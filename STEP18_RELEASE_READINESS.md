# Step 18 — Release Readiness

This step closes the account/privacy gaps needed before Ceventic enters Google Play testing.

## Added

- In-app **Settings → Account** section.
- Permanent **Delete account & data** flow with typed `DELETE` confirmation.
- Authenticated Convex deletion mutation that removes Ceventic-owned data, trusted-device/security records, provider account links, verification codes, refresh tokens, sessions, and the auth user record.
- Public `/delete-account` page that works without signing in and explains both in-app deletion and the support-request fallback.
- Privacy, Terms, and Delete Account links on the sign-in screen and legal pages.
- Public beta support/privacy email: `ceventic1@gmail.com`.
- Privacy Policy updated to describe deletion and the current no-email-verification beta state.
- Terms updated to mention in-app account deletion.

## Deletion behavior

The account-deletion mutation is transactional. If cleanup throws, Convex rolls back the mutation rather than leaving a partially deleted account.

User-owned tracker data is selected only through indexes whose first key is the authenticated `userId`; the deletion flow does not scan or touch another user's records.

After the server deletion succeeds, Ceventic clears its local device/theme/progress keys, asks Convex Auth to clear local auth state, and returns to the signed-out app.

## Public URLs after deployment

- `/privacy`
- `/terms`
- `/delete-account`

These routes render before the authentication gate, so Google Play reviewers and users can access them without a Ceventic account.

## Before pushing

Run:

```bat
npm run build
```

The build now includes the security audit and TypeScript checks. Do not deploy if either fails.

## After deployment

Test account deletion with a throwaway account only:

1. Create a fresh test account.
2. Add a routine, habit, workout day, Athkar progress, and macro values.
3. Open Settings → Account.
4. Delete the account.
5. Confirm Ceventic returns to sign-in.
6. Sign up again with the same identity and confirm the previous tracker data does not return.
7. Open `/delete-account` in a signed-out/private browser window and confirm it is public.

Do not use a real account with data you want to keep for this destructive test.
