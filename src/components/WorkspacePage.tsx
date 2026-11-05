import { t as tr, useLocale, getIntlLocale } from "../i18n";
import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  PAGES,
  validatePlan,
  selectSaveCategory,
  planItemCount,
  type SaveCategory,
  type Plan,
  type Page,
} from "../../convex/planFormat";
import { useSaveAction } from "../hooks/useSaveAction";
import { TemplateGallery } from "./TemplateGallery";
import { ChoiceSelect } from "./ChoiceSelect";
import { Icon, type IconName } from "./icons";
import { useLocalDateKey } from "../hooks/useLocalDateKey";
import { toast } from "sonner";

const card = "rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5";
const button =
  "min-h-11 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40";
const primary =
  "min-h-11 rounded-xl bg-[image:var(--sw-gradient)] px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40";
const field =
  "mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-base text-white";
const errorText = (error: string) =>
  error && (
    <p role="alert" className="mt-3 break-words text-sm text-red-300">
      {error}
    </p>
  );
export function GuidedSetup() {
  useLocale();
  const prefs = useQuery(api.workspace.getPreferences);
  const dateKey = useLocalDateKey();
  if (!prefs || prefs.setupDone) return null;
  return (
    <TemplateGallery
      dateKey={dateKey}
      onDone={() => toast.success(tr("Routine added to your blocks."))}
    />
  );
}

