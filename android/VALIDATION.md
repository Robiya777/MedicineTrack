# Android validation — 2026-11-18 / 0.3.0

Frontend bilan umumiy teal/mint dizayn Android native ekranlariga ulandi. Kod `android/` ichida; backenddagi yagona konfiguratsiya qo‘shimchasi emulator uchun `10.0.2.2` hostidir.

## Yakuniy natija

| Tekshiruv | Natija |
|---|---|
| `:app:assembleDebug` | PASS |
| `:app:assembleDebugAndroidTest` | PASS |
| `:app:lintDebug` | PASS: 0 error, 1 `OldTargetApi` warning |
| Android 14 / API 34, 360 dp, 100% shrift | **81 tekshiruv PASS** |
| Android 14 / API 34, 320 dp, 130% shrift | **31 tekshiruv PASS** |
| Albom holati, cold start va sessiya tiklanishi | Qo‘lda tekshirildi, PASS |
| APK imzosi | APK Signature Scheme v2: verified |
| Android crash buffer | 0 yozuv |

JDK 17, Gradle 8.14, AGP 8.11.1; compile SDK 36, build-tools 35.0.0, min SDK 26, target SDK 34. Debug APK: `app/build/outputs/apk/debug/app-debug.apk`.

## Tekshirilgan oqimlar

- Native kirish formasi, bo‘sh login validatsiyasi, parolni ko‘rsatish/yashirish, patient/doctor sessiyasi, Keystore orqali shifrlash va access refresh.
- Bemor bosh sahifasi va API asosidagi ko‘rsatkichlar; dori jadvali; TAKEN qaydi; ayni so‘rovning qaytariq dublikat himoyasi; faqat izoh tuzatilganda original qabul vaqti, soniyalar va kasr qismi saqlanishi.
- Offline SKIPPED navbati transport xatosida saqlanadi va server tasdig‘idan keyin tozalanadi; haqiqiy AlarmManager receiver generic notification chiqardi; tozalash, shifrlangan kesh va periodic sync job tekshirildi.
- Chat, yuborish kontrakti va retry dublikat himoyasi, bemor holati, shifokor javobi, o‘qilganlik, saqlangan chernovik, orqaga qaytish, bildirishnoma ekrani.
- Chaqiruv ro‘yxati/tafsiloti, qabul qilish/yakunlash APIlari, native hisobot correction formasi; dori DRAFT formasi, nullable ko‘rsatma, approve/revision/stop va aktivatsiya formasi.
- Har ikki rolda pastki menyuning faol bo‘limi, matnning sig‘ishi va kamida 44 dp bosish sohasi; 320 dp/130% rejimida klaviatura ochilganda menyu yashirilishi va xabar maydonining ko‘rinishi.

Asosiy yozuvchi tekshiruvlar alohida yangi sintetik SQLite backendda (`8013`) bajarildi. Ishlayotgan webning PostgreSQL backendiga (`8001`) Android orqali alohida ulanildi: avvalgi web auditning `c629dcc6` bemori, dori jadvali va suhbati ko‘rindi; webda yaratilgan va yakunlangan `11f20334-142d-454d-9665-0bd53f9dd6c8` chaqiruvi ham ayni holatda o‘qildi. Web testining hisobotidan aniq patient/task ID olinadi va fixture run mosligi tekshiriladi. Bu bosqich klinik yozuvlarni o‘zgartirmaydi.

Dalillar: [JSON hisobot](../docs/qa/android-2026-11-18/report.json), [kirish](../docs/qa/android-2026-11-18/login.png), [bemor](../docs/qa/android-2026-11-18/patient-home.png), [shifokor](../docs/qa/android-2026-11-18/doctor-tasks.png), [320 dp / 130%](../docs/qa/android-2026-11-18/doctor-320-font130.png), [klaviatura](../docs/qa/android-2026-11-18/keyboard-320-font130.png), [webdagi chaqiruv Androidda](../docs/qa/android-2026-11-18/linked-web-task.png).

