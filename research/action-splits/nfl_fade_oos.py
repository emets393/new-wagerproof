#!/usr/bin/env python3
"""Out-of-sample test of the NFL heavy-public spread fade, on 2023-2025.

The rule came off 2026 weeks 1-6 (see nfl_fade.py and the README): when a side holds
>=70% of spread tickets, FADE it. 16-6, +38.8% at -110, and it survived a size-matched
line-size control. n was 22. This file applies that rule, UNCHANGED and UNFITTED, to the
three completed seasons before it.

⛔ NFL ONLY. No CFB anywhere in here, and a CFB result is not evidence about this one.

## Why this is a clean test

Nothing is fitted here. The threshold (70%), the side (fade), and the price (-110) are
all fixed in advance by the 2026 work. Each prior season is scored independently, so
three seasons are three separate verdicts, not one pooled number that a single good year
can carry.

## Grading is self-contained, which removes the usual failure modes

Everything comes out of one Action Network payload per week: the consensus closing spread
(book 15), the ticket and money shares, and the final score from `boxscore`. So there is
no name crosswalk, no join to model_games or nflverse, and no stale cached artifact — the
two bugs that have already bitten this directory both came from joining to something else.
ATS is computed from the SCOREBOARD (home points minus away points against the home
spread), never read back off a graded column, and `check()` asserts the home cover rate
lands near half in every season as an orientation guard.

⚠ ONE REAL CAVEAT, and it cuts at the heart of the comparison. For a COMPLETED season the
endpoint serves the FINAL splits. The 2026 weeks this rule was built on were captured
mid-week by hand. Those are not the same measurement: ticket counts climb until kickoff
and late money moves the percentages, so a "70% side" on Thursday is not necessarily a
70% side at kickoff. The distribution block below prints the share of games past the
threshold per season so that difference is visible rather than assumed away. If 2026 sits
far off the historical seasons, the threshold does not transfer literally and the SHAPE
of the dose curve is the thing to read instead.

    python3 nfl_fade_oos.py [--seasons 2023 2024 2025]
"""
import argparse
import json
import os
import time

import numpy as np
import pandas as pd

import fetch_action as FA

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "data", "an_nfl_cache")
THRESHOLD = 70.0          # fixed by the 2026 work; do not tune here
PRICE = -110.0


def wilson(k, n, z=1.96):
    if n == 0:
        return (np.nan, np.nan)
    p, d = k / n, 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0, c - h), min(1, c + h))


def week_payload(season, week):
    os.makedirs(CACHE, exist_ok=True)
    f = os.path.join(CACHE, f"nfl_{season}_{week}.json")
    if os.path.exists(f):
        with open(f) as fh:
            return json.load(fh)
    d = FA.get("nfl", season, week)
    with open(f, "w") as fh:
        json.dump(d, fh)
    time.sleep(0.6)
    return d


def games(season):
    rows = []
    for week in range(1, 19):
        try:
            d = week_payload(season, week)
        except Exception as e:
            print(f"  [{season} wk{week}] fetch failed ({type(e).__name__})")
            continue
        for g in d.get("games") or []:
            if g.get("status") != "complete":
                continue
            b = g.get("boxscore") or {}
            hp, ap = b.get("total_home_points"), b.get("total_away_points")
            if hp is None or ap is None:
                continue
            sp = (((g.get("markets") or {}).get("15") or {}).get("event") or {}).get("spread")
            if not sp:
                continue
            home = next((o for o in sp if o["side"] == "home"), None)
            away = next((o for o in sp if o["side"] == "away"), None)
            if not home or not away or home.get("value") is None:
                continue
            bi = (away.get("bet_info") or {})
            tix = (bi.get("tickets") or {}).get("percent")
            mny = (bi.get("money") or {}).get("percent")
            if tix is None:
                continue
            rows.append(dict(season=season, week=int(g["week"]), game_id=g["id"],
                             home_spread=float(home["value"]),
                             tix_away=float(tix),
                             mny_away=float(mny) if mny is not None else np.nan,
                             home_pts=int(hp), away_pts=int(ap),
                             tickets=g.get("num_bets")))
    d = pd.DataFrame(rows)
    if d.empty:
        return d
    # ATS straight off the scoreboard. home covers when margin beats the home spread.
    d["home_ats"] = (d.home_pts - d.away_pts) + d.home_spread
    d = d[d.home_ats != 0]                      # pushes are no action
    d["home_covered"] = d.home_ats > 0
    d = d[d.tix_away != 50]
    d["pub_away"] = d.tix_away > 50
    d["pub_pct"] = np.where(d.pub_away, d.tix_away, 100 - d.tix_away)
    d["pub_money"] = np.where(d.pub_away, d.mny_away, 100 - d.mny_away)
    d["pub_covered"] = np.where(d.pub_away, ~d.home_covered, d.home_covered)
    return d


