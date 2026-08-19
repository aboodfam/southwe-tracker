import { useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useTheme } from "../contexts/ThemeContext";
import { PageHeader } from "./PageHeader";
import { Icon, IconName } from "./icons";
import { useLocalDateKey } from "../hooks/useLocalDateKey";

type TimeFrame = "daily" | "weekly" | "monthly" | "yearly";
type Metric = "overall" | "routines" | "workouts" | "habits";

type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  current: number;
  target: number;
  unit?: string;
  unlocked: boolean;
  rarity: Rarity;
};

type ProgressDay = {
  date: string;
  completionRate: number;
  routineCompletionRate: number;
  workoutCompletionRate: number;
  habitCompletionRate: number;
};

function clampPct(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  return Math.max(0, Math.min(100, n));
}

function formatPct(v: number) {
  const n = Math.round(clampPct(v));
  return String(n);
}

function prettyDate(iso: string) {
  // iso is YYYY-MM-DD
  try {
    const [y, m, d] = iso.split("-").map((x) => Number(x));
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function metricValue(d: ProgressDay, metric: Metric) {
  switch (metric) {
    case "routines":
      return d.routineCompletionRate;
    case "workouts":
      return d.workoutCompletionRate;
    case "habits":
      return d.habitCompletionRate;
    case "overall":
    default:
      return d.completionRate;
  }
}

function rgbaFromRgbTriplet(triplet: string, a: number) {
  return `rgba(${triplet}, ${a})`;
}

function rgbTripletFromColor(value: string) {
  const rgb = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return `${Number(rgb[1])}, ${Number(rgb[2])}, ${Number(rgb[3])}`;

  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return `${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}`;
  }

  return "163, 163, 163";
}

function TrendChart({
  points,
  accentTriplet,
}: {
  points: number[];
  accentTriplet: string;
}) {
  const w = 720;
  const h = 250;
  const padX = 38;
  const padY = 24;
  const safe = points.length === 1 ? [points[0], points[0]] : points.length ? points : [0, 0];

  const xs = safe.map((_, i) => padX + (i * (w - padX * 2)) / Math.max(1, safe.length - 1));
  const ys = safe.map((value) => {
    const clamped = clampPct(value);
    return h - padY - (clamped / 100) * (h - padY * 2);
  });

  const line = `M ${xs[0]} ${ys[0]} ` + xs.slice(1).map((x, i) => `L ${x} ${ys[i + 1]}`).join(" ");
  const area = `${line} L ${xs[xs.length - 1]} ${h - padY} L ${xs[0]} ${h - padY} Z`;
  const gridValues = [100, 75, 50, 25, 0];

  return (
    <div className="relative h-[220px] w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-black/25 sm:h-[260px]">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(circle at 72% 8%, ${rgbaFromRgbTriplet(accentTriplet, 0.12)}, transparent 46%)`,
        }}
      />
      <svg viewBox={`0 0 ${w} ${h}`} className="relative h-full w-full" preserveAspectRatio="none" aria-label="Progress trend chart">
        <defs>
          <linearGradient id="ceventicTrendLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={rgbaFromRgbTriplet(accentTriplet, 0.45)} />
            <stop offset="55%" stopColor={rgbaFromRgbTriplet(accentTriplet, 1)} />
            <stop offset="100%" stopColor={rgbaFromRgbTriplet(accentTriplet, 0.72)} />
          </linearGradient>
          <linearGradient id="ceventicTrendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={rgbaFromRgbTriplet(accentTriplet, 0.20)} />
            <stop offset="100%" stopColor={rgbaFromRgbTriplet(accentTriplet, 0.01)} />
          </linearGradient>
          <filter id="ceventicTrendGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {gridValues.map((value) => {
          const y = h - padY - (value / 100) * (h - padY * 2);
          return (
            <g key={value}>
              <line x1={padX} x2={w - padX} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
              <text x="8" y={y + 4} fill="rgba(255,255,255,0.28)" fontSize="12">{value}</text>
            </g>
          );
        })}

        <path d={area} fill="url(#ceventicTrendArea)" />
        <path d={line} fill="none" stroke={rgbaFromRgbTriplet(accentTriplet, 0.16)} strokeWidth="8" filter="url(#ceventicTrendGlow)" />
        <path d={line} fill="none" stroke="url(#ceventicTrendLine)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {safe.map((value, index) => {
          const isLast = index === safe.length - 1;
          return (
            <g key={`${index}-${value}`}>
              <circle cx={xs[index]} cy={ys[index]} r={isLast ? 7 : 4} fill="rgba(4,6,9,0.95)" stroke={rgbaFromRgbTriplet(accentTriplet, isLast ? 1 : 0.72)} strokeWidth={isLast ? 3 : 2} />
              {isLast && <circle cx={xs[index]} cy={ys[index]} r="12" fill="none" stroke={rgbaFromRgbTriplet(accentTriplet, 0.18)} strokeWidth="5" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}


function formatCompact(n: number) {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(Math.round(n));
}

function AchievementCard({ a, accentTriplet }: { a: Achievement; accentTriplet: string }) {
  const pct = Math.max(0, Math.min(1, a.target <= 0 ? 0 : a.current / a.target));
  const rarityLabel: Record<Rarity, string> = {
    common: "Common",
    uncommon: "Uncommon",
    rare: "Rare",
    epic: "Epic",
    legendary: "Legendary",
  };
  const unlocked = a.unlocked;
  const progressColor = unlocked
    ? `linear-gradient(90deg, ${rgbaFromRgbTriplet(accentTriplet, 1)}, ${rgbaFromRgbTriplet(accentTriplet, 0.58)})`
    : "linear-gradient(90deg, rgba(255,255,255,0.36), rgba(255,255,255,0.16))";

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border bg-black/30 p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-black/40"
      style={{
        borderColor: unlocked ? rgbaFromRgbTriplet(accentTriplet, 0.26) : "rgba(255,255,255,0.09)",
        boxShadow: unlocked ? `0 14px 40px rgba(0,0,0,.28), 0 0 28px ${rgbaFromRgbTriplet(accentTriplet, 0.08)}` : "0 14px 34px rgba(0,0,0,.20)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: unlocked ? `linear-gradient(90deg, transparent, ${rgbaFromRgbTriplet(accentTriplet, 0.7)}, transparent)` : "linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent)" }}
      />
      {unlocked && (
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full blur-3xl"
          style={{ background: rgbaFromRgbTriplet(accentTriplet, 0.10) }}
        />
      )}

      <div className="relative flex items-start gap-3">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border"
          style={{
            borderColor: unlocked ? rgbaFromRgbTriplet(accentTriplet, 0.28) : "rgba(255,255,255,0.10)",
            background: unlocked ? rgbaFromRgbTriplet(accentTriplet, 0.10) : "rgba(255,255,255,0.035)",
          }}
        >
          <Icon name={a.icon} className={unlocked ? "h-5 w-5 text-[rgb(var(--sw-accent-rgb))]" : "h-5 w-5 text-white/[0.46]"} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className={`truncate font-bold ${unlocked ? "text-white" : "text-white/[0.72]"}`}>{a.title}</h3>
              <p className="mt-1 text-xs leading-5 text-white/[0.43]">{a.description}</p>
            </div>
            <span
              className="shrink-0 rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em]"
              style={{
                borderColor: unlocked ? rgbaFromRgbTriplet(accentTriplet, 0.20) : "rgba(255,255,255,0.08)",
                background: unlocked ? rgbaFromRgbTriplet(accentTriplet, 0.07) : "rgba(255,255,255,0.025)",
                color: unlocked ? "rgba(255,255,255,0.76)" : "rgba(255,255,255,0.34)",
              }}
            >
              {rarityLabel[a.rarity]}
            </span>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">Progress</div>
              <div className="mt-0.5 text-sm font-bold text-white/[0.78]">
                {formatCompact(Math.min(a.current, a.target))}
                <span className="text-white/[0.28]"> / {formatCompact(a.target)} {a.unit ?? ""}</span>
              </div>
            </div>
            <div className={`text-xs font-semibold ${unlocked ? "text-[rgb(var(--sw-accent-rgb))]" : "text-white/[0.38]"}`}>
              {unlocked ? "Unlocked" : `${Math.round(pct * 100)}%`}
            </div>
          </div>

          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.055]">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct * 100}%`, background: progressColor }} />
          </div>
        </div>
      </div>
    </div>
  );
}


