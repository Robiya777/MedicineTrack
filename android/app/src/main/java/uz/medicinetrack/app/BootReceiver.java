package uz.medicinetrack.app;

import android.content.*;

public final class BootReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context c, Intent i) {
    if (i == null
        || !(Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())
            || Intent.ACTION_MY_PACKAGE_REPLACED.equals(i.getAction()))) return;
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
