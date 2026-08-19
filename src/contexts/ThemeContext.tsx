import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'cyan' | 'white' | 'black' | 'red' | 'purple' | 'green';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  getThemeColors: () => ThemeColors;

  // Optional accent override (lets the user pick ANY color).
  useCustomAccent: boolean;
  setUseCustomAccent: (value: boolean) => void;

  // Hex format, e.g. #00ccff
  customAccent: string;
  setCustomAccent: (hex: string) => void;
}

interface ThemeColors {
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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function isValidHex(hex: string) {
  return /^#([0-9a-fA-F]{6})$/.test(hex);
}

function hexToRgb(hex: string): RGB | null {
  if (!isValidHex(hex)) return null;
  const raw = hex.replace("#", "");
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return { r, g, b };
}

function parseRgbString(input: string): RGB | null {
  // Expected: rgb(r, g, b)
  const m = input.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (!m) return null;
  return { r: clamp(parseInt(m[1], 10), 0, 255), g: clamp(parseInt(m[2], 10), 0, 255), b: clamp(parseInt(m[3], 10), 0, 255) };
}

function rgbToHsl({ r, g, b }: RGB) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;

  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rr: h = ((gg - bb) / d) % 6; break;
      case gg: h = (bb - rr) / d + 2; break;
      case bb: h = (rr - gg) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rr = 0, gg = 0, bb = 0;
  if (h < 60) { rr = c; gg = x; bb = 0; }
  else if (h < 120) { rr = x; gg = c; bb = 0; }
  else if (h < 180) { rr = 0; gg = c; bb = x; }
  else if (h < 240) { rr = 0; gg = x; bb = c; }
  else if (h < 300) { rr = x; gg = 0; bb = c; }
  else { rr = c; gg = 0; bb = x; }

  return {
    r: Math.round((rr + m) * 255),
    g: Math.round((gg + m) * 255),
    b: Math.round((bb + m) * 255),
  };
}

function rgbString({ r, g, b }: RGB) {
  return `rgb(${r}, ${g}, ${b})`;
}

function buildOutOfWorldAccent(base: RGB) {
  // Create a premium neon gradient by nudging hue and lightness.
  const { h, s, l } = rgbToHsl(base);

  // Push saturation up (but keep it controlled), and keep a bright mid lightness.
  const sat = clamp(Math.max(s, 0.75), 0.7, 0.95);
  const midL = clamp(l, 0.45, 0.62);

  const a = hslToRgb((h - 18 + 360) % 360, sat, clamp(midL + 0.06, 0, 1));
  const b = hslToRgb(h, sat, midL);
  const c = hslToRgb((h + 24) % 360, sat, clamp(midL - 0.02, 0, 1));

  const hover = hslToRgb(h, sat, clamp(midL + 0.08, 0, 1));
  const light = hslToRgb(h, sat, clamp(midL + 0.18, 0, 1));
  const dark = hslToRgb(h, sat, clamp(midL - 0.18, 0, 1));

  return {
    primary: b,
    hover,
    light,
    dark,
    gradient: `linear-gradient(90deg, ${rgbString(a)}, ${rgbString(b)}, ${rgbString(c)})`,
    gradientHover: `linear-gradient(90deg, ${rgbString(hover)}, ${rgbString(light)}, ${rgbString(c)})`,
    glow: `0 0 24px rgba(${b.r}, ${b.g}, ${b.b}, 0.26), 0 0 54px rgba(${c.r}, ${c.g}, ${c.b}, 0.16)`,
  };
}

function applyAccentCssVars(gradient: string, gradientHover: string, glow: string, primary: RGB, hover: RGB, light: RGB) {
  const root = document.documentElement;
  root.style.setProperty("--sw-gradient", gradient);
  root.style.setProperty("--sw-gradient-hover", gradientHover);
  root.style.setProperty("--sw-glow", glow);
  root.style.setProperty("--sw-accent", rgbString(primary));
  root.style.setProperty("--sw-accent-rgb", `${primary.r} ${primary.g} ${primary.b}`);
  root.style.setProperty("--sw-accent-hover-rgb", `${hover.r} ${hover.g} ${hover.b}`);
  root.style.setProperty("--sw-accent-light-rgb", `${light.r} ${light.g} ${light.b}`);
}

