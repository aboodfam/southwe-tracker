import { t as tr, useLocale, getIntlLocale } from "../i18n";
import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PAGES, STARTERS, validatePlan, type Plan, type Page } from "../../convex/planFormat";
import { useSaveAction } from "../hooks/useSaveAction";
import { TemplateGallery } from "./TemplateGallery";
import { ChoiceSelect } from "./ChoiceSelect";
import { Icon, type IconName } from "./icons";
import { useLocalDateKey } from "../hooks/useLocalDateKey";
import { toast } from "sonner";

const card = "rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5";
const button = "min-h-11 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40";
const primary = "min-h-11 rounded-xl bg-[image:var(--sw-gradient)] px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40";
const field = "mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-base text-white";
const errorText = (error: string) => error && <p role="alert" className="mt-3 break-words text-sm text-red-300">{error}</p>;
function localizeStarterPlan(plan: Plan): Plan {
  return { ...plan, routines: plan.routines.map(routine => ({ ...routine, name: tr(routine.name), timeSlot: tr(routine.timeSlot), tasks: routine.tasks.map(task => tr(task)) })), workouts: plan.workouts };
}

export function GuidedSetup() {
  useLocale();
  const prefs = useQuery(api.workspace.getPreferences);
  const dateKey = useLocalDateKey();
  if (!prefs || prefs.setupDone) return null;
  return <TemplateGallery dateKey={dateKey} onDone={() => toast.success(tr("Open Today to begin your first action."))} />;
}

