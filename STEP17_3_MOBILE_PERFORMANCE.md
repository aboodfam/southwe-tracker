# Step 17.3 — Mobile performance + Athkar sizing

## Changes
- Reduced focused Athkar Arabic text size on phones and disabled browser text autosizing drift.
- Phone starfield now uses DPR 1, roughly 42–82 stars, 18 FPS, no canvas radial glows, and no per-star halo pass.
- The starfield is not rendered at all while Athkar focus mode is open on phones.
- Expensive CSS backdrop-filter blur is disabled on phones while keeping the same dark glass backgrounds/borders.
- `transition-all` is narrowed to paint/compositor-friendly properties on phones.

## Android status bar
The project already sets `theme-color` and PWA manifest `theme_color`/`background_color` to `#000000`. Some recent Android/Chrome/Samsung combinations still render a dark-gray native status-bar scrim for standalone PWAs. Web code cannot reliably override that native shell behavior. Exact control requires a native Android wrapper/app (or hiding the status bar via fullscreen, which is not the requested UX).
