#!/usr/bin/env bash
set -euo pipefail
container_name="draw-steel-rooms-test-$$"
cleanup() { docker rm -f "$container_name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --rm --network none -d --name "$container_name" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
for attempt in {1..30}; do
  # The image starts a temporary server during init. Wait for the final server
  # to become PID 1 so it cannot shut down between readiness and the test.
  if docker exec "$container_name" sh -c '[ "$(cat /proc/1/comm)" = postgres ] && pg_isready -U postgres' >/dev/null 2>&1; then break; fi
  if [[ "$attempt" == 30 ]]; then echo 'Postgres did not start' >&2; exit 1; fi
  sleep 1
done
for file in .scratch/sovmestnaya-igra/prototype/rooms-fixture.sql supabase/migrations/202610230001_create_characters.sql .scratch/sovmestnaya-igra/prototype/rooms-draft.sql .scratch/sovmestnaya-igra/prototype/rooms.sql; do
  docker exec -i "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$file" >/dev/null
done
echo 'Room access integration tests passed.'
