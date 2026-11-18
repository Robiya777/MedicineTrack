# Koordinatorga birlashtirish — backend 1–2-bosqich

## Vakolatlar

Faol xodim rollari: COORDINATOR, DOCTOR, ADMIN va PATIENT. HOSPITAL endi xodim roli emas; Organization.Type.HOSPITAL kasalxona turi sifatida qoladi.

Koordinator o‘z muassasasida bemor yaratadi va shu muassasa boshqaradigan chiqarishlar bilan ishlaydi. Bitta muassasadagi barcha koordinatorlar DRAFT yozuvlar, fayllar, AI tekshiruvi, tasdiqlash, tavsiyaga sababli tuzatish hamda aktivatsiya bilan ishlaydi. Kontaktni tahrirlash uchun bemor shu muassasaga tegishli va shu muassasada DRAFT mavjud bo‘lishi kerak. Mualliflar va audit aktorlari qayta yozilmaydi.

Chaqiruvlarni ko‘rish va taqsimlash mavjud hududiy qoidalarni saqlaydi. Shu sababli koordinator patronajdagi bemorni o‘qiy olishi, ammo boshqa muassasaning bemor kontakti yoki chiqarishini tahrirlay olmasligi mumkin. Qabul qiluvchi muassasasi yo‘q chaqiruv hujjatni boshqaruvchi muassasa koordinatorlariga yuboriladi.

Koordinator o‘z muassasasi bemoriga, shu muassasa boshqaradigan chiqarish asosida dori DRAFT yaratadi/tahrirlaydi. Klinik approve/revision/stop shifokor vakolatida; klinik approve uchun alohida ruxsat saqlangan. Koordinator bemor o‘rniga qabul qaydi kiritmaydi va qabul tarixiga yangi huquq olmaydi. Kasalxonaga biriktirilgan DOCTOR endi statsionar xodim vakolatini avtomatik olmaydi.

## API o‘zgarishi

Endpointlar o‘zgarmaydi. `POST /api/v1/discharges` uchun `hospital` UUID majburiy: faol, HOSPITAL turidagi, koordinator muassasasi bilan bir hududdagi tashkilot. `patient` shu muassasaga tegishli bo‘lishi kerak. `managing_organization` javobda mavjud va read-only: server sessiyadagi muassasani belgilaydi. Klient yuborgan boshqa qiymat vakolatni o‘zgartirmaydi.

PATCH hujjatdagi bemor yoki chiqaruvchi kasalxonani almashtirmaydi. Tasdiqlangan hujjat o‘zgartirilmaydi; tavsiya tuzatishlari alohida qayd etiladi. Faol hududiy kasalxonalarni mavjud `/api/v1/reference/organizations` orqali olish mumkin. Admin akkaunt API’si yangi HOSPITAL rolini rad etadi. Koordinatorga HOSPITAL yoki CLINIC tashkiloti biriktirish mumkin.

## Migratsiya va chiqarish tartibi

1. Ma’lumotlar bazasi backupini oling; backend va keyingi frontend bosqichini birgalikda chiqarishni rejalashtiring.
2. `python manage.py migrate`: care.0003 yangi managing_organization maydonini qo‘shib, eski hujjatlarda hospitaldan to‘ldiradi. accounts.0004 HOSPITAL foydalanuvchilarini COORDINATORga aylantiradi va ularning amaldagi web/Android sessiyalarini bekor qiladi. Access token ham AuthSession tekshiruvida rad etiladi.
3. Login, parol, muassasa, bemorlar, DRAFT/CONFIRMED yozuvlar, mualliflar, chaqiruvlar va audit tarixi saqlanadi. Migratsiya eski roldagi klinik approve flagini olib tashlaydi.
4. `seed_demo` demo.hospital loginini COORDINATOR sifatida yaratadi; demo.coordinator ham qoladi. Seedni takror ishga tushirish eski HOSPITAL rolini tiklamaydi.

Rol birlashtirish ma’lumot migratsiyasi **avtomatik orqaga qaytarilmaydi**: haqiqiy koordinator bilan o‘zgartirilgan sobiq statsionarni taxmin orqali ajratish mumkin emas. Rollback uchun migratsiyadan oldingi DB backupi va unga mos oldingi kod ishlatiladi. Yangi yozuvlar paydo bo‘lgach backupga qaytish ularni yo‘qotishi mumkin; avval eksport/reconciliation kerak.

3–4-bosqichda frontend ham COORDINATORga moslashtirildi. Koordinator menyusiga chiqarishlar va dori jadvali ulandi; yangi yaratish payloadida hospital yuboriladi. Lokal bazaga backupdan keyin migratsiyalar qo‘llandi va localhost:5173da ikki koordinatorning umumiy oqimi tekshirildi. Batafsil: ../../frontend/docs/COORDINATOR_UNIFICATION.md. Android DOCTOR/PATIENT loginlarini saqlaydi; koordinator uchun yangi mobil kabinet qo‘shilmadi.

## Sinovlar

- To‘liq SQLite pytest, ruxsatlar va migratsiya regressiyasi.
- Alohida vaqtinchalik DBda eski akkaunt/hujjatlardan migratsiya: muallif va original matn saqlanishi, sessiya va access token bekori.
- Kasalxona/poliklinika koordinatorlari, muassasadoshning DRAFT/confirm/aktivatsiyasi, idempotent confirm.
- Noto‘g‘ri hudud, faol bo‘lmagan kasalxona, boshqa muassasa yozuvi, boshqa rollarning yozishi va klinik approve rad etilishi.
- Yangi vaqtinchalik DBda migrate va seed_demo ikki marta.
