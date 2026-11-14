#!/usr/bin/env python3
"""PASSING TOUCHDOWNS — graded at the PRICE, with the new data (owner, 2026-09-19).
82% of pass-TD lines are 1.5, so 'model − line ≥ 0.35' is really 'take the over at whatever it costs' — the 61% win rate the
frozen config posts is the −150 favourite landing. This grades the market the only way a coarse-line market can be graded:
  p_implied  = devigged P(over) from the best over price and best under price (T-60, best of 4 books)
  p_model    = Poisson P(TDs > line) from the walk-forward ridge expectation (frozen set / full stack, seasons < test)
  bet OVER at the best over price when p_model − p_implied ≥ m; UNDER at the best under price when ≤ −m. ROI per season.
Plus: the market's own calibration by implied bucket; storyline cells for QBs (former team / homecoming / birthday) hit vs implied;
per-QB calibration (his over rate − implied, strict per-season sign); forecast window (learn ≤2025 wk12 → wk13-22) with his
entering bias; proper null (permute actual within season × implied bucket, refit)."""
import io, contextlib, itertools, numpy as np, pandas as pd, warnings
from scipy.stats import poisson
warnings.filterwarnings("ignore")
from prop_engine import ridge
from storyline_flags import flag
d = pd.read_parquet("data/_tds_deep_frame.parquet"); d = d[d.bo_dec.notna() & d.bu_dec.notna()].copy()
d["team"] = d.team.replace({"LAR":"LA"}); d["opp"] = d.opp.replace({"LAR":"LA"})
# prop-engine bo_dec / bu_dec are NET payouts per 1 unit (0.91 = −110), not decimal odds
d["bo_dec"] = d.bo_dec + 1; d["bu_dec"] = d.bu_dec + 1; d["p_imp"] = (1 / d.bo_dec) / (1 / d.bo_dec + 1 / d.bu_dec); d["over"] = (d.actual > d.close_line).astype(float)
d = flag(d, "player_name") if "player_name" in d.columns else flag(d.assign(player_name=d.qb), "player_name")
print(f"pass-TD lines with both prices: {len(d)} QB-games 2023-25 | lines {d.close_line.value_counts().to_dict()} | over rate {d.over.mean():.3f} vs mean implied {d.p_imp.mean():.3f}")
print("\nMARKET CALIBRATION by implied P(over) bucket — actual over rate / n / blanket ROI at best over price / best under price:")
def roi(x, side):
    if side == "over": pay, won = x.bo_dec - 1, x.actual > x.close_line
    else: pay, won = x.bu_dec - 1, x.actual < x.close_line
    p = np.where(won, pay, -1.0); return p.mean() if len(p) else np.nan
for b, g in d.groupby(pd.cut(d.p_imp, [0, .35, .4, .45, .5, .55, .6, .65, 1])): print(f"  {str(b):14s} over {100*g.over.mean():5.1f}%  n={len(g):4d} | O {100*roi(g,'over'):+6.1f}%  U {100*roi(g,'under'):+6.1f}%")
# ---------------------------------------------------------------- model expectation -> Poisson probability
src = open("exp_prop_injury_context.py").read().split('print("\\n" + "=" * 130)')[0]; ns = {}
with contextlib.redirect_stdout(io.StringIO()): exec(compile(src, "ic", "exec"), ns)
PE = ns["PE"]; FROZEN = [c for c in PE.SETS["player_pass_tds"] if c in d.columns]
FAMS = [c for c in d.columns if c.startswith(("qb_","T_","tm_","off_","def_","O_","OL_","oppallow","e_rw_","opp_rate_","ix_","sens_","inj_")) or c in ("l3","l5","szn","close_line","total","team_spread","implied_tt","wind","temp","precip","indoors","div_game","rest","is_home","primetime","big_fav","big_dog")]
FULL = list(dict.fromkeys(FROZEN + FAMS)); STORY = ["s_revenge","s_hc","s_birthday3"]
for c in ("revenge","hc","birthday3"): d["s_" + c] = d[c].fillna(False).astype(float)
d[FULL] = d[FULL].apply(lambda s: pd.to_numeric(s, errors="coerce")).apply(lambda s: s.fillna(s.median())).fillna(0)
def fit(tr, te, F, lam=200):
    Fk = [c for c in F if tr[c].std() > 1e-9]; X = tr[Fk].values.astype(float); mu, sd = X.mean(0), X.std(0); sd[sd == 0] = 1; w = ridge((X - mu) / sd, tr.actual.values.astype(float), lam); return np.clip(np.hstack([(te[Fk].values.astype(float) - mu) / sd, np.ones((len(te), 1))]) @ w, 0.05, 6)
