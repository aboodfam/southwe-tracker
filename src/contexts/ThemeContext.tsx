import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Theme = "cyan" | "white" | "black" | "red" | "purple" | "green";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  getThemeColors: () => ThemeColors;
  useCustomAccent: boolean;
  setUseCustomAccent: (value: boolean) => void;
  customAccent: string;
  setCustomAccent: (hex: string) => void;
}

export interface ThemeColors {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryDark: string;
  gradient: string;
  gradientHover: string;
  shadow: string;
  border: string;
  borderHover: string;
  text: string;
  textSecondary: string;
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
}

type RGB = { r: number; g: number; b: number };

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function isValidHex(hex: string) {
  return /^#([0-9a-fA-F]{6})$/.test(hex);
}

function normalizeHex(hex: string) {
  const value = hex.trim();
  const withHash = value.startsWith("#") ? value : `#${value}`;
  return withHash.toUpperCase();
}

function hexToRgb(hex: string): RGB | null {
  const normalized = normalizeHex(hex);
  if (!isValidHex(normalized)) return null;
  const raw = normalized.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function parseRgbString(input: string): RGB | null {
  const match = input.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (!match) return null;
  return {
    r: clamp(parseInt(match[1], 10), 0, 255),
    g: clamp(parseInt(match[2], 10), 0, 255),
    b: clamp(parseInt(match[3], 10), 0, 255),
  };
}

function mixRgb(from: RGB, to: RGB, amount: number): RGB {
  const t = clamp(amount, 0, 1);
  return {
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t),
  };
}

