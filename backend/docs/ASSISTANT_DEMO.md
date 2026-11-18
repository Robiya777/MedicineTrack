# Kalitsiz yordamchi va demo SOS

Bu funksiya bemorning mavjud suhbatiga ulangan, tashqi model kalitini talab qilmaydigan **qoidalar asosidagi demo**. Generativ LLM, klinik tashxis tizimi yoki haqiqiy 103 dispetcher integratsiyasi emas. Internetdagi AI xizmatiga bemor matni yuborilmaydi. Android va veb ishlayotgan MedicineTrack backendiga ulanishi kerak; tarmoqsiz yordamchi javobi yaratilmaydi. Telefonda 103 terish tugmasi server so‘rovi davomida ham ochiq qoladi.

## Ishga tushirish

`backend/.env`:

```dotenv
DEMO_MODE=true
ASSISTANT_MODE=demo
```

`AI_MODE=mock` mavjud epikriz ajratish funksiyasining alohida sozlamasi. Bemor yordamchisi uchun API kaliti yoki pullik xizmat kerak emas. `ASSISTANT_MODE=disabled` yoki `DEMO_MODE=false` yangi yordamchi javoblarini o‘chiradi. Oldin yaratilgan yozuvlar ruxsatli foydalanuvchilar uchun tarixda qoladi.

```bash
cd backend
docker compose up -d --build api worker beat
```

Compose `migrate` xizmati yangi jadvallarni yaratadi. Eski `HOSPITAL` roli mavjud bazalarda oldingi koordinator migratsiyalari ham qo‘llanadi: foydalanuvchi `COORDINATOR`ga o‘tadi, uning eski sessiyasi bekor qilinadi. Oldin zaxira oling; bazani o‘chirmang. Ishlayotgan mahalliy demo 2026-11-18 kuni zaxiralanib, yangilandi.

Web: `frontend/.env`da `API_PROXY_TARGET=http://127.0.0.1:8001`, keyin `npm run dev -- --host 127.0.0.1 --port 5173`. Android emulyatorda API `http://10.0.2.2:8001/api/v1`. Fizik telefonda `adb reverse tcp:8001 tcp:8001` va `http://127.0.0.1:8001/api/v1`, yoki HTTPS backend ishlatiladi. Login/parol lokal demo sozlamalaridan olinadi; APKda maxfiy kalit va parol yo‘q.

## Namoyish

1. Bemor kabinetidagi **AI yordamchi bilan suhbat** tugmasini bosing. Shifokorga biriktirilgan ochiq suhbat ishlatiladi.
2. `Boshim og‘riyapti` deb yozing. Bosh og‘rig‘iga mos savol chiqadi. `Yo‘q`dan keyin `2 soatdan beri, 4/10, kuchaymoqda` deb davom ettiring. Yordamchi shu suhbatdagi oldingi savolni hisobga oladi. `Ha` xavfli belgi savoliga javob bo‘lsa, demo SOS yaratiladi.
3. `Nafas ololmayapman` yoki `Ko‘kragim qattiq og‘riyapti` deb yozing. **EMERGENCY / DEMO SOS** avtomatik yaratiladi. Boshlang‘ich lokatsiya bo‘sh; ro‘yxatdagi manzil GPS deb ko‘rsatilmaydi.
4. Demo SOS tafsilotini oching. Haqiqiy vaziyat uchun **103** tugmasi telefon terish oynasini ochadi. Qo‘ng‘iroqni foydalanuvchi telefon ilovasida tasdiqlaydi; testda bu tugma orqali haqiqiy qo‘ng‘iroq qilinmaydi.
5. Lokatsiyani ulashishni tanlang va rozilik bering. Qurilma GPSi uchun Android/brauzer ruxsati ham kerak. Ruxsat rad etilsa, GPS o‘chiq bo‘lsa yoki vaqt tugasa, koordinata yuborilmaydi. Namoyish nuqtasini alohida tanlash mumkin: u doim `DEMO` deb belgilanadi va haqiqiy GPSga almashtirilmaydi.
6. Mas’ul shifokor/koordinator kabinetidagi **Demo SOS kuzatuvi**da bemor, sabab, ulashilgan lokatsiya, vaqt va jarayon tarixi ko‘rinadi. **SOSni ko‘rdim** ichki xodim tasdig‘idir; brigada yo‘lga chiqqani haqidagi tasdiq emas.
7. Shifokorning oddiy suhbat javobi klinik murojaatga javob beradi. Yordamchi javobi va SOS tasdig‘i bu majburiyatni yopmaydi.

## Javob va ruxsatlar

