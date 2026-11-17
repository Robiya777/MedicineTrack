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
