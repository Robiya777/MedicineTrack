package uz.medicinetrack.app;

import android.app.*;
import android.content.*;
import android.graphics.*;
import android.os.*;
import android.view.*;
import android.widget.*;

/** Lock-screen prompt contains no patient identity, medication or clinical details. */
public final class AlarmActivity extends Activity {
  String kind;
  final Handler handler = new Handler(Looper.getMainLooper());
  final Runnable timeout = () -> finish();

  @Override
  public void onCreate(Bundle state) {
    super.onCreate(state);
    if (Build.VERSION.SDK_INT >= 27) {
      setShowWhenLocked(true);
      setTurnScreenOn(true);
    } else
      getWindow()
          .addFlags(
              WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                  | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
    if (!BuildConfig.DEBUG) getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
    kind = getIntent().getStringExtra("kind");
    if (kind == null) {
      finish();
      return;
    }
    boolean health = AlarmAlerts.HEALTH.equals(kind);
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setGravity(Gravity.CENTER);
    root.setPadding(dp(24), dp(24), dp(24), dp(24));
    root.setBackgroundColor(0xfff5f8f7);
    setContentView(root);
    text(root, "MedicineTrack", 20, 0xff0f766e);
    text(root, health ? "Hozir ahvolingiz qanday?" : "Dori qabul qilish vaqti", 30, 0xff18332f);
    text(
        root,
        health
            ? "Holatingizni ilovada qayd eting. Javob o‘zingiz yuborganda shifokorga boradi."
            : "Ilovani ochib shifokor tasdiqlagan jadvalni tekshiring.",
        17,
        0xff52645e);
    button(
        root,
        health ? "Holatimni yuborish" : "Dori jadvalini ochish",
        () -> {
          AlarmAlerts.dismiss(this, kind);
          android.app.KeyguardManager keyguard =
              getSystemService(android.app.KeyguardManager.class);
          if (keyguard.isKeyguardLocked())
            keyguard.requestDismissKeyguard(
                this,
                new android.app.KeyguardManager.KeyguardDismissCallback() {
                  @Override
                  public void onDismissSucceeded() {
                    open(health);
                  }
                });
          else open(health);
        });
    button(
        root,
        "10 daqiqadan keyin",
        () -> {
          SyncJobService.WORK.execute(
              () -> {
                try {
                  AlarmAlerts.snooze(this, kind);
                } catch (Exception ignored) {
                }
              });
          finish();
        });
    button(
        root,
        "Yopish",
        () -> {
          AlarmAlerts.dismiss(this, kind);
          finish();
        });
    handler.postDelayed(timeout, 60000);
  }

  void open(boolean health) {
    startActivity(
        new Intent(this, MainActivity.class)
            .putExtra("screen", health ? "Holat" : "Dorilar")
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP));
    finish();
  }

  void text(LinearLayout root, String value, int size, int color) {
    TextView t = new TextView(this);
    t.setText(value);
    t.setTextSize(size);
    t.setTextColor(color);
    t.setTypeface(getResources().getFont(R.font.dm_sans));
    t.setGravity(Gravity.CENTER);
    t.setPadding(12, 16, 12, 16);
    root.addView(t);
  }

  void button(LinearLayout root, String value, Runnable action) {
    Button b = new Button(this);
    b.setText(value);
    b.setAllCaps(false);
    b.setTextSize(16);
    b.setTypeface(getResources().getFont(R.font.dm_sans));
    b.setStateListAnimator(null);
    android.graphics.drawable.GradientDrawable background =
        new android.graphics.drawable.GradientDrawable();
    boolean primary = value.equals("Holatimni yuborish") || value.equals("Dori jadvalini ochish");
    background.setColor(primary ? 0xff0f766e : 0xffdff5ef);
    background.setCornerRadius(dp(12));
    b.setBackground(background);
    b.setTextColor(primary ? Color.WHITE : 0xff0f766e);
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, dp(56));
    params.setMargins(0, dp(8), 0, 0);
    root.addView(b, params);
    b.setOnClickListener(v -> action.run());
  }

  int dp(int n) {
    return Math.round(n * getResources().getDisplayMetrics().density);
  }

  @Override
  public void onDestroy() {
    handler.removeCallbacks(timeout);
    super.onDestroy();
  }
}
