"""Deterministic, offline demonstration; NOT a validated medical triage device.

No diagnoses or prescriptions are produced. Emergency cues take precedence over
conversation templates. NHS emergency/FAST guidance and Uzbekistan's 103 service
are referenced in docs/ASSISTANT_DEMO.md; production requires clinical validation.
"""

import re
from dataclasses import dataclass, field

CYRILLIC = str.maketrans(
    dict(
        zip(
            "абвгдеёжзийклмнопрстуфхцчшщъыьэюяўқғҳ",
            [
                "a",
                "b",
                "v",
                "g",
                "d",
                "e",
                "yo",
                "j",
                "z",
                "i",
                "y",
                "k",
                "l",
                "m",
                "n",
                "o",
                "p",
                "r",
                "s",
                "t",
                "u",
                "f",
                "x",
                "ts",
                "ch",
                "sh",
                "sh",
                "",
                "y",
                "",
                "e",
                "yu",
                "ya",
                "o",
                "q",
                "g",
                "h",
            ],
            strict=True,
        )
    )
)


def normalize(text):
    return re.sub(
        r"\s+", " ", text.lower().translate(CYRILLIC).translate(str.maketrans("", "", "'‘’ʻʼ`´"))
    ).strip()


def matches(pattern, text):
    return bool(re.search(normalize(pattern), text))


@dataclass(frozen=True)
class Rule:
    code: str
    label: str
    pattern: str


RED_FLAGS = (
    Rule(
        "BREATHING",
        "Nafas olish qiyinlashishi",
        r"nafas.{0,25}(ololma|yetmay|yetishma|qis|qiyin|siq)|havo.{0,12}yetmay|bogil.{0,8}(yap|moqda)|(не могу дышать|задыхаюсь|нет воздуха)|cant breathe|cannot breathe|difficulty breathing",
    ),
    Rule(
        "CHEST_PAIN",
        "Ko‘krak yoki yurak sohasidagi og‘riq",
        r"(kokra[kg]|yurak|груд|chest).{0,45}(ogri|ogry|бол|pain|siq|bosil)|chest pain|(ogriq|боль|pain).{0,25}(kokra[kg]|груд|chest)",
    ),
    Rule(
        "STROKE",
        "Nutq yoki bir tomondagi harakatning yangi o‘zgarishi",
        r"bir.{0,10}tomon.{0,35}(kuchsiz|uvish|ishlama)|(ong|chap).{0,12}(qol|oyoq).{0,20}(ishlama|kuchsiz|kotarolma)|yuz.{0,20}(qiyshay|osil)|nutq.{0,20}(buz|yoqol)|gapir.{0,15}olmay|(speech|one side).{0,25}(slur|weak|numb)|перекос.{0,15}лиц|не могу говорить",
    ),
    Rule(
        "SUDDEN_HEADACHE",
        "To‘satdan boshlangan juda kuchli bosh og‘rig‘i",
        r"(tosatdan|birdan|sudden).{0,35}(bosh|head).{0,30}(qattiq|kuchli|severe|worst)|(bosh|head).{0,35}(tosatdan|birdan|sudden).{0,25}(qattiq|kuchli|severe)|sudden severe headache",
    ),
    Rule(
        "CONSCIOUSNESS",
        "Hushdan ketish yoki hushsizlik",
        r"hush.{0,10}(ket|yoqol)|hushsiz|behush|behosh|без сознания|потерял.{0,10}сознание|unconscious|fainted",
    ),
    Rule(
        "BLEEDING",
        "Kuchli yoki to‘xtamayotgan qon ketishi",
        r"(qon|кров|bleed).{0,30}(kop|kuchli|toxtama|сильн|не останавлива|heavy|severe)|kop qon",
    ),
    Rule(
        "AIRWAY_SWELLING",
        "Til, lab yoki tomoq shishishi",
        r"(tilim|labim|tomo[kg]|язык|губ|горл|tongue|throat|lips).{0,25}(shish|отек|опух|swell)",
    ),
    Rule(
        "SEIZURE",
        "Davom etayotgan tutqanoq",
        r"tutqanoq.{0,20}(tut|boshla|toxtama)|having a seizure|судорог.{0,20}(сейчас|нача|не прекращ)",
    ),
    Rule(
        "OVERDOSE",
        "Dori yoki zaharli moddaning ortiqcha qabul qilinishi",
        r"(kop|ortiqcha).{0,12}dori.{0,15}(ichdim|ichib|ichgan)|zaharlan|отравил|передозиров|overdose|swallowed poison",
    ),
)
NEGATIVE = r"\b(yoq|emas|net|not|no)\b|ogrimay|qisilma|siqilma|ketmagan|ketmadi|shishma|qiyshayma|buzilma|zaharlanma|qon ketmay|ne bolit|не болит"
HISTORICAL = r"\b(oldin|avval|tarix|kasalligim|history|ran[es]he)\b"
YES = {"ha", "xa", "yes", "da", "bor", "albatta"}
NO = {"yoq", "yok", "no", "net", "emas"}


