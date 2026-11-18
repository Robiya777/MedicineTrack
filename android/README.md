# MedicineTrack Android 0.4.0

## 0.4.0 — dori va ahvol budilniklari

Dori occurrence’lari avtomatik ovozli/vibratsiyali alarm kanalida chiqadi. Ahvol so‘rovi Toshkent vaqti bilan 08:00, 11:00, 14:00, 17:00, 20:00 da; tunda yo‘q. Bemor bosh sahifasi → “Eslatmalarni sozlash” orqali o‘chirish va bildirishnoma/aniq vaqt/full-screen ruxsatlarini yoqish mumkin.

Signal maksimum 60 soniya. “10 daqiqadan keyin”, “Yopish” va ilovadagi tegishli formani ochish amallari bor. Holatga javob avtomatik yuborilmaydi; bemor izoh bilan tasdiqlaydi. Qulflangan ekranda klinik tafsilot ko‘rsatilmaydi; qurilma qulfini ochish talab qilinadi. Android ruxsat bermasa heads-up/inexact alarm qoladi; telefonning DND/kanal/batareya qoidalari amal qiladi. Full-screen ekran emulator preview’da tekshirildi; barcha telefonlarda avtomatik full-screen ochilishi kafolatlanmaydi.


## 0.3.0 dizayn moslashuvi

Gitdagi frontend (`5e97667`) va `frontend/docs/DESIGN_SYSTEM.md` asosida:
- bir xil teal/mint ranglar, mahalliy DM Sans (SIL OFL, `DM-Sans-LICENSE.txt`);
- 16 dp oq kartalar, 9 dp input/tugmalar, konturli ikkilamchi amallar;
- ikonali pastki menyu va faol bo‘limning mint foni, hisob avatari;
- webdagi kirish matni va teal kirish kartasi;
- dori jadvalini oldinga chiqarish uchun yig‘iladigan eslatma sozlamalari.

Bu native Android moslashuvi; web kabinetning desktop yon menyusi mobil pastki menyuga aylantirilgan. API, encrypted draft va eslatma oqimlari saqlangan.


Bemor va oilaviy shifokor uchun backendga ulangan birinchi native Android prototip. Package: `uz.medicinetrack.app`; Android 8.0+ (API 26), target/compile 34. Play uchun tayyor release emas.

## Ishlaydigan oqimlar

- Bemor/DOCTOR login, Keystore AES-GCM session storage, refresh rotation va logout.
- Shifokor: barcha sahifalardan chaqiruvlar, tafsilot, telefon terish oynasi, qabul qilish, aloqa urinishi va yakuniy natija.
- Bemor/shifokor: suhbatlar, xabar yuborish, o‘qilganlik, javob siyosati. Bemor: holat yuborish. Foreground chat 15 soniyada yangilanadi; matn yozilayotganda polling ekran matnini almashtirmaydi.
- Bemor: tasdiqlangan dori jadvallari, qabul vaqtlari, Ichdim/SKIPPED qaydlari; shifokor biriktirilgan bemorning jadvali va qaydini ko‘radi.
- AlarmManager eslatmalari: Android maxsus ruxsati bo‘lsa exact, aks holda inexact fallback va UI ogohlantirishi. Notification ruxsati, rebootdan keyingi qayta rejalash. Keyingi vaqt rejalashtiriladi; receiver keyingisini ulaydi.
- Minimal dori keshi va yuborilmagan qabul qaydlari shifrlanadi. Offline qayd navbatda qoladi, qo‘lda yangilash yoki Android fon vazifasida ayni payload/kalit bilan yuboriladi. Server tasdig‘isiz sinxronlandi deyilmaydi.
- Private notification matni, release screenshot himoyasi, backup/transferdan chiqarish, logoutda kesh va eslatmalarni tozalash.

## 0.2.0da qo‘shildi

