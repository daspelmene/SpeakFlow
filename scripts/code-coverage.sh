#!/usr/bin/env bash

# Cleanup the containers and coverage data
docker compose \
  -f docker-compose.yml \
  -f docker-compose.coverage.yml \
  down

rm -rf coverage
mkdir -p coverage

# Start PostgreSQL and the backend with coverage enabled
docker compose \
  -f docker-compose.yml \
  -f docker-compose.coverage.yml \
  up -d --build postgres backend

# Run the tests
docker compose \
  -f docker-compose.yml \
  -f docker-compose.coverage.yml \
  run --rm tests

# Stop the backend to flush coverage data
docker compose \
  -f docker-compose.yml \
  -f docker-compose.coverage.yml \
  stop backend

# Display the coverage summary
docker compose \
  -f docker-compose.yml \
  -f docker-compose.coverage.yml \
  run --rm --no-deps --entrypoint coverage backend \
  report --rcfile=/app/.coveragerc -m

# Generate coverage report HTML
docker compose \
  -f docker-compose.yml \
  -f docker-compose.coverage.yml \
  run --rm --no-deps --entrypoint coverage backend \
  html --rcfile=/app/.coveragerc -d /coverage/htmlcov
