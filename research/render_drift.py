#!/usr/bin/env python3
"""Does what Render is actually running match render.yaml?

WHY. On 2026-10-09 nfl-prop-report-daily was found running a start command from before the
2026-10-07 edit: it still ended at the retired nfl_prop_narratives.py and was missing five steps,
including the payload build and the page generator. The job ran daily, exited 0, and emailed
nothing. Every data probe stayed green because the rows it checks were being written by a
different cron. fp_cards sat at 0 of 387 for the whole week as a result.

Editing render.yaml does not deploy it. Nothing in the repo or the dashboard surfaces the gap, so
the only way to catch it is to ask the API what is deployed and diff. Three slate jobs were
drifting the same way, each missing legacy_fade_watch.py.

Exits non-zero on drift so a cron wrapper can alert. Skips cleanly when RENDER_API_KEY is absent.
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

try:
    import yaml
except ModuleNotFoundError:            # pyyaml is not in every caller's build
    yaml = None

ROOT = Path(__file__).resolve().parent.parent


def key():
    k = os.environ.get("RENDER_API_KEY")
    if k:
        return k
    env = ROOT / ".env.local"
    if env.exists():
        for ln in env.read_text().splitlines():
            if ln.startswith("RENDER_API_KEY="):
                return ln.split("=", 1)[1].strip().strip('"')
    return None


def norm(s):
    """Whitespace-insensitive: render.yaml folds `>-` blocks, the API returns them re-wrapped."""
    return " ".join((s or "").split())


# EXIT CODES ARE PART OF THE CONTRACT. health_sweep.py reds only on 2.
#   0 = checked, no drift (or cleanly skipped)
#   1 = COULD NOT CHECK (missing dep/key/network) — not actionable, must not alarm
#   2 = DRIFT FOUND — actionable
# Collapsing 1 and 2 is how a missing pyyaml painted the whole daily sweep RED on
# 2026-10-10 while all 14 real checks were green.
CANNOT_CHECK, DRIFT = 1, 2


def main():
    if yaml is None:
        print("[drift] pyyaml not installed — cannot read render.yaml, skipping")
        return CANNOT_CHECK
    k = key()
    if not k:
        print("[drift] no RENDER_API_KEY — skipped")
        return CANNOT_CHECK
    blue = {s["name"]: norm(s["startCommand"])
            for s in yaml.safe_load((ROOT / "render.yaml").read_text()).get("services", [])
            if s.get("startCommand")}
    req = urllib.request.Request("https://api.render.com/v1/services?limit=100",
                                 headers={"Authorization": f"Bearer {k}",
                                          "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as r:
        rows = [x.get("service", x) for x in json.load(r)]

    drift, seen = [], set()
    for s in rows:
        n = s["name"]
        if n not in blue:
            continue
        seen.add(n)
        live = norm((s.get("serviceDetails", {}).get("envSpecificDetails", {}) or {})
                    .get("startCommand"))
        if live != blue[n]:
            drift.append((n, s["id"], live, blue[n]))

    absent = sorted(set(blue) - seen)
    print(f"[drift] {len(blue)} blueprint services with a start command, {len(seen)} found live")
    for n, sid, live, want in sorted(drift):
        print(f"  DRIFT {n} ({sid})")
        print(f"    live      : {live[:160]}")
        print(f"    blueprint : {want[:160]}")
    if absent:
        print(f"  not found live: {', '.join(absent)}")
    if drift:
        print(f"\n{len(drift)} service(s) drifted — render.yaml was edited but not applied. "
              f"Sync the blueprint in Render, or PATCH startCommand per service.")
        return DRIFT
    print("  all match")
    return 0


if __name__ == "__main__":
    sys.exit(main())
