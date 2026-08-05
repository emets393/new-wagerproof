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
        if pid in pvs.index and pvs.loc[pid].tgts_zone >= 15:
            me = pvs.loc[pid]
            splits = {}
            for kk, yc, tc in (("zone", "ypt_zone", "tgts_zone"), ("man", "ypt_man", "tgts_man"),
                               ("two_high", "ypt_twohigh", "tgts_twohigh"), ("one_high", "ypt_onehigh", "tgts_onehigh")):
                splits[kk] = dict(ypt=me[yc], targets=int(me[tc]) if pd.notna(me[tc]) else 0,
                                  pctile=pctile(qual[yc], me[yc]))
            scheme["player_splits"] = splits

        # ---- highlights: the "what matters most" layer ----
        hl = []
        if dprof and "player_splits" in scheme:
            dom = "man" if dprof["man"]["pctile"] >= 60 else "zone"
            shell = "two_high" if dprof["two_high"]["pctile"] >= 60 else ("one_high" if dprof["two_high"]["pctile"] <= 40 else None)
            for facing, why in ((dom, f"{g['opp']} plays {dom} at the {dprof[dom if dom!='zone' else 'man']['pctile']}th %ile" if dom == "man" else f"{g['opp']} is one of the most zone-heavy defenses"),
                                (shell, f"{g['opp']} lives in {shell.replace('_','-')} shells" if shell else "")):
                if not facing:
                    continue
                sp = scheme["player_splits"].get(facing)
                if sp and sp["pctile"] is not None and sp["targets"] >= 15:
                    if sp["pctile"] >= 75:
                        hl.append(dict(kind="scheme", split=facing, direction="up",
                                       markets=["player_receptions", "player_reception_yds"],
                                       text=f"Top-{100-sp['pctile']}% in the NFL vs {facing.replace('_','-')} coverage ({sp['ypt']:.1f} yds/target) — {why}."))
                    elif sp["pctile"] <= 25:
                        hl.append(dict(kind="scheme", split=facing, direction="down",
                                       markets=["player_receptions", "player_reception_yds"],
                                       text=f"Bottom-{sp['pctile']}% vs {facing.replace('_','-')} coverage ({sp['ypt']:.1f} yds/target) — {why}."))
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
        if ngs.get("kind") == "rushing" and dprof and dprof["light_box_rate" if False else "light_box"]["pctile"] >= 70:
            hl.append(dict(kind="scheme", direction="up", markets=["player_rush_yds"],
                           text=f"{g['opp']} shows light boxes at the {dprof['light_box']['pctile']}th %ile — favorable run fronts."))

        rows.append(dict(player_id=pid, season=SEASON, week=WEEK, player_name=p.player_name,
                         position=p.position, team=team, opponent=g["opp"], is_home=g["is_home"],
                         game_label=g["label"], kickoff=g["kickoff"], headshot_url=heads.get(pid),
                         markets=clean(mkts), baseline=clean(baseline), ngs=clean(ngs),
                         scheme=clean(scheme), highlights=clean(hl)))

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
