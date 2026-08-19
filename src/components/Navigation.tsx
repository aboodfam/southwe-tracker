import { useTheme } from "../contexts/ThemeContext";
import { Icon, IconName } from "./icons";

interface NavigationProps {
  currentPage: "routines" | "workout" | "habits" | "progress" | "athkar" | "macros";
  onPageChange: (page: "routines" | "workout" | "habits" | "progress" | "athkar" | "macros") => void;
}

export function Navigation({ currentPage, onPageChange }: NavigationProps) {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();

  const pages: { id: NavigationProps["currentPage"]; name: string; icon: IconName }[] = [
    { id: "routines", name: "Routines", icon: "routines" },
    { id: "workout", name: "Workout", icon: "workout" },
    { id: "habits", name: "Habits", icon: "habits" },
    { id: "progress", name: "Progress", icon: "progress" },
    { id: "athkar", name: "Athkar", icon: "athkar" },
    { id: "macros", name: "Macros", icon: "macros" },
  ];

  return (
    <nav className={`sticky top-16 sm:top-20 z-40 border-b ${colors.border} ${colors.backgroundSecondary} backdrop-blur-xl`}>
      <div className="container mx-auto px-2 sm:px-4">
        <div className="scrollbar-hide flex items-center justify-start gap-1 overflow-x-auto py-2 sm:justify-center sm:gap-1.5">
          {pages.map((page) => {
            const active = currentPage === page.id;
            return (
              <button
                key={page.id}
                onClick={() => onPageChange(page.id)}
                className={`group relative flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-sm font-medium transition-all duration-200 sm:px-3.5 ${
                  active
                    ? "border-white/15 bg-white/[0.06] text-white shadow-lg"
                    : `border-transparent ${colors.textSecondary} hover:border-white/10 hover:bg-white/[0.04] hover:text-white`
                }`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-lg border transition ${active ? colors.border : "border-white/10 bg-white/[0.025] group-hover:bg-white/[0.05]"}`}
                  style={active ? { background: "linear-gradient(135deg, rgb(var(--sw-accent-rgb) / 0.18), rgb(var(--sw-accent-rgb) / 0.05))" } : undefined}
                >
                  <Icon name={page.icon} className={`h-4 w-4 ${active ? colors.text : "text-white/55 group-hover:text-white/80"}`} />
                </span>
                <span className="hidden sm:inline">{page.name}</span>
                {active && <span className="absolute inset-x-4 -bottom-2 h-px bg-[image:var(--sw-gradient)] shadow-[0_0_10px_var(--sw-accent)]" />}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
