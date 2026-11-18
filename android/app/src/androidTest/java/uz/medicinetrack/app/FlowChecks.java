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

  android.view.View find(android.view.View root, String text) {
    if (root instanceof android.widget.Button
        && ((android.widget.Button) root).getText().toString().equals(text)) return root;
    if (root instanceof android.view.ViewGroup) {
      android.view.ViewGroup group = (android.view.ViewGroup) root;
      for (int i = 0; i < group.getChildCount(); i++) {
        android.view.View found = find(group.getChildAt(i), text);
        if (found != null) return found;
      }
    }
    return null;
  }

  void click(String text) {
    ui(
        () -> {
          android.view.View v = find(activity.root, text);
          if (v == null) throw new AssertionError("Button missing: " + text);
          v.performClick();
        });
  }

  void fields(android.view.View root, java.util.List<android.widget.EditText> result) {
    if (root instanceof android.widget.EditText) result.add((android.widget.EditText) root);
    if (root instanceof android.view.ViewGroup) {
      android.view.ViewGroup group = (android.view.ViewGroup) root;
      for (int i = 0; i < group.getChildCount(); i++) fields(group.getChildAt(i), result);
    }
  }

  View described(View root, String description) {
    if (description.equals(String.valueOf(root.getContentDescription()))) return root;
    if (root instanceof ViewGroup) {
      ViewGroup group = (ViewGroup) root;
      for (int i = 0; i < group.getChildCount(); i++) {
        View result = described(group.getChildAt(i), description);
        if (result != null) return result;
      }
    }
    return null;
  }

  void setField(String name, String value) {
    ui(
        () -> {
          View field = described(activity.root, name);
          if (!(field instanceof EditText)) throw new AssertionError("Field missing: " + name);
          ((EditText) field).setText(value);
        });
  }

  void navSelected(String name) throws Exception {
    Thread.sleep(150);
    waitForIdleSync();
    ui(
        () -> {
          View tab = described(activity.root, name);
          check(tab != null && tab.isSelected(), "Active bottom navigation: " + name);
          check(tab.getHeight() >= activity.dp(44), "Navigation touch target: " + name);
          if (tab instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) tab;
            for (int i = 0; i < group.getChildCount(); i++) {
              View child = group.getChildAt(i);
              if (child instanceof TextView) {
                TextView label = (TextView) child;
                check(
                    label.getLayout() != null
                        && label.getLayout().getLineWidth(0) <= label.getWidth() + 1,
                    "Navigation label fits: " + name);
              }
            }
          }
        });
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

  void layoutScreens(Api patient, Vault vault, String base, String password) throws Exception {
    ui(() -> activity.medications());
    idle();
    navSelected("Dorilar");
    check(activity.doses.length() > 0, "Medication rows loaded for compact layout");
    screenshot("layout-medications");
    JSONArray conversations = patient.list("/conversations");
    check(conversations.length() > 0, "Conversation available for keyboard layout");
    ui(() -> activity.chat(conversations.optJSONObject(0).optString("id"), false));
    idle();
    navSelected("Suhbatlar");
    ui(
        () -> {
          activity.chatInput.requestFocus();
          ((android.view.inputmethod.InputMethodManager)
                  activity.getSystemService(Context.INPUT_METHOD_SERVICE))
              .showSoftInput(
                  activity.chatInput, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT);
        });
    Thread.sleep(1200);
    waitForIdleSync();
    ui(
        () -> {
          View tab = described(activity.root, "Suhbatlar");
          check(tab != null && !tab.isShown(), "Keyboard leaves room for the message composer");
          android.graphics.Rect visible = new android.graphics.Rect();
          check(
              activity.chatInput.getGlobalVisibleRect(visible)
                  && visible.height() >= activity.dp(44),
              "Message input remains visible above keyboard");
        });
    screenshot("layout-keyboard");
    ui(
        () ->
            ((android.view.inputmethod.InputMethodManager)
                    activity.getSystemService(Context.INPUT_METHOD_SERVICE))
                .hideSoftInputFromWindow(activity.chatInput.getWindowToken(), 0));
    Thread.sleep(400);
    ui(() -> activity.account());
    navSelected("Hisob");
    screenshot("layout-account");
    Reminders.clear(getTargetContext());
    Api doctor = new Api(vault);
    doctor.login(base, args.getString("doctorUser", "demo.doctor"), password);
    ui(
        () -> {
          activity.api = doctor;
          activity.home();
        });
    ui(() -> activity.loadTasks());
    idle();
    navSelected("Chaqiruvlar");
    screenshot("layout-doctor-tasks");
    JSONArray tasks = doctor.list("/tasks");
    check(tasks.length() > 0, "Doctor tasks available for compact layout");
    ui(() -> activity.openTask(tasks.optJSONObject(0).optString("id")));
    idle();
    screenshot("layout-task-detail");
    patient.login(base, args.getString("patientUser", "demo.patient"), password);
    ui(
        () -> {
          activity.api = patient;
          activity.home();
        });
    navSelected("Asosiy");
    screenshot("layout-home");
  }

  @Override
  public void onStart() {
    Bundle report = new Bundle();
    try {
      String base = args.getString("base", MainActivity.DEFAULT_API),
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
      visible("Kabinetga kirish");
      screenshot("01-login");
      click("Kirish");
      ui(
          () ->
              check(
                  ((EditText) described(activity.root, "Login")).getError() != null,
                  "Empty login has a field error"));
      click("Server sozlamalari");
      setField("API manzili", base);
      click("Server sozlamalari");
      setField("Login", args.getString("patientUser", "demo.patient"));
      setField("Parol", password);
      ui(
          () -> {
            EditText secret = (EditText) described(activity.root, "Parol");
            described(activity.root, "Parolni ko‘rsatish").performClick();
            check(secret.getTransformationMethod() == null, "Show password");
            described(activity.root, "Parolni yashirish").performClick();
            check(secret.getTransformationMethod() != null, "Hide password");
          });
      click("Kirish");
      idle();
      Api patient = activity.api;
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
      navSelected("Asosiy");
      screenshot("02-patient-home");
      if (args.getString("mode", "full").equals("assistant")) {
        assistantScreens(patient, vault, base, password);
        report.putString(
            "stream",
            "PASS: " + checks + " assistant, demo SOS, consent and device location checks.\n");
        finish(Activity.RESULT_OK, report);
        return;
      }
      if (args.getString("mode", "full").equals("layout")) {
        layoutScreens(patient, vault, base, password);
        report.putString(
            "stream", "PASS: " + checks + " compact layout, navigation and keyboard checks.\n");
        finish(Activity.RESULT_OK, report);
        return;
      }
      ui(() -> activity.medications());
      idle();
      visible("Demo dori A");
      navSelected("Dorilar");
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
      JSONArray doseHistory = patient.list("/patients/" + patientId + "/medication-history");
      for (int i = 0; i < doseHistory.length(); i++) {
        JSONObject occurrence = doseHistory.getJSONObject(i),
            r = occurrence.optJSONObject("record");
        if (r == null || !r.optString("result").equals("TAKEN")) continue;
        String original = r.getString("reported_taken_at");
        ui(() -> new ClinicalUi(activity).correction(occurrence, patientId));
        setField("Izoh", "Faqat izoh tuzatildi");
        setField("Tuzatish sababi", "Sintetik aniqlashtirish");
        click("Tuzatishni saqlash");
        idle();
        JSONArray updated = patient.list("/patients/" + patientId + "/medication-history");
        for (int j = 0; j < updated.length(); j++) {
          JSONObject u = updated.getJSONObject(j);
          if (u.getString("id").equals(occurrence.getString("id"))) {
            check(
                Instant.parse(u.getJSONObject("record").getString("reported_taken_at"))
                    .equals(Instant.parse(original)),
                "Note correction preserves exact intake timestamp");
            check(
                u.getJSONObject("record").getInt("version") == r.getInt("version") + 1,
                "Native correction reaches backend");
          }
        }
        break;
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
      navSelected("Suhbatlar");
      screenshot("04-chat");
      ui(() -> activity.onBackPressed());
      idle();
      visible("Suhbatlar");
      navSelected("Suhbatlar");
      ui(() -> activity.account());
      click("Bildirishnomalar");
      idle();
      visible("Bildirishnomalar");
      navSelected("Hisob");
      screenshot("13-notifications");
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
      navSelected("Chaqiruvlar");
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
      JSONObject completedTask = doctor.get("/tasks/" + taskId);
      if (!completedTask.isNull("report")) {
        ui(() -> new ClinicalUi(activity).reportCorrection(completedTask));
        ui(
            () -> {
              java.util.ArrayList<EditText> input = new java.util.ArrayList<>();
              fields(activity.root, input);
              input.get(0).setText("Android hisobot tuzatishi");
              input.get(1).setText("Sintetik sabab");
            });
        click("Tuzatishni yuborish");
        idle();
        visible("Android hisobot tuzatishi");
      }
      String discharge =
          doctor
              .list("/patients/" + patientId + "/medication-plans")
              .getJSONObject(0)
              .getString("discharge");
      doctor.post(
          "/patients/" + patientId + "/medication-plans",
          MainActivity.json(
              "discharge_id",
              discharge,
              "items",
              new JSONArray()
                  .put(
                      MainActivity.json(
                          "name",
                          JSONObject.NULL,
                          "prescribed_dose_text",
                          JSONObject.NULL,
                          "route",
                          JSONObject.NULL,
                          "needs_clarification",
                          true,
                          "local_times",
                          new JSONArray()))),
          Api.key());
      ui(() -> new ClinicalUi(activity).plans(patientId, discharge));
      idle();
      visible("Dori nomi aniqlashtirilmagan");
      screenshot("09-nullable-draft");
      ui(() -> new ClinicalUi(activity).edit(patientId, discharge, null));
      ui(
          () -> {
            java.util.ArrayList<EditText> input = new java.util.ArrayList<>();
            fields(activity.root, input);
            input.get(0).setText("Sintetik jadval chernovigi");
            activity.saveFormDraft();
            activity.home();
          });
      ui(() -> new ClinicalUi(activity).edit(patientId, discharge, null));
      visible("Sintetik jadval chernovigi");
      String day = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Tashkent")).toString();
      ui(
          () -> {
            java.util.ArrayList<EditText> input = new java.util.ArrayList<>();
            fields(activity.root, input);
            String[] values = {
              "Android sinov dori",
              "Sintetik doza",
              "Sintetik yo‘l",
              "Sintetik epikriz",
              day,
              day,
              "08:00, 20:00",
              "Asia/Tashkent",
              "Sintetik ko‘rsatma"
            };
            for (int i = 0; i < values.length; i++) input.get(i).setText(values[i]);
          });
      click("Loyihani saqlash");
      idle();
      visible("Dori jadvallarini boshqarish");
      visible("Android sinov dori");
      JSONArray newPlans = doctor.list("/patients/" + patientId + "/medication-plans");
      JSONObject draft = newPlans.getJSONObject(0);
      check(draft.getString("status").equals("DRAFT"), "Plan form creates server draft");
      JSONObject active =
          doctor.post(
              "/medication-plans/" + draft.getString("id") + "/approve",
              MainActivity.json(
                  "version", draft.getInt("version"), "lock_version", draft.getInt("lock_version")),
              Api.key());
      check(active.getString("status").equals("ACTIVE"), "Clinical plan approval");
      JSONObject revision =
          doctor.post(
              "/medication-plans/" + active.getString("id") + "/revisions",
              MainActivity.json(
                  "version",
                  active.getInt("version"),
                  "lock_version",
                  active.getInt("lock_version")),
              Api.key());
      check(
          revision.getInt("version") == 2
              && doctor
                  .get("/medication-plans/" + active.getString("id"))
                  .getString("status")
                  .equals("ACTIVE"),
          "Revision leaves active plan until approval");
      ui(() -> new ClinicalUi(activity).edit(patientId, discharge, revision));
      visible("Loyihani saqlash");
      screenshot("08-plan-form");
      JSONObject revised =
          doctor.post(
              "/medication-plans/" + revision.getString("id") + "/approve",
              MainActivity.json(
                  "version",
                  revision.getInt("version"),
                  "lock_version",
                  revision.getInt("lock_version")),
              Api.key());
      JSONObject stopped =
          doctor.post(
              "/medication-plans/" + revised.getString("id") + "/stop",
              MainActivity.json(
                  "version",
                  revised.getInt("version"),
                  "lock_version",
                  revised.getInt("lock_version"),
                  "reason",
                  "Synthetic Android test"),
              Api.key());
      check(stopped.getString("status").equals("STOPPED"), "Plan stop");
      ui(
          () -> {
            activity.api = patient;
            new ClinicalUi(activity).queue();
          });
      idle();
      visible("Yuborilmagan qaydlar");
      JSONArray history = patient.list("/patients/" + patientId + "/medication-history");
      JSONObject recorded = null;
      for (int i = 0; i < history.length(); i++)
        if (!history.getJSONObject(i).isNull("record")) {
          recorded = history.getJSONObject(i);
          break;
        }
      check(recorded != null, "Patient history includes dose record");
      if (recorded != null) {
        JSONObject dose = recorded;
        ui(() -> new ClinicalUi(activity).correction(dose, patientId));
        visible("Tuzatishni saqlash");
        JSONObject r = dose.getJSONObject("record");
        JSONObject correction =
            MainActivity.json(
                "version",
                r.getInt("version"),
                "plan_version",
                dose.getInt("plan_version"),
                "result",
                "SKIPPED",
                "reported_taken_at",
                JSONObject.NULL,
                "client_recorded_at",
                Instant.now().toString(),
                "note",
                "Sintetik tuzatish",
                "reason",
                "Sintetik tekshiruv");
        JSONObject corrected =
            patient.post(
                "/dose-records/" + r.getString("id") + "/corrections", correction, Api.key());
        check(corrected.getInt("version") == r.getInt("version") + 1, "Dose correction version");
      }
      // Staff issues a one-use activation code; the patient-facing form performs activation.
      Api staff = new Api(vault);
      staff.configure(base);
      JSONObject staffTokens =
          staff.post(
              "/auth/login",
              MainActivity.json(
                  "username", "demo.hospital", "password", password, "client", "android"),
              null);
      staff.access = staffTokens.getString("access");
      staff.refresh = staffTokens.getString("refresh");
      staff.user = staffTokens.getJSONObject("user");
      String territory = staff.list("/reference/territories").getJSONObject(0).getString("id");
      JSONObject newPatient =
          staff.post(
              "/patients",
              MainActivity.json(
                  "full_name",
                  "Synthetic Android Activation",
                  "birth_date",
                  "2000-01-01",
                  "address",
                  "Synthetic demo address",
                  "territory",
                  territory,
                  "contact",
                  "+998900000000"),
              Api.key());
      JSONObject code =
          staff.post(
              "/patients/" + newPatient.getString("id") + "/activation",
              MainActivity.json("phone_verified", true),
              null);
      ui(() -> new ClinicalUi(activity).activation());
      setField("API manzili", base);
      setField("Bemor IDsi", newPatient.optString("id"));
      setField("Aktivatsiya kodi", code.optString("code"));
      setField("Yangi parol", password);
      setField("Parolni takrorlang", password);
      click("Hisobni aktivlashtirish");
      idle();
      visible("Uyda ham yolg‘iz emassiz.");
      check(
          activity.api.user.optString("patient").equals(newPatient.getString("id")),
          "Activation form creates patient session");
      ui(
          () -> {
            activity.api = doctor;
            activity.home();
          });
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
      ui(
          () ->
              activity.execute(
                  () -> {
                    MedicationSync.sync(activity);
                    return true;
                  },
                  v -> activity.home()));
      idle();
      check(!vault.get("doses").isEmpty(), "Background-sync repository restores patient reminders");
      check(
          getTargetContext()
                  .getSystemService(android.app.job.JobScheduler.class)
                  .getPendingJob(SyncJobService.ID)
              != null,
          "Periodic network sync job registered");
      ui(() -> activity.chat(id, true));
      idle();
      ui(
          () -> {
            if (activity.chatInput != null)
              activity.chatInput.setText("Sintetik saqlangan chernovik");
            activity.saveChatDraft();
            activity.home();
          });
      ui(() -> activity.chat(id, true));
      idle();
      visible("Sintetik saqlangan chernovik");
      ui(
          () -> {
            activity.clearChatDraft();
            activity.home();
          });
      long eight = Instant.parse("2026-11-18T03:00:00Z").toEpochMilli();
      check(AlarmAlerts.nextHealth(eight) == eight + 3 * 3600000L, "08:00 advances to 11:00");
      long twenty = Instant.parse("2026-11-18T15:00:00Z").toEpochMilli();
      check(
          AlarmAlerts.nextHealth(twenty) == twenty + 12 * 3600000L,
          "20:00 advances to next morning 08:00");
      android.content.SharedPreferences alarmPrefs =
          getTargetContext().getSharedPreferences("alarms", 0);
      alarmPrefs.edit().putBoolean("health", true).remove("health_due").commit();
      AlarmAlerts.scheduleHealth(getTargetContext());
      check(alarmPrefs.getLong("health_due", 0) > System.currentTimeMillis(), "Health alarm armed");
      AlarmAlerts.snooze(getTargetContext(), AlarmAlerts.HEALTH);
      long snoozed = alarmPrefs.getLong("health_due", 0);
      AlarmAlerts.scheduleHealth(getTargetContext());
      check(alarmPrefs.getLong("health_due", 0) == snoozed, "Health snooze survives resume/rearm");
      alarmPrefs.edit().putBoolean("health", false).commit();
      AlarmAlerts.scheduleHealth(getTargetContext());
      check(
          !alarmPrefs.contains("health_due"), "Disabled health reminder clears pending timestamp");
      alarmPrefs.edit().putBoolean("health", true).commit();
      AlarmAlerts.scheduleHealth(getTargetContext());
      // Execute the actual health receiver through a short synthetic AlarmManager trigger.
      AlarmAlerts.arm(getTargetContext(), AlarmAlerts.HEALTH, System.currentTimeMillis() + 1500);
      boolean healthDelivered = false;
      for (int n = 0; n < 150; n++) {
        Thread.sleep(100);
        for (android.service.notification.StatusBarNotification notification :
            getTargetContext()
                .getSystemService(NotificationManager.class)
                .getActiveNotifications()) {
          if (notification.getId() == ("alarm:" + AlarmAlerts.HEALTH).hashCode())
            healthDelivered = true;
        }
        if (healthDelivered) break;
      }
      check(healthDelivered, "Actual health AlarmReceiver delivered an alarm notification");
      AlarmAlerts.dismiss(getTargetContext(), AlarmAlerts.HEALTH);
      // Foreground preview is separate from the real AlarmManager delivery check above.
      Activity alarm =
          startActivitySync(
              new Intent(getTargetContext(), AlarmActivity.class)
                  .putExtra("kind", AlarmAlerts.HEALTH)
                  .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
      Thread.sleep(500);
      screenshot("09-alarm-screen");
      ui(alarm::finish);
      ui(() -> activity.healthReport());
      idle();
      visible("Bugungi holatingiz");
      screenshot("10-health-form");
      ui(() -> activity.home());
      screenshot("07-final-home");
      if (args.containsKey("linkedBase")) {
        JSONObject fixture = new JSONObject(args.getString("linkedFixture"));
        String linkedBase = args.getString("linkedBase"),
            linkedPassword = args.getString("linkedPassword");
        Reminders.clear(getTargetContext());
        vault.clear();
        Api linkedPatient = new Api(vault);
        linkedPatient.login(
            linkedBase,
            fixture.getJSONObject("users").getJSONObject("patient").getString("username"),
            linkedPassword);
        check(
            linkedPatient.user.getString("patient").equals(fixture.getString("patient_id")),
            "Web and Android share the same patient");
        ui(
            () -> {
              activity.api = linkedPatient;
              activity.home();
            });
        ui(() -> activity.medications());
        idle();
        visible("Sintetik QA dori " + fixture.getString("run_id"));
        navSelected("Dorilar");
        screenshot("10-linked-web-medications");
        ui(() -> activity.chat(fixture.optString("conversation_id"), false));
        idle();
        visible("Shifokor bilan suhbat");
        screenshot("11-linked-web-chat");
        Api linkedDoctor = new Api(vault);
        linkedDoctor.login(
            linkedBase,
            fixture.getJSONObject("users").getJSONObject("doctor").getString("username"),
            linkedPassword);
        ui(
            () -> {
              activity.api = linkedDoctor;
              activity.home();
            });
        String linkedTaskId = fixture.optString("web_task_id", fixture.getString("task_id"));
        JSONObject linkedTask = linkedDoctor.get("/tasks/" + linkedTaskId);
        check(
            fixture.has("web_task_id")
                ? linkedTask.getString("status").equals("COMPLETED")
                : linkedTask.getString("id").equals(linkedTaskId),
            "Android reads the task completed by the web UI");
        check(
            linkedTask
                .getJSONObject("patient")
                .getString("id")
                .equals(fixture.optString("web_patient_id", fixture.getString("patient_id"))),
            "Task patient matches the web fixture");
        ui(() -> activity.openTask(linkedTaskId));
        idle();
        visible(linkedTask.getJSONObject("patient").getString("full_name"));
        screenshot("12-linked-web-task");
        ui(() -> activity.loadConversations());
        idle();
        visible(fixture.getString("patient_name"));
        linkedPatient.login(
            linkedBase,
            fixture.getJSONObject("users").getJSONObject("patient").getString("username"),
            linkedPassword);
        ui(
            () -> {
              activity.api = linkedPatient;
              activity.home();
            });
        ui(
            () -> {
              activity.getPreferences(0).edit().putString("server", linkedBase).apply();
              activity.medications();
            });
        idle();
      }
      report.putString(
          "stream",
          "PASS: "
              + checks
              + " checks against the actual local backend; patient/doctor UI screenshots saved.\n");
      finish(Activity.RESULT_OK, report);
    } catch (Throwable error) {
      try {
        screenshot("failed-flow");
      } catch (Exception ignored) {
      }
      report.putString(
          "stream",
          "FAIL: "
              + error.getClass().getSimpleName()
              + ": "
              + error.getMessage()
              + " after "
              + checks
              + " checks.\n");
      finish(Activity.RESULT_CANCELED, report);
    }
  }

  void systemClick(String text) throws Exception {
    for (int attempt = 0; attempt < 40; attempt++) {
      android.view.accessibility.AccessibilityNodeInfo root =
          getUiAutomation().getRootInActiveWindow();
      if (root != null)
        for (android.view.accessibility.AccessibilityNodeInfo node :
            root.findAccessibilityNodeInfosByText(text))
          if (node.isClickable()
              && node.performAction(
                  android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK)) {
            Thread.sleep(250);
            return;
          }
      Thread.sleep(100);
    }
    throw new AssertionError("System dialog button missing: " + text);
  }

  JSONObject lastMessage(Api patient, String conversation) throws Exception {
    JSONArray rows = patient.list("/conversations/" + conversation + "/messages");
    return rows.getJSONObject(rows.length() - 1);
  }

  void typeChat(String text) {
    ui(
        () -> {
          activity.chatInput.requestFocus();
          activity.chatInput.setText(text);
        });
  }

  void assistantScreens(Api patient, Vault vault, String base, String password) throws Exception {
    check(patient.get("/assistant/config").getBoolean("enabled"), "Keyless assistant enabled");
    visible("AI yordamchi · DEMO");
    click("AI yordamchi bilan suhbat");
    idle();
    String conversation = activity.conversationId;
    check(!conversation.isEmpty(), "Assistant entry opens assigned conversation");
    typeChat("Boshim og‘riyapti");
    click("Yuborish");
    idle();
    JSONObject headache = lastMessage(patient, conversation);
    check(
        headache.getJSONObject("assistant").getString("risk").equals("DOCTOR_REVIEW"),
        "Symptom-specific demo reply reaches mobile");
    check(headache.isNull("answered_at"), "AI does not claim a doctor has answered");
    visible("Og‘riq to‘satdan juda kuchli boshlandimi");
    typeChat("Yuborilmagan shaxsiy qoralama");
    click("Yo‘q");
    idle();
    JSONObject follow = lastMessage(patient, conversation).getJSONObject("assistant");
    check(
        follow.getJSONObject("question").getString("key").equals("duration_severity"),
        "Quick answer follows the current assistant question");
    ui(
        () ->
            check(
                activity.chatInput.getText().toString().equals("Yuborilmagan shaxsiy qoralama"),
                "Quick answer preserves unsent composer draft"));
    typeChat("Nafas ololmayapman");
    click("Yuborish");
    idle();
    JSONObject danger = lastMessage(patient, conversation);
    JSONObject incident = danger.getJSONObject("assistant").getJSONObject("emergency");
    String id = incident.getString("id"), path = "/assistant/emergencies/" + id;
    check(
        danger.getJSONObject("assistant").getString("risk").equals("EMERGENCY"),
        "Danger automatically creates an SOS");
    check(
        incident.getBoolean("demo") && incident.getString("state").equals("DEMO_SIMULATED"),
        "SOS is explicitly a simulation");
    check(incident.isNull("location"), "No automatic GPS capture or invented patient coordinates");
    check(
        incident.getJSONArray("events").length() == 3,
        "Demo timeline has detection, simulated call and staff alert");
    Intent dial = AssistantUi.emergencyDialIntent();
    check(
        Intent.ACTION_DIAL.equals(dial.getAction()) && "tel:103".equals(dial.getDataString()),
        "Real emergency action opens a dialer; no automatic call");
    ui(
        () -> {
          activity.working(activity.root, true);
          View phone = described(activity.root, "O‘zbekiston: 103 telefon oynasini ochish");
          check(phone != null && phone.isEnabled(), "103 stays available during a network request");
          activity.working(activity.root, false);
        });
    screenshot("assistant-emergency-chat");
    ui(
        () -> {
          View sos = activity.root.findViewWithTag("assistant-emergency:" + id);
          check(sos != null, "SOS action belongs to the triggering assessment");
          sos.performClick();
        });
    idle();
    visible("DEMO · Haqiqiy tez yordam chaqirilmagan");
    visible("Lokatsiya ulashilmagan.");
    click("Hozirgi lokatsiyamni ulashish");
    systemClick("Bekor qilish");
    check(patient.get(path).isNull("location"), "Cancelling location consent uploads nothing");
    click("Demo lokatsiyani ulashish");
    systemClick("Demo nuqtani ulashish");
    idle();
    check(
        patient.get(path).getJSONObject("location").getString("source").equals("DEMO"),
        "Demo location is saved with a demo source");
    visible("Sizning GPSingiz emas");
    screenshot("assistant-demo-location");
    // Grant foreground permissions, then inject a synthetic GPS fix into the emulator.
    getUiAutomation()
        .grantRuntimePermission(
            getTargetContext().getPackageName(),
            android.Manifest.permission.ACCESS_COARSE_LOCATION);
    getUiAutomation()
        .grantRuntimePermission(
            getTargetContext().getPackageName(), android.Manifest.permission.ACCESS_FINE_LOCATION);
    click("Hozirgi lokatsiyamni ulashish");
    systemClick("Roziman, lokatsiyani ulashish");
    for (int attempt = 0; attempt < 150; attempt++) {
      JSONObject row = patient.get(path).optJSONObject("location");
      if (row != null && row.optString("source").equals("DEVICE")) break;
      Thread.sleep(100);
    }
    idle();
    JSONObject device = patient.get(path).getJSONObject("location");
    check(
        device.getString("source").equals("DEVICE") && device.getBoolean("consented"),
        "Foreground GPS uploads only after explicit confirmation");
    check(
        Math.abs(device.getDouble("latitude") - 41.312345) < .00001,
        "Device GPS is distinct from the fixed demo location");
    visible("Bemor roziligi bilan qurilma lokatsiyasi");
    screenshot("assistant-device-location");
    Api doctor = new Api(vault);
    doctor.login(base, args.getString("doctorUser", "demo.doctor"), password);
    check(
        doctor.get(path).getJSONObject("location").getDouble("latitude")
            == device.getDouble("latitude"),
        "Assigned doctor receives the same consented GPS");
    ui(
        () -> {
          activity.api = doctor;
          new AssistantUi(activity).incident(id);
        });
    idle();
    visible("DEMO · Haqiqiy tez yordam chaqirilmagan");
    click("Yozuvni ko‘rdim");
    idle();
    check(!doctor.get(path).isNull("acknowledged_at"), "Doctor acknowledgement reaches backend");
    check(
        patient.get("/conversations/" + conversation).getString("response_due_at").length() > 0,
        "Staff SOS acknowledgement does not answer the clinical episode");
    doctor.post(
        "/conversations/" + conversation + "/messages",
        MainActivity.json("text", "Sintetik shifokor javobi"),
        Api.key());
    check(
        !lastMessage(patient, conversation).has("assistant")
            || lastMessage(patient, conversation).isNull("assistant"),
        "Doctor reply is separate from demo AI");
    screenshot("assistant-doctor-acknowledged");
    Reminders.clear(getTargetContext());
  }
}
