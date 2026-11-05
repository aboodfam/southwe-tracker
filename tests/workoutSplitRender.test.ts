// @vitest-environment node
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { expect, test, vi } from "vitest";
import { WorkoutPage } from "../src/components/WorkoutPage";
import { WORKOUT_SPLITS } from "../src/lib/workoutSplits";

let savedDays: unknown = undefined;
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref) === "workouts:getWorkoutDays" ? savedDays : undefined,
  useMutation: () => vi.fn(),
}));
vi.mock("../src/contexts/ThemeContext", () => ({ useTheme: () => ({ getThemeColors: () => ({primary: "rgb(34, 211, 238)"}) }) }));
vi.mock("../src/contexts/SoundContext", () => ({ useSound: () => ({play: vi.fn()}) }));

test("the workout selector paints its real saved value before effects run", () => {
  // Server rendering never runs effects, so this catches the original initial-paint flash.
  savedDays = undefined;
  let html = renderToString(createElement(WorkoutPage));
  expect(html).toMatch(/<option[^>]*value="loading"[^>]*selected=""/);
  expect(html).not.toContain('value="days" selected=""');

  savedDays = WORKOUT_SPLITS.ppl.map((name, i) => ({_id: `day${i}`, name, order: i, exercises: []}));
  html = renderToString(createElement(WorkoutPage));
  expect(html).toContain('value="ppl" selected=""');
  expect(html).not.toContain('value="days" selected=""');

  savedDays = [{_id: "custom", name: "Shoulder/Chest", order: 0, exercises: []}];
  html = renderToString(createElement(WorkoutPage));
  expect(html).toMatch(/<option[^>]*value="current"[^>]*selected=""/);
  expect(html).toContain("Shoulder/Chest");
});
