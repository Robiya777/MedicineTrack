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
