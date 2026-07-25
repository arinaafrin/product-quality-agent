#!/usr/bin/env python
"""Command runner for the TimeCapsule backend (Django's manage.py)."""

import os
import sys


def main():
    # DJANGO_SETTINGS_MODULE tells Django which settings file to load.
    # Locally this defaults to "development"; in Docker/production it is
    # overridden by an environment variable (see docker-compose.prod.yml).
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
