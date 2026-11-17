# Backend tekshiruvi

Sana: 2026-11-17. Faqat sintetik bemorlar bilan lokal ishlab chiqish muhiti.

## Bajarilgan tekshiruvlar

| Tekshiruv | Natija |
|---|---|
| PostgreSQL 16da pytest | 46 ta test o‘tdi |
| SQLite’da pytest | 43 ta o‘tdi; PostgreSQL row-lock talab qiladigan 3 ta test skip |
| Ikki parallel confirm | Bitta task va bitta yaratilish hodisasi |
| Bir xil kalitli parallel HTTP confirm | Bir xil idempotent javob, bitta task |
| Reassign va complete parallel so‘rovlari | Bitta amal muvaffaqiyatli; ikkinchisi konflikt/ruxsat xatosi |
| Django system check va migration drift | Xato va yozilmagan migratsiya yo‘q |
| Ruff lint va format | O‘tdi |
| OpenAPI validate, fail-on-warn | Xato va ogohlantirish yo‘q |
| Docker | Migrations tugadi, API readiness sog‘lom, Redis/worker/beat ishladi |
| HTTP demo | Login → bemor → AI mock/review → confirm → reassign → accept → complete; chat → holat → shifokor javobi → metrikalar o‘tdi |

Testlar JWT refresh reuse/logout va inactive user, web CSRF cookie, login limit, aktivatsiya muddati va besh urinishli bloklash, obyekt ruxsatlari, private PDF, snapshot, noto‘g‘ri vaqt, kech chiqarish, outbox dedupe, chat ruxsatlari, ish kalendari, qayta biriktirish va inson AI review holatlarini qamraydi. `tests/` ichidagi nomlar aniq ssenariylarni ko‘rsatadi.

Backend qabul ssenariylari TZdagi AT-01…AT-33ning server qismini qamraydi. Shifokorga ko‘rinishi, koordinator UI, internet uzilganda klientning xatti-harakati va fizik qurilmadagi ishlash alohida web/APK integratsiyasida tekshiriladi. Har bir AT to‘liq mahsulot bo‘yicha o‘tdi degan xulosa chiqarilmaydi.

## Hali tekshirilmagan yoki ulanmagan qismlar

- Frontend va Android klientlari bilan integratsiya, fizik qurilma va 360 px UI.
- TZdagi 1 000 bemor/task, 20 parallel foydalanuvchi bilan 5 daqiqalik p95 yuklama mezonlari.
- Schedulerning real vaqt sharoitida 60 soniyalik chegarasi: muddat va dedupe mantiqi testlangan, alohida davomiy vaqt sinovi o‘tkazilmagan.
- Generativ AI provayderi: hozir faqat aniq belgilangan `Demo/mock` adapter ishlaydi; tashqi servis timeouti real provayderda tekshirilmagan.
- Public HTTPS hosting, backup/restore amaliyoti, SMS/push va real tibbiy ma’lumot bilan pilot.

Lokal manzil va demo paroli `.env`da. U Gitdan chiqarilgan. Ishga tushirish va qayta tekshirish buyruqlari `README.md`da.
