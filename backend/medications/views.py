from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from care.views import ScopedViewSet
from common.exceptions import Conflict
from common.idempotency import IdempotencyMixin

from . import services
from .models import MedicationItem
from .scopes import (
    intake_patients_for,
    occurrences_for,
    plans_for,
    records_for,
    require_doctor,
    require_patient,
    visible_patient,
)
from .serializers import (
    AwareDateTimeField,
    DoseCorrectionInput,
    DoseOccurrenceSerializer,
    DoseRecordInput,
    DoseRecordSerializer,
    MedicationPlanSerializer,
    PlanCreateInput,
    PlanStopInput,
    PlanUpdateInput,
    PlanVersionInput,
)


def sync_response(response):
    response.data["server_time"] = timezone.now().isoformat()
    response.data["cache_max_age_seconds"] = 86400
    return response


def filter_occurrences(queryset, params, plan=None):
    if "plan_version" in params:
        try:
            version = int(params["plan_version"])
            if version < 1:
                raise ValueError()
        except ValueError as exc:
            raise ValidationError({"plan_version": "Musbat butun son kiriting."}) from exc
        if plan and version != plan.version:
            raise Conflict("So‘ralgan jadval versiyasi mos emas.")
        queryset = queryset.filter(plan_version=version)
    for key, field in [
        ("scheduled_from", "scheduled_at__gte"),
        ("scheduled_to", "scheduled_at__lte"),
    ]:
        if params.get(key):
            queryset = queryset.filter(**{field: AwareDateTimeField().run_validation(params[key])})
    start, end = None, None
    try:
        if params.get("date_from"):
            start = date.fromisoformat(params["date_from"])
        if params.get("date_to"):
            end = date.fromisoformat(params["date_to"])
    except ValueError as exc:
        raise ValidationError({"date": "YYYY-MM-DD shaklida sana kiriting."}) from exc
    if start and end and start > end:
        raise ValidationError({"date_to": "Oxirgi sana boshlanish sanasidan oldin bo‘lmaydi."})
    if start or end:
        clause = Q(pk__in=[])
        zones = (
            MedicationItem.objects.filter(occurrences__in=queryset)
            .order_by()
            .values_list("timezone", flat=True)
            .distinct()
        )
        for name in zones:
            zone = ZoneInfo(name)
            condition = Q(item__timezone=name)
            if start:
                condition &= Q(scheduled_at__gte=datetime.combine(start, time.min, tzinfo=zone))
            if end:
                try:
                    next_day = end + timedelta(days=1)
                except OverflowError as exc:
                    raise ValidationError({"date_to": "Sana chegaradan tashqarida."}) from exc
                condition &= Q(scheduled_at__lt=datetime.combine(next_day, time.min, tzinfo=zone))
            clause |= condition
        queryset = queryset.filter(clause)
    return queryset


def occurrence_queryset(queryset):
    return (
        queryset.select_related("item__plan", "record")
        .prefetch_related("record__corrections")
        .order_by("scheduled_at", "id")
    )


class PatientPlansView(IdempotencyMixin, GenericAPIView):
    serializer_class = MedicationPlanSerializer

    def check_idempotency_scope(self, request, *args, **kwargs):
        visible_patient(request.user, kwargs["pk"])

    @extend_schema(responses=MedicationPlanSerializer(many=True))
    def get(self, request, pk):
        visible_patient(request.user, pk)
        queryset = (
            plans_for(request.user)
            .filter(patient_id=pk)
            .prefetch_related("items")
            .order_by("-created_at", "id")
        )
        response = self.get_paginated_response(
            MedicationPlanSerializer(self.paginate_queryset(queryset), many=True).data
        )
        return sync_response(response)

    @extend_schema(request=PlanCreateInput, responses={201: MedicationPlanSerializer})
    def post(self, request, pk):
        serializer = PlanCreateInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = services.create_plan(pk, request.user, serializer.validated_data, request)
        return Response(MedicationPlanSerializer(plan).data, status=201)


