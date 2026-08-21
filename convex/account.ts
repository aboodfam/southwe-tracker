import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Permanently removes the signed-in Ceventic account and data owned by it.
 *
 * Cleanup order matters:
 * - application/security data first
 * - refresh tokens / OAuth verifiers before sessions/accounts
 * - the auth user document last
 *
 * This keeps a partially-completed transaction from leaving orphaned auth
 * credentials pointing at an already-deleted user. Convex mutations are
 * transactional, so any thrown error rolls the whole deletion back.
 */
export const deleteMyAccount = mutation({
  args: { confirmation: v.string() },
  handler: async (ctx, args): Promise<{ deleted: true }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (args.confirmation.trim().toUpperCase() !== "DELETE") {
      throw new Error('Type "DELETE" to confirm account deletion');
    }

    // Product data. Every query is scoped through a user-first index so this
    // destructive operation never scans or touches another user's records.
    const routines = await ctx.db.query("routines").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const userStats = await ctx.db.query("userStats").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const habits = await ctx.db.query("habits").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const workouts = await ctx.db.query("workouts").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const workoutDays = await ctx.db.query("workoutDays").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const workoutStats = await ctx.db.query("workoutStats").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const workoutProgress = await ctx.db.query("workoutProgress").withIndex("by_user_date", (q) => q.eq("userId", userId)).collect();
    const dailyProgress = await ctx.db.query("dailyProgress").withIndex("by_user_date", (q) => q.eq("userId", userId)).collect();
    const dailyResetState = await ctx.db.query("dailyResetState").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const athkar = await ctx.db.query("athkar").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const profiles = await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const macroProfiles = await ctx.db.query("macroProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const weightEntries = await ctx.db.query("weightEntries").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const preferences = await ctx.db.query("userPreferences").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const trustedDevices = await ctx.db.query("trustedDevices").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const deviceChallenges = await ctx.db.query("deviceVerificationChallenges").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const rateLimits = await ctx.db.query("rateLimits").withIndex("by_user_key", (q) => q.eq("userId", userId)).collect();

    for (const doc of routines) await ctx.db.delete(doc._id);
    for (const doc of userStats) await ctx.db.delete(doc._id);
    for (const doc of habits) await ctx.db.delete(doc._id);
    for (const doc of workouts) await ctx.db.delete(doc._id);
    for (const doc of workoutDays) await ctx.db.delete(doc._id);
    for (const doc of workoutStats) await ctx.db.delete(doc._id);
    for (const doc of workoutProgress) await ctx.db.delete(doc._id);
    for (const doc of dailyProgress) await ctx.db.delete(doc._id);
    for (const doc of dailyResetState) await ctx.db.delete(doc._id);
    for (const doc of athkar) await ctx.db.delete(doc._id);
    for (const doc of profiles) await ctx.db.delete(doc._id);
    for (const doc of macroProfiles) await ctx.db.delete(doc._id);
    for (const doc of weightEntries) await ctx.db.delete(doc._id);
    for (const doc of preferences) await ctx.db.delete(doc._id);
    for (const doc of trustedDevices) await ctx.db.delete(doc._id);
    for (const doc of deviceChallenges) await ctx.db.delete(doc._id);
    for (const doc of rateLimits) await ctx.db.delete(doc._id);

    // Revoke every login session and its token chain first.
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    for (const session of sessions) {
      const refreshTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of refreshTokens) await ctx.db.delete(token._id);

      const verifiers = await ctx.db
        .query("authVerifiers")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const verifier of verifiers) await ctx.db.delete(verifier._id);

      await ctx.db.delete(session._id);
    }

    // Remove provider credentials/link records and their temporary codes.
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();

    for (const account of accounts) {
      const verificationCodes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      for (const code of verificationCodes) await ctx.db.delete(code._id);
      await ctx.db.delete(account._id);
    }

    // The auth user is deliberately last.
    await ctx.db.delete(userId);
    return { deleted: true };
  },
});
