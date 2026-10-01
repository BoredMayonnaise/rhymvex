#!/usr/bin/env bash
# End-to-end verification of the properties the brief calls for.
# Requires: the dev server running, and the database migrated + seeded.
#   npm run db:up && npm run db:migrate && npm run db:seed
#   npm run dev
#   bash scripts/verify.sh
set -uo pipefail

BASE="${BASE:-http://localhost:3000}"
export PGPASSWORD=rhymvex_dev
PSQL=(timeout 20 psql -h localhost -p 5435 -U rhymvex -d rhymvex -t -A -q -c)

pass=0; fail=0
ok()   { printf "  \033[32mPASS\033[0m  %s\n" "$1"; pass=$((pass+1)); }
bad()  { printf "  \033[31mFAIL\033[0m  %s\n" "$1"; fail=$((fail+1)); }
check(){ if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1 (got '$2', want '$3')"; fi; }

# First line only, so a RETURNING query's "INSERT 0 1" trailer is dropped.
q() { "${PSQL[@]}" "$1" 2>/dev/null | head -1; }
# Keeps stderr: a refused statement reports the reason there, and discarding it
# would make a correct refusal indistinguishable from a permitted one.
qerr() { "${PSQL[@]}" "$1" 2>&1; }

# Count occurrences of $2 in $1.
contains() { printf '%s' "$1" | grep -c -- "$2" || true; }
code() { timeout 25 curl -s -o /dev/null -w "%{http_code}" "${@:2}" "$BASE$1"; }
html() { timeout 25 curl -s "${@:2}" "$BASE$1"; }

# ---------------------------------------------------------------- sessions
cat > lib/db/_verify_sessions.ts <<'TS'
import "../env";
import { query, queryOne } from "@/lib/db/client";
import { createStaffSession, createClientSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";

async function ensurePortalUser(email: string, clientRef: string, name: string) {
  const client = await queryOne<{ id: string }>(
    "SELECT id FROM clients WHERE reference = $1", [clientRef]);
  if (!client) return null;
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM client_users WHERE email = $1", [email]);
  const id = existing
    ? existing.id
    : (await query<{ id: string }>(
        `INSERT INTO client_users (client_id, email, name, password_hash)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [client.id, email, name, await hashPassword("PortalVerify1234")]))[0]?.id;
  return id ?? null;
}

async function main() {
  const s = await queryOne<{ id: string }>(
    "SELECT id FROM staff WHERE email = 'sam@rhymvex.com'");
  if (s) {
    console.log("STAFF=" + (await createStaffSession(s.id, { ipAddress: "127.0.0.1" })).cookieValue);
  }
  const a = await ensurePortalUser("rina@harbourlight.test", "CLI-DEMO01", "Rina Sato");
  if (a) console.log("CLIENT_A=" + (await createClientSession(a, { ipAddress: "127.0.0.1" })).cookieValue);
  const b = await ensurePortalUser("tom@northline.test", "CLI-DEMO02", "Tom Vance");
  if (b) console.log("CLIENT_B=" + (await createClientSession(b, { ipAddress: "127.0.0.1" })).cookieValue);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
TS
npx tsx --tsconfig tsconfig.json lib/db/_verify_sessions.ts 2>/dev/null | grep -E "^(STAFF|CLIENT_A|CLIENT_B)=" > /tmp/verify_ck.txt
rm -f lib/db/_verify_sessions.ts

SC="rv_staff_session=$(grep '^STAFF='      /tmp/verify_ck.txt | cut -d= -f2-)"
CA="rv_client_session=$(grep '^CLIENT_A=' /tmp/verify_ck.txt | cut -d= -f2-)"
CB="rv_client_session=$(grep '^CLIENT_B=' /tmp/verify_ck.txt | cut -d= -f2-)"

if [ -z "${SC#rv_staff_session=}" ]; then bad "could not create a staff session"; echo; exit 1; fi
if [ -z "${CA#rv_client_session=}" ]; then bad "could not create a client session"; echo; exit 1; fi

echo
echo "=== 1. Authentication is required ==="
check "anonymous /admin redirects"                "$(code /admin)"                          307
check "anonymous /admin/leads redirects"          "$(code /admin/leads)"                   307
check "anonymous /portal redirects"               "$(code /portal)"                        307
check "anonymous /portal/invoices redirects"      "$(code /portal/invoices)"               307
check "client cookie cannot open /admin"          "$(code /admin -H "Cookie: $CA")"        307
check "staff cookie cannot open /portal"          "$(code /portal -H "Cookie: $SC")"       307
check "forged cookie rejected"                    "$(code /admin -H "Cookie: rv_staff_session=forged.sig")" 307

echo
echo "=== 2. Session types do not cross over ==="
check "staff session opens /admin"                "$(code /admin -H "Cookie: $SC")"        200
check "client session opens /portal"              "$(code /portal -H "Cookie: $CA")"       200
check "client A opens /portal/invoices"           "$(code /portal/invoices -H "Cookie: $CA")" 200

echo
echo "=== 3. Tenant isolation ==="
APROJ=$(q "SELECT id FROM projects ORDER BY created_at LIMIT 1")
NORTH=$(q "SELECT id FROM clients WHERE reference = 'CLI-DEMO02'")
BPROJ=$(q "INSERT INTO projects (client_id, name, status) VALUES ('$NORTH','Northline Rebrand','IN_PROGRESS') RETURNING id")
check "client A opens its own project"            "$(code /portal/projects/$APROJ -H "Cookie: $CA")" 200
check "client B opens its own project"            "$(code /portal/projects/$BPROJ -H "Cookie: $CB")" 200
check "client A blocked from B's project"         "$(code /portal/projects/$BPROJ -H "Cookie: $CA")" 404
check "unknown project id is 404"                 "$(code /portal/projects/00000000-0000-0000-0000-000000000000 -H "Cookie: $CA")" 404
check "non-uuid project id is 404"                "$(code /portal/projects/1-or-1--x -H "Cookie: $CA")" 404
q "DELETE FROM projects WHERE id = '$BPROJ'" >/dev/null

echo
echo "=== 4. Internal data never reaches the portal ==="
PORTAL_HTML=$(html /portal -H "Cookie: $CA")
for needle in lead_notes "Internal notes" audit_log actor_type staff_invite; do
  n=$(printf '%s' "$PORTAL_HTML" | grep -c -- "$needle")
  check "portal HTML omits '$needle'" "$n" 0
done
check "internal emails marked not client-visible" \
      "$(q "SELECT count(*) FROM email_messages WHERE client_visible = false AND client_id IS NOT NULL")" 0

echo
echo "=== 5. Public site: intake, not mailto ==="
# The intake page may show the contact address as an alternative to the form.
# What must not exist is a mailto *workflow* - a prefilled body, or a CTA that
# opens a mail client instead of posting to the backend.
n=$(html /intake | grep -cE 'mailto:[^"]*\?subject=|mailto:[^"]*\?body=' || true)
check "no prefilled mailto workflow on /intake" "$n" 0
# The form submits with fetch from a client component, so the endpoint string
# lives in a lazily-loaded chunk rather than the server-rendered HTML. Assert
# the form renders its real fields, and that the endpoint accepts a submission.
form=$(html /intake)
for f in 'name="name"' 'name="email"' 'name="situation"' 'name="message"'; do
  n=$(printf '%s' "$form" | grep -c -- "$f")
  check "intake form renders $f" "$n" 1
done
live=$(timeout 25 curl -s -X POST "$BASE/api/intake" -H 'Content-Type: application/json' \
  -H "X-Forwarded-For: 198.51.100.200" \
  -d "{\"name\":\"Verify Probe\",\"email\":\"verify@probe.test\",\"situation\":\"Something specific\",\"message\":\"checking the intake endpoint end to end\",\"startedAt\":$(( $(date +%s) * 1000 - 20000 ))}")
if printf '%s' "$live" | grep -q '"ok":true'; then
  ok "POST /api/intake accepts a real submission"
else
  bad "POST /api/intake rejected a valid submission: $live"
fi
n=$(html / | grep -o 'href="/intake"' | wc -l | tr -d ' ')
if [ "$n" -gt 0 ]; then ok "primary CTAs point at /intake ($n)"; else bad "no /intake links on the home page"; fi
n=$(html / | grep -c 'mailto:' )
if [ "$n" -le 1 ]; then ok "home page has at most the footer address ($n mailto)"; else bad "home page still has $n mailto links"; fi

echo
echo "=== 6. Audit log is immutable in the database ==="
# `pipefail` is on, and psql exits non-zero precisely because it refused the
# statement, which would fail the pipeline even on a match. Capture, then match.
out=$(qerr "UPDATE audit_log SET action = 'tampered'")
if printf '%s' "$out" | grep -q "append-only"; then
  ok "UPDATE on audit_log refused by the database"
else
  bad "UPDATE on audit_log was allowed"
fi
out=$(qerr "DELETE FROM audit_log")
if printf '%s' "$out" | grep -q "append-only"; then
  ok "DELETE on audit_log refused by the database"
else
  bad "DELETE on audit_log was allowed"
fi

echo
echo "=== 7. Invitation tokens ==="
check "no raw token column exists" \
      "$(q "SELECT count(*) FROM information_schema.columns WHERE table_name='invitations' AND column_name='token'")" 0
check "stored hashes are 64 hex chars" \
      "$(q "SELECT count(*) FROM invitations WHERE token_hash !~ '^[0-9a-f]{64}$'")" 0
check "no client email contains an admin URL" \
      "$(q "SELECT count(*) FROM email_outbox WHERE kind='CLIENT_CONFIRMATION' AND (body_text LIKE '%/admin/%' OR body_html LIKE '%/admin/%')")" 0
check "internal notifications do carry the workspace link" \
      "$(q "SELECT count(*) FROM email_outbox WHERE kind='INTERNAL_NOTIFICATION' AND body_text LIKE '%/admin/leads/%'")" \
      "$(q "SELECT count(*) FROM email_outbox WHERE kind='INTERNAL_NOTIFICATION'")"

echo
echo "=== 8. Leads are not auto-converted to clients ==="
check "no client points at an unlinked lead" \
      "$(q "SELECT count(*) FROM clients c JOIN leads l ON l.id = c.lead_id WHERE l.client_id IS DISTINCT FROM c.id")" 0
check "one client per originating lead" \
      "$(q "SELECT count(*) FROM (SELECT lead_id FROM clients WHERE lead_id IS NOT NULL GROUP BY lead_id HAVING count(*) > 1) d")" 0
check "converted leads are all WON" \
      "$(q "SELECT count(*) FROM clients c JOIN leads l ON l.id = c.lead_id WHERE l.status <> 'WON'")" 0

echo
echo "=== 9. Spam is absorbed rather than announced ==="
# A fresh address per run, so the per-IP rate limit cannot turn this into a 429.
PROBE_IP="198.51.100.$(( (RANDOM % 200) + 20 ))"
started=$(( $(date +%s) * 1000 - 20000 ))
honey=$(timeout 25 curl -s -X POST "$BASE/api/intake" -H 'Content-Type: application/json' \
  -H "X-Forwarded-For: $PROBE_IP" \
  -d "{\"name\":\"CSRF probe\",\"email\":\"csrf@probe.test\",\"situation\":\"Something specific\",\"message\":\"this is long enough to pass validation\",\"website_confirm\":\"bot\",\"startedAt\":$started}")
check "honeypot returns a decoy success" "$(contains "$honey" '"ok":true')" 1
check "honeypot returns no error detail" "$(contains "$honey" '"ok":false')" 0
check "honeypot created no lead" \
  "$(q "SELECT count(*) FROM leads WHERE email = 'csrf@probe.test'")" 0
q "DELETE FROM rate_limit_buckets WHERE bucket_key = 'intake:$PROBE_IP'" >/dev/null

echo
printf "  %d passed, %d failed\n\n" "$pass" "$fail"
[ "$fail" -eq 0 ]
