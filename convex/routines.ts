import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Matches the `routines.tasks` object schema in `convex/schema.ts`.
type RoutineTask = {
  id: string;
  name: string;
  completed: boolean;
  order: number;
};

export const getRoutines = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("routines")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const resetDailyTasks = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const today = isoDate(new Date());
    
    // Check if user has completed today already
    const todayProgress = await ctx.db
      .query("dailyProgress")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .first();

    // If no progress for today, reset all tasks
    if (!todayProgress) {
      const userRoutines = await ctx.db
        .query("routines")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      for (const routine of userRoutines) {
        const resetTasks = routine.tasks.map((task: RoutineTask) => ({ ...task, completed: false }));
        await ctx.db.patch(routine._id, { tasks: resetTasks });
      }
    }
  },
});

export const createDefaultRoutines = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if routines already exist
    const existing = await ctx.db
      .query("routines")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) return;

    const defaultRoutines = [
      {
        name: "Morning Routine",
        timeSlot: "5:00AM",
        tasks: [
          { id: "1", name: "Pre workout", completed: false, order: 1 },
          { id: "2", name: "Workout", completed: false, order: 2 },
          { id: "3", name: "Meal", completed: false, order: 3 },
          { id: "4", name: "Creatine", completed: false, order: 4 },
          { id: "5", name: "School", completed: false, order: 5 },
          { id: "6", name: "Athkar while in way to school", completed: false, order: 6 },
          { id: "7", name: "Drink 1.5L Water + Athkar omw home", completed: false, order: 7 },
        ],
      },
      {
        name: "Afternoon Routine",
        timeSlot: "Afternoon",
        tasks: [
          { id: "8", name: "Meditation + Reflex ball + stretches", completed: false, order: 1 },
          { id: "9", name: "Work on Website", completed: false, order: 2 },
        ],
      },
      {
        name: "Evening Routine",
        timeSlot: "Evening",
        tasks: [
          { id: "10", name: "Play", completed: false, order: 1 },
          { id: "11", name: "Chess Learning (Tactics Masterclass + puzzles) 1h", completed: false, order: 2 },
          { id: "12", name: "Pray", completed: false, order: 3 },
          { id: "13", name: "Learn/cyber/investments/islam (one of this) 1h", completed: false, order: 4 },
        ],
      },
      {
        name: "Night Routine",
        timeSlot: "9:00PM",
        tasks: [
          { id: "14", name: "Any Homework + study + eat meal", completed: false, order: 1 },
          { id: "15", name: "Oil pulling", completed: false, order: 2 },
          { id: "16", name: "Facial care", completed: false, order: 3 },
          { id: "17", name: "Brush teeth", completed: false, order: 4 },
          { id: "18", name: "Sleep", completed: false, order: 5 },
        ],
      },
    ];

    for (const routine of defaultRoutines) {
      await ctx.db.insert("routines", {
        userId,
        ...routine,
        isActive: true,
      });
    }

    // Initialize user stats
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


// --- Helpers for daily progress & achievements counting ---
function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function diffDays(a: string, b: string) {
  // returns whole-day difference between ISO dates (b - a)
  const msPerDay = 24 * 60 * 60 * 1000;
  const aMs = Date.parse(a);
  const bMs = Date.parse(b);
  return Math.floor((bMs - aMs) / msPerDay);
}

async function computeRoutineStats(ctx: any, userId: any) {
  const today = isoDate(new Date());

  const routines = await ctx.db
    .query("routines")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .collect();

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
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const routine = await ctx.db.get(args.routineId);
    if (!routine || routine.userId !== userId) {
      throw new Error("Routine not found");
    }

    const updatedTasks = routine.tasks.map((task) =>
      task.id === args.taskId ? { ...task, completed: !task.completed } : task
    );

    await ctx.db.patch(args.routineId, { tasks: updatedTasks });

    // Update today's routine progress (used by Progress & Achievements).
    const stats = await computeRoutineStats(ctx, userId);
    const dayDoc = await upsertDailyProgress(ctx, userId, stats);
    await maybeCountDayInUserStats(ctx, userId, dayDoc, stats.completionRate, stats.completedTasks);

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

    const updatedTasks = routine.tasks.map((task) =>
      task.id === args.taskId ? { ...task, name: args.name } : task
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

    const newTask = {
      id: Date.now().toString(),
      name: args.name,
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

    const updatedTasks = routine.tasks.filter((task) => task.id !== args.taskId);

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

    const byId = new Map(routine.tasks.map((t) => [t.id, t]));

    const reordered: typeof routine.tasks = [];
    for (const id of args.orderedTaskIds) {
      const t = byId.get(id);
      if (t) reordered.push(t);
    }
    for (const t of routine.tasks) {
      if (!args.orderedTaskIds.includes(t.id)) reordered.push(t);
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
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Update (or create) today's dailyProgress snapshot.
    const stats = await computeRoutineStats(ctx, userId);
    const dayDoc = await upsertDailyProgress(ctx, userId, stats);

    // If the day has reached the threshold, count it exactly once for Achievements/streak.
    await maybeCountDayInUserStats(ctx, userId, dayDoc, stats.completionRate, stats.completedTasks);

    // We already have the routines list in stats.
    const routines = stats.routines;

    // Reset all tasks for next day
    for (const routine of routines) {
      const resetTasks = routine.tasks.map((task: RoutineTask) => ({ ...task, completed: false }));
      await ctx.db.patch(routine._id, { tasks: resetTasks });
    }
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
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const today = isoDate(new Date());
    
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

    const name = args.name.trim();
    const timeSlot = args.timeSlot.trim();

    if (!name) throw new Error("Routine name is required");
    if (!timeSlot) throw new Error("Time is required");

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

    // safer than delete: keeps old progress references stable
    await ctx.db.patch(args.routineId, { isActive: false });
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

    await ctx.db.patch(args.routineId, {
      name: args.name.trim(),
      timeSlot: args.timeSlot.trim(),
    });
  },
});
