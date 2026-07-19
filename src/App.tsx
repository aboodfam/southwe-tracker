import { Authenticated, Unauthenticated, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster, toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { RoutineCard } from "./components/RoutineCard";
import { StatsPanel } from "./components/StatsPanel";
import { CompleteButton } from "./components/CompleteButton";
import { WorkoutPage } from "./components/WorkoutPage";
import { HabitsPage } from "./components/HabitsPage";
import { ProgressPage } from "./components/ProgressPage";
import { AthkarPage } from "./components/AthkarPage";
import { MacrosPage } from "./components/MacrosPage";
import { WeightTrackerPage } from "./components/WeightTrackerPage";
import { Navigation } from "./components/Navigation";
import { ThemeSelector } from "./components/ThemeSelector";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { SoundProvider } from "./contexts/SoundContext";
import { useSound } from "./contexts/SoundContext";
import { useDailyReset } from "./hooks/useDailyReset";

type Page = "routines" | "workout" | "habits" | "progress" | "athkar" | "macros" | "weight";

/* =========================
   Helpers
   ========================= */
type RGB = { r: number; g: number; b: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function rgba(c: RGB, a: number) {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

/**
 * Accepts:
 *  - "rgb(r,g,b)"
 *  - "#rrggbb"
 *  - "#rgb"
 */
function parseColorToRgb(input: string): RGB {
  if (!input) return { r: 255, g: 255, b: 255 };

  const rgb = input.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };

  const hex = input.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      return { r, g, b };
    }
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b };
  }

  return { r: 255, g: 255, b: 255 };
}

/* =========================
   STARFIELD / PARTICLES
   ✅ full page height (scroll-safe)
   ========================= */
