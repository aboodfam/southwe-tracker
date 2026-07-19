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

function applyAccentCssVars(gradient: string, gradientHover: string, glow: string) {
  const root = document.documentElement;
  root.style.setProperty("--sw-gradient", gradient);
  root.style.setProperty("--sw-gradient-hover", gradientHover);
  root.style.setProperty("--sw-glow", glow);
}

/**
 * GOAL:
 * - Keep cards EXACTLY the same vibe (bg-black/55)
 * - Make red/purple/green darker + premium (less “toy/neon”)
 * - Rework cyan to premium electric-aqua (clean, not washed)
 */
const themeColors: Record<Theme, ThemeColors> = {
  cyan: {
    // Premium electric aqua (cleaner than default tailwind cyan)
    primary: 'rgb(0, 204, 255)',
    primaryHover: 'rgb(80, 228, 255)',
    primaryLight: 'rgb(170, 248, 255)',
    primaryDark: 'rgb(0, 150, 210)',

    // Stronger + more premium bar/button gradient
    gradient: 'from-cyan-300 via-sky-400 to-blue-500',
    gradientHover: 'from-cyan-200 via-sky-300 to-blue-400',

    shadow: 'shadow-cyan-400/14',
    border: 'border-cyan-300/14',
    borderHover: 'border-cyan-200/22',

    text: 'text-cyan-200',
    textSecondary: 'text-slate-200/75',

    background: 'from-black via-slate-950 to-black',

    // ✅ KEEP OLD CARD LOOK (don’t change this)
    backgroundSecondary: 'bg-black/55',

    // Subtle tint inside task rows / add task area
    backgroundTertiary: 'bg-cyan-950/14'
  },

  white: {
    primary: 'rgb(235, 245, 255)',
    primaryHover: 'rgb(255, 255, 255)',
    primaryLight: 'rgb(200, 230, 255)',
    primaryDark: 'rgb(180, 210, 235)',

    gradient: 'from-slate-100 via-sky-100 to-white',
    gradientHover: 'from-white via-sky-50 to-slate-100',

    shadow: 'shadow-sky-200/12',
    border: 'border-white/18',
    borderHover: 'border-white/30',

    text: 'text-white',
    textSecondary: 'text-slate-200/85',

    background: 'from-black via-slate-950 to-black',

    // White theme can stay slightly frosty
    backgroundSecondary: 'bg-white/6',
    backgroundTertiary: 'bg-sky-500/6'
  },

  black: {
    primary: 'rgb(160, 210, 255)',
    primaryHover: 'rgb(200, 230, 255)',
    primaryLight: 'rgb(120, 185, 255)',
    primaryDark: 'rgb(80, 140, 220)',

    gradient: 'from-sky-200 via-slate-100 to-sky-300',
    gradientHover: 'from-white via-slate-100 to-sky-200',

    shadow: 'shadow-sky-400/10',
    border: 'border-white/10',
    borderHover: 'border-white/20',

    text: 'text-white',
    textSecondary: 'text-white/70',

    background: 'from-black via-slate-950 to-black',

    // ✅ KEEP OLD CARD LOOK
    backgroundSecondary: 'bg-black/55',
    backgroundTertiary: 'bg-white/5'
  },

  red: {
    // Dark ruby red (premium)
    primary: 'rgb(190, 18, 60)',        // rose-700
    primaryHover: 'rgb(225, 29, 72)',   // rose-600
    primaryLight: 'rgb(244, 63, 94)',   // rose-500
    primaryDark: 'rgb(159, 18, 57)',    // rose-800

    gradient: 'from-rose-600 via-red-600 to-orange-500',
    gradientHover: 'from-rose-500 via-red-500 to-orange-400',

    shadow: 'shadow-rose-500/12',
    border: 'border-rose-400/14',
    borderHover: 'border-rose-300/22',

    text: 'text-rose-200',
    textSecondary: 'text-slate-200/75',

    background: 'from-black via-zinc-950 to-black',

    // ✅ KEEP OLD CARD LOOK
    backgroundSecondary: 'bg-black/55',
    backgroundTertiary: 'bg-rose-950/14'
  },

  purple: {
    // Dark amethyst / galaxy purple (premium)
    primary: 'rgb(107, 33, 168)',       // purple-800
    primaryHover: 'rgb(147, 51, 234)',  // purple-600
    primaryLight: 'rgb(168, 85, 247)',  // purple-500
    primaryDark: 'rgb(88, 28, 135)',    // purple-900-ish

    gradient: 'from-violet-600 via-purple-600 to-fuchsia-500',
    gradientHover: 'from-violet-500 via-purple-500 to-fuchsia-400',

    shadow: 'shadow-purple-500/12',
    border: 'border-purple-400/14',
    borderHover: 'border-purple-300/22',

    text: 'text-violet-200',
    textSecondary: 'text-slate-200/75',

    background: 'from-black via-slate-950 to-black',

    // ✅ KEEP OLD CARD LOOK
    backgroundSecondary: 'bg-black/55',
    backgroundTertiary: 'bg-violet-950/14'
  },

  green: {
    // Dark emerald premium
    primary: 'rgb(4, 120, 87)',         // emerald-700
    primaryHover: 'rgb(5, 150, 105)',   // emerald-600
    primaryLight: 'rgb(16, 185, 129)',  // emerald-500
    primaryDark: 'rgb(6, 95, 70)',      // emerald-800-ish

    gradient: 'from-emerald-600 via-green-600 to-lime-500',
    gradientHover: 'from-emerald-500 via-green-500 to-lime-400',

    shadow: 'shadow-emerald-500/11',
    border: 'border-emerald-400/14',
    borderHover: 'border-emerald-300/22',

    text: 'text-emerald-200',
    textSecondary: 'text-slate-200/75',

    background: 'from-black via-zinc-950 to-black',

    // ✅ KEEP OLD CARD LOOK
    backgroundSecondary: 'bg-black/55',
    backgroundTertiary: 'bg-emerald-950/14'
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
  applyAccentCssVars(acc.gradient, acc.gradientHover, acc.glow);
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
