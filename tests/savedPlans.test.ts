/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import {
  SAVE_CATEGORIES,
  selectSaveCategory,
  validatePlan,
} from "../convex/planFormat";
const modules = import.meta.glob("../convex/**/*.{ts,js}");
async function setup() {
  const db = convexTest(schema, modules);
  const [ownerId, otherId] = await db.run(async (ctx) => [
    await ctx.db.insert("users", { name: "Owner" }),
    await ctx.db.insert("users", { name: "Other" }),
  ]);
  const owner = db.withIdentity({ subject: `${ownerId}|test` });
  const other = db.withIdentity({ subject: `${otherId}|test` });
  await db.run(async (ctx) => {
    for (const [name, timeSlot] of [
      ["Morning block", "Morning"],
      ["Top Priorities", "Flexible"],
      ["Other Tasks", "Flexible"],
    ]) {
      await ctx.db.insert("routines", {
        userId: ownerId,
        name,
        timeSlot,
        isActive: true,
        tasks: [
          {
            id: name,
            name: "Read",
            completed: true,
            order: 4,
            minutes: 10,
            fallbackName: "Read a page",
            fallbackMinutes: 2,
          },
        ],
      });
    }
    for (let i = 0; i < 7; i++)
      await ctx.db.insert("workoutDays", {
        userId: ownerId,
        name: `Day ${i + 1}`,
        order: i,
        isActive: true,
        exercises: [
          {
            id: `ex${i}`,
            name: "Push-ups",
            sets: 3,
            reps: "10",
            weight: 5,
            notes: "Steady",
            order: 0,
          },
        ],
      });
    for (const category of ["custom", "custom", "morning", "prayer"])
      await ctx.db.insert("athkar", {
        userId: ownerId,
        category,
        text: "سبحان الله\nوالحمد لله",
        translation: "Glory and praise to Allah",
        targetCount: 33,
        currentCount: 9,
        isCompleted: false,
      });
  });
  return { db, owner, other, ownerId, otherId };
}

test("each of the four save categories captures the complete category without progress or built-in Athkar", async () => {
  const { owner, other, db } = await setup();
  const current = await owner.query(api.workspace.getCurrentPlan);
  expect(SAVE_CATEGORIES).toEqual(["blocks", "flexible", "workouts", "athkar"]);
  expect(
    selectSaveCategory(current, "blocks").routines.map((r) => r.name),
  ).toEqual(["Morning block"]);
  expect(
    selectSaveCategory(current, "flexible").routines.map((r) => r.name),
  ).toEqual(["Top Priorities", "Other Tasks"]);
  expect(selectSaveCategory(current, "workouts").workouts).toHaveLength(7);
  expect(selectSaveCategory(current, "athkar")).toMatchObject({
    routines: [],
    workouts: [],
    athkar: [{ targetCount: 33 }, { targetCount: 33 }],
  });
  expect(JSON.stringify(current)).not.toMatch(
    /currentCount|isCompleted|userId|"completed"/,
  );
  for (const category of SAVE_CATEGORIES) {
    const plan = validatePlan(
      JSON.parse(JSON.stringify(selectSaveCategory(current, category))),
    );
    await owner.mutation(api.workspace.saveTemplate, { name: category, plan });
  }
  expect(await owner.query(api.workspace.listTemplates)).toHaveLength(4);
  expect(await other.query(api.workspace.listTemplates)).toHaveLength(0);
  await expect(
    db.mutation(api.workspace.saveTemplate, {
      name: "no",
      plan: selectSaveCategory(current, "athkar"),
    }),
  ).rejects.toThrow(/authenticated/);
});

