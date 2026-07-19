import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getUtcDateKey } from "./date";

const todayKey = () => getUtcDateKey();

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;

// TS helper
function assertExists<T>(
  value: T | null | undefined,
  msg: string
): asserts value is T {
  if (value === null || value === undefined) throw new Error(msg);
}

function safeCompleted(p: any): string[] {
  return Array.isArray(p?.completedExercises) ? p.completedExercises : [];
}
function safeNumber(n: any, fallback = 0): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}


function getPreviousDateString(dateString: string) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().split("T")[0];
}

function calculateWorkoutStreaks(completedDates: string[]) {
  const uniqueDates = Array.from(new Set(completedDates)).sort();

  if (uniqueDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let longestStreak = 0;
  let runningStreak = 0;
  let previousDate: string | null = null;

  for (const date of uniqueDates) {
    if (previousDate && getPreviousDateString(date) === previousDate) {
      runningStreak += 1;
    } else {
      runningStreak = 1;
    }

    longestStreak = Math.max(longestStreak, runningStreak);
    previousDate = date;
  }

  const today = todayKey();
  let currentStreak = 0;

  if (uniqueDates[uniqueDates.length - 1] === today) {
    currentStreak = 1;
    let cursor = today;

    for (let i = uniqueDates.length - 2; i >= 0; i -= 1) {
      const expectedPreviousDate = getPreviousDateString(cursor);
      if (uniqueDates[i] !== expectedPreviousDate) {
        break;
      }
      currentStreak += 1;
      cursor = uniqueDates[i];
    }
  }

  return { currentStreak, longestStreak };
}

export const getWorkoutDays = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const days = await ctx.db
      .query("workoutDays")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return days.sort((a, b) => a.order - b.order);
  },
});

export const createWorkoutDay = mutation({
  args: {
    name: v.string(),
    warmupNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const name = args.name.trim();
    if (!name) throw new Error("Day name is required");

    const existing = await ctx.db
      .query("workoutDays")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const maxOrder = existing.reduce((m, d) => Math.max(m, d.order), 0);

    await ctx.db.insert("workoutDays", {
      userId,
      name,
      warmupNotes: args.warmupNotes?.trim() || undefined,
      order: maxOrder + 1,
      exercises: [],
      isActive: true,
    });
  },
});

export const updateWorkoutDay = mutation({
  args: {
    dayId: v.id("workoutDays"),
    name: v.string(),
    warmupNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const day = await ctx.db.get(args.dayId);
    if (!day || day.userId !== userId) throw new Error("Workout day not found");

    const name = args.name.trim();
    if (!name) throw new Error("Day name is required");

    await ctx.db.patch(args.dayId, {
      name,
      warmupNotes: args.warmupNotes?.trim() || undefined,
    });
  },
});

export const deleteWorkoutDay = mutation({
  args: { dayId: v.id("workoutDays") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const day = await ctx.db.get(args.dayId);
    if (!day || day.userId !== userId) throw new Error("Workout day not found");

    await ctx.db.patch(args.dayId, { isActive: false });
  },
});

export const addExercise = mutation({
  args: {
    dayId: v.id("workoutDays"),
    name: v.string(),
    sets: v.number(),
    reps: v.string(),
    muscles: v.string(),
    isWarmup: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const day = await ctx.db.get(args.dayId);
    if (!day || day.userId !== userId) throw new Error("Workout day not found");

    const name = args.name.trim();
    const reps = args.reps.trim();
    const muscles = args.muscles.trim();
    if (!name) throw new Error("Exercise name is required");
    if (!reps) throw new Error("Reps is required");
    if (!muscles) throw new Error("Muscles is required");

    
const existing = Array.isArray((day as any).exercises) ? (day as any).exercises : [];
const nextOrder = existing.length + 1;

const ex = {
  id: uid(),
  name,
  sets: args.sets,
  reps,
  muscles,
  notes: args.notes?.trim() || undefined,
  isWarmup: args.isWarmup ?? false,
  order: nextOrder,
};

await ctx.db.patch(args.dayId, {
  exercises: [...existing, ex],
});

return ex;

  },
});

