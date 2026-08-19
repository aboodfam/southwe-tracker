import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { assertDateKey } from "./date";
import { LIMITS, assertCurrentLocalDate, assertShortId, cleanText, enforceRateLimit } from "./security";

export const getRoutines = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("routines")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .take(LIMITS.routines);
  },
});


// --- Helpers for daily progress & achievements counting ---
function diffDays(a: string, b: string) {
  // returns whole-day difference between ISO dates (b - a)
  const msPerDay = 24 * 60 * 60 * 1000;
  const aMs = Date.parse(a);
  const bMs = Date.parse(b);
  return Math.floor((bMs - aMs) / msPerDay);
}

async function computeRoutineStats(ctx: any, userId: any, dateKey: string) {
  const today = assertDateKey(dateKey);

  const routines = await ctx.db
    .query("routines")
    .withIndex("by_user_active", (q: any) => q.eq("userId", userId).eq("isActive", true))
    .take(LIMITS.routines);

  let totalTasks = 0;
  let completedTasks = 0;
  const completedRoutines: Id<"routines">[] = [];

  for (const routine of routines) {
    const routineCompletedTasks = routine.tasks.filter((t: any) => t.completed).length;
    totalTasks += routine.tasks.length;
    completedTasks += routineCompletedTasks;

    if (routine.tasks.length > 0 && routineCompletedTasks === routine.tasks.length) {
      completedRoutines.push(routine._id);
    }
  }

  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return { today, routines, totalTasks, completedTasks, completedRoutines, completionRate };
}

async function upsertDailyProgress(ctx: any, userId: any, stats: any) {
  const existingDay = await ctx.db
    .query("dailyProgress")
    .withIndex("by_user_date", (q: any) => q.eq("userId", userId).eq("date", stats.today))
    .first();

  if (existingDay) {
    await ctx.db.patch(existingDay._id, {
      completedRoutines: stats.completedRoutines,
      totalRoutines: stats.routines.length,
      totalTasks: stats.totalTasks,
      completedTasks: stats.completedTasks,
      completionRate: stats.completionRate,
    });
    return await ctx.db.get(existingDay._id);
  }

  const id = await ctx.db.insert("dailyProgress", {
    userId,
    date: stats.today,
    completedRoutines: stats.completedRoutines,
    totalRoutines: stats.routines.length,
    totalTasks: stats.totalTasks,
    completedTasks: stats.completedTasks,
    completionRate: stats.completionRate,
    countedInStats: false,
  });

  return await ctx.db.get(id);
}

async function maybeCountDayInUserStats(ctx: any, userId: any, dayDoc: any, completionRate: number, completedTasks: number) {
  // Count a day once when it reaches the threshold.
  const thresholdMet = completionRate >= 80;

  if (!thresholdMet) return;

  const userStats = await ctx.db
    .query("userStats")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (!userStats) return;

  // Already counted today? (either via dailyProgress flag or userStats.lastCompletionDate)
  if (dayDoc?.countedInStats === true || userStats.lastCompletionDate === dayDoc?.date) return;

  const lastDate = userStats.lastCompletionDate;
  let newCurrentStreak = userStats.currentStreak;

  if (!lastDate) {
    newCurrentStreak = 1;
  } else {
    const d = diffDays(lastDate, dayDoc.date);
    newCurrentStreak = d === 1 ? userStats.currentStreak + 1 : 1;
  }

  const newLongestStreak = Math.max(userStats.longestStreak, newCurrentStreak);

  const previousDaysCompleted = userStats.totalDaysCompleted;
  const newTotalDaysCompleted = previousDaysCompleted + 1;
  const newAverageCompletionRate =
    ((userStats.averageCompletionRate * previousDaysCompleted) + completionRate) / newTotalDaysCompleted;

  await ctx.db.patch(userStats._id, {
    totalDaysCompleted: newTotalDaysCompleted,
    currentStreak: newCurrentStreak,
    longestStreak: newLongestStreak,
    lastCompletionDate: dayDoc.date,
    totalTasksCompleted: userStats.totalTasksCompleted + completedTasks,
    averageCompletionRate: newAverageCompletionRate,
  });

  await ctx.db.patch(dayDoc._id, { countedInStats: true });
}

