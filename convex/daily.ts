import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertDateKey } from "./date";


async function snapshotRoutineProgress(ctx: any, userId: any, dateKey: string, routines: any[]) {
  const active = routines.filter((routine) => routine.isActive !== false);
  const totalTasks = active.reduce((sum, routine) => sum + routine.tasks.length, 0);
  const completedTasks = active.reduce(
    (sum, routine) => sum + routine.tasks.filter((task: any) => task.completed).length,
    0,
  );
  const completedRoutines = active
    .filter((routine) => routine.tasks.length > 0 && routine.tasks.every((task: any) => task.completed))
    .map((routine) => routine._id);
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const existing = await ctx.db
    .query("dailyProgress")
    .withIndex("by_user_date", (q: any) => q.eq("userId", userId).eq("date", dateKey))
    .first();

  const patch = {
    completedRoutines,
    totalRoutines: active.length,
    totalTasks,
    completedTasks,
    completionRate,
  };

  if (existing) {
    await ctx.db.patch(existing._id, patch);
  } else if (totalTasks > 0 || completedTasks > 0) {
    await ctx.db.insert("dailyProgress", {
      userId,
      date: dateKey,
      ...patch,
      countedInStats: false,
    });
  }
}

/**
 * Resets daily-progress across the app for the current user.
 *
 * Server-side idempotent: if today's reset already ran for this user,
 * the mutation becomes a no-op.
 */
export const resetEverythingDaily = mutation({
  args: { dateKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const today = assertDateKey(args.dateKey);
    const existingResetState = await ctx.db
      .query("dailyResetState")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existingResetState && existingResetState.lastResetDate >= today) {
      return {
        alreadyReset: true,
        resetDate: today,
        routinesReset: 0,
        athkarReset: 0,
      };
    }

    const routines = await ctx.db
      .query("routines")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Before clearing today's live checkmarks, persist the previous local day's
    // final routine state. This protects progress even if the last action of the
    // day was adding/deleting a task rather than toggling one.
    if (existingResetState?.lastResetDate && existingResetState.lastResetDate < today) {
      await snapshotRoutineProgress(ctx, userId, existingResetState.lastResetDate, routines);
    }

    for (const routine of routines) {
      const tasks = Array.isArray(routine.tasks) ? routine.tasks : [];
      const nextTasks = tasks.map((task) => ({
        ...task,
        completed: false,
      }));
      await ctx.db.patch(routine._id, { tasks: nextTasks });
    }

    const athkarDocs = await ctx.db
      .query("athkar")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const builtinCategories = new Set([
      "morning",
      "evening",
      "prayer",
      "before_sleep",
      "waking_up",
    ]);

    let athkarReset = 0;
    for (const dhikr of athkarDocs) {
      if (!builtinCategories.has(dhikr.category)) continue;
      await ctx.db.patch(dhikr._id, { currentCount: 0, isCompleted: false });
      athkarReset += 1;
    }

    if (existingResetState) {
      await ctx.db.patch(existingResetState._id, { lastResetDate: today });
    } else {
      await ctx.db.insert("dailyResetState", {
        userId,
        lastResetDate: today,
      });
    }

    return {
      alreadyReset: false,
      resetDate: today,
      routinesReset: routines.length,
      athkarReset,
    };
  },
});