def pover(lam_, line): return 1 - poisson.cdf(np.floor(line), lam_)
def grade(x, pm, m):
    e = pm - x.p_imp.values; o = e >= m; u = e <= -m
    ro = np.where(x.actual.values[o] > x.close_line.values[o], x.bo_dec.values[o] - 1, -1.0); ru = np.where(x.actual.values[u] < x.close_line.values[u], x.bu_dec.values[u] - 1, -1.0)
    allp = np.concatenate([ro, ru]); return (allp.mean() if len(allp) else np.nan, len(allp), (ro > 0).mean() if len(ro) else np.nan, len(ro), (ru > 0).mean() if len(ru) else np.nan, len(ru))
print("\n" + "=" * 130); print("THE BET AT THE PRICE — walk-forward 2024 / 2025: edge = Poisson P(over) from the model − implied P(over); ROI / n (over win%/n, under win%/n)"); print("=" * 130)
for name, F in (("frozen set", FROZEN), ("full stack", FULL), ("full + storyline flags", FULL + STORY), ("line + form only", ["close_line","l3","l5","szn"])):
    for m in (0.03, 0.06, 0.10):
        out = []
        for yr in (2024, 2025):
            tr, te = d[d.season < yr], d[d.season == yr]; pm = pover(fit(tr, te, F), te.close_line.values); r, n, wo, no, wu, nu = grade(te, pm, m); out.append(f"{yr}: {100*r if n else np.nan:+6.1f}% n={n:3d} (O {100*wo if no else np.nan:4.1f}%/{no:3d}, U {100*wu if nu else np.nan:4.1f}%/{nu:3d})")
        print(f"  {name:24s} m≥{m:.2f} | " + " | ".join(out))
print("\n  model calibration (full stack, 2024-25 pooled): P(over) model bucket → actual over rate")
P = pd.concat([d[d.season == yr].assign(pm=pover(fit(d[d.season < yr], d[d.season == yr], FULL), d[d.season == yr].close_line.values)) for yr in (2024, 2025)])
for b, g in P.groupby(pd.cut(P.pm, [0, .35, .45, .55, .65, 1])): print(f"    {str(b):12s} actual over {100*g.over.mean():5.1f}%  implied {100*g.p_imp.mean():5.1f}%  n={len(g)}")
print("\n  PROPER NULL — actual permuted within season × implied bucket, full stack refit, m ≥ 0.06, 5 reps:")
rng = np.random.default_rng(0); d["ib"] = pd.cut(d.p_imp, [0, .4, .5, .6, 1], labels=False)
for rep in range(5):
    s = d.copy(); s["actual"] = s.groupby(["season","ib"]).actual.transform(lambda v: rng.permutation(v.values)); out = []
    for yr in (2024, 2025):
        tr, te = s[s.season < yr], s[s.season == yr]; pm = pover(fit(tr, te, FULL), te.close_line.values); r, n, *_ = grade(te, pm, 0.06); out.append(f"{yr}: {100*r if n else np.nan:+6.1f}% n={n:3d}")
    print(f"    rep {rep}: " + " | ".join(out))
