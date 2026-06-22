"""
Per-BOOK spread<->ML divergence sweep. For every book: how much does its own ML diverge from its own
spread (residual std), and does that divergence predict the dog covering? A book that prices ML
INDEPENDENTLY (sharp/different) would show larger residual std AND a real residual->cover relationship.

residual = p_ml - p_spread (book's own numbers). p_spread from a universal spread->SU-winprob curve fit
on model_games. Grade ATS @ that book's close spread. We report, per book: residual std, corr(residual,
dog-cover), dog cover in the SOFT-fav-ML tail (residual<=-0.03) vs HARD tail (>=+0.03), n.
"""
import os, glob
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
cfbd = sorted(set(gm.homeTeam) | set(gm.awayTeam))
ALIAS = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
         "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State",
         "Southern Miss Golden Eagles": "Southern Miss"}
def to_cfbd(o):
    if o in ALIAS: return ALIAS[o]
    c = [x for x in cfbd if o.startswith(x + " ") or o == x]; c.sort(key=len, reverse=True)
    return c[0] if c else None
def ml_p(o):
    o = pd.to_numeric(o, errors="coerce")
    return np.where(o < 0, -o / (-o + 100), 100 / (o + 100))
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0
TS = [2021, 2022, 2023, 2024, 2025]
def per(b, w): return "/".join(f"{100*w[b.season==x].mean():.0f}" if (b.season==x).sum()>=8 else "--" for x in TS)

# universal spread -> fav SU-winprob curve (one row per game, from model_games)
g = gm[gm.spread_close.notna() & gm.actual_margin.notna()].copy()
g = g[g.spread_close != 0]
g["fav_spread"] = -g.spread_close.abs()
g["fav_won"] = (np.where(g.spread_close < 0, g.actual_margin, -g.actual_margin) > 0).astype(int)
curve = LogisticRegression().fit(g[["fav_spread"]], g.fav_won)

parts = []
for f in glob.glob(os.path.join(HERE, "data", "odds_history", "odds_*.parquet")):
    yr = int(os.path.basename(f).split("_")[1].split(".")[0]); d = pd.read_parquet(f); d["season"] = yr; parts.append(d)
od = pd.concat(parts, ignore_index=True)
od["home"] = od.home_team.map(to_cfbd); od["away"] = od.away_team.map(to_cfbd)
od = od.dropna(subset=["home", "away", "hrs_to_kick", "spread_home", "home_ml", "away_ml"])
od = od[od.hrs_to_kick >= 0]
mg = gm[["season", "homeTeam", "awayTeam", "actual_margin"]].rename(columns={"homeTeam": "home", "awayTeam": "away"})
ci = od[od.hrs_to_kick < 12].groupby(["season", "game_id", "book"]).hrs_to_kick.idxmin()
c = od.loc[ci].merge(mg, on=["season", "home", "away"], how="inner")
c = c[c.spread_home != 0]
hf = (c.spread_home < 0).values
c["fav_ml"] = pd.to_numeric(pd.Series(np.where(hf, c.home_ml, c.away_ml), index=c.index), errors="coerce")
c["dog_ml"] = pd.to_numeric(pd.Series(np.where(hf, c.away_ml, c.home_ml), index=c.index), errors="coerce")
c["fav_spread"] = -c.spread_home.abs()
c["fav_margin"] = np.where(hf, c.actual_margin, -c.actual_margin)
c = c[(c.fav_ml.between(-10000, 0)) & (c.dog_ml.between(-10000, 10000))]
pf = ml_p(c.fav_ml); pdg = ml_p(c.dog_ml); s = pf + pdg
c["p_ml"] = pf / s
c = c[(c.p_ml > 0.5) & (c.p_ml < 0.995)]
c["p_spread"] = curve.predict_proba(c[["fav_spread"]])[:, 1]
c["residual"] = c.p_ml - c.p_spread
c["ats"] = c.fav_margin + c.fav_spread
c = c[c.ats != 0]
c["dog_cov"] = (c.ats < 0).astype(int)

print(f"{'book':<16}{'n':>6}{'resStd':>8}{'corr':>7}{'softTail%':>10}{'hardTail%':>10}{'tailGap':>8}")
rows = []
for book, b in c.groupby("book"):
    if len(b) < 500: continue
    corr = np.corrcoef(b.residual, b.dog_cov)[0, 1]
    soft = b[b.residual <= -0.03]; hard = b[b.residual >= 0.03]
    sc = 100 * soft.dog_cov.mean() if len(soft) >= 30 else np.nan
    hc = 100 * hard.dog_cov.mean() if len(hard) >= 30 else np.nan
    rows.append((book, len(b), b.residual.std(), corr, sc, hc, len(soft), len(hard)))
rows.sort(key=lambda r: -r[2])
for book, n, rs, corr, sc, hc, ns, nh in rows:
    gap = (sc - hc) if (sc == sc and hc == hc) else np.nan
    sct = f"{sc:.1f}({ns})" if sc == sc else f"--({ns})"
    hct = f"{hc:.1f}({nh})" if hc == hc else f"--({nh})"
    gapt = f"{gap:+.1f}" if gap == gap else "--"
    print(f"{book:<16}{n:>6}{rs:>8.3f}{corr:>7.3f}{sct:>10}{hct:>10}{gapt:>8}")

# spotlight the highest-divergence book's soft-tail per-season
print("\n=== soft-fav-ML tail (residual<=-0.03 -> DOG) for the 3 highest-residual-std books ===")
for book, n, rs, *_ in rows[:3]:
    b = c[(c.book == book) & (c.residual <= -0.03)]
    if len(b) >= 30:
        print(f"  {book}: n={len(b)} DOG cover {100*b.dog_cov.mean():.1f}% roi {roi(int(b.dog_cov.sum()),len(b)):+.1f} [{per(b,b.dog_cov==1)}]")
