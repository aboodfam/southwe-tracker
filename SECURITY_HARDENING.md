# Ceventic System — Security & Scale Hardening

This project uses Vercel for the web frontend, Convex for authentication/data/backend functions, and Tauri for the Windows shell. Step 16 hardens the application code around those managed layers instead of adding redundant servers or databases.

## What Step 16 enforces

### Convex authorization

- Every custom public Convex query/mutation checks the authenticated user.
- Record mutations verify the record belongs to that user before changing/deleting it.
- Maintenance/backfill functions are `internalMutation`s and are not client-callable.
- The old unused Weight API was removed from the public function surface. Legacy tables remain so old data is not destroyed.

### Runtime validation and quotas

Product guardrails are centralized in `convex/security.ts`.

Current limits are intentionally generous:

- 24 routines per account
- 64 tasks per routine
- 50 habits
- 14 workout days
- 80 exercises per workout day
- 160 Athkar entries
- 800 retained daily habit entries per habit (>2 years)
- bounded lengths for names, notes, Dhikr text/translations, IDs, etc.
- numeric ranges for macro profile data, workout sets, and Athkar target counts
- live daily progress writes accept only the user's plausible current local date (UTC ± 1 day)

### Abuse/rate controls

A small fixed-window limiter in Convex protects expensive/structural writes such as:

- routine/workout/habit creation and editing
- reorder operations
- profile-name changes
- macro profile autosaves
- day/workout completion actions
- Athkar structure/category resets

High-frequency actions that are intentionally interactive (for example Athkar counting) are instead made idempotent/bounded where possible to avoid adding a second database write to every click.

### Database pressure

- Active routines and workout days now have compound indexes (`userId + isActive`).
- Progress history uses indexed user/date ranges instead of broad scans.
- Workout completion no longer scans all workout history to compute streaks.
- Workout progress is keyed by user + date + workout day so one workout cannot overwrite another.
- Deleted routines/workout days are hard-deleted going forward; historical progress snapshots remain separate.
- Habit entry arrays are capped so a single document cannot grow forever.
- Macro autosave is debounced and unchanged profiles do not get rewritten.
- Duplicate daily Progress subscriptions were removed on the Daily view.

### Web headers

`vercel.json` applies:

- Content Security Policy (CSP)
- clickjacking protection
- MIME sniffing protection
- strict referrer policy
- permissions policy for unused device APIs
- COOP/CORP isolation headers
- HSTS
- immutable one-year caching for hashed `/assets/*`
- revalidation for `index.html` so releases do not keep a stale app shell

### Windows/Tauri

Tauri no longer runs with CSP disabled. Production and development CSPs permit only the app resources, Tauri IPC, the required Convex endpoints, and the existing Google Fonts stylesheet/font origins used for Inter. Basic security headers are also applied by the Tauri shell.

### Build regression guard

Run:

```bash
npm run security:audit
```

The audit fails if a custom public Convex function lacks an auth check/args validator, if maintenance code becomes public, or if the web/Tauri security policies disappear.

Both normal web builds and desktop builds run this audit automatically. The Windows GitHub Actions workflow also runs TypeScript type-checking before compiling the installer.

## One manual item still recommended

The repository currently has no `package-lock.json`. The build environment used to create this Step 16 package could not reach npm long enough to generate one reliably.

On your PC, once after applying Step 16, run:

```bash
npm install --package-lock-only
```

Then commit and push the generated `package-lock.json`. `.gitignore` now allows it. A committed lockfile makes future installs more reproducible and reduces accidental dependency drift.

## Auth upgrades deliberately kept separate

This step hardens authorization around the existing email/password login without replacing the auth stack. Password reset, email verification, optional 2FA, session-management UI, and outbound auth email require a deliberate provider/configuration choice. They should be added as a separate auth upgrade so the working login flow is not broken by an incomplete migration.

## Deployment check

Step 16 adds schema indexes and a small `rateLimits` table. After pushing to GitHub, wait for the Vercel/Convex production deployment to finish successfully before testing the new web build. Rebuild the Tauri Windows artifact from GitHub Actions after the same commit so web and desktop use matching frontend code.
