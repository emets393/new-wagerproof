"""
Ablation: what drives the 53.5%-vs-opener? Test feature subsets in the SAME walk-forward margin model,
graded vs the OPENING number at |edge|>=2, with CLV. Subsets: PR-core, +injury, +rest, full, injury-only.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingRegressor
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"); L=print
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet")); od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet")); rec=pd.read_parquet(os.path.join(DATA,"ngs_receiving.parquet"))
pas=pd.read_parquet(os.path.join(DATA,"ngs_passing.parquet")); sc=pd.read_parquet(os.path.join(DATA,"snap_counts.parquet"))
px=pd.read_parquet(os.path.join(DATA,"players_xwalk.parquet")); g2p=dict(zip(px.gsis_id,px.pfr_id))
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
    p="h_" if s=="home" else "a_"; m=m.merge(ti.rename(columns={"ab":f"{s}_ab","air_out":f"{p}air_out","qb_out":f"{p}qb_out","def_out":f"{p}def_out"})[["season","week",f"{s}_ab",f"{p}air_out",f"{p}qb_out",f"{p}def_out"]],on=["season","week",f"{s}_ab"],how="left")
for c in ["h_air_out","h_qb_out","h_def_out","a_air_out","a_qb_out","a_def_out"]: m[c]=m[c].fillna(0)
m["pr_diff"]=m.home_predictive_pr-m.away_predictive_pr; m["last5_diff"]=m.home_last5_pr-m.away_last5_pr
m["air_diff"]=m.h_air_out-m.a_air_out; m["def_diff"]=m.h_def_out-m.a_def_out; m["qb_diff"]=m.h_qb_out-m.a_qb_out; m["rest_diff"]=m.home_rest-m.away_rest
m["actual_margin"]=m.home_score-m.away_score
PRC=["pr_diff","home_predictive_pr","away_predictive_pr","last5_diff","home_consistency_pr","away_consistency_pr"]
INJ=["air_diff","def_diff","qb_diff"]; RST=["rest_diff"]
for f in PRC+INJ+RST: m[f]=pd.to_numeric(m[f],errors="coerce")
W=m[m.week>=4].copy()

def run(feats, label):
    W["pred"]=np.nan
    for Y in range(2021,2026):
        tr=W[W.season<Y]; te=W[W.season==Y]
        gb=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.06,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[feats],tr.actual_margin)
        W.loc[te.index,"pred"]=gb.predict(te[feats])
    d=W.merge(od[["season","home_ab","away_ab","open_spread","close_spread"]],on=["season","home_ab","away_ab"],how="inner").dropna(subset=["pred","open_spread"])
    d["open_m"]=-d.open_spread; d["edge"]=d.pred-d.open_m; d["lm"]=(-d.close_spread)-d.open_m
    sub=d[d.edge.abs()>=2]; hc=sub.actual_margin > sub.open_m; push=sub.actual_margin == sub.open_m
    won=np.where(sub.edge>0,hc,~hc)[~push.values]; n=len(won); k=int(won.sum()); lo,hi=wilson_ci(k,n)
    clv=np.where(sub.edge>0,sub.lm,-sub.lm).mean()
    # per season
    ps=[]
    for s in sorted(sub.season.unique()):
        ss=sub[sub.season==s]; h2=ss.actual_margin > ss.open_m; p2=ss.actual_margin == ss.open_m
        w2=np.where(ss.edge>0,h2,~h2)[~p2.values]; ps.append(f"{int(s)}:{w2.mean()*100:.0f}%(n{len(w2)})")
    L(f"  {label:26s} |edge|>=2: n={n} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] roi={(k*100/110-(n-k))/n*100:+.1f}% CLV={clv:+.2f}pts  {' '.join(ps)}")

L("="*92); L("ABLATION: what drives the vs-opener ATS edge? (|edge|>=2, full slate 2023-25)"); L("="*92)
run(PRC, "PR-core only")
run(INJ, "INJURY-diffs only")
run(RST, "REST only")
run(PRC+INJ, "PR + injury")
run(PRC+INJ+RST, "FULL (all 10)")
run(PRC+RST, "PR + rest (no injury)")
