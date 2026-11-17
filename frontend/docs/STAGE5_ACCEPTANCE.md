# Dori jadvali — web qabul hisoboti

2026-11-18. Lokal Django, alohida sintetik SQLite baza, bir Chromium contextida
statsionar, shifokor va bemor sessiyalari bilan tekshirildi.

- Statsionar manbali DRAFT yaratdi. Bemorga ko‘rinmadi; operatorda klinik tasdiq
  tugmasi yo‘q. Klinik ruxsatli shifokor approve qildi.
- Server hisoblagan muddati kelgan va kelajakdagi occurrence’lar ko‘rindi.
  Kelajakdagi qabul uchun yozish tugmasi yo‘q. Qaydsiz holat avtomatik SKIPPED emas.
- Bemor TAKEN qaydini yubordi. Server saqlagach javob sun’iy uzildi. Retry aynan
  bir xil payload, client_recorded_at va Idempotency-Key bilan bitta recordni
  Idempotency-Replayed orqali oldi.
- Bemor sabab bilan SKIPPED tuzatishini yubordi. Original/corrections saqlandi;
  shifokor tarixida natija ko‘rindi, unda bemor o‘rniga yozish tugmasi yo‘q.
- Yangi klinik versiya DRAFT bo‘lib ochildi; tasdiqdan so‘ng eski versiya
  almashtirildi. Sababli stop kelajakdagi occurrence’larni bekor qildi.
  Oldingi qabul va tuzatish tarixi saqlandi, bemor refresh orqali holatni oldi.
- 360 px bemor va 1440 px shifokor ekranlari, skrinshotlar va gorizontal surilish
  tekshirildi. React sahifa xatolari aniqlanmadi.
- Backend `pytest tests/test_medications.py -q`: 36 passed, 3 PostgreSQL-specific skipped.
  Bu testlar ruxsat, versiya/lock, vaqt zonasi/DST, limitlar, dublikatlar, kelajak
  qaydi, bekor qilish va boshqa bemorga kirishni rad etishni qamraydi.

AT-34/35/36/38/39/44/45/48ning web/API qismlari qamralgan. AT-40ning web retry,
AT-41ning versiya/tarix va AT-47ning server kech qaydi qismi backend/webga tegishli.
Fizik APK notification, ruxsat rad etilishi, reboot, shifrlangan offline navbat va
web–APK birgalikdagi sync (AT-37/40/41/42/43/46/47) ushbu web tekshiruviga kirmaydi.