# ---------------------------------------------------------------- storyline cells for QBs
print("\n" + "=" * 130); print("STORYLINE CELLS — QB pass TDs: over rate vs implied, ROI at best price, per season"); print("=" * 130)
def cell(lab, m):
    x = d[m]
    if not len(x): print(f"  {lab:40s} —"); return
    print(f"  {lab:40s} n={len(x):3d} over {100*x.over.mean():5.1f}% vs implied {100*x.p_imp.mean():5.1f}% | O {100*roi(x,'over'):+6.1f}%  U {100*roi(x,'under'):+6.1f}% | " + " | ".join(f"{s}: {100*x[x.season==s].over.mean():4.1f}%/{int((x.season==s).sum()):2d}" if (x.season==s).sum() else f"{s}: —" for s in (2023,2024,2025)))
cell("vs former team", d.revenge); cell("vs former team, first meeting", d.first_meeting); cell("vs former team, drafted by them", d.revenge & d.drafted_by_opp); cell("vs former team, at old stadium", d.revenge & ~d.is_home)
cell("homecoming (visiting, ≤120 mi)", d.hc); cell("homecoming, non-division", d.hc_rare); cell("birthday ±3", d.birthday3); cell("none of the above", ~d.revenge & ~d.hc & ~d.birthday3)
# ---------------------------------------------------------------- per-QB calibration
print("\n" + "=" * 130); print("PER QB — his over rate minus implied, 2023-25 (15+ priced games); STABLE = same sign in every season with 8+ games"); print("=" * 130)
d["res"] = d.over - d.p_imp; rows = []
for q, g in d.groupby("qb"):
    if len(g) < 15: continue
    seas = [(s, gg.res.mean(), len(gg)) for s, gg in g.groupby("season") if len(gg) >= 8]; stable = len(seas) >= 2 and len({np.sign(v) for _, v, _ in seas}) == 1
    rows.append(dict(qb=q, games=len(g), over=100*g.over.mean(), implied=100*g.p_imp.mean(), diff=100*g.res.mean(), seasons=" ".join(f"{s}:{100*v:+.0f}({n})" for s, v, n in seas), stable="YES" if stable else "", roi_over=100*roi(g,"over"), roi_under=100*roi(g,"under")))
R = pd.DataFrame(rows).sort_values("diff", ascending=False); pd.set_option("display.width", 200); print(R.round(1).to_string(index=False))
print(f"  stable-sign QBs: {int((R.stable=='YES').sum())} of {len(R)} — a coin gives ~{len(R)*0.25:.0f} with two seasons, fewer with three")
# ---------------------------------------------------------------- forecast: entering per-QB bias -> bet
print("\n" + "=" * 130); print("FORECAST — learn ≤ 2025 wk12, bet 2025 wk13-22: his entering (over − implied) bias, shrunk k=8; bet the side of the bias when |bias| ≥ 0.08 at the best price"); print("=" * 130)
tr = d[(d.season < 2025) | ((d.season == 2025) & (d.week <= 12))]; te = d[(d.season == 2025) & (d.week > 12)].copy()
bias = tr.groupby("qb").res.agg(["sum","count"]); te["bias"] = te.qb.map(bias["sum"] / (bias["count"] + 8)).fillna(0)
for m in (0.05, 0.08, 0.12):
    o = te[te.bias >= m]; u = te[te.bias <= -m]; ro = np.where(o.actual > o.close_line, o.bo_dec - 1, -1.0); ru = np.where(u.actual < u.close_line, u.bu_dec - 1, -1.0)
    print(f"  |bias| ≥ {m:.2f}: OVER {100*(ro>0).mean() if len(ro) else np.nan:4.1f}%/{len(ro):3d} ROI {100*ro.mean() if len(ro) else np.nan:+6.1f}% | UNDER {100*(ru>0).mean() if len(ru) else np.nan:4.1f}%/{len(ru):3d} ROI {100*ru.mean() if len(ru) else np.nan:+6.1f}%")
pm = pover(fit(tr, te, FULL), te.close_line.values); r, n, wo, no, wu, nu = grade(te, pm, 0.06); print(f"  full-stack model at the price (m ≥ 0.06), same window: ROI {100*r if n else np.nan:+.1f}% n={n} (O {100*wo if no else np.nan:.1f}%/{no}, U {100*wu if nu else np.nan:.1f}%/{nu})")
d.to_parquet("data/_pass_tds_price_frame.parquet", index=False)
