import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { LIMITS, assertCurrentLocalDate, assertIntegerInRange, assertShortId, cleanLongText, cleanText, enforceRateLimit } from "./security";
import { shiftUtcDateKey } from "./date";
import { keepDeleted } from "./recovery";

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;

// Copying a day is atomic and never touches the source or its recorded history.
export const copyWorkoutDay = mutation({
  args: { dayId: v.id("workoutDays"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const source = await ctx.db.get(args.dayId);
    if (!source || source.userId !== userId || !source.isActive) throw new Error("Workout day not found");
    const name = cleanText(args.name, "Workout day name", LIMITS.workoutDayName);
    await enforceRateLimit(ctx, userId, "workouts:structure", 30, 60_000);
    const days = await ctx.db.query("workoutDays").withIndex("by_user_active", q => q.eq("userId", userId).eq("isActive", true)).take(LIMITS.workoutDays);
    if (days.length >= LIMITS.workoutDays) throw new Error("Workout day limit reached. Edit an existing day instead.");
    return await ctx.db.insert("workoutDays", {
      userId, name, isActive: true, warmupNotes: source.warmupNotes,
      order: Math.max(0, ...days.map(day => day.order)) + 1,
      exercises: source.exercises.map((exercise, index) => ({
        ...exercise, id: uid(), completed: false, order: index + 1,
      })),
    });
  },
});

export const logExerciseResult = mutation({
  args: {
    dayId: v.id("workoutDays"), exerciseId: v.string(), dateKey: v.string(),
    reps: v.optional(v.number()), weightKg: v.optional(v.number()), holdSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const today = assertCurrentLocalDate(args.dateKey);
    const day = await ctx.db.get(args.dayId);
    if (!day || day.userId !== userId || day.deletedAt !== undefined || !day.isActive) throw new Error("Workout day not found");
    const exerciseId = assertShortId(args.exerciseId, "Exercise id", 100);
    const exercise = day.exercises.find(item => item.id === exerciseId);
    if (!exercise) throw new Error("Exercise not found");
    if ((args.reps === undefined) === (args.holdSeconds === undefined)) throw new Error("Enter either reps or a hold time.");
    if (args.reps !== undefined) assertIntegerInRange(args.reps, "Reps", 1, 1000);
    if (args.holdSeconds !== undefined && (!Number.isFinite(args.holdSeconds) || args.holdSeconds <= 0 || args.holdSeconds > 3600)) throw new Error("Hold time must be between 0 and 3600 seconds.");
    if (args.weightKg !== undefined && (args.reps === undefined || !Number.isFinite(args.weightKg) || args.weightKg < 0 || args.weightKg > 1000)) throw new Error("Load must be between 0 and 1000 kg and used with reps.");
    await enforceRateLimit(ctx, userId, "workouts:results", 60, 60_000);
    const result = { exerciseId, name: exercise.name, reps: args.reps, weightKg: args.weightKg, holdSeconds: args.holdSeconds };
    const existing = await ctx.db.query("workoutProgress").withIndex("by_user_date_day", q => q.eq("userId", userId).eq("date", today).eq("workoutDayId", args.dayId)).first();
    if (existing) {
      const results = (existing.exerciseResults ?? []).filter(item => item.exerciseId !== exerciseId);
      if (results.length >= LIMITS.exercisesPerWorkoutDay) throw new Error("Result limit reached for today.");
      await ctx.db.patch(existing._id, { exerciseResults: [...results, result] });
    } else {
      await assertWorkoutProgressQuota(ctx, userId, today);
      await ctx.db.insert("workoutProgress", {
        userId, date: today, workoutDayId: args.dayId, dayLabel: day.name,
        completedExercises: [], totalExercises: day.exercises.filter(item => !item.isWarmup).length,
        completionRate: 0, completedWorkout: false, exerciseResults: [result],
      });
    }
    return result;
  },
});

export const getExerciseResults = query({
  args: { dateKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const today = assertCurrentLocalDate(args.dateKey);
    const rows = await ctx.db.query("workoutProgress")
      .withIndex("by_user_date", q => q.eq("userId", userId).gte("date", shiftUtcDateKey(today, -89)).lte("date", today))
      .order("desc").take(120);
    return rows.flatMap(row => (row.exerciseResults ?? []).map(result => ({
      ...result, date: row.date, dayId: row.workoutDayId, dayName: row.dayLabel,
    })));
  },
});

// TS helper
function assertExists<T>(
  value: T | null | undefined,
  msg: string
): asserts value is T {
  if (value === null || value === undefined) throw new Error(msg);
}

async function assertWorkoutProgressQuota(ctx: any, userId: any, dateKey: string) {
  const rows = await ctx.db
    .query("workoutProgress")
    .withIndex("by_user_date", (q: any) => q.eq("userId", userId).eq("date", dateKey))
    .take(LIMITS.workoutDays + 1);
  if (rows.length >= LIMITS.workoutDays) {
    throw new Error("Workout progress limit reached for today");
  }
}

function safeCompleted(p: any): string[] {
  return Array.isArray(p?.completedExercises) ? p.completedExercises : [];
}


function getPreviousDateString(dateString: string) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().split("T")[0];
}

