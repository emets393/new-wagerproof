#!/usr/bin/env python3
"""NBA public-betting splits from Action Network — fetch, cache, and frame.

Everything a game needs travels in ONE payload per slate date: both teams, the consensus
closing line, the opener, the ticket and money percentages, and the final score. So there
is no crosswalk to any other table and no cached artifact to go stale — the two bugs that
bit the football version of this both came from joining to something else.

    python3 fetch_nba.py --seasons 2024 2025           fetch (AN season labels, see below)
    python3 fetch_nba.py --seasons 2024 --probe        one month, for validation

## The endpoint

    https://api.actionnetwork.com/web/v2/scoreboard/nba
        ?period=game&date=YYYYMMDD&bookIds=15,30,68,69,71,75,79,123,2988,4727

⛔ FOUR TRAPS, all verified 2026-10-16. Do not rediscover them.

1. `bookIds` is camelCase and the FULL ten-id list is load-bearing. `book_ids=` returns
   `games: []`. A SHORT list returns the games with `markets: {}` — no odds, no splits,
   and NO ERROR. A thin result is a bad query, not a quiet night.

2. NBA is DATE-based, not week-based. `date=YYYYMMDD` is the ET slate date and must be
   passed ALONE — adding `season=` returns zero games. Consecutive dates do not overlap.

3. Book ids mean specific things. 30 = the OPENER (no `bet_info`; an opening line has no
   splits). 15 = the CONSENSUS: the current line AND the percentages the page prints.
   The other eight are individual sportsbooks. The percentages are a GAME-level figure
   repeated on every book, so they are read once, from 15.

4. ⛔ ACTION NETWORK LABELS NBA SEASONS BY START YEAR. A January 2025 game carries
   `season: 2024`. Every other piece of NBA work in this repo labels by END year (see the
   `nba-granular-data-source` note), so this module converts: `season_end = season + 1`.
   The `--seasons` argument takes AN's START-year label because that is what the payload
   carries; the frame carries `season` as the END year. Getting this backwards joins
   2024-25 data onto 2023-24 rows and nothing errors.
   Related: `start_time` is UTC, so a 7pm ET tip is next-day UTC. Slate day comes from the
   `date` parameter, never from slicing `start_time`.
"""
import argparse
import json
import os
import time
from datetime import date, timedelta

import numpy as np
import pandas as pd
from urllib.request import Request, urlopen
from urllib.parse import urlencode

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "data", "an_cache")
API = "https://api.actionnetwork.com/web/v2/scoreboard/nba"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0 Safari/537.36")
BOOK_IDS = "15,30,68,69,71,75,79,123,2988,4727"
CONSENSUS, OPENER = "15", "30"

# AN start-year label -> (first slate date, last slate date) covering regular season,
# play-in and playoffs. Generous at both ends; empty days simply return no games.
SEASON_SPAN = {
    2022: ("2022-10-15", "2023-06-20"),
    2023: ("2023-10-15", "2024-06-25"),
    2024: ("2024-10-15", "2025-06-25"),
    2025: ("2025-10-15", "2026-06-25"),
    2026: ("2026-10-15", "2027-06-25"),
}


def fetch_date(d: date, force=False):
    os.makedirs(CACHE, exist_ok=True)
    f = os.path.join(CACHE, f"nba_{d:%Y%m%d}.json")
    if os.path.exists(f) and not force:
        with open(f) as fh:
            return json.load(fh)
    q = urlencode({"period": "game", "date": f"{d:%Y%m%d}", "bookIds": BOOK_IDS})
    req = Request(f"{API}?{q}", headers={"User-Agent": UA,
                                         "Referer": "https://www.actionnetwork.com/",
                                         "Accept": "application/json"})
    with urlopen(req, timeout=45) as r:
        data = json.loads(r.read().decode())
    with open(f, "w") as fh:
        json.dump(data, fh)
    time.sleep(0.45)
    return data


def pct(o, kind):
    bi = (o or {}).get("bet_info") or {}
    return (bi.get(kind) or {}).get("percent")


def side(rows, which):
    return next((o for o in (rows or []) if o.get("side") == which), None)


def rows_for_date(d: date, payload):
    out = []
    for g in payload.get("games") or []:
        if g.get("status") != "complete":
            continue
        b = g.get("boxscore") or {}
        hp, ap = b.get("total_home_points"), b.get("total_away_points")
        if hp is None or ap is None:
            continue
        mk = g.get("markets") or {}
        con = ((mk.get(CONSENSUS) or {}).get("event") or {})
        opn = ((mk.get(OPENER) or {}).get("event") or {})
        sp_h, sp_a = side(con.get("spread"), "home"), side(con.get("spread"), "away")
        ov, un = side(con.get("total"), "over"), side(con.get("total"), "under")
        ml_h, ml_a = side(con.get("moneyline"), "home"), side(con.get("moneyline"), "away")
        if not sp_h or sp_h.get("value") is None:
            continue
        teams = {t["id"]: t for t in g.get("teams") or []}
        h, a = teams.get(g.get("home_team_id")), teams.get(g.get("away_team_id"))
        if not h or not a:
            continue
        o_sp = side(opn.get("spread"), "home")
        o_ov = side(opn.get("total"), "over")
        out.append(dict(
            # ⛔ END-year convention, converted from AN's start-year label. See the module
            # docstring: getting this backwards silently joins onto the wrong season.
            season=int(g["season"]) + 1,
            an_season=int(g["season"]),
            slate_date=pd.Timestamp(d),
            game_id=g["id"],
            tip_utc=pd.Timestamp(g["start_time"]) if g.get("start_time") else pd.NaT,
            away=a.get("display_name"), home=h.get("display_name"),
            away_abbr=a.get("abbr"), home_abbr=h.get("abbr"),
            home_spread=float(sp_h["value"]),
            home_spread_open=float(o_sp["value"]) if o_sp and o_sp.get("value") is not None else np.nan,
            total_line=float(ov["value"]) if ov and ov.get("value") is not None else np.nan,
            total_open=float(o_ov["value"]) if o_ov and o_ov.get("value") is not None else np.nan,
            ml_home=ml_h.get("odds") if ml_h else np.nan,
            ml_away=ml_a.get("odds") if ml_a else np.nan,
            tix_away=pct(sp_a, "tickets"), mny_away=pct(sp_a, "money"),
            tix_over=pct(ov, "tickets"), mny_over=pct(ov, "money"),
            tix_ml_away=pct(ml_a, "tickets"), mny_ml_away=pct(ml_a, "money"),
            home_pts=int(hp), away_pts=int(ap),
            tickets=g.get("num_bets"),
            game_type=g.get("type"),
        ))
    return out


