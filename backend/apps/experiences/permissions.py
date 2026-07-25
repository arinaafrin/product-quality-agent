from rest_framework.permissions import SAFE_METHODS, BasePermission


class ExperiencePolicy(BasePermission):
    """
    Python port of app/Policies/ExperiencePolicy.php:
    - anyone can read approved experiences
    - only the owner (created_by) or an admin can update/delete
    - only authenticated users can create
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            if obj.status == obj.Status.APPROVED:
                return True
            user = request.user
            return bool(
                user and user.is_authenticated and (user.is_admin or obj.created_by_id == user.id)
            )
        user = request.user
        return bool(
            user and user.is_authenticated and (user.is_admin or obj.created_by_id == user.id)
        )
