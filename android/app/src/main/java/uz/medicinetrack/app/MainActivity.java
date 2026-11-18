package uz.medicinetrack.app;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
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
  static final int INK = Design.INK,
      GREEN = Design.PRIMARY,
      MUTED = Design.MUTED,
      BG = Design.PAGE,
      LINE = Design.LINE;
  static final String DEFAULT_API = "http://10.0.2.2:8001/api/v1";
  ProgressBar progress;
  ScrollView contentScroll;
  JSONArray taskRows = new JSONArray();
  JSONObject conversationPatientNames = new JSONObject();
  String taskFilter = "Faol";
  Runnable backAction;
  String medicationFilter = "Bugun";
  int medicationLimit = 40, taskLimit = 40, messageLimit = 40;
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
              && !(getCurrentFocus() instanceof EditText)
              && (contentScroll == null || !contentScroll.canScrollVertically(1)))
            chat(conversationId, false);
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
    working(root, true);
    boolean hadSession = !api.access.isEmpty();
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
                working(root, false);
                message("");
                if (failure != null) {
                  if (hadSession
                      && failure instanceof Api.Failure
                      && ((Api.Failure) failure).status == 401) {
                    SyncJobService.cancel(this);
                    Reminders.clear(this);
                    vault.clear();
                    api.access = "";
                    api.refresh = "";
                    loginUI();
                  }
                  message(
                      failure instanceof Api.Failure
                          ? failure.getMessage()
                          : "Serverga ulanib bo‘lmadi. Internet va server manzilini tekshirib,"
                              + " qayta urinib ko‘ring.");
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

  void working(View view, boolean pending) {
    if (view == null) return;
    if (view instanceof Button
        || view instanceof EditText
        || view instanceof Spinner
        || view instanceof ImageButton
        || (view.isClickable() && view instanceof LinearLayout)) {
      view.setEnabled(!pending);
      view.setAlpha(pending ? .55f : 1f);
    }
    if (view instanceof ViewGroup) {
      ViewGroup group = (ViewGroup) view;
      for (int i = 0; i < group.getChildCount(); i++) working(group.getChildAt(i), pending);
    }
  }

  void summarize(Job job, Done done) {
    int ticket = generation;
    worker.execute(
        () -> {
          try {
            Object result = job.run();
            handler.post(
                () -> {
                  if (isDestroyed() || ticket != generation) return;
                  try {
                    done.run(result);
                  } catch (Exception e) {
                    message("Statistikani yangilab bo‘lmadi.");
                  }
                });
          } catch (Exception e) {
            handler.post(
                () -> {
                  if (!isDestroyed() && ticket == generation)
                    message("Statistika yuklanmadi. Ulanishni tekshiring.");
                });
          }
        });
  }

  int dp(int v) {
    return Math.round(v * getResources().getDisplayMetrics().density);
  }

  TextView text(String s, int size, int color) {
    TextView t = new TextView(this);
    t.setText(s);
    t.setTextSize(size);
    t.setTextColor(color);
    t.setTypeface(Design.font(this, false));
    t.setIncludeFontPadding(false);
    t.setLineSpacing(dp(3), 1);
    t.setPadding(0, dp(4), 0, dp(4));
    return t;
  }

  TextView title(String s) {
    TextView t = text(s, 26, INK);
    t.setTypeface(Design.font(this, true));
    if (Build.VERSION.SDK_INT >= 28) t.setAccessibilityHeading(true);
    return t;
  }

  LinearLayout column() {
    LinearLayout l = new LinearLayout(this);
    l.setOrientation(LinearLayout.VERTICAL);
    return l;
  }

  LinearLayout row() {
    LinearLayout l = new LinearLayout(this);
    l.setGravity(Gravity.CENTER_VERTICAL);
    return l;
  }

  LinearLayout card() {
    LinearLayout c = column();
    c.setPadding(dp(16), dp(16), dp(16), dp(16));
    c.setBackground(Design.shape(this, Color.WHITE, 16, LINE));
    LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
    p.setMargins(0, dp(6), 0, dp(10));
    body.addView(c, p);
    return c;
  }

  void label(LinearLayout c, String s) {
    if (!s.isEmpty()) c.addView(text(s, 14, MUTED));
  }

  TextView badge(LinearLayout c, String s, String state) {
    int color = GREEN, wash = Design.MINT;
    if (state.equals("OVERDUE") || state.equals("WORSENED")) {
      color = Design.DANGER;
      wash = 0xfffff1f0;
    } else if (state.equals("NEW") || state.equals("DRAFT") || state.equals("PENDING")) {
      color = Design.WARNING;
      wash = 0xfffff7e6;
    } else if (state.equals("COMPLETED") || state.equals("TAKEN")) {
      color = 0xff166534;
      wash = 0xffeaf7ed;
    } else if (state.equals("CANCELLED") || state.equals("STOPPED") || state.equals("SKIPPED")) {
      color = MUTED;
      wash = BG;
    }
    TextView t = text(s, 12, color);
    t.setTypeface(Design.font(this, true));
    t.setPadding(dp(10), dp(6), dp(10), dp(6));
    t.setBackground(Design.shape(this, wash, 7, 0));
    LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-2, -2);
    p.setMargins(0, 0, 0, dp(8));
    c.addView(t, p);
    return t;
  }

  Button action(LinearLayout c, String s, boolean filled, boolean destructive, Runnable action) {
    Button b = new Button(this);
    b.setText(s);
    b.setTextSize(14);
    b.setTypeface(Design.font(this, true));
    b.setAllCaps(false);
    b.setTextColor(destructive ? Design.DANGER : filled ? Color.WHITE : GREEN);
    b.setBackground(
        Design.ripple(
            this,
            destructive ? 0xfffff1f0 : filled ? GREEN : Color.WHITE,
            9,
            filled || destructive ? 0 : LINE));
    b.setStateListAnimator(null);
    b.setElevation(0);
    b.setMinHeight(dp(48));
    b.setMinimumHeight(dp(48));
    b.setMinWidth(0);
    b.setPadding(dp(14), dp(12), dp(14), dp(12));
    LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
    p.setMargins(0, dp(8), 0, dp(2));
    c.addView(b, p);
    b.setOnClickListener(
        v -> {
          if (!busy) action.run();
        });
    return b;
  }

  Button button(LinearLayout c, String s, Runnable action) {
    return action(c, s, true, false, action);
  }

  Button secondary(LinearLayout c, String s, Runnable action) {
    return action(c, s, false, false, action);
  }

  Button danger(LinearLayout c, String s, Runnable action) {
    return action(c, s, false, true, action);
  }

  EditText field(LinearLayout c, String label, String value, boolean password) {
    TextView caption = text(label, 14, INK);
    caption.setTypeface(Design.font(this, true));
    caption.setPadding(0, dp(12), 0, dp(6));
    c.addView(caption);
    EditText e = new EditText(this);
    e.setId(View.generateViewId());
    caption.setLabelFor(e.getId());
    e.setContentDescription(label);
    String draftId = label + ":" + draftFields.size();
    e.setText(
        !password && !activeFormKey.isEmpty() && restoredFields.has(draftId)
            ? restoredFields.optString(draftId)
            : value);
    if (!password && !activeFormKey.isEmpty()) draftFields.put(draftId, e);
    e.setTextColor(INK);
    e.setTextSize(16);
    e.setTypeface(Design.font(this, false));
    e.setPadding(dp(12), dp(12), dp(password ? 56 : 12), dp(12));
    android.graphics.drawable.StateListDrawable states =
        new android.graphics.drawable.StateListDrawable();
    states.addState(
        new int[] {android.R.attr.state_focused}, Design.shape(this, Color.WHITE, 9, GREEN));
    states.addState(new int[] {}, Design.shape(this, Color.WHITE, 9, Design.INPUT));
    e.setBackground(states);
    e.setMinHeight(dp(48));
    e.setSingleLine(true);
    e.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_NEXT);
    if (password) {
      e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
      e.setTypeface(Design.font(this, false));
    }
    e.addTextChangedListener(
        new android.text.TextWatcher() {
          public void beforeTextChanged(CharSequence value, int start, int count, int after) {}

          public void onTextChanged(CharSequence value, int start, int before, int count) {
            handler.removeCallbacks(draftSaver);
            handler.postDelayed(draftSaver, 400);
          }

          public void afterTextChanged(android.text.Editable value) {}
        });
    if (password) {
      FrameLayout wrapper = new FrameLayout(this);
      wrapper.addView(e, new FrameLayout.LayoutParams(-1, -2));
      ImageButton toggle =
          iconButton(
              "eye",
              "Parolni ko‘rsatish",
              () -> {
                boolean hidden = e.getTransformationMethod() != null;
                e.setTransformationMethod(
                    hidden ? null : android.text.method.PasswordTransformationMethod.getInstance());
                e.setSelection(e.length());
              });
      toggle.setOnClickListener(
          v -> {
            boolean hidden = e.getTransformationMethod() != null;
            e.setTransformationMethod(
                hidden ? null : android.text.method.PasswordTransformationMethod.getInstance());
            e.setSelection(e.length());
            toggle.setContentDescription(hidden ? "Parolni yashirish" : "Parolni ko‘rsatish");
          });
      wrapper.addView(
          toggle,
          new FrameLayout.LayoutParams(dp(48), dp(48), Gravity.END | Gravity.CENTER_VERTICAL));
      c.addView(wrapper, new LinearLayout.LayoutParams(-1, -2));
    } else c.addView(e, new LinearLayout.LayoutParams(-1, -2));
    return e;
  }

  void multiline(EditText field) {
    field.setSingleLine(false);
    field.setMinLines(3);
    field.setGravity(Gravity.TOP | Gravity.START);
    field.setInputType(
        InputType.TYPE_CLASS_TEXT
            | InputType.TYPE_TEXT_FLAG_MULTI_LINE
            | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
    field.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_NONE);
  }

  ImageButton iconButton(String icon, String description, Runnable action) {
    ImageButton b = new ImageButton(this);
    b.setImageDrawable(Design.icon(this, icon, GREEN));
    b.setContentDescription(description);
    b.setPadding(dp(12), dp(12), dp(12), dp(12));
    b.setBackground(Design.ripple(this, Color.TRANSPARENT, 10, 0));
    b.setOnClickListener(
        v -> {
          if (!busy) action.run();
        });
    return b;
  }

  String section() {
    if (screen.equals("Asosiy")) return "Asosiy";
    if (screen.equals("Hisob") || screen.equals("Bildirishnomalar")) return "Hisob";
    if (screen.startsWith("Suhbat") || screen.startsWith("Holat:")) return "Suhbatlar";
    return doctor() ? "Chaqiruvlar" : "Dorilar";
  }

  void frame(String heading, boolean navigation) {
    saveFormDraft();
    draftFields.clear();
    activeFormKey = "";
    restoredFields = new JSONObject();
    if (api != null && !api.access.isEmpty() && !screen.equals("Suhbat") && navigation) {
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
    backAction = navigation ? this::home : this::loginUI;
    root = column();
    root.setBackgroundColor(BG);
    setContentView(root);
    LinearLayout bar = row();
    bar.setBackgroundColor(Color.WHITE);
    bar.setPadding(dp(12), dp(6), dp(8), dp(6));
    if (navigation && !screen.equals("Asosiy")) {
      bar.addView(
          iconButton("back", "Orqaga", this::goBack),
          new LinearLayout.LayoutParams(dp(44), dp(48)));
    } else {
      ImageView logo = new ImageView(this);
      logo.setImageDrawable(Design.icon(this, "heart", Color.WHITE));
      logo.setPadding(dp(8), dp(8), dp(8), dp(8));
      logo.setBackground(Design.shape(this, GREEN, 10, 0));
      LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(40), dp(40));
      lp.setMargins(dp(4), 0, dp(8), 0);
      bar.addView(logo, lp);
    }
    LinearLayout brand = column();
    TextView name = text("MedicineTrack", 18, INK);
    name.setTypeface(Design.font(this, true));
    brand.addView(name);
    brand.addView(
        text(
            navigation
                ? doctor() ? "Shifokor kabineti" : "Bemor kabineti"
                : "Parvarish doim yoningizda",
            11,
            MUTED));
    bar.addView(brand, new LinearLayout.LayoutParams(0, -2, 1));
    if (navigation)
      bar.addView(
          iconButton("bell", "Bildirishnomalar", () -> new ClinicalUi(this).notifications()),
          new LinearLayout.LayoutParams(dp(48), dp(48)));
    root.addView(bar);
    View divider = new View(this);
    divider.setBackgroundColor(LINE);
    root.addView(divider, new LinearLayout.LayoutParams(-1, dp(1)));
    progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
    progress.setIndeterminate(true);
    progress.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(GREEN));
    progress.setVisibility(View.GONE);
    root.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
    feedback = text("", 14, Design.DANGER);
    feedback.setPadding(dp(16), dp(10), dp(16), dp(10));
    feedback.setBackgroundColor(0xfffff1f0);
    feedback.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
    feedback.setVisibility(View.GONE);
    root.addView(feedback);
    ScrollView scroll = new ScrollView(this);
    contentScroll = scroll;
    scroll.setFillViewport(true);
    scroll.setClipToPadding(false);
    FrameLayout content = new FrameLayout(this);
    body = column();
    body.setPadding(dp(16), dp(18), dp(16), dp(20));
    int width = getResources().getConfiguration().screenWidthDp > 720 ? dp(720) : -1;
    content.addView(
        body, new FrameLayout.LayoutParams(width, -2, Gravity.TOP | Gravity.CENTER_HORIZONTAL));
    scroll.addView(content, new ScrollView.LayoutParams(-1, -2));
    root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
    if (!heading.isEmpty()) {
      TextView title = title(heading);
      title.setPadding(0, 0, 0, dp(12));
      body.addView(title);
    }
    if (navigation) {
      View line = new View(this);
      line.setBackgroundColor(LINE);
      root.addView(line, new LinearLayout.LayoutParams(-1, dp(1)));
      LinearLayout nav = row();
      nav.setBackgroundColor(Color.WHITE);
      nav.setPadding(dp(8), dp(6), dp(8), dp(6));
      String[] names =
          doctor()
              ? new String[] {"Asosiy", "Chaqiruvlar", "Suhbatlar", "Hisob"}
              : new String[] {"Asosiy", "Dorilar", "Suhbatlar", "Hisob"};
      String[] icons = {"home", doctor() ? "tasks" : "pill", "chat", "user"};
      for (int i = 0; i < names.length; i++) {
        String item = names[i];
        boolean selected = section().equals(item);
        LinearLayout tab = column();
        tab.setGravity(Gravity.CENTER);
        tab.setPadding(dp(2), dp(6), dp(2), dp(6));
        tab.setBackground(Design.ripple(this, selected ? Design.MINT : Color.WHITE, 12, 0));
        ImageView icon = new ImageView(this);
        icon.setImageDrawable(Design.icon(this, icons[i], selected ? GREEN : MUTED));
        tab.addView(icon, new LinearLayout.LayoutParams(dp(22), dp(22)));
        TextView label = text(item, 11, selected ? GREEN : MUTED);
        label.setTypeface(Design.font(this, selected));
        label.setGravity(Gravity.CENTER);
        label.setMaxLines(1);
        label.setAutoSizeTextTypeUniformWithConfiguration(
            9, 11, 1, android.util.TypedValue.COMPLEX_UNIT_SP);
        tab.addView(label);
        tab.setContentDescription(item);
        tab.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);
        tab.setSelected(selected);
        tab.setOnClickListener(
            v -> {
              if (!busy) navigate(item);
            });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1);
        lp.setMargins(dp(3), 0, dp(3), 0);
        nav.addView(tab, lp);
      }
      root.addView(nav);
      root.getViewTreeObserver()
          .addOnGlobalLayoutListener(
              () -> {
                android.graphics.Rect visible = new android.graphics.Rect();
                root.getWindowVisibleDisplayFrame(visible);
                boolean keyboard = root.getRootView().getHeight() - visible.bottom > dp(160);
                int wanted = keyboard ? View.GONE : View.VISIBLE;
                if (nav.getVisibility() != wanted) nav.setVisibility(wanted);
              });
    }
  }

  void goBack() {
    if (!busy && backAction != null) backAction.run();
  }

  void empty(String heading, String detail, String icon) {
    LinearLayout c = card();
    c.setGravity(Gravity.CENTER);
    ImageView image = new ImageView(this);
    image.setImageDrawable(Design.icon(this, icon, GREEN));
    c.addView(image, new LinearLayout.LayoutParams(dp(36), dp(36)));
    TextView h = text(heading, 18, INK);
    h.setGravity(Gravity.CENTER);
    h.setTypeface(Design.font(this, true));
    c.addView(h);
    TextView desc = text(detail, 14, MUTED);
    desc.setGravity(Gravity.CENTER);
    c.addView(desc);
  }

  boolean doctor() {
    return api.user.optString("role").equals("DOCTOR");
  }

  void message(String s) {
    boolean loading = s.equals("Yuklanmoqda…");
    if (progress != null) progress.setVisibility(loading ? View.VISIBLE : View.GONE);
    if (feedback != null) {
      feedback.setText(s);
      feedback.setVisibility(s.isEmpty() || loading ? View.GONE : View.VISIBLE);
    }
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
      case "PENDING":
        return "Yuborish kutilmoqda";
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
    frame("", false);
    LinearLayout hero = card();
    hero.setBackground(Design.shape(this, GREEN, 16, 0));
    TextView promise = text("Har bir bemor e’tiborda.", 28, Color.WHITE);
    promise.setTypeface(Design.font(this, true));
    hero.addView(promise);
    hero.addView(text("Statsionardan keyingi kuzatuv va o‘z vaqtida patronaj.", 15, Color.WHITE));
    LinearLayout c = card();
    c.addView(title("Kabinetga kirish"));
    label(c, "Hisobingiz orqali tizimga kiring.");
    EditText login = field(c, "Login", "", false), password = field(c, "Parol", "", true);
    login.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
    login.setAutofillHints(View.AUTOFILL_HINT_USERNAME);
    password.setAutofillHints(View.AUTOFILL_HINT_PASSWORD);
    LinearLayout settings = column();
    EditText server =
        field(settings, "API manzili", getPreferences(0).getString("server", DEFAULT_API), false);
    server.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
    password.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_DONE);
    Button submit =
        button(
            c,
            "Kirish",
            () -> {
              String url = server.getText().toString(),
                  name = login.getText().toString().trim(),
                  secret = password.getText().toString();
              if (name.isEmpty()) {
                login.setError("Loginni kiriting.");
                login.requestFocus();
                return;
              }
              if (secret.isEmpty()) {
                password.setError("Parolni kiriting.");
                password.requestFocus();
                return;
              }
              ((android.view.inputmethod.InputMethodManager) getSystemService(INPUT_METHOD_SERVICE))
                  .hideSoftInputFromWindow(password.getWindowToken(), 0);
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
    password.setOnEditorActionListener(
        (v, id, event) -> {
          if (id == android.view.inputmethod.EditorInfo.IME_ACTION_DONE) {
            submit.performClick();
            return true;
          }
          return false;
        });
    secondary(c, "Bemor hisobini aktivlashtirish", () -> new ClinicalUi(this).activation());
    secondary(
        body,
        "Server sozlamalari",
        () ->
            settings.setVisibility(
                settings.getVisibility() == View.GONE ? View.VISIBLE : View.GONE));
    settings.setVisibility(View.GONE);
    body.addView(settings);
    label(body, "Bemor va oilaviy shifokor uchun. Kirish ma’lumotlarini muassasangiz beradi.");
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

  TextView metric(LinearLayout parent, String name, String icon) {
    LinearLayout tile = column();
    tile.setPadding(dp(14), dp(14), dp(14), dp(14));
    tile.setBackground(Design.shape(this, Color.WHITE, 16, LINE));
    ImageView image = new ImageView(this);
    image.setImageDrawable(Design.icon(this, icon, GREEN));
    tile.addView(image, new LinearLayout.LayoutParams(dp(22), dp(22)));
    TextView value = text("—", 28, INK);
    value.setTypeface(Design.font(this, true));
    tile.addView(value);
    label(tile, name);
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -1, 1);
    lp.setMargins(dp(4), dp(4), dp(4), dp(12));
    parent.addView(tile, lp);
    return value;
  }

  void home() {
    screen = "Asosiy";
    frame(doctor() ? "Ish kuningiz, bir joyda." : "Bugun o‘zingizni asrang.", true);
    label(
        body,
        LocalDate.now(ZoneId.of("Asia/Tashkent")).format(DateTimeFormatter.ofPattern("dd.MM.yyyy"))
            + " · Toshkent vaqti");
    LinearLayout hero = card();
    hero.setBackground(Design.shape(this, GREEN, 16, 0));
    TextView h =
        text(
            doctor() ? "Har bir chaqiruv ortida — bemor." : "Uyda ham yolg‘iz emassiz.",
            24,
            Color.WHITE);
    h.setTypeface(Design.font(this, true));
    hero.addView(h);
    hero.addView(
        text(
            doctor()
                ? "24 soat ichida holidan xabar oling va natijani qayd eting."
                : "Dori jadvali, shifokor bilan aloqa va kundalik holatingiz bir joyda.",
            15,
            Color.WHITE));
    LinearLayout metrics = row();
    body.addView(metrics);
    TextView first =
        metric(
            metrics,
            doctor() ? "Faol chaqiruvlar" : "Bugungi qabullar",
            doctor() ? "tasks" : "pill");
    TextView second =
        metric(
            metrics, doctor() ? "Muddat o‘tgan" : "Qayd kutilmoqda", doctor() ? "bell" : "check");
    LinearLayout c = card();
    badge(c, doctor() ? "PATRONAJ" : "KUNDALIK PARVARISH", "ACTIVE");
    c.addView(text(doctor() ? "Mening chaqiruvlarim" : "Dori qabul qilish jadvali", 20, INK));
    label(
        c,
        doctor()
            ? "Biriktirilgan bemorlar va tashrif natijalari."
            : "Faqat shifokor tasdiqlagan dori ko‘rsatmalari.");
    button(
        c,
        doctor() ? "Chaqiruvlarni ochish" : "Dorilarimni ko‘rish",
        () -> {
          if (doctor()) loadTasks();
          else medications();
        });
    LinearLayout chat = card();
    chat.addView(text(doctor() ? "Bemorlar bilan aloqa" : "Shifokor bilan aloqa", 20, INK));
    label(chat, "Xabar va holatni yuboring. Javob ish jadvali bo‘yicha beriladi.");
    secondary(chat, "Suhbatlarni ochish", this::loadConversations);
    Api homeApi = api;
    boolean homeDoctor = doctor();
    summarize(
        () ->
            homeDoctor
                ? homeApi.list("/tasks")
                : MedicationSync.fetchToday(homeApi, homeApi.user.getString("patient")),
        v -> {
          JSONArray rows = (JSONArray) v;
          int total = 0, pending = 0;
          LocalDate today = LocalDate.now(ZoneId.of("Asia/Tashkent"));
          for (int i = 0; i < rows.length(); i++) {
            JSONObject item = rows.getJSONObject(i);
            if (homeDoctor) {
              if (item.optString("status").equals("NEW")
                  || item.optString("status").equals("ACCEPTED")) {
                total++;
                if (item.optBoolean("overdue")) pending++;
              }
            } else if (item.isNull("cancelled_at")
                && Instant.parse(item.getString("scheduled_at"))
                    .atZone(ZoneId.of("Asia/Tashkent"))
                    .toLocalDate()
                    .equals(today)) {
              total++;
              if (item.isNull("record")
                  && !Instant.parse(item.getString("scheduled_at")).isAfter(Instant.now()))
                pending++;
            }
          }
          first.setText(String.valueOf(total));
          second.setText(String.valueOf(pending));
        });
  }

  void loadTasks() {
    execute(
        () -> api.list("/tasks"),
        v -> {
          taskRows = (JSONArray) v;
          tasksUI();
        });
  }

  void filterBar(String[] options, String selected, java.util.function.Consumer<String> select) {
    HorizontalScrollView scroll = new HorizontalScrollView(this);
    scroll.setHorizontalScrollBarEnabled(false);
    LinearLayout filters = row();
    for (String name : options) {
      Button b = new Button(this);
      b.setText(name);
      b.setTextSize(13);
      b.setAllCaps(false);
      b.setTypeface(Design.font(this, name.equals(selected)));
      b.setTextColor(name.equals(selected) ? GREEN : MUTED);
      b.setBackground(
          Design.ripple(
              this,
              name.equals(selected) ? Design.MINT : Color.WHITE,
              9,
              name.equals(selected) ? 0 : LINE));
      b.setMinWidth(0);
      b.setMinimumWidth(0);
      b.setMinHeight(dp(44));
      b.setMinimumHeight(dp(44));
      b.setPadding(dp(14), dp(10), dp(14), dp(10));
      b.setStateListAnimator(null);
      LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
      lp.setMargins(0, dp(8), dp(8), dp(10));
      filters.addView(b, lp);
      b.setOnClickListener(
          v -> {
            if (!busy) select.accept(name);
          });
    }
    scroll.addView(filters);
    body.addView(scroll);
  }

  void tasksUI() throws Exception {
    screen = "Chaqiruvlar";
    frame("Mening chaqiruvlarim", true);
    label(body, "Biriktirilgan chaqiruvlar: " + taskRows.length() + " · Toshkent vaqti");
    secondary(body, "Yangilash", this::loadTasks);
    filterBar(
        new String[] {"Faol", "Yangi", "Qabul qilingan", "Muddat o‘tgan", "Barchasi"},
        taskFilter,
        name -> {
          taskFilter = name;
          taskLimit = 40;
          try {
            tasksUI();
          } catch (Exception e) {
            message("Ro‘yxatni yangilang.");
          }
        });
    int count = 0;
    for (int i = 0; i < taskRows.length(); i++) {
      JSONObject t = taskRows.getJSONObject(i), p = t.optJSONObject("patient");
      String state = t.optString("status");
      boolean active = state.equals("NEW") || state.equals("ACCEPTED");
      if ((taskFilter.equals("Faol") && !active)
          || (taskFilter.equals("Yangi") && !state.equals("NEW"))
          || (taskFilter.equals("Qabul qilingan") && !state.equals("ACCEPTED"))
          || (taskFilter.equals("Muddat o‘tgan") && !(active && t.optBoolean("overdue")))) continue;
      count++;
      if (count > taskLimit) continue;
      LinearLayout c = card();
      badge(c, status(state), state);
      TextView patient = text(val(p, "full_name"), 21, INK);
      patient.setTypeface(Design.font(this, true));
      c.addView(patient);
      if (active && t.optBoolean("overdue")) badge(c, "Muddat o‘tgan", "OVERDUE");
      label(c, "Muddat: " + when(t.optString("due_at")));
      label(c, val(p, "address"));
      secondary(c, "Tafsilotlarni ochish", () -> openTask(t.optString("id")));
    }
    if (count == 0) {
      empty("Hozircha chaqiruv yo‘q.", "Boshqa filtrni tanlang yoki ro‘yxatni yangilang.", "tasks");
      secondary(
          body,
          "Barcha chaqiruvlar",
          () -> {
            taskFilter = "Barchasi";
            try {
              tasksUI();
            } catch (Exception ignored) {
            }
          });
    }
    if (count > taskLimit)
      secondary(
          body,
          "Yana 40 ta chaqiruvni ko‘rsatish",
          () -> {
            int oldY = contentScroll.getScrollY();
            taskLimit += 40;
            try {
              tasksUI();
              contentScroll.post(() -> contentScroll.scrollTo(0, oldY));
            } catch (Exception e) {
              message("Ro‘yxatni yangilang.");
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
    backAction = this::loadTasks;
    badge(c, status(t.optString("status")), t.optString("status"));
    c.addView(title(val(p, "full_name")));
    label(c, "Muddat: " + when(t.optString("due_at")));
    label(c, val(p, "address"));
    label(c, t.optString("recommendations"));
    String phone = val(p, "contact");
    if (!phone.isEmpty())
      secondary(
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
      secondary(c, "Aloqa urinishini qayd etish", () -> attemptForm(t));
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
        secondary(box, "Hisobotni tuzatish", () -> new ClinicalUi(this).reportCorrection(t));
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
      secondary(body, "Bemorning dori jadvali", () -> loadMedication(p.optString("id")));
    if (p != null && !val(p, "id").isEmpty())
      secondary(
          body,
          "Dori jadvalini boshqarish",
          () -> new ClinicalUi(this).plans(p.optString("id"), t.optString("discharge")));
    secondary(body, "Ro‘yxatga qaytish", this::loadTasks);
  }

  Spinner spinner(LinearLayout c, String[] names) {
    Spinner s = new Spinner(this);
    s.setAdapter(
        new ArrayAdapter<String>(this, android.R.layout.simple_spinner_dropdown_item, names) {
          @Override
          public View getView(int position, View convertView, ViewGroup parent) {
            TextView t = (TextView) super.getView(position, convertView, parent);
            t.setTextColor(INK);
            t.setTextSize(16);
            t.setTypeface(Design.font(MainActivity.this, false));
            t.setPadding(dp(8), dp(8), dp(8), dp(8));
            t.setCompoundDrawablesWithIntrinsicBounds(
                null, null, Design.icon(MainActivity.this, "down", MUTED), null);
            return t;
          }

          @Override
          public View getDropDownView(int position, View convertView, ViewGroup parent) {
            TextView t = (TextView) super.getDropDownView(position, convertView, parent);
            t.setTextColor(INK);
            t.setTextSize(16);
            t.setTypeface(Design.font(MainActivity.this, false));
            t.setPadding(dp(16), dp(12), dp(16), dp(12));
            t.setMinHeight(dp(48));
            return t;
          }
        });
    s.setBackground(Design.shape(this, Color.WHITE, 9, Design.INPUT));
    s.setPadding(dp(8), dp(4), dp(8), dp(4));
    s.setMinimumHeight(dp(48));
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(52));
    lp.setMargins(0, dp(8), 0, dp(8));
    c.addView(s, lp);
    return s;
  }

  void completeForm(JSONObject t) {
    screen = "Natija:" + t.optString("id") + ":" + t.optInt("version");
    frame("Tashrif natijasi", true);
    backAction = () -> openTask(t.optString("id"));
    LinearLayout c = card();
    label(c, "Faqat amalga oshirilgan aloqa yoki tashrifni tasdiqlang.");
    Spinner channel = spinner(c, new String[] {"Telefon", "Uyga tashrif"});
    EditText observed = field(c, "Kuzatuv", "", false),
        actions = field(c, "Bajarilgan ishlar", "", false),
        follow = field(c, "Keyingi reja", "", false);
    multiline(observed);
    multiline(actions);
    multiline(follow);
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
    secondary(c, "Orqaga", () -> openTask(t.optString("id")));
  }

  void attemptForm(JSONObject t) {
    screen = "Aloqa:" + t.optString("id") + ":" + t.optInt("version");
    frame("Aloqa urinishi", true);
    backAction = () -> openTask(t.optString("id"));
    LinearLayout c = card();
    Spinner result =
        spinner(
            c,
            new String[] {
              "Bog‘lanildi", "Javob bermadi", "Noto‘g‘ri raqam", "Manzil topilmadi", "Rad etdi"
            });
    EditText note = field(c, "Izoh", "", false), next = field(c, "Keyingi reja", "", false);
    multiline(note);
    multiline(next);
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
        () -> {
          JSONArray rows = api.list("/conversations");
          JSONObject names = new JSONObject();
          if (doctor()) {
            JSONArray patients = api.list("/patients");
            for (int i = 0; i < patients.length(); i++) {
              JSONObject patient = patients.getJSONObject(i);
              names.put(patient.getString("id"), patient.optString("full_name"));
            }
          }
          return new Object[] {rows, names};
        },
        v -> {
          Object[] data = (Object[]) v;
          JSONArray rows = (JSONArray) data[0];
          conversationPatientNames = (JSONObject) data[1];
          screen = "Suhbatlar";
          frame("Suhbatlar", true);
          label(body, "Shoshilinch yordam kerak bo‘lsa, chat javobini kutmang.");
          secondary(body, "Yangilash", this::loadConversations);
          if (rows.length() == 0)
            empty(
                "Suhbat hali ochilmagan.",
                "Muassasa bilan bog‘laning; biriktirilgan shifokor suhbati shu yerda ko‘rinadi.",
                "chat");
          for (int i = 0; i < rows.length(); i++) {
            JSONObject c = rows.getJSONObject(i);
            LinearLayout box = card();
            box.addView(
                text(
                    doctor()
                        ? conversationPatientNames.optString(
                            c.optString("patient"),
                            "Bemor · "
                                + c.optString("patient")
                                    .substring(0, Math.min(8, c.optString("patient").length())))
                        : "Oilaviy shifokoringiz",
                    20,
                    INK));
            label(box, c.optString("response_policy"));
            badge(box, status(c.optString("status")), c.optString("status"));
            if (!c.isNull("response_due_at"))
              label(box, "Javob muddati: " + when(c.optString("response_due_at")));
            secondary(box, "Suhbatni ochish", () -> chat(c.optString("id"), true));
          }
        });
  }

  void chat(String id, boolean markRead) {
    int oldY = contentScroll == null ? 0 : contentScroll.getScrollY();
    if (!conversationId.equals(id)) messageLimit = 40;
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
          backAction = this::loadConversations;
          if (doctor())
            label(
                body,
                conversationPatientNames.optString(c.optString("patient"), "Bemor bilan aloqa"));
          label(body, c.optString("response_policy"));
          if (rows.length() == 0) label(body, "Birinchi xabaringizni yuboring.");
          if (rows.length() > messageLimit)
            secondary(
                body,
                "Oldingi 40 ta xabar",
                () -> {
                  messageLimit += 40;
                  chat(id, false);
                });
          for (int i = Math.max(0, rows.length() - messageLimit); i < rows.length(); i++) {
            JSONObject m = rows.getJSONObject(i);
            LinearLayout box = card();
            boolean own = m.optString("sender").equals(api.user.optString("id"));
            box.setBackground(
                Design.shape(this, own ? Design.MINT : Color.WHITE, 16, own ? 0 : LINE));
            LinearLayout.LayoutParams bubble = (LinearLayout.LayoutParams) box.getLayoutParams();
            bubble.setMargins(own ? dp(32) : 0, dp(4), own ? 0 : dp(32), dp(8));
            box.setLayoutParams(bubble);
            label(box, (own ? "Siz" : "Suhbatdoshingiz") + " · " + when(m.optString("sent_at")));
            box.addView(text(m.optString("text"), 16, INK));
            label(box, status(m.optString("delivery_status")));
          }
          if (c.optString("status").equals("OPEN")) {
            LinearLayout compose = card();
            chatDraftKey = "chatdraft:" + api.user.optString("id") + ":" + id;
            EditText input = field(compose, "Xabar", vault.get(chatDraftKey), false);
            chatInput = input;
            multiline(input);
            input.setMinLines(2);
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
            if (!doctor()) secondary(compose, "Holatimni yuborish", () -> statusForm(id));
          }
          secondary(body, "Suhbatlar ro‘yxati", this::loadConversations);
          contentScroll.post(
              () -> {
                if (markRead) contentScroll.fullScroll(View.FOCUS_DOWN);
                else contentScroll.scrollTo(0, oldY);
              });
        });
  }

  void statusForm(String id) {
    screen = "Holat:" + id;
    frame("Bugungi holatingiz", true);
    backAction = () -> chat(id, true);
    LinearLayout c = card();
    Spinner state = spinner(c, new String[] {"Yaxshilandi", "O‘zgarmadi", "Yomonlashdi"});
    EditText note = field(c, "Izoh", "", false);
    label(c, "Shoshilinch yordam kerak bo‘lsa chat javobini kutmang.");
    multiline(note);
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
    secondary(body, "Saqlangan jadvalni ko‘rish", () -> cachedMedication(patient));
    secondary(body, "Yuborilmagan qaydlar", () -> new ClinicalUi(this).queue());
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
          JSONArray rows = MedicationSync.fetch(api, patient);
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
    if (doctor()) backAction = this::loadTasks;
    label(body, "Shifokor tasdiqlagan ko‘rsatmalar · Toshkent vaqti");
    if (cached) badge(body, "Offline · Saqlangan jadval", "PENDING");
    if (!doctor()) {
      String saved = vault.get("doses");
      if (!saved.isEmpty()) {
        long synced = new JSONObject(saved).getLong("synced_at");
        label(body, "Oxirgi yangilanish: " + when(Instant.ofEpochMilli(synced).toString()));
        if (System.currentTimeMillis() - synced > 86400000L)
          badge(body, "Jadval 24 soatdan eski. Shifokor bilan tekshiring.", "OVERDUE");
      }
    }
    secondary(body, "Jadvalni yangilash", () -> loadMedication(patient));
    filterBar(
        new String[] {"Bugun", "Barcha qabullar", "Qayd kutilmoqda"},
        medicationFilter,
        name -> {
          medicationFilter = name;
          medicationLimit = 40;
          try {
            medicationUI(patient, cached);
          } catch (Exception e) {
            message("Jadvalni yangilang.");
          }
        });
    java.util.Set<String> queued = new java.util.HashSet<>();
    if (!doctor()) {
      String packed = vault.get("dose_queue");
      JSONArray entries = packed.isEmpty() ? new JSONArray() : new JSONArray(packed);
      for (int i = 0; i < entries.length(); i++)
        queued.add(entries.getJSONObject(i).optString("id"));
      if (!queued.isEmpty()) badge(body, "Yuborilmagan qaydlar: " + queued.size(), "PENDING");
    }
    java.util.ArrayList<JSONObject> selected = new java.util.ArrayList<>();
    LocalDate today = LocalDate.now(ZoneId.of("Asia/Tashkent"));
    for (int i = 0; i < doses.length(); i++) {
      JSONObject d = doses.getJSONObject(i);
      Instant at = Instant.parse(d.getString("scheduled_at"));
      if (medicationFilter.equals("Bugun")
          && !at.atZone(ZoneId.of("Asia/Tashkent")).toLocalDate().equals(today)) continue;
      if (medicationFilter.equals("Qayd kutilmoqda")
          && (!d.isNull("record") || !d.isNull("cancelled_at") || at.isAfter(Instant.now())))
        continue;
      selected.add(d);
    }
    selected.sort((a, b) -> a.optString("scheduled_at").compareTo(b.optString("scheduled_at")));
    label(body, "Qabullar: " + selected.size() + " · Bemorning shaxsiy qaydlari");
    String lastDate = "";
    for (int i = 0; i < Math.min(medicationLimit, selected.size()); i++) {
      JSONObject dose = selected.get(i), item = dose.getJSONObject("item_details");
      String date =
          Instant.parse(dose.getString("scheduled_at"))
              .atZone(ZoneId.of("Asia/Tashkent"))
              .format(DateTimeFormatter.ofPattern("dd.MM.yyyy"));
      if (!lastDate.equals(date)) {
        TextView day = text(date, 14, INK);
        day.setTypeface(Design.font(this, true));
        body.addView(day);
        lastDate = date;
      }
      LinearLayout c = card();
      String state =
          !dose.isNull("cancelled_at")
              ? "CANCELLED"
              : queued.contains(dose.optString("id")) ? "PENDING" : dose.optString("status");
      badge(
          c,
          state.equals("PENDING") ? "Qurilmada saqlangan · Yuborish kutilmoqda" : status(state),
          state);
      TextView name = text(val(item, "name"), 21, INK);
      name.setTypeface(Design.font(this, true));
      c.addView(name);
      label(c, val(item, "prescribed_dose_text") + " · " + val(item, "route"));
      TextView time = text(when(dose.optString("scheduled_at")), 18, GREEN);
      time.setTypeface(Design.font(this, true));
      c.addView(time);
      label(c, val(item, "instructions"));
      if (!doctor() && !dose.isNull("record"))
        secondary(c, "Qaydni tuzatish", () -> new ClinicalUi(this).correction(dose, patient));
      boolean due = !Instant.parse(dose.getString("scheduled_at")).isAfter(Instant.now());
      if (!doctor()
          && due
          && dose.isNull("record")
          && dose.isNull("cancelled_at")
          && !queued.contains(dose.optString("id"))) {
        button(c, "Ichdim", () -> recordDose(dose, "TAKEN", patient));
        secondary(c, "O‘tkazib yubordim", () -> recordDose(dose, "SKIPPED", patient));
      }
    }
    if (selected.isEmpty()) {
      empty(
          "Bu bo‘limda qabul yo‘q.",
          doses.length() == 0
              ? "Tasdiqlangan dori jadvali hozircha yo‘q."
              : "Boshqa kunlar uchun barcha qabullarni oching.",
          "pill");
      if (doses.length() > 0)
        secondary(
            body,
            "Barcha qabullarni ko‘rish",
            () -> {
              medicationFilter = "Barcha qabullar";
              try {
                medicationUI(patient, cached);
              } catch (Exception ignored) {
              }
            });
    }
    if (selected.size() > medicationLimit)
      secondary(
          body,
          "Yana 40 ta qabulni ko‘rsatish",
          () -> {
            medicationLimit += 40;
            int y = contentScroll.getScrollY();
            try {
              medicationUI(patient, cached);
              contentScroll.post(() -> contentScroll.scrollTo(0, y));
            } catch (Exception ignored) {
            }
          });
    if (!doctor()) {
      LinearLayout settings = card();
      TextView heading = text("Eslatma va sinxronlash", 18, INK);
      heading.setTypeface(Design.font(this, true));
      settings.addView(heading);
      label(
          settings,
          getSystemService(NotificationManager.class).areNotificationsEnabled()
              ? "Bildirishnomalar yoqilgan"
              : "Bildirishnomalar o‘chirilgan");
      secondary(settings, "Eslatmalarga ruxsat berish", this::notificationPermission);
      if (Build.VERSION.SDK_INT >= 31
          && !getSystemService(AlarmManager.class).canScheduleExactAlarms()) {
        label(settings, "Aniq vaqtli eslatma ruxsati yo‘q; eslatma kechikishi mumkin.");
        secondary(
            settings,
            "Aniq vaqtli eslatmani yoqish",
            () ->
                startActivity(
                    new Intent(
                        android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                        Uri.parse("package:" + getPackageName()))));
      }
      secondary(settings, "Saqlangan jadvalni ko‘rish", () -> cachedMedication(patient));
      secondary(settings, "Yuborilmagan qaydlar", () -> new ClinicalUi(this).queue());
      label(
          settings,
          "Dorini o‘zgartirish uchun shifokorga yozing. Eslatma Android batareya cheklovlari sabab"
              + " kechikishi mumkin.");
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
    label(c, "MedicineTrack " + BuildConfig.VERSION_NAME);
    label(
        c,
        "Bildirishnomalar: "
            + (getSystemService(NotificationManager.class).areNotificationsEnabled()
                ? "yoqilgan"
                : "o‘chirilgan"));
    label(c, "Server: " + api.base);
    secondary(c, "Bildirishnomalar", () -> new ClinicalUi(this).notifications());
    danger(
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
    if (busy) return;
    if (screen.equals("Asosiy") || screen.equals("Kirish")) super.onBackPressed();
    else goBack();
  }
}
