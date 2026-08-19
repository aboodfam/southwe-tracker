"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useTheme } from "./contexts/ThemeContext";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();

  if (!isAuthenticated) return null;

  return (
    <button
      onClick={() => void signOut()}
      className={`grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl border ${colors.border} bg-black/45 text-white/65 shadow-lg backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white active:scale-[0.97]`}
      style={{ boxShadow: `0 0 18px rgb(var(--sw-accent-rgb) / .08)` }}
      title="Sign out"
      aria-label="Sign out"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M21 12a9 9 0 0 0-9-9" />
        <path d="M12 21a9 9 0 0 0 9-9" />
      </svg>
    </button>
  );
}
