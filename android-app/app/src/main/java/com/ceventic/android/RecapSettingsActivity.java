package com.ceventic.android;

import android.Manifest;
import android.app.Activity;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.*;
import java.time.LocalDate;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.*;

public final class RecapSettingsActivity extends Activity {
  private RecapStore store;
  private LinearLayout content;
  private TextView status;
  private boolean checking = false;
  private RecapOverlay preview;
  private final ExecutorService executor = Executors.newSingleThreadExecutor();

  @Override
  public void onCreate(Bundle bundle) {
    super.onCreate(bundle);
    store = new RecapStore(this);
    preview = new RecapOverlay(this, store);
    android.widget.FrameLayout root = new android.widget.FrameLayout(this);
    NativeUi.inset(this, root);
    ScrollView scroll = new ScrollView(this);
    content = NativeUi.column(this);
    content.setPadding(
        NativeUi.dp(this, 18), NativeUi.dp(this, 18), NativeUi.dp(this, 18), NativeUi.dp(this, 24));
    scroll.addView(content);
    root.addView(scroll);
    setContentView(root);
    render();
  }

  @Override
  public void onResume() {
    super.onResume();
    render();
    if (!store.user().isEmpty()) checkConnection(false);
  }

  private void render() {
    if (content == null) return;
    content.removeAllViews();
    content.addView(NativeUi.text(this, "Unlock recaps", 26, Color.WHITE, true));
    content.addView(
        NativeUi.text(
            this,
            "An optional screen after you unlock your phone, once for each completed day, week or"
                + " month with recorded activity.",
            14,
            0xffa6adb7,
            false));
    status =
        NativeUi.text(
            this,
            store.user().isEmpty()
                ? "Account not connected"
                : store.enabled()
                    ? (UnlockRecapService.running
                        ? "Monitoring is on"
                        : "Monitoring paused — enable to resume")
                    : "Account connected · monitoring is off",
            14,
            NativeUi.lightAccent(store),
            true);
    content.addView(status);
    if (!store.error().isEmpty())
      content.addView(NativeUi.text(this, store.error(), 13, 0xfffca5a5, false));
    content.addView(
        NativeUi.button(
            this, "Open Ceventic", () -> startActivity(new Intent(this, MainActivity.class))));
    content.addView(
        NativeUi.button(
            this,
            "Connect account in browser",
            () -> {
              try {
                String hash = store.hash();
                startActivity(
                    new Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse(BuildConfig.APP_ORIGIN + "/?ceventicAndroidDevice=" + hash)));
              } catch (Exception e) {
                store.error("Could not create the secure device connection.");
                render();
              }
            }));
    try {
      content.addView(
          NativeUi.text(
              this,
              "Device code: "
                  + store.hash().substring(0, 8).toUpperCase(java.util.Locale.ROOT)
                  + " · match this code before connecting in the browser.",
              12,
              0xff9299a3,
              false));
    } catch (Exception ignored) {
    }
    content.addView(
        NativeUi.button(
            this, checking ? "Checking…" : "Check connection / sync", () -> checkConnection(true)));
    for (String kind : new String[] {"day", "week", "month"}) {
      Switch toggle = new Switch(this);
      String label =
          switch (kind) {
            case "day" -> "Daily recap";
            case "week" -> "Weekly recap";
            default -> "Monthly recap";
          };
      toggle.setText(label);
      toggle.setTextColor(Color.WHITE);
      toggle.setTextSize(15);
      toggle.setMinHeight(NativeUi.dp(this, 52));
      toggle.setChecked(store.selected(kind));
      toggle.setOnCheckedChangeListener((v, checked) -> store.selected(kind, checked));
      content.addView(toggle);
    }
    content.addView(
        NativeUi.text(
            this,
            "Special access is required to show your recap over the phone’s home screen. While"
                + " monitoring is enabled, Android shows a quiet ongoing service notification with"
                + " a Stop action. No accessibility, screen reading, or notification-listener"
                + " access is used.",
            13,
            0xffa6adb7,
            false));
    content.addView(
        NativeUi.button(
            this,
            Settings.canDrawOverlays(this)
                ? "Display-over-apps permission: allowed"
                : "Allow display over other apps",
            () ->
                startActivity(
                    new Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getPackageName())))));
    if (android.os.Build.VERSION.SDK_INT >= 33)
      content.addView(
          NativeUi.button(
              this,
              checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                      == PackageManager.PERMISSION_GRANTED
                  ? "Service notification: allowed"
                  : "Allow service notification",
              () -> requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, 20)));
    content.addView(
        NativeUi.button(
            this,
            store.enabled() ? "Stop unlock recaps" : "Enable unlock recaps",
            () -> {
              if (store.enabled()) {
                store.enabled(false);
                stopService(new Intent(this, UnlockRecapService.class));
                render();
                return;
              }
              if (store.user().isEmpty() || store.expires() <= System.currentTimeMillis()) {
                store.error("Connect your account first, then check the connection.");
                render();
                return;
              }
              if (!Settings.canDrawOverlays(this)) {
                store.error("Allow display over other apps first.");
                render();
                return;
              }
              if (android.os.Build.VERSION.SDK_INT >= 33
                  && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                      != PackageManager.PERMISSION_GRANTED) {
                store.error(
                    "Allow the service notification first so its Stop control is available.");
                render();
                return;
              }
              store.enabled(true);
              try {
                startForegroundService(new Intent(this, UnlockRecapService.class));
                store.error("");
              } catch (Exception error) {
                store.enabled(false);
                store.error("Android blocked monitoring. Try again with this screen open.");
              }
              content.postDelayed(this::render, 600);
            }));
    content.addView(
        NativeUi.button(
            this,
            "Preview a sample recap",
            () -> {
              if (!Settings.canDrawOverlays(this)) {
                store.error("Allow display over other apps to preview the screen.");
                render();
                return;
              }
              try {
                JSONObject demo =
                    new JSONObject()
                        .put("kind", "day")
                        .put("start", LocalDate.now().minusDays(1).toString())
                        .put("end", LocalDate.now().minusDays(1).toString())
                        .put("tasks", 4)
                        .put("habits", 2)
                        .put("exercises", 8)
                        .put("workouts", 1)
                        .put("athkar", 2)
                        .put("totalDays", 1)
                        .put("activeDays", 1);
                preview.show(new JSONArray().put(demo), true, () -> {});
              } catch (Exception error) {
                store.error("Could not display the preview.");
                render();
              }
            }));
    content.addView(
        NativeUi.button(
            this,
            "View last synced recap",
            () -> {
              if (!Settings.canDrawOverlays(this)) {
                store.error("Allow display over other apps first.");
                render();
                return;
              }
              JSONArray periods = store.cache().optJSONArray("periods");
              if (periods == null || periods.length() == 0) {
                store.error(
                    "No recorded recap is available yet. Use the sample preview to test the"
                        + " screen.");
                render();
                return;
              }
              try {
                preview.show(periods, false, () -> {});
              } catch (Exception e) {
                store.error("Could not display the recap.");
                render();
              }
            }));
    content.addView(
        NativeUi.button(
            this,
            "Disconnect this Android app",
            () -> {
              stopService(new Intent(this, UnlockRecapService.class));
              store.disconnect();
              render();
            }));
    content.addView(
        NativeUi.text(
            this,
            "If the phone is offline, a new recap waits for a later unlock with a connection."
                + " Android may stop background apps; reopen Ceventic Preview to resume monitoring."
                + " Past Athkar sessions are not reconstructed. This is a personal test build, not"
                + " a Google Play release.",
            12,
            0xff7d858e,
            false));
  }

  private void checkConnection(boolean explicit) {
    if (checking) return;
    checking = true;
    if (status != null) status.setText("Checking the secure account connection…");
    executor.execute(
        () -> {
          String error = "";
          try {
            RecapClient.sync(store);
          } catch (Exception e) {
            error =
                e.getMessage() == null ? "Could not sync. Check the connection." : e.getMessage();
          }
          final String message = error;
          runOnUiThread(
              () -> {
                checking = false;
                if (isDestroyed()) return;
                if (!message.isEmpty()) store.error(message);
                render();
              });
        });
  }

  @Override
  public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
    super.onRequestPermissionsResult(request, permissions, results);
    render();
  }

  @Override
  public void onPause() {
    preview.hide();
    super.onPause();
  }

  @Override
  public void onDestroy() {
    preview.hide();
    executor.shutdownNow();
    super.onDestroy();
  }
}