export const updateExercise = mutation({
  args: {
    dayId: v.id("workoutDays"),
    exerciseId: v.string(),
    name: v.string(),
    sets: v.number(),
    reps: v.string(),
    muscles: v.string(),
    isWarmup: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const day = await ctx.db.get(args.dayId);
    if (!day || day.userId !== userId) throw new Error("Workout day not found");

    const name = args.name.trim();
    const reps = args.reps.trim();
    const muscles = args.muscles.trim();
    if (!name) throw new Error("Exercise name is required");
    if (!reps) throw new Error("Reps is required");
    if (!muscles) throw new Error("Muscles is required");

    const updated = day.exercises.map((ex) =>
      ex.id === args.exerciseId
        ? {
            ...ex,
            name,
            sets: args.sets,
            reps,
            muscles,
            isWarmup: args.isWarmup,
            notes: args.notes?.trim() || undefined,
          }
        : ex
    );

    await ctx.db.patch(args.dayId, { exercises: updated });
  },
});

export const deleteExercise = mutation({
  args: { dayId: v.id("workoutDays"), exerciseId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const day = await ctx.db.get(args.dayId);
    if (!day || day.userId !== userId) throw new Error("Workout day not found");

    const updated = day.exercises.filter((ex) => ex.id !== args.exerciseId);
    await ctx.db.patch(args.dayId, { exercises: updated });
  },
});

