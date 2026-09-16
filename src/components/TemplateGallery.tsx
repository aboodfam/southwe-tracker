import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  READY_TEMPLATES,
  type Starter,
  type StarterTask,
} from "../../convex/supportModel";
import { useSaveAction } from "../hooks/useSaveAction";
import { toast } from "sonner";

const button =
  "min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50";
const field =
  "mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-base";

export function TemplateGallery({
  dateKey,
  onDone,
  onClose,
}: {
  dateKey: string;
  onDone: () => void;
  onClose?: () => void;
}) {
  const apply = useMutation(api.workspace.applyStarter);
  const action = useSaveAction();
  const [draft, setDraft] = useState<Starter | null>(null);
  const [included, setIncluded] = useState<boolean[]>([]);
  const request = useRef(crypto.randomUUID());
  const edit = (index: number, patch: Partial<StarterTask>) =>
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            tasks: previous.tasks.map((task, i) =>
              i === index ? { ...task, ...patch } : task,
            ),
          }
        : previous,
    );
  const chosen = draft?.tasks.filter((_, index) => included[index]) ?? [];
  const minutes = chosen.reduce((sum, task) => sum + (task.minutes ?? 0), 0);
  const select = (starter: Starter) => {
    setDraft({ ...starter, tasks: starter.tasks.map((task) => ({ ...task })) });
    setIncluded(starter.tasks.map(() => true));
    request.current = crypto.randomUUID();
    action.setError("");
  };
  return (
    <section
      className="rounded-3xl border border-white/15 bg-black/30 p-5 sm:p-7"
      data-no-swipe
      aria-label="Ready-made templates"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[rgb(var(--sw-accent-rgb))]">
            A little structure to start
          </p>
          <h2 className="mt-2 text-2xl font-bold">
            What would you like help with?
          </h2>
        </div>
        {onClose && (
          <button className={button} onClick={onClose} disabled={action.busy}>
            Close
          </button>
        )}
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
        Choose a starting point, make it yours, and begin with one action. These
        are daily routines; only add what you want to repeat.
      </p>
      {!draft ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {READY_TEMPLATES.map((starter) => (
              <button
                key={starter.id}
                onClick={() => select(starter)}
                className="rounded-2xl border border-white/10 bg-white/[.025] p-5 text-left transition hover:border-[rgb(var(--sw-accent-rgb)/.6)] hover:bg-white/5"
              >
                <span className="text-xs text-white/50">
                  {starter.tasks.length}{" "}
                  {starter.tasks.length === 1 ? "action" : "actions"} · About{" "}
                  {starter.tasks.reduce(
                    (sum, task) => sum + (task.minutes ?? 0),
                    0,
                  )}{" "}
                  min
                </span>
                <span className="mt-2 block text-lg font-semibold">
                  {starter.name}
                </span>
                <span className="mt-2 block text-sm leading-6 text-white/60">
                  {starter.description}
                </span>
                <span className="mt-4 block text-sm text-[rgb(var(--sw-accent-rgb))]">
                  Preview & personalise →
                </span>
              </button>
            ))}
          </div>
          <button
            className={`${button} mt-4`}
            onClick={() =>
              select({
                id: "own",
                name: "My daily routine",
                description: "",
                timeSlot: "Any time",
                tasks: [{ name: "", minutes: 10 }],
              })
            }
          >
            Start with my own action
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
                tasks: chosen,
                requestId: request.current,
              });
              toast.success("Your routine is ready. Start with one action.");
              onDone();
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Routine name
              <input
                className={field}
                value={draft.name}
                maxLength={80}
                required
                disabled={action.busy}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </label>
            <label className="text-sm">
              When it fits your day
              <input
                className={field}
                value={draft.timeSlot}
                maxLength={48}
                required
                disabled={action.busy}
                onChange={(event) =>
                  setDraft({ ...draft, timeSlot: event.target.value })
                }
              />
            </label>
          </div>
          <p className="text-sm text-white/60">
            Edit each action or uncheck it to leave it out. Smaller options are
            suggestions for a difficult day, not automatic completions.
          </p>
          {draft.tasks.map((task, index) => (
            <fieldset
              key={index}
              disabled={action.busy}
              className="rounded-2xl border border-white/10 p-4"
            >
              <legend className="px-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={included[index]}
                    onChange={(event) =>
                      setIncluded((values) =>
                        values.map((value, i) =>
                          i === index ? event.target.checked : value,
                        ),
                      )
                    }
                  />
                  Include action {index + 1}
                </label>
              </legend>
              <div className={included[index] ? "" : "opacity-40"}>
                <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                  <label className="text-sm">
                    Action
                    <input
                      className={field}
                      value={task.name}
                      maxLength={180}
                      required={included[index]}
                      disabled={!included[index]}
                      onChange={(event) =>
                        edit(index, { name: event.target.value })
                      }
                      placeholder="e.g. Review one topic"
                    />
                  </label>
                  <label className="text-sm">
                    Minutes
                    <input
                      type="number"
                      min={1}
                      max={240}
                      required={included[index]}
                      disabled={!included[index]}
                      className={field}
                      value={task.minutes ?? ""}
                      onChange={(event) =>
                        edit(index, {
                          minutes: event.target.value
                            ? Number(event.target.value)
                            : undefined,
                        })
                      }
                    />
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem]">
                  <label className="text-sm text-white/65">
                    Smaller first step (optional)
                    <input
                      className={field}
                      value={task.fallbackName ?? ""}
                      disabled={!included[index]}
                      maxLength={180}
                      onChange={(event) =>
                        edit(index, { fallbackName: event.target.value })
                      }
                      placeholder="Something manageable"
                    />
                  </label>
                  <label className="text-sm text-white/65">
                    Minutes
                    <input
                      type="number"
                      min={1}
                      max={task.minutes ?? 240}
                      disabled={!included[index]}
                      className={field}
                      value={task.fallbackMinutes ?? ""}
                      onChange={(event) =>
                        edit(index, {
                          fallbackMinutes: event.target.value
                            ? Number(event.target.value)
                            : undefined,
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            </fieldset>
          ))}
          <div className="rounded-xl bg-white/5 p-4 text-sm text-white/75">
            Adds one daily routine with {chosen.length}{" "}
            {chosen.length === 1 ? "action" : "actions"}
            {minutes > 0 ? ` · About ${minutes} minutes` : ""}. Your existing
            plans stay in place.
          </div>
          {action.error && (
            <p role="alert" className="text-sm text-red-300">
              {action.error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={action.busy || !chosen.length}
              className="min-h-11 rounded-xl bg-[rgb(var(--sw-accent-rgb))] px-5 py-3 text-sm font-bold text-black disabled:opacity-50"
            >
              {action.busy ? "Saving…" : "Use this routine & begin"}
            </button>
            <button
              type="button"
              className={button}
              disabled={action.busy}
              onClick={() => setDraft(null)}
            >
              Back to templates
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
