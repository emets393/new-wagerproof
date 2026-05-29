"""
BACKUP-QB target/usage shifts (player-prop angle).
Theory: when a backup starts (injury), QBs check down / play conservative -> RB & TE & short/possession
receivers get more target share, RB more rush attempts; deep WRs get less.
Method (within-team to kill confounds): identify each team-season's PRIMARY QB (most starts) from NGS passing;
a 'backup game' = a week the starter != primary (injury-confirmed subset = primary QB listed Out). Compare the
team's position-group TARGET SHARE + RB carries in backup vs starter games (paired by team-season). Archetype
split by receiver aDOT. Then surface specific players who spike. 2018-2025.
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
# ---- starter QB per team-week (max attempts), season primary (most starts) ----
pas["att"]=num(pas,"attempts"); pas=pas[pas.att>=1]
st=pas.sort_values("att",ascending=False).groupby(["season","week","team"],as_index=False).first()[["season","week","team","player_id","att"]].rename(columns={"player_id":"starter_id"})
prim=st.groupby(["season","team","starter_id"]).size().reset_index(name="starts").sort_values("starts",ascending=False).groupby(["season","team"],as_index=False).first().rename(columns={"starter_id":"primary_id"})
st=st.merge(prim[["season","team","primary_id"]],on=["season","team"],how="left")
st["is_backup_game"]=(st.starter_id!=st.primary_id).astype(int)
# injury-confirmed: was the primary QB listed Out/Doubtful that week?
outqb=inj[inj.report_status.isin(["Out","Doubtful"])][["season","week","player_id"]].drop_duplicates(); outqb["primary_out"]=1
st=st.merge(outqb.rename(columns={"player_id":"primary_id"}),on=["season","week","primary_id"],how="left"); st["primary_out"]=st.primary_out.fillna(0)
nb=st[st.is_backup_game==1]
L(f"[build] team-weeks: {len(st)} | backup-QB starts: {int(st.is_backup_game.sum())} | injury-confirmed (primary Out): {int(nb.primary_out.sum())}")

# ---- attach backup flag to player_offense; team-game target totals ----
o=o.merge(st[["season","week","team","is_backup_game","primary_out"]],on=["season","week","team"],how="left")
o["is_backup_game"]=o.is_backup_game.fillna(0)
o["tgt"]=num(o,"targets"); o["car"]=num(o,"carries"); o["recyd"]=num(o,"receiving_yards")
tt=o.groupby(["season","week","team"]).tgt.sum().rename("team_tgt").reset_index()
o=o.merge(tt,on=["season","week","team"],how="left"); o["tgt_share"]=o.tgt/o.team_tgt.replace(0,np.nan)
o["pg"]=o.position_group.where(o.position_group.isin(["WR","TE","RB"]),o.position)

def paired_delta(metric_df, label):
    # per team-season, mean(metric) in backup vs starter games; delta; paired t across team-seasons
    g=metric_df.groupby(["season","team","is_backup_game"]).val.mean().unstack("is_backup_game")
    g=g.dropna(subset=[0.0,1.0])  # team-seasons with BOTH backup & starter games
    d=(g[1.0]-g[0.0]);
    if len(d)<5: L(f"  {label:34s} n={len(d)} (too few)"); return
    t,p=stats.ttest_1samp(d,0)
    L(f"  {label:34s} starter={g[0.0].mean():.3f} backup={g[1.0].mean():.3f}  delta={d.mean():+.3f}  ({(d>0).mean()*100:.0f}% teams up, n={len(d)}, p={p:.3f})")

L("\n"+"="*94); L("POSITION-GROUP TARGET SHARE: backup-QB games vs the team's own starter games (paired)"); L("="*94)
for pg in ["RB","TE","WR"]:
    sub=o[o.pg==pg].groupby(["season","week","team","is_backup_game"]).tgt_share.sum().reset_index().rename(columns={"tgt_share":"val"})
    paired_delta(sub, f"{pg} target share")
L("  RB rush attempts/game (team RB carries):")
rbc=o[o.pg=="RB"].groupby(["season","week","team","is_backup_game"]).car.sum().reset_index().rename(columns={"car":"val"})
paired_delta(rbc,"RB carries/game")
L("  team total pass attempts proxy (team targets/game):")
ttg=o.groupby(["season","week","team","is_backup_game"]).tgt.sum().reset_index().rename(columns={"tgt":"val"})
paired_delta(ttg,"team targets/game")

# ---- archetype: receiver aDOT (deep vs short) target-share shift ----
L("\n"+"="*94); L("RECEIVER ARCHETYPE (aDOT) target-share shift with backup QB"); L("="*94)
rec["iay"]=num(rec,"avg_intended_air_yards")
adot=rec.groupby(["season","player_id"]).iay.mean().rename("adot").reset_index()
oo=o[o.pg.isin(["WR","TE"])].merge(adot,on=["season","player_id"],how="left").dropna(subset=["adot"])
oo["arch"]=pd.cut(oo.adot,[-1,7,11,99],labels=["short(<7)","mid(7-11)","deep(>11)"])
for a in ["short(<7)","mid(7-11)","deep(>11)"]:
    sub=oo[oo.arch==a].groupby(["season","week","team","is_backup_game"]).tgt_share.sum().reset_index().rename(columns={"tgt_share":"val"})
    paired_delta(sub, f"{a} aDOT target share")

# ---- player-specific spikes (>=3 backup games) ----
L("\n"+"="*94); L("PLAYER SPIKES — targets/game in backup-QB games vs starter games (>=3 backup games)"); L("="*94)
pl=o.groupby(["player_id","name" if "name" in o else "player_name","is_backup_game"]).agg(tg=("tgt","mean"),n=("tgt","size")).reset_index()
nmcol="name" if "name" in o.columns else "player_name"
piv=pl.pivot_table(index=["player_id",nmcol],columns="is_backup_game",values=["tg","n"]).reset_index()
piv.columns=["player_id","name","tg_start","tg_back","n_start","n_back"]
piv=piv.dropna(subset=["tg_start","tg_back"]); piv=piv[(piv.n_back>=3)&(piv.n_start>=5)]
piv["delta"]=piv.tg_back-piv.tg_start
top=piv.sort_values("delta",ascending=False).head(12)
L(f"  {'player':22s} {'startTg':>7s} {'backTg':>6s} {'delta':>6s} {'nBack':>5s}")
for _,r in top.iterrows():
    L(f"  {r['name']:22s} {r.tg_start:7.1f} {r.tg_back:6.1f} {r.delta:+6.1f} {int(r.n_back):5d}")
