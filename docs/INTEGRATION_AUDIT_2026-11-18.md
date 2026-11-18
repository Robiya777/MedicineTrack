# MedicineTrack — backend va frontend integratsiya tekshiruvi

Sana: 2026-11-18, Asia/Tashkent. Uchta agent backend, frontend va API kontraktini parallel ko‘rdi; asosiy agent haqiqiy Chromium brauzerida ishchi kabinetlarni tekshirdi. Barcha yangi test ma’lumotlari sintetik va alohida QA hududi/muassasalariga tegishli.

Asosiy web oqimlari bitta ishlayotgan backendga ulangan va quyidagi sinovlardan o‘tdi. PDF/AI ishchi UI, tashqi AI modeli va ayrim topshirish jarayonlari hali to‘liq ulanmagan. Ushbu hisobot barcha funksiyalar tugaganini yoki production/pilot tayyorligini bildirmaydi.

## Ishlayotgan muhit

| Qism | Manzil / holat |
|---|---|
| Frontend | http://localhost:5173 — Vite ishlayapti |
| REST API | http://localhost:8001/api/v1 — Docker API sog‘lom |
| Swagger | http://localhost:8001/api/v1/docs |
| DB | PostgreSQL 16, shu Compose loyihasiga tegishli baza |
| Fon xizmatlari | Redis, Celery worker va beat ishlayapti; in-app yetkazish brauzerda tekshirildi |

Lokal `frontend/.env` yo‘q edi; standart `8000` porti boshqa loyihaga olib borardi. `API_PROXY_TARGET=http://127.0.0.1:8001` lokal sozlamasi qo‘yildi. Brauzer orqali proxydan olingan OpenAPI nomi va health javobi aynan MedicineTrack ekanligi tekshirildi. `.env` fayllari Gitdan chiqarilgan.

## Tekshiruv natijalari

| Tekshiruv | Natija |
|---|---|
| Backend — PostgreSQL | 112 passed |
| Backend — SQLite | 106 passed, 6 PostgreSQL concurrency testi skip |
| Frontend — regressiyalar | 9 passed |
| Frontend — o‘rnatish/build | `npm ci`, ESLint, TypeScript va production build o‘tdi |
| Backend — kod/kontrakt | Ruff, Django check, migratsiya tekshiruvi va OpenAPI validate o‘tdi |
| Haqiqiy Chromium — integratsiya | 20/20 tekshiruv o‘tdi |
| Brauzer oqimlaridagi xatolar | 0 JavaScript page error, 0 HTTP 5xx |
| Runtime dependency audit | `npm audit --omit=dev`: 0 topilma |

20 ta tekshiruvning mashina o‘qiydigan dalili: [qa/browser-audit-2026-11-18.json](qa/browser-audit-2026-11-18.json). Backend va frontenddagi alohida natijalar [backend/VALIDATION.md](../backend/VALIDATION.md) va [frontend/VALIDATION.md](../frontend/VALIDATION.md)da.

## Brauzerda bajarilgan oqimlar

1. Frontend proxy → MedicineTrack health/OpenAPI.
2. Statsionar login, sahifa yangilanganda sessiya tiklanishi.
3. `null` maydonli dori DRAFTi butun ro‘yxatni buzmasdan ko‘rinishi.
4. Webdan yangi bemor va DRAFT chiqarish yaratish.
5. Chiqarishni tasdiqlash, bitta UNASSIGNED task va aynan 24 soatlik deadline.
6. Koordinator aynan shu taskni shifokorga tayinlashi; deadline saqlanishi.
7. Shifokor qabul qilishi, javobsiz aloqa urinishidan keyin vazifa ochiq qolishi.
8. Shifokor natija yuborishi va statsionarda shu natija ko‘rinishi.
9. Bir martalik kod orqali web aktivatsiya va yangi bemorning o‘z kabinetiga kirishi.
10. Ketma-ket ikkita bir xil xabarning ikkita turli Message ID bilan saqlanishi.
11. Bemor holati koordinatorga chiqishi va shifokor javobi bemorda ko‘rinishi.
12. Ish jadvalini takroriy saqlash, ikki koordinatorning stale tahririga 409, forma qiymatlari saqlanishi va mavjud javobsiz muddat uzaymasligi.
13. In-app bildirishnomani olish va o‘qilgan deb belgilash.
14. Klinik ruxsatli shifokorning to‘liq DRAFTni tasdiqlashi.
15. Bemor dori qaydi va faqat izoh tuzatishida asl qabul vaqti saqlanishi.
16. Statsionardagi DOCTORning o‘z chiqarishi va dori tasdig‘iga kirishi.
17. Adminning xodim/muassasa/hudud ro‘yxatlari; webdan yangi hudud, poliklinika va ruxsatli shifokor yaratishi.
18. Bir brauzerning alohida vkladkalarida turli akkauntlar; biridan logout boshqasini chiqarmasligi; tokenlar localStorage/sessionStorage’da saqlanmasligi.
19. 360 px ekran, mobil menyu, Escape bilan yopish va gorizontal overflow yo‘qligi.
20. Oqimlar davomida JavaScript va server 5xx xatolari kuzatilmagani.

Desktop/mobil, chat, dori qaydi va jadval konflikti skrinshotlari lokal `/tmp/medicinetrack-browser-audit/results/`da saqlandi. Mobil va desktop ko‘rinishlari vizual ko‘rib chiqildi. Bu tekshiruv Chromium bilan bajarildi; barcha brauzer va fizik qurilmalarga umumlashtirilmaydi.