export const toggleTask = mutation({
  args: {
    routineId: v.id("routines"),
    taskId: v.string(),
    dateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const routine = await ctx.db.get(args.routineId);
    if (!routine || routine.userId !== userId) {
      throw new Error("Routine not found");
    }

    const today = assertCurrentLocalDate(args.dateKey);
    const savedDay = await ctx.db
      .query("dailyProgress")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .first();
    if (savedDay?.countedInStats === true) {
      throw new Error("Today is already completed.");
    }

    const taskId = assertShortId(args.taskId, "Task id", 100);
    const taskExists = routine.tasks.some((task) => task.id === taskId);
    if (!taskExists) throw new Error("Task not found");

    const updatedTasks = routine.tasks.map((task) =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );

    await ctx.db.patch(args.routineId, { tasks: updatedTasks });

    // Update today's routine progress (used by Progress & Achievements).
    const stats = await computeRoutineStats(ctx, userId, args.dateKey);
    await upsertDailyProgress(ctx, userId, stats);
  },
});


export const updateTask = mutation({
  args: {
    routineId: v.id("routines"),
    taskId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const routine = await ctx.db.get(args.routineId);
    if (!routine || routine.userId !== userId) {
      throw new Error("Routine not found");
    }

    await enforceRateLimit(ctx, userId, "routines:structure", 30, 60_000);
    const taskId = assertShortId(args.taskId, "Task id", 100);
    const name = cleanText(args.name, "Task name", LIMITS.taskName);
    if (!routine.tasks.some((task) => task.id === taskId)) throw new Error("Task not found");
    const updatedTasks = routine.tasks.map((task) =>
      task.id === taskId ? { ...task, name } : task
    );

    await ctx.db.patch(args.routineId, { tasks: updatedTasks });
  },
});

