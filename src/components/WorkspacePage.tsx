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
const button = "min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50";
const field = "mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-base text-white";
const errorText = (error: string) => error && <p role="alert" className="mt-3 break-words text-sm text-red-300">{error}</p>;

export function GuidedSetup() {
  const prefs = useQuery(api.workspace.getPreferences);
  const dateKey = useLocalDateKey();
  if (!prefs || prefs.setupDone) return null;
  return <TemplateGallery dateKey={dateKey} onDone={() => toast.success("Open Today to begin your first action.")} />;
}
export function PlanLibrary() {
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
  if (!current || !templates) return <p role="status" className="text-white/60">Loading plan library…</p>;
  const selection: Plan = { version: 1, routines: current.routines.filter((_, index) => selected.includes(`r${index}`)), workouts: current.workouts.filter((_, index) => selected.includes(`w${index}`)) };
  const allKeys = [...current.routines.map((_, index) => `r${index}`), ...current.workouts.map((_, index) => `w${index}`)];
  const count = selection.routines.length + selection.workouts.length;
  const openPreview = (input: unknown, title: string) => { try { setPreview({ plan: validatePlan(input), requestId: crypto.randomUUID(), title }); action.setError(""); } catch (error) { action.setError(error instanceof Error ? error.message : "Invalid file."); } };
  const download = () => {
    try {
      const plan = validatePlan(selection);
      const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "ceventic-plan.json"; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Plan export prepared. It contains templates, not your personal progress history.");
    } catch (error) { action.setError(error instanceof Error ? error.message : "Could not export."); }
  };
  return <section className={card} data-no-swipe>
    <h2 className="text-xl font-bold">Plan library & transfers</h2><p className="mt-2 text-sm leading-6 text-white/65">Save reusable routines and workout days, or move them between accounts using a plan file. Checkmarks, account details and history are never included.</p>
    <div className="mt-4 flex gap-2"><button className={button} onClick={() => setSelected(allKeys)}>Select all</button><button className={button} onClick={() => setSelected([])}>Clear selection</button></div>
    <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">{[...current.routines.map((row, i) => ({ key: `r${i}`, title: row.name, detail: `${row.tasks.length} tasks · Routine` })), ...current.workouts.map((row, i) => ({ key: `w${i}`, title: row.name, detail: `${row.exercises.length} exercises · Workout` }))].map(row => <label key={row.key} className="flex items-center gap-3 rounded-xl border border-white/10 p-3"><input type="checkbox" className="h-5 w-5 shrink-0" checked={selected.includes(row.key)} onChange={event => setSelected(previous => event.target.checked ? [...previous, row.key] : previous.filter(key => key !== row.key))} /><span className="min-w-0 text-sm"><span className="block break-words">{row.title}</span><span className="text-xs text-white/55">{row.detail}</span></span></label>)}</div>
    {!allKeys.length && <p className="mt-3 text-sm text-white/60">No plans yet. Import a file or preview a starter below.</p>}
    <div className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm">Template name<input value={name} maxLength={80} onChange={event => setName(event.target.value)} className={field} placeholder="e.g. My training week" /></label><button disabled={action.busy || !count || !name.trim()} className={button} onClick={() => void action.run(async () => { await saveTemplate({ name, plan: validatePlan(selection) }); setName(""); toast.success("Template saved to your account."); })}>Save selected as template</button><button disabled={!count || action.busy} onClick={download} className={button}>Export selected</button></div>
    <label className="mt-6 block text-sm font-semibold">Import a Ceventic plan (.json, up to 500 KB)<input type="file" accept=".json,application/json" disabled={action.busy} className="mt-2 block w-full text-sm text-white/70 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-3 file:text-white" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = "";
      if (!file) return;
      if (file.size > 500000) { action.setError("This file is too large. Maximum: 500 KB."); return; }
      void action.run(async () => { const text = await file.text(); openPreview(JSON.parse(text), file.name); });
    }} /></label>
    <div className="mt-5 flex flex-wrap gap-2">{Object.entries(STARTERS).map(([key, item]) => <button key={key} disabled={action.busy} onClick={() => openPreview(item.plan, item.name)} className={button}>Preview {item.name}</button>)}</div>
    <h3 className="mt-6 font-bold">Saved templates ({templates.length}/30)</h3>
    <div className="mt-3 space-y-2">{templates.map(template => <div key={template._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><span className="min-w-0 break-words text-sm">{template.name}<span className="block text-xs text-white/55">{template.plan.routines.length} routines · {template.plan.workouts.length} workout days</span></span><div className="flex gap-2"><button disabled={action.busy} onClick={() => openPreview(template.plan, template.name)} className={button}>Preview & add</button><button disabled={action.busy} onClick={() => setRemoveId(template._id)} className={button}>Remove</button></div>{removeId === template._id && <div className="w-full rounded-xl border border-red-400/20 p-3 text-sm text-white/70">Remove this saved template permanently? Your active routines and workouts stay unchanged.<div className="mt-3 flex gap-2"><button disabled={action.busy} className={button} onClick={() => void action.run(async () => { await removeTemplate({ id: template._id }); setRemoveId(null); toast.success("Saved template removed."); })}>Remove template</button><button className={button} onClick={() => setRemoveId(null)}>Cancel</button></div></div>}</div>)}</div>
    {preview && <div className="mt-5 rounded-2xl border border-[rgb(var(--sw-accent-rgb)/.4)] bg-black/40 p-4">
      <h3 className="text-lg font-bold">Review: {preview.title}</h3><p className="mt-2 text-sm text-white/65">Adds {preview.plan.routines.length} routine blocks and {preview.plan.workouts.length} workout days. Existing items and history are not replaced. Review the contents before adding.</p>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{preview.plan.routines.map((routine, index) => <details key={`r${index}`} className="rounded-xl border border-white/10 p-3 text-sm"><summary className="cursor-pointer">{routine.name} · {routine.timeSlot} · {routine.tasks.length} tasks</summary><ul className="mt-2 list-inside list-disc text-white/65">{routine.tasks.map((task, i) => <li key={i}>{task}</li>)}</ul></details>)}{preview.plan.workouts.map((day, index) => <details key={`w${index}`} className="rounded-xl border border-white/10 p-3 text-sm"><summary className="cursor-pointer">{day.name} · {day.exercises.length} exercises</summary><p className="mt-2 text-white/65">{day.warmupNotes}</p><ul className="space-y-2 text-white/65">{day.exercises.map((exercise, i) => <li key={i}>{exercise.name} · {exercise.sets} × {exercise.reps} · {exercise.muscles} {exercise.isWarmup ? "(warmup)" : ""}<span className="block text-xs">{exercise.notes}</span></li>)}</ul></details>)}</div>
      <div className="mt-4 flex gap-2"><button disabled={action.busy || !preview.plan.routines.length && !preview.plan.workouts.length} className={button} onClick={() => void action.run(async () => { const added = await importPlan({ plan: preview.plan, requestId: preview.requestId }); setPreview(null); setSelected([]); toast.success(`Added ${added.routines} routines and ${added.workouts} workout days.`); })}>{action.busy ? "Adding…" : "Add as new items"}</button><button disabled={action.busy} className={button} onClick={() => setPreview(null)}>Cancel</button></div>
    </div>}
    {errorText(action.error)}
  </section>;
}

