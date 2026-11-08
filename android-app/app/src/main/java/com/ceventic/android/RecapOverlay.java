package com.ceventic.android;

import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.*;
import android.widget.*;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import java.util.ArrayList;
import org.json.*;

/** Full-height native recap. The saved Ceventic accent is its only theme color. */
final class RecapOverlay {
  private final Context context;
  private final RecapStore store;
  private View root;
  private FrameLayout holder;
  private WindowManager manager;
  private String selectedKind;
  private boolean dismissing;

  RecapOverlay(Context context, RecapStore store) {
    this.context = context;
    this.store = store;
  }

  boolean showing() {
    return root != null;
  }

  private int dp(float n) {
    return NativeUi.dp(context, n);
  }

  private String t(String s) {
    return NativeStrings.text(store, s);
  }

  private int accent() {
    return NativeUi.lightAccent(store);
  }

  private int tint(int alpha) {
    return (NativeUi.accent(store) & 0xffffff) | (alpha << 24);
  }

  private String number(int n) {
    return java.text.NumberFormat.getIntegerInstance(
            java.util.Locale.forLanguageTag(store.locale()))
        .format(n);
  }

  private TextView text(String value, int size, int color, boolean bold) {
    TextView v = NativeUi.text(context, value, size, color, bold);
    v.setPadding(0, 0, 0, 0);
    v.setIncludeFontPadding(false);
    return v;
  }

  private void gap(LinearLayout p, int n) {
    p.addView(new View(context), new LinearLayout.LayoutParams(1, dp(n)));
  }

  private void flexibleGap(LinearLayout p, int min, float weight) {
    p.addView(new View(context), new LinearLayout.LayoutParams(1, dp(min), weight));
  }

  private int blend(int base, int color, float fraction) {
    return Color.rgb(
        Math.round(Color.red(base) * (1 - fraction) + Color.red(color) * fraction),
        Math.round(Color.green(base) * (1 - fraction) + Color.green(color) * fraction),
        Math.round(Color.blue(base) * (1 - fraction) + Color.blue(color) * fraction));
  }

  void show(JSONArray periods, boolean sample, Runnable dismissed) throws Exception {
    present(periods, sample, false, "", dismissed);
  }

