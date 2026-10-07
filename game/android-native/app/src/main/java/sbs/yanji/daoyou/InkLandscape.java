package sbs.yanji.daoyou;

import android.content.Context;
import android.graphics.*;
import android.view.View;

/** Local vector artwork; no network image fetch or web rendering. */
public final class InkLandscape extends View {
    private final Paint paint = new Paint(3);
    public InkLandscape(Context context) { super(context); setContentDescription("水墨山峦"); setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO); }
    @Override protected void onDraw(Canvas c) {
        super.onDraw(c); float w=getWidth(), h=getHeight(); c.drawColor(Color.rgb(242,241,231));
        paint.setColor(0xffdfcfab); c.drawCircle(w*.78f,h*.24f,h*.12f,paint);
        for(int layer=0;layer<4;layer++) {
            Path p=new Path(); p.moveTo(0,h);
            for(int i=0;i<=24;i++) { float x=w*i/24f; float y=h*(.36f+layer*.16f)+(float)(Math.sin(i*.77+layer)*h*.11+Math.cos(i*1.9)*h*.04); p.lineTo(x,y); }
            p.lineTo(w,h);p.close(); int[] colors={0xffc7d4cc,0xffacbfb3,0xff8da69b,0xff557c6c}; paint.setColor(colors[layer]); c.drawPath(p,paint);
        }
        paint.setColor(0x99ffffff);paint.setStrokeWidth(h*.035f); c.drawLine(0,h*.73f,w,h*.68f,paint);
    }
}
