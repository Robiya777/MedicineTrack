# Koordinator kabinetini birlashtirish — 3–4-bosqich

2026-11-18. COORDINATOR bemor, chiqarish, aktivatsiya va dori loyihalari ishlarini ham bajaradi. HOSPITAL endi xodim roli emas; tashkilot turi sifatida qoladi.

## Interfeys

- Ish stoli: avvalgi hududiy chaqiruvlar va ko‘rsatkichlar.
- Chiqarishlar: sahifalangan ro‘yxat, joriy sahifadan qidirish, DRAFT/CONFIRMED filtri, yangi chiqarish.
- Yangi chiqarish: bemorni UUID bilan tanlash yoki yangi bemor yaratish, hududdagi faol kasalxonani tanlash, tavsiya va kuzatuv asosi, tekshirish va tasdiqlash.
- Tafsilot: chiqaruvchi kasalxona, DRAFT kontakt/tahrirlash, tasdiqlangan tavsiyaga sababli tuzatish, aktivatsiya, dori loyihasi va biriktirilgan chaqiruv.
- Dori jadvali, ish jadvali va javobsiz murojaatlar bitta koordinator kabinetida.
- Admin yangi xodim uchun faqat ADMIN/DOCTOR/COORDINATOR rollarini tanlaydi. Kasalxona/poliklinika tashkilotlari saqlanadi.

`/kabinet/statsionar/...` sahifalari COORDINATOR uchun xuddi shu yo‘lning `/kabinet/koordinator/...` variantiga almashtiriladi; chiqarish identifikatori va query saqlanadi. Boshqa rollar o‘z kabinetiga yo‘naltiriladi. Bemor va shifokorga koordinator menyulari ochilmaydi; backend tekshiruvi ham saqlangan.

`demo.hospital` va `demo.coordinator` endi bir muassasaning ikki koordinatori. Mualliflar saqlanadi; hamkasb DRAFTni davom ettirishi mumkin. Yaratishda `hospital` majburiy, `managing_organization` esa server belgilaydigan maydon. Dori klinik approve/revision/stop shifokorda qoladi.

## Qabul tekshiruvlari

- Backend: 97 passed, 6 PostgreSQL-specific skipped; migratsiya, muassasa chegaralari, kasalxona tanlovi, idempotency, audit, aktivatsiya va klinik ruxsatlar regressiyasi.
- Chromium/localhost: migratsiya qilingan demo.hospital yangi sintetik bemor va kasalxona tanlangan chiqarish yaratdi; demo.coordinator shu DRAFTni tasdiqladi, aktivatsiya va dori bo‘limlari ochildi.
- Eski statsionar tafsilot havolasi aynan tegishli koordinator tafsilotiga o‘tdi.
- 1440/360 pxda gorizontal surilish va browser runtime xatosi aniqlanmadi.
- Shifokor uchun chiqarish route’i rad etildi; dori bo‘limi saqlandi.
- ESLint, TypeScript va production build tekshirildi; lokal parallel API refaktori saqlandi.

Bu web integratsiyasi. Androidga koordinator kabineti qo‘shilmadi; fizik qurilma/HTTPS qabul mezonlari ushbu sinovlar bilan yopilmaydi. API oqimi synthetic ma’lumotlar bilan tekshirildi; haqiqiy foydalanuvchi ma’lumotlari o‘zgartirilmadi.
