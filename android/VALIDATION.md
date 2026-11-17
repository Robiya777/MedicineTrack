# Android validation — 2026-11-17

Backend baseline: `7e6e705`; Android version: `0.1.0`, application ID `uz.medicinetrack.app`.

## Verified

- `:app:assembleDebug`, `:app:assembleDebugAndroidTest`, `:app:lintDebug`: PASS.
- Android 14 / API 34 x86_64 emulator `qurmart_test`, device `emulator-5554`.
- `FlowChecks`: **27 checks PASS** against the actual Django backend at emulator `10.0.2.2:8011/api/v1`, using a fresh isolated SQLite DB and synthetic seed only.
- Patient and doctor login, secure session roundtrip, encrypted on-disk storage without plaintext refresh or medication name, invalid-access refresh rotation.
- Patient medication list rendered from all API pages; TAKEN retry deduplicated; offline SKIPPED queue preserved on refused connection and cleared only after real server acknowledgement.
- Actual AlarmManager → manifest receiver → generic Android notification delivered in emulator; asynchronous notification cleanup checked.
- Chat payload retries deduplicated, status update stored, doctor replies; conversation screen rendered with send controls.
- Doctor task list/detail rendered, task accepted and completed through the Android API client, doctor medication access verified.
- Patient/doctor screenshots visually inspected. Test calls some mutations directly through the Android API client; it is not an exhaustive tap-by-tap UI test.
- Native client uses Java 17/platform Views; no extra runtime dependencies. Debug APK and test APK successfully installed.

Screenshots and local APK are outside source control at `/home/java/MedicineTrack-artifacts/`; no passwords, tokens, local DBs or secret files are committed. Test runner requires an environment variable for the synthetic password. Earlier notification-cleanup timing failure was fixed by waiting for asynchronous system cancellation; the fresh-database rerun passed.

## Limits

Lint: no errors; one `OldTargetApi` warning (target 34). The checked artifact is a **debug prototype**, not a Play-ready release. Emulator validation does not establish physical-device reliability.

Not verified: real-device battery restrictions, force-stop/reboot end-to-end, long-duration alarm chaining, production TLS hosting, background push, concurrent production load, clinical use or real patient data. Boot rescheduling code exists; no full reboot result is claimed. Offline conflict/correction UI, patient activation UI, plan authoring/approval UI and process-death draft recovery remain unfinished; see README.

Alarm uses `setAndAllowWhileIdle`, not exact scheduling: delays are possible. Real server schedule changes are fetched on refresh, not via guaranteed background sync. The app must remain a demonstration with synthetic patients until the remaining operational and clinical requirements are resolved.
