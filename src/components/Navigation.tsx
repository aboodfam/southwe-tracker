import { useTheme } from "../contexts/ThemeContext";

interface NavigationProps {
  currentPage: "routines" | "workout" | "habits" | "progress" | "athkar" | "macros" | "weight";
  onPageChange: (page: "routines" | "workout" | "habits" | "progress" | "athkar" | "macros" | "weight") => void;
}

export function Navigation({ currentPage, onPageChange }: NavigationProps) {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();

  const pages = [
    { id: "routines" as const, name: "Routines", icon: "📋" },
    { id: "workout" as const, name: "Workout", icon: "💪" },
    { id: "habits" as const, name: "Habits", icon: "🎯" },
    { id: "progress" as const, name: "Progress", icon: "📊" },
    { id: "athkar" as const, name: "Athkar", icon: "📿" },
    { id: "macros" as const, name: "Macros", icon: "🍎" },
    { id: "weight" as const, name: "Weight", icon: "⚖️" },
  ];

  return (
    <nav className={`sticky top-16 sm:top-20 z-40 ${colors.backgroundSecondary} backdrop-blur-md border-b ${colors.border} shadow-lg`}>
      <div className="container mx-auto px-4">
        <div className="flex justify-center">
          <div className="flex gap-1 sm:gap-2 p-2 overflow-x-auto">
            {pages.map((page) => (
              <button
                key={page.id}
                onClick={() => onPageChange(page.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl text-sm sm:text-base font-medium transition-all duration-300 whitespace-nowrap ${
                  currentPage === page.id
                    ? `bg-[image:var(--sw-gradient)] text-black shadow-lg`
                    : `${colors.textSecondary} hover:${colors.text} hover:bg-white/5`
                }`}
              >
                <span className="text-lg sm:text-xl">{page.icon}</span>
                <span className="hidden sm:inline">{page.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
