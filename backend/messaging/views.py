from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from accounts.models import Role, User
from care.services import audit, require_role
from care.views import ScopedViewSet
from common.exceptions import Conflict
from common.idempotency import IdempotencyMixin
from common.pagination import StandardPagination

from .models import Message, PatientStatusUpdate, ResponseEpisode, WorkSchedule
from .serializers import (
    ConversationSerializer,
    MessageInput,
    MessageSerializer,
    ScheduleSerializer,
    StatusInput,
    StatusSerializer,
)
from .services import conversations_for, ensure_conversation, locked_conversation, send_message


class MessageThrottle(UserRateThrottle):
    scope = "messages"


class ConversationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, ScopedViewSet):
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return conversations_for(self.request.user).order_by("-created_at", "id")

    def list(self, request, *args, **kwargs):
        if request.user.role == Role.PATIENT and request.user.patient_id:
            ensure_conversation(request.user.patient_id)
        return super().list(request, *args, **kwargs)

    def get_throttles(self):
        return (
            [MessageThrottle()]
            if self.request.method == "POST" and self.action in {"messages", "status_updates"}
            else super().get_throttles()
        )

    @extend_schema(methods=["GET"], responses=MessageSerializer(many=True))
    @extend_schema(methods=["POST"], request=MessageInput, responses=MessageSerializer)
    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        conversation = self.get_object()
        if request.method == "GET":
            queryset = (
                Message.objects.filter(
                    Q(conversation=conversation) | Q(response_episode__conversation=conversation)
                )
                .select_related(
                    "sender",
                    "response_episode",
                    "assistant_assessment__incident__assessment",
                    "assistant_assessment__incident__episode__conversation__patient",
                )
                .order_by("sent_at", "id")
            )
            return self.get_paginated_response(
                MessageSerializer(self.paginate_queryset(queryset), many=True).data
            )
        serializer = MessageInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = send_message(
            pk,
            request.user,
            serializer.validated_data["text"],
            request,
            assistant_response_to=serializer.validated_data.get("assistant_response_to"),
        )
        return Response(MessageSerializer(message).data, status=201)

    @extend_schema(request=None, responses={200: dict})
    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        self.get_object()
        conversation = locked_conversation(pk, request.user)
        count = (
            Message.objects.filter(
                Q(conversation=conversation) | Q(response_episode__conversation=conversation)
            )
            .filter(read_at__isnull=True)
            .exclude(sender=request.user)
            .update(read_at=timezone.now())
        )
        return Response({"marked_read": count})

    @extend_schema(methods=["GET"], responses=StatusSerializer(many=True))
    @extend_schema(methods=["POST"], request=StatusInput, responses=StatusSerializer)
    @action(detail=True, methods=["get", "post"], url_path="status-updates")
    def status_updates(self, request, pk=None):
        conversation = self.get_object()
        if request.method == "GET":
            queryset = conversation.status_updates.order_by("-received_at", "id")
            return self.get_paginated_response(
                StatusSerializer(self.paginate_queryset(queryset), many=True).data
            )
        require_role(request.user, Role.PATIENT)
        serializer = StatusInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        message = send_message(pk, request.user, data["note"], request, data)
        return Response(
            StatusSerializer(PatientStatusUpdate.objects.get(message=message)).data, status=201
        )


class ScheduleView(IdempotencyMixin, APIView):
    def get_doctor(self, request, pk, write=False):
        doctor = get_object_or_404(
            User.objects.select_related("organization"),
            pk=pk,
            role=Role.DOCTOR,
            is_active=True,
            organization__active=True,
        )
        user = request.user
        allowed = (
            (
                user.role == Role.COORDINATOR
                and user.organization.territory_id == doctor.organization.territory_id
            )
            or (not write and user.role == Role.DOCTOR and user.pk == doctor.pk)
            or (
                not write
                and user.role == Role.PATIENT
                and doctor.patientassignment_set.filter(
                    patient_id=user.patient_id,
                    valid_to__isnull=True,
                    valid_from__lte=timezone.now(),
                ).exists()
            )
        )
        if not allowed:
            raise PermissionDenied()
        return doctor

    @extend_schema(responses=ScheduleSerializer)
    def get(self, request, pk):
        doctor = self.get_doctor(request, pk)
        schedule = get_object_or_404(WorkSchedule, doctor=doctor)
        return Response(ScheduleSerializer(schedule).data)

    @extend_schema(request=ScheduleSerializer, responses=ScheduleSerializer)
    def put(self, request, pk):
        doctor = self.get_doctor(request, pk, write=True)
        User.objects.select_for_update().get(pk=doctor.pk)
        schedule = WorkSchedule.objects.filter(doctor=doctor).first()
        serializer = ScheduleSerializer(schedule, data=request.data)
        serializer.is_valid(raise_exception=True)
        expected_version = serializer.validated_data.pop("version")
        if expected_version != (schedule.version if schedule else 0):
            raise Conflict("Ish jadvali o‘zgargan. Yangilangan jadvalni olib, qayta tekshiring.")
        obj = serializer.save(
            doctor=doctor,
            organization=doctor.organization,
            version=(schedule.version + 1) if schedule else 1,
        )
        audit(request.user, obj, "WORK_SCHEDULE_SET", request=request)
        return Response(ScheduleSerializer(obj).data)


class UnansweredView(APIView):
    @extend_schema(responses={200: dict})
    def get(self, request):
        require_role(request.user, Role.COORDINATOR)
        territory = request.user.organization.territory_id
        episodes = (
            ResponseEpisode.objects.filter(responded_at__isnull=True)
            .filter(
                Q(
                    conversation__patient__territory_id=territory,
                    conversation__patient__created_by_org__territory_id=territory,
                )
                | Q(conversation__patient__created_by_org_id=request.user.organization_id)
            )
            .select_related("conversation")
            .order_by("first_unanswered_at", "id")
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(episodes, request)
        rows = []
        for episode in page:
            rows.append(
                {
                    "episode_id": episode.id,
                    "conversation_id": episode.conversation_id,
                    "patient_id": episode.conversation.patient_id,
                    "doctor_id": episode.conversation.doctor_id,
                    "first_unanswered_at": episode.first_unanswered_at,
                    "response_due_at": episode.response_due_at,
                    "overdue": bool(
                        episode.response_due_at and timezone.now() > episode.response_due_at
                    ),
                    "schedule_missing": episode.response_due_at is None,
                    "priority": "WORSENED"
                    if episode.conversation.status_updates.filter(
                        self_reported_state="WORSENED", received_at__gte=episode.first_unanswered_at
                    ).exists()
                    else "NORMAL",
                }
            )
        return paginator.get_paginated_response(rows)
