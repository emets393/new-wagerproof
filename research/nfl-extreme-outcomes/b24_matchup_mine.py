"""
Mine the attribute matchups for (1) FOOTBALL mechanism and (2) BETTING edge.
PART 1 mechanism: do the mismatches predict per-game passing output (CPOE, pass_yards), and do they add
   anything BEYOND the market-known pass-quality diff? (raw + partial corr; walk-forward GBM ablation)
PART 2 betting: battery of quartile spots -> offense covers / game over, vs CLOSE, with a PERMUTATION NULL
   (shuffle outcomes within season, recount 'passers') to separate real signal from multiple-comparison noise.
   Survivors get per-season + vs-OPEN. Plus the user's two named hypotheses (H1, H2) reported explicitly.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingRegressor
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
T=pd.read_parquet(os.path.join(DATA,"offense_matchup.parquet"))
MIS=["m_wr_db_speed","m_wr_cb_speed","m_wr_cb_wt","m_wr_cb_ht","m_wr_db_agility","m_ol_pr_str","m_wr_acc",
     "H1_fastWR_protect_vs_slowbigD","H2_bigWR_vs_smallCB"]
QUAL="off_pass_quality_diff"
for c in MIS+[QUAL,"cpoe","qb_pass_yards"]: T[c]=pd.to_numeric(T[c],errors="coerce")

L("="*94); L("PART 1 — MECHANISM: do attribute mismatches predict passing OUTPUT? (and beyond team quality?)"); L("="*94)
d=T.dropna(subset=["cpoe",QUAL]+MIS).copy()
L(f"  n={len(d)}. corr with CPOE (raw | partial after removing pass-quality-diff):")
qy=d[QUAL].values;
def partial(x):  # residualize x and cpoe on QUAL, then corr
    bx=np.polyfit(qy,x,1); rx=x-np.polyval(bx,qy)
    by=np.polyfit(qy,d.cpoe,1); ry=d.cpoe-np.polyval(by,qy)
    return np.corrcoef(rx,ry)[0,1]
for f in MIS+[QUAL]:
    raw=np.corrcoef(d[f],d.cpoe)[0,1]; pr=partial(d[f].values) if f!=QUAL else np.nan
    L(f"    {f:34s} raw r={raw:+.3f}   partial r={'   n/a' if f==QUAL else f'{pr:+.3f}'}")
# GBM ablation: predict cpoe walk-forward, quality-only vs quality+mismatches
def oos_corr(feats):
    d2=d.copy(); d2["p"]=np.nan
    for Y in range(2021,2026):
        tr=d2[d2.season<Y]; te=d2[d2.season==Y]
        if len(tr)<300: continue
        gb=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=250,min_samples_leaf=40,random_state=0).fit(tr[feats],tr.cpoe)
        d2.loc[te.index,"p"]=gb.predict(te[feats])
    dd=d2.dropna(subset=["p"]); return np.corrcoef(dd.p,dd.cpoe)[0,1]
L(f"  walk-forward OOS corr predicting CPOE:  quality-only={oos_corr([QUAL]):+.3f}   quality+mismatches={oos_corr([QUAL]+MIS):+.3f}")
L("  (if quality+mismatches ~ quality-only, the attribute matchups add NO on-field passing signal)")

L("\n"+"="*94); L("PART 2 — BETTING: quartile spots vs the CLOSE, with PERMUTATION NULL (FP control)"); L("="*94)
def spots(df):
    out={}
    for f in MIS:
        hi=df[f]>=df[f].quantile(.75); lo=df[f]<=df[f].quantile(.25)
        out[f+"_HI"]=hi; out[f+"_LO"]=lo
    return out
def count_pass(df, target, masks, thr=0.535, nmin=120):
    p=0; res={}
    for name,mask in masks.items():
        y=df.loc[mask,target].dropna(); n=len(y); h=y.mean() if n else 0
        if n>=nmin and h>=thr: p+=1
        res[name]=(h,n)
    return p,res
for target in ["off_cover","over_close"]:
    sub=T.dropna(subset=[target]).copy(); masks=spots(sub)
    real,res=count_pass(sub,target,masks)
    # permutation null: shuffle target within season
    rng=np.random.default_rng(0); nullc=[]
    for _ in range(300):
        s=sub.copy(); s[target]=s.groupby("season")[target].transform(lambda x:rng.permutation(x.values))
        nullc.append(count_pass(s,target,masks)[0])
    nullc=np.array(nullc); thr95=np.quantile(nullc,.95)
    L(f"\n  [{target}] real passers={real}  vs null mean={nullc.mean():.1f} (95th pct={thr95:.0f})  -> {'ENRICHED' if real>thr95 else 'NO signal (within noise)'}")
    top=sorted(res.items(),key=lambda kv:-kv[1][0])[:4]
    for nm,(h,n) in top: lo,hi=wilson_ci(int(h*n),n); L(f"     top: {nm:34s} {h*100:.1f}% (n={n}) CI[{lo*100:.0f},{hi*100:.0f}]")

L("\n"+"="*94); L("THE USER'S NAMED HYPOTHESES (top-quartile), vs CLOSE + per-season"); L("="*94)
for f,desc in [("H1_fastWR_protect_vs_slowbigD","fast WR + protection vs slow/big secondary"),("H2_bigWR_vs_smallCB","big WR vs small CB")]:
    sub=T[T[f]>=T[f].quantile(.75)]
    for tgt,lab in [("off_cover","ATS"),("over_close","OVER"),("off_cover_open","ATS-open")]:
        y=sub[tgt].dropna(); n=len(y);k=int(y.sum()); lo,hi=wilson_ci(k,n) if n else (0,0)
        L(f"  {desc[:38]:38s} {lab:8s}: {(k/n*100 if n else 0):.1f}% (n={n}) CI[{lo*100:.0f},{hi*100:.0f}]")
    # mechanism: do these offenses actually pass better?
    cp=sub.cpoe.mean(); base=T.cpoe.mean(); L(f"     -> CPOE in spot {cp:+.2f} vs league {base:+.2f} (pass output {'UP' if cp>base else 'flat/down'})")
