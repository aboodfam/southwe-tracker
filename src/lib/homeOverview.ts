import type { DayState } from "../../convex/supportModel";
import type { ProgressDay } from "../../convex/progressMath";
/** An unrecorded date is not a failed day; only actual check-ins count as activity. */
export function hasHomeActivity(
  day: ProgressDay,
  hiddenPages: readonly string[],
) {
  return (
    (!hiddenPages.includes("routines") && day.tasksDone > 0) ||
    (!hiddenPages.includes("habits") && day.habitsDone > 0) ||
    (!hiddenPages.includes("workout") && day.exercisesDone > 0)
  );
}

/** Deleted or hidden actions must not prevent other daily changes from saving. */
export function keepAvailableFocus(
  state: DayState,
  keys: readonly string[],
): DayState {
  const available = new Set(keys);
  return {
    ...state,
    focusKey: available.has(state.focusKey) ? state.focusKey : "",
    startedKey: available.has(state.startedKey) ? state.startedKey : "",
  };
}
