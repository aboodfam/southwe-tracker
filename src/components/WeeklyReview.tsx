import { t as tr, useLocale } from "../i18n";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function WeeklyReview({ dateKey }: { dateKey: string }) {
  useLocale();
  const review = useQuery(api.daySupport.weeklyReview, { dateKey });
  if (!review)
    return (
      <p role="status" className="mt-4 text-sm text-white/60">
        {tr("Loading your week…")} </p>
    );
  return (
    <div className="mt-4 space-y-3 text-sm">
      <p className="text-white/60">
        {review.start} – {review.end}
      </p>
      <p>
        {tr("You recorded progress on")}{" "}
        <strong>{review.current.activeDays} {tr("days")}</strong>{tr(", compared with")}{" "}
        {review.previous.activeDays} {tr("in the previous week.")} </p>
      <ul className="space-y-1 text-white/70">
        <li>{review.current.tasks} {tr("routine actions completed")}</li>
        <li>{review.current.habits} {tr("habits completed")}</li>
        <li>{review.current.workouts} {tr("workouts saved")}</li>
        {review.current.smallSteps > 0 && (
          <li>{review.current.smallSteps} {tr("smaller steps taken")}</li>
        )}
      </ul>
      <p className="text-xs leading-5 text-white/50">
        {tr("Based on saved activity. Unlogged days aren't treated as failures; smaller steps stay separate from full completions.")} </p>
    </div>
  );
}
