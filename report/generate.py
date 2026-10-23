#!/usr/bin/env python3
"""Builds a self-contained HTML report from a run's steps.jsonl file."""
import html
import json
import re
import sys
from pathlib import Path

_PLAYWRIGHT_CODE_BLOCK = re.compile(r"### Ran Playwright code\n```js\n.*?\n```\n?", re.DOTALL)


def strip_playwright_code(output):
    """Drop the echoed generated-code block - the report should show what
    happened (Result/Page/Events), not the scenario source itself."""
    return _PLAYWRIGHT_CODE_BLOCK.sub("", output)


def format_duration(ms):
    seconds = ms / 1000
    return f"{seconds:.1f}s"


def render_pass_chart(passed, failed):
    """Donut chart of passed vs failed, using the fixed status palette
    (good/critical) - these colors are reserved for pass/fail state and
    never reused for series identity."""
    total = passed + failed
    pass_pct = round((passed / total) * 100) if total else 0

    size = 140
    cx = cy = size / 2
    r = 54
    stroke_width = 24
    circumference = 2 * 3.141592653589793 * r
    gap = 3 if passed and failed else 0

    passed_full_len = (passed / total) * circumference if total else 0
    passed_draw_len = max(passed_full_len - gap, 0)
    failed_draw_len = max(circumference - passed_full_len - gap, 0)

    arcs = ""
    if passed:
        arcs += (
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="var(--status-good)" '
            f'stroke-width="{stroke_width}" stroke-dasharray="{passed_draw_len:.2f} {circumference - passed_draw_len:.2f}" '
            f'stroke-dashoffset="0"><title>Passed: {passed} ({pass_pct}%)</title></circle>'
        )
    if failed:
        arcs += (
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="var(--status-critical)" '
            f'stroke-width="{stroke_width}" stroke-dasharray="{failed_draw_len:.2f} {circumference - failed_draw_len:.2f}" '
            f'stroke-dashoffset="-{passed_full_len:.2f}"><title>Failed: {failed} ({100 - pass_pct}%)</title></circle>'
        )

    return f'''
    <div class="chart-card">
      <div class="chart-title">Pass rate</div>
      <div class="chart-body">
        <svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" role="img" aria-label="{pass_pct}% of test cases passed">
          <g transform="rotate(-90 {cx} {cy})">{arcs}</g>
          <text x="{cx}" y="{cy - 4}" text-anchor="middle" class="chart-center-value">{pass_pct}%</text>
          <text x="{cx}" y="{cy + 16}" text-anchor="middle" class="chart-center-label">passed</text>
        </svg>
        <div class="chart-legend">
          <div class="legend-row"><span class="swatch" style="background: var(--status-good)"></span>Passed <strong>{passed}</strong></div>
          <div class="legend-row"><span class="swatch" style="background: var(--status-critical)"></span>Failed <strong>{failed}</strong></div>
        </div>
      </div>
    </div>'''


def render_step(step):
    status = step["status"]
    badge_class = "passed" if status == "passed" else "failed"
    output = html.escape(strip_playwright_code(step.get("output", "")))
    screenshot_html = ""
    if step.get("screenshot_b64"):
        screenshot_html = f'''
        <div class="screenshot">
          <img src="data:image/png;base64,{step["screenshot_b64"]}" alt="Failure screenshot for {html.escape(step["name"])}" />
        </div>'''
    return f'''
    <details class="step {badge_class}" {"open" if status == "failed" else ""}>
      <summary>
        <span class="badge {badge_class}">{status.upper()}</span>
        <span class="step-name">{html.escape(step["name"])}</span>
        <span class="duration">{format_duration(step["duration_ms"])}</span>
      </summary>
      <div class="step-body">
        {screenshot_html}
        <pre class="output">{output}</pre>
      </div>
    </details>'''


