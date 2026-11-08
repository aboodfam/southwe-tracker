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

/** Compact native card; all accents come from the existing saved Ceventic theme. */
final class RecapOverlay {
  private final Context context;
  private final RecapStore store;
  private View root;
  private FrameLayout holder;
  private WindowManager manager;

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

  private TextView text(String value, int size, int color, boolean bold) {
    TextView v = NativeUi.text(context, value, size, color, bold);
    v.setPadding(0, 0, 0, 0);
    v.setIncludeFontPadding(false);
    return v;
  }

  private void gap(LinearLayout parent, int size) {
    parent.addView(new View(context), new LinearLayout.LayoutParams(1, dp(size)));
  }

  void show(JSONArray periods, boolean sample, Runnable dismissed) throws Exception {
    present(periods, sample, false, "", dismissed);
  }

  void present(
      JSONArray periods, boolean sample, boolean unlock, String message, Runnable dismissed)
      throws Exception {
    View card =
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
      holder.addView(card);
      return;
    }
    manager = context.getSystemService(WindowManager.class);
    FrameLayout backdrop = new FrameLayout(context);
    backdrop.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
    backdrop.setBackgroundColor(0x72000000);
    backdrop.setPadding(dp(18), dp(28), dp(18), dp(28));
    holder = new FrameLayout(context);
    holder.addView(card);
    ScrollView scroll = new ScrollView(context);
    scroll.setClipToPadding(false);
    scroll.setVerticalScrollBarEnabled(false);
    scroll.addView(holder);
    FrameLayout.LayoutParams box =
        new FrameLayout.LayoutParams(
            Math.min(context.getResources().getDisplayMetrics().widthPixels - dp(36), dp(360)),
            -2,
            Gravity.CENTER);
    backdrop.addView(scroll, box);
    int maxHeight = (int) (context.getResources().getDisplayMetrics().heightPixels * .80);
    scroll
        .getViewTreeObserver()
        .addOnGlobalLayoutListener(
            () -> {
              int wanted = Math.min(holder.getMeasuredHeight(), maxHeight);
              if (wanted > 0 && scroll.getLayoutParams().height != wanted) {
                ViewGroup.LayoutParams lp = scroll.getLayoutParams();
                lp.height = wanted;
                scroll.setLayoutParams(lp);
              }
            });
    backdrop.setOnClickListener(
        v -> {
          hide();
          dismissed.run();
        });
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
            WindowManager.LayoutParams.FLAG_DIM_BEHIND,
            android.graphics.PixelFormat.TRANSLUCENT);
    params.dimAmount = .12f;
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

  // Also exercised as an Android view tree in JVM UI tests, without an overlay permission bypass.
  View buildCard(
      JSONArray incoming, boolean sample, boolean unlock, String message, Runnable dismiss)
      throws JSONException {
    final JSONArray periods = new JSONArray();
    for (String kind : new String[] {"day", "week", "month"}) {
      for (int i = 0; i < incoming.length(); i++) {
        JSONObject item = incoming.optJSONObject(i);
        if (item != null && kind.equals(item.optString("kind"))) periods.put(item);
      }
    }
    LinearLayout panel = NativeUi.column(context);
    panel.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
    panel.setPadding(dp(18), dp(14), dp(18), dp(16));
    panel.setBackground(NativeUi.panel(0xff090d12, 0x26ffffff, 24, context));
    panel.setOnClickListener(v -> {});
    LinearLayout header = new LinearLayout(context);
    header.setGravity(Gravity.CENTER_VERTICAL);
    LinearLayout brand = new LinearLayout(context);
    brand.setGravity(Gravity.CENTER_VERTICAL);
    View dot = new View(context);
    dot.setBackground(NativeUi.panel(NativeUi.accent(store), 0, 4, context));
    LinearLayout.LayoutParams dotBox = new LinearLayout.LayoutParams(dp(6), dp(6));
    dotBox.setMarginEnd(dp(7));
    brand.addView(dot, dotBox);
    brand.addView(text("Ceventic", 13, 0xffe5e7eb, true));
    header.addView(brand, new LinearLayout.LayoutParams(0, -2, 1));
    Button close = NativeUi.button(context, "×", dismiss);
    close.setTextSize(23);
    close.setContentDescription(t("Close"));
    close.setBackground(NativeUi.panel(0x08ffffff, 0x10ffffff, 12, context));
    close.setPadding(0, 0, 0, 0);
    close.setMinWidth(0);
    close.setMinimumWidth(0);
    header.addView(close, new LinearLayout.LayoutParams(dp(44), dp(44)));
    panel.addView(header);
    gap(panel, 6);
    if (sample || unlock) {
      TextView badge =
          text(
              t(sample ? "Sample preview — not your account data" : "Unlock detected"),
              11,
              accent(),
              true);
      badge.setPadding(dp(9), dp(6), dp(9), dp(6));
      badge.setBackground(
          NativeUi.panel(
              (NativeUi.accent(store) & 0x00ffffff) | 0x14000000,
              (NativeUi.accent(store) & 0x00ffffff) | 0x30000000,
              9,
              context));
      panel.addView(badge, new LinearLayout.LayoutParams(-2, -2));
      gap(panel, 14);
    }
    LinearLayout details = NativeUi.column(context);
    if (periods.length() > 1) {
      LinearLayout tabs = new LinearLayout(context);
      tabs.setPadding(dp(3), dp(3), dp(3), dp(3));
      tabs.setBackground(NativeUi.panel(0x05ffffff, 0x13ffffff, 12, context));
      ArrayList<Button> buttons = new ArrayList<>();
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
                  } catch (Exception ignored) {
                  }
                });
        tab.setTextSize(12);
        tab.setPadding(dp(3), 0, dp(3), 0);
        tabs.addView(tab, new LinearLayout.LayoutParams(0, dp(44), 1));
        buttons.add(tab);
      }
      selectTab(buttons, 0);
      panel.addView(tabs);
      gap(panel, 16);
    }
    if (periods.length() > 0) render(details, periods.getJSONObject(0));
    else {
      details.addView(text(t("Your unlock screen is working"), 23, Color.WHITE, true));
      gap(details, 10);
      TextView description = text(t(message), 13, 0xffa6adb7, false);
      description.setLineSpacing(dp(3), 1);
      details.addView(description);
    }
    panel.addView(details);
    if (periods.length() > 0 && !message.isEmpty()) {
      gap(panel, 12);
      panel.addView(text(t(message), 11, 0xff89929f, false));
    }
    gap(panel, 16);
    Button done = NativeUi.button(context, t("Continue"), dismiss);
    done.setTextSize(13);
    done.setTextColor(accent());
    done.setBackground(
        NativeUi.panel(
            (NativeUi.accent(store) & 0x00ffffff) | 0x18000000,
            (NativeUi.accent(store) & 0x00ffffff) | 0x45000000,
            12,
            context));
    panel.addView(done, new LinearLayout.LayoutParams(-1, dp(46)));
    return panel;
  }

  private void selectTab(ArrayList<Button> buttons, int index) {
    for (int i = 0; i < buttons.size(); i++) {
      Button b = buttons.get(i);
      b.setTextColor(i == index ? accent() : 0xff9299a3);
      b.setBackground(NativeUi.panel(i == index ? 0x16ffffff : Color.TRANSPARENT, 0, 9, context));
      b.setSelected(i == index);
    }
  }

  private void render(LinearLayout details, JSONObject period) {
    details.removeAllViews();
    String kind = period.optString("kind");
    details.addView(
        text(
            t(kind.equals("week") ? "Your week" : kind.equals("month") ? "Your month" : "Your day"),
            25,
            Color.WHITE,
            true));
    gap(details, 5);
    String start = period.optString("start"), end = period.optString("end");
    try {
      DateTimeFormatter f =
          DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)
              .withLocale(java.util.Locale.forLanguageTag(store.locale()));
      start = LocalDate.parse(start).format(f);
      end = LocalDate.parse(end).format(f);
    } catch (Exception ignored) {
    }
    details.addView(text(start.equals(end) ? end : start + " – " + end, 11, 0xff89929f, false));
    gap(details, 17);
    ArrayList<String[]> metrics = new ArrayList<>();
    for (String[] m :
        new String[][] {
          {"tasks", "Tasks done", "routines"},
          {"habits", "Habit check-ins", "habits"},
          {"workouts", "Workouts saved", "workout"},
          {"exercises", "Exercises checked", "workout"},
          {"athkar", "Athkar sessions", "athkar"}
        }) {
      boolean hidden = false;
      JSONArray pages = period.optJSONArray("hiddenPages");
      if (pages != null)
        for (int i = 0; i < pages.length(); i++) if (m[2].equals(pages.optString(i))) hidden = true;
      if (!hidden) metrics.add(m);
    }
    for (int i = 0; i < metrics.size(); i += 2) {
      LinearLayout row = new LinearLayout(context);
      int remaining = metrics.size() - i;
      for (int j = i; j < Math.min(i + 2, metrics.size()); j++) {
        String[] m = metrics.get(j);
        LinearLayout tile = NativeUi.column(context);
        tile.setPadding(dp(12), dp(10), dp(12), dp(10));
        tile.setBackground(NativeUi.panel(0x07ffffff, 0x16ffffff, 14, context));
        LinearLayout head = new LinearLayout(context);
        head.setGravity(Gravity.CENTER_VERTICAL);
        head.addView(
            new RecapIcon(context, m[2], accent()), new LinearLayout.LayoutParams(dp(17), dp(17)));
        TextView number =
            text(
                java.text.NumberFormat.getIntegerInstance(
                        java.util.Locale.forLanguageTag(store.locale()))
                    .format(period.optInt(m[0])),
                25,
                Color.WHITE,
                true);
        number.setGravity(Gravity.END);
        head.addView(number, new LinearLayout.LayoutParams(0, -2, 1));
        tile.addView(head);
        gap(tile, 7);
        TextView label = text(t(m[1]), 11, 0xffa6adb7, false);
        label.setLineSpacing(dp(2), 1);
        tile.addView(label);
        LinearLayout.LayoutParams cell = new LinearLayout.LayoutParams(0, -1, 1);
        if (j == i && remaining > 1) cell.setMarginEnd(dp(7));
        row.addView(tile, cell);
      }
      details.addView(row, new LinearLayout.LayoutParams(-1, -2));
      if (i + 2 < metrics.size()) gap(details, 7);
    }
    if (!kind.equals("day")) {
      gap(details, 14);
      details.addView(
          text(
              t("Activity days")
                  + "  "
                  + period.optInt("activeDays")
                  + " / "
                  + period.optInt("totalDays"),
              11,
              accent(),
              true));
      JSONArray days = period.optJSONArray("days");
      if (days != null && days.length() > 0) {
        gap(details, 7);
        LinearLayout rhythm = new LinearLayout(context);
        for (int i = 0; i < days.length(); i++) {
          JSONObject d = days.optJSONObject(i);
          boolean active =
              d != null
                  && (d.optInt("tasks")
                          + d.optInt("habits")
                          + d.optInt("workouts")
                          + d.optInt("exercises")
                          + d.optInt("athkar")
                      > 0);
          View mark = new View(context);
          mark.setBackground(
              NativeUi.panel(active ? NativeUi.accent(store) : 0x12ffffff, 0, 3, context));
          LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(5), 1);
          lp.setMarginEnd(dp(3));
          rhythm.addView(mark, lp);
        }
        details.addView(rhythm);
      }
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
