import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { cleanText, enforceRateLimit } from "./security";

function cleanNumericString(value: string, label: string, min: number, max: number) {
  const text = cleanText(value, label, 16);
  const number = Number(text);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
  return text;
}

export const getMacroProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("macroProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const saveMacroProfile = mutation({
  args: {
    sex: v.union(v.literal("male"), v.literal("female")),
    age: v.string(),
    heightCm: v.string(),
    weightKg: v.string(),
    activityId: v.union(
      v.literal("sedentary"),
      v.literal("light"),
      v.literal("moderate"),
      v.literal("active"),
      v.literal("athlete"),
    ),
    goal: v.union(v.literal("maintain"), v.literal("cut"), v.literal("bulk")),
    pace: v.union(v.literal("mild"), v.literal("moderate"), v.literal("aggressive")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await enforceRateLimit(ctx, userId, "macros:save", 40, 60_000);

    const payload = {
      sex: args.sex,
      age: cleanNumericString(args.age, "Age", 13, 120),
      heightCm: cleanNumericString(args.heightCm, "Height", 80, 260),
      weightKg: cleanNumericString(args.weightKg, "Weight", 20, 500),
      activityId: args.activityId,
      goal: args.goal,
      pace: args.pace,
      updatedAt: Date.now(),
    };

    const existing = await ctx.db
      .query("macroProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      const unchanged =
        existing.sex === payload.sex &&
        existing.age === payload.age &&
        existing.heightCm === payload.heightCm &&
        existing.weightKg === payload.weightKg &&
        existing.activityId === payload.activityId &&
        existing.goal === payload.goal &&
        existing.pace === payload.pace;
      if (!unchanged) await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("macroProfiles", { userId, ...payload });
  },
});

// Weight tracking was removed from the product UI. Legacy weight tables stay in
// schema.ts so existing data is not destroyed, but there are deliberately no
// client-callable weight functions anymore. This keeps unused personal-data
// endpoints out of the public API surface.
