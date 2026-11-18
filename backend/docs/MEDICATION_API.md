# Dori jadvali API — TZ 1.2

Barcha yo‘llar `/api/v1` ostida, autentifikatsiya `Authorization: Bearer <access>`. Bu API mavjud ko‘rsatmadan jadval tuzadi; dori, doza yoki soatni o‘zi tanlamaydi. Android lokal notification, shifrlangan navbat, reboot va logoutdagi tozalash klient vazifasidir.

## Ruxsatlar

- `COORDINATOR`: o‘z muassasasi boshqaradigan discharge uchun DRAFT yaratadi va tahrirlaydi. Approve/stop/revision va bemorning qabul tarixi uchun ruxsati yo‘q.
- Oilaviy `DOCTOR`: faqat faol PatientAssignment orqali o‘ziga biriktirilgan bemorning jadvali va tarixini ko‘radi; DRAFT yaratadi/tahrirlaydi, revision va stop qiladi.
- Approve uchun qo‘shimcha **`can_approve_medication_schedule=true`** talab qilinadi. Bu ruxsatning o‘zi boshqa bemorga kirish bermaydi.
- Statsionardagi `DOCTOR` o‘z muassasasida **o‘zi yaratgan discharge** uchun jadval tuzib, klinik ruxsat bilan tasdiqlay oladi. Family Assignment bo‘lmasa bemorning qabul qaydlari ochilmaydi: occurrences javobida `record` yo‘q va `status=NOT_AVAILABLE`.
- `PATIENT`: o‘zining faqat tasdiqlangan jadvallari va qabul tarixini ko‘radi, o‘zi uchun TAKEN/SKIPPED qayd va correction yuboradi. Jadvalni o‘zgartirmaydi.
- `ADMIN` va `COORDINATOR`ga dori matni va qabul tarixi avtomatik ochilmaydi.

Texnik admin `/reference/accounts/{doctor_id}`ga PATCH bilan klinik ruxsatni boshqaradi. Uni operator roliga berish rad etiladi. Login va `/me` javobida ruxsat bayrog‘i bor. Demo seed `demo.doctor` va `demo.doctor2` uchun ruxsatni yoqadi; odatiy yangi akkauntda u o‘chiq.

## DRAFT yaratish

`POST /patients/{patient_id}/medication-plans`, `Idempotency-Key` bilan:

```json
{
  "discharge_id": "<discharge UUID>",
  "items": [{
    "name": "Sintetik demo dori",
    "prescribed_dose_text": "Sintetik doza (demo)",
    "route": "Sintetik qabul yo‘li",
    "source_reference": "Sintetik epikriz, 1-bet, mavjud ko‘rsatma",
    "instructions": "",
    "start_date": "2026-11-17",
    "end_date": "2026-11-18",
    "timezone": "Asia/Tashkent",
    "local_times": ["08:00", "20:00"],
    "schedule_type": "FIXED_TIMES",
    "needs_clarification": false
  }]
}
```

`201`: DRAFT, `version=1`, `lock_version=1`, `items[]`. DRAFTda yetishmagan maydonlar bo‘lishi mumkin; `missing_fields` ularni ko‘rsatadi. Tasdiqsiz occurrence yaratilmaydi. Bemor DRAFTni ko‘rmaydi. `AS_NEEDED` va boshqa schedule turlari qabul qilinmaydi. Noaniq ko‘rsatma `needs_clarification=true` bilan klinik tekshiruvda qoladi.

`PATCH /medication-plans/{id}`: `version`, `lock_version` va ixtiyoriy `items`. `items` yuborilsa DRAFTning to‘liq ro‘yxatini almashtiradi. Faol jadvalga PATCH — `409`.

## Versiya va tasdiq

Ikki alohida versiya bor:

