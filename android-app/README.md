# Ceventic Android Preview

A personal Android test build of Ceventic, with an optional recap after phone unlock. This is a separate app (`com.ceventic.android.preview`), so it installs alongside the older WebIntoApp app. Android 11 or later is required.

## Try it on your phone

1. Install the supplied **Ceventic Preview** APK. If Android asks, allow installation from the browser/file app used to open this APK.
2. Open Ceventic Preview. In Preferences, choose **Android unlock recaps**. You can also long-press the launcher icon and choose **Unlock recaps**.
3. Sign in inside the app, or choose **Connect account in browser**. For browser pairing, sign in to Ceventic, compare the eight-character device code, and explicitly choose **Connect device**. Return to Preview and tap **Check connection / sync**. Browser pairing also works when a sign-in provider rejects embedded WebViews; it connects recap access, not the WebView's browser login session.
4. Allow **Display over other apps** and the service notification. Choose daily, weekly, and/or monthly recaps, then tap **Enable unlock recaps**.
5. Use **Preview a sample recap** to check the overlay immediately. Sample numbers are clearly labeled and do not change real recap history.
6. Lock and unlock the phone. If a completed period has recorded activity, its recap appears once. Opening Ceventic does not trigger an automatic recap.

The daily recap covers yesterday; weeks run Monday–Sunday; monthly recaps cover the previous calendar month. Dates use the phone's local timezone. Overlapping periods share one compact card with tabs. A period is marked shown after its overlay opens successfully, so repeated unlocks do not repeat it. The settings screen can manually reopen the last synced recap. Empty periods are skipped. There is no in-app Home tab, widget, AI feature, or progress notification.

## Android behavior

Monitoring uses a user-enabled foreground service and a quiet ongoing notification with a **Stop** action. It listens only for system screen-off/unlock broadcasts. It does not use accessibility, screen reading, notification-listener access, background location, exact alarms, or recurring wake-up timers. The overlay closes on screen-off. The ordinary app can optionally request approximate foreground location for prayer times.

A new day's data needs a connection. Offline failures retry on a later unlock, at most once per 15 minutes; a successful response is cached for that local date. Android/Samsung may pause or stop background monitoring. If monitoring stops, open Preview and check Recap settings; device-specific battery restrictions may need adjusting. Force-stopping the app requires reopening it. First enablement can show the most recent completed periods with activity, rather than waiting a full month.

This is a signed **debug/test APK**, not a Play Store release. Physical Samsung unlock, restart, battery-management, and overlay behavior must be tested on the phone. The build and automated checks do not establish that every manufacturer will keep the service running.

## Account and data access

The app creates a random device capability and encrypts its secret with Android Keystore. Only its SHA-256 hash reaches the website during pairing; the native raw secret never enters JavaScript or a URL. Native messages are restricted to Ceventic's exact HTTPS origin and the main frame. HTTPS certificate errors are never bypassed. The recap HTTP endpoint accepts no client-supplied user ID and returns aggregate progress only; it cannot edit tasks or account data.

Access is scoped to the signed-in account and auth session, expires within 30 days (or sooner when that session expires), and ends when that session is revoked. Up to five active devices can be linked. **Preferences → Account → Android recap devices** lets you revoke a device remotely. Signing out from Preview disconnects the native capability; account deletion also removes device records and the new Athkar session history. **Disconnect this Android app** in native settings destroys its local key and cache; remove its old entry in Account settings to release the server-side device slot immediately. Reconnect if credentials expire.

The recap uses recorded progress, not fabricated completion percentages. Unrecorded days are not failures. Existing pending routine/habit/exercise checks are attributed only to their stored reset date. New Athkar history records completed scheduled/prayer sessions from this update onward; it does not invent historical totals or count undated custom counters. Hidden workspace sections are omitted. The recap uses the saved app accent and language; temporary color-wheel previews are not persisted to it.

## Build and verify

Install JDK 17, Android SDK platform 36 and build tools 35.0.0. Set `ANDROID_HOME` or an untracked `local.properties` with `sdk.dir`. Then:

```sh
cd android-app
./gradlew clean :app:testDebugUnitTest :app:assembleDebug :app:lintDebug
```

The APK is `app/build/outputs/apk/debug/app-debug.apk`. Gradle 8.13 is pinned with its distribution SHA-256; AGP is 8.13.2. Run `npm test` and `npm run build` from the repository root for backend/web checks. Deploy Convex/web changes before using this APK: `APP_ORIGIN` and `RECAP_ENDPOINT` in `app/build.gradle` target the existing production Ceventic deployment.

No original wrapper signing material is reused or committed. Release signing and Play foreground-service review are separate future work. Debug signing keys are generated outside the repository and are not committed.
