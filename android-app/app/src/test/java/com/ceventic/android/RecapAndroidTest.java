package com.ceventic.android;

import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

import android.app.*;
import android.content.*;
import android.graphics.*;
import android.os.*;
import android.view.*;
import android.widget.*;
import java.io.*;
import java.time.Duration;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ServiceController;
import org.robolectric.annotation.*;
import org.robolectric.shadows.*;
import org.robolectric.util.ReflectionHelpers;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34, qualifiers = "w390dp-h844dp-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class RecapAndroidTest {
  private Application app;
  private RecapStore store;

  @Before
  public void setup() {
    app = RuntimeEnvironment.getApplication();
    app.getSharedPreferences("native_recaps", Context.MODE_PRIVATE).edit().clear().commit();
    store = new RecapStore(app);
    ShadowSettings.setCanDrawOverlays(true);
    shadowOf(app).grantPermissions(android.Manifest.permission.POST_NOTIFICATIONS);
    shadowOf(app.getSystemService(KeyguardManager.class)).setKeyguardLocked(false);
    shadowOf(app.getSystemService(KeyguardManager.class)).setIsDeviceLocked(false);
    shadowOf(app.getSystemService(PowerManager.class)).setIsInteractive(true);
  }

  private void broadcast(String action) {
    app.sendBroadcast(new Intent(action));
    shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(800));
  }

  @Test
  public void actualUnlockShowsWithoutAccountAndRepeatsAfterNextScreenOff() {
    assertTrue(store.everyUnlock());
    store.enabled(true);
    ServiceController<UnlockRecapService> controller =
        Robolectric.buildService(UnlockRecapService.class).create();
    UnlockRecapService service = controller.get();
    service.onStartCommand(null, 0, 1);
    try {
      broadcast(Intent.ACTION_USER_PRESENT);
      assertEquals(1, store.unlockCount());
      assertTrue(store.lastUnlock() > 0);
      assertTrue(store.lastShown() > 0);
      RecapOverlay overlay = ReflectionHelpers.getField(service, "overlay");
      assertTrue(overlay.showing());
      overlay.hide();
      broadcast(Intent.ACTION_SCREEN_ON);
      broadcast(Intent.ACTION_USER_PRESENT);
      assertEquals("duplicate system broadcasts must not reopen the card", 1, store.unlockCount());
      assertFalse(overlay.showing());
      broadcast(Intent.ACTION_SCREEN_OFF);
      broadcast(Intent.ACTION_SCREEN_ON);
      assertEquals(2, store.unlockCount());
      assertTrue(overlay.showing());
      service.onStartCommand(new Intent().setAction("STOP"), 0, 2);
      assertFalse(store.enabled());
    } finally {
      controller.destroy();
    }
  }

  @Test
  public void aLockedPhoneNeverShowsPersonalProgress() {
    store.enabled(true);
    ServiceController<UnlockRecapService> controller =
        Robolectric.buildService(UnlockRecapService.class).create();
    controller.get().onStartCommand(null, 0, 1);
    try {
      shadowOf(app.getSystemService(KeyguardManager.class)).setKeyguardLocked(true);
      shadowOf(app.getSystemService(KeyguardManager.class)).setIsDeviceLocked(true);
      broadcast(Intent.ACTION_SCREEN_ON);
      broadcast(Intent.ACTION_USER_PRESENT);
      assertEquals(0, store.unlockCount());
      assertEquals(0, store.lastShown());
      shadowOf(app.getSystemService(KeyguardManager.class)).setKeyguardLocked(false);
      shadowOf(app.getSystemService(KeyguardManager.class)).setIsDeviceLocked(false);
      broadcast(Intent.ACTION_USER_PRESENT);
      assertEquals(1, store.unlockCount());
    } finally {
      controller.destroy();
    }
  }

  @Test
  public void compactNativeCardFitsPhoneAndLargeTextWithoutInventingData() throws Exception {
    JSONObject day =
        new JSONObject()
            .put("kind", "day")
            .put("start", "2026-11-08")
            .put("end", "2026-11-08")
            .put("tasks", 4)
            .put("habits", 2)
            .put("workouts", 1)
            .put("exercises", 8)
            .put("athkar", 2);
    for (int width : new int[] {284, 354}) {
      View card =
          new RecapOverlay(app, store)
              .buildCard(new JSONArray().put(day), true, false, "", () -> {});
      render(card, width, "sample-" + width);
      assertTrue(
          "compact card should fit without taking the whole screen",
          card.getMeasuredHeight() < 610);
    }
    app.getResources().getConfiguration().fontScale = 1.3f;
    app.getResources().getDisplayMetrics().scaledDensity = 1.3f;
    View largeCard =
        new RecapOverlay(app, store).buildCard(new JSONArray().put(day), true, false, "", () -> {});
    render(largeCard, 284, "sample-large-text");
    assertTrue(largeCard.getMeasuredHeight() < 700);
    View status =
        new RecapOverlay(app, store)
            .buildCard(
                new JSONArray(),
                false,
                true,
                "Connect your account to see your progress here.",
                () -> {});
    render(status, 284, "unlock-status");
    assertTrue(status.getMeasuredHeight() < 500);
    assertEquals(
        "manual layout/preview must not consume automatic unlocks", 0, store.unlockCount());
  }

  @Test
  public void tabsUseDayWeekMonthOrderAndSwitchTheActualPeriod() throws Exception {
    JSONObject day =
        new JSONObject()
            .put("kind", "day")
            .put("start", "2026-11-08")
            .put("end", "2026-11-08")
            .put("tasks", 4);
    JSONObject week =
        new JSONObject(day.toString())
            .put("kind", "week")
            .put("start", "2026-11-02")
            .put("totalDays", 7)
            .put("activeDays", 3);
    View card =
        new RecapOverlay(app, store)
            .buildCard(
                new JSONArray().put(week).put(day), false, true, "Shown on every unlock", () -> {});
    render(card, 354, "period-tabs");
    assertNotNull(findText(card, "Your day"));
    TextView tab = findText(card, "Week");
    assertTrue(tab instanceof Button);
    assertTrue(tab.performClick());
    render(card, 354, "week-tab");
    assertNotNull(findText(card, "Your week"));
    assertTrue(tab.isSelected());
  }

  @Test
  public void regularModeStillRequiresAnAccountAndModeChoicePersists() {
    store.everyUnlock(false);
    assertFalse(new RecapStore(app).everyUnlock());
    store.enabled(true);
    ServiceController<UnlockRecapService> controller =
        Robolectric.buildService(UnlockRecapService.class).create();
    try {
      assertEquals(Service.START_NOT_STICKY, controller.get().onStartCommand(null, 0, 1));
      assertFalse(store.enabled());
    } finally {
      controller.destroy();
    }
  }

  private TextView findText(View view, String value) {
    if (view instanceof TextView && value.equals(((TextView) view).getText().toString()))
      return (TextView) view;
    if (view instanceof ViewGroup) {
      ViewGroup group = (ViewGroup) view;
      for (int i = 0; i < group.getChildCount(); i++) {
        TextView found = findText(group.getChildAt(i), value);
        if (found != null) return found;
      }
    }
    return null;
  }

  private void render(View card, int width, String name) throws Exception {
    card.measure(
        View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
        View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED));
    card.layout(0, 0, width, card.getMeasuredHeight());
    Bitmap image = Bitmap.createBitmap(width, card.getMeasuredHeight(), Bitmap.Config.ARGB_8888);
    card.draw(new Canvas(image));
    File directory = new File("build/outputs/recap-ui");
    directory.mkdirs();
    try (FileOutputStream file = new FileOutputStream(new File(directory, name + ".png"))) {
      image.compress(Bitmap.CompressFormat.PNG, 100, file);
    }
  }
}