const saveOptions: { id: SaveCategory; label: string; icon: IconName }[] = [
  { id: "blocks", label: "Blocks", icon: "layers" },
  { id: "flexible", label: "Flexible routine", icon: "routines" },
  { id: "workouts", label: "Whole workout plan", icon: "workout" },
  { id: "athkar", label: "Custom Athkar", icon: "hands" },
];
function planSummary(plan: Plan) {
  return [
    plan.routines.length
      ? tr("{0} routine sections", { 0: plan.routines.length })
      : "",
    plan.workouts.length
      ? tr("{0} workout days", { 0: plan.workouts.length })
      : "",
    plan.athkar?.length
      ? tr("{0} custom Athkar", { 0: plan.athkar.length })
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function PlanLibrary() {
  useLocale();
  const [mode, setMode] = useState<"saved" | "save" | "import">("saved");
  const [category, setCategory] = useState<SaveCategory>("blocks");
  const current = useQuery(
    api.workspace.getCurrentPlan,
    mode === "save" ? {} : "skip",
  );
  const templates = useQuery(api.workspace.listTemplates);
  const saveTemplate = useMutation(api.workspace.saveTemplate);
  const removeTemplate = useMutation(api.workspace.deleteTemplate);
  const importPlan = useMutation(api.workspace.importPlan);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<{
    plan: Plan;
    requestId: string;
    title: string;
  } | null>(null);
  const [removeId, setRemoveId] = useState<Id<"planTemplates"> | null>(null);
  const fileId = useId();
  const action = useSaveAction();
  const selection = selectSaveCategory(current, category);
  const count = planItemCount(selection);
  const openPreview = (input: unknown, title: string) => {
    setPreview(null);
    try {
      setPreview({
        plan: validatePlan(input),
        requestId: crypto.randomUUID(),
        title,
      });
      action.setError("");
    } catch (error) {
      action.setError(
        error instanceof Error ? error.message : tr("Invalid file."),
      );
    }
  };
  const changeMode = (next: typeof mode) => {
    setMode(next);
    setPreview(null);
    action.setError("");
  };
  const download = () => {
    const plan = validatePlan(selection);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ceventic-${category}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(tr("Plan downloaded."));
  };
  return (
    <section className={card}>
      <h2 className="text-lg font-semibold">{tr("Saved plans")}</h2>
      <p className="mt-1 text-sm text-white/55">
        {tr("Save a whole category and use it again later.")}
      </p>
      <div className="my-4 flex flex-wrap gap-2">
        {(
          [
            ["saved", "Your plans"],
            ["save", "Save a plan"],
            ["import", "Import a file"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            disabled={action.busy}
            aria-pressed={mode === key}
            className={`${button} ${mode === key ? "border-white/30 bg-white/10 text-white" : ""}`}
            onClick={() => changeMode(key)}
          >
            {tr(label)}
          </button>
        ))}
      </div>
      {mode === "saved" && (
        <>
          {templates === undefined ? (
            <p role="status" className="py-4 text-sm text-white/55">
              {tr("Loading plan library…")}
            </p>
          ) : templates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 p-5 text-center">
              <p className="text-sm text-white/65">
                {tr("No saved plans yet.")}
              </p>
              <button
                className={`${button} mt-4`}
                onClick={() => changeMode("save")}
              >
                {tr("Save your first plan")}
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {templates.map((template) => (
                <li
                  key={template._id}
                  className="rounded-xl border border-white/10 p-3"
                >
                  <p className="break-words text-sm font-semibold">
                    {template.name}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {planSummary(template.plan)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      disabled={action.busy}
                      className={button}
                      onClick={() => openPreview(template.plan, template.name)}
                    >
                      {tr("Preview & add")}
                    </button>
                    <button
                      disabled={action.busy}
                      className={button}
                      onClick={() => setRemoveId(template._id)}
                    >
                      {tr("Remove")}
                    </button>
                  </div>
                  {removeId === template._id && (
                    <div className="mt-3 rounded-xl border border-red-400/20 p-3 text-sm text-white/70">
                      <p>
                        {tr(
                          "Remove this saved plan? Your active items stay unchanged.",
                        )}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          disabled={action.busy}
                          className={button}
                          onClick={() =>
                            void action.run(async () => {
                              await removeTemplate({ id: template._id });
                              setRemoveId(null);
                              toast.success(tr("Saved template removed."));
                            })
                          }
                        >
                          {tr("Remove template")}
                        </button>
                        <button
                          className={button}
                          onClick={() => setRemoveId(null)}
                        >
                          {tr("Cancel")}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {mode === "save" && (
        <>
          <h3 className="text-sm font-medium text-white/80">
            {tr("What would you like to save?")}
          </h3>
          <div
            role="group"
            aria-label={tr("Save category")}
            className="mt-3 grid grid-cols-2 gap-2"
          >
            {saveOptions.map((option) => {
              const plan = selectSaveCategory(current, option.id);
              const selected = category === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={action.busy}
                  onClick={() => setCategory(option.id)}
                  className={`min-h-24 min-w-0 rounded-xl border p-3 text-start transition ${selected ? "border-[rgb(var(--sw-accent-rgb)/.65)] bg-[rgb(var(--sw-accent-rgb)/.08)]" : "border-white/10 bg-white/[.02] hover:bg-white/5"}`}
                >
                  <Icon
                    name={option.icon}
                    className={`mb-2 h-4 w-4 ${selected ? "text-[rgb(var(--sw-accent-rgb))]" : "text-white/45"}`}
                  />
                  <span className="block break-words text-sm font-semibold">
                    {tr(option.label)}
                  </span>
                  <span className="mt-1 block text-xs text-white/50">
                    {current === undefined
                      ? tr("Loading…")
                      : planSummary(plan) || tr("Nothing here yet")}
                  </span>
                </button>
              );
            })}
          </div>
          {current === undefined ? (
            <p role="status" className="mt-4 text-sm text-white/55">
              {tr("Loading plan library…")}
            </p>
          ) : count === 0 ? (
            <p className="mt-4 text-sm text-white/55">
              {tr("There is nothing to save in this category yet.")}
            </p>
          ) : (
            <>
              <p className="mt-4 text-xs leading-5 text-white/50">
                {tr(
                  "Everything in this category is included. Progress and checkmarks are not saved.",
                )}
              </p>
              <label className="mt-4 block text-sm">
                {tr("Template name")}
                <input
                  value={name}
                  maxLength={80}
                  onChange={(event) => setName(event.target.value)}
                  className={field}
                  placeholder={tr("Give this plan a name")}
                />
              </label>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  disabled={action.busy || !name.trim()}
                  className={primary}
                  onClick={() =>
                    void action.run(async () => {
                      await saveTemplate({
                        name: name.trim(),
                        plan: validatePlan(selection),
                      });
                      setName("");
                      setMode("saved");
                      toast.success(tr("Template saved to your account."));
                    })
                  }
                >
                  {action.busy ? tr("Saving…") : tr("Save plan")}
                </button>
                <button
                  disabled={action.busy}
                  onClick={() => void action.run(async () => download())}
                  className={button}
                >
                  {tr("Download plan")}
                </button>
              </div>
            </>
          )}
        </>
      )}
      {mode === "import" && (
        <>
          <p className="text-sm leading-6 text-white/60">
            {tr(
              "Choose a Ceventic plan file. You can review it before adding anything.",
            )}
          </p>
          <label
            htmlFor={fileId}
            className={`${button} mt-4 flex cursor-pointer items-center justify-center gap-2 focus-within:outline focus-within:outline-2 focus-within:outline-white/50`}
          >
            <Icon name="upload" className="h-4 w-4" />
            {tr("Choose plan file")}
            <input
              id={fileId}
              aria-label={tr("Choose plan file")}
              type="file"
              accept=".json,application/json"
              disabled={action.busy}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setPreview(null);
                if (file.size > 500000) {
                  action.setError(
                    tr("This file is too large. Maximum: 500 KB."),
                  );
                  return;
                }
                void action.run(async () =>
                  openPreview(JSON.parse(await file.text()), file.name),
                );
              }}
            />
          </label>
          <p className="mt-2 text-xs text-white/45">
            {tr("Ceventic JSON file · up to 500 KB")}
          </p>
        </>
      )}
      {preview && (
        <div
          className="mt-5 rounded-xl border border-[rgb(var(--sw-accent-rgb)/.35)] bg-black/40 p-4"
          aria-live="polite"
        >
          <h3 className="break-words text-base font-semibold">
            {tr("Review:")} {preview.title}
          </h3>
          <p className="mt-1 text-sm text-white/60">
            {planSummary(preview.plan)}
          </p>
          <p className="mt-2 text-xs leading-5 text-white/50">
            {tr("Adds new items without replacing your existing progress.")}
          </p>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto scrollbar-hide">
            {preview.plan.routines.map((routine, index) => (
              <details
                key={`r${index}`}
                className="rounded-lg border border-white/10 p-3 text-sm"
              >
                <summary className="cursor-pointer break-words">
                  {routine.name} · {routine.tasks.length} {tr("tasks")}
                </summary>
                <ul className="mt-2 list-inside list-disc text-white/65">
                  {routine.tasks.map((task, i) => (
                    <li key={i}>{task}</li>
                  ))}
                </ul>
              </details>
            ))}
            {preview.plan.workouts.map((day, index) => (
              <details
                key={`w${index}`}
                className="rounded-lg border border-white/10 p-3 text-sm"
              >
                <summary className="cursor-pointer break-words">
                  {day.name} · {day.exercises.length} {tr("exercises")}
                </summary>
                <p className="mt-2 text-white/65">{day.warmupNotes}</p>
                <ul className="space-y-2 text-white/65">
                  {day.exercises.map((exercise, i) => (
                    <li key={i}>
                      {exercise.name} · {exercise.sets} × {exercise.reps}
                      {exercise.muscles ? ` · ${exercise.muscles}` : ""}
                      {exercise.isWarmup ? ` ${tr("(warmup)")}` : ""}
                      <span className="block text-xs">{exercise.notes}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            {preview.plan.athkar?.map((dhikr, index) => (
              <details
                key={`a${index}`}
                className="rounded-lg border border-white/10 p-3 text-sm"
              >
                <summary className="cursor-pointer">
                  {tr("Dhikr {0}", { 0: index + 1 })} · ×{dhikr.targetCount}
                </summary>
                <p dir="auto" className="mt-3 whitespace-pre-wrap leading-7">
                  {dhikr.text}
                </p>
                {dhikr.translation && (
                  <p
                    dir="auto"
                    className="mt-2 whitespace-pre-wrap text-xs text-white/60"
                  >
                    {dhikr.translation}
                  </p>
                )}
              </details>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              disabled={action.busy || !planItemCount(preview.plan)}
              className={primary}
              onClick={() =>
                void action.run(async () => {
                  await importPlan({
                    plan: preview.plan,
                    requestId: preview.requestId,
                  });
                  setPreview(null);
                  toast.success(tr("Plan added."));
                })
              }
            >
              {action.busy ? tr("Adding…") : tr("Add as new items")}
            </button>
            <button
              disabled={action.busy}
              className={button}
              onClick={() => setPreview(null)}
            >
              {tr("Cancel")}
            </button>
          </div>
        </div>
      )}
      {errorText(action.error)}
    </section>
  );
}

function DeletedItems() {
  useLocale();
  const deleted = useQuery(api.recovery.listDeleted);
  const restore = useMutation(api.recovery.restore);
  const purge = useMutation(api.recovery.removePermanently);
  const [confirm, setConfirm] = useState<Id<"recycleBin"> | null>(null);
  const action = useSaveAction();
  return (
    <section className={card}>
      <h2 className="text-lg font-semibold">{tr("Recently deleted")}</h2>
      <p className="mt-1 text-sm leading-6 text-white/55">
        {tr("Restore something you deleted, or remove it permanently.")}
      </p>
      {deleted === undefined ? (
        <p role="status" className="mt-4 text-sm text-white/60">
          {tr("Loading deleted items…")}
        </p>
      ) : !deleted.length ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-white/55">
          {tr("Nothing in recently deleted.")}
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {deleted.map((item) => (
            <li
              key={item._id}
              className="rounded-xl border border-white/10 p-3"
            >
              <p className="break-words text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-xs text-white/45">
                {new Date(item.deletedAt).toLocaleDateString(getIntlLocale())}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(async () => {
                      await restore({ id: item._id });
                      toast.success(tr("Restored."));
                    })
                  }
                  className={button}
                >
                  {tr("Restore")}
                </button>
                <button
                  disabled={action.busy}
                  onClick={() => setConfirm(item._id)}
                  className={button}
                >
                  {tr("Remove forever")}
                </button>
              </div>
              {confirm === item._id && (
                <div className="mt-3 rounded-xl border border-red-400/20 p-3 text-sm">
                  <p>
                    {tr(
                      "This cannot be undone. Any separately deleted children need their parent to be restorable.",
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      disabled={action.busy}
                      className={button}
                      onClick={() =>
                        void action.run(async () => {
                          await purge({ id: item._id, confirm: "DELETE" });
                          setConfirm(null);
                          toast.success(tr("Permanently removed."));
                        })
                      }
                    >
                      {tr("Confirm permanent removal")}
                    </button>
                    <button className={button} onClick={() => setConfirm(null)}>
                      {tr("Cancel")}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <details className="mt-4 border-t border-white/10 pt-3 text-xs leading-6 text-white/50">
        <summary className="cursor-pointer py-1">
          {tr("How restore works")}
        </summary>
        <p className="mt-2">
          {tr(
            "Restore routines, tasks, habits, workout days and exercises deleted after this update. Up to 100 items are kept until you restore or permanently remove them. Restore a parent routine or day before its individual items. Restored routine checkmarks start unchecked; saved history stays intact.",
          )}
        </p>
      </details>
      {errorText(action.error)}
    </section>
  );
}

const areas: {
  id: "customize" | "routines" | "plans" | "deleted";
  label: string;
  icon: IconName;
}[] = [
  { id: "customize", label: "Customize", icon: "settings" },
  { id: "routines", label: "Routines", icon: "routines" },
  { id: "plans", label: "Saved plans", icon: "layers" },
  { id: "deleted", label: "Deleted items", icon: "trash" },
];
export function WorkspacePage({ onBack }: { onBack?: () => void }) {
  useLocale();
  const dateKey = useLocalDateKey();
  const [area, setArea] = useState<(typeof areas)[number]["id"]>("customize");
  const tabId = useId();
  const tabs = useRef<HTMLDivElement>(null);
  const prefs = useQuery(api.workspace.getPreferences);
  const save = useMutation(api.workspace.savePreferences);
  const [hidden, setHidden] = useState<Page[]>(() => prefs?.hiddenPages ?? []);
  const [start, setStart] = useState<Page>(() => prefs?.startPage ?? "today");
  const action = useSaveAction();
  const navigationKey = prefs
    ? `${prefs.userId}:${prefs.startPage}:${prefs.hiddenPages.join("|")}`
    : "";
  useEffect(() => {
    if (prefs) {
      setHidden(prefs.hiddenPages);
      setStart(prefs.startPage);
    }
  }, [navigationKey]);
  if (!prefs)
    return (
      <p role="status" className="p-10 text-center text-white/60">
        {tr("Loading your workspace…")}
      </p>
    );
  const dirty =
    start !== prefs.startPage ||
    [...hidden].sort().join() !== [...prefs.hiddenPages].sort().join();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="py-1">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-1 inline-flex min-h-11 items-center gap-2 text-sm text-white/55 hover:text-white"
          >
            <Icon name="chevronLeft" className="h-4 w-4" />
            {tr("Back to app")}
          </button>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--sw-accent-rgb))] sm:text-3xl">
          {tr("My workspace")}
        </h1>
        <p className="mt-1 text-sm text-white/55">
          {tr("Make Ceventic yours.")}
        </p>
      </header>
      <div
        ref={tabs}
        role="tablist"
        aria-label={tr("Workspace sections")}
        className="grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1"
        onKeyDown={(event) => {
          const index = areas.findIndex((item) => item.id === area);
          let next = index;
          if (event.key === "ArrowRight") next = (index + 1) % areas.length;
          else if (event.key === "ArrowLeft")
            next = (index - 1 + areas.length) % areas.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = areas.length - 1;
          else return;
          event.preventDefault();
          setArea(areas[next].id);
          tabs.current
            ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
            [next]?.focus();
        }}
      >
        {areas.map((item) => (
          <button
            key={item.id}
            id={`${tabId}-${item.id}`}
            role="tab"
            aria-selected={area === item.id}
            aria-controls={`${tabId}-panel`}
            tabIndex={area === item.id ? 0 : -1}
            onClick={() => setArea(item.id)}
            className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2 text-[11px] font-medium transition sm:text-sm ${area === item.id ? "bg-white/10 text-white" : "text-white/45 hover:bg-white/5 hover:text-white/80"}`}
          >
            <Icon name={item.icon} className="h-4 w-4 shrink-0" />
            <span className="max-w-full break-words text-center leading-4">
              {tr(item.label)}
            </span>
          </button>
        ))}
      </div>
      <div
        id={`${tabId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabId}-${area}`}
        tabIndex={0}
        className="outline-none"
      >
        {area === "customize" && (
          <section className={card}>
            <h2 className="text-lg font-semibold">
              {tr("Show in navigation")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-white/55">
              {tr(
                "Choose the sections you use. Hidden sections keep their data.",
              )}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PAGES.map((page) => {
                const visible = !hidden.includes(page.id);
                return (
                  <button
                    key={page.id}
                    role="switch"
                    aria-checked={visible}
                    disabled={
                      action.busy ||
                      (visible && hidden.length === PAGES.length - 1)
                    }
                    aria-label={tr(page.name)}
                    onClick={() => {
                      const next = visible
                        ? [...hidden, page.id]
                        : hidden.filter((id) => id !== page.id);
                      setHidden(next);
                      if (next.includes(start))
                        setStart(
                          PAGES.find((item) => !next.includes(item.id))!.id,
                        );
                    }}
                    className={`flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition disabled:opacity-40 ${visible ? "border-white/20 bg-white/[.06] text-white/90" : "border-white/10 text-white/40"}`}
                  >
                    <span className="min-w-0 break-words text-start">
                      {tr(page.name)}
                    </span>
                    <span
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${visible ? "border-transparent bg-[rgb(var(--sw-accent-rgb))] text-black" : "border-white/20"}`}
                    >
                      {visible && <Icon name="check" className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="mb-2 text-sm font-medium text-white/80">
                {tr("Start page")}
              </p>
              <ChoiceSelect
                label={tr("Start page")}
                value={start}
                disabled={action.busy}
                className="w-full"
                onChange={setStart}
                options={PAGES.filter((page) => !hidden.includes(page.id)).map(
                  (page) => ({ value: page.id, label: tr(page.name) }),
                )}
              />
            </div>
            <p className="mt-2 text-xs text-white/45">
              {tr("Keep at least one section visible.")}
            </p>
            <button
              disabled={action.busy || !dirty}
              className={`${primary} mt-4 w-full`}
              onClick={() =>
                void action.run(async () => {
                  await save({ hiddenPages: hidden, startPage: start });
                  toast.success(
                    tr("Workspace preferences saved across your account."),
                  );
                })
              }
            >
              {action.busy
                ? tr("Saving…")
                : dirty
                  ? tr("Save changes")
                  : tr("Saved")}
            </button>
            {errorText(action.error)}
          </section>
        )}
        {area === "routines" && (
          <TemplateGallery
            dateKey={dateKey}
            onDone={() => toast.success(tr("Routine added to your blocks."))}
          />
        )}
        {area === "plans" && <PlanLibrary />}
        {area === "deleted" && <DeletedItems />}
      </div>
    </div>
  );
}
