import { Authenticated, Unauthenticated, useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { DesktopFullscreenButton } from "./DesktopFullscreenButton";
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
import { Navigation } from "./components/Navigation";
import { ThemeSelector } from "./components/ThemeSelector";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { SoundProvider } from "./contexts/SoundContext";
import { useSound } from "./contexts/SoundContext";
import { useDailyReset } from "./hooks/useDailyReset";
import { TrustedDeviceGate } from "./TrustedDeviceGate";

type Page = "routines" | "workout" | "habits" | "progress" | "athkar" | "macros";

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

  const { theme, useCustomAccent, getThemeColors } = useTheme();
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
  }, [theme, useCustomAccent, colors.primary, colors.primaryLight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;

    const resize = () => {
      const isMobileViewport = window.innerWidth <= 640;
      const rawDpr = window.devicePixelRatio || 1;
      dpr = Math.min(rawDpr, isMobileViewport ? 1.5 : 2);
      w = Math.floor(window.innerWidth);
      h = Math.floor(window.innerHeight);

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    let resizeRaf: number | null = null;
    const scheduleResize = () => {
      if (resizeRaf !== null) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        resize();
      });
    };
    window.addEventListener("resize", scheduleResize, { passive: true });

    const area = w * h;
    const isWhite = !useCustomAccent && theme === "white";
    const isMobileViewport = w <= 640;

    // Mobile keeps the same animated look, but avoids spending most of the frame
    // budget on hundreds of particles at 3x device pixel ratio.
    const starCount = isMobileViewport
      ? (isWhite
          ? clamp(Math.floor(area / 5200), 130, 220)
          : clamp(Math.floor(area / 7000), 105, 180))
      : (isWhite
          ? clamp(Math.floor(area / 6200), 260, 620)
          : clamp(Math.floor(area / 9000), 180, 420));

    const glowCount = isMobileViewport
      ? (isWhite ? 5 : 3)
      : (isWhite
          ? clamp(Math.floor(area / 130000), 12, 26)
          : clamp(Math.floor(area / 170000), 7, 16));

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

    const FPS = isMobileViewport ? 24 : 30;
    const frameInterval = 1000 / FPS;
    let lastTime = 0;

    const draw = (time: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (document.hidden || time - lastTime < frameInterval) return;
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
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      window.removeEventListener("resize", scheduleResize);
    };
  }, [palette, theme, useCustomAccent]);

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
  const { getThemeColors } = useTheme();
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

  const inputBase = `bg-black/35 text-white placeholder:text-white/35 border ${colors.borderHover}`;

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
  const [athkarFocus, setAthkarFocus] = useState(false);
  const { theme, getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  // Only touch authenticated daily data after auth has resolved.
  useDailyReset(isAuthenticated);

  useEffect(() => {
    if (currentPage !== "athkar") setAthkarFocus(false);
  }, [currentPage]);

  const PAGE_ORDER: Page[] = ["routines", "workout", "habits", "progress", "athkar", "macros"];

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
    if (!isAuthenticated || athkarFocus || shouldIgnoreSwipe(e.target)) return;
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
      {!authLoading && isAuthenticated && <StarfieldBackground key={theme} />}

      {authLoading ? (
        <div className="grid min-h-screen place-items-center bg-black">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
        </div>
      ) : isAuthenticated ? (
        <TrustedDeviceGate>
          <header className={`${athkarFocus ? "hidden sm:block" : ""} relative z-50 ${colors.backgroundSecondary} backdrop-blur-md border-b ${colors.border} shadow-2xl`}>
            <div className="container mx-auto flex h-16 items-center justify-end px-3 sm:h-20 sm:px-4">
              <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
                <ThemeSelector />
                <DesktopFullscreenButton />
                <SignOutButton />
              </div>
            </div>
          </header>

          <div className={athkarFocus ? "hidden sm:block" : ""}>
            <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
          </div>

          <main
            className={`relative z-10 container mx-auto pb-safe ${athkarFocus ? "px-0 py-0 sm:px-4 sm:py-8" : "px-3 py-4 sm:px-4 sm:py-8"}`}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div key={swapKey} className={swapDir === "left" ? "sw-page-swap-left" : "sw-page-swap-right"}>
              <Content currentPage={currentPage} onAthkarFocusChange={setAthkarFocus} />
            </div>
          </main>
        </TrustedDeviceGate>
      ) : (
        <main className="relative z-10 min-h-screen">
          <Content currentPage={currentPage} onAthkarFocusChange={setAthkarFocus} />
        </main>
      )}

      <Toaster />
    </div>
  );
}

