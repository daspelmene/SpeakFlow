#!/bin/sh
set -e
export PYTHONPATH=/app
cd /app/backend

echo "Running database migrations..."
python -m alembic upgrade head

echo "Starting server..."
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
