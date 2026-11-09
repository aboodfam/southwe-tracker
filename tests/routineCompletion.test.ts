/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { getUtcDateKey } from "../convex/date";
const modules = import.meta.glob("../convex/**/*.{ts,js}");
const dateKey = getUtcDateKey();
async function setup(completed = true) {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Owner" }),
  );
  const user = t.withIdentity({ subject: `${userId}|session` });
  const routineId = await t.run((ctx) =>
    ctx.db.insert("routines", {
      userId,
      name: "Block",
      timeSlot: "Morning",
      isActive: true,
      tasks: [{ id: "one", name: "Task", completed, order: 0 }],
    }),
  );
  await user.mutation(api.routines.ensureUserStats, {});
  return { t, user, routineId, userId };
}
test("a completed routine day remains locked without raising a server error", async () => {
  const { t, user, routineId } = await setup();
  await user.mutation(api.routines.completeDay, { dateKey });
  const before = await user.query(api.routines.getTodayProgress, { dateKey });
  const statsBefore = await user.query(api.routines.getUserStats, {});
  for (let i = 0; i < 3; i++)
    expect(
      await user.mutation(api.routines.toggleTask, {
        routineId,
        taskId: "one",
        dateKey,
      }),
    ).toEqual({ locked: true });
  expect(
    (await t.run((ctx) => ctx.db.get(routineId)))!.tasks[0].completed,
  ).toBe(true);
  expect(await user.query(api.routines.getTodayProgress, { dateKey })).toEqual(
    before,
  );
  expect(await user.query(api.routines.getUserStats, {})).toEqual(statsBefore);
});
test("an open day still allows checking and unchecking before completion", async () => {
  const { t, user, routineId } = await setup(false);
  for (const expected of [true, false]) {
    expect(
      await user.mutation(api.routines.toggleTask, {
        routineId,
        taskId: "one",
        dateKey,
      }),
    ).toEqual({ locked: false });
    expect(
      (await t.run((ctx) => ctx.db.get(routineId)))!.tasks[0].completed,
    ).toBe(expected);
  }
});
test("the completed-day no-op preserves ownership and authentication checks", async () => {
  const { t, user, routineId } = await setup();
  await user.mutation(api.routines.completeDay, { dateKey });
  await expect(
    t.mutation(api.routines.toggleTask, { routineId, taskId: "one", dateKey }),
  ).rejects.toThrow(/authenticated/);
  const otherId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Other" }),
  );
  const other = t.withIdentity({ subject: `${otherId}|other-session` });
  await expect(
    other.mutation(api.routines.toggleTask, {
      routineId,
      taskId: "one",
      dateKey,
    }),
  ).rejects.toThrow(/not found/);
});
