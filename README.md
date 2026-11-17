# MedicineTrack

Statsionardan chiqarilgan og‘ir bemorni hududiy oilaviy shifokorga avtomatik topshirish va 24 soat ichidagi patronajni kuzatish platformasi.

## Loyiha hujjati

- [Batafsil texnik topshiriq — TZ (o‘zbekcha)](docs/TECHNICAL_SPEC_UZ.md)
- [Nurazizning uch kunlik frontend rejasi](docs/FRONTEND_PLAN_UZ.md)

Repo tarkibida web frontend asosi va backend ulanishini tekshiradigan boshlang‘ich sahifa bor. Statsionar, koordinator va shifokor kabinetlari, backend hamda APK rejalashtirish bosqichida.

## Frontendni ishga tushirish

Node.js 24 va npm ishlatiladi.

```sh
cd frontend
npm ci
cp .env.example .env
npm run dev
```

Terminaldagi manzilni brauzerda oching. Bosh sahifa `/health/ready` orqali backend holatini ko‘rsatadi. Backend boshqa lokal portda bo‘lsa, `frontend/.env` ichida `API_PROXY_TARGET`ni o‘zgartiring va Vite’ni qayta ishga tushiring. Standart manzil `http://127.0.0.1:8000`.

`frontend/` ichida tekshiruvlar:

```sh
npm run lint
npm run typecheck
npm run build
```

Demo muhitida `frontend/dist`ni HTTPS orqali tarqating. Shu origin ichida `/api/*` va `/health/*` so‘rovlarini backendga yo‘naltiring. Ilovaning boshqa sahifa URL’lariga `index.html` qaytaring. `API_PROXY_TARGET` Vite’ning lokal proksisi uchun ishlatiladi.

### Kutubxonalar qayerda ulangan

| Kutubxona | Joyi va vazifasi |
|---|---|
| Tailwind CSS | `frontend/vite.config.ts` va `src/index.css`. Vite plugini, asosiy stillar va ranglar |
| TanStack Router | `src/routes/` va `src/main.tsx`. Fayl asosidagi route’lar, `(app)` guruhi, 404 va avtomatik `src/routeTree.gen.ts` |
| TanStack Query | `src/main.tsx` va bosh sahifa. Bitta `QueryClient`, backend holati va qayta tekshirish |
| Zod | `frontend/vite.config.ts`. Lokal backend manzilini tekshirish |
| Zustand | `src/state/session.ts`. Access tokenning xotiradagi holati |
| Axios | `src/api/client.ts`. `/api/v1` klienti, token headeri va `/health/ready` so‘rovi |
| Lucide React | Bosh sahifa. Backend ulanish holati ikonlari |

`src/` yo‘llari `frontend/` papkasiga nisbatan yozilgan. Route qo‘shilganda daraxtni `npm run dev` yoki `npm run build` bilan generatsiya qiling.

Formada xatolarni `safeParse` natijasidan oling. API javobini o‘qishda mos sxema bilan `parse` ishlating va format xatosini so‘rov holatida ko‘rsating. Masalan:

```ts
import { z } from 'zod'

const patientIdSchema = z.object({ id: z.uuid() })
const formResult = patientIdSchema.safeParse(formValues)
const patient = patientIdSchema.parse(response.data)
```

## Jamoa

| Yo‘nalish | Mas’ul |
|---|---|
| PM | @robiya777 |
| Frontend | @nuraziz07 |
| Android / APK | @akashishunichiro |
| Backend | @sunnatila |

## MVP

Bemorni chiqarish → avtomatik aktiv chaqiruv → oilaviy shifokor qabul qilishi → aloqa/tashrif → natijani tasdiqlash. Koordinator mas’ulsiz va kechikkan chaqiruvlarni nazorat qiladi. Bemor kabinetida shifokorga yozish va holatini yuborish rejalashtirilgan; javob ish jadvali bo‘yicha beriladi. Shifokor tasdiqlagan dori jadvali asosida Android eslatmalari va “Ichdim / O‘tkazib yubordim” tarixi ham rejalashtirilgan. AI epikrizdan ma’lumot ajratadi; yakuniy tasdiq xodimda qoladi.

Repo faqat sintetik bemor ma’lumotlarini saqlaydi. Haqiqiy tibbiy hujjatlar va maxfiy kalitlarni commit qilmang.
