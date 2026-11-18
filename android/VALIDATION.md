# Android validation — 2026-11-17

Backend baseline: `7e6e705`; Android version: `0.2.0`, application ID `uz.medicinetrack.app`.

## Verified

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

## 0.2.0 additional evidence

- Patient activation form was filled and submitted in the emulator with a newly issued synthetic one-use code; it created and opened the expected patient account.
- Native multi-field medication form created a server DRAFT. Clinical approval, revision (old ACTIVE retained until approval), replacement approval and STOPPED state were checked against the backend. Plan form and correction screens rendered.
- Doctor report correction was submitted from its native form and the returned append-only correction displayed. Dose correction version increment checked.
- Draft medication text survived leaving/reopening its contextual form. Chat draft survived leaving/reopening the conversation. Form values remain encrypted in Vault.
- Pending queue UI rendered; offline entries retained after failed transport and only acknowledged entries removed. Server-error entries retain an explicit error and can be individually discarded after confirmation.
- Background sync repository executed through the shared worker. OS JobScheduler job 2401 registered and `cmd jobscheduler run -f` accepted it. Medication alarms existed after sync.
- The actual emulator was rebooted: BOOT_COMPLETED restored `ReminderReceiver` alarms (observed in `dumpsys alarm`), and persistent job 2401 remained `waiting`. This is emulator evidence only.
- A missing ACCESS_NETWORK_STATE permission found by the first job-enabled run was fixed; subsequent complete run passed. Final source builds and lint pass.

## Limits

Lint: 0 errors, 3 warnings (OldTargetApi, ObsoleteSdkInt, SetTextI18n). The artifact is a **debug prototype**, not a Play-ready release. Tests combine API checks and native screen/form interactions; not every dialog/control or every TZ acceptance criterion has an independent end-to-end test.

Not verified: real-device battery restrictions, long-duration scheduling, optional exact-alarm delivery on physical hardware, force-stop recovery on every OEM, production TLS hosting, real push/SMS, production concurrency or clinical use. Reboot recovery and inexact notification delivery were verified on API 34 emulator. Current screen and spinner/checkbox selections are not restored; contextual text drafts are. See README for remaining operational limits.


## 2026-11-18 — frontend dizayniga moslashuv (0.3.0)

Reference: main `5e97667`, frontend DESIGN_SYSTEM.md va src/index.css. DM Sans fonti ilova ichiga joylandi (internet talab qilmaydi). Umumiy native komponentlar rang, chegaralar, yumaloqlik va navigatsiya bo‘yicha moslashtirildi; kirish sahifasi yangilandi. Dori sahifasidagi yordamchi boshqaruvlar ochiladigan bo‘limga yig‘ildi.

API 34 emulatorda login, bemor bosh sahifasi, dorilar, suhbat, shifokor ro‘yxati, tafsilot va dori formasi screenshotlari ko‘rib chiqildi. Lokal sintetik backendga qarshi dastlab 45 ta tekshiruv, yakuniy takroriy yugurishda 42 ta tekshiruv o‘tdi (oldingi yugurishda tugallangan task va dori holatlari sabab shartli tekshiruvlar soni kamayadi); assembleDebug/assembleDebugAndroidTest/lintDebug o‘tdi (0 lint error, avvalgi 3 warning). Jismoniy qurilma va production server bu tekshiruvga kirmaydi.
