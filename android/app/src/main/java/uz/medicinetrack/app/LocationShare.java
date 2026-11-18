package uz.medicinetrack.app;

import android.Manifest;
import android.app.AlertDialog;
import android.content.pm.PackageManager;
import android.location.*;
import android.os.*;
import java.time.Instant;

/** Foreground, one-shot GPS sharing; never captures or uploads without consent. */
final class LocationShare {
  static final int PERMISSION = 81;
  final MainActivity m;
  String incident = "", user = "";
  int generation;
  boolean awaitingPermission;
  LocationManager manager;
  CancellationSignal signal;
  LocationListener listener;
  final Runnable timeout;

  LocationShare(MainActivity activity) {
    m = activity;
    timeout =
        () -> {
          cancel();
          m.message(
              "Lokatsiya topilmadi. Joylashuv xizmatini yoqib qayta urinib ko‘ring. Hech qanday"
                  + " koordinata yuborilmadi.");
        };
  }

  void confirm(String id) {
    new AlertDialog.Builder(m)
        .setTitle("Lokatsiyangizni ulashishga rozimisiz?")
        .setMessage(
            "Hozirgi qurilma lokatsiyasi demo SOS yozuviga qo‘shiladi. Uni mas’ul shifokor va hudud"
                + " koordinatorlari ko‘ra oladi. 103 xizmatiga avtomatik yuborilmaydi. Fon rejimida"
                + " kuzatish yo‘q.")
        .setNegativeButton("Bekor qilish", null)
        .setPositiveButton("Roziman, lokatsiyani ulashish", (d, w) -> start(id))
        .show();
  }

  void start(String id) {
    cancel();
    incident = id;
    generation = m.generation;
    user = m.api.user.optString("id");
    if (m.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        && m.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
      awaitingPermission = true;
      m.requestPermissions(
          new String[] {
            Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION
          },
          PERMISSION);
    } else locate();
  }

  void permissionResult() {
    awaitingPermission = false;
    if (incident.isEmpty()) return;
    if (m.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED
        || m.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED) locate();
    else {
      cancel();
      m.message(
          "Lokatsiya ruxsati berilmadi. Koordinatalar yuborilmadi. 103 ga telefon qilib manzilni"
              + " aytishingiz mumkin.");
    }
  }

  void locate() {
    if (!current()) {
      cancel();
      return;
    }
    manager = m.getSystemService(LocationManager.class);
    boolean fine =
        m.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    String provider =
        fine && manager.isProviderEnabled(LocationManager.GPS_PROVIDER)
            ? LocationManager.GPS_PROVIDER
            : manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
                ? LocationManager.NETWORK_PROVIDER
                : null;
    if (provider == null) {
      cancel();
      m.message(
          "Joylashuv xizmati o‘chirilgan yoki ruxsatga mos manba yo‘q. Telefon sozlamasidan yoqing"
              + " va qayta urinib ko‘ring.");
      return;
    }
    m.message("Lokatsiya aniqlanmoqda…");
    try {
      Location cached = manager.getLastKnownLocation(provider);
      if (cached != null
          && System.currentTimeMillis() - cached.getTime() >= 0
          && System.currentTimeMillis() - cached.getTime() <= 60000) {
        found(cached);
        return;
      }
      m.handler.postDelayed(timeout, 15000);
      if (Build.VERSION.SDK_INT >= 30) {
        signal = new CancellationSignal();
        manager.getCurrentLocation(provider, signal, m.getMainExecutor(), this::found);
      } else {
        listener =
            new LocationListener() {
              @Override
              public void onLocationChanged(Location location) {
                found(location);
              }

              @Override
              public void onStatusChanged(String p, int status, Bundle extras) {}

              @Override
              public void onProviderEnabled(String p) {}

              @Override
              public void onProviderDisabled(String p) {}
            };
        manager.requestSingleUpdate(provider, listener, Looper.getMainLooper());
      }
    } catch (SecurityException error) {
      cancel();
      m.message("Lokatsiya ruxsati bekor qilingan. Koordinatalar yuborilmadi.");
    }
  }

  boolean current() {
    return !m.isDestroyed()
        && generation == m.generation
        && user.equals(m.api.user.optString("id"))
        && !incident.isEmpty();
  }

  void found(Location location) {
    if (!current()) {
      cancel();
      return;
    }
    if (location == null) {
      cancel();
      m.message("Lokatsiya topilmadi. Qayta urinib ko‘ring.");
      return;
    }
    long age = System.currentTimeMillis() - location.getTime();
    if (age > 300000 || age < -30000) {
      cancel();
      m.message("Lokatsiya vaqti eskirgan. Qayta aniqlang.");
      return;
    }
    String id = incident, key = Api.key();
    double lat = Math.rint(location.getLatitude() * 1e6) / 1e6,
        lon = Math.rint(location.getLongitude() * 1e6) / 1e6;
    double accuracy = location.hasAccuracy() ? location.getAccuracy() : 100000;
    String recorded = Instant.ofEpochMilli(location.getTime()).toString();
    cancel();
    m.message("");
    m.execute(
        () ->
            m.api.post(
                "/assistant/emergencies/" + id + "/location",
                MainActivity.json(
                    "consent",
                    true,
                    "source",
                    "DEVICE",
                    "latitude",
                    lat,
                    "longitude",
                    lon,
                    "accuracy_m",
                    accuracy,
                    "recorded_at",
                    recorded),
                key),
        v -> new AssistantUi(m).incident(id));
  }

  void pause() {
    if (!awaitingPermission) cancel();
  }

  void cancel() {
    m.handler.removeCallbacks(timeout);
    if (signal != null) {
      signal.cancel();
      signal = null;
    }
    if (manager != null && listener != null) {
      try {
        manager.removeUpdates(listener);
      } catch (SecurityException ignored) {
      }
      listener = null;
    }
    incident = "";
    awaitingPermission = false;
  }
}
