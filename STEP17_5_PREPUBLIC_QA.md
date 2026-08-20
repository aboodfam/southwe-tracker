# Step 17.5 — Pre-public QA

Final beta polish before opening Ceventic to testers.

- Fixed custom accent editor overflow at narrow widths / browser zoom.
- Workout dialogs now render through a document-level portal and stay centered regardless of page scroll.
- Add Exercise no longer auto-opens the mobile keyboard.
- Empty workout days show an obvious Add Exercise action.
- Applying a split is now one authenticated Convex mutation, so the confirmation closes immediately and the seven day names update atomically.
- Split controls show a short applying state and reject double submissions.
- Corrected workout-day deletion copy to match real delete behavior.
- Password recovery is hidden by default during the free beta until transactional email is configured. Set `VITE_PASSWORD_RECOVERY_ENABLED=true` only after the backend mail variables exist.

Google Play publication still requires a public privacy policy plus both in-app and external account-deletion paths. Those are release-policy work, not included in this UI patch.
