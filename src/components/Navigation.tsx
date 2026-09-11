import { useTheme } from "../contexts/ThemeContext";
import { Icon, IconName } from "./icons";

interface NavigationProps {
  currentPage: "today" | "routines" | "workout" | "habits" | "progress" | "athkar" | "macros" | "workspace";
  hiddenPages: string[];
  onPageChange: (page: NavigationProps["currentPage"]) => void;
}

export function Navigation({ currentPage, onPageChange, hiddenPages }: NavigationProps) {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();

  const pages: { id: NavigationProps["currentPage"]; name: string; icon: IconName }[] = [
    { id: "today", name: "Today", icon: "calendar" },
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
        <div className="scrollbar-hide flex items-center gap-1 overflow-x-auto py-2 sm:justify-center sm:gap-1.5">
          {pages.filter(page => !hiddenPages.includes(page.id)).map((page) => {
            const active = currentPage === page.id;
            return (
              <button
                key={page.id}
                onClick={() => onPageChange(page.id)}
                onPointerUp={(event) => {
                  if (event.pointerType !== "mouse") event.currentTarget.blur();
                }}
                aria-current={active ? "page" : undefined}
                aria-label={page.name}
                className={`sw-nav-button group relative flex min-w-[60px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-1.5 text-sm font-medium transition-all duration-200 sm:flex-row sm:gap-2 sm:px-3.5 sm:py-2 ${
                  active
                    ? "border-white/15 bg-white/[0.06] text-white shadow-lg"
                    : `border-transparent ${colors.textSecondary} sm:hover:border-white/10 sm:hover:bg-white/[0.04] sm:hover:text-white`
                }`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-lg border transition ${active ? colors.border : "border-white/10 bg-white/[0.025] sm:group-hover:bg-white/[0.05]"}`}
                  style={active ? { background: "linear-gradient(135deg, rgb(var(--sw-accent-rgb) / 0.18), rgb(var(--sw-accent-rgb) / 0.05))" } : undefined}
                >
                  <Icon name={page.icon} className={`h-4 w-4 ${active ? colors.text : "text-white/55 sm:group-hover:text-white/80"}`} />
                </span>
                <span className="text-[10px] sm:text-sm">{page.name}</span>
                {active && <span className="absolute inset-x-4 -bottom-1.5 h-px sm:-bottom-2 bg-[image:var(--sw-gradient)] shadow-[0_0_10px_var(--sw-accent)]" />}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
