import { v, type Infer } from "convex/values";
import { taskOptions } from "./supportModel";

export const pageValidator = v.union(v.literal("today"), v.literal("routines"), v.literal("workout"), v.literal("habits"), v.literal("progress"), v.literal("athkar"), v.literal("macros"));
export const planValidator = v.object({
  version: v.literal(1),
  routines: v.array(v.object({ name: v.string(), timeSlot: v.string(), tasks: v.array(v.string()), taskDetails: v.optional(v.array(v.object(taskOptions))) })),
  workouts: v.array(v.object({ name: v.string(), warmupNotes: v.optional(v.string()), exercises: v.array(v.object({
    name: v.string(), sets: v.number(), reps: v.string(), muscles: v.optional(v.string()),
    notes: v.optional(v.string()), isWarmup: v.optional(v.boolean()), weight: v.optional(v.number()), duration: v.optional(v.number()),
  })) })),
});
export type Plan = Infer<typeof planValidator>;
export type Page = Infer<typeof pageValidator>;
export const PAGES: { id: Page; name: string }[] = [
  { id: "today", name: "Today" }, { id: "routines", name: "Routines" }, { id: "workout", name: "Workout" },
  { id: "habits", name: "Habits" }, { id: "progress", name: "Progress" }, { id: "athkar", name: "Athkar" }, { id: "macros", name: "Macros" },
];

// Used both before previewing a file and at the server boundary. Never trust file content.
export function validatePlan(input: unknown): Plan {
  if (new TextEncoder().encode(JSON.stringify(input) ?? "").length > 500000) throw new Error("Plan is too large (maximum 500 KB). Export fewer items at a time.");
  const fail = (message: string): never => { throw new Error(message); };
  const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : fail("Invalid plan structure.");
  const text = (value: unknown, name: string, max: number): string => typeof value === "string" && value.trim().length > 0 && value.length <= max ? value.trim() : fail(`${name} must contain 1–${max} characters.`);
  const optionalText = (value: unknown, name: string, max: number) => value === undefined || value === "" ? undefined : text(value, name, max);
  const list = (value: unknown, max: number): unknown[] => Array.isArray(value) && value.length <= max ? value : fail(`Invalid list or too many items (maximum ${max}).`);
  const optionalNumber = (value: unknown, name: string) => value === undefined ? undefined : typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10000 ? value : fail(`Invalid ${name}.`);
  const plan = record(input);
  if (plan.version !== 1) fail("Unsupported file version. Use a Ceventic plan export (version 1).");
  return {
    version: 1,
    routines: list(plan.routines, 24).map(value => { const row = record(value);
      const tasks = list(row.tasks, 64).map(task => text(task, "Task", 180));
      const taskDetails = row.taskDetails === undefined ? undefined : list(row.taskDetails, 64).map(value => {
        const detail = record(value);
        const minutes = optionalNumber(detail.minutes, "minutes"), fallbackMinutes = optionalNumber(detail.fallbackMinutes, "fallback minutes");
        for (const amount of [minutes, fallbackMinutes]) if (amount !== undefined && (!Number.isInteger(amount) || amount < 1 || amount > 240)) fail("Task time must be 1–240 minutes.");
        if (minutes && fallbackMinutes && fallbackMinutes > minutes) fail("A smaller step cannot take longer than the usual action.");
        return { minutes, fallbackMinutes, fallbackName: optionalText(detail.fallbackName, "Smaller step", 180) };
      });
      if (taskDetails && taskDetails.length !== tasks.length) fail("Task details must match the task list.");
      return {
      name: text(row.name, "Routine name", 80), timeSlot: text(row.timeSlot, "Time slot", 48),
      tasks, taskDetails,
    }; }),
    workouts: list(plan.workouts, 14).map(value => { const row = record(value); return {
      name: text(row.name, "Workout name", 80), warmupNotes: optionalText(row.warmupNotes, "Warmup notes", 1200),
      exercises: list(row.exercises, 80).map(value => { const ex = record(value);
        if (typeof ex.sets !== "number" || !Number.isInteger(ex.sets) || ex.sets < 1 || ex.sets > 100) fail("Exercise sets must be a whole number from 1 to 100.");
        if (ex.isWarmup !== undefined && typeof ex.isWarmup !== "boolean") fail("Invalid warmup flag.");
        return { name: text(ex.name, "Exercise name", 120), sets: ex.sets as number, reps: text(ex.reps, "Reps", 48),
          muscles: optionalText(ex.muscles, "Muscles", 160), notes: optionalText(ex.notes, "Notes", 1200),
          isWarmup: ex.isWarmup as boolean | undefined, weight: optionalNumber(ex.weight, "weight"), duration: optionalNumber(ex.duration, "duration"),
        };
      }),
    }; }),
  };
}

export const STARTERS: Record<string, { name: string; description: string; plan: Plan }> = {
  daily: { name: "Daily rhythm", description: "Three small tasks to give your day structure.", plan: { version: 1, workouts: [], routines: [{ name: "Daily reset", timeSlot: "Any time", tasks: ["Choose today's main priority", "Spend 10 minutes on that priority", "Write one thing that went well"] }] } },
  focus: { name: "Focus session", description: "A simple preparation, work and review routine.", plan: { version: 1, workouts: [], routines: [{ name: "Focus session", timeSlot: "When ready", tasks: ["Choose one task", "Silence distractions", "Work on the task for 15 minutes", "Write the next step"] }] } },
  training: { name: "Training routine", description: "Prepare and reflect around your own workout. No prescribed exercise program.", plan: { version: 1, workouts: [], routines: [{ name: "Training ritual", timeSlot: "Training day", tasks: ["Choose today's workout or rest", "Prepare your training space", "Record how the session felt"] }] } },
};
