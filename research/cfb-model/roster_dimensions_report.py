"""Roster-dimension leaderboards (2026) + week-1 backtest of each dimension.

Dimensions per team-season (all from the roster layer + coach history):
  exp_yrs    roster experience — mean prior seasons on ANY FBS roster (athlete_id
             history, capped at 4) across this season's roster
  ret_share  returning share of last season's production (roster_scores)
  ret_prod   ABSOLUTE returning production (how much comes back, not the share)
  cur_prod   total current productive stock = returning + transfers-in production
             (who's on the roster NOW, regardless of where they produced)
  same_hc    returning head coach (coach_seasons / coaches_{season})

Leaderboards: full table -> out/roster_dimensions_2026.csv; top-20s printed.
Backtest: week-1 games, home-vs-away diff per dimension -> does the higher side
win SU (2019-2025, scores) / cover ATS at the Odds-API close (2021-2025)?
Sign guard: home-favorite cover rate asserted ~50%.
"""
import numpy as np
import pandas as pd
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"

# ---- dimension frame ---------------------------------------------------------------
ro = pd.read_parquet(DATA / "cfbd" / "rosters.parquet")[["season", "athlete_id", "team"]]
first_season = ro.groupby("athlete_id").season.min().rename("first_season")
ro = ro.merge(first_season, on="athlete_id")
ro["exp"] = (ro.season - ro.first_season).clip(0, 4)
exp = ro.groupby(["season", "team"])["exp"].mean().rename("exp_yrs").reset_index()

rs = pd.read_parquet(DATA / "roster_scores.parquet")[
    ["season", "team", "ret_share", "ret_prod", "in_prod"]]
rs["cur_prod"] = rs.ret_prod + rs.in_prod

cs = pd.read_parquet(DATA / "cfbd" / "coach_seasons.parquet")
cs = cs.sort_values("games", ascending=False).drop_duplicates(["year", "school"])
hc = cs.set_index(["year", "school"]).coach
def same_hc(season, team):
    a, b = hc.get((season, team)), hc.get((season - 1, team))
    if season == 2026:
        c26 = pd.read_parquet(DATA / "cfbd" / "coaches_2026.parquet").set_index("school")
        if team in c26.index:
            return not bool(c26.loc[team, "new_hc"])
    if a is None or b is None:
        return None
    return a == b

dims = exp.merge(rs, on=["season", "team"], how="outer")
dims["same_hc"] = [same_hc(s, t) for s, t in zip(dims.season, dims.team)]

# ---- 2026 leaderboards -------------------------------------------------------------
d26 = dims[dims.season == 2026].dropna(subset=["exp_yrs"]).copy()
for c in ("exp_yrs", "ret_share", "ret_prod", "cur_prod"):
    d26[f"rk_{c}"] = d26[c].rank(ascending=False).astype(int)
d26["rk_exp_ret"] = (d26.rk_exp_yrs + d26.rk_ret_share).rank().astype(int)

out = HERE / "out" / "roster_dimensions_2026.csv"
d26.sort_values("rk_cur_prod").round(3).to_csv(out, index=False)
print(f"full table ({len(d26)} teams) -> {out}\n")

def top(df, col, n=20, extra=()):
    cols = ["team", col, *extra]
    print(df.nlargest(n, col)[cols].round(3).to_string(index=False))

print("=" * 70); print("1) MOST EXPERIENCED ROSTERS (mean prior FBS seasons/player)")
top(d26, "exp_yrs", extra=("ret_share",))
print("\n" + "=" * 70); print("2) EXPERIENCED + MOST RETURNING (combined rank)")
print(d26.nsmallest(20, "rk_exp_ret")[["team", "exp_yrs", "ret_share", "rk_exp_ret"]]
      .round(3).to_string(index=False))
print("\n" + "=" * 70); print("3) RETURNING COACH + RETURNING ROSTER (same HC, by ret_share)")
print(d26[d26.same_hc == True].nlargest(20, "ret_share")[
    ["team", "ret_share", "exp_yrs"]].round(3).to_string(index=False))
