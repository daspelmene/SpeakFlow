#!/bin/sh
set -e
export PYTHONPATH=/app
cd /app/app/backend

echo "Running database migrations..."
python -m alembic upgrade head

echo "Starting server..."
exec uvicorn app.backend.main:app --host 0.0.0.0 --port 8000
