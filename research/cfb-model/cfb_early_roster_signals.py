"""Weeks-1-3 early-season roster-value signals (preseason-known, leak-safe). Two bettable ATS signals that
early lines under-price because they anchor on last year's roster before the market has current-season data:

  S-CFB2  ret_prod_edge     : back the team with the higher RETURNING-PRODUCTION differential (percentPPA,
                              opp-relative ≥ +0.20). Validated 54.4%/9-9 seasons (FOOTBALL_PROFILES.md).
  S-CFB3  portal_talent_influx: back the team that added ≥3 four-star PORTAL transfers (and more than the opp).
                              Candidate 54.5% wk1-3, decays by wk4, survives talent control (n small, track-plus).

Both weeks 1-3 ONLY (they decay once the market has current-season data). Data: CFBD /player/returning +
/player/portal (data/cfbd/returning_production.parquet, portal.parquet)."""
import numpy as np, pandas as pd

RET_EDGE, PORTAL_STARS, PORTAL_MIN = 0.20, 4, 3

def _returning(season, path="data/cfbd/returning_production.parquet"):
    try:
        rp = pd.read_parquet(path)
        rp = rp[rp.season == season]
        return dict(zip(rp.team, rp.percentPPA))
    except Exception:
        return {}

def _portal_4star(season, path="data/cfbd/portal.parquet"):
    try:
        p = pd.read_parquet(path)
        p = p[(p.season == season) & (p.stars >= PORTAL_STARS)].dropna(subset=["destination"])
        return p.groupby("destination").size().to_dict()
    except Exception:
        return {}

def triggers_for_week(season, week, matchups):
    """matchups: iterable of (team, opponent). Returns {team: [(signal_key, edge_value, tier), ...]} for teams
    that trigger. Empty outside weeks 1-3 (signals decay after)."""
    if week > 3:
        return {}
    ret = _returning(season)
    hi4 = _portal_4star(season)
    out = {}
    for team, opp in matchups:
        # S-CFB2 — returning-production continuity edge
        rt, ro = ret.get(team), ret.get(opp)
        if rt is not None and ro is not None and (rt - ro) >= RET_EDGE:
            out.setdefault(team, []).append(("ret_prod_edge", round(float(rt - ro), 3), "T2"))
        # S-CFB3 — blue-chip portal talent influx (and more than the opponent)
        ht, ho = hi4.get(team, 0), hi4.get(opp, 0)
        if ht >= PORTAL_MIN and ht > ho:
            out.setdefault(team, []).append(("portal_talent_influx", int(ht), "T3"))
    return out

if __name__ == "__main__":
    # self-test: fire on a historical wk1-3 slate and check the backed team's ATS cover
    mg = pd.read_parquet("data/model_games.parquet")
    hits = {"ret_prod_edge": [0, 0], "portal_talent_influx": [0, 0]}
    for season in [2021, 2022, 2023, 2024, 2025]:
        for wk in (1, 2, 3):
            sl = mg[(mg.season == season) & (mg.week == wk)]
            mm = [(r.homeTeam, r.awayTeam) for _, r in sl.iterrows()] + [(r.awayTeam, r.homeTeam) for _, r in sl.iterrows()]
            fired = triggers_for_week(season, wk, mm)
            for _, r in sl.iterrows():
                for team, side_sign in [(r.homeTeam, 1), (r.awayTeam, -1)]:
                    if team not in fired or pd.isna(r.actual_margin):
                        continue
                    tsp = r.spread_close * side_sign; tmg = r.actual_margin * side_sign
                    if tmg + tsp == 0: continue
                    cov = int(tmg + tsp > 0)
                    for sk, _v, _t in fired[team]:
                        hits[sk][0] += cov; hits[sk][1] += 1
    for sk, (w, n) in hits.items():
        print(f"  {sk:22s}: {w}/{n} = {w/n*100:.1f}% ATS  (wk1-3, 2021-25)" if n else f"  {sk}: no fires")
