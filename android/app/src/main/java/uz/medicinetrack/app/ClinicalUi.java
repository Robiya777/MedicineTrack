package uz.medicinetrack.app;

import android.app.AlertDialog;
import android.widget.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import org.json.*;

/** Clinical forms remain server-authorized; no dose or treatment is inferred here. */
final class ClinicalUi {
  final MainActivity m;

  ClinicalUi(MainActivity activity) {
    m = activity;
  }

  void activation() {
    m.screen = "Aktivatsiya";
    m.frame("Bemor hisobini ochish", false);
    LinearLayout c = m.card();
    m.label(c, "Muassasangiz bergan bemor IDsi va bir martalik kodni kiriting.");
    EditText
        base =
            m.field(
                c,
                "API manzili",
                m.getPreferences(0).getString("server", "http://10.0.2.2:8011/api/v1"),
                false),
        id = m.field(c, "Bemor IDsi", "", false),
        code = m.field(c, "Aktivatsiya kodi", "", true),
        password = m.field(c, "Yangi parol", "", true),
        repeat = m.field(c, "Parolni takrorlang", "", true);
    m.button(
        c,
        "Hisobni aktivlashtirish",
        () -> {
          String secret = password.getText().toString();
          if (!secret.equals(repeat.getText().toString())) {
            m.message("Parollar mos emas.");
            return;
          }
          String url = base.getText().toString(),
              patient = id.getText().toString().trim(),
              token = code.getText().toString().trim();
          m.execute(
              () -> {
                Api fresh = new Api(m.vault);
                fresh.configure(url);
                JSONObject user =
                    fresh.post(
                        "/auth/patient-activate",
                        MainActivity.json("patient_id", patient, "code", token, "password", secret),
                        null);
                fresh.login(url, user.getString("username"), secret);
                return fresh;
              },
              v -> {
                m.api = (Api) v;
                password.setText("");
                code.setText("");
                m.getPreferences(0).edit().putString("server", url).apply();
                m.home();
              });
        });
    m.button(c, "Kirishga qaytish", m::loginUI);
  }

  void plans(String patient, String discharge) {
    m.execute(
        () -> m.api.list("/patients/" + patient + "/medication-plans"),
        v -> {
          m.screen = "Jadvallar";
          m.frame("Dori jadvallarini boshqarish", true);
          m.label(
              m.body, "Mavjud shifokor ko‘rsatmasini kiriting. Ilova dori yoki doza tanlamaydi.");
          m.button(m.body, "Yangi jadval loyihasi", () -> edit(patient, discharge, null));
          JSONArray rows = (JSONArray) v;
          for (int i = 0; i < rows.length(); i++) {
            JSONObject p = rows.getJSONObject(i);
            LinearLayout c = m.card();
            m.label(c, m.status(p.optString("status")) + " · Versiya " + p.optInt("version"));
            JSONArray items = p.getJSONArray("items");
            for (int j = 0; j < items.length(); j++) {
              JSONObject item = items.getJSONObject(j);
              c.addView(m.text(item.optString("name"), 20, MainActivity.INK));
              m.label(c, item.optString("prescribed_dose_text") + " · " + item.optString("route"));
              m.label(c, item.optString("start_date") + " — " + item.optString("end_date"));
              m.label(
                  c,
                  item.optJSONArray("local_times").toString() + " · " + item.optString("timezone"));
              m.label(c, "Manba: " + item.optString("source_reference"));
            }
            String state = p.optString("status");
            if (state.equals("DRAFT")) {
              m.button(c, "Loyihani tahrirlash", () -> edit(patient, discharge, p));
              if (m.api.user.optBoolean("can_approve_medication_schedule"))
                m.button(
                    c,
                    "Jadvalni tasdiqlash",
                    () ->
                        new AlertDialog.Builder(m)
                            .setTitle("Klinik jadvalni tasdiqlash")
                            .setMessage(
                                "Har bir dori, doza, vaqt, kurs va manbani tekshirdingizmi?"
                                    + " Tasdiqdan so‘ng bemorga eslatmalar rejalashtiriladi.")
                            .setNegativeButton("Orqaga", null)
                            .setPositiveButton(
                                "Tekshirdim, tasdiqlash",
                                (d, w) ->
                                    m.mutate(
                                        () ->
                                            m.api.post(
                                                "/medication-plans/"
                                                    + p.getString("id")
                                                    + "/approve",
                                                versions(p),
                                                Api.key()),
                                        out -> plans(patient, discharge)))
                            .show());
            }
            if (state.equals("ACTIVE")) {
              m.button(
                  c,
                  "Yangi versiya tayyorlash",
                  () ->
                      m.mutate(
                          () ->
                              m.api.post(
                                  "/medication-plans/" + p.getString("id") + "/revisions",
                                  versions(p),
                                  Api.key()),
                          out -> edit(patient, discharge, (JSONObject) out)));
              m.button(c, "Jadvalni to‘xtatish", () -> stop(p, patient, discharge));
            }
          }
          m.button(m.body, "Qabul tarixini ko‘rish", () -> m.loadMedication(patient));
        });
  }

