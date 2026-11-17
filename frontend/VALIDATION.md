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

- Webdan yaratilgan yangi chaqiruvni aynan shu ID bilan Androidda yakunlash.
- Bemor aktivatsiyasi, chat, dori jadvallari va PDF/AI ishchi ekranlarini ulash.
- Ommaviy HTTPS demo URL, fizik qurilma, turli brauzerlar va yuklama sinovlari.

Backend API kontraktiga o‘zgartirish kiritilmadi. Ushbu qayd 2-bosqich tekshiruv
hisoboti. To‘liq MVP qabulida qolgan ssenariylar ham tekshiriladi.

## 3-bosqich tekshiruvi

Lokal Django backend, alohida sintetik SQLite baza va Chromium bilan
quyidagilar tekshirildi.

- Koordinatorning hududiy KPI, mas’ulsiz va kechikkan navbatlari.
  Keyingi 4 soatda muddati tugaydigan 22 ta ochiq vazifa ikki sahifada
  ko‘rsatildi. Shu oraliqdagi COMPLETED va CANCELLED yozuvlar kirmadi.
- Shifokor va muassasa filtrlari, filtr o‘zgarganda birinchi sahifaga qaytish.
  Ma’lumotnomalar barcha server sahifalaridan olinadi.
- Statsionar webda yangi bemor chiqarildi. Koordinator ayni task IDni
  tayinladi. 360 px shifokor webida qabul qilinib, urinish va yakuniy natija
  yuborildi. 1280 px koordinator panelida shu natija va yangilangan KPI ko‘rindi.
- Accept faqat qabul holatini o‘zgartirdi. Javobsiz aloqa urinishidan keyin
  task ochiq qoldi. COMPLETED faqat server yakuniy hisobotni saqlagach ko‘rindi.
- Reassign, accept, contact-attempts, complete va cancel javoblari server
  amali bajarilgach brauzerga sun’iy uzildi. Qayta so‘rovda bir xil kalit va
  Idempotency-Replayed tasdiqlandi. Takroriy urinish va hisobot yaratilmadi.
- ACCEPTED vazifa boshqa shifokorga tayinlanganda status NEW,
  accepted_at null bo‘ldi. Dastlabki due_at saqlandi.
  Oldingi shifokor yangilaganda API ruxsat bermadi va klinik tafsilot yashirildi.
- Boshqa shifokorga tegishli task IDsi bilan kirishda ma’lumot ochilmadi.
- Natija formasi ochiq paytda parallel aloqa urinishi server versiyasini
  o‘zgartirdi. Eski complete 409 qaytardi. Matn yo‘qolmadi va foydalanuvchi
  joriy holatni tasdiqlagach yangi versiya bilan yakunladi.
- Kelajakdagi tashrif vaqti rad etildi. Cancel uchun sabab turi va izoh
  yuborildi. Terminal vazifada o‘zgartirish tugmalari yopildi.
- 360 px tayinlash dialogi, Escape bilan yopish, forma va tafsilotlar,
  1280 px koordinator paneli tekshirildi. Skrinshotlar vizual ko‘rib chiqildi.
- npm run lint, npm run build va TypeScript tekshiruvi o‘tdi.

Bitta taskning webdan Android APKda yakunlanishi qolgan integratsiya sinovi.
Ushbu kompyuterda sozlangan AVD va ishlaydigan Java muhiti aniqlanmadi.
Uch rolning web orqali bir xil backend bilan ishlashi yuqorida tekshirildi.

## Dizayn 1–2-bosqich — 2026-11-18

Teal va mint koordinator preview’si sintetik ma’lumot bilan Chromiumda tekshirildi.

- Galereyadan /design/medicinetrack/queue ochildi. 24 ta sintetik yozuv,
  14 aktiv, 3 mas’ulsiz, 2 kechikkan va 70% (7/10) ko‘rsatkichlari
  shu datasetdan hisoblandi.
- Holat, shifokor va muassasa filtrlari, mos yozuv bo‘lmagan holat, filtrni
  tozalash, sahifalash va muddat bo‘yicha ikki tomonlama saralash o‘tdi.
- Tafsilotda to‘liq ID ochildi va nusxalandi. Escape bilan dialog yopildi
  va fokus uni ochgan tugmaga qaytdi. Mobil menyuda ham shu xatti-harakat tekshirildi.
- Yuklanish, bo‘sh ro‘yxat va xato holatlari, xatodan qayta urinish tekshirildi.
- 1440, 1024, 768 va 360 px ekranlarda skrinshot olindi. Gorizontal surilish yo‘q.
  Desktop va mobil skrinshotlar vizual tekshirildi. 800×360 landscape ham tekshirildi.
- Mobil menyu, filtrlarni ochish va tafsilot oynasi ishladi. Ko‘rinadigan
  interaktiv elementlarning o‘lchamlari tekshirildi.
- Reduced motion yoqilganda refresh animatsiyasi o‘chdi.
- Yetti asosiy matn/fon juftligining hisoblangan kontrasti 4.5:1dan yuqori chiqdi.
- Original clinical dizayn varianti va login ochildi. Preview CSS doirasi,
  yangi variantning qo‘llanadigan queue yo‘li va preview paytida API so‘rovlari
  yuborilmasligi tekshirildi.
- npm run lint, TypeScript va build o‘tdi.

Bu dizaynni ko‘rib kelishish uchun alohida preview. Ishchi kabinetlarga
dizayn integratsiyasi keyingi bosqichning qabul ssenariylari bilan tekshiriladi.
