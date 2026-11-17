# 4-bosqich — bemor va shifokor aloqasi

## Muhit

Lokal Django API, alohida sintetik SQLite baza va Chromium.
Frontend branchida backend kodi o‘zgartirilmadi.

## Ishlaydigan ekranlar

| Rol | Ekran |
|---|---|
| Bemor | `/faollashtirish`, `/kabinet/bemor`, `/kabinet/bemor/suhbat/{id}` |
| Statsionar | Chiqarish tafsilotida tekshirilgan telefon uchun aktivatsiya kodi |
| Shifokor | `/kabinet/shifokor/suhbat`, suhbat tafsiloti va javob yuborish |
| Koordinator | `/kabinet/koordinator/ish-jadvali`, `/kabinet/koordinator/murojaatlar` |

## Tekshirish

- Webda bemor yaratildi, telefon tasdiqlandi va aktivatsiya kodi olindi.
  Bemor kod va yangi parol bilan faollashdi; server qaytargan login bilan kirdi.
- Koordinator haftalik jadvalga tushlik tanaffusi va istisno kun kiritdi.
  Ustma-ust oraliqlar yuborilmadi. Server jadvalni saqladi.
- Bemor xabar va “Yomonlashdi” holatini yubordi; shifokor ularni ko‘rib javob berdi.
  Bemor 15 soniyalik polling orqali javob va “Javob berildi” belgisini ko‘rdi.
- Xabar/status serverda saqlangach brauzerga javob sun’iy uzildi. Qayta
  yuborish ayni kalit va Idempotency-Replayed bilan bitta yozuvni qaytardi.
  Muvaffaqiyatli yuborishdan so‘ng ataylab bir xil matn yuborilsa yangi yozuv yaratildi.
- Koordinator navbatida yomonlashgan bemor va javob muddati ko‘rindi;
  suhbat matni chiqarilmadi.
- Aktivatsiya va bemor suhbati 360 px, jadval va shifokor suhbati 1440 pxda
  tekshirildi. Skrinshotlar vizual ko‘rib chiqildi.

- Qayta tayinlashda eski shifokor tafsilotidan xabarlar va yuborish formasi
  yashirildi. Bemor eski tarixni ko‘rdi, yangi suhbatga o‘tdi va dastlabki
  javob muddati saqlandi. Yakunlangan patronajdan keyin ham xabar yuborildi.
- Kelajakdagi kuzatuv vaqti mijozda rad etildi.

## AT-24–AT-33 natijalari

| Mezoni | Natija | Dalil |
|---|---|---|
| AT-24 — begona suhbat | O‘tdi | Backend ruxsat testi |
| AT-25 — kod qayta ishlatilishi/muddati | O‘tdi | Aktivatsiya web oqimi va backend single-use/expiry/lockout testlari |
| AT-26 — xabar va holat | O‘tdi | Bemor → shifokor web oqimi |
| AT-27 — ish vaqtidan tashqari xabar | O‘tdi | Ish soati, tanaffus/istisno hisoblash testi va webdagi server muddati |
| AT-28 — o‘qish taskni yopmaydi | O‘tdi | Backend read testi va shifokor webi |
| AT-29 — takrorlanmaydigan eskalatsiya | O‘tdi | Ikki scan natijasida bitta outbox eventi; koordinator navbati webda |
| AT-30 — COMPLETEDdan keyin chat | O‘tdi | Shifokor webida patronaj yakunlandi, bemor xabari yuborildi |
| AT-31 — qayta biriktirish | O‘tdi | Uch rolning web oqimi, eski kirish yopilishi, tarix/deadline saqlanishi |
| AT-32 — tarmoqdan keyingi retry | O‘tdi | POST javobini uzib, kalit va server replay tekshirildi |
| AT-33 — Yomonlashdi | O‘tdi | Web holat formasi, kutmaslik eslatmasi va koordinator ustuvor filtri |

## Backend regressiyasi

`pytest tests/test_messaging.py tests/test_auth.py -q`: **22 passed**.

Testlar begona bemor kirishini rad etish, kodning bir marta ishlatilishi,
24 soatlik amal qilish va urinishlar limiti, ish soatlari/tanaffus/istisnolar,
o‘qilganlik taskni yakunlamasligi, bitta eskalatsiya, javobsiz muddatning
uzaymasligi, qayta tayinlash va yakunlangan taskdan keyingi chatni qamraydi.

## Chegara

AT-24–AT-33ning web/API qismlari tekshiriladi. Android APK bilan bitta umumiy
muhitdagi yakuniy ssenariy va ochiq HTTPS demo keyingi umumiy qabulga tegishli.
