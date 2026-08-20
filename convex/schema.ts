import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  routines: defineTable({
    userId: v.id("users"),
    name: v.string(),
    timeSlot: v.string(),
    tasks: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        completed: v.boolean(),
        order: v.number(),
      })
    ),
    isActive: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"]),

  userStats: defineTable({
    userId: v.id("users"),
    lastCompletionDate: v.optional(v.string()),
    totalDaysCompleted: v.number(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    totalTasksCompleted: v.number(),
    averageCompletionRate: v.number(),

    // Legacy fields kept optional so existing deployed documents still validate.
    totalTasks: v.optional(v.number()),
    completedTasks: v.optional(v.number()),
    streak: v.optional(v.number()),
    level: v.optional(v.number()),
    xp: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  habits: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    frequency: v.optional(v.string()),
    targetCount: v.optional(v.number()),
    currentStreak: v.number(),
    bestStreak: v.optional(v.number()),
    longestStreak: v.number(),
    completions: v.optional(v.array(v.string())),
    entries: v.array(
      v.object({
        date: v.string(),
        completed: v.boolean(),
      })
    ),
    isActive: v.optional(v.boolean()),
    type: v.string(),
  }).index("by_user", ["userId"]),

  workouts: defineTable({
    userId: v.id("users"),
    name: v.string(),
    exercises: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        sets: v.number(),
        reps: v.union(v.number(), v.string()),
        weight: v.optional(v.number()),
        duration: v.optional(v.number()),
        completed: v.optional(v.boolean()),
        muscles: v.optional(v.string()),
        isWarmup: v.optional(v.boolean()),
        notes: v.optional(v.string()),
        order: v.optional(v.number()),
      })
    ),
    duration: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    isTemplate: v.boolean(),
  }).index("by_user", ["userId"]),

  workoutDays: defineTable({
    userId: v.id("users"),
    name: v.string(),
    exercises: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        sets: v.number(),
        reps: v.union(v.number(), v.string()),
        weight: v.optional(v.number()),
        duration: v.optional(v.number()),
        completed: v.optional(v.boolean()),
        muscles: v.optional(v.string()),
        isWarmup: v.optional(v.boolean()),
        notes: v.optional(v.string()),
        order: v.optional(v.number()),
      })
    ),
    isActive: v.boolean(),
    order: v.number(),
    warmupNotes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"]),

  workoutStats: defineTable({
    userId: v.id("users"),
    totalWorkouts: v.number(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    averageCompletionRate: v.number(),
    lastCompletionDate: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  workoutProgress: defineTable({
    userId: v.id("users"),
    date: v.string(),
    workoutDayId: v.optional(v.id("workoutDays")),
    dayLabel: v.string(),
    completedExercises: v.array(v.string()),
    totalExercises: v.number(),
    completionRate: v.number(),
    completedWorkout: v.boolean(),
    day: v.optional(v.number()),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user_date_day", ["userId", "date", "workoutDayId"]),

  dailyProgress: defineTable({
    userId: v.id("users"),
    date: v.string(),
    completedRoutines: v.array(v.id("routines")),
    totalRoutines: v.optional(v.number()),
    completionRate: v.number(),
    totalTasks: v.number(),
    completedTasks: v.number(),
    countedInStats: v.optional(v.boolean()),
  }).index("by_user_date", ["userId", "date"]),

  dailyResetState: defineTable({
    userId: v.id("users"),
    lastResetDate: v.string(),
  }).index("by_user", ["userId"]),

  athkar: defineTable({
    userId: v.id("users"),
    text: v.string(),
    translation: v.optional(v.string()),
    targetCount: v.number(),
    currentCount: v.number(),
    category: v.string(),
    isCompleted: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_category", ["userId", "category"]),

  userProfiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    // Older profiles may not have this yet. Once the user explicitly saves
    // their name, it becomes true and onboarding never guesses again.
    nameConfirmed: v.optional(v.boolean()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // User-specific nutrition/macro calculator profile.
  macroProfiles: defineTable({
    userId: v.id("users"),
    sex: v.string(),
    age: v.string(),
    heightCm: v.string(),
    weightKg: v.string(),
    activityId: v.string(),
    goal: v.string(),
    pace: v.string(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Weight history is keyed by user + calendar date so one entry can be
  // updated in place instead of creating duplicate rows for the same day.
  weightEntries: defineTable({
    userId: v.id("users"),
    date: v.string(),
    weightKg: v.number(),
    note: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  userPreferences: defineTable({
    userId: v.id("users"),
    weightUnit: v.union(v.literal("kg"), v.literal("lbs")),
  }).index("by_user", ["userId"]),


  trustedDevices: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    label: v.string(),
    createdAt: v.number(),
    lastVerifiedAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_token", ["userId", "tokenHash"]),

  deviceVerificationChallenges: defineTable({
    userId: v.id("users"),
    deviceHash: v.string(),
    codeHash: v.string(),
    label: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
    sentAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_device", ["userId", "deviceHash"]),

  // One small rolling document per user/action. This bounds abusive structural
  // mutations without creating an ever-growing request log.
  rateLimits: defineTable({
    userId: v.id("users"),
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_user_key", ["userId", "key"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
