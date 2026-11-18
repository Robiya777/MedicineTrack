# Jamoaviy chat va shifokordan keyingi AI javobi

Bemorning chatida shifokor profillari, ism bo‘yicha qidirish va suhbatni tanlash paneli yo‘q. Biriktirilgan tibbiy jamoa bilan umumiy chat avtomatik ochiladi. Shifokor javoblari muallif nomi bilan ajratiladi; AI javobi **AI yordamchi · DEMO** deb ko‘rsatiladi.

## Jamoaga shifokor ulash

Asosiy oilaviy shifokor amaldagi `PatientAssignment` orqali avtomatik qatnashadi. Qo‘shimcha shifokorlar aniq chat a’zoligi orqali qo‘shiladi. Mas’ul shifokor chatdagi **Chat jamoasi** tugmasi orqali ruxsatli shifokorni tanlab qo‘shishi yoki chiqarishi mumkin. Hudud/muassasa doirasidagi koordinator ham API orqali boshqaradi. Bemor va qo‘shimcha chat shifokori jamoani o‘zgartira olmaydi.

Taklif qilinadigan shifokor faol muassasaga tegishli bo‘lishi va bemorning xizmat hududi yoki dastlabki muassasasiga bog‘langan bo‘lishi kerak. Chatga qo‘shish patronaj vazifalari, bemor kartasi yoki dori jadvalini o‘zgartirish vakolatini bermaydi. Qo‘shimcha shifokor shu bemorning chatini va ruxsatli demo SOS yozuvini ko‘radi. Chatdan chiqarilganda mavjud sessiyasi ham xabar/SOSni qayta ocha olmaydi; idempotent javobni qayta olishda ham amaldagi ruxsat tekshiriladi.

Mahalliy `demo.patient` jamoasiga `demo.doctor` va `demo.doctor2` ulangan. Boshqa bemorga aloqasi bo‘lmagan shifokor avtomatik qo‘shilmaydi.

## AI qachon javob beradi

| Holat | Natija |
|---|---|
| Jamoada hech bir shifokor onlayn emas | Demo yordamchi darhol javob beradi |
| Kamida bitta jamoa shifokori onlayn | Avval shifokor javobi kutiladi |
| 60 soniya ichida istalgan jamoa shifokori javob berdi | Kutilayotgan AI javobi bekor qilinadi |
| Shifokor onlayn, 60 soniyada javob bermadi | Serverdagi fon vazifasi AI javobini chiqaradi |
| Kutish paytida barcha jamoa shifokorlari oflayn bo‘ldi | AI 60 soniyani tugatishni kutmasdan javob beradi |
| Xavfli alomat bildirildi | Demo SOS va shoshilinch ogohlantirish kutmasdan chiqadi |

Onlaynlik shifokorning faol ilova sessiyasi bilan o‘lchanadi. Veb oynasi ko‘rinib turganda va Android old fonda bo‘lganda sessiya 15 soniyada yangilanadi. Yopilgan/yashirilgan oynadan oflayn signali yuboriladi; signal kelmasa oxirgi faollik 45 soniyadan keyin eskiradi. Chiqilgan yoki muddati tugagan sessiya onlayn sanalmaydi. Bir foydalanuvchining boshqa faol sessiyasi uni onlayn saqlashi mumkin. Shu sabab loginning o‘zi foydalanuvchini doimiy onlayn qilib qo‘ymaydi.

60 soniyalik muddat serverda saqlanadi; sahifani yopish yoki qayta yuklash uni qayta boshlamaydi. Kutish paytida ketma-ket yozilgan xabarlar bir to‘plam sifatida baholanadi va avvalgi muddat uzaytirilmaydi. Eng so‘nggi baho chiqariladi, eskirgan kutilayotgan javoblar bekor qilinadi. Xabarni o‘qish javob berish hisoblanmaydi. AI chiqqanidan keyin ham shifokor yozishi mumkin; AI klinik murojaatni javob berilgan deb yopmaydi.

AI kalitsiz qoidalar asosidagi demo bo‘lib qoladi. Tashxis va yangi dori dozasini belgilamaydi. Haqiqiy 103 dispetcheri avtomatik chaqirilmaydi; telefon tugmasi terish oynasini ochadi. [Demo SOS va lokatsiya cheklovlari](ASSISTANT_DEMO.md).

## API va ishga tushirish

- `POST /api/v1/me/presence` — shifokorning o‘z sessiyasi uchun `{active: true|false}`.
- `GET /api/v1/patients/{id}/chat-doctors` — a’zolar va boshqaruv ruxsati; nomzodlar faqat boshqaruvchiga qaytadi.
- `POST /api/v1/patients/{id}/chat-doctors` — `{doctor: UUID, action: "ADD"|"REMOVE"}`, `Idempotency-Key` bilan.
- Suhbat metadatasida `team`, `patient_name`, `can_manage_team`, `assistant_enabled` bor.
- Xabarda `sender_name`, `sender_role`, `assistant_status` va `assistant_due_at` bor. Kutish/bekor qilish holatida `assistant=null`; chiqarilgan javobda `reply_at` va `reply_reason` ko‘rsatiladi.

`accounts.0005` sessiyadagi faollik vaqtini, `messaging.0005` chat a’zolari va AI kutish maydonlarini qo‘shadi. Oldingi AI javoblari tarixda saqlanadi. Bazani oldin zaxiralang, keyin `docker compose up -d --build api worker beat` bajaring. Baza o‘chirilmaydi. `messaging.jobs.release_assistant_replies` har soniyada ishlaydi; kechiktirilgan javob uchun Celery worker va beat ishlashi kerak. Veb xabarlarni 2 soniyada, jamoa onlaynligini 5 soniyada oladi. Shuning uchun interfeysda chiqish muddatdan bir necha soniya kechroq ko‘rinishi mumkin.

Android **0.5.1 / code 6** ham shu API va qoidalarni ishlatadi. Bemor chat bo‘limini ochganda umumiy chatga kiradi. Chatga kirish AI o‘chirilgan muhitda ham ishlaydi.

Tekshiruv: [jamoaviy chat hisoboti](../../docs/qa/group-chat-2026-11-18.json). Haqiqiy 60 soniyalik kutish Chromium, PostgreSQL va Celery bilan sinovdan o‘tkazilgan. Sintetik ma’lumot va emulyator ishlatilgan; bu klinik validatsiya emas.
