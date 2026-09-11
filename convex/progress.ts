import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getUtcDateKeyDaysAgo, getUtcMonthStartKey, getUtcYearStartKey, parseUtcDateKey } from "./date";
import { LIMITS, assertCurrentLocalDate } from "./security";
import { dateRange, percentage, meanRecorded, type ProgressDay } from "./progressMath";

export const getProgressData = query({
  args: {
    dateKey: v.string(),
    timeFrame: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("yearly")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const today = assertCurrentLocalDate(args.dateKey);
    const base = parseUtcDateKey(today);
    const start = args.timeFrame === "daily" ? getUtcDateKeyDaysAgo(6, base)
      : args.timeFrame === "weekly" ? getUtcDateKeyDaysAgo(27, base)
      : args.timeFrame === "monthly" ? getUtcMonthStartKey(5, base) : getUtcYearStartKey(2, base);
    const [routineLogs, workoutLogs, habits, routines] = await Promise.all([
      ctx.db.query("dailyProgress").withIndex("by_user_date", q => q.eq("userId", userId).gte("date", start).lte("date", today)).collect(),
      ctx.db.query("workoutProgress").withIndex("by_user_date", q => q.eq("userId", userId).gte("date", start).lte("date", today)).collect(),
      ctx.db.query("habits").withIndex("by_user", q => q.eq("userId", userId)).take(LIMITS.habits),
      ctx.db.query("routines").withIndex("by_user_active", q => q.eq("userId", userId).eq("isActive", true)).take(LIMITS.routines),
    ]);
    const activeHabits = habits.filter(habit => habit.isActive !== false).map(habit => ({
      ...habit,
      firstDate: new Date(habit._creationTime).toISOString().slice(0, 10),
      entriesByDate: new Map(habit.entries.map(entry => [entry.date, entry.completed])),
    }));
    const routineMap = new Map(routineLogs.map(log => [log.date, log]));
    const workoutMap = new Map<string, typeof workoutLogs>();
    for (const log of workoutLogs) {
      const group = workoutMap.get(log.date) ?? [];
      group.push(log);
      workoutMap.set(log.date, group);
    }
    return dateRange(start, today).map(date => {
      const snapshot = routineMap.get(date);
      const workouts = workoutMap.get(date) ?? [];
      const day: ProgressDay = { date, routines: null, workouts: null, habits: null, tasksDone: 0, exercisesDone: 0, habitsDone: 0, workoutsCompleted: 0 };
      if (snapshot) {
        day.tasksDone = snapshot.completedTasks;
        day.routines = percentage(snapshot.completedTasks, snapshot.totalTasks);
      }
      if (date === today && !snapshot?.countedInStats) {
        day.tasksDone = routines.reduce((sum, routine) => sum + routine.tasks.filter(task => task.completed).length, 0);
        day.routines = percentage(day.tasksDone, routines.reduce((sum, routine) => sum + routine.tasks.length, 0));
      }
      day.exercisesDone = workouts.reduce((sum, log) => sum + Math.min(log.totalExercises, new Set(log.completedExercises).size), 0);
      day.workoutsCompleted = workouts.filter(log => log.completedWorkout).length;
      day.workouts = percentage(day.exercisesDone, workouts.reduce((sum, log) => sum + log.totalExercises, 0));
      // Include unmarked eligible habits in the denominator, not just checked ones.
      // History is explicitly scoped to habits that still exist and are active.
      const eligible = activeHabits.filter(habit => habit.firstDate <= date || habit.entriesByDate.has(date));
      if (date === today || eligible.some(habit => habit.entriesByDate.has(date))) {
        day.habitsDone = eligible.filter(habit => habit.entriesByDate.get(date) === true).length;
        day.habits = percentage(day.habitsDone, eligible.length);
      }
      // Keep older installed clients compatible while the new UI uses explicit nulls.
      return { ...day,
        routineCompletionRate: day.routines ?? 0,
        workoutCompletionRate: day.workouts ?? 0,
        habitCompletionRate: day.habits ?? 0,
        completionRate: meanRecorded([day.routines, day.workouts, day.habits]) ?? 0,
      };
    });
  },
});
