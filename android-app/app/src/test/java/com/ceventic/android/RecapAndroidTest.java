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
  public void fullScreenRecapFillsPhoneAndKeepsContinueVisibleWithLargeText() throws Exception {
    app.getSharedPreferences("native_recaps", Context.MODE_PRIVATE)
        .edit()
        .putString("accent", "#F43F5E")
        .commit();
    JSONObject month =
        new JSONObject()
            .put("kind", "month")
            .put("start", "2026-10-01")
            .put("end", "2026-10-31")
            .put("tasks", 0)
            .put("habits", 0)
            .put("workouts", 0)
            .put("exercises", 6)
            .put("athkar", 0)
            .put("activeDays", 2)
            .put("totalDays", 31);
    month.put("days", monthDays());
    for (int[] size : new int[][] {{320, 640}, {390, 800}, {412, 880}, {720, 360}}) {
      View screen =
          new RecapOverlay(app, store)
              .buildCard(
                  new JSONArray().put(month), false, true, "Shown on every unlock", () -> {});
      render(screen, size[0], size[1], "month-" + size[0] + "x" + size[1]);
      assertEquals(size[1], screen.getMeasuredHeight());
      assertFooter(screen, size[1]);
      assertNull(
          "debug copy should not dominate a real recap", findText(screen, "Unlock detected"));
      assertNull(findText(screen, "Shown on every unlock"));
      assertNull("no recap logo or wordmark", findText(screen, "Ceventic"));
      assertEquals(0, countImages(screen));
      assertNotNull(findText(screen, "Training"));
      assertNotNull(findText(screen, "6"));
    }
    app.getResources().getConfiguration().fontScale = 1.3f;
    app.getResources().getDisplayMetrics().scaledDensity = 1.3f;
    View large =
        new RecapOverlay(app, store)
            .buildCard(new JSONArray().put(month), false, true, "Shown on every unlock", () -> {});
    render(large, 320, 640, "month-large-text");
    assertFooter(large, 640);
    View status =
        new RecapOverlay(app, store)
            .buildCard(
                new JSONArray(),
                false,
                true,
                "Connect your account to see your progress here.",
                () -> {});
    render(status, 390, 800, "unlock-status");
    assertFooter(status, 800);
    assertEquals("manual preview does not consume a real unlock", 0, store.unlockCount());
  }

  private void assertFooter(View screen, int height) {
    View footer = screen.findViewWithTag("recap_footer");
    assertEquals("footer must stay at bottom", height, footer.getTop() + footer.getHeight());
    Button done = screen.findViewWithTag("recap_continue");
    assertTrue(done.getHeight() >= 48);
    assertTrue("landscape reading width stays bounded", footer.getWidth() <= 560);
    assertTrue(footer.getTop() + done.getTop() + done.getHeight() <= height);
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
    RecapOverlay overlay = new RecapOverlay(app, store);
    View card =
        overlay.buildCard(
            new JSONArray().put(week).put(day), false, true, "Shown on every unlock", () -> {});
    render(card, 390, 800, "period-tabs");
    int buttonTop = ((View) card.findViewWithTag("recap_footer")).getTop();
    assertNotNull(findText(card, "Your day"));
    TextView tab = findText(card, "Week");
    assertTrue(tab instanceof Button);
    assertTrue(tab.performClick());
    render(card, 390, 800, "week-tab");
    assertEquals(buttonTop, ((View) card.findViewWithTag("recap_footer")).getTop());
    assertNotNull(findText(card, "Your week"));
    assertTrue(tab.isSelected());
    View refreshed =
        overlay.buildCard(
            new JSONArray().put(week).put(day), false, true, "Shown on every unlock", () -> {});
    assertNotNull(
        "in-place sync must retain the selected period", findText(refreshed, "Your week"));
  }

  @Test
  public void arabicRecapUsesSavedAccentAndKeepsNavigationLayoutStable() throws Exception {
    app.getSharedPreferences("native_recaps", Context.MODE_PRIVATE)
        .edit()
        .putString("locale", "ar")
        .putString("accent", "#A855F7")
        .commit();
    JSONObject month =
        new JSONObject()
            .put("kind", "month")
            .put("start", "2026-10-01")
            .put("end", "2026-10-31")
            .put("activeDays", 2)
            .put("totalDays", 31)
            .put("exercises", 6);
    month.put("days", monthDays());
    View screen =
        new RecapOverlay(app, store)
            .buildCard(new JSONArray().put(month), false, true, "Shown on every unlock", () -> {});
    render(screen, 390, 800, "month-arabic");
    assertEquals(View.LAYOUT_DIRECTION_LTR, screen.getLayoutDirection());
    assertNotNull(findText(screen, "ملخّص شهرك"));
    assertNotNull(findText(screen, "متابعة"));
    assertFooter(screen, 800);
    assertEquals(Color.parseColor("#A855F7"), NativeUi.accent(store));
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

  @Test
  public void entryPopsOnceDismissAnimatesAndLockHideIsImmediate() throws Exception {
    org.robolectric.util.ReflectionHelpers.callStaticMethod(
        android.animation.ValueAnimator.class,
        "setDurationScale",
        org.robolectric.util.ReflectionHelpers.ClassParameter.from(float.class, 1f));
    RecapOverlay overlay = new RecapOverlay(app, store);
    try {
      overlay.present(
          new JSONArray(),
          false,
          true,
          "Connect your account to see your progress here.",
          () -> {});
      View root = ReflectionHelpers.getField(overlay, "root"),
          holder = ReflectionHelpers.getField(overlay, "holder");
      assertEquals(.94f, holder.getScaleX(), .001f);
      assertEquals(0, holder.getAlpha(), .001f);
      shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(600));
      assertEquals(1, holder.getScaleX(), .001f);
      assertEquals(1, holder.getAlpha(), .001f);
      overlay.present(
          new JSONArray(),
          false,
          true,
          "Connect your account to see your progress here.",
          () -> {});
      assertEquals("sync updates do not replay the popup", 1, holder.getScaleX(), .001f);
      findText(root, "Continue").performClick();
      assertTrue(overlay.showing());
      shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(300));
      assertFalse(overlay.showing());
      overlay.present(
          new JSONArray(),
          false,
          true,
          "Connect your account to see your progress here.",
          () -> {});
      overlay.hide();
      assertFalse(overlay.showing());
      shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(600));
      assertFalse(overlay.showing());
    } finally {
      overlay.hide();
    }
  }

  @Test
  public void disabledSystemAnimationsSkipThePopupMotion() throws Exception {
    org.robolectric.util.ReflectionHelpers.callStaticMethod(
        android.animation.ValueAnimator.class,
        "setDurationScale",
        org.robolectric.util.ReflectionHelpers.ClassParameter.from(float.class, 0f));
    RecapOverlay overlay = new RecapOverlay(app, store);
    try {
      overlay.present(new JSONArray(), false, true, "", () -> {});
      View holder = ReflectionHelpers.getField(overlay, "holder");
      assertEquals(1, holder.getScaleX(), .001f);
      assertEquals(1, holder.getAlpha(), .001f);
    } finally {
      overlay.hide();
    }
  }

  @Test
  public void tinyChartsUseActualDailyCountsAndNeverInventMissingDetail() throws Exception {
    RecapChart exercises = new RecapChart(app, Color.RED, monthDays(), "exercises");
    int[] values = exercises.valuesForTesting();
    assertEquals(31, values.length);
    int sum = 0;
    for (int n : values) sum += n;
    assertEquals(6, sum);
    assertEquals(3, values[2]);
    assertEquals(3, values[25]);
    assertEquals(0, new RecapChart(app, Color.RED, null, "exercises").valuesForTesting().length);
  }

  private JSONArray monthDays() throws Exception {
    JSONArray days = new JSONArray();
    for (int i = 1; i <= 31; i++)
      days.put(
          new JSONObject()
              .put("date", String.format(java.util.Locale.ROOT, "2026-10-%02d", i))
              .put("tasks", 0)
              .put("habits", 0)
              .put("workouts", 0)
              .put("exercises", i == 3 || i == 26 ? 3 : 0)
              .put("athkar", 0));
    return days;
  }

  private int countImages(View v) {
    int count = v instanceof ImageView ? 1 : 0;
    if (v instanceof ViewGroup)
      for (int i = 0; i < ((ViewGroup) v).getChildCount(); i++)
        count += countImages(((ViewGroup) v).getChildAt(i));
    return count;
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

  private void render(View card, int width, int height, String name) throws Exception {
    card.measure(
        View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
        View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
    card.layout(0, 0, width, card.getMeasuredHeight());
    // Let the reading-width cap settle just as the real Android view tree does.
    card.measure(
        View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
        View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
    card.layout(0, 0, width, height);
    Bitmap image = Bitmap.createBitmap(width, card.getMeasuredHeight(), Bitmap.Config.ARGB_8888);
    card.draw(new Canvas(image));
    File directory = new File("build/outputs/recap-ui");
    directory.mkdirs();
    try (FileOutputStream file = new FileOutputStream(new File(directory, name + ".png"))) {
      image.compress(Bitmap.CompressFormat.PNG, 100, file);
    }
  }
}
