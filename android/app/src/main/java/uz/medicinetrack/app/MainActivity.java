package uz.medicinetrack.app;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.*;
import android.text.InputType;
import android.view.*;
import android.widget.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.*;
import org.json.*;

public final class MainActivity extends Activity {
  static final int INK = 0xff19312b,
      GREEN = 0xff176b56,
      MUTED = 0xff61756d,
      BG = 0xfff4f7f5,
      LINE = 0xffdce6e0;
  final ExecutorService worker = SyncJobService.WORK;
  final Handler handler = new Handler(Looper.getMainLooper());
  Vault vault;
  Api api;
  LinearLayout root, body;
  TextView feedback;
  String screen = "Kirish", conversationId = "";
  boolean busy = false, paused = true;
  int generation = 0;
  JSONArray doses = new JSONArray();
  String medicationSyncWarning = "";
  EditText chatInput;
  String chatDraftKey = "";
  final Runnable draftSaver =
      () -> {
        saveChatDraft();
        saveFormDraft();
      };

  void saveChatDraft() {
    if (chatInput != null && !api.access.isEmpty() && !chatDraftKey.isEmpty()) {
      String value = chatInput.getText().toString(), key = chatDraftKey;
      try {
        vault.put(key, value);
      } catch (Exception ignored) {
      }
    }
  }

  void clearChatDraft() {
    if (chatInput != null) chatInput.setText("");
    try {
      if (!chatDraftKey.isEmpty()) vault.put(chatDraftKey, "");
    } catch (Exception ignored) {
    }
  }

  interface Job {
    Object run() throws Exception;
  }

  interface Done {
    void run(Object value) throws Exception;
  }

  final Runnable poll =
      new Runnable() {
        public void run() {
          if (!paused
              && screen.equals("Suhbat")
              && !conversationId.isEmpty()
              && !busy
              && !(getCurrentFocus() instanceof EditText)) chat(conversationId, false);
          handler.postDelayed(this, 15000);
        }
      };

  @Override
  public void onCreate(Bundle saved) {
    super.onCreate(saved);
    if (!BuildConfig.DEBUG) getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
    vault = new Vault(this);
    api = new Api(vault);
    loginUI();
    execute(
        () -> {
          api.restore();
          if (!api.access.isEmpty()) {
            try {
              api.user = api.get("/me");
              api.save();
            } catch (java.io.IOException offline) {
              if (offline instanceof Api.Failure) throw offline;
              return true;
            }
          }
          return !api.access.isEmpty();
        },
        v -> {
          if ((boolean) v) {
            if ("Dorilar".equals(getIntent().getStringExtra("screen"))) medications();
            else home();
          }
        });
    handler.postDelayed(poll, 15000);
  }

  @Override
  protected void onResume() {
    super.onResume();
    paused = false;
    SyncJobService.schedule(this);
    if (vault != null && !worker.isShutdown())
      worker.execute(
          () -> {
            try {
              Reminders.schedule(this);
            } catch (Exception ignored) {
            }
          });
  }

  @Override
  protected void onPause() {
    paused = true;
    saveChatDraft();
    saveFormDraft();
    super.onPause();
  }

  @Override
  protected void onDestroy() {
    handler.removeCallbacksAndMessages(null);
    // Shared serial worker also serves the OS medication sync job.
    super.onDestroy();
  }

  @Override
  protected void onNewIntent(Intent i) {
    super.onNewIntent(i);
    if (!api.access.isEmpty() && "Dorilar".equals(i.getStringExtra("screen"))) medications();
  }

  final java.util.LinkedHashMap<String, EditText> draftFields = new java.util.LinkedHashMap<>();
  String activeFormKey = "";
  JSONObject restoredFields = new JSONObject();

  void saveFormDraft() {
    if (activeFormKey.isEmpty() || api.access.isEmpty()) return;
    try {
      JSONObject data = new JSONObject();
      for (java.util.Map.Entry<String, EditText> e : draftFields.entrySet())
        data.put(e.getKey(), e.getValue().getText().toString());
      vault.put(activeFormKey, data.toString());
    } catch (Exception ignored) {
    }
  }

  void clearFormDraft() {
    try {
      if (!activeFormKey.isEmpty()) vault.put(activeFormKey, "");
    } catch (Exception ignored) {
    }
    draftFields.clear();
    activeFormKey = "";
  }

