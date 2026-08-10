"""Does the CURRENT early-week blend (roster + CORE features) have BETTABLE edges wk1-3?
Walk-forward 2021-25: train on seasons < Y, predict wk1-3 of Y, bet when |model - line| >= cut.
Graded ATS vs BOTH open and close, per season. Uses the exact production feature sets."""
import numpy as np, pandas as pd, warnings
from sklearn.linear_model import Ridge
warnings.filterwarnings("ignore")
import importlib.util, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("CFB_SEASON", "2026"); os.environ.setdefault("CFB_WEEK", "1")
spec = importlib.util.spec_from_file_location("ew", os.path.join(HERE, "cfb_early_week.py"))
# import the module WITHOUT running main(): temporarily neuter __main__ guard by loading module (it calls main() at bottom?)
src = open(os.path.join(HERE, "cfb_early_week.py")).read()
src = src.replace('main()', 'pass', 1) if '\nmain()' in src else src
ns = {"__name__": "ew_mod", "__file__": os.path.join(HERE, "cfb_early_week.py")}
exec(compile(src.split("\nif __name__")[0] if "\nif __name__" in src else src.replace("\nmain()", "\n"), "cfb_early_week.py", "exec"), ns)
load, MARGIN_FEATS, TOTAL_FEATS = ns["load"], ns["MARGIN_FEATS"], ns["TOTAL_FEATS"]

gm = load()
tr = gm[(gm.week <= 3) & gm.actual_margin.notna()].copy()
print(f"frame: {len(tr)} completed wk1-3 games, seasons {sorted(tr.season.unique())}")

def imp(df, feats):
    means = df[feats].mean()
    return df[feats].fillna(means)

rows = []
for Y in (2021, 2022, 2023, 2024, 2025):
    a, b = tr[tr.season < Y].copy(), tr[tr.season == Y].copy()
    if len(a) < 300 or len(b) < 30: continue
    fa = sorted(set(MARGIN_FEATS + TOTAL_FEATS))
    means = a[fa].mean()
    A = a[fa].fillna(means); B = b[fa].fillna(means)
    mm = Ridge(alpha=5.0).fit(A[MARGIN_FEATS], a.actual_margin)
    tt = Ridge(alpha=5.0).fit(A[TOTAL_FEATS], a.actual_total)
    b["pm"] = mm.predict(B[MARGIN_FEATS]); b["pt"] = tt.predict(B[TOTAL_FEATS])
    for line_col, tot_col, tag in (("spread_open","total_open","open"), ("spread_close","total_close","close")):
        d = b[b[line_col].notna()].copy()
        d["edge_s"] = d.pm + d[line_col]                 # >0 bet HOME
        d["cover_home"] = np.sign(d.actual_margin + d[line_col])
        dt = b[b[tot_col].notna()].copy()
        dt["edge_t"] = dt.pt - dt[tot_col]
        dt["over"] = np.sign(dt.actual_total - dt[tot_col])
        for cut in (2,4,6,8):
            s = d[d.edge_s.abs() >= cut]
            win = (np.sign(s.edge_s) == s.cover_home) & (s.cover_home != 0)
            n = int((s.cover_home != 0).sum())
            rows.append(dict(mkt="spread", vs=tag, cut=cut, season=Y, n=n, w=int(win.sum())))
            t2 = dt[dt.edge_t.abs() >= cut]
            winT = (np.sign(t2.edge_t) == t2.over) & (t2.over != 0)
            nT = int((t2.over != 0).sum())
            rows.append(dict(mkt="total", vs=tag, cut=cut, season=Y, n=nT, w=int(winT.sum())))

r = pd.DataFrame(rows)
print("\n=== POOLED (2021-25 wk1-3) — win% (n) by market x line x cut ===")
for mkt in ("spread","total"):
    for vs in ("open","close"):
        line = f"{mkt:6s} vs {vs:5s}: "
        for cut in (2,4,6,8):
            g = r[(r.mkt==mkt)&(r.vs==vs)&(r.cut==cut)]
            n, w = g.n.sum(), g.w.sum()
            line += f"cut>={cut}: {100*w/n:.1f}% ({n})   " if n else f"cut>={cut}: —   "
        print(line)
print("\n=== PER SEASON, cut>=4 ===")
for mkt in ("spread","total"):
    for vs in ("open","close"):
        g = r[(r.mkt==mkt)&(r.vs==vs)&(r.cut==4)].sort_values("season")
        cells = "  ".join(f"{row.season}: {100*row.w/row.n:.0f}% ({row.n})" if row.n else f"{row.season}: —" for row in g.itertuples())
        print(f"{mkt:6s} vs {vs:5s}: {cells}")
