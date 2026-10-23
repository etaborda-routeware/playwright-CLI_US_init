#!/usr/bin/env python3
"""Appends one step record (JSON line) to a run's steps.jsonl file."""
import base64
import json
import re
import sys
from pathlib import Path

# auth/login.js embeds literal credentials in its source, which playwright-cli
# echoes back verbatim as "generated code" in its output - strip them here, at
# the point output is first persisted, so every downstream report (local HTML,
# Slack canvas, etc.) is protected without each needing its own copy of this.
_SECRET_PATTERNS = [
    re.compile(r"(PASSWORD\s*=\s*)'[^']*'"),
    re.compile(r"(EMAIL\s*=\s*)'[^']*'"),
]


def redact(text):
    for pattern in _SECRET_PATTERNS:
        text = pattern.sub(r"\1'***REDACTED***'", text)
    return text


def main():
    steps_file, name, status, start_ms, stop_ms, output_file, screenshot_file = sys.argv[1:8]

    output = redact(Path(output_file).read_text(errors="replace")) if output_file != "-" else ""

    screenshot_b64 = None
    if screenshot_file != "-" and Path(screenshot_file).exists():
        screenshot_b64 = base64.b64encode(Path(screenshot_file).read_bytes()).decode("ascii")

    record = {
        "name": name,
        "status": status,
        "start_ms": int(start_ms),
        "stop_ms": int(stop_ms),
        "duration_ms": int(stop_ms) - int(start_ms),
        "output": output,
        "screenshot_b64": screenshot_b64,
    }

    with open(steps_file, "a") as f:
        f.write(json.dumps(record) + "\n")


if __name__ == "__main__":
    main()