function Content({ currentPage, onAthkarFocusChange }: { currentPage: Page; onAthkarFocusChange: (focused: boolean) => void }) {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userProfile = useQuery(api.auth.getProfile);
  // Keep Athkar subscribed while the user is in the app so opening the page
  // does not wait for a brand-new query round trip.
  const prefetchedAthkar = useQuery(api.athkar.getAthkar, loggedInUser ? {} : "skip");
  const setDisplayName = useMutation(api.auth.setDisplayName);
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const [applyingPendingName, setApplyingPendingName] = useState(false);
  const [confirmedNameThisSession, setConfirmedNameThisSession] = useState<string | null>(null);

  const profileName = userProfile?.displayName?.trim() ?? "";
  const displayName = confirmedNameThisSession ?? profileName;
  // Do not try to infer whether a person's name is valid from their email or
  // from old placeholder values. Explicit confirmation is the source of truth.
  const needsRealName =
    userProfile !== undefined &&
    !!loggedInUser &&
    confirmedNameThisSession === null &&
    (!userProfile || userProfile.nameConfirmed !== true);

  useEffect(() => {
    // Reset the immediate client confirmation when auth changes.
    if (!loggedInUser) setConfirmedNameThisSession(null);
  }, [loggedInUser]);

  useEffect(() => {
    if (!loggedInUser || userProfile === undefined || applyingPendingName) return;
    const pending = sessionStorage.getItem("pending_display_name")?.trim().replace(/\s+/g, " ") ?? "";
    if (pending.length < 2) return;

    // A pending signup name should be applied even if an old profile document
    // somehow exists. Saving it also marks the name as explicitly confirmed.
    setApplyingPendingName(true);
    void setDisplayName({ displayName: pending })
      .then(() => {
        setConfirmedNameThisSession(pending);
        sessionStorage.removeItem("pending_display_name");
      })
      .catch(() => {})
      .finally(() => setApplyingPendingName(false));
  }, [loggedInUser, userProfile, applyingPendingName, setDisplayName]);

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
        {loggedInUser && needsRealName && !applyingPendingName && (
          <NameSetupModal onSaved={(savedName) => setConfirmedNameThisSession(savedName)} />
        )}
        {currentPage === "routines" && (
          <RoutinesContent
            loggedInUser={loggedInUser}
            displayName={needsRealName ? "" : displayName}
          />
        )}
        {currentPage === "workout" && <WorkoutPage />}
        {currentPage === "habits" && <HabitsPage />}
        {currentPage === "progress" && <ProgressPage />}
        {currentPage === "athkar" && <AthkarPage prefetchedAthkar={prefetchedAthkar} onFocusModeChange={onAthkarFocusChange} />}
        {currentPage === "macros" && <MacrosPage />}
      </Authenticated>

      <Unauthenticated>
        <div className="auth-stage">
          <div className="auth-shell">
            <section className="auth-brand-panel">
              <div className="auth-brand-topline">Personal operating system</div>
              <h1 className="auth-brand-title">Ceventic<br />System</h1>
              <p className="auth-brand-copy">One place for the systems you repeat, measure, and improve.</p>

              <div className="auth-motion-board" aria-hidden="true">
                <div className="auth-motion-row"><span>01</span><b>Plan the day</b><i /></div>
                <div className="auth-motion-row"><span>02</span><b>Do the work</b><i /></div>
                <div className="auth-motion-row"><span>03</span><b>Track the signal</b><i /></div>
                <div className="auth-motion-row"><span>04</span><b>Repeat</b><i /></div>
              </div>

              <div className="auth-brand-foot">Your Personal Operating System</div>
            </section>
            <section className="auth-form-panel">
              <SignInForm />
            </section>
          </div>
        </div>
      </Unauthenticated>
    </div>
  );
}

