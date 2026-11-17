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

## Dizayn 3–4-bosqich — 2026-11-18

Tasdiqlangan teal/mint uslub haqiqiy API bilan ishlaydigan login, statsionar,
koordinator va shifokor ekranlariga ulandi. Tekshiruvlar alohida sintetik SQLite
bazasi va lokal Django backend bilan Chromiumda bajarildi.

- Statsionar → koordinator → 360 px shifokor → koordinator oqimi bitta task
  IDsi bilan o‘tdi. Yangi bemor, chiqarish, tayinlash, qabul qilish, aloqa
  urinishi, yakuniy natija va KPI ro‘yxati tekshirildi.
- Tayinlash, qabul qilish, aloqa urinishi, natija va bekor qilish javobi server
  saqlagach sun’iy uzildi. Takroriy so‘rov bir xil Idempotency-Key ishlatdi,
  server Idempotency-Replayed qaytardi; qo‘shimcha yozuv yaralmadi.
- Parallel o‘zgarishdagi haqiqiy 409 forma matnini saqladi. Foydalanuvchi
  yangi versiyani tasdiqlagach natija saqlandi. Qayta tayinlash eski shifokor
  ruxsatini yopdi; 403/404 holatida klinik tafsilotlar yashirildi.
- 22 ta yaqin muddatli ochiq chaqiruv ikki sahifada ko‘rindi. Yakunlangan va
  bekor qilingan yozuvlar bu navbatga kirmadi. Shifokor/muassasa filtri hamda
  filtr o‘zgarganda birinchi sahifaga qaytish tekshirildi.
- UUID bilan bemor tanlash, topilmagan UUID, yangi bemorda telefon yo‘qligi,
  draftni qayta ochish/tahrirlash, kelajak vaqtini rad etish, Toshkent vaqtini
  boshqa brauzer vaqt zonasidan yuborish va serverning +24 soat muddati o‘tdi.
- URL filtrlari va ikkinchi sahifa tafsilotdan qaytganda saqlandi. Noto‘g‘ri
  query qiymatlari standart ro‘yxatni ochdi. Shifokorning statsionar route’iga
  kirishi o‘z kabinetiga qaytardi. Chiqish login sahifasiga olib bordi.
- Haqiqiy ro‘yxatning yuklanish, bo‘sh va 503 xato holatlari ko‘rsatildi;
  qayta urinish ro‘yxatni tikladi. Mobil filtrlarni ochish/yopish ishladi.
- 1440, 1024, 768, 360 px va 800×360 landscape tekshirildi. Login, ro‘yxatlar,
  bemor formasi, tafsilot, tayinlash dialogi va hisobot skrinshotlari olindi
  va vizual ko‘rib chiqildi. Gorizontal surilish aniqlanmadi.
- Mahalliy DM Sans, parolni ko‘rsatish/yashirish, native modal/drawer ichidagi
  fokus, Escape va boshlang‘ich tugmaga fokus qaytishi tekshirildi.
  Ko‘rinadigan menyu va filtr boshqaruvlari kamida 44 px.
- Sintetik preview galereyasi, filtrlari, saralashi, ID nusxalash, loading/empty/
  error/retry, reduced motion va avvalgi clinical varianti qayta tekshirildi.
- `npm run lint`, `npm run build` va build ichidagi TypeScript tekshiruvi o‘tdi.

Bu bosqich web dizayn integratsiyasini qamraydi. Avvalgi Android APK bilan
bitta chaqiruvni yakunlash integratsiya sinovi haqidagi cheklov saqlanadi.

## Funksional 4-bosqich — 2026-11-18

Bemor aktivatsiyasi, bemor kabineti, chat, holat yuborish, koordinator ish
jadvali va javobsiz murojaatlar real API bilan ulandi.

- Statsionar → bir martalik kod → bemor faollashuvi → xabar/holat → shifokor
  javobi → koordinator ustuvor navbati oqimi Chromiumda o‘tdi.
- Xabar va holat POST javoblari server saqlagach uzildi; qayta yuborish ayni
  Idempotency-Key bilan server replay qaytardi. Muvaffaqiyatli yuborishdan
  keyin bir xil matnni yana yuborish yangi kalit va alohida yozuv yaratdi.
- Qayta tayinlash eski shifokor ekranidan klinik ma’lumotni yashirdi. Bemorda
  eski tarix saqlandi va yangi suhbat dastlabki javob muddatini oldi.
  Patronaj yakunlangandan keyin ham faol biriktirish bilan chat ishladi.
- Haftalik oraliqlar, tushlik tanaffusi, istisno kun va ustma-ust oraliqni
  rad etish tekshirildi. Javob muddati backenddan olindi.
- 1440/1024/768/360 px bemor kabineti, 1440/360 px suhbat, mobil menyu va
  klaviatura fokusi tekshirildi. Koordinator jadvali va javobsizlar skrinshotlari
  olindi. Gorizontal surilish aniqlanmadi.
- Backenddagi auth/messaging regressiyasi: 22 passed. Lint, TypeScript va build o‘tdi.

AT-24–AT-33 bo‘yicha dalillar va APK/HTTPS qabul chegarasi
[4-bosqich qabul hisobotida](docs/STAGE4_ACCEPTANCE.md).

## Vkladkalar bo‘yicha alohida sessiya — 2026-11-18

Bitta Chromium browser context ichida cookie’larni bo‘lishadigan ikki sahifa
bilan tekshirildi. Ular alohida incognito context emas.

- Doctor va patient ikki vkladkada kirdi; ikkisi reload qilinganda o‘z roli saqlandi.
- APIga sun’iy 401 qaytarilganda faqat doctor sessiyasi yangilandi.
- Doctor chiqdi; patient reload va refreshdan keyin tizimda qoldi.
- Yangi vkladka va sessionStorage ko‘chiriladigan window.open nusxasi boshqa
  akkauntni olmadi; alohida identifikator va login sahifasini oldi.
- Refresh cookie’lari HttpOnly va auth path bilan cheklangan; document.cookie
  orqali ko‘rinmadi. Tokenlar SessionStorage yoki LocalStorage’ga yozilmadi.
- Lint, TypeScript va production build o‘tdi.

## Funksional 5-bosqich — 2026-11-18

Dori loyihasi, klinik approve, revision/stop, bemor qabuli, sababli correction
va shifokor tarixi ulandi. Uch rolning bitta backenddagi web oqimi tekshirildi.
Record javobi yo‘qolganda bir xil payload va kalit bilan retry o‘tdi.
Backend medication regressiyasi: 36 passed, 3 PostgreSQL-specific skipped.
Web/API dalillari va APK bilan qolgan sinovlar
[5-bosqich hisobotida](docs/STAGE5_ACCEPTANCE.md) ajratilgan.

## In-app bildirishnomalar — 2026-11-18

Lokal backenddagi navbatda qolgan hodisalar yetkazildi. 360 px doctor kabinetida
qo‘ng‘iroq ochildi, bildirishnomadan biriktirilgan task tafsilotiga o‘tildi,
o‘qilganlik POSTi 200 qaytardi va chaqiruv bilan ishlash amallari ko‘rindi. Dialog hamda
sahifada gorizontal surilish va React xatosi aniqlanmadi. Lint/build o‘tdi.
Bildirishnoma bemorni avtomatik tayinlamaydi; UNASSIGNED uchun koordinator amali kerak.
