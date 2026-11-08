package com.ceventic.android;

import android.content.Context;
import android.graphics.*;
import android.view.View;
import org.json.*;

/** Each bar is a real daily aggregate. Missing detail remains an empty track. */
final class RecapChart extends View {
  private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final int color;
  private final int[] values;

  RecapChart(Context c, int accent, JSONArray days, String field) {
    super(c);
    color = accent;
    values = new int[days == null ? 0 : Math.min(31, days.length())];
    for (int i = 0; i < values.length; i++) {
      JSONObject d = days.optJSONObject(days.length() - values.length + i);
      if (d == null) continue;
      values[i] =
          field.equals("activity")
              ? (d.optInt("tasks")
                          + d.optInt("habits")
                          + d.optInt("exercises")
                          + d.optInt("workouts")
                          + d.optInt("athkar")
                      > 0
                  ? 1
                  : 0)
              : Math.max(0, d.optInt(field));
    }
    setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
  }

  @Override
  protected void onDraw(Canvas canvas) {
    super.onDraw(canvas);
    float padding = NativeUi.dp(getContext(), 3),
        height = getHeight() - padding * 2,
        width = getWidth() - padding * 2;
    if (width <= 0 || height <= 0) return;
    int max = 1;
    for (int value : values) max = Math.max(max, value);
    if (values.length == 0) {
      paint.setColor(0x16ffffff);
      paint.setStrokeWidth(NativeUi.dp(getContext(), 2));
      canvas.drawLine(
          padding, getHeight() - padding, getWidth() - padding, getHeight() - padding, paint);
      return;
    }
    float step = width / values.length,
        bar = Math.min(NativeUi.dp(getContext(), 9), Math.max(1, step * .6f));
    for (int i = 0; i < values.length; i++) {
      float x = padding + (i + .5f) * step - bar / 2;
      float h =
          values[i] == 0
              ? NativeUi.dp(getContext(), 2)
              : Math.max(NativeUi.dp(getContext(), 5), height * values[i] / max);
      paint.setColor(values[i] > 0 ? color : 0x22ffffff);
      canvas.drawRoundRect(
          x,
          getHeight() - padding - h,
          x + bar,
          getHeight() - padding,
          Math.min(bar / 2, NativeUi.dp(getContext(), 3)),
          Math.min(bar / 2, NativeUi.dp(getContext(), 3)),
          paint);
    }
  }

  int[] valuesForTesting() {
    return values.clone();
  }
}
