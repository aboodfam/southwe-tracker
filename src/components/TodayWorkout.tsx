import { useState } from "react";
import { ChoiceSelect } from "./ChoiceSelect";
import { t as tr, useLocale } from "../i18n";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useLocalDateKey } from "../hooks/useLocalDateKey";
import { useSaveAction } from "../hooks/useSaveAction";
import { ExerciseResultLog } from "./ExerciseResultLog";
import { toast } from "sonner";

export function TodayWorkout({
  onOpen,
  compact = false,
}: {
  onOpen: () => void;
  compact?: boolean;
}) {
  useLocale();
  const dateKey = useLocalDateKey();
  const [expanded, setExpanded] = useState(false);
  const days = useQuery(api.workouts.getWorkoutDays);
  const plan = useQuery(api.workspace.getTodayPlan, { dateKey });
  const choose = useMutation(api.workspace.chooseTodayWorkout);
  const toggle = useMutation(api.workouts.toggleExerciseComplete);
  const finish = useMutation(api.workouts.completeWorkout);
  const day = days?.find((row) => row._id === plan?.dayId);
  const progress = useQuery(
    api.workouts.getTodayWorkoutProgress,
    day ? { dayId: day._id, dateKey } : "skip",
  );
  const results = useQuery(
    api.workouts.getExerciseResults,
    day && (!compact || expanded) ? { dateKey } : "skip",
  );
  const action = useSaveAction();
  const exercises = [...(day?.exercises ?? [])]
    .filter((exercise) => !exercise.isWarmup)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const done = exercises.filter((exercise) =>
    progress?.completedExercises.includes(exercise.id),
  ).length;
  const rate = exercises.length ? (done / exercises.length) * 100 : 0;
  const button =
    "min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50";
  return (
    <section
      aria-label={tr("Workout")}
      className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          className={compact ? "text-base font-semibold" : "text-xl font-bold"}
        >
          {tr("Workout")}
        </h2>
        <button
          onClick={onOpen}
          className="min-h-11 text-sm font-semibold text-[rgb(var(--sw-accent-rgb))]"
        >
          {tr("View plan")}
        </button>
      </div>
      {compact && (
        <div className="mt-2">
          <p className="text-sm font-semibold text-white/85">
            {plan === undefined
              ? tr("Loading today's training…")
              : plan?.rest
                ? tr("Rest / recovery")
                : (day?.name ?? tr("Not planned yet"))}
          </p>
          {day && progress === undefined && (
            <p role="status" className="mt-3 text-xs text-white/50">
              {tr("Loading this session…")}
            </p>
          )}
          {day && progress !== undefined && (
            <div className="mt-3">
              <div className="flex justify-between gap-2 text-xs text-white/55">
                <span>
                  {tr("{0}/{1} done", { 0: done, 1: exercises.length })}
                </span>
                <span>
                  {progress?.completedWorkout
                    ? tr("Completed")
                    : tr("In progress")}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-[image:var(--sw-gradient)]"
                  style={{ width: `${rate}%` }}
                />
              </div>
            </div>
          )}
          <button
            aria-expanded={expanded}
            className="mt-3 min-h-11 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm font-semibold text-primary"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded
              ? tr("Show less")
              : day
                ? tr("Continue workout")
                : tr("Choose session")}
          </button>
        </div>
      )}
      {(!compact || expanded) && (
        <>
          {days === undefined || plan === undefined ? (
            <p role="status" className="mt-4 text-white/60">
              {tr("Loading today's training…")}
            </p>
          ) : (
            <>
              <label className="mt-4 block text-sm">
                {tr("Choose a workout or a rest day")}
                <ChoiceSelect
                  label={tr("Choose a workout or a rest day")}
                  disabled={action.busy}
                  value={plan?.rest ? "rest" : (day?._id ?? "")}
                  className="mt-2 w-full"
                  onChange={(value) => {
                    void action.run(async () => {
                      await choose({
                        dateKey,
                        rest: value === "rest",
                        dayId:
                          value && value !== "rest"
                            ? (value as Id<"workoutDays">)
                            : undefined,
                      });
                      toast.success(
                        value === "rest"
                          ? tr(
                              "Rest day saved. Your previous workout logs are unchanged.",
                            )
                          : tr("Today's plan saved."),
                      );
                    });
                  }}
                  options={[
                    { value: "", label: tr("Not planned yet") },
                    { value: "rest", label: tr("Rest / recovery") },
                    ...days.map((workout) => ({
                      value: workout._id,
                      label: `${workout.name} · ${workout.exercises.filter((ex) => !ex.isWarmup).length} ${tr("exercises")}`,
                    })),
                  ]}
                />
              </label>
              {plan?.rest && (
                <p className="mt-4 text-sm text-white/75">
                  {tr("Rest day. You're all set.")}
                </p>
              )}
              {!plan?.rest && !day && (
                <p className="mt-4 text-sm text-white/60">
                  {plan?.dayId
                    ? tr(
                        "The chosen workout is no longer active. Restore it in My workspace or choose another.",
                      )
                    : days.length
                      ? tr("Pick the session you want to work through here.")
                      : tr(
                          "Create a workout in the Workout page, then select it here.",
                        )}
                </p>
              )}
              {day && (
                <div className="mt-5 space-y-3">
                  {progress === undefined ? (
                    <p role="status">{tr("Loading this session…")}</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <h3 className="font-bold">{day.name}</h3>
                        <span>
                          {done}/{exercises.length} {tr("exercises")}
                        </span>
                      </div>
                      <div
                        className="h-2 overflow-hidden rounded-full bg-white/10"
                        role="progressbar"
                        aria-label={tr("Workout completion")}
                        aria-valuenow={Math.round(rate)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="h-full bg-[rgb(var(--sw-accent-rgb))]"
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      {!exercises.length && (
                        <p className="text-sm text-white/60">
                          {tr(
                            "No training exercises in this day yet. Add exercises in Workout, or choose Rest above.",
                          )}
                        </p>
                      )}
                      {exercises.map((exercise) => (
                        <div
                          key={exercise.id}
                          className="rounded-xl border border-white/10 bg-black/20"
                        >
                          <label className="flex items-start gap-3 p-4">
                            <input
                              type="checkbox"
                              className="mt-1 h-5 w-5 shrink-0"
                              disabled={
                                action.busy || progress?.completedWorkout
                              }
                              checked={
                                progress?.completedExercises.includes(
                                  exercise.id,
                                ) ?? false
                              }
                              onChange={() =>
                                void action.run(async () => {
                                  await toggle({
                                    dayId: day._id,
                                    exerciseId: exercise.id,
                                    dateKey,
                                  });
                                })
                              }
                            />
                            <span className="min-w-0 text-sm">
                              <span className="block break-words font-semibold">
                                {exercise.name}
                              </span>
                              <span className="mt-1 block text-white/60">
                                {exercise.sets} × {exercise.reps}
                                {exercise.notes ? ` · ${exercise.notes}` : ""}
                              </span>
                            </span>
                          </label>
                          <ExerciseResultLog
                            dayId={day._id}
                            exerciseId={exercise.id}
                            dateKey={dateKey}
                            history={results?.filter(
                              (result) =>
                                result.dayId === day._id &&
                                result.exerciseId === exercise.id,
                            )}
                          />
                        </div>
                      ))}
                      {exercises.length > 0 &&
                        (progress?.completedWorkout ? (
                          <p className="text-sm text-[rgb(var(--sw-accent-rgb))]">
                            {tr("Workout complete.")}
                          </p>
                        ) : (
                          rate >= 70 && (
                            <>
                              <button
                                disabled={action.busy}
                                className={`${button} w-full`}
                                onClick={() =>
                                  void action.run(async () => {
                                    await finish({ dayId: day._id, dateKey });
                                    toast.success(tr("Workout saved."));
                                  })
                                }
                              >
                                {action.busy
                                  ? tr("Saving…")
                                  : tr("Finish workout")}
                              </button>
                              <p className="text-xs text-white/55">
                                {tr(
                                  "Finishing locks this session's checkmarks.",
                                )}
                              </p>
                            </>
                          )
                        ))}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
      {action.error && (
        <p role="alert" className="mt-4 break-words text-sm text-red-300">
          {action.error}
        </p>
      )}
    </section>
  );
}
