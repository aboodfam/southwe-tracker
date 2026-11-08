package com.ceventic.android;

import android.content.Context;
import android.graphics.*;
import android.view.View;

/** Same 24-unit outline motifs as src/components/icons.tsx. */
final class RecapIcon extends View {
  private final String name;
  private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);

  RecapIcon(Context c, String name, int color) {
    super(c);
    this.name = name;
    stroke.setColor(color);
    stroke.setStyle(Paint.Style.STROKE);
    stroke.setStrokeWidth(1.8f);
    stroke.setStrokeCap(Paint.Cap.ROUND);
    stroke.setStrokeJoin(Paint.Join.ROUND);
    setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
  }

  private void line(Canvas c, float x, float y, float a, float b) {
    c.drawLine(x, y, a, b, stroke);
  }

  @Override
  protected void onDraw(Canvas c) {
    super.onDraw(c);
    c.save();
    c.scale(getWidth() / 24f, getHeight() / 24f);
    switch (name) {
      case "habits":
        c.drawCircle(12, 12, 8, stroke);
        c.drawCircle(12, 12, 4, stroke);
        c.drawCircle(12, 12, 1, stroke);
        line(c, 12, 4, 12, 2);
        line(c, 20, 12, 22, 12);
        break;
      case "workout":
        line(c, 6.5f, 8, 6.5f, 16);
        line(c, 3.5f, 9.5f, 3.5f, 14.5f);
        line(c, 17.5f, 8, 17.5f, 16);
        line(c, 20.5f, 9.5f, 20.5f, 14.5f);
        line(c, 6.5f, 12, 17.5f, 12);
        break;
      case "athkar":
        for (float[] p :
            new float[][] {{12, 5}, {17, 8}, {18, 14}, {14, 18}, {8, 18}, {5, 13}, {7, 8}})
          c.drawCircle(p[0], p[1], 2, stroke);
        break;
      default:
        c.drawRoundRect(5, 4, 19, 21, 2, 2, stroke);
        line(c, 9, 4, 9, 2);
        line(c, 9, 2, 15, 2);
        line(c, 15, 2, 15, 4);
        line(c, 8.5f, 10, 10, 11.5f);
        line(c, 10, 11.5f, 13, 8.5f);
        line(c, 14, 11, 16.5f, 11);
        line(c, 8.5f, 16, 10, 17.5f);
        line(c, 10, 17.5f, 13, 14.5f);
        line(c, 14, 17, 16.5f, 17);
    }
    c.restore();
  }
}
