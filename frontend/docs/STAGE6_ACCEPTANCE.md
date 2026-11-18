# Funksional 6-bosqich — web qabul hisoboti

Sana: 2026-11-18.

| Qism | Natija |
| --- | --- |
| In-app bildirishnomalar | Oldingi topshiruvda qo‘ng‘iroq, o‘qilganlik va task/suhbat havolasi ulangan |
| Statsionar tavsiyasiga tuzatish | CONFIRMED chiqarishda sabab va tuzatish alohida yoziladi; original saqlanadi |
| Shifokor hisobotiga tuzatish | Faqat hisobot muallifi observation/actions/follow_up maydoniga sababli tuzatish qo‘shadi |
| Bemor kontakti | Bemorni yaratgan statsionar xodim o‘z DRAFT chiqarishi mavjudligida manzil va telefonni tahrirlaydi |
| Texnik admin | Xodim, rol, muassasa, faol holat, klinik approve ruxsati, parol, tashkilot va hudud boshqaruvi |

## Brauzer tekshiruvi

- Admin yangi hudud, poliklinika va xodim yaratdi; mos kelmagan rol/muassasa serverda rad etildi va forma saqlandi.
- Xodim roli va faol holati o‘zgartirildi; shifokor bo‘lmagan rolga o‘tganda klinik approve ruxsati olib tashlandi. Parol yangilandi; javob parolni qaytarmadi.
- Tashkilot nomi/faol holati va hududning ota hududi tahrirlandi. Hudud tanlovida o‘zi va avlodlari berilmaydi.
- Statsionar noto‘g‘ri telefon bilan yubora olmadi; to‘g‘ri kontakt saqlandi. Tasdiqlangach kontakt tahriri yashirildi.
- Tavsiya tuzatishining muvaffaqiyatli javobi sun’iy yo‘qotildi. Bir xil idempotency kaliti bilan retry bitta yozuv qaytardi; original va yagona tuzatish ko‘rindi.
- Shifokor taskni qabul qilib hisobot yubordi va o‘z hisobotiga sababli tuzatish qo‘shdi.
- Bemor original tavsiya va tuzatishni o‘qidi; tahrirlash va admin bo‘limiga kirish berilmadi.
- 1440 va 360 px ekranlarda tekshirildi. Sahifa xatosi va gorizontal surilish aniqlanmadi.
- ESLint, TypeScript va production build o‘tdi.

Backend regressiya sinovlari `backend/tests/test_record_corrections.py`da original saqlanishi, audit, idempotency, muallif/rol chegaralari, kontaktning DRAFT chegarasi va parol almashganda sessiya bekorini tekshiradi. Aniq umumiy test natijasi backend VALIDATION.mdda.

## Foydalanish

`demo.admin` kabinetida Xodimlar / Muassasalar / Hududlar bo‘limlari mavjud. Mavjud demo parolingiz bilan kiring. Bemor uchun akkaunt yaratish texnik admin formasiga kiritilmagan: bemor aktivatsiyasi statsionar oqimida qoladi.

Statsionar chiqarish tafsilotida DRAFT uchun kontakt tahriri, CONFIRMED uchun tavsiyaga tuzatish bor. Shifokor task tarixidagi o‘z yakuniy hisobotiga tuzatish qo‘shadi. Original matn ustiga yozilmaydi; sabab va vaqt alohida tarixda chiqadi.

## Qolgan chegaralar

Bu web bosqichi. PDF/AI keyingi bosqichga, APK va public HTTPS yakuniy integratsiya qabuliga tegishli. Tashqi browser push bu in-app modulga kirmaydi. Biriktirilmagan task uchun koordinator tayinlashi kerak.
