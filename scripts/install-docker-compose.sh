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
read -p "Enter DeepSeek API key (or press Enter): " deepseek_api_key

if [ -z "$deepseek_api_key" ]; then
    echo -e "\n\nATTENTION: DeepSeek API was not specified !!!"
    echo "-> The key will be set to 'none': There will be NO smart matching and session topic generation"
    echo "-> In 30 seconds the script will continue its execution..."

    deepseek_api_key="none"

    for t in {1..30}; do
        echo -n "."
        sleep 1
    done

    echo -e "\nContinuing executing the script..."
fi

echo "Writing the data..."
cat << EOF > .env
POSTGRES_DB=${pg_db}
POSTGRES_USER=${pg_user}
POSTGRES_PASSWORD=${pg_pass}
JWT_SECRET_KEY=${secret_key}
JWT_ALGORITHM=${algorithm}
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=${access_token_expire_min}
JWT_REFRESH_TOKEN_EXPIRE_DAYS=${refresh_token_expire_days}
DEEPSEEK_API_KEY=${deepseek_api_key}
EOF

echo "Data was successfully written to .env"

echo "Deploying..."
docker compose up --build -d
