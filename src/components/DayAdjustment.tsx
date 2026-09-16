import { useState } from "react";
import {
  REASONS,
  type Adjustment,
  type DayState,
} from "../../convex/supportModel";

export type TodayItem = {
  key: string;
  name: string;
  group: string;
  completed: boolean;
  minutes?: number;
  fallbackName?: string;
  fallbackMinutes?: number;
  locked?: boolean;
};
const field =
  "mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-base";
const button =
  "min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50";

export function DayAdjustment({
  items,
  state,
  initialKey,
  busy,
  error,
  onApply,
  onCancel,
}: {
  items: TodayItem[];
  state: DayState;
  initialKey?: string;
  busy: boolean;
  error: string;
  onApply: (state: DayState) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<Adjustment["reason"]>("time");
  const [focus, setFocus] = useState(state.focusKey);
  const [changes, setChanges] = useState<Adjustment[]>(state.adjustments);
  const [onlyOne, setOnlyOne] = useState(!!initialKey);
  const available = items.filter((item) => !item.completed && !item.locked);
  const shown = onlyOne
    ? available.filter((item) => item.key === initialKey)
    : available;
  const select = (item: TodayItem, mode: "keep" | "step" | "pause") =>
    setChanges((previous) => {
      const old = previous.find((change) => change.key === item.key);
      const rest = previous.filter((change) => change.key !== item.key);
      return mode === "keep"
        ? rest
        : [
            ...rest,
            {
              key: item.key,
              title: item.name,
              reason,
              mode,
              step: mode === "step" ? old?.step || item.fallbackName || "" : "",
              stepDone:
                mode === "step" && old?.mode === "step" ? old.stepDone : false,
            },
          ];
    });
  const paused = available.filter((item) =>
    changes.some(
      (change) => change.key === item.key && change.mode === "pause",
    ),
  ).length;
  const smaller = available.filter((item) =>
    changes.some((change) => change.key === item.key && change.mode === "step"),
  ).length;
  const invalid = changes.some(
    (change) => change.mode === "step" && !change.step.trim(),
  );
  return (
    <section
      className="rounded-3xl border border-[rgb(var(--sw-accent-rgb)/.4)] bg-black/40 p-5 sm:p-6"
      data-no-swipe
    >
      <p className="text-xs uppercase tracking-widest text-[rgb(var(--sw-accent-rgb))]">
        Make room for real life
      </p>
      <h2 className="mt-2 text-2xl font-bold">Adjust today</h2>
      <p className="mt-3 text-sm leading-6 text-white/65">
        Keep what matters, choose a smaller first step, or pause an optional
        action for today. Your original routine returns tomorrow.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onApply({ ...state, focusKey: focus, adjustments: changes });
        }}
        className="mt-5 space-y-5"
      >
        <fieldset disabled={busy}>
          <legend className="text-sm font-semibold">
            What's getting in the way?
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(REASONS).map(([key, label]) => (
              <button
                type="button"
                key={key}
                aria-pressed={reason === key}
                className={`${button} ${reason === key ? "border-[rgb(var(--sw-accent-rgb))] bg-white/10" : ""}`}
                onClick={() => {
                  setReason(key as Adjustment["reason"]);
                  setChanges((previous) =>
                    previous.map((change) =>
                      shown.some((item) => item.key === change.key)
                        ? { ...change, reason: key as Adjustment["reason"] }
                        : change,
                    ),
                  );
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm">
          What matters most right now?
          <select
            className={field}
            value={focus}
            disabled={busy}
            onChange={(event) => setFocus(event.target.value)}
          >
            <option value="">Use the next available action</option>
            {available.map((item) => (
              <option key={item.key} value={item.key}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-3">
          {shown.map((item) => {
            const change = changes.find((row) => row.key === item.key);
            return (
              <fieldset
                key={item.key}
                disabled={busy}
                className="rounded-2xl border border-white/10 p-4"
              >
                <legend className="max-w-full break-words px-2 text-sm font-semibold">
                  {item.name}
                </legend>
                <p className="text-xs text-white/50">
                  {item.group}
                  {item.minutes ? ` · About ${item.minutes} min` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["keep", "Keep as planned"],
                      ["step", "Smaller first step"],
                      ["pause", "Pause today"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={(change?.mode ?? "keep") === mode}
                      className={`${button} ${(change?.mode ?? "keep") === mode ? "border-[rgb(var(--sw-accent-rgb))]" : ""}`}
                      onClick={() => select(item, mode)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {change?.mode === "step" && (
                  <label className="mt-3 block text-sm text-white/65">
                    An achievable first step
                    <input
                      className={field}
                      required
                      maxLength={180}
                      value={change.step}
                      placeholder={
                        reason === "unclear"
                          ? "e.g. Open the brief and write one question"
                          : "e.g. Work on the first paragraph for 5 minutes"
                      }
                      onChange={(event) =>
                        setChanges((previous) =>
                          previous.map((row) =>
                            row.key === item.key
                              ? {
                                  ...row,
                                  step: event.target.value,
                                  stepDone: false,
                                }
                              : row,
                          ),
                        )
                      }
                    />
                    <span className="mt-2 block text-xs">
                      Finishing this step won't mark the full action complete.
                    </span>
                  </label>
                )}
                {change?.mode === "pause" && (
                  <p className="mt-3 text-xs leading-5 text-white/60">
                    This occurrence stays unfinished and moves to “Paused
                    today.” Nothing is completed or rescheduled. Keep any
                    time-sensitive commitment in your active plan.
                  </p>
                )}
              </fieldset>
            );
          })}
        </div>
        {onlyOne && (
          <button
            type="button"
            onClick={() => setOnlyOne(false)}
            className={button}
          >
            Adjust the rest of my day too
          </button>
        )}
        {!available.length && (
          <p className="text-sm text-white/60">
            There are no editable actions remaining today.
          </p>
        )}
        <div className="rounded-xl bg-white/5 p-4 text-sm leading-6">
          <strong>Your updated plan</strong>
          <p className="mt-1 text-white/70">
            {available.length - paused - smaller} unchanged · {smaller} smaller
            steps · {paused} paused for today
          </p>
          <p className="mt-2 text-xs text-white/55">
            This changes routine tasks and habits on Today. Workouts and Athkar
            stay as you planned them. Original progress totals remain unchanged.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy || invalid || !available.length}
            className="min-h-11 rounded-xl bg-[rgb(var(--sw-accent-rgb))] px-5 py-3 text-sm font-bold text-black disabled:opacity-50"
          >
            {busy ? "Saving…" : "Use this plan for today"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={button}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
