/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { HOME_SECTIONS, normalizeHomeLayout } from "../convex/homeLayout";
import { PAGES, visibleStartPage } from "../convex/planFormat";
import { getUtcDateKey } from "../convex/date";
import { hasHomeActivity, keepAvailableFocus } from "../src/lib/homeOverview";
import type { ProgressDay } from "../convex/progressMath";
const modules = import.meta.glob("../convex/**/*.{ts,js}");

test("Home retains old routes and normalizes missing or partial layouts", () => {
  expect(PAGES[0]).toEqual({ id: "routines", name: "Routines" });
  expect(visibleStartPage(["today"], "today")).toBe("routines");
  const defaults = HOME_SECTIONS.map((row) => row.id);
  expect(normalizeHomeLayout()).toEqual({ order: defaults, hidden: [] });
  expect(
    normalizeHomeLayout(["workout", "workout", "focus"], ["tasks", "tasks"]),
  ).toEqual({
    order: ["workout", "focus", "consistency", "athkar", "routines", "tasks"],
    hidden: ["tasks"],
  });
});

test("Home order and visibility persist per account without overwriting navigation preferences", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { name: "One" }));
  const otherId = await t.run((ctx) => ctx.db.insert("users", { name: "Two" }));
  const user = t.withIdentity({ subject: `${userId}|one` });
  const other = t.withIdentity({ subject: `${otherId}|two` });
  await user.mutation(api.workspace.savePreferences, {
    hiddenPages: ["athkar"],
    startPage: "workout",
  });
  const order = HOME_SECTIONS.map((row) => row.id).reverse();
  await user.mutation(api.workspace.saveHomeLayout, {
    order,
    hidden: ["focus", "athkar"],
  });
  expect(await user.query(api.workspace.getPreferences)).toMatchObject({
    homeOrder: order,
    homeHidden: ["focus", "athkar"],
    hiddenPages: ["athkar"],
    startPage: "workout",
  });
  expect(await other.query(api.workspace.getPreferences)).toMatchObject({
    homeOrder: HOME_SECTIONS.map((row) => row.id),
    homeHidden: [],
  });
  await user.mutation(api.workspace.savePreferences, {
    hiddenPages: [],
    startPage: "routines",
  });
  expect(await user.query(api.workspace.getPreferences)).toMatchObject({
    homeOrder: order,
    homeHidden: ["focus", "athkar"],
  });
  await expect(
    user.mutation(api.workspace.saveHomeLayout, {
      order: ["tasks"],
      hidden: [],
    }),
  ).rejects.toThrow(/exactly once/);
  await expect(
    user.mutation(api.workspace.saveHomeLayout, { order, hidden: order }),
  ).rejects.toThrow(/at least one/);
  await expect(
    t.mutation(api.workspace.saveHomeLayout, { order, hidden: [] }),
  ).rejects.toThrow(/authenticated/);
  expect(await user.query(api.workspace.getPreferences)).toMatchObject({
    homeOrder: order,
    homeHidden: ["focus", "athkar"],
  });
});

test("a chosen Home focus persists with check-offs and lighter-day adjustments", async () => {
  const t = convexTest(schema, modules);
  const id = await t.run((ctx) => ctx.db.insert("users", { name: "One" }));
  const user = t.withIdentity({ subject: `${id}|one` });
  const dateKey = getUtcDateKey();
  await user.mutation(api.workspace.applyStarter, {
    name: "Morning",
    timeSlot: "Morning",
    tasks: [{ name: "Prepare" }, { name: "Start" }],
    dateKey,
    requestId: "home-test",
  });
  const [routine] = await user.query(api.routines.getRoutines);
  const key = `task:${routine._id}:${routine.tasks[1].id}`;
  const saved = (await user.query(api.daySupport.getToday, { dateKey }))!;
  await user.mutation(api.daySupport.saveDay, {
    dateKey,
    expectedVersion: saved.version,
    state: { ...saved.state, focusKey: key },
  });
  await user.mutation(api.routines.toggleTask, {
    dateKey,
    routineId: routine._id,
    taskId: routine.tasks[0].id,
  });
  const state = (await user.query(api.daySupport.getToday, { dateKey }))!;
  await user.mutation(api.daySupport.saveDay, {
    dateKey,
    expectedVersion: state.version,
    state: {
      ...state.state,
      adjustments: [
        {
          key: `task:${routine._id}:${routine.tasks[0].id}`,
          title: "Prepare",
          reason: "time",
          mode: "pause",
          step: "",
          stepDone: false,
        },
      ],
    },
  });
  expect(
    (await user.query(api.daySupport.getToday, { dateKey }))?.state.focusKey,
  ).toBe(key);
  expect(
    (await user.query(api.routines.getRoutines))[0].tasks[0].completed,
  ).toBe(true);
  await user.mutation(api.routines.deleteTask, {
    routineId: routine._id,
    taskId: routine.tasks[1].id,
  });
  const afterDelete = (await user.query(api.daySupport.getToday, { dateKey }))!;
  await user.mutation(api.daySupport.saveDay, {
    dateKey,
    expectedVersion: afterDelete.version,
    state: keepAvailableFocus(afterDelete.state, [
      `task:${routine._id}:${routine.tasks[0].id}`,
    ]),
  });
  expect(
    (await user.query(api.daySupport.getToday, { dateKey }))?.state.focusKey,
  ).toBe("");
});

test("weekly consistency counts actual activity and respects hidden modules", () => {
  const day: ProgressDay = {
    date: "2026-11-08",
    routines: null,
    habits: null,
    workouts: null,
    tasksDone: 0,
    habitsDone: 0,
    exercisesDone: 0,
    workoutsCompleted: 0,
  };
  expect(hasHomeActivity(day, [])).toBe(false);
  expect(hasHomeActivity({ ...day, tasksDone: 1 }, [])).toBe(true);
  expect(hasHomeActivity({ ...day, tasksDone: 1 }, ["routines"])).toBe(false);
  expect(hasHomeActivity({ ...day, exercisesDone: 1 }, [])).toBe(true);
  expect(hasHomeActivity({ ...day, habitsDone: 1 }, ["habits"])).toBe(false);
});


test("an old Home start page falls back to a visible app section without losing preferences", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(ctx => ctx.db.insert("users", {name: "Legacy"}));
  const id = await t.run(ctx => ctx.db.insert("workspacePreferences", {userId, startPage: "today", hiddenPages: ["today", "routines"], setupDone: true, homeOrder: ["athkar"], homeHidden: ["focus"]}));
  const user = t.withIdentity({subject: `${userId}|legacy`});
  expect(await user.query(api.workspace.getPreferences)).toMatchObject({startPage: "workout", hiddenPages: ["routines"], homeHidden: ["focus"]});
  expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({startPage: "today", setupDone: true, homeOrder: ["athkar"]});
});
