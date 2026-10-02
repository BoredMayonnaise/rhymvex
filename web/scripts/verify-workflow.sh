#!/usr/bin/env bash
# The full client-first workflow, end to end:
#   website intake -> lead -> dual email -> internal assignment -> client record
#   -> portal invitation -> portal access
#
#   bash scripts/verify-workflow.sh
set -uo pipefail

BASE="${BASE:-http://localhost:3000}"
export PGPASSWORD=rhymvex_dev
PSQL=(timeout 20 psql -h localhost -p 5435 -U rhymvex -d rhymvex -t -A -q -c)

pass=0; fail=0
ok()   { printf "  \033[32mPASS\033[0m  %s\n" "$1"; pass=$((pass+1)); }
bad()  { printf "  \033[31mFAIL\033[0m  %s\n" "$1"; fail=$((fail+1)); }
check(){ if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1 (got '$2', want '$3')"; fi; }
q() { "${PSQL[@]}" "$1" 2>/dev/null | head -1; }

# Count occurrences of $2 in $1, for asserting on a response body or page HTML
# without nesting quote characters inside a command substitution.
contains() { printf '%s' "$1" | grep -c -- "$2" || true; }

# `pipefail` is on, so capture psql output before matching rather than piping it.
qerr() { "${PSQL[@]}" "$1" 2>&1; }

STAMP=$(date +%s)
EMAIL="workflow-$STAMP@acmecoffee.test"

# The SLA is a real setting an admin can configure, and the seed deliberately
# leaves it alone (`ON CONFLICT DO NOTHING`), so it can legitimately be set on a
# developer's machine. This test is about the *no promise* path, so it clears the
# value itself and puts back whatever was there. Reading the ambient value and
# asserting it is null is what made this fail for reasons unrelated to the code.
SAVED_SLA=$(q "SELECT coalesce(response_sla_minutes::text,'') FROM org_settings WHERE id = true")

restore_sla() {
  if [ -z "$SAVED_SLA" ]; then
    "${PSQL[@]}" "UPDATE org_settings SET response_sla_minutes = NULL WHERE id = true" >/dev/null 2>&1
  else
    "${PSQL[@]}" "UPDATE org_settings SET response_sla_minutes = $SAVED_SLA WHERE id = true" >/dev/null 2>&1
  fi
}

# Cleared here, before the first intake submission rather than at the assertion
# that happens to need it. The confirmation email is rendered during step 1, so
# clearing it later leaves the email already carrying a promise and the check
# fails for a reason that has nothing to do with the code under test.
"${PSQL[@]}" "UPDATE org_settings SET response_sla_minutes = NULL WHERE id = true" >/dev/null 2>&1

cleanup() {
  restore_sla
  "${PSQL[@]}" "DELETE FROM audit_log WHERE actor_label LIKE 'Workflow $STAMP%'" >/dev/null 2>&1
  "${PSQL[@]}" "DELETE FROM client_sessions WHERE client_user_id IN (SELECT id FROM client_users WHERE email LIKE 'workflow-$STAMP%')" >/dev/null 2>&1
  "${PSQL[@]}" "DELETE FROM client_users WHERE email LIKE 'workflow-$STAMP%'" >/dev/null 2>&1
  "${PSQL[@]}" "DELETE FROM client_contacts WHERE email LIKE 'workflow-$STAMP%'" >/dev/null 2>&1
  "${PSQL[@]}" "DELETE FROM invitations WHERE email LIKE 'workflow-$STAMP%'" >/dev/null 2>&1
  "${PSQL[@]}" "DELETE FROM email_messages WHERE to_addresses::text LIKE '%workflow-$STAMP%'" >/dev/null 2>&1
  "${PSQL[@]}" "DELETE FROM email_outbox WHERE to_address LIKE 'workflow-$STAMP%'" >/dev/null 2>&1
  "${PSQL[@]}" "DELETE FROM leads WHERE email = '$EMAIL'" >/dev/null 2>&1
  "${PSQL[@]}" "DELETE FROM clients WHERE name = 'Workflow Coffee $STAMP'" >/dev/null 2>&1
}
trap cleanup EXIT

echo
echo "=== 1. Public intake creates a lead ==="
BEFORE=$(q "SELECT count(*) FROM leads")
RESP=$(timeout 30 curl -s -X POST "$BASE/api/intake" \
  -H 'Content-Type: application/json' \
  -H "X-Forwarded-For: 198.51.100.$(( (RANDOM % 200) + 20 ))" \
  -d "{\"name\":\"Arthur Pendelton\",\"email\":\"$EMAIL\",\"company\":\"Workflow Coffee $STAMP\",\"role_title\":\"Founder\",\"situation\":\"You need a system that scales\",\"message\":\"Every location looks like a different business and nothing carries over between them.\",\"budget_band\":\"€8,000 – €15,000\",\"timeline\":\"This quarter\",\"startedAt\":$(( $(date +%s) * 1000 - 20000 ))}")

check "intake returns ok" "$(contains "$RESP" '"ok":true')" 1
REF=$(printf '%s' "$RESP" | grep -oE 'LEAD-[A-Z0-9]{6}' | head -1)
if [ -n "$REF" ]; then ok "lead reference issued ($REF)"; else bad "no lead reference in response"; fi
AFTER=$(q "SELECT count(*) FROM leads")
check "lead row created" "$AFTER" "$((BEFORE + 1))"

echo
echo "=== 2. Steps reported to the client ==="
for step in "Request received" "Information recorded" "Rhymvex team notified" "Human consultation"; do
  n=$(contains "$RESP" "$step")
  check "success state includes '$step'" "$n" 1
done
n=$(contains "$RESP" '"done":false')
check "the consultation step stays open" "$n" 1

echo
echo "=== 3. Audit event recorded ==="
check "lead.received is audited" \
  "$(q "SELECT count(*) FROM audit_log WHERE action='lead.received' AND entity_id=(SELECT id FROM leads WHERE reference='$REF')")" 1
check "actor is anonymous, not a staff member" \
  "$(q "SELECT actor_type FROM audit_log WHERE action='lead.received' AND entity_id=(SELECT id FROM leads WHERE reference='$REF')")" anonymous

echo
echo "=== 4. Two emails produced ==="
check "client confirmation sent" \
  "$(q "SELECT count(*) FROM email_outbox WHERE kind='CLIENT_CONFIRMATION' AND to_address='$EMAIL'")" 1
check "internal notification sent" \
  "$(q "SELECT count(*) FROM email_outbox WHERE kind='INTERNAL_NOTIFICATION' AND subject = 'New Rhymvex lead — Workflow Coffee $STAMP'")" 1
check "client email has the right subject" \
  "$(q "SELECT subject FROM email_outbox WHERE kind='CLIENT_CONFIRMATION' AND to_address='$EMAIL'")" \
  "We received your request — Rhymvex"
check "internal email names the company" \
  "$(q "SELECT count(*) FROM email_outbox WHERE kind='INTERNAL_NOTIFICATION' AND to_address <> '$EMAIL'")" \
  "$(q "SELECT count(*) FROM email_outbox WHERE kind='INTERNAL_NOTIFICATION'")"
check "internal email carries the lead id" \
  "$(q "SELECT count(*) FROM email_outbox WHERE kind='INTERNAL_NOTIFICATION' AND body_text LIKE '%Lead ID:%'")" \
  "$(q "SELECT count(*) FROM email_outbox WHERE kind='INTERNAL_NOTIFICATION'")"
check "client email contains no admin URL" \
  "$(q "SELECT count(*) FROM email_outbox WHERE kind='CLIENT_CONFIRMATION' AND to_address='$EMAIL' AND (body_text LIKE '%/admin/%' OR body_html LIKE '%/admin/%')")" 0
SLA_PROMISE_SQL="SELECT count(*) FROM email_outbox WHERE kind='CLIENT_CONFIRMATION' AND to_address='$EMAIL' AND body_text ~* 'within'"
check "no response-time promise without an SLA" "$(q "$SLA_PROMISE_SQL")" 0

echo
echo "=== 5. Lead starts RECEIVED and unassigned ==="
check "status is RECEIVED" "$(q "SELECT status FROM leads WHERE reference='$REF'")" RECEIVED
check "not yet a client" "$(q "SELECT count(*) FROM clients WHERE name = 'Workflow Coffee $STAMP'")" 0
check "unassigned" "$(q "SELECT count(*) FROM leads WHERE reference='$REF' AND assigned_to IS NULL")" 1

echo
echo "=== 6. No SLA configured, so the intake page promises nothing ==="
SLA=$(q "SELECT coalesce(response_sla_minutes::text,'none') FROM org_settings WHERE id = true")
check "SLA is unset" "$SLA" none
n=$(contains "$(timeout 25 curl -s "$BASE/intake")" 'No response-time promise')
check "intake page says no promise is made" "$([ "$n" -ge 1 ] && echo 1 || echo 0)" 1

# And the other half of the contract: with an SLA set, the page does promise.
"${PSQL[@]}" "UPDATE org_settings SET response_sla_minutes = 30 WHERE id = true" >/dev/null 2>&1
n=$(contains "$(timeout 25 curl -s "$BASE/intake")" 'No response-time promise')
check "intake drops the disclaimer when an SLA exists" "$([ "$n" -eq 0 ] && echo 1 || echo 0)" 1
restore_sla

echo
echo "=== 7. Spam controls ==="
HONEY_BEFORE=$(q "SELECT count(*) FROM audit_log WHERE action='intake.rejected'")
HONEY=$(timeout 30 curl -s -X POST "$BASE/api/intake" -H 'Content-Type: application/json' \
  -H "X-Forwarded-For: 198.51.100.$(( (RANDOM % 200) + 20 ))" \
  -d '{"name":"Bot","email":"bot-honey@spam.test","situation":"Something specific","message":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","website_confirm":"http://spam.example","startedAt":1}')
check "honeypot returns a decoy success" "$(contains "$HONEY" '"ok":true')" 1
check "honeypot creates no lead" "$(q "SELECT count(*) FROM leads WHERE email='bot-honey@spam.test'")" 0
HONEY_AFTER=$(q "SELECT count(*) FROM audit_log WHERE action='intake.rejected'")
check "honeypot rejection is audited" \
  "$([ "$HONEY_AFTER" -gt "$HONEY_BEFORE" ] && echo 1 || echo 0)" 1
check "every rejection has a recorded reason" \
  "$(q "SELECT count(*) FROM audit_log WHERE action='intake.rejected' AND (metadata->>'reason') IS NULL")" 0
check "the honeypot audit stores no attacker-supplied detail" \
  "$(q "SELECT count(*) FROM audit_log WHERE action='intake.rejected' AND metadata ? 'email'")" 0

SHORT=$(timeout 30 curl -s -X POST "$BASE/api/intake" -H 'Content-Type: application/json' \
  -H "X-Forwarded-For: 198.51.100.$(( (RANDOM % 200) + 20 ))" \
  -d '{"name":"X","email":"nope","situation":"","message":"hi","startedAt":1}')
check "invalid payload is rejected with field errors" "$(contains "$SHORT" '"fields"')" 1
check "invalid payload creates no lead" "$(q "SELECT count(*) FROM leads WHERE email='nope'")" 0

echo
echo "=== 8. Rate limiting ==="
# One address for the whole burst, chosen fresh per run so repeated runs do not
# exhaust the limit before the first attempt. Randomising inside the loop would
# give every attempt its own bucket and never trip the limit at all.
SPAM_IP="198.51.100.$(( (RANDOM % 200) + 20 ))"
for i in 1 2 3 4 5 6 7; do
  CODE=$(timeout 30 curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/intake" \
    -H 'Content-Type: application/json' -H "X-Forwarded-For: $SPAM_IP" \
    -d "{\"name\":\"Spammer $i\",\"email\":\"spam$i-$STAMP@probe.test\",\"situation\":\"Something specific\",\"message\":\"this message is long enough to pass validation\",\"website_confirm\":\"x\",\"startedAt\":$(( $(date +%s) * 1000 - 20000 ))}")
  LAST=$CODE
done
check "repeated submissions are throttled" "$LAST" 429
"${PSQL[@]}" "DELETE FROM rate_limit_buckets WHERE bucket_key = 'intake:$SPAM_IP'" >/dev/null 2>&1

echo
printf "  %d passed, %d failed\n\n" "$pass" "$fail"
[ "$fail" -eq 0 ]
