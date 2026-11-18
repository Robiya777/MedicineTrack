package uz.medicinetrack.app;

import android.app.*;
import android.content.*;
import android.media.*;
import android.net.Uri;
import android.os.Build;
import java.time.*;

/** Patient-controlled local alarms; no clinical data appears on the lock screen. */
final class AlarmAlerts {
  static final String HEALTH = "health";
  static final long SNOOZE = 10 * 60 * 1000L;

  static PendingIntent pending(Context c, String kind, String action) {
    return PendingIntent.getBroadcast(
        c,
        0,
        new Intent(c, AlarmReceiver.class)
            .setData(Uri.parse("medicinetrack://alarm/" + kind))
            .setAction(action),
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  static long nextHealth(long now) {
    ZonedDateTime local = Instant.ofEpochMilli(now).atZone(ZoneId.of("Asia/Tashkent"));
    for (int day = 0; day < 2; day++) {
      for (int hour = 8; hour <= 20; hour += 3) {
        long at =
            local
                .toLocalDate()
                .plusDays(day)
                .atTime(hour, 0)
                .atZone(local.getZone())
                .toInstant()
                .toEpochMilli();
        if (at > now) return at;
      }
    }
    throw new IllegalStateException("No next daytime slot");
  }

  static boolean patient(Context c) throws Exception {
    Api api = new Api(new Vault(c));
    api.restore();
    return !api.access.isEmpty() && "PATIENT".equals(api.user.optString("role"));
  }

  static void arm(Context c, String kind, long at) {
    AlarmManager manager = c.getSystemService(AlarmManager.class);
    PendingIntent event = pending(c, kind, "FIRE");
    if (Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms()) {
      try {
        manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, event);
        return;
      } catch (SecurityException ignored) {
      }
    }
    manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, event);
  }

  static void scheduleHealth(Context c) throws Exception {
    if (!patient(c) || !c.getSharedPreferences("alarms", 0).getBoolean("health", true)) {
      c.getSharedPreferences("alarms", 0).edit().remove("health_due").apply();
      c.getSystemService(AlarmManager.class).cancel(pending(c, HEALTH, "FIRE"));
      return;
    }
    long now = System.currentTimeMillis();
    long due = c.getSharedPreferences("alarms", 0).getLong("health_due", 0);
    if (due <= now) due = nextHealth(now);
    c.getSharedPreferences("alarms", 0).edit().putLong("health_due", due).apply();
    arm(c, HEALTH, due);
  }

  static void clear(Context c) {
    c.getSystemService(AlarmManager.class).cancel(pending(c, HEALTH, "FIRE"));
    c.getSharedPreferences("alarms", 0).edit().remove("health_due").apply();
    try {
      String saved = new Vault(c).get("doses");
      if (!saved.isEmpty()) {
        org.json.JSONArray rows = new org.json.JSONObject(saved).getJSONArray("rows");
        for (int n = 0; n < rows.length(); n++)
          c.getSystemService(AlarmManager.class)
              .cancel(pending(c, rows.getJSONObject(n).getString("id"), "FIRE"));
      }
    } catch (Exception ignored) {
    }
  }

  static void snooze(Context c, String kind) throws Exception {
    dismiss(c, kind);
    if (!patient(c)) return;
    long at = System.currentTimeMillis() + SNOOZE;
    if (HEALTH.equals(kind)) {
      if (!c.getSharedPreferences("alarms", 0).getBoolean("health", true)) return;
      ZonedDateTime local = Instant.ofEpochMilli(at).atZone(ZoneId.of("Asia/Tashkent"));
      if (local.getHour() < 8 || local.getHour() >= 22) {
        scheduleHealth(c);
        return;
      }
    }
    if (HEALTH.equals(kind))
      c.getSharedPreferences("alarms", 0).edit().putLong("health_due", at).apply();
    arm(c, kind, at);
  }

  static void dismiss(Context c, String kind) {
    c.getSystemService(NotificationManager.class).cancel(("alarm:" + kind).hashCode());
  }

  static void show(Context c, String kind) throws Exception {
    if (!patient(c)) return;
    boolean health = HEALTH.equals(kind);
    if (health) {
      ZonedDateTime local = ZonedDateTime.now(ZoneId.of("Asia/Tashkent"));
      if (!c.getSharedPreferences("alarms", 0).getBoolean("health", true)
          || local.getHour() < 8
          || local.getHour() >= 22) return;
    } else if (!Reminders.valid(c, kind)) return;
    NotificationManager nm = c.getSystemService(NotificationManager.class);
    NotificationChannel channel =
        new NotificationChannel(
            "patient_alarm_v1",
            "Ovozli parvarish eslatmalari",
            NotificationManager.IMPORTANCE_HIGH);
    channel.setSound(
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
        new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());
    channel.enableVibration(true);
    channel.setVibrationPattern(new long[] {0, 500, 300, 500});
    channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
    nm.createNotificationChannel(channel);
    Intent i =
        new Intent(c, AlarmActivity.class)
            .putExtra("kind", kind)
            .setData(Uri.parse("medicinetrack://alarm-screen/" + kind))
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent open =
        PendingIntent.getActivity(
            c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder b =
        new Notification.Builder(c, "patient_alarm_v1")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(health ? "Hozir ahvolingiz qanday?" : "Dori qabul qilish vaqti")
            .setContentText(
                health
                    ? "Holatingizni shifokorga yuboring."
                    : "Tasdiqlangan jadvalni ochib tekshiring.")
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setContentIntent(open)
            .setAutoCancel(true)
            .setTimeoutAfter(60000)
            .addAction(
                new Notification.Action.Builder(
                        null, "10 daqiqadan keyin", pending(c, kind, "SNOOZE"))
                    .build())
            .addAction(
                new Notification.Action.Builder(null, "Yopish", pending(c, kind, "DISMISS"))
                    .build());
    if (Build.VERSION.SDK_INT < 34 || nm.canUseFullScreenIntent())
      b.setFullScreenIntent(open, true);
    Notification notification = b.build();
    notification.flags |= Notification.FLAG_INSISTENT;
    nm.notify(("alarm:" + kind).hashCode(), notification);
  }
}