export function PlanLibrary() {
  useLocale();
  const [mode, setMode] = useState<"saved" | "save" | "import">("saved");
  const current = useQuery(api.workspace.getCurrentPlan, mode === "save" ? {} : "skip");
  const templates = useQuery(api.workspace.listTemplates);
  const saveTemplate = useMutation(api.workspace.saveTemplate);
  const removeTemplate = useMutation(api.workspace.deleteTemplate);
  const importPlan = useMutation(api.workspace.importPlan);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<{ plan: Plan; requestId: string; title: string } | null>(null);
  const [removeId, setRemoveId] = useState<Id<"planTemplates"> | null>(null);
  const fileId = useId();
  const action = useSaveAction();
  useEffect(() => { setSelected([]); }, [current]);
  const selection: Plan = { version: 1, routines: (current?.routines ?? []).filter((_, index) => selected.includes(`r${index}`)), workouts: (current?.workouts ?? []).filter((_, index) => selected.includes(`w${index}`)) };
  const rows = [...(current?.routines ?? []).map((row, i) => ({ key: `r${i}`, title: row.name, detail: tr("{0} tasks · Routine", { 0: row.tasks.length }) })), ...(current?.workouts ?? []).map((row, i) => ({ key: `w${i}`, title: row.name, detail: tr("{0} exercises · Workout", { 0: row.exercises.length }) }))];
  const count = selection.routines.length + selection.workouts.length;
  const openPreview = (input: unknown, title: string) => {
    setPreview(null);
    try { setPreview({ plan: validatePlan(input), requestId: crypto.randomUUID(), title }); action.setError(""); }
    catch (error) { action.setError(error instanceof Error ? error.message : tr("Invalid file.")); }
  };
  const changeMode = (next: typeof mode) => { setMode(next); setPreview(null); action.setError(""); };
  const download = () => {
    try {
      const plan = validatePlan(selection);
      const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "ceventic-plan.json"; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(tr("Plan export prepared. It contains templates, not your personal progress history."));
    } catch (error) { action.setError(error instanceof Error ? error.message : tr("Could not export.")); }
  };
  return <section className={card} data-no-swipe>
    <h2 className="text-lg font-semibold">{tr("Saved plans")}</h2>
    <p className="mt-1 text-sm leading-6 text-white/55">{tr("Reuse a plan or move it between accounts.")}</p>
    <div className="my-4 flex flex-wrap gap-2">
      {([["saved", "Your plans"], ["save", "Save a plan"], ["import", "Import a file"]] as const).map(([key, label]) => <button key={key} disabled={action.busy} aria-pressed={mode === key} className={`${button} ${mode === key ? "border-white/30 bg-white/10 text-white" : ""}`} onClick={() => changeMode(key)}>{tr(label)}</button>)}
    </div>
    {mode === "saved" && <>
      {templates === undefined ? <p role="status" className="py-4 text-sm text-white/55">{tr("Loading plan library…")}</p> : templates.length === 0 ? <div className="rounded-xl border border-dashed border-white/15 p-5 text-center"><Icon name="layers" className="mx-auto h-6 w-6 text-white/35" /><p className="mt-3 text-sm text-white/65">{tr("No saved plans yet.")}</p><button className={`${button} mt-4`} onClick={() => changeMode("save")}>{tr("Save your first plan")}</button></div> : <ul className="space-y-2">{templates.map(template => <li key={template._id} className="rounded-xl border border-white/10 p-3">
        <p className="break-words text-sm font-semibold">{template.name}</p><p className="mt-1 text-xs text-white/50">{template.plan.routines.length} {tr("routines ·")} {template.plan.workouts.length} {tr("workout days")}</p>
        <div className="mt-3 flex flex-wrap gap-2"><button disabled={action.busy} className={button} onClick={() => openPreview(template.plan, template.name)}>{tr("Preview & add")}</button><button disabled={action.busy} className={button} onClick={() => setRemoveId(template._id)}>{tr("Remove")}</button></div>
        {removeId === template._id && <div className="mt-3 rounded-xl border border-red-400/20 p-3 text-sm text-white/70"><p>{tr("Remove this saved template permanently? Your active routines and workouts stay unchanged.")}</p><div className="mt-3 flex flex-wrap gap-2"><button disabled={action.busy} className={button} onClick={() => void action.run(async () => { await removeTemplate({ id: template._id }); setRemoveId(null); toast.success(tr("Saved template removed.")); })}>{tr("Remove template")}</button><button className={button} onClick={() => setRemoveId(null)}>{tr("Cancel")}</button></div></div>}
      </li>)}</ul>}
    </>}
    {mode === "save" && <>
      <p className="text-sm leading-6 text-white/60">{tr("Choose routines or workout days to save together.")}</p>
      {current === undefined ? <p role="status" className="py-4 text-sm text-white/55">{tr("Loading plan library…")}</p> : <>
        {rows.length > 0 ? <><div className="mt-3 flex flex-wrap gap-2"><button className={button} onClick={() => setSelected(rows.map(row => row.key))}>{tr("Select all")}</button><button className={button} onClick={() => setSelected([])}>{tr("Clear selection")}</button></div>
          <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">{rows.map(row => <label key={row.key} className="flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-3"><input type="checkbox" className="h-4 w-4 shrink-0 accent-[rgb(var(--sw-accent-rgb))]" checked={selected.includes(row.key)} onChange={event => setSelected(previous => event.target.checked ? [...previous, row.key] : previous.filter(key => key !== row.key))} /><span className="min-w-0"><span className="block break-words text-sm">{row.title}</span><span className="text-xs text-white/50">{row.detail}</span></span></label>)}</div>
          <p className="mt-3 text-xs text-white/50">{tr("Selected: {0}", { 0: count })}</p>
          <label className="mt-4 block text-sm">{tr("Template name")}<input value={name} maxLength={80} onChange={event => setName(event.target.value)} className={field} placeholder={tr("e.g. My training week")} /></label>
          <div className="mt-3 grid gap-2 sm:grid-cols-2"><button disabled={action.busy || !count || !name.trim()} className={primary} onClick={() => void action.run(async () => { await saveTemplate({ name: name.trim(), plan: validatePlan(selection) }); setName(""); setSelected([]); setMode("saved"); toast.success(tr("Template saved to your account.")); })}>{action.busy ? tr("Saving…") : tr("Save plan")}</button><button disabled={!count || action.busy} onClick={download} className={button}>{tr("Download selected")}</button></div>
        </> : <p className="py-4 text-sm text-white/60">{tr("No plans yet. Import a file or preview a starter below.")}</p>}
        <p className="mt-3 text-xs leading-5 text-white/45">{tr("Plans include routines and exercises, without account details or progress.")}</p>
      </>}
    </>}
    {mode === "import" && <>
      <p className="text-sm leading-6 text-white/60">{tr("Choose a Ceventic plan file. You can review it before adding anything.")}</p>
      <label htmlFor={fileId} className={`${button} mt-4 flex cursor-pointer items-center justify-center gap-2 focus-within:outline focus-within:outline-2 focus-within:outline-white/50`}><Icon name="upload" className="h-4 w-4" />{tr("Choose plan file")}<input id={fileId} aria-label={tr("Choose plan file")} type="file" accept=".json,application/json" disabled={action.busy} className="sr-only" onChange={event => {
        const file = event.target.files?.[0]; event.target.value = "";
        if (!file) return;
        setPreview(null);
        if (file.size > 500000) { action.setError(tr("This file is too large. Maximum: 500 KB.")); return; }
        void action.run(async () => openPreview(JSON.parse(await file.text()), file.name));
      }} /></label>
      <p className="mt-2 text-xs text-white/45">{tr("Ceventic JSON file · up to 500 KB")}</p>
      <details className="mt-5 border-t border-white/10 pt-3"><summary className="cursor-pointer py-2 text-sm text-white/65">{tr("Try an example plan")}</summary><div className="mt-2 flex flex-wrap gap-2">{Object.entries(STARTERS).map(([key, item]) => <button key={key} disabled={action.busy} onClick={() => openPreview(localizeStarterPlan(item.plan), tr(item.name))} className={button}>{tr(item.name)}</button>)}</div></details>
    </>}
    {preview && <div className="mt-5 rounded-xl border border-[rgb(var(--sw-accent-rgb)/.35)] bg-black/40 p-4" aria-live="polite">
      <h3 className="break-words text-base font-semibold">{tr("Review:")} {preview.title}</h3><p className="mt-2 text-sm leading-6 text-white/60">{tr("Adds")} {preview.plan.routines.length} {tr("routine blocks and")} {preview.plan.workouts.length} {tr("workout days. Existing items and history are not replaced. Review the contents before adding.")}</p>
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{preview.plan.routines.map((routine, index) => <details key={`r${index}`} className="rounded-lg border border-white/10 p-3 text-sm"><summary className="cursor-pointer break-words">{routine.name} · {routine.timeSlot} · {routine.tasks.length} {tr("tasks")}</summary><ul className="mt-2 list-inside list-disc text-white/65">{routine.tasks.map((task, i) => <li key={i}>{task}</li>)}</ul></details>)}{preview.plan.workouts.map((day, index) => <details key={`w${index}`} className="rounded-lg border border-white/10 p-3 text-sm"><summary className="cursor-pointer">{day.name} · {day.exercises.length} {tr("exercises")}</summary><p className="mt-2 text-white/65">{day.warmupNotes}</p><ul className="space-y-2 text-white/65">{day.exercises.map((exercise, i) => <li key={i}>{exercise.name} · {exercise.sets} × {exercise.reps} · {exercise.muscles} {exercise.isWarmup ? tr("(warmup)") : ""}<span className="block text-xs">{exercise.notes}</span></li>)}</ul></details>)}</div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2"><button disabled={action.busy || !preview.plan.routines.length && !preview.plan.workouts.length} className={primary} onClick={() => void action.run(async () => { const added = await importPlan({ plan: preview.plan, requestId: preview.requestId }); setPreview(null); setSelected([]); toast.success(tr("Added {0} routines and {1} workout days.", { 0: added.routines, 1: added.workouts })); })}>{action.busy ? tr("Adding…") : tr("Add as new items")}</button><button disabled={action.busy} className={button} onClick={() => setPreview(null)}>{tr("Cancel")}</button></div>
    </div>}
    {errorText(action.error)}
  </section>;
}

