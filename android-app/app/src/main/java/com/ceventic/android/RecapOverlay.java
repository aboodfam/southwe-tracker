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
    View screen =
        buildCard(
            periods,
            sample,
            unlock,
            message,
            () -> {
              hide();
              dismissed.run();
            });
    if (showing()) {
      holder.removeAllViews();
      holder.addView(screen, new FrameLayout.LayoutParams(-1, -1));
      return;
    }
    manager = context.getSystemService(WindowManager.class);
    FrameLayout backdrop = new FrameLayout(context);
    backdrop.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
    backdrop.setBackgroundColor(0xff06090d);
    holder = new FrameLayout(context);
    holder.addView(screen, new FrameLayout.LayoutParams(-1, -1));
    backdrop.addView(holder, new FrameLayout.LayoutParams(-1, -1));
    backdrop.setFocusableInTouchMode(true);
    backdrop.setOnKeyListener(
        (v, key, event) -> {
          if (key == KeyEvent.KEYCODE_BACK && event.getAction() == KeyEvent.ACTION_UP) {
            hide();
            dismissed.run();
            return true;
          }
          return false;
        });
    WindowManager.LayoutParams params =
        new WindowManager.LayoutParams(
            -1,
            -1,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            0,
            android.graphics.PixelFormat.OPAQUE);
    params.setFitInsetsTypes(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
    params.gravity = Gravity.CENTER;
    params.setTitle("Ceventic recap");
    root = backdrop;
    try {
      manager.addView(root, params);
      root.requestFocus();
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
    ImageView logo = new ImageView(context);
    logo.setImageResource(com.ceventic.android.R.mipmap.ic_launcher);
    logo.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
    LinearLayout.LayoutParams logoBox = new LinearLayout.LayoutParams(dp(28), dp(28));
    logoBox.setMarginEnd(dp(9));
    header.addView(logo, logoBox);
    header.addView(text("Ceventic", 16, 0xffe5e7eb, true), new LinearLayout.LayoutParams(0, -2, 1));
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
    body.setPadding(dp(22), dp(12), dp(22), dp(12));
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
                    render(details, periods.getJSONObject(index));
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
      gap(body, 20);
    }
    if (periods.length() > 0) {
      render(details, periods.getJSONObject(initial));
      body.addView(details, new LinearLayout.LayoutParams(-1, 0, 1));
      // Debug repetition messages belong in settings. Sync failures still remain visible.
      if (!message.isEmpty() && !message.equals("Shown on every unlock")) {
        gap(body, 14);
        body.addView(text(t(message), 12, 0xff929ba7, false));
      }
    } else {
      body.setGravity(Gravity.CENTER_VERTICAL);
      TextView title = text(t("Your unlock screen is working"), 29, Color.WHITE, true);
      title.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
      body.addView(title);
      gap(body, 24);
      FrameLayout proof = hero("✓", t("Unlock detected"), -1);
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

  private FrameLayout hero(String value, String label, float ratio) {
    FrameLayout box = new FrameLayout(context);
    box.setMinimumHeight(dp(168));
    RecapRing ring = new RecapRing(context, NativeUi.accent(store), ratio);
    box.addView(ring, new FrameLayout.LayoutParams(dp(168), dp(168), Gravity.CENTER));
    LinearLayout center = NativeUi.column(context);
    center.setGravity(Gravity.CENTER);
    if (ratio >= 0 && value.contains(" / ")) {
      String[] parts = value.split(" / ", 2);
      LinearLayout countRow = new LinearLayout(context);
      countRow.setGravity(Gravity.CENTER);
      countRow.setBaselineAligned(true);
      countRow.addView(text(parts[0], 44, Color.WHITE, true));
      TextView denominator = text(" / " + parts[1], 16, 0xff89929f, false);
      countRow.addView(denominator);
      center.addView(countRow);
    } else {
      TextView count = text(value, 44, Color.WHITE, true);
      count.setGravity(Gravity.CENTER);
      center.addView(count);
    }
    gap(center, 5);
    TextView unit = text(label, 11, 0xffa6adb7, false);
    unit.setGravity(Gravity.CENTER);
    unit.setMaxWidth(dp(124));
    center.addView(unit);
    box.addView(center, new FrameLayout.LayoutParams(dp(138), -2, Gravity.CENTER));
    box.setLayoutParams(new LinearLayout.LayoutParams(-1, dp(168)));
    return box;
  }

  private void render(LinearLayout details, JSONObject period) {
    details.removeAllViews();
    String kind = period.optString("kind");
    selectedKind = kind;
    TextView eyebrow =
        text(
            t(
                kind.equals("week")
                    ? "Weekly recap"
                    : kind.equals("month") ? "Monthly recap" : "Daily recap"),
            10,
            accent(),
            true);
    eyebrow.setLetterSpacing(.12f);
    details.addView(eyebrow);
    gap(details, 7);
    details.addView(
        text(
            t(kind.equals("week") ? "Your week" : kind.equals("month") ? "Your month" : "Your day"),
            32,
            Color.WHITE,
            true));
    gap(details, 7);
    String start = period.optString("start"), end = period.optString("end");
    try {
      DateTimeFormatter f =
          DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)
              .withLocale(java.util.Locale.forLanguageTag(store.locale()));
      start = LocalDate.parse(start).format(f);
      end = LocalDate.parse(end).format(f);
    } catch (Exception ignored) {
    }
    details.addView(text(start.equals(end) ? end : start + " – " + end, 12, 0xff89929f, false));
    flexibleGap(details, 18, .5f);
    ArrayList<String[]> metrics = new ArrayList<>();
    for (String[] m :
        new String[][] {
          {"tasks", "Tasks done", "routines"},
          {"habits", "Habit check-ins", "habits"},
          {"workouts", "Workouts saved", "workout"},
          {"exercises", "Exercises checked", "workout"},
          {"athkar", "Athkar sessions", "athkar"}
        }) if (!hidden(period, m[2])) metrics.add(m);
    boolean consistency = !kind.equals("day") && period.optInt("totalDays") > 0;
    String featuredLabel = "Recorded activity";
    int featured = 0;
    for (String[] m : metrics)
      if (period.optInt(m[0]) > featured) {
        featured = period.optInt(m[0]);
        featuredLabel = m[1];
      }
    FrameLayout summary;
    if (consistency) {
      int active = Math.max(0, period.optInt("activeDays")),
          total = Math.max(1, period.optInt("totalDays"));
      summary =
          hero(
              number(active) + " / " + number(total),
              t("Activity days"),
              Math.min(1, active / (float) total));
      // The ring is explicitly active days / calendar days, never a made-up goal score.
      summary.setContentDescription(
          t("Activity days") + ": " + number(active) + " / " + number(total));
    } else summary = hero(number(featured), t(featuredLabel), -1);
    details.addView(summary);
    gap(details, 10);
    TextView recorded = text(t("Recorded activity"), 11, 0xff7f8997, false);
    recorded.setGravity(Gravity.CENTER);
    details.addView(recorded);
    flexibleGap(details, 22, .5f);
    details.addView(text(t("Your activity"), 14, 0xffe5e7eb, true));
    gap(details, 12);
    for (int i = 0; i < metrics.size(); i += 2) {
      LinearLayout row = new LinearLayout(context);
      for (int j = i; j < Math.min(i + 2, metrics.size()); j++) {
        String[] m = metrics.get(j);
        LinearLayout tile = new LinearLayout(context);
        tile.setGravity(Gravity.CENTER_VERTICAL);
        tile.setPadding(dp(12), dp(13), dp(12), dp(13));
        tile.setBackground(NativeUi.panel(0x06ffffff, 0x0fffffff, 15, context));
        FrameLayout icon = new FrameLayout(context);
        icon.setBackground(NativeUi.panel(tint(20), 0, 11, context));
        icon.addView(
            new RecapIcon(context, m[2], accent()),
            new FrameLayout.LayoutParams(dp(17), dp(17), Gravity.CENTER));
        LinearLayout.LayoutParams iconBox = new LinearLayout.LayoutParams(dp(32), dp(32));
        iconBox.setMarginEnd(dp(10));
        tile.addView(icon, iconBox);
        LinearLayout words = NativeUi.column(context);
        words.addView(text(number(period.optInt(m[0])), 22, Color.WHITE, true));
        gap(words, 3);
        TextView label = text(t(m[1]), 11, 0xff929ba7, false);
        label.setLineSpacing(dp(2), 1);
        words.addView(label);
        tile.addView(words, new LinearLayout.LayoutParams(0, -2, 1));
        LinearLayout.LayoutParams cell = new LinearLayout.LayoutParams(0, -1, 1);
        if (j == i && j + 1 < metrics.size()) cell.setMarginEnd(dp(8));
        row.addView(tile, cell);
      }
      details.addView(row, new LinearLayout.LayoutParams(-1, -2));
      if (i + 2 < metrics.size()) gap(details, 8);
    }
  }

  void hide() {
    if (root != null) {
      try {
        manager.removeView(root);
      } catch (Exception ignored) {
      }
      root = null;
      holder = null;
    }
  }
}