export const addTask = mutation({
  args: {
    routineId: v.id("routines"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const routine = await ctx.db.get(args.routineId);
    if (!routine || routine.userId !== userId) {
      throw new Error("Routine not found");
    }

    await enforceRateLimit(ctx, userId, "routines:structure", 30, 60_000);
    if (routine.tasks.length >= LIMITS.tasksPerRoutine) {
      throw new Error(`A routine can have up to ${LIMITS.tasksPerRoutine} tasks`);
    }
    const name = cleanText(args.name, "Task name", LIMITS.taskName);
    const newTask = {
      id: `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`,
      name,
      completed: false,
      order: routine.tasks.length + 1,
    };

    await ctx.db.patch(args.routineId, {
      tasks: [...routine.tasks, newTask],
    });
  },
});

export const deleteTask = mutation({
  args: {
    routineId: v.id("routines"),
    taskId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const routine = await ctx.db.get(args.routineId);
    if (!routine || routine.userId !== userId) {
      throw new Error("Routine not found");
    }

    await enforceRateLimit(ctx, userId, "routines:structure", 30, 60_000);
    const taskId = assertShortId(args.taskId, "Task id", 100);
    if (!routine.tasks.some((task) => task.id === taskId)) throw new Error("Task not found");
    const updatedTasks = routine.tasks.filter((task) => task.id !== taskId);
    await ctx.db.patch(args.routineId, { tasks: updatedTasks });
  },
});

/**
 * ✅ NEW: Persist task reordering (hold + drag)
 * Fixes TS: always writes fully-typed task objects (no undefined)
 */
export const reorderTasks = mutation({
  args: {
    routineId: v.id("routines"),
    orderedTaskIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const routine = await ctx.db.get(args.routineId);
    if (!routine || routine.userId !== userId) {
      throw new Error("Routine not found");
    }

    await enforceRateLimit(ctx, userId, "routines:reorder", 60, 60_000);
    if (args.orderedTaskIds.length > LIMITS.tasksPerRoutine) throw new Error("Too many tasks");
    const orderedTaskIds = args.orderedTaskIds.map((id) => assertShortId(id, "Task id", 100));
    if (new Set(orderedTaskIds).size !== orderedTaskIds.length) throw new Error("Invalid task order");
    const byId = new Map(routine.tasks.map((t) => [t.id, t]));

    const reordered: typeof routine.tasks = [];
    for (const id of orderedTaskIds) {
      const t = byId.get(id);
      if (t) reordered.push(t);
    }
    for (const t of routine.tasks) {
      if (!orderedTaskIds.includes(t.id)) reordered.push(t);
    }

    const finalTasks = reordered.map((t, index) => ({
      id: t.id,
      name: t.name,
      completed: t.completed,
      order: index + 1,
    }));

    await ctx.db.patch(args.routineId, { tasks: finalTasks });
  },
});

export const completeDay = mutation({
  args: { dateKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const today = assertCurrentLocalDate(args.dateKey);
    await enforceRateLimit(ctx, userId, "routines:complete-day", 10, 60_000);
    // Update (or create) today's dailyProgress snapshot.
    const stats = await computeRoutineStats(ctx, userId, today);
    if (stats.completionRate < 80) {
      throw new Error("Reach at least 80% before completing the day.");
    }

    const dayDoc = await upsertDailyProgress(ctx, userId, stats);

    // Count it exactly once for Achievements/streak. Keep today's checkmarks
    // visible; the single daily reset will clear them on the next local day.
    await maybeCountDayInUserStats(ctx, userId, dayDoc, stats.completionRate, stats.completedTasks);
  },
});

export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const getTodayProgress = query({
  args: { dateKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const today = assertCurrentLocalDate(args.dateKey);
    
    return await ctx.db
      .query("dailyProgress")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .first();
  },
});

export const ensureUserStats = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) return;

    await ctx.db.insert("userStats", {
      userId,
      totalDaysCompleted: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalTasksCompleted: 0,
      averageCompletionRate: 0,
    });
  },
});

export const createRoutine = mutation({
  args: {
    name: v.string(),
    timeSlot: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await enforceRateLimit(ctx, userId, "routines:structure", 30, 60_000);
    const name = cleanText(args.name, "Routine name", LIMITS.routineName);
    const timeSlot = cleanText(args.timeSlot, "Time", LIMITS.timeSlot);
    const active = await ctx.db
      .query("routines")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .take(LIMITS.routines);
    if (active.length >= LIMITS.routines) throw new Error(`You can have up to ${LIMITS.routines} routines`);

    await ctx.db.insert("routines", {
      userId,
      name,
      timeSlot,
      tasks: [],
      isActive: true,
    });
  },
});

export const deleteRoutine = mutation({
  args: {
    routineId: v.id("routines"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const routine = await ctx.db.get(args.routineId);
    if (!routine || routine.userId !== userId) throw new Error("Routine not found");

    await enforceRateLimit(ctx, userId, "routines:structure", 30, 60_000);
    await ctx.db.delete(args.routineId);
  },
});

export const updateRoutine = mutation({
  args: {
    routineId: v.id("routines"),
    name: v.string(),
    timeSlot: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const routine = await ctx.db.get(args.routineId);
    if (!routine || routine.userId !== userId) throw new Error("Routine not found");

    await enforceRateLimit(ctx, userId, "routines:structure", 30, 60_000);
    const name = cleanText(args.name, "Routine name", LIMITS.routineName);
    const timeSlot = cleanText(args.timeSlot, "Time", LIMITS.timeSlot);
    await ctx.db.patch(args.routineId, { name, timeSlot });
  },
});