- O‘zbek lotin/kirill, rus va ingliz tilidagi belgilangan xavfli iboralar tekshiriladi. Nafas qiyinlashishi, ko‘krak og‘rig‘i, yangi nutq/bir tomon harakati o‘zgarishi, hushsizlik, kuchli qon ketishi, nafas yo‘li shishi, davom etayotgan tutqanoq, ortiqcha dori/zaharlanish va ayrim to‘satdan kuchli bosh og‘riq iboralari namoyishda qamrab olingan. Bu barcha kasallik va yozuv variantlarini aniqlash kafolati emas.
- Javoblar: `EMERGENCY`, `DOCTOR_REVIEW`, `SELF_MONITOR`, `NEEDS_INFO`. Tashxis yoki yangi dori/doza tavsiya qilinmaydi. Noma’lum matnda ma’lumot so‘raladi; `SELF_MONITOR` tibbiy xavfsizlik tasdig‘i emas.
- Savol konteksti ayni javobsiz murojaat ichida 30 daqiqa saqlanadi. Eski tezkor savolga javob `409` qaytaradi. Javobsiz SOS 30 daqiqadan keyin ham avtomatik pasaytirilmaydi. Bir javobsiz murojaatga bitta SOS; takroriy tarmoq so‘rovlari idempotency orqali dublikat yaratmaydi.
- GPS bir martalik, jonli kuzatuv emas. Fon lokatsiyasi va avtomatik telefon qilish ruxsati so‘ralmaydi. Qurilma koordinatasi 5 daqiqadan yangi, kelajak vaqti 30 soniyadan oshmagan bo‘lishi kerak. Javobsiz SOSga yangi koordinata ulashish mumkin; 24 soatdan eski va shifokor javob bergan SOSga yangi koordinata qabul qilinmaydi. `DEVICE` mijoz bergan koordinata ekanini bildiradi, uning fizik manzili mustaqil tasdiqlanganini bildirmaydi.
- Bemor faqat o‘z yozuvini ko‘radi va lokatsiyasini ulashadi. Shifokor faol biriktirilgan bemorlarniki, koordinator amaldagi hudud/muassasa doirasidagini ko‘radi. Texnik admin va begona foydalanuvchiga klinik SOS ochilmaydi. Biriktirish tugaganda oldingi idempotent javob ham qayta tekshiriladi.
- Lokatsiya auditida koordinataning o‘zi yozilmaydi. Koordinata ruxsatli API javobida qaytadi. Xarita avtomatik yuklanmaydi; foydalanuvchi OpenStreetMap havolasini ochsa koordinata o‘sha xizmatga uzatiladi.
- Ichki `AI_EMERGENCY_ALERT` outbox → Celery worker → bildirishnoma oqimidan o‘tadi. Veb SOS ro‘yxati 10 soniyada, suhbatlar 15 soniyada yangilanadi. Android SOSda **Yangilash** mavjud. SMS, push, haqiqiy tez yordam raqami, avtomatik brigada jo‘natish va ETA integratsiyasi yo‘q.

## API

| So‘rov | Vazifa |
|---|---|
| `GET /api/v1/assistant/config` | Demo, tashqi model va real dispatch holati |
| `POST /api/v1/conversations/{id}/messages` | `{text, assistant_response_to?}`; javobda `assistant` yoki `null` |
| `POST /api/v1/conversations/{id}/status-updates` | Holat xabariga ham yordamchi bahosi yaratiladi; suhbat GETida ko‘rinadi |
| `GET /api/v1/assistant/emergencies` | Foydalanuvchiga ruxsatli, sahifalangan SOSlar |
| `GET /api/v1/assistant/emergencies/{id}` | Tafsilot va vaqtli voqealar |
| `POST /api/v1/assistant/emergencies/{id}/location` | Bemor roziligi bilan bir martalik lokatsiya |
| `POST /api/v1/assistant/emergencies/{id}/acknowledge` | Mas’ul xodim ko‘rganini tasdiqlash |

Lokatsiya uchun `{consent: true, source: "DEMO"}` yoki `{consent: true, source: "DEVICE", latitude, longitude, accuracy_m, recorded_at}` yuboriladi. `recorded_at` ISO vaqt; koordinata 6 kasr xonasigacha. Yozuvchi so‘rovlarda `Idempotency-Key` ishlatiladi. Yangilangan kontrakt: [OpenAPI](../openapi.yaml).

## Tekshiruv va manbalar

Natijalar va takrorlash: [yordamchi demo hisobotida](../../docs/ASSISTANT_DEMO_VALIDATION.md). Sintetik GPS va test akkauntlaridan foydalanilgan; bu klinik tekshiruv yoki fizik telefondagi sinov emas.

O‘zbekistondagi 103 raqami [rasmiy davlat xizmatlari sahifasida](https://gov.uz/oz/advice/63/document/1090) ko‘rsatilgan. Xavfli belgilar uchun [NHS shoshilinch yordam](https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-call-999/) va [insult belgilari](https://www.nhs.uk/conditions/stroke/symptoms/) yo‘riqnomalari namoyish qoidalarini tuzishda ishlatilgan; ulardagi Britaniya raqamlari ilovaga ko‘chirilmagan. Bu manbalardan foydalanish algoritm klinik tasdiqlanganini bildirmaydi.

[Android Intent hujjati](https://developer.android.com/reference/android/content/Intent#ACTION_CALL) odatiy `ACTION_CALL` orqali favqulodda raqamni avtomatik terish mumkin emasligini ko‘rsatadi; ilova `ACTION_DIAL` ishlatadi. [Foreground lokatsiya ruxsatlari](https://developer.android.com/develop/sensors-and-location/location/permissions) asosida faqat bemor boshlagan bir martalik olish ishlatilgan.