- Bir martalik kod bilan bemor aktivatsiyasi va avtomatik bemor sessiyasi.
- Shifokorda ko‘p dorili DRAFT yaratish/tahrirlash, klinik ruxsat bilan approve, yangi versiya va sabab bilan stop. Jadval dori nomi, doza, qabul yo‘li, manba, kurs, vaqtlar va zonani talab qiladi; hech biri AI tomonidan taxmin qilinmaydi.
- Bemorning dori qaydiga sababli correction va shifokorning o‘z yakuniy hisobotiga append-only correction.
- Yuborilmagan qaydlar: xatoni ko‘rish, qayta yuborish, alohida tasdiq bilan qurilmadan olib tashlash. Bitta server xatosi keyingi qaydlarni va jadval yangilanishini to‘smaydi.
- Shifrlangan chat va forma matni chernoviklari; tegishli formani qayta ochganda tiklash. Forma konteksti user/patient/task/plan versiyasiga bog‘langan, muvaffaqiyatli yuborilganda tozalanadi. Parol va aktivatsiya kodi chernovikka yozilmaydi. Offline sessiyada lokal kabinet va dori keshi ochilishi mumkin; server vakolati tarmoq qaytganda tekshiriladi.
- In-app bildirishnomalar ro‘yxati, o‘qilganlik va tegishli chaqiruv/suhbatga o‘tish.
- JobScheduler 15 daqiqalik eng qisqa interval bilan tarmoqqa bog‘langan periodic sync rejalashtiradi. OS ishni kechiktirishi mumkin: bu aniq 15 daqiqalik kafolat emas. Fon va UI API ishlari bitta serial workerda; token rotatsiyasi oxirgi shifrlangan sessiyadan olinadi. Logout job va alarmni bekor qiladi.

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

## Qolgan tashqi ish va cheklovlar

- Ommaviy HTTPS backend, release signing, Play talablari va fizik telefon/batareya QA hali yo‘q. Hozir sintetik bemorli lokal demo; real tibbiy ma’lumotlar uchun tasdiqlangan muhit kerak.
- Target 34 emulatorda tekshirilgan; Play uchun target/edge-to-edge yangilanishi zarur. Lint: 0 error, 3 warning (target, ortiqcha v26 qualifier, tarjima resursi).
- Fon sync Android tomonidan kechiktirilishi mumkin; offline jadval stop/revisioni darhol olinmaydi. Oxirgi yangilanish va 24 soatdan eski kesh belgisi bor. Push/SMS integratsiyasi yo‘q.
- Rebootdan keyin alarm va periodic job tiklanishi emulatorda ko‘rildi; fizik qurilma yoki barcha ishlab chiqaruvchilar uchun kafolat emas. Force-stopdan keyin ilova qayta ochilishi kerak. Exact permission foydalanuvchi tomonidan beriladi; ruxsatsiz fallback ishlaydi, aniq vaqtli yo‘lning fizik qurilma tekshiruvi qolgan.
- Matnli chernoviklar forma qayta ochilganda tiklanadi. Oxirgi ekran avtomatik qayta ochilmaydi; spinner/checkbox holati saqlanmaydi. Bu saqlangan klinik jadval emas, qayta tekshiriladigan lokal loyiha.
- Qabulning yangi TAKEN vaqti hozirgi vaqt; oldingi vaqt kerak bo‘lsa saqlangan qayd correction formasida tuzatiladi. Bemor qaydi haqiqiy ichganlikning mustaqil dalili emas.
- Internet bo‘lmagan logout server sessiyasini bekor qilolmasligi mumkin; lokal sessiya, kesh, chernovik, job va alarm tozalanadi. Server sessiyasi muddatigacha qolishi mumkin.
- Debug build QA screenshotlariga ruxsat beradi, faqat sintetik ma’lumotda ishlating; release FLAG_SECURE ishlatadi. Generativ AI va tashqi klinik integratsiya mavjudligi da’vo qilinmaydi.

Yakuniy tekshiruvda lokal backend 8013 portda, kirish ekranidan moslanadi. Bu TZdagi barcha production/klinik talablar bajarilganining tasdig‘i emas. [Validation](VALIDATION.md).
