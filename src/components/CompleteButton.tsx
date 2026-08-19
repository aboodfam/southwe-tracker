import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useTheme } from "../contexts/ThemeContext";
import { useSound } from "../contexts/SoundContext";
import { Icon } from "./icons";
import { useLocalDateKey } from "../hooks/useLocalDateKey";

export function CompleteButton() {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { play } = useSound();
  const dateKey = useLocalDateKey();

  const routines = useQuery(api.routines.getRoutines);
  const completeDay = useMutation(api.routines.completeDay);
  const todayProgress = useQuery(api.routines.getTodayProgress, { dateKey });

  const handleCompleteDay = async () => {
    try {
      await completeDay({ dateKey });
      play("complete", 1.25);
      toast.success("Day locked in. Progress will reset tomorrow.", {
        style: {
          background: "rgb(var(--sw-accent-rgb) / 0.12)",
          border: "1px solid rgb(var(--sw-accent-rgb) / 0.35)",
          color: "white",
        },
      });
    } catch {
      toast.error("Failed to complete day");
    }
  };

  if (!routines) return null;

  const totalTasks = routines.reduce((sum, routine) => sum + routine.tasks.length, 0);
  const completedTasks = routines.reduce((sum, routine) => sum + routine.tasks.filter((task) => task.completed).length, 0);
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const isAlreadyCompleted = todayProgress?.countedInStats === true;
  const remaining = Math.max(0, Math.ceil(((80 - completionRate) * totalTasks) / 100));

  return (
    <div className="text-center">
      <div className={`${colors.backgroundSecondary} relative overflow-hidden rounded-2xl border ${colors.border} p-5 backdrop-blur-sm sm:p-6`}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[image:var(--sw-gradient)] opacity-[0.08] blur-3xl" />
        <div className="relative z-10">
          <div className="mb-5 flex items-center justify-between gap-3 text-left">
            <div>
              <h3 className={`text-lg font-semibold ${colors.text}`}>Daily Progress</h3>
              <p className={`mt-1 text-xs ${colors.textSecondary}`}>Reach 80% to lock in the day.</p>
            </div>
            <div className={`grid h-10 w-10 place-items-center rounded-xl border ${colors.border} bg-white/[0.035]`}>
              <Icon name={isAlreadyCompleted ? "checkCircle" : "chart"} className={`h-5 w-5 ${colors.text}`} />
            </div>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2">
            {[
              ["Completed", completedTasks],
              ["Total", totalTasks],
              ["Progress", `${completionRate.toFixed(0)}%`],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3">
                <div className="text-xl font-bold text-white">{value}</div>
                <div className={`mt-1 text-[11px] ${colors.textSecondary}`}>{label}</div>
              </div>
            ))}
          </div>

          <div className="mb-5 h-2 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="h-full rounded-full bg-[image:var(--sw-gradient)] transition-all duration-500" style={{ width: `${Math.min(100, completionRate)}%` }} />
          </div>

          <button
            onClick={handleCompleteDay}
            disabled={isAlreadyCompleted || completionRate < 80}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold transition duration-200 ${
              isAlreadyCompleted
                ? "cursor-not-allowed border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                : completionRate >= 80
                  ? `bg-[image:var(--sw-gradient)] text-black shadow-lg ${colors.shadow} hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0`
                  : "cursor-not-allowed border border-white/10 bg-white/[0.03] text-white/40"
            }`}
          >
            <Icon name={isAlreadyCompleted ? "checkCircle" : completionRate >= 80 ? "check" : "info"} className="h-4 w-4" />
            {isAlreadyCompleted ? "Day Completed" : completionRate >= 80 ? "Complete Day" : `Complete ${remaining} more task${remaining === 1 ? "" : "s"}`}
          </button>

          {isAlreadyCompleted && <p className="mt-2 text-xs text-emerald-300/60">Tasks reset automatically tomorrow.</p>}
        </div>
      </div>
    </div>
  );
}
