import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { aggregateProgress, compareResults, compareCompletedWeeks, meanRecorded, type ProgressMetric } from "../../convex/progressMath";
import { PageHeader } from "./PageHeader";
import { Icon } from "./icons";
import { useLocalDateKey } from "../hooks/useLocalDateKey";
import { resultLabel } from "./ExerciseResultLog";

const labels = { routines: "Routines", workouts: "Workouts", habits: "Habits" };
const ranges = { daily: "7 days", weekly: "28 days", monthly: "6 months" };
type Range = keyof typeof ranges;
const pct = (value: number | null) => value === null ? "—" : Math.round(value) + "%";
const shortDate = (key: string) => new Date(key + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
const card = "rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6";

export function ProgressPage() {
  const dateKey = useLocalDateKey();
  const [range, setRange] = useState<Range>("weekly");
  const [metric, setMetric] = useState<ProgressMetric>("routines");
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [milestoneView, setMilestoneView] = useState<"next" | "earned" | "all">("next");
  const month = useQuery(api.progress.getProgressData, { timeFrame: "weekly", dateKey });
  const other = useQuery(api.progress.getProgressData, range === "weekly" ? "skip" : { timeFrame: range, dateKey });
  const userStats = useQuery(api.routines.getUserStats);
  const workoutStats = useQuery(api.workouts.getWorkoutStats);
  const results = useQuery(api.workouts.getExerciseResults, { dateKey });
  const data = range === "weekly" ? month : other;

  if (!data || !month || userStats === undefined || workoutStats === undefined || !results) {
    return <p className="p-10 text-center text-white/60" role="status">Gathering your progress…</p>;
  }

  const lastWeek = month.slice(-7);
  const priorWeek = month.slice(-14, -7);
  const activeDays = lastWeek.filter(day => day.tasksDone + day.habitsDone + day.exercisesDone > 0).length;
  const priorActiveDays = priorWeek.filter(day => day.tasksDone + day.habitsDone + day.exercisesDone > 0).length;
  const totalTasks = lastWeek.reduce((sum, day) => sum + day.tasksDone, 0);
  const totalHabits = lastWeek.reduce((sum, day) => sum + day.habitsDone, 0);
  const totalWorkouts = lastWeek.reduce((sum, day) => sum + day.workoutsCompleted, 0);
  const points = aggregateProgress(data, metric, range === "daily" ? "day" : range === "weekly" ? "week" : "month");
  const average = meanRecorded(data.map(day => day[metric]));
  const logged = data.filter(day => day[metric] !== null).length;
  const selectedPoint = points.find(point => point.key === selected);
  const milestones = [
    { id: "day1", name: "First strong day", current: userStats?.totalDaysCompleted ?? 0, target: 1, unit: "routine days at 80%+" },
    { id: "day7", name: "A week of effort", current: userStats?.totalDaysCompleted ?? 0, target: 7, unit: "routine days at 80%+" },
    { id: "day30", name: "Built over time", current: userStats?.totalDaysCompleted ?? 0, target: 30, unit: "routine days at 80%+" },
    { id: "day100", name: "One hundred days", current: userStats?.totalDaysCompleted ?? 0, target: 100, unit: "routine days at 80%+" },
    { id: "workout1", name: "First session", current: workoutStats?.totalWorkouts ?? 0, target: 1, unit: "saved workouts" },
    { id: "workout10", name: "Showing up", current: workoutStats?.totalWorkouts ?? 0, target: 10, unit: "saved workouts" },
    { id: "workout25", name: "Training is a habit", current: workoutStats?.totalWorkouts ?? 0, target: 25, unit: "saved workouts" },
    { id: "workout100", name: "A hundred sessions", current: workoutStats?.totalWorkouts ?? 0, target: 100, unit: "saved workouts" },
    { id: "streak3", name: "Three in a row", current: userStats?.longestStreak ?? 0, target: 3, unit: "best routine streak days" },
    { id: "streak7", name: "A week in rhythm", current: userStats?.longestStreak ?? 0, target: 7, unit: "best routine streak days" },
    { id: "streak14", name: "Two weeks strong", current: userStats?.longestStreak ?? 0, target: 14, unit: "best routine streak days" },
    { id: "streak30", name: "A month in rhythm", current: userStats?.longestStreak ?? 0, target: 30, unit: "best routine streak days" },
  ];
  const earned = milestones.filter(item => item.current >= item.target);
  const upcoming = milestones.filter(item => item.current < item.target).sort((a, b) => b.current / b.target - a.current / a.target);
  const visible = milestoneView === "all" ? milestones : milestoneView === "earned" ? earned : upcoming.slice(0, 3);
  const next = upcoming[0];
  const recentResults = results.filter((result, index) => results.findIndex(item => item.dayId === result.dayId && item.exerciseId === result.exerciseId) === index).slice(0, 6);
  const recordedDays = [...data].reverse().filter(day => day.routines !== null || day.workouts !== null || day.habits !== null);
  const pill = (active: boolean) => "rounded-xl border px-3 py-2 text-sm font-semibold transition " + (active ? "border-[rgb(var(--sw-accent-rgb)/.4)] bg-[rgb(var(--sw-accent-rgb)/.1)] text-[rgb(var(--sw-accent-rgb))]" : "border-white/10 text-white/60 hover:bg-white/5 hover:text-white");

  return <div className="mx-auto max-w-6xl space-y-5 animate-fade-in">
    <PageHeader title="Progress" subtitle="Proof of the work. Not just a score." />
    <section className={card + " sw-holo relative overflow-hidden"}>
      <div className="grid items-center gap-6 md:grid-cols-[1.25fr_1fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--sw-accent-rgb))]">Your last seven days</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{activeDays ? "Look at what you put in." : "Your next step starts the story."}</h2>
          <p className="mt-3 text-sm leading-6 text-white/60">{activeDays ? `You recorded completions on ${activeDays} of 7 days. The previous seven days had ${priorActiveDays} active days.` : "Complete a task, practice a habit, or finish an exercise. Your effort will start appearing here."}</p>
          <p className="mt-2 text-xs text-white/50">No-activity days stay visible. Rest days aren't graded as failed workouts.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[[totalTasks, "Tasks done"], [totalHabits, "Habit check-ins"], [totalWorkouts, "Workouts saved"]].map(([count, label]) => <div key={label} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-5 text-center"><div className="text-3xl font-black text-white sm:text-4xl">{count}</div><div className="mt-2 text-xs text-white/60">{label}</div></div>)}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-7 gap-2">{lastWeek.map(day => {
        const active = day.tasksDone + day.exercisesDone + day.habitsDone > 0;
        return <div key={day.date} title={`${day.date}: ${day.tasksDone} tasks, ${day.exercisesDone} exercises, ${day.habitsDone} habits`} className={"rounded-xl border py-3 text-center " + (active ? "border-[rgb(var(--sw-accent-rgb)/.3)] bg-[rgb(var(--sw-accent-rgb)/.1)]" : "border-white/10 bg-white/[.02]")}>
          <div className="text-[11px] text-white/60">{new Date(day.date + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })}</div>
          <div className="mt-2 text-lg text-[rgb(var(--sw-accent-rgb))]">{active ? "✓" : "—"}</div>
          <span className="sr-only">{active ? "Completions recorded" : "No completions recorded"}</span>
        </div>;
      })}</div>
    </section>

    <section className={card}>
      <h2 className="text-xl font-bold">Week against week</h2>
      <p className="mt-2 text-sm text-white/65">Two full seven-day windows ending yesterday. Today's unfinished checklist is excluded.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{(["routines", "habits"] as const).map(category => {
        const comparison = compareCompletedWeeks(month, category);
        return <article key={category} className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
          <h3 className="font-bold">{labels[category]}</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">{[["Previous", comparison.previous], ["Latest", comparison.current]].map(([label, summary]) => {
            const week = summary as typeof comparison.current;
            return <div key={String(label)}><p className="text-sm text-white/65">{String(label)}</p><p className="mt-1 text-2xl font-black">{week.completions}</p><p className="text-xs text-white/55">{category === "routines" ? "tasks completed" : "habit check-ins"}</p><p className="mt-2 text-sm">{pct(week.average)} average</p><p className="mt-1 text-xs text-white/55">{week.recordedDays}/7 days recorded<br />{week.start && shortDate(week.start)} – {week.end && shortDate(week.end)}</p></div>;
          })}</div>
          <p className="mt-4 text-sm text-[rgb(var(--sw-accent-rgb))]">{comparison.delta === null ? "Record activity in both weeks to compare completion rates." : `${comparison.delta > 0 ? "+" : ""}${Math.round(comparison.delta)} percentage points in recorded-day completion.`}</p>
          <p className="mt-2 text-xs leading-5 text-white/55">Counts include recorded completions only. Average percentages exclude unrecorded days; compare the coverage above too.{category === "habits" ? " Habit history reflects currently active habits." : ""}</p>
        </article>;
      })}</div>
    </section>

    <section className={card}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h2 className="text-xl font-bold">Completion over time</h2><p className="mt-1 text-sm text-white/60">Explore one area at a time.</p></div>
        <div className="flex flex-wrap gap-2">{(Object.keys(ranges) as Range[]).map(key => <button key={key} aria-pressed={range === key} onClick={() => { setRange(key); setSelected(null); setShowAll(false); }} className={pill(range === key)}>{ranges[key]}</button>)}</div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">{(Object.keys(labels) as ProgressMetric[]).map(key => <button key={key} aria-pressed={metric === key} onClick={() => { setMetric(key); setSelected(null); }} className={pill(metric === key)}>{labels[key]}</button>)}</div>
      <div className="mt-6 flex items-end justify-between gap-4"><div><span className="text-4xl font-black">{pct(average)}</span><span className="ml-3 text-sm text-white/60">average on recorded days</span></div><span className="text-right text-xs text-white/50">{logged} of {data.length} days have records</span></div>
      <div className="mt-6 flex h-52 items-end gap-2 border-b border-white/10 pb-1" aria-label={labels[metric] + " completion chart"}>
        {points.map(point => <button key={point.key} aria-pressed={selected === point.key} aria-label={`${shortDate(point.key)}: ${pct(point.value)}, ${point.recorded} recorded days of ${point.days}`} onClick={() => setSelected(point.key)} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2 rounded-t-lg px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgb(var(--sw-accent-rgb))]">
          <span className="text-xs font-semibold text-white/70">{pct(point.value)}</span>
          <span className={"block w-full max-w-20 rounded-t-lg border transition-all " + (point.value === null ? "border-dashed border-white/20 bg-transparent" : "border-[rgb(var(--sw-accent-rgb)/.4)] bg-[rgb(var(--sw-accent-rgb)/.3)] group-hover:bg-[rgb(var(--sw-accent-rgb)/.55)]")} style={{ height: point.value === null ? 8 : Math.max(4, point.value * 1.35) }} />
          <span className="pb-1 text-[10px] text-white/60 sm:text-xs">{range === "monthly" ? new Date(point.key + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", timeZone: "UTC" }) : shortDate(point.key)}</span>
        </button>)}
      </div>
      <p className="mt-3 text-xs leading-5 text-white/60" aria-live="polite">{selectedPoint ? `${shortDate(selectedPoint.key)}: ${pct(selectedPoint.value)} · ${selectedPoint.recorded} recorded days out of ${selectedPoint.days} in this bucket.` : "Select a bar for details. — means no record, not 0%. Week and month bars average their recorded days."}</p>
      <details className="mt-4 rounded-xl border border-white/10 p-3 text-xs leading-6 text-white/60"><summary className="cursor-pointer font-semibold text-white/80">How these numbers work</summary><p className="mt-2">Routines use completed tasks divided by total tasks in saved daily snapshots (or today's live checklist until saved). Workouts use checked exercises divided by exercises in that day's logged sessions. No workout record means no assumption about whether training was planned. Habits include all currently active habits that existed on that date, including unmarked ones; deleting or deactivating a habit changes this view of its history. A day with no habit entries is shown as unrecorded. The overall average weights each recorded day equally, not each chart bar. No combined “life score” is calculated.</p></details>
    </section>

    <section className={card}>
      <div className="flex items-center gap-3"><Icon name="workout" className="h-6 w-6 text-[rgb(var(--sw-accent-rgb))]" /><div><h2 className="text-xl font-bold">Beyond the checkmark</h2><p className="mt-1 text-sm text-white/60">Your latest best sets and honest, like-for-like comparisons.</p></div></div>
      {recentResults.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{recentResults.map(result => {
        const previous = results.find(item => item.dayId === result.dayId && item.exerciseId === result.exerciseId && item.date < result.date);
        const comparison = previous ? compareResults(result, previous) : null;
        return <article key={String(result.dayId) + result.exerciseId} className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
          <p className="text-xs text-white/50">{result.dayName} · {shortDate(result.date)}</p><h3 className="mt-2 break-words font-bold">{result.name}</h3>
          <p className="mt-4 text-xl font-black text-[rgb(var(--sw-accent-rgb))]">{resultLabel(result)}</p>
          <p className="mt-2 text-xs leading-5 text-white/60">{comparison ?? (previous ? "Different reps or load—compare the sets below." : "Baseline saved. Your next session gives you a comparison.")}</p>
          {previous && <p className="mt-2 text-xs text-white/50">Previous: {resultLabel(previous)} · {shortDate(previous.date)}</p>}
        </article>;
      })}</div> : <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-6"><h3 className="font-bold">Start with a baseline.</h3><p className="mt-2 text-sm leading-6 text-white/60">On the Workout page, choose “Log your best set” beneath an exercise. Record actual reps, load, or hold seconds. Next time, you'll see what changed.</p><p className="mt-3 text-xs text-white/50">Example only: 3-second hold → 5-second hold. Your personal results appear here after you log them.</p></div>}
      <p className="mt-4 text-xs text-white/50">Shows up to 6 exercises from the latest 120 workout records within 90 days. Same variation and load convention are needed for meaningful comparisons.</p>
    </section>

    <section className={card}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-xl font-bold">Milestones that stay with you</h2><p className="mt-1 text-sm text-white/60">{earned.length} earned · Lifetime totals and personal-best routine streaks, independent of the chart range.</p></div><div className="flex gap-2">{(["next", "earned", "all"] as const).map(view => <button key={view} aria-pressed={milestoneView === view} onClick={() => setMilestoneView(view)} className={pill(milestoneView === view)}>{view === "next" ? "In reach" : view === "earned" ? "Earned" : "All"}</button>)}</div></div>
      {next && milestoneView === "next" && <p className="mt-4 text-sm text-[rgb(var(--sw-accent-rgb))]">Next up: {next.name} · {next.target - next.current} {next.unit} to go.</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map(item => <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
        <div className="flex items-start justify-between gap-2"><h3 className="font-bold">{item.name}</h3><Icon name={item.current >= item.target ? "trophy" : "sparkles"} className="h-5 w-5 shrink-0 text-[rgb(var(--sw-accent-rgb))]" /></div>
        <p className="mt-2 text-xs text-white/60">{item.target} {item.unit}</p><div className="mt-4 flex justify-between text-xs"><span>{Math.min(item.current, item.target)} / {item.target}</span><span className="text-[rgb(var(--sw-accent-rgb))]">{item.current >= item.target ? "Earned" : "In progress"}</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[rgb(var(--sw-accent-rgb))]" style={{ width: Math.min(100, item.current / item.target * 100) + "%" }} /></div>
      </article>)}</div>
      {!visible.length && <p className="mt-4 text-sm text-white/60">{milestoneView === "earned" ? "Your first milestone is still ahead. One completed session or strong routine day gets you started." : "You've reached every milestone in this set."}</p>}
    </section>

    <section className={card}>
      <h2 className="text-xl font-bold">Your recorded days</h2><p className="mt-1 text-sm text-white/60">The numbers behind the charts. Missing dates remain visible in the chart above.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Recorded completion percentages by date</caption><thead><tr className="border-b border-white/10 text-white/60"><th scope="col" className="py-3 pr-4">Date</th>{Object.values(labels).map(label => <th key={label} scope="col" className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{recordedDays.slice(0, showAll ? undefined : 7).map(day => <tr key={day.date} className="border-b border-white/5"><th scope="row" className="whitespace-nowrap py-3 pr-4 font-normal text-white/70">{day.date}</th><td className="px-3">{pct(day.routines)}</td><td className="px-3">{pct(day.workouts)}</td><td className="px-3">{pct(day.habits)}</td></tr>)}</tbody></table></div>
      {!recordedDays.length && <p className="py-5 text-sm text-white/60">No records in this range yet.</p>}
      {recordedDays.length > 7 && <button onClick={() => setShowAll(!showAll)} className="mt-4 text-sm font-semibold text-[rgb(var(--sw-accent-rgb))]">{showAll ? "Show fewer days" : `Show all ${recordedDays.length} recorded days`}</button>}
    </section>
  </div>;
}
