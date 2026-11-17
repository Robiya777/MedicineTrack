# MedicineTrack backend

REST API, PostgreSQL modellari, JWT sessiyalari, patronaj topshiriqlari, bemor–shifokor xabarlari, tasdiqlangan dori jadvallari va Celery fon vazifalari. Barcha backend fayllari shu papkada. API versiyasi 0.2.0; TZ 1.2dagi §24 moduli qo‘shilgan.

Dori jadvali, klinik ruxsat, versiya, offline qayd va klient sync kontrakti: [docs/MEDICATION_API.md](docs/MEDICATION_API.md). Tekshiruv natijalari va qolgan klient sinovlari: [VALIDATION.md](VALIDATION.md).

Texnologiyalar: Python 3.13, Django 5.2, Django REST Framework, PostgreSQL 16, Redis 7, Celery. Aniq paket versiyalari `uv.lock` va `requirements.txt`da.

## Docker orqali ishga tushirish

Buyruqlarni `backend/` papkasida bajaring:

```bash
cp .env.example .env
# .env ichida DJANGO_SECRET_KEY va POSTGRES_PASSWORD qiymatlarini almashtiring.
docker compose up -d --build
docker compose exec api python manage.py seed_demo
```

Migratsiyalar `migrate` servisi orqali bir marta bajariladi; API va worker uning muvaffaqiyatli tugashini kutadi. `seed_demo` sintetik akkauntlar uchun tasodifiy parol chiqaradi. `.env`ga `DEMO_PASSWORD` kiritsangiz, seed shu parolni ishlatadi va uni chiqarmaydi. Bu holda `.env` o‘zgargach `docker compose up -d` bajaring.

- API: `http://localhost:8000/api/v1`
- Swagger: `http://localhost:8000/api/v1/docs`
- OpenAPI: `http://localhost:8000/api/v1/schema`, saqlangan kontrakt: `openapi.yaml`
- Health: `/health/live`, `/health/ready`

`APP_PORT` va `POSTGRES_PORT` band bo‘lsa `.env`da almashtiring. API va PostgreSQL portlari faqat localhostga ochiladi. Celery worker va beat in-app bildirishnomalar, eslatmalar, eskalatsiya hamda AI demo navbatini ishlatadi.

Demo akkauntlar:

| Login | Rol |
|---|---|
| `demo.hospital` | Statsionar xodimi |
| `demo.doctor`, `demo.doctor2` | Oilaviy shifokor |
| `demo.coordinator` | Koordinator |
| `demo.admin` | Texnik admin |
| `demo.patient` | Bemor |

Seed uchta vaziyat tayyorlaydi: yangi, mas’ulsiz va kechikkan chaqiruv. Qayta seed qilish mavjud task muddatlarini o‘zgartirmaydi, demo parollarini yangilaydi. `DEMO_MODE=false` bo‘lsa seed rad etiladi.

## Dockersiz tezkor ishga tushirish

`uv` va Python 3.13 kerak; `uv sync` mos Pythonni yuklay oladi.

```bash
uv sync --frozen
cp .env.example .env
uv run python manage.py migrate
uv run python manage.py seed_demo
uv run python manage.py runserver 127.0.0.1:8000
```

Bo‘sh `DATABASE_URL` SQLite ishlatadi. SQLite lokal oqimni ko‘rish uchun; parallel so‘rovlarning row-lock kafolati PostgreSQLda tekshiriladi. Redis ishlatilmasa, boshqa terminalda `uv run python manage.py process_jobs` bir martalik fon siklini bajaradi. Doimiy worker uchun `.env`da PostgreSQL va Redis URLlarini bering va Celery worker/beatni ishga tushiring.

## Web va Android integratsiyasi

Yo‘llar oxirida slash yo‘q. Sana va vaqt ISO-8601, vaqt zonasi bilan beriladi; server UTC qaytaradi. UI `Asia/Tashkent`da ko‘rsatadi.

Android yoki Swagger uchun:

```http
POST /api/v1/auth/login
Content-Type: application/json

{"username":"demo.doctor","password":"<seed bergan parol>","client":"android"}
```

Javob: `access`, `refresh`, `user`. Keyingi so‘rovga `Authorization: Bearer <access>` qo‘shing. Access 15 daqiqa, sessiya va refresh 7 kun amal qiladi. Refresh har ishlatilganda almashtiriladi; eski refreshni qayta ishlatish shu sessiyani bekor qiladi. Logout accessni ham darhol yaroqsiz qiladi. Android tokenlarni Keystore yordamida saqlashi kerak.

Web uchun avval `GET /auth/csrf`ni `credentials: include` bilan chaqiring. Qaytgan `csrf_token`ni `X-CSRFToken`da, loginda `client: web` yuboring. Refresh HttpOnly cookiega yoziladi, JSONga qaytarilmaydi. Refresh va logoutda ham cookie hamda CSRF header kerak. Lokal HTTPda `COOKIE_SECURE=false`; HTTPS muhitida `true` bo‘ladi. CORS va CSRF originlar `.env` orqali aniq belgilanadi.

