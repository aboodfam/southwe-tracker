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
type AchievementFilter = "next" | "unlocked" | "all";

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

type SeriesPoint = {
  key: string;
  label: string;
  overall: number;
  routines: number;
  workouts: number;
  habits: number;
};

const metricLabel: Record<Metric, string> = {
  overall: "Overall",
  routines: "Routines",
  workouts: "Workouts",
  habits: "Habits",
};

const timeframeLabel: Record<TimeFrame, string> = {
  daily: "7 days",
  weekly: "4 weeks",
  monthly: "6 months",
  yearly: "3 years",
};

function clampPct(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, safe));
}

function formatPct(value: number) {
  return `${Math.round(clampPct(value))}%`;
}

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return String(Math.round(value));
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shortDate(value: string) {
  return parseDateKey(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function metricValue(day: ProgressDay | SeriesPoint, metric: Metric) {
  if ("completionRate" in day) {
    if (metric === "routines") return day.routineCompletionRate;
    if (metric === "workouts") return day.workoutCompletionRate;
    if (metric === "habits") return day.habitCompletionRate;
    return day.completionRate;
  }
  return day[metric];
}

function rgbaFromRgbTriplet(triplet: string, alpha: number) {
  return `rgba(${triplet}, ${alpha})`;
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

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function startOfWeekKey(value: string) {
  const date = parseDateKey(value);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return toDateKey(date);
}

function aggregateSeries(days: ProgressDay[], timeframe: TimeFrame): SeriesPoint[] {
  const groups = new Map<string, ProgressDay[]>();
  days.forEach((day) => {
    const key = timeframe === "daily"
      ? day.date
      : timeframe === "weekly"
        ? startOfWeekKey(day.date)
        : timeframe === "monthly"
          ? day.date.slice(0, 7)
          : day.date.slice(0, 4);
    groups.set(key, [...(groups.get(key) ?? []), day]);
  });

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => {
      const date = timeframe === "monthly" ? parseDateKey(`${key}-01`) : timeframe === "yearly" ? parseDateKey(`${key}-01-01`) : parseDateKey(key);
      const label = timeframe === "daily"
        ? date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })
        : timeframe === "weekly"
          ? shortDate(key)
          : timeframe === "monthly"
            ? date.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" })
            : key;
      return {
        key,
        label,
        overall: average(values.map((item) => clampPct(item.completionRate))),
        routines: average(values.map((item) => clampPct(item.routineCompletionRate))),
        workouts: average(values.map((item) => clampPct(item.workoutCompletionRate))),
        habits: average(values.map((item) => clampPct(item.habitCompletionRate))),
      };
    });
}

