# MedicineTrack frontend

[O‘rnatish va ishga tushirish yo‘riqnomasi](../README.md#frontendni-ishga-tushirish)

[Nurazizning frontend rejasi](../docs/FRONTEND_PLAN_UZ.md)

## Web sessiyasini lokal tekshirish

Backendni `main` checkoutidan alohida ishga tushiring va `DEMO_MODE=true` bilan
`seed_demo` bajaring. Frontenddagi `API_PROXY_TARGET` shu backend manzilini
ko‘rsatishi kerak. Lokal web originini backenddagi `CSRF_TRUSTED_ORIGINS`ga
kiriting. Masalan, `http://localhost:5173`. Lokal HTTP uchun
`COOKIE_SECURE=false`, HTTPS muhitida `COOKIE_SECURE=true` ishlatiladi.

`/login` sahifasida seed yaratgan parol bilan kiring.

| Demo akkaunt | Kabinet |
|---|---|
| `demo.hospital` | `/kabinet/statsionar` |
| `demo.coordinator` | `/kabinet/koordinator` |
| `demo.doctor` | `/kabinet/shifokor` |

Kabinet ochilgach sahifani yangilang va sessiya tiklanganini tekshiring.
Chiqishdan keyin kabinet URLini ochish login sahifasiga olib boradi.

## Statsionar oqimi

`demo.hospital` akkaunti bilan kirganda statsionar chiqarishlari sahifalangan
ro‘yxatda ko‘rinadi. **Yangi chiqarish** orqali bemorni aniq UUID bilan tanlang
yoki yangi karta yarating. Telefon bo‘lmasa sababini yozing. Xizmat hududi
backend ma’lumotnomasidan olinadi.

Chiqarish vaqtini **Toshkent vaqti** bilan kiriting, kuzatuvga olish asosi va
shifokor tavsiyasini yozing. Loyihani saqlang, xulosani tekshiring, so‘ng
**Chiqarishni tasdiqlash**ni bosing. Chaqiruv IDsi, holati, mas’ul shifokor yoki
«Mas’ul biriktirilmagan» yozuvi hamda server hisoblagan muddat ko‘rinadi.
Loyiha URL orqali qayta ochiladi va tasdiqlashgacha tahrirlanadi.

Tarmoq javobi yo‘qolsa shu formani o‘zgartirmasdan yana yuboring. Qayta yuborish
bir xil idempotency kalitidan foydalanadi. `409` javobida chiqarishning joriy
holati qayta olinadi. Tasdiqlangan yozuvda yakuniy bemor ma’lumotlari snapshotdan
ko‘rsatiladi.

Tekshiruv natijalari [VALIDATION.md](VALIDATION.md)da keltirilgan.

## Koordinator va shifokor oqimi

`demo.coordinator` uchun hududiy KPI, barcha chaqiruvlar, mas’ulsiz,
keyingi 4 soatda muddati tugaydigan ochiq, kechikkan, bajarilgan va bekor
qilingan chaqiruvlar ko‘rinadi. Shifokor va qabul qiluvchi muassasa filtrlari
bor. Ro‘yxat va KPI har 30 soniyada yangilanadi.

Chaqiruv tafsilotida koordinator faol shifokorni tanlab, sabab bilan tayinlaydi
yoki qayta tayinlaydi. Qayta tayinlangan vazifa NEW holatiga qaytadi,
yangi shifokor uni qabul qiladi va dastlabki muddat saqlanadi. Bekor qilishda
sabab turi va izoh kiritiladi.

`demo.doctor` o‘z ochiq chaqiruvlarini ko‘radi. Tafsilotda qabul qilish,
aloqa urinishini qo‘shish va qabul qilingan vazifaga yakuniy natija yuborish
mumkin. Aloqa va tashrif vaqtlari Toshkent vaqtida kiritiladi.
Javobsiz qo‘ng‘iroq ochiq vazifaning aloqa tarixida qoladi.

Natija, urinishlar va hodisalar chaqiruv tarixida ko‘rinadi.
`409` konfliktida joriy vazifa qayta olinadi. Forma saqlangan holda
**Joriy holat bilan davom etish** orqali yangi versiyani tekshirib davom etiladi.
Eski shifokor ruxsati bekor bo‘lsa, tafsilot o‘rnida ruxsat xabari ko‘rsatiladi.

## Ishchi teal va mint dizayn

Login, statsionar ro‘yxati, bemor/chiqarish formalari, koordinator KPI va navbati,
shifokor navbati, chaqiruv tafsiloti, tayinlash/bekor qilish dialoglari va
hisobot tarixi umumiy dizayndan foydalanadi. Desktopda jadval, mobil ekranda
kartalar, yig‘iladigan filtrlar va yon menyu mavjud. Ro‘yxat filtrlari va
sahifasi URLda saqlanadi.

## Yangi teal va mint dizayn preview’si

Dev serverda `/design/medicinetrack/queue`ni oching. Bu 1–2-dizayn bosqichi
uchun koordinatorning sintetik preview’si. Jadval holatlari, shifokor/muassasa
filtrlari, muddat bo‘yicha saralash, sahifalash va tafsilot oynasi ishlaydi.
Mobil menyu kichik ekranda ochiladi. **Preview holatlari** orqali yuklanish,
bo‘sh ro‘yxat va xato ko‘rinishlarini sinang.

Ranglar, tipografiya va o‘lchamlar [dizayn asosida](docs/DESIGN_SYSTEM.md)
yozilgan. Ishchi kabinetlar va preview `.mt-theme` tokenlari hamda umumiy
komponentlardan foydalanadi. Production preview uchun mavjud
`VITE_ENABLE_DESIGN_PREVIEW=true` sozlamasi ishlatiladi.

## 4-bosqich: bemor aktivatsiyasi va aloqa

Statsionar chiqarish tafsilotida bemor/vakil telefonini tekshirganini belgilab,
**Aktivatsiya kodini olish**ni bosadi. Bemor UUIDsi va bir martalik kodni bemorga
beradi. Yangi kod eski kodni bekor qiladi; kod 24 soat amal qiladi.
Kod brauzerning doimiy xotirasi yoki URLiga yozilmaydi.

Bemor `/faollashtirish` sahifasida UUID, kod va yangi parolni kiritadi. Server
qaytargan login bilan `/login`dan kiradi. `/kabinet/bemor`da o‘z chiqarishlari,
mas’ul shifokori va ochiq/yopiq suhbatlari ko‘rinadi. Xabarlar va bemor bildirgan
holatlar server tasdiqlagach ko‘rsatiladi. Yuborish javobi yo‘qolsa, o‘sha
ma’lumotni qayta yuborish ayni idempotency kalitini ishlatadi.

Shifokor yon menyudagi **Suhbatlar** orqali bemor xabarlarini o‘qiydi va javob
beradi. Ochiq suhbat, xabarlar va holatlar har 15 soniyada yangilanadi. Yopiq
suhbatga yozib bo‘lmaydi. Qayta tayinlashda bemorning eski tarixi saqlanadi,
eski shifokor kirishi yopiladi va bemorda yangi suhbat ochiladi.

Koordinator **Ish jadvali**da haftalik oraliqlar, tanaffuslar va istisno kunlarni
sozlaydi. **Javobsiz murojaatlar**da yomonlashgan va kechikkan murojaatlarni
filtrlaydi. Bu ekranda shaxsiy suhbat matni ochilmaydi. Javob muddati backenddan
olinadi; oldingi javobsiz davr muddati jadval o‘zgarganda uzaytirilmaydi.

Fon eskalatsiyalari uchun backend worker/beat ishlashi kerak. Dockersiz lokal
sinovda backend papkasida `python manage.py process_jobs` bir martalik siklni
bajaradi. Ishchi serverni sozlash [backend yo‘riqnomasida](../backend/README.md).

Qabul sinovlari [4-bosqich hisobotida](docs/STAGE4_ACCEPTANCE.md) keltirilgan.
