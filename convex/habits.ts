import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertDateKey, shiftUtcDateKey } from "./date";

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

function getPreviousDateString(dateString: string) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().split("T")[0];
}

function calculateHabitStreaks(entries: { date: string; completed: boolean }[], today = getTodayDateString()) {
  const completedDates = Array.from(
    new Set(entries.filter((entry) => entry.completed).map((entry) => entry.date))
  ).sort();

  if (completedDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
    };
  }

  let longestStreak = 0;
  let runningStreak = 0;
  let previousDate: string | null = null;

  for (const date of completedDates) {
    if (previousDate && getPreviousDateString(date) === previousDate) {
      runningStreak += 1;
    } else {
      runningStreak = 1;
    }

    longestStreak = Math.max(longestStreak, runningStreak);
    previousDate = date;
  }

  let currentStreak = 0;

  if (completedDates[completedDates.length - 1] === today) {
    currentStreak = 1;
    let cursor = today;

    for (let i = completedDates.length - 2; i >= 0; i -= 1) {
      const expectedPreviousDate = getPreviousDateString(cursor);
      if (completedDates[i] !== expectedPreviousDate) {
        break;
      }
      currentStreak += 1;
      cursor = completedDates[i];
    }
  }

  return {
    currentStreak,
    longestStreak,
  };
}

export const getHabits = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("habits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getHabitStats = query({
  args: { dateKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const habits = await ctx.db
      .query("habits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (habits.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        averageCompletionRate: 0,
        totalHabits: 0,
      };
    }

    const derivedStreaks = habits.map((habit) => calculateHabitStreaks(habit.entries, assertDateKey(args.dateKey)));
    const totalCurrentStreak = derivedStreaks.reduce((sum, streak) => sum + streak.currentStreak, 0);
    const totalLongestStreak = Math.max(...derivedStreaks.map((streak) => streak.longestStreak));

    const today = assertDateKey(args.dateKey);
    // Calculate average completion rate over the last 30 local calendar days.
    const thirtyDaysAgoStr = shiftUtcDateKey(today, -29);

    let totalDays = 0;
    let completedDays = 0;

    habits.forEach((habit) => {
      const recentEntries = habit.entries.filter((entry) => entry.date >= thirtyDaysAgoStr);
      totalDays += recentEntries.length;
      completedDays += recentEntries.filter((entry) => entry.completed).length;
    });

    const averageCompletionRate = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

    return {
      currentStreak: totalCurrentStreak,
      longestStreak: totalLongestStreak,
      averageCompletionRate,
      totalHabits: habits.length,
    };
  },
});

export const createHabit = mutation({
  args: {
    name: v.string(),
    type: v.union(v.literal("build"), v.literal("break")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.insert("habits", {
      userId,
      name: args.name,
      description: "",
      category: "personal",
      frequency: "daily",
      targetCount: 1,
      type: args.type,
      currentStreak: 0,
      bestStreak: 0,
      longestStreak: 0,
      completions: [],
      entries: [],
      isActive: true,
    });
  },
});

export const logHabit = mutation({
  args: {
    habitId: v.id("habits"),
    completed: v.boolean(),
    dateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== userId) {
      throw new Error("Habit not found");
    }

    const today = assertDateKey(args.dateKey);
    const existingEntryIndex = habit.entries.findIndex((entry) => entry.date === today);
    const newEntries = [...habit.entries];

    if (existingEntryIndex >= 0) {
      newEntries[existingEntryIndex] = { date: today, completed: args.completed };
    } else {
      newEntries.push({ date: today, completed: args.completed });
    }

    const { currentStreak, longestStreak } = calculateHabitStreaks(newEntries, today);

    await ctx.db.patch(args.habitId, {
      entries: newEntries,
      currentStreak,
      longestStreak,
      bestStreak: Math.max(habit.bestStreak || 0, longestStreak),
    });
  },
});

export const deleteHabit = mutation({
  args: {
    habitId: v.id("habits"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== userId) {
      throw new Error("Habit not found");
    }

    await ctx.db.delete(args.habitId);
  },
});