print("\n" + "=" * 70); print("4) BEST RETURNING PRODUCTION (absolute)")
top(d26, "ret_prod", extra=("ret_share",))
print("\n" + "=" * 70); print("5) BEST CURRENT PRODUCTIVE STOCK (returning + transfers in)")
top(d26, "cur_prod", extra=("ret_prod", "in_prod"))

# ---- week-1 backtest ---------------------------------------------------------------
print("\n" + "=" * 70)
print("WEEK-1 BACKTEST — does the higher-dimension team win/cover?")
mg = pd.read_parquet(DATA / "model_games.parquet")
g = mg[(mg.week == 1) & mg.homePoints.notna() & (mg.season >= 2019) & (mg.season <= 2025)][
    ["season", "homeTeam", "awayTeam", "homePoints", "awayPoints"]].copy()
g["margin"] = g.homePoints - g.awayPoints

ogf = pd.read_parquet(DATA / "odds_game_frame.parquet")[
    ["season", "home", "away", "close_spread"]]
g = g.merge(ogf, left_on=["season", "homeTeam", "awayTeam"],
            right_on=["season", "home", "away"], how="left")
# sign guard (mandatory): home favorites should cover ~half
_w = g.dropna(subset=["close_spread"])
_fav = _w[_w.close_spread < 0]
_cov = ((_fav.margin + _fav.close_spread) > 0).mean()
assert 0.42 < _cov < 0.58, f"spread sign guard failed: {_cov:.3f}"

D = dims.set_index(["season", "team"])
def dval(col, s, t):
    try: return D.loc[(s, t), col]
    except KeyError: return np.nan

results = []
for col in ("exp_yrs", "ret_share", "ret_prod", "cur_prod"):
    h = np.array([dval(col, s, t) for s, t in zip(g.season, g.homeTeam)], dtype=float)
    a = np.array([dval(col, s, t) for s, t in zip(g.season, g.awayTeam)], dtype=float)
    diff = h - a
    m = ~np.isnan(diff) & (diff != 0)
    su = np.where(diff[m] > 0, g.margin.values[m] > 0, g.margin.values[m] < 0)
    ats_m = m & g.close_spread.notna().values
    atsd = diff[ats_m]
    cover_home = (g.margin.values[ats_m] + g.close_spread.values[ats_m])
    ats = np.where(atsd > 0, cover_home > 0, cover_home < 0)
    push = cover_home == 0
    results.append(dict(dimension=col,
                        su_n=int(m.sum()), su_pct=round(100 * su.mean(), 1),
                        ats_n=int((~push).sum()), ats_pct=round(100 * ats[~push].mean(), 1)))
    # per-season ATS for the law (pooled can hide drift)
    seas = g.season.values[ats_m][~push]
    by = pd.Series(ats[~push]).groupby(seas).mean()
    results[-1]["ats_by_season"] = " ".join(f"{int(s)}:{v*100:.0f}" for s, v in by.items())

res = pd.DataFrame(results)
print(res[["dimension", "su_n", "su_pct", "ats_n", "ats_pct"]].to_string(index=False))
print("\nATS by season (higher-dim side cover %):")
for _, r in res.iterrows():
    print(f"  {r.dimension:10s} {r.ats_by_season}")

# same-HC as a matchup dimension (exactly one side returning coach)
sh = np.array([dval("same_hc", s, t) for s, t in zip(g.season, g.homeTeam)], dtype=object)
sa = np.array([dval("same_hc", s, t) for s, t in zip(g.season, g.awayTeam)], dtype=object)
m = pd.Series(sh).notna().values & pd.Series(sa).notna().values & (sh != sa)
su = np.where(np.array(sh[m], dtype=bool), g.margin.values[m] > 0, g.margin.values[m] < 0)
ats_m = m & g.close_spread.notna().values
cover_home = g.margin.values[ats_m] + g.close_spread.values[ats_m]
ats = np.where(np.array(sh[ats_m], dtype=bool), cover_home > 0, cover_home < 0)
push = cover_home == 0
print(f"\nsame_hc (returning-coach side vs new-coach side): "
      f"SU {100*su.mean():.1f}% n={int(m.sum())} | ATS {100*ats[~push].mean():.1f}% n={int((~push).sum())}")