function NameSetupModal({ onSaved }: { onSaved: (name: string) => void }) {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const setDisplayName = useMutation(api.auth.setDisplayName);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const clean = name.trim().replace(/\s+/g, " ");
    if (clean.length < 2) return toast.error("Enter the name you want us to use.");
    setSaving(true);
    try {
      await setDisplayName({ displayName: clean });
      // Close onboarding immediately; Convex will still update the reactive
      // profile query in the background.
      onSaved(clean);
      toast.success(`Welcome, ${clean}`);
    } catch (error: any) {
      toast.error(error?.message ?? "Could not save your name");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-xl" />
      <div
        className={`relative z-10 w-full max-w-md overflow-hidden rounded-3xl border ${colors.border} p-5 shadow-2xl sm:p-6`}
        style={{ background: "rgba(6, 9, 13, 0.97)", boxShadow: `0 28px 100px rgba(0,0,0,.55), 0 0 44px rgb(var(--sw-accent-rgb) / .12)` }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[image:var(--sw-gradient)] opacity-10 blur-3xl" />
        <div className="relative">
          <div className={`grid h-11 w-11 place-items-center rounded-2xl border ${colors.border} bg-white/[0.04]`}>
            <svg viewBox="0 0 24 24" className={`h-5 w-5 ${colors.text}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
            </svg>
          </div>
          <h2 className={`mt-4 text-2xl font-bold ${colors.text}`}>What should we call you?</h2>
          <p className={`mt-2 text-sm leading-6 ${colors.textSecondary}`}>This name will appear on your dashboard.</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
            maxLength={32}
            autoFocus
            placeholder="Your name"
            className={`mt-5 w-full rounded-2xl border ${colors.border} bg-black/45 px-4 py-3.5 ${colors.text} outline-none transition focus:border-white/25 focus:ring-2 focus:ring-white/5`}
          />
          <button
            onClick={() => void submit()}
            disabled={saving || name.trim().length < 2}
            className="mt-3 w-full rounded-2xl bg-[image:var(--sw-gradient)] px-4 py-3.5 font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoutinesContent({ loggedInUser, displayName }: { loggedInUser: any; displayName: string }) {
  const routines = useQuery(api.routines.getRoutines);
  const userStats = useQuery(api.routines.getUserStats);

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

  // Daily reset is handled once at the app shell using the user's local date.
  // Here we only make sure the stats document exists.
  useEffect(() => {
    if (!loggedInUser) return;
    void ensureUserStats();
  }, [loggedInUser, ensureUserStats]);

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

  return (
    <>
      {/* Header */}
      <div className="animate-fade-in px-3 text-center sm:px-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45 sm:text-xs">Welcome back</p>
        <h1
          className="mt-2 break-words bg-[image:var(--sw-gradient)] bg-clip-text text-4xl font-bold leading-[1.05] text-transparent sm:mt-3 sm:text-5xl md:text-6xl"
          style={{ textShadow: `0 0 18px ${glowStrong}` }}
        >
          {displayName || "Your dashboard"}
        </h1>
        <div className="mx-auto mt-5 h-1 w-20 rounded-full bg-[image:var(--sw-gradient)] sm:mt-6 sm:w-28" />
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
              viewMode === "blocks" ? "text-black" : `${colors.textSecondary} hover:text-white`,
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
              viewMode === "flex" ? "text-black" : `${colors.textSecondary} hover:text-white`,
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
