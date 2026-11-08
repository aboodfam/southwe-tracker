package com.ceventic.android;

import android.content.Context;
import android.graphics.*;
import android.view.View;

/** Only a supplied, meaningful active-day denominator draws a progress arc. */
final class RecapRing extends View {
  private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final int accent;
  private final float ratio;

  RecapRing(Context context, int accent, float ratio) {
    super(context);
    this.accent = accent;
    this.ratio = ratio;
    setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
  }

  @Override
  protected void onDraw(Canvas canvas) {
    super.onDraw(canvas);
    float stroke = NativeUi.dp(getContext(), 7), inset = stroke + NativeUi.dp(getContext(), 5);
    RectF rect = new RectF(inset, inset, getWidth() - inset, getHeight() - inset);
    paint.setStyle(Paint.Style.STROKE);
    paint.setStrokeWidth(stroke);
    paint.setStrokeCap(Paint.Cap.ROUND);
    paint.setColor(0x0effffff);
    canvas.drawOval(rect, paint);
    if (ratio >= 0) {
      if (ratio > 0) {
        paint.setColor(accent);
        canvas.drawArc(rect, -90, Math.min(1, ratio) * 360, false, paint);
      }
    } else {
      paint.setStrokeWidth(NativeUi.dp(getContext(), 1));
      paint.setColor((accent & 0xffffff) | 0x50000000);
      canvas.drawOval(rect, paint);
    }
    paint.setStrokeWidth(NativeUi.dp(getContext(), 1));
    paint.setColor(0x06ffffff);
    float outer = NativeUi.dp(getContext(), 2);
    canvas.drawOval(new RectF(outer, outer, getWidth() - outer, getHeight() - outer), paint);
  }
}
