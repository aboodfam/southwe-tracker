import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLocalDateKey } from "../hooks/useLocalDateKey";
import { PageHeader } from "./PageHeader";
import { Icon } from "./icons";
import { toast } from "sonner";

type Destination = "routines" | "habits" | "workout" | "progress";

export function TodayPage({ onNavigate, displayName }: {
  onNavigate: (page: Destination) => void;
  displayName: string;
}) {
  const dateKey = useLocalDateKey();
  const routines = useQuery(api.routines.getRoutines);
  const habits = useQuery(api.habits.getHabits);
  const days = useQuery(api.workouts.getWorkoutDays);
  const activity = useQuery(api.progress.getProgressData, { timeFrame: "daily", dateKey });
  const routineDay = useQuery(api.routines.getTodayProgress, { dateKey });
  const toggleTask = useMutation(api.routines.toggleTask);
  const logHabit = useMutation(api.habits.logHabit);
  const completeDay = useMutation(api.routines.completeDay);
  const ensureStats = useMutation(api.routines.ensureUserStats);
  const lock = useRef(false);
  const [pending, setPending] = useState<string | null>(null);

  if (!routines || !habits || !days || !activity || routineDay === undefined) {
    return <p className="p-10 text-center text-white/60" role="status">Getting your day ready…</p>;
  }

  const tasks = routines.flatMap(routine => [...routine.tasks].sort((a, b) => a.order - b.order)
    .map(task => ({ ...task, routineId: routine._id, routineName: routine.name })));
  const activeHabits = habits.filter(habit => habit.isActive !== false);
  const remaining = tasks.filter(task => !task.completed);
  const completedTasks = tasks.length - remaining.length;
  const doneHabits = activeHabits.filter(habit => habit.entries.some(entry => entry.date === dateKey && entry.completed)).length;
  const total = tasks.length + activeHabits.length;
  const done = completedTasks + doneHabits;
  const percentage = total ? Math.round(done / total * 100) : 0;
  const today = activity.find(day => day.date === dateKey);
  const configured = total > 0 || days.some(day => day.exercises.length > 0);
  const run = async (id: string, action: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setPending(id);
    try { await action(); }
    catch { toast.error("That change wasn't saved. Please try again."); }
    finally { lock.current = false; setPending(null); }
  };
  const button = "rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50";

  return <div className="mx-auto max-w-6xl space-y-5 animate-fade-in">
    <PageHeader title="Today" subtitle={new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} />
    <section className="sw-holo relative overflow-hidden rounded-3xl border border-white/10 bg-black/35 p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div className="max-w-xl">
          <p className="text-sm text-[rgb(var(--sw-accent-rgb))]">Your day, at your pace{displayName ? ` · ${displayName}` : ""}</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{!configured ? "Start with one small promise." : total > 0 && done === total ? "You showed up for yourself." : "One next step. Then another."}</h2>
          <p className="mt-3 text-sm leading-6 text-white/60">{!configured ? "Choose one area below. You can add the rest whenever you're ready." : total ? `${done} of ${total} routine tasks and habits done today. ${total - done ? "Pick your next small win below." : "Your daily checklist is complete. Training is tracked separately."}` : "Your workout is ready. Open it when you're ready to train."}</p>
        </div>
        {total > 0 && <div className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(rgb(var(--sw-accent-rgb)) ${percentage * 3.6}deg, rgba(255,255,255,.07) 0deg)` }}>
          <div className="grid h-28 w-28 place-content-center rounded-full bg-[#090b0c] text-center"><span className="text-3xl font-black">{percentage}%</span><span className="text-xs text-white/60">Daily checklist</span></div>
        </div>}
      </div>
      {total > 0 && <p className="mt-5 text-xs text-white/50">A new day is a fresh checklist, not a loss of your past progress.</p>}
    </section>

    {!configured && <section className="grid gap-3 sm:grid-cols-3" aria-label="Choose where to start">
      {([
        ["routines", "Build a routine", "Add one task you want to repeat."],
        ["workout", "Set up training", "Choose a split, then add your exercises."],
        ["habits", "Start a habit", "Choose one habit to build or break."],
      ] as const).map(([page, title, copy]) => <button key={page} onClick={() => onNavigate(page)} className={`${button} p-5 text-left`}><Icon name={page === "workout" ? "workout" : page} className="mb-4 h-6 w-6 text-[rgb(var(--sw-accent-rgb))]" /><span className="block text-base font-bold">{title}</span><span className="mt-2 block text-sm font-normal text-white/60">{copy}</span></button>)}
    </section>}

    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Next in your routines</h2><span className="text-sm text-white/60">{completedTasks}/{tasks.length}</span></div>
        {remaining.length ? <ul className="space-y-2">{remaining.slice(0, 5).map(task => <li key={`${task.routineId}-${task.id}`}>
          <button disabled={pending !== null || routineDay?.countedInStats === true} onClick={() => void run(task.id, () => toggleTask({ routineId: task.routineId, taskId: task.id, dateKey }))} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[.025] p-3 text-left transition hover:bg-white/5 disabled:opacity-50" aria-label={`Complete ${task.name}`}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/20 text-xs">{pending === task.id ? "…" : ""}</span><span className="min-w-0"><span className="block break-words text-sm font-semibold">{task.name}</span><span className="text-xs text-white/50">{task.routineName}</span></span>
          </button>
        </li>)}</ul> : <p className="py-5 text-sm text-white/60">{tasks.length ? "All routine tasks are done. Nice work." : "No tasks yet. Start with something manageable."}</p>}
        <button onClick={() => onNavigate("routines")} className={`${button} mt-4 w-full`}>{tasks.length ? "Open routines & completed tasks" : "Create a routine"}</button>
        {routineDay?.countedInStats ? <p className="mt-3 text-xs text-white/60">Routine day saved. Its checklist is locked until tomorrow.</p> : tasks.length > 0 && completedTasks / tasks.length >= 0.8 && <div className="mt-4">
          <p className="mb-2 text-xs text-white/60">Ready to finish? Saving counts this routine day toward milestones and locks today's routine checklist.</p>
          <button disabled={pending !== null} onClick={() => void run("save-day", async () => { await ensureStats({}); await completeDay({ dateKey }); toast.success("Routine day saved. Another day in your story."); })} className={`${button} w-full`}>{pending === "save-day" ? "Saving…" : "Save routine day"}</button>
        </div>}
      </section>

      <section className="rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Small habits, repeated</h2><span className="text-sm text-white/60">{doneHabits}/{activeHabits.length}</span></div>
        <ul className="space-y-2">{activeHabits.slice(0, 5).map(habit => {
          const checked = habit.entries.some(entry => entry.date === dateKey && entry.completed);
          return <li key={habit._id}><button aria-pressed={checked} disabled={pending !== null} onClick={() => void run(habit._id, () => logHabit({ habitId: habit._id, completed: !checked, dateKey }))} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[.025] p-3 text-left transition hover:bg-white/5 disabled:opacity-50">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${checked ? "border-[rgb(var(--sw-accent-rgb))] text-[rgb(var(--sw-accent-rgb))]" : "border-white/20"}`}>{pending === habit._id ? "…" : checked ? "✓" : ""}</span>
            <span className="min-w-0"><span className="block break-words text-sm font-semibold">{habit.name}</span><span className="text-xs text-white/50">{habit.type === "break" ? "Avoided today" : "Practiced today"}</span></span>
          </button></li>;
        })}</ul>
        {!activeHabits.length && <p className="py-5 text-sm text-white/60">One habit is enough to begin.</p>}
        <button onClick={() => onNavigate("habits")} className={`${button} mt-4 w-full`}>{activeHabits.length ? "Open all habits" : "Choose a habit"}</button>
      </section>
    </div>

    <section className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-black/30 p-5 sm:flex-row sm:items-center sm:p-6">
      <div><h2 className="text-lg font-bold">Training, on your terms</h2><p className="mt-2 text-sm text-white/60">{today?.workoutsCompleted ? `${today.workoutsCompleted} workout${today.workoutsCompleted === 1 ? "" : "s"} saved today.` : "Choose your workout when you train. A day without a workout log isn't automatically a missed workout."}</p></div>
      <button className={`${button} shrink-0`} onClick={() => onNavigate("workout")}>Open workout</button>
    </section>
    <button onClick={() => onNavigate("progress")} className={`${button} w-full`}>See how your work is adding up →</button>
  </div>;
}
