#!/usr/bin/env python3
"""Fantasy Points Data Suite -> local parquet warehouse (every tool, every scope, every week).

WHAT: the paid FP Data subscription (data.fantasypoints.com) exposes ~30 tool tables the
subscriber role can read — passing / rushing / receiving (basic + advanced + splits),
offense snaps, run-pass, coverage matrix, OL/DL, fantasy points scored/allowed, the weekly
share reports — each in up to three scopes: player, team offense ("team"), team defense
("opponent"). This pulls every (tool, scope, season, week) cell through the same POST the
web app makes (`/v2/ds/nfl/tools/<scope>/<tool>/values`), one call per cell, so every row
is a player-game or team-game with the tool's full column set. Charted data starts 2021.

WHY per week: the API aggregates over the filter window; a week filter is what makes
rows per-GAME. Player scope is pulled WITHOUT a position filter (every roster player
comes back, defenders/OL with empty stats) and the empties are dropped at consolidation —
no assumptions about which positions a tool covers.

AUTH: `FP_DATA_TOKEN` in .env.local (or env) = the JWT the logged-in web app sends as the
Authorization header (no "Bearer"). It carries no exp claim; if the API starts answering
401/403 the run stops loudly — capture a fresh token from the browser's request headers.

Tools whose `roles` need a tier we don't have (the "private" ones: XFP report, pressure,
dropback, game logs, ...) answer with a 5-row preview; they are listed in the catalog file
as skipped, never pulled, so the warehouse holds no preview stubs.

Usage:
  python3 fp_pull.py --backfill                 # 2021..current, weeks 1-18, skip cells on disk
  python3 fp_pull.py --inseason                 # current season: last completed week ±1, re-pull
  python3 fp_pull.py --tools receivingAdvanced,rushingAdvanced --seasons 2025 --weeks 1-3
  python3 fp_pull.py --consolidate              # raw JSON -> data/fpdata/<tool>__<scope>.parquet
Layout: data/fpdata/raw/<tool>/<scope>/<season>_w<week>.json ; data/fpdata/catalog.json
"""
import argparse
import concurrent.futures as cf
import json
import os
import re
import sys
import time

import pandas as pd
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data", "fpdata")
RAW = os.path.join(OUT, "raw")
API = "https://data.fantasypoints.com/v2/ds"
FIRST_SEASON = 2021           # charted + play-by-play tools both start here (probed 2013-2020: 0 rows)
WEEKS = range(1, 19)
SCOPES = {"player": ("player", "$player.playerId", "player", "player", "player"),
          "team": ("team/offense", "$team.teamId", "team", "team", "offense"),
          "opponent": ("team/defense", "$team.teamId", "opponent", "team", "defense")}
SKIP_PROPS = {"debug", "debugChris"}


def token():
    for fn in (os.path.join(HERE, "..", "..", ".env.local"), os.path.join(HERE, "..", "..", ".env")):
        if os.path.exists(fn):
            for line in open(fn):
                if line.startswith("FP_DATA_TOKEN="):
                    return line.split("=", 1)[1].strip()
    t = os.environ.get("FP_DATA_TOKEN")
    if not t:
        sys.exit("[fp] FP_DATA_TOKEN missing (.env.local or env)")
    return t


def slug(prop):
    return re.sub(r"(?<!^)(?=[A-Z])", "-", prop).lower()


def catalog(H, refresh=False):
    """Tool list from the API, filtered to what our role can actually read. Cached."""
    path = os.path.join(OUT, "catalog.json")
    if os.path.exists(path) and not refresh:
        return json.load(open(path))
    r = requests.post(f"{API}/all/tools", json={}, headers=H, timeout=60)
    r.raise_for_status()
    # roles come from the JWT claims (the /all/tools session block only echoes one of them)
    import base64
    p = H["Authorization"].split(".")[1]; p += "=" * (-len(p) % 4)
    my_roles = set(json.loads(base64.urlsafe_b64decode(p)).get("roles") or [])
    tools, skipped = [], []
    for t in r.json()["content"]["tables"]["values"]:
        prop = t["property"]
        if prop in SKIP_PROPS:
            continue
        roles = set(t.get("roles") or [])
        # a tool whose required roles we lack returns a 5-row preview, not data
        if roles and not (roles & my_roles):
            skipped.append({"property": prop, "name": t["name"], "roles": sorted(roles)})
            continue
        tools.append({"property": prop, "name": t["name"], "scopes": t.get("context") or ["player"],
                      "requiresCharting": bool(t.get("requiresCharting")), "roles": sorted(roles),
                      "category": [c.get("name") for c in (t.get("category") or [])]})
    cat = {"pulled_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "my_roles": sorted(my_roles),
           "tools": tools, "skipped_private": skipped}
    os.makedirs(OUT, exist_ok=True)
    json.dump(cat, open(path, "w"), indent=1)
    return cat


