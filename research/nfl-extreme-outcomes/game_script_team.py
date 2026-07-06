"""Game-script — TEAM level (the real theory). 2024-25.

Team expected volume from the LINES vs the team's ACTUAL season attempts average:
  pass_lean = QB pass-attempts line          - team's season-avg ACTUAL pass attempts (prior)
  rush_lean = SUM of all RBs rush-att lines  - team's season-avg ACTUAL rush attempts (prior)
(>0 = Vegas setting this game's volume above the team's normal tendency.)

Then: (1) VALIDATE the line predicts script (does run-lean actually -> more running, fewer pts),
(2) FLAGSHIP run-heavy prep (pass-lean down + rush-lean up) -> team total UNDER / lower scoring,
(3) GAME air-raid index (both teams' pass vs rush volume) -> game total, (4) prop cascades.
Each graded 2024 vs 2025. Read-only.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from stats_helpers import wilson_ci
from game_script_scan import lines, team_primary, NORM

DATA = Path(__file__).resolve().parent / "data"


def team_actuals():
    po = pd.read_parquet(DATA / "player_offense.parquet")
    po["team"] = po.team.replace(NORM)
    g = po.groupby(["season", "week", "team"]).agg(
        pass_att=("attempts", "sum"), rush_att=("carries", "sum")).reset_index()
    g = g.sort_values(["team", "season", "week"])
    g["avg_pass_prior"] = g.groupby("team").pass_att.transform(lambda s: s.shift(1).expanding(min_periods=3).mean())
    g["avg_rush_prior"] = g.groupby("team").rush_att.transform(lambda s: s.shift(1).expanding(min_periods=3).mean())
    return g


def team_lines():
    ex = pd.read_parquet(DATA / "props_rows_extra.parquet")
    ex["team"] = ex.team.replace(NORM)
    cons = ex.groupby(["season", "week", "team", "player_id", "market"]).line.median().reset_index()
    pa = cons[cons.market == "player_pass_attempts"].groupby(["season", "week", "team"]).line.max() \
        .rename("pass_att_line").reset_index()                     # starter QB
    ra = cons[cons.market == "player_rush_attempts"].groupby(["season", "week", "team"]).line.sum() \
        .rename("rush_att_line").reset_index()                     # ALL RBs summed
    return pa.merge(ra, on=["season", "week", "team"], how="outer")


def outcomes():
    h = pd.read_parquet(DATA / "h1tt_frame.parquet")
    h["home_ab"] = h.home_ab.replace(NORM); h["away_ab"] = h.away_ab.replace(NORM)
    rows = []
    for _, r in h.iterrows():
        tot = r.final_home + r.final_away
        gk = "|".join(sorted([r.home_ab, r.away_ab])) + f"_{int(r.season)}_{int(r.week)}"
        for home in (True, False):
            rows.append(dict(season=int(r.season), week=int(r.week), game_key=gk,
                team=r.home_ab if home else r.away_ab, opp=r.away_ab if home else r.home_ab,
                team_pts=r.final_home if home else r.final_away,
                tt_line=r.tt_home_close_tt_home_point if home else r.tt_away_close_tt_away_point,
                total_line=r.total_close_total_point, actual_total=tot))
    return pd.DataFrame(rows)


def rep(label, sub, hit, base=None):
    s = pd.DataFrame({"hit": hit, "season": sub.season}).dropna(subset=["hit"])
    n = len(s)
    if n == 0:
        print(f"  {label:46s} n=0"); return
    k = int(s.hit.sum()); hp = k / n * 100
    lo, hi = wilson_ci(k, n)
    yr = {y: s[s.season == y].hit.mean() * 100 for y in (2024, 2025) if len(s[s.season == y])}
    both = len(yr) == 2 and all(v > (base or 50) for v in yr.values())
    tier = "HIGH" if (both and n >= 40 and hp - (base or 50) >= 4) else ("LEAD" if both else "noise")
    ys = " ".join(f"{y}:{v:.0f}%" for y, v in yr.items())
    b = f" base={base:.0f}%" if base is not None else ""
    print(f"  {label:46s} n={n:4d} hit={hp:5.1f}%{b} [{ys}] CI[{lo*100:.0f},{hi*100:.0f}] {tier}")


def main():
    ta, tl, oc = team_actuals(), team_lines(), outcomes()
    tg = oc.merge(tl, on=["season", "week", "team"], how="left") \
           .merge(ta[["season", "week", "team", "pass_att", "rush_att", "avg_pass_prior", "avg_rush_prior"]],
                  on=["season", "week", "team"], how="left")
    tg["pass_lean"] = tg.pass_att_line - tg.avg_pass_prior
    tg["rush_lean"] = tg.rush_att_line - tg.avg_rush_prior
    tg["run_rate"] = tg.rush_att / (tg.rush_att + tg.pass_att)     # ACTUAL run rate this game
    d = lines()
    for mkt, c in [("player_reception_yds", "wy"), ("player_rush_yds", "ry")]:
        tg = tg.merge(team_primary(d, mkt, c), on=["season", "week", "team"], how="left")

    v = tg.dropna(subset=["pass_lean", "rush_lean"])
    runheavy = v[(v.pass_lean < 0) & (v.rush_lean > 0)]
    passheavy = v[(v.pass_lean > 0) & (v.rush_lean < 0)]
    print(f"team-games with leans: {len(v)} | run-heavy-prep: {len(runheavy)} | pass-heavy-prep: {len(passheavy)}\n")

    print("(1) VALIDATION — does the line actually predict game script?")
    print(f"    run-heavy-prep games:  avg ACTUAL run-rate={runheavy.run_rate.mean():.3f}  avg pts={runheavy.team_pts.mean():.1f}")
    print(f"    pass-heavy-prep games: avg ACTUAL run-rate={passheavy.run_rate.mean():.3f}  avg pts={passheavy.team_pts.mean():.1f}")
    print(f"    league baseline:       avg ACTUAL run-rate={v.run_rate.mean():.3f}  avg pts={v.team_pts.mean():.1f}\n")

    base_u = (v.team_pts < v.tt_line).mean() * 100
    base_o = (v.team_pts > v.tt_line).mean() * 100
    print("(2) FLAGSHIP — run-heavy prep -> team total UNDER:")
    m = runheavy.dropna(subset=["tt_line", "team_pts"])
    rep("run-heavy -> team total UNDER", m, m.team_pts < m.tt_line, base_u)
    ext = m[(m.pass_lean < -3) & (m.rush_lean > 3)]
    rep("  strong (|lean|>3 att)", ext, ext.team_pts < ext.tt_line, base_u)
    print("   (contrast) pass-heavy prep -> team total OVER:")
    p = passheavy.dropna(subset=["tt_line", "team_pts"])
    rep("pass-heavy -> team total OVER", p, p.team_pts > p.tt_line, base_o)

    print("\n(3) GAME air-raid index (both teams' volume) -> game total:")
    gk = v.groupby("game_key").agg(pass_lean=("pass_lean", "sum"), rush_lean=("rush_lean", "sum"),
        season=("season", "first"), actual_total=("actual_total", "first"),
        total_line=("total_line", "first")).dropna()
    base_go = (gk.actual_total > gk.total_line).mean() * 100
    air = gk[gk.pass_lean - gk.rush_lean > 0]      # net pass-lean = air-raid
    grd = gk[gk.pass_lean - gk.rush_lean < 0]      # net run-lean = ground
    rep("air-raid game -> game total OVER", air, air.actual_total > air.total_line, base_go)
    rep("ground game -> game total UNDER", grd, grd.actual_total < grd.total_line, 100 - base_go)
    q = gk[(gk.pass_lean - gk.rush_lean) >= (gk.pass_lean - gk.rush_lean).quantile(0.75)]
    rep("  extreme air-raid (top25%) -> OVER", q, q.actual_total > q.total_line, base_go)

    print("\n(4) PROP cascades:")
    base_wr = (v.wy_act > v.wy_line).mean() * 100
    base_rb = (v.ry_act > v.ry_line).mean() * 100
    w = passheavy.dropna(subset=["wy_line", "wy_act"]); w = w[w.wy_act != w.wy_line]
    rep("pass-heavy prep -> WR1 rec-yds OVER", w, w.wy_act > w.wy_line, base_wr)
    r = runheavy.dropna(subset=["ry_line", "ry_act"]); r = r[r.ry_act != r.ry_line]
    rep("run-heavy prep -> RB1 rush-yds OVER", r, r.ry_act > r.ry_line, base_rb)


if __name__ == "__main__":
    main()
