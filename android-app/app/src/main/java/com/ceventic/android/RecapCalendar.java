package com.ceventic.android;

import android.content.Context;
import android.graphics.*;
import android.view.View;
import org.json.*;

/** Calendar marks reflect actual daily aggregates, including saved workouts. */
@android.annotation.SuppressLint("ViewConstructor")
final class RecapCalendar extends View {
  private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final boolean[] activity;
  private final int accent;

  RecapCalendar(Context c, int accent, JSONArray days) {
    super(c);
    this.accent = accent;
    activity = new boolean[days == null ? 0 : Math.min(days.length(), 31)];
    for (int i = 0; i < activity.length; i++) {
      JSONObject d = days.optJSONObject(i);
      if (d != null) for (String field : RecapInsight.FIELDS) activity[i] |= d.optInt(field) > 0;
    }
    setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
  }

  @Override
  protected void onDraw(Canvas c) {
    int columns = Math.min(7, activity.length), rows = (activity.length + 6) / 7;
    if (columns == 0) return;
    float stepX = getWidth() / (float) columns, stepY = getHeight() / (float) rows;
    float size = Math.min(NativeUi.dp(getContext(), 10), Math.min(stepX, stepY) * .65f);
    for (int i = 0; i < activity.length; i++) {
      float x = (i % 7 + .5f) * stepX, y = (i / 7 + .5f) * stepY;
      paint.setColor(activity[i] ? accent : 0x24ffffff);
      c.drawRoundRect(
          x - size / 2, y - size / 2, x + size / 2, y + size / 2, size * .28f, size * .28f, paint);
    }
  }

  boolean[] activityForTesting() {
    return activity.clone();
  }
}