  void mutate(Job job, Done done) {
    execute(
        job,
        v -> {
          clearFormDraft();
          done.run(v);
        });
  }

  void execute(Job job, Done done) {
    if (busy) return;
    busy = true;
    int ticket = generation;
    message("Yuklanmoqda…");
    worker.execute(
        () -> {
          Object result = null;
          Exception error = null;
          try {
            result = job.run();
          } catch (Exception e) {
            error = e;
          }
          Object value = result;
          Exception failure = error;
          handler.post(
              () -> {
                if (isDestroyed() || ticket != generation) return;
                busy = false;
                message("");
                if (failure != null) {
                  if (failure instanceof Api.Failure && ((Api.Failure) failure).status == 401) {
                    SyncJobService.cancel(this);
                    Reminders.clear(this);
                    vault.clear();
                    api.access = "";
                    api.refresh = "";
                    loginUI();
                  }
                  message(
                      failure.getMessage() == null
                          ? "Ulanish xatosi. Qayta urinib ko‘ring."
                          : failure.getMessage());
                  return;
                }
                try {
                  done.run(value);
                } catch (Exception e) {
                  message("Ma’lumotni ko‘rsatib bo‘lmadi. Yangilang.");
                }
              });
        });
  }

  int dp(int v) {
    return Math.round(v * getResources().getDisplayMetrics().density);
  }

  GradientDrawable bg(int color, int radius) {
    GradientDrawable d = new GradientDrawable();
    d.setColor(color);
    d.setCornerRadius(dp(radius));
    return d;
  }

  TextView text(String s, int size, int color) {
    TextView t = new TextView(this);
    t.setText(s);
    t.setTextSize(size);
    t.setTextColor(color);
    t.setPadding(0, dp(4), 0, dp(4));
    return t;
  }

  TextView title(String s) {
    TextView t = text(s, 26, INK);
    t.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
    return t;
  }

  LinearLayout column() {
    LinearLayout l = new LinearLayout(this);
    l.setOrientation(LinearLayout.VERTICAL);
    return l;
  }

  LinearLayout card() {
    LinearLayout c = column();
    c.setPadding(dp(18), dp(14), dp(18), dp(14));
    c.setBackground(bg(Color.WHITE, 18));
    LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
    p.setMargins(0, dp(6), 0, dp(8));
    body.addView(c, p);
    return c;
  }

  void label(LinearLayout c, String s) {
    if (!s.isEmpty()) c.addView(text(s, 14, MUTED));
  }

