import { expect, test } from "vitest";
import { resolveWorkoutSplit, WORKOUT_SPLITS } from "../src/lib/workoutSplits";
const week = (names: readonly string[]) => names.map(name => ({ name }));

test("loading does not impersonate Days Split, and a saved template is resolved on its first render", () => {
  expect(resolveWorkoutSplit(undefined, null)).toBe("loading");
  for (const key of Object.keys(WORKOUT_SPLITS) as (keyof typeof WORKOUT_SPLITS)[]) {
    expect(resolveWorkoutSplit(week(WORKOUT_SPLITS[key]), null)).toBe(key);
  }
  expect(resolveWorkoutSplit([], null)).toBe("days");
});

test("exercise refreshes and loading transitions do not override an explicit template choice", () => {
  const saved = week(WORKOUT_SPLITS.ppl);
  expect(resolveWorkoutSplit(saved, "arnold")).toBe("arnold");
  expect(resolveWorkoutSplit(saved.map(day => ({...day, exercises: []})), "arnold")).toBe("arnold");
  expect(resolveWorkoutSplit(undefined, "arnold")).toBe("arnold");
});

test("custom and partial weeks keep their own identity instead of guessing from muscle names", () => {
  expect(resolveWorkoutSplit(week(["Shoulder/Chest", "Back/abs", "Legs"]), null)).toBe("current");
  expect(resolveWorkoutSplit(week(["Push", "Pull", "Legs"]), null)).toBe("current");
  expect(resolveWorkoutSplit(week([...WORKOUT_SPLITS.bro, "Custom recovery"]), null)).toBe("bro");
  expect(resolveWorkoutSplit(week(WORKOUT_SPLITS.arnold.map(name => ` ${name.toUpperCase()} `)), null)).toBe("arnold");
});
