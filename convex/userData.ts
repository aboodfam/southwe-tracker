import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertDateKey } from "./date";

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
    sex: v.string(),
    age: v.string(),
    heightCm: v.string(),
    weightKg: v.string(),
    activityId: v.string(),
    goal: v.string(),
    pace: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("macroProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const payload = { ...args, updatedAt: Date.now() };
    if (existing[0]) {
      await ctx.db.patch(existing[0]._id, payload);
      for (const duplicate of existing.slice(1)) await ctx.db.delete(duplicate._id);
      return existing[0]._id;
    }

    return await ctx.db.insert("macroProfiles", { userId, ...payload });
  },
});

export const getWeightData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { entries: [], unit: "kg", hasPreferences: false };

    const [entries, preferences] = await Promise.all([
      ctx.db
        .query("weightEntries")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("userPreferences")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
    ]);

    return {
      entries: entries.sort((a, b) => b.date.localeCompare(a.date)),
      unit: preferences?.weightUnit === "lbs" ? "lbs" : "kg",
      hasPreferences: !!preferences,
    };
  },
});

export const saveWeightEntry = mutation({
  args: {
    dateKey: v.string(),
    weightKg: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const date = assertDateKey(args.dateKey);
    if (!Number.isFinite(args.weightKg) || args.weightKg <= 0 || args.weightKg > 1000) {
      throw new Error("Invalid weight");
    }

    const existing = await ctx.db
      .query("weightEntries")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .collect();

    const payload = {
      date,
      weightKg: args.weightKg,
      note: args.note?.trim() || undefined,
      updatedAt: Date.now(),
    };

    if (existing[0]) {
      await ctx.db.patch(existing[0]._id, payload);
      for (const duplicate of existing.slice(1)) await ctx.db.delete(duplicate._id);
      return existing[0]._id;
    }

    return await ctx.db.insert("weightEntries", { userId, ...payload });
  },
});

export const deleteWeightEntry = mutation({
  args: { entryId: v.id("weightEntries") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.userId !== userId) throw new Error("Weight entry not found");
    await ctx.db.delete(args.entryId);
  },
});

export const setWeightUnit = mutation({
  args: { unit: v.union(v.literal("kg"), v.literal("lbs")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const docs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (docs[0]) {
      await ctx.db.patch(docs[0]._id, { weightUnit: args.unit });
      for (const duplicate of docs.slice(1)) await ctx.db.delete(duplicate._id);
      return docs[0]._id;
    }

    return await ctx.db.insert("userPreferences", { userId, weightUnit: args.unit });
  },
});
