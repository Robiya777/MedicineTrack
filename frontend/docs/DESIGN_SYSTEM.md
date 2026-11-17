# MedicineTrack web dizayn asosi

Kelishilgan asos — WellNest joylashuvi, Medlink tipografiyasi va teal/mint palitrasi.
Tasdiqlangan dizayn login, statsionar, koordinator va shifokorning ishchi ekranlariga ulangan.

## Rang va matn

| Vazifa | Qiymat |
|---|---|
| Asosiy amal | Teal, #0F766E |
| Hover | #115E59 |
| Faol menyu | Och mint, #DFF5EF |
| Sahifa / karta | #F5F8F7 / #FFFFFF |
| Asosiy / yordamchi matn | #18332F / #52645E |
| Chegara / input chegarasi | #DCE6E2 / #81988F |
| Xato / ogohlantirish / bajarilgan | #B42318 / #92400E / #166534 |

DM Sans Variable mahalliy font fayllaridan yuklanadi. Asosiy matn 16 px,
jadval 14 px, sarlavha 24–32 px. Raqamlar tabular. Oraliqlar 4/8 px
qadamda, kartalar 16 px va input/tugmalar 9 px yumaloqlikda.

## Ekran

Yon menyu → yuqori panel → sarlavha → hudud KPI → filtrlar → chaqiruv jadvali.
Mobil ko‘rinishda menyu dialogga, jadval kartalarga va KPI ikki ustunga o‘tadi.
Bemor, mas’ul, status va muddat asosiy ma’lumot hisoblanadi.

Holat matn va ikon bilan ko‘rsatiladi. Overdue — ochiq vazifaning alohida
ogohlantirishi. Bitta asosiy amal ajratiladi. Xatoda qayta urinish, bo‘sh
ro‘yxatda filtrni tozalash yo‘li bor. Interaktiv maydonlar kamida 44 px,
focus 3 px, asosiy matn kontrasti kamida 4.5:1.

## Umumiy komponentlar

- `src/styles/medicine-track.css` — `.mt-theme` doirasidagi tokenlar, mahalliy DM Sans, tugma, maydon, karta va status.
- `src/styles/workspace.css` — tasdiqlangan preview bilan umumiy menyu, panel, KPI, jadval, mobil karta va dialog joylashuvi.
- `src/styles/live.css` — ishchi formalar, bosqichlar, tarix, login va mobil filtrlar.
- `src/components/dialog.tsx` — native modal: fokus chegarasi, Escape, yopilganda boshlang‘ich tugmaga qaytish. Yuborilayotgan amal tugamaguncha yopilmaydi.
- `src/features/hospital/ui.tsx` — haqiqiy API xatosi, qayta urinish, label va maydon xatosi.
- `src/features/tasks/task-table.tsx` — API ma’lumotlariga asoslangan jadval va kartalar.

Koordinator va shifokor ro‘yxatining segmenti, filtrlari va sahifasi URLda saqlanadi.
Noto‘g‘ri query qiymatlari standart navbatga qaytadi. Tafsilotdan qaytganda
filtr va sahifa saqlanadi. Mobil filtrlar alohida tugma bilan ochiladi.

Preview sintetik ma’lumot bilan alohida `/design/medicinetrack/queue`da qoladi.
Ishchi kabinetlar haqiqiy sessiya, rol va backend javoblaridan foydalanadi.
Bo‘sh statistikaga uydirma qiymat yoki grafik qo‘shilmaydi.
