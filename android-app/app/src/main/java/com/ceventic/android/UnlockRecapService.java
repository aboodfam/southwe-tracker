package com.ceventic.android;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;
import android.provider.Settings;
import java.time.LocalDate;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.*;

public final class UnlockRecapService extends Service {
  public static volatile boolean running = false;
  private RecapStore store;
  private RecapOverlay overlay;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final ExecutorService executor = Executors.newSingleThreadExecutor();
  private boolean fetching = false, destroyed = false;
  private long retryAfter = 0;
  private final UnlockCycle cycle = new UnlockCycle();
  private final BroadcastReceiver receiver =
      new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent intent) {
          if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) {
            overlay.hide();
            cycle.screenOff();
            unlockChecks = 0;
            handler.removeCallbacks(screenOnCheck);
            return;
          }
          if (Intent.ACTION_SCREEN_ON.equals(intent.getAction())) {
            handler.removeCallbacks(screenOnCheck);
            unlockChecks = 0;
            handler.postDelayed(screenOnCheck, 350);
          }
          if (Intent.ACTION_USER_PRESENT.equals(intent.getAction())) {
            handler.removeCallbacks(screenOnCheck);
            unlockChecks = 0;
            // Some phones deliver the broadcast just before keyguard state settles.
            handler.postDelayed(screenOnCheck, 200);
          }
        }
      };

  private int unlockChecks;
  private final Runnable screenOnCheck =
      new Runnable() {
        @Override
        public void run() {
          if (destroyed || !store.enabled()) return;
          if (unlocked()) {
            unlockChecks = 0;
            onUnlock();
          } else if (++unlockChecks < 8 && getSystemService(PowerManager.class).isInteractive())
            handler.postDelayed(this, 400);
          else unlockChecks = 0;
        }
      };

  @Override
  public void onCreate() {
    super.onCreate();
    store = new RecapStore(this);
    overlay = new RecapOverlay(this, store);
    NotificationManager notifications = getSystemService(NotificationManager.class);
    NotificationChannel channel =
        new NotificationChannel(
            "unlock_recaps", "Unlock recap monitoring", NotificationManager.IMPORTANCE_LOW);
    channel.setSound(null, null);
    channel.enableVibration(false);
    channel.setShowBadge(false);
    channel.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
    notifications.createNotificationChannel(channel);
    IntentFilter filter = new IntentFilter();
    filter.addAction(Intent.ACTION_USER_PRESENT);
    filter.addAction(Intent.ACTION_SCREEN_ON);
    filter.addAction(Intent.ACTION_SCREEN_OFF);
    // These are protected system broadcasts. No app-defined actions are accepted.
    if (Build.VERSION.SDK_INT >= 33)
      registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
    else registerReceiver(receiver, filter);
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && "STOP".equals(intent.getAction())) {
      store.enabled(false);
      stopSelf();
      return START_NOT_STICKY;
    }
    if (!store.enabled()
        || (!store.everyUnlock()
            && (store.user().isEmpty() || store.expires() <= System.currentTimeMillis()))
        || !Settings.canDrawOverlays(this)
        || (Build.VERSION.SDK_INT >= 33
            && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != android.content.pm.PackageManager.PERMISSION_GRANTED)) {
      store.enabled(false);
      stopSelf();
      return START_NOT_STICKY;
    }
    PendingIntent settings =
        PendingIntent.getActivity(
            this,
            0,
            new Intent(this, RecapSettingsActivity.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    PendingIntent stop =
        PendingIntent.getService(
            this,
            1,
            new Intent(this, UnlockRecapService.class).setAction("STOP"),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    Notification notification =
        new Notification.Builder(this, "unlock_recaps")
            .setSmallIcon(com.ceventic.android.R.drawable.ic_recap)
            .setContentTitle("Ceventic unlock recaps")
            .setContentText("Monitoring is on. Tap to manage; Stop to turn it off.")
            .setOngoing(true)
            .setShowWhen(false)
            .setContentIntent(settings)
            .setVisibility(Notification.VISIBILITY_SECRET)
            .addAction(new Notification.Action.Builder(null, "Stop", stop).build())
            .build();
    try {
      if (Build.VERSION.SDK_INT >= 34)
        startForeground(70, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
      else startForeground(70, notification);
      running = true;
    } catch (Exception error) {
      store.enabled(false);
      store.error("Android blocked monitoring. Open Recap settings and enable it again.");
      stopSelf();
      return START_NOT_STICKY;
    }
    return START_STICKY;
  }

  private boolean unlocked() {
    KeyguardManager keyguard = getSystemService(KeyguardManager.class);
    PowerManager power = getSystemService(PowerManager.class);
    return power.isInteractive() && !keyguard.isKeyguardLocked() && !keyguard.isDeviceLocked();
  }

  private void onUnlock() {
    if (!store.enabled()) {
      stopSelf();
      return;
    }
    if (destroyed
        || !unlocked()
        || overlay.showing()
        || !Settings.canDrawOverlays(this)
        || !cycle.claim()) return;
    store.detectedUnlock();
    JSONObject cache = store.cache();
    if (store.everyUnlock()) {
      showEvery(cache);
      if (store.user().isEmpty() || store.expires() <= System.currentTimeMillis()) return;
    }
    if (fetching) return;
    if (LocalDate.now().toString().equals(cache.optString("localDate"))) {
      if (!store.everyUnlock()) showDue(cache);
      return;
    }
    if (System.currentTimeMillis() < retryAfter) return;
    fetching = true;
    executor.execute(
        () -> {
          JSONObject data = null;
          String failure = "";
          try {
            data = RecapClient.sync(store);
          } catch (Exception e) {
            failure = e.getMessage() == null ? "Could not sync recaps." : e.getMessage();
          }
          final JSONObject result = data;
          final String error = failure;
          handler.post(
              () -> {
                fetching = false;
                if (destroyed) return;
                if (result != null) {
                  retryAfter = 0;
                  if (store.everyUnlock()) {
                    // Update an open card in place. Never reopen after the user dismisses it.
                    if (overlay.showing()) showEvery(result);
                  } else showDue(result);
                } else {
                  store.error(error);
                  retryAfter = System.currentTimeMillis() + 15 * 60 * 1000;
                  if (!store.enabled() || store.user().isEmpty()) stopSelf();
                  else if (store.everyUnlock() && overlay.showing()) showEvery(store.cache());
                }
              });
        });
  }

  private void showEvery(JSONObject data) {
    if (!store.enabled() || !unlocked() || !Settings.canDrawOverlays(this)) return;
    JSONArray periods = new JSONArray();
    boolean linked = !store.user().isEmpty() && store.expires() > System.currentTimeMillis();
    if (linked && store.user().equals(data.optString("userId"))) {
      JSONArray all = data.optJSONArray("periods");
      if (all != null)
        for (int i = 0; i < all.length(); i++) {
          JSONObject p = all.optJSONObject(i);
          if (p != null
              && store.selected(p.optString("kind"))
              && PeriodRules.closedEnd(p.optString("kind"), LocalDate.now())
                  .equals(p.optString("end"))) periods.put(p);
        }
    }
    String message =
        !linked
            ? "Connect your account to see your progress here."
            : !LocalDate.now().toString().equals(data.optString("localDate"))
                ? (store.error().isEmpty()
                    ? "Syncing your saved progress…"
                    : "Progress is offline. Check connection in Recap settings.")
                : periods.length() == 0
                    ? "No completed recap with recorded activity yet."
                    : "Shown on every unlock";
    try {
      overlay.present(periods, false, true, message, () -> {});
      store.screenShown();
    } catch (Exception error) {
      store.error("Android could not display the recap. Check display-over-apps permission.");
    }
  }

  private void showDue(JSONObject data) {
    if (!store.enabled()
        || !unlocked()
        || !store.user().equals(data.optString("userId"))
        || store.expires() <= System.currentTimeMillis()) return;
    JSONArray due = new JSONArray(), periods = data.optJSONArray("periods");
    if (periods == null) return;
    for (int i = 0; i < periods.length(); i++) {
      JSONObject p = periods.optJSONObject(i);
      if (p != null
          && store.selected(p.optString("kind"))
          && PeriodRules.due(
              p.optString("kind"),
              p.optString("end"),
              store.acknowledged(p.optString("kind")),
              LocalDate.now())) due.put(p);
    }
    if (due.length() == 0) return;
    try {
      overlay.show(due, false, () -> {});
      store.screenShown();
      for (int i = 0; i < due.length(); i++) {
        JSONObject p = due.getJSONObject(i);
        store.acknowledge(p.getString("kind"), p.getString("end"));
      }
    } catch (Exception error) {
      store.error("Android could not display the recap. Check display-over-apps permission.");
    }
  }

  @Override
  public void onDestroy() {
    destroyed = true;
    running = false;
    try {
      unregisterReceiver(receiver);
    } catch (Exception ignored) {
    }
    overlay.hide();
    executor.shutdownNow();
    handler.removeCallbacksAndMessages(null);
    stopForeground(STOP_FOREGROUND_REMOVE);
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