def body(tool, scope, season, week):
    path, grouping, mc, rc, rct = SCOPES[scope]
    fm = {"game.season": {"eq": season}, "game.week": {"eq": week}}
    if scope == "player":
        fm["isGamePlayed"] = {"eq": True}
    ctx = {"tableProperty": tool["property"], "grouping": grouping, "dualContext": False,
           "modelContext": mc, "routeContext": rc, "routeContextTarget": rct,
           "filterMatch": fm, "filterPlay": {}, "filterResult": {}, "qualifiers": {}, "splits": {},
           "disabled": {"filterMatch": {}, "filterPlay": {}, "filterResult": {}},
           "requiresSchedule": None, "requiresCharting": tool["requiresCharting"],
           "requiresPlayByPlay": False, "requiresPreTotals": False, "requiresPostTotals": False,
           "requiresMultiplePipelines": None, "requiredRoles": tool["roles"], "isFreePreview": False}
    return f"{API}/nfl/tools/{path}/{slug(tool['property'])}/values", \
        {"context": ctx, "useCache": True, "flatten": True, "debug": False}


def cell_path(tool, scope, season, week):
    return os.path.join(RAW, tool["property"], scope, f"{season}_w{week}.json")


def pull_cell(H, tool, scope, season, week):
    url, b = body(tool, scope, season, week)
    for attempt in range(5):
        try:
            r = requests.post(url, json=b, headers=H, timeout=240)
        except requests.RequestException as e:
            time.sleep(3 * (attempt + 1)); err = str(e); continue
        if r.status_code in (401, 403):
            raise SystemExit(f"[fp] {r.status_code} from API — FP_DATA_TOKEN expired/revoked; recapture it")
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(5 * (attempt + 1)); err = f"HTTP {r.status_code}"; continue
        j = r.json()
        rows = (((j.get("content") or {}).get("rows") or {}).get("values")) or []
        errs = j.get("errors") or []
        if errs and not rows:
            time.sleep(3); err = str(errs)[:200]; continue
        p = cell_path(tool, scope, season, week)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        json.dump({"tool": tool["property"], "scope": scope, "season": season, "week": week,
                   "pulled_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                   "nrows": len(rows), "errors": errs, "rows": rows}, open(p, "w"))
        return len(rows)
    raise RuntimeError(f"{tool['property']}/{scope} {season} w{week}: {err}")


def current_season_week():
    """(season, last COMPLETED regular-season week) from the nflverse schedule."""
    # always live: the local nflverse_games.parquet cache can be days stale
    import io
    r = requests.get("https://github.com/nflverse/nfldata/raw/master/data/games.csv", timeout=120)
    r.raise_for_status()
    g = pd.read_csv(io.StringIO(r.text)); g = g[g.game_type == "REG"]
    season = int(g.season.max()); s = g[g.season == season]
    done = s[s.result.notna()]
    return season, (int(done.week.max()) if len(done) else 0)


def is_stat_col(c):
    """Real per-game stat columns: not identity, not the Yes/No filter labels, not gamesPlayed
    (every roster row carries those, which is why the first pass kept 78% empty defenders)."""
    if c.startswith("__") or c.endswith("Label") or c.endswith("GamesPlayed"):
        return False
    if c.startswith(("playerStats", "teamStats", "opponentStats", "marketShare")):
        return True
    return not c.startswith(("game", "player", "team", "opponent"))


def consolidate(tools=None):
    """raw cells -> one parquet per tool__scope; drops rows with no real stat values
    (player scope returns the whole roster). Newest pull of a cell wins (files are overwritten)."""
    n_out = 0
    for tool in sorted(os.listdir(RAW)):
        if (tools and tool not in tools) or not os.path.isdir(os.path.join(RAW, tool)):
            continue
        for scope in sorted(os.listdir(os.path.join(RAW, tool))):
            if not os.path.isdir(os.path.join(RAW, tool, scope)):
                continue
            frames = []
            for f in sorted(os.listdir(os.path.join(RAW, tool, scope))):
                d = json.load(open(os.path.join(RAW, tool, scope, f)))
                if d["rows"]:
                    df = pd.DataFrame(d["rows"])
                    df["__season"], df["__week"], df["__pulled_at"] = d["season"], d["week"], d["pulled_at"]
                    frames.append(df)
            if not frames:
                continue
            df = pd.concat(frames, ignore_index=True)
            stat = [c for c in df.columns if is_stat_col(c)]
            if stat:
                df = df[df[stat].notna().any(axis=1)]
            for c in ("teamsPlayedFor", "opponentsPlayed"):
                if c in df.columns:
                    df = df.drop(columns=[c])
            dest = os.path.join(OUT, f"{tool}__{scope}.parquet")
            df.to_parquet(dest, index=False)
            n_out += 1
            print(f"  {tool:32s} {scope:9s} {len(df):7d} rows {len(df.columns):3d} cols "
                  f"seasons {df.__season.min()}-{df.__season.max()}")
    print(f"[fp] consolidated {n_out} tool/scope parquets -> {OUT}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backfill", action="store_true")
    ap.add_argument("--inseason", action="store_true")
    ap.add_argument("--consolidate", action="store_true")
    ap.add_argument("--tools", help="comma list of tool properties")
    ap.add_argument("--seasons", help="e.g. 2025 or 2021-2026")
    ap.add_argument("--weeks", help="e.g. 3 or 1-18")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--force", action="store_true", help="re-pull cells already on disk")
    ap.add_argument("--refresh-catalog", action="store_true")
    a = ap.parse_args()
    H = {"Authorization": token(), "Content-Type": "application/json"}
    cat = catalog(H, refresh=a.refresh_catalog)
    tools = cat["tools"]
    if a.tools:
        want = set(a.tools.split(",")); tools = [t for t in tools if t["property"] in want]
    print(f"[fp] {len(tools)} tools ({sum(len(t['scopes']) for t in tools)} tool/scopes); "
          f"{len(cat['skipped_private'])} private tools skipped")

    def rng(s, lo, hi):
        if not s: return list(range(lo, hi + 1))
        if "-" in s: x, y = s.split("-"); return list(range(int(x), int(y) + 1))
        return [int(s)]
    season_now, wk_done = current_season_week()
    if a.inseason:
        seasons, weeks, force = [season_now], [w for w in (wk_done - 1, wk_done, wk_done + 1) if 1 <= w <= 18], True
    else:
        seasons = rng(a.seasons, FIRST_SEASON, season_now); weeks = rng(a.weeks, 1, 18); force = a.force
    if a.backfill or a.inseason or (a.tools and not a.consolidate):
        # "other" is a scope the catalog lists for run/pass + OL/DL that the app has no route for; skip
        cells = [(t, sc, s, w) for t in tools for sc in t["scopes"] if sc in SCOPES for s in seasons for w in weeks
                 if not (s == season_now and w > wk_done + 1)      # unplayed weeks: nothing to pull
                 and (force or not os.path.exists(cell_path(t, sc, s, w)))]
        print(f"[fp] {len(cells)} cells to pull (seasons {seasons[0]}-{seasons[-1]}, weeks {weeks[0]}-{weeks[-1]}, "
              f"season_now={season_now} last_completed_week={wk_done})")
        done = fails = 0; t0 = time.time()
        with cf.ThreadPoolExecutor(a.workers) as ex:
            futs = {ex.submit(pull_cell, H, *c): c for c in cells}
            for f in cf.as_completed(futs):
                t, sc, s, w = futs[f]
                try:
                    f.result(); done += 1
                except SystemExit as e:
                    print(e); os._exit(2)
                except Exception as e:
                    fails += 1; print(f"  FAIL {t['property']}/{sc} {s} w{w}: {e}")
                if (done + fails) % 100 == 0:
                    print(f"  progress {done + fails}/{len(cells)} ({fails} failed) {time.time() - t0:.0f}s")
        print(f"[fp] pulled {done} cells, {fails} failed, {time.time() - t0:.0f}s")
    if a.consolidate or a.backfill or a.inseason:
        consolidate([t["property"] for t in tools] if a.tools else None)


if __name__ == "__main__":
    main()
