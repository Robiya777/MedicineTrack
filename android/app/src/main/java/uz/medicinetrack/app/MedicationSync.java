package uz.medicinetrack.app;

import android.content.Context;
import org.json.*;

final class MedicationSync {
  static void flush(Api api, Vault vault) throws Exception {
    String saved = vault.get("dose_queue");
    JSONArray queue = saved.isEmpty() ? new JSONArray() : new JSONArray(saved);
    JSONArray remaining = new JSONArray();
    String problem = "";
    for (int i = 0; i < queue.length(); i++) {
      JSONObject entry = queue.getJSONObject(i);
      try {
        api.post(
            "/dose-occurrences/" + entry.getString("id") + "/record",
            entry.getJSONObject("payload"),
            entry.getString("key"));
      } catch (Api.Failure e) {
        if (e.status == 401) throw e;
        entry.put("error", e.getMessage());
        remaining.put(entry);
        problem = e.getMessage();
      } catch (Exception e) {
        entry.put("error", "Ulanish yo‘q. Qayd qurilmada saqlangan.");
        remaining.put(entry);
        problem = "Ulanish yo‘q";
      }
    }
    vault.put("dose_queue", remaining.toString());
    if (remaining.length() > 0)
      throw new Exception("Yuborilmagan qaydlar: " + remaining.length() + ". " + problem);
  }

  static JSONArray fetch(Api api, String patient) throws Exception {
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
    return rows;
  }

  static void sync(Context c) throws Exception {
    Vault vault = new Vault(c);
    Api api = new Api(vault);
    api.restore();
    if (api.access.isEmpty() || !api.user.optString("role").equals("PATIENT")) return;
    api.get("/me");
    String warning = "";
    try {
      flush(api, vault);
    } catch (Api.Failure e) {
      throw e;
    } catch (Exception e) {
      warning = e.getMessage();
    }
    JSONArray rows = fetch(api, api.user.getString("patient"));
    Reminders.save(c, rows);
    vault.put("sync_warning", warning);
  }
}
