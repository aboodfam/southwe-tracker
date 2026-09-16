/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import {
  EMPTY_DAY,
  taskKey,
  READY_TEMPLATES,
  type DayState,
} from "../convex/supportModel";
import { getUtcDateKey, shiftUtcDateKey } from "../convex/date";
import { validatePlan } from "../convex/planFormat";

test("saved and exported templates retain time estimates and smaller options", async () => {
  const { user } = await setup();
  await addStarter(user);
  const plan = validatePlan(
    JSON.parse(JSON.stringify(await user.query(api.workspace.getCurrentPlan))),
  );
  await user.mutation(api.workspace.importPlan, {
    plan,
    requestId: "round-trip",
  });
  const routines = await user.query(api.routines.getRoutines);
  expect(routines).toHaveLength(2);
  expect(routines[1].tasks[0]).toMatchObject({
    minutes: 25,
    fallbackName: "Review one page of that topic",
    fallbackMinutes: 5,
    completed: false,
  });
});

test("an invalid weekly time adjustment cannot save a partial review", async () => {
  const { user } = await setup();
  const routine = await addStarter(user);
  await expect(
    user.mutation(api.daySupport.saveReview, {
      dateKey: today,
      experiment: "Try mornings",
      reflection: "",
      routineId: routine._id,
      timeSlot: "",
    }),
  ).rejects.toThrow();
  expect(
    (await user.query(api.daySupport.weeklyReview, { dateKey: today }))?.saved,
  ).toBeNull();
  expect((await user.query(api.routines.getRoutines))[0].timeSlot).toBe(
    routine.timeSlot,
  );
});

test("out-of-window dates and duplicate adjustments are rejected", async () => {
  const { user } = await setup();
  const routine = await addStarter(user);
  const state = smaller(taskKey(routine._id, routine.tasks[0].id), "Study");
  await expect(
    user.mutation(api.daySupport.saveDay, {
      dateKey: shiftUtcDateKey(today, -3),
      expectedVersion: 0,
      state,
    }),
  ).rejects.toThrow(/window/);
  await expect(
    user.mutation(api.daySupport.saveDay, {
      dateKey: today,
      expectedVersion: 1,
      state: {
        ...state,
        adjustments: [...state.adjustments, ...state.adjustments],
      },
    }),
  ).rejects.toThrow(/one adjustment/);
});

const modules = import.meta.glob("../convex/**/*.{ts,js}");
const today = getUtcDateKey();
async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Test user" }),
  );
  const user = t.withIdentity({ subject: `${userId}|test-session` });
  const otherId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Other user" }),
  );
  const other = t.withIdentity({ subject: `${otherId}|other-session` });
  return { t, user, other, userId };
}
async function addStarter(
  user: Awaited<ReturnType<typeof setup>>["user"],
  requestId = "starter-test",
) {
  const starter = READY_TEMPLATES[0];
  await user.mutation(api.workspace.applyStarter, {
    name: starter.name,
    timeSlot: starter.timeSlot,
    tasks: starter.tasks,
    requestId,
    dateKey: today,
  });
  return (await user.query(api.routines.getRoutines))[0];
}
function smaller(key: string, title: string): DayState {
  return {
    ...EMPTY_DAY,
    focusKey: key,
    adjustments: [
      {
        key,
        title,
        mode: "step",
        reason: "time",
        step: "Review one page",
        stepDone: true,
      },
    ],
  };
}

test("template retries are idempotent and custom actions persist", async () => {
  const { user } = await setup();
  await addStarter(user);
  await addStarter(user);
  const routines = await user.query(api.routines.getRoutines);
  expect(routines).toHaveLength(1);
  expect(routines[0].tasks[0]).toMatchObject({
    minutes: 25,
    fallbackMinutes: 5,
    fallbackName: "Review one page of that topic",
    completed: false,
  });
  expect((await user.query(api.workspace.getPreferences))?.setupDone).toBe(
    true,
  );
});

test("a blank or invalid starter rolls back without partial items", async () => {
  const { user } = await setup();
  await expect(
    user.mutation(api.workspace.applyStarter, {
      dateKey: today,
      requestId: "bad",
      name: "Mine",
      timeSlot: "Morning",
      tasks: [{ name: "", minutes: 5 }],
    }),
  ).rejects.toThrow();
  expect(await user.query(api.routines.getRoutines)).toHaveLength(0);
});

