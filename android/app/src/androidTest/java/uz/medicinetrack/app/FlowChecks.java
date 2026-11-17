package uz.medicinetrack.app;

import android.app.*;
import android.content.*;
import android.graphics.Bitmap;
import android.os.*;
import android.view.*;
import android.widget.*;
import java.io.*;
import java.time.Instant;
import org.json.*;

/** Runs against a seeded local backend; all patients must be synthetic. */
public final class FlowChecks extends Instrumentation {
  Bundle args;
  MainActivity activity;
  int checks = 0;

  @Override
  public void onCreate(Bundle values) {
    args = values;
    start();
  }

  void check(boolean valid, String detail) {
    if (!valid) throw new AssertionError(detail);
    checks++;
  }

  void ui(Runnable r) {
    runOnMainSync(r);
  }

  void idle() throws Exception {
    for (int i = 0; i < 200; i++) {
      Thread.sleep(100);
      boolean[] busy = {true};
      ui(() -> busy[0] = activity.busy);
      if (!busy[0]) {
        waitForIdleSync();
        return;
      }
    }
    throw new AssertionError("UI request timeout");
  }

  boolean contains(View view, String text) {
    if (view instanceof TextView && ((TextView) view).getText().toString().contains(text))
      return true;
    if (view instanceof ViewGroup) {
      ViewGroup group = (ViewGroup) view;
      for (int i = 0; i < group.getChildCount(); i++)
        if (contains(group.getChildAt(i), text)) return true;
    }
    return false;
  }

  void visible(String text) {
    boolean[] ok = {false};
    ui(() -> ok[0] = contains(activity.root, text));
    check(ok[0], "Missing screen text: " + text);
  }

  void screenshot(String name) throws Exception {
    Thread.sleep(400);
    Bitmap b = getUiAutomation().takeScreenshot();
    File dir = new File(getTargetContext().getExternalFilesDir(null), "qa");
    dir.mkdirs();
    try (FileOutputStream out = new FileOutputStream(new File(dir, name + ".png"))) {
      b.compress(Bitmap.CompressFormat.PNG, 100, out);
    }
  }