test("custom Athkar save/import/export retains text, translation and targets, starts fresh, and is idempotent", async () => {
  const { owner, other } = await setup();
  const current = await owner.query(api.workspace.getCurrentPlan);
  const plan = validatePlan(
    JSON.parse(JSON.stringify(selectSaveCategory(current, "athkar"))),
  );
  expect(plan.athkar?.[0].text).toBe("سبحان الله\nوالحمد لله");
  const args = { plan, requestId: "athkar-roundtrip" };
  expect(await other.mutation(api.workspace.importPlan, args)).toEqual({
    routines: 0,
    workouts: 0,
    athkar: 2,
  });
  await other.mutation(api.workspace.importPlan, args);
  const added = await other.query(api.athkar.getAthkar);
  expect(added).toHaveLength(2);
  expect(added[0]).toMatchObject({
    category: "custom",
    targetCount: 33,
    currentCount: 0,
    isCompleted: false,
    translation: "Glory and praise to Allah",
  });
  expect((await owner.query(api.athkar.getAthkar))[0].currentCount).toBe(9);
});

test("the whole workout is loaded together and legacy version-one files still work", async () => {
  const { owner, other } = await setup();
  const current = await owner.query(api.workspace.getCurrentPlan);
  const plan = selectSaveCategory(current, "workouts");
  expect(plan.athkar).toBeUndefined();
  expect(validatePlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
  await other.mutation(api.workspace.importPlan, {
    plan,
    requestId: "whole-workout",
  });
  await other.mutation(api.workspace.importPlan, {
    plan,
    requestId: "whole-workout",
  });
  const days = await other.query(api.workouts.getWorkoutDays);
  expect(days).toHaveLength(7);
  expect(days[0].exercises[0]).toMatchObject({
    name: "Push-ups",
    sets: 3,
    reps: "10",
    weight: 5,
    notes: "Steady",
  });
  expect(days[0].exercises[0].id).not.toBe("ex0");
});

test("loading flexible tasks reuses the two accessible sections and preserves existing tasks and checkmarks", async () => {
  const { owner } = await setup();
  const current = await owner.query(api.workspace.getCurrentPlan);
  const args = {
    plan: selectSaveCategory(current, "flexible"),
    requestId: "flexible",
  };
  await owner.mutation(api.workspace.importPlan, args);
  await owner.mutation(api.workspace.importPlan, args);
  const routines = await owner.query(api.routines.getRoutines);
  expect(routines).toHaveLength(3);
  const flexible = routines.find((r) => r.name === "Top Priorities")!;
  expect(flexible.tasks).toHaveLength(2);
  expect(flexible.tasks[0]).toMatchObject({
    id: "Top Priorities",
    completed: true,
    order: 4,
  });
  expect(flexible.tasks[1]).toMatchObject({
    completed: false,
    order: 5,
    minutes: 10,
    fallbackMinutes: 2,
  });
});

test("custom-Athkar validation rejects invalid counts and oversize text; capacity failures are atomic", async () => {
  const base = {
    version: 1,
    routines: [],
    workouts: [],
    athkar: [{ text: "ذكر", targetCount: 1 }],
  };
  for (const targetCount of [0, 1001, 1.5, "3"])
    expect(() =>
      validatePlan({ ...base, athkar: [{ text: "ذكر", targetCount }] }),
    ).toThrow(/target/);
  expect(() =>
    validatePlan({
      ...base,
      athkar: [{ text: "x".repeat(5001), targetCount: 1 }],
    }),
  ).toThrow();
  const { db, other, otherId } = await setup();
  await db.run(async (ctx) => {
    for (let i = 0; i < 160; i++)
      await ctx.db.insert("athkar", {
        userId: otherId,
        category: "custom",
        text: "ذكر",
        targetCount: 1,
        currentCount: 0,
        isCompleted: false,
      });
  });
  await expect(
    other.mutation(api.workspace.importPlan, {
      requestId: "full",
      plan: {
        ...base,
        version: 1,
        routines: [
          { name: "Must not appear", timeSlot: "Morning", tasks: ["Task"] },
        ],
      },
    }),
  ).rejects.toThrow(/space/);
  expect(await other.query(api.routines.getRoutines)).toHaveLength(0);
});
