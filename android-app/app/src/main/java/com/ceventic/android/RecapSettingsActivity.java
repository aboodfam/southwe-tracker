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
  private boolean checking = false;
  private RecapOverlay preview;
  private final ExecutorService executor = Executors.newSingleThreadExecutor();

  private final android.content.SharedPreferences.OnSharedPreferenceChangeListener updates =
      (prefs, key) -> {
        if ("last_unlock".equals(key) || "last_shown".equals(key) || "enabled".equals(key))
          if (content != null) content.post(this::render);
      };

  @Override
  public void onCreate(Bundle bundle) {
    super.onCreate(bundle);
    store = new RecapStore(this);
    store.listen(updates);
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

  private boolean detailsOpen;

  private boolean linked() {
    return !store.user().isEmpty() && store.expires() > System.currentTimeMillis();
  }

  private String stamp(long time) {
    return time == 0
        ? "Not detected yet"
        : java.text.DateFormat.getDateTimeInstance(
                java.text.DateFormat.SHORT, java.text.DateFormat.MEDIUM)
            .format(new java.util.Date(time));
  }

  private LinearLayout section(String title) {
    LinearLayout box = NativeUi.column(this);
    box.setPadding(
        NativeUi.dp(this, 14), NativeUi.dp(this, 12), NativeUi.dp(this, 14), NativeUi.dp(this, 14));
    box.setBackground(NativeUi.panel(0xff090d12, 0x22ffffff, 18, this));
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
    lp.topMargin = NativeUi.dp(this, 12);
    content.addView(box, lp);
    box.addView(NativeUi.text(this, title, 14, Color.WHITE, true));
    return box;
  }

  private void note(LinearLayout box, String message) {
    box.addView(NativeUi.text(this, message, 12, 0xff929ba7, false));
  }

  private Switch toggle(
      LinearLayout box,
      String label,
      boolean checked,
      android.widget.CompoundButton.OnCheckedChangeListener listener) {
    Switch v = new Switch(this);
    v.setText(label);
    v.setTextColor(0xffe5e7eb);
    v.setTextSize(14);
    v.setMinHeight(NativeUi.dp(this, 48));
    v.setThumbTintList(
        android.content.res.ColorStateList.valueOf(
            checked ? NativeUi.lightAccent(store) : 0xff89929f));
    v.setChecked(checked);
    v.setOnCheckedChangeListener(listener);
    box.addView(v);
    return v;
  }

  private void render() {
    if (content == null || isDestroyed()) return;
    content.removeAllViews();
    content.addView(NativeUi.text(this, "Unlock recaps", 24, Color.WHITE, true));
    note(content, "A small Ceventic screen after you unlock your phone.");
    LinearLayout monitor =
        section(
            store.enabled() && UnlockRecapService.running
                ? "Monitoring is on"
                : store.enabled() ? "Monitoring paused" : "Monitoring is off");
    note(
        monitor,
        linked()
            ? "Account connected"
            : "You can test unlock detection before connecting your account.");
    toggle(
        monitor,
        "Show on every unlock",
        store.everyUnlock(),
        (v, checked) -> {
          store.everyUnlock(checked);
          if (!checked && !linked() && store.enabled()) {
            store.enabled(false);
            stopService(new Intent(this, UnlockRecapService.class));
          }
          render();
        });
    note(
        monitor,
        store.everyUnlock()
            ? "On for testing. Every unlock shows this screen, even when there is no recap yet."
            : "Each completed day, week or month is shown once when it has recorded activity.");
    Button enable =
        NativeUi.button(
            this,
            store.enabled() ? "Stop unlock recaps" : "Enable unlock recaps",
            this::toggleMonitoring);
    enable.setTextColor(NativeUi.lightAccent(store));
    enable.setBackground(
        NativeUi.panel(
            (NativeUi.accent(store) & 0x00ffffff) | 0x18000000,
            (NativeUi.accent(store) & 0x00ffffff) | 0x45000000,
            12,
            this));
    monitor.addView(enable);
    if (!store.error().isEmpty())
      monitor.addView(NativeUi.text(this, store.error(), 12, 0xfffca5a5, false));
    LinearLayout proof = section("Did it work?");
    note(proof, "Last unlock: " + stamp(store.lastUnlock()));
    note(proof, "Last screen shown: " + stamp(store.lastShown()));
    note(proof, "Unlocks detected: " + store.unlockCount());
    note(
        proof,
        "Enable monitoring, lock the phone, then unlock it. A manual preview does not count as an"
            + " unlock.");
    proof.addView(NativeUi.button(this, "Preview the new card", this::sample));
    LinearLayout access = section("Permissions");
    boolean overlay = Settings.canDrawOverlays(this);
    note(access, "Display over other apps: " + (overlay ? "allowed" : "needed"));
    if (!overlay)
      access.addView(
          NativeUi.button(
              this,
              "Allow display over other apps",
              () ->
                  startActivity(
                      new Intent(
                          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                          Uri.parse("package:" + getPackageName())))));
    boolean notification =
        android.os.Build.VERSION.SDK_INT < 33
            || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    note(access, "Service notification: " + (notification ? "allowed" : "needed"));
    if (!notification)
      access.addView(
          NativeUi.button(
              this,
              "Allow service notification",
              () -> requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, 20)));
    note(
        access,
        "A quiet ongoing notification keeps monitoring visible and gives you a Stop button.");
    LinearLayout account = section(linked() ? "Your recap data" : "Connect your account");
    note(
        account,
        linked()
            ? "Your saved accent, language and recorded progress are linked."
            : "Link your account for real progress. Unlock testing works without it.");
    account.addView(
        NativeUi.button(
            this, "Open Ceventic", () -> startActivity(new Intent(this, MainActivity.class))));
    if (!linked())
      account.addView(
          NativeUi.button(
              this,
              "Connect account in browser",
              () -> {
                try {
                  startActivity(
                      new Intent(
                          Intent.ACTION_VIEW,
                          Uri.parse(
                              BuildConfig.APP_ORIGIN + "/?ceventicAndroidDevice=" + store.hash())));
                } catch (Exception e) {
                  store.error("Could not create the secure device connection.");
                  render();
                }
              }));
    if (!linked())
      try {
        note(
            account,
            "Device code: "
                + store.hash().substring(0, 8).toUpperCase(java.util.Locale.ROOT)
                + " · match before connecting.");
      } catch (Exception ignored) {
      }
    account.addView(
        NativeUi.button(
            this, checking ? "Checking…" : "Check connection / sync", () -> checkConnection(true)));
    if (store.synced() > 0) note(account, "Last sync: " + stamp(store.synced()));
    content.addView(
        NativeUi.button(
            this,
            detailsOpen ? "Hide recap options" : "Recap options & help",
            () -> {
              detailsOpen = !detailsOpen;
              render();
            }));
    if (detailsOpen) {
      LinearLayout options = section("Include in your recap");
      for (String kind : new String[] {"day", "week", "month"})
        toggle(
            options,
            kind.equals("day")
                ? "Daily recap"
                : kind.equals("week") ? "Weekly recap" : "Monthly recap",
            store.selected(kind),
            (v, checked) -> store.selected(kind, checked));
      options.addView(
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
                  store.error("No recorded recap yet. Try Preview the new card.");
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
      options.addView(
          NativeUi.button(
              this,
              "Disconnect this Android app",
              () -> {
                store.disconnect();
                render();
              }));
      note(
          options,
          "The daily recap covers yesterday. Weeks run Monday–Sunday; months use the previous"
              + " calendar month. Dates use your phone’s timezone.");
      note(
          options,
          "Only recorded activity is counted. Athkar history starts with the first Preview update"
              + " and counts scheduled/prayer sessions. Unrecorded days are not failures.");
      note(
          options,
          "Android may pause background monitoring. Reopen Preview to resume it. New data needs a"
              + " connection; cached recaps and unlock detection work offline.");
      note(
          options,
          "No accessibility or screen-reading access is used. This is a personal test build, not a"
              + " Play Store release.");
    }
  }

  private void toggleMonitoring() {
    if (store.enabled()) {
      store.enabled(false);
      stopService(new Intent(this, UnlockRecapService.class));
      render();
      return;
    }
    if (!store.everyUnlock() && !linked()) {
      store.error("Connect your account or turn on Show on every unlock to test.");
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
      store.error("Allow the service notification so its Stop control is available.");
      render();
      return;
    }
    store.enabled(true);
    try {
      startForegroundService(new Intent(this, UnlockRecapService.class));
      store.error("");
    } catch (Exception e) {
      store.enabled(false);
      store.error("Android blocked monitoring. Try again with this screen open.");
    }
    content.postDelayed(this::render, 600);
  }

  private void sample() {
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
      demo.put(
          "days",
          new JSONArray()
              .put(
                  new JSONObject()
                      .put("date", LocalDate.now().minusDays(1).toString())
                      .put("tasks", 4)
                      .put("habits", 2)
                      .put("exercises", 8)
                      .put("workouts", 1)
                      .put("athkar", 2)));
      preview.show(new JSONArray().put(demo), true, () -> {});
    } catch (Exception e) {
      store.error("Could not display the preview.");
      render();
    }
  }

  private void checkConnection(boolean explicit) {
    if (checking) return;
    checking = true;
    render();
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
    store.unlisten(updates);
    super.onDestroy();
  }
}