function DeletedItems() {
  const deleted = useQuery(api.recovery.listDeleted);
  const restore = useMutation(api.recovery.restore);
  const purge = useMutation(api.recovery.removePermanently);
  const [confirm, setConfirm] = useState<Id<"recycleBin"> | null>(null);
  const action = useSaveAction();
  return <section className={card}><h2 className="text-xl font-bold">Recently deleted</h2><p className="mt-2 text-sm leading-6 text-white/65">Restore routines, tasks, habits, workout days and exercises deleted after this update. Up to 100 items are kept until you restore or permanently remove them. Restore a parent routine or day before its individual items. Restored routine checkmarks start unchecked; saved history stays intact.</p>
    {deleted === undefined ? <p role="status" className="mt-4 text-white/60">Loading deleted items…</p> : !deleted.length ? <p className="mt-4 text-sm text-white/60">Nothing in recently deleted.</p> : <ul className="mt-4 space-y-2">{deleted.map(item => <li key={item._id} className="rounded-xl border border-white/10 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{item.title}</p><p className="text-xs text-white/55">{item.kind} · {new Date(item.deletedAt).toLocaleDateString()}</p></div><div className="flex gap-2"><button disabled={action.busy} onClick={() => void action.run(async () => { await restore({ id: item._id }); toast.success("Restored."); })} className={button}>Restore</button><button disabled={action.busy} onClick={() => setConfirm(item._id)} className={button}>Remove forever</button></div></div>{confirm === item._id && <div className="mt-3 rounded-xl border border-red-400/20 p-3 text-sm"><p>This cannot be undone. Any separately deleted children need their parent to be restorable.</p><div className="mt-3 flex gap-2"><button disabled={action.busy} className={button} onClick={() => void action.run(async () => { await purge({ id: item._id, confirm: "DELETE" }); setConfirm(null); toast.success("Permanently removed."); })}>Confirm permanent removal</button><button className={button} onClick={() => setConfirm(null)}>Cancel</button></div></div>}</li>)}</ul>}{errorText(action.error)}
  </section>;
}

export function WorkspacePage() {
  const prefs = useQuery(api.workspace.getPreferences);
  const save = useMutation(api.workspace.savePreferences);
  const [hidden, setHidden] = useState<Page[]>([]);
  const [start, setStart] = useState<Page>("today");
  const [quiet, setQuiet] = useState(false);
  const action = useSaveAction();
  useEffect(() => { if (prefs) { setHidden(prefs.hiddenPages); setStart(prefs.startPage); setQuiet(prefs.quiet); } }, [prefs]);
  if (!prefs) return <p role="status" className="p-10 text-center text-white/60">Loading your workspace…</p>;
  return <div className="mx-auto max-w-6xl space-y-5" data-no-swipe><PageHeader title="My workspace" subtitle="Keep what helps. Make the rest optional." />
    <section className={card}><h2 className="text-xl font-bold">Your sections</h2><p className="mt-2 text-sm text-white/65">Hiding a section removes it from navigation and Today, but never deletes its data. Today and this settings page remain available.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{PAGES.filter(page => page.id !== "today").map(page => <label key={page.id} className="flex items-center gap-3 rounded-xl border border-white/10 p-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={!hidden.includes(page.id)} onChange={event => { setHidden(previous => event.target.checked ? previous.filter(id => id !== page.id) : [...previous, page.id]); if (!event.target.checked && start === page.id) setStart("today"); }} />{page.name}</label>)}</div>
      <label className="mt-5 block text-sm">Open Ceventic on<select className={field} value={start} onChange={event => setStart(event.target.value as Page)}>{PAGES.filter(page => !hidden.includes(page.id)).map(page => <option key={page.id} value={page.id}>{page.name}</option>)}</select></label>
      <label className="mt-4 flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={quiet} onChange={event => setQuiet(event.target.checked)} />Quiet mode: reduce decorative motion and mute reward sounds</label>
      <button disabled={action.busy} className={`${button} mt-5`} onClick={() => void action.run(async () => { await save({ hiddenPages: hidden, startPage: start, quiet }); toast.success("Workspace preferences saved across your account."); })}>{action.busy ? "Saving…" : "Save preferences"}</button>{errorText(action.error)}
    </section><GuidedSetup /><PlanLibrary /><DeletedItems />
  </div>;
}
