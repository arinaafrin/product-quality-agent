#!/usr/bin/env bash
# Runs before every container start (web, worker, or beat). Waits for
# Postgres to accept connections, applies migrations, then hands off to
# whatever command the container was started with (gunicorn, celery, etc).
set -euo pipefail

host="${DATABASE_HOST:-db}"
port="${DATABASE_PORT:-5432}"

echo "Waiting for database at ${host}:${port}..."
until python - <<PYEOF
import socket, sys
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(1)
try:
    s.connect(("${host}", ${port}))
except OSError:
    sys.exit(1)
PYEOF
do
    sleep 1
done
echo "Database is up."

echo "Applying database migrations..."
python manage.py migrate --noinput

if [ "${1:-}" = "gunicorn" ]; then
    echo "Collecting static files..."
    python manage.py collectstatic --noinput
fi

exec "$@"