  JSONObject versions(JSONObject p) throws Exception {
    return MainActivity.json(
        "version", p.getInt("version"), "lock_version", p.getInt("lock_version"));
  }

  void stop(JSONObject plan, String patient, String discharge) {
    LinearLayout box = m.column();
    box.setPadding(m.dp(20), m.dp(12), m.dp(20), 0);
    EditText reason = m.field(box, "To‘xtatish sababi", "", false);
    AlertDialog dialog =
        new AlertDialog.Builder(m)
            .setTitle("Jadvalni to‘xtatish")
            .setView(box)
            .setNegativeButton("Orqaga", null)
            .setPositiveButton("To‘xtatish", null)
            .create();
    dialog.setOnShowListener(
        d ->
            dialog
                .getButton(-1)
                .setOnClickListener(
                    view -> {
                      String r = reason.getText().toString().trim();
                      if (r.isEmpty()) {
                        reason.setError("Sabab majburiy");
                        return;
                      }
                      dialog.dismiss();
                      m.execute(
                          () -> {
                            JSONObject data = versions(plan);
                            data.put("reason", r);
                            return m.api.post(
                                "/medication-plans/" + plan.getString("id") + "/stop",
                                data,
                                Api.key());
                          },
                          v -> plans(patient, discharge));
                    }));
    dialog.show();
  }

  final class ItemForm {
    final EditText name, dose, route, source, start, end, times, zone, note;
    final CheckBox excluded;

    ItemForm(JSONObject item) {
      LinearLayout c = m.card();
      name = m.field(c, "Dori nomi", m.val(item, "name"), false);
      dose = m.field(c, "Shifokor yozgan doza", m.val(item, "prescribed_dose_text"), false);
      route = m.field(c, "Qabul yo‘li", m.val(item, "route"), false);
      source = m.field(c, "Ko‘rsatma manbasi", m.val(item, "source_reference"), false);
      start = m.field(c, "Boshlanish sanasi (YYYY-MM-DD)", m.val(item, "start_date"), false);
      end = m.field(c, "Tugash sanasi (YYYY-MM-DD)", m.val(item, "end_date"), false);
      String hours = "";
      if (item != null) {
        JSONArray a = item.optJSONArray("local_times");
        if (a != null)
          for (int i = 0; i < a.length(); i++) hours += (i > 0 ? ", " : "") + a.optString(i);
      }
      times = m.field(c, "Aniq vaqtlar (08:00, 20:00)", hours, false);
      zone =
          m.field(
              c, "Vaqt zonasi", item == null ? "Asia/Tashkent" : m.val(item, "timezone"), false);
      note = m.field(c, "Qo‘shimcha ko‘rsatma", m.val(item, "instructions"), false);
      excluded = new CheckBox(m);
      excluded.setText("Bu dorini saqlanadigan jadvaldan chiqarish");
      c.addView(excluded);
    }

    JSONObject data() throws Exception {
      JSONArray hours = new JSONArray();
      for (String t : times.getText().toString().split(",")) {
        String value = t.trim();
        if (!value.isEmpty()) hours.put(value);
      }
      return MainActivity.json(
          "name",
          name.getText().toString(),
          "prescribed_dose_text",
          dose.getText().toString(),
          "route",
          route.getText().toString(),
          "source_reference",
          source.getText().toString(),
          "start_date",
          emptyDate(start),
          "end_date",
          emptyDate(end),
          "timezone",
          zone.getText().toString(),
          "local_times",
          hours,
          "instructions",
          note.getText().toString(),
          "needs_clarification",
          false);
    }

    Object emptyDate(EditText e) {
      return e.length() == 0 ? JSONObject.NULL : e.getText().toString();
    }
  }

