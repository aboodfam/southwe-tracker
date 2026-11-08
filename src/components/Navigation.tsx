import { useEffect, useRef } from "react";
import { t as tr, useLocale } from "../i18n";
import { useTheme } from "../contexts/ThemeContext";
import { Icon, IconName } from "./icons";

interface NavigationProps {
  currentPage: "today" | "routines" | "workout" | "habits" | "progress" | "athkar" | "macros" | "workspace";
  hiddenPages: string[];
  onPageChange: (page: NavigationProps["currentPage"]) => void;
}

export function Navigation({ currentPage, onPageChange, hiddenPages }: NavigationProps) {
  const locale = useLocale();
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const strip = useRef<HTMLDivElement>(null);
  const visibleKey = hiddenPages.join("|");
  useEffect(() => {
    const container = strip.current;
    const active = container?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!container || !active) return;
    const box = container.getBoundingClientRect();
    const target = active.getBoundingClientRect();
    const left = container.scrollLeft + target.left - box.left - (box.width - target.width) / 2;
    container.scrollTo({ left, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [currentPage, visibleKey, locale]);

  const pages: { id: NavigationProps["currentPage"]; name: string; icon: IconName }[] = [
    { id: "today", name: tr("Home"), icon: "home" },
    { id: "routines", name: tr("Routines"), icon: "routines" },
    { id: "workout", name: tr("Workout"), icon: "workout" },
    { id: "habits", name: tr("Habits"), icon: "habits" },
    { id: "progress", name: tr("Progress"), icon: "progress" },
    { id: "athkar", name: tr("Athkar"), icon: "athkar" },
    { id: "macros", name: tr("Macros"), icon: "macros" },
  ];

  return (
    <nav data-page-chrome aria-label={tr("Main navigation")} className={`border-b ${colors.border}`}>
      <div className="container mx-auto px-2 sm:px-4">
        <div ref={strip} className="scrollbar-hide flex items-center gap-1 overflow-x-auto py-1 sm:py-2 sm:justify-start lg:justify-center sm:gap-1.5">
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
                className={`sw-nav-button group relative flex min-w-[60px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-1 text-sm font-medium transition-all duration-200 sm:flex-row sm:gap-2 sm:px-3.5 sm:py-2 ${
                  active
                    ? "border-white/15 bg-white/[0.06] text-white shadow-lg"
                    : `border-transparent ${colors.textSecondary} sm:hover:border-white/10 sm:hover:bg-white/[0.04] sm:hover:text-white`
                }`}
              >
                <span
                  className={`grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-lg border transition ${active ? colors.border : "border-white/10 bg-white/[0.025] sm:group-hover:bg-white/[0.05]"}`}
                  style={active ? { background: "linear-gradient(135deg, rgb(var(--sw-accent-rgb) / 0.18), rgb(var(--sw-accent-rgb) / 0.05))" } : undefined}
                >
                  <Icon name={page.icon} className={`h-4 w-4 ${active ? colors.text : "text-white/55 sm:group-hover:text-white/80"}`} />
                </span>
                <span className="text-[10px] leading-[14px] sm:text-sm">{page.name}</span>
                {active && <span className="absolute inset-x-4 -bottom-1.5 h-px sm:-bottom-2 bg-[image:var(--sw-gradient)] shadow-[0_0_10px_var(--sw-accent)]" />}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
