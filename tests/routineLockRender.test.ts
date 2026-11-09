// @vitest-environment node
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { expect, test, vi } from "vitest";
import { RoutineCard } from "../src/components/RoutineCard";
let progress: unknown = undefined;
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref) === "routines:getTodayProgress" ? progress : undefined,
  useMutation: () => vi.fn(),
}));
vi.mock("../src/contexts/ThemeContext", () => ({
  useTheme: () => ({ getThemeColors: () => ({}) }),
}));
vi.mock("../src/contexts/SoundContext", () => ({
  useSound: () => ({ play: vi.fn() }),
}));
const routine = {
  _id: "routine" as never,
  name: "Daily block",
  timeSlot: "Morning",
  tasks: [{ id: "one", name: "Read", completed: true, order: 0 }],
};
function taskButton() {
  const html = renderToString(createElement(RoutineCard, { routine }));
  return html.match(/<button[^>]*aria-pressed="true"[^>]*>/)?.[0] ?? "";
}
test("routine checkmarks are disabled while loading and after day completion", () => {
  progress = undefined;
  expect(taskButton()).toContain('disabled=""');
  progress = { countedInStats: true };
  expect(taskButton()).toContain('disabled=""');
  expect(taskButton()).toContain("Day Completed");
  progress = { countedInStats: false };
  expect(taskButton()).not.toContain('disabled=""');
  progress = null;
  expect(taskButton()).not.toContain('disabled=""');
});
