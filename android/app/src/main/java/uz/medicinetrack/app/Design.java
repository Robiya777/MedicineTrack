package uz.medicinetrack.app;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.*;
import android.graphics.drawable.*;

/** Native equivalents of frontend/src/index.css tokens and its outline icons. */
final class Design {
  static final int PRIMARY = 0xff0f766e,
      MINT = 0xffdff5ef,
      INK = 0xff18332f,
      MUTED = 0xff52645e,
      PAGE = 0xfff5f8f7,
      LINE = 0xffdce6e2,
      INPUT = 0xff81988f,
      DANGER = 0xffb42318,
      WARNING = 0xff92400e;

  static Typeface font(Context context, boolean bold) {
    Typeface base = context.getResources().getFont(R.font.dm_sans);
    return Typeface.create(base, bold ? Typeface.BOLD : Typeface.NORMAL);
  }

  static GradientDrawable shape(Context context, int color, int radius, int border) {
    float density = context.getResources().getDisplayMetrics().density;
    GradientDrawable d = new GradientDrawable();
    d.setColor(color);
    d.setCornerRadius(radius * density);
    if (border != 0) d.setStroke(Math.max(1, Math.round(density)), border);
    return d;
  }

  static Drawable ripple(Context context, int color, int radius, int border) {
    return new RippleDrawable(
        ColorStateList.valueOf(0x260f766e),
        shape(context, color, radius, border),
        shape(context, Color.WHITE, radius, 0));
  }

  static Drawable icon(Context context, String name, int color) {
    return new OutlineIcon(name, color, context.getResources().getDisplayMetrics().density);
  }

  private static final class OutlineIcon extends Drawable {
    final String name;
    final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    final int size;

    OutlineIcon(String name, int color, float density) {
      this.name = name;
      size = Math.round(24 * density);
      paint.setColor(color);
      paint.setStyle(Paint.Style.STROKE);
      paint.setStrokeWidth(1.8f);
      paint.setStrokeCap(Paint.Cap.ROUND);
      paint.setStrokeJoin(Paint.Join.ROUND);
    }

    void path(Canvas c, float... points) {
      Path p = new Path();
      p.moveTo(points[0], points[1]);
      for (int i = 2; i < points.length; i += 2) p.lineTo(points[i], points[i + 1]);
      c.drawPath(p, paint);
    }

    @Override
    public void draw(Canvas canvas) {
      int save = canvas.save();
      Rect b = getBounds();
      canvas.translate(b.left, b.top);
      canvas.scale(b.width() / 24f, b.height() / 24f);
      switch (name) {
        case "phone":
          path(
              canvas, 6, 2, 3, 3, 2, 7, 4, 13, 10, 19, 16, 22, 20, 21, 22, 18, 17, 14, 14, 16, 8,
              10, 10, 7, 6, 2);
          break;
        case "home":
          path(canvas, 3, 10, 12, 3, 21, 10, 21, 21, 15, 21, 15, 14, 9, 14, 9, 21, 3, 21, 3, 10);
          break;
        case "tasks":
          canvas.drawRoundRect(5, 4, 19, 22, 2, 2, paint);
          canvas.drawRoundRect(9, 2, 15, 6, 1, 1, paint);
          path(canvas, 9, 12, 10, 13, 12, 11);
          path(canvas, 15, 12, 16, 12);
          path(canvas, 9, 17, 10, 18, 12, 16);
          path(canvas, 15, 17, 16, 17);
          break;
        case "chat":
          path(canvas, 21, 11, 21, 16, 17, 20, 7, 20, 3, 23, 3, 6, 7, 2, 17, 2, 21, 6, 21, 11);
          path(canvas, 7, 8, 17, 8);
          path(canvas, 7, 13, 14, 13);
          break;
        case "user":
          canvas.drawCircle(12, 7, 4, paint);
          canvas.drawArc(4, 14, 20, 28, 180, 180, false, paint);
          break;
        case "bell":
          path(canvas, 4, 17, 6, 14, 6, 8, 8, 4, 12, 2, 16, 4, 18, 8, 18, 14, 20, 17, 4, 17);
          canvas.drawArc(9, 18, 15, 22, 0, 180, false, paint);
          break;
        case "pill":
          canvas.rotate(-45, 12, 12);
          canvas.drawRoundRect(7, 2, 17, 22, 5, 5, paint);
          path(canvas, 7, 12, 17, 12);
          break;
        case "back":
          path(canvas, 14, 5, 7, 12, 14, 19);
          path(canvas, 7, 12, 21, 12);
          break;
        case "next":
          path(canvas, 9, 5, 16, 12, 9, 19);
          break;
        case "down":
          path(canvas, 6, 9, 12, 15, 18, 9);
          break;
        case "refresh":
          canvas.drawArc(4, 4, 20, 20, 35, 285, false, paint);
          path(canvas, 20, 3, 20, 9, 14, 9);
          break;
        case "eye":
          Path eye = new Path();
          eye.moveTo(2, 12);
          eye.quadTo(12, -1, 22, 12);
          eye.quadTo(12, 25, 2, 12);
          canvas.drawPath(eye, paint);
          canvas.drawCircle(12, 12, 3, paint);
          break;
        case "shield":
          path(canvas, 12, 2, 21, 6, 20, 15, 17, 19, 12, 22, 7, 19, 4, 15, 3, 6, 12, 2);
          path(canvas, 8, 12, 11, 15, 16, 9);
          break;
        case "check":
          path(canvas, 5, 12, 10, 17, 20, 7);
          break;
        default:
          Path heart = new Path();
          heart.moveTo(20.8f, 4.6f);
          heart.cubicTo(17, 1, 13, 3, 12, 5);
          heart.cubicTo(10, 1, 4, 1, 2.7f, 6);
          heart.cubicTo(0, 12, 8, 18, 12, 22);
          heart.cubicTo(17, 17, 25, 10, 20.8f, 4.6f);
          canvas.drawPath(heart, paint);
          path(canvas, 2, 12, 7, 12, 9, 8, 12, 16, 15, 11, 22, 11);
      }
      canvas.restoreToCount(save);
    }

    @Override
    public int getIntrinsicWidth() {
      return size;
    }

    @Override
    public int getIntrinsicHeight() {
      return size;
    }

    @Override
    public void setAlpha(int alpha) {
      paint.setAlpha(alpha);
      invalidateSelf();
    }

    @Override
    public void setColorFilter(ColorFilter filter) {
      paint.setColorFilter(filter);
    }

    @Override
    public int getOpacity() {
      return PixelFormat.TRANSLUCENT;
    }
  }
}
