#!/usr/bin/env python3
"""ANYTIME TOUCHDOWN — the full pass with the new data (owner, 2026-09-19).
Killed twice (v1, v2 red-zone stack: model = market to three decimals, ROI negative everywhere). What is NEW since then:
storyline flags (former team / homecoming / birthday), and the per-player method (his own scored-minus-implied residual with
strict per-season stability, then a forecast window). Frame = the v2 red-zone frame (best price of 4 books at T-60, week ≥ 4)
rebuilt from the Fantasy Points history so 2023-25 are intact.
  (1) market calibration by implied bucket (re-stated)          (2) storyline cells: hit vs implied, ROI at best price, per season
  (3) per-player: residual vs implied, strict stability, list  (4) forecast: entering per-player residual (shrunk) → bet YES / skip
  (5) model: v2 parity + storyline + player residual, walk-forward, corr vs market, ROI at edge thresholds; proper null"""
import io, contextlib, numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
from fp_hist import read_fp
from storyline_flags import flag
src = open("exp_anytime_td_v2.py").read().split("def ridge(")[0]
src = src.replace('pd.read_parquet(FP + "', '_rd("')
def _rd(name):
    name = name.replace(".parquet", "")
    if name.startswith("_") or name == "player_crosswalk": return pd.read_parquet(f"data/fpdata/{name}.parquet")
    return read_fp(name)
ns = {"_rd": _rd}
with contextlib.redirect_stdout(io.StringIO()): exec(compile(src, "atd_v2", "exec"), ns)
D, V1, NEWF, payout = ns["D"], ns["V1"], ns["NEWF"], ns["payout"]
D = D.copy(); D["pay"] = payout(D.best_odds)
N2A = {"Arizona Cardinals":"ARI","Atlanta Falcons":"ATL","Baltimore Ravens":"BAL","Buffalo Bills":"BUF","Carolina Panthers":"CAR","Chicago Bears":"CHI","Cincinnati Bengals":"CIN","Cleveland Browns":"CLE","Dallas Cowboys":"DAL","Denver Broncos":"DEN","Detroit Lions":"DET","Green Bay Packers":"GB","Houston Texans":"HOU","Indianapolis Colts":"IND","Jacksonville Jaguars":"JAX","Kansas City Chiefs":"KC","Las Vegas Raiders":"LV","Los Angeles Chargers":"LAC","Los Angeles Rams":"LA","Miami Dolphins":"MIA","Minnesota Vikings":"MIN","New England Patriots":"NE","New Orleans Saints":"NO","New York Giants":"NYG","New York Jets":"NYJ","Philadelphia Eagles":"PHI","Pittsburgh Steelers":"PIT","San Francisco 49ers":"SF","Seattle Seahawks":"SEA","Tampa Bay Buccaneers":"TB","Tennessee Titans":"TEN","Washington Commanders":"WAS"}
D["team"] = D.team.replace({"LAR":"LA"}); D["home_ab"] = D.home.map(N2A); D["away_ab"] = D.away.map(N2A); D["is_home"] = D.team == D.home_ab; D["opp"] = np.where(D.is_home, D.away_ab, D.home_ab)   # panel home/away are full names
print(f"ATD frame: {len(D)} player-games 2023-25 (week ≥ 4, best price) | scored {D.scored.mean():.3f} vs mean implied {D.p_best.mean():.3f} | flat-bet every YES ROI {100*(D.scored * D.pay - (1 - D.scored)).mean():+.1f}%")
D = flag(D, "player_name"); D.to_parquet("data/_atd_full_frame.parquet", index=False)
def roi(x): return 100 * (x.scored * x.pay - (1 - x.scored)).mean() if len(x) else np.nan
print("\n(1) MARKET CALIBRATION — implied bucket: hit / implied / ROI at best price / n")
for b, g in D.groupby(pd.cut(D.p_best, [0, .05, .1, .15, .2, .3, .4, .55, 1])): print(f"  {str(b):14s} hit {100*g.scored.mean():5.1f}%  implied {100*g.p_best.mean():5.1f}%  ROI {roi(g):+6.1f}%  n={len(g)}")
print("\n(2) STORYLINE CELLS — hit vs implied, ROI at best price, per season (hit%/n)")
def cell(lab, m):
    x = D[m]; c = D[~m & D.player_id.isin(x.player_id.unique())]
    if len(x) < 20: print(f"  {lab:44s} n={len(x)}"); return
    print(f"  {lab:44s} n={len(x):4d} hit {100*x.scored.mean():5.1f}% vs implied {100*x.p_best.mean():5.1f}% (same players elsewhere: hit {100*c.scored.mean():5.1f}% vs {100*c.p_best.mean():5.1f}%) | ROI {roi(x):+6.1f}% | " + " | ".join(f"{s}: {100*x[x.season==s].scored.mean():4.1f}%/{int((x.season==s).sum()):3d}" if (x.season==s).sum() else f"{s}: —" for s in (2023,2024,2025)))