export function ProgressPage() {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const dateKey = useLocalDateKey();

  const [activeTimeFrame, setActiveTimeFrame] = useState<TimeFrame>("weekly");
  const [metric, setMetric] = useState<Metric>("overall");

  const progressData = useQuery(api.progress.getProgressData, { timeFrame: activeTimeFrame, dateKey }) as ProgressDay[] | undefined;

  const userStats = useQuery(api.routines.getUserStats);
  const workoutStats = useQuery(api.workouts.getWorkoutStats);
  const habitStats = useQuery(api.habits.getHabitStats, { dateKey });

  // Separate daily series for achievements like "Perfect Day"
  const dailyDataRaw = useQuery(api.progress.getProgressData, { timeFrame: "daily", dateKey }) as ProgressDay[] | undefined;
  const dailyLastRef = useRef<ProgressDay[] | null>(null);
  if (dailyDataRaw && dailyDataRaw.length) dailyLastRef.current = dailyDataRaw;
  const dailySafe = (dailyDataRaw ?? dailyLastRef.current ?? []) as ProgressDay[];

  // Prevent "flash" on slow networks: keep last good data.
  const lastRef = useRef<ProgressDay[] | null>(null);
  if (progressData && progressData.length) lastRef.current = progressData;
  const safe = (progressData ?? lastRef.current ?? []) as ProgressDay[];

  const ordered = useMemo(() => {
    return [...safe].sort((a, b) => a.date.localeCompare(b.date));
  }, [safe]);

  const points = useMemo(() => ordered.map((d) => clampPct(metricValue(d, metric))), [ordered, metric]);

  const latest = ordered.length ? ordered[ordered.length - 1] : null;
  const current = latest ? clampPct(metricValue(latest, metric)) : 0;

  const avg = useMemo(() => {
    if (!points.length) return 0;
    return points.reduce((a, b) => a + b, 0) / points.length;
  }, [points]);

  const best = useMemo(() => (points.length ? Math.max(...points) : 0), [points]);
  const delta = useMemo(() => (points.length >= 2 ? points[points.length - 1] - points[0] : 0), [points]);

  const accentTriplet = useMemo(() => rgbTripletFromColor(colors.primary), [colors.primary]);


// -------------------- Achievements --------------------
const achievements = useMemo(() => {
  const tasksCompleted = userStats?.totalTasksCompleted ?? 0;
  const daysCompleted = userStats?.totalDaysCompleted ?? 0;
  const currentStreak = userStats?.currentStreak ?? 0;
  const longestStreak = userStats?.longestStreak ?? 0;

  const workoutsTotal = workoutStats?.totalWorkouts ?? 0;
  const workoutLongest = workoutStats?.longestStreak ?? 0;

  const habitsTotal = habitStats?.totalHabits ?? 0;
  const habitLongest = habitStats?.longestStreak ?? 0;

  // "Perfect day" = 99.5%+ completion to avoid float issues
  const perfectDays = (dailySafe ?? []).filter((d: any) => (d?.completionRate ?? 0) >= 99.5).length;

  const ach = (
    id: string,
    title: string,
    description: string,
    icon: IconName,
    current: number,
    target: number,
    unit: string | undefined,
    rarity: Rarity
  ): Achievement => ({
    id,
    title,
    description,
    icon,
    current,
    target,
    unit,
    unlocked: current >= target,
    rarity,
  });

  return [
    // Tasks
    ach("task_1", "First Task", "Complete your first task.", "checkCircle", tasksCompleted, 1, "tasks", "common"),
    ach("task_100", "Task Grinder", "Complete 100 tasks.", "layers", tasksCompleted, 100, "tasks", "uncommon"),
    ach("task_1000", "Task Machine", "Complete 1,000 tasks.", "settings", tasksCompleted, 1000, "tasks", "rare"),
    ach("task_5000", "Relentless", "Complete 5,000 tasks.", "flame", tasksCompleted, 5000, "tasks", "legendary"),

    // Days completed (>=80% rule)
    ach("day_1", "First Day", "Finish your first day (80%+).", "calendar", daysCompleted, 1, "days", "common"),
    ach("day_7", "Week Locked In", "Complete 7 days.", "calendar", daysCompleted, 7, "days", "rare"),
    ach("day_30", "30‑Day Discipline", "Complete 30 days.", "trophy", daysCompleted, 30, "days", "epic"),
    ach("day_100", "100 Days", "Complete 100 days.", "diamond", daysCompleted, 100, "days", "legendary"),

    // Streaks
    ach("streak_3", "Streak Starter", "Hold a 3‑day streak.", "bolt", currentStreak, 3, "days", "uncommon"),
    ach("streak_7", "Streak Warrior", "Hold a 7‑day streak.", "shield", currentStreak, 7, "days", "rare"),
    ach("streak_14", "Two Weeks", "Hold a 14‑day streak.", "bolt", currentStreak, 14, "days", "epic"),
    ach("streak_30", "Unbreakable", "Hold a 30‑day streak.", "shield", currentStreak, 30, "days", "legendary"),
    ach("longest_60", "Legendary Streak", "Reach a 60‑day longest streak.", "sparkles", longestStreak, 60, "days", "legendary"),

    // Perfection
    ach("perfect_1", "Perfect Day", "Hit 100% completion in a day.", "checkCircle", perfectDays, 1, "days", "rare"),
    ach("perfect_7", "Perfection Week", "Get 7 perfect days (100%).", "sparkles", perfectDays, 7, "days", "legendary"),

    // Workouts
    ach("workout_1", "First Workout", "Finish your first workout.", "workout", workoutsTotal, 1, "workouts", "common"),
    ach("workout_10", "Workout Habit", "Finish 10 workouts.", "workout", workoutsTotal, 10, "workouts", "uncommon"),
    ach("workout_25", "Built Different", "Finish 25 workouts.", "workout", workoutsTotal, 25, "workouts", "rare"),
    ach("workout_100", "Training Beast", "Finish 100 workouts.", "trophy", workoutsTotal, 100, "workouts", "legendary"),
    ach("workout_longest_14", "Workout Legend", "Reach a 14‑day longest workout streak.", "trophy", workoutLongest, 14, "days", "epic"),

    // Habits
    ach("habit_1", "First Habit", "Create your first habit.", "habits", habitsTotal, 1, "habits", "common"),
    ach("habit_5", "Habit Builder", "Create 5 habits.", "layers", habitsTotal, 5, "habits", "uncommon"),
    ach("habit_10", "Habit Architect", "Create 10 habits.", "routines", habitsTotal, 10, "habits", "rare"),
    ach("habit_longest_21", "Consistency", "Reach a 21‑day habit streak.", "diamond", habitLongest, 21, "days", "epic"),
    ach("habit_longest_60", "Master of Habits", "Reach a 60‑day habit streak.", "habits", habitLongest, 60, "days", "legendary"),
  ];
}, [userStats, workoutStats, habitStats, dailySafe]);

const unlockedCount = useMemo(
  () => achievements.filter((a) => a.unlocked).length,
  [achievements]
);

const achievementsSorted = useMemo(() => {
  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);
  locked.sort((a, b) => (b.current / b.target) - (a.current / a.target));
  return [...unlocked, ...locked];
}, [achievements]);

  const timeframeLabel: Record<TimeFrame, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
  };

  const metricLabel: Record<Metric, string> = {
    overall: "Overall",
    routines: "Routines",
    workouts: "Workouts",
    habits: "Habits",
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in">
      <PageHeader title="Progress" subtitle="Keep it simple. See the trend." />

      {/* CONTROL PANEL (matches Habits style) */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl p-4 sm:p-5 sw-holo animate-slide-up max-w-5xl mx-auto">
        <div className="relative z-10 flex flex-col items-center text-center gap-4">
          {/* Metric pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {(["overall", "routines", "workouts", "habits"] as Metric[]).map((m) => {
              const active = metric === m;
              return (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={[
                    "px-3 py-2 rounded-xl border text-sm font-semibold transition",
                    active ? "bg-white/10 border-white/20 text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/8 hover:text-white",
                  ].join(" ")}
                >
                  {metricLabel[m]}
                </button>
              );
            })}
          </div>

          {/* Timeframe pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {(Object.keys(timeframeLabel) as TimeFrame[]).map((tf) => {
              const active = activeTimeFrame === tf;
              return (
                <button
                  key={tf}
                  onClick={() => setActiveTimeFrame(tf)}
                  className={[
                    "px-3 py-2 rounded-xl border text-sm font-semibold transition",
                    active ? "bg-white/10 border-white/20 text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/8 hover:text-white",
                  ].join(" ")}
                >
                  {timeframeLabel[tf]}
                </button>
              );
            })}
          </div>

          {/* Now card (very similar to Habits "Today") */}
          <div className="w-full max-w-md mt-1 rounded-2xl border border-white/10 bg-black/35 p-4 text-left">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-white/60 text-xs font-semibold">Now</div>
                <div className="mt-1 text-white text-3xl font-black">
                  {formatPct(current)}%
                  <span className="ml-2 text-white/50 text-sm font-semibold">{metricLabel[metric]}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-white/[0.35] text-xs">{latest ? latest.date : "—"}</div>
                <div className="mt-1 text-white/[0.35] text-xs">{ordered.length ? `${ordered.length} checkpoints` : "No data yet"}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <div className="text-white/[0.55] text-[11px] font-semibold">Average</div>
                <div className="mt-0.5 text-white font-black">{formatPct(avg)}%</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <div className="text-white/[0.55] text-[11px] font-semibold">Best</div>
                <div className="mt-0.5 text-white font-black">{formatPct(best)}%</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <div className="text-white/[0.55] text-[11px] font-semibold">Change</div>
                <div className="mt-0.5 text-white font-black">
                  {delta >= 0 ? "+" : ""}
                  {Math.round(delta)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* background aura */}
        <div
          className="absolute -inset-24 opacity-60 blur-3xl pointer-events-none"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${rgbaFromRgbTriplet(accentTriplet, 0.20)}, transparent 55%)`,
          }}
        />
      </div>

      {/* TIMELINE */}
      <section className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-4 sm:p-5 animate-float-in">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl"
          style={{ background: rgbaFromRgbTriplet(accentTriplet, 0.08) }}
        />
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.035]">
                <Icon name="chart" className="h-5 w-5 text-[rgb(var(--sw-accent-rgb))]" />
              </div>
              <div>
                <h2 className="font-bold text-white">Timeline</h2>
                <p className="mt-1 text-xs text-white/[0.42]">Your {metricLabel[metric].toLowerCase()} completion across this {timeframeLabel[activeTimeFrame].toLowerCase()} view.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[310px]">
              {[
                ["Average", `${formatPct(avg)}%`],
                ["Best", `${formatPct(best)}%`],
                ["Change", `${delta >= 0 ? "+" : ""}${Math.round(delta)}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30">{label}</div>
                  <div className="mt-1 text-sm font-bold text-white/[0.82]">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 force-ltr">
            <TrendChart points={points} accentTriplet={accentTriplet} />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/[0.34] force-ltr">
            <span>{ordered.length ? prettyDate(ordered[0].date) : "No history yet"}</span>
            <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-white/30">
              {ordered.length ? `${ordered.length} checkpoints` : "Waiting for data"}
            </span>
            <span>{ordered.length ? prettyDate(ordered[ordered.length - 1].date) : "—"}</span>
          </div>
        </div>
      </section>

      {/* ACHIEVEMENTS */}
      <section className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-4 sm:p-5">
        <div
          className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full blur-3xl"
          style={{ background: rgbaFromRgbTriplet(accentTriplet, 0.07) }}
        />
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.035]">
                <Icon name="trophy" className="h-5 w-5 text-[rgb(var(--sw-accent-rgb))]" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Achievements</h2>
                <p className="mt-1 max-w-xl text-sm text-white/[0.43]">Milestones earned from real routines, workouts, habits and streaks.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 sm:min-w-[210px]">
              <div
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full p-[3px]"
                style={{ background: `conic-gradient(rgb(var(--sw-accent-rgb)) ${(unlockedCount / Math.max(1, achievements.length)) * 360}deg, rgba(255,255,255,0.07) 0deg)` }}
              >
                <div className="grid h-full w-full place-items-center rounded-full bg-[#080a0d] text-xs font-black text-white">
                  {Math.round((unlockedCount / Math.max(1, achievements.length)) * 100)}%
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">Unlocked</div>
                <div className="mt-0.5 text-lg font-black text-white">{unlockedCount}<span className="text-white/25">/{achievements.length}</span></div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {achievementsSorted.map((a) => (
              <AchievementCard key={a.id} a={a} accentTriplet={accentTriplet} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
