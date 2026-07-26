"""
Celery application used for background jobs — story/image AI generation,
the same role Laravel's queue workers (GenerateStoryJob, GenerateMediaJob)
played in the PHP backend.
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

app = Celery("timecapsule")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
