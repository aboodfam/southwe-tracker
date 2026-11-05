import { localizedComparison as compareResults } from "../i18n/results";
import { t as tr, useLocale, getIntlLocale } from "../i18n";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  aggregateProgress,
  compareCompletedWeeks,
  meanRecorded,
  type ProgressMetric,
} from "../../convex/progressMath";
import { WeeklyReview } from "./WeeklyReview";
import { Icon } from "./icons";
import { useLocalDateKey } from "../hooks/useLocalDateKey";
import { resultLabel } from "./ExerciseResultLog";

const labels = { routines: "Routines", workouts: "Workouts", habits: "Habits" };
const ranges = { daily: "7 days", weekly: "28 days", monthly: "6 months" };
type Range = keyof typeof ranges;
const pct = (value: number | null) =>
  value === null ? "—" : Math.round(value) + "%";
const shortDate = (key: string) =>
  new Date(key + "T00:00:00Z").toLocaleDateString(getIntlLocale(), {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const card = "rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5";
const views = {
  overview: "Overview",
  trends: "Trends",
  training: "Training",
  milestones: "Milestones",
} as const;

export function ProgressPage() {
  useLocale();
  const dateKey = useLocalDateKey();
  const [view, setView] = useState<keyof typeof views>("overview");
  const [range, setRange] = useState<Range>("daily");
  const [metric, setMetric] = useState<ProgressMetric>("routines");
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [milestoneView, setMilestoneView] = useState<"next" | "earned" | "all">(
    "next",
  );
  const month = useQuery(api.progress.getProgressData, {
    timeFrame: "weekly",
    dateKey,
  });
  const other = useQuery(
    api.progress.getProgressData,
    range === "weekly" ? "skip" : { timeFrame: range, dateKey },
  );
  const userStats = useQuery(api.routines.getUserStats);
  const workoutStats = useQuery(api.workouts.getWorkoutStats);
  const results = useQuery(
    api.workouts.getExerciseResults,
    view === "training" ? { dateKey } : "skip",
  );
  const data = range === "weekly" ? month : other;

  if (
    !data ||
    !month ||
    userStats === undefined ||
    workoutStats === undefined ||
    (view === "training" && results === undefined)
  ) {
    return (
      <p className="p-10 text-center text-white/60" role="status">
        {tr("Gathering your progress…")}
      </p>
    );
  }

  const lastWeek = month.slice(-7);
  const activeDays = lastWeek.filter(
    (day) => day.tasksDone + day.habitsDone + day.exercisesDone > 0,
  ).length;
  const totalTasks = lastWeek.reduce((sum, day) => sum + day.tasksDone, 0);
  const totalHabits = lastWeek.reduce((sum, day) => sum + day.habitsDone, 0);
  const totalWorkouts = lastWeek.reduce(
    (sum, day) => sum + day.workoutsCompleted,
    0,
  );
  const points = aggregateProgress(
    data,
    metric,
    range === "daily" ? "day" : range === "weekly" ? "week" : "month",
  );
  const average = meanRecorded(data.map((day) => day[metric]));
  const logged = data.filter((day) => day[metric] !== null).length;
  const selectedPoint = points.find((point) => point.key === selected);
  const selectedDay = month.find((day) => day.date === selected);
  const milestones = [
    {
      id: "day1",
      name: tr("First strong day"),
      current: userStats?.totalDaysCompleted ?? 0,
      target: 1,
      unit: tr("routine days at 80%+"),
    },
    {
      id: "day7",
      name: tr("A week of effort"),
      current: userStats?.totalDaysCompleted ?? 0,
      target: 7,
      unit: tr("routine days at 80%+"),
    },
    {
      id: "day30",
      name: tr("Built over time"),
      current: userStats?.totalDaysCompleted ?? 0,
      target: 30,
      unit: tr("routine days at 80%+"),
    },
    {
      id: "day100",
      name: tr("One hundred days"),
      current: userStats?.totalDaysCompleted ?? 0,
      target: 100,
      unit: tr("routine days at 80%+"),
    },
    {
      id: "workout1",
      name: tr("First session"),
      current: workoutStats?.totalWorkouts ?? 0,
      target: 1,
      unit: tr("saved workouts"),
    },
    {
      id: "workout10",
      name: tr("Showing up"),
      current: workoutStats?.totalWorkouts ?? 0,
      target: 10,
      unit: tr("saved workouts"),
    },
    {
      id: "workout25",
      name: tr("Training is a habit"),
      current: workoutStats?.totalWorkouts ?? 0,
      target: 25,
      unit: tr("saved workouts"),
    },
    {
      id: "workout100",
      name: tr("A hundred sessions"),
      current: workoutStats?.totalWorkouts ?? 0,
      target: 100,
      unit: tr("saved workouts"),
    },
    {
      id: "streak3",
      name: tr("Three in a row"),
      current: userStats?.longestStreak ?? 0,
      target: 3,
      unit: tr("best routine streak days"),
    },
    {
      id: "streak7",
      name: tr("A week in rhythm"),
      current: userStats?.longestStreak ?? 0,
      target: 7,
      unit: tr("best routine streak days"),
    },
    {
      id: "streak14",
      name: tr("Two weeks strong"),
      current: userStats?.longestStreak ?? 0,
      target: 14,
      unit: tr("best routine streak days"),
    },
    {
      id: "streak30",
      name: tr("A month in rhythm"),
      current: userStats?.longestStreak ?? 0,
      target: 30,
      unit: tr("best routine streak days"),
    },
  ];
  const earned = milestones.filter((item) => item.current >= item.target);
  const upcoming = milestones
    .filter((item) => item.current < item.target)
    .sort((a, b) => b.current / b.target - a.current / a.target);
  const visible =
    milestoneView === "all"
      ? milestones
      : milestoneView === "earned"
        ? earned
        : upcoming.slice(0, 3);
  const next = upcoming[0];
  const recentResults = (results ?? [])
    .filter(
      (result, index) =>
        (results ?? []).findIndex(
          (item) =>
            item.dayId === result.dayId &&
            item.exerciseId === result.exerciseId,
        ) === index,
    )
    .slice(0, 6);
  const recordedDays = [...data]
    .reverse()
    .filter(
      (day) =>
        day.routines !== null || day.workouts !== null || day.habits !== null,
    );
  const pill = (active: boolean) =>
    "rounded-xl border px-3 py-2 text-sm font-semibold transition " +
    (active
      ? "border-[rgb(var(--sw-accent-rgb)/.4)] bg-[rgb(var(--sw-accent-rgb)/.1)] text-[rgb(var(--sw-accent-rgb))]"
      : "border-white/10 text-white/60 hover:bg-white/5 hover:text-white");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--sw-accent-rgb))]">
          {tr("Progress")}
        </h1>
        <p className="mt-1 text-sm text-white/55">
          {tr("Your progress, day by day.")}
        </p>
      </header>
      <div
        role="group"
        aria-label={tr("Progress views")}
        className="grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1"
      >
        {(Object.keys(views) as (keyof typeof views)[]).map((key) => (
          <button
            key={key}
            aria-pressed={view === key}
            className={`min-h-11 min-w-0 break-words rounded-xl px-1 py-2 text-xs font-semibold sm:text-sm ${view === key ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}
            onClick={() => {
              setView(key);
              setSelected(null);
            }}
          >
            {tr(views[key])}
          </button>
        ))}
      </div>
      {view === "overview" && (
        <>
          <section className={card + " sw-holo relative overflow-hidden"}>
            <div className="grid items-center gap-4 md:grid-cols-[1.25fr_1fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--sw-accent-rgb))]">
                  {tr("Your last seven days")}
                </p>
                <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
                  {activeDays
                    ? tr("{0} days of effort.", { 0: activeDays })
                    : tr("Your progress starts here.")}
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  {activeDays
                    ? tr("Tap a day to see your progress.")
                    : tr(
                        "Check off a task, habit, or exercise to get started.",
                      )}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  [totalTasks, "Tasks done"],
                  [totalHabits, "Habit check-ins"],
                  [totalWorkouts, "Workouts saved"],
                ].map(([count, label]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-black/30 px-2 py-3 text-center"
                  >
                    <div className="text-2xl font-bold text-white sm:text-3xl">
                      {count}
                    </div>
                    <div className="mt-2 text-xs text-white/60">
                      {tr(String(label))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1">
              {lastWeek.map((day) => {
                const active =
                  day.tasksDone + day.exercisesDone + day.habitsDone > 0;
                return (
                  <button
                    type="button"
                    key={day.date}
                    aria-pressed={selected === day.date}
                    aria-label={tr("View {0} progress", {
                      0: shortDate(day.date),
                    })}
                    onClick={() => {
                      setRange("daily");
                      setSelected(day.date);
                      setShowAll(false);
                    }}
                    title={tr("{0}: {1} tasks, {2} exercises, {3} habits", {
                      0: day.date,
                      1: day.tasksDone,
                      2: day.exercisesDone,
                      3: day.habitsDone,
                    })}
                    className={
                      "rounded-xl border py-2 text-center " +
                      (selected === day.date
                        ? "border-[rgb(var(--sw-accent-rgb))] bg-[rgb(var(--sw-accent-rgb)/.2)]"
                        : active
                          ? "border-[rgb(var(--sw-accent-rgb)/.3)] bg-[rgb(var(--sw-accent-rgb)/.1)]"
                          : "border-white/10 bg-white/[.02]")
                    }
                  >
                    <div className="text-[11px] text-white/60">
                      {new Date(day.date + "T12:00:00Z").toLocaleDateString(
                        getIntlLocale(),
                        { weekday: "short", timeZone: "UTC" },
                      )}
                    </div>
                    <div className="mt-2 text-lg text-[rgb(var(--sw-accent-rgb))]">
                      {active ? "✓" : "—"}
                    </div>
                    <span className="sr-only">
                      {active
                        ? tr("Completions recorded")
                        : tr("No completions recorded")}
                    </span>
                  </button>
                );
              })}
            </div>
            {range === "daily" && selectedDay && (
              <div
                aria-live="polite"
                className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <p className="text-sm font-semibold">
                  {shortDate(selectedDay.date)}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(Object.keys(labels) as ProgressMetric[]).map((key) => (
                    <div key={key}>
                      <p className="text-xs text-white/60">{tr(labels[key])}</p>
                      <p className="mt-1 text-lg font-bold text-[rgb(var(--sw-accent-rgb))]">
                        {pct(selectedDay[key])}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <details
            className={card}
            onToggle={(event) => setReviewOpen(event.currentTarget.open)}
          >
            <summary className="cursor-pointer font-semibold">
              {tr("Weekly summary")}
            </summary>
            {reviewOpen && (
              <div className="mt-4">
                <WeeklyReview dateKey={dateKey} />
              </div>
            )}
          </details>
        </>
      )}
      {view === "trends" && (
        <>
          <section className={card}>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold">{tr("Daily progress")}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ranges) as Range[]).map((key) => (
                  <button
                    key={key}
                    aria-pressed={range === key}
                    onClick={() => {
                      setRange(key);
                      setSelected(null);
                      setShowAll(false);
                    }}
                    className={pill(range === key)}
                  >
                    {tr(ranges[key])}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {(Object.keys(labels) as ProgressMetric[]).map((key) => (
                <button
                  key={key}
                  aria-pressed={metric === key}
                  onClick={() => {
                    setMetric(key);
                    setSelected(null);
                  }}
                  className={pill(metric === key)}
                >
                  {tr(labels[key])}
                </button>
              ))}
            </div>
            {logged > 0 ? (
              <>
                <div className="mt-6 flex items-end justify-between gap-4">
                  <div>
                    <span className="text-4xl font-black">{pct(average)}</span>
                    <span className="ms-3 text-sm text-white/60">
                      {tr("average on recorded days")}
                    </span>
                  </div>
                  <span className="text-end text-xs text-white/50">
                    {logged} {tr("of")} {data.length} {tr("days have records")}
                  </span>
                </div>
                <div
                  className="mt-5 flex h-40 items-end gap-2 border-b border-white/10 pb-1"
                  aria-label={tr(labels[metric]) + tr(" completion chart")}
                >
                  {points.map((point) => (
                    <button
                      key={point.key}
                      aria-pressed={selected === point.key}
                      aria-label={tr("{0}: {1}, {2} recorded days of {3}", {
                        0: shortDate(point.key),
                        1: pct(point.value),
                        2: point.recorded,
                        3: point.days,
                      })}
                      onClick={() => setSelected(point.key)}
                      className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2 rounded-t-lg px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgb(var(--sw-accent-rgb))]"
                    >
                      <span className="text-xs font-semibold text-white/70">
                        {pct(point.value)}
                      </span>
                      <span
                        className={
                          "block w-full max-w-20 rounded-t-lg border transition-all " +
                          (point.value === null
                            ? "border-dashed border-white/20 bg-transparent"
                            : "border-[rgb(var(--sw-accent-rgb)/.4)] bg-[rgb(var(--sw-accent-rgb)/.3)] group-hover:bg-[rgb(var(--sw-accent-rgb)/.55)]")
                        }
                        style={{
                          height:
                            point.value === null
                              ? 8
                              : Math.max(4, point.value * 1.35),
                        }}
                      />
                      <span className="pb-1 text-[10px] text-white/60 sm:text-xs">
                        {range === "monthly"
                          ? new Date(
                              point.key + "T00:00:00Z",
                            ).toLocaleDateString(getIntlLocale(), {
                              month: "short",
                              timeZone: "UTC",
                            })
                          : shortDate(point.key)}
                      </span>
                    </button>
                  ))}
                </div>
                <p
                  className="mt-3 text-sm leading-5 text-white/60"
                  aria-live="polite"
                >
                  {selectedPoint
                    ? `${shortDate(selectedPoint.key)}: ${pct(selectedPoint.value)}${range === "daily" ? "" : tr(" · {0} days recorded", { 0: selectedPoint.recorded })}`
                    : tr("Tap a bar to explore. — means no record, not 0%.")}
                </p>
              </>
            ) : (
              <p className="mt-5 rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-white/55">
                {tr("No records in this range yet.")}
              </p>
            )}
            <details className="mt-4 rounded-xl border border-white/10 p-3 text-xs leading-6 text-white/60">
              <summary className="cursor-pointer font-semibold text-white/80">
                {tr("How these numbers work")}
              </summary>
              <p className="mt-2">
                {tr(
                  "Routines use completed tasks divided by total tasks in saved daily snapshots (or today's live checklist until saved). Workouts use checked exercises divided by exercises in that day's logged sessions. No workout record means no assumption about whether training was planned. Habits include all currently active habits that existed on that date, including unmarked ones; deleting or deactivating a habit changes this view of its history. A day with no habit entries is shown as unrecorded. The overall average weights each recorded day equally, not each chart bar. No combined “life score” is calculated.",
                )}
              </p>
            </details>
          </section>
        </>
      )}
      {view === "training" && (
        <>
          <section className={card}>
            <div className="flex items-center gap-3">
              <Icon
                name="workout"
                className="h-6 w-6 text-[rgb(var(--sw-accent-rgb))]"
              />
              <h2 className="text-xl font-bold">
                {tr("Your latest best sets")}
              </h2>
            </div>
            {recentResults.length ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recentResults.map((result) => {
                  const previous = (results ?? []).find(
                    (item) =>
                      item.dayId === result.dayId &&
                      item.exerciseId === result.exerciseId &&
                      item.date < result.date,
                  );
                  const comparison = previous
                    ? compareResults(result, previous)
                    : null;
                  return (
                    <article
                      key={String(result.dayId) + result.exerciseId}
                      className="rounded-2xl border border-white/10 bg-white/[.025] p-4"
                    >
                      <p className="text-xs text-white/50">
                        {result.dayName} · {shortDate(result.date)}
                      </p>
                      <h3 className="mt-2 break-words font-bold">
                        {result.name}
                      </h3>
                      <p className="mt-4 text-xl font-black text-[rgb(var(--sw-accent-rgb))]">
                        {resultLabel(result)}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-white/60">
                        {comparison ??
                          (previous
                            ? tr(
                                "Different reps or load—compare the sets below.",
                              )
                            : tr(
                                "Baseline saved. Your next session gives you a comparison.",
                              ))}
                      </p>
                      {previous && (
                        <p className="mt-2 text-xs text-white/50">
                          {tr("Previous:")} {resultLabel(previous)} ·{" "}
                          {shortDate(previous.date)}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-white/60">
                {tr(
                  "Log a best set in your workout to see how you improve over time.",
                )}
              </p>
            )}
            <details className="mt-4 text-xs leading-6 text-white/50">
              <summary className="cursor-pointer">
                {tr("About these comparisons")}
              </summary>
              <p>
                {tr(
                  "Shows up to 6 exercises from the latest 120 workout records within 90 days. Use the same exercise variation and load convention when comparing.",
                )}
              </p>
            </details>
          </section>
        </>
      )}
      {view === "trends" && (
        <>
          <section className={card}>
            <h2 className="text-xl font-bold">{tr("Your recorded days")}</h2>
            {recordedDays.length > 0 && (
              <div className="mt-4 space-y-2">
                {recordedDays.slice(0, showAll ? undefined : 7).map((day) => (
                  <article
                    key={day.date}
                    className="rounded-xl border border-white/10 p-3"
                  >
                    <p className="text-sm font-semibold text-white/75">
                      {shortDate(day.date)}
                    </p>
                    <dl className="mt-2 grid grid-cols-3 gap-2">
                      {(Object.keys(labels) as ProgressMetric[]).map((key) => (
                        <div key={key}>
                          <dt className="text-xs text-white/45">
                            {tr(labels[key])}
                          </dt>
                          <dd className="mt-1 text-sm font-semibold">
                            {pct(day[key])}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                ))}
              </div>
            )}
            {!recordedDays.length && (
              <p className="py-5 text-sm text-white/60">
                {tr("No records in this range yet.")}
              </p>
            )}
            {recordedDays.length > 7 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="mt-4 text-sm font-semibold text-[rgb(var(--sw-accent-rgb))]"
              >
                {showAll
                  ? tr("Show fewer days")
                  : tr("Show all {0} recorded days", {
                      0: recordedDays.length,
                    })}
              </button>
            )}
          </section>
          <details className={card}>
            <summary className="min-h-11 cursor-pointer text-base font-semibold">
              {tr("View details · Weekly comparison")}
            </summary>
            <p className="mt-2 text-sm text-white/65">
              {tr(
                "Two full seven-day windows ending yesterday. Today's unfinished checklist is excluded.",
              )}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(["routines", "habits"] as const).map((category) => {
                const comparison = compareCompletedWeeks(month, category);
                return (
                  <article
                    key={category}
                    className="rounded-2xl border border-white/10 bg-white/[.025] p-4"
                  >
                    <h3 className="font-bold">{tr(labels[category])}</h3>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {[
                        ["Previous", comparison.previous],
                        ["Latest", comparison.current],
                      ].map(([label, summary]) => {
                        const week = summary as typeof comparison.current;
                        return (
                          <div key={tr(String(label))}>
                            <p className="text-sm text-white/65">
                              {tr(String(label))}
                            </p>
                            <p className="mt-1 text-2xl font-black">
                              {week.completions}
                            </p>
                            <p className="text-xs text-white/55">
                              {category === "routines"
                                ? tr("tasks completed")
                                : tr("habit check-ins")}
                            </p>
                            <p className="mt-2 text-sm">
                              {pct(week.average)} {tr("average")}
                            </p>
                            <p className="mt-1 text-xs text-white/55">
                              {week.recordedDays}
                              {tr("/7 days recorded")}
                              <br />
                              {week.start && shortDate(week.start)} –{" "}
                              {week.end && shortDate(week.end)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-4 text-sm text-[rgb(var(--sw-accent-rgb))]">
                      {comparison.delta === null
                        ? tr(
                            "Record activity in both weeks to compare completion rates.",
                          )
                        : tr(
                            "{0}{1} percentage points in recorded-day completion.",
                            {
                              0: comparison.delta > 0 ? "+" : "",
                              1: Math.round(comparison.delta),
                            },
                          )}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-white/55">
                      {tr(
                        "Counts include recorded completions only. Average percentages exclude unrecorded days; compare the coverage above too.",
                      )}
                      {category === "habits"
                        ? tr(" Habit history reflects currently active habits.")
                        : ""}
                    </p>
                  </article>
                );
              })}
            </div>
          </details>
        </>
      )}
      {view === "milestones" && (
        <section className={card}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-bold">
                {tr("Milestones that stay with you")}
              </h2>
              <p className="mt-1 text-sm text-white/60">
                {earned.length} {tr("earned · Lifetime progress")}
              </p>
            </div>
            <div className="flex gap-2">
              {(["next", "earned", "all"] as const).map((view) => (
                <button
                  key={view}
                  aria-pressed={milestoneView === view}
                  onClick={() => setMilestoneView(view)}
                  className={pill(milestoneView === view)}
                >
                  {view === "next"
                    ? tr("In reach")
                    : view === "earned"
                      ? tr("Earned")
                      : tr("All")}
                </button>
              ))}
            </div>
          </div>
          {next && milestoneView === "next" && (
            <p className="mt-4 text-sm text-[rgb(var(--sw-accent-rgb))]">
              {tr("Next up:")} {next.name} · {next.target - next.current}{" "}
              {tr(next.unit)} {tr("to go.")}
            </p>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-white/10 bg-white/[.025] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold">{item.name}</h3>
                  <Icon
                    name={item.current >= item.target ? "trophy" : "sparkles"}
                    className="h-5 w-5 shrink-0 text-[rgb(var(--sw-accent-rgb))]"
                  />
                </div>
                <p className="mt-2 text-xs text-white/60">
                  {item.target} {tr(item.unit)}
                </p>
                <div className="mt-4 flex justify-between text-xs">
                  <span>
                    {Math.min(item.current, item.target)} / {item.target}
                  </span>
                  <span className="text-[rgb(var(--sw-accent-rgb))]">
                    {item.current >= item.target
                      ? tr("Earned")
                      : tr("In progress")}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[rgb(var(--sw-accent-rgb))]"
                    style={{
                      width:
                        Math.min(100, (item.current / item.target) * 100) + "%",
                    }}
                  />
                </div>
              </article>
            ))}
          </div>
          {!visible.length && (
            <p className="mt-4 text-sm text-white/60">
              {milestoneView === "earned"
                ? tr(
                    "Your first milestone is still ahead. One completed session or strong routine day gets you started.",
                  )
                : tr("You've reached every milestone in this set.")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
