package com.ceventic.android;

import android.content.Context;
import android.graphics.Color;
import android.view.*;
import android.widget.*;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import org.json.*;

final class RecapOverlay {
  private final Context context;
  private final RecapStore store;
  private View root;
  private WindowManager manager;

  RecapOverlay(Context context, RecapStore store) {
    this.context = context;
    this.store = store;
  }

  boolean showing() {
    return root != null;
  }

  private String t(String s) {
    return NativeStrings.text(store, s);
  }

  void show(JSONArray periods, boolean sample, Runnable dismissed) throws Exception {
    if (showing() || periods.length() == 0) return;
    manager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
    FrameLayout backdrop = new FrameLayout(context);
    backdrop.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
    backdrop.setBackgroundColor(0xbb000000);
    backdrop.setPadding(
        NativeUi.dp(context, 16),
        NativeUi.dp(context, 32),
        NativeUi.dp(context, 16),
        NativeUi.dp(context, 32));
    LinearLayout panel = NativeUi.column(context);
    panel.setPadding(
        NativeUi.dp(context, 18),
        NativeUi.dp(context, 16),
        NativeUi.dp(context, 18),
        NativeUi.dp(context, 16));
    panel.setBackground(NativeUi.panel(0xff090d12, 0x30ffffff, 24, context));
    ScrollView scroll = new ScrollView(context);
    scroll.setFillViewport(false);
    scroll.addView(panel);
    FrameLayout.LayoutParams box =
        new FrameLayout.LayoutParams(
            Math.min(
                context.getResources().getDisplayMetrics().widthPixels - NativeUi.dp(context, 32),
                NativeUi.dp(context, 400)),
            -2,
            Gravity.CENTER);
    box.setMargins(0, 0, 0, 0);
    backdrop.addView(scroll, box);
    int maxHeight = (int) (context.getResources().getDisplayMetrics().heightPixels * .84);
    scroll
        .getViewTreeObserver()
        .addOnGlobalLayoutListener(
            () -> {
              if (scroll.getHeight() > maxHeight) {
                android.view.ViewGroup.LayoutParams lp = scroll.getLayoutParams();
                lp.height = maxHeight;
                scroll.setLayoutParams(lp);
              }
            });
    LinearLayout top = new LinearLayout(context);
    top.setGravity(Gravity.CENTER_VERTICAL);
    TextView brand = NativeUi.text(context, "Ceventic", 14, NativeUi.lightAccent(store), true);
    top.addView(brand, new LinearLayout.LayoutParams(0, -2, 1));
    Button close =
        NativeUi.button(
            context,
            "×",
            () -> {
              hide();
              dismissed.run();
            });
    close.setContentDescription(t("Close"));
    close.setLayoutParams(
        new LinearLayout.LayoutParams(NativeUi.dp(context, 48), NativeUi.dp(context, 48)));
    top.addView(close);
    panel.addView(top);
    if (sample)
      panel.addView(
          NativeUi.text(
              context, t("Sample preview — not your account data"), 12, Color.LTGRAY, false));
    LinearLayout tabs = new LinearLayout(context);
    tabs.setGravity(Gravity.CENTER);
    LinearLayout details = NativeUi.column(context);
    for (int i = 0; i < periods.length(); i++) {
      final int index = i;
      JSONObject period = periods.getJSONObject(i);
      String label =
          switch (period.optString("kind")) {
            case "week" -> "Week";
            case "month" -> "Month";
            default -> "Day";
          };
      Button tab =
          NativeUi.button(
              context,
              t(label),
              () -> {
                try {
                  render(details, periods.getJSONObject(index));
                } catch (Exception ignored) {
                }
              });
      LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(0, NativeUi.dp(context, 48), 1);
      tp.setMargins(
          NativeUi.dp(context, 2),
          NativeUi.dp(context, 10),
          NativeUi.dp(context, 2),
          NativeUi.dp(context, 10));
      tabs.addView(tab, tp);
    }
    if (periods.length() > 1) panel.addView(tabs);
    panel.addView(details);
    render(details, periods.getJSONObject(0));
    panel.addView(
        NativeUi.text(context, t("Unrecorded days are not failures."), 12, 0xff9299a3, false));
    panel.addView(
        NativeUi.text(
            context,
            t(
                "Athkar history starts with this update. Only scheduled and prayer sessions are"
                    + " counted."),
            11,
            0xff7d858e,
            false));
    panel.addView(
        NativeUi.button(
            context,
            t("Continue"),
            () -> {
              hide();
              dismissed.run();
            }));
    backdrop.setOnClickListener(
        v -> {
          hide();
          dismissed.run();
        });
    panel.setOnClickListener(v -> {});
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
    params.dimAmount = .25f;
    params.gravity = Gravity.CENTER;
    params.setTitle("Ceventic recap");
    root = backdrop;
    try {
      manager.addView(root, params);
      root.requestFocus();
    } catch (Exception e) {
      root = null;
      throw e;
    }
  }

  private void render(LinearLayout details, JSONObject period) {
    details.removeAllViews();
    String title =
        switch (period.optString("kind")) {
          case "week" -> "Your week";
          case "month" -> "Your month";
          default -> "Your day";
        };
    details.addView(NativeUi.text(context, t(title), 26, Color.WHITE, true));
    String start = period.optString("start"), end = period.optString("end");
    try {
      DateTimeFormatter formatter =
          DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)
              .withLocale(java.util.Locale.forLanguageTag(store.locale()));
      start = LocalDate.parse(start).format(formatter);
      end = LocalDate.parse(end).format(formatter);
    } catch (Exception ignored) {
    }
    details.addView(
        NativeUi.text(
            context, start.equals(end) ? end : start + " – " + end, 12, 0xff9299a3, false));
    String[][] metrics = {
      {"tasks", "Tasks done"},
      {"habits", "Habit check-ins"},
      {"workouts", "Workouts saved"},
      {"exercises", "Exercises checked"},
      {"athkar", "Athkar sessions recorded"}
    };
    for (String[] metric : metrics) {
      String page =
          switch (metric[0]) {
            case "tasks" -> "routines";
            case "habits" -> "habits";
            case "athkar" -> "athkar";
            default -> "workout";
          };
      if (period.optJSONArray("hiddenPages") != null
          && period.optJSONArray("hiddenPages").toString().contains("\"" + page + "\"")) continue;
      LinearLayout row = new LinearLayout(context);
      row.setGravity(Gravity.CENTER_VERTICAL);
      row.setPadding(0, NativeUi.dp(context, 6), 0, NativeUi.dp(context, 6));
      row.addView(
          NativeUi.text(context, t(metric[1]), 14, 0xffc5c9ce, false),
          new LinearLayout.LayoutParams(0, -2, 1));
      String n =
          java.text.NumberFormat.getIntegerInstance(java.util.Locale.forLanguageTag(store.locale()))
              .format(period.optInt(metric[0]));
      row.addView(NativeUi.text(context, n, 23, NativeUi.lightAccent(store), true));
      details.addView(row);
    }
    if (!"day".equals(period.optString("kind")))
      details.addView(
          NativeUi.text(
              context,
              t("Activity days")
                  + ": "
                  + period.optInt("activeDays")
                  + " / "
                  + period.optInt("totalDays"),
              13,
              0xffc5c9ce,
              false));
  }

  void hide() {
    if (root != null) {
      try {
        manager.removeView(root);
      } catch (Exception ignored) {
      }
      root = null;
    }
  }
}
