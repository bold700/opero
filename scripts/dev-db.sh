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

# A local PostgreSQL installation can be used on Windows when Docker Desktop
# is unavailable. Keep its data outside the repository and start it on demand.
if [ -n "${LOCALAPPDATA:-}" ] && command -v cygpath >/dev/null 2>&1; then
  LOCAL_DB_ROOT="$(cygpath -u "$LOCALAPPDATA")/OperoDev"
  PG_BIN="${LOCAL_DB_ROOT}/PostgreSQL16/pgsql/bin"
  PG_DATA="${LOCAL_DB_ROOT}/pgdata"
  if [ -x "${PG_BIN}/pg_ctl.exe" ] && [ -d "${PG_DATA}" ]; then
    if ! "${PG_BIN}/pg_isready.exe" -h 127.0.0.1 -p "${HOST_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
      echo "starting local PostgreSQL on port ${HOST_PORT}..."
      "${PG_BIN}/pg_ctl.exe" -D "${PG_DATA}" -l "${LOCAL_DB_ROOT}/postgres.log" -o "-p ${HOST_PORT} -h 127.0.0.1" -w start
    fi
    "${PG_BIN}/pg_isready.exe" -h 127.0.0.1 -p "${HOST_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null
    exit 0
  fi
fi

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