## Takrorlash va chegaralar

`README.md`dagi build va `scripts/run_checks.py` asosiy sintetik testni ishga tushiradi. Web bilan bog‘lanish uchun qo‘shimcha `--linked-base`, `--linked-fixture`, `--linked-report` va `MEDICINETRACK_LINKED_PASSWORD` kerak. Kichik ekran tekshiruvi uchun `--mode layout --patient-user ... --doctor-user ...` ishlatiladi; oldin emulator density/font scale moslanadi. Parollar, tokenlar va aktivatsiya kodlari hisobotga yozilmaydi.

Sinovlar API assertionlari va native forma/menyu amallarini birlashtiradi; har bir tugmani haqiqiy koordinata orqali bosadigan to‘liq test emas. Fizik telefonlar, uzoq batareya sinovi, barcha Android/OEM versiyalari va Play release tekshirilmagan. Target 34 sabab Play uchun target/edge-to-edge ishlari alohida qoladi. Eski reboot dalili quyida tarix sifatida saqlangan; yangi versiyada reboot qayta bajarilmadi.

## Oldingi 0.2.0 tekshiruvi — 2026-11-17

Backend baseline: `7e6e705`; Android version: `0.2.0`, application ID `uz.medicinetrack.app`.

### Verified

- `:app:assembleDebug`, `:app:assembleDebugAndroidTest`, `:app:lintDebug`: PASS.
- Android 14 / API 34 x86_64 emulator `qurmart_test`, device `emulator-5554`.
- `FlowChecks`: **45 checks PASS** against the actual Django backend at emulator `10.0.2.2:8013/api/v1`, using a fresh isolated SQLite DB and synthetic seed only.
- Patient and doctor login, secure session roundtrip, encrypted on-disk storage without plaintext refresh or medication name, invalid-access refresh rotation.
- Patient medication list rendered from all API pages; TAKEN retry deduplicated; offline SKIPPED queue preserved on refused connection and cleared only after real server acknowledgement.
- Actual AlarmManager → manifest receiver → generic Android notification delivered in emulator; asynchronous notification cleanup checked.
- Chat payload retries deduplicated, status update stored, doctor replies; conversation screen rendered with send controls.
- Doctor task list/detail rendered, task accepted and completed through the Android API client, doctor medication access verified.
- Patient/doctor screenshots visually inspected. Test calls some mutations directly through the Android API client; it is not an exhaustive tap-by-tap UI test.
- Native client uses Java 17/platform Views; no extra runtime dependencies. Debug APK and test APK successfully installed.

Screenshots and local APK are outside source control at `/home/java/MedicineTrack-artifacts/`; no passwords, tokens, local DBs or secret files are committed. Test runner requires an environment variable for the synthetic password. Earlier notification-cleanup timing failure was fixed by waiting for asynchronous system cancellation; the fresh-database rerun passed.

### 0.2.0 additional evidence

- Patient activation form was filled and submitted in the emulator with a newly issued synthetic one-use code; it created and opened the expected patient account.
- Native multi-field medication form created a server DRAFT. Clinical approval, revision (old ACTIVE retained until approval), replacement approval and STOPPED state were checked against the backend. Plan form and correction screens rendered.
- Doctor report correction was submitted from its native form and the returned append-only correction displayed. Dose correction version increment checked.
- Draft medication text survived leaving/reopening its contextual form. Chat draft survived leaving/reopening the conversation. Form values remain encrypted in Vault.
- Pending queue UI rendered; offline entries retained after failed transport and only acknowledged entries removed. Server-error entries retain an explicit error and can be individually discarded after confirmation.
- Background sync repository executed through the shared worker. OS JobScheduler job 2401 registered and `cmd jobscheduler run -f` accepted it. Medication alarms existed after sync.
- The actual emulator was rebooted: BOOT_COMPLETED restored `ReminderReceiver` alarms (observed in `dumpsys alarm`), and persistent job 2401 remained `waiting`. This is emulator evidence only.
- A missing ACCESS_NETWORK_STATE permission found by the first job-enabled run was fixed; subsequent complete run passed. Final source builds and lint pass.

