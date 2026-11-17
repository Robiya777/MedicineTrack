from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler as drf_exception_handler


class Conflict(APIException):
    status_code = 409
    default_detail = "Holat yoki versiya o‘zgargan. Ma’lumotni yangilang."
    default_code = "CONFLICT"


class PayloadTooLarge(APIException):
    status_code = 413
    default_detail = "PDF hajmi 10 MBdan oshmasligi kerak."
    default_code = "FILE_TOO_LARGE"


def exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None
    original = response.data
    messages = {
        400: ("VALIDATION_ERROR", "Maydonlarni tekshiring"),
        401: ("UNAUTHENTICATED", "Sessiya yaroqsiz yoki tugagan"),
        403: ("FORBIDDEN", "Bu amal uchun ruxsat yo‘q"),
        404: ("NOT_FOUND", "Yozuv topilmadi"),
        409: ("CONFLICT", "Holat yoki versiya o‘zgargan"),
        413: ("FILE_TOO_LARGE", "Fayl hajmi chegaradan oshgan"),
        429: ("RATE_LIMITED", "Urinishlar ko‘p. Keyinroq urinib ko‘ring"),
        503: ("SERVICE_UNAVAILABLE", "Xizmat vaqtincha ishlamayapti"),
    }
    code, message = messages.get(response.status_code, ("API_ERROR", "So‘rov bajarilmadi"))
    if isinstance(original, dict) and "detail" in original:
        message = str(original["detail"])
        fields = {}
    else:
        fields = original
    response.data = {
        "code": code,
        "message": message,
        "fields": fields,
        "request_id": getattr(context.get("request"), "request_id", ""),
    }
    return response