export const getWorkoutDays = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const days = await ctx.db
      .query("workoutDays")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .take(LIMITS.workoutDays);

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

    await enforceRateLimit(ctx, userId, "workouts:structure", 30, 60_000);
    const name = cleanText(args.name, "Workout day name", LIMITS.workoutDayName);
    const warmupNotes = args.warmupNotes === undefined ? undefined : cleanLongText(args.warmupNotes, "Warmup notes", LIMITS.warmupNotes, { optional: true });
    const existing = await ctx.db
      .query("workoutDays")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .take(LIMITS.workoutDays);
    if (existing.length >= LIMITS.workoutDays) {
      throw new Error(`You can have up to ${LIMITS.workoutDays} workout days`);
    }
    const maxOrder = existing.reduce((m, d) => Math.max(m, d.order), 0);

    await ctx.db.insert("workoutDays", {
      userId,
      name,
      warmupNotes,
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
    if (!day || day.userId !== userId || day.deletedAt !== undefined) throw new Error("Workout day not found");

    await enforceRateLimit(ctx, userId, "workouts:structure", 30, 60_000);
    const name = cleanText(args.name, "Workout day name", LIMITS.workoutDayName);
    const warmupNotes = args.warmupNotes === undefined ? undefined : cleanLongText(args.warmupNotes, "Warmup notes", LIMITS.warmupNotes, { optional: true });
    await ctx.db.patch(args.dayId, { name, warmupNotes });
  },
});

export const deleteWorkoutDay = mutation({
  args: { dayId: v.id("workoutDays") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const day = await ctx.db.get(args.dayId);
    if (!day || day.userId !== userId || day.deletedAt !== undefined) throw new Error("Workout day not found");

    await enforceRateLimit(ctx, userId, "workouts:structure", 30, 60_000);
    await keepDeleted(ctx, userId, { kind: "workoutDay", itemId: day._id, title: day.name });
    await ctx.db.patch(args.dayId, { isActive: false, deletedAt: Date.now() });
  },
});


