"""
WEBSITE-RELEVANT sides test: full slate, graded vs the OPENING number + CLV (not the close).
A betting site posts picks early in the week at softer numbers; the right bar is (a) full-slate ATS at
the OPENING line, and (b) closing-line value (does the line move toward our pick after we post it).
Train margin model on 2018-2023 (curated, leak-safe), test full slate 2024-25 (openers exist 2023-25).
Report: ATS vs OPEN (all games + by disagreement), ATS vs CLOSE (for contrast), CLV %, avg CLV pts, per szn.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
from sklearn.ensemble import HistGradientBoostingRegressor
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
L = print
m = pd.read_parquet(os.path.join(DATA, "matchup.parquet"))
od = pd.read_parquet(os.path.join(DATA, "odds_consensus.parquet"))
inj = pd.read_parquet(os.path.join(DATA, "injuries_raw.parquet"))
rec = pd.read_parquet(os.path.join(DATA, "ngs_receiving.parquet"))
pas = pd.read_parquet(os.path.join(DATA, "ngs_passing.parquet"))
sc = pd.read_parquet(os.path.join(DATA, "snap_counts.parquet"))
px = pd.read_parquet(os.path.join(DATA, "players_xwalk.parquet")); g2p=dict(zip(px.gsis_id,px.pfr_id))
def carry(df,kid,col,out):
    df=df.sort_values([kid,"season","week"]).copy(); df["_c"]=df.groupby([kid,"season"])[col].apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
    pl=df[["season",kid]].drop_duplicates(); grid=pl.merge(pd.DataFrame({"week":range(1,23)}),how="cross").merge(df[["season",kid,"week","_c"]],on=["season",kid,"week"],how="left").sort_values(["season",kid,"week"]); grid[out]=grid.groupby(["season",kid])["_c"].ffill(); return grid[["season","week",kid,out]]
air=carry(rec,"player_id","percent_share_of_intended_air_yards","airshare"); qat=carry(pas,"player_id","attempts","qb_att")
sc=sc[sc.game_type=="REG"].copy(); sc["def_pct"]=sc.defense_pct.fillna(0); dsnap=carry(sc,"pfr_player_id","def_pct","def_pct_prior")
miss=inj[inj.report_status.isin(["Out","Doubtful"])].copy(); miss["pfr"]=miss.player_id.map(g2p)
miss=miss.merge(air,on=["season","week","player_id"],how="left").merge(qat,on=["season","week","player_id"],how="left").merge(dsnap.rename(columns={"pfr_player_id":"pfr"}),on=["season","week","pfr"],how="left")
SK={"WR","TE","RB","FB"}; DEFP={"DE","DT","NT","OLB","EDGE","CB","S","SS","FS","DB","LB","ILB","MLB"}
miss["air_w"]=np.where(miss.position.isin(SK),miss.airshare.clip(lower=0).fillna(0),0); miss["qb_w"]=((miss.position=="QB")&(miss.qb_att>=15)).astype(float); miss["def_w"]=np.where(miss.position.isin(DEFP),miss.def_pct_prior.fillna(0),0)
ti=miss.groupby(["season","week","team"]).agg(air_out=("air_w","sum"),qb_out=("qb_w","max"),def_out=("def_w","sum")).reset_index(); nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}; ti["ab"]=ti.team.replace(nv2our)
for s in ["home","away"]:
    p="h_" if s=="home" else "a_"
    m=m.merge(ti.rename(columns={"ab":f"{s}_ab","air_out":f"{p}air_out","qb_out":f"{p}qb_out","def_out":f"{p}def_out"})[["season","week",f"{s}_ab",f"{p}air_out",f"{p}qb_out",f"{p}def_out"]],on=["season","week",f"{s}_ab"],how="left")
for c in ["h_air_out","h_qb_out","h_def_out","a_air_out","a_qb_out","a_def_out"]: m[c]=m[c].fillna(0)
m["pr_diff"]=m.home_predictive_pr-m.away_predictive_pr; m["last5_diff"]=m.home_last5_pr-m.away_last5_pr
m["air_diff"]=m.h_air_out-m.a_air_out; m["def_diff"]=m.h_def_out-m.a_def_out; m["qb_diff"]=m.h_qb_out-m.a_qb_out; m["rest_diff"]=m.home_rest-m.away_rest
m["mkt_margin"]=-m.home_spread; m["actual_margin"]=m.home_score-m.away_score
FEATS=["pr_diff","last5_diff","home_predictive_pr","away_predictive_pr","air_diff","def_diff","qb_diff","rest_diff","home_consistency_pr","away_consistency_pr"]
for f in FEATS: m[f]=pd.to_numeric(m[f],errors="coerce")
W=m[m.week>=4].copy()

# walk-forward margin model: train all seasons < Y, predict Y
W["pred_margin"]=np.nan
for Y in range(2021,2026):
    tr=W[W.season<Y]; te=W[W.season==Y]
    gb=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.06,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[FEATS],tr.actual_margin)
    W.loc[te.index,"pred_margin"]=gb.predict(te[FEATS])

# merge OPENERS (2023-25)
key=["season","home_ab","away_ab"]
d=W.merge(od[key+["open_spread","close_spread"]],on=key,how="inner").dropna(subset=["pred_margin","open_spread"])
d["open_m"]=-d.open_spread; d["close_m"]=-d.close_spread
d["edge_open"]=d.pred_margin-d.open_m            # our model vs the OPENING number
d["line_move"]=d.close_m-d.open_m                # open->close (home margin)
L(f"[build] games w/ opener (2023-25): {len(d)} | model OOS corr w/ margin={np.corrcoef(d.pred_margin,d.actual_margin)[0,1]:.3f} open corr={np.corrcoef(d.open_m,d.actual_margin)[0,1]:.3f} close corr={np.corrcoef(d.close_m,d.actual_margin)[0,1]:.3f}")

def ats(num_col, label, thr):
    sub=d[d.edge_open.abs()>=thr].copy()
    # home covers vs num_col (=home expected margin) iff actual_margin > num_col
    home_cov=sub.actual_margin > sub[num_col]; push=sub.actual_margin == sub[num_col]
    bet_home=sub.edge_open>0; won=np.where(bet_home,home_cov,~home_cov)[~push.values]
    n=len(won); k=int(won.sum()); lo,hi=wilson_ci(k,n)
    L(f"  {label} |edge|>={thr}: n={n} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] roi={(k*100/110-(n-k))/n*100:+.1f}%")

L("\n"+"="*86); L("[1] FULL-SLATE ATS vs the OPENING number (the website bar)"); L("="*86)
for thr in [0,1,2,3]: ats("open_m","vs OPEN",thr)
L("  per-season vs OPEN (|edge|>=1):")
for s in sorted(d.season.unique()):
    ss=d[(d.season==s)&(d.edge_open.abs()>=1)]; hc=ss.actual_margin > ss.open_m; push=ss.actual_margin == ss.open_m
    won=np.where(ss.edge_open>0,hc,~hc)[~push.values]; n=len(won);k=int(won.sum())
    L(f"    {int(s)}: {k}/{n}={k/n*100:.1f}%")
L("\n[2] same picks vs the CLOSING number (contrast):")
for thr in [0,1]: ats("close_m","vs CLOSE",thr)

L("\n"+"="*86); L("[3] CLOSING-LINE VALUE (does the line move toward our pick?)"); L("="*86)
for thr in [0,1,2]:
    sub=d[d.edge_open.abs()>=thr]
    toward=(np.sign(sub.edge_open)==np.sign(sub.line_move))
    clv=np.where(sub.edge_open>0, sub.line_move, -sub.line_move)  # pts the line moved in our favor
    L(f"  |edge|>={thr}: n={len(sub)} line moved TOWARD us {toward.mean()*100:.1f}% of games | avg CLV={clv.mean():+.2f} pts | corr(edge,move)={np.corrcoef(sub.edge_open,sub.line_move)[0,1]:+.3f}")
L("  (>52.4% 'toward' + positive avg CLV = we systematically get a better number than the close)")
