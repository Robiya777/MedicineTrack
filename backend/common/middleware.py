import uuid


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            request.request_id = str(uuid.UUID(request.headers.get("X-Request-ID", "")))
        except ValueError:
            request.request_id = str(uuid.uuid4())
        response = self.get_response(request)
        response["X-Request-ID"] = request.request_id
        if request.path.startswith("/api/v1/"):
            response["Cache-Control"] = "no-store"
        return response
