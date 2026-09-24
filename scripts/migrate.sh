#!/bin/sh

set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
MIGRATIONS_DIR="$PROJECT_ROOT/database/migrations"
CONTAINER_NAME="matcha_postgres"

if ! docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "PostgreSQL container does not exist."
  echo "Run: docker compose up -d"
  exit 1
fi

if ! docker exec "$CONTAINER_NAME" true >/dev/null 2>&1; then
  echo "PostgreSQL container is not running."
  echo "Run: docker compose up -d"
  exit 1
fi

docker exec "$CONTAINER_NAME" sh -c '
  psql \
    -X \
    -v ON_ERROR_STOP=1 \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -c "
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL
          DEFAULT CURRENT_TIMESTAMP
      );
    "
'

for migration in "$MIGRATIONS_DIR"/*.sql; do
  if [ ! -f "$migration" ]; then
    echo "No migration files found."
    exit 1
  fi

  filename=$(basename "$migration")

  case "$filename" in
    *[!a-zA-Z0-9._-]*)
      echo "Unsafe migration filename: $filename"
      exit 1
      ;;
  esac

  check_sql="
    SELECT EXISTS (
      SELECT 1
      FROM schema_migrations
      WHERE filename = '$filename'
    );
  "

  already_applied=$(
    docker exec "$CONTAINER_NAME" sh -c '
      psql \
        -X \
        -tA \
        -v ON_ERROR_STOP=1 \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        -c "$1"
    ' sh "$check_sql"
  )

  if [ "$already_applied" = "t" ]; then
    echo "Already applied: $filename"
    continue
  fi

  echo "Applying: $filename"

  docker exec -i "$CONTAINER_NAME" sh -c '
    psql \
      -X \
      -v ON_ERROR_STOP=1 \
      -1 \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB"
  ' < "$migration"

  record_sql="
    INSERT INTO schema_migrations (filename)
    VALUES ('$filename');
  "

  docker exec "$CONTAINER_NAME" sh -c '
    psql \
      -X \
      -v ON_ERROR_STOP=1 \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" \
      -c "$1"
  ' sh "$record_sql"
done

echo "Database migrations are up to date."