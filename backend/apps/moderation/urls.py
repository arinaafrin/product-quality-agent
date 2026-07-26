from django.urls import path

from . import views

urlpatterns = [
    path("moderation/queue", views.ModerationQueueView.as_view(), name="moderation-queue"),
    path(
        "moderation/<uuid:experience_id>/approve",
        views.ApproveView.as_view(),
        name="moderation-approve",
    ),
    path(
        "moderation/<uuid:experience_id>/reject",
        views.RejectView.as_view(),
        name="moderation-reject",
    ),
    path(
        "moderation/<uuid:experience_id>/comment",
        views.CommentView.as_view(),
        name="moderation-comment",
    ),
    path(
        "moderation/<uuid:experience_id>/logs",
        views.ModerationLogListView.as_view(),
        name="moderation-logs",
    ),
    path("admin/stats", views.AdminStatsView.as_view(), name="admin-stats"),
]