def main():
    run_dir = Path(sys.argv[1])
    steps_file = run_dir / "steps.jsonl"
    steps = [json.loads(line) for line in steps_file.read_text().splitlines() if line.strip()]

    total = len(steps)
    passed = sum(1 for s in steps if s["status"] == "passed")
    failed = total - passed
    total_duration = sum(s["duration_ms"] for s in steps)
    overall_class = "passed" if failed == 0 else "failed"

    steps_html = "\n".join(render_step(s) for s in steps)

    html_doc = f'''<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Hauler US Scenario Report - {html.escape(run_dir.name)}</title>
<style>
  :root {{
    color-scheme: light dark;
    --bg: #f7f8fa; --card: #ffffff; --text: #1c1f26; --muted: #6b7280;
    --border: #e5e7eb; --green: #16a34a; --green-bg: #dcfce7;
    --red: #dc2626; --red-bg: #fee2e2;
    /* Fixed status palette - reserved for pass/fail state, never themed,
       same steps in light/dark (both clear 3:1 on their own surface). */
    --status-good: #0ca30c; --status-critical: #d03b3b;
  }}
  @media (prefers-color-scheme: dark) {{
    :root {{
      --bg: #0f1115; --card: #171a21; --text: #e5e7eb; --muted: #9ca3af;
      --border: #2a2e37; --green: #4ade80; --green-bg: #14351f;
      --red: #f87171; --red-bg: #3a1616;
    }}
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; padding: 2rem; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }}
  .container {{ max-width: 900px; margin: 0 auto; }}
  h1 {{ font-size: 1.4rem; margin-bottom: 0.25rem; }}
  .subtitle {{ color: var(--muted); font-size: 0.9rem; margin-bottom: 1.5rem; }}
  .summary {{
    display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;
  }}
  .summary-card {{
    background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    padding: 1rem 1.25rem; flex: 1; min-width: 120px;
  }}
  .summary-card .label {{ color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; }}
  .summary-card .value {{ font-size: 1.6rem; font-weight: 600; margin-top: 0.25rem; }}
  .summary-card.overall .value.passed {{ color: var(--green); }}
  .summary-card.overall .value.failed {{ color: var(--red); }}
  .step {{
    background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    margin-bottom: 0.75rem; overflow: hidden;
  }}
  .step summary {{
    cursor: pointer; padding: 0.85rem 1.1rem; display: flex; align-items: center;
    gap: 0.75rem; list-style: none;
  }}
  .step summary::-webkit-details-marker {{ display: none; }}
  .badge {{
    font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 6px;
    letter-spacing: 0.03em;
  }}
  .badge.passed {{ color: var(--green); background: var(--green-bg); }}
  .badge.failed {{ color: var(--red); background: var(--red-bg); }}
  .step-name {{ font-weight: 500; flex: 1; }}
  .duration {{ color: var(--muted); font-size: 0.85rem; }}
  .step-body {{ padding: 0 1.1rem 1.1rem; }}
  .output {{
    background: var(--bg); border: 1px solid var(--border); border-radius: 8px;
    padding: 0.85rem; font-size: 0.78rem; line-height: 1.45; overflow-x: auto;
    white-space: pre-wrap; word-break: break-word; max-height: 420px; overflow-y: auto;
  }}
  .screenshot {{ margin-bottom: 0.75rem; }}
  .screenshot img {{
    max-width: 100%; border-radius: 8px; border: 1px solid var(--border);
  }}
  .chart-card {{
    background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    padding: 1rem 1.25rem; margin-bottom: 1.5rem;
  }}
  .chart-title {{ color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 0.75rem; }}
  .chart-body {{ display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }}
  .chart-center-value {{ font-size: 1.3rem; font-weight: 600; fill: var(--text); }}
  .chart-center-label {{ font-size: 0.65rem; fill: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }}
  .chart-legend {{ display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem; }}
  .legend-row {{ display: flex; align-items: center; gap: 0.5rem; }}
  .legend-row strong {{ margin-left: 0.15rem; }}
  .swatch {{ display: inline-block; width: 12px; height: 12px; border-radius: 3px; }}
</style>
</head>
<body>
  <div class="container">
    <h1>Hauler US Scenario Report</h1>
    <div class="subtitle">Run: {html.escape(run_dir.name)}</div>
    <div class="summary">
      <div class="summary-card overall">
        <div class="label">Overall</div>
        <div class="value {overall_class}">{"PASSED" if failed == 0 else "FAILED"}</div>
      </div>
      <div class="summary-card">
        <div class="label">Total Test Cases</div>
        <div class="value">{total}</div>
      </div>
      <div class="summary-card">
        <div class="label">Passed</div>
        <div class="value passed" style="color: var(--green)">{passed}</div>
      </div>
      <div class="summary-card">
        <div class="label">Failed</div>
        <div class="value failed" style="color: var(--red)">{failed}</div>
      </div>
      <div class="summary-card">
        <div class="label">Duration</div>
        <div class="value">{format_duration(total_duration)}</div>
      </div>
    </div>
    {render_pass_chart(passed, failed)}
    {steps_html}
  </div>
</body>
</html>'''

    (run_dir / "report.html").write_text(html_doc)
    print(run_dir / "report.html")


if __name__ == "__main__":
    main()
