# Nuraziz uchun bosqichma-bosqich web frontend rejasi

Frontend asosi tayyorlangach, birinchi ishlaydigan oqim **login → bemor → chiqarishni tasdiqlash → chaqiruv tafsiloti** bo‘ladi. Keyin shu chaqiruvga koordinator va shifokor ekranlari ulanadi. PDF va AI review asosiy oqim ishlagach qo‘shiladi. [Texnik topshiriq](TECHNICAL_SPEC_UZ.md)

## 1-kun — statsionar kabineti

1. **Backend bilan API kontraktini kelishing.** `@sunnatila`dan demo akkauntlar, login, `/me`, chiqarishni tasdiqlash va chaqiruv tafsiloti uchun namuna javoblarni oling. Chiqarishlar ro‘yxati va tafsiloti uchun `GET /discharges` va `GET /discharges/{id}` marshrutlarini, shuningdek tasdiqlash vakolati `/me` javobida qanday berilishini kelishing. Backend tayyorlanayotganda shu kontraktga mos mock bilan ishlang.
2. **Login va sessiyani ulang.** Tayyor frontend asosi va umumiy API klientidan foydalaning. Login, sessiyani yangilash va logoutni ulang. `/me` bo‘yicha statsionar xodimi, koordinator va shifokorni o‘z kabinetiga yo‘naltiring.
3. **Bemor va chiqarish formasini ishlating.** Dashboardda loyihalar va tasdiqlangan chiqarishlarni ko‘rsating. Mavjud bemorni ichki UUID orqali topish yoki yangi karta yaratish imkonini bering. Chiqarish formasida aloqa ma’lumoti, hudud, haqiqiy chiqarish vaqti, tavsiya va kuzatuvga olish asosini kiriting. Maydon xatolarini tegishli input yonida chiqaring.
4. **Tasdiqlash va chaqiruv tafsilotini ulang.** Tasdiqlashdan oldin kiritilgan ma’lumotlarni ko‘rsating. API javobidan task ID, mas’ul yoki «Mas’ul biriktirilmagan» holati va muddatni chiqaring. Vaqtni `Asia/Tashkent` bo‘yicha ko‘rsating.

**Kun yakuni.** Sintetik bemor uchun login → bemor → chiqarish → tasdiqlash → chaqiruv tafsiloti brauzerda ishlaydi. API hali tayyorlanayotgan bo‘lsa, oqim kontraktga mos mock bilan namoyish qilinadi.

## 2-kun — koordinator va shifokor kabinetlari

5. **Koordinator panelini quring.** Mas’ulsiz, muddati yaqin va kechikkan chaqiruvlarni alohida ko‘rsating. Muassasa va shifokor filtrlarini, KPI kartalarini va chaqiruv tarixini ulang. «Muddati yaqin» uchun boshlang‘ich qiymat — hali ochiq vazifaning oxirgi 4 soati.
6. **Tayinlash va bekor qilishni ulang.** Mas’ulsiz vazifaga shifokor tanlash, mavjud mas’ulni almashtirish va vazifani bekor qilish uchun sabab majburiy bo‘lgan oynalar quring. Muvaffaqiyatli javobdan keyin ro‘yxat va tafsilotni yangilang. `409` kelganda serverdagi joriy holatni qayta oling va foydalanuvchiga ko‘rsating.
7. **Shifokorning web zaxira oqimini tugating.** Shifokor o‘z chaqiruvlarini ko‘radi, vazifani qabul qiladi, aloqa urinishini qayd etadi va natija yuboradi. `COMPLETED` holatini server tasdiqlagach ko‘rsating. Javob yo‘lda yo‘qolsa, aynan o‘sha yuborishni bir xil `Idempotency-Key` bilan qayta sinang.
8. **Android bilan birgalikda sinang.** `@akashishunichiro` bilan webdan chiqarishni tasdiqlang, APKda shu task IDni oching va natija yuboring. Koordinator panelida holat va tarixni tekshiring. Mas’ulsiz vazifani tayinlab, dastlabki muddat saqlanganini tekshiring.

**Kun yakuni.** P0 oqimi bitta haqiqiy demo API orqali web va Androidda ishlaydi.

## 3-kun — AI, tekshiruv va topshirish

9. **PDF va AI review’ni qo‘shing.** PDF yuklash, ishlov holati, ajratilgan qiymat va uning manba parchasini ko‘rsating. Xodim qiymatni tekshira, tahrirlay va tasdiqlay olsin. Topilmagan maydon, skan va timeout holatlarida qo‘lda kiritish yo‘li ishlasin. Mock javob «Demo/mock» deb belgilansin.
10. **Web qabul sinovlarini o‘tkazing.** 360 px va 1280 px ekranlarda formalar va klaviatura navigatsiyasini tekshiring. Sessiya tugashi, bo‘sh ro‘yxat, ruxsat xatosi va `409` holatini sinang. Webga biriktirilgan AT-06, AT-11, AT-16, AT-17, AT-20 va AT-23 natijalarini yozing.
11. **Demo URL va topshiruvni tayyorlang.** Statsionar, shifokor va koordinator demo akkauntlari bilan URLni boshidan oxirigacha tekshiring. `@robiya777`ga demo URL, commit SHA, sinov natijalari va ochiq qolgan masalalarni bering.

**Tayyorlik mezoni.** Webda chiqarish tasdiqlanadi, Android yoki shifokor webidan natija yuboriladi, koordinator shu chaqiruvning holati va tarixini ko‘radi. Demo ma’lumotlarida mas’ulsiz va kechikkan vazifalar alohida namoyish qilinadi.
