import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function WeeklyReview({ dateKey }: { dateKey: string }) {
  const review = useQuery(api.daySupport.weeklyReview, { dateKey });
  if (!review)
    return (
      <p role="status" className="mt-4 text-sm text-white/60">
        Loading your week…
      </p>
    );
  return (
    <div className="mt-4 space-y-3 text-sm">
      <p className="text-white/60">
        {review.start} – {review.end}
      </p>
      <p>
        You recorded progress on{" "}
        <strong>{review.current.activeDays} days</strong>, compared with{" "}
        {review.previous.activeDays} in the previous week.
      </p>
      <ul className="space-y-1 text-white/70">
        <li>{review.current.tasks} routine actions completed</li>
        <li>{review.current.habits} habits completed</li>
        <li>{review.current.workouts} workouts saved</li>
        {review.current.smallSteps > 0 && (
          <li>{review.current.smallSteps} smaller steps taken</li>
        )}
      </ul>
      <p className="text-xs leading-5 text-white/50">
        Based on saved activity. Unlogged days aren't treated as failures;
        smaller steps stay separate from full completions.
      </p>
    </div>
  );
}
