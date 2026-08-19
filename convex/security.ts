import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getUtcDateKey, diffUtcDateKeys, assertDateKey } from "./date";

/** Product-level guardrails. These are intentionally generous for normal use. */
export const LIMITS = {
  routines: 24,
  tasksPerRoutine: 64,
  habits: 50,
  habitEntriesPerHabit: 800,
  workoutDays: 14,
  exercisesPerWorkoutDay: 80,
  athkarTotal: 160,
  routineName: 80,
  timeSlot: 48,
  taskName: 180,
  habitName: 100,
  workoutDayName: 80,
  warmupNotes: 1200,
  exerciseName: 120,
  reps: 48,
  muscles: 160,
  exerciseNotes: 1200,
  dhikrText: 5000,
  dhikrTranslation: 3000,
  dhikrCategory: 40,
  profileName: 32,
} as const;

export function cleanText(
  value: string,
  label: string,
  maxLength: number,
  options: { minLength?: number; allowEmpty?: boolean } = {},
) {
  const text = value.trim().replace(/\s+/g, " ");
  const minLength = options.minLength ?? (options.allowEmpty ? 0 : 1);

  if (text.length < minLength) {
    throw new Error(`${label} is required`);
  }
  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or less`);
  }
  return text;
}

/** Keep intentional line breaks in long-form notes/content while still bounding size. */
export function cleanLongText(value: string, label: string, maxLength: number): string;
export function cleanLongText(
  value: string,
  label: string,
  maxLength: number,
  options: { optional: true },
): string | undefined;
export function cleanLongText(
  value: string,
  label: string,
  maxLength: number,
  options: { optional?: boolean } = {},
): string | undefined {
  const text = value.replace(/\r\n/g, "\n").trim();
  if (!text) {
    if (options.optional) return undefined;
    throw new Error(`${label} is required`);
  }
  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or less`);
  }
  return text;
}


export function assertShortId(value: string, label = "Identifier", maxLength = 128) {
  if (!value || value.length > maxLength || /\s/.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

export function assertIntegerInRange(value: number, label: string, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be a whole number between ${min} and ${max}`);
  }
  return value;
}

/**
 * The browser sends the user's local YYYY-MM-DD. A real local date can differ
 * from the server's UTC date by one day, but not by weeks/months. Restricting
 * live tracker mutations prevents forged historical/future progress.
 */
export function assertCurrentLocalDate(dateKey: string) {
  const key = assertDateKey(dateKey);
  const utcToday = getUtcDateKey();
  const distance = Math.abs(diffUtcDateKeys(utcToday, key));
  if (distance > 1) {
    throw new Error("Date is outside the allowed local-day window");
  }
  return key;
}

/**
 * Small fixed-window limiter for expensive/structural mutations. We avoid
 * applying this to every checkbox/count click because that would add an extra
 * database write to the hottest paths.
 */
export async function enforceRateLimit(
  ctx: MutationCtx,
  userId: Id<"users">,
  key: string,
  limit: number,
  windowMs: number,
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", key))
    .first();

  if (!existing) {
    await ctx.db.insert("rateLimits", {
      userId,
      key,
      windowStart: now,
      count: 1,
    });
    return;
  }

  if (now - existing.windowStart >= windowMs) {
    await ctx.db.patch(existing._id, { windowStart: now, count: 1 });
    return;
  }

  if (existing.count >= limit) {
    throw new Error("Too many requests. Please wait a moment and try again.");
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 });
}
