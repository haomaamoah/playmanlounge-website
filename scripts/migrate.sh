#!/usr/bin/env bash
set -euo pipefail
if [[ "${APPLY_DB_MIGRATIONS:-}" != "1" || -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Select and confirm the target project, then set APPLY_DB_MIGRATIONS=1 and SUPABASE_DB_URL."
  exit 1
fi
command -v psql >/dev/null || { echo "Install PostgreSQL client tools (psql) first."; exit 1; }
export PGDATABASE="$SUPABASE_DB_URL"
psql -X -v ON_ERROR_STOP=1 <<'SQL'
begin;
select pg_advisory_xact_lock(202610090001);
create schema if not exists app_migrations;
create table if not exists app_migrations.versions(version text primary key, applied_at timestamptz not null default now());
select not exists(select 1 from app_migrations.versions where version='202610090001') as apply \gset
\if :apply
\i supabase/migrations/202610090001_backend.sql
insert into app_migrations.versions(version) values('202610090001');
\endif
select not exists(select 1 from app_migrations.versions where version='202610090002') as apply2 \gset
\if :apply2
\i supabase/migrations/202610090002_email_thumbnails.sql
insert into app_migrations.versions(version) values('202610090002');
\endif
select not exists(select 1 from app_migrations.versions where version='202610090003') as apply3 \gset
\if :apply3
\i supabase/migrations/202610090003_delivery_and_attempts.sql
insert into app_migrations.versions(version) values('202610090003');
\endif
commit;
SQL
