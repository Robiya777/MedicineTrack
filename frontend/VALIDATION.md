# Web tekshiruvi

Sana 2026-11-17. 2-bosqich statsionar oqimi. Sintetik ma’lumotli lokal Django
backend, alohida SQLite baza va Playwright boshqaruvidagi Chromium ishlatildi.

## O‘tgan tekshiruvlar

- `npm ci`, `npm run lint` va `npm run build` o‘tdi. Build TypeScript
  tekshiruvini ham bajaradi.
- Statsionar loginidan chiqarishlar ro‘yxati va saqlangan yozuv tafsilotiga
  o‘tildi. Yigirmatadan ortiq yozuv bilan server sahifalashi tekshirildi.
- Noto‘g‘ri UUID, mavjud bo‘lmagan bemor va mavjud bemorni aniq UUID orqali
  topish holatlari tekshirildi.
- Yangi bemor uchun ism, sana, backenddan olingan hudud, manzil, xalqaro telefon,
  vakil telefoni va telefon yo‘qligi sababi tekshirildi.
- Backendning maydon xatosi tegishli input yonida ko‘rsatildi. Qayta yuborishda
  forma qiymatlari saqlandi.
- Haqiqiy chiqarish vaqti, kuzatuv asosi va tavsiyadan DRAFT yaratildi.
  Loyiha sahifa qayta yuklangach ochildi va tahrirlandi. Kelajak vaqti rad etildi.
- Brauzer vaqti America/New_York bo‘lsa ham forma qiymati Asia/Tashkent
  bo‘yicha serverga yuborildi. Chaqiruv muddati server javobidan olindi va
  chiqarishdan aynan 24 soat keyinligi tekshirildi.
- Tasdiqdan keyin bitta task ID, holat, mas’ul shifokor yoki
  «Mas’ul biriktirilmagan» holati ko‘rindi. Tasdiqlangan tafsilot qayta ochildi.
- Bemor yaratish, DRAFT yaratish va confirm serverda bajarilgach, brauzerga
  javob sun’iy uzildi. O‘sha forma qayta yuborilganda ayni idempotency kaliti,
  `Idempotency-Replayed: true` va avvalgi obyekt IDsi tekshirildi.
- DRAFT tahrirlanayotganida parallel confirm yuborildi. PATCH `409` qaytardi,
  web serverdagi tasdiqlangan holatni qayta oldi. Original tavsiya va
  muddati o‘tgan chaqiruv saqlandi.
- Mavjud bo‘lmagan chiqarish uchun 404 xabari chiqdi. Shifokor akkaunti
  statsionar chiqarish formasidan o‘z kabinetiga qaytarildi.
- 360 px va 1280 px ekranlar tekshirildi. Asosiy forma va tafsilotlarda
  gorizontal scroll chiqmadi. Skrinshot vizual ko‘rib chiqildi.

## Qolgan ishlar

- 3-bosqichdagi koordinator boshqaruvi va shifokor natija yuborishi.
- Webdan yaratilgan yangi chaqiruvni aynan shu ID bilan Androidda yakunlash.
- Bemor aktivatsiyasi, chat, dori jadvallari va PDF/AI ishchi ekranlarini ulash.
- Ommaviy HTTPS demo URL, fizik qurilma, turli brauzerlar va yuklama sinovlari.

Backend API kontraktiga o‘zgartirish kiritilmadi. Ushbu qayd 2-bosqich tekshiruv
hisoboti. To‘liq MVP qabulida qolgan ssenariylar ham tekshiriladi.