class MedicationPlanViewSet(mixins.RetrieveModelMixin, ScopedViewSet):
    serializer_class = MedicationPlanSerializer

    def get_queryset(self):
        return plans_for(self.request.user).prefetch_related("items")

    def check_idempotency_scope(self, request, *args, **kwargs):
        self.get_object()
        if self.action in {"approve", "revisions", "stop"}:
            require_doctor(request.user, approve=self.action == "approve")

    @extend_schema(request=PlanUpdateInput, responses=MedicationPlanSerializer)
    def partial_update(self, request, pk=None):
        serializer = PlanUpdateInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            MedicationPlanSerializer(
                services.update_draft(pk, request.user, serializer.validated_data, request)
            ).data
        )

    @extend_schema(request=PlanVersionInput, responses=MedicationPlanSerializer)
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        serializer = PlanVersionInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            MedicationPlanSerializer(
                services.approve_plan(pk, request.user, serializer.validated_data, request)
            ).data
        )

    @extend_schema(request=PlanUpdateInput, responses={201: MedicationPlanSerializer})
    @action(detail=True, methods=["post"])
    def revisions(self, request, pk=None):
        serializer = PlanUpdateInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            MedicationPlanSerializer(
                services.revise_plan(pk, request.user, serializer.validated_data, request)
            ).data,
            status=201,
        )

    @extend_schema(request=PlanStopInput, responses=MedicationPlanSerializer)
    @action(detail=True, methods=["post"])
    def stop(self, request, pk=None):
        serializer = PlanStopInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            MedicationPlanSerializer(
                services.stop_plan(pk, request.user, serializer.validated_data, request)
            ).data
        )

    @extend_schema(
        parameters=[
            OpenApiParameter("plan_version", int),
            OpenApiParameter("date_from", str),
            OpenApiParameter("date_to", str),
            OpenApiParameter("scheduled_from", str),
            OpenApiParameter("scheduled_to", str),
        ],
        responses=DoseOccurrenceSerializer(many=True),
    )
    @action(detail=True, methods=["get"])
    def occurrences(self, request, pk=None):
        plan = self.get_object()
        queryset = occurrence_queryset(
            filter_occurrences(
                occurrences_for(request.user).filter(item__plan=plan), request.query_params, plan
            )
        )
        context = {
            "include_records": intake_patients_for(request.user).filter(pk=plan.patient_id).exists()
        }
        response = self.get_paginated_response(
            DoseOccurrenceSerializer(
                self.paginate_queryset(queryset), many=True, context=context
            ).data
        )
        response.data.update(
            {"plan_id": str(plan.id), "plan_version": plan.version, "plan_status": plan.status}
        )
        return sync_response(response)


class DoseOccurrenceViewSet(ScopedViewSet):
    serializer_class = DoseOccurrenceSerializer

    def get_queryset(self):
        return occurrences_for(self.request.user)

    def check_idempotency_scope(self, request, *args, **kwargs):
        require_patient(request.user)
        super().check_idempotency_scope(request, *args, **kwargs)

    @extend_schema(
        request=DoseRecordInput, responses={200: DoseRecordSerializer, 201: DoseRecordSerializer}
    )
    @action(detail=True, methods=["post"])
    def record(self, request, pk=None):
        serializer = DoseRecordInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        record, created = services.record_dose(pk, request.user, serializer.validated_data, request)
        return Response(DoseRecordSerializer(record).data, status=201 if created else 200)


class DoseRecordViewSet(ScopedViewSet):
    serializer_class = DoseRecordSerializer

    def get_queryset(self):
        return records_for(self.request.user)

    def check_idempotency_scope(self, request, *args, **kwargs):
        require_patient(request.user)
        super().check_idempotency_scope(request, *args, **kwargs)

    @extend_schema(request=DoseCorrectionInput, responses=DoseRecordSerializer)
    @action(detail=True, methods=["post"])
    def corrections(self, request, pk=None):
        serializer = DoseCorrectionInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            DoseRecordSerializer(
                services.correct_dose(pk, request.user, serializer.validated_data, request)
            ).data
        )


class MedicationHistoryView(GenericAPIView):
    serializer_class = DoseOccurrenceSerializer

    @extend_schema(
        parameters=[
            OpenApiParameter("plan_version", int),
            OpenApiParameter("date_from", str),
            OpenApiParameter("date_to", str),
        ],
        responses=DoseOccurrenceSerializer(many=True),
    )
    def get(self, request, pk):
        get_object_or_404(intake_patients_for(request.user), pk=pk)
        queryset = occurrences_for(request.user).filter(
            item__plan__patient_id=pk, scheduled_at__lte=timezone.now()
        )
        queryset = occurrence_queryset(filter_occurrences(queryset, request.query_params))
        response = self.get_paginated_response(
            DoseOccurrenceSerializer(self.paginate_queryset(queryset), many=True).data
        )
        return sync_response(response)
