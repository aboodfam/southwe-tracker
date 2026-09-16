import {
  query,
  mutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  assertCurrentLocalDate,
  cleanText,
  enforceRateLimit,
  LIMITS,
} from "./security";
import { shiftUtcDateKey, diffUtcDateKeys } from "./date";
import {
  dayStateValidator,
  EMPTY_DAY,
  frictionPatterns,
  taskKey,
  habitKey,
} from "./supportModel";

async function activeItems(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const routines = await ctx.db
    .query("routines")
    .withIndex("by_user_active", (q) =>
      q.eq("userId", userId).eq("isActive", true),
    )
    .take(LIMITS.routines);
  const habits = await ctx.db
    .query("habits")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("deletedAt"), undefined))
    .take(LIMITS.habits);
  return new Map([
    ...routines.flatMap((r) =>
      r.tasks.map((t) => [taskKey(r._id, t.id), t.name] as const),
    ),
    ...habits
      .filter((h) => h.isActive !== false)
      .map((h) => [habitKey(h._id), h.name] as const),
  ]);
}

export const getToday = query({
  args: { dateKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const date = assertCurrentLocalDate(args.dateKey);
    const days = await ctx.db
      .query("supportDays")
      .withIndex("by_user_date", (q) =>
        q
          .eq("userId", userId)
          .gte("date", shiftUtcDateKey(date, -13))
          .lte("date", date),
      )
      .collect();
    const current = days.find((day) => day.date === date);
    const visit = await ctx.db
      .query("supportVisits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const reset = await ctx.db
      .query("dailyResetState")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const lastDate = visit?.lastDate ?? reset?.lastResetDate;
    const showWelcome =
      (lastDate && diffUtcDateKeys(lastDate, date) >= 7) ||
      (visit?.returnDate === date && !visit.dismissed);
    const items = await activeItems(ctx, userId);
    const state = current?.state ?? EMPTY_DAY;
    const patterns = frictionPatterns(days).filter(
      (item) =>
        items.has(item.key) &&
        !days.some(
          (day) =>
            day.date >= item.latestDate &&
            day.state.dismissedFriction.includes(item.key),
        ),
    );
    const experiment = await ctx.db
      .query("weeklyReviews")
      .withIndex("by_user_date", (q) =>
        q
          .eq("userId", userId)
          .gte("date", shiftUtcDateKey(date, -6))
          .lte("date", date),
      )
      .order("desc")
      .first();
    return {
      state,
      version: current?.version ?? 0,
      patterns,
      showWelcome: !!showWelcome,
      experiment,
    };
  },
});

export const visitToday = mutation({
  args: { dateKey: v.string(), dismiss: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const date = assertCurrentLocalDate(args.dateKey);
    const visit = await ctx.db
      .query("supportVisits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (visit && visit.lastDate > date) return;
    if (visit?.lastDate === date && !args.dismiss) return;
    const reset = await ctx.db
      .query("dailyResetState")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const last = visit?.lastDate ?? reset?.lastResetDate;
    const returning = !!last && diffUtcDateKeys(last, date) >= 7;
    const patch = {
      lastDate: date,
      returnDate: returning ? date : visit?.returnDate,
      dismissed:
        args.dismiss === true || (!returning && (visit?.dismissed ?? false)),
    };
    if (visit) await ctx.db.patch(visit._id, patch);
    else await ctx.db.insert("supportVisits", { userId, ...patch });
  },
});

export const saveDay = mutation({
  args: {
    dateKey: v.string(),
    expectedVersion: v.number(),
    state: dayStateValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const date = assertCurrentLocalDate(args.dateKey);
    await enforceRateLimit(ctx, userId, "support:day", 90, 60000);
    const current = await ctx.db
      .query("supportDays")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .first();
    if ((current?.version ?? 0) !== args.expectedVersion)
      throw new Error(
        "Your day changed on another screen. Review it and try again.",
      );
    const items = await activeItems(ctx, userId);
    const state = args.state;
    if (state.adjustments.length > 100 || state.dismissedFriction.length > 100)
      throw new Error("Too many adjustments for one day.");
    if (
      new Set(state.adjustments.map((item) => item.key)).size !==
      state.adjustments.length
    )
      throw new Error("Choose one adjustment per action.");
    for (const key of [state.focusKey, state.startedKey])
      if (key && !items.has(key))
        throw new Error("That action is no longer available.");
    for (const key of state.dismissedFriction)
      if (key.length > 200) throw new Error("Invalid action.");
    // Old adjustments may remain after deleting their original item. They cannot
    // become a way to reference or edit another user's data.
    const adjustments = state.adjustments.map((item) => {
      const title = items.get(item.key);
      if (!title) {
        const previous = current?.state.adjustments.find(
          (old) => old.key === item.key,
        );
        if (!previous || JSON.stringify(previous) !== JSON.stringify(item))
          throw new Error("That action is no longer available.");
        return previous;
      }
      return {
        ...item,
        title,
        step:
          item.mode === "step" ? cleanText(item.step, "First step", 180) : "",
        stepDone: item.mode === "step" && item.stepDone,
      };
    });
    const version = (current?.version ?? 0) + 1;
    const patch = { state: { ...state, adjustments }, version };
    if (current) await ctx.db.patch(current._id, patch);
    else await ctx.db.insert("supportDays", { userId, date, ...patch });
    return version;
  },
});

export const weeklyReview = query({
  args: { dateKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const date = assertCurrentLocalDate(args.dateKey);
    const start = shiftUtcDateKey(date, -7),
      previousStart = shiftUtcDateKey(date, -14);
    const routines = await ctx.db
      .query("dailyProgress")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).gte("date", previousStart).lt("date", date),
      )
      .collect();
    const workouts = await ctx.db
      .query("workoutProgress")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).gte("date", previousStart).lt("date", date),
      )
      .collect();
    const habits = await ctx.db
      .query("habits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const days = await ctx.db
      .query("supportDays")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).gte("date", previousStart).lt("date", date),
      )
      .collect();
    const summary = (from: string, until: string) => {
      const inside = (key: string) => key >= from && key < until;
      const routineRows = routines.filter((row) => inside(row.date));
      const workoutRows = workouts.filter((row) => inside(row.date));
      const entries = habits.flatMap((h) =>
        h.entries.filter((e) => inside(e.date) && e.completed),
      );
      const small = days
        .filter((day) => inside(day.date))
        .flatMap((day) =>
          day.state.adjustments
            .filter((item) => item.mode === "step" && item.stepDone)
            .map((item) => ({ ...item, date: day.date })),
        );
      const activeDates = new Set([
        ...routineRows
          .filter((row) => row.completedTasks > 0)
          .map((row) => row.date),
        ...workoutRows
          .filter((row) => row.completedExercises.length > 0)
          .map((row) => row.date),
        ...entries.map((row) => row.date),
        ...small.map((row) => row.date),
      ]);
      return {
        activeDays: activeDates.size,
        tasks: routineRows.reduce((n, row) => n + row.completedTasks, 0),
        habits: entries.length,
        workouts: workoutRows.filter((row) => row.completedWorkout).length,
        smallSteps: small.length,
      };
    };
    const saved = await ctx.db
      .query("weeklyReviews")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .first();
    const previousReview = await ctx.db
      .query("weeklyReviews")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).lt("date", date))
      .order("desc")
      .first();
    return {
      start,
      end: shiftUtcDateKey(date, -1),
      current: summary(start, date),
      previous: summary(previousStart, start),
      patterns: frictionPatterns(days.filter((day) => day.date >= start)),
      saved,
      previousReview,
    };
  },
});

export const saveReview = mutation({
  args: {
    dateKey: v.string(),
    experiment: v.string(),
    reflection: v.string(),
    routineId: v.optional(v.id("routines")),
    timeSlot: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const date = assertCurrentLocalDate(args.dateKey);
    await enforceRateLimit(ctx, userId, "support:review", 20, 60000);
    const experiment = cleanText(args.experiment, "Next week's change", 240);
    const reflection = cleanText(args.reflection, "Reflection", 400, {
      allowEmpty: true,
    });
    let timeSlot: string | undefined;
    if (args.routineId) {
      const routine = await ctx.db.get(args.routineId);
      if (
        !routine ||
        routine.userId !== userId ||
        !routine.isActive ||
        routine.deletedAt !== undefined
      )
        throw new Error("Routine no longer available.");
      timeSlot = cleanText(args.timeSlot ?? "", "New time", 48);
      await ctx.db.patch(routine._id, { timeSlot });
    }
    const current = await ctx.db
      .query("weeklyReviews")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .first();
    const patch = {
      experiment,
      reflection,
      routineId: args.routineId,
      timeSlot,
    };
    if (current) await ctx.db.patch(current._id, patch);
    else await ctx.db.insert("weeklyReviews", { userId, date, ...patch });
  },
});
