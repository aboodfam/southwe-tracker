import { useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useTheme } from "../contexts/ThemeContext";
import { PageHeader } from "./PageHeader";
import { Icon, IconName } from "./icons";

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
  // triplet: "r, g, b"
  return `rgba(${triplet}, ${a})`;
}

function Sparkline({
  points,
  accentTriplet,
}: {
  points: number[];
  accentTriplet: string; // "r, g, b"
}) {
  // Keep the box compact but "zoom in" on mobile
  const w = 560;
  const h = 220;
  const pad = 18;

  const safe = points.length === 1 ? [points[0], points[0]] : points.length ? points : [0, 0];

  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const span = Math.max(1, max - min);

  const xs = safe.map((_, i) => pad + (i * (w - pad * 2)) / Math.max(1, safe.length - 1));
  const ys = safe.map((v) => {
    const t = (v - min) / span;
    return h - pad - t * (h - pad * 2);
  });

  const area = `M ${xs[0]} ${h - pad} ` + xs.map((x, i) => `L ${x} ${ys[i]}`).join(" ") + ` L ${xs[xs.length - 1]} ${h - pad} Z`;
  const line = `M ${xs[0]} ${ys[0]} ` + xs.map((x, i) => `L ${x} ${ys[i]}`).join(" ");

  const stroke = rgbaFromRgbTriplet(accentTriplet, 0.95);
  const glow = rgbaFromRgbTriplet(accentTriplet, 0.18);

  const isMobile = typeof window !== "undefined" ? window.innerWidth < 640 : false;

  return (
    <div className="relative w-full h-[240px] sm:h-[280px] rounded-2xl overflow-hidden">
      {/* soft glow */}
      <div
        className="absolute -inset-10 opacity-70 blur-2xl"
        style={{
          background: `radial-gradient(circle at 25% 35%, ${rgbaFromRgbTriplet(accentTriplet, 0.22)}, transparent 55%)`,
        }}
      />

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="relative w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        style={isMobile ? { transform: "scale(1.65)", transformOrigin: "50% 55%" } : undefined}
      >
        <defs>
          <linearGradient id="swLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={rgbaFromRgbTriplet(accentTriplet, 0.15)} />
            <stop offset="35%" stopColor={rgbaFromRgbTriplet(accentTriplet, 0.95)} />
            <stop offset="100%" stopColor={rgbaFromRgbTriplet(accentTriplet, 0.25)} />
          </linearGradient>
          <linearGradient id="swArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={rgbaFromRgbTriplet(accentTriplet, 0.22)} />
            <stop offset="100%" stopColor={rgbaFromRgbTriplet(accentTriplet, 0.02)} />
          </linearGradient>
          <filter id="swGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path d={area} fill="url(#swArea)" />
        <path d={line} fill="none" stroke={glow} strokeWidth={6} filter="url(#swGlow)" />
        <path d={line} fill="none" stroke="url(#swLine)" strokeWidth={2.6} />
      </svg>

      {/* baseline */}
      <div className="absolute left-4 right-4 bottom-6 h-px bg-white/10" />
    </div>
  );
}


function formatCompact(n: number) {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(Math.round(n));
}

function AchievementCard({ a }: { a: Achievement }) {
  const pct = Math.max(0, Math.min(1, a.target <= 0 ? 0 : a.current / a.target));

  const RARITY: Record<Rarity, { label: string; rgb: string; pillBg: string; border: string; }> = {
    common: {
      label: "COMMON",
      rgb: "34,197,94", // green
      pillBg: "rgba(34,197,94,0.14)",
      border: "rgba(34,197,94,0.25)",
    },
    uncommon: {
      label: "UNCOMMON",
      rgb: "255,255,255", // white
      pillBg: "rgba(255,255,255,0.10)",
      border: "rgba(255,255,255,0.22)",
    },
    rare: {
      label: "RARE",
      rgb: "59,130,246", // blue
      pillBg: "rgba(59,130,246,0.14)",
      border: "rgba(59,130,246,0.25)",
    },
    epic: {
      label: "EPIC",
      rgb: "168,85,247", // purple
      pillBg: "rgba(168,85,247,0.16)",
      border: "rgba(168,85,247,0.28)",
    },
    legendary: {
      label: "LEGENDARY",
      rgb: "147,197,253", // sky-ish base
      pillBg: "rgba(255,255,255,0.12)",
      border: "rgba(255,255,255,0.35)",
    },
  };

  const meta = RARITY[a.rarity];

  const isLocked = !a.unlocked;

  const boxShadow =
    a.rarity === "legendary"
      ? `0 0 0 1px rgba(255,255,255,0.16), 0 0 24px rgba(255,255,255,0.18), 0 0 70px rgba(59,130,246,0.24)`
      : a.rarity === "epic"
        ? `0 0 22px rgba(168,85,247,0.22)`
        : a.rarity === "rare"
          ? `0 0 18px rgba(59,130,246,0.24)`
          : a.rarity === "uncommon"
            ? `0 0 16px rgba(255,255,255,0.10)`
            : `0 0 14px rgba(34,197,94,0.14)`;

  const lockedFade = isLocked ? "opacity-80" : "opacity-100";

  const barBg = isLocked ? "rgba(255,255,255,0.08)" : `rgba(${meta.rgb}, 0.14)`;
  const barFill =
    a.rarity === "legendary"
      ? "linear-gradient(90deg, rgba(255,255,255,0.95), rgba(59,130,246,0.75), rgba(255,255,255,0.55))"
      : `linear-gradient(90deg, rgba(${meta.rgb},0.95), rgba(${meta.rgb},0.55))`;

  // Legendary "Ultra Instinct" aura (soft, upward, not annoying)
  const legendaryOverlay =
    a.rarity === "legendary"
      ? "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(59,130,246,0.08), rgba(255,255,255,0.02))"
      : `linear-gradient(180deg, rgba(${meta.rgb},0.10), rgba(255,255,255,0.02))`;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-white/[0.03] backdrop-blur-xl ${lockedFade}`}
      style={{
        borderColor: meta.border,
        boxShadow: isLocked ? `0 0 0 1px ${meta.border}, 0 0 18px rgba(${meta.rgb},0.10)` : boxShadow,
      }}
    >
      <style>
        {`@keyframes uiRise {
          0% { transform: translateY(28px); opacity: 0; }
          18% { opacity: 0.42; }
          60% { opacity: 0.20; }
          100% { transform: translateY(-64px); opacity: 0; }
        }
        @keyframes uiShimmer {
          0% { transform: translateY(56px); opacity: 0; }
          25% { opacity: 0.18; }
          55% { opacity: 0.10; }
          100% { transform: translateY(-56px); opacity: 0; }
        }`}
      </style>

      {/* rarity tint */}
      <div className="pointer-events-none absolute inset-0" style={{ background: legendaryOverlay, opacity: isLocked ? 0.35 : 0.65 }} />

      {/* Legendary aura (Ultra Instinct) */}
      {a.rarity === "legendary" && (
        <>
          
          {/* Edge glow */}
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              boxShadow:
                "inset 0 0 0 1px rgba(255,255,255,0.20), 0 0 40px rgba(255,255,255,0.12), 0 0 90px rgba(59,130,246,0.14)",
              opacity: isLocked ? 0.35 : 1,
            }}
          />

          {/* Side aura (Ultra Instinct style) */}
          <div
            className="pointer-events-none absolute -left-12 top-6 bottom-6 w-28 rounded-full blur-2xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(255,255,255,0.46), rgba(59,130,246,0.24), transparent 72%)",
              animation: isLocked ? "none" : "uiRise 3.0s ease-in-out infinite",
            }}
          />
          <div
            className="pointer-events-none absolute -right-12 top-6 bottom-6 w-28 rounded-full blur-2xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(255,255,255,0.46), rgba(59,130,246,0.24), transparent 72%)",
              animation: isLocked ? "none" : "uiRise 3.0s ease-in-out infinite",
              animationDelay: "0.9s",
            }}
          />

          {/* Upward shimmer streaks */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.10) 45%, transparent 100%)",
              mixBlendMode: "screen",
              animation: isLocked ? "none" : "uiShimmer 4.2s ease-in-out infinite",
            }}
          />
<div
            className="pointer-events-none absolute -bottom-20 left-1/2 h-72 w-[520px] -translate-x-1/2 rounded-full blur-3xl"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.22), rgba(59,130,246,0.12), transparent 70%)",
              animation: isLocked ? "none" : "uiRise 3.6s ease-in-out infinite",
            }}
          />
          <div
            className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-[520px] -translate-x-1/2 rounded-full blur-3xl"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.18), rgba(59,130,246,0.10), transparent 70%)",
              animation: isLocked ? "none" : "uiRise 3.6s ease-in-out infinite",
              animationDelay: "1.6s",
            }}
          />
        </>
      )}

      <div className="relative p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/20">
              <Icon name={a.icon} className="h-5 w-5 text-white/80" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-white font-extrabold leading-tight">{a.title}</div>
                <span
                  className="text-[10px] font-black tracking-wider px-2 py-1 rounded-full border"
                  style={{
                    borderColor: meta.border,
                    background: meta.pillBg,
                    color: a.rarity === "uncommon" ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.88)",
                  }}
                >
                  {meta.label}
                </span>
              </div>
              <div className="mt-0.5 text-white/70 text-sm leading-snug">{a.description}</div>
            </div>
          </div>

          <div className="text-right">
            <div className={`text-[11px] font-bold ${a.unlocked ? "text-white/80" : "text-white/50"}`}>
              {a.unlocked ? "UNLOCKED" : "LOCKED"}
            </div>
            <div className="mt-1 text-xs text-white/55">
              {Math.min(a.current, a.target)}/{a.target} {a.unit ?? ""}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-white/55">
            <span>{Math.round(pct * 100)}%</span>
            <span className="text-white/40">{a.unlocked ? "Nice." : "Keep going"}</span>
          </div>

          <div className="mt-2 h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/30">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct * 100}%`,
                background: barFill,
                boxShadow: a.unlocked ? `0 0 16px rgba(${meta.rgb},0.18)` : "none",
              }}
            />
            <div className="pointer-events-none -mt-2 h-2 w-full" style={{ background: barBg, opacity: 0.35 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProgressPage() {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();

  const [activeTimeFrame, setActiveTimeFrame] = useState<TimeFrame>("weekly");
  const [metric, setMetric] = useState<Metric>("overall");

  const progressData = useQuery(api.progress.getProgressData, { timeFrame: activeTimeFrame }) as ProgressDay[] | undefined;

  const userStats = useQuery(api.routines.getUserStats);
  const workoutStats = useQuery(api.workouts.getWorkoutStats);
  const habitStats = useQuery(api.habits.getHabitStats);

  // Separate daily series for achievements like "Perfect Day"
  const dailyDataRaw = useQuery(api.progress.getProgressData, { timeFrame: "daily" }) as ProgressDay[] | undefined;
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

  const accentTriplet = useMemo(() => {
    // convert "#RRGGBB" -> "r, g, b"
    const hex = (colors.primary || "#00ccff").replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.slice(4, 6), 16) || 0;
    return `${r}, ${g}, ${b}`;
  }, [colors.primary]);


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
                <div className="text-white/35 text-xs">{latest ? latest.date : "—"}</div>
                <div className="mt-1 text-white/35 text-xs">{ordered.length ? `${ordered.length} checkpoints` : "No data yet"}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <div className="text-white/55 text-[11px] font-semibold">Average</div>
                <div className="mt-0.5 text-white font-black">{formatPct(avg)}%</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <div className="text-white/55 text-[11px] font-semibold">Best</div>
                <div className="mt-0.5 text-white font-black">{formatPct(best)}%</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <div className="text-white/55 text-[11px] font-semibold">Change</div>
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

      {/* TIMELINE (simple) */}
      <div className="rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl p-4 sm:p-5 animate-float-in max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="text-white font-bold">Timeline</div>
          <div className="text-white/35 text-xs">
            {ordered.length ? `${prettyDate(ordered[0].date)} → ${prettyDate(ordered[ordered.length - 1].date)}` : "—"}
          </div>
        </div>

        <div className="mt-3 force-ltr">
          <Sparkline points={points} accentTriplet={accentTriplet} />
        </div>

        <div className="mt-2 flex items-center justify-between text-white/35 text-xs force-ltr">
          <div>{ordered.length ? prettyDate(ordered[0].date) : "—"}</div>
          <div>{ordered.length ? prettyDate(ordered[ordered.length - 1].date) : "—"}</div>
        </div>
      </div>

      {/* ACHIEVEMENTS */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 overflow-hidden relative">
        <div
          className="absolute -inset-10 blur-2xl opacity-50"
          style={{
            background: `radial-gradient(circle at 15% 30%, rgba(${accentTriplet}, 0.18), transparent 60%)`,
          }}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="text-white font-black text-lg">Achievements</div>
            <div className="mt-1 text-white/55 text-sm">
              Reward badges for consistency. These update automatically from your real stats.
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-white/45 text-xs font-semibold">Unlocked</div>
            <div className="text-white font-extrabold">{unlockedCount}/{achievements.length}</div>
          </div>
        </div>

        
<div className="mt-3 flex flex-wrap gap-2">
  <span className="text-[10px] font-black tracking-wider px-2 py-1 rounded-full border"
        style={{ borderColor: "rgba(34,197,94,0.30)", background: "rgba(34,197,94,0.14)" }}>
    COMMON
  </span>
  <span className="text-[10px] font-black tracking-wider px-2 py-1 rounded-full border"
        style={{ borderColor: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.10)" }}>
    UNCOMMON
  </span>
  <span className="text-[10px] font-black tracking-wider px-2 py-1 rounded-full border"
        style={{ borderColor: "rgba(59,130,246,0.30)", background: "rgba(59,130,246,0.14)" }}>
    RARE
  </span>
  <span className="text-[10px] font-black tracking-wider px-2 py-1 rounded-full border"
        style={{ borderColor: "rgba(168,85,247,0.35)", background: "rgba(168,85,247,0.16)" }}>
    EPIC
  </span>
  <span className="text-[10px] font-black tracking-wider px-2 py-1 rounded-full border"
        style={{
          borderColor: "rgba(255,255,255,0.38)",
          background: "rgba(255,255,255,0.12)",
          boxShadow: "0 0 18px rgba(255,255,255,0.14), 0 0 50px rgba(59,130,246,0.24)"
        }}>
    LEGENDARY
  </span>
</div>

<div className="relative mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{achievementsSorted.map((a) => (
            <AchievementCard key={a.id} a={a} />
          ))}
        </div>
      </div>

    </div>
  );
}