  void edit(String patient, String discharge, JSONObject plan) {
    m.screen =
        "Jadval formasi:"
            + patient
            + ":"
            + (plan == null ? "new" : plan.optString("id") + ":" + plan.optInt("lock_version"));
    m.frame("Ko‘rsatmadan jadval tuzish", true);
    m.label(
        m.body,
        "Faqat belgilangan vaqtdagi qabul. Noaniq ko‘rsatmani taxmin qilmang; shifokor bilan"
            + " aniqlashtiring.");
    ArrayList<ItemForm> forms = new ArrayList<>();
    JSONArray items = plan == null ? new JSONArray() : plan.optJSONArray("items");
    if (items != null)
      for (int i = 0; i < items.length(); i++) forms.add(new ItemForm(items.optJSONObject(i)));
    if (forms.isEmpty()) forms.add(new ItemForm(null));
    int savedCount = Math.min(20, m.restoredFields.length() / 9);
    while (forms.size() < savedCount) forms.add(new ItemForm(null));
    LinearLayout actions = m.card();
    m.button(
        actions,
        "Yana dori qo‘shish",
        () -> {
          if (forms.size() >= 20) {
            m.message("Bir jadvalda ko‘pi bilan 20 dori.");
            return;
          }
          forms.add(new ItemForm(null));
        });
    String key = Api.key();
    m.button(
        actions,
        "Loyihani saqlash",
        () -> {
          try {
            JSONArray result = new JSONArray();
            for (ItemForm f : forms) if (!f.excluded.isChecked()) result.put(f.data());
            if (result.length() == 0) {
              m.message("Kamida bitta dori qoldiring yoki butun jadvalni to‘xtating.");
              return;
            }
            JSONObject payload =
                plan == null
                    ? MainActivity.json("discharge_id", discharge, "items", result)
                    : versions(plan).put("items", result);
            m.mutate(
                () ->
                    plan == null
                        ? m.api.post("/patients/" + patient + "/medication-plans", payload, key)
                        : m.api.call(
                            "PATCH", "/medication-plans/" + plan.getString("id"), payload, key),
                v -> plans(patient, discharge));
          } catch (Exception e) {
            m.message("Maydonlarni tekshiring.");
          }
        });
    m.button(actions, "Jadvallarga qaytish", () -> plans(patient, discharge));
  }