function TrendChart({ points, metric, accentTriplet }: { points: SeriesPoint[]; metric: Metric; accentTriplet: string }) {
  const width = 760;
  const height = 280;
  const padX = 42;
  const padTop = 24;
  const padBottom = 42;
  const plotted = points.length === 1 ? [points[0], { ...points[0], key: `${points[0].key}-copy`, label: "Now" }] : points;
  const safe = plotted.length ? plotted : [
    { key: "empty-a", label: "Start", overall: 0, routines: 0, workouts: 0, habits: 0 },
    { key: "empty-b", label: "Now", overall: 0, routines: 0, workouts: 0, habits: 0 },
  ];
  const values = safe.map((point) => clampPct(metricValue(point, metric)));
  const xs = safe.map((_, index) => padX + (index * (width - padX * 2)) / Math.max(1, safe.length - 1));
  const ys = values.map((value) => height - padBottom - (value / 100) * (height - padTop - padBottom));
  const line = `M ${xs[0]} ${ys[0]} ${xs.slice(1).map((x, index) => `L ${x} ${ys[index + 1]}`).join(" ")}`;
  const area = `${line} L ${xs[xs.length - 1]} ${height - padBottom} L ${xs[0]} ${height - padBottom} Z`;
  const labelEvery = Math.max(1, Math.ceil(safe.length / 6));

  return (
    <div className="relative h-[250px] w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-black/30 sm:h-[300px]">
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 75% 10%, ${rgbaFromRgbTriplet(accentTriplet, 0.13)}, transparent 48%)` }} />
      <svg viewBox={`0 0 ${width} ${height}`} className="relative h-full w-full" preserveAspectRatio="none" role="img" aria-label={`${metricLabel[metric]} progress trend`}>
        <defs>
          <linearGradient id="progressLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={rgbaFromRgbTriplet(accentTriplet, 0.45)} />
            <stop offset="65%" stopColor={rgbaFromRgbTriplet(accentTriplet, 1)} />
            <stop offset="100%" stopColor="white" />
          </linearGradient>
          <linearGradient id="progressArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={rgbaFromRgbTriplet(accentTriplet, 0.24)} />
            <stop offset="100%" stopColor={rgbaFromRgbTriplet(accentTriplet, 0.01)} />
          </linearGradient>
          <filter id="progressGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {[100, 75, 50, 25, 0].map((value) => {
          const y = height - padBottom - (value / 100) * (height - padTop - padBottom);
          return <g key={value}><line x1={padX} x2={width - padX} y1={y} y2={y} stroke="rgba(255,255,255,.065)" /><text x="9" y={y + 4} fill="rgba(255,255,255,.27)" fontSize="11">{value}</text></g>;
        })}
        <path d={area} fill="url(#progressArea)" />
        <path d={line} fill="none" stroke={rgbaFromRgbTriplet(accentTriplet, 0.14)} strokeWidth="10" filter="url(#progressGlow)" />
        <path d={line} fill="none" stroke="url(#progressLine)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="progress-chart-line" />
        {safe.map((point, index) => {
          const showLabel = index === 0 || index === safe.length - 1 || index % labelEvery === 0;
          return (
            <g key={point.key}>
              <title>{point.label}: {formatPct(values[index])}</title>
              <circle cx={xs[index]} cy={ys[index]} r={index === safe.length - 1 ? 6 : 4} fill="#07090b" stroke={rgbaFromRgbTriplet(accentTriplet, index === safe.length - 1 ? 1 : 0.72)} strokeWidth={index === safe.length - 1 ? 3 : 2} />
              {index === safe.length - 1 && <circle cx={xs[index]} cy={ys[index]} r="12" fill="none" stroke={rgbaFromRgbTriplet(accentTriplet, 0.2)} strokeWidth="5" className="progress-last-point" />}
              {showLabel && <text x={xs[index]} y={height - 16} textAnchor="middle" fill="rgba(255,255,255,.34)" fontSize="11">{point.label}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AchievementCard({ achievement, accentTriplet }: { achievement: Achievement; accentTriplet: string }) {
  const progress = Math.max(0, Math.min(1, achievement.target <= 0 ? 0 : achievement.current / achievement.target));
  const remaining = Math.max(0, achievement.target - achievement.current);
  const rarityLabel: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };
  return (
    <article className="group relative overflow-hidden rounded-2xl border bg-black/30 p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-black/40" style={{ borderColor: achievement.unlocked ? rgbaFromRgbTriplet(accentTriplet, 0.28) : "rgba(255,255,255,.085)", boxShadow: achievement.unlocked ? `0 0 30px ${rgbaFromRgbTriplet(accentTriplet, 0.07)}` : undefined }}>
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border" style={{ borderColor: achievement.unlocked ? rgbaFromRgbTriplet(accentTriplet, 0.3) : "rgba(255,255,255,.1)", background: achievement.unlocked ? rgbaFromRgbTriplet(accentTriplet, 0.1) : "rgba(255,255,255,.03)" }}>
          <Icon name={achievement.icon} className={achievement.unlocked ? "h-5 w-5 text-[rgb(var(--sw-accent-rgb))]" : "h-5 w-5 text-white/40"} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div><h3 className="font-bold text-white/90">{achievement.title}</h3><p className="mt-1 text-xs leading-5 text-white/40">{achievement.description}</p></div>
            <span className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white/35">{rarityLabel[achievement.rarity]}</span>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="font-bold text-white/70">{formatCompact(Math.min(achievement.current, achievement.target))}<span className="text-white/25"> / {formatCompact(achievement.target)} {achievement.unit}</span></span>
            <span className={achievement.unlocked ? "font-bold text-[rgb(var(--sw-accent-rgb))]" : "font-semibold text-white/38"}>{achievement.unlocked ? "Unlocked" : `${formatCompact(remaining)} to go`}</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.055]"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${progress * 100}%`, background: achievement.unlocked ? `linear-gradient(90deg, ${rgbaFromRgbTriplet(accentTriplet, 1)}, white)` : `linear-gradient(90deg, ${rgbaFromRgbTriplet(accentTriplet, 0.72)}, ${rgbaFromRgbTriplet(accentTriplet, 0.3)})` }} /></div>
        </div>
      </div>
    </article>
  );
}

