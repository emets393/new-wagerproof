#!/usr/bin/env python3
"""Export the six-season NBA results + consensus-close warehouse to Supabase `nba_games_hist` (CFB project) -- the history
behind the apps' NBA head-to-head / last-5 records and the Outliers trend cards (cfb_automation nba_team_trends_daily.py
appends the current season from nba_schedule + nba_odds_snapshots). One-off; re-run is idempotent (upsert on espn_game_id).

Sources (data/parquet, built by fetch.py / parse.py / build_openclose.py):
  results_nba            ESPN results: espn_id, date_et, start_utc, full names, final + FIRST-HALF scores     (2020-21..2025-26)
  games_nba              Odds API event_id <-> espn_id (+ the Odds API's own scores, used to detect flipped orientation)
  openclose_nba_*        per event x book opener + T-60 close FG spread/total/moneyline, cross-book consensus medians
  h1tt_nba_*             per event x book T-60 first-half spread/total/moneyline + team totals                  (2023-24..)
  bdl_games              balldontlie schedule: postseason flag by (date, home abbr)

Team ids are balldontlie (nba_teams_master.team_id_bdl) via the full-name map below; All-Star rows (no team) are dropped.
Moneylines: a cross-book median inside (-100, 100) is not a price (books disagreed on the favorite) -> NULL.

Run:  SUPABASE_SERVICE_KEY=... python3 export_nba_games_hist.py [--dry-run]
"""
import glob
import os
import sys

import numpy as np
import pandas as pd
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.environ.get("BBALL_PARQUET_DIR") or os.path.join(HERE, "data", "parquet")   # the parquet warehouse is gitignored; point a clean checkout at it
URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/nba_games_hist"
DRY = "--dry-run" in sys.argv

TEAMS = {  # full name -> (balldontlie id, abbr); both Clippers spellings appear across feeds
    "Atlanta Hawks": (1, "ATL"), "Boston Celtics": (2, "BOS"), "Brooklyn Nets": (3, "BKN"), "Charlotte Hornets": (4, "CHA"),
    "Chicago Bulls": (5, "CHI"), "Cleveland Cavaliers": (6, "CLE"), "Dallas Mavericks": (7, "DAL"), "Denver Nuggets": (8, "DEN"),
    "Detroit Pistons": (9, "DET"), "Golden State Warriors": (10, "GSW"), "Houston Rockets": (11, "HOU"), "Indiana Pacers": (12, "IND"),
    "LA Clippers": (13, "LAC"), "Los Angeles Clippers": (13, "LAC"), "Los Angeles Lakers": (14, "LAL"), "Memphis Grizzlies": (15, "MEM"),
    "Miami Heat": (16, "MIA"), "Milwaukee Bucks": (17, "MIL"), "Minnesota Timberwolves": (18, "MIN"), "New Orleans Pelicans": (19, "NOP"),
    "New York Knicks": (20, "NYK"), "Oklahoma City Thunder": (21, "OKC"), "Orlando Magic": (22, "ORL"), "Philadelphia 76ers": (23, "PHI"),
    "Phoenix Suns": (24, "PHX"), "Portland Trail Blazers": (25, "POR"), "Sacramento Kings": (26, "SAC"), "San Antonio Spurs": (27, "SAS"),
    "Toronto Raptors": (28, "TOR"), "Utah Jazz": (29, "UTA"), "Washington Wizards": (30, "WAS"),
}


def med(s):
    s = pd.to_numeric(s, errors="coerce").dropna()
    return float(s.median()) if len(s) else np.nan


