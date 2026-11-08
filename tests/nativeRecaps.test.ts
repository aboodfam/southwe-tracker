/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { getUtcDateKey, shiftUtcDateKey } from "../convex/date";
import {
  closedRecapPeriods,
  hashDeviceToken,
} from "../convex/nativeRecapModel";
const modules = import.meta.glob("../convex/**/*.{ts,js}");
const token = "A".repeat(43);
const today = getUtcDateKey();
async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { name: "One" }));
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 86400000,
    }),
  );
  const user = t.withIdentity({ subject: `${userId}|${sessionId}` });
  const hash = await hashDeviceToken(token);
  return { t, userId, sessionId, user, hash };
}
const connect = (
  user: Awaited<ReturnType<typeof setup>>["user"],
  hash: string,
) =>
  user.mutation(api.nativeRecaps.connectDevice, {
    tokenHash: hash,
    label: "Test phone",
    accentHex: "#82FF34",
    locale: "ar",
  });

test("closed periods exclude the current day, week and month across year/leap boundaries", () => {
  expect(closedRecapPeriods("2024-03-01")).toEqual([
    { kind: "month", start: "2024-02-01", end: "2024-02-29" },
    { kind: "week", start: "2024-02-19", end: "2024-02-25" },
    { kind: "day", start: "2024-02-29", end: "2024-02-29" },
  ]);
  expect(closedRecapPeriods("2026-01-05")[1]).toEqual({
    kind: "week",
    start: "2025-12-29",
    end: "2026-01-04",
  });
  expect(closedRecapPeriods("2026-01-01")[0]).toEqual({
    kind: "month",
    start: "2025-12-01",
    end: "2025-12-31",
  });
});
test("device connection is authenticated, session-bound, bounded and cannot overwrite another account", async () => {
  const { t, user, userId, hash } = await setup();
  await expect(connect(t as never, hash)).rejects.toThrow(/authenticated/);
  await expect(connect(user, "bad")).rejects.toThrow(/Invalid/);
  await connect(user, hash);
  const otherId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Other" }),
  );
  const otherSession = await t.run((ctx) =>
    ctx.db.insert("authSessions", {
      userId: otherId,
      expirationTime: Date.now() + 86400000,
    }),
  );
  const other = t.withIdentity({ subject: `${otherId}|${otherSession}` });
  await expect(connect(other, hash)).rejects.toThrow(/previous account/);
  await other.mutation(api.nativeRecaps.disconnectDevice, { tokenHash: hash });
  expect(
    await t.query(internal.nativeRecaps.readDeviceRecaps, {
      tokenHash: hash,
      dateKey: today,
    }),
  ).toMatchObject({ userId });
  for (let i = 1; i < 5; i++)
    await connect(user, await hashDeviceToken(String(i).repeat(43)));
  await expect(
    connect(user, await hashDeviceToken("Z".repeat(43))),
  ).rejects.toThrow(/Five/);
  const device = (await user.query(api.nativeRecaps.listDevices))[0];
  await expect(
    other.mutation(api.nativeRecaps.revokeDevice, { deviceId: device.id }),
  ).rejects.toThrow(/Device not found/);
  await user.mutation(api.nativeRecaps.revokeDevice, { deviceId: device.id });
  await user.mutation(api.nativeRecaps.disconnectDevice, { tokenHash: hash });
  expect(
    await t.query(internal.nativeRecaps.readDeviceRecaps, {
      tokenHash: hash,
      dateKey: today,
    }),
  ).toBeNull();
});
test("HTTP capability returns only its own closed-period totals, including pending live checks, without resetting anything", async () => {
  const { t, user, userId, hash } = await setup();
  await connect(user, hash);
  const yesterday = shiftUtcDateKey(today, -1);
  const routineId = await t.run((ctx) =>
    ctx.db.insert("routines", {
      userId,
      name: "Private task names stay off the endpoint",
      timeSlot: "Morning",
      isActive: true,
      tasks: [
        { id: "one", name: "secret task", order: 0, completed: true },
        { id: "two", name: "other", order: 1, completed: false },
      ],
    }),
  );
  await t.run(async (ctx) => {
    await ctx.db.insert("dailyResetState", {
      userId,
      lastResetDate: yesterday,
    });
    await ctx.db.insert("dailyProgress", {
      userId,
      date: yesterday,
      completedRoutines: [],
      completionRate: 0,
      totalTasks: 2,
      completedTasks: 0,
      countedInStats: false,
    });
    await ctx.db.insert("dailyProgress", {
      userId,
      date: today,
      completedRoutines: [],
      completionRate: 100,
      totalTasks: 99,
      completedTasks: 99,
      countedInStats: true,
    });
    await ctx.db.insert("athkarCompletions", {
      userId,
      date: yesterday,
      category: "morning",
      sessionKey: `morning:${yesterday}`,
      completedAt: Date.now(),
    });
  });
  const response = await t.fetch("/android/recaps", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dateKey: today, userId: "not-used" }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  const data = await response.json();
  expect(data.userId).toBe(userId);
  expect(data.accentHex).toBe("#82FF34");
  expect(
    data.periods.find((p: { kind: string }) => p.kind === "day"),
  ).toMatchObject({ tasks: 1, athkar: 1, start: yesterday, end: yesterday });
  expect(JSON.stringify(data)).not.toContain("secret task");
  expect(JSON.stringify(data)).not.toContain(hash);
  expect(JSON.stringify(data)).not.toContain(token);
  expect(
    (await t.run((ctx) => ctx.db.get(routineId)))?.tasks[0].completed,
  ).toBe(true);
  expect(
    (await t.run((ctx) => ctx.db.query("dailyResetState").first()))
      ?.lastResetDate,
  ).toBe(yesterday);
  for (const request of [
    { headers: {} },
    { headers: { Authorization: `Bearer ${"B".repeat(43)}` } },
  ])
    expect(
      (
        await t.fetch("/android/recaps", {
          method: "POST",
          ...request,
          body: JSON.stringify({ dateKey: today }),
        })
      ).status,
    ).toBe(401);
  expect(
    (
      await t.fetch("/android/recaps", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dateKey: "2050-01-01" }),
      })
    ).status,
  ).toBe(400);
});
test("sign-out/session revocation, credential expiry and account deletion revoke device reads", async () => {
  const { t, user, userId, hash, sessionId } = await setup();
  await connect(user, hash);
  await t.run((ctx) => ctx.db.delete(sessionId));
  expect(
    await t.query(internal.nativeRecaps.readDeviceRecaps, {
      tokenHash: hash,
      dateKey: today,
    }),
  ).toBeNull();
  const replacement = await t.run((ctx) =>
    ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 86400000,
    }),
  );
  const signed = t.withIdentity({ subject: `${userId}|${replacement}` });
  await connect(signed, hash);
  await t.run(async (ctx) => {
    const d = await ctx.db.query("nativeDevices").first();
    await ctx.db.patch(d!._id, { expiresAt: Date.now() - 1 });
  });
  expect(
    await t.query(internal.nativeRecaps.readDeviceRecaps, {
      tokenHash: hash,
      dateKey: today,
    }),
  ).toBeNull();
  await connect(signed, hash);
  await signed.mutation(api.account.deleteMyAccount, {
    confirmation: "DELETE",
  });
  expect(await t.run((ctx) => ctx.db.query("nativeDevices").collect())).toEqual(
    [],
  );
});
test("scheduled and prayer Athkar completion history is idempotent", async () => {
  const { t, user, userId } = await setup();
  await t.run(async (ctx) => {
    await ctx.db.insert("athkar", {
      userId,
      category: "morning",
      text: "ذكر",
      targetCount: 1,
      currentCount: 1,
      isCompleted: true,
    });
    await ctx.db.insert("athkarSessions", {
      userId,
      category: "morning",
      sessionKey: "active",
      currentIndex: 0,
      completed: false,
      activeWindowKey: today,
      updatedAt: Date.now(),
    });
  });
  await user.mutation(api.athkar.markCategoryCompleted, {
    category: "morning",
    windowKey: today,
  });
  await user.mutation(api.athkar.markCategoryCompleted, {
    category: "morning",
    windowKey: today,
  });
  const dhikrId = await t.run((ctx) =>
    ctx.db.insert("athkar", {
      userId,
      category: "prayer",
      text: "الحمد لله",
      targetCount: 1,
      currentCount: 0,
      isCompleted: false,
    }),
  );
  await user.mutation(api.athkar.incrementPrayerSession, {
    sessionKey: `prayer:${today}:fajr`,
    dhikrId,
  });
  await user.mutation(api.athkar.incrementPrayerSession, {
    sessionKey: `prayer:${today}:fajr`,
    dhikrId,
  });
  expect(
    await t.run((ctx) => ctx.db.query("athkarCompletions").collect()),
  ).toHaveLength(2);
});
