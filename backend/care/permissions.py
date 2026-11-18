from rest_framework.permissions import SAFE_METHODS, BasePermission

from .scopes import is_discharge_coordinator


class CoordinatorWritePermission(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.method in SAFE_METHODS or is_discharge_coordinator(request.user)
        )
