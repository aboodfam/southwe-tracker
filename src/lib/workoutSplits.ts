export const WORKOUT_SPLITS = {
  days: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"],
  ppl: ["Push", "Pull", "Legs", "Push", "Pull", "Legs", "Rest"],
  bro: ["Chest", "Back", "Shoulders", "Arms", "Legs", "Abs", "Rest"],
  arnold: ["Chest & Back", "Shoulders & Arms", "Legs", "Chest & Back", "Shoulders & Arms", "Legs", "Rest"],
} as const;

export type WorkoutSplit = keyof typeof WORKOUT_SPLITS;
export type SplitSelection = WorkoutSplit | "current" | "loading";

/** Resolve before rendering: loading and custom weeks must never look like Days Split.
 * A template the user picked stays selected through reactive exercise updates. */
export function resolveWorkoutSplit(
  days: readonly { name: string }[] | undefined,
  choice: WorkoutSplit | null,
): SplitSelection {
  if (choice) return choice;
  if (days === undefined) return "loading";
  if (days.length === 0) return "days";
  const normalize = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
  for (const key of Object.keys(WORKOUT_SPLITS) as WorkoutSplit[]) {
    if (WORKOUT_SPLITS[key].every((name, index) => days[index] && normalize(days[index].name) === normalize(name))) return key;
  }
  return "current";
}
