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
// Each template is one repeatable session, with a concrete start and finish.
// These are suggestions copied into a user's draft, never changes to saved routines.
export const READY_TEMPLATES: Starter[] = [
  {
    id: "study",
    name: "Study session",
    description:
      "Learn one topic, test yourself, and keep track of what needs practice.",
    timeSlot: "Study time",
    tasks: [
      {
        name: "Study the chosen topic",
        minutes: 25,
        fallbackName: "Review one page of that topic",
        fallbackMinutes: 5,
      },
      { name: "Close the notes and explain the topic from memory", minutes: 5 },
      {
        name: "Try a practice question without checking the answer",
        minutes: 10,
      },
      { name: "Write down one mistake to review next time", minutes: 2 },
    ],
  },
  {
    id: "morning",
    name: "Morning setup",
    description: "Know what is coming and get your first task ready.",
    timeSlot: "After waking up",
    tasks: [
      { name: "Check today's appointments and deadlines", minutes: 2 },
      { name: "Choose the one task that matters most today", minutes: 2 },
      { name: "Prepare what you need to start that task", minutes: 3 },
    ],
  },
  {
    id: "focus",
    name: "Focused work",
    description:
      "Finish one clear piece of work and leave an easy place to resume.",
    timeSlot: "Work time",
    tasks: [
      { name: "Write the result you want from this session", minutes: 2 },
      { name: "Put your phone away and close unrelated tabs", minutes: 1 },
      {
        name: "Work on the result you chose",
        minutes: 25,
        fallbackName: "Start the first part",
        fallbackMinutes: 5,
      },
      { name: "Save your work and write the next step", minutes: 2 },
    ],
  },
  {
    id: "evening",
    name: "Prepare for tomorrow",
    description:
      "Handle the small things tonight so tomorrow is easier to start.",
    timeSlot: "Before bed",
    tasks: [
      { name: "Check tomorrow's first appointment or deadline", minutes: 2 },
      { name: "Prepare your bag, clothes or workspace", minutes: 5 },
      { name: "Clear the surface you will use first", minutes: 3 },
      { name: "Write down tomorrow's first task", minutes: 2 },
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