export const applyWorkoutSplit = mutation({
  args: { names: v.array(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (args.names.length !== 7) throw new Error("A split must contain exactly 7 days");
    const names = args.names.map((name, index) =>
      cleanText(name, `Day ${index + 1} name`, LIMITS.workoutDayName),
    );

    // One rate-limit check and one Convex mutation means the visible workout
    // week updates atomically instead of flashing through seven separate writes.
    await enforceRateLimit(ctx, userId, "workouts:structure", 30, 60_000);
    const activeDays = await ctx.db
      .query("workoutDays")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .take(LIMITS.workoutDays);
    activeDays.sort((a, b) => a.order - b.order);

    for (let index = 0; index < names.length; index += 1) {
      const existing = activeDays[index];
      if (existing) {
        await ctx.db.patch(existing._id, {
          name: names[index],
          order: index + 1,
        });
      } else {
        await ctx.db.insert("workoutDays", {
          userId,
          name: names[index],
          order: index + 1,
          exercises: [],
          isActive: true,
        });
      }
    }

    // Extra/custom days belong to the user; changing split labels must not delete them.

    return { count: names.length };
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
    if (!day || day.userId !== userId || day.deletedAt !== undefined) throw new Error("Workout day not found");

    await enforceRateLimit(ctx, userId, "workouts:structure", 30, 60_000);
    const name = cleanText(args.name, "Exercise name", LIMITS.exerciseName);
    const reps = cleanText(args.reps, "Reps", LIMITS.reps);
    const muscles = cleanText(args.muscles, "Muscles", LIMITS.muscles);
    const notes =
      args.notes === undefined
        ? undefined
        : cleanLongText(args.notes, "Notes", LIMITS.exerciseNotes, { optional: true });
    const sets = assertIntegerInRange(args.sets, "Sets", 1, 100);

    const existing = Array.isArray(day.exercises) ? day.exercises : [];
    if (existing.length >= LIMITS.exercisesPerWorkoutDay) {
      throw new Error(`A workout day can have up to ${LIMITS.exercisesPerWorkoutDay} exercises`);
    }

    const ex = {
      id: uid(),
      name,
      sets,
      reps,
      muscles,
      notes,
      isWarmup: args.isWarmup ?? false,
      order: existing.length + 1,
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
    if (!day || day.userId !== userId || day.deletedAt !== undefined) throw new Error("Workout day not found");

    await enforceRateLimit(ctx, userId, "workouts:structure", 30, 60_000);
    const exerciseId = assertShortId(args.exerciseId, "Exercise id", 100);
    if (!day.exercises.some((ex) => ex.id === exerciseId)) throw new Error("Exercise not found");
    const name = cleanText(args.name, "Exercise name", LIMITS.exerciseName);
    const reps = cleanText(args.reps, "Reps", LIMITS.reps);
    const muscles = cleanText(args.muscles, "Muscles", LIMITS.muscles);
    const notes = args.notes === undefined ? undefined : cleanLongText(args.notes, "Notes", LIMITS.exerciseNotes, { optional: true });
    const sets = assertIntegerInRange(args.sets, "Sets", 1, 100);

    const updated = day.exercises.map((ex) =>
      ex.id === exerciseId
        ? {
            ...ex,
            name,
            sets,
            reps,
            muscles,
            isWarmup: args.isWarmup,
            notes,
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
    if (!day || day.userId !== userId || day.deletedAt !== undefined) throw new Error("Workout day not found");

    await enforceRateLimit(ctx, userId, "workouts:structure", 30, 60_000);
    const exerciseId = assertShortId(args.exerciseId, "Exercise id", 100);
    if (!day.exercises.some((ex) => ex.id === exerciseId)) throw new Error("Exercise not found");
    const updated = day.exercises.filter((ex) => ex.id !== exerciseId);
    const deletedExercise = day.exercises.find(ex => ex.id === exerciseId)!;
    await keepDeleted(ctx, userId, { kind: "exercise", itemId: exerciseId, parentId: day._id, title: deletedExercise.name, snapshot: deletedExercise });
    await ctx.db.patch(args.dayId, { exercises: updated });
  },
});

export const getTodayWorkoutProgress = query({
  args: {
    dayId: v.optional(v.id("workoutDays")),
    dateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const today = assertCurrentLocalDate(args.dateKey);

    if (args.dayId) {
      return await ctx.db
        .query("workoutProgress")
        .withIndex("by_user_date_day", (q) =>
          q.eq("userId", userId).eq("date", today).eq("workoutDayId", args.dayId)
        )
        .first();
    }

    return await ctx.db
      .query("workoutProgress")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .first();
  },
});

export const toggleExerciseComplete = mutation({
  args: {
    dayId: v.id("workoutDays"),
    exerciseId: v.string(),
    dateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const day = await ctx.db.get(args.dayId);
    if (!day || day.userId !== userId || day.deletedAt !== undefined) throw new Error("Workout day not found");
    const exerciseId = assertShortId(args.exerciseId, "Exercise id", 100);
    if (!day.exercises.some((ex) => ex.id === exerciseId)) throw new Error("Exercise not found");

    const today = assertCurrentLocalDate(args.dateKey);
    const eligibleIds = new Set(day.exercises.filter(exercise => !exercise.isWarmup).map(exercise => exercise.id));
    if (!eligibleIds.has(exerciseId)) throw new Error("Warmups are not included in workout completion.");
    const totalExercises = eligibleIds.size;

    const existing = await ctx.db
      .query("workoutProgress")
      .withIndex("by_user_date_day", (q) =>
        q.eq("userId", userId).eq("date", today).eq("workoutDayId", args.dayId)
      )
      .first();

    let progress = existing;

    if (progress?.completedWorkout) {
      throw new Error("This workout is already completed for today.");
    }

    // create if none
    if (!progress) {
      await assertWorkoutProgressQuota(ctx, userId, today);
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

    const nowCompleted = [...new Set(safeCompleted(progress))].filter(id => eligibleIds.has(id));
    const exists = nowCompleted.includes(exerciseId);

    const nextCompleted = exists
      ? nowCompleted.filter((id) => id !== exerciseId)
      : [...nowCompleted, exerciseId];

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
    dateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const day = await ctx.db.get(args.dayId);
    if (!day || day.userId !== userId || day.deletedAt !== undefined) throw new Error("Workout day not found");

    const today = assertCurrentLocalDate(args.dateKey);
    const eligibleIds = new Set(day.exercises.filter(exercise => !exercise.isWarmup).map(exercise => exercise.id));
    const totalExercises = eligibleIds.size;

    const existing = await ctx.db
      .query("workoutProgress")
      .withIndex("by_user_date_day", (q) =>
        q.eq("userId", userId).eq("date", today).eq("workoutDayId", args.dayId)
      )
      .first();

    let progress = existing;

    // Already-saved historical snapshots must not be recalculated after editing a template.
    if (progress?.completedWorkout) return { completionRate: progress.completionRate };

    if (!progress) {
      await assertWorkoutProgressQuota(ctx, userId, today);
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

    const completedExercises = [...new Set(safeCompleted(progress))].filter(id => eligibleIds.has(id));
    const completedCount = completedExercises.length;
    const completionRate =
      totalExercises > 0 ? (completedCount / totalExercises) * 100 : 0;

    await ctx.db.patch(progress._id, {
      completedExercises,
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

    await enforceRateLimit(ctx, userId, "workouts:complete", 12, 60_000);

    // Determine streak state from only today/yesterday instead of scanning the
    // user's entire workout history on every completion.
    const sameDayEntries = await ctx.db
      .query("workoutProgress")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .take(LIMITS.workoutDays);
    const hadCompletedToday = sameDayEntries.some(
      (entry) => entry._id !== progress._id && entry.completedWorkout,
    );

    await ctx.db.patch(progress._id, { completedWorkout: true });

    const stats = await ctx.db
      .query("workoutStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!stats) {
      await ctx.db.insert("workoutStats", {
        userId,
        totalWorkouts: 1,
        currentStreak: 1,
        longestStreak: 1,
        averageCompletionRate: completionRate,
        lastCompletionDate: today,
      });
    } else {
      let currentStreak = Math.max(1, stats.currentStreak);
      if (!hadCompletedToday) {
        const previousDate = getPreviousDateString(today);
        let continued = stats.lastCompletionDate === previousDate;

        // Legacy stats may not have lastCompletionDate yet. Check only the
        // previous calendar day, which is bounded by the workout-day quota.
        if (!stats.lastCompletionDate) {
          const yesterdayEntries = await ctx.db
            .query("workoutProgress")
            .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", previousDate))
            .take(LIMITS.workoutDays);
          continued = yesterdayEntries.some((entry) => entry.completedWorkout);
        }

        currentStreak = continued ? Math.max(1, stats.currentStreak) + 1 : 1;
      }

      const newTotal = stats.totalWorkouts + 1;
      const newAvg =
        (stats.averageCompletionRate * stats.totalWorkouts + completionRate) / newTotal;

      await ctx.db.patch(stats._id, {
        totalWorkouts: newTotal,
        currentStreak,
        longestStreak: Math.max(stats.longestStreak, currentStreak),
        averageCompletionRate: newAvg,
        lastCompletionDate: today,
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
export const backfillWorkoutProgress = internalMutation({
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
