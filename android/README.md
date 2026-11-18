# MedicineTrack Android 0.3.0

Bemor va oilaviy shifokor uchun backendga ulangan birinchi native Android prototip. Package: `uz.medicinetrack.app`; Android 8.0+ (API 26), target 34 / compile 36. Play uchun tayyor release emas.

## Ishlaydigan oqimlar

- Bemor/DOCTOR login, Keystore AES-GCM session storage, refresh rotation va logout.
- Shifokor: barcha sahifalardan chaqiruvlar, tafsilot, telefon terish oynasi, qabul qilish, aloqa urinishi va yakuniy natija.
- Bemor/shifokor: suhbatlar, xabar yuborish, o‘qilganlik, javob siyosati. Bemor: holat yuborish. Foreground chat 15 soniyada yangilanadi; matn yozilayotganda polling ekran matnini almashtirmaydi.
- Bemor: tasdiqlangan dori jadvallari, qabul vaqtlari, Ichdim/SKIPPED qaydlari; shifokor biriktirilgan bemorning jadvali va qaydini ko‘radi.
- AlarmManager eslatmalari: Android maxsus ruxsati bo‘lsa exact, aks holda inexact fallback va UI ogohlantirishi. Notification ruxsati, rebootdan keyingi qayta rejalash. Keyingi vaqt rejalashtiriladi; receiver keyingisini ulaydi.
- Minimal dori keshi va yuborilmagan qabul qaydlari shifrlanadi. Offline qayd navbatda qoladi, qo‘lda yangilash yoki Android fon vazifasida ayni payload/kalit bilan yuboriladi. Server tasdig‘isiz sinxronlandi deyilmaydi.
- Private notification matni, release screenshot himoyasi, backup/transferdan chiqarish, logoutda kesh va eslatmalarni tozalash.

## Web bilan umumiy dizayn

- `frontend/src/index.css`dagi ayni teal/mint tokenlar: asosiy rang `#0F766E`, mint `#DFF5EF`, sahifa `#F5F8F7`, matn `#18332F`. DM Sans fonti ilovaga joylangan; uni yuklash uchun internet kerak emas. Litsenziya APK assets ichida.
- Login va aktivatsiya, bosh sahifa, chaqiruvlar, chat, dori jadvallari, tuzatishlar, bildirishnomalar va hisob umumiy karta, maydon va tugmalarni ishlatadi. Asosiy/ikkinchi darajali/xavfli amallar ajratilgan; bosish sohasi kamida 44 dp.
- Pastki menyu ikonka va faol bo‘lim bilan, tafsilotlarda orqaga qaytish va yuqorida bildirishnoma tugmasi. Kontent planshetda 720 dp bilan chegaralanadi; klaviatura ochilganda pastki menyu joy bo‘shatadi.
- Bosh sahifa haqiqiy API ma’lumotidan hisoblaydi. Dori ekranida bugungi, barcha va qayd kutilayotgan qabullar filtri; uzun ro‘yxat 40 tadan ochiladi. Offline va server tasdig‘ini kutayotgan qaydlar alohida belgilanadi. Chaqiruvlarda faol/yangi/qabul qilingan/muddati o‘tgan/barcha filtrlari mavjud.
- Xatolar va yuklanish alohida ko‘rinadi, so‘rov vaqtida boshqaruvlar bloklanadi. Parolni ko‘rsatish/yashirish va klaviaturadan kirish ishlaydi. API sozlamasi oddiy kirish formasidan alohida ochiladi.
- Faqat izoh o‘zgartirilgan dori correctionida oldingi qabul vaqtining soniya va kasr qismi saqlanadi. Nullable DRAFT ko‘rsatmalar xavfsiz chiqariladi; aniqlashtirish belgisi tahrirda saqlanadi.

## 0.2.0da qo‘shildi