List javobi: `results`, `count`, `next`, `previous`; `page_size` odatda 20, maksimum 100. Task filtrlari: `status`, `overdue=true/false`, `due_before`, `doctor_id`, `organization_id`, `discharged_from`, `discharged_to`. Bemor qidiruvi aniq `id` bo‘yicha va o‘z muassasasi doirasida; global ism/telefon qidiruvi yo‘q.

Mutatsiyalarda noyob `Idempotency-Key` yuboring. Bir foydalanuvchi + metod/yo‘l + kalit natijasi 24 soat saqlanadi; o‘sha kalit bilan boshqa payload — `409`. Qayta yuborishda kalit va payloadni saqlang. Auth va aktivatsiya endpointlari bu keshdan foydalanmaydi: parol/token/aktivatsiya kodi javobi idempotency jadvaliga yozilmaydi. Aktivatsiya kodi qayta berilganda oldingisi bekor bo‘ladi.

Task amallarida oxirgi javobdagi `version`ni yuboring. `409` kelsa taskni qayta oling; eski forma avtomatik muvaffaqiyatli deb belgilanmaydi.

```json
{"code":"VALIDATION_ERROR","message":"Maydonlarni tekshiring","fields":{"performed_at":["..."]},"request_id":"uuid"}
```

`401`: sessiya, `403`: vakolat, `404`: topilmagan yoki yashirilgan obyekt, `409`: holat/versiya, `413`: PDF hajmi, `429`: limit. Login IP bo‘yicha 10/min, xabar va holat birgalikda foydalanuvchi bo‘yicha 20/min. Xabarlar foregroundda 15 soniyada polling/refresh orqali olinishi mumkin.

## Asosiy oqim

1. Statsionar `POST /patients`, so‘ng `POST /discharges` bilan loyiha yaratadi.
2. Ixtiyoriy `POST /discharges/{id}/attachments` PDF qabul qiladi. PDF ≤10 MB, MIME/signatura va o‘qilishi tekshiriladi; fayl nomi serverda UUIDga almashtiriladi.
3. `POST /discharges/{id}/confirm` bitta tranzaksiyada snapshot, task va outbox yozuvini saqlaydi. Faol biriktirish bo‘lmasa `UNASSIGNED`; tasodifiy shifokor tanlanmaydi.
4. Shifokor `GET /tasks`, `/accept`, `/contact-attempts`, `/complete` orqali ishlaydi. Natija faqat qabul qilingan taskka yoziladi.
5. Koordinator `/reassign`, `/cancel`, `/dashboard/metrics`dan foydalanadi. Qayta tayinlash yangi shifokordan qayta qabul talab qiladi.

`due_at = discharged_at + 24 soat`. Qayta tayinlash, kech kiritish va servis restarti muddatni yangilamaydi. 12/20 soatlik eslatmalar, overdue uchun bitta dedupe qilingan eskalatsiya bor. Scheduler har 60 soniya ishlaydi. Outbox 5 soniyada tekshiriladi, xatoda 1/5/15 daqiqadan keyin takrorlanadi. Yopilgan task uchun hali yetkazilmagan bildirishnoma yuborilmaydi.

Tasdiqlangan tavsiya va yakuniy hisobot o‘rniga append-only correction qo‘shiladi; sana/statusni correction bilan o‘zgartirib bo‘lmaydi. Tarixiy bemor ma’lumoti tasdiqlash paytidagi snapshotdan ko‘rsatiladi. Boshqa muassasa yozuvlari, metrikalari va fayllari ruxsat doirasidan tashqarida ko‘rinmaydi. Texnik adminning odatiy roli klinik yozuvlarni ochmaydi.

## Bemor kabineti va chat

Statsionar tekshirilgan telefon uchun `POST /patients/{id}/activation`ga `{"phone_verified":true}` yuboradi. Javobdagi kod bir martalik, 24 soatlik; bazada hash saqlanadi. `POST /auth/patient-activate`ga `patient_id`, `code`, `password` yuboriladi. Javobdagi `username` bilan odatdagi login qilinadi. Besh xato kod urinishidan keyin yangi kod talab qilinadi.

`GET /conversations` bemorning joriy suhbatini tayyorlaydi. Xabarlar: `GET/POST /conversations/{id}/messages`, o‘qilganlik: `POST .../read`. Holat: `GET/POST .../status-updates`; payload: `self_reported_state` (`IMPROVED`, `UNCHANGED`, `WORSENED`), `note`, `observed_at`. Matn 1–4000 belgi. Xabar javobida `SENT`, `READ`, `ANSWERED` va `answered_at` beriladi.

Koordinator `GET/PUT /doctors/{id}/work-schedule` orqali jadval beradi:

```json
{"timezone":"Asia/Tashkent","shifts":[{"weekday":0,"start":"09:00","end":"18:00"}],"exceptions":{"2026-12-08":[]}}
```

