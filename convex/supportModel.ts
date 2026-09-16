import { v, type Infer } from "convex/values";

export const taskOptions = {
  minutes: v.optional(v.number()),
  fallbackName: v.optional(v.string()),
  fallbackMinutes: v.optional(v.number()),
};
export const starterTaskValidator = v.object({
  name: v.string(),
  ...taskOptions,
});
export type StarterTask = Infer<typeof starterTaskValidator>;
export const adjustmentValidator = v.object({
  key: v.string(),
  title: v.string(),
  reason: v.union(
    v.literal("time"),
    v.literal("energy"),
    v.literal("big"),
    v.literal("unclear"),
    v.literal("changed"),
  ),
  mode: v.union(v.literal("step"), v.literal("pause")),
  step: v.string(),
  stepDone: v.boolean(),
});
export type Adjustment = Infer<typeof adjustmentValidator>;
export const dayStateValidator = v.object({
  focusKey: v.string(),
  startedKey: v.string(),
  adjustments: v.array(adjustmentValidator),
  dismissedFriction: v.array(v.string()),
});
export type DayState = Infer<typeof dayStateValidator>;
export const EMPTY_DAY: DayState = {
  focusKey: "",
  startedKey: "",
  adjustments: [],
  dismissedFriction: [],
};
export const REASONS = {
  time: "Short on time",
  energy: "Low energy",
  big: "Too big",
  unclear: "Unsure where to start",
  changed: "Priorities changed",
} as const;
export const taskKey = (routineId: string, taskId: string) =>
  `task:${routineId}:${taskId}`;
export const habitKey = (habitId: string) => `habit:${habitId}`;

export type Starter = {
  id: string;
  name: string;
  description: string;
  timeSlot: string;
  tasks: StarterTask[];
};
export const READY_TEMPLATES: Starter[] = [
  {
    id: "study",
    name: "Study consistently",
    description:
      "Make room for one topic and leave yourself a clear next step.",
    timeSlot: "Afternoon",
    tasks: [
      {
        name: "Study one topic for 25 minutes",
        minutes: 25,
        fallbackName: "Review one page of that topic",
        fallbackMinutes: 5,
      },
      { name: "Write the next thing to study", minutes: 2 },
    ],
  },
  {
    id: "balance",
    name: "Work & personal life",
    description: "Give your main priority and one personal commitment a place.",
    timeSlot: "When ready",
    tasks: [
      {
        name: "Work on my main priority for 25 minutes",
        minutes: 25,
        fallbackName: "Spend 5 minutes on the first part",
        fallbackMinutes: 5,
      },
      {
        name: "Make time for one personal activity",
        minutes: 15,
        fallbackName: "Spend 5 minutes on that activity",
        fallbackMinutes: 5,
      },
    ],
  },
  {
    id: "routine",
    name: "A simple daily routine",
    description: "A little reading and a moment to prepare for tomorrow.",
    timeSlot: "Evening",
    tasks: [
      {
        name: "Read for 20 minutes",
        minutes: 20,
        fallbackName: "Read for 5 minutes",
        fallbackMinutes: 5,
      },
      {
        name: "Prepare one thing for tomorrow",
        minutes: 5,
        fallbackName: "Write down tomorrow's first action",
        fallbackMinutes: 1,
      },
    ],
  },
  {
    id: "restart",
    name: "Start again gently",
    description: "One small action. You can build from here.",
    timeSlot: "Any time",
    tasks: [
      {
        name: "Spend 10 minutes on something that matters",
        minutes: 10,
        fallbackName: "Take one 2-minute first step",
        fallbackMinutes: 2,
      },
    ],
  },
];

// Distinct dates, not button taps, are evidence of repeated friction.
export function frictionPatterns(days: { date: string; state: DayState }[]) {
  const counts = new Map<
    string,
    { key: string; title: string; dates: Set<string> }
  >();
  for (const day of days)
    for (const item of day.state.adjustments) {
      const value = counts.get(item.key) ?? {
        key: item.key,
        title: item.title,
        dates: new Set<string>(),
      };
      value.dates.add(day.date);
      counts.set(item.key, value);
    }
  return [...counts.values()]
    .filter((item) => item.dates.size >= 3)
    .map((item) => ({
      key: item.key,
      title: item.title,
      days: item.dates.size,
      latestDate: [...item.dates].sort().slice(-1)[0],
    }))
    .sort((a, b) => b.days - a.days || a.key.localeCompare(b.key));
}
