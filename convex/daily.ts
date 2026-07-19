import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getUtcDateKey } from "./date";

/**
 * Resets daily-progress across the app for the current user.
 *
 * Server-side idempotent: if today's reset already ran for this user,
 * the mutation becomes a no-op.
 */
export const resetEverythingDaily = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const today = getUtcDateKey();
    const existingResetState = await ctx.db
      .query("dailyResetState")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existingResetState?.lastResetDate === today) {
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