`weekday`: dushanba 0, yakshanba 6. Tanaffus uchun bir kunda bir nechta kesishmaydigan interval yoziladi. `exceptions` sanada odatdagi jadvalni almashtiradi; bo‘sh ro‘yxat — dam olish kuni. Javob muddati birinchi javobsiz xabardan 4 ish soati. Keyingi xabarlar, qayta biriktirish va jadval o‘zgarishi mavjud deadline’ni yangilamaydi. Jadval bo‘lmasa `response_due_at=null` va konfiguratsiya bildirishnomasi yaratiladi.

Shifokor almashganda eski suhbat yozish uchun yopiladi, eski shifokorning kirishi bekor qilinadi, bemorda tarix qoladi. Yangi shifokor oldingi chat matnini avtomatik ko‘rmaydi. Task yakunlansa ham faol PatientAssignment bilan chat davom etadi. `/dashboard/unanswered` koordinatorga vaqt va identifikatorlarni beradi; klinik chat matnini bermaydi. `WORSENED` alohida ustuvor bildirishnoma va navbat belgisini yaratadi. Chat dastlabki patronaj taskini avtomatik yopmaydi.

Texnik admin uchun `/reference/accounts` xodim akkauntlarini boshqaradi; `/reference/organizations` va `/reference/territories` ma’lumotnomalarni boshqaradi. Bemor akkauntlari staff ro‘yxatiga kirmaydi.

## AI demo adapter

`AI_MODE=mock` faqat `Xulosa:`, `Tashxis:`, `Tavsiya:`, `Kuzatuv:` qatorlarini matndan/PDFdan manbasi bilan ajratadi. Javobda `is_mock=true`, `model_version=demo-extractive-v1` va “Demo/mock” ogohlantirishi bor. Bu generativ AI integratsiyasi emas; tashqi modelga ma’lumot yuborilmaydi. `AI_MODE=disabled`da qo‘lda chiqarish oqimi ishlaydi.

`POST /discharges/{id}/ai-extractions`ga `text` yoki `attachment_id` yuboring; `202` va extraction ID qaytadi. Natija `/ai-extractions/{id}`dan olinadi. Matnsiz/skan PDFga `TEXT_NOT_FOUND` qaytadi. Ajratilmagan maydon `null`/bo‘sh ro‘yxat, topilgan faktlarda sahifa va manba parchasi bor. `PENDING_REVIEW` natijasi xodim barcha maydonlarni `/review` orqali tekshirmaguncha chiqarish yozuvini o‘zgartirmaydi. Klinika tavsiyasi, tashxis yoki dozani adapter o‘zi yaratmaydi.

## Tekshirish

```bash
uv run pytest -q
uv run python scripts/test_postgres.py
uv run ruff check .
uv run ruff format --check .
uv run python manage.py check
uv run python manage.py makemigrations --check --dry-run
uv run python manage.py spectacular --file openapi.yaml --validate --fail-on-warn
```

PostgreSQL skripti shu Compose DBni ishga tushiradi va alohida `test_...` bazasida testlarni bajaradi. Parallel confirm, bir xil idempotency kaliti, reassign/complete, dori tasdig‘i, offline qayd hamda stop/revision poygasi PostgreSQLda tekshiriladi; bu olti test SQLite’da skip qilinadi.

Ishlayotgan Docker APIga HTTP sinov (`DEMO_PASSWORD` `.env`da seed bilan bir xil bo‘lishi kerak):

```bash
uv run python scripts/smoke_test.py
uv run python scripts/smoke_medications.py
```

Birinchi skript sintetik bemor va task yaratadi, AI mock/review, tasdiqlash, biriktirish, qabul qilish, yakunlash, chat va holat yuborishni tekshiradi. Ikkinchisi klinik dori tasdig‘i, occurrences, bemor qaydi, correction, yangi versiya, kech offline tarix va stopni tekshiradi. Ikkalasi ham token/parolni chiqarmaydi. Yangilangan `seed_demo` `demo.patient` uchun sintetik tasdiqlangan dori jadvali ham yaratadi.

Web/APK klientlari, fizik Android QA, tashqi AI provayderi, real SMS/push, public hosting va TZdagi 1000 task/20 parallel foydalanuvchilik yuklama sinovi alohida integratsiya ishlaridir. Lokal test natijalari bu tekshiruvlarning o‘rniga ko‘rsatilmaydi.

### Vkladka uchun web sessiyasi

Web login va refresh tanasi ixtiyoriy `tab_id` UUID qabul qiladi. Shu qiymat
berilsa, refresh token `refresh_token_<UUID hex>` nomli HttpOnly cookie’da
saqlanadi. Refresh faqat tanlangan cookie’ni o‘qiydi, umumiy cookie’ga tushmaydi.
Logout tanasi ham shu `tab_id`ni qabul qilib, faqat shu cookie’ni o‘chiradi.
CSRF, Secure/SameSite, token rotatsiyasi va qayta ishlatishni bloklash saqlanadi.
`tab_id` berilmagan eski web mijozlar hamda Android token oqimi mos qoladi.
