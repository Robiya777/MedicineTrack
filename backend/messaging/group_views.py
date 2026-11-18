from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from common.idempotency import IdempotencyMixin

from .groups import (
    available_doctors,
    can_manage_team,
    change_team,
    team_metadata,
    visible_team_patient,
)


class TeamDoctorSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)
    online = serializers.BooleanField(read_only=True)
    primary = serializers.BooleanField(read_only=True)


class TeamOutput(serializers.Serializer):
    members = TeamDoctorSerializer(many=True, read_only=True)
    available = TeamDoctorSerializer(many=True, read_only=True)
    can_manage = serializers.BooleanField(read_only=True)


class TeamInput(serializers.Serializer):
    doctor = serializers.UUIDField()
    action = serializers.ChoiceField(choices=["ADD", "REMOVE"])


class PatientChatTeamView(IdempotencyMixin, APIView):
    def check_idempotency_scope(self, request, *args, **kwargs):
        visible_team_patient(request.user, kwargs["pk"], write=True)

    def result(self, request, pk):
        patient = visible_team_patient(request.user, pk)
        members = team_metadata(pk)
        manage = can_manage_team(request.user, patient)
        ids = {row["id"] for row in members}
        available = (
            [
                {
                    "id": str(doctor.pk),
                    "name": doctor.get_full_name() or doctor.username,
                    "online": False,
                    "primary": False,
                }
                for doctor in available_doctors(patient)
                if str(doctor.pk) not in ids
            ]
            if manage
            else []
        )
        return Response({"members": members, "available": available, "can_manage": manage})

    @extend_schema(responses=TeamOutput)
    def get(self, request, pk):
        return self.result(request, pk)

    @extend_schema(request=TeamInput, responses=TeamOutput)
    def post(self, request, pk):
        data = TeamInput(data=request.data)
        data.is_valid(raise_exception=True)
        change_team(
            request.user, pk, data.validated_data["doctor"], data.validated_data["action"], request
        )
        return self.result(request, pk)
