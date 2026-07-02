"""Week 12 2025 DRY RUN — last-5 head-to-head history into nfl_matchup_history.

For each of the 14 Week 12 matchups, store the last 5 prior meetings between the
two franchises (newest-first), strictly before the Week 12 kickoff cutoff. This is
the NFL-only "series history" card; CFB has no equivalent table.

Franchise relocations are folded into current abbreviations (OAK->LV, SD->LAC,
STL->LA) so the series joins to today's teams. matchup_key is the two current
abbreviations sorted and joined with '|', matching public.nfl_matchup_last5().

closing_spread_home uses the dryrun convention (negative = home favored), i.e.
-(nflverse spread_line, which is positive when home is favored).

Usage:  python3 dryrun_wk12_matchups.py [--no-load]
"""
import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
BASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
# Season/week parametrized (env) to match the other slate builders; defaults to the
# Wk12-2025 dry-run so an unparameterized run stays byte-for-byte the original.
SEASON = int(os.environ.get("NFL_SEASON", 2025))
WEEK = int(os.environ.get("NFL_WEEK", 12))
N_LAST = 5
# relocations + scheme normalization -> current abbreviation
RELOC = {"OAK": "LV", "SD": "LAC", "STL": "LA", "LAR": "LA", "WSH": "WAS", "JAC": "JAX"}


def cur(ab):
    return RELOC.get(ab, ab)


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found in .env.local")


def mkey(a, b):
    return "|".join(sorted([a, b]))


def build():
    g = pd.read_parquet(DATA / "nflverse_games.parquet")
    g = g[g.home_score.notna() & g.away_score.notna()].copy()
    g["home_ab"] = g.home_team.map(cur)
    g["away_ab"] = g.away_team.map(cur)
    g["gd"] = pd.to_datetime(g.gameday)
    g["key"] = [mkey(h, a) for h, a in zip(g.home_ab, g.away_ab)]

    # dry-run cutoff: first kickoff of Week 12 2025
    f = pd.read_parquet(DATA / "h1tt_frame.parquet")
    wk = f[(f.season == SEASON) & (f.week == WEEK)].copy()
    cutoff = pd.to_datetime(wk.gameday).min()
    matchups = [(cur(h), cur(a)) for h, a in zip(wk.home_ab, wk.away_ab)]

    g = g[g.gd < cutoff]
    rows = []
    for home_ab, away_ab in matchups:
        key = mkey(home_ab, away_ab)
        sub = g[g.key == key].sort_values("gd", ascending=False).head(N_LAST)
        for _, r in sub.iterrows():
            hs, as_ = int(r.home_score), int(r.away_score)
            csh = -float(r.spread_line) if pd.notna(r.spread_line) else None  # negative = home fav
            tot = float(r.total_line) if pd.notna(r.total_line) else None
            result = hs - as_                                                 # home margin
            total_points = hs + as_
            winner = r.home_ab if hs > as_ else (r.away_ab if as_ > hs else None)
            cover_margin = (result + csh) if csh is not None else None
            if cover_margin is None:
                cover_team, ats_result = None, None
            elif cover_margin > 0:
                cover_team, ats_result = r.home_ab, "HOME"
            elif cover_margin < 0:
                cover_team, ats_result = r.away_ab, "AWAY"
            else:
                cover_team, ats_result = None, "PUSH"
            ou_margin = (total_points - tot) if tot is not None else None
            if ou_margin is None:
                ou_result = None
            elif ou_margin > 0:
                ou_result = "OVER"
            elif ou_margin < 0:
                ou_result = "UNDER"
            else:
                ou_result = "PUSH"
            rows.append(dict(
                matchup_key=key, game_id=r.game_id, season=int(r.season), week=int(r.week),
                date=str(r.gameday), away_team=r.away_ab, home_team=r.home_ab,
                neutral_site=(str(r.location).lower() != "home"),
                away_score=as_, home_score=hs,
                closing_spread_home=round(csh, 1) if csh is not None else None,
                closing_total=round(tot, 1) if tot is not None else None,
                closing_ml_home=int(r.home_moneyline) if pd.notna(r.home_moneyline) else None,
                closing_ml_away=int(r.away_moneyline) if pd.notna(r.away_moneyline) else None,
                winner_team=winner, cover_team=cover_team,
                ats_result=ats_result, ou_result=ou_result,
                total_points=total_points,
                cover_margin_home=round(cover_margin, 1) if cover_margin is not None else None,
                ou_margin=round(ou_margin, 1) if ou_margin is not None else None,
            ))
    return pd.DataFrame(rows), [mkey(h, a) for h, a in matchups]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-load", action="store_true")
    args = ap.parse_args()

    df, keys = build()
    print(f"{len(df)} meetings across {len(set(keys))} matchups")
    print(df[["matchup_key", "season", "week", "away_team", "home_team",
              "away_score", "home_score", "ats_result", "ou_result"]].to_string(index=False))
    if args.no_load:
        return

    recs = json.loads(df.replace({np.nan: None}).to_json(orient="records"))
    key = load_key()
    hdr = {"apikey": key, "Authorization": f"Bearer {key}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}
    # idempotent: clear the matchups we are about to reload
    in_list = ",".join(f'"{k}"' for k in set(keys))
    requests.delete(f"{BASE_URL}/nfl_matchup_history?matchup_key=in.({in_list})",
                    headers=hdr, timeout=60)
    resp = requests.post(f"{BASE_URL}/nfl_matchup_history", headers=hdr, json=recs, timeout=120)
    if resp.status_code != 201:
        sys.exit(f"insert: {resp.status_code} {resp.text[:300]}")
    print(f"loaded {len(recs)} rows -> nfl_matchup_history")


if __name__ == "__main__":
    main()
