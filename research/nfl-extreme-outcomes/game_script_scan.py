"""Game-script signal scan (2024-25). Read Vegas's attempts/completions lines as a
game-script lean, then test cascades into team totals, game total, and player props.

Leans (per team-game, vs the player's own season-to-date avg LINE, entering):
  qb_pa_lean = starting QB pass-attempts line - his prior-avg line   (>0 = pass-heavy lean)
  rb_ra_lean = lead RB rush-attempts line - his prior-avg line       (>0 = run-heavy lean)

First battery of mechanism cascades, each graded 2024 vs 2025 separately, nothing gated —
reported with n, per-season split, Wilson CI, and a tier. Read-only.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from stats_helpers import wilson_ci

DATA = Path(__file__).resolve().parent / "data"
NORM = {"LAR": "LA", "WSH": "WAS", "JAC": "JAX", "OAK": "LV", "SD": "LAC", "STL": "LA"}


def lines():
    pf = pd.read_parquet(DATA / "props_frame.parquet")
    a = pf.groupby(["season", "week", "player_id", "position", "team", "market"]).agg(
        line=("close_line", "median"), actual=("actual", "first")).reset_index()
    ex = pd.read_parquet(DATA / "props_rows_extra.parquet")
    b = ex.groupby(["season", "week", "player_id", "position", "team", "market"]).agg(
        line=("line", "median")).reset_index()
    b["actual"] = np.nan
    d = pd.concat([a, b], ignore_index=True)
    d["team"] = d.team.replace(NORM)
    d = d.sort_values(["player_id", "market", "season", "week"])
    d["prior"] = d.groupby(["player_id", "market"]).line.transform(
        lambda s: s.shift(1).expanding(min_periods=2).mean())
    d["lean"] = d.line - d.prior
    return d


def team_primary(d, market, col):
    """Per (season,week,team) take the player with the highest line for `market`."""
    m = d[(d.market == market) & d.lean.notna()].copy()
    idx = m.groupby(["season", "week", "team"]).line.idxmax()
    out = m.loc[idx, ["season", "week", "team", "lean", "line", "actual"]].copy()
    return out.rename(columns={"lean": f"{col}_lean", "line": f"{col}_line", "actual": f"{col}_act"})


def outcomes():
    h = pd.read_parquet(DATA / "h1tt_frame.parquet")
    h["home_ab"] = h.home_ab.replace(NORM); h["away_ab"] = h.away_ab.replace(NORM)
    rows = []
    for _, r in h.iterrows():
        tot = r.final_home + r.final_away
        for home in (True, False):
            rows.append(dict(
                season=int(r.season), week=int(r.week),
                team=r.home_ab if home else r.away_ab,
                team_pts=r.final_home if home else r.final_away,
                tt_line=r.tt_home_close_tt_home_point if home else r.tt_away_close_tt_away_point,
                total_line=r.total_close_total_point, actual_total=tot))
    return pd.DataFrame(rows)


def report(label, sub, hit, base=None):
    """hit = boolean Series (the bet won). Prints n, hit%, per-season, CI, tier."""
    s = pd.DataFrame({"hit": hit, "season": sub.season}).dropna(subset=["hit"])
    n = len(s)
    if n == 0:
        print(f"  {label:44s} n=0"); return
    k = int(s.hit.sum()); pctg = k / n * 100
    lo, hi = wilson_ci(k, n)
    yr = {y: s[s.season == y].hit.mean() * 100 for y in (2024, 2025) if len(s[s.season == y])}
    both = len(yr) == 2 and all(v >= 52.4 for v in yr.values())
    tier = "HIGH" if (both and n >= 40) else ("LEAD" if both else "noise")
    ys = " ".join(f"{y}:{v:.0f}%/{len(s[s.season==y])}" for y, v in yr.items())
    b = f"  (base {base:.0f}%)" if base is not None else ""
    print(f"  {label:44s} n={n:4d} hit={pctg:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] [{ys}] {tier}{b}")


def main():
    d = lines()
    qb = team_primary(d, "player_pass_attempts", "pa")
    rb = team_primary(d, "player_rush_attempts", "ra")
    wr1 = team_primary(d, "player_reception_yds", "wy")   # WR1 reception yds (line+actual)
    rby = team_primary(d, "player_rush_yds", "ry")        # lead RB rush yds
    oc = outcomes()

    tg = qb.merge(rb, on=["season", "week", "team"], how="outer") \
           .merge(wr1, on=["season", "week", "team"], how="left") \
           .merge(rby, on=["season", "week", "team"], how="left") \
           .merge(oc, on=["season", "week", "team"], how="inner")

    tt = tg.dropna(subset=["tt_line", "team_pts"])
    base_tt_under = (tt.team_pts < tt.tt_line).mean() * 100
    base_tt_over = (tt.team_pts > tt.tt_line).mean() * 100
    print(f"team-game rows: {len(tg)} | base team-total UNDER={base_tt_under:.0f}% OVER={base_tt_over:.0f}%\n")

    print("FLAGSHIP — run-heavy script (pass-lean DOWN + rush-lean UP) -> team total UNDER:")
    m = tg[(tg.pa_lean < 0) & (tg.ra_lean > 0) & tg.tt_line.notna() & tg.team_pts.notna()]
    report("run-heavy -> team total UNDER", m, m.team_pts < m.tt_line, base_tt_under)
    ext = m[(tg.pa_lean < -1) & (tg.ra_lean > 1)]
    report("  stronger (|leans|>1 att)", ext, ext.team_pts < ext.tt_line, base_tt_under)

    print("\nPASS-heavy script (pass-lean UP) -> team total OVER:")
    p = tg[(tg.pa_lean > 0) & tg.tt_line.notna() & tg.team_pts.notna()]
    report("pass-lean up -> team total OVER", p, p.team_pts > p.tt_line, base_tt_over)

    print("\nPROP cascades:")
    w = tg[(tg.pa_lean > 0) & tg.wy_line.notna() & tg.wy_act.notna() & (tg.wy_act != tg.wy_line)]
    base_wr = ((tg.wy_act > tg.wy_line).mean()) * 100
    report("pass-lean up -> WR1 rec-yds OVER", w, w.wy_act > w.wy_line, base_wr)
    r = tg[(tg.ra_lean > 0) & tg.ry_line.notna() & tg.ry_act.notna() & (tg.ry_act != tg.ry_line)]
    base_rb = ((tg.ry_act > tg.ry_line).mean()) * 100
    report("run-lean up -> RB1 rush-yds OVER", r, r.ry_act > r.ry_line, base_rb)
    rr = tg[(tg.ra_lean > 0) & (tg.pa_lean < 0) & tg.ry_line.notna() & tg.ry_act.notna() & (tg.ry_act != tg.ry_line)]
    report("  + pass-lean down (ground) -> RB1 OVER", rr, rr.ry_act > rr.ry_line, base_rb)


if __name__ == "__main__":
    main()
