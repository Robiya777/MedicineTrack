# Yordamchi va demo SOS tekshiruvi

2026-11-18, Asia/Tashkent. Sintetik bemorlar bilan kalitsiz demo tekshirildi. Bu klinik validatsiya, fizik telefon yoki haqiqiy 103 xizmatiga ulanish sinovi emas. [Ishlatish va cheklovlar](../backend/docs/ASSISTANT_DEMO.md).

## Natijalar

| Tekshiruv | Natija |
|---|---|
| Backend, alohida PostgreSQL 16 bazasi | **173 passed** |
| Backend, SQLite | **167 passed, 6 skipped**; concurrency testlari PostgreSQLda o‘tdi |
| Android 14, yangi yordamchi oqimi, asosiy 8001 backend | **39 passed** |
| Android, avvalgi funksiyalar va asosiy web bemoriga ulanish | **88 passed** |
| Haqiqiy Chromium, 5173 → 8001, yangi SOS oqimi | **12 passed** |
| Frontend mavjud regressiyalari | **9 passed** |
| Backend Ruff, Django check, migration drift, OpenAPI | O‘tdi; schema warning/error yo‘q |
| Frontend ESLint, TypeScript, production build | O‘tdi |
| Android debug APK, test APK, lint | O‘tdi; 0 error, oldingi `OldTargetApi` warning qolgan |

173 backend testi ichida yangi yordamchiga tegishli 57 ta holat bor: o‘zbek lotin/kirill, rus/ingliz xavfli belgilar, inkor, yaqin va eski tarix, savol-javob konteksti, eski savolni rad etish, dori dozasini belgilamaslik, demo/SOS dublikatlari, rozilik, GPS vaqt/chegara tekshiruvi, ruxsat va biriktirish tugagandan keyin replayni rad etish. Yordamchi klinik murojaatni javob berilgan deb yopmasligi ham tekshirildi.

## Mobil sinov

Android 14/API 34 emulyator, 720×1600 px / 360 dp. Android ilovasi real HTTP APIga ulanib tekshirildi. Avval alohida sintetik SQLite serverda, keyin **asosiy PostgreSQL backend 8001**dagi yangi sintetik bemor/shifokor bilan bajarildi.

Yangi oqimda bemor kirishi → yordamchi suhbatini ochish → bosh og‘rig‘i → tezkor javob → qoralama saqlanishi → xavfli xabar → avtomatik demo SOS → rozilikni bekor qilish → belgilangan demo nuqtasi → foreground GPS → shifokor ko‘rishi/tasdig‘i → alohida shifokor javobi tekshirildi. Qurilma GPSi emulyatorda sintetik koordinata bilan berildi; bu fizik bemor joylashuvini tekshirish emas. 103 harakati `ACTION_DIAL`/`tel:103` ekanligi va server so‘rovi davomida ochiq qolishi tekshirildi. Haqiqiy qo‘ng‘iroq qilinmadi.

88 ta regressiya dori jadvallari, nullable DRAFT, dori qaydi/tuzatish, idempotency, shifrlangan sessiya/kesh, refresh, offline queue, chat, patronaj, AlarmManager signali va webdagi ayni bemor/jadval/suhbat/taskni o‘qishni qamrab oldi. Oqimning ayrim amallari instrumentation orqali, ayrimlari klient API orqali bajarilgan.

## Veb sinov

`http://127.0.0.1:5173` proksisi → `http://127.0.0.1:8001/api/v1`, PostgreSQL, Redis va Celery worker/beat ishladi. Bemor, faol biriktirilgan shifokor va hudud koordinatorining alohida brauzer kontekstlari ishlatildi.

Alomatga mos javob, tezkor savol, davomiylik/kuch javobi, avtomatik demo SOS, rozilikni bekor qilish, brauzer GPS ruxsatini rad qilish, demo koordinatasini belgilash, sintetik qurilma GPSini olish, shifokor/koordinator kabinetida ayni SOS va GPS, xodim tasdig‘i, haqiqiy notification worker orqali ichki bildirishnoma va shifokorning alohida javobi o‘tdi. 360 px kenglikda gorizontal overflow yo‘q. Brauzerda **0 JavaScript page error, 0 HTTP 5xx**.

Mashina o‘qiydigan natija: [qa/assistant-demo-2026-11-18.json](qa/assistant-demo-2026-11-18.json). Suratlar: [Androiddagi GPS](qa/assistant-demo-2026-11-18/android-location.png), [shifokor SOS kabineti](qa/assistant-demo-2026-11-18/web-doctor-sos.png).

## Takrorlash

Backend: `cd backend && .venv/bin/pytest -q`. PostgreSQL uchun `DATABASE_URL`ni alohida test bazasiga sozlang. SQLite row lock concurrency tekshiruvini bajarmaydi.

Chromium uchun yangi sintetik fixture yarating; avval ishlatilgan klinik savol/SOS holatini qayta ishlatmang:

```bash
mkdir -p /tmp/medicinetrack-assistant-qa
docker compose -f backend/compose.yaml exec -T api python manage.py shell -v 0 \
  < scripts/create-browser-audit-fixture.py > /tmp/medicinetrack-assistant-qa/fixture.json
PLAYWRIGHT_PACKAGE_DIR=/tmp/medicinetrack-browser-audit node scripts/assistant-demo-check.mjs
```

Playwright mavjud katalogi va `/usr/bin/google-chrome` talab qilinadi; kerak bo‘lsa `PLAYWRIGHT_PACKAGE_DIR`, `QA_BASE_URL`, `QA_FIXTURE`, `QA_OUTPUT` beriladi. Skript parolni lokal `.env`dan oladi va natijaga chiqarmaydi. Faqat sintetik demo muhitida ishlating.

Android uchun yangi sintetik bemor bilan `android/scripts/run_checks.py --mode assistant --base <api> --patient-user <login> --doctor-user <login>` ishlatiladi. `MEDICINETRACK_TEST_PASSWORD`ni maxfiy environment orqali bering. `adb emu geo fix 69.234567 41.312345` orqali sintetik nuqta ta’minlanadi. Asosiy regressiya uchun `--mode full`, kichik ekran uchun `--mode layout`. Test APK release tarkibiga kirmaydi.

Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`, versiya **0.5.0 / code 5**, SHA-256 `af217c1d376de7ca340561e4299f8b37be439c1bb0e45e72f6b61ef7cb54e982`.

## Amaliy chegara

Kalitsiz demo so‘z/ibora qoidalaridan foydalanadi. Alomatlarni to‘liq aniqlash, tashxis yoki davolashni almashtirish kafolatlanmaydi. SOS ichki simulyatsiya; haqiqiy 103 dispetcheri, SMS va push integratsiyasi mavjud emas. GPS mijoz tomonidan yuboriladi va uzluksiz kuzatilmaydi. Ommaviy HTTPS, release signing, yangi Play target talablari va fizik qurilma sinovi oldingi tashqi ishlar bo‘lib qolgan. Frontend buildidagi mavjud katta chunk va Androidning target 34 ogohlantirishlari bu demo sinovini bloklamadi.