  @Override
  public void onStart() {
    Bundle report = new Bundle();
    try {
      String base = args.getString("base", "http://10.0.2.2:8011/api/v1"),
          password = args.getString("password");
      check(password != null && !password.isEmpty(), "Supply a synthetic demo password");
      Vault vault = new Vault(getTargetContext());
      Reminders.clear(getTargetContext());
      vault.clear();
      activity =
          (MainActivity)
              startActivitySync(
                  new Intent(getTargetContext(), MainActivity.class)
                      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
      idle();
      visible("Parvarish davom etadi.");
      screenshot("01-login");
      Api patient = new Api(vault);
      patient.login(base, "demo.patient", password);
      check(patient.user.getString("role").equals("PATIENT"), "patient login");
      Api restored = new Api(vault);
      restored.restore();
      check(restored.refresh.equals(patient.refresh), "Keystore session roundtrip");
      String patientId = patient.user.getString("patient");
      ui(
          () -> {
            activity.api = patient;
            activity.home();
          });
      visible("Uyda ham yolg‘iz emassiz.");
      screenshot("02-patient-home");
      ui(() -> activity.medications());
      idle();
      visible("Demo dori A");
      check(activity.doses.length() > 0, "Medication occurrences loaded");
      screenshot("03-medications");
      String cache = vault.get("doses");
      check(!cache.isEmpty(), "Medication cache encrypted roundtrip");
      File prefs =
          new File(getTargetContext().getApplicationInfo().dataDir, "shared_prefs/vault.xml");
      String packed =
          new String(
              java.nio.file.Files.readAllBytes(prefs.toPath()),
              java.nio.charset.StandardCharsets.UTF_8);
      check(
          !packed.contains(patient.refresh) && !packed.contains("Demo dori A"),
          "No plaintext token or medication name");
      JSONArray occurrences = activity.doses;
      JSONObject due = null;
      for (int i = 0; i < occurrences.length(); i++) {
        JSONObject d = occurrences.getJSONObject(i);
        if (d.isNull("record")
            && d.isNull("cancelled_at")
            && Instant.parse(d.getString("scheduled_at")).isBefore(Instant.now())) {
          due = d;
          break;
        }
      }
      if (due != null) {
        String time = Instant.now().toString();
        JSONObject payload =
            MainActivity.json(
                "plan_version",
                due.getInt("plan_version"),
                "result",
                "TAKEN",
                "reported_taken_at",
                time,
                "client_recorded_at",
                time,
                "note",
                "Synthetic Android integration check");
        String key = Api.key();
        JSONObject a =
            patient.post("/dose-occurrences/" + due.getString("id") + "/record", payload, key);
        JSONObject b =
            patient.post("/dose-occurrences/" + due.getString("id") + "/record", payload, key);
        check(a.getString("id").equals(b.getString("id")), "Dose retry deduplicated");
      }
      JSONArray freshPlans = patient.list("/patients/" + patientId + "/medication-plans");
      JSONObject freshPlan = freshPlans.getJSONObject(0);
      JSONArray freshDoses =
          patient.list(
              "/medication-plans/"
                  + freshPlan.getString("id")
                  + "/occurrences?plan_version="
                  + freshPlan.getInt("version"));
      for (int i = 0; i < freshDoses.length(); i++) {
        JSONObject d = freshDoses.getJSONObject(i);
        if (d.isNull("record")
            && d.isNull("cancelled_at")
            && Instant.parse(d.getString("scheduled_at")).isBefore(Instant.now())) {
          String time = Instant.now().toString();
          JSONObject entry =
              MainActivity.json(
                  "id",
                  d.getString("id"),
                  "key",
                  Api.key(),
                  "payload",
                  MainActivity.json(
                      "plan_version",
                      d.getInt("plan_version"),
                      "result",
                      "SKIPPED",
                      "reported_taken_at",
                      JSONObject.NULL,
                      "client_recorded_at",
                      time,
                      "note",
                      "Synthetic offline check"));
          vault.put("dose_queue", new JSONArray().put(entry).toString());
          patient.base = "http://127.0.0.1:9/api/v1";
          boolean failed = false;
          try {
            activity.flushQueue();
          } catch (Exception expected) {
            failed = true;
          }
          check(failed && !vault.get("dose_queue").equals("[]"), "Offline dose retained");
          check(!vault.get("session").isEmpty(), "Network error preserves session");
          patient.base = base;
          activity.flushQueue();
          activity.flushQueue();
          check(vault.get("dose_queue").equals("[]"), "Queue sync clears only acknowledged dose");
          break;
        }
      }
      getUiAutomation()
          .executeShellCommand(
              "pm grant uz.medicinetrack.app android.permission.POST_NOTIFICATIONS")
          .close();
      JSONObject reminder =
          MainActivity.json(
              "id",
              "synthetic-reminder-check",
              "scheduled_at",
              Instant.now().plusMillis(1500).toString(),
              "reminder_enabled",
              true,
              "cancelled_at",
              JSONObject.NULL,
              "record",
              JSONObject.NULL);
      Reminders.save(getTargetContext(), new JSONArray().put(reminder));
      boolean delivered = false;
      for (int i = 0; i < 150; i++) {
        Thread.sleep(100);
        if (getTargetContext()
                .getSystemService(NotificationManager.class)
                .getActiveNotifications()
                .length
            > 0) {
          delivered = true;
          break;
        }
      }
      check(delivered, "Actual AlarmManager receiver posts generic notification");
      Reminders.clear(getTargetContext());
      for (int i = 0;
          i < 30
              && getTargetContext()
                      .getSystemService(NotificationManager.class)
                      .getActiveNotifications()
                      .length
                  > 0;
          i++) Thread.sleep(100);
      check(
          getTargetContext()
                  .getSystemService(NotificationManager.class)
                  .getActiveNotifications()
                  .length
              == 0,
          "Notification cleanup");
      JSONArray convs = patient.list("/conversations");
      check(convs.length() > 0, "Patient conversation");
      String id = convs.getJSONObject(0).getString("id");
      ui(() -> activity.chat(id, true));
      idle();
      visible("Yuborish");
      screenshot("04-chat");
      String key = Api.key();
      JSONObject msg =
          MainActivity.json("text", "Sintetik Android tekshiruvi: holatim o‘zgarmadi.");
      JSONObject first = patient.post("/conversations/" + id + "/messages", msg, key),
          again = patient.post("/conversations/" + id + "/messages", msg, key);
      check(first.getString("id").equals(again.getString("id")), "Chat retry deduplicated");
      patient.post(
          "/conversations/" + id + "/status-updates",
          MainActivity.json(
              "self_reported_state",
              "UNCHANGED",
              "note",
              "Sintetik holat qaydi",
              "observed_at",
              Instant.now().toString()),
          Api.key());
      checks++;
      patient.access = "invalid-access-token";
      check(
          patient.get("/me").getString("id").equals(patient.user.getString("id")),
          "Refresh rotation recovers 401");
      Api doctor = new Api(vault);
      doctor.login(base, "demo.doctor", password);
      JSONArray tasks = doctor.list("/tasks");
      check(tasks.length() > 0, "Doctor tasks");
      ui(
          () -> {
            Reminders.clear(activity);
            activity.api = doctor;
            activity.home();
          });
      ui(() -> activity.loadTasks());
      idle();
      visible("Mening chaqiruvlarim");
      screenshot("05-doctor-tasks");
      JSONObject task = tasks.getJSONObject(0);
      for (int i = 0; i < tasks.length(); i++)
        if (tasks.getJSONObject(i).getString("status").equals("NEW")) {
          task = tasks.getJSONObject(i);
          break;
        }
      if (task.getString("status").equals("NEW"))
        task =
            doctor.post(
                "/tasks/" + task.getString("id") + "/accept",
                MainActivity.json("version", task.getInt("version")),
                Api.key());
      String taskId = task.getString("id");
      ui(() -> activity.openTask(taskId));
      idle();
      visible("Bemor holidan xabar olish");
      screenshot("06-task-detail");
      if (task.getString("status").equals("ACCEPTED")) {
        JSONObject result =
            doctor.post(
                "/tasks/" + taskId + "/complete",
                MainActivity.json(
                    "version",
                    task.getInt("version"),
                    "performed_at",
                    Instant.now().toString(),
                    "channel",
                    "PHONE",
                    "observation",
                    "Sintetik sinov kuzatuvi",
                    "actions",
                    "Sintetik aloqa",
                    "follow_up",
                    "Sintetik keyingi reja"),
                Api.key());
        check(result.getString("status").equals("COMPLETED"), "Doctor completes care task");
      }
      check(
          doctor.list("/patients/" + patientId + "/medication-plans").length() > 0,
          "Doctor sees patient medication plans");
      doctor.post(
          "/conversations/" + id + "/messages",
          MainActivity.json("text", "Sintetik shifokor javobi olindi."),
          Api.key());
      checks++;
      Reminders.clear(getTargetContext());
      vault.clear();
      check(vault.get("session").isEmpty(), "Logout local cleanup");
      // Leave the visible emulator signed into the synthetic patient account.
      patient.login(base, "demo.patient", password);
      ui(
          () -> {
            activity.api = patient;
            activity.home();
          });
      screenshot("07-final-home");
      report.putString(
          "stream",
          "PASS: "
              + checks
              + " checks against the actual local backend; patient/doctor UI screenshots saved.\n");
      finish(Activity.RESULT_OK, report);
    } catch (Throwable error) {
      report.putString(
          "stream", "FAIL: " + error.getClass().getSimpleName() + ": " + error.getMessage() + "\n");
      finish(Activity.RESULT_CANCELED, report);
    }
  }
}
