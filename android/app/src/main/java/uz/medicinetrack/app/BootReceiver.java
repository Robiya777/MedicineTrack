package uz.medicinetrack.app;

import android.content.*;

public final class BootReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context c, Intent i) {
    PendingResult r = goAsync();
    new Thread(
            () -> {
              try {
                Reminders.schedule(c);
              } catch (Exception ignored) {
              } finally {
                r.finish();
              }
            })
        .start();
  }
}
