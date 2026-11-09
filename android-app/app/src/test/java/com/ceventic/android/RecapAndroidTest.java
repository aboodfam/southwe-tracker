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
      assertNotNull(findText(screen, "Exercises checked"));
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
      assertEquals(.985f, holder.getScaleX(), .001f);
      assertEquals(0, holder.getAlpha(), .001f);
      shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(900));
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
      shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(400));
      assertFalse(overlay.showing());
      overlay.present(
          new JSONArray(),
          false,
          true,
          "Connect your account to see your progress here.",
          () -> {});
      overlay.hide();
      assertFalse(overlay.showing());
      shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(900));
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
  public void recapBackgroundExtendsBehindBarsWhileOnlyContentIsInset() throws Exception {
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
      WindowManager.LayoutParams params = (WindowManager.LayoutParams) root.getLayoutParams();
      assertEquals(0, params.getFitInsetsTypes());
      assertTrue((params.flags & WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN) != 0);
      assertEquals(
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS,
          params.layoutInDisplayCutoutMode);
      root.dispatchApplyWindowInsets(
          new WindowInsets.Builder()
              .setInsets(WindowInsets.Type.statusBars(), Insets.of(0, 26, 0, 0))
              .setInsets(WindowInsets.Type.navigationBars(), Insets.of(0, 0, 0, 22))
              .build());
      assertEquals(26, holder.getPaddingTop());
      assertEquals(22, holder.getPaddingBottom());
      assertEquals("background is not pushed below the status bar", 0, root.getPaddingTop());
      assertEquals("bar backdrop never fades into wallpaper", 1f, root.getAlpha(), .001f);
      assertEquals(255, root.getBackground().getAlpha());
    } finally {
      overlay.hide();
    }
  }

  @Test
  public void activityBarsUseTheHeaderSurfaceAndPreserveKeyboardInsets() {
    org.robolectric.android.controller.ActivityController<Activity> controller =
        Robolectric.buildActivity(Activity.class).setup();
    try {
      Activity activity = controller.get();
      FrameLayout root = new FrameLayout(activity);
      NativeUi.inset(activity, root);
      activity.setContentView(root);
      assertEquals(Color.TRANSPARENT, activity.getWindow().getStatusBarColor());
      assertEquals(Color.TRANSPARENT, activity.getWindow().getNavigationBarColor());
      assertFalse(activity.getWindow().isStatusBarContrastEnforced());
      assertFalse(activity.getWindow().isNavigationBarContrastEnforced());
      assertEquals(
          NativeUi.SURFACE,
          ((android.graphics.drawable.ColorDrawable) root.getBackground()).getColor());
      root.dispatchApplyWindowInsets(
          new WindowInsets.Builder()
              .setInsets(WindowInsets.Type.statusBars(), Insets.of(0, 26, 0, 0))
              .setInsets(WindowInsets.Type.navigationBars(), Insets.of(0, 0, 0, 22))
              .setInsets(WindowInsets.Type.ime(), Insets.of(0, 0, 0, 200))
              .build());
      assertEquals(26, root.getPaddingTop());
      assertEquals(200, root.getPaddingBottom());
    } finally {
      controller.pause().stop().destroy();
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

  @Test
  public void launcherUsesTheSuppliedWhiteCAndHiddenSectionsStayHidden() throws Exception {
    ImageView icon = new ImageView(app);
    icon.setImageResource(R.mipmap.ic_launcher);
    icon.setBackgroundColor(Color.BLACK);
    render(icon, 108, 108, "launcher-white-c");
    assertTrue(icon.getDrawable() instanceof android.graphics.drawable.AdaptiveIconDrawable);
    Bitmap mark = Bitmap.createBitmap(108, 108, Bitmap.Config.ARGB_8888);
    icon.draw(new Canvas(mark));
    int left = 108, right = -1, top = 108, bottom = -1;
    for (int y = 0; y < 108; y++) for (int x = 0; x < 108; x++) {
      int color = mark.getPixel(x, y);
      if (Color.red(color) > 210 && Color.green(color) > 210 && Color.blue(color) > 210) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    assertTrue("mark stays visible", right - left >= 20);
    assertTrue("mark has padding inside the adaptive launcher mask", right - left <= 54);
    assertTrue("mark stays centered with clear top/bottom padding", top >= 20 && bottom <= 88);
    JSONObject period =
        comparedPeriod(6, 4)
            .put("tasks", 3)
            .put("hiddenPages", new JSONArray().put("workout").put("athkar"));
    View screen =
        new RecapOverlay(app, store)
            .buildCard(new JSONArray().put(period), false, true, "", () -> {});
    render(screen, 390, 800, "hidden-workout-athkar");
    assertNull(findText(screen, "Exercises checked"));
    assertNull(findText(screen, "Athkar sessions"));
    assertNotNull(findText(screen, "Tasks done"));
  }

  private JSONObject comparedPeriod(int current, int previous) throws Exception {
    JSONObject coverage = new JSONObject().put("exercises", 1);
    return new JSONObject()
        .put("kind", "month")
        .put("start", "2026-10-01")
        .put("end", "2026-10-31")
        .put("exercises", current)
        .put("activeDays", 2)
        .put("totalDays", 31)
        .put("days", monthDays())
        .put("recordedDays", coverage)
        .put(
            "previous",
            new JSONObject()
                .put("exercises", previous)
                .put("totalDays", 30)
                .put("recordedDays", coverage));
  }

  @Test
  public void insightsUseRealComparisonsAndNeverTreatMissingHistoryAsZero() throws Exception {
    JSONObject period = comparedPeriod(6, 4);
    assertEquals("More exercises checked.", RecapInsight.from(period).headline);
    assertEquals(4, RecapInsight.from(period).previous);
    period.put("exercises", 4);
    assertEquals("You kept your rhythm.", RecapInsight.from(period).headline);
    period.put("exercises", 2);
    assertEquals("Room to build again.", RecapInsight.from(period).headline);
    period.getJSONObject("previous").remove("recordedDays");
    assertFalse(RecapInsight.from(period).comparable);
    assertEquals("Your progress starts here.", RecapInsight.from(period).headline);
    period.put("recordedGoalsComplete", true);
    assertEquals("Recorded goals complete.", RecapInsight.from(period).headline);
    period.put("hiddenPages", new JSONArray().put("workout"));
    assertEquals("", RecapInsight.from(period).field);
  }

  @Test
  public void comparisonCalendarAndTranslationsFitAndSavedAccentSurvivesReopen() throws Exception {
    for (String locale : new String[] {"en", "ar", "es", "fr", "zh"}) {
      app.getSharedPreferences("native_recaps", Context.MODE_PRIVATE)
          .edit()
          .putString("locale", locale)
          .putString("accent", "#F43F5E")
          .commit();
      JSONObject period = comparedPeriod(6, 4);
      for (int[] size : new int[][] {{320, 640}, {390, 800}, {412, 880}, {720, 360}}) {
        View view =
            new RecapOverlay(app, new RecapStore(app))
                .buildCard(new JSONArray().put(period), false, true, "", () -> {});
        render(view, size[0], size[1], "comparison-" + locale + "-" + size[0]);
        assertFooter(view, size[1]);
        assertNotNull(findText(view, NativeStrings.text(store, "More exercises checked.")));
        assertEquals(View.LAYOUT_DIRECTION_LTR, view.getLayoutDirection());
        assertEquals(Color.parseColor("#F43F5E"), NativeUi.accent(new RecapStore(app)));
        ScrollView scroll = view.findViewWithTag("recap_scroll");
        scroll.scrollTo(0, 10000);
        assertFooter(view, size[1]);
      }
    }
    RecapCalendar calendar = new RecapCalendar(app, Color.RED, monthDays());
    int active = 0;
    for (boolean value : calendar.activityForTesting()) if (value) active++;
    assertEquals(2, active);
  }

  @Test
  public void disabledBlurRestoresOpaqueBackdropAndEnabledBlurUsesSubtleTransparency()
      throws Exception {
    RecapOverlay overlay = new RecapOverlay(app, store);
    try {
      overlay.present(new JSONArray(), false, true, "", () -> {});
      View root = ReflectionHelpers.getField(overlay, "root");
      ReflectionHelpers.callInstanceMethod(
          overlay, "updateBlur", ReflectionHelpers.ClassParameter.from(boolean.class, true));
      assertEquals(230, root.getBackground().getAlpha());
      assertTrue(
          (((WindowManager.LayoutParams) root.getLayoutParams()).flags
                  & WindowManager.LayoutParams.FLAG_BLUR_BEHIND)
              != 0);
      ReflectionHelpers.callInstanceMethod(
          overlay, "updateBlur", ReflectionHelpers.ClassParameter.from(boolean.class, false));
      assertEquals(255, root.getBackground().getAlpha());
      assertEquals(
          0,
          ((WindowManager.LayoutParams) root.getLayoutParams()).flags
              & WindowManager.LayoutParams.FLAG_BLUR_BEHIND);
    } finally {
      overlay.hide();
    }
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
