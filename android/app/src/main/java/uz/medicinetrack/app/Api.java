package uz.medicinetrack.app;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.json.*;

final class Api {
  static final class Failure extends IOException {
    final int status;

    Failure(int s, String text) {
      super(text);
      status = s;
    }
  }

  final Vault vault;
  String base = "", access = "", refresh = "";
  JSONObject user = new JSONObject();

  Api(Vault v) {
    vault = v;
  }

  void restore() throws Exception {
    String value = vault.get("session");
    if (!value.isEmpty()) {
      JSONObject s = new JSONObject(value);
      base = s.getString("base");
      access = s.getString("access");
      refresh = s.getString("refresh");
      user = s.getJSONObject("user");
    }
  }

  void save() throws Exception {
    vault.put(
        "session",
        new JSONObject()
            .put("base", base)
            .put("access", access)
            .put("refresh", refresh)
            .put("user", user)
            .toString());
  }

  void login(String url, String username, String password) throws Exception {
    URI uri = new URI(url.trim());
    boolean local =
        BuildConfig.DEBUG
            && ("10.0.2.2".equals(uri.getHost())
                || "127.0.0.1".equals(uri.getHost())
                || "localhost".equals(uri.getHost()));
    if (uri.getHost() == null
        || uri.getUserInfo() != null
        || uri.getQuery() != null
        || uri.getFragment() != null
        || !("https".equals(uri.getScheme()) || (local && "http".equals(uri.getScheme()))))
      throw new IOException("HTTPS server manzilini kiriting. Lokal HTTP faqat debug uchun.");
    base = url.trim().replaceAll("/+$", "");
    access = "";
    refresh = "";
    JSONObject tokens =
        raw(
            "POST",
            "/auth/login",
            new JSONObject()
                .put("username", username)
                .put("password", password)
                .put("client", "android"),
            null);
    user = tokens.getJSONObject("user");
    String role = user.optString("role");
    if (!role.equals("DOCTOR") && !role.equals("PATIENT"))
      throw new IOException("Bu ilova bemor va oilaviy shifokor uchun.");
    access = tokens.getString("access");
    refresh = tokens.getString("refresh");
    save();
  }

  synchronized JSONObject call(String method, String path, JSONObject data, String key)
      throws Exception {
    try {
      return raw(method, path, data, key);
    } catch (Failure e) {
      if (e.status != 401 || refresh.isEmpty()) throw e;
      try {
        JSONObject tokens =
            raw("POST", "/auth/refresh", new JSONObject().put("refresh", refresh), null);
        access = tokens.getString("access");
        refresh = tokens.getString("refresh");
        user = tokens.getJSONObject("user");
        save();
      } catch (Failure x) {
        if (x.status != 401 && x.status != 403) throw x;
        access = "";
        refresh = "";
        vault.clear();
        throw new Failure(401, "Sessiya tugadi. Qayta kiring.");
      }
      return raw(method, path, data, key);
    }
  }

  JSONObject get(String path) throws Exception {
    return call("GET", path, null, null);
  }

  JSONObject post(String path, JSONObject data, String key) throws Exception {
    return call("POST", path, data, key);
  }

  JSONArray list(String path) throws Exception {
    JSONArray all = new JSONArray();
    int page = 1;
    while (true) {
      JSONObject out = get(path + (path.contains("?") ? "&" : "?") + "page_size=100&page=" + page);
      JSONArray rows = out.optJSONArray("results");
      if (rows == null) throw new IOException("API ro‘yxat shakli mos emas");
      for (int i = 0; i < rows.length(); i++) all.put(rows.get(i));
      if (out.isNull("next") || out.optString("next").isEmpty()) return all;
      if (++page > 100) throw new IOException("Ro‘yxat juda katta. Filtrni toraytiring.");
    }
  }

  private JSONObject raw(String method, String path, JSONObject data, String key) throws Exception {
    HttpURLConnection conn = (HttpURLConnection) new URL(base + path).openConnection();
    conn.setInstanceFollowRedirects(false);
    conn.setConnectTimeout(12000);
    conn.setReadTimeout(20000);
    conn.setRequestMethod(method);
    conn.setRequestProperty("Accept", "application/json");
    if (!access.isEmpty()) conn.setRequestProperty("Authorization", "Bearer " + access);
    if (key != null) {
      byte[] digest =
          java.security.MessageDigest.getInstance("SHA-256")
              .digest((data == null ? "" : data.toString()).getBytes(StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder();
      for (byte b : digest) hex.append(String.format("%02x", b));
      conn.setRequestProperty("Idempotency-Key", key + "-" + hex);
    }
    try {
      if (data != null) {
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/json");
        try (OutputStream out = conn.getOutputStream()) {
          out.write(data.toString().getBytes(StandardCharsets.UTF_8));
        }
      }
      int status = conn.getResponseCode();
      InputStream stream = status < 400 ? conn.getInputStream() : conn.getErrorStream();
      String text = "";
      if (stream != null)
        try (InputStream in = stream) {
          ByteArrayOutputStream bytes = new ByteArrayOutputStream();
          byte[] buffer = new byte[4096];
          int count;
          while ((count = in.read(buffer)) != -1) {
            bytes.write(buffer, 0, count);
            if (bytes.size() > 8_000_000) throw new IOException("Javob hajmi juda katta");
          }
          text = new String(bytes.toByteArray(), StandardCharsets.UTF_8);
        }
      JSONObject json;
      try {
        json = text.isEmpty() ? new JSONObject() : new JSONObject(text);
      } catch (JSONException e) {
        throw new IOException("Server javobi JSON emas (" + status + ")");
      }
      if (status < 200 || status >= 300) {
        String message =
            json.optString(
                "message", json.optString("detail", "So‘rov bajarilmadi (" + status + ")"));
        if (json.has("fields")) message += "\n" + json.get("fields").toString();
        throw new Failure(status, message);
      }
      return json;
    } finally {
      conn.disconnect();
    }
  }

  static String key() {
    return UUID.randomUUID().toString();
  }
}