cell("vs former team (any)", D.revenge); cell("  first season away", D.revenge & (D.seasons_since <= 1)); cell("  drafted by them", D.revenge & D.drafted_by_opp); cell("  first meeting since leaving", D.first_meeting); cell("  at the old stadium", D.revenge & ~D.is_home)
cell("  QB vs former team", D.revenge & (D.position == "QB")); cell("  RB vs former team", D.revenge & (D.position == "RB")); cell("  WR/TE vs former team", D.revenge & D.position.isin(["WR","TE"]))
cell("homecoming (visiting, ≤120 mi, own far)", D.hc); cell("  non-division", D.hc_rare); cell("  RB homecoming", D.hc & (D.position == "RB")); cell("  WR/TE homecoming", D.hc & D.position.isin(["WR","TE"]))
cell("birthday ±3", D.birthday3); cell("  RB birthday", D.birthday3 & (D.position == "RB")); cell("none of the above", ~D.revenge & ~D.hc & ~D.birthday3)
print("\n(3) PER PLAYER — scored minus implied, 2023-25 (25+ priced games); STABLE = same sign every season with 8+ games")
D["res"] = D.scored - D.p_best; rows = []
for pid, g in D.groupby("player_id"):
    if len(g) < 25: continue
    seas = [(s, gg.res.mean(), len(gg)) for s, gg in g.groupby("season") if len(gg) >= 8]; stable = len(seas) >= 2 and len({np.sign(v) for _, v, _ in seas}) == 1
    rows.append(dict(player=g.player_name.iloc[0], pos=g.position.iloc[0], games=len(g), hit=100*g.scored.mean(), implied=100*g.p_best.mean(), diff=100*g.res.mean(), seasons=" ".join(f"{s}:{100*v:+.0f}({n})" for s, v, n in seas), stable="YES" if stable else "", roi=roi(g)))
R = pd.DataFrame(rows).sort_values("diff", ascending=False); pd.set_option("display.width", 220)
print("  TOP 15 (score more than priced):"); print(R.head(15).round(1).to_string(index=False)); print("  BOTTOM 15 (score less than priced):"); print(R.tail(15).round(1).to_string(index=False))
print(f"  players: {len(R)} | stable-sign: {int((R.stable=='YES').sum())} (positive {int(((R.stable=='YES')&(R['diff']>0)).sum())}, negative {int(((R.stable=='YES')&(R['diff']<0)).sum())}) — with 2 seasons a coin gives ~{0.5*len(R):.0f} stable, with 3 ~{0.25*len(R):.0f}")
print("\n(4) FORECAST — learn ≤ 2025 wk12, bet 2025 wk13-22 on his entering residual (scored − implied, shrunk k=10): YES when residual ≥ m at best price; per position")
tr = D[(D.season < 2025) | ((D.season == 2025) & (D.week <= 12))]; te = D[(D.season == 2025) & (D.week > 12)].copy()
b = tr.groupby("player_id").res.agg(["sum","count"]); te["bias"] = te.player_id.map(b["sum"] / (b["count"] + 10)).fillna(0)
for m in (0.03, 0.05, 0.08):
    x = te[te.bias >= m]; print(f"  residual ≥ {m:.2f}: n={len(x):3d} hit {100*x.scored.mean() if len(x) else np.nan:4.1f}% vs implied {100*x.p_best.mean() if len(x) else np.nan:4.1f}% ROI {roi(x):+6.1f}% | " + " ".join(f"{p}: {roi(x[x.position==p]):+.1f}%/{int((x.position==p).sum())}" for p in ("RB","WR","TE","QB")))
    y = te[te.bias <= -m]; print(f"    (skip side, residual ≤ −{m:.2f}: n={len(y):3d} hit {100*y.scored.mean() if len(y) else np.nan:4.1f}% vs implied {100*y.p_best.mean() if len(y) else np.nan:4.1f}% ROI {roi(y):+6.1f}%)")