def fetch_season(an_season, probe=False, force=False):
    lo, hi = SEASON_SPAN[an_season]
    d0, d1 = date.fromisoformat(lo), date.fromisoformat(hi)
    if probe:
        d1 = d0 + timedelta(days=30)
    rows, days, got = [], 0, 0
    d = d0
    while d <= d1:
        try:
            p = fetch_date(d, force=force)
        except Exception as e:
            print(f"  [{d}] fetch failed ({type(e).__name__}) — skipped")
            d += timedelta(days=1)
            continue
        r = rows_for_date(d, p)
        if r:
            got += 1
        rows += r
        days += 1
        if days % 40 == 0:
            print(f"  ... {d} ({len(rows)} games so far)")
        d += timedelta(days=1)
    print(f"  season {an_season} ({an_season + 1} end-year): {len(rows)} completed games "
          f"over {got} slate days of {days} scanned")
    return rows


def derive(d):
    """Market-ready columns. Graded from the SCOREBOARD, never read back off a column."""
    if d.empty:
        return d
    d = d.copy()
    d["margin"] = d.home_pts - d.away_pts
    d["total_pts"] = d.home_pts + d.away_pts
    d["home_ats"] = d.margin + d.home_spread
    d["ou_margin"] = d.total_pts - d.total_line
    d["fav_away"] = d.home_spread > 0
    d["mag"] = d.home_spread.abs()

    for c in ("tix_away", "mny_away", "tix_over", "mny_over", "tix_ml_away", "mny_ml_away"):
        d[c] = pd.to_numeric(d[c], errors="coerce")

    d["sp_ok"] = (d.home_ats != 0) & d.tix_away.notna() & (d.tix_away != 50)
    d["home_covered"] = d.home_ats > 0
    d["pub_away"] = d.tix_away > 50
    d["pub_pct"] = np.where(d.pub_away, d.tix_away, 100 - d.tix_away)
    d["pub_covered"] = np.where(d.pub_away, ~d.home_covered, d.home_covered)
    d["fav_covered"] = np.where(d.fav_away, ~d.home_covered, d.home_covered)

    d["ou_ok"] = d.ou_margin.notna() & (d.ou_margin != 0) & d.tix_over.notna() & (d.tix_over != 50)
    d["over_hit"] = d.ou_margin > 0
    d["pub_over"] = d.tix_over > 50
    d["ou_pub_pct"] = np.where(d.pub_over, d.tix_over, 100 - d.tix_over)
    d["ou_pub_won"] = np.where(d.pub_over, d.over_hit, ~d.over_hit)

    d["ml_ok"] = d.tix_ml_away.notna() & (d.tix_ml_away != 50) & (d.margin != 0)
    d["home_won"] = d.margin > 0
    d["ml_pub_away"] = d.tix_ml_away > 50
    d["ml_pub_won"] = np.where(d.ml_pub_away, ~d.home_won, d.home_won)
    return d


def guard(d):
    """Orientation guard, per season. A sign flip is silent otherwise."""
    for s, g in d[d.sp_ok].groupby("season"):
        hc = g.home_covered.mean()
        assert 0.40 < hc < 0.60, f"season {s}: home cover {hc:.1%} — orientation is wrong"
        print(f"    {s}: home covers {hc:.1%}  (n={len(g)})  — guard OK")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seasons", type=int, nargs="+", default=[2023, 2024, 2025],
                    help="AN START-year labels; 2024 means the 2024-25 season")
    ap.add_argument("--probe", action="store_true", help="first 30 days only")
    ap.add_argument("--force", action="store_true", help="ignore the disk cache")
    a = ap.parse_args()

    rows = []
    for s in a.seasons:
        if s not in SEASON_SPAN:
            print(f"no date span defined for AN season {s}")
            continue
        print(f"[{s}] {SEASON_SPAN[s][0]} -> {SEASON_SPAN[s][1]}"
              + ("  (PROBE: 30 days)" if a.probe else ""))
        rows += fetch_season(s, probe=a.probe, force=a.force)

    d = derive(pd.DataFrame(rows))
    if d.empty:
        print("no games")
        return
    print(f"\n{len(d)} completed games "
          f"(spread gradable {int(d.sp_ok.sum())}, totals {int(d.ou_ok.sum())}, "
          f"ml {int(d.ml_ok.sum())})")
    guard(d)

    out = os.path.join(HERE, "data", "nba_splits.parquet")
    if not a.probe:
        d.to_parquet(out, index=False)
        print(f"-> {out}")
    else:
        print("(probe: not written)")


if __name__ == "__main__":
    main()
