import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useLocalDateKey } from "../hooks/useLocalDateKey";
import { useSaveAction } from "../hooks/useSaveAction";
import { ExerciseResultLog } from "./ExerciseResultLog";
import { toast } from "sonner";

export function TodayWorkout({ onOpen }: { onOpen: () => void }) {
  const dateKey = useLocalDateKey();
  const days = useQuery(api.workouts.getWorkoutDays);
  const plan = useQuery(api.workspace.getTodayPlan, { dateKey });
  const choose = useMutation(api.workspace.chooseTodayWorkout);
  const toggle = useMutation(api.workouts.toggleExerciseComplete);
  const finish = useMutation(api.workouts.completeWorkout);
  const day = days?.find(row => row._id === plan?.dayId);
  const progress = useQuery(api.workouts.getTodayWorkoutProgress, day ? { dayId: day._id, dateKey } : "skip");
  const results = useQuery(api.workouts.getExerciseResults, day ? { dateKey } : "skip");
  const action = useSaveAction();
  const exercises = [...(day?.exercises ?? [])].filter(exercise => !exercise.isWarmup).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const done = exercises.filter(exercise => progress?.completedExercises.includes(exercise.id)).length;
  const rate = exercises.length ? done / exercises.length * 100 : 0;
  const button = "min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50";
  return <section className="rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6" data-no-swipe>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Workout</h2><button onClick={onOpen} className="min-h-11 text-sm font-semibold text-[rgb(var(--sw-accent-rgb))]">View plan</button></div>
    {days === undefined || plan === undefined ? <p role="status" className="mt-4 text-white/60">Loading today's training…</p> : <>
      <label className="mt-4 block text-sm">Choose a workout or a rest day<select disabled={action.busy} value={plan?.rest ? "rest" : day?._id ?? ""} className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-base" onChange={event => { const value = event.target.value; void action.run(async () => { await choose({ dateKey, rest: value === "rest", dayId: value && value !== "rest" ? value as Id<"workoutDays"> : undefined }); toast.success(value === "rest" ? "Rest day saved. Your previous workout logs are unchanged." : "Today's plan saved."); }); }}><option value="">Not planned yet</option><option value="rest">Rest / recovery</option>{days.map(workout => <option key={workout._id} value={workout._id}>{workout.name} · {workout.exercises.filter(ex => !ex.isWarmup).length} exercises</option>)}</select></label>
      {plan?.rest && <p className="mt-4 text-sm text-white/75">Rest day. You're all set.</p>}
      {!plan?.rest && !day && <p className="mt-4 text-sm text-white/60">{plan?.dayId ? "The chosen workout is no longer active. Restore it in My workspace or choose another." : days.length ? "Pick the session you want to work through here." : "Create a workout in the Workout page, then select it here."}</p>}
      {day && <div className="mt-5 space-y-3">
        {progress === undefined ? <p role="status">Loading this session…</p> : <>
          <div className="flex items-center justify-between gap-3 text-sm"><h3 className="font-bold">{day.name}</h3><span>{done}/{exercises.length} exercises</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Workout completion" aria-valuenow={Math.round(rate)} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-[rgb(var(--sw-accent-rgb))]" style={{ width: `${rate}%` }} /></div>
          {!exercises.length && <p className="text-sm text-white/60">No training exercises in this day yet. Add exercises in Workout, or choose Rest above.</p>}
          {exercises.map(exercise => <div key={exercise.id} className="rounded-xl border border-white/10 bg-black/20">
            <label className="flex items-start gap-3 p-4"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" disabled={action.busy || progress?.completedWorkout} checked={progress?.completedExercises.includes(exercise.id) ?? false} onChange={() => void action.run(async () => { await toggle({ dayId: day._id, exerciseId: exercise.id, dateKey }); })} /><span className="min-w-0 text-sm"><span className="block break-words font-semibold">{exercise.name}</span><span className="mt-1 block text-white/60">{exercise.sets} × {exercise.reps}{exercise.notes ? ` · ${exercise.notes}` : ""}</span></span></label>
            <ExerciseResultLog dayId={day._id} exerciseId={exercise.id} dateKey={dateKey} history={results?.filter(result => result.dayId === day._id && result.exerciseId === exercise.id)} />
          </div>)}
          {exercises.length > 0 && (progress?.completedWorkout ? <p className="text-sm text-[rgb(var(--sw-accent-rgb))]">Workout complete.</p> : rate >= 70 && <><button disabled={action.busy} className={`${button} w-full`} onClick={() => void action.run(async () => { await finish({ dayId: day._id, dateKey }); toast.success("Workout saved."); })}>{action.busy ? "Saving…" : "Finish workout"}</button><p className="text-xs text-white/55">Finishing locks this session's checkmarks.</p></>)}
        </>}
      </div>}
    </>}
    {action.error && <p role="alert" className="mt-4 break-words text-sm text-red-300">{action.error}</p>}
  </section>;
}