# walk-forward version of the same per-player residual (entering, within-season accumulation), 2024 and 2025
print("  walk-forward (residual accumulates as games are played, prior seasons seed it):")
D = D.sort_values(["player_id","season","week"]); out = []
for yr in (2024, 2025):
    pri = D[D.season < yr].groupby("player_id").res.agg(["sum","count"]); x = D[D.season == yr].copy(); g = x.groupby("player_id"); cs = g.res.cumsum() - x.res; cn = g.cumcount()
    x["bias"] = (cs + x.player_id.map(pri["sum"]).fillna(0)) / (cn + x.player_id.map(pri["count"]).fillna(0) + 10); out.append(x)
X = pd.concat(out)
for m in (0.03, 0.05, 0.08): print("   " + " | ".join(f"{yr}: residual ≥ {m:.2f} n={int(((X.season==yr)&(X.bias>=m)).sum()):3d} hit {100*X[(X.season==yr)&(X.bias>=m)].scored.mean() if ((X.season==yr)&(X.bias>=m)).sum() else np.nan:4.1f}% vs implied {100*X[(X.season==yr)&(X.bias>=m)].p_best.mean() if ((X.season==yr)&(X.bias>=m)).sum() else np.nan:4.1f}% ROI {roi(X[(X.season==yr)&(X.bias>=m)]):+6.1f}%" for yr in (2024, 2025)))
print("\n(5) MODEL — v2 parity set + storyline flags + entering player residual, walk-forward; corr vs market; ROI at edge thresholds; proper null")
from prop_engine import ridge
X["rev_first"] = (X.revenge.fillna(False).astype(bool) & (X.seasons_since <= 1)).astype(float); STORY = ["revenge","hc","birthday3","first_meeting"]; X[STORY] = X[STORY].fillna(False).astype(float)
BASE = [c for c in V1 + ["rzshare5","rzshare10","rzshare20"] if c in X.columns]
def run(F, tag, lam=100):
    F = [c for c in dict.fromkeys(F) if c in X.columns]; x = X.copy(); x[F] = x[F].apply(lambda s: s.fillna(s.median())).fillna(0); o = []
    for yr in (2024, 2025):
        tr, te = x[x.season < yr], x[x.season == yr].copy()
        if yr == 2024: tr = D[D.season < yr].copy(); tr["bias"] = 0.0; tr[STORY + ["rev_first"]] = 0.0; tr = tr.assign(**{c: tr[c] if c in tr.columns else 0.0 for c in F}); tr[F] = tr[F].apply(lambda s: s.fillna(s.median())).fillna(0)
        Fk = [c for c in F if tr[c].std() > 1e-9]; Xt = tr[Fk].values.astype(float); mu, sd = Xt.mean(0), Xt.std(0); sd[sd == 0] = 1; w = ridge((Xt - mu) / sd, tr.scored.values.astype(float), lam)
        te["pm"] = np.clip(np.hstack([(te[Fk].values.astype(float) - mu) / sd, np.ones((len(te), 1))]) @ w, .001, .99); o.append(te)
    pr = pd.concat(o); pr["edge"] = pr.pm - pr.p_best
    print(f"  {tag:44s} corr model {np.corrcoef(pr.pm, pr.scored)[0,1]:+.4f} vs market {np.corrcoef(pr.p_best, pr.scored)[0,1]:+.4f} | " + " | ".join(f"edge≥{t:.2f}: n={int((pr.edge>=t).sum()):4d} ROI {roi(pr[pr.edge>=t]):+6.1f}% ({roi(pr[(pr.edge>=t)&(pr.season==2024)]):+.1f} / {roi(pr[(pr.edge>=t)&(pr.season==2025)]):+.1f})" for t in (0.02, 0.04, 0.06)))
    return pr
run(BASE, "v2 parity (as killed)"); run(BASE + STORY + ["rev_first"], "+ storyline flags"); pr = run(BASE + ["bias"], "+ entering player residual"); run(BASE + STORY + ["rev_first","bias"], "+ both")
rng = np.random.default_rng(0); X["ib"] = pd.cut(X.p_best, [0, .1, .2, .3, .45, 1], labels=False); keep = X.scored.copy()
print("  proper null (scored permuted within season × implied bucket, '+ both' refit, 3 reps):")
for rep in range(3):
    X["scored"] = X.groupby(["season","ib"]).scored.transform(lambda v: rng.permutation(v.values)); X["res"] = X.scored - X.p_best; run(BASE + STORY + ["rev_first","bias"], f"    null rep {rep}")
X["scored"] = keep
