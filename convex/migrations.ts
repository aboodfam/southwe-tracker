// Maintenance-only migrations. Internal functions cannot be invoked by the web client.
import { internalMutation } from "./_generated/server";

export const migrateUserStatsCleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const stats = await ctx.db.query("userStats").collect();
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

    return { migrated };
  },
});
