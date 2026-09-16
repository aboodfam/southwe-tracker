import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { pageValidator, planValidator, validatePlan, STARTERS, type Plan } from "./planFormat";
import { LIMITS, cleanText, enforceRateLimit, assertCurrentLocalDate } from "./security";
import { starterTaskValidator, taskKey } from "./supportModel";
import { EMPTY_DAY } from "./supportModel";

const defaults = { hiddenPages: [], startPage: "today" as const, setupDone: false, quiet: false };
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const applyStarter = mutation({
  args: { name: v.string(), timeSlot: v.string(), tasks: v.array(starterTaskValidator), requestId: v.string(), dateKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx); if (!userId) throw new Error("Not authenticated");
    const date = assertCurrentLocalDate(args.dateKey);
    const requestId = cleanText(args.requestId, "Request", 100);
    const prior = await ctx.db.query("planApplications").withIndex("by_user_request", q => q.eq("userId", userId).eq("requestId", requestId)).first();
    if (prior) return;
    await enforceRateLimit(ctx, userId, "workspace:import", 10, 60000);
    if (!args.tasks.length || args.tasks.length > 5) throw new Error("Choose between one and five actions.");
    const routines = await ctx.db.query("routines").withIndex("by_user_active", q => q.eq("userId", userId).eq("isActive", true)).take(LIMITS.routines);
    if (routines.length >= LIMITS.routines) throw new Error("Make room for a routine before adding this template.");
    const tasks = args.tasks.map((task, order) => {
      for (const amount of [task.minutes, task.fallbackMinutes]) if (amount !== undefined && (!Number.isInteger(amount) || amount < 1 || amount > 240)) throw new Error("Time must be between 1 and 240 minutes.");
      if (task.minutes && task.fallbackMinutes && task.fallbackMinutes > task.minutes) throw new Error("The smaller option cannot take longer than the usual action.");
      return { ...task, name: cleanText(task.name, "Action", LIMITS.taskName),
        fallbackName: task.fallbackName ? cleanText(task.fallbackName, "Smaller step", LIMITS.taskName) : undefined,
        id: uid(), order, completed: false };
    });
    const routineId = await ctx.db.insert("routines", { userId, name: cleanText(args.name, "Template name", 80), timeSlot: cleanText(args.timeSlot, "Time", 48), tasks, isActive: true });
    const prefs = await ctx.db.query("workspacePreferences").withIndex("by_user", q => q.eq("userId", userId)).first();
    if (prefs) await ctx.db.patch(prefs._id, { setupDone: true, hiddenPages: prefs.hiddenPages.filter(page => page !== "routines") });
    else await ctx.db.insert("workspacePreferences", { ...defaults, userId, setupDone: true });
    const day = await ctx.db.query("supportDays").withIndex("by_user_date", q => q.eq("userId", userId).eq("date", date)).first();
    if (!day) await ctx.db.insert("supportDays", { userId, date, version: 1, state: { ...EMPTY_DAY, focusKey: taskKey(routineId, tasks[0].id) } });
    await ctx.db.insert("planApplications", { userId, requestId, routines: 1, workouts: 0 });
  },
});
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
    tasks: routine.tasks.map((name, order) => ({ ...routine.taskDetails?.[order], id: uid(), name, order, completed: false })),
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
    routines: routines.map(row => { const tasks = [...row.tasks].sort((a, b) => a.order - b.order); return { name: row.name, timeSlot: row.timeSlot, tasks: tasks.map(task => task.name), taskDetails: tasks.map(({ minutes, fallbackName, fallbackMinutes }) => ({ minutes, fallbackName, fallbackMinutes })) }; }),
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
