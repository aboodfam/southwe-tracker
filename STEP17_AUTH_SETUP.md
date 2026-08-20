# Step 17 — Authentication + Mobile Focus Mode

Step 17 adds the new Ceventic auth experience, Google sign-in on the web,
password recovery, 30-day trusted-device email checks, a black mobile system
bar configuration, and a focused Athkar reader on phones.

## Important: Google and email codes need one-time provider setup

The code is already wired. Google and email delivery will not work until the
production Convex deployment has the required secrets.

### 1. Resend — verification + password reset codes

Create a Resend account, verify a sender/domain, then set these **server-side
Convex environment variables**:

```bash
npx convex env set RESEND_API_KEY "re_..." --prod
npx convex env set AUTH_EMAIL_FROM "Ceventic <auth@yourdomain.com>" --prod
```

For development, run the same commands without `--prod` if you also want codes
from the dev deployment.

Ceventic deliberately leaves the trusted-device gate disabled when those two
values are absent. This prevents a bad email configuration from locking every
user out. As soon as both are configured, a new/untrusted device is asked for a
6-digit code and becomes trusted for 30 days after successful verification.

The device credential itself is a random local token. Convex stores only its
SHA-256 hash; Ceventic does not use browser fingerprinting as the trust secret.

### 2. Google OAuth

Create a **Web application** OAuth client in Google Cloud Console.

Set the production Convex environment variables:

```bash
npx convex env set AUTH_GOOGLE_ID "YOUR_GOOGLE_CLIENT_ID" --prod
npx convex env set AUTH_GOOGLE_SECRET "YOUR_GOOGLE_CLIENT_SECRET" --prod
npx convex env set SITE_URL "https://YOUR-VERCEL-DOMAIN" --prod
```

In Google Cloud Console, add your production website as an authorized
JavaScript origin:

```text
https://YOUR-VERCEL-DOMAIN
```

and add this exact authorized redirect URI (the callback itself lives on
Convex, not Vercel):

```text
https://YOUR-DEPLOYMENT.convex.site/api/auth/callback/google
```

You can find the `.convex.site` URL in Convex Dashboard → Settings → URL &
Deploy Key.

Also make sure `SITE_URL` is the exact production website origin (no random
preview URL). Convex Auth redirects OAuth back to `SITE_URL` by default.

### 3. Windows desktop app

Email/password, reset codes, and trusted-device verification work in the Tauri
Windows app.

Google OAuth is intentionally presented as **web-only** in the Windows app for
now. Google OAuth does not permit the normal embedded-webview OAuth approach;
adding desktop Google sign-in correctly requires a system-browser/deep-link
flow rather than weakening OAuth policy.

## Trusted-device behavior

- First password sign-up: account signs in, then Ceventic verifies the account
  email/device before showing the tracker.
- Existing account on a new browser/device: one email code is required.
- Verified device: trusted for 30 days.
- After 30 days: next authenticated visit asks for a fresh code.
- Signing out does **not** erase the trusted-device token, so signing back in on
  the same device within 30 days does not create unnecessary friction.
- The verification code expires after 10 minutes and incorrect attempts are
  capped.
- Code sends are server rate-limited.

Successful device verification also marks the Auth user email as verified. This
allows a later Google sign-in with the same verified address to safely link to
that existing user under Convex Auth's verified-email linking behavior.

### Security scope of the 30-day device check

This Step 17 implementation is an **application-level trusted-device gate**:
Ceventic hides all tracker UI until the email code succeeds and records only a
hashed random device token. It is useful protection against ordinary sign-ins
from a new browser/device.

It is not the same thing as a cryptographic second factor enforced inside every
Convex RPC. Convex Auth creates the authenticated session before this app-level
device gate runs, so someone who somehow steals a raw valid session token and
writes their own Convex client is outside this gate's protection. Turning the
email code into hard MFA at session issuance requires a deeper auth flow (or an
auth provider with native MFA/session policies) and should be treated as a
separate security migration rather than pretending this UI gate provides it.

## Password recovery

The new login screen includes **Forgot password?**. It sends a six-digit Resend
code, verifies it, changes the password, and Convex Auth invalidates the user's
other sessions as part of the reset flow.

## Mobile changes

- `theme-color`, safe-area background, and standalone-app status bar are black.
- When a phone opens an Athkar section, the global Ceventic header/navigation is
  hidden and the reader takes over the screen.
- The Athkar back button returns to Athkar sections; from there the normal
  Ceventic navigation is visible again.
- Desktop keeps the normal Ceventic shell.

## Deployment check

After adding provider secrets:

```bash
npm audit
npm run security:audit
npm run typecheck
npm run build
```

Then commit/push and wait for the Vercel + Convex production deployment to be
Ready before testing Google or email codes.
