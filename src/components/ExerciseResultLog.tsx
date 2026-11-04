import { t as tr, useLocale } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { type ExerciseResult } from "../../convex/progressMath";
import { localizedComparison as compareResults } from "../i18n/results";
import { toast } from "sonner";

export type SavedExerciseResult = ExerciseResult & { date: string; dayId?: Id<"workoutDays">; dayName: string };

export function resultLabel(result: ExerciseResult) {
  if (result.holdSeconds !== undefined) return tr("{0}s hold", {0: result.holdSeconds});
  return tr("{0} reps", {0: result.reps ?? 0}) + (result.weightKg !== undefined ? tr(" · {0} kg load", {0: result.weightKg}) : tr(" · bodyweight"));
}

export function ExerciseResultLog({ dayId, exerciseId, dateKey, history }: {
  dayId: Id<"workoutDays">;
  exerciseId: string;
  dateKey: string;
  history: SavedExerciseResult[] | undefined;
}) {
  useLocale();
  const save = useMutation(api.workouts.logExerciseResult);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("reps");
  const [value, setValue] = useState("");
  const [load, setLoad] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const today = history?.find(result => result.date === dateKey);
  const previous = history?.find(result => result.date < dateKey);

  useEffect(() => {
    setMode(today?.holdSeconds !== undefined ? "hold" : "reps");
    setValue(String(today?.holdSeconds ?? today?.reps ?? ""));
    setLoad(String(today?.weightKg ?? ""));
  }, [dateKey, today?.holdSeconds, today?.reps, today?.weightKg]);

  const comparison = today && previous ? compareResults(today, previous) : null;
  const field = "mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white";
  return <div className="px-3 pb-2 sm:px-4">
    <button type="button" aria-expanded={open} disabled={history === undefined} onClick={() => setOpen(!open)} className="min-h-10 text-start text-xs font-semibold text-[rgb(var(--sw-accent-rgb))] disabled:opacity-50">
      {history === undefined ? tr("Loading results…") : today ? tr("Today: {0} · Edit result", {0: resultLabel(today)}) : tr("+ Log your best set")}
    </button>
    {comparison && <p className="pb-2 text-xs text-white/60">{comparison}</p>}
    {open && <form className="mb-2 space-y-3 rounded-xl border border-white/10 bg-black/30 p-4" onSubmit={async event => {
      event.preventDefault();
      if (lock.current) return;
      setError("");
      const number = Number(value);
      if (!value.trim() || !Number.isFinite(number) || number <= 0 || (mode === "reps" && (!Number.isInteger(number) || number > 1000)) || (mode === "hold" && number > 3600)) {
        setError(mode === "reps" ? tr("Enter whole reps from 1 to 1000.") : tr("Enter a hold above 0 and up to 3600 seconds.")); return;
      }
      if (mode === "reps" && load.trim() && (!Number.isFinite(Number(load)) || Number(load) < 0 || Number(load) > 1000)) {
        setError(tr("Enter a load from 0 to 1000 kg, or leave blank for bodyweight.")); return;
      }
      lock.current = true;
      setBusy(true);
      try {
        await save({ dayId, exerciseId, dateKey,
          ...(mode === "hold" ? { holdSeconds: number } : { reps: number, weightKg: load.trim() ? Number(load) : undefined }) });
        toast.success(tr("Best set saved. Your earlier sessions are still there."));
        setOpen(false);
      } catch { setError("Couldn't save this result. Your entry is still here—please try again."); }
      finally { lock.current = false; setBusy(false); }
    }}>
      <p className="text-xs leading-5 text-white/60">{tr("One best set per exercise, per day. This records what you actually did, without changing your prescribed sets or checking off the exercise.")}</p>
      {previous && <p className="text-sm text-white/80">{tr("Last time (")}{previous.date}): {resultLabel(previous)}</p>}
      <label className="block text-xs text-white/70">{tr("Track")}<select value={mode} onChange={event => { setMode(event.target.value); setValue(""); }} className={field}><option value="reps">{tr("Repetitions")}</option><option value="hold">{tr("Hold duration")}</option></select></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-white/70">{mode === "reps" ? tr("Reps in your best set") : tr("Hold duration (seconds)")}<input autoFocus required inputMode="decimal" type="number" min={mode === "reps" ? 1 : 0.1} max={mode === "reps" ? 1000 : 3600} step={mode === "reps" ? 1 : 0.1} value={value} onChange={event => setValue(event.target.value)} className={field} /></label>
        {mode === "reps" && <label className="text-xs text-white/70">{tr("External load (kg, optional)")}<input type="number" inputMode="decimal" min="0" max="1000" step="0.01" value={load} onChange={event => setLoad(event.target.value)} placeholder={tr("Blank = bodyweight")} className={field} /></label>}
      </div>
      <p className="text-xs text-white/50">{tr("Use the same exercise variation and load convention each time. Different band assistance isn't directly comparable.")}</p>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <div className="flex gap-2"><button type="submit" disabled={busy} className="rounded-xl bg-[rgb(var(--sw-accent-rgb))] px-4 py-2 text-sm font-bold text-black disabled:opacity-50">{busy ? tr("Saving…") : today ? tr("Update today's result") : tr("Save result")}</button><button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70">{tr("Cancel")}</button></div>
      {history && history.length > 1 && <details className="text-xs text-white/60"><summary className="cursor-pointer py-2">{tr("Recent results")}</summary><ul className="space-y-2">{history.slice(0, 10).map(result => <li key={result.date}>{result.date} · {resultLabel(result)}</li>)}</ul></details>}
    </form>}
  </div>;
}
