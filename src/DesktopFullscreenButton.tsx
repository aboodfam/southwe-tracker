import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTheme } from "./contexts/ThemeContext";

function isTauriDesktop() {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
}

export function DesktopFullscreenButton() {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const [isDesktop, setIsDesktop] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const syncFullscreenState = useCallback(async () => {
    if (!isTauriDesktop()) return;
    try {
      setIsFullscreen(await getCurrentWindow().isFullscreen());
    } catch {
      // Keep the web build unaffected if the desktop API is unavailable.
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!isTauriDesktop()) return;
    try {
      const appWindow = getCurrentWindow();
      const next = !(await appWindow.isFullscreen());
      await appWindow.setFullscreen(next);
      setIsFullscreen(next);
    } catch {
      // Ignore desktop-shell failures instead of breaking the tracker UI.
    }
  }, []);

  useEffect(() => {
    const desktop = isTauriDesktop();
    setIsDesktop(desktop);
    if (!desktop) return;

    void syncFullscreenState();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F11") {
        event.preventDefault();
        void toggleFullscreen();
        return;
      }

      if (event.key === "Escape" && isFullscreen) {
        event.preventDefault();
        void getCurrentWindow().setFullscreen(false).then(() => setIsFullscreen(false));
      }
    };

    const onFocus = () => void syncFullscreenState();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("focus", onFocus);
    };
  }, [isFullscreen, syncFullscreenState, toggleFullscreen]);

  if (!isDesktop) return null;

  return (
    <button
      onClick={() => void toggleFullscreen()}
      className={`grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl border ${colors.border} bg-black/45 text-white/65 shadow-lg transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white active:scale-[0.97]`}
      style={{ boxShadow: `0 0 18px rgb(var(--sw-accent-rgb) / .08)` }}
      title={isFullscreen ? "Exit fullscreen (F11)" : "Enter fullscreen (F11)"}
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      aria-pressed={isFullscreen}
    >
      {isFullscreen ? (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3v6H3" />
          <path d="m3 9 6-6" />
          <path d="M15 3v6h6" />
          <path d="m21 9-6-6" />
          <path d="M9 21v-6H3" />
          <path d="m3 15 6 6" />
          <path d="M15 21v-6h6" />
          <path d="m21 15-6 6" />
        </svg>
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9V3h6" />
          <path d="M21 9V3h-6" />
          <path d="M3 15v6h6" />
          <path d="M21 15v6h-6" />
        </svg>
      )}
    </button>
  );
}
