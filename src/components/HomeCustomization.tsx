import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { HOME_SECTIONS, type HomeSection } from "../../convex/homeLayout";
import { t as tr, useLocale } from "../i18n";
import { useSaveAction } from "../hooks/useSaveAction";
import { Icon } from "./icons";

export function HomeCustomization({
  order,
  hidden,
  onClose,
}: {
  order: HomeSection[];
  hidden: HomeSection[];
  onClose: () => void;
}) {
  useLocale();
  const [draft, setDraft] = useState(order);
  const [off, setOff] = useState(hidden);
  const save = useMutation(api.workspace.saveHomeLayout);
  const action = useSaveAction();
  const move = (index: number, delta: number) =>
    setDraft((current) => {
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  return (
    <section
      data-no-swipe
      aria-label={tr("Customize Home")}
      className="rounded-2xl border border-white/15 bg-black/30 p-4 sm:p-5"
    >
      <h2 className="font-semibold">{tr("Customize Home")}</h2>
      <p className="mt-1 text-xs leading-5 text-white/50">
        {tr("Show what helps and put it in your order. Your data stays saved.")}
      </p>
      <fieldset disabled={action.busy} className="mt-3 space-y-2">
        {draft.map((id, index) => {
          const label = tr(HOME_SECTIONS.find((row) => row.id === id)!.label);
          const checked = !off.includes(id);
          return (
            <div
              key={id}
              className="flex min-w-0 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.025] px-2"
            >
              <label className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 py-2 text-sm">
                <input
                  className="h-5 w-5 shrink-0 accent-primary"
                  type="checkbox"
                  checked={checked}
                  disabled={
                    action.busy || (checked && off.length === draft.length - 1)
                  }
                  onChange={() =>
                    setOff((current) =>
                      checked
                        ? [...current, id]
                        : current.filter((row) => row !== id),
                    )
                  }
                />
                <span className="break-words">{label}</span>
              </label>
              <button
                type="button"
                disabled={action.busy || index === 0}
                onClick={() => move(index, -1)}
                aria-label={tr("Move {0} up", { 0: label })}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-white/5 disabled:opacity-20"
              >
                <Icon name="chevronUp" className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={action.busy || index === draft.length - 1}
                onClick={() => move(index, 1)}
                aria-label={tr("Move {0} down", { 0: label })}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-white/5 disabled:opacity-20"
              >
                <Icon name="chevronDown" className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </fieldset>
      <p className="mt-3 text-xs text-white/45">
        {tr("Sections hidden in My workspace also stay hidden here.")}
      </p>
      {action.error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {action.error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              await save({ order: draft, hidden: off });
              onClose();
            })
          }
          className="min-h-11 flex-1 rounded-xl bg-[image:var(--sw-gradient)] px-3 text-sm font-semibold text-black disabled:opacity-40"
        >
          {action.busy ? tr("Saving…") : tr("Save changes")}
        </button>
        <button
          disabled={action.busy}
          onClick={onClose}
          className="min-h-11 rounded-xl border border-white/10 px-4 text-sm"
        >
          {tr("Cancel")}
        </button>
      </div>
    </section>
  );
}
