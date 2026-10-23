#!/bin/bash
# Runs the schema + rule tests against a throwaway local Postgres 16 (needs btree_gist).
# usage: supabase/tests/run.sh   (as root, uses the postgres system user)
set -e
B=${PGBIN:-/usr/lib/postgresql/16/bin}; D=$(mktemp -d); chown postgres "$D"
HERE=$(cd "$(dirname "$0")" && pwd)
su postgres -c "$B/initdb -D $D/data -A trust >/dev/null && $B/pg_ctl -D $D/data -o '-k $D -p 5497 -c timezone=UTC' -l $D/pg.log start >/dev/null"
sleep 1.5
P="psql -h $D -p 5497 -U postgres -q"
$P -v ON_ERROR_STOP=1 -f "$HERE/harness.sql" 2>/dev/null
$P -v ON_ERROR_STOP=1 -f "$HERE/../migrations/001_beautypass.sql" && echo "schema OK"
$P -f "$HERE/rules.sql" 2>&1 | grep -v 'CONTEXT\|PL/pgSQL\|^SQL statement'
su postgres -c "$B/pg_ctl -D $D/data stop -m fast" >/dev/null; rm -rf "$D"
