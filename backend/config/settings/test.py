"""
Settings used by pytest / CI: fast in-memory SQLite DB, synchronous Celery
(no broker needed), password hashing turned down for speed.
"""

from .base import *  # noqa: F401,F403

DEBUG = False
SECRET_KEY = "test-secret-key"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Run Celery tasks eagerly (inline, no worker/broker) so tests don't need Redis.
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

MEDIA_ROOT = "/tmp/timecapsule-test-media"  # noqa: S108

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
