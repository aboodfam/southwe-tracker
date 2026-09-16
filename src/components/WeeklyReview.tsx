import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { useSaveAction } from "../hooks/useSaveAction";
import { toast } from "sonner";

const field =
  "mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-base";
export function WeeklyReview({
  dateKey,
  routines,
}: {
  dateKey: string;
  routines: Doc<"routines">[];
}) {
  const review = useQuery(api.daySupport.weeklyReview, { dateKey });
  const save = useMutation(api.daySupport.saveReview);
  const action = useSaveAction();
  const [experiment, setExperiment] = useState<string | null>(null);
  const [reflection, setReflection] = useState<string | null>(null);
  const [routineId, setRoutineId] = useState("");
  const [time, setTime] = useState("");
  if (!review)
    return (
      <p role="status" className="p-5 text-white/60">
        Preparing your review…
      </p>
    );
  const next = experiment ?? review.saved?.experiment ?? "";
  const observation = reflection ?? review.saved?.reflection ?? "";
  const { current, previous } = review;
  return (
    <section
      className="rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6"
      data-no-swipe
    >
      <p className="text-xs uppercase tracking-widest text-[rgb(var(--sw-accent-rgb))]">
        Reflect, then make one change
      </p>
      <h2 className="mt-2 text-2xl font-bold">Your weekly review</h2>
      <p className="mt-2 text-sm text-white/60">
        {review.start} to {review.end} · The last seven complete days
      </p>
      <p className="mt-5 text-lg">
        You recorded progress on <strong>{current.activeDays} days</strong>.
      </p>
      <p className="mt-1 text-sm text-white/60">
        The preceding seven days: {previous.activeDays} days with logged
        progress.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [current.tasks, "Routine actions"],
          [current.habits, "Habit completions"],
          [current.workouts, "Saved workouts"],
          [current.smallSteps, "Smaller steps"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-xl bg-white/5 p-4">
            <strong className="block text-2xl">{value}</strong>
            <span className="text-xs text-white/60">{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-white/50">
        Based on saved logs, not a score for your whole life. Missing logs are
        unknown. Smaller steps are shown separately; they do not count as
        finishing the original action.
      </p>
      {review.patterns.length > 0 && (
        <p className="mt-5 rounded-xl border border-white/10 p-4 text-sm leading-6">
          You adjusted “{review.patterns[0].title}” on {review.patterns[0].days}{" "}
          days. A different time or a clearer first step could be worth trying.
        </p>
      )}
      {review.previousReview && (
        <div className="mt-5 rounded-xl bg-white/5 p-4">
          <p className="text-xs text-white/55">
            Your previous experiment · {review.previousReview.date}
          </p>
          <p className="mt-2 text-sm">{review.previousReview.experiment}</p>
          <p className="mt-2 text-sm text-white/60">
            Did it help? Use your reflection below to keep, change, or stop it.
          </p>
        </div>
      )}
      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void action.run(async () => {
            await save({
              dateKey,
              experiment: next,
              reflection: observation,
              routineId: routineId ? (routineId as Id<"routines">) : undefined,
              timeSlot: routineId ? time : undefined,
            });
            toast.success(
              routineId
                ? "Review saved and routine time updated."
                : "Review saved. Your experiment is on Today.",
            );
            setRoutineId("");
            setTime("");
          });
        }}
      >
        <label className="block text-sm">
          What helped or got in the way? (optional)
          <textarea
            className={field}
            rows={2}
            maxLength={400}
            value={observation}
            onChange={(event) => setReflection(event.target.value)}
            placeholder="Your own explanation, rather than a guess from Ceventic."
          />
        </label>
        <label className="block text-sm">
          One change to try over the next seven days
          <input
            className={field}
            maxLength={240}
            required
            value={next}
            onChange={(event) => setExperiment(event.target.value)}
            placeholder="e.g. Read after breakfast instead of late at night"
          />
        </label>
        <details className="rounded-xl border border-white/10 p-4">
          <summary className="cursor-pointer text-sm">
            Optionally update a routine's time now
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Routine
              <select
                className={field}
                value={routineId}
                onChange={(event) => {
                  setRoutineId(event.target.value);
                  setTime(
                    routines.find((r) => r._id === event.target.value)
                      ?.timeSlot ?? "",
                  );
                }}
              >
                <option value="">Keep routine times</option>
                {routines.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            {routineId && (
              <label className="text-sm">
                New time
                <input
                  className={field}
                  maxLength={48}
                  required
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </label>
            )}
          </div>
          {routineId && (
            <p className="mt-3 text-xs text-white/60">
              Saving updates this recurring routine's time. You can change it
              again in Routines.
            </p>
          )}
        </details>
        {action.error && (
          <p role="alert" className="text-sm text-red-300">
            {action.error}
          </p>
        )}
        <button
          disabled={action.busy || !next.trim()}
          className="min-h-11 rounded-xl bg-[rgb(var(--sw-accent-rgb))] px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
        >
          {action.busy
            ? "Saving…"
            : routineId
              ? "Save review & update routine"
              : "Save review & experiment"}
        </button>
      </form>
    </section>
  );
}
