# Step 18.1 — Convex deploy fix

Vercel/Convex typecheck failed because `convex/account.ts` referenced two auth-table indexes that are not exposed by `@convex-dev/auth@0.0.94` in this project:

- `authVerifiers.sessionId`
- `authVerificationCodes.accountId`

The account-deletion cleanup now filters those two temporary auth tables by their relationship fields instead. All other indexed, user-scoped deletion queries remain unchanged.

This preserves the permanent account/data deletion behavior while matching the actual generated Convex Auth data model.
