/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { getAthkarWindowKey, getScheduledAthkarWindow, SCHEDULED_ATHKAR_STARTS } from "../src/lib/athkarSchedule";
import { pageMotion, swipeNavigation } from "../src/lib/navigation";
import { getLocale, setLocale } from "../src/i18n";
import { muscleLabel } from "../src/i18n/fitness";
const modules = import.meta.glob("../convex/**/*.{ts,js}");
async function setup() {
  const db = convexTest(schema, modules);
  const userId = await db.run(ctx => ctx.db.insert("users", { name: "Tester" }));
  const user = db.withIdentity({ subject: `${userId}|test` });
  const insert = (category: string, count = 0) => db.run(ctx => ctx.db.insert("athkar", {
    userId, category, text: "سبحان الله", targetCount: 30, currentCount: count, isCompleted: count >= 30,
  }));
  return { db, userId, user, insert };
}

test("incomplete progress resets in the next occurrence but survives refreshes within one occurrence", async () => {
  const { db, user, insert } = await setup();
  const id = await insert("evening");
  await user.mutation(api.athkar.prepareCategorySession, {category: "evening", windowKey: "2026-11-03"});
  await user.mutation(api.athkar.incrementCount, { dhikrId: id });
  await user.mutation(api.athkar.saveCategoryIndex, { category: "evening", currentIndex: 0 });
  await user.mutation(api.athkar.prepareCategorySession, {category: "evening", windowKey: "2026-11-03"});
  expect((await db.run(ctx => ctx.db.get(id)))?.currentCount).toBe(1);
  const fresh = await user.mutation(api.athkar.prepareCategorySession, {category: "evening", windowKey: "2026-11-04"});
  expect(fresh).toMatchObject({ activeWindowKey: "2026-11-04", completed: false, currentIndex: 0 });
  expect((await db.run(ctx => ctx.db.get(id)))?.currentCount).toBe(0);
});

test("a stale tab cannot reset a newer occurrence or mark it complete under yesterday's date", async () => {
  const { db, user, insert } = await setup();
  const id = await insert("morning");
  await user.mutation(api.athkar.prepareCategorySession, {category: "morning", windowKey: "2026-11-04"});
  await db.run(ctx => ctx.db.patch(id, { currentCount: 30, isCompleted: true }));
  const stale = await user.mutation(api.athkar.prepareCategorySession, {category: "morning", windowKey: "2026-11-03"});
  expect(stale?.activeWindowKey).toBe("2026-11-04");
  expect((await db.run(ctx => ctx.db.get(id)))?.currentCount).toBe(30);
  expect(await user.mutation(api.athkar.markCategoryCompleted, {category: "morning", windowKey: "2026-11-03"})).toEqual({completed: false});
  expect(await user.mutation(api.athkar.markCategoryCompleted, {category: "morning", windowKey: "2026-11-04"})).toEqual({completed: true});
  await user.mutation(api.athkar.prepareCategorySession, {category: "morning", windowKey: "2026-11-04"});
  expect((await db.run(ctx => ctx.db.get(id)))?.currentCount).toBe(30);
  await user.mutation(api.athkar.prepareCategorySession, {category: "morning", windowKey: "2026-11-05"});
  expect((await db.run(ctx => ctx.db.get(id)))?.currentCount).toBe(0);
});

test("legacy unfinished sessions cannot carry weeks-old counts forever; custom and prayer progress stay separate", async () => {
  const { db, userId, user, insert } = await setup();
  const old = await insert("evening", 29);
  const custom = await insert("custom", 7);
  const prayer = await insert("prayer", 5);
  await db.run(ctx => ctx.db.insert("athkarSessions", {
    userId, category: "evening", sessionKey: "active", currentIndex: 20, completed: false, updatedAt: 1,
  }));
  await user.mutation(api.athkar.prepareCategorySession, {category: "evening", windowKey: "2026-11-04"});
  expect((await db.run(ctx => ctx.db.get(old)))?.currentCount).toBe(0);
  expect((await db.run(ctx => ctx.db.get(custom)))?.currentCount).toBe(7);
  expect((await db.run(ctx => ctx.db.get(prayer)))?.currentCount).toBe(5);
  await expect(user.mutation(api.athkar.prepareCategorySession, {category: "custom", windowKey: "2026-11-04"})).rejects.toThrow(/scheduled/);
});

