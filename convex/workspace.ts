import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { pageValidator, planValidator, validatePlan, STARTERS, type Plan } from "./planFormat";
import { LIMITS, cleanText, enforceRateLimit, assertCurrentLocalDate } from "./security";

const defaults = { hiddenPages: [], startPage: "today" as const, setupDone: false, quiet: false };
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const getPreferences = query({ args: {}, handler: async ctx => {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return { ...defaults, ...await ctx.db.query("workspacePreferences").withIndex("by_user", q => q.eq("userId", userId)).first(), userId };
} });

export const savePreferences = mutation({
  args: { hiddenPages: v.array(pageValidator), startPage: pageValidator, quiet: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx); if (!userId) throw new Error("Not authenticated");
    await enforceRateLimit(ctx, userId, "workspace:preferences", 30, 60000);
    if (args.hiddenPages.length > 6 || args.hiddenPages.includes("today")) throw new Error("Today must remain available.");
    if (args.hiddenPages.includes(args.startPage)) throw new Error("Your starting page must be visible.");
    const existing = await ctx.db.query("workspacePreferences").withIndex("by_user", q => q.eq("userId", userId)).first();
    const changes = { ...args, hiddenPages: [...new Set(args.hiddenPages)] };
    if (existing) await ctx.db.patch(existing._id, changes);
    else await ctx.db.insert("workspacePreferences", { userId, ...defaults, ...changes });
  },
});

async function appendPlan(ctx: MutationCtx, userId: Id<"users">, input: Plan) {
  const plan = validatePlan(input);
  if (!plan.routines.length && !plan.workouts.length) throw new Error("Choose at least one routine or workout day.");
  const [routines, days] = await Promise.all([
    ctx.db.query("routines").withIndex("by_user_active", q => q.eq("userId", userId).eq("isActive", true)).take(LIMITS.routines),
    ctx.db.query("workoutDays").withIndex("by_user_active", q => q.eq("userId", userId).eq("isActive", true)).take(LIMITS.workoutDays),
  ]);
  if (routines.length + plan.routines.length > LIMITS.routines || days.length + plan.workouts.length > LIMITS.workoutDays) throw new Error("Not enough space. Maximum: 24 routine blocks and 14 workout days. Nothing was imported.");
  for (const routine of plan.routines) await ctx.db.insert("routines", { userId, isActive: true, name: routine.name, timeSlot: routine.timeSlot,
    tasks: routine.tasks.map((name, order) => ({ id: uid(), name, order, completed: false })),
  });
  const lastOrder = Math.max(0, ...days.map(day => day.order));
  for (const [index, day] of plan.workouts.entries()) await ctx.db.insert("workoutDays", { ...day, userId, isActive: true, order: lastOrder + index + 1,
    exercises: day.exercises.map((exercise, order) => ({ ...exercise, id: uid(), order, completed: false })),
  });
  return { routines: plan.routines.length, workouts: plan.workouts.length };
}

export const finishSetup = mutation({
  args: { focus: v.union(v.literal("daily"), v.literal("focus"), v.literal("training")), useStarter: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx); if (!userId) throw new Error("Not authenticated");
    const prefs = await ctx.db.query("workspacePreferences").withIndex("by_user", q => q.eq("userId", userId)).first();
    if (prefs?.setupDone) return;
    await enforceRateLimit(ctx, userId, "workspace:setup", 10, 60000);
    if (args.useStarter) await appendPlan(ctx, userId, STARTERS[args.focus].plan);
    if (prefs) await ctx.db.patch(prefs._id, { setupDone: true, focus: args.focus });
    else await ctx.db.insert("workspacePreferences", { ...defaults, userId, setupDone: true, focus: args.focus });
  },
});

