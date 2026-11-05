export type PageMotion = "left" | "right";
/** Navigation order and physical motion stay the same in every language. */
export function pageMotion(fromIndex: number, toIndex: number): PageMotion {
  return toIndex >= fromIndex ? "left" : "right";
}
export function swipeNavigation(deltaX: number) {
  return {
    next: deltaX < 0,
    motion: deltaX < 0 ? "left" as const : "right" as const,
  };
}

/** Arabic remembrance is read right to left, independently of the app locale. */
export function athkarSwipeNavigation(deltaX: number) {
  return { ...swipeNavigation(deltaX), next: deltaX > 0 };
}

/** Let vertical scrolling win early; require a deliberate horizontal swipe to navigate. */
export function pageSwipe(deltaX: number, deltaY: number) {
  return Math.abs(deltaX) >= 70 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4
    ? swipeNavigation(deltaX) : null;
}
