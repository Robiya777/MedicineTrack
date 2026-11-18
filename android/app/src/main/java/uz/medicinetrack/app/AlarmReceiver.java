package uz.medicinetrack.app;

import android.content.*;

public final class AlarmReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context c, Intent i) {
    PendingResult result = goAsync();
    SyncJobService.WORK.execute(
        () -> {
          try {
            if (i.getData() == null) return;
            String kind = i.getData().getLastPathSegment();
            if ("SNOOZE".equals(i.getAction())) AlarmAlerts.snooze(c, kind);
            else if ("DISMISS".equals(i.getAction())) AlarmAlerts.dismiss(c, kind);
            else {
              AlarmAlerts.show(c, kind);
            }
          } catch (Exception ignored) {
          } finally {
            if ("FIRE".equals(i.getAction())
                && i.getData() != null
                && AlarmAlerts.HEALTH.equals(i.getData().getLastPathSegment())) {
              c.getSharedPreferences("alarms", 0).edit().remove("health_due").apply();
              try {
                AlarmAlerts.scheduleHealth(c);
              } catch (Exception ignored) {
              }
            }
            result.finish();
          }
        });
  }
}
