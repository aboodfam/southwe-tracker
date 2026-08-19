import { useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { Icon, IconName } from "./icons";

interface UserStats {
  totalDaysCompleted: number;
  currentStreak: number;
  longestStreak: number;
  totalTasksCompleted: number;
  averageCompletionRate: number;
}

interface StatsPanelProps {
  stats: UserStats | null | undefined;
  isLoading?: boolean;
}

export function StatsPanel({ stats, isLoading }: StatsPanelProps) {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const loading = isLoading ?? stats === undefined;

  const safeStats: UserStats = stats ?? {
    totalDaysCompleted: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalTasksCompleted: 0,
    averageCompletionRate: 0,
  };

  const statItems = useMemo(
    () => [
      { label: "Days Completed", value: safeStats.totalDaysCompleted, icon: "trophy" as IconName },
      { label: "Current Streak", value: safeStats.currentStreak, icon: "flame" as IconName },
      { label: "Longest Streak", value: safeStats.longestStreak, icon: "bolt" as IconName },
      { label: "Tasks Completed", value: safeStats.totalTasksCompleted, icon: "checkCircle" as IconName },
      { label: "Avg Completion", value: `${safeStats.averageCompletionRate.toFixed(0)}%`, icon: "chart" as IconName },
    ],
    [safeStats.totalDaysCompleted, safeStats.currentStreak, safeStats.longestStreak, safeStats.totalTasksCompleted, safeStats.averageCompletionRate]
  );

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 animate-slide-up">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`${i === 4 ? "col-span-2 md:col-span-1" : ""} ${colors.backgroundSecondary} rounded-2xl border ${colors.border} p-3.5 sm:p-4 backdrop-blur-sm animate-pulse`}>
            <div className="mb-4 h-9 w-9 rounded-xl bg-white/[0.05]" />
            <div className="mb-2 h-3 w-20 rounded bg-white/[0.05]" />
            <div className="h-6 w-12 rounded bg-white/[0.08]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5 animate-slide-up">
      {statItems.map((stat, index) => (
        <div
          key={stat.label}
          className={`${index === 4 ? "col-span-2 md:col-span-1" : ""} ${colors.backgroundSecondary} group relative overflow-hidden rounded-2xl border ${colors.border} p-3.5 sm:p-4 backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.04] animate-fade-in`}
          style={{ animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
        >
          <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-[image:var(--sw-gradient)] opacity-[0.06] blur-2xl transition group-hover:opacity-[0.12]" />
          <div className="relative z-10">
            <div className="mb-3.5 flex items-center justify-between sm:mb-4">
              <span className={`grid h-9 w-9 place-items-center rounded-xl border ${colors.border} bg-white/[0.035]`}>
                <Icon name={stat.icon} className={`h-[18px] w-[18px] ${colors.text}`} />
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--sw-accent)] shadow-[0_0_10px_var(--sw-accent)]" />
            </div>
            <div className={`mb-1 text-[11px] font-medium uppercase tracking-[0.08em] ${colors.textSecondary}`}>{stat.label}</div>
            <div className="text-xl font-bold text-white transition-transform duration-200 group-hover:translate-x-0.5">{stat.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
