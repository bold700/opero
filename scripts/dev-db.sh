#!/usr/bin/env bash
# Ensure the local Postgres dev container is running before `pnpm dev`.
# Creates the container if it does not exist, starts it if it is stopped,
# then waits until Postgres accepts connections.
set -euo pipefail

CONTAINER="opero-postgres"
IMAGE="postgres:16"
HOST_PORT="5433"
POSTGRES_USER="opero"
POSTGRES_PASSWORD="opero_dev_pw"
POSTGRES_DB="opero"

if ! docker info >/dev/null 2>&1; then
  echo "docker daemon is not running — start Docker Desktop and retry" >&2
  exit 1
fi

if [ -z "$(docker ps -aq --filter "name=^${CONTAINER}$")" ]; then
  echo "creating ${CONTAINER} (${IMAGE}) on port ${HOST_PORT}..."
  docker run --name "${CONTAINER}" \
    -e "POSTGRES_USER=${POSTGRES_USER}" \
    -e "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" \
    -e "POSTGRES_DB=${POSTGRES_DB}" \
    -p "${HOST_PORT}:5432" \
    -v "${CONTAINER}-data:/var/lib/postgresql/data" \
    -d "${IMAGE}" >/dev/null
elif [ -z "$(docker ps -q --filter "name=^${CONTAINER}$")" ]; then
  echo "starting ${CONTAINER}..."
  docker start "${CONTAINER}" >/dev/null
fi

for _ in $(seq 1 60); do
  if docker exec "${CONTAINER}" pg_isready -U "${POSTGRES_USER}" >/dev/null 2>&1; then
    exit 0
  fi
  sleep 0.5
done

echo "postgres did not become ready in time" >&2
docker logs --tail 20 "${CONTAINER}" >&2 || true
exit 1