  Button button(LinearLayout c, String s, Runnable action) {
    Button b = new Button(this);
    b.setText(s);
    b.setTextSize(14);
    b.setAllCaps(false);
    b.setTextColor(Color.WHITE);
    b.setBackground(bg(GREEN, 12));
    LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, dp(48));
    p.setMargins(0, dp(8), 0, dp(4));
    c.addView(b, p);
    b.setOnClickListener(
        v -> {
          if (!busy) action.run();
        });
    return b;
  }

  EditText field(LinearLayout c, String label, String value, boolean password) {
    label(c, label);
    EditText e = new EditText(this);
    String draftId = label + ":" + draftFields.size();
    e.setText(
        !password && !activeFormKey.isEmpty() && restoredFields.has(draftId)
            ? restoredFields.optString(draftId)
            : value);
    if (!password && !activeFormKey.isEmpty()) draftFields.put(draftId, e);
    e.setTextColor(INK);
    e.setTextSize(16);
    e.setPadding(dp(12), dp(8), dp(12), dp(8));
    GradientDrawable d = bg(BG, 10);
    d.setStroke(dp(1), LINE);
    e.setBackground(d);
    e.setMinHeight(dp(48));
    e.setSingleLine(true);
    if (password)
      e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
    e.addTextChangedListener(
        new android.text.TextWatcher() {
          public void beforeTextChanged(CharSequence value, int start, int count, int after) {}

          public void onTextChanged(CharSequence value, int start, int before, int count) {
            handler.removeCallbacks(draftSaver);
            handler.postDelayed(draftSaver, 400);
          }

          public void afterTextChanged(android.text.Editable value) {}
        });
    c.addView(e, new LinearLayout.LayoutParams(-1, -2));
    return e;
  }

  void frame(String heading, boolean navigation) {
    saveFormDraft();
    draftFields.clear();
    activeFormKey = "";
    restoredFields = new JSONObject();
    if (api != null && !api.access.isEmpty() && !screen.equals("Suhbat")) {
      activeFormKey = "form:" + api.user.optString("id") + ":" + screen;
      try {
        String data = vault.get(activeFormKey);
        if (!data.isEmpty()) restoredFields = new JSONObject(data);
      } catch (Exception ignored) {
      }
    }
    saveChatDraft();
    chatInput = null;
    chatDraftKey = "";
    generation++;
    root = column();
    root.setBackgroundColor(BG);
    root.setPadding(dp(20), dp(12), dp(20), dp(8));
    setContentView(root);
    TextView brand = text("＋  MEDICINETRACK", 13, GREEN);
    brand.setLetterSpacing(.12f);
    brand.setTypeface(Typeface.DEFAULT_BOLD);
    root.addView(brand);
    root.addView(title(heading));
    feedback = text("", 13, 0xffa8372d);
    feedback.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
    root.addView(feedback);
    ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    body = column();
    scroll.addView(body);
    root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
    if (navigation) {
      LinearLayout nav = new LinearLayout(this);
      String[] names =
          doctor()
              ? new String[] {"Asosiy", "Chaqiruvlar", "Suhbatlar", "Hisob"}
              : new String[] {"Asosiy", "Dorilar", "Suhbatlar", "Hisob"};
      for (String name : names) {
        TextView t = text(name, 12, GREEN);
        t.setGravity(Gravity.CENTER);
        t.setMinHeight(dp(54));
        t.setTypeface(Typeface.DEFAULT_BOLD);
        nav.addView(t, new LinearLayout.LayoutParams(0, -2, 1));
        t.setOnClickListener(
            v -> {
              if (!busy) navigate(name);
            });
      }
      root.addView(nav);
    }
  }

  boolean doctor() {
    return api.user.optString("role").equals("DOCTOR");
  }

  void message(String s) {
    if (feedback != null) feedback.setText(s);
  }

  String val(JSONObject j, String k) {
    return j == null || j.isNull(k) ? "" : j.optString(k);
  }

  static JSONObject json(Object... pairs) throws JSONException {
    JSONObject j = new JSONObject();
    for (int i = 0; i < pairs.length; i += 2) j.put((String) pairs[i], pairs[i + 1]);
    return j;
  }

  String when(String raw) {
    try {
      return Instant.parse(raw)
          .atZone(ZoneId.of("Asia/Tashkent"))
          .format(DateTimeFormatter.ofPattern("dd.MM, HH:mm"));
    } catch (Exception e) {
      return raw;
    }
  }

  String now() {
    return Instant.now().toString();
  }

  String status(String s) {
    switch (s) {
      case "NEW":
        return "Yangi chaqiruv";
      case "ACCEPTED":
        return "Qabul qilingan";
      case "COMPLETED":
        return "Bajarilgan";
      case "CANCELLED":
        return "Bekor qilingan";
      case "TAKEN":
        return "Ichdim — bemor qaydi";
      case "SKIPPED":
        return "O‘tkazib yuborilgan";
      case "UNRECORDED":
        return "Qayd kiritilmagan";
      case "UPCOMING":
        return "Qabul vaqti kelmagan";
      case "DRAFT":
        return "Loyiha";
      case "STOPPED":
        return "To‘xtatilgan";
      case "OPEN":
        return "Ochiq";
      case "ACTIVE":
        return "Faol";
      case "CLOSED":
        return "Yopilgan";
      case "SENT":
        return "Yuborildi";
      case "READ":
        return "Ko‘rildi";
      case "ANSWERED":
        return "Javob berildi";
      default:
        return s;
    }
  }

  void loginUI() {
    screen = "Kirish";
    frame("Parvarish davom etadi.", false);
    label(body, "Uyga qaytgandan keyin ham shifokoringiz bilan aloqada bo‘ling.");
    LinearLayout c = card();
    label(c, "HISOBINGIZGA KIRING");
    EditText server =
        field(
            c,
            "API manzili",
            getPreferences(0).getString("server", "http://10.0.2.2:8011/api/v1"),
            false);
    server.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
    EditText login = field(c, "Login", "", false), password = field(c, "Parol", "", true);
    button(
        c,
        "Kirish",
        () -> {
          String url = server.getText().toString();
          String name = login.getText().toString().trim(), secret = password.getText().toString();
          execute(
              () -> {
                api.login(url, name, secret);
                return true;
              },
              v -> {
                password.setText("");
                getPreferences(0).edit().putString("server", url).apply();
                home();
              });
        });
    label(body, "Bemor va oilaviy shifokor uchun. Kirish ma’lumotlarini muassasangiz beradi.");
    button(body, "Bemor hisobini aktivlashtirish", () -> new ClinicalUi(this).activation());
    label(body, "Ilova shoshilinch yordam xizmati emas.");
  }

  void navigate(String s) {
    switch (s) {
      case "Asosiy":
        home();
        break;
      case "Chaqiruvlar":
        loadTasks();
        break;
      case "Dorilar":
        medications();
        break;
      case "Suhbatlar":
        loadConversations();
        break;
      case "Hisob":
        account();
        break;
    }
  }

  void home() {
    screen = "Asosiy";
    frame(doctor() ? "Ish kuningiz, bir joyda." : "Bugun o‘zingizni asrang.", true);
    LinearLayout hero = card();
    hero.setBackground(bg(GREEN, 18));
    TextView h =
        text(
            doctor() ? "Har bir chaqiruv ortida — bemor." : "Uyda ham yolg‘iz emassiz.",
            24,
            Color.WHITE);
    h.setTypeface(Typeface.DEFAULT_BOLD);
    hero.addView(h);
    hero.addView(
        text(
            doctor()
                ? "24 soat ichida holidan xabar oling va natijani qayd eting."
                : "Dorilar jadvalini ko‘ring, holatingizni yuboring va shifokorga yozing.",
            15,
            Color.WHITE));
    LinearLayout c = card();
    label(c, doctor() ? "PATRONAJ" : "KUNDALIK PARVARISH");
    c.addView(title(doctor() ? "Mening chaqiruvlarim" : "Dori qabul qilish jadvali"));
    button(
        c,
        doctor() ? "Chaqiruvlarni ochish" : "Dorilarimni ko‘rish",
        () -> {
          if (doctor()) loadTasks();
          else medications();
        });
    LinearLayout chat = card();
    chat.addView(text("Shifokor bilan aloqa", 20, INK));
    label(chat, "Xabar yuborish va holatni qayd etish. Javob ish jadvali bo‘yicha.");
    button(chat, "Suhbatlarni ochish", this::loadConversations);
  }

  void loadTasks() {
    execute(
        () -> api.list("/tasks"),
        v -> {
          JSONArray rows = (JSONArray) v;
          screen = "Chaqiruvlar";
          frame("Mening chaqiruvlarim", true);
          label(body, "Toshkent vaqti · Ro‘yxatni yangilab turing");
          button(body, "Yangilash", this::loadTasks);
          if (rows.length() == 0) label(body, "Hozircha chaqiruv yo‘q.");
          for (int i = 0; i < rows.length(); i++) {
            JSONObject t = rows.getJSONObject(i), p = t.optJSONObject("patient");
            LinearLayout c = card();
            label(
                c,
                (t.optBoolean("overdue") ? "MUDDAT O‘TGAN · " : "")
                    + status(t.optString("status")));
            c.addView(text(val(p, "full_name"), 21, INK));
            label(c, "Muddat: " + when(t.optString("due_at")));
            label(c, val(p, "address"));
            button(c, "Tafsilotlarni ochish", () -> openTask(t.optString("id")));
          }
        });
  }

  void openTask(String id) {
    execute(() -> api.get("/tasks/" + id), v -> taskUI((JSONObject) v));
  }

  void taskUI(JSONObject t) throws Exception {
    screen = "Topshiriq";
    frame("Bemor holidan xabar olish", true);
    JSONObject p = t.optJSONObject("patient");
    LinearLayout c = card();
    label(c, status(t.optString("status")));
    c.addView(title(val(p, "full_name")));
    label(c, "Muddat: " + when(t.optString("due_at")));
    label(c, val(p, "address"));
    label(c, t.optString("recommendations"));
    String phone = val(p, "contact");
    if (!phone.isEmpty())
      button(
          c,
          "Telefon qilish",
          () -> startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + phone))));
    if (t.optString("status").equals("NEW"))
      button(
          c,
          "Topshiriqni qabul qilish",
          () ->
              mutate(
                  () ->
                      api.post(
                          "/tasks/" + t.getString("id") + "/accept",
                          json("version", t.getInt("version")),
                          Api.key()),
                  v -> taskUI((JSONObject) v)));
    if (t.optString("status").equals("ACCEPTED")) {
      button(c, "Aloqa urinishini qayd etish", () -> attemptForm(t));
      button(c, "Natijani kiritish", () -> completeForm(t));
    }
    if (!t.isNull("report")) {
      JSONObject r = t.getJSONObject("report");
      LinearLayout box = card();
      label(box, "TASDIQLANGAN NATIJA");
      label(box, r.optString("observation"));
      label(box, r.optString("actions"));
      label(box, r.optString("follow_up"));
      if (r.optString("author").equals(api.user.optString("id")))
        button(box, "Hisobotni tuzatish", () -> new ClinicalUi(this).reportCorrection(t));
      JSONArray corrections = t.optJSONArray("corrections");
      if (corrections != null)
        for (int i = 0; i < corrections.length(); i++) {
          JSONObject correction = corrections.getJSONObject(i);
          label(
              box,
              "Tuzatish: "
                  + correction.optString("correction_text")
                  + " · "
                  + correction.optString("reason"));
        }
    }
    if (p != null && !val(p, "id").isEmpty())
      button(body, "Bemorning dori jadvali", () -> loadMedication(p.optString("id")));
    if (p != null && !val(p, "id").isEmpty())
      button(
          body,
          "Dori jadvalini boshqarish",
          () -> new ClinicalUi(this).plans(p.optString("id"), t.optString("discharge")));
    button(body, "Ro‘yxatga qaytish", this::loadTasks);
  }

  Spinner spinner(LinearLayout c, String[] names) {
    Spinner s = new Spinner(this);
    s.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, names));
    c.addView(s);
    return s;
  }

  void completeForm(JSONObject t) {
    screen = "Natija:" + t.optString("id") + ":" + t.optInt("version");
    frame("Tashrif natijasi", true);
    LinearLayout c = card();
    label(c, "Faqat amalga oshirilgan aloqa yoki tashrifni tasdiqlang.");
    Spinner channel = spinner(c, new String[] {"Telefon", "Uyga tashrif"});
    EditText observed = field(c, "Kuzatuv", "", false),
        actions = field(c, "Bajarilgan ishlar", "", false),
        follow = field(c, "Keyingi reja", "", false);
    String key = Api.key();
    String performedAt = now();
    button(
        c,
        "Natijani tasdiqlash",
        () -> {
          if (observed.length() == 0 || actions.length() == 0 || follow.length() == 0) {
            message("Barcha natija maydonlarini to‘ldiring.");
            return;
          }
          String time = performedAt,
              a = observed.getText().toString(),
              b = actions.getText().toString(),
              f = follow.getText().toString(),
              ch = channel.getSelectedItemPosition() == 0 ? "PHONE" : "HOME_VISIT";
          mutate(
              () ->
                  api.post(
                      "/tasks/" + t.getString("id") + "/complete",
                      json(
                          "version",
                          t.getInt("version"),
                          "performed_at",
                          time,
                          "channel",
                          ch,
                          "observation",
                          a,
                          "actions",
                          b,
                          "follow_up",
                          f),
                      key),
              v -> taskUI((JSONObject) v));
        });
    button(c, "Orqaga", () -> openTask(t.optString("id")));
  }

  void attemptForm(JSONObject t) {
    screen = "Aloqa:" + t.optString("id") + ":" + t.optInt("version");
    frame("Aloqa urinishi", true);
    LinearLayout c = card();
    Spinner result =
        spinner(
            c,
            new String[] {
              "Bog‘lanildi", "Javob bermadi", "Noto‘g‘ri raqam", "Manzil topilmadi", "Rad etdi"
            });
    EditText note = field(c, "Izoh", "", false), next = field(c, "Keyingi reja", "", false);
    String key = Api.key();
    String attemptedAt = now();
    button(
        c,
        "Qayd etish",
        () -> {
          int selection = result.getSelectedItemPosition();
          String n = note.getText().toString(), f = next.getText().toString();
          mutate(
              () ->
                  api.post(
                      "/tasks/" + t.getString("id") + "/contact-attempts",
                      json(
                          "version",
                          t.getInt("version"),
                          "channel",
                          selection == 3 ? "HOME_VISIT" : "PHONE",
                          "result",
                          new String[] {
                                "CONTACTED",
                                "NO_ANSWER",
                                "WRONG_NUMBER",
                                "ADDRESS_NOT_FOUND",
                                "REFUSED"
                              }
                              [selection],
                          "attempted_at",
                          attemptedAt,
                          "note",
                          n,
                          "next_action",
                          f),
                      key),
              v -> openTask(t.getString("id")));
        });
  }

  void loadConversations() {
    execute(
        () -> api.list("/conversations"),
        v -> {
          JSONArray rows = (JSONArray) v;
          screen = "Suhbatlar";
          frame("Aloqada qoling", true);
          label(body, "Shoshilinch yordam kerak bo‘lsa, chat javobini kutmang.");
          button(body, "Yangilash", this::loadConversations);
          if (rows.length() == 0) label(body, "Suhbat hali ochilmagan. Muassasa bilan bog‘laning.");
          for (int i = 0; i < rows.length(); i++) {
            JSONObject c = rows.getJSONObject(i);
            LinearLayout box = card();
            box.addView(
                text(
                    doctor()
                        ? "Bemor · " + c.optString("patient").substring(0, 8)
                        : "Oilaviy shifokoringiz",
                    20,
                    INK));
            label(box, c.optString("response_policy"));
            label(box, "Holat: " + status(c.optString("status")));
            if (!c.isNull("response_due_at"))
              label(box, "Javob muddati: " + when(c.optString("response_due_at")));
            button(box, "Suhbatni ochish", () -> chat(c.optString("id"), true));
          }
        });
  }

  void chat(String id, boolean markRead) {
    execute(
        () -> {
          JSONObject c = api.get("/conversations/" + id);
          JSONArray rows = api.list("/conversations/" + id + "/messages");
          if (markRead) api.post("/conversations/" + id + "/read", new JSONObject(), Api.key());
          return new Object[] {c, rows};
        },
        v -> {
          Object[] data = (Object[]) v;
          JSONObject c = (JSONObject) data[0];
          JSONArray rows = (JSONArray) data[1];
          conversationId = id;
          screen = "Suhbat";
          frame(doctor() ? "Bemor bilan suhbat" : "Shifokor bilan suhbat", true);
          label(body, c.optString("response_policy"));
          if (rows.length() == 0) label(body, "Birinchi xabaringizni yuboring.");
          for (int i = 0; i < rows.length(); i++) {
            JSONObject m = rows.getJSONObject(i);
            LinearLayout box = card();
            label(
                box,
                (m.optString("sender").equals(api.user.optString("id")) ? "Siz" : "Suhbatdoshingiz")
                    + " · "
                    + when(m.optString("sent_at")));
            box.addView(text(m.optString("text"), 16, INK));
            label(box, status(m.optString("delivery_status")));
          }
          if (c.optString("status").equals("OPEN")) {
            LinearLayout compose = card();
            chatDraftKey = "chatdraft:" + api.user.optString("id") + ":" + id;
            EditText input = field(compose, "Xabar", vault.get(chatDraftKey), false);
            chatInput = input;
            input.setSingleLine(false);
            String key = Api.key();
            button(
                compose,
                "Yuborish",
                () -> {
                  String value = input.getText().toString().trim();
                  if (value.isEmpty()) {
                    message("Xabar matnini yozing.");
                    return;
                  }
                  mutate(
                      () ->
                          api.post("/conversations/" + id + "/messages", json("text", value), key),
                      out -> {
                        clearChatDraft();
                        chat(id, true);
                      });
                });
            if (!doctor()) button(compose, "Holatimni yuborish", () -> statusForm(id));
          }
          button(body, "Suhbatlar ro‘yxati", this::loadConversations);
        });
  }

  void statusForm(String id) {
    screen = "Holat:" + id;
    frame("Bugungi holatingiz", true);
    LinearLayout c = card();
    Spinner state = spinner(c, new String[] {"Yaxshilandi", "O‘zgarmadi", "Yomonlashdi"});
    EditText note = field(c, "Izoh", "", false);
    label(c, "Shoshilinch yordam kerak bo‘lsa chat javobini kutmang.");
    String key = Api.key();
    String observedAt = now();
    button(
        c,
        "Holatni yuborish",
        () -> {
          String n = note.getText().toString(),
              code =
                  new String[] {"IMPROVED", "UNCHANGED", "WORSENED"}
                      [state.getSelectedItemPosition()];
          mutate(
              () ->
                  api.post(
                      "/conversations/" + id + "/status-updates",
                      json("self_reported_state", code, "note", n, "observed_at", observedAt),
                      key),
              v -> chat(id, true));
        });
  }

  void medications() {
    String patient = val(api.user, "patient");
    if (patient.isEmpty()) {
      message("Bemor biriktirilmagan.");
      return;
    }
    screen = "Dorilar";
    frame("Dori jadvali", true);
    button(body, "Saqlangan jadvalni ko‘rish", () -> cachedMedication(patient));
    button(body, "Yuborilmagan qaydlar", () -> new ClinicalUi(this).queue());
    loadMedication(patient);
  }

  void flushQueue() throws Exception {
    MedicationSync.flush(api, vault);
  }

  void loadMedication(String patient) {
    execute(
        () -> {
          medicationSyncWarning = "";
          if (!doctor()) {
            try {
              flushQueue();
            } catch (Exception e) {
              medicationSyncWarning = e.getMessage();
            }
          }
          JSONArray plans = api.list("/patients/" + patient + "/medication-plans"),
              rows = new JSONArray();
          for (int i = 0; i < plans.length(); i++) {
            JSONObject plan = plans.getJSONObject(i);
            JSONArray all =
                api.list(
                    "/medication-plans/"
                        + plan.getString("id")
                        + "/occurrences?plan_version="
                        + plan.getInt("version"));
            for (int j = 0; j < all.length(); j++) rows.put(all.get(j));
          }
          if (!doctor()) Reminders.save(this, rows);
          return rows;
        },
        v -> {
          doses = (JSONArray) v;
          medicationUI(patient, false);
          if (!medicationSyncWarning.isEmpty()) message(medicationSyncWarning);
        });
  }

  void cachedMedication(String patient) {
    try {
      String packed = vault.get("doses");
      if (packed.isEmpty()) {
        message("Saqlangan jadval yo‘q.");
        return;
      }
      doses = new JSONObject(packed).getJSONArray("rows");
      medicationUI(patient, true);
    } catch (Exception e) {
      message("Jadvalni o‘qib bo‘lmadi.");
    }
  }

  void medicationUI(String patient, boolean cached) throws Exception {
    screen = "Dorilar";
    frame("Dori jadvali", true);
    label(body, "Faqat shifokor tasdiqlagan ko‘rsatma. Vaqt: Toshkent.");
    if (cached) label(body, "OFFLINE · Oxirgi yuklangan jadval. Yangilangan bo‘lishi mumkin.");
    if (!doctor()) {
      String saved = vault.get("doses");
      if (!saved.isEmpty()) {
        long synced = new JSONObject(saved).getLong("synced_at");
        label(body, "Oxirgi yangilanish: " + when(Instant.ofEpochMilli(synced).toString()));
        if (System.currentTimeMillis() - synced > 86400000L)
          label(body, "Jadval 24 soatdan eski. Shifokor bilan tekshiring.");
      }
    }
    button(body, "Jadvalni yangilash", () -> loadMedication(patient));
    if (!doctor()) {
      button(body, "Eslatmalarga ruxsat berish", this::notificationPermission);
      if (Build.VERSION.SDK_INT >= 31) {
        boolean precise = getSystemService(AlarmManager.class).canScheduleExactAlarms();
        label(
            body,
            precise
                ? "Aniq vaqtli eslatma ruxsati yoqilgan"
                : "Aniq vaqtli eslatma ruxsati yo‘q; eslatma kechikishi mumkin.");
        if (!precise)
          button(
              body,
              "Aniq vaqtli eslatmani yoqish",
              () ->
                  startActivity(
                      new Intent(
                          android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                          Uri.parse("package:" + getPackageName()))));
      }
      button(body, "Saqlangan jadvalni ko‘rish", () -> cachedMedication(patient));
      button(body, "Yuborilmagan qaydlar", () -> new ClinicalUi(this).queue());
      label(
          body,
          "Eslatma Android batareya cheklovlari sabab kechikishi mumkin. Dorini o‘zgartirish uchun"
              + " shifokorga yozing.");
    }
    if (doses.length() == 0) label(body, "Tasdiqlangan dori jadvali hozircha yo‘q.");
    for (int i = 0; i < doses.length(); i++) {
      JSONObject dose = doses.getJSONObject(i), item = dose.getJSONObject("item_details");
      LinearLayout c = card();
      label(c, when(dose.optString("scheduled_at")) + " · " + status(dose.optString("status")));
      c.addView(text(item.optString("name"), 21, INK));
      label(c, item.optString("prescribed_dose_text") + " · " + item.optString("route"));
      label(c, item.optString("instructions"));
      if (!doctor() && !dose.isNull("record"))
        button(c, "Qaydni tuzatish", () -> new ClinicalUi(this).correction(dose, patient));
      boolean due =
          Instant.parse(dose.getString("scheduled_at")).toEpochMilli()
              <= System.currentTimeMillis();
      if (!doctor() && due && dose.isNull("record") && dose.isNull("cancelled_at")) {
        button(c, "Ichdim", () -> recordDose(dose, "TAKEN", patient));
        button(c, "O‘tkazib yubordim", () -> recordDose(dose, "SKIPPED", patient));
      }
    }
  }

  void recordDose(JSONObject dose, String result, String patient) {
    new AlertDialog.Builder(this)
        .setTitle(
            result.equals("TAKEN")
                ? "Qabul qilganingizni tasdiqlaysizmi?"
                : "O‘tkazib yuborilganini qayd etasizmi?")
        .setMessage("Bu sizning shaxsiy qaydingiz. Doza bo‘yicha savol bo‘lsa shifokorga yozing.")
        .setNegativeButton("Orqaga", null)
        .setPositiveButton(
            "Tasdiqlash",
            (dialog, w) -> {
              try {
                String time = now();
                JSONObject payload =
                    json(
                        "plan_version",
                        dose.getInt("plan_version"),
                        "result",
                        result,
                        "reported_taken_at",
                        result.equals("TAKEN") ? time : JSONObject.NULL,
                        "client_recorded_at",
                        time,
                        "note",
                        "");
                JSONObject entry =
                    json("id", dose.getString("id"), "key", Api.key(), "payload", payload);
                execute(
                    () -> {
                      String saved = vault.get("dose_queue");
                      JSONArray queue = saved.isEmpty() ? new JSONArray() : new JSONArray(saved);
                      for (int i = 0; i < queue.length(); i++)
                        if (queue.getJSONObject(i).getString("id").equals(dose.getString("id")))
                          throw new Exception("Qayd navbatda. Jadvalni yangilang.");
                      queue.put(entry);
                      vault.put("dose_queue", queue.toString());
                      flushQueue();
                      return true;
                    },
                    v -> loadMedication(patient));
              } catch (Exception e) {
                message("Qayd tayyorlanmadi.");
              }
            })
        .show();
  }

  void notificationPermission() {
    if (Build.VERSION.SDK_INT >= 33
        && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED) {
      requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, 7);
      return;
    }
    startActivity(
        new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName()));
  }

  void account() {
    screen = "Hisob";
    frame("Mening hisobim", true);
    LinearLayout c = card();
    c.addView(text(api.user.optString("username"), 22, INK));
    label(c, doctor() ? "Oilaviy shifokor" : "Bemor");
    label(c, "MedicineTrack 0.2.0 · Sinov versiyasi");
    label(
        c,
        "Bildirishnomalar: "
            + (getSystemService(NotificationManager.class).areNotificationsEnabled()
                ? "yoqilgan"
                : "o‘chirilgan"));
    label(c, "Server: " + api.base);
    button(c, "Bildirishnomalar", () -> new ClinicalUi(this).notifications());
    button(
        c,
        "Chiqish",
        () ->
            new AlertDialog.Builder(this)
                .setTitle("Hisobdan chiqish")
                .setMessage(
                    "Yuborilmagan dori qaydlari bo‘lsa yo‘qoladi. Avval jadvalni yangilab"
                        + " sinxronlang.")
                .setNegativeButton("Qolish", null)
                .setPositiveButton(
                    "Chiqish",
                    (d, w) ->
                        mutate(
                            () -> {
                              try {
                                api.post("/auth/logout", json("refresh", api.refresh), null);
                              } catch (Exception ignored) {
                              }
                              SyncJobService.cancel(this);
                              Reminders.clear(this);
                              vault.clear();
                              api.access = "";
                              api.refresh = "";
                              api.user = new JSONObject();
                              return true;
                            },
                            v -> loginUI()))
                .show());
  }

  @Override
  public void onBackPressed() {
    if (!busy && !api.access.isEmpty()) home();
    else if (!busy) super.onBackPressed();
  }
}
