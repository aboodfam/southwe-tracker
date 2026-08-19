import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { LIMITS, cleanText, enforceRateLimit } from "./security";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});

export const loggedInUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // getAuthUserId already proves this request has an authenticated user. The
    // UI only needs a truthy result, so avoid an extra auth-table read and do
    // not expose the raw user/email document.
    return { authenticated: true as const };
  },
});

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) return null;
    return {
      displayName: profile.displayName,
      nameConfirmed: profile.nameConfirmed === true,
    };
  },
});

export const setDisplayName = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await enforceRateLimit(ctx, userId, "profile:name", 12, 60_000);
    const displayName = cleanText(args.displayName, "Name", LIMITS.profileName, { minLength: 2 });

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const updatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { displayName, nameConfirmed: true, updatedAt });
      return existing._id;
    }

    return await ctx.db.insert("userProfiles", {
      userId,
      displayName,
      nameConfirmed: true,
      updatedAt,
    });
  },
});
