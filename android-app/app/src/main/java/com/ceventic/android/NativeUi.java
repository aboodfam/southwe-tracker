package com.ceventic.android;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.View;
import android.widget.*;

final class NativeUi {
  static int dp(Context c, float n) {
    return Math.round(n * c.getResources().getDisplayMetrics().density);
  }

  static int accent(RecapStore s) {
    try {
      return Color.parseColor(s.accent());
    } catch (Exception e) {
      return Color.LTGRAY;
    }
  }

  static int lightAccent(RecapStore s) {
    int a = accent(s);
    return Color.rgb(
        (int) (Color.red(a) * .68 + 255 * .32),
        (int) (Color.green(a) * .68 + 255 * .32),
        (int) (Color.blue(a) * .68 + 255 * .32));
  }

  static GradientDrawable panel(int color, int border, float radius, Context c) {
    GradientDrawable d = new GradientDrawable();
    d.setColor(color);
    d.setCornerRadius(dp(c, radius));
    d.setStroke(dp(c, 1), border);
    return d;
  }

  static LinearLayout column(Context c) {
    LinearLayout v = new LinearLayout(c);
    v.setOrientation(LinearLayout.VERTICAL);
    return v;
  }

  static TextView text(Context c, String value, int size, int color, boolean bold) {
    TextView t = new TextView(c);
    t.setText(value);
    t.setTextSize(size);
    t.setTextColor(color);
    t.setFontFeatureSettings("tnum");
    if (bold) t.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
    t.setPadding(0, dp(c, 5), 0, dp(c, 5));
    return t;
  }

  static Button button(Context c, String label, Runnable click) {
    Button b = new Button(c);
    b.setText(label);
    b.setAllCaps(false);
    b.setTextSize(14);
    b.setTextColor(Color.WHITE);
    b.setMinHeight(dp(c, 48));
    b.setBackground(panel(0xff171b20, 0x35ffffff, 12, c));
    LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, dp(c, 50));
    p.topMargin = dp(c, 10);
    b.setLayoutParams(p);
    b.setOnClickListener(v -> click.run());
    return b;
  }

  static void inset(android.app.Activity activity, View root) {
    activity.getWindow().setDecorFitsSystemWindows(false);
    root.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
    activity.getWindow().setStatusBarColor(Color.BLACK);
    activity.getWindow().setNavigationBarColor(Color.BLACK);
    root.setBackgroundColor(Color.BLACK);
    root.setOnApplyWindowInsetsListener(
        (v, i) -> {
          android.graphics.Insets bars =
              i.getInsets(
                  android.view.WindowInsets.Type.systemBars()
                      | android.view.WindowInsets.Type.ime());
          v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
          return android.view.WindowInsets.CONSUMED;
        });
  }
}
