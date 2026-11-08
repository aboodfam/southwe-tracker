import { v, type Infer } from "convex/values";

export const homeSectionValidator = v.union(
  v.literal("focus"),
  v.literal("tasks"),
  v.literal("workout"),
  v.literal("athkar"),
  v.literal("routines"),
  v.literal("consistency"),
);
export type HomeSection = Infer<typeof homeSectionValidator>;
export const HOME_SECTIONS: { id: HomeSection; label: string }[] = [
  { id: "focus", label: "Focus" },
  { id: "consistency", label: "Weekly consistency" },
  { id: "workout", label: "Workout" },
  { id: "athkar", label: "Athkar" },
  { id: "routines", label: "Routines" },
  { id: "tasks", label: "Tasks & habits" },
];
export function normalizeHomeLayout(
  order?: readonly HomeSection[],
  hidden?: readonly HomeSection[],
) {
  const ids = HOME_SECTIONS.map((row) => row.id);
  return {
    order: [
      ...new Set([...(order ?? []).filter((id) => ids.includes(id)), ...ids]),
    ],
    hidden: [...new Set((hidden ?? []).filter((id) => ids.includes(id)))],
  };
}
export function validateHomeLayout(
  order: HomeSection[],
  hidden: HomeSection[],
) {
  const ids = HOME_SECTIONS.map((row) => row.id);
  if (
    order.length !== ids.length ||
    new Set(order).size !== ids.length ||
    !ids.every((id) => order.includes(id))
  )
    throw new Error("Include each Home section exactly once.");
  if (new Set(hidden).size !== hidden.length || hidden.length >= ids.length)
    throw new Error("Keep at least one Home section visible.");
  return { order, hidden };
}
