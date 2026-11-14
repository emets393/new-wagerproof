#!/usr/bin/env python3
"""WEEKLY POWER-RATINGS SCORER.  Usage: python3 score_week_power.py 2026 2

NOT A BETTING BOARD (retracted 2026-09-17, see power_ratings_spec.py): the model's edge vs the
opener was closing-line information; graded honestly it is ~50-54%. The "core/extended/★" tiers
printed below are the old thresholds and mean nothing. Use the four composites as a matchup
description only. CORE now reads data/team_week_seasonal.parquet (real season-to-date, K=4
seeded); the prod table fed one-game raw stats for 2026 and inflated the first Week 2 board.

Frozen spec (power_ratings_spec.py): reliability-gated FP units + production CORE + 9 matchup
differentials + market anchor + PLAYED-ONLY skill-position injury counts (own + opp), ridge
lambda 80. Spreads: |model line - market| >= 2, HOME lean = core tier, AWAY lean = extended tier.
Totals: rolling calibration (prior-season offset until >= 24 games this season), |gap| >= 3.

Injury handling, all learned the hard way today:
  * skill players (WR/TE/RB/FB) count ONLY if they have usage > 0 this or last season — a body
    count that includes practice-squad players is what the owner (correctly) objected to
  * QB flags are NOT model features (49 historical cases, wrong-signed coefficient, market already
    prices a starter out). Starter identity is computed anyway — as FIRST PASSER of the team's most
    recent game from play-by-play — purely so the report names who is out correctly
  * live names are matched TEAM-scoped first, name-only fallback (traded players)
  * state is CARRIED FORWARD to the unplayed week, never joined on it
"""
import re
import sys
import io
import contextlib
import glob
import importlib.util as iu
from pathlib import Path

import numpy as np
import pandas as pd
import requests

SEASON, WEEK = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (2026, 2)
FP = "data/fpdata/"
num = lambda s: pd.to_numeric(s, errors="coerce")
SUF = re.compile(r"\s+(jr|sr|ii|iii|iv|v)\.?$", re.I)
nn = lambda s: SUF.sub("", str(s).lower().strip()).replace(".", "").replace("'", "").replace("-", " ").strip()
SK = ["WR", "TE", "RB", "FB"]
SKILL = ["p_inj_skill", "opp_p_inj_skill"]
TOTAL_OFFSET_FALLBACK = 2.52     # prior-season mean(model total - market total); rolling once >= 24 games

# ---------------- trained model (historical frame + played-only skill counts) ----------------
spec = iu.spec_from_file_location("pf", "power_ratings_prodfeats.py"); PF = iu.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()):
    spec.loader.exec_module(PF)
Q, ridge, BLEND, norm = PF.Q.copy(), PF.ridge, PF.BLEND, PF.norm
W = pd.read_parquet(FP + "_injury_weekly_played.parquet")
Q = Q.merge(W, on=["season", "week", "team"], how="left").merge(
    W.rename(columns={"team": "opp", "p_inj_skill": "opp_p_inj_skill", "p_inj_qb": "opp_p_inj_qb"}),
    on=["season", "week", "opp"], how="left")
Q[SKILL] = Q[SKILL].fillna(0)
tr = Q[Q.season < SEASON]
F = [c for c in BLEND + SKILL if c in tr.columns and tr[c].std() > 1e-9]
X = tr[F].values.astype(float); mu, sd = X.mean(0), X.std(0); sd[sd == 0] = 1
w = ridge((X - mu) / sd, tr.pts.values.astype(float), 80.0)

# ---------------- slate features, state carried forward ----------------
spec2 = iu.spec_from_file_location("pc", "power_ratings_checks.py"); C = iu.module_from_spec(spec2)
with contextlib.redirect_stdout(io.StringIO()):
    spec2.loader.exec_module(C)
S = C.W.copy()

# ---------------- live injuries ----------------
def env(n):
    for l in Path("../../.env.local").read_text().splitlines():
        if l.startswith(n + "="):
            return l.split("=", 1)[1].strip()
sk = env("SUPABASE_SERVICE_KEY"); H = {"apikey": sk, "Authorization": f"Bearer {sk}"}
r = requests.get("https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/nfl_injuries_raw", headers=H,
                 params={"select": "team,player_name,position,report_status", "season": f"eq.{SEASON}",
                         "week": f"eq.{WEEK}", "report_status": "in.(Out,Doubtful,Injured Reserve)", "limit": "2000"})
li = pd.DataFrame(r.json()); li["team"] = norm(li.team); li["nm"] = li.player_name.map(nn)
ra = pd.read_parquet(FP + "player_receiving-advanced.parquet"); bc = pd.read_parquet(FP + "player_rushing-bell-cow.parquet")
for d in (ra, bc):
    d["nm"] = (d.playerFirstName.astype(str) + " " + d.playerLastName.astype(str)).map(nn); d["team"] = norm(d.teamAbbreviation)
