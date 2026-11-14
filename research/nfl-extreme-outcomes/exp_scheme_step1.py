#!/usr/bin/env python3
"""SCHEME PIPELINE — STEP 1: predict THIS WEEK's scheme from identity + opponent (owner 2026-09-17).

Owner's frame: predict both teams' schemes for the matchup, then predict production conditional
on scheme. This is the foundation: for each defense-game, predict the share of dropbacks in
man / two-high / single-high / cover3, using ONLY information available before kickoff:
  identity(D)     = defense's own share entering the week (prior games this season, K=4 seeded
                    with last season)
  invited(O)      = what this offense has PULLED out of prior defenses, entering the week:
                    mean over its prior games of (share played − that defense's identity),
                    K=4 seeded
  prediction      = identity + b × invited,  b fit on seasons before the test season
Gate: does adding the opponent term beat identity-only OUT OF SAMPLE (2023-25)? Reported as
mean absolute error and as correlation of predicted vs actual deviation-from-identity.
Preview of step 2 at the bottom: production per dropback BY SCHEME is in the same table
(fantasy points passing per scheme), so 'points Buffalo allows in man' is directly measurable.
"""
import numpy as np, pandas as pd
FP = "data/fpdata/"; num = lambda s: pd.to_numeric(s, errors="coerce"); K = 4.0
NICK = {"Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI","Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HOU","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
AB = {"ARZ":"ARI","BLT":"BAL","CLV":"CLE","HST":"HOU"}
DIALS = {"man":"Man","twohigh":"TwoHigh","singlehigh":"SingleHigh","cover3":"Cover3","zone":"Zone"}

co = pd.read_parquet(FP + "coverageMatrix__opponent.parquet")
co["def"] = co.teamNickname.map(NICK); co["off"] = co.opponentAbbreviation.map(lambda a: AB.get(a, a))
for k, s in DIALS.items():
    co[k] = 100 * num(co[f"opponentStatsCoverageScheme{s}PassingDropbacksPercentage"])
co["db"] = num(co.opponentStatsPassingDropbacksTotal)
co = co[co.man.notna() & (co.__season >= 2021)].sort_values(["__season", "__week"]).copy()
co = co.rename(columns={"__season": "season", "__week": "week"})

def entering(df, key, col):
    """K-seeded entering value: (K*prior-season mean + sum of prior games this season)/(K+n).
    Index-safe: the first version merged (which resets the index) and then re-attached by position,
    so every identity landed on the wrong row — that produced a fake 'identity is worse than the
    league mean' and a fake null on the opponent term."""
    d = df.sort_values([key, "season", "week"])
    pri = d.groupby([key, "season"])[col].mean()
    p = pd.Series([pri.get((kk, ss - 1), np.nan) for kk, ss in zip(d[key], d.season)], index=d.index)
    g = d.groupby([key, "season"])[col]
    cs = g.transform(lambda x: x.shift(1).expanding().sum()).fillna(0)
    cn = g.transform(lambda x: x.shift(1).expanding().count()).fillna(0)
    v = (p.fillna(0) * K + cs) / (K + cn); v[p.isna() & (cn == 0)] = np.nan
    return v.reindex(df.index)

for k in DIALS:
    co[k + "_id"] = entering(co, "def", k)                 # defense identity entering the game
    co[k + "_resid"] = co[k] - co[k + "_id"]               # what this game pulled off identity
    co[k + "_inv"] = entering(co, "off", k + "_resid")     # what the offense has pulled, entering
    co[k + "_dev"] = co[k] - co[k + "_id"]

print("=" * 100); print("STEP 1 — predicting this week's scheme.  Walk-forward, test 2023-25.  Error in share points."); print("=" * 100)
print(f"  {'dial':10s} {'b (fit)':>8s} | {'MAE identity-only':>18s} {'MAE +opponent':>14s} {'gain':>6s} | {'corr(pred dev, actual dev)':>26s} {'n':>5s}")
OUT = []
for k in DIALS:
    d = co.dropna(subset=[k + "_id", k + "_inv", k]).copy()
    rows = []
    for ssn in (2023, 2024, 2025):
        tr, te = d[d.season < ssn], d[d.season == ssn].copy()
        b = np.polyfit(tr[k + "_inv"], tr[k + "_dev"], 1)[0]
        te["pred"] = te[k + "_id"] + b * te[k + "_inv"]; te["b"] = b
        rows.append(te)
    r = pd.concat(rows)
    mae0 = (r[k] - r[k + "_id"]).abs().mean(); mae1 = (r[k] - r.pred).abs().mean()
    c = np.corrcoef(r.pred - r[k + "_id"], r[k + "_dev"])[0, 1]
    print(f"  {k:10s} {r.b.mean():8.2f} | {mae0:18.2f} {mae1:14.2f} {mae0-mae1:+6.2f} | {c:26.3f} {len(r):5d}")
    r["dial"] = k; OUT.append(r[["season", "week", "def", "off", "dial", k, k + "_id", "pred", "db"]].rename(columns={k: "actual", k + "_id": "identity"}))
pd.concat(OUT).to_parquet(FP + "_scheme_pred_step1.parquet", index=False)
print("  (gain > 0 = knowing the opponent predicts the scheme better than identity alone, out of sample)")
print("\n  sanity — MAE of the pre-game guesses, 2023-25 (identity must beat the league mean or entering() is broken):")
for k in DIALS:
    x = co[co.season >= 2023].dropna(subset=[k + "_id"]); lg = x.groupby("season")[k].transform("mean")
    print(f"    {k:10s} league-mean {(x[k]-lg).abs().mean():6.2f}   entering identity {(x[k]-x[k+'_id']).abs().mean():6.2f}   corr(identity, actual) {np.corrcoef(x[k+'_id'], x[k])[0,1]:+.3f}")

# by-week: is the opponent term useful early in the season, when the identity itself is still forming?
r = pd.concat(OUT); r["err_id"] = (r.actual - r.identity).abs(); r["err_pr"] = (r.actual - r.pred).abs()
print("\n  gain by week bucket (all dials pooled):")
for lo, hi in ((2, 5), (6, 10), (11, 18)):
    x = r[(r.week >= lo) & (r.week <= hi)]
    print(f"    weeks {lo:2d}-{hi:2d}: identity MAE {x.err_id.mean():.2f}  +opponent {x.err_pr.mean():.2f}  gain {x.err_id.mean()-x.err_pr.mean():+.2f}  n={len(x)}")

# ---- STEP 2 PREVIEW: production per dropback BY SCHEME is in the same table
print("\n" + "=" * 100); print("STEP 2 PREVIEW — fantasy points (PPR passing) allowed PER DROPBACK by the scheme the defense was in, 2025"); print("=" * 100)
for s in ("Man", "Zone", "SingleHigh", "TwoHigh"):
    co[f"pts_{s}"] = num(co[f"opponentStatsCoverageScheme{s}FantasyPointsPprPassing"]); co[f"db_{s}"] = num(co[f"opponentStatsCoverageScheme{s}PassingDropbacksTotal"])
x = co[co.season == 2025]
lg = {s: x[f"pts_{s}"].sum() / x[f"db_{s}"].sum() for s in ("Man", "Zone", "SingleHigh", "TwoHigh")}
print("  LEAGUE  " + "  ".join(f"{s}: {lg[s]:.3f}" for s in lg))
for t in ("BUF", "DET"):
    y = x[x["def"] == t]
    print(f"  {t} D   " + "  ".join(f"{s}: {y[f'pts_{s}'].sum()/y[f'db_{s}'].sum():.3f} ({int(y[f'db_{s}'].sum())} db)" for s in lg))
ct = pd.read_parquet(FP + "coverageMatrix__team.parquet"); ct["off"] = ct.teamNickname.map(NICK)
ct = ct[ct.__season == 2025]
print("  offense side — points per dropback the OFFENSE produced against each scheme, 2025:")
for t in ("BUF", "DET"):
    y = ct[ct.off == t]
    print(f"  {t} O   " + "  ".join(f"{s}: {num(y[f'teamStatsCoverageScheme{s}FantasyPointsPprPassing']).sum()/num(y[f'teamStatsCoverageScheme{s}PassingDropbacksTotal']).sum():.3f} ({int(num(y[f'teamStatsCoverageScheme{s}PassingDropbacksTotal']).sum())} db)" for s in lg))
