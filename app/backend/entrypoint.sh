#!/bin/sh
set -e

export PYTHONPATH=${PYTHONPATH:-/app}
cd /app/backend

echo "Running database migrations..."
python -m alembic upgrade head

if [ "$#" -eq 0 ]; then
    echo "Starting server..."
    exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
else
    echo "Running custom command: $@"
    exec "$@"
fi