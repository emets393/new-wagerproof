"""
b58: Does the predicted-vs-line GAP correlate with hit rate? User Q: if model predicts 40 and line is
47.5 (a 7.5pt gap), does that hit better/worse than a 2pt gap?
Buckets by |edge|; reports hit% per bucket. Tests against BOTH lines + with/without agreement filter.
Uses the locked consensus_totals build functions.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from consensus_totals import build_b15, build_b55
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_total"]=m.home_score+m.away_score

# Build predictions for 2024+2025, BOTH modes (so we can test honestly vs both lines)
out=[]
for Y in [2024,2025]:
    L(f"[build] {Y}...")
    b15_f=build_b15(Y,strict_open=False); b55_f=build_b55(Y,strict_open=False)
    b15_s=build_b15(Y,strict_open=True); b55_s=build_b55(Y,strict_open=True)
    g=m[m.season==Y][['season','week','home_ab','away_ab','actual_total']].copy()
    g=g.merge(b15_f.rename(columns={'pt_b15':'b15_f'}),on=['season','week','home_ab','away_ab'],how='left')
    g=g.merge(b55_f.rename(columns={'pt_b55':'b55_f'}),on=['season','week','home_ab','away_ab'],how='left')
    g=g.merge(b15_s.rename(columns={'pt_b15':'b15_s'}),on=['season','week','home_ab','away_ab'],how='left')
    g=g.merge(b55_s.rename(columns={'pt_b55':'b55_s'}),on=['season','week','home_ab','away_ab'],how='left')
    g=g.merge(od[['season','home_ab','away_ab','open_total','close_total']],on=['season','home_ab','away_ab'],how='left')
    out.append(g)
gp=pd.concat(out,ignore_index=True).dropna(subset=['actual_total','open_total','close_total','b15_f','b55_f','b15_s','b55_s']).copy()
gp['ens_full']=(gp.b15_f+gp.b55_f)/2
gp['ens_strict']=(gp.b15_s+gp.b55_s)/2
gp['edge_full_close']=gp.ens_full-gp.close_total
gp['edge_full_open']=gp.ens_full-gp.open_total
gp['edge_strict_open']=gp.ens_strict-gp.open_total
# agreement on direction (sign agreement between b15 and b55 vs line)
gp['agree_full_close']=(np.sign(gp.b15_f-gp.close_total)==np.sign(gp.b55_f-gp.close_total))&(gp.b15_f!=gp.close_total)&(gp.b55_f!=gp.close_total)
gp['agree_full_open']=(np.sign(gp.b15_f-gp.open_total)==np.sign(gp.b55_f-gp.open_total))&(gp.b15_f!=gp.open_total)&(gp.b55_f!=gp.open_total)
gp['agree_strict_open']=(np.sign(gp.b15_s-gp.open_total)==np.sign(gp.b55_s-gp.open_total))&(gp.b15_s!=gp.open_total)&(gp.b55_s!=gp.open_total)
L(f"\n[data] n games (2024+2025): {len(gp)}")

BUCKETS=[(0,1),(1,2),(2,3),(3,4),(4,5),(5,7),(7,99)]
def bucket(d, edge_col, line_col, label, agree_col=None):
    L(f"\n{'='*92}\n{label}\n{'='*92}")
    sub=d.dropna(subset=[edge_col,line_col,'actual_total']).copy()
    if agree_col is not None: sub=sub[sub[agree_col]]
    sub['abs_edge']=sub[edge_col].abs()
    sub['hit']=np.where(sub[edge_col]>0, sub.actual_total>sub[line_col], sub.actual_total<sub[line_col]).astype(float)
    sub.loc[sub.actual_total==sub[line_col],'hit']=np.nan
    L(f"  {'edge bucket':<13s} {'n':>5s} {'hit%':>7s} {'CI 95%':>13s} {'ROI@-110':>9s} {'avg_edge':>9s}")
    cumul_n=0; cumul_k=0
    for lo,hi in BUCKETS:
        b=sub[(sub.abs_edge>=lo)&(sub.abs_edge<hi)].dropna(subset=['hit'])
        n=len(b); k=int(b.hit.sum()); avg_edge=b.abs_edge.mean() if n else 0
        if n<5:
            L(f"  [{lo:>3.0f}, {hi:>3.0f})    {n:>5d}  too few (need n>=5)")
            cumul_n+=n; cumul_k+=k; continue
        cl,ch=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
        L(f"  [{lo:>3.0f}, {hi:>3.0f})    {n:>5d} {k/n*100:>6.1f}% [{cl*100:>3.0f},{ch*100:>3.0f}]    {roi:>+8.1f}% {avg_edge:>+8.2f}")
        cumul_n+=n; cumul_k+=k
    # all-games row
    if cumul_n>=5:
        cl,ch=wilson_ci(cumul_k,cumul_n); roi=(cumul_k*100/110-(cumul_n-cumul_k))/cumul_n*100
        L(f"  {'ALL':13s}  {cumul_n:>5d} {cumul_k/cumul_n*100:>6.1f}% [{cl*100:>3.0f},{ch*100:>3.0f}]    {roi:>+8.1f}%")
    # monotonicity check
    rates=[]
    for lo,hi in BUCKETS:
        b=sub[(sub.abs_edge>=lo)&(sub.abs_edge<hi)].dropna(subset=['hit'])
        if len(b)>=10: rates.append((f"[{lo:.0f},{hi:.0f})", b.hit.mean()*100))
    if len(rates)>=3:
        rs=[r[1] for r in rates]
        is_monotone_up=all(rs[i]<=rs[i+1]+5 for i in range(len(rs)-1))  # allow 5pp wiggle
        L(f"  monotonicity: hit% by bucket = {[f'{r:.0f}' for r in rs]}")
        L(f"  -> bigger edge {'IS' if is_monotone_up else 'is NOT'} clearly better hit rate (allowing 5pp noise)")

# Honest scenarios (no leak)
bucket(gp,'edge_full_close','close_total','B1) FULL ENSEMBLE vs CLOSE LINE — all games')
bucket(gp,'edge_full_close','close_total','B2) FULL ENSEMBLE vs CLOSE — both models agree','agree_full_close')
bucket(gp,'edge_strict_open','open_total','A1) STRICT-OPEN ENSEMBLE vs OPEN LINE — all games')
bucket(gp,'edge_strict_open','open_total','A2) STRICT-OPEN ENSEMBLE vs OPEN — both models agree','agree_strict_open')
# Leaky reference (the original backtest)
bucket(gp,'edge_full_open','open_total','C) FULL ENSEMBLE vs OPEN (LEAKY backtest reference) — both agree','agree_full_open')
