import { t as tr, useLocale, getIntlLocale } from "../i18n";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PAGES, STARTERS, validatePlan, type Plan, type Page } from "../../convex/planFormat";
import { useSaveAction } from "../hooks/useSaveAction";
import { PageHeader } from "./PageHeader";
import { TemplateGallery } from "./TemplateGallery";
import { useLocalDateKey } from "../hooks/useLocalDateKey";
import { toast } from "sonner";

const card = "rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6";
function localizeStarterPlan(plan: Plan): Plan {
  return { ...plan, routines: plan.routines.map(routine => ({...routine, name: tr(routine.name), timeSlot: tr(routine.timeSlot), tasks: routine.tasks.map(task => tr(task))})), workouts: plan.workouts };
}

const button = "min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50";
const field = "mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-base text-white";
const errorText = (error: string) => error && <p role="alert" className="mt-3 break-words text-sm text-red-300">{error}</p>;

export function GuidedSetup() {
  useLocale();
  const prefs = useQuery(api.workspace.getPreferences);
  const dateKey = useLocalDateKey();
  if (!prefs || prefs.setupDone) return null;
  return <TemplateGallery dateKey={dateKey} onDone={() => toast.success(tr("Open Today to begin your first action."))} />;
}
export function PlanLibrary() {
  useLocale();
  const current = useQuery(api.workspace.getCurrentPlan);
  const templates = useQuery(api.workspace.listTemplates);
  const saveTemplate = useMutation(api.workspace.saveTemplate);
  const removeTemplate = useMutation(api.workspace.deleteTemplate);
  const importPlan = useMutation(api.workspace.importPlan);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<{ plan: Plan; requestId: string; title: string } | null>(null);
  const [removeId, setRemoveId] = useState<Id<"planTemplates"> | null>(null);
  const action = useSaveAction();
  // A reactive plan update can change array positions. Require a fresh selection.
  useEffect(() => { setSelected([]); }, [current]);
  if (!current || !templates) return <p role="status" className="text-white/60">{tr("Loading plan library…")}</p>;
  const selection: Plan = { version: 1, routines: current.routines.filter((_, index) => selected.includes(`r${index}`)), workouts: current.workouts.filter((_, index) => selected.includes(`w${index}`)) };
  const allKeys = [...current.routines.map((_, index) => `r${index}`), ...current.workouts.map((_, index) => `w${index}`)];
  const count = selection.routines.length + selection.workouts.length;
  const openPreview = (input: unknown, title: string) => { try { setPreview({ plan: validatePlan(input), requestId: crypto.randomUUID(), title }); action.setError(""); } catch (error) { action.setError(error instanceof Error ? error.message : tr("Invalid file.")); } };
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
    <h2 className="text-xl font-bold">{tr("Plan library & transfers")}</h2><p className="mt-2 text-sm leading-6 text-white/65">{tr("Save reusable routines and workout days, or move them between accounts using a plan file. Checkmarks, account details and history are never included.")}</p>
    <div className="mt-4 flex gap-2"><button className={button} onClick={() => setSelected(allKeys)}>{tr("Select all")}</button><button className={button} onClick={() => setSelected([])}>{tr("Clear selection")}</button></div>
    <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">{[...current.routines.map((row, i) => ({ key: `r${i}`, title: row.name, detail: tr("{0} tasks · Routine", {0: row.tasks.length}) })), ...current.workouts.map((row, i) => ({ key: `w${i}`, title: row.name, detail: tr("{0} exercises · Workout", {0: row.exercises.length}) }))].map(row => <label key={row.key} className="flex items-center gap-3 rounded-xl border border-white/10 p-3"><input type="checkbox" className="h-5 w-5 shrink-0" checked={selected.includes(row.key)} onChange={event => setSelected(previous => event.target.checked ? [...previous, row.key] : previous.filter(key => key !== row.key))} /><span className="min-w-0 text-sm"><span className="block break-words">{row.title}</span><span className="text-xs text-white/55">{row.detail}</span></span></label>)}</div>
    {!allKeys.length && <p className="mt-3 text-sm text-white/60">{tr("No plans yet. Import a file or preview a starter below.")}</p>}
    <div className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm">{tr("Template name")}<input value={name} maxLength={80} onChange={event => setName(event.target.value)} className={field} placeholder={tr("e.g. My training week")} /></label><button disabled={action.busy || !count || !name.trim()} className={button} onClick={() => void action.run(async () => { await saveTemplate({ name, plan: validatePlan(selection) }); setName(""); toast.success(tr("Template saved to your account.")); })}>{tr("Save selected as template")}</button><button disabled={!count || action.busy} onClick={download} className={button}>{tr("Export selected")}</button></div>
    <label className="mt-6 block text-sm font-semibold">{tr("Import a Ceventic plan (.json, up to 500 KB)")}<input type="file" accept=".json,application/json" disabled={action.busy} className="mt-2 block w-full text-sm text-white/70 file:me-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-3 file:text-white" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = "";
      if (!file) return;
      if (file.size > 500000) { action.setError(tr("This file is too large. Maximum: 500 KB.")); return; }
      void action.run(async () => { const text = await file.text(); openPreview(JSON.parse(text), file.name); });
    }} /></label>
    <div className="mt-5 flex flex-wrap gap-2">{Object.entries(STARTERS).map(([key, item]) => <button key={key} disabled={action.busy} onClick={() => openPreview(localizeStarterPlan(item.plan), tr(item.name))} className={button}>{tr("Preview")} {tr(item.name)}</button>)}</div>
    <h3 className="mt-6 font-bold">{tr("Saved templates (")}{templates.length}/30)</h3>
    <div className="mt-3 space-y-2">{templates.map(template => <div key={template._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><span className="min-w-0 break-words text-sm">{template.name}<span className="block text-xs text-white/55">{template.plan.routines.length} {tr("routines ·")} {template.plan.workouts.length} {tr("workout days")}</span></span><div className="flex gap-2"><button disabled={action.busy} onClick={() => openPreview(template.plan, template.name)} className={button}>{tr("Preview & add")}</button><button disabled={action.busy} onClick={() => setRemoveId(template._id)} className={button}>{tr("Remove")}</button></div>{removeId === template._id && <div className="w-full rounded-xl border border-red-400/20 p-3 text-sm text-white/70">{tr("Remove this saved template permanently? Your active routines and workouts stay unchanged.")}<div className="mt-3 flex gap-2"><button disabled={action.busy} className={button} onClick={() => void action.run(async () => { await removeTemplate({ id: template._id }); setRemoveId(null); toast.success(tr("Saved template removed.")); })}>{tr("Remove template")}</button><button className={button} onClick={() => setRemoveId(null)}>{tr("Cancel")}</button></div></div>}</div>)}</div>
    {preview && <div className="mt-5 rounded-2xl border border-[rgb(var(--sw-accent-rgb)/.4)] bg-black/40 p-4">
      <h3 className="text-lg font-bold">{tr("Review:")} {preview.title}</h3><p className="mt-2 text-sm text-white/65">{tr("Adds")} {preview.plan.routines.length} {tr("routine blocks and")} {preview.plan.workouts.length} {tr("workout days. Existing items and history are not replaced. Review the contents before adding.")}</p>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{preview.plan.routines.map((routine, index) => <details key={`r${index}`} className="rounded-xl border border-white/10 p-3 text-sm"><summary className="cursor-pointer">{routine.name} · {routine.timeSlot} · {routine.tasks.length} {tr("tasks")}</summary><ul className="mt-2 list-inside list-disc text-white/65">{routine.tasks.map((task, i) => <li key={i}>{task}</li>)}</ul></details>)}{preview.plan.workouts.map((day, index) => <details key={`w${index}`} className="rounded-xl border border-white/10 p-3 text-sm"><summary className="cursor-pointer">{day.name} · {day.exercises.length} {tr("exercises")}</summary><p className="mt-2 text-white/65">{day.warmupNotes}</p><ul className="space-y-2 text-white/65">{day.exercises.map((exercise, i) => <li key={i}>{exercise.name} · {exercise.sets} × {exercise.reps} · {exercise.muscles} {exercise.isWarmup ? tr("(warmup)") : ""}<span className="block text-xs">{exercise.notes}</span></li>)}</ul></details>)}</div>
      <div className="mt-4 flex gap-2"><button disabled={action.busy || !preview.plan.routines.length && !preview.plan.workouts.length} className={button} onClick={() => void action.run(async () => { const added = await importPlan({ plan: preview.plan, requestId: preview.requestId }); setPreview(null); setSelected([]); toast.success(tr("Added {0} routines and {1} workout days.", {0: added.routines, 1: added.workouts})); })}>{action.busy ? tr("Adding…") : tr("Add as new items")}</button><button disabled={action.busy} className={button} onClick={() => setPreview(null)}>{tr("Cancel")}</button></div>
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
  return <section className={card}><h2 className="text-xl font-bold">{tr("Recently deleted")}</h2><p className="mt-2 text-sm leading-6 text-white/65">{tr("Restore routines, tasks, habits, workout days and exercises deleted after this update. Up to 100 items are kept until you restore or permanently remove them. Restore a parent routine or day before its individual items. Restored routine checkmarks start unchecked; saved history stays intact.")}</p>
    {deleted === undefined ? <p role="status" className="mt-4 text-white/60">{tr("Loading deleted items…")}</p> : !deleted.length ? <p className="mt-4 text-sm text-white/60">{tr("Nothing in recently deleted.")}</p> : <ul className="mt-4 space-y-2">{deleted.map(item => <li key={item._id} className="rounded-xl border border-white/10 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{item.title}</p><p className="text-xs text-white/55">{item.kind} · {new Date(item.deletedAt).toLocaleDateString(getIntlLocale())}</p></div><div className="flex gap-2"><button disabled={action.busy} onClick={() => void action.run(async () => { await restore({ id: item._id }); toast.success(tr("Restored.")); })} className={button}>{tr("Restore")}</button><button disabled={action.busy} onClick={() => setConfirm(item._id)} className={button}>{tr("Remove forever")}</button></div></div>{confirm === item._id && <div className="mt-3 rounded-xl border border-red-400/20 p-3 text-sm"><p>{tr("This cannot be undone. Any separately deleted children need their parent to be restorable.")}</p><div className="mt-3 flex gap-2"><button disabled={action.busy} className={button} onClick={() => void action.run(async () => { await purge({ id: item._id, confirm: "DELETE" }); setConfirm(null); toast.success(tr("Permanently removed.")); })}>{tr("Confirm permanent removal")}</button><button className={button} onClick={() => setConfirm(null)}>{tr("Cancel")}</button></div></div>}</li>)}</ul>}{errorText(action.error)}
  </section>;
}

export function WorkspacePage() {
  useLocale();
  const dateKey = useLocalDateKey();
  const [showTemplates, setShowTemplates] = useState(false);
  const prefs = useQuery(api.workspace.getPreferences);
  const save = useMutation(api.workspace.savePreferences);
  const [hidden, setHidden] = useState<Page[]>([]);
  const [start, setStart] = useState<Page>("today");
  const [quiet, setQuiet] = useState(false);
  const action = useSaveAction();
  useEffect(() => { if (prefs) { setHidden(prefs.hiddenPages); setStart(prefs.startPage); setQuiet(prefs.quiet); } }, [prefs]);
  if (!prefs) return <p role="status" className="p-10 text-center text-white/60">{tr("Loading your workspace…")}</p>;
  return <div className="mx-auto max-w-6xl space-y-5" data-no-swipe><PageHeader title={tr("My workspace")} subtitle={tr("Keep what helps. Make the rest optional.")} />
    <section className={card}><h2 className="text-xl font-bold">{tr("Your sections")}</h2><p className="mt-2 text-sm text-white/65">{tr("Hiding a section removes it from navigation and Today, but never deletes its data. Today and this settings page remain available.")}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{PAGES.filter(page => page.id !== "today").map(page => <label key={page.id} className="flex items-center gap-3 rounded-xl border border-white/10 p-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={!hidden.includes(page.id)} onChange={event => { setHidden(previous => event.target.checked ? previous.filter(id => id !== page.id) : [...previous, page.id]); if (!event.target.checked && start === page.id) setStart("today"); }} />{tr(page.name)}</label>)}</div>
      <label className="mt-5 block text-sm">{tr("Open Ceventic on")}<select className={field} value={start} onChange={event => setStart(event.target.value as Page)}>{PAGES.filter(page => !hidden.includes(page.id)).map(page => <option key={page.id} value={page.id}>{tr(page.name)}</option>)}</select></label>
      <label className="mt-4 flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={quiet} onChange={event => setQuiet(event.target.checked)} />{tr("Quiet mode: reduce decorative motion and mute reward sounds")}</label>
      <button disabled={action.busy} className={`${button} mt-5`} onClick={() => void action.run(async () => { await save({ hiddenPages: hidden, startPage: start, quiet }); toast.success(tr("Workspace preferences saved across your account.")); })}>{action.busy ? tr("Saving…") : tr("Save preferences")}</button>{errorText(action.error)}
    </section><details className={card} onToggle={event => setShowTemplates(event.currentTarget.open)}><summary className="cursor-pointer font-semibold">{tr("Ready-made routines")}</summary>{showTemplates && <div className="mt-4"><TemplateGallery dateKey={dateKey} onDone={() => toast.success(tr("Added to Today."))} /></div>}</details><details className={card}><summary className="cursor-pointer font-semibold">{tr("Saved plans & imports")}</summary><div className="mt-4"><PlanLibrary /></div></details><DeletedItems />
  </div>;
}
