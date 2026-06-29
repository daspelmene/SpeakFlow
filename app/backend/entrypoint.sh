#!/bin/sh
set -e

export PYTHONPATH=${PYTHONPATH:-/app}
cd /app

echo "Running database migrations..."
python -m alembic upgrade head

echo "Starting server..."
exec python -c "
import uvicorn
uvicorn.run('main:app', host='0.0.0.0', port=8000, ws_ping_interval=None, ws_ping_timeout=None)
"
