"""
SPREAD <-> MONEYLINE internal-consistency divergence (within-book), the NFL theory.
A spread implies a SU win prob; the moneyline implies a SU win prob. When they DISAGREE the market is
mispricing one of them. Example: fav -4.5 should be ~-190 ML; if the book shows only -140 the ML says the
fav is WEAKER than the spread -> spread inflated -> dog live.

ml_soft = p_spread - p_ml   (how much MORE the SPREAD believes in the fav than the ML does)
  ml_soft > 0  -> spread too big vs ML (soft fav ML / inflated spread) -> expect DOG to cover
  ml_soft < 0  -> ML loves fav more than spread -> expect FAV to cover

Within-book = DraftKings close (spread + its own ML). Grade ATS @ that close spread. Per-season. Pushes excl.
p_spread from an empirical logistic fit of SU-win on the favorite spread (structural market curve).
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
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0
def ml_p(o):
    o = pd.to_numeric(o, errors="coerce")
    return np.where(o < 0, -o / (-o + 100), 100 / (o + 100))
TS = [2021, 2022, 2023, 2024, 2025]
BOOK = "draftkings"

parts = []
for f in glob.glob(os.path.join(HERE, "data", "odds_history", "odds_*.parquet")):
    yr = int(os.path.basename(f).split("_")[1].split(".")[0]); d = pd.read_parquet(f); d["season"] = yr; parts.append(d)
od = pd.concat(parts, ignore_index=True)
od = od[od.book == BOOK].copy()
od["home"] = od.home_team.map(to_cfbd); od["away"] = od.away_team.map(to_cfbd)
od = od.dropna(subset=["home", "away", "hrs_to_kick", "spread_home", "home_ml", "away_ml"])
od = od[(od.hrs_to_kick >= 0) & (od.hrs_to_kick < 12)]
ci = od.groupby(["season", "game_id"]).hrs_to_kick.idxmin()
c = od.loc[ci].copy()
mg = gm[["season", "homeTeam", "awayTeam", "actual_margin"]].rename(columns={"homeTeam": "home", "awayTeam": "away"})
c = c.merge(mg, on=["season", "home", "away"], how="inner")

# favorite perspective
c = c[c.spread_home != 0]                          # drop pickems
c["home_fav"] = c.spread_home < 0
c["fav_spread"] = -c.spread_home.abs()
c["fav_ml"] = np.where(c.home_fav, c.home_ml, c.away_ml)
c["dog_ml"] = np.where(c.home_fav, c.away_ml, c.home_ml)
c["fav_margin"] = np.where(c.home_fav, c.actual_margin, -c.actual_margin)
# clean ML
for col in ["fav_ml", "dog_ml"]:
    c[col] = pd.to_numeric(c[col], errors="coerce")
c = c[(c.fav_ml.between(-10000, 10000)) & (c.dog_ml.between(-10000, 10000)) & (c.fav_ml < 0)]
pf = ml_p(c.fav_ml); pd_ = ml_p(c.dog_ml); s = pf + pd_
c["p_ml"] = pf / s                                 # no-vig fav win prob from ML
c = c[(c.p_ml > 0.5) & (c.p_ml < 0.995)]
c["fav_won"] = (c.fav_margin > 0).astype(int)
c["ats"] = c.fav_margin + c.fav_spread             # >0 fav covers ATS
c = c[c.ats != 0]                                  # ATS push excl

# empirical spread -> SU winprob (structural curve)
lr = LogisticRegression().fit(c[["fav_spread"]], c.fav_won)
c["p_spread"] = lr.predict_proba(c[["fav_spread"]])[:, 1]
c["ml_soft"] = c.p_spread - c.p_ml                 # >0 spread bigger believer than ML -> dog live

print(f"DK games (clean fav/ML): {len(c)} | mean ml_soft {c.ml_soft.mean():+.3f}")
print(f"baseline fav ATS cover: {100*(c.ats>0).mean():.1f}%  | fav SU win: {100*c.fav_won.mean():.1f}%\n")

def per(b, w): return "/".join(f"{100*w[b.season==x].mean():.0f}" if (b.season==x).sum()>=8 else "--" for x in TS)
print("=== by ML-softness bucket (ml_soft = p_spread - p_ml) ===")
print(f"{'ml_soft bucket':>16}{'n':>6}{'DOGcover%':>10}{'favSUwin%':>10}{'dogML_roi%':>11}   per-season DOGcover")
edges = [(-1, -0.06), (-0.06, -0.03), (-0.03, 0.03), (0.03, 0.06), (0.06, 0.10), (0.10, 1)]
for lo, hi in edges:
    b = c[(c.ml_soft >= lo) & (c.ml_soft < hi)]
    if len(b) < 25: continue
    dogcov = (b.ats < 0)
    # dog ML roi: bet dog ML at dog_ml price
    dec = np.where(b.dog_ml < 0, 1 + 100 / -b.dog_ml, 1 + b.dog_ml / 100)
    dogwin = b.fav_won == 0
    pnl = np.where(dogwin, dec - 1, -1)
    print(f"{f'[{lo},{hi})':>16}{len(b):>6}{100*dogcov.mean():>10.1f}{100*b.fav_won.mean():>10.1f}{100*pnl.mean():>11.1f}   [{per(b,dogcov)}]")

print("\n=== HEADLINE: strong soft-fav-ML (ml_soft>=0.06) -> take the DOG (ATS) ===")
for thr in [0.05, 0.06, 0.08, 0.10]:
    b = c[c.ml_soft >= thr]
    if len(b) < 25: continue
    dc = (b.ats < 0)
    print(f"  ml_soft>={thr}: n={len(b)} DOG cover {100*dc.mean():.1f}% roi {roi(int(dc.sum()),len(b)):+.1f} [{per(b,dc)}]")
print("\n=== opposite: ML loves fav (ml_soft<=-0.05) -> FAV covers? ===")
for thr in [-0.05, -0.07, -0.10]:
    b = c[c.ml_soft <= thr]
    if len(b) < 25: continue
    fc = (b.ats > 0)
    print(f"  ml_soft<={thr}: n={len(b)} FAV cover {100*fc.mean():.1f}% roi {roi(int(fc.sum()),len(b)):+.1f} [{per(b,fc)}]")
