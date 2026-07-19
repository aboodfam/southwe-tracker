// migrations.ts — placeholder for future data migrations.
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const migrateUserStatsCleanup = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let migrated = 0;

    for (const doc of stats) {
      await ctx.db.replace(doc._id, {
        userId: doc.userId,
        lastCompletionDate: doc.lastCompletionDate,
        totalDaysCompleted: doc.totalDaysCompleted ?? 0,
        currentStreak: doc.currentStreak ?? 0,
        longestStreak: doc.longestStreak ?? 0,
        totalTasksCompleted: doc.totalTasksCompleted ?? 0,
        averageCompletionRate: doc.averageCompletionRate ?? 0,
      });
      migrated += 1;
    }

    return {
      migrated,
    };
  },
});
