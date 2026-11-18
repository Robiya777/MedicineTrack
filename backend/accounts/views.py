import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from care.models import Patient
from care.scopes import is_hospital_staff
from care.services import audit

from .models import ActivationCode, AuthSession, Role, User
from .serializers import (
    ActivationInput,
    ActivationIssueInput,
    ActivationOutput,
    LoginInput,
    RefreshInput,
    TabSessionInput,
    TokenOutput,
    UserSerializer,
)


class LoginThrottle(AnonRateThrottle):
    scope = "login"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class ActivationThrottle(LoginThrottle):
    scope = "activation"


class RefreshThrottle(LoginThrottle):
    scope = "refresh"


def csrf_check(request):
    check = CSRFCheck(lambda request: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise PermissionDenied("CSRF tekshiruvi bajarilmadi.")


def refresh_cookie_name(tab_id=None):
    # A selector is not a credential. The token stays HttpOnly, scoped to auth URLs.
    return f"refresh_token_{tab_id.hex}" if tab_id else "refresh_token"


def mint_tokens(session, tab_id=None):
    refresh = RefreshToken.for_user(session.user)
    refresh["sid"] = str(session.id)
    refresh.set_exp(from_time=session.created_at, lifetime=timedelta(days=7))
    session.current_jti = refresh["jti"]
    session.save(update_fields=["current_jti"])
    result = {"access": str(refresh.access_token), "user": UserSerializer(session.user).data}
    if session.client == "android":
        result["refresh"] = str(refresh)
    response = Response(result)
    if session.client == "web":
        response.set_cookie(
            refresh_cookie_name(tab_id),
            str(refresh),
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite="Lax",
            path="/api/v1/auth",
            max_age=max(0, int((session.expires_at - timezone.now()).total_seconds())),
        )
    return response


def auth_failure(request, message):
    return Response(
        {
            "code": "UNAUTHENTICATED",
            "message": message,
            "fields": {},
            "request_id": getattr(request, "request_id", ""),
        },
        status=401,
    )


class CSRFView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses={200: dict})
    def get(self, request):
        return Response({"csrf_token": get_token(request)})


class PublicAuthView(APIView):
    def get_authenticate_header(self, request):
        return "Bearer"

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response


class LoginView(PublicAuthView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginThrottle]

    @extend_schema(request=LoginInput, responses=TokenOutput)
    def post(self, request):
        serializer = LoginInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data["client"] == "web":
            csrf_check(request)
        user = authenticate(request, username=data["username"], password=data["password"])
        if not user or user.role not in Role.values:
            raise AuthenticationFailed("Login yoki parol noto‘g‘ri.")
        if user.role not in {Role.ADMIN, Role.PATIENT} and (
            not user.organization_id or not user.organization.active
        ):
            raise AuthenticationFailed("Muassasa faol emas.")
        with transaction.atomic():
            session = AuthSession.objects.create(
                user=user, client=data["client"], expires_at=timezone.now() + timedelta(days=7)
            )
            return mint_tokens(session, data.get("tab_id"))


