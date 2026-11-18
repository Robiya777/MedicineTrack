# Backend tekshiruvi

Sana: 2026-11-17. TZ 1.2, API 0.2.0. Faqat sintetik bemorlar bilan lokal ishlab chiqish muhiti.

## Bajarilgan tekshiruvlar

| Tekshiruv | Natija |
|---|---|
| PostgreSQL 16da pytest | 91 ta test o‘tdi |
| SQLite’da pytest | 85 ta o‘tdi; PostgreSQL row-lock talab qiladigan 6 ta test skip |
| Ikki parallel confirm | Bitta task va bitta yaratilish hodisasi |
| Bir xil kalitli parallel HTTP confirm | Bir xil idempotent javob, bitta task |
| Reassign va complete parallel so‘rovlari | Bitta amal muvaffaqiyatli; ikkinchisi konflikt/ruxsat xatosi |
| Ikki parallel dori tasdig‘i | Occurrences bitta marta yaratiladi |
| Ikki parallel offline qayd | Bitta DoseRecord, joriy natija bitta |
| Stop va revision approve poygasi | Bitta amal muvaffaqiyatli; kelajakdagi eski versiya qayta faollashmaydi |
| Django system check va migration drift | Xato va yozilmagan migratsiya yo‘q |
| Ruff lint va format | O‘tdi |
| OpenAPI validate, fail-on-warn | Xato va ogohlantirish yo‘q |
| Docker | Migrations tugadi, API readiness sog‘lom, Redis/worker/beat ishladi |
| HTTP demo | Login → bemor → AI mock/review → confirm → reassign → accept → complete; chat → holat → shifokor javobi → metrikalar o‘tdi |
| Dori HTTP demo | Klinik tasdiq → occurrences → takroriy qayd → correction → revision → kech offline tarix → stop; future-dose va ruxsat tekshiruvlari o‘tdi |
| Ishlayotgan API kontrakti | `/api/v1/docs` va `/api/v1/schema?format=json` HTTP 200; versiya 0.2.0 va yangi approve yo‘li tekshirildi |

Testlar JWT refresh reuse/logout va inactive user, web CSRF cookie, login limit, aktivatsiya muddati va besh urinishli bloklash, obyekt ruxsatlari, private PDF, snapshot, noto‘g‘ri vaqt, kech chiqarish, outbox dedupe, chat ruxsatlari, ish kalendari, qayta biriktirish va inson AI review holatlarini qamraydi. Dori modulida klinik ruxsat, statsionar DOCTOR doirasi, 90 kun/20 item/8 vaqt limitlari, timezone/DST, tasdiqsiz eslatma yo‘qligi, future-dose rad etilishi, append-only correction, revision/stop, bemor tarixi va kech offline qayd testlangan. `tests/` ichidagi nomlar aniq ssenariylarni ko‘rsatadi.

Ruxsatlar qayta tekshirilgani uchun qayta tayinlangan shifokor eski idempotency javobini ham ololmaydi. Faol biriktirish va shifokor muassasasi mosligi tekshiriladi. Muassasa almashgan statsionar xodimi eski muassasa chiqarishlarini ko‘rmaydi. Vaqtincha o‘chirilgan shifokor qayta yoqilganda yangi suhbat oldingi tarixni aralashtirmasdan ochiladi.

Backend qabul ssenariylari TZdagi AT-01…AT-33ning server qismini qamraydi. Shifokorga ko‘rinishi, koordinator UI, internet uzilganda klientning xatti-harakati va fizik qurilmadagi ishlash alohida web/APK integratsiyasida tekshiriladi. Har bir AT to‘liq mahsulot bo‘yicha o‘tdi degan xulosa chiqarilmaydi.

## §24 qabul mezonlari

| TZ sinovi | Backend dalili / qolgan ish |
|---|---|
| AT-34, AT-35 | DRAFT occurrence yaratmaydi; operator yoki klinik bayroqsiz DOCTOR approve qila olmaydi |
| AT-36 | UTC occurrences deterministik va takrorlanmaydi; zona, kun va resurs limitlari tekshirilgan |
| AT-38, AT-39 | TAKEN/SKIPPED bemor qaydi sifatida saqlanadi; javobsiz occurrence UNRECORDED, avtomatik natija yo‘q |
| AT-40 | Takroriy/parallel sync bitta record saqlaydi; klientdagi navbat va sync belgisi APKda tekshiriladi |
| AT-41 | Revision/stop kelajakdagi eski occurrence’larni bekor qiladi; tarix saqlanadi; lokal notification bekori APKda tekshiriladi |
| AT-44 | Boshqa bemor, texnik admin, koordinator va shifokorning bemor o‘rniga qayd kiritishi bloklangan |
| AT-45 | Noaniq doza/vaqtli yoki clarification belgilangan DRAFT approve qilinmaydi; mock adapter dori soatlarini tanlamaydi |
| AT-47 | To‘xtatilgan versiyaga kech yetgan qayd tarix sifatida saqlanadi; faol jadval qayta yoqilmaydi |
| AT-48 | Kelajakdagi occurrence va muddatidan oldingi TAKEN vaqti 400 bilan rad etiladi |
| AT-37, AT-42, AT-43, AT-46 | Fizik Android notification, alarm ruxsati, reboot, logout/kesh tozalash klient sinovlari; backend testi deb belgilanmaydi |

Patronaj, chat va dori uchta alohida jarayon ekanligi testda tekshirilgan: qabul qaydi taskni yopmaydi va chatga javob belgisi qo‘ymaydi.

## Hali tekshirilmagan yoki ulanmagan qismlar

- Frontend va Android klientlari bilan integratsiya, fizik qurilma va 360 px UI.
- TZdagi 1 000 bemor/task, 20 parallel foydalanuvchi bilan 5 daqiqalik p95 yuklama mezonlari.
- Schedulerning real vaqt sharoitida 60 soniyalik chegarasi: muddat va dedupe mantiqi testlangan, alohida davomiy vaqt sinovi o‘tkazilmagan.
- Generativ AI provayderi: hozir faqat aniq belgilangan `Demo/mock` adapter ishlaydi; tashqi servis timeouti real provayderda tekshirilmagan.
- Public HTTPS hosting, backup/restore amaliyoti, SMS/push va real tibbiy ma’lumot bilan pilot.

Lokal manzil va demo paroli `.env`da. U Gitdan chiqarilgan. Ishga tushirish va qayta tekshirish buyruqlari `README.md`da.

## Tab-isolated web sessions — 2026-11-18

- Added optional UUID tab_id to web login/refresh/logout; each selector uses a
  separate HttpOnly cookie. Unknown selectors never fall back to the legacy cookie.
- Verified two accounts share one browser cookie jar, retain identities after
  reload/rotation, and logout deletes only the selected tab cookie/session.
- Verified Secure/HttpOnly cookie attributes, CSRF enforcement, legacy web and
  Android auth compatibility through the existing auth regression suite.
- Full SQLite suite: 87 passed, 6 skipped (PostgreSQL-specific checks).
- Chromium tested two pages in one context, forced access expiry, separate logout,
  a fresh tab and a window.open copy of sessionStorage. All passed.

## Stage 6 record corrections and admin — 2026-11-18

Full SQLite suite: **93 passed, 6 skipped** (PostgreSQL-specific tests).
Four added regression tests cover correction original preservation, audit and
idempotent replay, report author/role/field/reason restrictions, own DRAFT-only
patient contact editing, and admin password reset revoking existing sessions
without returning the password. Existing account/reference permission tests pass.
Chromium web integration is documented in frontend/docs/STAGE6_ACCEPTANCE.md.