| Maydon | Ma’nosi |
|---|---|
| `series_id` | Jadvalning barcha klinik versiyalarini bog‘laydi |
| `version` | Tasdiqlanadigan klinik versiya: 1, 2, 3… |
| `lock_version` | Shu yozuvga o‘zgartirish kiritilganda oshadigan optimistik bloklash raqami |

PATCH, approve, revisions va stopda oxirgi javobdagi ikkala versiyani yuboring. `409`da jadvalni qayta oling. Bir xil so‘rovni qayta yuborishda bir xil `Idempotency-Key` va payloadni saqlang. Ruxsatlar bekor bo‘lsa keshdagi klinik javob ham qayta berilmaydi.

`POST /medication-plans/{id}/approve`:

```json
{"version":1,"lock_version":1}
```

To‘liq maydonlar, manba, IANA zona va aniq `HH:MM` vaqtlari kerak. Butun jadval maksimum 90 kun, item maksimum 20 ta, har birida sutkaga maksimum 8 ta takrorlanmas vaqt. Bir xil dori/doza/yo‘lning bir paytga tushgan takrorlari rad etiladi; turli dorilarning bir vaqtda bo‘lishi taqiqlanmaydi. DST sabab mavjud bo‘lmagan yoki ikki xil talqin qilinadigan vaqt avtomatik ko‘chirilmaydi, aniqlashtirish talab qilinadi.

Tasdiqda ACTIVE va deterministik UUIDli occurrences bitta DB tranzaksiyada yaratiladi. Tasdiq takrorlansa occurrence ko‘paymaydi. Butun kurs allaqachon tugagan bo‘lsa COMPLETED yoziladi. Kurs tugashi lokal oxirgi kunning yakuni bo‘yicha hisoblanadi; scheduler ACTIVE → COMPLETED qiladi, qabul natijasini taxmin qilmaydi.

## Klientga jadval va vaqtlarni olish

- `GET /patients/{id}/medication-plans` — pagination bilan barcha ruxsatli versiyalar, jumladan STOPPED va COMPLETED. Eski lokal eslatmalarni bekor qilish uchun ularning holatini ham qayta oling.
- `GET /medication-plans/{id}` — bitta ruxsatli jadval.
- `GET /medication-plans/{id}/occurrences?plan_version=1&date_from=2026-11-17&date_to=2026-11-18` — server hisoblagan vaqtlar.

`date_from/date_to` har itemning tasdiqlangan vaqt zonasida talqin qilinadi. UTC bo‘yicha filtrlash uchun `scheduled_from/scheduled_to` ISO-8601 vaqt zonali qiymatlari bor. Qurilma zonasi hisobga o‘zicha qo‘shilmaydi. Noto‘g‘ri `plan_version` — `409`.

Javobda `results/count/next/previous`, `server_time`, `cache_max_age_seconds=86400`; occurrencesda yana `plan_id/plan_version/plan_status` bor. Itemning zona/soatlari, occurrence ID, UTC `scheduled_at`, `cancelled_at`, `reminder_enabled` qaytadi. Kurs qisqa bo‘lsa ham sahifalarning hammasini olish kerak; `page_size` maksimum 100.

Android faqat tasdiqlangan joriy jadvalning kelajakdagi, bekor qilinmagan occurrence’larini lokal rejalashtiradi. Oxirgi muvaffaqiyatli sync vaqtini saqlaydi; 24 soatdan eski keshga eskirganlik eslatmasini ko‘rsatadi. Bu server notification yetkazganining yoki dori qabul qilinganining dalili emas. Qurilmada faqat kerakli minimal medication ma’lumoti va yuborilmagan qaydlar shifrlab saqlanadi; chat/epikriz bu keshga kirmaydi.

## Bemor qaydi

`POST /dose-occurrences/{id}/record`, faqat shu bemor:

```json
{
  "plan_version": 1,
  "result": "TAKEN",
  "reported_taken_at": "2026-11-17T08:02:00+05:00",
  "client_recorded_at": "2026-11-17T08:03:00+05:00",
  "note": "Sintetik bemor qaydi"
}
```

