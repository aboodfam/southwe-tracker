# Step 17.7 — Windows Build + Policies

## Windows build fix

The Windows GitHub Action failed because `Referrer-Policy` was placed inside `app.security.headers` in `src-tauri/tauri.conf.json`.

Tauri v2 only accepts a documented allowlist of response header names in that object. `Referrer-Policy` is a valid web/Vercel header, but it is not accepted by Tauri's desktop header schema.

Step 17.7 removes `Referrer-Policy` from the Tauri header object while keeping:

- Tauri Content Security Policy (`csp` / `devCsp`)
- `X-Content-Type-Options: nosniff`
- restrictive `Permissions-Policy`
- the full web/Vercel `Referrer-Policy` and other web security headers

The project security audit now checks Tauri header names against the supported allowlist so this configuration error cannot silently return later.

## Public policy pages

Two public routes are included and work without signing in:

- `/privacy`
- `/terms`

Links are shown at the bottom of the Ceventic sign-in/sign-up card.

The Privacy Policy reflects the current beta architecture: Convex backend/auth, Vercel public web release, optional Google sign-in, tracker content, trusted-device security data, and no sale of personal data.

## Before Google Play submission

Set `VITE_SUPPORT_EMAIL` to a real support/privacy contact address so the public policy displays a direct contact method.

Account deletion is intentionally **not claimed as finished** in this patch. Google Play requires apps that allow account creation to provide both an in-app deletion option and an external deletion-request route. Implement and test that before Play submission.