## Topilgan va tuzatilgan muammolar

| Muammo | Tuzatish |
|---|---|
| `npm ci` noto‘liq optional lock yozuvi sabab to‘xtardi | Lockfile yozuvi tuzatildi, toza o‘rnatish o‘tdi |
| Bir xil muvaffaqiyatli xabar eski idempotency kalitini qayta ishlatardi | Yangi muvaffaqiyatli amal yangi kalit oladi; xatodan keyingi retry kalitni saqlaydi |
| Noaniq dori DRAFTidagi null nom/doza/yo‘l frontend parserini yiqitardi | Server javobi nullni qabul qiladi, tahrir formasi qiymatlarni xavfsiz normallashtiradi |
| Faqat izohni tuzatish qabul vaqtini hozirgi vaqtga almashtirardi | Original vaqt, jumladan soniya ulushi, o‘zgarmasa saqlanadi |
| Hospital DOCTOR oilaviy shifokor kabinetiga yo‘naltirilardi | `organization_type` va muassasaga mos workspace/capability tekshiruvlari qo‘shildi |
| Ish jadvalidagi parallel tahrirlar bir-birini bosib yozardi | PUT uchun `version` majburiy, stale versiya 409; frontend qaytgan versiyani saqlaydi |
| Boshqa shifoxonaga o‘tgan xodim eski AI natijasini o‘qiy olardi | AI read/review joriy ruxsatli chiqarishlar bilan cheklangan |
| Klinikasini almashgan shifokor eski klinika tasklarini o‘qiy olardi | `receiving_org` joriy muassasaga mos bo‘lishi talab qilinadi; eski bildirishnomalar ham yuborilmaydi |
| Faol biriktirish bekor bo‘lsa ham eski chatga yozish mumkin edi | Yozish paytida biriktirish qayta tekshiriladi; eski suhbat uchun 409 |
| Dastlabki refresh login limitini sarflardi | Refresh alohida 60/min, login talabi 10/min bo‘lib qoldi |

Tuzatishlar regressiya testlari bilan qoplangan. Backend qayta build qilindi. Frontend build va yangilangan backend bilan haqiqiy brauzer tekshiruvlari o‘tdi.

## Hali ulanmagan yoki tekshirilmagan qismlar

| Qism | Holat |
|---|---|
| Ishchi web PDF/AI ekrani | Backend upload/extraction/review endpointlari bor; webda ular hozir faqat dizayn preview’ida, ishchi kabinetga ulanmagan |
| Haqiqiy AI provayderi | `AI_MODE=mock`, tashqi modelga ulanish yo‘q |
| Qayta tayinlashdagi auditli handover xulosasi | Alohida model/API/forma yo‘q. Muddat yangi suhbatga o‘tadi, oldingi savol yopiq tarixda qoladi |
| Web → ayni yozuv → Android | Android 0.3.0 davomida API 34 emulatorda PASS: ayni bemor/jadval/suhbat va webda yakunlangan chaqiruv o‘qildi; [81 + 31 tekshiruv](../android/VALIDATION.md) |
| Fizik Android alarm, reboot, ruxsat va offline kesh | Ushbu backend/frontend tekshiruvining qismi emas; APKda alohida tekshiriladi |
| 1 000 task/20 foydalanuvchi yuklamasi, public HTTPS | Ushbu tekshiruvda o‘tkazilmadi |

Haqiqiy SMS/push ham keyingi integratsiya bosqichidir; sinovdan o‘tgan bildirishnoma kanali — in-app.

`npm audit` dev/build vositalarida bitta picomatch ReDoS muammosidan kelib chiqqan 16 ta yuqori darajali dependency-chain topilmasini ko‘rsatadi. Runtime auditda topilma yo‘q. Tekshiruv vaqtida mos tuzatilgan versiya mavjud emasligi [rasmiy GitHub advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) va registry orqali tekshirildi; majburiy breaking downgrade qo‘llanmadi.

## Brauzer tekshiruvini takrorlash

Avval lokal demo backend va frontendni yuqoridagi manzillarda ishga tushiring. Backend `.env`da `DEMO_MODE=true` va `DEMO_PASSWORD` kerak. Quyidagi fixture faqat yangi sintetik QA ma’lumotlarini yaratadi; ishlab chiqarish muhiti uchun mo‘ljallanmagan.

```bash
mkdir -p /tmp/medicinetrack-browser-audit
npm install --prefix /tmp/medicinetrack-browser-audit --no-save playwright
cd backend
docker compose exec -T api python manage.py shell -v 0 < ../scripts/create-browser-audit-fixture.py > /tmp/medicinetrack-browser-audit/fixture.json
cd ..
node scripts/browser-audit.mjs
```

Chromium uchun standart `/usr/bin/google-chrome` ishlatiladi. Boshqa muhitda `CHROME_PATH`, `QA_BASE_URL`, `QA_FIXTURE`, `QA_OUTPUT`, `PLAYWRIGHT_PACKAGE_DIR` bilan sozlash mumkin. Parol va aktivatsiya kodi hisobotga yozilmaydi, skrinshotlarda maxfiy inputlar/kodlar yopiladi. Qayta ishga tushirishdan oldin yangi fixture yarating: sinov ba’zi DRAFTlarni tasdiqlaydi va yangi qaydlar qo‘shadi. Skript login limitini pasaytirmaydi; 429 bo‘lsa serverning Retry-After muddatini kutadi.
