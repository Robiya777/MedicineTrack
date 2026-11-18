package uz.medicinetrack.app;

import android.graphics.*;
import android.graphics.drawable.Drawable;

/** Small stroke icons matching the web cabinet's navigation vocabulary. */
final class NavIcon extends Drawable {
  private final int kind;
  private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
  NavIcon(int kind, int color) {
    this.kind = kind;
    paint.setColor(color);
    paint.setStyle(Paint.Style.STROKE);
    paint.setStrokeWidth(1.8f);
    paint.setStrokeCap(Paint.Cap.ROUND);
    paint.setStrokeJoin(Paint.Join.ROUND);
  }
  @Override public void draw(Canvas canvas) {
    canvas.save();
    canvas.translate(getBounds().left, getBounds().top);
    canvas.scale(getBounds().width()/24f, getBounds().height()/24f);
    Path p = new Path();
    if (kind == 0) {
      p.moveTo(3,10); p.lineTo(12,3); p.lineTo(21,10); p.lineTo(21,21);
      p.lineTo(15,21); p.lineTo(15,14); p.lineTo(9,14); p.lineTo(9,21);
      p.lineTo(3,21); p.close(); canvas.drawPath(p,paint);
    } else if (kind == 1) {
      canvas.drawRoundRect(4,4,20,21,3,3,paint);
      canvas.drawLine(8,2,8,6,paint); canvas.drawLine(16,2,16,6,paint);
      canvas.drawLine(4,9,20,9,paint); canvas.drawLine(9,15,15,15,paint);
      canvas.drawLine(12,12,12,18,paint);
    } else if (kind == 2) {
      p.moveTo(6,3); p.lineTo(18,3); p.quadTo(21,3,21,6); p.lineTo(21,15);
      p.quadTo(21,18,18,18); p.lineTo(9,18); p.lineTo(3,22); p.lineTo(3,6);
      p.quadTo(3,3,6,3); canvas.drawPath(p,paint);
      canvas.drawLine(7,8,17,8,paint); canvas.drawLine(7,12,14,12,paint);
    } else {
      canvas.drawCircle(12,7,4,paint); canvas.drawArc(4,13,20,27,180,180,false,paint);
    }
    canvas.restore();
  }
  @Override public void setAlpha(int alpha) { paint.setAlpha(alpha); }
  @Override public void setColorFilter(ColorFilter filter) { paint.setColorFilter(filter); }
  @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
}
