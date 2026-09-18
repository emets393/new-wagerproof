#!/usr/bin/env python3
"""Re-grade the FP model backtest against REAL T-60 Odds-API lines (odds_hist)
instead of nflverse spread_line. Confirms the edge survives on bettable lines.
(Owner catch 2026-09-17: nflverse lines != our Odds-API lines.)"""
import numpy as np
import pandas as pd

# T-60 consensus line per game: last snapshot <=60min before commence, median across books
o = pd.read_parquet("data/odds_hist.parquet")
o["snap_ts"] = pd.to_datetime(o.snap_ts, utc=True, errors="coerce")
o["commence_time"] = pd.to_datetime(o.commence_time, utc=True, errors="coerce")
o = o[o.snap_ts <= o.commence_time - pd.Timedelta(minutes=60)]
o = o.sort_values("snap_ts")
last = o.groupby(["season", "home_team", "away_team", "book"], as_index=False).last()
t60 = (last.groupby(["season", "home_team", "away_team"])
       .agg(t60_home_spread=("spread_home", "median"), t60_total=("total_point", "median"),
            n_books=("book", "nunique")).reset_index())
# snap to half-point grid
for c in ("t60_home_spread", "t60_total"):
    t60[c] = (t60[c] * 2).round() / 2
print(f"T-60 lines built: {len(t60)} games, seasons {sorted(t60.season.unique())}")

# build model predictions (FP-only variant) via predict_upcoming machinery, played games only
src = open("predict_upcoming.py").read().split("# validation backtest")[0]
exec(src)
for c in [x for x in FEATS if x in p.columns]:
    p[c] = pd.to_numeric(p[c], errors="coerce")
FEATS = [c for c in FEATS if c in p.columns and not p[c].isna().all()]
val = p[(p.season >= 2021) & (p.season <= 2025)].dropna(subset=["pts"]).copy()


def rf3(X, y, lam=50.0):
    Xb = np.hstack([X, np.ones((len(X), 1))]); A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam
    return np.linalg.solve(A, Xb.T @ y)


preds = []
for ssn in (2023, 2024, 2025):
    tr = val[val.season < ssn].dropna(subset=FEATS + ["line", "total"])
    te = val[val.season == ssn].copy()
    X = tr[FEATS].values.astype(float); m, s = X.mean(0), X.std(0); s[s == 0] = 1
    te2 = te.dropna(subset=FEATS).copy()
    w = rf3((X - m) / s, tr.pts.values.astype(float))
    te2["pred"] = np.hstack([(te2[FEATS].values.astype(float) - m) / s, np.ones((len(te2), 1))]) @ w
    preds.append(te2)
pr = pd.concat(preds)
own = pr.set_index(["game_id", "team"]).pred
pr["pm"] = pr.pred - own.reindex(pd.MultiIndex.from_arrays([pr.game_id, pr.opp])).values
pr["pt"] = pr.pred + own.reindex(pd.MultiIndex.from_arrays([pr.game_id, pr.opp])).values
gg = pr.drop_duplicates("game_id").copy()
gmv = g.set_index("game_id")
gg["home_ab"] = gmv.reindex(gg.game_id).home_team.values
gg["away_ab"] = gmv.reindex(gg.game_id).away_team.values
gg["hpm"] = np.where(gg.team == gg.home_ab, gg.pm, -gg.pm)
gg["act_total"] = gmv.reindex(gg.game_id).home_score.values + gmv.reindex(gg.game_id).away_score.values
gg["home_margin"] = gmv.reindex(gg.game_id).home_score.values - gmv.reindex(gg.game_id).away_score.values

# join T-60 (odds_hist uses full team names -> map nflverse abbr)
AB2FULL = {"ARI":"Arizona","ATL":"Atlanta","BAL":"Baltimore","BUF":"Buffalo","CAR":"Carolina",
"CHI":"Chicago","CIN":"Cincinnati","CLE":"Cleveland","DAL":"Dallas","DEN":"Denver","DET":"Detroit",
"GB":"Green Bay","HOU":"Houston","IND":"Indianapolis","JAX":"Jacksonville","KC":"Kansas City",
"LA":"LA Rams","LAC":"LA Chargers","LV":"Las Vegas","MIA":"Miami","MIN":"Minnesota","NE":"New England",
"NO":"New Orleans","NYG":"NY Giants","NYJ":"NY Jets","PHI":"Philadelphia","PIT":"Pittsburgh",
"SEA":"Seattle","SF":"San Francisco","TB":"Tampa Bay","TEN":"Tennessee","WAS":"Washington"}
gg["home_full"] = gg.home_ab.map(AB2FULL); gg["away_full"] = gg.away_ab.map(AB2FULL)
gg = gg.merge(t60, left_on=["season", "home_full", "away_full"],
              right_on=["season", "home_team", "away_team"], how="left")
matched = gg.t60_home_spread.notna().mean()
print(f"model games matched to T-60 lines: {matched:.0%}\n")

for src_label, home_line, tot in (("NFLVERSE lines", gg.get("line_home"), gg.total),
                                  ("T-60 ODDS-API lines", gg.t60_home_spread, gg.t60_total)):
    d = gg.dropna(subset=["hpm", "act_total"]).copy()
    if src_label.startswith("NFLVERSE"):
        # nflverse home line = -(team line where team==home)  -> reconstruct
        d["hl"] = np.where(d.team == d.home_ab, d.line, -d.line)
    else:
        d = d.dropna(subset=["t60_home_spread"]).copy()
        d["hl"] = d.t60_home_spread
        d["total"] = d.t60_total
    d["sp_edge"] = d.hpm - (-d.hl)
    d["tot_edge"] = d.pt - d.total
    print(f"== {src_label} (n={len(d)}) ==")
    for thr in (2, 3):
        m = d.sp_edge.abs() >= thr; pk = d.sp_edge >= thr
        ok = m & ((d.home_margin + d.hl) != 0)
        w = np.where(pk, (d.home_margin + d.hl) > 0, (d.home_margin + d.hl) < 0)
        mt = d.tot_edge.abs() >= thr; pkt = d.tot_edge >= thr
        okt = mt & (d.act_total != d.total)
        wt = np.where(pkt, d.act_total > d.total, d.act_total < d.total)
        print(f"  SP{thr}: {100*w[ok].mean():.1f}% (n={ok.sum()})   TOT{thr}: {100*wt[okt].mean():.1f}% (n={okt.sum()})")
    print()