- Bir martalik kod bilan bemor aktivatsiyasi va avtomatik bemor sessiyasi.
- Shifokorda ko‘p dorili DRAFT yaratish/tahrirlash, klinik ruxsat bilan approve, yangi versiya va sabab bilan stop. Jadval dori nomi, doza, qabul yo‘li, manba, kurs, vaqtlar va zonani talab qiladi; hech biri AI tomonidan taxmin qilinmaydi.
- Bemorning dori qaydiga sababli correction va shifokorning o‘z yakuniy hisobotiga append-only correction.
- Yuborilmagan qaydlar: xatoni ko‘rish, qayta yuborish, alohida tasdiq bilan qurilmadan olib tashlash. Bitta server xatosi keyingi qaydlarni va jadval yangilanishini to‘smaydi.
- Shifrlangan chat va forma matni chernoviklari; tegishli formani qayta ochganda tiklash. Forma konteksti user/patient/task/plan versiyasiga bog‘langan, muvaffaqiyatli yuborilganda tozalanadi. Parol va aktivatsiya kodi chernovikka yozilmaydi. Offline sessiyada lokal kabinet va dori keshi ochilishi mumkin; server vakolati tarmoq qaytganda tekshiriladi.
- In-app bildirishnomalar ro‘yxati, o‘qilganlik va tegishli chaqiruv/suhbatga o‘tish.
- JobScheduler 15 daqiqalik eng qisqa interval bilan tarmoqqa bog‘langan periodic sync rejalashtiradi. OS ishni kechiktirishi mumkin: bu aniq 15 daqiqalik kafolat emas. Fon va UI API ishlari bitta serial workerda; token rotatsiyasi oxirgi shifrlangan sessiyadan olinadi. Logout job va alarmni bekor qiladi.

## Build

JDK 17, Android SDK platform 36 va build-tools 35.0.0 kerak. `ANDROID_HOME`ni o‘z SDK katalogingizga yo‘naltiring yoki lokal `local.properties`da `sdk.dir=...` yozing; uni commit qilmang.

```bash
export JAVA_HOME="$HOME/jdk17"
export ANDROID_HOME="$HOME/android-sdk"
cd android
./gradlew :app:assembleDebug :app:lintDebug :app:assembleDebugAndroidTest
adb -s emulator-5554 install -r app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5554 shell am start -n uz.medicinetrack.app/.MainActivity
```

