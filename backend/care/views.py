import hashlib
import uuid

from django.db.models import F, Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from drf_spectacular.utils import OpenApiParameter, extend_schema
from pypdf import PdfReader
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role, User
from common.exceptions import Conflict, PayloadTooLarge
from common.idempotency import IdempotencyMixin

from . import services
from .models import (
    OPEN_STATUSES,
    AIExtraction,
    Attachment,
    ContactAttempt,
    Discharge,
    Notification,
    Organization,
    TaskStatus,
    Territory,
)
from .scopes import discharges_for, patients_for, tasks_for
from .serializers import (
    AIReviewInput,
    AttachmentSerializer,
    CancelInput,
    CompleteInput,
    ContactAttemptInput,
    CorrectionSerializer,
    DischargeSerializer,
    DoctorSerializer,
    ExtractionInput,
    ExtractionSerializer,
    NotificationSerializer,
    OrganizationSerializer,
    PatientSerializer,
    ReassignInput,
    TaskSerializer,
    TerritorySerializer,
    UploadInput,
    VersionInput,
)


class ScopedViewSet(IdempotencyMixin, viewsets.GenericViewSet):
    lookup_value_regex = (
        r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
    )


class PatientViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    ScopedViewSet,
):
    serializer_class = PatientSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "id", str, description="Exact patient UUID; no global name or phone search"
            )
        ]
    )
    def list(self, request, *args, **kwargs):
        if set(request.query_params) & {"search", "name", "phone"}:
            raise ValidationError("Bemorni faqat aniq ichki UUID bilan qidiring.")
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        queryset = patients_for(self.request.user).order_by("-created_at")
        value = self.request.query_params.get("id")
        if value:
            try:
                queryset = queryset.filter(pk=uuid.UUID(value))
            except ValueError as exc:
                raise ValidationError({"id": "UUID kiriting."}) from exc
        return queryset.select_for_update() if self.request.method == "PATCH" else queryset

    def perform_create(self, serializer):
        services.require_role(self.request.user, Role.HOSPITAL)
        if self.request.user.organization.type != Organization.Type.HOSPITAL:
            raise PermissionDenied()
        patient = serializer.save(
            created_by=self.request.user, created_by_org=self.request.user.organization
        )
        services.audit(self.request.user, patient, "PATIENT_CREATED", request=self.request)

    def perform_update(self, serializer):
        services.require_role(self.request.user, Role.HOSPITAL)
        patient = serializer.instance
        if patient.created_by_id != self.request.user.id:
            raise PermissionDenied()
        if not patient.discharges.filter(
            created_by=self.request.user, status=Discharge.Status.DRAFT
        ).exists():
            raise Conflict("Tahrir uchun tasdiqlanmagan chiqarish kerak.")
        serializer.save()
        services.audit(
            self.request.user,
            patient,
            "PATIENT_UPDATED",
            serializer.validated_data.keys(),
            self.request,
        )


class DischargeViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    ScopedViewSet,
):
    serializer_class = DischargeSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        queryset = (
            discharges_for(self.request.user)
            .select_related("patient", "hospital")
            .prefetch_related("attachments")
            .order_by("-created_at")
        )
        if self.request.method in {"POST", "PATCH"}:
            return queryset.select_for_update(of=("self",))
        return queryset

    def perform_create(self, serializer):
        services.require_role(self.request.user, Role.HOSPITAL)
        if self.request.user.organization.type != Organization.Type.HOSPITAL:
            raise PermissionDenied()
        obj = serializer.save(created_by=self.request.user, hospital=self.request.user.organization)
        services.audit(self.request.user, obj, "DISCHARGE_DRAFT_CREATED", request=self.request)

    def perform_update(self, serializer):
        services.require_role(self.request.user, Role.HOSPITAL)
        if serializer.instance.status != Discharge.Status.DRAFT:
            raise Conflict("Tasdiqlangan yozuvga faqat tuzatish qo‘shiladi.")
        serializer.save()
        services.audit(
            self.request.user,
            serializer.instance,
            "DISCHARGE_DRAFT_UPDATED",
            serializer.validated_data.keys(),
            self.request,
        )

    @extend_schema(request=None, responses=TaskSerializer)
    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        self.get_object()
        task, created = services.confirm_discharge(pk, request.user, request)
        return Response(TaskSerializer(task).data, status=201 if created else 200)

    @extend_schema(request=UploadInput, responses=AttachmentSerializer)
    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser])
    def attachments(self, request, pk=None):
        services.require_role(request.user, Role.HOSPITAL)
        discharge = self.get_object()
        if discharge.status != Discharge.Status.DRAFT:
            raise Conflict("Faqat loyiha chiqarishga fayl yuklanadi.")
        serializer = UploadInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data["file"]
        if upload.size > 10 * 1024 * 1024:
            raise PayloadTooLarge()
        if upload.content_type != "application/pdf" or upload.read(5) != b"%PDF-":
            raise ValidationError({"file": "Haqiqiy application/pdf fayli kerak."})
        upload.seek(0)
        try:
            reader = PdfReader(upload)
            if reader.is_encrypted or not reader.pages:
                raise ValueError("Unreadable PDF")
        except Exception as exc:
            raise ValidationError(
                {"file": "PDF o‘qilmaydi yoki parol bilan himoyalangan."}
            ) from exc
        upload.seek(0)
        digest = hashlib.sha256(upload.read()).hexdigest()
        upload.seek(0)
        upload.name = f"{uuid.uuid4()}.pdf"
        attachment = Attachment.objects.create(
            discharge=discharge,
            file=upload,
            checksum=digest,
            size=upload.size,
            uploaded_by=request.user,
        )
        services.audit(request.user, attachment, "PDF_UPLOADED", request=request)
        return Response(AttachmentSerializer(attachment).data, status=201)

    @extend_schema(request=CorrectionSerializer, responses=CorrectionSerializer)
    @action(detail=True, methods=["post"])
    def corrections(self, request, pk=None):
        services.require_role(request.user, Role.HOSPITAL)
        discharge = self.get_object()
        if discharge.status != Discharge.Status.CONFIRMED:
            raise Conflict("Loyiha yozuvni bevosita tahrirlang.")
        serializer = CorrectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data["field"] != "recommendations":
            raise ValidationError({"field": "Faqat recommendations tuzatiladi."})
        correction = serializer.save(discharge=discharge, actor=request.user)
        services.audit(request.user, discharge, "DISCHARGE_CORRECTED", ["recommendations"], request)
        return Response(CorrectionSerializer(correction).data, status=201)

    @extend_schema(request=ExtractionInput, responses=ExtractionSerializer)
    @action(detail=True, methods=["post"], url_path="ai-extractions")
    def ai_extractions(self, request, pk=None):
        services.require_role(request.user, Role.HOSPITAL)
        discharge = self.get_object()
        if discharge.status != Discharge.Status.DRAFT:
            raise Conflict("AI tekshiruvi faqat loyiha chiqarish uchun.")
        serializer = ExtractionInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        attachment = (
            get_object_or_404(Attachment, pk=data["attachment_id"], discharge=discharge)
            if "attachment_id" in data
            else None
        )
        extraction = AIExtraction.objects.create(
            discharge=discharge, attachment=attachment, source_text=data.get("text", "")
        )
        services.audit(request.user, extraction, "AI_QUEUED", request=request)
        return Response(ExtractionSerializer(extraction).data, status=202)


class TaskViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, ScopedViewSet):
    serializer_class = TaskSerializer

    def get_queryset(self):
        queryset = (
            tasks_for(self.request.user)
            .select_related("discharge", "report")
            .prefetch_related("contact_attempts", "discharge__attachments")
            .order_by("due_at", "id")
        )
        params = self.request.query_params
        if params.get("status"):
            if params["status"] not in TaskStatus.values:
                raise ValidationError({"status": "Noto‘g‘ri holat."})
            queryset = queryset.filter(status=params["status"])
        for key, field in [
            ("doctor_id", "assigned_doctor_id"),
            ("organization_id", "receiving_org_id"),
        ]:
            if params.get(key):
                try:
                    queryset = queryset.filter(**{field: uuid.UUID(params[key])})
                except ValueError as exc:
                    raise ValidationError({key: "UUID kiriting."}) from exc
        for key, field in [
            ("due_before", "due_at__lte"),
            ("discharged_from", "discharge__discharged_at__gte"),
            ("discharged_to", "discharge__discharged_at__lte"),
        ]:
            if params.get(key):
                try:
                    value = parse_datetime(params[key])
                except ValueError:
                    value = None
                if not value or timezone.is_naive(value):
                    raise ValidationError({key: "Vaqt zonali ISO-8601 vaqt kiriting."})
                queryset = queryset.filter(**{field: value})
        if "overdue" in params:
            if params["overdue"] not in {"true", "false"}:
                raise ValidationError({"overdue": "true yoki false kiriting."})
            overdue = Q(status__in=OPEN_STATUSES, due_at__lt=timezone.now())
            queryset = queryset.filter(overdue if params["overdue"] == "true" else ~overdue)
        return queryset

    @extend_schema(request=VersionInput, responses=TaskSerializer)
    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        self.get_object()
        serializer = VersionInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            TaskSerializer(
                services.accept_task(
                    pk, request.user, serializer.validated_data["version"], request
                )
            ).data
        )

    @extend_schema(request=CompleteInput, responses=TaskSerializer)
    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        self.get_object()
        serializer = CompleteInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            TaskSerializer(
                services.complete_task(pk, request.user, dict(serializer.validated_data), request)
            ).data
        )

    @extend_schema(request=ContactAttemptInput, responses=TaskSerializer)
    @action(detail=True, methods=["post"], url_path="contact-attempts")
    def contact_attempts(self, request, pk=None):
        self.get_object()
        services.require_role(request.user, Role.DOCTOR)
        serializer = ContactAttemptInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        task = services.locked_task(pk, data.pop("version"))
        if task.assigned_doctor_id != request.user.id:
            raise PermissionDenied()
        if not task.discharge.discharged_at <= data["attempted_at"] <= timezone.now():
            raise ValidationError({"attempted_at": "Vaqt chiqarish va hozir oralig‘ida bo‘lsin."})
        ContactAttempt.objects.create(task=task, actor=request.user, **data)
        task.version += 1
        task.save(update_fields=["version"])
        services.audit(request.user, task, "CONTACT_ATTEMPT_RECORDED", request=request)
        return Response(TaskSerializer(task).data, status=201)

    @extend_schema(request=ReassignInput, responses=TaskSerializer)
    @action(detail=True, methods=["post"])
    def reassign(self, request, pk=None):
        self.get_object()
        serializer = ReassignInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            TaskSerializer(
                services.reassign_task(pk, request.user, serializer.validated_data, request)
            ).data
        )

    @extend_schema(request=CancelInput, responses=TaskSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        self.get_object()
        serializer = CancelInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            TaskSerializer(
                services.cancel_task(pk, request.user, serializer.validated_data, request)
            ).data
        )

    @extend_schema(request=CorrectionSerializer, responses=CorrectionSerializer)
    @action(detail=True, methods=["post"], url_path="report-corrections")
    def report_corrections(self, request, pk=None):
        services.require_role(request.user, Role.DOCTOR)
        task = self.get_object()
        report = getattr(task, "report", None)
        if not report or report.author_id != request.user.id:
            raise PermissionDenied()
        serializer = CorrectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        field = serializer.validated_data["field"]
        if field not in {"observation", "actions", "follow_up"}:
            raise ValidationError({"field": "Faqat hisobot matni tuzatiladi."})
        correction = serializer.save(report=report, actor=request.user)
        services.audit(request.user, task, "REPORT_CORRECTED", [field], request)
        return Response(CorrectionSerializer(correction).data, status=201)


class AttachmentDownloadView(APIView):
    @extend_schema(responses={(200, "application/pdf"): bytes})
    def get(self, request, pk):
        attachment = get_object_or_404(
            Attachment, pk=pk, discharge__in=discharges_for(request.user)
        )
        services.audit(request.user, attachment, "PDF_DOWNLOADED", request=request)
        response = FileResponse(
            attachment.file.open("rb"),
            as_attachment=True,
            filename=f"{attachment.id}.pdf",
            content_type="application/pdf",
        )
        response["Cache-Control"] = "no-store"
        return response


class ExtractionViewSet(mixins.RetrieveModelMixin, ScopedViewSet):
    serializer_class = ExtractionSerializer

    def get_queryset(self):
        if self.request.user.role != Role.HOSPITAL:
            return AIExtraction.objects.none()
        return AIExtraction.objects.filter(discharge__created_by=self.request.user)

    @extend_schema(request=AIReviewInput, responses=ExtractionSerializer)
    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        obj = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)
        discharge = Discharge.objects.select_for_update().get(pk=obj.discharge_id)
        if obj.status != "PENDING_REVIEW" or discharge.status != Discharge.Status.DRAFT:
            raise Conflict("Natija tekshiruv kutmayapti yoki chiqarish tasdiqlangan.")
        serializer = AIReviewInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj.reviewed_result = serializer.validated_data
        obj.reviewed_by, obj.reviewed_at, obj.status = request.user, timezone.now(), "REVIEWED"
        obj.save(update_fields=["reviewed_result", "reviewed_by", "reviewed_at", "status"])
        if obj.reviewed_result["recommendations"]:
            discharge.recommendations = "\n".join(obj.reviewed_result["recommendations"])
            discharge.save(update_fields=["recommendations"])
        services.audit(request.user, obj, "AI_REVIEWED", request=request)
        return Response(ExtractionSerializer(obj).data)


