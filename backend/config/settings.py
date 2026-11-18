import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    return os.getenv(name, str(default)).lower() in {"1", "true", "yes"}


def env_list(name, default=""):
    return [value.strip() for value in os.getenv(name, default).split(",") if value.strip()]


DEBUG = env_bool("DJANGO_DEBUG", True)
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "development-only-change-before-deployment")
if not DEBUG and (SECRET_KEY.startswith(("development-", "replace-")) or len(SECRET_KEY) < 40):
    raise ImproperlyConfigured(
        "Production requires a random DJANGO_SECRET_KEY of at least 40 characters."
    )
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver")
INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "corsheaders",
    "common",
    "accounts",
    "care",
    "messaging",
    "medications",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "common.middleware.RequestIDMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []},
    }
]
DATABASES = {
    "default": dj_database_url.parse(
        os.getenv("DATABASE_URL", "").strip() or f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=60,
        conn_health_checks=True,
    )
}
DATABASES["default"].setdefault("OPTIONS", {})
if DATABASES["default"]["ENGINE"].endswith("sqlite3"):
    DATABASES["default"]["OPTIONS"]["timeout"] = 30
AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
LANGUAGE_CODE = "uz"
TIME_ZONE = "UTC"
USE_TZ = True
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
APPEND_SLASH = False
MEDIA_ROOT = Path(os.getenv("PRIVATE_STORAGE_ROOT", str(BASE_DIR / "private_media")))
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
DATA_UPLOAD_MAX_MEMORY_SIZE = 12 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 1024 * 1024
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
CORS_ALLOW_CREDENTIALS = True
from corsheaders.defaults import default_headers  # noqa: E402

CORS_ALLOW_HEADERS = (*default_headers, "idempotency-key", "x-request-id")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", "http://localhost:5173")
COOKIE_SECURE = env_bool("COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SECURE = COOKIE_SECURE
SESSION_COOKIE_SECURE = COOKIE_SECURE
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", not DEBUG)
X_FRAME_OPTIONS = "DENY"
SECURE_HSTS_SECONDS = 0 if DEBUG else 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
REDIS_URL = os.getenv("REDIS_URL", "")
CACHES = {
    "default": (
        {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_URL,
            "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
        }
        if REDIS_URL
        else {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}
    )
}
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["accounts.authentication.SessionJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "common.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "common.exceptions.exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_RATES": {
        "login": "10/min",
        "refresh": "60/min",
        "messages": "20/min",
        "activation": "10/min",
    },
}
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
}
SPECTACULAR_SETTINGS = {
    "TITLE": "MedicineTrack API",
    "VERSION": "0.2.0",
    "DESCRIPTION": "Synthetic-data demo. Times are UTC; clients display Asia/Tashkent.",
    "SERVE_PERMISSIONS": ["rest_framework.permissions.AllowAny"],
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "ContactChannelEnum": [("PHONE", "Telefon"), ("HOME_VISIT", "Uyga tashrif")],
        "DoseResultEnum": [("TAKEN", "Ichdim"), ("SKIPPED", "O‘tkazib yubordim")],
        "ContactAttemptResultEnum": [
            ("CONTACTED", "Bog‘lanildi"),
            ("NO_ANSWER", "Javobsiz"),
            ("WRONG_NUMBER", "Noto‘g‘ri raqam"),
            ("ADDRESS_NOT_FOUND", "Manzil topilmadi"),
            ("REFUSED", "Rad etdi"),
        ],
    },
}
CELERY_BROKER_URL = REDIS_URL or "redis://localhost:6379/0"
CELERY_RESULT_BACKEND = None
CELERY_TASK_IGNORE_RESULT = True
CELERY_TASK_TIME_LIMIT = 40
CELERY_TASK_SOFT_TIME_LIMIT = 30
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_BEAT_SCHEDULE = {
    "medication-course-completion": {"task": "medications.jobs.complete_courses", "schedule": 60.0},
    "deadlines": {"task": "care.jobs.scan_deadlines", "schedule": 60.0},
    "outbox": {"task": "care.jobs.deliver_outbox", "schedule": 5.0},
    "response-deadlines": {"task": "messaging.jobs.scan_responses", "schedule": 60.0},
    "ai-extractions": {"task": "care.jobs.process_extractions", "schedule": 5.0},
}
DEMO_MODE = env_bool("DEMO_MODE", False)
AI_MODE = os.getenv("AI_MODE", "disabled")
COMPLETION_CHANNELS = env_list("COMPLETION_CHANNELS", "PHONE,HOME_VISIT")