function rgbString({ r, g, b }: RGB) {
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Accent generation intentionally keeps the exact selected hue.
 * The previous implementation forced saturation and shifted hue, which made
 * neutral presets look cyan and made custom colors display as a different color.
 */
function buildExactAccent(
  primary: RGB,
  provided?: { hover?: RGB | null; light?: RGB | null; dark?: RGB | null },
) {
  const hover = provided?.hover ?? mixRgb(primary, WHITE, 0.16);
  const light = provided?.light ?? mixRgb(primary, WHITE, 0.32);
  const dark = provided?.dark ?? mixRgb(primary, BLACK, 0.20);
  const softStart = mixRgb(primary, WHITE, 0.10);
  const softEnd = mixRgb(primary, BLACK, 0.12);
  const hoverStart = mixRgb(hover, WHITE, 0.08);

  return {
    primary,
    hover,
    light,
    dark,
    gradient: `linear-gradient(90deg, ${rgbString(softStart)}, ${rgbString(primary)} 52%, ${rgbString(softEnd)})`,
    gradientHover: `linear-gradient(90deg, ${rgbString(hoverStart)}, ${rgbString(hover)} 52%, ${rgbString(primary)})`,
    glow: `0 0 24px rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.24), 0 0 52px rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.12)`,
  };
}

function applyAccentCssVars(
  gradient: string,
  gradientHover: string,
  glow: string,
  primary: RGB,
  hover: RGB,
  light: RGB,
) {
  const root = document.documentElement;
  root.style.setProperty("--sw-gradient", gradient);
  root.style.setProperty("--sw-gradient-hover", gradientHover);
  root.style.setProperty("--sw-glow", glow);
  root.style.setProperty("--sw-accent", rgbString(primary));
  root.style.setProperty("--sw-accent-rgb", `${primary.r} ${primary.g} ${primary.b}`);
  root.style.setProperty("--sw-accent-hover-rgb", `${hover.r} ${hover.g} ${hover.b}`);
  root.style.setProperty("--sw-accent-light-rgb", `${light.r} ${light.g} ${light.b}`);
}

const themeColors: Record<Theme, ThemeColors> = {
  cyan: {
    primary: "rgb(34, 211, 238)",
    primaryHover: "rgb(103, 232, 249)",
    primaryLight: "rgb(165, 243, 252)",
    primaryDark: "rgb(8, 145, 178)",
    gradient: "from-cyan-300 via-sky-400 to-blue-500",
    gradientHover: "from-cyan-200 via-sky-300 to-blue-400",
    shadow: "shadow-cyan-400/15",
    border: "border-cyan-300/15",
    borderHover: "border-cyan-200/30",
    text: "text-cyan-100",
    textSecondary: "text-slate-300/75",
    background: "from-[#02070b] via-[#07111b] to-[#020407]",
    backgroundSecondary: "bg-[#071018]/78",
    backgroundTertiary: "bg-cyan-950/22",
  },
  white: {
    primary: "rgb(245, 245, 245)",
    primaryHover: "rgb(255, 255, 255)",
    primaryLight: "rgb(255, 255, 255)",
    primaryDark: "rgb(163, 163, 163)",
    gradient: "from-slate-100 via-white to-slate-300",
    gradientHover: "from-white via-slate-100 to-slate-200",
    shadow: "shadow-slate-200/10",
    border: "border-slate-200/15",
    borderHover: "border-white/30",
    text: "text-slate-100",
    textSecondary: "text-slate-300/75",
    background: "from-[#050608] via-[#10141a] to-[#030405]",
    backgroundSecondary: "bg-slate-900/72",
    backgroundTertiary: "bg-slate-800/45",
  },
  black: {
    primary: "rgb(163, 163, 163)",
    primaryHover: "rgb(212, 212, 212)",
    primaryLight: "rgb(229, 229, 229)",
    primaryDark: "rgb(82, 82, 82)",
    gradient: "from-slate-400 via-slate-300 to-slate-500",
    gradientHover: "from-slate-300 via-slate-200 to-slate-400",
    shadow: "shadow-white/5",
    border: "border-white/10",
    borderHover: "border-white/22",
    text: "text-white",
    textSecondary: "text-slate-400",
    background: "from-black via-[#090b0f] to-black",
    backgroundSecondary: "bg-[#090a0d]/84",
    backgroundTertiary: "bg-white/5",
  },
  red: {
    primary: "rgb(244, 63, 94)",
    primaryHover: "rgb(251, 113, 133)",
    primaryLight: "rgb(253, 164, 175)",
    primaryDark: "rgb(190, 18, 60)",
    gradient: "from-rose-500 via-red-500 to-rose-700",
    gradientHover: "from-rose-400 via-red-400 to-rose-600",
    shadow: "shadow-rose-500/14",
    border: "border-rose-400/15",
    borderHover: "border-rose-300/28",
    text: "text-rose-100",
    textSecondary: "text-slate-300/75",
    background: "from-[#090204] via-[#17060a] to-[#050203]",
    backgroundSecondary: "bg-[#16070b]/76",
    backgroundTertiary: "bg-rose-950/24",
  },
  purple: {
    primary: "rgb(168, 85, 247)",
    primaryHover: "rgb(192, 132, 252)",
    primaryLight: "rgb(216, 180, 254)",
    primaryDark: "rgb(126, 34, 206)",
    gradient: "from-violet-500 via-purple-500 to-violet-700",
    gradientHover: "from-violet-400 via-purple-400 to-violet-600",
    shadow: "shadow-purple-500/14",
    border: "border-violet-400/15",
    borderHover: "border-violet-300/28",
    text: "text-violet-100",
    textSecondary: "text-slate-300/75",
    background: "from-[#06020b] via-[#11091d] to-[#040206]",
    backgroundSecondary: "bg-[#120a1c]/76",
    backgroundTertiary: "bg-violet-950/24",
  },
  green: {
    primary: "rgb(16, 185, 129)",
    primaryHover: "rgb(52, 211, 153)",
    primaryLight: "rgb(110, 231, 183)",
    primaryDark: "rgb(4, 120, 87)",
    gradient: "from-emerald-500 via-teal-500 to-emerald-700",
    gradientHover: "from-emerald-400 via-teal-400 to-emerald-600",
    shadow: "shadow-emerald-500/13",
    border: "border-emerald-400/15",
    borderHover: "border-emerald-300/28",
    text: "text-emerald-100",
    textSecondary: "text-slate-300/75",
    background: "from-[#020806] via-[#07150f] to-[#020503]",
    backgroundSecondary: "bg-[#07140f]/76",
    backgroundTertiary: "bg-emerald-950/24",
  },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const savedTheme = localStorage.getItem("theme") as Theme | null;
      if (savedTheme && themeColors[savedTheme]) return savedTheme;
    } catch {}
    return "cyan";
  });

  const [useCustomAccent, setUseCustomAccent] = useState<boolean>(() => {
    try {
      return localStorage.getItem("sw_use_custom_accent") === "true";
    } catch {
      return false;
    }
  });

  const [customAccent, setCustomAccent] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("sw_custom_accent");
      if (saved && isValidHex(normalizeHex(saved))) return normalizeHex(saved);
    } catch {}
    return "#22D3EE";
  });

  const handleSetTheme = (newTheme: Theme) => {
    // Presets and Custom are separate modes. Selecting a preset always shows
    // that preset exactly instead of silently keeping a previous custom color.
    setTheme(newTheme);
    setUseCustomAccent(false);
    try {
      localStorage.setItem("theme", newTheme);
      localStorage.setItem("sw_use_custom_accent", "false");
    } catch {}
  };

  const handleSetUseCustomAccent = (value: boolean) => {
    setUseCustomAccent(value);
    try {
      localStorage.setItem("sw_use_custom_accent", String(value));
    } catch {}
  };

  const handleSetCustomAccent = (hex: string) => {
    const normalized = normalizeHex(hex);
    if (!isValidHex(normalized)) return;
    setCustomAccent(normalized);
    try {
      localStorage.setItem("sw_custom_accent", normalized);
    } catch {}
  };

  const getThemeColors = (): ThemeColors => {
    if (!useCustomAccent) return themeColors[theme];

    // Custom mode intentionally uses neutral graphite surfaces. This prevents
    // a hidden preset (for example Amethyst) from changing the background while
    // a custom orange/blue/etc. accent is active.
    const neutral = themeColors.black;
    const primary = hexToRgb(customAccent) ?? { r: 34, g: 211, b: 238 };
    const accent = buildExactAccent(primary);

    return {
      ...neutral,
      primary: rgbString(accent.primary),
      primaryHover: rgbString(accent.hover),
      primaryLight: rgbString(accent.light),
      primaryDark: rgbString(accent.dark),
    };
  };

  useEffect(() => {
    const colors = getThemeColors();
    document.documentElement.setAttribute("data-theme", useCustomAccent ? "custom" : theme);

    const primary = parseRgbString(colors.primary) ?? { r: 34, g: 211, b: 238 };
    const hover = parseRgbString(colors.primaryHover);
    const light = parseRgbString(colors.primaryLight);
    const dark = parseRgbString(colors.primaryDark);
    const accent = buildExactAccent(primary, { hover, light, dark });

    applyAccentCssVars(
      accent.gradient,
      accent.gradientHover,
      accent.glow,
      accent.primary,
      accent.hover,
      accent.light,
    );
  }, [theme, useCustomAccent, customAccent]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: handleSetTheme,
        getThemeColors,
        useCustomAccent,
        setUseCustomAccent: handleSetUseCustomAccent,
        customAccent,
        setCustomAccent: handleSetCustomAccent,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
