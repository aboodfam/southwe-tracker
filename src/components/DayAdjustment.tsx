import { useState } from "react";
import type { DayState, Adjustment } from "../../convex/supportModel";

export type TodayItem = {
  key: string;
  name: string;
  group: string;
  completed: boolean;
  locked?: boolean;
};

export function DayAdjustment({
  items,
  state,
  busy,
  error,
  onApply,
  onCancel,
}: {
  items: TodayItem[];
  state: DayState;
  busy: boolean;
  error: string;
  onApply: (state: DayState) => void;
  onCancel: () => void;
}) {
  const available = items.filter((item) => !item.completed && !item.locked);
  const [kept, setKept] = useState(() =>
    available
      .filter(
        (item) =>
          !state.adjustments.some(
            (row) => row.key === item.key && row.mode === "pause",
          ),
      )
      .map((item) => item.key),
  );
  return (
    <section
      className="rounded-2xl border border-white/15 bg-black/30 p-5"
      data-no-swipe
    >
      <h2 className="text-lg font-semibold">What do you want to keep today?</h2>
      <p className="mt-2 text-sm leading-6 text-white/60">
        Uncheck anything optional. It will be set aside for today, without
        marking it complete.
      </p>
      <form
        className="mt-4"
        onSubmit={(event) => {
          event.preventDefault();
          const keys = new Set(available.map((item) => item.key));
          const changes: Adjustment[] = state.adjustments.filter(
            (row) => !keys.has(row.key),
          );
          for (const item of available) {
            const previous = state.adjustments.find(
              (row) => row.key === item.key,
            );
            if (!kept.includes(item.key))
              changes.push({
                key: item.key,
                title: item.name,
                mode: "pause",
                reason: previous?.reason ?? "time",
                step: "",
                stepDone: false,
              });
            else if (previous?.mode === "step") changes.push(previous);
          }
          onApply({ ...state, adjustments: changes });
        }}
      >
        <fieldset disabled={busy} className="space-y-2">
          {available.map((item) => (
            <label
              key={item.key}
              className="flex min-h-12 items-center gap-3 rounded-xl bg-white/[.03] px-3 py-3 text-sm"
            >
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0"
                checked={kept.includes(item.key)}
                onChange={(event) =>
                  setKept((current) =>
                    event.target.checked
                      ? [...current, item.key]
                      : current.filter((key) => key !== item.key),
                  )
                }
              />
              <span className="break-words">{item.name}</span>
            </label>
          ))}
        </fieldset>
        <p className="mt-3 text-xs leading-5 text-white/50">
          Your usual routine returns tomorrow. Workouts and Athkar stay
          unchanged.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <button
            disabled={busy}
            className="min-h-11 rounded-xl bg-[rgb(var(--sw-accent-rgb))] px-5 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save today"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 rounded-xl px-4 py-2 text-sm text-white/65"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