ra["rs"] = num(ra.marketShareReceivingRoutesTotal); bc["ms"] = num(bc.marketShareRushingAttemptsTotal)
def usage(d, c):
    rr = d[d.__season.isin([SEASON - 1, SEASON])]
    bt = rr.groupby(["nm", "team"])[c].mean().to_dict(); bn = rr.groupby("nm")[c].mean().to_dict()
    return lambda n, t: bt.get((n, t), bn.get(n, 0.0))
ur, um = usage(ra, "rs"), usage(bc, "ms")
li["u"] = [max(ur(n, t), um(n, t)) if p in SK else 0.0 for n, t, p in zip(li.nm, li.team, li.position)]
li["counts"] = (li.position.isin(SK) & (li.u > 0)).astype(int)
# QB starter = first passer of the team's most recent game (narrative only)
fpq = []
for f in sorted(glob.glob("data/pbp_cache/pbp_*.parquet")) + sorted(glob.glob("data/pbp_cache/_pbp*.parquet")):
    d = pd.read_parquet(f, columns=["season", "week", "posteam", "passer_player_name", "play_id", "play_type"])
    d = d[(d.play_type == "pass") & d.passer_player_name.notna()].sort_values("play_id")
    fpq.append(d.groupby(["season", "week", "posteam"], as_index=False).passer_player_name.first())
FPQ = pd.concat(fpq); FPQ["team"] = norm(FPQ.posteam)
FPQ["key"] = FPQ.passer_player_name.astype(str).str.lower().str.replace(".", "", regex=False).str.replace(" ", "", regex=False)
def ikey(name):
    p = nn(name).split(); return (p[0][0] + "".join(p[1:])) if len(p) >= 2 else nn(name).replace(" ", "")
def is_starter(row):
    g = FPQ[(FPQ.team == row.team) & (((FPQ.season == SEASON) & (FPQ.week < WEEK)) | (FPQ.season == SEASON - 1))]
    return int(len(g) > 0 and g.sort_values(["season", "week"]).iloc[-1].key == ikey(row.player_name))
li["starter_qb"] = [is_starter(rw) if rw.position == "QB" else 0 for rw in li.itertuples()]
cnt = li.groupby("team").agg(p_inj_skill=("counts", "sum"))
S = S.merge(cnt, left_on="team", right_index=True, how="left").merge(
    cnt.rename(columns={"p_inj_skill": "opp_p_inj_skill"}), left_on="opp", right_index=True, how="left")
S[SKILL] = S[SKILL].fillna(0)

# ---------------- score ----------------
S[F] = S[F].fillna(tr[F].median())
S["off"] = np.hstack([(S[F].values.astype(float) - mu) / sd, np.ones((len(S), 1))]) @ w
own = S.set_index(["game", "team"]).off
S["opp_off"] = own.reindex(pd.MultiIndex.from_arrays([S.game, S.opp])).values
Hm = S[S.home == 1].copy()
Hm["model_margin"] = Hm.off - Hm.opp_off
Hm["model_total"] = Hm.off + Hm.opp_off - TOTAL_OFFSET_FALLBACK
Hm["sp_gap"] = Hm.model_margin - (-Hm.close_line)
Hm["to_gap"] = Hm.model_total - Hm.total
bet = lambda t, m: f"{t} {'-' if m > 0 else '+'}{abs(m):.1f}"

print(f"POWER RATINGS — {SEASON} week {WEEK}   (lines in betting notation; gap = |model line − market line|)")
print(f"{'game':10s} {'HOME off':>8s} {'AWAY off':>8s} | {'MARKET':>11s} {'MODEL':>11s} {'gap':>5s}  {'spread':16s} | {'mkt T':>5s} {'model':>6s} {'gap':>5s}  total")
for _, r in Hm.sort_values("sp_gap", key=abs, ascending=False).iterrows():
    home, away = r.game.split("@")[1], r.game.split("@")[0]
    lean = home if r.sp_gap > 0 else away
    sp = (f"{lean} {'★★ core' if r.sp_gap > 0 else '★ extended'}") if abs(r.sp_gap) >= 2 else ""
    tp = "OVER ★" if r.to_gap >= 3 else "UNDER ★" if r.to_gap <= -3 else ""
    print(f"{r.game:10s} {r.off:8.1f} {r.opp_off:8.1f} | {bet(home, -r.close_line):>11s} {bet(home, r.model_margin):>11s} "
          f"{abs(r.sp_gap):5.1f}  {sp:16s} | {r.total:5.1f} {r.model_total:6.1f} {r.to_gap:+5.1f}  {tp}")
print("\nINJURIES THAT COUNT (played skill players) and STARTING QBs OUT (narrative only, not in model):")
for t, g in li[(li.counts == 1) | (li.starter_qb == 1)].groupby("team"):
    print(f"  {t}: " + ", ".join(f"{p} ({pos}{' — STARTING QB' if s else f' {u:.2f}'})" for p, pos, s, u in zip(g.player_name, g.position, g.starter_qb, g.u)))
Hm.to_parquet(FP + f"_power_ratings_{SEASON}w{WEEK}.parquet", index=False)
