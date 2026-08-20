# Step 17.4 — Mobile Navigation + Performance

- Fixed sticky mobile nav selection after swiping.
- Active navigation state now comes only from `currentPage`/`aria-current`.
- Touch focus is cleared after navigation so the previously tapped tab cannot remain visually selected.
- Navigation taps and swipes now share one route transition path and update the page-swap animation key/direction.
- Reduced mobile starfield particle count further and lowered its refresh target from 18 FPS to 10 FPS.
- No authentication, Convex schema, or dependency changes.

## Android status bar
The web/PWA already requests a black theme color. Exact transparent edge-to-edge status bar control is a native Android window capability; it is not reliably exposed to installed PWAs on all Samsung/Chromium combinations.
