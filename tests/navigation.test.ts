import { expect, test } from "vitest";
import { pageSwipe } from "../src/lib/navigation";
import { visibleStartPage, PAGES } from "../convex/planFormat";

test("horizontal page gestures have a threshold and leave vertical or diagonal scrolling alone", () => {
  expect(pageSwipe(-100, 2)).toEqual({ next: true, motion: "left" });
  expect(pageSwipe(100, 2)).toEqual({ next: false, motion: "right" });
  expect(pageSwipe(50, 0)).toBeNull();
  expect(pageSwipe(100, 100)).toBeNull();
  expect(pageSwipe(10, 150)).toBeNull();
});

test("hidden Today never becomes an automatic landing page", () => {
  expect(visibleStartPage(["today"], "today")).toBe("routines");
  expect(visibleStartPage(["today"], "workout")).toBe("workout");
  expect(
    visibleStartPage(
      PAGES.filter((page) => page.id !== "macros").map((page) => page.id),
      "today",
    ),
  ).toBe("macros");
  expect(
    visibleStartPage(
      PAGES.map((page) => page.id),
      "today",
    ),
  ).toBeNull();
});