  void correction(JSONObject dose, String patient) {
    try {
      JSONObject record = dose.getJSONObject("record");
      m.screen = "Qayd tuzatish:" + dose.optString("id") + ":" + record.optInt("version");
      m.frame("Dori qaydini tuzatish", true);
      LinearLayout c = m.card();
      m.label(c, "Oldingi qayd tarixda qoladi. Tuzatish sababini yozing.");
      Spinner result = m.spinner(c, new String[] {"Ichdim", "O‘tkazib yubordim"});
      if (record.optString("result").equals("SKIPPED")) result.setSelection(1);
      String initial = m.val(record, "reported_taken_at");
      String local =
          initial.isEmpty()
              ? ""
              : Instant.parse(initial)
                  .atZone(ZoneId.of("Asia/Tashkent"))
                  .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
      EditText time = m.field(c, "Ichilgan vaqt (YYYY-MM-DD HH:mm, Toshkent)", local, false),
          note = m.field(c, "Izoh", record.optString("note"), false),
          reason = m.field(c, "Tuzatish sababi", "", false);
      String key = Api.key();
      m.button(
          c,
          "Tuzatishni saqlash",
          () -> {
            try {
              String state = result.getSelectedItemPosition() == 0 ? "TAKEN" : "SKIPPED";
              Object taken =
                  state.equals("TAKEN")
                      ? LocalDateTime.parse(
                              time.getText().toString().trim(),
                              DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                          .atZone(ZoneId.of("Asia/Tashkent"))
                          .toInstant()
                          .toString()
                      : JSONObject.NULL;
              JSONObject payload =
                  MainActivity.json(
                      "version",
                      record.getInt("version"),
                      "plan_version",
                      dose.getInt("plan_version"),
                      "result",
                      state,
                      "reported_taken_at",
                      taken,
                      "client_recorded_at",
                      m.now(),
                      "note",
                      note.getText().toString(),
                      "reason",
                      reason.getText().toString());
              m.mutate(
                  () ->
                      m.api.post(
                          "/dose-records/" + record.getString("id") + "/corrections", payload, key),
                  v -> m.loadMedication(patient));
            } catch (Exception e) {
              m.message("Vaqtni YYYY-MM-DD HH:mm shaklida kiriting.");
            }
          });
    } catch (Exception e) {
      m.message("Qayd topilmadi. Jadvalni yangilang.");
    }
  }

  void queue() {
    m.execute(
        () -> {
          String value = m.vault.get("dose_queue");
          return value.isEmpty() ? new JSONArray() : new JSONArray(value);
        },
        v -> {
          JSONArray rows = (JSONArray) v;
          m.screen = "Navbat";
          m.frame("Yuborilmagan qaydlar", true);
          m.label(
              m.body,
              "Qayd server tasdiqlamaguncha shu qurilmada qoladi. Tashlab yuborish serverdagi"
                  + " tarixni o‘chirmaydi.");
          if (rows.length() == 0) m.label(m.body, "Barcha qaydlar yuborilgan.");
          m.button(
              m.body,
              "Qayta sinxronlash",
              () ->
                  m.execute(
                      () -> {
                        m.flushQueue();
                        return true;
                      },
                      out -> queue()));
          for (int i = 0; i < rows.length(); i++) {
            JSONObject entry = rows.getJSONObject(i);
            LinearLayout c = m.card();
            m.label(c, m.status(entry.getJSONObject("payload").optString("result")));
            m.label(
                c,
                "Qayd vaqti: "
                    + m.when(entry.getJSONObject("payload").optString("client_recorded_at")));
            m.label(c, entry.optString("error", "Server tasdig‘i kutilmoqda"));
            m.button(
                c,
                "Qaydni qurilmadan olib tashlash",
                () ->
                    new AlertDialog.Builder(m)
                        .setTitle("Yuborilmagan qaydni olib tashlash?")
                        .setMessage("Bu qayd qayta yuborilmaydi. Serverdagi ma’lumot o‘zgarmaydi.")
                        .setNegativeButton("Qolish", null)
                        .setPositiveButton(
                            "Olib tashlash",
                            (d, w) ->
                                m.execute(
                                    () -> {
                                      String saved = m.vault.get("dose_queue");
                                      JSONArray
                                          all =
                                              saved.isEmpty()
                                                  ? new JSONArray()
                                                  : new JSONArray(saved),
                                          kept = new JSONArray();
                                      for (int j = 0; j < all.length(); j++)
                                        if (!all.getJSONObject(j)
                                            .getString("id")
                                            .equals(entry.getString("id"))) kept.put(all.get(j));
                                      m.vault.put("dose_queue", kept.toString());
                                      return true;
                                    },
                                    out -> queue()))
                        .show());
          }
        });
  }

  void notifications() {
    m.execute(
        () -> m.api.list("/notifications"),
        v -> {
          m.screen = "Bildirishnomalar";
          m.frame("Bildirishnomalar", true);
          JSONArray rows = (JSONArray) v;
          if (rows.length() == 0) m.label(m.body, "Yangi bildirishnoma yo‘q.");
          for (int i = 0; i < rows.length(); i++) {
            JSONObject n = rows.getJSONObject(i);
            LinearLayout c = m.card();
            String kind = n.optString("event_type");
            String label =
                kind.contains("OVERDUE") || kind.contains("ESCALAT")
                    ? "Javob muddati o‘tgan"
                    : kind.contains("REMIND")
                        ? "Eslatma"
                        : kind.contains("MESSAGE")
                            ? "Yangi xabar"
                            : kind.contains("ASSIGN") || kind.contains("CREAT")
                                ? "Yangi topshiriq"
                                : kind.contains("WORSEN")
                                    ? "Bemor holati bo‘yicha xabar"
                                    : "Parvarish bo‘yicha yangilik";
            c.addView(m.text(label, 20, MainActivity.INK));
            m.label(
                c,
                m.when(n.optString("created_at"))
                    + (n.isNull("read_at") ? " · O‘qilmagan" : " · Ko‘rilgan"));
            m.button(
                c,
                "Ochish",
                () ->
                    m.mutate(
                        () ->
                            m.api.post(
                                "/notifications/" + n.getString("id") + "/read",
                                new JSONObject(),
                                Api.key()),
                        out -> {
                          if (!n.isNull("task") && m.doctor()) m.openTask(n.getString("task"));
                          else if (!n.isNull("conversation"))
                            m.chat(n.getString("conversation"), true);
                          else notifications();
                        }));
          }
          m.button(m.body, "Yangilash", this::notifications);
        });
  }

  void reportCorrection(JSONObject task) {
    m.screen = "Hisobotni tuzatish:" + task.optString("id");
    m.frame("Tashrif natijasini tuzatish", true);
    LinearLayout c = m.card();
    Spinner field = m.spinner(c, new String[] {"Kuzatuv", "Bajarilgan ishlar", "Keyingi reja"});
    EditText text = m.field(c, "Tuzatilgan matn", "", false),
        reason = m.field(c, "Tuzatish sababi", "", false);
    m.label(c, "Original hisobot tarixda saqlanadi. Vaqt va task holati o‘zgarmaydi.");
    String key = Api.key();
    m.button(
        c,
        "Tuzatishni yuborish",
        () -> {
          String
              chosen =
                  new String[] {"observation", "actions", "follow_up"}
                      [field.getSelectedItemPosition()],
              value = text.getText().toString(),
              why = reason.getText().toString();
          m.mutate(
              () ->
                  m.api.post(
                      "/tasks/" + task.getString("id") + "/report-corrections",
                      MainActivity.json("field", chosen, "correction_text", value, "reason", why),
                      key),
              v -> m.openTask(task.getString("id")));
        });
  }
}
