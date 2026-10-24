set -euo pipefail
BASE="${1:?Usage: smoke-test.sh BASE_URL API_KEY}"
KEY="${2:?Usage: smoke-test.sh BASE_URL API_KEY}"
JSON='Content-Type: application/json'
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

[ "$(code "$BASE/api/health")" = 200 ] && pass "health is 200" || fail "health"
[ "$(code "$BASE/")" = 200 ] && pass "frontend page is 200" || fail "frontend"
[ "$(code "$BASE/api/rules")" = 401 ] && pass "rules without token is 401" || fail "no-token check"
[ "$(code -X POST "$BASE/api/auth/token" -H "$JSON" -d '{"apiKey":"wrong"}')" = 401 ] \
  && pass "wrong API key is 401" || fail "wrong key check"

TOKEN=$(curl -sf -X POST "$BASE/api/auth/token" -H "$JSON" -d "{\"apiKey\":\"$KEY\"}" | jq -r .token || true)
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] && pass "token issued" || fail "token"
AUTH="Authorization: Bearer $TOKEN"

[ "$(code "$BASE/api/rules" -H "$AUTH")" = 200 ] && pass "rules with token is 200" || fail "rules"

curl -sf -X POST "$BASE/api/validate" -H "$AUTH" -H "$JSON" \
  -d "$(jq '{records: .}' backend/src/data/sample_feed.json)" | jq -e '.total > 0' >/dev/null \
  && pass "validate sample feed" || fail "validate"

curl -sf "$BASE/api/runs" -H "$AUTH" | jq -e 'length >= 1' >/dev/null \
  && pass "run history saved" || fail "runs"

curl -sf -X POST "$BASE/api/ask" -H "$AUTH" -H "$JSON" \
  -d '{"question":"Why does a product without a title fail?"}' | jq -e '.answer | length > 0' >/dev/null \
  && pass "agent answers" || fail "ask"

echo "ALL CHECKS PASSED"
