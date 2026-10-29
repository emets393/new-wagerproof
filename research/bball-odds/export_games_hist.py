#!/usr/bin/env python3
"""Export the six-season college results + consensus-close warehouse to Supabase `ncaab_games_hist` (CFB project) -- the
history behind the apps' head-to-head and last-5 records (cfb_automation ncaab_team_trends_daily.py appends the current
season from cbb_team_lines_history). One-off; re-run is idempotent (upsert on cbbd_id).

Sources (data/parquet, built by fetch.py / parse.py / build_openclose.py / fetch_stats.py):
  results_ncaab          CBBD results: cbbd_id, scores, FIRST-HALF scores, neutral_site, game_type      (2020-21..2025-26)
  cbbd_team_box          gameId x teamId x isHome -> home/away CBBD team ids, conferenceGame, tournament
  games_ncaab            Odds API event_id <-> cbbd_id (+ the Odds API's own scores, used to detect flipped orientation)
  openclose_ncaab_*      per event x book opener + T-60 close FG spread/total/moneyline, cross-book consensus medians
  h1tt_ncaab_*           per event x book T-60 first-half spread/total/moneyline + team totals                   (2023-24..)

Orientation: the Odds API lists neutral-site games with home/away OPPOSITE of CBBD about half the time. Each event's side
is resolved by matching the Odds API scores to the CBBD scores; a flipped pair negates the spread and swaps the
moneylines / team totals. Events whose scores match neither way keep NULL lines.

Run:  SUPABASE_SERVICE_KEY=... python3 export_games_hist.py [--dry-run]
"""
import glob
import os
import sys

import numpy as np
import pandas as pd
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, "data", "parquet")
URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/ncaab_games_hist"
DRY = "--dry-run" in sys.argv


def med(s):
    s = pd.to_numeric(s, errors="coerce").dropna()
    return float(s.median()) if len(s) else np.nan


