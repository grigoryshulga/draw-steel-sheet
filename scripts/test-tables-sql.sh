#!/usr/bin/env bash
# Always creates a fresh container; never accepts a connection URL or cloud credentials.
set -euo pipefail
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container_name="dss-tables-test-${RANDOM}-$$"
cleanup() { docker rm -f "$container_name" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
docker run --rm -d --name "$container_name" -e POSTGRES_PASSWORD=disposable-only postgres:17-alpine >/dev/null
for attempt in {1..60}; do
  if docker exec "$container_name" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  if [[ "$attempt" = 60 ]]; then echo 'Disposable Postgres did not become ready' >&2; exit 1; fi
  sleep 0.5
done
psql_local() { docker exec -i "$container_name" psql -X -U postgres -v ON_ERROR_STOP=1 "$@"; }
psql_local <<'SQL'
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
create publication supabase_realtime;
SQL
psql_local < "$root_dir/supabase/migrations/202610230001_create_characters.sql"
psql_local < "$root_dir/supabase/migrations/202611070001_create_tables.sql"
psql_local < "$root_dir/supabase/migrations/202611070003_start_scene_in_place.sql"
psql_local < "$root_dir/tests/sql/tables-fixture.sql"
has_revision_rpc=0
if [[ -f "$root_dir/supabase/migrations/202611070002_character_revisions.sql" ]]; then
  has_revision_rpc=1
  # The avatar migration normally supplies this column; Storage is outside this fixture.
  psql_local -c 'alter table public.characters add column if not exists avatar_url text;' >/dev/null
  psql_local < "$root_dir/supabase/migrations/202611070002_character_revisions.sql"
fi
# True competing transactions: same expectedRevision can commit only once.
table_id="$(psql_local -Atc "select id from table_backend.tables where name='Concurrency';")"
revision="$(psql_local -Atc "select revision from table_backend.tables where id='$table_id';")"
log_dir="$(mktemp -d)"
trap 'rm -rf "$log_dir"; cleanup' EXIT INT TERM
run_racer() {
  psql_local >"$log_dir/$1" 2>&1 <<SQL
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.table_command('$table_id','{"type":"rename","payload":{"name":"Racer $1"},"operationId":"race-$1","expectedRevision":$revision}');
SQL
}
run_racer one & first_pid=$!
run_racer two & second_pid=$!
first_status=0; wait "$first_pid" || first_status=$?
second_status=0; wait "$second_pid" || second_status=$?
if [[ "$first_status" = 0 && "$second_status" = 0 ]] || [[ "$first_status" != 0 && "$second_status" != 0 ]]; then
  cat "$log_dir/one" "$log_dir/two" >&2
  echo 'Exactly one conflicting command must succeed' >&2; exit 1
fi
psql_local -Atc "select public.test_assert(revision=$revision+1,'concurrent revision lock') from table_backend.tables where id='$table_id';"
# Same operation ID racing to accept one gift must succeed twice but deliver once.
gift_id="$(psql_local -Atc "select id from table_backend.tables where name='Concurrent gift';")"
gift_revision="$(psql_local -Atc "select revision from table_backend.tables where id='$gift_id';")"
offer_id="$(psql_local -Atc "select offers->0->>'id' from table_backend.tables where id='$gift_id';")"
item_count="$(psql_local -Atc "select jsonb_array_length(document->'inventory') from public.characters where user_id='00000000-0000-0000-0000-000000000002' and id='a';")"
old_stamp="$(psql_local -Atc "select updated_at from public.characters where user_id='00000000-0000-0000-0000-000000000002' and id='a';")"
run_accept() {
  psql_local >"$log_dir/accept-$1" 2>&1 <<SQL
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.table_command('$gift_id','{"type":"answer-offer","payload":{"offerId":"$offer_id","accept":true,"version":1},"operationId":"race-accept-gift","expectedRevision":$gift_revision}');
SQL
}
run_accept one & first_pid=$!
run_accept two & second_pid=$!
first_status=0; wait "$first_pid" || first_status=$?
second_status=0; wait "$second_pid" || second_status=$?
if [[ "$first_status" != 0 || "$second_status" != 0 ]]; then
  cat "$log_dir/accept-one" "$log_dir/accept-two" >&2; exit 1
fi
psql_local -Atc "select public.test_assert(jsonb_array_length(document->'inventory')=$item_count+1,'concurrent offer delivered once') from public.characters where user_id='00000000-0000-0000-0000-000000000002' and id='a';"
psql_local -Atc "select public.test_assert(offers#>>'{0,status}'='accepted' and offers#>>'{0,version}'='2','concurrent offer version') from table_backend.tables where id='$gift_id';"
if [[ "$has_revision_rpc" = 1 ]]; then
  psql_local <<SQL
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.test_denied(format('select public.character_save(%L,%L::timestamptz)','{"id":"a","name":"Stale autosave","inventory":[]}', '$old_stamp'),'PT409');
select public.test_denied('update public.characters set document=''{}''','42501');
SQL
fi
echo 'Disposable Postgres tables assertions passed; container removed on exit.'