function DeletedItems() {
  useLocale();
  const deleted = useQuery(api.recovery.listDeleted);
  const restore = useMutation(api.recovery.restore);
  const purge = useMutation(api.recovery.removePermanently);
  const [confirm, setConfirm] = useState<Id<"recycleBin"> | null>(null);
  const action = useSaveAction();
  return <section className={card} data-no-swipe>
    <h2 className="text-lg font-semibold">{tr("Recently deleted")}</h2><p className="mt-1 text-sm leading-6 text-white/55">{tr("Restore something you deleted, or remove it permanently.")}</p>
    {deleted === undefined ? <p role="status" className="mt-4 text-sm text-white/60">{tr("Loading deleted items…")}</p> : !deleted.length ? <div className="mt-4 rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-white/55">{tr("Nothing in recently deleted.")}</div> : <ul className="mt-4 space-y-2">{deleted.map(item => <li key={item._id} className="rounded-xl border border-white/10 p-3"><p className="break-words text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-white/45">{new Date(item.deletedAt).toLocaleDateString(getIntlLocale())}</p><div className="mt-3 flex flex-wrap gap-2"><button disabled={action.busy} onClick={() => void action.run(async () => { await restore({ id: item._id }); toast.success(tr("Restored.")); })} className={button}>{tr("Restore")}</button><button disabled={action.busy} onClick={() => setConfirm(item._id)} className={button}>{tr("Remove forever")}</button></div>{confirm === item._id && <div className="mt-3 rounded-xl border border-red-400/20 p-3 text-sm"><p>{tr("This cannot be undone. Any separately deleted children need their parent to be restorable.")}</p><div className="mt-3 flex flex-wrap gap-2"><button disabled={action.busy} className={button} onClick={() => void action.run(async () => { await purge({ id: item._id, confirm: "DELETE" }); setConfirm(null); toast.success(tr("Permanently removed.")); })}>{tr("Confirm permanent removal")}</button><button className={button} onClick={() => setConfirm(null)}>{tr("Cancel")}</button></div></div>}</li>)}</ul>}
    <details className="mt-4 border-t border-white/10 pt-3 text-xs leading-6 text-white/50"><summary className="cursor-pointer py-1">{tr("How restore works")}</summary><p className="mt-2">{tr("Restore routines, tasks, habits, workout days and exercises deleted after this update. Up to 100 items are kept until you restore or permanently remove them. Restore a parent routine or day before its individual items. Restored routine checkmarks start unchecked; saved history stays intact.")}</p></details>
    {errorText(action.error)}
  </section>;
}

