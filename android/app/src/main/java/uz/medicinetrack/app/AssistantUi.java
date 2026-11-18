package uz.medicinetrack.app;

import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.widget.Button;
import android.widget.LinearLayout;
import org.json.*;

/** The demo assistant is always identified separately from the assigned doctor. */
final class AssistantUi {
  final MainActivity m;
  int incidentLimit = 40;

  AssistantUi(MainActivity activity) {
    m = activity;
  }

  static Intent emergencyDialIntent() {
    return new Intent(Intent.ACTION_DIAL, Uri.parse("tel:103"));
  }

  String risk(String code) {
    switch (code) {
      case "EMERGENCY":
        return "Shoshilinch belgi aniqlandi";
      case "DOCTOR_REVIEW":
        return "Shifokor tekshiruvi kerak";
      case "SELF_MONITOR":
        return "Kuzatuvni davom ettiring";
      default:
        return "Qo‘shimcha ma’lumot kerak";
    }
  }

  void call() {
    try {
      m.startActivity(emergencyDialIntent());
    } catch (android.content.ActivityNotFoundException error) {
      m.message("Telefon ilovasi topilmadi. O‘zbekistonda 103 raqamini telefoningizdan tering.");
    }
  }

  void phoneButton(LinearLayout c) {
    Button button = m.danger(c, "O‘zbekiston: 103 ga telefon qilish", this::call);
    button.setTag("emergency-call");
    button.setOnClickListener(v -> call());
  }

  void entry() {
    LinearLayout card = m.card();
    m.badge(card, "Tibbiy jamoa · Chat", "ACTIVE");
    card.addView(m.text("Shifokorlaringizga yozing", 20, MainActivity.INK));
    m.label(
        card,
        "Avval tibbiy jamoa javob beradi. Shifokorlar oflayn bo‘lsa yoki 1 daqiqada javob kelmasa,"
            + " kalitsiz yordamchi ulanadi. Haqiqiy tez yordam avtomatik chaqirilmaydi.");
    m.button(card, "Umumiy chatni ochish", this::open);
    m.secondary(card, "Demo SOS yozuvlari", this::incidents);
  }

  void open() {
    m.execute(
        () -> {
          return m.api.list("/conversations");
        },
        value -> {
          JSONArray rows = (JSONArray) value;
          String id = "";
          int open = 0;
          for (int i = 0; i < rows.length(); i++)
            if (rows.getJSONObject(i).optString("status").equals("OPEN")) {
              id = rows.getJSONObject(i).getString("id");
              open++;
            }
          if (open == 1) m.chat(id, true);
          else m.loadConversations();
        });
  }

  void assessment(JSONObject assessment, String conversation, boolean interactive)
      throws Exception {
    if (assessment == null) return;
    LinearLayout c = m.card();
    c.setBackground(Design.shape(m, 0xffedf4fc, 16, MainActivity.LINE));
    m.badge(c, "AI yordamchi · DEMO", "ACTIVE");
    if (assessment.optString("reply_reason").equals("DOCTORS_OFFLINE"))
      m.label(c, "Shifokorlar oflayn bo‘lgani uchun yordamchi javob berdi.");
    else if (assessment.optString("reply_reason").equals("NO_REPLY_60S"))
      m.label(c, "Shifokorlar 1 daqiqada javob bermagani uchun yordamchi javob berdi.");
    String state = assessment.optString("risk");
    m.badge(
        c,
        risk(state),
        state.equals("EMERGENCY")
            ? "OVERDUE"
            : state.equals("SELF_MONITOR") ? "COMPLETED" : "PENDING");
    JSONObject emergency = assessment.optJSONObject("emergency");
    if (emergency != null) {
      phoneButton(c);
      m.secondary(c, "Demo SOS tafsiloti", () -> incident(emergency.optString("id")))
          .setTag("assistant-emergency:" + emergency.optString("id"));
    }
    c.addView(m.text(assessment.optString("reply"), 16, MainActivity.INK));
    JSONObject question = assessment.optJSONObject("question");
    if (question != null && !question.optString("text").isEmpty()) {
      c.addView(m.text(question.optString("text"), 16, MainActivity.INK));
      JSONArray choices = question.optJSONArray("choices");
      if (!m.doctor() && interactive && choices != null)
        for (int i = 0; i < choices.length(); i++) {
          String choice = choices.getString(i), key = Api.key();
          m.secondary(
              c,
              choice,
              () ->
                  m.execute(
                      () ->
                          m.api.post(
                              "/conversations/" + conversation + "/messages",
                              MainActivity.json(
                                  "text",
                                  choice,
                                  "assistant_response_to",
                                  assessment.optString("id")),
                              key),
                      v -> m.chat(conversation, true)));
        }
    }
    m.label(c, assessment.optString("disclaimer"));
  }