def main():
    R = pd.read_parquet(os.path.join(P, "results_nba.parquet")).drop_duplicates("espn_id")
    R = R[R.home_team.isin(TEAMS) & R.away_team.isin(TEAMS)].copy()          # drops All-Star exhibitions
    R["season_end"] = R.season.str[:4].astype(int) + 1
    R["espn_id"] = R.espn_id.astype(int)

    G = pd.read_parquet(os.path.join(P, "games_nba.parquet")).dropna(subset=["espn_id"])
    G["espn_id"] = G.espn_id.astype(int)
    oc = pd.concat([pd.read_parquet(f) for f in sorted(glob.glob(os.path.join(P, "openclose_nba_*.parquet")))], ignore_index=True)
    fg = oc.groupby("event_id").agg(close_spread=("cons_close_spread", "first"), close_total=("cons_close_total", "first"),
                                    close_ml_home=("close_ml_home_price", med), close_ml_away=("close_ml_away_price", med)).reset_index()
    h1 = pd.concat([pd.read_parquet(f) for f in sorted(glob.glob(os.path.join(P, "h1tt_nba_*.parquet")))], ignore_index=True)
    hh = h1.groupby("event_id").agg(h1_spread=("h1_spread_home_point", med), h1_total=("h1_total_point", med),
                                    h1_ml_home=("h1_ml_home_price", med), h1_ml_away=("h1_ml_away_price", med),
                                    tt_home=("tt_home_point", med), tt_away=("tt_away_point", med)).reset_index()
    L = G[["event_id", "espn_id", "home_score", "away_score"]].merge(fg, on="event_id", how="left").merge(hh, on="event_id", how="left")
    L = L.rename(columns={"home_score": "oa_home_score", "away_score": "oa_away_score"}).drop_duplicates("espn_id")

    W = R.merge(L, on="espn_id", how="left")
    # Orientation: the Odds API's home/away can be the reverse of ESPN's (neutral-site / international games). Resolve by
    # matching the Odds API scores to ESPN's; a flipped pair negates the spread and swaps moneylines / team totals.
    same = (W.oa_home_score == W.home_score) & (W.oa_away_score == W.away_score)
    flip = (W.oa_home_score == W.away_score) & (W.oa_away_score == W.home_score) & ~same
    unk = W.oa_home_score.notna() & ~same & ~flip
    for c in ("close_spread", "h1_spread"):
        W.loc[flip, c] = -W.loc[flip, c]
    for a, b in (("close_ml_home", "close_ml_away"), ("h1_ml_home", "h1_ml_away"), ("tt_home", "tt_away")):
        W.loc[flip, [a, b]] = W.loc[flip, [b, a]].values
    W.loc[unk, ["close_spread", "close_total", "close_ml_home", "close_ml_away", "h1_spread", "h1_total", "h1_ml_home", "h1_ml_away", "tt_home", "tt_away"]] = np.nan

    B = pd.read_parquet(os.path.join(P, "bdl_games.parquet"), columns=["date", "home_team.abbreviation", "postseason"])
    post = {(str(d), a) for d, a, p in B.itertuples(index=False) if p}
    W["home_abbr"] = W.home_team.map(lambda t: TEAMS[t][1])
    W["away_abbr"] = W.away_team.map(lambda t: TEAMS[t][1])
    W["game_type"] = [("postseason" if (str(d), a) in post else "regular") for d, a in zip(W.date_et, W.home_abbr)]

    for c in ("close_ml_home", "close_ml_away", "h1_ml_home", "h1_ml_away"):
        W[c] = W[c].round()
        W.loc[W[c].abs() < 100, c] = np.nan
    out = pd.DataFrame({
        "espn_game_id": W.espn_id, "season": W.season_end, "date_et": W.date_et.astype(str),
        "start_utc": pd.to_datetime(W.start_utc, utc=True).dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "home_team": W.home_team, "away_team": W.away_team,
        "home_team_id": W.home_team.map(lambda t: TEAMS[t][0]), "away_team_id": W.away_team.map(lambda t: TEAMS[t][0]),
        "home_abbr": W.home_abbr, "away_abbr": W.away_abbr, "neutral_site": None, "game_type": W.game_type,
        "home_score": W.home_score.astype(int), "away_score": W.away_score.astype(int), "home_h1": W.home_h1, "away_h1": W.away_h1,
        **{c: W[c] for c in ("close_spread", "close_total", "close_ml_home", "close_ml_away", "h1_spread", "h1_total", "h1_ml_home", "h1_ml_away", "tt_home", "tt_away")},
        "line_source": "research warehouse (openclose_nba / h1tt_nba)"})
    print(f"{len(out):,} games {out.season.min()}..{out.season.max()}; close {out.close_spread.notna().sum():,}; 1H line {out.h1_spread.notna().sum():,}; "
          f"TT {out.tt_home.notna().sum():,}; 1H scores {out.home_h1.notna().sum():,}; flipped {int(flip.sum())}, unresolved {int(unk.sum())}; postseason {(out.game_type == 'postseason').sum()}")
    print(out.groupby("season").agg(n=("espn_game_id", "size"), close=("close_spread", "count"), h1=("h1_spread", "count")).to_string())
    if DRY:
        print(out.head(3).to_string())
        return
    key = os.environ["SUPABASE_SERVICE_KEY"]
    H = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"}
    rows = out.astype(object).where(pd.notna(out), None).to_dict("records")
    for i in range(0, len(rows), 1000):
        r = requests.post(URL, params={"on_conflict": "espn_game_id"}, headers=H, json=rows[i:i + 1000], timeout=180)
        if r.status_code not in (200, 201, 204):
            sys.exit(f"upsert failed {r.status_code}: {r.text[:300]}")
    print("loaded")


if __name__ == "__main__":
    main()