@dataclass
class Assessment:
    risk: str
    reply: str
    reasons: list = field(default_factory=list)
    question: dict = field(default_factory=dict)
    context: dict = field(default_factory=dict)


def question(key, text, choices=()):
    return {"key": key, "text": text, "choices": list(choices)}


SAFETY = question(
    "danger_signs",
    "Hozir nafas olish juda qiyinmi, kuchli ko‘krak og‘rig‘i, hushdan ketish yoki bir tomonda kuchsizlik bormi?",
    ("Ha", "Yo‘q"),
)
DISCLAIMER = (
    "Bu kalitsiz demo yordamchi: masofadan tashxis qo‘ymaydi va shifokor ko‘rigini almashtirmaydi."
)
EMERGENCY_REPLY = (
    "Yozganingizda shoshilinch baholashni talab qilishi mumkin bo‘lgan belgi bor. "
    "Hozir O‘zbekistonda 103 ga qo‘ng‘iroq qiling yoki yoningizdagi odamdan yordam so‘rang. "
    "Chatdagi javobni kutmang, o‘zingiz transport boshqarmang. "
    "Yordamchining demo SOS yozuvi haqiqiy tez yordamni chaqirmaydi. "
    "Telefon tugmasidan qo‘ng‘iroqni tasdiqlang; lokatsiyani rozilik bilan ulashishingiz mumkin."
)


