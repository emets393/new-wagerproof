"""Sync the MCP-facing preseason tables: cfb_team_roster_profile + cfb_schedule.

Created 2026-08-18 after connector users got hallucinated 2026 win projections
(Oklahoma State "2 wins"): the roster/transfer/preseason layer lived only in research
parquets, so users' Claude guessed from memory. This loads it into the warehouse:
  - cfb_team_roster_profile: priors + roster_scores + roster_dims merged per
    (season, team), 2016-2026 — returning/incoming/lost production, transfer ratings,
    QB1 status, talent, recruiting, prior SP+/FPI.
  - cfb_schedule: the full upcoming-season schedule (games_<season>.parquet).
Runs in run_cfb_week.sh after the roster-layer build. Idempotent per season.
"""
import glob
import json
import os
import sys

import pandas as pd
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"


def key():
    for line in open(os.path.join(HERE, "..", "..", ".env.local")):
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not in .env.local")


def main():
    season = int(sys.argv[1]) if len(sys.argv) > 1 else None
    sk = key()
    hdr = {"apikey": sk, "Authorization": f"Bearer {sk}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}

    pr = pd.read_parquet(os.path.join(HERE, "data", "priors.parquet"))
    rs = pd.read_parquet(os.path.join(HERE, "data", "roster_scores.parquet"))
    rd = pd.read_parquet(os.path.join(HERE, "data", "roster_dims.parquet"))
    prof = pr.merge(rs, on=["season", "team"], how="outer") \
             .merge(rd, on=["season", "team"], how="outer", suffixes=("", "_dim"))
    prof = prof.loc[:, ~prof.columns.duplicated()]
    prof = prof[[c for c in prof.columns if not c.endswith("_dim")]]
    if season:
        prof = prof[prof.season == season]
    for s in sorted(prof.season.unique()):
        requests.delete(f"{SUPA}/cfb_team_roster_profile?season=eq.{int(s)}", headers=hdr, timeout=60)
    recs = json.loads(prof.where(pd.notna(prof), None).to_json(orient="records"))
    for i in range(0, len(recs), 4000):
        requests.post(f"{SUPA}/cfb_team_roster_profile", headers=hdr,
                      json=recs[i:i + 4000], timeout=120).raise_for_status()
    print(f"[roster_profile] loaded {len(recs)} rows")

    # schedule: newest games_<season>.parquet (or the requested season's)
    files = sorted(glob.glob(os.path.join(HERE, "data", "cfbd", "games_20*.parquet")))
    target = [f for f in files if season and str(season) in f] or files[-1:]
    g = pd.read_parquet(target[0])
    if not len(g):
        print("[schedule] source empty, skipped")
        return
    idc = "id" if "id" in g.columns else "gameId"
    g = g[[idc, "season", "week", "startDate", "neutralSite", "conferenceGame",
           "homeTeam", "homeConference", "awayTeam", "awayConference"]].rename(columns={
        idc: "game_id", "startDate": "start_date", "neutralSite": "neutral_site",
        "conferenceGame": "conference_game", "homeTeam": "home_team",
        "homeConference": "home_conference", "awayTeam": "away_team",
        "awayConference": "away_conference"})
    s = int(g.season.iloc[0])
    requests.delete(f"{SUPA}/cfb_schedule?season=eq.{s}", headers=hdr, timeout=60)
    recs = json.loads(g.where(pd.notna(g), None).to_json(orient="records"))
    for i in range(0, len(recs), 4000):
        requests.post(f"{SUPA}/cfb_schedule", headers=hdr,
                      json=recs[i:i + 4000], timeout=120).raise_for_status()
    print(f"[schedule] loaded {len(recs)} rows for {s}")

    # as-of ratings (cfb_ratings_asof) — the in-season strength table
    ca = pd.read_parquet(os.path.join(HERE, "data", "cfbd", "core_asof.parquet"))
    if season:
        ca = ca[ca.season == season]
    for yr in sorted(ca.season.unique()):
        requests.delete(f"{SUPA}/cfb_ratings_asof?season=eq.{int(yr)}", headers=hdr, timeout=60)
    recs = json.loads(ca.where(pd.notna(ca), None).to_json(orient="records"))
    for i in range(0, len(recs), 4000):
        requests.post(f"{SUPA}/cfb_ratings_asof", headers=hdr,
                      json=recs[i:i + 4000], timeout=120).raise_for_status()
    print(f"[ratings_asof] loaded {len(recs)} rows")

    # weekly polls (cfb_rankings) — AP + Coaches, incl. preseason
    rk = pd.read_parquet(os.path.join(HERE, "data", "cfbd", "rankings_weekly.parquet")) \
        .rename(columns={"year": "season"})
    rk = rk[rk.poll.isin(["AP Top 25", "Coaches Poll"])] \
        .drop_duplicates(["season", "asof_week", "poll", "team"])
    if season:
        rk = rk[rk.season == season]
    for yr in sorted(rk.season.unique()):
        requests.delete(f"{SUPA}/cfb_rankings?season=eq.{int(yr)}", headers=hdr, timeout=60)
    recs = json.loads(rk.where(pd.notna(rk), None).to_json(orient="records"))
    for i in range(0, len(recs), 4000):
        requests.post(f"{SUPA}/cfb_rankings", headers=hdr,
                      json=recs[i:i + 4000], timeout=120).raise_for_status()
    print(f"[rankings] loaded {len(recs)} rows")


if __name__ == "__main__":
    main()
