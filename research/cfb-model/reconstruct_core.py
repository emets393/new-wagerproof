"""Reconstruct CORE-style ratings AS-OF any week (the archive CFBD doesn't serve).

Method: ridge over team-game offensive PPA (per play, weighted by plays) with
one-hot team-offense + opponent-defense + HFA — the standard opponent-adjustment
CORE describes. FBS-vs-FBS only, regular+post. We can't replicate their exact
context model / garbage-time filter, so this is a PROXY; the validation section
scores our END-OF-SEASON solve against the official published CORE (2016-2025).
If that correlation is high, the weekly as-of solves inherit the fidelity.

Outputs: data/cfbd/core_asof.parquet  (season, thru_week, team, off, def, overall)
Run:  python3 reconstruct_core.py [--validate-only]
"""
import sys
import glob
import numpy as np
import pandas as pd
from pathlib import Path
from scipy import sparse
from sklearn.linear_model import Ridge

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
VALIDATE_ONLY = "--validate-only" in sys.argv

ga = pd.concat([pd.read_parquet(f) for f in
                sorted(glob.glob(str(DATA / "cfbd" / "game_advanced_20*.parquet")))],
               ignore_index=True)
ga = ga[ga["offense.ppa"].notna() & ga["offense.plays"].notna()]
# FBS-vs-FBS only: both sides must appear as a 'team' that season
fbs = ga.groupby("season").team.unique().to_dict()
ga = ga[[o in set(fbs[s]) for s, o in zip(ga.season, ga.opponent)]]
# postseason rows: treat as after the last regular week
ga["wk"] = np.where(ga.seasonType == "postseason", 99, ga.week)

# HFA flag via model_games home side
mg = pd.read_parquet(DATA / "model_games.parquet")[["season", "week", "homeTeam", "awayTeam"]]
home_key = set(zip(mg.season, mg.homeTeam, mg.awayTeam))
ga["is_home"] = [(s, t, o) in home_key for s, t, o in zip(ga.season, ga.team, ga.opponent)]

def solve(season, thru_wk):
    d = ga[(ga.season == season) & (ga.wk <= thru_wk)]
    if len(d) < 100:
        return None
    teams = sorted(set(d.team) | set(d.opponent))
    ix = {t: i for i, t in enumerate(teams)}
    n, k = len(d), len(teams)
    rows_o = np.arange(n); X = sparse.lil_matrix((n, 2 * k + 1))
    X[rows_o, [ix[t] for t in d.team]] = 1.0                    # team offense
    X[rows_o, [k + ix[o] for o in d.opponent]] = 1.0            # opponent defense
    X[rows_o, 2 * k] = np.where(d.is_home, 1.0, -1.0)           # symmetric HFA
    y = d["offense.ppa"].values
    w = d["offense.plays"].values
    m = Ridge(alpha=1.0, fit_intercept=True).fit(sparse.csr_matrix(X), y, sample_weight=w)
    off = m.coef_[:k] * 100                                      # per-100-play scale
    dfn = m.coef_[k:2 * k] * 100
    off -= off.mean(); dfn -= dfn.mean()                         # league-average zero
    return pd.DataFrame(dict(season=season, thru_week=thru_wk, team=teams,
                             off=off.round(2), dfn=dfn.round(2),
                             overall=(off - dfn).round(2)))

# ---- validation vs official CORE (end of season) -----------------------------------
core = pd.read_parquet(DATA / "cfbd" / "core_ratings.parquet")
print("validation: our full-season solve vs official CORE")
print(f"{'season':6s} {'r_overall':>9s} {'rank_r':>7s} {'r_off':>6s} {'r_def':>6s} {'n':>4s}")
for s in range(2016, 2026):
    ours = solve(s, 99)
    if ours is None: continue
    off_c = core[core.year == s][["team", "overall", "offense", "defense"]]
    j = ours.merge(off_c, on="team", how="inner")
    r = np.corrcoef(j.overall_x, j.overall_y)[0, 1]
    rr = j.overall_x.rank().corr(j.overall_y.rank())
    ro = np.corrcoef(j.off, j.offense)[0, 1]
    rd = np.corrcoef(j.dfn, j.defense)[0, 1]
    print(f"{s:6d} {r:9.3f} {rr:7.3f} {ro:6.3f} {rd:6.3f} {len(j):4d}")

if VALIDATE_ONLY:
    sys.exit(0)

# ---- as-of weekly archive ----------------------------------------------------------
frames = []
for s in range(2016, 2026):
    _wks = ga[(ga.season == s) & (ga.wk < 99)].wk
    if not len(_wks):
        print(f"{s}: no game_advanced rows (skipped)"); continue
    max_wk = int(_wks.max())
    for w in range(3, max_wk + 1):
        r = solve(s, w)
        if r is not None:
            frames.append(r)
    fin = solve(s, 99)
    if fin is not None:
        frames.append(fin)
    print(f"{s}: weeks 3-{max_wk} + final solved")
out = pd.concat(frames, ignore_index=True)
out.to_parquet(DATA / "cfbd" / "core_asof.parquet", index=False)
print(f"\n{len(out)} rows -> data/cfbd/core_asof.parquet")
