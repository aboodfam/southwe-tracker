import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "settings" | "chevronDown" | "chevronLeft" | "chevronRight" | "edit" | "x" | "palette" | "volume" | "shuffle" | "check" | "play" | "trash" | "upload"
  | "routines" | "workout" | "habits" | "progress" | "athkar" | "macros"
  | "trophy" | "flame" | "bolt" | "checkCircle" | "chart" | "clock" | "sparkles" | "refresh"
  | "save" | "info" | "sun" | "moon" | "bed" | "hands" | "sunrise" | "plus" | "soundWave"
  | "shield" | "calendar" | "layers" | "diamond" | "headphones" | "gamepad" | "film";

const paths: Record<IconName, ReactNode> = {
  settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.57 15a1.7 1.7 0 0 0-1.57-1H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.06 1.52 1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></>,
  chevronDown: <path d="m6 9 6 6 6-6"/>,
  chevronLeft: <path d="m15 18-6-6 6-6"/>,
  chevronRight: <path d="m9 18 6-6-6-6"/>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
  x: <><path d="m6 6 12 12"/><path d="M18 6 6 18"/></>,
  palette: <><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 3a9 9 0 0 0 0 18h1.5a1.5 1.5 0 0 0 0-3H12a2 2 0 0 1 0-4h2a7 7 0 0 0 0-14h-2Z"/></>,
  volume: <><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></>,
  shuffle: <><path d="M16 3h5v5"/><path d="m21 3-6.5 6.5a4 4 0 0 1-5.7 0L3 4"/><path d="M16 16h5v5"/><path d="m21 21-6.5-6.5"/><path d="M3 20l4.5-4.5"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  play: <path d="m8 5 11 7-11 7V5Z"/>,
  trash: <><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></>,
  upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></>,
  routines: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2"/><path d="m8.5 10 1.5 1.5 3-3"/><path d="M14 11h2.5M8.5 16l1.5 1.5 3-3M14 17h2.5"/></>,
  workout: <><path d="M6.5 8v8M3.5 9.5v5M17.5 8v8M20.5 9.5v5M6.5 12h11"/></>,
  habits: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/><path d="M12 4V2M20 12h2"/></>,
  progress: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
  athkar: <><circle cx="12" cy="5" r="2"/><circle cx="17" cy="8" r="2"/><circle cx="18" cy="14" r="2"/><circle cx="14" cy="18" r="2"/><circle cx="8" cy="18" r="2"/><circle cx="5" cy="13" r="2"/><circle cx="7" cy="8" r="2"/></>,
  macros: <><circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/><path d="M12 12 6 19"/></>,
  trophy: <><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6"/></>,
  flame: <path d="M12 22c4 0 7-3 7-7 0-3-1.5-5.5-4.5-8.5.1 2-1 3.5-2.2 4.4C11 8.4 9.5 6.2 7 4c.2 3-2 5.2-2 8.5C5 17.8 8.1 22 12 22Z"/>,
  bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/>,
  checkCircle: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
  chart: <><path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-6"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  sparkles: <><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z"/><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/><path d="m5 14 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"/></>,
  refresh: <><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6.2 6.2L4 8M5.5 15A7 7 0 0 0 17.8 17.8L20 16"/></>,
  save: <><path d="M5 3h12l2 2v16H5V3Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></>,
  moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>,
  bed: <><path d="M3 6v13M21 19v-7a3 3 0 0 0-3-3H9v10M3 14h18"/><path d="M6 9h3v5H6a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2Z"/></>,
  hands: <><path d="M8 12V7a2 2 0 1 1 4 0v5"/><path d="M12 12V5a2 2 0 1 1 4 0v7"/><path d="M16 12V8a2 2 0 1 1 4 0v7c0 4-3 7-7 7h-1c-3 0-5-1.5-7-4l-2-3a2 2 0 0 1 3-2l2 2v-3"/></>,
  sunrise: <><path d="M3 18h18M5 14a7 7 0 0 1 14 0M12 3v4M4.2 7.2l2.1 2.1M19.8 7.2l-2.1 2.1"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  soundWave: <><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4"/></>,
  shield: <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
  diamond: <path d="m12 3 7 6-7 12L5 9l7-6Z"/>,
  headphones: <><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v6H5a1 1 0 0 1-1-1v-5ZM20 14h-3v6h2a1 1 0 0 0 1-1v-5Z"/></>,
  gamepad: <><path d="M8 8h8a5 5 0 0 1 4.8 6.4l-1 3.4a2 2 0 0 1-3.2 1l-2.2-1.8H9.6l-2.2 1.8a2 2 0 0 1-3.2-1l-1-3.4A5 5 0 0 1 8 8Z"/><path d="M7 12v4M5 14h4M16.5 13h.01M18.5 15h.01"/></>,
  film: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4"/></>,
};

export function Icon({ name, className = "h-5 w-5", ...props }: { name: IconName; className?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}
