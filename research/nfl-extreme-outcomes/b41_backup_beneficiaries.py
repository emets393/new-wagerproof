"""
Backup-QB BENEFICIARIES (the flip side of the deep-WR fade): when a backup checks down, who GAINS?
Test RB (receptions/rec-yds/carries/rush-yds), short-aDOT WRs, TEs — within-team paired (backup vs starter
games, by player-season), all-backup + injury-confirmed. Then name the players who rise (good backup samples).
"""
import os, sys, warnings
import numpy as np, pandas as pd
from scipy import stats
warnings.filterwarnings("ignore")
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
o=pd.read_parquet(os.path.join(DATA,"player_offense.parquet"))
pas=pd.read_parquet(os.path.join(DATA,"ngs_passing.parquet")); inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet"))
rec=pd.read_parquet(os.path.join(DATA,"ngs_receiving.parquet"))
num=lambda d,c: pd.to_numeric(d.get(c),errors="coerce").fillna(0)
pas["att"]=num(pas,"attempts"); pas=pas[pas.att>=1]
st=pas.sort_values("att",ascending=False).groupby(["season","week","team"],as_index=False).first()[["season","week","team","player_id"]].rename(columns={"player_id":"starter_id"})
prim=st.groupby(["season","team","starter_id"]).size().reset_index(name="s").sort_values("s",ascending=False).groupby(["season","team"],as_index=False).first().rename(columns={"starter_id":"primary_id"})
st=st.merge(prim[["season","team","primary_id"]],on=["season","team"],how="left"); st["backup"]=(st.starter_id!=st.primary_id).astype(int)
outqb=inj[inj.report_status.isin(["Out","Doubtful"])][["season","week","player_id"]].drop_duplicates(); outqb["pout"]=1
st=st.merge(outqb.rename(columns={"player_id":"primary_id"}),on=["season","week","primary_id"],how="left"); st["backup_inj"]=((st.backup==1)&(st.pout.fillna(0)==1)).astype(int)
adot=rec.assign(iay=num(rec,"avg_intended_air_yards")).groupby(["season","player_id"]).iay.mean().rename("adot").reset_index()
for c in ["receptions","receiving_yards","targets","carries","rushing_yards"]: o[c]=num(o,c)
o=o.merge(st[["season","week","team","backup","backup_inj"]],on=["season","week","team"],how="left").merge(adot,on=["season","player_id"],how="left")
o[["backup","backup_inj"]]=o[["backup","backup_inj"]].fillna(0)

def flat(p): p.columns=[f"{v}_{int(b)}" for v,b in p.columns]; return p.reset_index()
def quant(sub, stat, flag, label):
    g=sub.groupby(["player_id","player_name","season",flag]).agg(v=(stat,"mean"),n=(stat,"size")).reset_index()
    piv=flat(g.pivot_table(index=["player_id","player_name","season"],columns=flag,values=["v","n"])).dropna(subset=["v_0","v_1"])
    if len(piv)<8: L(f"  {label:34s} n={len(piv)} (few)"); return
    p=stats.ttest_1samp(piv.v_1-piv.v_0,0).pvalue
    L(f"  {label:34s} n={len(piv):3d} | {piv.v_0.mean():.2f} -> {piv.v_1.mean():.2f}  (delta {(piv.v_1-piv.v_0).mean():+.2f}, p={p:.3f})")

RB=o[o.position_group=="RB"]; TE=o[o.position_group=="TE"]; sWR=o[(o.position_group=="WR")&(o.adot<8)]
L("="*92); L("BENEFICIARIES — does the stat RISE with a backup QB? (paired by player-season, starter->backup)"); L("="*92)
L(" RUNNING BACKS:")
for s,lab in [("receptions","RB receptions/g"),("receiving_yards","RB rec-yds/g"),("carries","RB carries/g"),("rushing_yards","RB rush-yds/g")]:
    quant(RB,s,"backup",lab)
L(" short-aDOT WRs (<8, possession/slot):")
for s,lab in [("targets","short-WR targets/g"),("receptions","short-WR rec/g"),("receiving_yards","short-WR rec-yds/g")]:
    quant(sWR,s,"backup",lab)
L(" TIGHT ENDS:")
for s,lab in [("receptions","TE receptions/g"),("receiving_yards","TE rec-yds/g"),("targets","TE targets/g")]:
    quant(TE,s,"backup",lab)
L(" injury-confirmed (primary Out) — RB receptions & rec-yds, TE rec-yds:")
quant(RB,"receptions","backup_inj","RB receptions/g (inj)"); quant(RB,"receiving_yards","backup_inj","RB rec-yds/g (inj)")
quant(TE,"receiving_yards","backup_inj","TE rec-yds/g (inj)")

def names(sub, stat, label, nmin_b=4):
    pl=sub.groupby(["player_id","player_name","backup"]).agg(v=(stat,"mean"),n=(stat,"size")).reset_index()
    piv=flat(pl.pivot_table(index=["player_id","player_name"],columns="backup",values=["v","n"])).dropna(subset=["v_0","v_1"])
    piv=piv[(piv.n_1>=nmin_b)&(piv.n_0>=8)]; piv["rise"]=piv.v_1-piv.v_0
    L(f"\n {label} — biggest RISERS (career, >={nmin_b} backup games):")
    L(f"  {'player':22s} {'start':>6s} {'backup':>6s} {'rise':>6s} {'nBack':>5s}")
    for _,r in piv.sort_values("rise",ascending=False).head(10).iterrows():
        L(f"  {r['player_name']:22s} {r.v_0:6.1f} {r.v_1:6.1f} {r.rise:+6.1f} {int(r.n_1):5d}")
    L(f"  group avg (n={len(piv)}): {piv.v_0.mean():.2f}->{piv.v_1.mean():.2f} ({(piv.v_1-piv.v_0).mean():+.2f})")
names(RB,"receptions","RB receptions"); names(RB,"receiving_yards","RB receiving yards")