const areas: { id: "customize" | "routines" | "plans" | "deleted"; label: string; icon: IconName }[] = [
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
  const [hidden, setHidden] = useState<Page[]>([]);
  const [start, setStart] = useState<Page>("today");
  const [quiet, setQuiet] = useState(false);
  const action = useSaveAction();
  useEffect(() => { if (prefs) { setHidden(prefs.hiddenPages); setStart(prefs.startPage); setQuiet(prefs.quiet); } }, [prefs]);
  if (!prefs) return <p role="status" className="p-10 text-center text-white/60">{tr("Loading your workspace…")}</p>;
  const dirty = start !== prefs.startPage || quiet !== prefs.quiet || [...hidden].sort().join() !== [...prefs.hiddenPages].sort().join();
  return <div className="mx-auto max-w-3xl space-y-4" data-no-swipe>
    <header className="py-1">
      {onBack && <button onClick={onBack} className="mb-1 inline-flex min-h-11 items-center gap-2 text-sm text-white/55 hover:text-white"><Icon name="chevronLeft" className="h-4 w-4" />{tr("Back to Today")}</button>}
      <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--sw-accent-rgb))] sm:text-3xl">{tr("My workspace")}</h1>
      <p className="mt-1 text-sm text-white/55">{tr("Make Ceventic yours.")}</p>
    </header>
    <div ref={tabs} role="tablist" aria-label={tr("Workspace sections")} className="grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1" onKeyDown={event => {
      const index = areas.findIndex(item => item.id === area);
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % areas.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + areas.length) % areas.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = areas.length - 1;
      else return;
      event.preventDefault(); setArea(areas[next].id);
      tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }}>
      {areas.map(item => <button key={item.id} id={`${tabId}-${item.id}`} role="tab" aria-selected={area === item.id} aria-controls={`${tabId}-panel`} tabIndex={area === item.id ? 0 : -1} onClick={() => setArea(item.id)} className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2 text-[11px] font-medium transition sm:text-sm ${area === item.id ? "bg-white/10 text-white" : "text-white/45 hover:bg-white/5 hover:text-white/80"}`}><Icon name={item.icon} className="h-4 w-4 shrink-0" /><span className="max-w-full break-words text-center leading-4">{tr(item.label)}</span></button>)}
    </div>
    <div id={`${tabId}-panel`} role="tabpanel" aria-labelledby={`${tabId}-${area}`} tabIndex={0} className="outline-none">
      {area === "customize" && <section className={card}>
        <h2 className="text-lg font-semibold">{tr("Show in navigation")}</h2><p className="mt-1 text-sm leading-6 text-white/55">{tr("Choose the sections you use. Hidden sections keep their data.")}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{PAGES.filter(page => page.id !== "today").map(page => {
          const visible = !hidden.includes(page.id);
          return <button key={page.id} role="switch" aria-checked={visible} disabled={action.busy} aria-label={tr(page.name)} onClick={() => { setHidden(previous => visible ? [...previous, page.id] : previous.filter(id => id !== page.id)); if (visible && start === page.id) setStart("today"); }} className={`flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition disabled:opacity-40 ${visible ? "border-white/20 bg-white/[.06] text-white/90" : "border-white/10 text-white/40"}`}><span className="min-w-0 break-words text-start">{tr(page.name)}</span><span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${visible ? "border-transparent bg-[rgb(var(--sw-accent-rgb))] text-black" : "border-white/20"}`}>{visible && <Icon name="check" className="h-3 w-3" />}</span></button>;
        })}</div>
        <div className="mt-5 border-t border-white/10 pt-4"><p className="mb-2 text-sm font-medium text-white/80">{tr("Start page")}</p><ChoiceSelect label={tr("Start page")} value={start} disabled={action.busy} className="w-full" onChange={setStart} options={PAGES.filter(page => !hidden.includes(page.id)).map(page => ({value: page.id, label: tr(page.name)}))} /></div>
        <button role="switch" aria-checked={quiet} aria-label={tr("Quiet mode")} disabled={action.busy} onClick={() => setQuiet(value => !value)} className="mt-4 flex min-h-14 w-full items-center justify-between gap-4 rounded-xl py-2 text-start disabled:opacity-40"><span><span className="block text-sm font-medium">{tr("Quiet mode")}</span><span className="mt-1 block text-xs text-white/50">{tr("Less animation. No reward sounds.")}</span></span><span aria-hidden="true" className={`flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition ${quiet ? "justify-end bg-[rgb(var(--sw-accent-rgb))]" : "justify-start bg-white/20"}`}><span className="h-5 w-5 rounded-full bg-white shadow" /></span></button>
        <button disabled={action.busy || !dirty} className={`${primary} mt-4 w-full`} onClick={() => void action.run(async () => { await save({ hiddenPages: hidden, startPage: start, quiet }); toast.success(tr("Workspace preferences saved across your account.")); })}>{action.busy ? tr("Saving…") : dirty ? tr("Save changes") : tr("Saved")}</button>
        {errorText(action.error)}
      </section>}
      {area === "routines" && <TemplateGallery dateKey={dateKey} onDone={() => toast.success(tr("Added to Today."))} />}
      {area === "plans" && <PlanLibrary />}
      {area === "deleted" && <DeletedItems />}
    </div>
  </div>;
}
