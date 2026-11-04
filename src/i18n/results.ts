import { compareResults, type ExerciseResult } from "../../convex/progressMath";
import { t } from "./index";

/** Localize the presentation of the shared comparison without changing its math. */
export function localizedComparison(current: ExerciseResult, previous: ExerciseResult): string | null {
  const message = compareResults(current, previous);
  if (message === null) return null;
  if (message === "Same hold as last time" || message === "Same reps at the same load") return t(message);
  const parts = message.match(/^([+]?)(-?[\d.]+)(s hold vs last time| reps at the same load| kg at the same reps)$/);
  if (!parts) return message;
  return t("{0}{1}" + parts[3], { 0: parts[1], 1: Number(parts[2]) });
}
