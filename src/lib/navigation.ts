export type PageMotion = "left" | "right";
/** Motion describes the direction the content travels, independently of text direction. */
export function pageMotion(fromIndex: number, toIndex: number, rtl: boolean): PageMotion {
  return (toIndex >= fromIndex) !== rtl ? "left" : "right";
}
export function swipeNavigation(deltaX: number, rtl: boolean) {
  return {
    next: (deltaX < 0) !== rtl,
    motion: deltaX < 0 ? "left" as const : "right" as const,
  };
}