  void incidents() {
    m.execute(
        () -> m.api.list("/assistant/emergencies"),
        value -> {
          m.screen = "SOS ro‘yxati";
          m.frame("Demo SOS yozuvlari", true);
          m.label(
              m.body,
              "Demo hodisalari haqiqiy tez yordam chaqirig‘i emas. Haqiqiy shoshilinch vaziyatda"
                  + " 103 ga telefon qiling.");
          m.secondary(m.body, "Yangilash", this::incidents);
          JSONArray rows = (JSONArray) value;
          if (rows.length() == 0)
            m.empty(
                "SOS yozuvi yo‘q",
                "Xavfli belgi yozilganda demo SOS avtomatik yaratiladi.",
                "shield");
          for (int i = 0; i < Math.min(incidentLimit, rows.length()); i++) {
            JSONObject row = rows.getJSONObject(i);
            LinearLayout c = m.card();
            m.badge(c, "DEMO · Shoshilinch belgi", "OVERDUE");
            c.addView(m.text(row.optString("patient_name"), 20, MainActivity.INK));
            m.label(c, m.when(row.optString("created_at")));
            m.label(
                c,
                row.isNull("acknowledged_at")
                    ? "Tibbiyot xodimi tasdig‘i kutilmoqda"
                    : "Tibbiyot xodimi yozuvni ko‘rgan");
            m.secondary(c, "Demo SOS tafsiloti", () -> incident(row.optString("id")));
          }
          if (rows.length() > incidentLimit)
            m.secondary(
                m.body,
                "Yana 40 ta SOS",
                () -> {
                  incidentLimit += 40;
                  incidents();
                });
        });
  }

  void incident(String id) {
    m.execute(
        () -> m.api.get("/assistant/emergencies/" + id),
        value -> {
          JSONObject row = (JSONObject) value;
          m.screen = "SOS:" + id;
          m.frame("Demo SOS tafsiloti", true);
          m.backAction = this::incidents;
          LinearLayout c = m.card();
          m.badge(c, "DEMO · Haqiqiy tez yordam chaqirilmagan", "OVERDUE");
          c.addView(m.text(row.optString("patient_name"), 22, MainActivity.INK));
          m.label(c, "Namoyish raqami: " + row.optString("reference"));
          m.label(c, row.optString("notice"));
          m.label(c, "Ro‘yxatdagi manzil: " + row.optString("registered_address"));
          phoneButton(c);
          m.label(
              c,
              "Telefon oynasida qo‘ng‘iroqni tasdiqlaysiz. Bu ilova 103 dispetcheriga ulanmagan.");
          JSONObject location = row.optJSONObject("location");
          if (location == null) m.label(c, "Lokatsiya ulashilmagan.");
          else {
            m.badge(
                c,
                location.optString("source").equals("DEMO")
                    ? "Namoyish lokatsiyasi · Sizning GPSingiz emas"
                    : "Bemor roziligi bilan qurilma lokatsiyasi",
                "ACTIVE");
            m.label(c, location.optDouble("latitude") + ", " + location.optDouble("longitude"));
            if (!location.isNull("accuracy_m"))
              m.label(
                  c, "Taxminiy aniqlik: " + Math.round(location.optDouble("accuracy_m")) + " m");
            m.label(c, "Aniqlangan: " + m.when(location.optString("recorded_at")));
            m.secondary(
                c,
                "Xaritada ko‘rish (OpenStreetMap)",
                () -> {
                  Uri uri = Uri.parse(location.optString("map_url"));
                  if ("https".equals(uri.getScheme())
                      && "www.openstreetmap.org".equals(uri.getHost()))
                    try {
                      m.startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (android.content.ActivityNotFoundException e) {
                      m.message("Xarita uchun brauzer topilmadi.");
                    }
                });
          }
          if (!m.doctor()) {
            m.secondary(
                c,
                "Hozirgi lokatsiyamni ulashish",
                () -> {
                  if (m.locationShare == null) m.locationShare = new LocationShare(m);
                  m.locationShare.confirm(id);
                });
            m.secondary(
                c,
                "Demo lokatsiyani ulashish",
                () ->
                    new AlertDialog.Builder(m)
                        .setTitle("Namoyish lokatsiyasi")
                        .setMessage(
                            "Bu haqiqiy GPS emas. Toshkentdagi namoyish nuqtasi demo SOS yozuviga"
                                + " qo‘shiladi va tizimdagi mas’ullarga ko‘rinadi.")
                        .setNegativeButton("Bekor qilish", null)
                        .setPositiveButton(
                            "Demo nuqtani ulashish",
                            (d, w) -> {
                              String key = Api.key();
                              m.execute(
                                  () ->
                                      m.api.post(
                                          "/assistant/emergencies/" + id + "/location",
                                          MainActivity.json("consent", true, "source", "DEMO"),
                                          key),
                                  v -> incident(id));
                            })
                        .show());
            m.label(
                c,
                "Qurilma lokatsiyasi faqat rozilikdan keyin shifokor va hudud koordinatorlariga"
                    + " yuboriladi. U 103 xizmatiga avtomatik uzatilmaydi.");
          } else if (row.isNull("acknowledged_at")) {
            String key = Api.key();
            m.button(
                c,
                "Yozuvni ko‘rdim",
                () ->
                    m.execute(
                        () ->
                            m.api.post(
                                "/assistant/emergencies/" + id + "/acknowledge",
                                new JSONObject(),
                                key),
                        v -> incident(id)));
          }
          LinearLayout timeline = m.card();
          timeline.addView(m.text("Demo hodisalar tarixi", 20, MainActivity.INK));
          JSONArray events = row.getJSONArray("events");
          for (int i = 0; i < events.length(); i++) {
            JSONObject event = events.getJSONObject(i);
            m.label(timeline, m.when(event.optString("created_at")));
            timeline.addView(m.text(event.optString("detail"), 15, MainActivity.INK));
          }
          m.secondary(m.body, "Suhbatni ochish", () -> m.chat(row.optString("conversation"), true));
        });
  }
}
