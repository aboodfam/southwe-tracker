package com.ceventic.android;

import android.graphics.*;
import android.graphics.drawable.Drawable;

/** Theme-derived translucent materials; no captured wallpaper or hardcoded accent. */
final class RecapGlass extends Drawable {
  private final int accent;
  private final boolean panel;
  private final float radius;
  private int opacity;
  private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

  RecapGlass(int accent, boolean panel, int opacity) {
    this(accent, panel, opacity, 0);
  }

  RecapGlass(int accent, boolean panel, int opacity, float radius) {
    this.accent = accent;
    this.panel = panel;
    this.opacity = opacity;
    this.radius = radius;
  }

  private int alpha(int color, int n) {
    return (color & 0xffffff) | (n << 24);
  }

  @Override
  public void draw(Canvas c) {
    Rect b = getBounds();
    if (b.width() == 0 || b.height() == 0) return;
    RectF box = new RectF(b.left + .5f, b.top + .5f, b.right - .5f, b.bottom - .5f);
    paint.setStyle(Paint.Style.FILL);
    paint.setShader(
        new LinearGradient(
            b.left,
            b.top,
            b.right,
            b.bottom,
            new int[] {
              alpha(NativeUi.mix(NativeUi.RECAP_BASE, accent, panel ? .065f : .045f), opacity),
              alpha(NativeUi.mix(NativeUi.RECAP_BASE, accent, panel ? .022f : .009f), opacity)
            },
            null,
            Shader.TileMode.CLAMP));
    c.drawRoundRect(box, radius, radius, paint);
    paint.setShader(null);
    if (!panel) return;
    c.save();
    Path clip = new Path();
    clip.addRoundRect(box, radius, radius, Path.Direction.CW);
    c.clipPath(clip);
    paint.setShader(
        new RadialGradient(
            b.left,
            b.bottom,
            Math.max(b.width(), b.height()),
            new int[] {alpha(accent, 13), alpha(accent, 0)},
            null,
            Shader.TileMode.CLAMP));
    c.drawRect(b, paint);
    paint.setShader(null);
    // Quiet tonal reflection rather than a bright glass rim.
    Path curve = new Path();
    curve.moveTo(b.left, b.bottom * .92f);
    curve.cubicTo(
        b.width() * .4f,
        b.bottom * .6f,
        b.width() * .7f,
        b.bottom * 1.15f,
        b.right,
        b.bottom * .7f);
    curve.lineTo(b.right, b.bottom);
    curve.lineTo(b.left, b.bottom);
    curve.close();
    paint.setColor(0x03ffffff);
    c.drawPath(curve, paint);
    c.restore();
    paint.setStyle(Paint.Style.STROKE);
    paint.setStrokeWidth(1);
    paint.setColor(alpha(NativeUi.mix(accent, Color.WHITE, .22f), 35));
    c.drawRoundRect(box, radius, radius, paint);
    paint.setStyle(Paint.Style.FILL);
  }

  @Override
  public void setAlpha(int value) {
    opacity = value;
    invalidateSelf();
  }

  @Override
  public int getAlpha() {
    return opacity;
  }

  @Override
  public void setColorFilter(ColorFilter filter) {
    paint.setColorFilter(filter);
  }

  @Override
  public int getOpacity() {
    return opacity == 255 ? PixelFormat.OPAQUE : PixelFormat.TRANSLUCENT;
  }
}