  void present(
      JSONArray periods, boolean sample, boolean unlock, String message, Runnable dismissed)
      throws Exception {
    if (dismissing) return;
    View screen =
        buildCard(
            periods,
            sample,
            unlock,
            message,
            () -> {
              dismissAnimated(dismissed);
            });
    if (showing()) {
      ScrollView previous = holder.findViewWithTag("recap_scroll");
      int previousY = previous == null ? 0 : previous.getScrollY();
      holder.removeAllViews();
      holder.addView(screen, new FrameLayout.LayoutParams(-1, -1));
      ScrollView updated = screen.findViewWithTag("recap_scroll");
      updated.post(() -> updated.scrollTo(0, previousY));
      return;
    }
    manager = context.getSystemService(WindowManager.class);
    FrameLayout backdrop = new FrameLayout(context);
    backdrop.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
    backdrop.setBackgroundColor(0xb0080b10);
    holder = new FrameLayout(context);
    holder.addView(screen, new FrameLayout.LayoutParams(-1, -1));
    backdrop.addView(holder, new FrameLayout.LayoutParams(-1, -1));
    backdrop.setFocusableInTouchMode(true);
    backdrop.setOnKeyListener(
        (v, key, event) -> {
          if (key == KeyEvent.KEYCODE_BACK && event.getAction() == KeyEvent.ACTION_UP) {
            dismissAnimated(dismissed);
            return true;
          }
          return false;
        });
    WindowManager.LayoutParams params =
        new WindowManager.LayoutParams(
            -1,
            -1,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            android.graphics.PixelFormat.TRANSLUCENT);
    params.setFitInsetsTypes(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
    params.gravity = Gravity.CENTER;
    params.setTitle("Ceventic recap");
    root = backdrop;
    try {
      manager.addView(root, params);
      root.requestFocus();
      animateEntry();
    } catch (Exception e) {
      root = null;
      holder = null;
      throw e;
    }
  }

  /** Fixed header/footer and a separately scrollable body, including on small/landscape phones. */
  View buildCard(
      JSONArray incoming, boolean sample, boolean unlock, String message, Runnable dismiss)
      throws JSONException {
    final JSONArray periods = new JSONArray();
    for (String kind : new String[] {"day", "week", "month"})
      for (int i = 0; i < incoming.length(); i++) {
        JSONObject p = incoming.optJSONObject(i);
        if (p != null && kind.equals(p.optString("kind"))) periods.put(p);
      }
    FrameLayout surface =
        new FrameLayout(context) {
          @Override
          protected void onMeasure(int widthSpec, int heightSpec) {
            if (getChildCount() > 0) {
              getChildAt(0).getLayoutParams().width =
                  Math.min(View.MeasureSpec.getSize(widthSpec), dp(560));
            }
            super.onMeasure(widthSpec, heightSpec);
          }
        };
    surface.setTag("recap_screen");
    surface.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
    GradientDrawable wash =
        new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[] {blend(0xff090d12, NativeUi.accent(store), .075f), 0xff090d12, 0xff070a0f});
    surface.setBackground(wash);
    // The background fills the viewport; reading width is bounded on tablets and landscape.
    LinearLayout page = NativeUi.column(context);
    FrameLayout.LayoutParams pageBox = new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER);
    surface.addView(page, pageBox);
    LinearLayout header = new LinearLayout(context);
    header.setGravity(Gravity.CENTER_VERTICAL);
    header.setPadding(dp(20), dp(10), dp(16), dp(8));
    LinearLayout heading = NativeUi.column(context);
    TextView title = text(t("Your overview"), 25, Color.WHITE, true);
    TextView date = text("", 11, 0xff929ba7, false);
    heading.addView(title);
    gap(heading, 5);
    heading.addView(date);
    LinearLayout.LayoutParams headingBox = new LinearLayout.LayoutParams(0, -2, 1);
    headingBox.setMarginEnd(dp(12));
    header.addView(heading, headingBox);
    Button close = NativeUi.button(context, "×", dismiss);
    close.setTextSize(24);
    close.setPadding(0, 0, 0, 0);
    close.setMinWidth(0);
    close.setMinimumWidth(0);
    close.setContentDescription(t("Close"));
    close.setBackground(NativeUi.panel(0x06ffffff, 0x10ffffff, 14, context));
    header.addView(close, new LinearLayout.LayoutParams(dp(44), dp(44)));
    page.addView(header);
    ScrollView scroll = new ScrollView(context);
    scroll.setTag("recap_scroll");
    scroll.setFillViewport(true);
    scroll.setClipToPadding(false);
    scroll.setVerticalScrollBarEnabled(false);
    scroll.setOverScrollMode(View.OVER_SCROLL_IF_CONTENT_SCROLLS);
    LinearLayout body = NativeUi.column(context);
    body.setPadding(dp(18), dp(6), dp(18), dp(12));
    scroll.addView(body, new ScrollView.LayoutParams(-1, -2));
    page.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
    if (sample) {
      TextView badge = text(t("Sample preview — not your account data"), 11, accent(), false);
      badge.setPadding(dp(10), dp(7), dp(10), dp(7));
      badge.setBackground(NativeUi.panel(tint(18), tint(40), 10, context));
      body.addView(badge);
      gap(body, 16);
    }
    LinearLayout details = NativeUi.column(context);
    ArrayList<Button> buttons = new ArrayList<>();
    int initial = 0;
    for (int i = 0; i < periods.length(); i++)
      if (periods.getJSONObject(i).optString("kind").equals(selectedKind)) initial = i;
    if (periods.length() > 1) {
      LinearLayout tabs = new LinearLayout(context);
      tabs.setPadding(dp(4), dp(4), dp(4), dp(4));
      tabs.setBackground(NativeUi.panel(0x04ffffff, 0x12ffffff, 15, context));
      for (int i = 0; i < periods.length(); i++) {
        final int index = i;
        String kind = periods.getJSONObject(i).optString("kind");
        Button tab =
            NativeUi.button(
                context,
                t(kind.equals("week") ? "Week" : kind.equals("month") ? "Month" : "Day"),
                () -> {
                  try {
                    render(details, periods.getJSONObject(index), title, date);
                    selectTab(buttons, index);
                    scroll.smoothScrollTo(0, 0);
                  } catch (JSONException ignored) {
                  }
                });
        tab.setTextSize(12);
        tab.setPadding(dp(4), 0, dp(4), 0);
        tabs.addView(tab, new LinearLayout.LayoutParams(0, dp(44), 1));
        buttons.add(tab);
      }
      selectTab(buttons, initial);
      body.addView(tabs);
      gap(body, 12);
    }
    if (periods.length() > 0) {
      render(details, periods.getJSONObject(initial), title, date);
      body.addView(details, new LinearLayout.LayoutParams(-1, 0, 1));
      // Debug repetition messages belong in settings. Sync failures still remain visible.
      if (!message.isEmpty() && !message.equals("Shown on every unlock")) {
        gap(body, 14);
        body.addView(text(t(message), 12, 0xff929ba7, false));
      }
    } else {
      body.setGravity(Gravity.CENTER_VERTICAL);
      TextView emptyTitle = text(t("Your unlock screen is working"), 29, Color.WHITE, true);
      emptyTitle.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
      body.addView(emptyTitle);
      gap(body, 24);
      FrameLayout proof = new FrameLayout(context);
      proof.setBackground(NativeUi.panel(tint(18), tint(32), 24, context));
      TextView check = text("✓", 42, accent(), true);
      check.setGravity(Gravity.CENTER);
      proof.addView(check, new FrameLayout.LayoutParams(-1, dp(110)));
      proof.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(110)));
      body.addView(proof);
      gap(body, 22);
      TextView description = text(t(message), 14, 0xffa6adb7, false);
      description.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
      description.setLineSpacing(dp(4), 1);
      body.addView(description);
    }
    LinearLayout footer = NativeUi.column(context);
    footer.setTag("recap_footer");
    footer.setPadding(dp(22), dp(12), dp(22), dp(18));
    Button done = NativeUi.button(context, t("Continue"), dismiss);
    done.setTag("recap_continue");
    done.setTextSize(15);
    done.setTextColor(Color.luminance(NativeUi.accent(store)) > .179 ? Color.BLACK : Color.WHITE);
    GradientDrawable gradient =
        new GradientDrawable(
            GradientDrawable.Orientation.LEFT_RIGHT,
            new int[] {NativeUi.lightAccent(store), NativeUi.accent(store)});
    gradient.setCornerRadius(dp(16));
    done.setBackground(gradient);
    footer.addView(done, new LinearLayout.LayoutParams(-1, dp(52)));
    page.addView(footer);
    return surface;
  }

  private void selectTab(ArrayList<Button> buttons, int index) {
    for (int i = 0; i < buttons.size(); i++) {
      Button b = buttons.get(i);
      b.setTextColor(i == index ? accent() : 0xff89929f);
      b.setBackground(
          NativeUi.panel(
              i == index ? tint(22) : Color.TRANSPARENT, i == index ? tint(40) : 0, 11, context));
      b.setSelected(i == index);
    }
  }

  private boolean hidden(JSONObject p, String page) {
    JSONArray pages = p.optJSONArray("hiddenPages");
    if (pages != null)
      for (int i = 0; i < pages.length(); i++) if (page.equals(pages.optString(i))) return true;
    return false;
  }

  private LinearLayout card() {
    LinearLayout box = NativeUi.column(context);
    box.setPadding(dp(16), dp(15), dp(16), dp(15));
    box.setBackground(NativeUi.panel(0xff11161e, 0x0cffffff, 22, context));
    return box;
  }

  private void cardHeading(LinearLayout box, String label, String iconName) {
    LinearLayout row = new LinearLayout(context);
    row.setGravity(Gravity.CENTER_VERTICAL);
    row.addView(text(t(label), 13, 0xffdce1e8, true), new LinearLayout.LayoutParams(0, -2, 1));
    if (iconName != null) {
      LinearLayout.LayoutParams iconBox = new LinearLayout.LayoutParams(dp(20), dp(20));
      iconBox.setMarginStart(dp(9));
      row.addView(new RecapIcon(context, iconName, accent()), iconBox);
    }
    box.addView(row);
  }

  private RecapChart chart(JSONObject period, String field) {
    RecapChart v =
        new RecapChart(context, NativeUi.accent(store), period.optJSONArray("days"), field);
    v.setContentDescription(
        t("Recorded activity")
            + " · "
            + t(
                field.equals("exercises")
                    ? "Exercises checked"
                    : field.equals("athkar") ? "Athkar sessions" : "Activity days"));
    return v;
  }

  private void render(LinearLayout details, JSONObject period, TextView title, TextView date) {
    details.removeAllViews();
    String kind = period.optString("kind");
    selectedKind = kind;
    title.setText(
        t(kind.equals("week") ? "Your week" : kind.equals("month") ? "Your month" : "Your day"));
    String start = period.optString("start"), end = period.optString("end");
    try {
      DateTimeFormatter f =
          DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)
              .withLocale(java.util.Locale.forLanguageTag(store.locale()));
      start = LocalDate.parse(start).format(f);
      end = LocalDate.parse(end).format(f);
    } catch (Exception ignored) {
    }
    date.setText(start.equals(end) ? end : start + " – " + end);
    LinearLayout summary = card();
    GradientDrawable glow =
        new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[] {
              blend(0xff11161e, NativeUi.accent(store), .14f),
              blend(0xff11161e, NativeUi.accent(store), .035f)
            });
    glow.setCornerRadius(dp(22));
    summary.setBackground(glow);
    TextView eyebrow =
        text(
            t(
                kind.equals("week")
                    ? "Weekly recap"
                    : kind.equals("month") ? "Monthly recap" : "Daily recap"),
            10,
            accent(),
            true);
    eyebrow.setLetterSpacing(.05f);
    summary.addView(eyebrow);
    gap(summary, 9);
    summary.addView(text(t("Your rhythm"), 19, Color.WHITE, true));
    gap(summary, 12);
    LinearLayout rhythm = new LinearLayout(context);
    rhythm.setGravity(Gravity.CENTER_VERTICAL);
    LinearLayout stats = NativeUi.column(context);
    LinearLayout values = new LinearLayout(context);
    values.setGravity(Gravity.BOTTOM);
    values.addView(text(number(Math.max(0, period.optInt("activeDays"))), 34, Color.WHITE, true));
    int total = period.optInt("totalDays");
    if (total > 0) values.addView(text(" / " + number(total), 15, 0xffa6adb7, false));
    stats.addView(values);
    gap(stats, 3);
    stats.addView(text(t("Activity days"), 11, 0xffa6adb7, false));
    rhythm.addView(stats, new LinearLayout.LayoutParams(0, -2, 1));
    rhythm.addView(chart(period, "activity"), new LinearLayout.LayoutParams(dp(110), dp(52)));
    summary.addView(rhythm);
    details.addView(summary);
    flexibleGap(details, 12, 1);
    if (!hidden(period, "workout")) {
      LinearLayout training = card();
      cardHeading(training, "Training", "workout");
      gap(training, 12);
      LinearLayout row = new LinearLayout(context);
      row.setGravity(Gravity.CENTER_VERTICAL);
      LinearLayout statsTraining = NativeUi.column(context);
      statsTraining.addView(text(number(period.optInt("exercises")), 30, Color.WHITE, true));
      gap(statsTraining, 3);
      statsTraining.addView(text(t("Exercises checked"), 11, 0xffa6adb7, false));
      row.addView(statsTraining, new LinearLayout.LayoutParams(0, -2, 1));
      row.addView(chart(period, "exercises"), new LinearLayout.LayoutParams(dp(128), dp(56)));
      training.addView(row);
      gap(training, 10);
      TextView saved =
          text(
              number(period.optInt("workouts")) + " · " + t("Workouts saved"),
              11,
              0xff929ba7,
              false);
      training.addView(saved);
      details.addView(training);
      flexibleGap(details, 12, 1);
    }
    LinearLayout small = new LinearLayout(context);
    ArrayList<LinearLayout> tiles = new ArrayList<>();
    if (!hidden(period, "routines"))
      tiles.add(metricCard(period, "tasks", "Tasks done", "routines"));
    if (!hidden(period, "habits"))
      tiles.add(metricCard(period, "habits", "Habit check-ins", "habits"));
    for (int i = 0; i < tiles.size(); i++) {
      LinearLayout.LayoutParams cell = new LinearLayout.LayoutParams(0, -1, 1);
      if (i + 1 < tiles.size()) cell.setMarginEnd(dp(10));
      small.addView(tiles.get(i), cell);
    }
    if (!tiles.isEmpty()) {
      details.addView(small);
      flexibleGap(details, 12, 1);
    }
    if (!hidden(period, "athkar")) {
      LinearLayout athkar = card();
      cardHeading(athkar, "Athkar sessions", "athkar");
      gap(athkar, 10);
      LinearLayout row = new LinearLayout(context);
      row.setGravity(Gravity.CENTER_VERTICAL);
      LinearLayout statsAthkar = NativeUi.column(context);
      statsAthkar.addView(text(number(period.optInt("athkar")), 28, Color.WHITE, true));
      gap(statsAthkar, 3);
      statsAthkar.addView(text(t("Completed sessions"), 11, 0xff929ba7, false));
      row.addView(statsAthkar, new LinearLayout.LayoutParams(0, -2, 1));
      row.addView(chart(period, "athkar"), new LinearLayout.LayoutParams(dp(128), dp(42)));
      athkar.addView(row);
      details.addView(athkar);
    }
  }

  private LinearLayout metricCard(JSONObject period, String field, String label, String icon) {
    LinearLayout tile = card();
    cardHeading(tile, label, icon);
    gap(tile, 13);
    tile.addView(text(number(period.optInt(field)), 28, Color.WHITE, true));
    gap(tile, 9);
    RecapChart strip = chart(period, field);
    tile.addView(strip, new LinearLayout.LayoutParams(-1, dp(17)));
    return tile;
  }

  private void animateEntry() {
    if (!android.animation.ValueAnimator.areAnimatorsEnabled() || holder == null) return;
    root.setAlpha(0);
    root.animate()
        .alpha(1)
        .setDuration(180)
        .setInterpolator(new android.view.animation.DecelerateInterpolator())
        .start();
    holder.setAlpha(0);
    holder.setScaleX(.94f);
    holder.setScaleY(.94f);
    holder.setTranslationY(dp(22));
    holder
        .animate()
        .alpha(1)
        .scaleX(1)
        .scaleY(1)
        .translationY(0)
        .setDuration(360)
        .setInterpolator(new android.view.animation.OvershootInterpolator(.65f))
        .start();
  }

  private void dismissAnimated(Runnable dismissed) {
    if (root == null || dismissing) return;
    if (!android.animation.ValueAnimator.areAnimatorsEnabled()) {
      hide();
      dismissed.run();
      return;
    }
    dismissing = true;
    View closing = root;
    if (holder != null) holder.animate().cancel();
    root.animate().cancel();
    if (holder != null)
      holder
          .animate()
          .alpha(0)
          .scaleX(.98f)
          .scaleY(.98f)
          .translationY(dp(10))
          .setDuration(130)
          .start();
    root.animate()
        .alpha(0)
        .setDuration(140)
        .withEndAction(
            () -> {
              if (root == closing) {
                hide();
                dismissed.run();
              }
            })
        .start();
  }

  void hide() {
    if (root != null) {
      root.animate().cancel();
      if (holder != null) holder.animate().cancel();
      dismissing = false;
      try {
        manager.removeView(root);
      } catch (Exception ignored) {
      }
      root = null;
      holder = null;
    }
  }
}
