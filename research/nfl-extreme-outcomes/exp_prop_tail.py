#!/usr/bin/env python3
"""TAIL TEST — can the model sort the board?  (owner, 2026-09-18: "we're not betting every prop; 5% of
the board gets displayed. The question is whether we can tell which props are MORE probable.")

Every week, pool every prop the model priced across all markets, rank by conviction, and keep only
the top slice (2% / 5% / 10% / 20%). Score the slice against the rest of the board, per season,
for three feature stacks:  base -> + injury context (CTX) -> + FP matchup features (coverage prior,
separation, opponent coverage identity). Also a decile ladder (conviction decile -> hit rate) so
the SHAPE of the ranking shows, and a cross-config agreement check: do different settings pick the
same tail?  Conviction = model edge vs the BEST available book line, in units of that market's
edge spread (so yards and receptions rank on one scale). Best-book payout, pushes = no action."""
import itertools, sys, warnings, numpy as np, pandas as pd
NULL = int(sys.argv[sys.argv.index("--null") + 1]) if "--null" in sys.argv else None   # shuffled-target null: same pipeline, labels permuted in training
warnings.filterwarnings("ignore")
src = open("exp_prop_holdout.py").read().split('print("=" * 120)')[0]; ns = {}; exec(compile(src, "ho", "exec"), ns)
prep2, PE, CTX, fit_year, SETS = ns["prep2"], ns["PE"], ns["CTX"], ns["fit_year"], ns["SETS"]
_s = open("exp_rp_coverage_success.py").read(); _a = _s.split("# ================================================================ PART A")[0]; _b = "\n".join(_s.split("# ================================================================ PART B")[1].split("src = open")[0].splitlines()[1:]); rp = {}; exec(compile(_a + "\n" + _b, "rp", "exec"), rp)
PR, TP, PRI = rp["PR"], rp["TP"], rp["PRI"]
MK = (("player_pass_yds", ["QB"]), ("player_pass_completions", ["QB"]), ("player_pass_attempts", ["QB"]), ("player_receptions", ["WR","TE"]), ("player_reception_yds", ["WR","TE"]), ("player_rush_attempts", ["RB"]), ("player_rush_yds", ["RB"]), ("player_receptions", ["RB"]))
FPB = [c for c in PE.SETS["player_reception_yds"] if any(k in c for k in ("sep_", "cov_", "man", "zone", "press", "yprr"))]     # the FP-derived blocks already in the wide sets
rows = []
for mkt, pos in MK:
    d, F0 = prep2(mkt, pos, None)
    d = d.merge(TP, on=["team","season","week"], how="left") if pos == ["QB"] else d.merge(PR, on=["player_id","season","week"], how="left")
    wide = [c for c in dict.fromkeys(SETS[mkt]) if c in d.columns and d[c].notna().mean() > 0.35]
    base = [c for c in wide if c not in FPB]; fp = [c for c in wide if c in FPB]; pri = [f"team_{c}" for c in PRI] if pos == ["QB"] else PRI
    allc = list(dict.fromkeys(base + CTX + fp + pri)); d[allc] = d[allc].apply(lambda s: s.fillna(s.median())).fillna(0)
    stacks = {"base": base, "+ctx": base + CTX, "+ctx+fp": base + CTX + fp + pri}
    for (sname, F), lam, yr in itertools.product(stacks.items(), (60, 200, 600), (2024, 2025)):
        te = fit_year(d, F, lam, yr, shuffle_seed=NULL); te = te[te.bo_line.notna()].copy()
        over = te.edge >= 0; te["line"] = np.where(over, te.bo_line, te.bu_line); te["pay"] = np.where(over, te.bo_dec, te.bu_dec)
        te["edge_bb"] = np.where(over, te.pred - te.bo_line, te.bu_line - te.pred)           # edge vs the line we would actually get
        te["z"] = te.edge_bb / te.edge.std(); te["won"] = np.where(over, te.actual > te.line, te.actual < te.line); te["push"] = te.actual == te.line
        te["pl"] = np.where(te.push, 0, np.where(te.won, te.pay, -1.0)); te["mkt"] = mkt + ("_RB" if pos == ["RB"] else ""); te["stack"] = sname; te["lam"] = lam; te["over"] = over.values
        rows.append(te[["season","week","mkt","player_id","stack","lam","z","over","won","push","pl","pay"]])
