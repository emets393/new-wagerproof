"""Populate nfl_prop_player_pages — the single-fetch data contract for the web Player
Prop Breakdown page (one row per slate player per week).

Layers (all REAL sources, zero test data):
  identity   nfl_slate_games (live 2026 slate) + players_xwalk (official headshots)
  markets    nfl_player_prop_trends.markets ∩ modeled markets; lines join from
             nfl_slate_props when books post (status 'pending' until then)
  baseline   player_offense.parquet — 2025 per-game averages (real NFL results)
  ngs        NGS receiving/rushing/passing 2025 season means + league percentiles
  scheme     nfl_def_scheme (opponent identity, l8 + league pctiles + tag) and
             nfl_player_vs_scheme (career ypt vs man/zone/1-high/2-high + pctiles)
  highlights pre-computed "what matters most" flags w/ plain-English reasons —
             the page renders these, it never re-derives them

Companion table: nfl_player_prop_trends (game logs / splits / per-opponent records)
— the page fetches BOTH by player_id. Run weekly from run_nfl_week.sh.
"""
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
SEASON = int(os.environ.get("NFL_SEASON", 2026))
WEEK = int(os.environ.get("NFL_WEEK", 1))
STAT_SEASON = 2025          # baseline/NGS/scheme snapshot season (last completed)
POSITIONS = {"WR", "TE", "RB", "QB"}
MARKET_LABEL = {
    "player_receptions": "Receptions", "player_reception_yds": "Receiving Yards",
    "player_rush_yds": "Rushing Yards", "player_rush_attempts": "Rush Attempts",
    "player_anytime_td": "Anytime TD", "player_pass_yds": "Passing Yards",
    "player_pass_tds": "Passing TDs", "player_pass_attempts": "Pass Attempts",
    "player_pass_completions": "Completions",
}
TEAM_NAMES = {
    "Arizona Cardinals": "ARI", "Atlanta Falcons": "ATL", "Baltimore Ravens": "BAL",
    "Buffalo Bills": "BUF", "Carolina Panthers": "CAR", "Chicago Bears": "CHI",
    "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE", "Dallas Cowboys": "DAL",
    "Denver Broncos": "DEN", "Detroit Lions": "DET", "Green Bay Packers": "GB",
    "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAX",
    "Kansas City Chiefs": "KC", "Los Angeles Rams": "LA", "Los Angeles Chargers": "LAC",
    "Las Vegas Raiders": "LV", "Miami Dolphins": "MIA", "Minnesota Vikings": "MIN",
    "New England Patriots": "NE", "New Orleans Saints": "NO", "New York Giants": "NYG",
    "New York Jets": "NYJ", "Philadelphia Eagles": "PHI", "Pittsburgh Steelers": "PIT",
    "Seattle Seahawks": "SEA", "San Francisco 49ers": "SF", "Tampa Bay Buccaneers": "TB",
    "Tennessee Titans": "TEN", "Washington Commanders": "WAS"}


def load_key():
    for fn in (ROOT.parent.parent / ".env.local",):
        if fn.exists():
            for line in fn.read_text().splitlines():
                if line.startswith("SUPABASE_SERVICE_KEY="):
                    return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found")


KEY = load_key()
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}


def fetch(table, params=""):
    out, off = [], 0
    while True:
        r = requests.get(f"{BASE_URL}/{table}?{params}&limit=1000&offset={off}", headers=H, timeout=60)
        r.raise_for_status()
        rows = r.json()
        out += rows
        if len(rows) < 1000:
            return pd.DataFrame(out)
        off += 1000


def pctile(series, value):
    s = series.dropna()
    if pd.isna(value) or not len(s):
        return None
    return int(round((s < value).mean() * 100))


def clean(o):
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    if isinstance(o, list):
        return [clean(v) for v in o]
    if isinstance(o, (np.floating, float)):
        return None if pd.isna(o) else round(float(o), 2)
    if isinstance(o, (np.integer,)):
        return int(o)
    return o


