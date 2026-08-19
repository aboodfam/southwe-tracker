import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  assertDateKey,
  getUtcDateKeyDaysAgo,
  getUtcMonthStartKey,
  getUtcYearStartKey,
  parseUtcDateKey,
} from "./date";

type DayProgress = {
  date: string;
  routineCompletionRate: number;
  workoutCompletionRate: number;
  habitCompletionRate: number;
  completionRate: number;
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export const getProgressData = query({
  args: {
    dateKey: v.string(),
    timeFrame: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("yearly"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const today = assertDateKey(args.dateKey);
    const baseDate = parseUtcDateKey(today);
    let startDateStr: string;

    switch (args.timeFrame) {
      case "daily":
        startDateStr = getUtcDateKeyDaysAgo(6, baseDate);
        break;
      case "weekly":
        startDateStr = getUtcDateKeyDaysAgo(27, baseDate);
        break;
      case "monthly":
        startDateStr = getUtcMonthStartKey(5, baseDate);
        break;
      case "yearly":
        startDateStr = getUtcYearStartKey(2, baseDate);
        break;
      default:
        startDateStr = getUtcDateKeyDaysAgo(6, baseDate);
    }

    const [dailyProgress, workoutProgress, habits, routines, workoutDays] = await Promise.all([
      ctx.db
        .query("dailyProgress")
        .withIndex("by_user_date", (q) => q.eq("userId", userId))
        .filter((q) => q.gte(q.field("date"), startDateStr))
        .collect(),
      ctx.db
        .query("workoutProgress")
        .withIndex("by_user_date", (q) => q.eq("userId", userId))
        .filter((q) => q.gte(q.field("date"), startDateStr))
        .collect(),
      ctx.db
        .query("habits")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("routines")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("workoutDays")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    const activeHabits = habits.filter((habit) => habit.isActive !== false);
    const hasRoutineTracking = routines.some((routine) => routine.isActive !== false);
    const hasWorkoutTracking = workoutDays.some((day) => day.isActive !== false);
    const hasHabitTracking = activeHabits.length > 0;

    const progressMap = new Map<string, DayProgress>();

    const ensureDay = (date: string) => {
      if (!progressMap.has(date)) {
        progressMap.set(date, {
          date,
          routineCompletionRate: 0,
          workoutCompletionRate: 0,
          habitCompletionRate: 0,
          completionRate: 0,
        });
      }
      return progressMap.get(date)!;
    };

    dailyProgress.forEach((day) => {
      ensureDay(day.date).routineCompletionRate = day.completionRate;
    });

    // For the current local day, the live routine documents are authoritative.
    // Historical days keep their saved dailyProgress snapshots.
    const todayRoutineSnapshot = dailyProgress.find((day) => day.date === today);
    if (hasRoutineTracking && todayRoutineSnapshot?.countedInStats !== true) {
      const activeRoutines = routines.filter((routine) => routine.isActive !== false);
      const totalTasks = activeRoutines.reduce((sum, routine) => sum + routine.tasks.length, 0);
      const completedTasks = activeRoutines.reduce(
        (sum, routine) => sum + routine.tasks.filter((task) => task.completed).length,
        0,
      );
      if (totalTasks > 0 || dailyProgress.some((day) => day.date === today)) {
        ensureDay(today).routineCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
      }
    }

    const workoutRatesByDate = new Map<string, number[]>();
    workoutProgress.forEach((workout) => {
      const rates = workoutRatesByDate.get(workout.date) ?? [];
      rates.push(workout.completionRate);
      workoutRatesByDate.set(workout.date, rates);
    });
    workoutRatesByDate.forEach((rates, date) => {
      ensureDay(date).workoutCompletionRate = average(rates);
    });

    const habitTotalsByDate = new Map<string, { completed: number; total: number }>();

    activeHabits.forEach((habit) => {
      const seenDates = new Set<string>();

      habit.entries.forEach((entry) => {
        if (entry.date < startDateStr || seenDates.has(entry.date)) return;
        seenDates.add(entry.date);

        const current = habitTotalsByDate.get(entry.date) ?? { completed: 0, total: 0 };
        current.total += 1;
        if (entry.completed) current.completed += 1;
        habitTotalsByDate.set(entry.date, current);
      });
    });

    habitTotalsByDate.forEach(({ completed, total }, date) => {
      ensureDay(date).habitCompletionRate = total > 0 ? (completed / total) * 100 : 0;
    });

    const result = Array.from(progressMap.values()).map((day) => {
      const rates: number[] = [];

      if (hasRoutineTracking) rates.push(day.routineCompletionRate);
      if (hasWorkoutTracking) rates.push(day.workoutCompletionRate);
      if (hasHabitTracking) rates.push(day.habitCompletionRate);

      day.completionRate = average(rates);
      return day;
    });

    return result
      .filter((day) => day.date >= startDateStr && day.date <= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});