class RefreshView(PublicAuthView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [RefreshThrottle]

    @extend_schema(request=RefreshInput, responses=TokenOutput)
    def post(self, request):
        serializer = RefreshInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        tab_id = serializer.validated_data.get("tab_id")
        raw = serializer.validated_data.get("refresh") or request.COOKIES.get(
            refresh_cookie_name(tab_id)
        )
        try:
            token = RefreshToken(raw or "")
        except TokenError as exc:
            raise AuthenticationFailed("Refresh token yaroqsiz.") from exc
        with transaction.atomic():
            session = (
                AuthSession.objects.select_for_update(of=("self",))
                .select_related("user", "user__organization")
                .filter(pk=token.get("sid"))
                .first()
            )
            if not session or session.revoked_at or session.expires_at <= timezone.now():
                return auth_failure(request, "Sessiya tugagan.")
            if session.client == "web":
                csrf_check(request)
            user = session.user
            if (
                not user.is_active
                or session.current_jti != token["jti"]
                or str(user.id) != token["user_id"]
                or (
                    user.role not in {Role.ADMIN, Role.PATIENT}
                    and (not user.organization_id or not user.organization.active)
                )
            ):
                # Return inside atomic so revocation survives the error response.
                session.revoked_at = timezone.now()
                session.save(update_fields=["revoked_at"])
                return auth_failure(
                    request, "Refresh token qayta ishlatilgan yoki akkaunt bloklangan."
                )
            return mint_tokens(session, tab_id)


class LogoutView(APIView):
    @extend_schema(request=TabSessionInput, responses={204: None})
    def post(self, request):
        serializer = TabSessionInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = AuthSession.objects.get(pk=request.auth["sid"])
        if session.client == "web":
            csrf_check(request)
        session.revoked_at = timezone.now()
        session.save(update_fields=["revoked_at"])
        response = Response(status=204)
        if session.client == "web":
            response.delete_cookie(
                refresh_cookie_name(serializer.validated_data.get("tab_id")),
                path="/api/v1/auth",
                samesite="Lax",
            )
        return response


class MeView(APIView):
    @extend_schema(responses=UserSerializer)
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class IssueActivationView(APIView):
    @extend_schema(request=ActivationIssueInput, responses=ActivationOutput)
    def post(self, request, pk):
        if not is_hospital_staff(request.user):
            raise PermissionDenied()
        serializer = ActivationIssueInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            patient = get_object_or_404(
                Patient.objects.select_for_update(), pk=pk, created_by_org=request.user.organization
            )
            if not patient.contact or not serializer.validated_data["phone_verified"]:
                raise ValidationError({"phone_verified": "Bemor telefoni tekshirilishi kerak."})
            if User.objects.filter(patient=patient).exists():
                raise ValidationError({"patient_id": "Akkaunt allaqachon aktivlashtirilgan."})
            code = secrets.token_urlsafe(24)
            activation, _ = ActivationCode.objects.update_or_create(
                patient=patient,
                defaults={
                    "code_hash": make_password(code),
                    "expires_at": timezone.now() + timedelta(hours=24),
                    "attempts": 0,
                    "used_at": None,
                },
            )
            audit(request.user, patient, "ACTIVATION_ISSUED", request=request)
        response = Response(
            {"patient_id": str(patient.id), "code": code, "expires_at": activation.expires_at},
            status=201,
        )
        response["Cache-Control"] = "no-store"
        return response


class ActivatePatientView(PublicAuthView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ActivationThrottle]

    @extend_schema(request=ActivationInput, responses=UserSerializer)
    def post(self, request):
        serializer = ActivationInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            validate_password(data["password"])
        except DjangoValidationError as exc:
            raise ValidationError({"password": exc.messages}) from exc
        with transaction.atomic():
            activation = (
                ActivationCode.objects.select_for_update()
                .filter(patient_id=data["patient_id"])
                .first()
            )
            if (
                not activation
                or activation.used_at
                or activation.attempts >= 5
                or activation.expires_at <= timezone.now()
            ):
                return auth_failure(request, "Aktivatsiya kodi yaroqsiz.")
            if not check_password(data["code"], activation.code_hash):
                activation.attempts += 1
                activation.save(update_fields=["attempts"])
                return auth_failure(request, "Aktivatsiya kodi yaroqsiz.")
            user = User.objects.create_user(
                username=f"patient-{activation.patient_id.hex}",
                password=data["password"],
                role=Role.PATIENT,
                patient_id=activation.patient_id,
            )
            activation.used_at = timezone.now()
            activation.save(update_fields=["used_at"])
            audit(user, activation.patient, "PATIENT_ACTIVATED", request=request)
            return Response(UserSerializer(user).data, status=201)
