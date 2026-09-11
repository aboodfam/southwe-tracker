import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { LIMITS, enforceRateLimit } from "./security";

export async function keepDeleted(ctx: MutationCtx, userId: Id<"users">, item: {
  kind: "routine" | "habit" | "workoutDay" | "task" | "exercise";
  itemId: string; title: string; parentId?: string; snapshot?: unknown;
}) {
  const bin = await ctx.db.query("recycleBin").withIndex("by_user", q => q.eq("userId", userId)).take(100);
  if (bin.some(row => row.kind === item.kind && row.itemId === item.itemId && row.parentId === item.parentId)) return;
  if (bin.length >= 100) throw new Error("Recently deleted is full. Restore or permanently remove an item in My workspace first. Nothing was deleted.");
  await ctx.db.insert("recycleBin", { ...item, snapshot: JSON.stringify(item.snapshot ?? null), userId, deletedAt: Date.now() });
}

export const listDeleted = query({ args: {}, handler: async ctx => {
  const userId = await getAuthUserId(ctx); if (!userId) return [];
  const rows = await ctx.db.query("recycleBin").withIndex("by_user", q => q.eq("userId", userId)).order("desc").take(100);
  return rows.map(({ snapshot: _snapshot, ...row }) => row);
} });

export const restore = mutation({ args: { id: v.id("recycleBin") }, handler: async (ctx, args) => {
  const userId = await getAuthUserId(ctx); if (!userId) throw new Error("Not authenticated");
  const entry = await ctx.db.get(args.id);
  if (!entry) return; // Safe retry after a completed restore.
  if (entry.userId !== userId) throw new Error("Item not found");
  await enforceRateLimit(ctx, userId, "recovery:restore", 30, 60000);
  if (entry.kind === "routine") {
    const id = ctx.db.normalizeId("routines", entry.itemId); const row = id ? await ctx.db.get(id) : null;
    if (!row || row.userId !== userId) throw new Error("Routine no longer exists.");
    const active = await ctx.db.query("routines").withIndex("by_user_active", q => q.eq("userId", userId).eq("isActive", true)).take(LIMITS.routines);
    if (active.length >= LIMITS.routines) throw new Error("Routine limit reached. Make room before restoring.");
    await ctx.db.patch(row._id, { isActive: true, deletedAt: undefined, tasks: row.tasks.map(task => ({ ...task, completed: false })) });
  } else if (entry.kind === "habit") {
    const id = ctx.db.normalizeId("habits", entry.itemId); const row = id ? await ctx.db.get(id) : null;
    if (!row || row.userId !== userId) throw new Error("Habit no longer exists.");
    const active = await ctx.db.query("habits").withIndex("by_user", q => q.eq("userId", userId)).filter(q => q.eq(q.field("deletedAt"), undefined)).take(LIMITS.habits);
    if (active.length >= LIMITS.habits) throw new Error("Habit limit reached. Make room before restoring.");
    await ctx.db.patch(row._id, { isActive: true, deletedAt: undefined });
  } else if (entry.kind === "workoutDay") {
    const id = ctx.db.normalizeId("workoutDays", entry.itemId); const row = id ? await ctx.db.get(id) : null;
    if (!row || row.userId !== userId) throw new Error("Workout day no longer exists.");
    const active = await ctx.db.query("workoutDays").withIndex("by_user_active", q => q.eq("userId", userId).eq("isActive", true)).take(LIMITS.workoutDays);
    if (active.length >= LIMITS.workoutDays) throw new Error("Workout day limit reached. Make room before restoring.");
    await ctx.db.patch(row._id, { isActive: true, deletedAt: undefined, order: Math.max(0, ...active.map(day => day.order)) + 1 });
  } else if (entry.kind === "task") {
    const id = ctx.db.normalizeId("routines", entry.parentId ?? ""); const parent = id ? await ctx.db.get(id) : null;
    if (!parent || parent.userId !== userId || !parent.isActive) throw new Error("Restore the parent routine first. If it was permanently removed, this task cannot be restored.");
    const task = JSON.parse(entry.snapshot) as Doc<"routines">["tasks"][number];
    if (!parent.tasks.some(item => item.id === task.id)) {
      if (parent.tasks.length >= LIMITS.tasksPerRoutine) throw new Error("Task limit reached.");
      await ctx.db.patch(parent._id, { tasks: [...parent.tasks, { ...task, completed: false, order: Math.max(-1, ...parent.tasks.map(item => item.order)) + 1 }] });
    }
  } else {
    const id = ctx.db.normalizeId("workoutDays", entry.parentId ?? ""); const parent = id ? await ctx.db.get(id) : null;
    if (!parent || parent.userId !== userId || !parent.isActive) throw new Error("Restore the parent workout day first. If it was permanently removed, this exercise cannot be restored.");
    const exercise = JSON.parse(entry.snapshot) as Doc<"workoutDays">["exercises"][number];
    if (!parent.exercises.some(item => item.id === exercise.id)) {
      if (parent.exercises.length >= LIMITS.exercisesPerWorkoutDay) throw new Error("Exercise limit reached.");
      await ctx.db.patch(parent._id, { exercises: [...parent.exercises, { ...exercise, completed: false, order: Math.max(-1, ...parent.exercises.map(item => item.order ?? 0)) + 1 }] });
    }
  }
  await ctx.db.delete(entry._id);
} });

export const removePermanently = mutation({ args: { id: v.id("recycleBin"), confirm: v.literal("DELETE") }, handler: async (ctx, args) => {
  const userId = await getAuthUserId(ctx); if (!userId) throw new Error("Not authenticated");
  const entry = await ctx.db.get(args.id); if (!entry) return;
  if (entry.userId !== userId) throw new Error("Item not found");
  await enforceRateLimit(ctx, userId, "recovery:purge", 30, 60000);
  const table = entry.kind === "routine" ? "routines" : entry.kind === "habit" ? "habits" : entry.kind === "workoutDay" ? "workoutDays" : null;
  if (table) {
    const id = ctx.db.normalizeId(table, entry.itemId); const row = id ? await ctx.db.get(id) : null;
    if (row && row.userId === userId && row.deletedAt !== undefined) await ctx.db.delete(row._id);
  }
  await ctx.db.delete(entry._id);
} });