export const getTodayWorkoutProgress = query({
  args: {
    dayId: v.optional(v.id("workoutDays")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const today = todayKey();
    const p = await ctx.db
      .query("workoutProgress")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .first();

    if (!p) return null;
    if (args.dayId && p.workoutDayId && p.workoutDayId !== args.dayId) return null;

    return p;
  },
});

export const toggleExerciseComplete = mutation({
  args: {
    dayId: v.id("workoutDays"),
    exerciseId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const day = await ctx.db.get(args.dayId);
    if (!day || day.userId !== userId) throw new Error("Workout day not found");

    const today = todayKey();
    const totalExercises = day.exercises.length;

    const existing = await ctx.db
      .query("workoutProgress")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .first();

    let progress = existing;

    // create if none
    if (!progress) {
      const insertedId = await ctx.db.insert("workoutProgress", {
        userId,
        date: today,
        workoutDayId: args.dayId,
        dayLabel: day.name,
        completedExercises: [],
        totalExercises,
        completionRate: 0,
        completedWorkout: false,
      });

      const created = await ctx.db.get(insertedId);
      assertExists(created, "Progress not found");
      progress = created;
    }

    // normalize legacy doc fields
    const completed = safeCompleted(progress);

    // if progress exists but is for different day, reset to this day
    if (progress.workoutDayId !== args.dayId) {
      await ctx.db.patch(progress._id, {
        workoutDayId: args.dayId,
        dayLabel: day.name,
        completedExercises: [],
        totalExercises,
        completionRate: 0,
        completedWorkout: false,
      });

      progress = {
        ...progress,
        workoutDayId: args.dayId,
        dayLabel: day.name,
        completedExercises: [],
        totalExercises,
        completionRate: 0,
        completedWorkout: false,
      };
    }

    const nowCompleted = safeCompleted(progress);
    const exists = nowCompleted.includes(args.exerciseId);

    const nextCompleted = exists
      ? nowCompleted.filter((id) => id !== args.exerciseId)
      : [...nowCompleted, args.exerciseId];

    const completionRate =
      totalExercises > 0 ? (nextCompleted.length / totalExercises) * 100 : 0;

    await ctx.db.patch(progress._id, {
      completedExercises: nextCompleted,
      totalExercises,
      completionRate,
      dayLabel: day.name,
    });

    return { completionRate };
  },
});

export const completeWorkout = mutation({
  args: {
    dayId: v.id("workoutDays"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const day = await ctx.db.get(args.dayId);
    if (!day || day.userId !== userId) throw new Error("Workout day not found");

    const today = todayKey();
    const totalExercises = day.exercises.length;

    const existing = await ctx.db
      .query("workoutProgress")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .first();

    let progress = existing;

    if (!progress) {
      const insertedId = await ctx.db.insert("workoutProgress", {
        userId,
        date: today,
        workoutDayId: args.dayId,
        dayLabel: day.name,
        completedExercises: [],
        totalExercises,
        completionRate: 0,
        completedWorkout: false,
      });

      const created = await ctx.db.get(insertedId);
      assertExists(created, "Progress not found");
      progress = created;
    }

    // if for different day, reset
    if (progress.workoutDayId !== args.dayId) {
      await ctx.db.patch(progress._id, {
        workoutDayId: args.dayId,
        dayLabel: day.name,
        completedExercises: [],
        totalExercises,
        completionRate: 0,
        completedWorkout: false,
      });

      progress = {
        ...progress,
        workoutDayId: args.dayId,
        dayLabel: day.name,
        completedExercises: [],
        totalExercises,
        completionRate: 0,
        completedWorkout: false,
      };
    }

    const completedExercises = safeCompleted(progress);
    const completedCount = completedExercises.length;
    const completionRate =
      totalExercises > 0 ? (completedCount / totalExercises) * 100 : 0;

    await ctx.db.patch(progress._id, {
      totalExercises,
      completionRate,
      dayLabel: day.name,
    });

    // prevent double count
    if (progress.completedWorkout) {
      return { completionRate };
    }

    if (completionRate < 70) {
      throw new Error("Complete at least 70% of exercises to finish the workout.");
    }

    await ctx.db.patch(progress._id, { completedWorkout: true });

    const completedProgress = await ctx.db
      .query("workoutProgress")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .collect();

    const completedDates = completedProgress
      .filter((entry) => entry.completedWorkout)
      .map((entry) => entry.date);

    if (!completedDates.includes(today)) {
      completedDates.push(today);
    }

    const { currentStreak, longestStreak } = calculateWorkoutStreaks(completedDates);

    const stats = await ctx.db
      .query("workoutStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!stats) {
      await ctx.db.insert("workoutStats", {
        userId,
        totalWorkouts: 1,
        currentStreak,
        longestStreak,
        averageCompletionRate: completionRate,
      });
    } else {
      const newTotal = stats.totalWorkouts + 1;
      const newAvg =
        (stats.averageCompletionRate * stats.totalWorkouts + completionRate) /
        newTotal;

      await ctx.db.patch(stats._id, {
        totalWorkouts: newTotal,
        currentStreak,
        longestStreak: Math.max(stats.longestStreak, longestStreak),
        averageCompletionRate: newAvg,
      });
    }

    return { completionRate };
  },
});

export const getWorkoutStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("workoutStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

/**
 * Optional cleanup: fills missing fields for old docs.
 * (You can run it later from Convex dashboard -> Functions -> Run)
 */
export const backfillWorkoutProgress = mutation({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("workoutProgress").collect();
    let patched = 0;

    for (const d of docs) {
      const doc: any = d;
      const patch: any = {};

      // allow old numeric day -> label
      if (doc.dayLabel === undefined) {
        if (typeof doc.day === "number") patch.dayLabel = `Day ${doc.day}`;
        else patch.dayLabel = "Workout";
      }

      if (doc.completedExercises === undefined) patch.completedExercises = [];
      if (doc.totalExercises === undefined)
        patch.totalExercises = (doc.completedExercises?.length ?? 0);
      if (doc.completionRate === undefined) patch.completionRate = 0;
      if (doc.completedWorkout === undefined) patch.completedWorkout = false;

      if (Object.keys(patch).length) {
        await ctx.db.patch(doc._id, patch);
        patched++;
      }
    }

    return { scanned: docs.length, patched };
  },
});
