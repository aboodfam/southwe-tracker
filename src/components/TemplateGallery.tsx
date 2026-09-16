import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { READY_TEMPLATES, type Starter } from "../../convex/supportModel";
import { useSaveAction } from "../hooks/useSaveAction";

const button =
  "min-h-11 rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50";
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
  const select = (starter: Starter) => {
    setDraft({ ...starter, tasks: starter.tasks.map((task) => ({ ...task })) });
    setIncluded(starter.tasks.map(() => true));
    request.current = crypto.randomUUID();
    action.setError("");
  };
  return (
    <section
      className="rounded-2xl border border-white/10 bg-black/30 p-5"
      data-no-swipe
      aria-label="Ready-made templates"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          {draft ? draft.name : "Start with something simple"}
        </h2>
        {onClose && (
          <button onClick={onClose} disabled={action.busy} className={button}>
            Close
          </button>
        )}
      </div>
      {!draft ? (
        <>
          <p className="mt-2 text-sm text-white/60">
            Choose a small daily routine, or add your own action.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {READY_TEMPLATES.map((starter) => (
              <button
                key={starter.id}
                onClick={() => select(starter)}
                className={`${button} p-4 text-left`}
              >
                <span className="block font-semibold">{starter.name}</span>
                <span className="mt-1 block text-xs text-white/55">
                  {starter.tasks.length} daily{" "}
                  {starter.tasks.length === 1 ? "action" : "actions"}
                </span>
              </button>
            ))}
          </div>
          <button
            className="mt-3 min-h-11 text-sm text-[rgb(var(--sw-accent-rgb))]"
            onClick={() =>
              select({
                id: "own",
                name: "My daily routine",
                description: "",
                timeSlot: "Any time",
                tasks: [{ name: "" }],
              })
            }
          >
            Add my own action
          </button>
        </>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(async () => {
              await apply({
                dateKey,
                name: draft.name,
                timeSlot: draft.timeSlot,
                tasks: draft.tasks.filter((_, i) => included[i]),
                requestId: request.current,
              });
              onDone();
              setDraft(null);
            });
          }}
        >
          <p className="text-sm text-white/60">
            Edit the actions or uncheck any you don't want. These repeat daily.
          </p>
          {draft.tasks.map((task, index) => (
            <div key={index} className="flex items-center gap-3">
              <input
                type="checkbox"
                aria-label={`Include action ${index + 1}`}
                checked={included[index]}
                disabled={action.busy}
                className="h-5 w-5 shrink-0"
                onChange={(event) =>
                  setIncluded((current) =>
                    current.map((value, i) =>
                      i === index ? event.target.checked : value,
                    ),
                  )
                }
              />
              <input
                aria-label={`Action ${index + 1}`}
                value={task.name}
                required={included[index]}
                maxLength={180}
                disabled={action.busy || !included[index]}
                placeholder="What would you like to do?"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-base disabled:opacity-40"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    tasks: draft.tasks.map((row, i) =>
                      i === index ? { ...row, name: event.target.value } : row,
                    ),
                  })
                }
              />
            </div>
          ))}
          <details className="text-sm text-white/65">
            <summary className="cursor-pointer py-2">
              Name and timing (optional)
            </summary>
            <label className="mt-2 block">
              Routine name
              <input
                className="mt-1 block min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3"
                value={draft.name}
                maxLength={80}
                required
                disabled={action.busy}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </label>
            <label className="mt-3 block">
              When
              <input
                className="mt-1 block min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3"
                value={draft.timeSlot}
                maxLength={48}
                required
                disabled={action.busy}
                onChange={(event) =>
                  setDraft({ ...draft, timeSlot: event.target.value })
                }
              />
            </label>
          </details>
          {action.error && (
            <p role="alert" className="text-sm text-red-300">
              {action.error}
            </p>
          )}
          <div className="flex gap-3">
            <button
              disabled={action.busy || !included.some(Boolean)}
              className="min-h-11 rounded-xl bg-[rgb(var(--sw-accent-rgb))] px-5 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {action.busy ? "Adding…" : "Add to my day"}
            </button>
            <button
              type="button"
              className={button}
              disabled={action.busy}
              onClick={() => setDraft(null)}
            >
              Back
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