APK: `app/build/outputs/apk/debug/app-debug.apk`. Gradle wrapper 8.14 va AGP 8.11.1. [Rasmiy moslik jadvali](https://developer.android.com/build/releases/agp-8-11-0-release-notes)ga mos JDK 17/build-tools 35 ishlatiladi. API 34 emulatorda tekshirilgan birinchi poydevor uchun Java 17 va platform Views tanlandi: qo‘shimcha runtime kutubxonalar yo‘q, barcha biznes qoidalari backendda qoladi. TZdagi Kotlin/Compose texnologiya taklifi keyingi refaktor uchun ochiq; REST kontrakti o‘zgarmaydi.

## Lokal backend va emulator

`backend/README.md` bo‘yicha backendni ishga tushiring. Ushbu ishda web ham, Android ham **8001** portdagi Docker backendga ulanishi mumkin. Kirishdagi “Server sozlamalari” orqali manzil o‘zgartiriladi.

Emulator: `http://10.0.2.2:8001/api/v1` — standart manzil. `DJANGO_ALLOWED_HOSTS` ichida `10.0.2.2` bo‘lishi kerak; `.env.example`ga qo‘shilgan. Login: `demo.patient` yoki `demo.doctor`; parol lokal `seed_demo` yaratgan parol. APKda parol mavjud emas.

Fizik telefon USB orqali ulanganda:

```bash
adb reverse tcp:8001 tcp:8001
```

So‘ng ilovaning server manzilini `http://127.0.0.1:8001/api/v1` qiling. Ommaviy serverda HTTPS manzil kiriting.

Debug HTTP faqat `10.0.2.2`, `127.0.0.1`, `localhost` uchun ochiq. Release HTTPS talab qiladi. `10.0.2.2` faqat Android emulatordan hostga yo‘l; fizik telefon uchun public HTTPS backend yoki `adb reverse` bilan localhost kerak.

## Sinov

Instrumentatsiya testlari **sintetik demo** serverga yozadi: dori qaydi, chat, holat va patronaj natijasi yaratiladi. Alohida yangi DB bilan ishga tushiring. Test APK faqat debug uchun; releasega kirmaydi.

```bash
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest
# MEDICINETRACK_TEST_PASSWORDni terminalda maxfiy ravishda kiriting.
read -rs MEDICINETRACK_TEST_PASSWORD
export MEDICINETRACK_TEST_PASSWORD
python3 scripts/run_checks.py --serial emulator-5554 --base http://10.0.2.2:8013/api/v1
unset MEDICINETRACK_TEST_PASSWORD
```

Test native kirish formasi, parol ko‘rinishi, faol menyu/bosish sohasi, orqaga qaytish, bildirishnoma ekrani, nullable DRAFT va soniyali correctionni ham tekshiradi. Test API sessiyalari, JSON kontrakti, dublikat himoyasi, encrypted roundtrip, invalid accessdan refresh, offline queue transport xatosi/sync, haqiqiy AlarmManager notification, ikkala rol ekranlari va task completionni tekshiradi. Ba’zi amallar to‘g‘ridan-to‘g‘ri klient API orqali, ayrim ekranlar activity orqali ochiladi; bu barcha tugmalarni bosadigan to‘liq UI testi emas. Screenshots: ilovaning external files `qa/` katalogida, faqat sintetik bemorlar bilan.

Android reference: [alarm scheduling](https://developer.android.com/develop/background-work/services/alarms), [notification permission](https://developer.android.com/develop/ui/views/notifications/notification-permission).

## 0.3.0 tekshiruv dalili

Android 14 emulatorda **81 funksional/integratsiya** va **31 kichik ekran/klaviatura** tekshiruvi o‘tdi. 360 dp/100% va 320 dp/130% rejimlari ko‘rildi. Webdagi ayni bemor/jadval/suhbat va webda yakunlangan chaqiruv 8001 backenddan o‘qildi. [To‘liq hisobot va screenshots](VALIDATION.md).

`run_checks.py --mode layout --base ... --patient-user ... --doctor-user ...` faqat ekran/klaviatura tekshiruvini ochadi. Asosiy testga `--linked-base http://10.0.2.2:8001/api/v1 --linked-fixture <fixture.json> --linked-report <browser-report.json>` qo‘shilsa, `MEDICINETRACK_LINKED_PASSWORD` ham beriladi. Fixture va web report bir run uchun bo‘lishi kerak. Asosiy yozuvchi testni ishlayotgan web bazasiga yo‘naltirmang; yangi sintetik bazadan foydalaning.

## Qolgan tashqi ish va cheklovlar

- Ommaviy HTTPS backend, release signing, Play talablari va fizik telefon/batareya QA hali yo‘q. Hozir sintetik bemorli lokal demo; real tibbiy ma’lumotlar uchun tasdiqlangan muhit kerak.
- Target 34 emulatorda tekshirilgan; Play uchun target/edge-to-edge yangilanishi zarur. Lint: 0 error, 1 warning (`OldTargetApi`).
- Fon sync Android tomonidan kechiktirilishi mumkin; offline jadval stop/revisioni darhol olinmaydi. Oxirgi yangilanish va 24 soatdan eski kesh belgisi bor. Push/SMS integratsiyasi yo‘q.
- Rebootdan keyin alarm va periodic job tiklanishi emulatorda ko‘rildi; fizik qurilma yoki barcha ishlab chiqaruvchilar uchun kafolat emas. Force-stopdan keyin ilova qayta ochilishi kerak. Exact permission foydalanuvchi tomonidan beriladi; ruxsatsiz fallback ishlaydi, aniq vaqtli yo‘lning fizik qurilma tekshiruvi qolgan.
- Matnli chernoviklar forma qayta ochilganda tiklanadi. Oxirgi ekran avtomatik qayta ochilmaydi; spinner/checkbox holati saqlanmaydi. Bu saqlangan klinik jadval emas, qayta tekshiriladigan lokal loyiha.
- Qabulning yangi TAKEN vaqti hozirgi vaqt; oldingi vaqt kerak bo‘lsa saqlangan qayd correction formasida tuzatiladi. Bemor qaydi haqiqiy ichganlikning mustaqil dalili emas.
- Internet bo‘lmagan logout server sessiyasini bekor qilolmasligi mumkin; lokal sessiya, kesh, chernovik, job va alarm tozalanadi. Server sessiyasi muddatigacha qolishi mumkin.
- Debug build QA screenshotlariga ruxsat beradi, faqat sintetik ma’lumotda ishlating; release FLAG_SECURE ishlatadi. Generativ AI va tashqi klinik integratsiya mavjudligi da’vo qilinmaydi.

Instrumentatsiya uchun alohida yangi SQLite demo backend 8013 portda ishlatiladi; web bilan bog‘lanish 8001 portda tekshiriladi. Bu TZdagi barcha production/klinik talablar bajarilganining tasdig‘i emas. [Validation](VALIDATION.md).
