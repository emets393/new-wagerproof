#!/usr/bin/env python3
"""NCAAB public-betting splits from Action Network — fetch, cache, and frame.

Port of ../nba-splits/fetch_nba.py. One payload per ET slate date carries both teams, the
consensus closing line, the opener, the ticket and money percentages, and the final score
(with first-half points), so nothing is joined to anything.

    python3 fetch_ncaab.py --seasons 2024 2025        AN START-year labels (2024 = 2024-25)
    python3 fetch_ncaab.py --seasons 2025 --probe     one month, for validation

## The endpoint

    https://api.actionnetwork.com/web/v2/scoreboard/ncaab
        ?period=game&date=YYYYMMDD&division=D1&bookIds=15,30,68,69,71,75,79,123,2988,4727

All four NBA traps apply (camelCase `bookIds` with the full ten-id list; `date` passed
ALONE; book 30 = opener, 15 = consensus with the splits; AN labels the season by START
year, this frame by END year). Two more are college-specific, verified 2026-10-26:

5. ⛔ `division=D1` is load-bearing. Without it the endpoint serves a "featured" handful —
   7 games on a 47-game Wednesday, 1 game on a 60-game Sunday — with no error. A thin
   day is a missing parameter, not a quiet slate.

6. ⛔ Percentages exist only from 2024-25 on. Every 2019-20 through 2023-24 game comes
   back with `bet_info` absent (probed Nov, Jan and Mar of each season), so the usable
   history is two seasons: AN 2024 and 2025. The lines and scores DO exist for the
   earlier years if a study ever needs them without the splits.

Division I only; `conference_type` is carried for conference splits. `game_type` is AN's
`type` (reg / post). First-half points come from the boxscore for 1H work.
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
API = "https://api.actionnetwork.com/web/v2/scoreboard/ncaab"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0 Safari/537.36")
BOOK_IDS = "15,30,68,69,71,75,79,123,2988,4727"
CONSENSUS, OPENER = "15", "30"

# AN start-year label -> (first slate date, last slate date): opening night through the
# national championship, generous both ends. Empty days simply return no games.
SEASON_SPAN = {
    2022: ("2022-11-01", "2023-04-10"),
    2023: ("2023-11-01", "2024-04-10"),
    2024: ("2024-11-01", "2025-04-10"),
    2025: ("2025-11-01", "2026-04-10"),
    2026: ("2026-11-01", "2027-04-10"),
}


def fetch_date(d: date, force=False):
    os.makedirs(CACHE, exist_ok=True)
    f = os.path.join(CACHE, f"ncaab_{d:%Y%m%d}.json")
    if os.path.exists(f) and not force:
        with open(f) as fh:
            return json.load(fh)
    q = urlencode({"period": "game", "date": f"{d:%Y%m%d}", "division": "D1", "bookIds": BOOK_IDS})
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


def fnum(o, key="value"):
    return float(o[key]) if o and o.get(key) is not None else np.nan


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
        ranks = g.get("ranks") or {}
        out.append(dict(
            season=int(g["season"]) + 1,          # END-year convention, see docstring
            an_season=int(g["season"]),
            slate_date=pd.Timestamp(d),
            game_id=g["id"],
            tip_utc=pd.Timestamp(g["start_time"]) if g.get("start_time") else pd.NaT,
            away=a.get("display_name"), home=h.get("display_name"),
            away_full=a.get("full_name"), home_full=h.get("full_name"),
            away_abbr=a.get("abbr"), home_abbr=h.get("abbr"),
            away_id=a.get("id"), home_id=h.get("id"),
            away_conf=a.get("conference_type"), home_conf=h.get("conference_type"),
            home_spread=float(sp_h["value"]), home_spread_price=sp_h.get("odds"), away_spread_price=sp_a.get("odds") if sp_a else np.nan,
            home_spread_open=fnum(side(opn.get("spread"), "home")),
            total_line=fnum(ov), over_price=ov.get("odds") if ov else np.nan, under_price=un.get("odds") if un else np.nan,
            total_open=fnum(side(opn.get("total"), "over")),
            ml_home=ml_h.get("odds") if ml_h else np.nan,
            ml_away=ml_a.get("odds") if ml_a else np.nan,
            ml_home_open=fnum(side(opn.get("moneyline"), "home"), "odds"),
            ml_away_open=fnum(side(opn.get("moneyline"), "away"), "odds"),
            tix_away=pct(sp_a, "tickets"), mny_away=pct(sp_a, "money"),
            tix_over=pct(ov, "tickets"), mny_over=pct(ov, "money"),
            tix_ml_away=pct(ml_a, "tickets"), mny_ml_away=pct(ml_a, "money"),
            home_pts=int(hp), away_pts=int(ap),
            home_1h=b.get("total_home_firsthalf_points"), away_1h=b.get("total_away_firsthalf_points"),
            tickets=g.get("num_bets"),
            game_type=g.get("type"),
            home_rank=(ranks.get("home") or {}).get("rank") if isinstance(ranks, dict) else None,
            away_rank=(ranks.get("away") or {}).get("rank") if isinstance(ranks, dict) else None,
            broadcast=(g.get("broadcast") or {}).get("network") if isinstance(g.get("broadcast"), dict) else None,
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
            print(f"  [{d}] fetch failed ({type(e).__name__}) — skipped", flush=True)
            d += timedelta(days=1)
            continue
        r = rows_for_date(d, p)
        if r:
            got += 1
        rows += r
        days += 1
        if days % 30 == 0:
            print(f"  ... {d} ({len(rows)} games so far)", flush=True)
        d += timedelta(days=1)
    print(f"  season {an_season} ({an_season + 1} end-year): {len(rows)} completed games "
          f"over {got} slate days of {days} scanned", flush=True)
    return rows


def derive(d):
    """Market-ready columns. Graded from the SCOREBOARD, never read back off a column.
    Same placeholder rule as the NBA frame: a 0/100 split is a feed placeholder, not a crowd."""
    if d.empty:
        return d
    d = d.copy()
    d["margin"] = d.home_pts - d.away_pts
    d["total_pts"] = d.home_pts + d.away_pts
    d["home_ats"] = d.margin + d.home_spread
    d["ou_margin"] = d.total_pts - d.total_line
    d["fav_away"] = d.home_spread > 0
    d["mag"] = d.home_spread.abs()
    d["conf_game"] = (d.home_conf == d.away_conf) & d.home_conf.notna()

    for c in ("tix_away", "mny_away", "tix_over", "mny_over", "tix_ml_away", "mny_ml_away"):
        d[c] = pd.to_numeric(d[c], errors="coerce")

    d["placeholder_sp"] = d.tix_away.isin([0, 100])
    d["placeholder_ou"] = d.tix_over.isin([0, 100])
    d["placeholder_ml"] = d.tix_ml_away.isin([0, 100])

    d["sp_ok"] = ((d.home_ats != 0) & d.tix_away.notna() & (d.tix_away != 50)
                  & ~d.placeholder_sp)
    d["home_covered"] = d.home_ats > 0
    d["pub_away"] = d.tix_away > 50
    d["pub_pct"] = np.where(d.pub_away, d.tix_away, 100 - d.tix_away)
    d["pub_covered"] = np.where(d.pub_away, ~d.home_covered, d.home_covered)
    d["fav_covered"] = np.where(d.fav_away, ~d.home_covered, d.home_covered)

    d["ou_ok"] = (d.ou_margin.notna() & (d.ou_margin != 0) & d.tix_over.notna()
                  & (d.tix_over != 50) & ~d.placeholder_ou)
    d["over_hit"] = d.ou_margin > 0
    d["pub_over"] = d.tix_over > 50
    d["ou_pub_pct"] = np.where(d.pub_over, d.tix_over, 100 - d.tix_over)
    d["ou_pub_won"] = np.where(d.pub_over, d.over_hit, ~d.over_hit)

    d["ml_ok"] = (d.tix_ml_away.notna() & (d.tix_ml_away != 50) & (d.margin != 0)
                  & ~d.placeholder_ml)
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
    ap.add_argument("--seasons", type=int, nargs="+", default=[2024, 2025],
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
              + ("  (PROBE: 30 days)" if a.probe else ""), flush=True)
        rows += fetch_season(s, probe=a.probe, force=a.force)

    d = derive(pd.DataFrame(rows))
    if d.empty:
        print("no games")
        return
    print(f"\n{len(d)} completed games "
          f"(spread gradable {int(d.sp_ok.sum())}, totals {int(d.ou_ok.sum())}, "
          f"ml {int(d.ml_ok.sum())})")
    guard(d)

    out = os.path.join(HERE, "data", "ncaab_splits.parquet")
    if not a.probe:
        d.to_parquet(out, index=False)
        print(f"-> {out}")
    else:
        print("(probe: not written)")


if __name__ == "__main__":
    main()
