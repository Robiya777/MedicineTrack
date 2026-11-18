from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import SimpleRouter

from accounts.management_views import StaffAccountViewSet
from accounts.views import (
    ActivatePatientView,
    CSRFView,
    IssueActivationView,
    LoginView,
    LogoutView,
    MeView,
    RefreshView,
)
from care.views import (
    AttachmentDownloadView,
    DischargeViewSet,
    DoctorViewSet,
    ExtractionViewSet,
    MetricsView,
    NotificationViewSet,
    OrganizationViewSet,
    PatientViewSet,
    TaskViewSet,
    TerritoryViewSet,
)
from common.health import live, ready
from medications.views import (
    DoseOccurrenceViewSet,
    DoseRecordViewSet,
    MedicationHistoryView,
    MedicationPlanViewSet,
    PatientPlansView,
)
from messaging.assistant_views import AssistantConfigView, EmergencyViewSet
from messaging.views import ConversationViewSet, ScheduleView, UnansweredView

router = SimpleRouter(trailing_slash=False)
router.register("assistant/emergencies", EmergencyViewSet, basename="assistant-emergency")
router.register("medication-plans", MedicationPlanViewSet, basename="medication-plan")
router.register("dose-occurrences", DoseOccurrenceViewSet, basename="dose-occurrence")
router.register("dose-records", DoseRecordViewSet, basename="dose-record")
router.register("reference/accounts", StaffAccountViewSet, basename="staff-account")
router.register("patients", PatientViewSet, basename="patient")
router.register("discharges", DischargeViewSet, basename="discharge")
router.register("tasks", TaskViewSet, basename="task")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("ai-extractions", ExtractionViewSet, basename="extraction")
router.register("reference/territories", TerritoryViewSet, basename="territory")
router.register("reference/organizations", OrganizationViewSet, basename="organization")
router.register("reference/doctors", DoctorViewSet, basename="doctor")
router.register("conversations", ConversationViewSet, basename="conversation")

urlpatterns = [
    path("api/v1/assistant/config", AssistantConfigView.as_view()),
    path("api/v1/patients/<uuid:pk>/medication-plans", PatientPlansView.as_view()),
    path("api/v1/patients/<uuid:pk>/medication-history", MedicationHistoryView.as_view()),
    path("health/live", live),
    path("health/ready", ready),
    path("api/v1/auth/csrf", CSRFView.as_view()),
    path("api/v1/auth/login", LoginView.as_view()),
    path("api/v1/auth/refresh", RefreshView.as_view()),
    path("api/v1/auth/logout", LogoutView.as_view()),
    path("api/v1/auth/patient-activate", ActivatePatientView.as_view()),
    path("api/v1/me", MeView.as_view()),
    path("api/v1/patients/<uuid:pk>/activation", IssueActivationView.as_view()),
    path("api/v1/attachments/<uuid:pk>/download", AttachmentDownloadView.as_view()),
    path("api/v1/dashboard/metrics", MetricsView.as_view()),
    path("api/v1/dashboard/unanswered", UnansweredView.as_view()),
    path("api/v1/doctors/<uuid:pk>/work-schedule", ScheduleView.as_view()),
    path("api/v1/schema", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/docs", SpectacularSwaggerView.as_view(url_name="schema")),
    path("api/v1/", include(router.urls)),
]