### Limits

Lint: 0 errors, 3 warnings (OldTargetApi, ObsoleteSdkInt, SetTextI18n). The artifact is a **debug prototype**, not a Play-ready release. Tests combine API checks and native screen/form interactions; not every dialog/control or every TZ acceptance criterion has an independent end-to-end test.

Not verified: real-device battery restrictions, long-duration scheduling, optional exact-alarm delivery on physical hardware, force-stop recovery on every OEM, production TLS hosting, real push/SMS, production concurrency or clinical use. Reboot recovery and inexact notification delivery were verified on API 34 emulator. Current screen and spinner/checkbox selections are not restored; contextual text drafts are. See README for remaining operational limits.


## 2026-11-18 — frontend dizayniga moslashuv (0.3.0)

Reference: main `5e97667`, frontend DESIGN_SYSTEM.md va src/index.css. DM Sans fonti ilova ichiga joylandi (internet talab qilmaydi). Umumiy native komponentlar rang, chegaralar, yumaloqlik va navigatsiya bo‘yicha moslashtirildi; kirish sahifasi yangilandi. Dori sahifasidagi yordamchi boshqaruvlar ochiladigan bo‘limga yig‘ildi.

API 34 emulatorda login, bemor bosh sahifasi, dorilar, suhbat, shifokor ro‘yxati, tafsilot va dori formasi screenshotlari ko‘rib chiqildi. Lokal sintetik backendga qarshi dastlab 45 ta tekshiruv, yakuniy takroriy yugurishda 42 ta tekshiruv o‘tdi (oldingi yugurishda tugallangan task va dori holatlari sabab shartli tekshiruvlar soni kamayadi); assembleDebug/assembleDebugAndroidTest/lintDebug o‘tdi (0 lint error, avvalgi 3 warning). Jismoniy qurilma va production server bu tekshiruvga kirmaydi.


## 2026-11-18 — parvarish budilniklari (0.4.0)

API 34 emulatorda yakuniy yangi sintetik bazaga qarshi **52 checks PASS**. Dori AlarmManager receiver’i va yangi ahvol AlarmReceiver’i haqiqiy notification chiqardi. 08:00→11:00, 20:00→ertasi 08:00 hisoblari, snooze timestampining qayta rejalashda saqlanishi, o‘chirilganda timestamp bekor bo‘lishi tekshirildi. Budilnik Activity preview va holat formasiga o‘tish screenshotlari olindi. Bemor kirganda jadval avtomatik sinxronlanadi; fon job va lokal cache saqlanadi.

assembleDebug / assembleDebugAndroidTest / lintDebug o‘tdi: 0 errors, 4 warnings (old target API, redundant v26 resource folder, 2 literal UI strings). Ikki takroriy test lokal login throttlega tushgan; yangi ajratilgan backend jarayoni va bazada mavjud throttle qoidalarini o‘zgartirmasdan to‘liq test o‘tdi.

Chegara: full-screen Activity ko‘rinishi foreground preview bilan tekshirildi; qulflangan jismoniy telefonda avtomatik ochilish, ovozning real eshitilishi, API 26 runtime, uzoq muddatli interval va OEM batareya cheklovlari tekshirilmagan. Full-screen va exact alarm maxsus ruxsatlari mavjud bo‘lmaganda notification/inexact fallback ishlatiladi. Avvalgi reboot tiklash dalili 0.2.0ga tegishli; yangi health boot yo‘li kodga ulangan, shu versiyada jismoniy reboot sinovi bajarilmadi. Holatning haqiqiy yuborilishi bemorning tasdig‘ini talab qiladi.
