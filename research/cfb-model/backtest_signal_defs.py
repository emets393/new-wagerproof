#!/usr/bin/env python3
"""Measure every CFB signal's real backtest record and write it onto cfb_signal_defs.

WHY (owner, 2026-10-05). `cfb_signal_defs.typical_hit` was a hand-typed STRING
("~58%") with no sample size anywhere, and `signal_performance` holds only the
SEASON-TO-DATE live tally. Asked "how many samples does conf_sunbelt_fade have?",
the only queryable number was a 1-row live counter — so the answer came back
"n=1" for a signal whose real record is 80-62-2 over 142 bets. The agents read
these same tables to justify picks, so a prose hit rate with no n is a number
they can overclaim from.

Each spot is graded on ITS OWN line, the way backtest_2025.py does it and the
grading framework requires: a spot tagged `open` grades at the opener, `close`
at the close, `dk` at DraftKings' close, `soft` at the soft-book number. Grading
a spot at a line it never used is how a signal's record gets flattered.

Out of sample by construction: build_season(S) trains on < S only.

Covers the spot library. The ~10 bespoke flags built inline in
gen_cfb_slate_flags.py (team totals, 1H markets, coach hammer, look-ahead, the
style/archetype reads) have no reusable mask here and are left NULL rather than
guessed — a NULL says "not measured", a fabricated number does not.

Usage: backtest_signal_defs.py [--write] [--seasons 2021-2025]
"""
import argparse
import collections
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))
import cfb_forecast as F
import dry_common as C

BASE = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"


def line_for(row, side, gl):
    """The spread this bet is graded at — home perspective."""
    if gl == "dk" and pd.notna(row.get("dk_sp_close")):
        return row.get("dk_sp_close")
    if gl == "soft":
        v = row.get("soft_best_home") if side == "HOME" else row.get("soft_best_away")
        if pd.notna(v):
            return v
    return row.get("spread_close") if gl in ("close", "dk", "soft") else row.get("spread_open")


def grade(row, side, mkt, gl):
    """1 win / 0 loss / -1 push / None ungradeable."""
    hp, ap = row.get("homePoints"), row.get("awayPoints")
    if pd.isna(hp) or pd.isna(ap):
        return None
    if mkt == "side":
        ln = line_for(row, side, gl)
        if pd.isna(ln):
            return None
        e = (hp - ap) + ln                       # >0 home covers
        if abs(e) < 1e-9:
            return -1
        return int((e > 0) == (side == "HOME"))
    if mkt == "total":
        ln = row.get("total_close") if gl == "close" else row.get("total_open")
        if pd.isna(ln):
            return None
        d = (hp + ap) - ln
        if abs(d) < 1e-9:
            return -1
        return int((d > 0) == (side == "OVER"))
    return None                                   # team_total etc. — not measured here


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--seasons", default="2021-2025")
    a = ap.parse_args()
    lo, hi = (int(x) for x in a.seasons.split("-"))

    # key -> season -> [w, l, p]; dedupe (game, market, side) within a season
    tally = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0, 0]))
    names_for = collections.defaultdict(set)
    for season in range(lo, hi + 1):
        try:
            gm, feats, te, S = F.build_season(season)
        except Exception as e:
            print(f"  {season}: build_season failed ({e}) — skipped")
            continue
        te = te[te.actual_total.notna()].copy()
        if te.empty:
            print(f"  {season}: no graded games"); continue
        seen = set()
        fired = 0
        for name, spec in S.items():
            mask, side, mkt, gl = spec[0], spec[1], spec[2], (spec[3] if len(spec) > 3 else "close")
            if C.is_blanket(name):               # slate-wide leans are not per-game signals
                continue
            key = C.key_for(name)
            names_for[key].add(name)
            m = pd.Series(mask).reindex(te.index, fill_value=False).fillna(False)
            for gid in te.index[m.astype(bool)]:
                dedupe = (key, gid, mkt, side)
                if dedupe in seen:
                    continue
                seen.add(dedupe)
                g = grade(te.loc[gid], side, mkt, gl)
                if g is None:
                    continue
                fired += 1
                tally[key][season][0 if g == 1 else (1 if g == 0 else 2)] += 1
        print(f"  {season}: {len(te)} graded games, {fired} signal-bets")

    rows = []
    for key, by_season in sorted(tally.items()):
        w = sum(v[0] for v in by_season.values())
        l = sum(v[1] for v in by_season.values())
        p = sum(v[2] for v in by_season.values())
        n = w + l
        if n == 0:
            continue
        prof = sum(1 for v in by_season.values() if v[0] + v[1] and (v[0] * 0.909 - v[1]) > 0)
        rows.append(dict(
            signal_key=key, backtest_w=w, backtest_l=l, backtest_p=p, backtest_n=n,
            backtest_hit=round(w / n, 4), backtest_roi=round((w * 0.909 - l) / n, 4),
            backtest_seasons=len(by_season), backtest_seasons_profitable=prof,
            backtest_window=f"{lo}-{hi}",
            # dict, not a JSON string: a jsonb column fed a string stores a JSON
            # *string*, so `->>'2025'` then returns nothing.
            backtest_by_season={str(s): {"w": v[0], "l": v[1], "p": v[2]}
                                for s, v in sorted(by_season.items())},
        ))
    rows.sort(key=lambda r: -r["backtest_n"])
    print(f"\n{len(rows)} signals measured ({lo}-{hi}), graded on each spot's own line\n")
    print(f"{'signal_key':<28}{'record':>14}{'hit':>8}{'roi':>8}{'szns':>6}{'prof':>6}")
    for r in rows:
        rec = f"{r['backtest_w']}-{r['backtest_l']}" + (f"-{r['backtest_p']}" if r['backtest_p'] else "")
        print(f"{r['signal_key']:<28}{rec:>14}{r['backtest_hit']*100:>7.1f}%{r['backtest_roi']*100:>+7.1f}%"
              f"{r['backtest_seasons']:>6}{r['backtest_seasons_profitable']:>6}")
    Path("out").mkdir(exist_ok=True)
    _csv = [{**r, "backtest_by_season": json.dumps(r["backtest_by_season"])} for r in rows]
    pd.DataFrame(_csv).to_csv("out/signal_backtests.csv", index=False)
    print(f"\n-> out/signal_backtests.csv")

    if not a.write:
        print("(--write not set; nothing sent to cfb_signal_defs)")
        return
    key = ""
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            key = line.split("=", 1)[1].strip(); break
    hdr = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
           "Prefer": "return=minimal"}
    ok = 0
    for r in rows:
        resp = requests.patch(f"{BASE}/cfb_signal_defs?signal_key=eq.{r['signal_key']}",
                              headers=hdr, json={k: v for k, v in r.items() if k != "signal_key"},
                              timeout=60)
        if resp.status_code in (200, 204):
            ok += 1
        else:
            print(f"  {r['signal_key']}: {resp.status_code} {resp.text[:160]}")
    print(f"wrote {ok}/{len(rows)} signal_defs rows")


if __name__ == "__main__":
    main()