class NotificationViewSet(mixins.ListModelMixin, ScopedViewSet):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).order_by("-created_at")

    @extend_schema(request=None, responses=NotificationSerializer)
    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        obj = self.get_object()
        if not obj.read_at:
            obj.read_at = timezone.now()
            obj.save(update_fields=["read_at"])
        return Response(NotificationSerializer(obj).data)


class MetricsView(APIView):
    @extend_schema(responses={200: dict})
    def get(self, request):
        services.require_role(request.user, Role.COORDINATOR)
        all_tasks = tasks_for(request.user)
        queryset = all_tasks.filter(is_test=False).exclude(status=TaskStatus.CANCELLED)
        now = timezone.now()
        assessed = queryset.filter(Q(due_at__lt=now) | Q(status=TaskStatus.COMPLETED)).count()
        on_time = queryset.filter(
            status=TaskStatus.COMPLETED, completed_at__lte=F("due_at")
        ).count()
        return Response(
            {
                "active": queryset.filter(status__in=OPEN_STATUSES).count(),
                "overdue": queryset.filter(status__in=OPEN_STATUSES, due_at__lt=now).count(),
                "unassigned": queryset.filter(status=TaskStatus.UNASSIGNED).count(),
                "completed_on_time": on_time,
                "assessed": assessed,
                "sla_percent": round(on_time / assessed * 100, 2) if assessed else None,
                "late_documented": queryset.filter(
                    status=TaskStatus.COMPLETED,
                    completed_at__gt=F("due_at"),
                    report__performed_at__lte=F("due_at"),
                ).count(),
                "no_contact": queryset.filter(contact_attempts__isnull=True).count(),
                "cancelled": all_tasks.filter(status=TaskStatus.CANCELLED).count(),
                "test_records": all_tasks.filter(is_test=True).count(),
            }
        )


class ReferenceViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    ScopedViewSet,
):
    http_method_names = ["get", "post", "patch", "head", "options"]

    def perform_create(self, serializer):
        services.require_role(self.request.user, Role.ADMIN)
        obj = serializer.save()
        services.audit(self.request.user, obj, "REFERENCE_CREATED", request=self.request)

    def perform_update(self, serializer):
        services.require_role(self.request.user, Role.ADMIN)
        obj = serializer.save()
        services.audit(
            self.request.user,
            obj,
            "REFERENCE_UPDATED",
            serializer.validated_data.keys(),
            self.request,
        )


class TerritoryViewSet(ReferenceViewSet):
    serializer_class = TerritorySerializer

    def get_queryset(self):
        queryset = Territory.objects.order_by("name", "id")
        user = self.request.user
        if user.role == Role.ADMIN:
            return queryset
        if user.organization_id:
            return queryset.filter(pk=user.organization.territory_id)
        if user.role == Role.PATIENT and user.patient_id:
            return queryset.filter(pk=user.patient.territory_id)
        return queryset.none()


class OrganizationViewSet(ReferenceViewSet):
    serializer_class = OrganizationSerializer

    def get_queryset(self):
        queryset = Organization.objects.order_by("name", "id")
        user = self.request.user
        if user.role == Role.ADMIN:
            return queryset
        return (
            queryset.filter(territory_id=user.organization.territory_id, active=True)
            if user.organization_id
            else queryset.none()
        )


class DoctorViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, ScopedViewSet):
    serializer_class = DoctorSerializer

    def get_queryset(self):
        queryset = User.objects.filter(
            role=Role.DOCTOR, is_active=True, organization__active=True
        ).order_by("username")
        user = self.request.user
        if user.role == Role.ADMIN:
            return queryset
        if user.organization_id:
            return queryset.filter(organization__territory_id=user.organization.territory_id)
        if user.role == Role.PATIENT and user.patient_id:
            return queryset.filter(
                patientassignment__patient_id=user.patient_id,
                patientassignment__valid_to__isnull=True,
            )
        return queryset.none()
