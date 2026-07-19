import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useTheme } from '../contexts/ThemeContext';
import { useSound } from "../contexts/SoundContext";

export function CompleteButton() {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { play } = useSound();
  
  const routines = useQuery(api.routines.getRoutines);
  const completeDay = useMutation(api.routines.completeDay);
  const todayProgress = useQuery(api.routines.getTodayProgress);

  const handleCompleteDay = async () => {
    try {
      await completeDay();
      // Big reward
      play("complete", 1.25);
      toast.success("Day completed! All tasks reset for tomorrow.", {
  style: {
    background: "rgba(var(--accent-rgb), 0.12)",
    border: "1px solid rgba(var(--accent-rgb), 0.35)",
    color: "rgb(var(--accent-light-rgb))",
  },
});

    } catch (error) {
      toast.error("Failed to complete day");
    }
  };

  if (!routines) return null;

  const totalTasks = routines.reduce((sum, routine) => sum + routine.tasks.length, 0);
  const completedTasks = routines.reduce(
    (sum, routine) => sum + routine.tasks.filter(task => task.completed).length,
    0
  );
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const isAlreadyCompleted = todayProgress !== null;

  return (
    <div className="text-center space-y-4">
      <div className={`${colors.backgroundSecondary} backdrop-blur-sm border ${colors.border} rounded-lg p-6 relative overflow-hidden`}>
        {/* Particle effect */}
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className={`absolute w-0.5 h-0.5 ${colors.text.replace('text-', 'bg-')} rounded-full`}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10">
          <h3 className={`text-xl font-bold ${colors.text} mb-4`}>Daily Progress</h3>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className={`text-2xl font-bold ${colors.text}`}>{completedTasks}</div>
              <div className={`text-xs ${colors.textSecondary}`}>Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-300">{totalTasks}</div>
              <div className={`text-xs ${colors.textSecondary}`}>Total</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${colors.text}`}>{completionRate.toFixed(0)}%</div>
              <div className={`text-xs ${colors.textSecondary}`}>Progress</div>
            </div>
          </div>

          <div className="w-full bg-gray-800/50 rounded-full h-3 mb-6 overflow-hidden">
            <div 
              className={`h-full bg-[image:var(--sw-gradient)] transition-all duration-500 ease-out relative`}
              style={{ width: `${completionRate}%` }}
            >
            </div>
          </div>

          <button
            onClick={handleCompleteDay}
            disabled={isAlreadyCompleted}
            className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-all duration-200 ${
              isAlreadyCompleted
                ? "bg-green-500/20 border-2 border-green-500/30 text-green-300 cursor-not-allowed"
                : completionRate >= 80
                ? `bg-[image:var(--sw-gradient)] text-black shadow-lg ${colors.shadow} transform hover:scale-105`
                : `${colors.backgroundTertiary} border-2 border-gray-700/50 text-gray-400 hover:${colors.borderHover} hover:${colors.textSecondary}`
            }`}
          >
            {isAlreadyCompleted ? (
              <span className="flex items-center justify-center gap-2">
                ✅ Day Completed
              </span>
            ) : completionRate >= 80 ? (
              <span className="flex items-center justify-center gap-2">
                🚀 Complete Day
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                ⚠️ Complete More Tasks ({Math.ceil((80 - completionRate) * totalTasks / 100)} remaining)
              </span>
            )}
          </button>

          {isAlreadyCompleted && (
            <p className="text-xs text-green-400/70 mt-2">
              Tasks will reset automatically tomorrow
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
