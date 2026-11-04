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
