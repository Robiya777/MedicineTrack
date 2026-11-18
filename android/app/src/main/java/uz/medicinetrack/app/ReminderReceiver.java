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

              } catch (Exception ignored) {
              } finally {
                try {
                  Reminders.schedule(c);
                } catch (Exception ignored) {
                }
                r.finish();
              }
            })
        .start();
  }
}