def assess(text, previous=None, self_reported_state=None):
    value = normalize(text)
    previous = previous or {}
    prior_context = dict(previous.get("context") or {})
    prior_question = (previous.get("question") or {}).get("key", "")
    clauses = [
        c.strip()
        for c in re.split(r"[.!?;,\n]+|\b(?:lekin|ammo|biroq|but|va|and)\b", value)
        if c.strip()
    ]
    reasons, historical = [], []
    for rule in RED_FLAGS:
        for clause in clauses:
            if not matches(rule.pattern, clause):
                continue
            forced = matches(r"ololma|не могу|задыхаюсь|нет воздуха|cannot|cant", clause)
            if matches(NEGATIVE, clause) and not forced:
                continue
            if matches(HISTORICAL, clause) and not matches(
                r"hozir|yana|сейчас|now|bugun|kecha|yaqinda|\b\d+\s*(daqiqa|minut|soat|minute|hour)",
                clause,
            ):
                historical.append(rule.label)
                continue
            reasons.append({"code": rule.code, "label": rule.label})
            break
    if value in YES and prior_question in {"danger_signs", "headache_danger", "wound_danger"}:
        reasons.append(
            {"code": "FOLLOWUP_DANGER", "label": "Shoshilinch belgi haqidagi savolga «Ha» javobi"}
        )
    if reasons:
        return Assessment("EMERGENCY", EMERGENCY_REPLY, reasons, context={"emergency": True})
    if previous.get("risk") == "EMERGENCY":
        return Assessment(
            "EMERGENCY",
            "Oldingi xabardagi xavfli belgini demo suhbat orqali bekor qila olmayman. "
            + EMERGENCY_REPLY,
            [
                {
                    "code": "RECENT_EMERGENCY",
                    "label": "Shu suhbatda yaqinda shoshilinch belgi bildirilgan",
                }
            ],
            context={"emergency": True},
        )
    if value in NO and prior_question in {"danger_signs", "headache_danger", "wound_danger"}:
        prior_context["danger_denied"] = True
        topic = prior_context.get("topic")
        if topic:
            return Assessment(
                "DOCTOR_REVIEW",
                "Javobingizni yozib oldim. Bu xavfni to‘liq istisno qilmaydi. "
                "Qachondan boshlanganini, kuchini 0–10 oralig‘ida va qanday o‘zgarganini yozing. "
                "Statsionardan keyingi yangi yoki kuchayayotgan alomatni bugun shifokoringizga bildiring.",
                question=question(
                    "duration_severity", "Masalan: «2 soatdan beri, 4/10, kuchaymoqda»."
                ),
                context=prior_context,
            )
        return Assessment(
            "NEEDS_INFO",
            "Tushundim. Eng ko‘p bezovta qilayotgan alomatni, qachondan boshlanganini va hozir qanday o‘zgarganini yozing.",
            question=question("main_symptom", "Nima bezovta qilyapti?"),
            context=prior_context,
        )
    if value in YES | NO:
        return Assessment(
            "NEEDS_INFO",
            "Qaysi alomat haqida aytayotganingizni to‘liq yozing. Birgina «ha/yo‘q» javobidan holatingizni aniqlay olmayman.",
            question=SAFETY,
        )
    if matches(r"dori|doza|tablet|лекар|доз|medicine|antibiot|paratset|paracet|ibuprofen", value):
        return Assessment(
            "DOCTOR_REVIEW",
            "Dori nomi, shifokor belgilagan doza va savolingizni aniq yozing. "
            "Men dori yoki yangi doza tanlamayman. Tasdiqlangan jadvalga qarang va o‘zgartirishni shifokor bilan kelishing. "
            "Ortiqcha dori ichilgan bo‘lsa yoki keskin alomat paydo bo‘lsa 103 ga murojaat qiling.",
            question=question("medication_question", "Qaysi dori va qanday muammo?"),
            context={"topic": "medication"},
        )
    if historical:
        return Assessment(
            "DOCTOR_REVIEW",
            "Avvalgi holat haqidagi ma’lumotni qabul qildim. Hozir shu alomat qaytdimi yoki yangi alomat bormi? "
            "Yaqinda bo‘lgan nutq yoki bir tomondagi harakat o‘zgarishi to‘xtagan bo‘lsa ham shoshilinch tibbiy baholash kerak.",
            question=SAFETY,
            context={"topic": "history"},
        )
    active_text = "; ".join(c for c in clauses if not matches(NEGATIVE, c))
    topics = (
        (
            "headache",
            r"bosh.{0,18}(ogri|ogry)|голов.{0,18}бол|headache",
            "Bosh og‘rig‘i",
            question(
                "headache_danger",
                "Og‘riq to‘satdan juda kuchli boshlandimi yoki nutq/ko‘rish/qo‘l-oyoq harakatida yangi o‘zgarish bormi?",
                ("Ha", "Yo‘q"),
            ),
        ),
        ("fever", r"isitma|harorat|temperatur|температур|fever", "Harorat yoki isitma", SAFETY),
        (
            "wound",
            r"yara|chok|operats|жароҳ|шов|ран[аы]|wound",
            "Yara yoki operatsiyadan keyingi soha",
            question(
                "wound_danger",
                "Ko‘p qon ketishi, hushdan ketish yoki nafas olishning keskin qiyinlashishi bormi?",
                ("Ha", "Yo‘q"),
            ),
        ),
        ("pain", r"ogri|ogry|бол|pain", "Og‘riq", SAFETY),
        (
            "nausea",
            r"kongil|qayt|qus|ich ket|тошн|рвот|vomit|diarr",
            "Ko‘ngil aynishi yoki ovqat hazm qilish alomati",
            SAFETY,
        ),
        ("blood_pressure", r"bosim|давлен|blood pressure", "Qon bosimi bo‘yicha murojaat", SAFETY),
        (
            "weakness",
            r"holsiz|darmonsiz|bosh.{0,10}aylan|слаб|головокруж|dizz|weak",
            "Holsizlik yoki bosh aylanishi",
            SAFETY,
        ),
    )
    for topic, pattern, title, followup in topics:
        if not matches(pattern, active_text):
            continue
        if prior_context.get("danger_denied") and prior_context.get("topic") == topic:
            return Assessment(
                "DOCTOR_REVIEW",
                f"{title} haqidagi ma’lumotni oldim. Qachondan boshlanganini va avvalgidan farqini shifokoringizga yubordim. "
                "Yangi yoki kuchayayotgan alomat uchun bugun tibbiy xodim bilan bog‘laning. "
                "Nafas yetishmasligi, kuchli ko‘krak og‘rig‘i yoki hushdan ketish bo‘lsa javobni kutmang — 103.",
                question=question(
                    "additional_details",
                    "Shifokor bilishi kerak bo‘lgan yana qanday o‘zgarish bor?",
                ),
                context=prior_context,
            )
        return Assessment(
            "DOCTOR_REVIEW",
            f"{title} haqida yozdingiz. Qachondan boshlanganini, hozir kuchayayaptimi va o‘lchov bo‘lsa qiymatini yozing. "
            "Xabaringiz mas’ul shifokorga ham ko‘rinadi. Avval shoshilinch belgilarni aniqlashtiraylik.",
            question=followup,
            context={"topic": topic},
        )
    if prior_context.get("topic") and prior_question in {"duration_severity", "additional_details"}:
        return Assessment(
            "DOCTOR_REVIEW",
            "Alomatning davomiyligi va kuchi haqidagi qo‘shimcha ma’lumotni qayd qildim. "
            "Bu xabar mas’ul shifokorga ham ko‘rinadi. Yangi yoki kuchayayotgan alomat bo‘lsa "
            "bugun shifokoringiz bilan bog‘laning. Nafas yetishmasligi, kuchli ko‘krak og‘rig‘i, "
            "hushdan ketish yoki nutq/harakatning yangi o‘zgarishi bo‘lsa javobni kutmang — 103.",
            question=question(
                "additional_details", "Shifokor bilishi kerak bo‘lgan yana qanday o‘zgarish bor?"
            ),
            context=prior_context,
        )
    if self_reported_state == "WORSENED" or matches(r"yomon|yaxshi emas|плохо|worse|unwell", value):
        return Assessment(
            "DOCTOR_REVIEW",
            "Holatingiz yomonlashganini qayd qildim. Xabaringiz mas’ul shifokorga ham ko‘rinadi. "
            "Yangi alomat, boshlanish vaqti va kuchini yozing; og‘ir alomat bo‘lsa chat javobini kutmang.",
            question=SAFETY,
        )
    if matches(
        r"yaxshi|bezovta qilmay|alomat yoq|огримай|хорошо|feel fine|feeling well|better",
        active_text,
    ):
        return Assessment(
            "SELF_MONITOR",
            "Yaxshiroq his qilayotganingizni qayd qildim. Bu tekshiruv o‘rnini bosmaydi. "
            "Shifokor tasdiqlagan jadvalni davom ettiring, yangi yoki kuchayayotgan alomat bo‘lsa yozing. "
            "Bugun qaysi o‘zgarish yoki savolni muhokama qilmoqchisiz?",
            question=question("main_symptom", "Alomat yoki savolingizni yozing."),
        )
    return Assessment(
        "NEEDS_INFO",
        "Men MedicineTrack demo yordamchisiman. Yozganlaringizni tartibga solib, xavfli belgilarni ajratishga yordam beraman. "
        "Nima bezovta qilyapti, qachondan boshlandi va hozir kuchayayaptimi?",
        question=SAFETY,
    )
