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
  className={[
    // ✅ mobile = icon button, desktop = normal button
    'h-10 w-10 sm:w-auto sm:h-auto',
    'px-0 sm:px-4 py-0 sm:py-2',
    'rounded-xl font-semibold transition-all duration-200',
    'border backdrop-blur-md shadow-lg',
    'flex items-center justify-center sm:justify-start gap-0 sm:gap-2',
    'bg-[image:var(--sw-gradient)]',
    'hover:brightness-110',
    colors.shadow,
    colors.borderHover,
    'text-black',
    'active:scale-[0.98]',
  ].join(' ')}
  style={{
    boxShadow: `0 0 18px ${colors.primary.replace('rgb(', 'rgba(').replace(')', ',0.18)')}`,
  }}
  title="Sign out"
>
  <svg
    className="w-5 h-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 00-9-9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 009-9" />
  </svg>

  {/* ✅ Hide text on mobile, show on bigger screens */}
  <span className="hidden sm:inline">Sign out</span>
</button>
  );
}