export function ProgressPage() {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const dateKey = useLocalDateKey();
  const [activeTimeFrame, setActiveTimeFrame] = useState<TimeFrame>("weekly");
  const [metric, setMetric] = useState<Metric>("overall");
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>("next");

  const progressData = useQuery(api.progress.getProgressData, { timeFrame: activeTimeFrame, dateKey }) as ProgressDay[] | undefined;
  const dailyDataExtra = useQuery(api.progress.getProgressData, activeTimeFrame === "daily" ? "skip" : { timeFrame: "daily", dateKey }) as ProgressDay[] | undefined;
  const userStats = useQuery(api.routines.getUserStats);
  const workoutStats = useQuery(api.workouts.getWorkoutStats);
  const habitStats = useQuery(api.habits.getHabitStats, { dateKey });

  const cacheRef = useRef<Partial<Record<TimeFrame, ProgressDay[]>>>({});
  if (progressData) cacheRef.current[activeTimeFrame] = progressData;
  const safe = progressData ?? cacheRef.current[activeTimeFrame] ?? [];
  const dailyLastRef = useRef<ProgressDay[]>([]);
  const dailyRaw = activeTimeFrame === "daily" ? progressData : dailyDataExtra;
  if (dailyRaw) dailyLastRef.current = dailyRaw;
  const dailySafe = dailyRaw ?? dailyLastRef.current;

  const ordered = useMemo(() => [...safe].sort((a, b) => a.date.localeCompare(b.date)), [safe]);
  const series = useMemo(() => aggregateSeries(ordered, activeTimeFrame), [ordered, activeTimeFrame]);
  const values = useMemo(() => series.map((point) => clampPct(metricValue(point, metric))), [series, metric]);
  const current = values.at(-1) ?? 0;
  const previous = values.at(-2) ?? current;
  const delta = current - previous;
  const periodAverage = average(values);
  const personalBest = values.length ? Math.max(...values) : 0;
  const accentTriplet = useMemo(() => rgbTripletFromColor(colors.primary), [colors.primary]);

  const sevenDayPulse = useMemo(() => {
    const byDate = new Map(dailySafe.map((day) => [day.date, day]));
    const today = parseDateKey(dateKey);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() - (6 - index));
      const key = toDateKey(date);
      const day = byDate.get(key);
      return { key, label: date.toLocaleDateString(undefined, { weekday: "narrow", timeZone: "UTC" }), value: day ? clampPct(day.completionRate) : 0, tracked: Boolean(day), today: key === dateKey };
    });
  }, [dailySafe, dateKey]);

  const strongDays = sevenDayPulse.filter((day) => day.value >= 80).length;
  const trackedDays = sevenDayPulse.filter((day) => day.tracked).length;
  const consistency = trackedDays ? (strongDays / trackedDays) * 100 : 0;
  const currentStreak = userStats?.currentStreak ?? 0;
  const categorySummary = useMemo(() => (["routines", "workouts", "habits"] as const).map((category) => {
    const categoryValues = series.map((point) => clampPct(point[category]));
    const latest = categoryValues.at(-1) ?? 0;
    const prior = categoryValues.at(-2) ?? latest;
    return { category, value: average(categoryValues), delta: latest - prior };
  }), [series]);

  const achievements = useMemo(() => {
    const tasksCompleted = userStats?.totalTasksCompleted ?? 0;
    const daysCompleted = userStats?.totalDaysCompleted ?? 0;
    const longestStreak = userStats?.longestStreak ?? 0;
    const workoutsTotal = workoutStats?.totalWorkouts ?? 0;
    const workoutLongest = workoutStats?.longestStreak ?? 0;
    const habitsTotal = habitStats?.totalHabits ?? 0;
    const habitLongest = habitStats?.longestStreak ?? 0;
    const perfectDays = dailySafe.filter((day) => day.completionRate >= 99.5).length;
    const make = (id: string, title: string, description: string, icon: IconName, currentValue: number, target: number, unit: string | undefined, rarity: Rarity): Achievement => ({ id, title, description, icon, current: currentValue, target, unit, unlocked: currentValue >= target, rarity });
    return [
      make("task_1", "First Task", "Complete your first task.", "checkCircle", tasksCompleted, 1, "tasks", "common"),
      make("task_100", "Task Grinder", "Complete 100 tasks.", "layers", tasksCompleted, 100, "tasks", "uncommon"),
      make("task_1000", "Task Machine", "Complete 1,000 tasks.", "settings", tasksCompleted, 1000, "tasks", "rare"),
      make("task_5000", "Relentless", "Complete 5,000 tasks.", "flame", tasksCompleted, 5000, "tasks", "legendary"),
      make("day_1", "First Day", "Finish your first day at 80% or better.", "calendar", daysCompleted, 1, "days", "common"),
      make("day_7", "Week Locked In", "Complete 7 strong days.", "calendar", daysCompleted, 7, "days", "rare"),
      make("day_30", "30-Day Discipline", "Complete 30 strong days.", "trophy", daysCompleted, 30, "days", "epic"),
      make("day_100", "100 Days", "Complete 100 strong days.", "diamond", daysCompleted, 100, "days", "legendary"),
      make("streak_3", "Streak Starter", "Hold a 3-day streak.", "bolt", currentStreak, 3, "days", "uncommon"),
      make("streak_7", "Streak Warrior", "Hold a 7-day streak.", "shield", currentStreak, 7, "days", "rare"),
      make("streak_14", "Two Weeks", "Hold a 14-day streak.", "bolt", currentStreak, 14, "days", "epic"),
      make("streak_30", "Unbreakable", "Hold a 30-day streak.", "shield", currentStreak, 30, "days", "legendary"),
      make("longest_60", "Legendary Streak", "Reach a 60-day longest streak.", "sparkles", longestStreak, 60, "days", "legendary"),
      make("perfect_1", "Perfect Day", "Hit 100% completion in a day.", "checkCircle", perfectDays, 1, "days", "rare"),
      make("perfect_7", "Perfection Week", "Collect 7 perfect days.", "sparkles", perfectDays, 7, "days", "legendary"),
      make("workout_1", "First Workout", "Finish your first workout.", "workout", workoutsTotal, 1, "workouts", "common"),
      make("workout_10", "Workout Habit", "Finish 10 workouts.", "workout", workoutsTotal, 10, "workouts", "uncommon"),
      make("workout_25", "Built Different", "Finish 25 workouts.", "workout", workoutsTotal, 25, "workouts", "rare"),
      make("workout_100", "Training Beast", "Finish 100 workouts.", "trophy", workoutsTotal, 100, "workouts", "legendary"),
      make("workout_longest_14", "Workout Legend", "Reach a 14-day workout streak.", "trophy", workoutLongest, 14, "days", "epic"),
      make("habit_1", "First Habit", "Create your first habit.", "habits", habitsTotal, 1, "habits", "common"),
      make("habit_5", "Habit Builder", "Create 5 habits.", "layers", habitsTotal, 5, "habits", "uncommon"),
      make("habit_10", "Habit Architect", "Create 10 habits.", "routines", habitsTotal, 10, "habits", "rare"),
      make("habit_longest_21", "Consistency", "Reach a 21-day habit streak.", "diamond", habitLongest, 21, "days", "epic"),
      make("habit_longest_60", "Master of Habits", "Reach a 60-day habit streak.", "habits", habitLongest, 60, "days", "legendary"),
    ];
  }, [userStats, workoutStats, habitStats, dailySafe, currentStreak]);

  const unlocked = achievements.filter((achievement) => achievement.unlocked);
  const locked = achievements.filter((achievement) => !achievement.unlocked).sort((a, b) => (b.current / b.target) - (a.current / a.target));
  const nextAchievement = locked[0] ?? unlocked.at(-1);
  const visibleAchievements = achievementFilter === "unlocked" ? unlocked : achievementFilter === "all" ? [...unlocked, ...locked] : locked.slice(0, 6);
  const unlockRate = (unlocked.length / Math.max(1, achievements.length)) * 100;
  const status = delta > 4
    ? { label: "Momentum rising", copy: `Up ${Math.round(delta)} points from the previous checkpoint.` }
    : delta < -4
      ? { label: "Bounce-back window", copy: `${Math.abs(Math.round(delta))} points below your last checkpoint. One strong day changes the line.` }
      : { label: "Holding steady", copy: "Your pace is stable. The next win comes from consistency." };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Progress" subtitle="See the work add up." />

      <section className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-black/35 p-4 shadow-2xl sm:p-6 sw-holo">
        <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full blur-3xl" style={{ background: rgbaFromRgbTriplet(accentTriplet, 0.12) }} />
        <div className="relative grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full p-[7px] progress-ring-pop" style={{ background: `conic-gradient(rgb(var(--sw-accent-rgb)) ${current * 3.6}deg, rgba(255,255,255,.07) 0deg)`, boxShadow: `0 0 42px ${rgbaFromRgbTriplet(accentTriplet, 0.14)}` }}>
                <div className="grid h-full w-full place-items-center rounded-full border border-white/[0.08] bg-[#07090b] text-center"><div><div className="text-4xl font-black tracking-tight text-white">{formatPct(current)}</div><div className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/35">{metricLabel[metric]}</div></div></div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[rgb(var(--sw-accent-rgb))]"><Icon name={delta >= 0 ? "bolt" : "refresh"} className="h-4 w-4" />{status.label}</div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">Your momentum score</h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-white/45">{status.copy}</p>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[["Average", formatPct(periodAverage)], ["Best", formatPct(personalBest)], ["Streak", `${currentStreak}d`]].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/[0.07] bg-black/25 p-3"><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/30">{label}</div><div className="mt-1 text-lg font-black text-white/90">{value}</div></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-black/30 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/30">Next milestone</div><h2 className="mt-2 text-xl font-black text-white">{nextAchievement?.title ?? "All milestones cleared"}</h2><p className="mt-1 text-sm leading-6 text-white/42">{nextAchievement?.description ?? "You have unlocked everything currently available."}</p></div><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.035]"><Icon name={nextAchievement?.icon ?? "trophy"} className="h-6 w-6 text-[rgb(var(--sw-accent-rgb))]" /></div></div>
            {nextAchievement && <><div className="mt-6 flex items-end justify-between gap-3"><div className="text-3xl font-black text-white">{formatCompact(Math.min(nextAchievement.current, nextAchievement.target))}<span className="text-base text-white/25"> / {formatCompact(nextAchievement.target)}</span></div><div className="text-xs font-bold text-[rgb(var(--sw-accent-rgb))]">{nextAchievement.unlocked ? "Unlocked" : `${formatCompact(Math.max(0, nextAchievement.target - nextAchievement.current))} ${nextAchievement.unit ?? ""} left`}</div></div><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, (nextAchievement.current / Math.max(1, nextAchievement.target)) * 100)}%`, background: `linear-gradient(90deg, ${rgbaFromRgbTriplet(accentTriplet, 0.75)}, white)`, boxShadow: `0 0 18px ${rgbaFromRgbTriplet(accentTriplet, 0.42)}` }} /></div></>}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1.4fr_.6fr]">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.035]"><Icon name="chart" className="h-5 w-5 text-[rgb(var(--sw-accent-rgb))]" /></div><div><h2 className="font-bold text-white">Momentum trend</h2><p className="mt-1 text-xs text-white/40">Clear checkpoints across your selected range.</p></div></div>
            <div className="flex flex-wrap gap-2">{(Object.keys(timeframeLabel) as TimeFrame[]).map((timeframe) => <button key={timeframe} type="button" aria-pressed={activeTimeFrame === timeframe} onClick={() => setActiveTimeFrame(timeframe)} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${activeTimeFrame === timeframe ? "border-white/20 bg-white/10 text-white" : "border-white/[0.08] bg-white/[0.025] text-white/45 hover:bg-white/[0.06] hover:text-white/80"}`}>{timeframeLabel[timeframe]}</button>)}</div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{(Object.keys(metricLabel) as Metric[]).map((item) => <button key={item} type="button" aria-pressed={metric === item} onClick={() => setMetric(item)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${metric === item ? "border-[rgb(var(--sw-accent-rgb)/.35)] bg-[rgb(var(--sw-accent-rgb)/.1)] text-[rgb(var(--sw-accent-rgb))]" : "border-white/[0.08] text-white/40 hover:text-white/70"}`}>{metricLabel[item]}</button>)}</div>
          <div className="mt-4 force-ltr"><TrendChart points={series} metric={metric} accentTriplet={accentTriplet} /></div>
          {!series.length && <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-center text-sm text-white/40">Complete a routine, workout, or habit to draw your first progress line.</div>}
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/30 p-4 sm:p-5">
          <div className="flex items-start justify-between"><div><h2 className="font-bold text-white">7-day pulse</h2><p className="mt-1 text-xs text-white/40">Strong days hit 80% or more.</p></div><div className="text-right"><div className="text-2xl font-black text-white">{strongDays}<span className="text-white/25">/{trackedDays || 7}</span></div><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/30">strong days</div></div></div>
          <div className="mt-5 grid grid-cols-7 gap-1.5">{sevenDayPulse.map((day) => <div key={day.key} title={`${shortDate(day.key)}: ${day.tracked ? formatPct(day.value) : "No activity"}`} className={`flex min-w-0 flex-col items-center rounded-xl border px-1 py-2 ${day.today ? "border-[rgb(var(--sw-accent-rgb)/.35)]" : "border-white/[0.07]"} bg-white/[0.02]`}><span className="text-[10px] font-bold text-white/35">{day.label}</span><div className="mt-2 flex h-20 w-full items-end justify-center overflow-hidden rounded-lg bg-white/[0.035] p-1"><div className="w-full rounded-md transition-[height] duration-700" style={{ height: `${Math.max(day.tracked ? 8 : 3, day.value)}%`, background: day.value >= 80 ? `linear-gradient(180deg, white, ${rgbaFromRgbTriplet(accentTriplet, 0.8)})` : day.tracked ? rgbaFromRgbTriplet(accentTriplet, 0.32) : "rgba(255,255,255,.055)", boxShadow: day.value >= 80 ? `0 0 14px ${rgbaFromRgbTriplet(accentTriplet, 0.3)}` : undefined }} /></div><span className="mt-2 text-[10px] font-bold text-white/45">{day.tracked ? Math.round(day.value) : "—"}</span></div>)}</div>
          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold text-white/55">Consistency</span><span className="text-sm font-black text-white">{formatPct(consistency)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-[image:var(--sw-gradient)] transition-[width] duration-700" style={{ width: `${consistency}%` }} /></div></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-black/30 p-4 sm:p-5">
        <div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.035]"><Icon name="layers" className="h-5 w-5 text-[rgb(var(--sw-accent-rgb))]" /></div><div><h2 className="font-bold text-white">What is driving the score</h2><p className="mt-1 text-xs text-white/40">Compare your system and know where to focus next.</p></div></div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">{categorySummary.map(({ category, value, delta: categoryDelta }) => <button key={category} type="button" onClick={() => setMetric(category)} className={`rounded-2xl border p-4 text-left transition ${metric === category ? "border-[rgb(var(--sw-accent-rgb)/.3)] bg-[rgb(var(--sw-accent-rgb)/.07)]" : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"}`}><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 font-bold text-white/80"><Icon name={category === "workouts" ? "workout" : category} className="h-4 w-4 text-[rgb(var(--sw-accent-rgb))]" />{metricLabel[category]}</span><span className={`text-xs font-bold ${categoryDelta > 0 ? "text-[rgb(var(--sw-accent-rgb))]" : "text-white/35"}`}>{categoryDelta > 0 ? "+" : ""}{Math.round(categoryDelta)} pts</span></div><div className="mt-4 flex items-end justify-between"><span className="text-3xl font-black text-white">{formatPct(value)}</span><span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/25">period avg</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-[image:var(--sw-gradient)] transition-[width] duration-700" style={{ width: `${value}%` }} /></div></button>)}</div>
      </section>

      <section className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-4 sm:p-5">
        <div className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full blur-3xl" style={{ background: rgbaFromRgbTriplet(accentTriplet, 0.07) }} />
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.035]"><Icon name="trophy" className="h-5 w-5 text-[rgb(var(--sw-accent-rgb))]" /></div><div><h2 className="text-lg font-black text-white">Milestones</h2><p className="mt-1 text-sm text-white/42">{unlocked.length} of {achievements.length} unlocked · {Math.round(unlockRate)}% complete</p></div></div><div className="flex flex-wrap gap-2">{(["next", "unlocked", "all"] as AchievementFilter[]).map((filter) => <button key={filter} type="button" aria-pressed={achievementFilter === filter} onClick={() => setAchievementFilter(filter)} className={`rounded-xl border px-3 py-2 text-xs font-bold capitalize transition ${achievementFilter === filter ? "border-white/20 bg-white/10 text-white" : "border-white/[0.08] bg-white/[0.02] text-white/40 hover:text-white/75"}`}>{filter === "next" ? "In reach" : filter}</button>)}</div></div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.055]"><div className="h-full rounded-full bg-[image:var(--sw-gradient)] transition-[width] duration-700" style={{ width: `${unlockRate}%` }} /></div>
          {visibleAchievements.length ? <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleAchievements.map((achievement) => <AchievementCard key={achievement.id} achievement={achievement} accentTriplet={accentTriplet} />)}</div> : <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-center text-sm text-white/40">No milestones in this view yet.</div>}
        </div>
      </section>
    </div>
  );
}