export const getCurrentPlan = query({ args: {}, handler: async ctx => {
  const userId = await getAuthUserId(ctx); if (!userId) return null;
  const routines = await ctx.db.query("routines").withIndex("by_user_active", q => q.eq("userId", userId).eq("isActive", true)).take(LIMITS.routines);
  const workouts = await ctx.db.query("workoutDays").withIndex("by_user_active", q => q.eq("userId", userId).eq("isActive", true)).take(LIMITS.workoutDays);
  return { version: 1 as const,
    routines: routines.map(row => ({ name: row.name, timeSlot: row.timeSlot, tasks: [...row.tasks].sort((a, b) => a.order - b.order).map(task => task.name) })),
    workouts: workouts.sort((a, b) => a.order - b.order).map(row => ({ name: row.name, warmupNotes: row.warmupNotes,
      exercises: [...row.exercises].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(({ name, sets, reps, muscles, notes, isWarmup, weight, duration }) => ({ name, sets, reps: String(reps), muscles, notes, isWarmup, weight, duration })),
    })),
  };
} });

export const listTemplates = query({ args: {}, handler: async ctx => {
  const userId = await getAuthUserId(ctx); if (!userId) return [];
  return ctx.db.query("planTemplates").withIndex("by_user", q => q.eq("userId", userId)).take(30);
} });
export const saveTemplate = mutation({ args: { name: v.string(), plan: planValidator }, handler: async (ctx, args) => {
  const userId = await getAuthUserId(ctx); if (!userId) throw new Error("Not authenticated");
  await enforceRateLimit(ctx, userId, "workspace:templates", 20, 60000);
  const existing = await ctx.db.query("planTemplates").withIndex("by_user", q => q.eq("userId", userId)).take(30);
  if (existing.length >= 30) throw new Error("Template library is full (30). Remove a template first.");
  const plan = validatePlan(args.plan);
  if (!plan.routines.length && !plan.workouts.length) throw new Error("Select something to save.");
  return ctx.db.insert("planTemplates", { userId, name: cleanText(args.name, "Template name", 80), plan });
} });
export const deleteTemplate = mutation({ args: { id: v.id("planTemplates") }, handler: async (ctx, args) => {
  const userId = await getAuthUserId(ctx); if (!userId) throw new Error("Not authenticated");
  const template = await ctx.db.get(args.id); if (!template || template.userId !== userId) throw new Error("Template not found");
  await ctx.db.delete(template._id);
} });
export const importPlan = mutation({ args: { plan: planValidator, requestId: v.string() }, handler: async (ctx, args) => {
  const userId = await getAuthUserId(ctx); if (!userId) throw new Error("Not authenticated");
  const requestId = cleanText(args.requestId, "Import request", 100);
  const prior = await ctx.db.query("planApplications").withIndex("by_user_request", q => q.eq("userId", userId).eq("requestId", requestId)).first();
  if (prior) return { routines: prior.routines, workouts: prior.workouts };
  await enforceRateLimit(ctx, userId, "workspace:import", 10, 60000);
  const count = await appendPlan(ctx, userId, args.plan);
  await ctx.db.insert("planApplications", { userId, requestId, ...count });
  return count;
} });

export const getTodayPlan = query({ args: { dateKey: v.string() }, handler: async (ctx, args) => {
  const userId = await getAuthUserId(ctx); if (!userId) return null;
  const date = assertCurrentLocalDate(args.dateKey);
  return ctx.db.query("todayPlans").withIndex("by_user_date", q => q.eq("userId", userId).eq("date", date)).first();
} });
export const chooseTodayWorkout = mutation({ args: { dateKey: v.string(), dayId: v.optional(v.id("workoutDays")), rest: v.boolean() }, handler: async (ctx, args) => {
  const userId = await getAuthUserId(ctx); if (!userId) throw new Error("Not authenticated");
  const date = assertCurrentLocalDate(args.dateKey);
  if (args.rest && args.dayId) throw new Error("Choose a workout or rest, not both.");
  if (args.dayId) { const day = await ctx.db.get(args.dayId); if (!day || day.userId !== userId || !day.isActive) throw new Error("Workout not found"); }
  await enforceRateLimit(ctx, userId, "workspace:today", 40, 60000);
  const existing = await ctx.db.query("todayPlans").withIndex("by_user_date", q => q.eq("userId", userId).eq("date", date)).first();
  const changes = { dayId: args.dayId, rest: args.rest };
  if (existing) await ctx.db.patch(existing._id, changes);
  else await ctx.db.insert("todayPlans", { userId, date, ...changes });
} });