SKIPPED uchun `reported_taken_at=null`; izoh ixtiyoriy. Barcha vaqtlar zonali ISO-8601. `scheduled_at <= reported_taken_at <= client_recorded_at <= server_now`; SKIPPEDda `scheduled_at <= client_recorded_at <= server_now`. Kelajakdagi occurrence — `400`, boshqa bemorniki — `404`, shifokorning bemor o‘rniga yozishi — `403`.

Birinchi yozuv `201`; bir xil payload boshqa kalit bilan qaytarilsa ham mavjud yozuv `200`. Natijani o‘zgartiradigan ikkinchi POST — `409`; correction ishlating. DBdagi UNIQUE kalit 24 soatlik idempotency muddati tugagach ham dublikatni to‘sadi. Offline navbat occurrence ID, `plan_version`, asl payload va `Idempotency-Key`ni saqlaydi.

Javobda `patient_reported=true`, server qabul vaqti va haqiqiy/bemor kiritgan vaqtlar alohida. `late_recorded` haqiqiy qabuldan (SKIPPEDda belgilangan vaqtdan) keyin hujjatlashtirishni bildiradi; `recording_delay_seconds` uning farqi. `sync_delay_seconds` klientdagi qayddan servergacha kechikish. Bular klinik xavf yoki dori haqiqatan qabul qilinganining bahosi emas.

## Tuzatish va tarix

`POST /dose-records/{id}/corrections` — faqat original bemor. Qaydning oxirgi `version`, `plan_version`, yangi `result/reported_taken_at/client_recorded_at/note` va majburiy `reason` yuboriladi. Original o‘zgarmaydi; `original` va `corrections[]` qaytadi. Joriy natija oxirgi correctiondan olinadi; stale `version` — `409`.

`GET /patients/{id}/medication-history`: faqat bemor yoki faol biriktirilgan oilaviy shifokor, pagination va sana filtrlari. O‘tgan occurrences, jumladan hech qanday qayd yo‘qlari ko‘rsatiladi. Hech qanday amal bo‘lmasa `UNRECORDED`; avtomatik SKIPPED yoki TAKEN yo‘q. Occurrences ro‘yxatidagi boshqa holatlar `UPCOMING`, `CANCELLED`, `TAKEN`, `SKIPPED`.

## Yangi versiya va stop

`POST /medication-plans/{id}/revisions`: oxirgi `version/lock_version`, ixtiyoriy yangi `items`. `201` bilan keyingi klinik versiyadagi DRAFT keladi. U tasdiqlanguncha oldingi jadval ACTIVE. Bir faol versiya uchun bitta tekshirilmagan revision bo‘lishi mumkin. Revision approve qilinganda eski versiya STOPPED bo‘ladi, kelajakdagi eski occurrences bekor qilinadi va yangi versiyaning faqat kelajakdagi vaqtlari yaratiladi. Oldingi qabul tarixi o‘zgarmaydi.

`POST /medication-plans/{id}/stop`: oxirgi `version/lock_version` va majburiy `reason`. Kelajakdagi occurrences `cancelled_at` bilan belgilanadi, o‘chirilmaydi. Syncdan keyin klient eski lokal eslatmalarni bekor qiladi.

Stop yoki revision paytida offline qolgan bemorning eski versiyaga qaydi keyin kelishi mumkin. Agar occurrence va vaqtlar haqiqiy bo‘lsa tarix sifatida saqlanadi, `recorded_against_inactive_plan=true`; jadval qayta ACTIVE bo‘lmaydi. Qurilmaga tezkor stop yetib borishi va notificationning darhol yo‘qolishi backend tomonidan kafolatlanmaydi.

Dori qaydi, 24 soatlik patronaj va chatga 4 ish soatida javob berish uchta alohida jarayon. Dori qaydi taskni yakunlamaydi va chatni javob berilgan qilmaydi.