test("smaller steps never complete or rename the original action", async () => {
  const { user } = await setup();
  const routine = await addStarter(user);
  const key = taskKey(routine._id, routine.tasks[0].id);
  await user.mutation(api.daySupport.saveDay, {
    dateKey: today,
    expectedVersion: 1,
    state: smaller(key, "Forged title"),
  });
  expect(
    (await user.query(api.routines.getRoutines))[0].tasks[0],
  ).toMatchObject({ name: routine.tasks[0].name, completed: false });
  expect(
    (await user.query(api.daySupport.getToday, { dateKey: today }))?.state
      .adjustments[0].title,
  ).toBe(routine.tasks[0].name);
  expect(
    await user.query(api.routines.getTodayProgress, { dateKey: today }),
  ).toBeNull();
});

test("cross-account focus, adjustments, and routine changes are rejected", async () => {
  const { user, other } = await setup();
  const routine = await addStarter(user);
  const key = taskKey(routine._id, routine.tasks[0].id);
  await expect(
    other.mutation(api.daySupport.saveDay, {
      dateKey: today,
      expectedVersion: 0,
      state: smaller(key, routine.tasks[0].name),
    }),
  ).rejects.toThrow();
  await expect(
    other.mutation(api.daySupport.saveReview, {
      dateKey: today,
      experiment: "Try mornings",
      reflection: "",
      routineId: routine._id,
      timeSlot: "Morning",
    }),
  ).rejects.toThrow();
  expect(
    (await other.query(api.daySupport.getToday, { dateKey: today }))?.state,
  ).toEqual(EMPTY_DAY);
});

test("stale changes and stale undo cannot overwrite newer changes", async () => {
  const { user } = await setup();
  const routine = await addStarter(user);
  const key = taskKey(routine._id, routine.tasks[0].id);
  const original = (await user.query(api.daySupport.getToday, {
    dateKey: today,
  }))!;
  const nextVersion = await user.mutation(api.daySupport.saveDay, {
    dateKey: today,
    expectedVersion: original.version,
    state: smaller(key, "Study"),
  });
  await expect(
    user.mutation(api.daySupport.saveDay, {
      dateKey: today,
      expectedVersion: original.version,
      state: EMPTY_DAY,
    }),
  ).rejects.toThrow(/another screen/);
  await user.mutation(api.daySupport.saveDay, {
    dateKey: today,
    expectedVersion: nextVersion,
    state: original.state,
  });
  expect(
    (await user.query(api.daySupport.getToday, { dateKey: today }))?.state
      .adjustments,
  ).toHaveLength(0);
});

test("yesterday's paused actions do not change today's plan", async () => {
  const { t, user, userId } = await setup();
  const routine = await addStarter(user);
  const key = taskKey(routine._id, routine.tasks[0].id);
  await t.run((ctx) =>
    ctx.db.insert("supportDays", {
      userId,
      date: shiftUtcDateKey(today, -1),
      version: 1,
      state: {
        ...EMPTY_DAY,
        adjustments: [
          {
            key,
            title: "Study",
            mode: "pause",
            reason: "time",
            step: "",
            stepDone: false,
          },
        ],
      },
    }),
  );
  expect(
    (await user.query(api.daySupport.getToday, { dateKey: today }))?.state
      .adjustments,
  ).toEqual([]);
});

test("friction requires three dates and stays dismissed until new evidence", async () => {
  const { t, user, userId } = await setup();
  const routine = await addStarter(user);
  const key = taskKey(routine._id, routine.tasks[0].id);
  for (const ago of [3, 2])
    await t.run((ctx) =>
      ctx.db.insert("supportDays", {
        userId,
        date: shiftUtcDateKey(today, -ago),
        version: 1,
        state: smaller(key, "Study"),
      }),
    );
  expect(
    (await user.query(api.daySupport.getToday, { dateKey: today }))?.patterns,
  ).toHaveLength(0);
  await t.run((ctx) =>
    ctx.db.insert("supportDays", {
      userId,
      date: shiftUtcDateKey(today, -1),
      version: 1,
      state: smaller(key, "Study"),
    }),
  );
  expect(
    (await user.query(api.daySupport.getToday, { dateKey: today }))?.patterns[0]
      .days,
  ).toBe(3);
  await user.mutation(api.daySupport.saveDay, {
    dateKey: today,
    expectedVersion: 1,
    state: { ...EMPTY_DAY, dismissedFriction: [key] },
  });
  expect(
    (await user.query(api.daySupport.getToday, { dateKey: today }))?.patterns,
  ).toHaveLength(0);
});

