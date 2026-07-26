from rest_framework.permissions import BasePermission


class HasRole(BasePermission):
    """
    Equivalent of Laravel's `role:partner,admin` route middleware.
    Usage: permission_classes = [HasRole.for_roles("admin")]
    """

    roles: tuple[str, ...] = ()

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.role in self.roles
        )

    @classmethod
    def for_roles(cls, *roles: str):
        return type(f"HasRole_{'_'.join(roles)}", (cls,), {"roles": roles})


class IsAdmin(HasRole):
    roles = ("admin",)


class IsPartnerOrAdmin(HasRole):
    roles = ("partner", "admin")


class IsOwnerOrAdmin(BasePermission):
    """Object-level check: the creator of a resource, or an admin, may edit/delete it."""

    owner_field = "created_by"

    def has_object_permission(self, request, view, obj):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role == "admin":
            return True
        return getattr(obj, self.owner_field, None) == user
