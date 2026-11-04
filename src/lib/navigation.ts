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
