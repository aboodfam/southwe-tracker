import { useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";

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
      { label: "Days Completed", value: safeStats.totalDaysCompleted, icon: "🏆", color: "text-yellow-400" },
      { label: "Current Streak", value: safeStats.currentStreak, icon: "🔥", color: "text-orange-400" },
      { label: "Longest Streak", value: safeStats.longestStreak, icon: "⚡", color: colors.text },
      { label: "Tasks Completed", value: safeStats.totalTasksCompleted, icon: "✅", color: "text-green-400" },
      { label: "Avg Completion", value: `${safeStats.averageCompletionRate.toFixed(0)}%`, icon: "📊", color: "text-purple-400" },
    ],
    [safeStats, colors.text]
  );

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-slide-up">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`${colors.backgroundSecondary} backdrop-blur-sm border border-gray-700/30 rounded-lg p-4 animate-pulse`}
          >
            <div className="h-4 bg-gray-800 rounded mb-2" />
            <div className="h-6 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-slide-up">
      {statItems.map((stat, index) => (
        <div
          key={index}
          className={`${colors.backgroundSecondary} backdrop-blur-sm border ${colors.border} rounded-lg p-4 hover:${colors.borderHover} transition-all duration-200 group relative overflow-hidden animate-fade-in`}
          style={{ animationDelay: `${index * 70}ms`, animationFillMode: "both" }}
        >
          {/* Subtle particle effect */}
          <div className="absolute inset-0 opacity-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`absolute w-0.5 h-0.5 ${colors.text.replace("text-", "bg-")} rounded-full`}
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
              />
            ))}
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{stat.icon}</span>
              <div className={`w-2 h-2 rounded-full ${colors.text.replace("text-", "bg-")}`} />
            </div>
            <div className={`text-xs ${colors.textSecondary} mb-1`}>{stat.label}</div>
            <div className={`text-xl font-bold ${stat.color} group-hover:scale-110 transition-transform duration-200`}>
              {stat.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