/**
 * Theme presets use the same layout system but each one now has its own
 * surface tint, border character, and background atmosphere. The old
 * "white" id is kept for backwards compatibility, but visually represents
 * the Frost preset instead of pretending to be a half-light/half-dark mode.
 */
const themeColors: Record<Theme, ThemeColors> = {
  cyan: {
    primary: 'rgb(34, 211, 238)',
    primaryHover: 'rgb(103, 232, 249)',
    primaryLight: 'rgb(165, 243, 252)',
    primaryDark: 'rgb(8, 145, 178)',
    gradient: 'from-cyan-300 via-sky-400 to-blue-500',
    gradientHover: 'from-cyan-200 via-sky-300 to-blue-400',
    shadow: 'shadow-cyan-400/15',
    border: 'border-cyan-300/15',
    borderHover: 'border-cyan-200/30',
    text: 'text-cyan-100',
    textSecondary: 'text-slate-300/75',
    background: 'from-[#02070b] via-[#07111b] to-[#020407]',
    backgroundSecondary: 'bg-[#071018]/78',
    backgroundTertiary: 'bg-cyan-950/22'
  },

  white: {
    primary: 'rgb(226, 232, 240)',
    primaryHover: 'rgb(248, 250, 252)',
    primaryLight: 'rgb(255, 255, 255)',
    primaryDark: 'rgb(148, 163, 184)',
    gradient: 'from-slate-100 via-white to-sky-200',
    gradientHover: 'from-white via-slate-100 to-sky-100',
    shadow: 'shadow-slate-200/10',
    border: 'border-slate-200/15',
    borderHover: 'border-white/30',
    text: 'text-slate-100',
    textSecondary: 'text-slate-300/75',
    background: 'from-[#050608] via-[#10141a] to-[#030405]',
    backgroundSecondary: 'bg-slate-900/72',
    backgroundTertiary: 'bg-slate-800/45'
  },

  black: {
    primary: 'rgb(148, 163, 184)',
    primaryHover: 'rgb(203, 213, 225)',
    primaryLight: 'rgb(226, 232, 240)',
    primaryDark: 'rgb(71, 85, 105)',
    gradient: 'from-slate-400 via-slate-200 to-white',
    gradientHover: 'from-slate-300 via-white to-slate-200',
    shadow: 'shadow-white/5',
    border: 'border-white/10',
    borderHover: 'border-white/22',
    text: 'text-white',
    textSecondary: 'text-slate-400',
    background: 'from-black via-[#090b0f] to-black',
    backgroundSecondary: 'bg-[#090a0d]/84',
    backgroundTertiary: 'bg-white/5'
  },

  red: {
    primary: 'rgb(244, 63, 94)',
    primaryHover: 'rgb(251, 113, 133)',
    primaryLight: 'rgb(253, 164, 175)',
    primaryDark: 'rgb(190, 18, 60)',
    gradient: 'from-rose-500 via-red-500 to-orange-400',
    gradientHover: 'from-rose-400 via-red-400 to-orange-300',
    shadow: 'shadow-rose-500/14',
    border: 'border-rose-400/15',
    borderHover: 'border-rose-300/28',
    text: 'text-rose-100',
    textSecondary: 'text-slate-300/75',
    background: 'from-[#090204] via-[#17060a] to-[#050203]',
    backgroundSecondary: 'bg-[#16070b]/76',
    backgroundTertiary: 'bg-rose-950/24'
  },

  purple: {
    primary: 'rgb(168, 85, 247)',
    primaryHover: 'rgb(192, 132, 252)',
    primaryLight: 'rgb(216, 180, 254)',
    primaryDark: 'rgb(126, 34, 206)',
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    gradientHover: 'from-violet-400 via-purple-400 to-fuchsia-400',
    shadow: 'shadow-purple-500/14',
    border: 'border-violet-400/15',
    borderHover: 'border-violet-300/28',
    text: 'text-violet-100',
    textSecondary: 'text-slate-300/75',
    background: 'from-[#06020b] via-[#11091d] to-[#040206]',
    backgroundSecondary: 'bg-[#120a1c]/76',
    backgroundTertiary: 'bg-violet-950/24'
  },

  green: {
    primary: 'rgb(16, 185, 129)',
    primaryHover: 'rgb(52, 211, 153)',
    primaryLight: 'rgb(110, 231, 183)',
    primaryDark: 'rgb(4, 120, 87)',
    gradient: 'from-emerald-500 via-teal-500 to-lime-400',
    gradientHover: 'from-emerald-400 via-teal-400 to-lime-300',
    shadow: 'shadow-emerald-500/13',
    border: 'border-emerald-400/15',
    borderHover: 'border-emerald-300/28',
    text: 'text-emerald-100',
    textSecondary: 'text-slate-300/75',
    background: 'from-[#020806] via-[#07150f] to-[#020503]',
    backgroundSecondary: 'bg-[#07140f]/76',
    backgroundTertiary: 'bg-emerald-950/24'
  }
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {

const [theme, setTheme] = useState<Theme>(() => {
  try {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme && themeColors[savedTheme]) return savedTheme;
  } catch {}
  return 'cyan';
});

const [useCustomAccent, setUseCustomAccent] = useState<boolean>(() => {
  try {
    return localStorage.getItem('sw_use_custom_accent') === 'true';
  } catch {
    return false;
  }
});
const [customAccent, setCustomAccent] = useState<string>(() => {
  try {
    const saved = localStorage.getItem('sw_custom_accent');
    if (saved && isValidHex(saved)) return saved;
  } catch {}
  return '#00ccff';
});

const handleSetTheme = (newTheme: Theme) => {
  setTheme(newTheme);
  localStorage.setItem('theme', newTheme);
};

const handleSetUseCustomAccent = (value: boolean) => {
  setUseCustomAccent(value);
  localStorage.setItem('sw_use_custom_accent', String(value));
};

const handleSetCustomAccent = (hex: string) => {
  const normalized = hex.startsWith('#') ? hex : `#${hex}`;
  if (!isValidHex(normalized)) return;
  setCustomAccent(normalized);
  localStorage.setItem('sw_custom_accent', normalized);
};

const getThemeColors = () => {
  const base = themeColors[theme];

  // Always keep the base "layout vibe" (backgrounds, borders, text).
  // Only override accent colors (primary + glow) when enabled.
  if (!useCustomAccent) return base;

  const baseRgb = hexToRgb(customAccent) ?? parseRgbString(base.primary) ?? { r: 0, g: 204, b: 255 };
  const acc = buildOutOfWorldAccent(baseRgb);

  return {
    ...base,
    primary: rgbString(acc.primary),
    primaryHover: rgbString(acc.hover),
    primaryLight: rgbString(acc.light),
    primaryDark: rgbString(acc.dark),
  };
};

useEffect(() => {
  const colors = getThemeColors();

  // Set data-theme attribute on document for CSS targeting
  document.documentElement.setAttribute('data-theme', theme);

  // Pick accent source (custom or theme base) and compute a premium gradient.
  const baseRgb =
    (useCustomAccent ? hexToRgb(customAccent) : parseRgbString(colors.primary)) ??
    parseRgbString(colors.primary) ??
    { r: 0, g: 204, b: 255 };

  const acc = buildOutOfWorldAccent(baseRgb);
  applyAccentCssVars(acc.gradient, acc.gradientHover, acc.glow, acc.primary, acc.hover, acc.light);
}, [theme, useCustomAccent, customAccent]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, getThemeColors, useCustomAccent, setUseCustomAccent: handleSetUseCustomAccent, customAccent, setCustomAccent: handleSetCustomAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
