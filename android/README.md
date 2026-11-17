# MedicineTrack Android 0.1.0

Bemor va oilaviy shifokor uchun backendga ulangan birinchi native Android prototip. Package: `uz.medicinetrack.app`; Android 8.0+ (API 26), target/compile 34. Play uchun tayyor release emas.

## Ishlaydigan oqimlar

- Bemor/DOCTOR login, Keystore AES-GCM session storage, refresh rotation va logout.
- Shifokor: barcha sahifalardan chaqiruvlar, tafsilot, telefon terish oynasi, qabul qilish, aloqa urinishi va yakuniy natija.
- Bemor/shifokor: suhbatlar, xabar yuborish, o‘qilganlik, javob siyosati. Bemor: holat yuborish. Foreground chat 15 soniyada yangilanadi; matn yozilayotganda polling ekran matnini almashtirmaydi.
- Bemor: tasdiqlangan dori jadvallari, qabul vaqtlari, Ichdim/SKIPPED qaydlari; shifokor biriktirilgan bemorning jadvali va qaydini ko‘radi.
- Lokal **inexact** AlarmManager eslatmalari, notification permission, bootdan keyin qayta rejalash kodi. Keyingi qabul vaqti rejalashtiriladi; receiver undan keyingisini ulaydi.
- Minimal dori keshi va yuborilmagan qabul qaydlari shifrlanadi. Offline qayd navbatda qoladi, keyingi qo‘lda yangilashda ayni payload/kalit bilan yuboriladi. Server tasdig‘isiz sinxronlandi deyilmaydi.
- Private notification matni, release screenshot himoyasi, backup/transferdan chiqarish, logoutda kesh va eslatmalarni tozalash.

## Build

JDK 17, Android SDK platform 34 va build-tools 34.0.0 kerak. `ANDROID_HOME`ni o‘z SDK katalogingizga yo‘naltiring yoki lokal `local.properties`da `sdk.dir=...` yozing; uni commit qilmang.

```bash
cd android
./gradlew :app:assembleDebug :app:lintDebug :app:assembleDebugAndroidTest
adb -s emulator-5554 install -r app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5554 shell am start -n uz.medicinetrack.app/.MainActivity
```

APK: `app/build/outputs/apk/debug/app-debug.apk`. Gradle wrapper 8.7 va AGP 8.5.2. API 34 emulatorda tekshirilgan birinchi poydevor uchun Java 17 va platform Views tanlandi: qo‘shimcha runtime kutubxonalar yo‘q, barcha biznes qoidalari backendda qoladi. TZdagi Kotlin/Compose texnologiya taklifi keyingi refaktor uchun ochiq; REST kontrakti o‘zgarmaydi.

## Lokal backend va emulator

`backend/README.md` bo‘yicha migratsiya va `seed_demo`ni bajaring. Ushbu ishda 8000 port bandligi sabab demo backend 8011 portda ishga tushirildi. Sizning server 8000 bo‘lsa kirish ekranidagi API manzilini moslang.

```bash
cd backend
uv run python manage.py runserver 127.0.0.1:8011 --noreload
```

Emulator login ekranida API: `http://10.0.2.2:8011/api/v1`. Host allowlistiga `10.0.2.2`ni qo‘shing. Login: `demo.patient` yoki `demo.doctor`; parol seed yaratgan lokal parol. APKda parol mavjud emas. App ichidan demo akkauntni avtomatik yaratish yo‘q.

Debug HTTP faqat `10.0.2.2`, `127.0.0.1`, `localhost` uchun ochiq. Release HTTPS talab qiladi. `10.0.2.2` faqat Android emulatordan hostga yo‘l; fizik telefon uchun public HTTPS backend yoki `adb reverse` bilan localhost kerak.

## Sinov

Instrumentatsiya testlari **sintetik demo** serverga yozadi: dori qaydi, chat, holat va patronaj natijasi yaratiladi. Alohida yangi DB bilan ishga tushiring. Test APK faqat debug uchun; releasega kirmaydi.

```bash
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest
# MEDICINETRACK_TEST_PASSWORDni terminalda maxfiy ravishda kiriting.
read -rs MEDICINETRACK_TEST_PASSWORD
export MEDICINETRACK_TEST_PASSWORD
python3 scripts/run_checks.py --serial emulator-5554 --base http://10.0.2.2:8011/api/v1
unset MEDICINETRACK_TEST_PASSWORD
```

Test API sessiyalari, JSON kontrakti, dublikat himoyasi, encrypted roundtrip, invalid accessdan refresh, offline queue transport xatosi/sync, haqiqiy AlarmManager notification, ikkala rol ekranlari va task completionni tekshiradi. Ba’zi amallar to‘g‘ridan-to‘g‘ri klient API orqali, ayrim ekranlar activity orqali ochiladi; bu barcha tugmalarni bosadigan to‘liq UI testi emas. Screenshots: ilovaning external files `qa/` katalogida, faqat sintetik bemorlar bilan.

Android reference: [alarm scheduling](https://developer.android.com/develop/background-work/services/alarms), [notification permission](https://developer.android.com/develop/ui/views/notifications/notification-permission).

## Qolgan ish va cheklovlar

- Bu to‘liq TZ bajarildi degani emas: aktivatsiya, dori jadvali yaratish/tasdiqlash, correction va murakkab klinik boshqaruv uchun APK formalari hali yo‘q; backend/webdan foydalaniladi.
- Exact-alarm ruxsati olinmaydi. Eslatma kechikishi mumkin; aniq minutda yoki barcha fizik qurilmada ishlash kafolati yo‘q. Force-stopdan so‘ng app ochilishi kerak. Reboot handler mavjud, ammo to‘liq reboot E2E alohida tekshiriladi.
- Push, background server sync va doimiy chat yetkazish yo‘q. Jadval stop/revision holati navbatdagi yangilashda olinadi; offline eski eslatma qolishi mumkin. Oxirgi sync va eskirganlik ko‘rsatiladi.
- Offline navbat faqat dori qaydlari uchun. Server 400/409 bilan rad etgan yozuv navbatda saqlanadi, xatosi ko‘rsatiladi; alohida conflict resolution UI hali kerak. Yangi jadvalni olish bunday xato bilan to‘silmaydi.
- Chat/forma loyihalari rotation/process deathdan tiklanmaydi. Login ekranidan offline sessiyani tiklab kabinetga kirish hozircha yo‘q; avvalgi ochiq sessiyada dori keshi ko‘riladi.
- Dori TAKEN vaqti hozirgi vaqt bilan yoziladi; orqaga vaqt tanlash/correction UI yo‘q. Qayd bemor aytgan ma’lumot, haqiqiy ichganlik dalili emas.
- Lokal logout internet bo‘lmasa serverdagi sessiyani bekor qilolmaydi; lokal sirlar o‘chiriladi, server sessiyasi muddati tugaguncha qolishi mumkin.
- API 34 lint target ogohlantirishi bor. Play tarqatishdan oldin target yangilash, edge-to-edge, accessibility, fizik telefon QA va release signing zarur.
- APK release signing, public backend deploy va klinik tekshiruv ushbu versiyada bajarilmagan. Debug build faqat sintetik ma’lumot uchun: QA screenshotlari ochiq; release esa FLAG_SECURE ishlatadi.
