"""Pressure-test the QB-downgrade signal: is it real, or a small-n home-team artifact?
Pool both sides (does the DOWNGRADED team fail to cover the opener?), per-season, threshold dose,
and the baseline home-cover rate for context."""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
# reuse the feature build from b17 by importing its dataframe
import b17_madden_features as B
m=B.m; OD=B.OD; key=B.key
d=m[m.season.isin([2024,2025])].merge(OD,on=key,how="inner").dropna(subset=["open_spread"]).copy()
d["hco"]=(d.actual_margin+d.open_spread>0).astype(float); d=d[d.actual_margin+d.open_spread!=0]
L(f"\n[baseline] 2024-25 home covers the OPENER: {d.hco.mean()*100:.1f}% (n={len(d)})  <- context for any 'bet home' spot")

L("\n[QB downgrade] DOWNGRADED team's cover rate vs opener (pooled both sides), by threshold:")
for thr in [5,8,12]:
    rows=[]
    # home downgraded: downgraded team is home -> its cover = hco
    hd=d[d.h_qb_dn>=thr]; ad=d[d.a_qb_dn>=thr]
    dwn=pd.concat([hd.hco, 1-ad.hco]).dropna()              # downgraded team covers?
    k=int((dwn==1).sum()); n=len(dwn); lo,hi=wilson_ci(k,n) if n else (0,0)
    L(f"  dn>={thr:2d}: downgraded-team cover={ (k/n*100 if n else 0):.1f}% (n={n}) CI[{lo*100:.0f},{hi*100:.0f}]  | home-dn n={len(hd)} away-dn n={len(ad)}")
L("  (if FADE works, downgraded-team cover should be WELL BELOW 50%)")

L("\n[QB downgrade>=8] per-season & per-side (the asymmetry check):")
for yr in [2024,2025]:
    dy=d[d.season==yr]
    hd=dy[dy.h_qb_dn>=8]; ad=dy[dy.a_qb_dn>=8]
    for lab,sub,cov in [("home-dn (cover=home)",hd,hd.hco),("away-dn (cover=away)",ad,1-ad.hco)]:
        cov=cov.dropna(); k=int((cov==1).sum()); n=len(cov)
        L(f"  {yr} {lab:22s}: downgraded cover={ (k/n*100 if n else 0):.1f}% (n={n})")

L("\n[OL-out>=15] downgraded(injured-OL) team cover vs opener, pooled + per-season:")
for yr in [2024,2025,'both']:
    dd=d if yr=='both' else d[d.season==yr]
    hd=dd[dd.h_ol_out>=15]; ad=dd[dd.a_ol_out>=15]
    cov=pd.concat([hd.hco,1-ad.hco]).dropna(); k=int((cov==1).sum()); n=len(cov); lo,hi=wilson_ci(k,n) if n else (0,0)
    L(f"  {str(yr):5s}: OL-injured-team cover={ (k/n*100 if n else 0):.1f}% (n={n}) CI[{lo*100:.0f},{hi*100:.0f}]")
