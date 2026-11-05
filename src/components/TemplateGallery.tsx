import { t as tr, useLocale, formatNumber } from "../i18n";
import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  READY_TEMPLATES,
  type Starter,
  type StarterTask,
} from "../../convex/supportModel";
import { useSaveAction } from "../hooks/useSaveAction";
import { Icon, type IconName } from "./icons";

const button =
  "min-h-11 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/5 disabled:opacity-40";
const field =
  "min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-base disabled:opacity-40";
const icons: Record<string, IconName> = {
  study: "routines",
  morning: "sunrise",
  focus: "habits",
  evening: "moon",
};
type DraftStep = StarterTask & { key: string };
type Draft = Omit<Starter, "tasks"> & { tasks: DraftStep[] };
const estimate = (tasks: StarterTask[]) =>
  tasks.reduce((total, task) => total + (task.minutes ?? 0), 0);

export function TemplateGallery({
  dateKey,
  onDone,
  onClose,
}: {
  dateKey: string;
  onDone: () => void;
  onClose?: () => void;
}) {
  useLocale();
  const apply = useMutation(api.workspace.applyStarter);
  const action = useSaveAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const request = useRef(crypto.randomUUID());
  const gallery = useRef<HTMLElement>(null);
  const showStart = () =>
    requestAnimationFrame(() =>
      gallery.current?.scrollIntoView({ block: "start" }),
    );
  const select = (starter: Starter) => {
    setDraft({
      ...starter,
      name: tr(starter.name),
      description: tr(starter.description),
      timeSlot: tr(starter.timeSlot),
      tasks: starter.tasks.map((task) => ({
        ...task,
        key: crypto.randomUUID(),
        name: tr(task.name),
        ...(task.fallbackName ? { fallbackName: tr(task.fallbackName) } : {}),
      })),
    });
    request.current = crypto.randomUUID();
    action.setError("");
    showStart();
  };
  const updateStep = (key: string, changes: Partial<StarterTask>) =>
    setDraft(
      (current) =>
        current && {
          ...current,
          tasks: current.tasks.map((task) =>
            task.key === key ? { ...task, ...changes } : task,
          ),
        },
    );
  const total = draft ? estimate(draft.tasks) : 0;

  return (
    <section
      ref={gallery}
      className="min-w-0 scroll-mt-24 rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5"
      aria-label={tr("Ready-made templates")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {draft ? tr("Make it your routine") : tr("Routine ideas")}
          </h2>
          <p className="mt-2 text-sm text-white/60">
            {draft
              ? tr("This adds one daily block. Edit the steps to fit your day.")
              : tr(
                  "Choose a repeatable part of your day. Preview the steps, then make it yours.",
                )}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} disabled={action.busy} className={button}>
            {tr("Close")}
          </button>
        )}
      </div>
      {!draft ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {READY_TEMPLATES.map((starter) => (
              <button
                key={starter.id}
                onClick={() => select(starter)}
                className="group flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-start transition hover:border-[rgb(var(--sw-accent-rgb))]/50 hover:bg-white/5"
              >
                <span className="flex w-full items-start gap-3">
                  <span className="rounded-xl bg-[rgb(var(--sw-accent-rgb)/0.1)] p-2 text-[rgb(var(--sw-accent-rgb))]">
                    <Icon name={icons[starter.id]} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {tr(starter.name)}
                    </span>
                    <span className="mt-1 block text-xs text-white/50">
                      {tr("{0} steps · about {1} min", {
                        0: formatNumber(starter.tasks.length),
                        1: formatNumber(estimate(starter.tasks)),
                      })}
                    </span>
                  </span>
                </span>
                <span className="mt-3 text-sm text-white/60">
                  {tr(starter.description)}
                </span>
                <span className="my-4 flex w-full flex-1 flex-col gap-2 border-t border-white/10 pt-3">
                  {starter.tasks.map((task, index) => (
                    <span
                      key={task.name}
                      className="flex gap-2 text-sm leading-relaxed text-white/75"
                    >
                      <span className="w-4 shrink-0 text-white/35">
                        {formatNumber(index + 1)}
                      </span>
                      <span>{tr(task.name)}</span>
                    </span>
                  ))}
                </span>
                <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold text-[rgb(var(--sw-accent-rgb))]">
                  {tr("Customize routine")}
                  <Icon name="chevronRight" className="h-4 w-4 shrink-0" />
                </span>
              </button>
            ))}
          </div>
          <button
            className={`${button} mt-3 flex w-full items-center justify-center gap-2 border-dashed`}
            onClick={() =>
              select({
                id: "own",
                name: "",
                description: "",
                timeSlot: "Any time",
                tasks: [{ name: "" }],
              })
            }
          >
            <Icon name="plus" className="h-4 w-4" />
            {tr("Build my own routine")}
          </button>
        </>
      ) : (
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(async () => {
              await apply({
                dateKey,
                name: draft.name,
                timeSlot: draft.timeSlot,
                tasks: draft.tasks.map(({ key: _key, ...task }) => task),
                requestId: request.current,
              });
              onDone();
              setDraft(null);
              showStart();
            });
          }}
        >
          <fieldset disabled={action.busy} className="min-w-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-white/75">
                {tr("Routine name")}
                <input
                  autoComplete="off"
                  className={`${field} mt-2`}
                  value={draft.name}
                  maxLength={80}
                  required
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </label>
              <label className="block text-sm text-white/75">
                {tr("When")}
                <input
                  className={`${field} mt-2`}
                  value={draft.timeSlot}
                  placeholder={tr("e.g. After breakfast")}
                  maxLength={48}
                  required
                  onChange={(event) =>
                    setDraft({ ...draft, timeSlot: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <h3 className="font-semibold">{tr("Routine steps")}</h3>
              <span className="text-white/50">
                {total
                  ? draft.tasks.some((task) => !task.minutes)
                    ? tr("{0} min + untimed steps", { 0: formatNumber(total) })
                    : tr("About {0} min", { 0: formatNumber(total) })
                  : tr("Time estimates are optional")}
              </span>
            </div>
            <ol className="space-y-3">
              {draft.tasks.map((task, index) => (
                <li
                  key={task.key}
                  className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label
                      htmlFor={task.key}
                      className="text-xs font-semibold text-white/55"
                    >
                      {tr("Step {0}", { 0: formatNumber(index + 1) })}
                    </label>
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-white/45 hover:bg-white/5 hover:text-red-300 disabled:opacity-25"
                      disabled={action.busy || draft.tasks.length === 1}
                      aria-label={tr("Remove step {0}", { 0: index + 1 })}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          tasks: draft.tasks.filter(
                            (row) => row.key !== task.key,
                          ),
                        })
                      }
                    >
                      <Icon name="x" className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    id={task.key}
                    aria-label={tr("Action {0}", { 0: index + 1 })}
                    value={task.name}
                    required
                    maxLength={180}
                    rows={2}
                    placeholder={tr("What would you like to do?")}
                    className={`${field} block resize-y leading-relaxed`}
                    onChange={(event) =>
                      updateStep(task.key, { name: event.target.value })
                    }
                  />
                  <label className="mt-3 flex items-center justify-between gap-3 text-sm text-white/55">
                    {tr("Minutes (optional)")}
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={240}
                      step={1}
                      aria-label={tr("Minutes for step {0}", { 0: index + 1 })}
                      className={`${field} !w-20 shrink-0 text-center`}
                      value={task.minutes ?? ""}
                      onChange={(event) => {
                        const minutes =
                          event.target.value === ""
                            ? undefined
                            : Number(event.target.value);
                        updateStep(task.key, {
                          minutes,
                          // Keep the optional short version valid when a usual step gets shorter.
                          fallbackMinutes:
                            minutes && minutes > 0 && task.fallbackMinutes
                              ? Math.min(task.fallbackMinutes, minutes)
                              : task.fallbackMinutes,
                        });
                      }}
                    />
                  </label>
                  <details className="mt-2 text-xs text-white/50">
                    <summary className="cursor-pointer py-3">
                      {tr("Short version (optional)")}
                    </summary>
                    <label className="block">
                      {tr("A smaller step for busy days")}
                      <input
                        aria-label={tr("Short version for step {0}", {
                          0: index + 1,
                        })}
                        className={`${field} mt-2`}
                        maxLength={180}
                        value={task.fallbackName ?? ""}
                        onChange={(event) =>
                          updateStep(task.key, {
                            fallbackName: event.target.value || undefined,
                            ...(!event.target.value
                              ? { fallbackMinutes: undefined }
                              : {}),
                          })
                        }
                      />
                    </label>
                    {task.fallbackName && (
                      <label className="mt-2 flex items-center justify-between gap-3">
                        {tr("Minutes (optional)")}
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={task.minutes ?? 240}
                          step={1}
                          aria-label={tr("Short version minutes for step {0}", {
                            0: index + 1,
                          })}
                          className={`${field} !w-20 shrink-0 text-center`}
                          value={task.fallbackMinutes ?? ""}
                          onChange={(event) =>
                            updateStep(task.key, {
                              fallbackMinutes:
                                event.target.value === ""
                                  ? undefined
                                  : Number(event.target.value),
                            })
                          }
                        />
                      </label>
                    )}
                  </details>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className={`${button} flex w-full items-center justify-center gap-2`}
              disabled={action.busy || draft.tasks.length >= 5}
              onClick={() =>
                setDraft({
                  ...draft,
                  tasks: [
                    ...draft.tasks,
                    { key: crypto.randomUUID(), name: "" },
                  ],
                })
              }
            >
              <Icon name="plus" className="h-4 w-4" />
              {tr("Add a step")}
            </button>
            <p className="text-xs text-white/45">
              {tr(
                "Up to 5 steps. Each step resets daily; time estimates are not timers.",
              )}
            </p>
            {action.error && (
              <p role="alert" className="text-sm text-red-300">
                {action.error}
              </p>
            )}
            <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
              <button
                disabled={
                  action.busy ||
                  !draft.name.trim() ||
                  !draft.timeSlot.trim() ||
                  draft.tasks.some((task) => !task.name.trim())
                }
                className="min-h-11 flex-1 rounded-xl bg-[image:var(--sw-gradient)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
              >
                {action.busy ? tr("Adding…") : tr("Add routine")}
              </button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  setDraft(null);
                  action.setError("");
                  showStart();
                }}
              >
                {tr("Back")}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
