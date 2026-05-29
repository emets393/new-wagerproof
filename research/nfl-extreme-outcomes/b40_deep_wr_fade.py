"""
Quantify the DEEP-WR fade with a backup QB, in PROP terms (targets/game + receiving-yards/game), and name
the players. Vertical receiver = season aDOT (NGS avg_intended_air_yards) >= threshold. Within player-season
paired: backup-QB games vs the player's own starter-QB games. All-backup + injury-confirmed (primary Out).
NB: pivot columns flattened explicitly as f"{value}_{backup}" (0=starter,1=backup) to avoid value-order bugs.
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
# backup-QB flag per team-week
pas["att"]=num(pas,"attempts"); pas=pas[pas.att>=1]
st=pas.sort_values("att",ascending=False).groupby(["season","week","team"],as_index=False).first()[["season","week","team","player_id"]].rename(columns={"player_id":"starter_id"})
prim=st.groupby(["season","team","starter_id"]).size().reset_index(name="s").sort_values("s",ascending=False).groupby(["season","team"],as_index=False).first().rename(columns={"starter_id":"primary_id"})
st=st.merge(prim[["season","team","primary_id"]],on=["season","team"],how="left")
st["backup"]=(st.starter_id!=st.primary_id).astype(int)
outqb=inj[inj.report_status.isin(["Out","Doubtful"])][["season","week","player_id"]].drop_duplicates(); outqb["pout"]=1
st=st.merge(outqb.rename(columns={"player_id":"primary_id"}),on=["season","week","primary_id"],how="left")
st["backup_inj"]=((st.backup==1)&(st.pout.fillna(0)==1)).astype(int)
adot=rec.assign(iay=num(rec,"avg_intended_air_yards")).groupby(["season","player_id"]).iay.mean().rename("adot").reset_index()
o["tgt"]=num(o,"targets"); o["recyd"]=num(o,"receiving_yards")
w=o[o.position_group.isin(["WR","TE"])].merge(st[["season","week","team","backup","backup_inj"]],on=["season","week","team"],how="left").merge(adot,on=["season","player_id"],how="left")
w[["backup","backup_inj"]]=w[["backup","backup_inj"]].fillna(0); w=w.dropna(subset=["adot"])

def flat(piv):  # flatten pivot MultiIndex cols to f"{value}_{backup}" robustly
    piv.columns=[f"{v}_{int(b)}" for v,b in piv.columns]; return piv.reset_index()

def quantify(thr, flag, label):
    d=w[w.adot>=thr]
    g=d.groupby(["player_id","player_name","season",flag]).agg(tg=("tgt","mean"),yd=("recyd","mean"),n=("tgt","size")).reset_index()
    piv=flat(g.pivot_table(index=["player_id","player_name","season"],columns=flag,values=["tg","yd","n"]))
    piv=piv.dropna(subset=["tg_0","tg_1"])
    if len(piv)<8: L(f"  {label:30s} n={len(piv)} (too few)"); return
    dt=stats.ttest_1samp(piv.tg_1-piv.tg_0,0); dy=stats.ttest_1samp(piv.yd_1-piv.yd_0,0)
    L(f"  {label:30s} n={len(piv):3d} | TARGETS {piv.tg_0.mean():.1f}->{piv.tg_1.mean():.1f} ({(piv.tg_1-piv.tg_0).mean():+.1f}, p={dt.pvalue:.3f}) | YDS {piv.yd_0.mean():.1f}->{piv.yd_1.mean():.1f} ({(piv.yd_1-piv.yd_0).mean():+.1f}, p={dy.pvalue:.3f})")

L("="*98); L("DEEP-WR fade in PROP terms — targets/game & rec-yds/game: starter(0) vs backup(1), paired by player-season"); L("="*98)
for thr in [10,11,12,13]: quantify(thr,"backup",f"aDOT>={thr} | ALL backups")
L("  injury-confirmed (primary QB Out):")
for thr in [11,12]: quantify(thr,"backup_inj",f"aDOT>={thr} | INJURY backups")

L("\n"+"="*98); L("PLAYERS TO FADE — vertical WRs (career aDOT>=11) with >=3 backup games: rec-yds/game drop"); L("="*98)
cad=w.groupby("player_id").adot.mean().rename("cadot").reset_index()
deep=w.merge(cad,on="player_id"); deep=deep[deep.cadot>=11]
pl=deep.groupby(["player_id","player_name","backup"]).agg(tg=("tgt","mean"),yd=("recyd","mean"),n=("tgt","size")).reset_index()
piv=flat(pl.pivot_table(index=["player_id","player_name"],columns="backup",values=["tg","yd","n"]))
piv=piv.dropna(subset=["yd_0","yd_1"]); piv=piv[(piv.n_1>=3)&(piv.n_0>=8)]
piv["yd_drop"]=piv.yd_0-piv.yd_1; piv["tg_drop"]=piv.tg_0-piv.tg_1
L(f"  {'player':22s} {'startYd':>7s} {'backYd':>6s} {'ydDrop':>6s} {'startTg':>7s} {'backTg':>6s} {'nStart':>6s} {'nBack':>5s}")
for _,r in piv.sort_values("yd_drop",ascending=False).head(14).iterrows():
    L(f"  {r['player_name']:22s} {r.yd_0:7.1f} {r.yd_1:6.1f} {r.yd_drop:+6.1f} {r.tg_0:7.1f} {r.tg_1:6.1f} {int(r.n_0):6d} {int(r.n_1):5d}")
L(f"\n  group avg (n={len(piv)} deep WRs): YDS {piv.yd_0.mean():.1f}->{piv.yd_1.mean():.1f} ({(piv.yd_0-piv.yd_1).mean():+.1f} drop), TGT {piv.tg_0.mean():.1f}->{piv.tg_1.mean():.1f} ({(piv.tg_0-piv.tg_1).mean():+.1f} drop)")