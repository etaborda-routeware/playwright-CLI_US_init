#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Must match STATE_PATH in auth/login.template.js - that script is the one
# that actually writes this file, so the two names have to stay in sync.
STATE_FILE=".auth/hauler-eliana-qausa.json"
SCENARIOS_DIR="scenarios"
DASHBOARD_URL="https://hauler.qa.smartcity.routeware.com/dashboard/all-ops"

# `python3` can resolve to the Windows Store alias stub (which just prints an
# install prompt and exits non-zero) ahead of a real interpreter on PATH -
# probe candidates and fail fast with a clear message instead of limping
# through with broken output.
resolve_python() {
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c "" >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done
  if command -v py >/dev/null 2>&1 && py -3 -c "" >/dev/null 2>&1; then
    echo "py -3"
    return 0
  fi
  return 1
}

PYTHON="$(resolve_python)" || {
  echo "No working Python 3 interpreter found on PATH (python3/python/py resolved to a stub or nothing usable)." >&2
  exit 1
}

LOGIN_SCRIPT=$(mktemp -t login-rendered-XXXX.js)
$PYTHON "$DIR/auth/render_login.py" "$LOGIN_SCRIPT" >/dev/null

RUN_ID="run-$(date +%Y%m%dT%H%M%S)"
RUN_DIR="$DIR/reports/$RUN_ID"
mkdir -p "$RUN_DIR"
: > "$RUN_DIR/steps.jsonl"
OVERALL_STATUS=0

epoch_ms() { $PYTHON -c 'import time; print(int(time.time()*1000))'; }

run_step() {
  local name="$1" file="$2" slug="${3:-$1}"
  local out_file start stop status screenshot_file
  out_file=$(mktemp)
  screenshot_file="-"

  start=$(epoch_ms)
  playwright-cli run-code --filename="$file" >"$out_file" 2>&1 || true
  stop=$(epoch_ms)

  # playwright-cli run-code always exits 0, even when the script throws -
  # detect failure from the "### Error" marker it prints instead.
  if grep -q '^### Error' "$out_file"; then
    status="failed"
  else
    status="passed"
  fi

  cat "$out_file"

  if [ "$status" = "failed" ]; then
    screenshot_file="$RUN_DIR/${slug}-failure.png"
    playwright-cli screenshot --filename="$screenshot_file" >/dev/null 2>&1 || screenshot_file="-"
    OVERALL_STATUS=1
  fi

  $PYTHON "$DIR/report/append_step.py" "$RUN_DIR/steps.jsonl" "$name" "$status" "$start" "$stop" "$out_file" "$screenshot_file"
  rm -f "$out_file"

  [ "$status" = "passed" ]
}

finish() {
  REPORT_HTML=$($PYTHON "$DIR/report/generate.py" "$RUN_DIR")
  cp "$REPORT_HTML" "$DIR/reports/latest.html"
  echo ""
  echo "Report: $REPORT_HTML"
  echo "Latest: $DIR/reports/latest.html"
  exit "$OVERALL_STATUS"
}

if [ "$#" -gt 0 ]; then
  FILES=("$@")
else
  FILES=("$SCENARIOS_DIR"/*.js)
fi

playwright-cli open --headed
trap 'playwright-cli close >/dev/null 2>&1 || true; rm -f "$LOGIN_SCRIPT"' EXIT

if [ -f "$STATE_FILE" ]; then
  playwright-cli state-load "$STATE_FILE"
fi

echo "=== Ensuring valid session ==="
if ! run_step "login" "$LOGIN_SCRIPT"; then
  echo "Login failed - aborting without running scenarios." >&2
  finish
fi

for script in "${FILES[@]}"; do
  slug="$(basename "$script" .js)"
  # Scenario files can declare a friendlier display name via a leading
  # "// name: ..." comment; falls back to the filename if absent.
  name="$(head -1 "$script" | sed -n 's/^\/\/[[:space:]]*name:[[:space:]]*//p')"
  if [ -z "$name" ]; then
    name="$slug"
  fi
  echo "=== Running scenario: $name ==="
  playwright-cli goto "$DASHBOARD_URL"
  run_step "$name" "$script" "$slug" || true
done

finish
