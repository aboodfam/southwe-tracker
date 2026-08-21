# Ceventic — Google Play Beta Checklist

## Completed in Step 18

- Public Privacy Policy route (`/privacy`)
- Public Terms route (`/terms`)
- Public account-deletion route (`/delete-account`)
- In-app Settings → Account deletion control
- Permanent server-side deletion of account-owned tracker/auth data
- Support/privacy contact: `ceventic1@gmail.com`
- Google sign-in already configured for the current production backend

## Still required before Play upload

1. Build the Android version and signed `.aab` package.
2. Target the Google Play API level required at submission time (we are planning API 36 for the 2026 release).
3. Test sign-in, offline/error states, navigation, account deletion, and app resume/background behavior on real Android devices.
4. Complete Play Console Data safety accurately from the final Android build and its libraries.
5. Complete content rating, target audience, ads declaration, app access/reviewer instructions, and other App content sections.
6. Prepare store listing assets: app icon, feature graphic, phone screenshots, short description, and full description.
7. Upload to internal/closed testing first.
8. If the developer account is subject to Google's new-personal-account production-access requirement, complete the required closed test before applying for Production.

## Reviewer access

Ceventic requires an account for core functionality. Keep a dedicated reviewer/test account available during Play review and provide simple sign-in instructions in Play Console App access. Avoid credentials that depend on expiring email codes.

## Destructive QA

Use a throwaway account for account-deletion testing. Never test deletion on an account whose data you want to keep.