test("welcome-back survives daily reset and can be dismissed", async () => {
  const { t, user, userId } = await setup();
  await t.run((ctx) =>
    ctx.db.insert("dailyResetState", {
      userId,
      lastResetDate: shiftUtcDateKey(today, -9),
    }),
  );
  await user.mutation(api.daily.resetEverythingDaily, { dateKey: today });
  await user.mutation(api.daySupport.visitToday, { dateKey: today });
  expect(
    (await user.query(api.daySupport.getToday, { dateKey: today }))
      ?.showWelcome,
  ).toBe(true);
  await user.mutation(api.daySupport.visitToday, {
    dateKey: today,
    dismiss: true,
  });
  expect(
    (await user.query(api.daySupport.getToday, { dateKey: today }))
      ?.showWelcome,
  ).toBe(false);
});

test("review reports actual logs and distinct days without inventing missed actions", async () => {
  const { t, user, userId } = await setup();
  const routine = await addStarter(user);
  const yesterday = shiftUtcDateKey(today, -1),
    key = taskKey(routine._id, routine.tasks[0].id);
  await t.run(async (ctx) => {
    await ctx.db.insert("supportDays", {
      userId,
      date: yesterday,
      version: 1,
      state: smaller(key, "Study"),
    });
    await ctx.db.insert("dailyProgress", {
      userId,
      date: yesterday,
      completedTasks: 2,
      totalTasks: 4,
      completedRoutines: [],
      completionRate: 50,
    });
    await ctx.db.insert("dailyProgress", {
      userId,
      date: today,
      completedTasks: 5,
      totalTasks: 5,
      completedRoutines: [],
      completionRate: 100,
    });
  });
  const review = await user.query(api.daySupport.weeklyReview, {
    dateKey: today,
  });
  expect(review?.current).toEqual({
    activeDays: 1,
    tasks: 2,
    habits: 0,
    workouts: 0,
    smallSteps: 1,
  });
  expect(review?.previous.activeDays).toBe(0);
});

test("weekly experiment and requested routine-time change save together", async () => {
  const { user } = await setup();
  const routine = await addStarter(user);
  await user.mutation(api.daySupport.saveReview, {
    dateKey: today,
    experiment: "Study after breakfast",
    reflection: "Evenings were busy",
    routineId: routine._id,
    timeSlot: "After breakfast",
  });
  expect((await user.query(api.routines.getRoutines))[0].timeSlot).toBe(
    "After breakfast",
  );
  expect(
    (await user.query(api.daySupport.getToday, { dateKey: today }))?.experiment
      ?.experiment,
  ).toBe("Study after breakfast");
});

test("unauthenticated requests cannot save data", async () => {
  const { t } = await setup();
  await expect(
    t.mutation(api.daySupport.saveDay, {
      dateKey: today,
      expectedVersion: 0,
      state: EMPTY_DAY,
    }),
  ).rejects.toThrow(/authenticated/);
  expect(await t.query(api.daySupport.getToday, { dateKey: today })).toBeNull();
});

test("account deletion includes all new support records", async () => {
  const { t, user, userId } = await setup();
  await addStarter(user);
  await user.mutation(api.daySupport.visitToday, { dateKey: today });
  await user.mutation(api.daySupport.saveReview, {
    dateKey: today,
    experiment: "Keep it small",
    reflection: "",
  });
  await user.mutation(api.account.deleteMyAccount, { confirmation: "DELETE" });
  const remaining = await t.run(async (ctx) =>
    Promise.all(
      ["supportDays", "supportVisits", "weeklyReviews"].map(
        async (table) =>
          (await ctx.db.query(table as "supportDays").collect()).filter(
            (row) => row.userId === userId,
          ).length,
      ),
    ),
  );
  expect(remaining).toEqual([0, 0, 0]);
});
