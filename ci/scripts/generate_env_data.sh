#!/usr/bin/env sh

set -euo pipefail

echo "Creating /env..."
mkdir -p /env

echo "Generating data..."

# PostgreSQL data
pg_db="speakflow"
pg_user="admin"
pg_pass=$(head -c 128 /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 32)

# Backend data
algorithm="HS256"
access_token_expire_min="30"
refresh_token_expire_days="1"
secret_key=$(head -c 256 /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 64)

# Tests data
pg_host="postgres"
api_url="http://backend:8000/api/v1"

echo "Writing the data..."
cat << EOF > /env/.env
POSTGRES_DB=${pg_db}
POSTGRES_USER=${pg_user}
POSTGRES_PASSWORD=${pg_pass}
JWT_SECRET_KEY=${secret_key}
JWT_ALGORITHM=${algorithm}
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=${access_token_expire_min}
JWT_REFRESH_TOKEN_EXPIRE_DAYS=${refresh_token_expire_days}
POSTGRES_HOST=${pg_host}
API_BASE_URL=${api_url}
EOF

echo "Data was successfully written to .env"
