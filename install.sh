#!/usr/bin/env bash

set -e

echo "Generating data..."

# PostgreSQL data
pg_db="speakflow"
pg_user="admin"
pg_pass=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)

# Backend data
algorithm="HS256"
access_token_expire_min="30"
refresh_token_expire_days="1"
secret_key=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64)
db_url="postgresql+asyncpg://${pg_user}:${pg_pass}@localhost:5433/speakflow"

echo "Writing the data..."
cat << EOF > .env
POSTGRES_DB=${pg_db}
POSTGRES_USER=${pg_user}
POSTGRES_PASSWORD=${pg_pass}
SECRET_KEY=${secret_key}
ALGORITHM=${algorithm}
ACCESS_TOKEN_EXPIRE_MINUTES=${access_token_expire_min}
REFRESH_TOKEN_EXPIRE_DAYS=${refresh_token_expire_days}
DATABASE_URL=${db_url}
EOF

echo "Data was successfully written to .env"

echo "Deploying..."
docker-compose up --build -d
