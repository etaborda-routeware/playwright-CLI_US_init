#!/usr/bin/env python3
"""Renders auth/login.template.js into a runnable script using auth/credentials.json.

playwright-cli run-code scripts can't read files themselves (no fs/require access),
so this substitution has to happen here, before the script is handed to run-code.
"""
import json
import sys
from pathlib import Path

BASE = Path(__file__).parent


def main():
    creds_path = BASE / "credentials.json"
    if not creds_path.exists():
        print(f"Missing {creds_path}", file=sys.stderr)
        print(f"Copy auth/credentials.example.json to auth/credentials.json and fill in real values.", file=sys.stderr)
        sys.exit(1)

    template = (BASE / "login.template.js").read_text()
    creds = json.loads(creds_path.read_text())

    rendered = (
        template
        .replace("__EMAIL__", creds["email"])
        .replace("__PASSWORD__", creds["password"])
        .replace("__VENDOR__", creds["vendor"])
    )

    out_path = sys.argv[1] if len(sys.argv) > 1 else str(BASE / "login.generated.js")
    Path(out_path).write_text(rendered)
    print(out_path)


if __name__ == "__main__":
    main()
