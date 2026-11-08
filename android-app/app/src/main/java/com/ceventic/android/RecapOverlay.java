package com.ceventic.android;

import android.content.Context;
import android.graphics.Color;
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
  private java.util.function.Consumer<Boolean> blurListener;

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
    screen.setBackgroundColor(Color.TRANSPARENT);
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
    // One continuous, stationary backdrop covers the bars while content animates.
    backdrop.setBackground(NativeUi.recapBackground(store));
    holder = new FrameLayout(context);
    holder.addView(screen, new FrameLayout.LayoutParams(-1, -1));
    backdrop.addView(holder, new FrameLayout.LayoutParams(-1, -1));
    backdrop.setOnApplyWindowInsetsListener(
        (v, insets) -> {
          android.graphics.Insets safe =
              insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
          if (holder != null) holder.setPadding(safe.left, safe.top, safe.right, safe.bottom);
          NativeUi.lightSystemIcons(v);
          return WindowInsets.CONSUMED;
        });
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
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            android.graphics.PixelFormat.TRANSLUCENT);
    params.setFitInsetsTypes(0);
    params.layoutInDisplayCutoutMode =
        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
    params.gravity = Gravity.CENTER;
    params.setTitle("Ceventic recap");
    root = backdrop;
    try {
      manager.addView(root, params);
      if (android.os.Build.VERSION.SDK_INT >= 31) {
        blurListener = enabled -> updateBlur(enabled);
        manager.addCrossWindowBlurEnabledListener(context.getMainExecutor(), blurListener);
        updateBlur(manager.isCrossWindowBlurEnabled());
      }
      root.requestFocus();
      root.requestApplyInsets();
      animateEntry();
    } catch (Exception e) {
      hide();
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
    surface.setBackground(NativeUi.recapBackground(store));
    // The background fills the viewport; reading width is bounded on tablets and landscape.
    LinearLayout page = NativeUi.column(context);
    FrameLayout.LayoutParams pageBox = new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER);
    surface.addView(page, pageBox);
    LinearLayout header = new LinearLayout(context);
    header.setGravity(Gravity.CENTER_VERTICAL);
    header.setPadding(dp(20), dp(10), dp(16), dp(8));
    LinearLayout heading = NativeUi.column(context);
    TextView title = text(t("Your overview"), 24, Color.WHITE, true);
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
    done.setTextColor(Color.WHITE);
    done.setBackground(
        new android.graphics.drawable.RippleDrawable(
            android.content.res.ColorStateList.valueOf(tint(28)),
            NativeUi.panel(
                blend(NativeUi.RECAP_BASE, NativeUi.accent(store), .045f), tint(85), 16, context),
            null));
    done.setPadding(dp(20), 0, dp(20), 0);
    android.graphics.drawable.Drawable arrow =
        new android.graphics.drawable.Drawable() {
          final android.graphics.Paint paint =
              new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);

          @Override
          public void draw(android.graphics.Canvas c) {
            paint.setColor(Color.WHITE);
            paint.setStrokeWidth(dp(1.5f));
            paint.setStyle(android.graphics.Paint.Style.STROKE);
            float x = getBounds().centerX(), y = getBounds().centerY();
            c.drawLine(x - dp(7), y, x + dp(7), y, paint);
            c.drawLine(x + dp(2), y - dp(5), x + dp(7), y, paint);
            c.drawLine(x + dp(2), y + dp(5), x + dp(7), y, paint);
          }

          @Override
          public void setAlpha(int a) {}

          @Override
          public void setColorFilter(android.graphics.ColorFilter f) {}

          @Override
          public int getOpacity() {
            return android.graphics.PixelFormat.TRANSLUCENT;
          }
        };
    arrow.setBounds(0, 0, dp(18), dp(18));
    done.setCompoundDrawables(null, null, arrow, null);
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
    box.setBackground(NativeUi.glassPanel(context, store));
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
    RecapInsight insight = RecapInsight.from(period);
    TextView eyebrow =
        text(
            t(
                kind.equals("week")
                    ? "Weekly recap"
                    : kind.equals("month") ? "Monthly recap" : "Daily recap"),
            10,
            accent(),
            true);
    eyebrow.setLetterSpacing(.09f);
    details.addView(eyebrow);
    gap(details, 7);
    TextView personal = text(t(insight.headline), 23, Color.WHITE, true);
    personal.setTag("recap_insight");
    details.addView(personal);
    gap(details, 5);
    TextView description = text(t(insight.description), 12, 0xffb9b3b6, false);
    description.setLineSpacing(dp(2), 1);
    details.addView(description);
    gap(details, 14);

    if (!insight.field.isEmpty()) {
      LinearLayout hero = card();
      cardHeading(hero, RecapInsight.label(insight.field), iconFor(insight.field));
      gap(hero, 12);
      LinearLayout row = new LinearLayout(context);
      row.setGravity(Gravity.CENTER_VERTICAL);
      LinearLayout values = NativeUi.column(context);
      values.addView(text(number(insight.current), 38, Color.WHITE, true));
      gap(values, 7);
      if (insight.comparable) {
        int delta = insight.current - insight.previous;
        String deltaText = (delta > 0 ? "+" : delta < 0 ? "−" : "") + number(Math.abs(delta));
        TextView change = text(deltaText + " · " + t("vs previous period"), 11, accent(), true);
        change.setPadding(dp(9), dp(6), dp(9), dp(6));
        change.setBackground(NativeUi.panel(tint(18), tint(32), 12, context));
        values.addView(change);
        gap(values, 6);
        values.addView(
            text(t("Previously") + " " + number(insight.previous), 11, 0xffa49da1, false));
      }
      row.addView(values, new LinearLayout.LayoutParams(0, -2, 1));
      if (insight.comparable)
        row.addView(comparison(insight), new LinearLayout.LayoutParams(dp(116), dp(90)));
      else
        row.addView(chart(period, insight.field), new LinearLayout.LayoutParams(dp(106), dp(58)));
      hero.addView(row);
      if (insight.comparable) {
        gap(hero, 10);
        // Different month lengths and sparse logs are made explicit, never normalized into a score.
        String before =
            number(insight.previousCoverage)
                + "/"
                + number(period.optJSONObject("previous").optInt("totalDays"));
        String now = number(insight.currentCoverage) + "/" + number(period.optInt("totalDays"));
        TextView coverage =
            text(t("Recorded days") + ": " + before + " → " + now, 10, 0xff9f989c, false);
        hero.addView(coverage);
      }
      details.addView(hero);
      gap(details, 12);
    }

    LinearLayout summary = card();
    TextView rhythmTitle = text(t("Your rhythm"), 12, 0xffb9b3b6, false);
    summary.addView(rhythmTitle);
    gap(summary, 9);
    LinearLayout rhythm = new LinearLayout(context);
    rhythm.setGravity(Gravity.CENTER_VERTICAL);
    LinearLayout stats = NativeUi.column(context);
    LinearLayout values = new LinearLayout(context);
    values.setGravity(Gravity.BOTTOM);
    values.addView(text(number(Math.max(0, period.optInt("activeDays"))), 31, Color.WHITE, true));
    int total = period.optInt("totalDays");
    if (total > 0) values.addView(text(" / " + number(total), 14, 0xffa6a0a3, false));
    stats.addView(values);
    gap(stats, 4);
    stats.addView(text(t("Activity days"), 11, 0xffb9b3b6, false));
    if (!hidden(period, "workout")) {
      gap(stats, 8);
      stats.addView(
          text(
              number(period.optInt("workouts")) + " · " + t("Workouts saved"),
              10,
              0xffa49da1,
              false));
    }
    rhythm.addView(stats, new LinearLayout.LayoutParams(0, -2, 1));
    RecapCalendar calendar =
        new RecapCalendar(context, NativeUi.accent(store), period.optJSONArray("days"));
    rhythm.addView(calendar, new LinearLayout.LayoutParams(dp(116), dp(total > 7 ? 78 : 36)));
    summary.addView(rhythm);
    details.addView(summary);
    gap(details, 12);
    ArrayList<LinearLayout> tiles = new ArrayList<>();
    if (!hidden(period, "routines") && !insight.field.equals("tasks"))
      tiles.add(metricCard(period, "tasks", "Tasks done", "routines"));
    if (!hidden(period, "habits") && !insight.field.equals("habits"))
      tiles.add(metricCard(period, "habits", "Habit check-ins", "habits"));
    if (!hidden(period, "workout")
        && !insight.field.equals("exercises")
        && !insight.field.equals("workouts"))
      tiles.add(metricCard(period, "exercises", "Exercises checked", "workout"));
    // Keep a phone-friendly two-column grid even when the highlighted metric changes.
    for (int i = 0; i < tiles.size(); i += 2) {
      LinearLayout pair = new LinearLayout(context);
      for (int j = i; j < Math.min(i + 2, tiles.size()); j++) {
        LinearLayout.LayoutParams cell = new LinearLayout.LayoutParams(0, -1, 1);
        if (j == i && i + 1 < tiles.size()) cell.setMarginEnd(dp(10));
        pair.addView(tiles.get(j), cell);
      }
      details.addView(pair);
      gap(details, 12);
    }
    if (!hidden(period, "athkar") && !insight.field.equals("athkar")) {
      LinearLayout athkar = card();
      LinearLayout row = new LinearLayout(context);
      row.setGravity(Gravity.CENTER_VERTICAL);
      row.addView(iconTile("athkar"), new LinearLayout.LayoutParams(dp(38), dp(38)));
      LinearLayout label = NativeUi.column(context);
      label.addView(text(t("Athkar sessions"), 13, Color.WHITE, true));
      gap(label, 3);
      label.addView(text(t("Completed sessions"), 10, 0xffa49da1, false));
      LinearLayout.LayoutParams labelBox = new LinearLayout.LayoutParams(0, -2, 1);
      labelBox.setMarginStart(dp(12));
      row.addView(label, labelBox);
      row.addView(text(number(period.optInt("athkar")), 28, Color.WHITE, true));
      athkar.addView(row);
      details.addView(athkar);
    }
    gap(details, 12);
    TextView encouragement = text(t("Keep building at your own pace."), 11, 0xffb9b3b6, false);
    encouragement.setGravity(Gravity.CENTER);
    details.addView(encouragement);
  }

  private String iconFor(String field) {
    return field.equals("tasks")
        ? "routines"
        : field.equals("habits") ? "habits" : field.equals("athkar") ? "athkar" : "workout";
  }

  private FrameLayout iconTile(String icon) {
    FrameLayout tile = new FrameLayout(context);
    tile.setBackground(NativeUi.panel(tint(18), tint(26), 12, context));
    tile.addView(
        new RecapIcon(context, icon, accent()),
        new FrameLayout.LayoutParams(dp(21), dp(21), Gravity.CENTER));
    return tile;
  }

  private View comparison(RecapInsight insight) {
    LinearLayout group = new LinearLayout(context);
    group.setGravity(Gravity.BOTTOM);
    int max = Math.max(1, Math.max(insight.previous, insight.current));
    int[] values = {insight.previous, insight.current};
    for (int i = 0; i < 2; i++) {
      LinearLayout column = NativeUi.column(context);
      column.setGravity(Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
      column.addView(text(number(values[i]), 11, Color.WHITE, true));
      gap(column, 4);
      FrameLayout track = new FrameLayout(context);
      View bar = new View(context);
      bar.setBackground(NativeUi.panel(i == 0 ? tint(70) : NativeUi.accent(store), 0, 4, context));
      track.addView(
          bar,
          new FrameLayout.LayoutParams(
              dp(23),
              values[i] == 0 ? dp(2) : Math.max(dp(4), dp(44) * values[i] / max),
              Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL));
      column.addView(track, new LinearLayout.LayoutParams(-1, dp(44)));
      gap(column, 5);
      column.addView(text(t(i == 0 ? "Previous" : "This period"), 9, 0xffa49da1, false));
      group.addView(column, new LinearLayout.LayoutParams(0, -1, 1));
    }
    group.setContentDescription(
        t("Previously")
            + " "
            + number(insight.previous)
            + "; "
            + t("This period")
            + " "
            + number(insight.current));
    return group;
  }

  private LinearLayout metricCard(JSONObject period, String field, String label, String icon) {
    LinearLayout tile = card();
    tile.addView(iconTile(icon), new LinearLayout.LayoutParams(dp(32), dp(32)));
    gap(tile, 9);
    tile.addView(text(number(period.optInt(field)), 26, Color.WHITE, true));
    gap(tile, 4);
    tile.addView(text(t(label), 11, 0xffb9b3b6, false));
    return tile;
  }

  private void updateBlur(boolean enabled) {
    if (root == null || android.os.Build.VERSION.SDK_INT < 31) return;
    WindowManager.LayoutParams params = (WindowManager.LayoutParams) root.getLayoutParams();
    if (enabled) params.flags |= WindowManager.LayoutParams.FLAG_BLUR_BEHIND;
    else params.flags &= ~WindowManager.LayoutParams.FLAG_BLUR_BEHIND;
    params.setBlurBehindRadius(enabled ? dp(32) : 0);
    root.setBackground(new RecapGlass(NativeUi.accent(store), false, enabled ? 230 : 255));
    try {
      manager.updateViewLayout(root, params);
    } catch (IllegalArgumentException ignored) {
    }
  }

  private void animateEntry() {
    if (!android.animation.ValueAnimator.areAnimatorsEnabled() || holder == null) return;
    holder.setAlpha(0);
    holder.setScaleX(.985f);
    holder.setScaleY(.985f);
    holder.setTranslationY(dp(18));
    holder
        .animate()
        .alpha(1)
        .scaleX(1)
        .scaleY(1)
        .translationY(0)
        .setDuration(680)
        .setInterpolator(new android.view.animation.PathInterpolator(.2f, .05f, .15f, 1f))
        .withLayer()
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
          .scaleX(.99f)
          .scaleY(.99f)
          .translationY(dp(8))
          .setDuration(260)
          .setInterpolator(new android.view.animation.PathInterpolator(.4f, 0f, 1f, 1f))
          .start();
    root.animate()
        .alpha(0)
        .setDuration(280)
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
      if (blurListener != null && android.os.Build.VERSION.SDK_INT >= 31) {
        manager.removeCrossWindowBlurEnabledListener(blurListener);
        blurListener = null;
      }
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
