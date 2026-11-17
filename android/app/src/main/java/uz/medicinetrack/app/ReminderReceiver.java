package uz.medicinetrack.app;

import android.content.*;

public final class ReminderReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context c, Intent i) {
    PendingResult r = goAsync();
    new Thread(
            () -> {
              try {
                if (i.getData() != null) Reminders.show(c, i.getData().getLastPathSegment());
                Reminders.schedule(c);
              } catch (Exception ignored) {
              } finally {
                r.finish();
              }
            })
        .start();
  }
}
