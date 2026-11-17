package uz.medicinetrack.app;

import android.app.*;
import android.content.*;
import android.net.Uri;
import java.time.Instant;
import org.json.*;

final class Reminders {
  static PendingIntent intent(Context c, String id) {
    return PendingIntent.getBroadcast(
        c,
        0,
        new Intent(c, ReminderReceiver.class).setData(Uri.parse("medicinetrack://dose/" + id)),
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  static void cancel(Context c) throws Exception {
    String old = new Vault(c).get("doses");
    if (old.isEmpty()) return;
    JSONArray rows = new JSONObject(old).getJSONArray("rows");
    for (int i = 0; i < rows.length(); i++)
      c.getSystemService(AlarmManager.class)
          .cancel(intent(c, rows.getJSONObject(i).getString("id")));
  }

  static void save(Context c, JSONArray rows) throws Exception {
    cancel(c);
    new Vault(c)
        .put(
            "doses",
            new JSONObject()
                .put("synced_at", System.currentTimeMillis())
                .put("rows", rows)
                .toString());
    schedule(c);
  }

  static void schedule(Context c) throws Exception {
    String packed = new Vault(c).get("doses");
    if (packed.isEmpty()) return;
    JSONArray rows = new JSONObject(packed).getJSONArray("rows");
    long earliest = Long.MAX_VALUE;
    for (int i = 0; i < rows.length(); i++) {
      JSONObject row = rows.getJSONObject(i);
      long at = Instant.parse(row.getString("scheduled_at")).toEpochMilli();
      if (row.optBoolean("reminder_enabled") && at > System.currentTimeMillis())
        earliest = Math.min(earliest, at);
    }
    // Only the next due time is armed. Receiver chains later doses without hitting alarm quotas.
    for (int i = 0; i < rows.length(); i++) {
      JSONObject row = rows.getJSONObject(i);
      long at = Instant.parse(row.getString("scheduled_at")).toEpochMilli();
      if (row.optBoolean("reminder_enabled") && at > System.currentTimeMillis() && at == earliest)
        c.getSystemService(AlarmManager.class)
            .setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent(c, row.getString("id")));
    }
  }

  static void clear(Context c) {
    try {
      cancel(c);
    } catch (Exception ignored) {
    }
    c.getSystemService(NotificationManager.class).cancelAll();
  }

  static void show(Context c, String id) throws Exception {
    String packed = new Vault(c).get("doses");
    if (packed.isEmpty()) return;
    JSONObject cache = new JSONObject(packed);
    JSONArray rows = cache.getJSONArray("rows");
    boolean valid = false;
    for (int i = 0; i < rows.length(); i++) {
      JSONObject r = rows.getJSONObject(i);
      if (r.getString("id").equals(id)
          && r.optBoolean("reminder_enabled")
          && r.isNull("cancelled_at")
          && r.isNull("record")) valid = true;
    }
    if (!valid) return;
    NotificationManager nm = c.getSystemService(NotificationManager.class);
    nm.createNotificationChannel(
        new NotificationChannel(
            "medication", "Dori eslatmalari", NotificationManager.IMPORTANCE_HIGH));
    PendingIntent open =
        PendingIntent.getActivity(
            c,
            0,
            new Intent(c, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra("screen", "Dorilar"),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    boolean stale = System.currentTimeMillis() - cache.getLong("synced_at") > 86400000L;
    nm.notify(
        id.hashCode(),
        new Notification.Builder(c, "medication")
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle("Dori qabul qilish vaqti")
            .setContentText(
                stale
                    ? "Jadval eskirgan bo‘lishi mumkin. Ilovada yangilang."
                    : "Tasdiqlangan jadvalni ilovada ko‘ring.")
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build());
  }
}
