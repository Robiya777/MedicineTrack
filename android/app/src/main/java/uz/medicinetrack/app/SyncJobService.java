package uz.medicinetrack.app;

import android.app.job.*;
import android.content.*;
import java.util.concurrent.*;

/** All API mutations share one worker, including OS jobs, so session rotation is serialized. */
public final class SyncJobService extends JobService {
  static final ExecutorService WORK = Executors.newSingleThreadExecutor();
  static final int ID = 2401;

  static void schedule(Context c) {
    JobScheduler scheduler = c.getSystemService(JobScheduler.class);
    if (scheduler.getPendingJob(ID) == null)
      scheduler.schedule(
          new JobInfo.Builder(ID, new ComponentName(c, SyncJobService.class))
              .setPeriodic(15 * 60 * 1000L)
              .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
              .setPersisted(true)
              .build());
  }

  static void cancel(Context c) {
    c.getSystemService(JobScheduler.class).cancel(ID);
  }

  @Override
  public boolean onStartJob(JobParameters params) {
    WORK.execute(
        () -> {
          boolean retry = false;
          try {
            MedicationSync.sync(this);
          } catch (Api.Failure e) {
            if (e.status == 401 || e.status == 403) {
              Reminders.clear(this);
              cancel(this);
            } else retry = true;
          } catch (Exception e) {
            retry = true;
          }
          jobFinished(params, retry);
        });
    return true;
  }

  @Override
  public boolean onStopJob(JobParameters params) {
    return true;
  }
}
