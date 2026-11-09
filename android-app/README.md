# Ceventic Android Preview

A personal Android test build of Ceventic, with optional recaps after phone unlock. Version 0.7 matches the approved dark translucent concept using each person's saved accent, near-black glass materials, a concrete comparison highlight, a compact activity calendar and supporting task/habit/Athkar cards. Continue is a quiet outlined dark button. The supplied white C is the launcher icon; there is no recap logo or wordmark.

Comparisons use the preceding closed calendar day/week/month and actual saved totals. The headline names the specific metric that improved, stayed steady or decreased. Both periods need explicit records in that metric; missing history never becomes a failed or zero-performance baseline. The number of recorded days in each period is shown beside comparisons, including unequal calendar-month lengths. “Recorded goals complete” is restricted to known completion denominators, 100% on all recorded targets, with records across every day in the period; this is not a claim about untracked goals or an invented overall score. Hidden sections are excluded from both periods. Empty periods are skipped. Existing caches refresh for the new comparison format without disconnecting accounts.

The 680 ms eased scale/slide/fade entrance and 280 ms dismissal respect disabled system animations; screen-off still removes the recap immediately. A stationary full-window backdrop covers the system-bar area and only controls receive safe insets. On Android 12+ when cross-window blur is enabled by the device, the backdrop has subtle transparency (230/255 opacity) over a requested blur. Runtime blur disablement restores an opaque background for readability. No wallpaper/screen pixels are captured, and no new permissions are added. Manufacturers may disable blur or control system-bar composition, so those effects need a phone check. The ordinary app's matching header/system bars are unchanged by this recap redesign.

Safe insets, bounded reading width, a scrollable body and fixed Continue button support small phones, larger text and landscape. This is a separate app (`com.ceventic.android.preview`) that installs alongside the older WebIntoApp wrapper. Android 11 or later is required.

## Try it on your phone

1. Install the supplied **Ceventic Preview** APK. If Android asks, allow installation from the browser/file app used to open this APK.
2. Open Ceventic Preview. In Preferences, choose **Android unlock recaps**. You can also long-press the launcher icon and choose **Unlock recaps**.
3. Allow **Display over other apps** and the service notification. Leave **Show on every unlock** on, then tap **Enable unlock recaps**. This test works even before you connect your account.
4. Lock the phone and unlock it again. A full-height confirmation screen should appear. Lock and unlock again to repeat the test. In Recap settings, **Did it work?** shows the last real unlock time, last successful display time, and number of unlocks detected.
5. **Preview the new card** shows clearly labeled sample numbers without counting a real unlock or consuming recap history.
6. To see real progress, sign in inside the app, or choose **Connect account in browser**. Compare the eight-character device code, choose **Connect device**, return to Preview and tap **Check connection / sync**. Browser pairing connects recap access, not the WebView's browser login session.

Version **0.7-test** corrects the launcher mark’s adaptive-icon size. Its test signing certificate was regenerated because the earlier temporary key was unavailable. Android will therefore require uninstalling the old **Ceventic Preview** before installing 0.7; keep the separate Ceventic System app. Account data remains on the server, but Preview must be signed in/paired and monitoring permissions enabled again. Preserve the new test signing key for future in-place updates. The every-unlock switch defaults to on for this test, including upgrades. Each real wake shows one card; duplicate screen-on/unlock broadcasts do not repeatedly reopen it. When there is no linked account or completed recap data, the screen explicitly confirms unlock detection instead of inventing progress. Opening Ceventic itself does not trigger it.

Turn **Show on every unlock** off to return to once-per-completed-period behavior. Daily/weekly/monthly visibility switches are in **Recap options & help**. The daily recap covers yesterday; weeks run Monday–Sunday; monthly recaps cover the previous calendar month. Dates use the phone's local timezone. Overlapping periods share one compact card with selected tabs. Every-unlock testing does not mark periods acknowledged; the regular mode still marks a period shown only after its overlay opens successfully. Empty periods are skipped only in regular mode. The settings screen can manually reopen the last synced recap. There is no in-app Home tab, widget, AI feature, or progress notification.

## Routine controls in this release

Completed routine days retain their server-side completion lock. Routine checkboxes are disabled while progress loads, while a toggle saves, and after day completion. A stale-client toggle on a completed day returns a locked no-op, without changing tasks, history or statistics or showing a technical server-error toast. Fixed-size icon/check buttons across the web app keep square visible shapes and separate 44 px hit areas on touch devices. Normal text buttons and switches retain their existing sizing.

## Android behavior

Monitoring uses a user-enabled foreground service and a quiet ongoing notification with a **Stop** action. It listens only for protected system screen-on, screen-off, and unlock broadcasts. A short, bounded keyguard check handles phones that deliver unlock broadcasts before lock state settles. It does not use accessibility, screen reading, notification-listener access, background location, exact alarms, or recurring wake-up timers. The overlay closes on screen-off. The ordinary app can optionally request approximate foreground location for prayer times.

A new day's data needs a connection. Offline failures retry on a later unlock, at most once per 15 minutes; a successful response is cached for that local date. Every-unlock confirmation works offline and without an account. Cached progress is labeled by its actual completed-period dates. Android/Samsung may pause or stop background monitoring. If monitoring stops, open Preview and check Recap settings; device-specific battery restrictions may need adjusting. Force-stopping the app requires reopening it. First enablement can show the most recent completed periods with activity, rather than waiting a full month.

This is a signed **debug/test APK**, not a Play Store release. Physical Samsung unlock, restart, battery-management, and overlay behavior must be tested on the phone. JVM Android tests simulate broadcasts, lock state, permissions and view layout; they do not replace physical-device testing. The build and automated checks do not establish that every manufacturer will keep the service running.

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

Keep the new test signing key outside Git and reuse it as the Android debug keystore for subsequent Preview builds. It has also been saved privately with the deliverables. No original wrapper signing material is reused or committed. Release signing and Play foreground-service review are separate future work. Debug signing keys are generated outside the repository and are not committed.