def check(d, season):
    """Orientation guard: home teams cover near half, never 3/4."""
    hc = d.home_covered.mean()
    assert 0.35 < hc < 0.65, f"{season}: home cover {hc:.1%} — orientation is wrong"
    return hc


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seasons", type=int, nargs="+", default=[2023, 2024, 2025])
    a = ap.parse_args()

    all_d = {}
    for s in a.seasons:
        d = games(s)
        if d.empty:
            print(f"{s}: no usable games")
            continue
        hc = check(d, s)
        all_d[s] = d
        print(f"{s}: {len(d)} graded games, home cover {hc:.1%} (orientation OK)")

    if not all_d:
        return

    print("\n" + "=" * 78)
    print("IS THE MEASUREMENT COMPARABLE? share of games past the threshold")
    print("=" * 78)
    print("  (a completed season serves FINAL splits; the 2026 rule was built on "
          "mid-week pastes)")
    for s, d in all_d.items():
        print(f"    {s}: median crowd {d.pub_pct.median():.0f}%   "
              f">=70% in {(d.pub_pct >= THRESHOLD).mean():.0%} of games "
              f"({int((d.pub_pct >= THRESHOLD).sum())} of {len(d)})")
    print(f"    2026 reference (the fit sample): >=70% in 31% of games (22 of 72)")

    print("\n" + "=" * 78)
    print(f"THE DOSE CURVE, by season — does the SHAPE repeat?")
    print("=" * 78)
    edges = [(50, 55), (55, 60), (60, 65), (65, 70), (70, 101)]
    print(f"    {'season':<8}" + "".join(f"{lo}-{hi - 1:<8}" for lo, hi in edges))
    for s, d in all_d.items():
        cells = []
        for lo, hi in edges:
            m = d[(d.pub_pct >= lo) & (d.pub_pct < hi)]
            cells.append(f"{m.pub_covered.mean():.0%} ({len(m)})" if len(m) >= 8 else "  -   ")
        print(f"    {s:<8}" + "".join(f"{c:<11}" for c in cells))
    print("    (cell = the crowd's side cover rate, n in brackets)")

    print("\n" + "=" * 78)
    print(f"THE RULE, UNFITTED: fade any side holding >= {THRESHOLD:.0f}% of tickets, "
          f"at {PRICE:.0f}")
    print("=" * 78)
    print(f"    break-even is 52.4%\n")
    tot_w = tot_l = 0
    for s, d in all_d.items():
        h = d[d.pub_pct >= THRESHOLD]
        if not len(h):
            continue
        w = int((~h.pub_covered).sum())
        l = len(h) - w
        tot_w += w
        tot_l += l
        roi = (w * 100 - l * 110) / (len(h) * 110)
        lo, hi = wilson(w, len(h))
        verdict = "profitable" if roi > 0 else "LOSES"
        print(f"    {s}:  {w}-{l}   {w / len(h):6.1%}   roi {roi:+6.1%}   "
              f"95% CI [{lo:.0%}, {hi:.0%}]   {verdict}")
    n = tot_w + tot_l
    if n:
        roi = (tot_w * 100 - tot_l * 110) / (n * 110)
        lo, hi = wilson(tot_w, n)
        print(f"\n    POOLED {min(all_d)}-{max(all_d)}:  {tot_w}-{tot_l}   "
              f"{tot_w / n:6.1%}   roi {roi:+6.1%}   95% CI [{lo:.0%}, {hi:.0%}]   n={n}")
        print(f"    2026 (the fit sample, for contrast):  16-6   72.7%   roi +38.8%   n=22")

    print("\n" + "=" * 78)
    print("MONEY vs TICKETS, pooled across the out-of-sample seasons")
    print("=" * 78)
    pool = pd.concat(all_d.values(), ignore_index=True)
    for lab, col in (("tickets", "pub_pct"), ("money", "pub_money")):
        s = pool.dropna(subset=[col])
        h = s[s[col] >= THRESHOLD]
        if len(h):
            w = int((~h.pub_covered).sum())
            roi = (w * 100 - (len(h) - w) * 110) / (len(h) * 110)
            print(f"    fade >= {THRESHOLD:.0f}% of {lab:<8} {w}-{len(h) - w}  "
                  f"{w / len(h):.1%}  roi {roi:+.1%}  n={len(h)}")
        r = np.corrcoef(s[col], s.pub_covered.astype(float))[0, 1]
        print(f"      continuous corr({lab}%, crowd side covers) = {r:+.3f}  n={len(s)}")


if __name__ == "__main__":
    main()