function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const { theme, getThemeColors } = useTheme();
  const colors = getThemeColors();

  const makeVisible = (c: RGB): RGB => {
    const brightness = c.r + c.g + c.b;
    if (brightness < 140) return { r: 220, g: 220, b: 220 };
    return c;
  };

  const palette = useMemo(() => {
    const accent = makeVisible(parseColorToRgb(colors.primary));
    const tint = makeVisible(parseColorToRgb(colors.primaryLight));
    const white: RGB = { r: 245, g: 245, b: 245 };
    return { tint, accent, white };
  }, [theme, colors.primary, colors.primaryLight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      w = Math.floor(window.innerWidth);
      h = Math.floor(window.innerHeight);

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const area = w * h;
    const isWhite = theme === "white";

    const starCount = isWhite
      ? clamp(Math.floor(area / 6200), 260, 620)
      : clamp(Math.floor(area / 9000), 180, 420);

    const glowCount = isWhite
      ? clamp(Math.floor(area / 130000), 12, 26)
      : clamp(Math.floor(area / 170000), 7, 16);

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    type Star = {
      x: number;
      y: number;
      r: number;
      a: number;
      vx: number;
      vy: number;
      mix: "tint" | "white";
    };

    type Glow = { x: number; y: number; r: number; a: number };

    const stars: Star[] = Array.from({ length: starCount }).map(() => {
      const big = Math.random() < (isWhite ? 0.08 : 0.12);

      const speed = isWhite
        ? (big ? rand(0.04, 0.085) : rand(0.025, 0.06))
        : (big ? rand(0.06, 0.14) : rand(0.035, 0.10));

      return {
        x: rand(0, w),
        y: rand(0, h),
        r: isWhite ? (big ? rand(0.95, 1.75) : rand(0.4, 1.05)) : (big ? rand(1.05, 2.1) : rand(0.55, 1.35)),
        a: isWhite ? (big ? rand(0.55, 0.85) : rand(0.22, 0.60)) : (big ? rand(0.55, 0.9) : rand(0.18, 0.55)),
        vx: (isWhite ? rand(-0.8, 0.8) : rand(-1, 1)) * speed,
        vy: (isWhite ? rand(0.5, 1.2) : rand(0.2, 1)) * speed,
        mix: Math.random() < (isWhite ? 0.08 : 0.18) ? "white" : "tint",
      };
    });

    const glows: Glow[] = Array.from({ length: glowCount }).map(() => ({
      x: rand(-w * 0.1, w * 1.1),
      y: rand(-h * 0.1, h * 1.1),
      r: rand(180, 360),
      a: rand(0.06, 0.11),
    }));

    const FPS = 30;
    const frameInterval = 1000 / FPS;
    let lastTime = 0;

    const draw = (time: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (time - lastTime < frameInterval) return;
      lastTime = time;

      ctx.clearRect(0, 0, w, h);

      for (const g of glows) {
        const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
        grad.addColorStop(0, rgba(palette.accent, g.a));
        grad.addColorStop(0.55, rgba(palette.accent, g.a * 0.28));
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;

        if (s.x < -10) s.x = w + 10;
        if (s.x > w + 10) s.x = -10;
        if (s.y < -10) s.y = h + 10;
        if (s.y > h + 10) s.y = -10;

        const c = s.mix === "white" ? palette.white : palette.tint;

        if (s.r > 1.5) {
          ctx.fillStyle = rgba(c, s.a * 0.22);
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = rgba(c, s.a);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [palette, theme]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/45" />
    </div>
  );
}

/* =========================
   Create New Block (animated + readable inputs)
   ========================= */
function CreateRoutineCard() {
  const { theme, getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { play } = useSound();

  const createRoutine = useMutation(api.routines.createRoutine);

  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);

  const [name, setName] = useState("");
  const [timeSlot, setTimeSlot] = useState("");

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const t = setTimeout(() => setEntered(true), 10);
    return () => clearTimeout(t);
  }, [open]);

  const isWhite = theme === "white";

  // ✅ readable text (fix)
  const inputBase = isWhite
    ? `bg-white/70 text-gray-900 placeholder:text-gray-500 border border-black/10`
    : `bg-black/35 text-white placeholder:text-white/35 border ${colors.borderHover}`;

  const handleCreate = async () => {
    const n = name.trim();
    const t = timeSlot.trim();

    if (!n) return toast.error("Block name is required");
    if (!t) return toast.error("Time is required");

    try {
      await createRoutine({ name: n, timeSlot: t });
      setName("");
      setTimeSlot("");
      setOpen(false);
      toast.success("Block created");
      play("notification", 0.9);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create block");
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={[
          "group relative w-full",
          "p-4 sm:p-6 rounded-2xl",
          "border-2 border-dashed border-gray-700/30",
          "text-gray-300 text-sm font-medium",
          "transition-all duration-300 ease-out",
          "hover:scale-[1.01] active:scale-[0.99]",
          "hover:border-white/20",
        ].join(" ")}
      >
        <div
          className={[
            "pointer-events-none absolute inset-0 rounded-2xl opacity-0",
            "transition-opacity duration-300",
            "group-hover:opacity-100",
          ].join(" ")}
          style={{
            boxShadow: `0 0 40px ${colors.primary.replace("rgb(", "rgba(").replace(")", ",0.14)")}`,
          }}
        />

        <span className="relative z-10 flex items-center justify-center gap-2">
          <span
            className={[
              "inline-flex items-center justify-center",
              "w-9 h-9 rounded-xl",
              "border border-white/10",
              "bg-white/5",
              "transition-all duration-300",
              "group-hover:bg-white/8",
            ].join(" ")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </span>

          <span className="flex flex-col items-start leading-tight">
            <span className="text-base sm:text-[15px]">Add New Block</span>
            <span className="text-xs text-white/40">Name it • set time • add tasks</span>
          </span>
        </span>
      </button>
    );
  }

  return (
    <div
      className={[
        "relative rounded-2xl overflow-hidden",
        "shadow-2xl backdrop-blur-md border",
        colors.border,
        colors.backgroundSecondary,
        "transition-all duration-300 ease-out",
        entered ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-[0.99]",
      ].join(" ")}
    >
      <div
        className="absolute inset-x-0 -top-24 h-24 blur-2xl opacity-60"
        style={{
          background: `linear-gradient(90deg, transparent, ${colors.primary.replace("rgb(", "rgba(").replace(")", ",0.35)")}, transparent)`,
        }}
      />

      <div className="relative z-10 p-4 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className={`text-lg sm:text-xl font-bold ${colors.text}`}>Create New Block</h3>
            <p className={`${colors.textSecondary} text-sm mt-1`}>
              Keep it clean: one block = one time window.
            </p>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-200 transition-colors rounded-lg hover:bg-white/5"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-white/45">Block name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Morning / Study / Night..."
              className={[
                "w-full rounded-xl px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-white/10",
                inputBase,
              ].join(" ")}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/45">Time</label>
            <input
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
              placeholder="5:00AM / Afternoon / 9:00PM"
              className={[
                "w-full rounded-xl px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-white/10",
                inputBase,
              ].join(" ")}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleCreate}
            className={[
              "flex-1 px-4 py-2 rounded-xl text-sm font-semibold",
              "bg-[image:var(--sw-gradient)]",
              "text-black",
              "transition-all duration-300",
              "hover:brightness-110 active:scale-[0.99]",
            ].join(" ")}
          >
            Create
          </button>

          <button
            onClick={() => setOpen(false)}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-white/10 text-white hover:bg-white/15 transition-all duration-300 active:scale-[0.99]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================= */

export default function App() {
  return (
    <ThemeProvider>
      <SoundProvider>
        <AppContent />
      </SoundProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>("routines");
  const [swapKey, setSwapKey] = useState(0);
  const [swapDir, setSwapDir] = useState<"left" | "right">("left");
  const { theme, getThemeColors } = useTheme();
  const colors = getThemeColors();

  // Daily reset hook
  useDailyReset();

  const PAGE_ORDER: Page[] = ["routines", "workout", "habits", "progress", "athkar", "macros", "weight"];

  const goPrev = () => {
    const idx = PAGE_ORDER.indexOf(currentPage);
    const next = PAGE_ORDER[(idx - 1 + PAGE_ORDER.length) % PAGE_ORDER.length];
    setCurrentPage(next);
  };

  const goNext = () => {
    const idx = PAGE_ORDER.indexOf(currentPage);
    const next = PAGE_ORDER[(idx + 1) % PAGE_ORDER.length];
    setCurrentPage(next);
  };

  const swipeRef = useRef({ x: 0, y: 0, active: false, locked: false });

  const shouldIgnoreSwipe = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    // Avoid swiping when interacting with controls or horizontally scrollable areas
    return !!target.closest(
      "button, a, input, textarea, select, [role='button'], [data-no-swipe], [contenteditable='true']"
    );
  };

  const onTouchStart = (e: any) => {
    if (shouldIgnoreSwipe(e.target)) return;
    const t = e.touches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY, active: true, locked: false };
  };

  const onTouchMove = (e: any) => {
    if (!swipeRef.current.active || swipeRef.current.locked) return;
    const t = e.touches[0];
    const dx = t.clientX - swipeRef.current.x;
    const dy = t.clientY - swipeRef.current.y;

    // If the user is scrolling vertically, don't hijack.
    if (Math.abs(dy) > Math.abs(dx) * 1.2) {
      swipeRef.current.active = false;
      return;
    }

    // Trigger swipe when horizontal intent is clear
    const THRESH = 70;
    if (Math.abs(dx) > THRESH && Math.abs(dx) > Math.abs(dy) * 1.4) {
      swipeRef.current.locked = true;
      if (dx < 0) goNext();
      else goPrev();
      // small delay to avoid multiple triggers
      window.setTimeout(() => {
        swipeRef.current.active = false;
        swipeRef.current.locked = false;
      }, 220);
    }
  };

  const onTouchEnd = () => {
    swipeRef.current.active = false;
    swipeRef.current.locked = false;
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${colors.background} relative overflow-hidden`}>
      <StarfieldBackground key={theme} />

      <header className={`relative z-50 ${colors.backgroundSecondary} backdrop-blur-md border-b ${colors.border} shadow-2xl`}>
        <div className="container mx-auto px-4 h-16 sm:h-20 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br  rounded-lg flex items-center justify-center shadow-lg ${colors.shadow}`}>
                <span className="text-black font-bold text-sm sm:text-lg">S</span>
              </div>
            </div>
            <h2 className={`text-lg sm:text-2xl font-bold bg-[image:var(--sw-gradient)] bg-clip-text text-transparent`}>
              SouthWe System
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <ThemeSelector />
            <SignOutButton />
          </div>
        </div>
      </header>

      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />

      <main className="relative z-10 container mx-auto px-4 py-4 sm:py-8 pb-safe" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div key={swapKey} className={swapDir === "left" ? "sw-page-swap-left" : "sw-page-swap-right"}>
        <Content currentPage={currentPage} />
                </div>
        </main>

      <Toaster />
    </div>
  );
}

function Content({ currentPage }: { currentPage: Page }) {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="relative">
          <div
            className={`animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 ${colors.border}/30`}
            style={{ borderTopColor: colors.primary }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <Authenticated>
        {currentPage === "routines" && <RoutinesContent loggedInUser={loggedInUser} />}
        {currentPage === "workout" && <WorkoutPage />}
        {currentPage === "habits" && <HabitsPage />}
        {currentPage === "progress" && <ProgressPage />}
        {currentPage === "athkar" && <AthkarPage />}
        {currentPage === "macros" && <MacrosPage />}
        {currentPage === "weight" && <WeightTrackerPage />}
      </Authenticated>

      <Unauthenticated>
        <div className="text-center space-y-6 sm:space-y-8 animate-fade-in px-4">
<div className="relative">
  {/* Premium controlled glow (smaller + softer) */}
  <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
    <div
      className={`h-16 sm:h-20 w-[320px] sm:w-[520px] rounded-full bg-[image:var(--sw-gradient)] opacity-10 blur-2xl`}
    />
  </div>

  <h1
    className={`text-4xl sm:text-5xl md:text-7xl font-bold bg-[image:var(--sw-gradient)] bg-clip-text text-transparent`}
  >
    SouthWe System
  </h1>
</div>

          <p className={`${colors.textSecondary} text-lg sm:text-xl`}>Transform your daily habits</p>
          <div className={`w-24 sm:w-32 h-1 bg-[image:var(--sw-gradient)] mx-auto rounded-full`} />
          <SignInForm />
        </div>
      </Unauthenticated>
    </div>
  );
}

function RoutinesContent({ loggedInUser }: { loggedInUser: any }) {
  const routines = useQuery(api.routines.getRoutines);
  const userStats = useQuery(api.routines.getUserStats);

  const resetDailyTasks = useMutation(api.routines.resetDailyTasks);
  const ensureUserStats = useMutation(api.routines.ensureUserStats);
  const createRoutine = useMutation(api.routines.createRoutine);

  const { getThemeColors } = useTheme();
  const colors = getThemeColors();

  const isLoading = routines === undefined || userStats === undefined;

  // Keep last loaded data to avoid skeleton flash on refetch/tab switching
  const [stableRoutines, setStableRoutines] = useState<any[] | null>(null);
  const [stableStats, setStableStats] = useState<any | null>(null);

  useEffect(() => {
    if (routines !== undefined) setStableRoutines(routines as any);
  }, [routines]);

  useEffect(() => {
    if (userStats !== undefined) setStableStats(userStats as any);
  }, [userStats]);

  const routinesData = stableRoutines ?? [];
  const statsData = stableStats;
  const showInitialLoading = stableRoutines === null || stableStats === null;

  // View mode: Blocks vs Flexible
  const [viewMode, setViewMode] = useState<"blocks" | "flex">("blocks");
  const [modeSwapKey, setModeSwapKey] = useState(0);

  // Entry animations for newly created blocks
  const [newRoutineIds, setNewRoutineIds] = useState<Record<string, boolean>>({});
  const prevRoutineIdsRef = useRef<string[]>([]);

  useEffect(() => {
    setModeSwapKey((k) => k + 1);
  }, [viewMode]);

  useEffect(() => {
    const curr = routinesData.map((r: any) => r._id as string);
    const prev = new Set(prevRoutineIdsRef.current);
    const added = curr.filter((id) => !prev.has(id));
    if (added.length) {
      setNewRoutineIds((m) => {
        const next = { ...m };
        for (const id of added) next[id] = true;
        return next;
      });
      window.setTimeout(() => {
        setNewRoutineIds((m) => {
          const next = { ...m };
          for (const id of added) delete next[id];
          return next;
        });
      }, 1400);
    }
    prevRoutineIdsRef.current = curr;
  }, [routinesData]);


  useEffect(() => {
    const saved = localStorage.getItem("sw_routines_view");
    if (saved === "flex" || saved === "blocks") setViewMode(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("sw_routines_view", viewMode);
  }, [viewMode]);

  // Keep daily reset + stats safe
  useEffect(() => {
    if (!loggedInUser) return;
    void ensureUserStats();
    void resetDailyTasks();
  }, [loggedInUser, ensureUserStats, resetDailyTasks]);

  // Flexible sections (stored as normal routines)
  const FLEX_TIME = "Flexible";
  const FLEX_PRIORITIES = "Top Priorities";
  const FLEX_OTHER = "Other Tasks";

  const flexCreatedRef = useRef(false);

  const flexPriority =
    routinesData.find((r) => r.name === FLEX_PRIORITIES && r.timeSlot === FLEX_TIME) ?? null;
  const flexOther =
    routinesData.find((r) => r.name === FLEX_OTHER && r.timeSlot === FLEX_TIME) ?? null;

  // Auto-create the two Flexible sections once (when user switches to Flexible)
  useEffect(() => {
    if (viewMode !== "flex") return;
    if (!routines) return;

    // avoid spamming create calls
    if (flexCreatedRef.current) return;
    flexCreatedRef.current = true;

    (async () => {
      try {
        if (!flexPriority) await createRoutine({ name: FLEX_PRIORITIES, timeSlot: FLEX_TIME });
        if (!flexOther) await createRoutine({ name: FLEX_OTHER, timeSlot: FLEX_TIME });
      } catch {
        // silent (no UI corruption / no popups)
      }
    })();
  }, [viewMode, stableRoutines, flexPriority, flexOther, createRoutine]);

  // Block list excludes flexible routines
  const blockRoutines =
    routinesData.filter(
      (r) =>
        !(
          r.timeSlot === FLEX_TIME &&
          (r.name === FLEX_PRIORITIES || r.name === FLEX_OTHER)
        )
    ) ?? [];

  const glowStrong = colors.primary.replace("rgb(", "rgba(").replace(")", ",0.35)");
  const glowSoft = colors.primary.replace("rgb(", "rgba(").replace(")", ",0.22)");

  return (
    <>
      {/* Header */}
      <div className="text-center space-y-4 sm:space-y-6 animate-fade-in px-4">
        <h1
          className={`text-3xl sm:text-4xl md:text-6xl font-bold bg-[image:var(--sw-gradient)] bg-clip-text text-transparent`}
          style={{ textShadow: `0 0 18px ${glowStrong}` }}
        >
          Welcome Back
        </h1>

        <p
          className={`${colors.textSecondary} text-lg sm:text-xl`}
          style={{ textShadow: `0 0 12px ${glowSoft}` }}
        >
          {loggedInUser?.email?.split("@")[0] ?? "User"}
        </p>

        <div className={`w-24 sm:w-32 h-1 bg-[image:var(--sw-gradient)] mx-auto rounded-full`} />
      </div>

      {/* Stats */}
      <StatsPanel stats={statsData} isLoading={showInitialLoading} />

      {/* Mode switch */}
      <div className="flex justify-center">
        <div
          className={`relative inline-flex items-center rounded-2xl border ${colors.border} ${colors.backgroundSecondary} backdrop-blur-md p-1 shadow-xl overflow-hidden`}
        >
          {/* sliding pill */}
          <div
            className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-xl bg-[image:var(--sw-gradient)] transition-transform duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)]`}
            style={{ transform: viewMode === "flex" ? "translateX(100%)" : "translateX(0%)" }}
          />
          <button
            onClick={() => {
              flexCreatedRef.current = false;
              setViewMode("blocks");
            }}
            className={[
              "relative z-10 px-4 py-2 rounded-xl text-sm font-semibold transition-colors duration-300",
              viewMode === "blocks" ? "text-black" : `${colors.textSecondary} hover:${colors.text}`,
            ].join(" ")}
          >
            Blocks
          </button>

          <button
            onClick={() => {
              flexCreatedRef.current = false;
              setViewMode("flex");
            }}
            className={[
              "relative z-10 px-4 py-2 rounded-xl text-sm font-semibold transition-colors duration-300",
              viewMode === "flex" ? "text-black" : `${colors.textSecondary} hover:${colors.text}`,
            ].join(" ")}
          >
            Flexible
          </button>
        </div>
      </div>

      {/* Content */}
      {showInitialLoading ? (
        <div className="space-y-4 sm:space-y-6 animate-slide-up-delayed">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className={`${colors.backgroundSecondary} backdrop-blur-sm border ${colors.border} rounded-2xl p-6 animate-pulse`}
            >
              <div className="h-5 w-48 bg-gray-800 rounded mb-4" />
              <div className="h-3 w-full bg-gray-800 rounded mb-2" />
              <div className="h-3 w-2/3 bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div key={modeSwapKey} className="animate-swap-in">
          {viewMode === "blocks" ? (
            <div className="space-y-4 sm:space-y-6 animate-slide-up-delayed">
              {/* Your normal blocks */}
              {blockRoutines.map((routine) => (
                <RoutineCard key={routine._id} routine={routine} appear={!!newRoutineIds[routine._id]} />
              ))}

              {/* Your Add New Block (keep as-is in your App.tsx) */}
              <CreateRoutineCard />
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6 animate-slide-up-delayed">
              {/* Flexible = two fixed sections */}
              {flexPriority && <RoutineCard routine={flexPriority} appear={!!newRoutineIds[flexPriority._id]} />}
              {flexOther && <RoutineCard routine={flexOther} appear={!!newRoutineIds[flexOther._id]} />}

              {/* If still creating them */}
              {(!flexPriority || !flexOther) && (
                <div className={`${colors.textSecondary} text-sm text-center py-4`}>
                  Preparing your flexible layout...
                </div>
              )}
            </div>
          )}
        </div>
        </>
      )}

      {/* Keep button consistent */}
      <div className="animate-fade-in-delayed">
        <CompleteButton />
      </div>
    </>
  );
}