test("a legacy session completed in the current window stays complete", async () => {
  const { db, userId, user, insert } = await setup();
  const id = await insert("morning", 30);
  await db.run(ctx => ctx.db.insert("athkarSessions", {
    userId, category: "morning", sessionKey: "active", currentIndex: 0, completed: true,
    completedWindowKey: "2026-11-04", updatedAt: 1,
  }));
  const result = await user.mutation(api.athkar.prepareCategorySession, { category: "morning", windowKey: "2026-11-04" });
  expect(result).toMatchObject({ completed: true, activeWindowKey: "2026-11-04" });
  expect((await db.run(ctx => ctx.db.get(id)))?.currentCount).toBe(30);
});

test("preparing another user's category cannot touch this user's records", async () => {
  const { db, insert } = await setup();
  const id = await insert("evening", 29);
  const otherId = await db.run(ctx => ctx.db.insert("users", { name: "Other" }));
  const other = db.withIdentity({subject: `${otherId}|test`});
  await other.mutation(api.athkar.prepareCategorySession, { category: "evening", windowKey: "2026-11-04" });
  expect((await db.run(ctx => ctx.db.get(id)))?.currentCount).toBe(29);
  await expect(db.mutation(api.athkar.prepareCategorySession, { category: "evening", windowKey: "2026-11-04" })).rejects.toThrow(/authenticated/);
});

test("each category starts a fresh occurrence at its local start, including sleeping after midnight", () => {
  for (const [category, hour] of Object.entries(SCHEDULED_ATHKAR_STARTS)) {
    const key = category as keyof typeof SCHEDULED_ATHKAR_STARTS;
    expect(getAthkarWindowKey(key, new Date(2026, 10, 4, hour - 1, 59))).toBe("2026-11-03");
    expect(getAthkarWindowKey(key, new Date(2026, 10, 4, hour))).toBe("2026-11-04");
  }
  expect(getAthkarWindowKey("before_sleep", new Date(2026, 10, 4, 0, 30))).toBe("2026-11-03");
  expect(getAthkarWindowKey("morning", new Date(2027, 0, 1, 4))).toBe("2026-12-31");
  for (const hour of [1, 5, 12, 18]) {
    const date = new Date(2026, 10, 4, hour);
    const scheduled = getScheduledAthkarWindow(date)!;
    expect(scheduled.windowKey).toBe(getAthkarWindowKey(scheduled.category, date));
  }
});

test("swipe motion and page order stay consistent across all interface languages", () => {
  const previous = getLocale();
  try {
    for (const locale of ["en", "ar", "es", "fr", "zh"] as const) {
      setLocale(locale);
      expect(swipeNavigation(-80)).toEqual({next: true, motion: "left"});
      expect(swipeNavigation(80)).toEqual({next: false, motion: "right"});
      expect(pageMotion(0, 1)).toBe("left");
      expect(pageMotion(1, 0)).toBe("right");
    }
  } finally { setLocale(previous); }
});

test("fitness labels use the muscle meaning of Back, familiar Arabic terms, and preserve custom names", () => {
  const previous = getLocale();
  try {
    setLocale("ar");
    expect(muscleLabel("Back")).toBe("الظهر");
    expect(muscleLabel("Biceps")).toBe("البايسبس");
    expect(muscleLabel("Back, Biceps")).toBe("الظهر، البايسبس");
    expect(muscleLabel("Forearms / Grip")).toBe("السواعد والقبضة");
    expect(muscleLabel("My custom group")).toBe("My custom group");
    setLocale("en");
    expect(muscleLabel("Back")).toBe("Back");
  } finally { setLocale(previous); }
});