def main():
    # ---- slate: team -> opponent map (LIVE season tables) ----
    sg = fetch("nfl_slate_games", f"season=eq.{SEASON}&week=eq.{WEEK}&select=home_team,away_team,kickoff")
    if sg.empty:
        sys.exit(f"no {SEASON} wk{WEEK} rows in nfl_slate_games")
    games = {}
    for _, g in sg.iterrows():
        h, a = TEAM_NAMES.get(g.home_team), TEAM_NAMES.get(g.away_team)
        ko = g.get("kickoff")
        games[h] = dict(opp=a, is_home=True, label=f"{g.away_team} @ {g.home_team}", kickoff=ko)
        games[a] = dict(opp=h, is_home=False, label=f"{g.away_team} @ {g.home_team}", kickoff=ko)

    tr = fetch("nfl_player_prop_trends", "select=player_id,player_name,position,current_team,markets,matchups")
    tr = tr[tr.position.isin(POSITIONS) & tr.current_team.isin(games)]
    props = fetch("nfl_slate_props", f"season=eq.{SEASON}&week=eq.{WEEK}")

    xw = pd.read_parquet(DATA / "players_xwalk.parquet")[["gsis_id", "headshot"]].dropna()
    heads = xw.set_index("gsis_id").headshot.to_dict()

    po = pd.read_parquet(DATA / "player_offense.parquet")
    po = po[po.season == STAT_SEASON]
    base = po.groupby("player_id").agg(
        games=("week", "size"), receptions=("receptions", "mean"), rec_yds=("receiving_yards", "mean"),
        targets=("targets", "mean"), rush_att=("carries", "mean"), rush_yds=("rushing_yards", "mean"),
        pass_att=("attempts", "mean"), pass_yds=("passing_yards", "mean"),
        rec_td=("receiving_tds", "sum"), rush_td=("rushing_tds", "sum"), pass_td=("passing_tds", "sum"))

    ngs_r = pd.read_parquet(DATA / "ngs_receiving.parquet")
    ngs_r = ngs_r[ngs_r.season == STAT_SEASON].groupby("player_id").agg(
        separation=("avg_separation", "mean"), cushion=("avg_cushion", "mean"),
        adot=("avg_intended_air_yards", "mean"), air_share=("percent_share_of_intended_air_yards", "mean"),
        yac_above_exp=("avg_yac_above_expectation", "mean"))
    ngs_u = pd.read_parquet(DATA / "ngs_rushing.parquet")
    ngs_u = ngs_u[ngs_u.season == STAT_SEASON].groupby("player_id").agg(
        efficiency=("efficiency", "mean"), ryoe_per_att=("rush_yards_over_expected_per_att", "mean"),
        eight_box_pct=("percent_attempts_gte_eight_defenders", "mean"), time_to_los=("avg_time_to_los", "mean"))
    ngs_p = pd.read_parquet(DATA / "ngs_passing.parquet")
    ngs_p = ngs_p[ngs_p.season == STAT_SEASON].groupby("player_id").agg(
        time_to_throw=("avg_time_to_throw", "mean"), completed_air_yds=("avg_completed_air_yards", "mean"),
        intended_air_yds=("avg_intended_air_yards", "mean"))

    pvs = pd.read_parquet(DATA / "nfl_player_vs_scheme.parquet")
    pvs = pvs.sort_values(["season", "week"]).groupby("player_id").tail(1).set_index("player_id")
    qual = pvs[pvs.tgts_zone >= 100]      # league baseline: established receivers

    ds = pd.read_parquet(DATA / "nfl_def_scheme.parquet")
    ds = ds.sort_values(["season", "week"]).groupby("team").tail(1).set_index("team")

    def def_profile(opp):
        if opp not in ds.index:
            return None
        r = ds.loc[opp]
        prof = {}
        for k, col in (("two_high", "two_high_rate_l8"), ("man", "man_rate_l8"),
                       ("pressure", "pressure_rate_l8"), ("blitz", "blitzers_l8"),
                       ("heavy_box", "heavy_box_rate_l8"), ("light_box", "light_box_rate_l8")):
            prof[k] = dict(rate=float(r[col]), pctile=pctile(ds[col], r[col]))
        tags = []
        if prof["man"]["pctile"] >= 70: tags.append("MAN-HEAVY")
        elif prof["man"]["pctile"] <= 30: tags.append("ZONE-HEAVY")
        if prof["two_high"]["pctile"] >= 70: tags.append("TWO-HIGH SHELL")
        elif prof["two_high"]["pctile"] <= 30: tags.append("SINGLE-HIGH")
        if prof["blitz"]["pctile"] >= 70: tags.append("BLITZ-HAPPY")
        elif prof["pressure"]["pctile"] >= 70: tags.append("PRESSURE FRONT")
        if prof["heavy_box"]["pctile"] >= 70: tags.append("STACKS THE BOX")
        prof["identity"] = " · ".join(tags[:2]) if tags else "BALANCED"
        return prof

    # Precompute identity buckets once (for look_hit_rates aggregation).
    similar_teams = {"zone_heavy": [], "man_heavy": [], "two_high": [], "single_high": []}
    for team_ab, row in ds.iterrows():
        man_p = pctile(ds["man_rate_l8"], row["man_rate_l8"])
        th_p = pctile(ds["two_high_rate_l8"], row["two_high_rate_l8"])
        if man_p is not None and man_p <= 30:
            similar_teams["zone_heavy"].append(team_ab)
        if man_p is not None and man_p >= 70:
            similar_teams["man_heavy"].append(team_ab)
        if th_p is not None and th_p >= 70:
            similar_teams["two_high"].append(team_ab)
        if th_p is not None and th_p <= 30:
            similar_teams["single_high"].append(team_ab)

    # Precompute league overall-ypt series among qualified receivers.
    overall_league = []
    for _, qr in qual.iterrows():
        qtm = float(qr.tgts_man) if pd.notna(qr.tgts_man) else 0.0
        qtz = float(qr.tgts_zone) if pd.notna(qr.tgts_zone) else 0.0
        if qtm + qtz < 100 or pd.isna(qr.ypt_man) or pd.isna(qr.ypt_zone):
            continue
        overall_league.append((float(qr.ypt_man) * qtm + float(qr.ypt_zone) * qtz) / (qtm + qtz))
    overall_league_s = pd.Series(overall_league)

    # ---- GAME-LEVEL scheme-type splits: player's per-game averages vs classified defenses ----
    # Classify every (season, team) defense into types by season s2d rates (terciles per season).
    ds_all = pd.read_parquet(DATA / "nfl_def_scheme.parquet")
    ds_end = ds_all.sort_values("week").groupby(["season", "team"]).tail(1)
    types = {}
    for ssn, grp in ds_end.groupby("season"):
        for typ, col, top in (("man_heavy", "man_rate_s2d", True), ("zone_heavy", "man_rate_s2d", False),
                              ("two_high_heavy", "two_high_rate_s2d", True), ("single_high", "two_high_rate_s2d", False),
                              ("blitz_heavy", "blitzers_s2d", True), ("heavy_box", "heavy_box_rate_s2d", True),
                              ("light_box", "light_box_rate_s2d", True)):
            q = grp[col].quantile(0.67 if top else 0.33)
            sel = grp[grp[col] >= q] if top else grp[grp[col] <= q]
            for t in sel.team:
                types.setdefault((ssn, t), []).append(typ)
    logs = pd.read_parquet(DATA / "player_offense.parquet")
    logs = logs[logs.season >= 2024].copy()
    # player_offense carries no opponent column — resolve via the schedule (moved below
    # after opp_map is built; placeholder filled in the loop pre-pass)
    logs["opp_types"] = [[] for _ in range(len(logs))]
    STATS = ["receptions", "receiving_yards", "targets", "carries", "rushing_yards", "attempts", "passing_yards"]
    OUT_NAMES = {"receptions": "receptions", "receiving_yards": "rec_yds", "targets": "targets",
                 "carries": "rush_att", "rushing_yards": "rush_yds", "attempts": "pass_att",
                 "passing_yards": "pass_yds"}
    _gs_ready = {"done": False}
    def game_splits(pid, opp_types_now):
        if not _gs_ready["done"]:
            logs["opp"] = [opp_map.get((s_, w_, t_)) for s_, w_, t_ in zip(logs.season, logs.week, logs.team)]
            logs["opp_types"] = [types.get((s_, o_), []) for s_, o_ in zip(logs.season, logs.opp)]
            _gs_ready["done"] = True
        g = logs[logs.player_id == pid]
        if len(g) < 4:
            return None
        overall = {OUT_NAMES[c]: round(float(g[c].mean()), 2) for c in STATS}
        overall["n"] = int(len(g))
        splits = {}
        for typ in ("man_heavy", "zone_heavy", "two_high_heavy", "single_high",
                    "blitz_heavy", "heavy_box", "light_box"):
            sub = g[g.opp_types.map(lambda ts: typ in ts)]
            if len(sub) < 3:
                splits[typ] = dict(n=int(len(sub)), insufficient=True)
                continue
            e = {OUT_NAMES[c]: round(float(sub[c].mean()), 2) for c in STATS}
            e["n"] = int(len(sub))
            e["delta"] = {OUT_NAMES[c]: round(float(sub[c].mean() - g[c].mean()), 2) for c in STATS}
            splits[typ] = e
        return dict(overall=overall, splits=splits, applicable=opp_types_now,
                    window="2024-2025 games vs defenses classified by season scheme rates")

    # ---- projection previews: empirical 2025 per-game bands (REAL data, PREVIEW status —
    # the per-market model replaces these without any schema change) ----
    PROJ_STAT = {"player_receptions": "receptions", "player_reception_yds": "receiving_yards",
                 "player_rush_yds": "rushing_yards", "player_rush_attempts": "carries",
                 "player_pass_yds": "passing_yards", "player_pass_attempts": "attempts"}
    po25 = po
    def projections(pid, markets_):
        g = po25[po25.player_id == pid]
        if len(g) < 6:
            return None
        out = {}
        for mk in markets_:
            if mk == "player_anytime_td":
                rate = float(((g.receiving_tds + g.rushing_tds) > 0).mean())
                out[mk] = dict(kind="rate", score_rate=round(rate, 2), n=int(len(g)),
                               status="preview", source="2025 games")
            elif mk in PROJ_STAT:
                v = g[PROJ_STAT[mk]]
                hi = float(v.quantile(0.65))
                if hi <= 0:      # degenerate (e.g. a WR's rushing band) — suppress, don't render 0-0-0
                    continue
                out[mk] = dict(kind="band", low=round(float(v.quantile(0.35)), 1),
                               median=round(float(v.quantile(0.5)), 1),
                               high=round(hi, 1), n=int(len(g)),
                               status="preview", source="2025 games")
        return out or None

    # ---- QB / RB scheme substrates (build_qb_rb_scheme.py) ----
    qbss = pd.read_parquet(DATA / "nfl_qb_vs_scheme.parquet").set_index("player_id")
    qb_qual = qbss[qbss.overall_dropbacks >= 150]
    rbss = pd.read_parquet(DATA / "nfl_rusher_vs_box.parquet").set_index("player_id")
    rb_qual = rbss[rbss.overall_carries >= 100]

    # ---- AS-OF look hit rates from props_frame (real lines + results, opponent classified
    # by the season the game was PLAYED — Cursor option (b), historical as-of tagging) ----
    pfh = pd.read_parquet(DATA / "props_frame.parquet")
    pfh = pfh[pfh.result_close.isin(["O", "U", "Y", "N"])].copy()
    pfh["opp_types"] = [types.get((s_, o_), []) for s_, o_ in zip(pfh.season, pfh.opp)]
    hitr = {}
    for r_ in pfh.itertuples():
        for typ in r_.opp_types:
            k = (r_.player_id, r_.market, typ)
            h_, n_ = hitr.get(k, (0, 0))
            hitr[k] = (h_ + (1 if r_.result_close in ("O", "Y") else 0), n_ + 1)

    # ---- (season, week, team) -> opponent map for the game-level splits ----
    nvg = pd.read_parquet(DATA / "nflverse_games.parquet")
    nvg = nvg[nvg.season >= 2024]
    opp_map = {}
    for r_ in nvg.itertuples():
        opp_map[(r_.season, r_.week, r_.home_team)] = r_.away_team
        opp_map[(r_.season, r_.week, r_.away_team)] = r_.home_team

    rows = []
    for _, p in tr.iterrows():
        pid, team = p.player_id, p.current_team
        g = games[team]
        mkts = []
        for mk in (p.markets or []):
            if mk not in MARKET_LABEL:
                continue
            row = dict(key=mk, label=MARKET_LABEL[mk], line=None, over_price=None,
                       under_price=None, status="pending")
            if len(props):
                hit = props[(props.player_id == pid) & (props.market == mk)] if "player_id" in props.columns else []
                if len(hit):
                    hr = hit.iloc[0]
                    row.update(line=hr.get("line"), over_price=hr.get("over_price"),
                               under_price=hr.get("under_price"), status="posted")
            mkts.append(row)
        if not mkts:
            continue

        b = base.loc[pid] if pid in base.index else None
        baseline = None
        if b is not None:
            baseline = dict(games=int(b.games), receptions=b.receptions, rec_yds=b.rec_yds,
                            targets=b.targets, rush_att=b.rush_att, rush_yds=b.rush_yds,
                            pass_att=b.pass_att, pass_yds=b.pass_yds,
                            total_td=int(b.rec_td + b.rush_td), pass_td=int(b.pass_td),
                            season=STAT_SEASON)

        ngs = {}
        if p.position in ("WR", "TE") and pid in ngs_r.index:
            r = ngs_r.loc[pid]
            ngs = dict(kind="receiving",
                       separation=dict(v=r.separation, pctile=pctile(ngs_r.separation, r.separation)),
                       cushion=dict(v=r.cushion, pctile=pctile(ngs_r.cushion, r.cushion)),
                       adot=dict(v=r.adot, pctile=pctile(ngs_r.adot, r.adot)),
                       air_share=dict(v=r.air_share, pctile=pctile(ngs_r.air_share, r.air_share)),
                       yac_above_exp=dict(v=r.yac_above_exp, pctile=pctile(ngs_r.yac_above_exp, r.yac_above_exp)))
        elif p.position == "RB" and pid in ngs_u.index:
            r = ngs_u.loc[pid]
            ngs = dict(kind="rushing",
                       efficiency=dict(v=r.efficiency, pctile=pctile(ngs_u.efficiency, r.efficiency)),
                       ryoe_per_att=dict(v=r.ryoe_per_att, pctile=pctile(ngs_u.ryoe_per_att, r.ryoe_per_att)),
                       eight_box_pct=dict(v=r.eight_box_pct, pctile=pctile(ngs_u.eight_box_pct, r.eight_box_pct)),
                       time_to_los=dict(v=r.time_to_los, pctile=pctile(ngs_u.time_to_los, r.time_to_los)))
        elif p.position == "QB" and pid in ngs_p.index:
            r = ngs_p.loc[pid]
            ngs = dict(kind="passing",
                       time_to_throw=dict(v=r.time_to_throw, pctile=pctile(ngs_p.time_to_throw, r.time_to_throw)),
                       completed_air_yds=dict(v=r.completed_air_yds, pctile=pctile(ngs_p.completed_air_yds, r.completed_air_yds)),
                       intended_air_yds=dict(v=r.intended_air_yds, pctile=pctile(ngs_p.intended_air_yds, r.intended_air_yds)))

        dprof = def_profile(g["opp"])
        scheme = dict(opponent=g["opp"], defense=dprof)

        # Career overall YPT (man+zone partition) — apples-to-apples vs coverage splits.
        # THIN-SAMPLE POLICY (owner+Cursor 2026-08-05): always EMIT whatever exists; pctile
        # only above the qualification floor; "thin" flag below it. Floors: overall 50
        # targets, per-split 25 (WR/TE). Only truly target-less players get no layer.
        overall_ypt = None
        if pid in pvs.index and p.position in ("WR", "TE", "RB"):
            me = pvs.loc[pid]
            tm = float(me.tgts_man) if pd.notna(me.tgts_man) else 0.0
            tz = float(me.tgts_zone) if pd.notna(me.tgts_zone) else 0.0
            if tm + tz >= 1 and pd.notna(me.ypt_man) and pd.notna(me.ypt_zone):
                overall_ypt = (float(me.ypt_man) * tm + float(me.ypt_zone) * tz) / (tm + tz)
                scheme["player_overall"] = dict(
                    ypt=overall_ypt,
                    targets=int(tm + tz),
                    pctile=(pctile(overall_league_s, overall_ypt)
                            if (tm + tz) >= 50 and len(overall_league_s) else None),
                    sample=("thin" if (tm + tz) < 50 else "ok"),
                )

            splits = {}
            for kk, yc, tc in (("zone", "ypt_zone", "tgts_zone"), ("man", "ypt_man", "tgts_man"),
                               ("two_high", "ypt_twohigh", "tgts_twohigh"), ("one_high", "ypt_onehigh", "tgts_onehigh")):
                ypt_v = me[yc]
                tgt_v = int(me[tc]) if pd.notna(me[tc]) else 0
                delta = None
                if overall_ypt is not None and pd.notna(ypt_v):
                    delta = float(ypt_v) - float(overall_ypt)
                splits[kk] = dict(
                    ypt=ypt_v, targets=tgt_v,
                    pctile=pctile(qual[yc], ypt_v) if tgt_v >= 25 else None,
                    delta_ypt=delta,
                    sample=("thin" if tgt_v < 25 else "ok"),
                )
            scheme["player_splits"] = splits

            # Which looks this opponent actually plays — UI comparison focus.
            look_focus = []
            if dprof:
                if dprof["man"]["pctile"] >= 60:
                    look_focus.append("man")
                elif dprof["man"]["pctile"] <= 40:
                    look_focus.append("zone")
                if dprof["two_high"]["pctile"] >= 60:
                    look_focus.append("two_high")
                elif dprof["two_high"]["pctile"] <= 40:
                    look_focus.append("one_high")
            scheme["look_focus"] = look_focus or ["zone"]
            scheme["kind"] = "receiving"

        # ---- QB scheme layer: EPA/dropback compare + YPA/comp%/sack% support ----
        if p.position == "QB" and pid in qbss.index:
            q_ = qbss.loc[pid]
            odb = int(q_.overall_dropbacks)
            scheme["kind"] = "qb"
            scheme["player_overall"] = dict(
                epa_db=q_.overall_epa_db, ypa=q_.overall_ypa, comp_pct=q_.overall_comp_pct,
                sack_rate=q_.overall_sack_rate, dropbacks=odb,
                pctile=pctile(qb_qual.overall_epa_db, q_.overall_epa_db) if odb >= 150 else None,
                sample=("thin" if odb < 150 else "ok"))
            qsplits = {}
            for look in ("man", "zone", "two_high", "one_high", "pressure", "blitz"):
                n_ = q_.get(f"{look}_dropbacks")
                if pd.isna(n_) or n_ < 1:
                    qsplits[look] = dict(dropbacks=0, insufficient=True)
                    continue
                qsplits[look] = dict(
                    dropbacks=int(n_), epa_db=q_.get(f"{look}_epa_db"), ypa=q_.get(f"{look}_ypa"),
                    comp_pct=q_.get(f"{look}_comp_pct"), sack_rate=q_.get(f"{look}_sack_rate"),
                    delta_epa_db=(q_.get(f"{look}_epa_db") - q_.overall_epa_db
                                  if pd.notna(q_.get(f"{look}_epa_db")) else None),
                    delta_ypa=(q_.get(f"{look}_ypa") - q_.overall_ypa
                               if pd.notna(q_.get(f"{look}_ypa")) else None),
                    pctile=(pctile(qb_qual[f"{look}_epa_db"], q_.get(f"{look}_epa_db"))
                            if n_ >= 50 else None),
                    sample=("thin" if n_ < 50 else "ok"))
            scheme["player_splits"] = qsplits
            lf = []
            if dprof:
                if dprof["pressure"]["pctile"] >= 60: lf.append("pressure")
                if dprof["blitz"]["pctile"] >= 60: lf.append("blitz")
                if dprof["man"]["pctile"] >= 60: lf.append("man")
                elif dprof["man"]["pctile"] <= 40: lf.append("zone")
                if dprof["two_high"]["pctile"] >= 60: lf.append("two_high")
                elif dprof["two_high"]["pctile"] <= 40: lf.append("one_high")
            scheme["look_focus"] = lf[:3] or ["zone"]

        # ---- RB box layer: EPA/rush compare + YPC display ----
        if p.position == "RB" and pid in rbss.index:
            b_ = rbss.loc[pid]
            oc = int(b_.overall_carries)
            scheme["kind"] = "rb"
            scheme["rush_overall"] = dict(
                ypc=b_.overall_ypc, epa_rush=b_.overall_epa_rush, td_rate=b_.overall_td_rate,
                carries=oc,
                pctile=pctile(rb_qual.overall_epa_rush, b_.overall_epa_rush) if oc >= 100 else None,
                sample=("thin" if oc < 100 else "ok"))
            rsplits = {}
            for look in ("heavy_box", "neutral", "light_box"):
                n_ = b_.get(f"{look}_carries")
                if pd.isna(n_) or n_ < 1:
                    rsplits[look] = dict(carries=0, insufficient=True)
                    continue
                rsplits[look] = dict(
                    carries=int(n_), ypc=b_.get(f"{look}_ypc"), epa_rush=b_.get(f"{look}_epa_rush"),
                    td_rate=b_.get(f"{look}_td_rate"),
                    delta_ypc=(b_.get(f"{look}_ypc") - b_.overall_ypc
                               if pd.notna(b_.get(f"{look}_ypc")) else None),
                    delta_epa_rush=(b_.get(f"{look}_epa_rush") - b_.overall_epa_rush
                                    if pd.notna(b_.get(f"{look}_epa_rush")) else None),
                    pctile=(pctile(rb_qual[f"{look}_epa_rush"], b_.get(f"{look}_epa_rush"))
                            if n_ >= 20 else None),
                    sample=("thin" if n_ < 20 else "ok"))
            scheme["rush_splits"] = rsplits
            rlf = []
            if dprof:
                if dprof["heavy_box"]["pctile"] >= 60: rlf.append("heavy_box")
                if dprof["light_box"]["pctile"] >= 60: rlf.append("light_box")
            scheme["rush_look_focus"] = rlf or ["neutral"]

        # Prop hit rates vs *this type* of defense — AS-OF tagging: every historical game's
        # opponent is classified by the season it was PLAYED (props_frame lines+results, 2024-25).
        # Closest-identity fallback: a BALANCED opponent still gets its most-extreme dimension's
        # bucket so the layer is never empty when history exists.
        if dprof:
            active_buckets = []
            if dprof["man"]["pctile"] <= 30: active_buckets.append("zone_heavy")
            if dprof["man"]["pctile"] >= 70: active_buckets.append("man_heavy")
            if dprof["two_high"]["pctile"] >= 70: active_buckets.append("two_high_heavy")
            if dprof["two_high"]["pctile"] <= 30: active_buckets.append("single_high")
            if dprof["heavy_box"]["pctile"] >= 70: active_buckets.append("heavy_box")
            if dprof["light_box"]["pctile"] >= 70: active_buckets.append("light_box")
            if dprof["blitz"]["pctile"] >= 70: active_buckets.append("blitz_heavy")
            if not active_buckets:
                dims = {"man": ("man_heavy", "zone_heavy"), "two_high": ("two_high_heavy", "single_high"),
                        "heavy_box": ("heavy_box", None), "blitz": ("blitz_heavy", None)}
                best, bestdev = None, -1
                for dim, (hi, lo) in dims.items():
                    pv = dprof[dim]["pctile"]
                    if pv is None: continue
                    dev = abs(pv - 50)
                    pick = hi if pv >= 50 else lo
                    if pick and dev > bestdev:
                        best, bestdev = pick, dev
                if best:
                    active_buckets = [best]
            look_hits = {}
            for bucket in active_buckets:
                by_mkt = {}
                for m_ in [mm["key"] for mm in mkts]:
                    h_, n_ = hitr.get((pid, m_, bucket), (0, 0))
                    if n_ >= 3:
                        by_mkt[m_] = dict(h=h_, n=n_, pct=round(h_ / n_, 3))
                if by_mkt:
                    look_hits[bucket] = by_mkt
            if look_hits:
                scheme["look_hit_rates"] = look_hits

        # ---- highlights: the "what matters most" layer ----
        hl = []
        if dprof and scheme.get("kind") == "receiving" and "player_splits" in scheme:
            dom = "man" if dprof["man"]["pctile"] >= 60 else "zone"
            shell = "two_high" if dprof["two_high"]["pctile"] >= 60 else ("one_high" if dprof["two_high"]["pctile"] <= 40 else None)
            for facing, why in ((dom, f"{g['opp']} plays {dom} at the {dprof[dom if dom!='zone' else 'man']['pctile']}th %ile" if dom == "man" else f"{g['opp']} is one of the most zone-heavy defenses"),
                                (shell, f"{g['opp']} lives in {shell.replace('_','-')} shells" if shell else "")):
                if not facing:
                    continue
                sp = scheme["player_splits"].get(facing)
                if sp and sp["pctile"] is not None and sp["targets"] >= 15:
                    delta = sp.get("delta_ypt")
                    delta_bit = ""
                    if delta is not None and abs(delta) >= 0.35:
                        sign = "+" if delta > 0 else ""
                        delta_bit = f" ({sign}{delta:.1f} vs his career avg)"
                    # Prefer vs-own-average when it conflicts with league rank.
                    soft_vs_self = delta is not None and delta <= -0.5
                    elite_vs_self = delta is not None and delta >= 0.5
                    if soft_vs_self or (sp["pctile"] <= 25 and not elite_vs_self):
                        hl.append(dict(kind="scheme", split=facing, direction="down",
                                       markets=["player_receptions", "player_reception_yds"],
                                       text=f"Softer vs {facing.replace('_', '-')} coverage ({sp['ypt']:.1f} yds/target{delta_bit}) — {why}."))
                    elif elite_vs_self or sp["pctile"] >= 75:
                        hl.append(dict(kind="scheme", split=facing, direction="up",
                                       markets=["player_receptions", "player_reception_yds"],
                                       text=f"Top-{max(1, 100 - sp['pctile'])}% vs {facing.replace('_', '-')} coverage ({sp['ypt']:.1f} yds/target{delta_bit}) — {why}."))

            # Hit-rate vs this *type* of defense (line cash rate), when sample is thick enough.
            lhr = scheme.get("look_hit_rates") or {}
            for bucket, bucket_mkts in lhr.items():
                label = bucket.replace("_", "-")
                for mk, rec in bucket_mkts.items():
                    if rec["n"] < 4:
                        continue
                    lbl = MARKET_LABEL.get(mk, mk).lower()
                    if mk == "player_anytime_td":
                        txt_up = f"Scored in {rec['h']} of {rec['n']} games vs {label} defenses."
                        txt_dn = f"Scored in only {rec['h']} of {rec['n']} games vs {label} defenses."
                    else:
                        txt_up = f"Over his {lbl} line in {rec['h']} of {rec['n']} games vs {label} defenses."
                        txt_dn = f"Cleared his {lbl} line in only {rec['h']} of {rec['n']} games vs {label} defenses."
                    if rec["pct"] is not None and rec["pct"] >= 0.65:
                        hl.append(dict(kind="look_hit", bucket=bucket, direction="up", markets=[mk], text=txt_up))
                    elif rec["pct"] is not None and rec["pct"] <= 0.35:
                        hl.append(dict(kind="look_hit", bucket=bucket, direction="down", markets=[mk], text=txt_dn))

        mu = (p.matchups or {}).get(g["opp"]) if isinstance(p.matchups, dict) else None
        if mu and mu.get("meetings", 0) >= 3:
            for mk, rec in mu.items():
                if not isinstance(rec, dict) or rec.get("n", 0) < 3:
                    continue
                lbl = MARKET_LABEL.get(mk, mk).lower()
                if mk == "player_anytime_td":
                    up_txt = f"Scored in {rec['h']} of {rec['n']} career games vs {g['opp']}."
                    dn_txt = f"Scored in only {rec['h']} of {rec['n']} career games vs {g['opp']}."
                else:
                    up_txt = f"Over his {lbl} line in {rec['h']} of {rec['n']} career games vs {g['opp']}."
                    dn_txt = f"Over his {lbl} line in only {rec['h']} of {rec['n']} career games vs {g['opp']}."
                if rec["pct"] >= 0.7:
                    hl.append(dict(kind="matchup", direction="up", markets=[mk], text=up_txt))
                elif rec["pct"] <= 0.3:
                    hl.append(dict(kind="matchup", direction="down", markets=[mk], text=dn_txt))
        if ngs.get("kind") == "receiving" and ngs["separation"]["pctile"] is not None and ngs["separation"]["pctile"] >= 80:
            hl.append(dict(kind="profile", direction="up", markets=["player_receptions"],
                           text=f"Elite separator — top {100-ngs['separation']['pctile']}% in yards of separation created."))
        if ngs.get("kind") == "rushing" and dprof and dprof["light_box"]["pctile"] >= 70:
            hl.append(dict(kind="scheme", direction="up", markets=["player_rush_yds"],
                           text=f"{g['opp']} shows light boxes at the {dprof['light_box']['pctile']}th %ile — favorable run fronts."))

        opp_types_now = types.get((STAT_SEASON, g["opp"]), [])
        gs = game_splits(pid, opp_types_now)
        proj = projections(pid, [m["key"] for m in mkts])
        rows.append(dict(player_id=pid, season=SEASON, week=WEEK, player_name=p.player_name,
                         position=p.position, team=team, opponent=g["opp"], is_home=g["is_home"],
                         game_label=g["label"], kickoff=g["kickoff"], headshot_url=heads.get(pid),
                         markets=clean(mkts), baseline=clean(baseline), ngs=clean(ngs),
                         scheme=clean(scheme), scheme_game_splits=clean(gs),
                         projection=clean(proj), rookie=baseline is None,
                         highlights=clean(hl)))

    print(f"{len(rows)} player pages assembled | headshots {sum(1 for r in rows if r['headshot_url'])}"
          f" | w/ scheme splits {sum(1 for r in rows if 'player_splits' in (r['scheme'] or {}))}"
          f" | w/ highlights {sum(1 for r in rows if r['highlights'])}")
    if "--no-load" in sys.argv:
        return
    requests.delete(f"{BASE_URL}/nfl_prop_player_pages?season=eq.{SEASON}&week=eq.{WEEK}", headers=H, timeout=60)
    hdr = {**H, "Content-Type": "application/json", "Prefer": "return=minimal"}
    for i in range(0, len(rows), 100):
        r = requests.post(f"{BASE_URL}/nfl_prop_player_pages", headers=hdr,
                          json=json.loads(json.dumps(rows[i:i + 100], default=str)), timeout=120)
        r.raise_for_status()
    print(f"loaded {len(rows)} -> nfl_prop_player_pages")


if __name__ == "__main__":
    main()