A = pd.concat(rows, ignore_index=True); A["key"] = A.mkt + "|" + A.player_id.astype(str) + "|" + A.week.astype(str)
def score(x): x = x[~x.push]; return 100 * x.won.mean(), 100 * x.pl.mean(), len(x)
print("=" * 118); print("TAIL TEST — weekly cross-market ranking by conviction (edge vs best book, market-scaled). Slice = top share of the WEEK's board."); print("=" * 118)
for yr in (2024, 2025):
    print(f"\n{yr}")
    print(f"  {'stack':8s} {'lam':>4s} | {'whole board':>22s} | {'top 20%':>22s} | {'top 10%':>22s} | {'top 5%':>22s} | {'top 2%':>22s}")
    for (sname, lam), x in A[A.season == yr].groupby(["stack","lam"], sort=False):
        x = x.copy(); x["rk"] = x.groupby("week").z.rank(pct=True, ascending=False); out = [score(x)]
        for q in (0.20, 0.10, 0.05, 0.02): out.append(score(x[x.rk <= q]))
        print(f"  {sname:8s} {lam:4d} | " + " | ".join(f"{w:5.1f}% {r:+5.1f}% n={n:4d}" for w, r, n in out))
print("\nLADDER (pooled over lam): band of the week's board by conviction -> win% / ROI%.  Bands: 0-2 | 2-5 | 5-10 | 10-20 | 20-35 | 35-50 | 50-100")
BANDS = [(0, .02), (.02, .05), (.05, .10), (.10, .20), (.20, .35), (.35, .50), (.50, 1.01)]
for sname in ("base", "+ctx", "+ctx+fp"):
    for yr in (2024, 2025):
        x = A[(A.season == yr) & (A["stack"] == sname)].copy(); x["rk"] = x.groupby(["week","lam"]).z.rank(pct=True, ascending=False); x = x[~x.push]
        cells = [score(x[(x.rk > lo) & (x.rk <= hi)]) for lo, hi in BANDS]
        print(f"  {sname:8s} {yr}  " + " | ".join(f"{w:4.1f}% {r:+5.1f}%" for w, r, n in cells) + f"   (n per band, per lam: {', '.join(str(n//3) for w, r, n in cells)})")
print("\nNULL for the 5-10% band: n≈690/season -> 1 sd of win% ≈ 1.9 pts. Board base ≈ 53%. A band needs ≈57% to be 2 sd clear.")
print("\nTOP-5% BY MARKET, 2024 | 2025  (+ctx+fp stack, lam pooled; which markets the tail is made of and whether each part of it wins)")
x = A[A["stack"] == "+ctx+fp"].copy(); x["rk"] = x.groupby(["season","week","lam"]).z.rank(pct=True, ascending=False); t = x[x.rk <= 0.05]
for m, g in t.groupby("mkt"):
    a, b = g[g.season == 2024], g[g.season == 2025]; sa, sb = score(a), score(b)
    print(f"  {m:28s} share of tail {100*len(g)/len(t):4.1f}% | 2024 {sa[0]:5.1f}% {sa[1]:+5.1f}% n={sa[2]:4d} | 2025 {sb[0]:5.1f}% {sb[1]:+5.1f}% n={sb[2]:4d}")
print("\nAGREEMENT: share of the top-5% tail (lam=200) that is ALSO in the top-5% under the other lams / other stacks — is the tail a property of the data or of the settings?")
def tail(sname, lam, q=0.05):
    x = A[(A["stack"] == sname) & (A.lam == lam)].copy(); x["rk"] = x.groupby(["season","week"]).z.rank(pct=True, ascending=False); return set(x[x.rk <= q].key)
ref = tail("+ctx+fp", 200)
for sname, lam in (("+ctx+fp", 60), ("+ctx+fp", 600), ("+ctx", 200), ("base", 200)):
    o = tail(sname, lam); print(f"  vs {sname:8s} lam={lam:3d}: overlap {100*len(ref & o)/len(ref):4.0f}%")
print("\nCONSENSUS TAIL: props in the top 5% under ALL 9 (+ctx+fp) and (+ctx) settings — the ones every setting agrees on")
sets = [tail(s, l) for s in ("+ctx+fp","+ctx","base") for l in (60, 200, 600)]; cons = set.intersection(*sets)
x = A[(A["stack"] == "+ctx+fp") & (A.lam == 200) & A.key.isin(cons)]
for yr in (2024, 2025): w, r, n = score(x[x.season == yr]); print(f"  {yr}: {w:5.1f}% ROI {r:+5.1f}% n={n} ({n/18:.0f}/week)")
A.to_parquet(f"data/_prop_tail_rows{'' if NULL is None else '_null' + str(NULL)}.parquet", index=False); print("done")