def main():
    res = pd.read_parquet(os.path.join(P, "results_ncaab.parquet"))
    res = res.drop_duplicates("cbbd_id")
    res["season_end"] = res.season.str[:4].astype(int) + 1
    tb = pd.read_parquet(os.path.join(P, "cbbd_team_box.parquet"), columns=["gameId", "teamId", "isHome", "conferenceGame", "tournament"])
    home = tb[tb.isHome].drop_duplicates("gameId").set_index("gameId")
    away = tb[~tb.isHome].drop_duplicates("gameId").set_index("gameId")
    res["home_team_id"] = res.cbbd_id.map(home.teamId)
    res["away_team_id"] = res.cbbd_id.map(away.teamId)
    res["conference_game"] = res.cbbd_id.map(home.conferenceGame)
    res["tournament"] = res.cbbd_id.map(home.tournament)

    G = pd.read_parquet(os.path.join(P, "games_ncaab.parquet")).dropna(subset=["cbbd_id"])
    G["cbbd_id"] = G.cbbd_id.astype(int)
    oc = pd.concat([pd.read_parquet(f) for f in sorted(glob.glob(os.path.join(P, "openclose_ncaab_*.parquet")))], ignore_index=True)
    fg = oc.groupby("event_id").agg(close_spread=("cons_close_spread", "first"), close_total=("cons_close_total", "first"),
                                    close_ml_home=("close_ml_home_price", med), close_ml_away=("close_ml_away_price", med)).reset_index()
    h1 = pd.concat([pd.read_parquet(f) for f in sorted(glob.glob(os.path.join(P, "h1tt_ncaab_*.parquet")))], ignore_index=True)
    hh = h1.groupby("event_id").agg(h1_spread=("h1_spread_home_point", med), h1_total=("h1_total_point", med),
                                    h1_ml_home=("h1_ml_home_price", med), h1_ml_away=("h1_ml_away_price", med),
                                    tt_home=("tt_home_point", med), tt_away=("tt_away_point", med)).reset_index()
    L = G[["event_id", "cbbd_id", "home_score", "away_score"]].merge(fg, on="event_id", how="left").merge(hh, on="event_id", how="left")
    L = L.rename(columns={"home_score": "oa_home_score", "away_score": "oa_away_score"})
    L = L.sort_values("event_id").drop_duplicates("cbbd_id")
    X = res.merge(L, on="cbbd_id", how="left")

    same = (X.oa_home_score == X.home_score) & (X.oa_away_score == X.away_score)
    flip = (X.oa_home_score == X.away_score) & (X.oa_away_score == X.home_score) & ~same
    unknown = X.event_id.notna() & ~same & ~flip
    line_cols = ["close_spread", "close_total", "close_ml_home", "close_ml_away", "h1_spread", "h1_total", "h1_ml_home", "h1_ml_away", "tt_home", "tt_away"]
    X.loc[unknown, line_cols] = np.nan
    for a, b in (("close_ml_home", "close_ml_away"), ("h1_ml_home", "h1_ml_away"), ("tt_home", "tt_away")):
        va, vb = X.loc[flip, a].copy(), X.loc[flip, b].copy()
        X.loc[flip, a], X.loc[flip, b] = vb.values, va.values
    X.loc[flip, "close_spread"] = -X.loc[flip, "close_spread"]
    X.loc[flip, "h1_spread"] = -X.loc[flip, "h1_spread"]
    print(f"games {len(X):,}; with an Odds API event {X.event_id.notna().sum():,}; orientation same {same.sum():,} / flipped {flip.sum():,} / "
          f"unresolved {unknown.sum():,}; FG close {X.close_spread.notna().sum():,}; 1H line {X.h1_spread.notna().sum():,}; team totals {X.tt_home.notna().sum():,}")

    W = pd.DataFrame({
        "cbbd_id": X.cbbd_id.astype(int), "season": X.season_end.astype(int), "date_et": pd.to_datetime(X.start_utc, utc=True).dt.tz_convert("America/New_York").dt.date.astype(str),
        "start_utc": pd.to_datetime(X.start_utc, utc=True).dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "home_team": X.home_team, "away_team": X.away_team, "home_team_id": X.home_team_id, "away_team_id": X.away_team_id,
        "neutral_site": X.neutral_site.astype(object), "conference_game": X.conference_game.astype(object), "game_type": X.game_type, "tournament": X.tournament,
        "home_score": X.home_score, "away_score": X.away_score, "home_h1": X.home_h1, "away_h1": X.away_h1,
        **{c: X[c] for c in line_cols}, "line_source": "research_warehouse"})
    for c in ("close_ml_home", "close_ml_away", "h1_ml_home", "h1_ml_away"):
        W[c] = W[c].round()
    W = W.replace({np.nan: None})
    INT_COLS = ("cbbd_id", "season", "home_team_id", "away_team_id", "home_score", "away_score", "home_h1", "away_h1", "close_ml_home", "close_ml_away", "h1_ml_home", "h1_ml_away")
    print(W.groupby("season").agg(games=("cbbd_id", "size"), fg_close=("close_spread", "count"), h1=("h1_spread", "count"), tt=("tt_home", "count")).to_string())
    if DRY:
        print(W.head(3).T.to_string()); return
    key = os.environ["SUPABASE_SERVICE_KEY"]
    H = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"}
    rows = W.to_dict("records")
    for i in range(0, len(rows), 1000):
        def clean(k, v):   # pandas upcasts int+None columns to float; Postgres rejects "34.0" for an integer column
            if v is None or (isinstance(v, float) and v != v):
                return None
            if k in INT_COLS:
                return int(v)
            return v.item() if hasattr(v, "item") else v
        chunk = [{k: clean(k, v) for k, v in r.items()} for r in rows[i:i + 1000]]
        r = requests.post(URL, params={"on_conflict": "cbbd_id"}, headers=H, json=chunk, timeout=180)
        if r.status_code >= 300:
            sys.exit(f"upsert failed {r.status_code}: {r.text[:300]}")
    print(f"upserted {len(rows):,} rows -> ncaab_games_hist")


if __name__ == "__main__":
    main()
