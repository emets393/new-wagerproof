"""
b56: ENSEMBLE locked b15 (direct totals, ~20 env+weather+flag features) with b55 (PRUNED+SCH team-points
sum, 108 features). Different feature sets + architectures => uncorrelated errors expected.
Three strategies tested on 2024+2025 vs OPENER:
  (A) prediction AVERAGE then edge-bet
  (B) AGREEMENT FILTER (bet only when both agree on direction)
  (C) SUM-OF-EDGES quintile
Both edge>=thr threshold tests and quintile tests, with ROI at -110.
"""
import os, sys, warnings, time
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingRegressor
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
sp=pd.read_parquet(os.path.join(DATA,"scheme_plays.parquet"))
inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet"))
rec=pd.read_parquet(os.path.join(DATA,"ngs_receiving.parquet"))
imp_b54=pd.read_csv(os.path.join(DATA,"b54_feature_importance.csv"))
m["actual_total"]=m.home_score+m.away_score
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}

# =============================================================================
# (1) Train b15 — LOCKED direct totals model (replicates b15_totals.py)
# =============================================================================
def carry(df,kid,col,out):
    df=df.sort_values([kid,"season","week"]).copy()
    df["_c"]=df.groupby([kid,"season"])[col].apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
    pl=df[["season",kid]].drop_duplicates()
    grid=pl.merge(pd.DataFrame({"week":range(1,23)}),how="cross").merge(df[["season",kid,"week","_c"]],on=["season",kid,"week"],how="left").sort_values(["season",kid,"week"])
    grid[out]=grid.groupby(["season",kid])["_c"].ffill(); return grid[["season","week",kid,out]]
air=carry(rec,"player_id","percent_share_of_intended_air_yards","airshare")
miss=inj[inj.report_status.isin(["Out","Doubtful"])].merge(air,on=["season","week","player_id"],how="left")
miss=miss[miss.position.isin({"WR","TE","RB","FB"})]
keyout=miss.groupby(["season","week","team"]).airshare.max().reset_index().rename(columns={"airshare":"max_air_out"})
keyout["ab"]=keyout.team.replace(nv2our)
mm=m.copy()
for side,p in [("home","h_"),("away","a_")]:
    mm=mm.merge(keyout.rename(columns={"ab":f"{side}_ab","max_air_out":f"{p}max_air_out"})[["season","week",f"{side}_ab",f"{p}max_air_out"]],on=["season","week",f"{side}_ab"],how="left")
mm["h_max_air_out"]=mm.h_max_air_out.fillna(0); mm["a_max_air_out"]=mm.a_max_air_out.fillna(0)
mm["key_recv_out"]=((mm.h_max_air_out>=35)|(mm.a_max_air_out>=35)).astype(int)
mm["wind_mph"]=pd.to_numeric(mm.wind_mph,errors="coerce").fillna(pd.to_numeric(mm.wind_speed,errors="coerce"))
mm["temp_f"]=pd.to_numeric(mm.temp_f,errors="coerce").fillna(pd.to_numeric(mm.temperature,errors="coerce"))
mm["dome"]=(mm.dome_closed.fillna(0).astype(float)>0).astype(int) if "dome_closed" in mm else 0
mm["wind_under"]=(mm.wind_mph>=15).astype(int); mm["cold"]=(mm.temp_f<=32).astype(int); mm["primetime_i"]=mm.primetime.fillna(0).astype(int)
def s(c): return pd.to_numeric(mm[c],errors="coerce") if c in mm.columns else np.nan
mm["off_ppd_sum"]=s("home_off_ppd_s2d")+s("away_off_ppd_s2d")
mm["def_ppd_sum"]=s("home_def_ppd_allowed_s2d")+s("away_def_ppd_allowed_s2d")
mm["pace_sum"]=s("home_off_pace_s2d")+s("away_off_pace_s2d")
mm["pass_epa_sum"]=s("home_off_pass_epa_neutral_s2d")+s("away_off_pass_epa_neutral_s2d")
mm["rush_epa_sum"]=s("home_off_rush_epa_neutral_s2d")+s("away_off_rush_epa_neutral_s2d")
mm["def_pass_allowed_sum"]=s("home_def_pass_epa_allowed_neutral_s2d")+s("away_def_pass_epa_allowed_neutral_s2d")
mm["def_rush_allowed_sum"]=s("home_def_rush_epa_allowed_neutral_s2d")+s("away_def_rush_epa_allowed_neutral_s2d")
mm["expl_pass_sum"]=s("home_off_explosive_pass_rate_s2d")+s("away_off_explosive_pass_rate_s2d")
mm["td_per_drive_sum"]=s("home_off_td_per_drive_s2d")+s("away_off_td_per_drive_s2d")
mm["last_pts_sum"]=s("home_last_points")+s("away_last_points")+s("home_last_allowed_points")+s("away_last_allowed_points")
mm["no_huddle_sum"]=s("home_off_no_huddle_rate_s2d")+s("away_off_no_huddle_rate_s2d")
B15=["off_ppd_sum","def_ppd_sum","pace_sum","pass_epa_sum","rush_epa_sum","def_pass_allowed_sum",
     "def_rush_allowed_sum","expl_pass_sum","td_per_drive_sum","last_pts_sum","no_huddle_sum",
     "wind_mph","temp_f","dome","key_recv_out","wind_under","cold","primetime_i","h_max_air_out","a_max_air_out"]
B15=[c for c in B15 if c in mm.columns and pd.to_numeric(mm[c],errors="coerce").notna().mean()>0.5]
for c in B15: mm[c]=pd.to_numeric(mm[c],errors="coerce")
W=mm[mm.week>=4].copy()
W["pt_b15"]=np.nan
for Y in [2024,2025]:
    trn=W[W.season<Y].dropna(subset=["actual_total"]+B15); te=W[W.season==Y]
    gb=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=350,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(trn[B15],trn.actual_total)
    W.loc[te.index,"pt_b15"]=gb.predict(te[B15])
b15_preds=W[W.season.isin([2024,2025])][['season','week','home_ab','away_ab','pt_b15']].dropna(subset=['pt_b15'])
L(f"[b15] LOCKED model trained. n predictions (week>=4): {len(b15_preds)}")

# =============================================================================
# (2) Train b55 — PRUNED+SCH team-points -> derived totals
# =============================================================================
BL_TERMS=['spread','total_line','_line','odds','money','juice','implied','vegas','book','ml_','_ml','open_','close_']
BL_KEEP=['oline','dline']
OUTCOME_TERMS=['cover','spread_miss','spread_diff','away_favorite','total_points','actual_','_actual',
               'resid_','fav_margin','fav_won','_won','_final','total_score','winning_','losing_','final_',
               'points_scored','points_allowed_actual','upset','outright','total_diff','total_miss',
               'total_won','margin_won','margin_loss','underdog_covered','favorite_covered','_outcome',
               '_result','over_win','under_win','ats_win','ml_win','mkt_','exp_margin','exp_total','exp_pts']
SAFE_SUFFIXES=('_s2d','_last3','_last5','_pr','_rate','_pct','_streak','_per_game','_per_play','_per_drive')
def is_betting(c):
    cl=c.lower()
    if any(k in cl for k in BL_KEEP): return False
    return any(t in cl for t in BL_TERMS)
def is_outcome(c):
    cl=c.lower()
    if cl.endswith(SAFE_SUFFIXES): return False
    if '_s2d_' in cl or '_last3_' in cl or '_last5_' in cl: return False
    return any(t in cl for t in OUTCOME_TERMS)
betting=[c for c in m.columns if is_betting(c)]
outcomes=[c for c in m.columns if is_outcome(c)]
ID_KEYS={'season','week','home_ab','away_ab','game_id','gameday','game_date','date','home_coach','away_coach','home_score','away_score'}
exclude=set(betting)|set(outcomes)|ID_KEYS
feats=[c for c in m.columns if c not in exclude]
home_cols=sorted([c for c in feats if c.startswith('home_')])
away_cols=sorted([c for c in feats if c.startswith('away_')])
pairs=[]
for hc in home_cols:
    base=hc[5:]
    if f"away_{base}" in away_cols: pairs.append((hc,f"away_{base}",base))
paired={p for tup in pairs for p in tup[:2]}
neutral=[c for c in feats if c not in paired and not c.startswith('home_') and not c.startswith('away_')]
def build(side, df):
    if side=='home':
        off_cols=[p[0] for p in pairs]; def_cols=[p[1] for p in pairs]
        target=df.home_score; is_home=1; off_t=df.home_ab; def_t=df.away_ab
    else:
        off_cols=[p[1] for p in pairs]; def_cols=[p[0] for p in pairs]
        target=df.away_score; is_home=0; off_t=df.away_ab; def_t=df.home_ab
    out=pd.DataFrame({'season':df.season,'week':df.week,'off_abv':off_t,'def_abv':def_t,'target':target,'is_home':is_home})
    for c,p in zip(off_cols,[p[2] for p in pairs]): out[f'off_{p}']=df[c].values
    for c,p in zip(def_cols,[p[2] for p in pairs]): out[f'def_{p}']=df[c].values
    for c in neutral: out[c]=df[c].values
    return out
tg=pd.concat([build('home',m),build('away',m)],ignore_index=True).dropna(subset=['target']).copy()
sp["posteam"]=sp.posteam.replace(nv2our); sp["defteam"]=sp.defteam.replace(nv2our)
lab=sp[(sp["pass"]==1)&sp.defense_man_zone_type.isin(["MAN_COVERAGE","ZONE_COVERAGE"])].copy()
lab["mz"]=np.where(lab.defense_man_zone_type=="MAN_COVERAGE","M","Z")
lab["pr"]=pd.to_numeric(lab.was_pressure,errors="coerce").fillna(0).astype(int)
lab["epa"]=pd.to_numeric(lab.epa,errors="coerce")
def scheme_priors(Y):
    sub=lab[lab.season.isin([Y-2,Y-1])]
    qM=sub[sub.mz=="M"].groupby("passer_player_id").agg(n=("epa","size"),v=("epa","mean")).reset_index()
    qM=qM[qM.n>=60].rename(columns={"v":"qb_epa_vs_man"})[["passer_player_id","qb_epa_vs_man"]]
    qZ=sub[sub.mz=="Z"].groupby("passer_player_id").agg(n=("epa","size"),v=("epa","mean")).reset_index()
    qZ=qZ[qZ.n>=60].rename(columns={"v":"qb_epa_vs_zone"})[["passer_player_id","qb_epa_vs_zone"]]
    w=sub[(sub.mz=="Z")&(sub.pr==0)&sub.receiver_player_id.notna()].groupby("receiver_player_id").agg(n=("epa","size"),v=("epa","mean")).reset_index()
    w=w[w.n>=40].rename(columns={"v":"wr_epa_zNP"})[["receiver_player_id","wr_epa_zNP"]]
    d=sub.groupby("defteam").agg(man_rate=("mz",lambda x:(x=="M").mean()),pressure_rate=("pr","mean")).reset_index()
    d["zone_rate"]=1-d.man_rate
    return qM,qZ,w,d
all_off=[]; all_def=[]
for Y in sorted(tg.season.unique()):
    if Y<2020: continue
    qM,qZ,wr,dpri=scheme_priors(Y)
    p=sp[(sp["pass"]==1)&(sp.season==Y)].copy()
    qc=p.groupby(["season","week","posteam","passer_player_id"]).size().reset_index(name="n")
    qprim=qc.sort_values("n",ascending=False).drop_duplicates(["season","week","posteam"])
    qprim=qprim.merge(qM,on="passer_player_id",how="left").merge(qZ,on="passer_player_id",how="left")
    off_q=qprim[["season","week","posteam","qb_epa_vs_man","qb_epa_vs_zone"]].rename(columns={"posteam":"off_abv"})
    wt=p.dropna(subset=["receiver_player_id"]).groupby(["season","week","posteam","receiver_player_id"]).size().reset_index(name="tgts")
    wt=wt.merge(wr,on="receiver_player_id",how="inner")
    ww=wt.groupby(["season","week","posteam"]).apply(lambda g:(g.wr_epa_zNP*g.tgts).sum()/g.tgts.sum() if g.tgts.sum()>0 else np.nan).reset_index(name="wr_zNP_w")
    ww=ww.rename(columns={"posteam":"off_abv"})
    off_feats=off_q.merge(ww,on=["season","week","off_abv"],how="outer"); all_off.append(off_feats)
    dd=dpri.rename(columns={"defteam":"def_abv","man_rate":"def_man_rate","pressure_rate":"def_pressure_rate","zone_rate":"def_zone_rate"})
    dd["season"]=Y; all_def.append(dd)
off_sch=pd.concat(all_off,ignore_index=True); def_sch=pd.concat(all_def,ignore_index=True)
tg=tg.merge(off_sch,on=["season","week","off_abv"],how="left")
tg=tg.merge(def_sch[["season","def_abv","def_man_rate","def_pressure_rate","def_zone_rate"]],on=["season","def_abv"],how="left")
tg["int_qbman_x_def"]=(-tg.qb_epa_vs_man)*tg.def_man_rate*tg.def_pressure_rate
tg["int_wrzNP_x_def"]=tg.wr_zNP_w*tg.def_zone_rate*(1-tg.def_pressure_rate)
NEW=["qb_epa_vs_man","qb_epa_vs_zone","wr_zNP_w","def_man_rate","def_pressure_rate","def_zone_rate","int_qbman_x_def","int_wrzNP_x_def"]
TOP_N=100
top_b54=imp_b54.sort_values('imp',ascending=False).head(TOP_N).feature.tolist()
top_b54=[f for f in top_b54 if f in tg.columns]
for c in top_b54+NEW:
    if c in tg.columns and tg[c].dtype=='object': tg[c]=pd.to_numeric(tg[c],errors='coerce')
top_b54=[f for f in top_b54 if tg[f].notna().sum()/len(tg)>=0.5]
final_feats=top_b54+NEW
all_p=[]
for Y in [2024,2025]:
    tr=tg[tg.season<Y].dropna(subset=['target']).copy()
    te=tg[tg.season==Y].dropna(subset=['target']).copy()
    gbm=HistGradientBoostingRegressor(max_depth=4,learning_rate=0.05,max_iter=500,min_samples_leaf=40,l2_regularization=1.0,random_state=0).fit(tr[final_feats],tr.target)
    pred=gbm.predict(te[final_feats])
    t=te[['season','week','off_abv','target']].copy(); t['pred']=pred; all_p.append(t)
preds=pd.concat(all_p,ignore_index=True)
ptab=preds.groupby(['season','week','off_abv']).agg(pred=('pred','first')).reset_index()
L(f"[b55] PRUNED+SCH trained. n team-game predictions: {len(ptab)}")

# =============================================================================
# (3) ENSEMBLE — assemble per-game frame with both models' totals
# =============================================================================
gp=m[m.season.isin([2024,2025])][['season','week','home_ab','away_ab','home_score','away_score']].copy()
gp['actual_total']=gp.home_score+gp.away_score
gp=gp.merge(ptab.rename(columns={'off_abv':'home_ab','pred':'h_pred'}),on=['season','week','home_ab'],how='left')
gp=gp.merge(ptab.rename(columns={'off_abv':'away_ab','pred':'a_pred'}),on=['season','week','away_ab'],how='left')
gp['pt_b55']=gp.h_pred+gp.a_pred
gp=gp.merge(b15_preds,on=['season','week','home_ab','away_ab'],how='left')
gp=gp.merge(od[['season','home_ab','away_ab','open_total','close_total']],on=['season','home_ab','away_ab'],how='left')
gp=gp.dropna(subset=['actual_total','open_total','pt_b15','pt_b55']).copy()
L(f"\n[ensemble] games with both models + opener (week>=4): {len(gp)}")
gp['edge_b15']=gp.pt_b15-gp.open_total
gp['edge_b55']=gp.pt_b55-gp.open_total
gp['over_open']=(gp.actual_total>gp.open_total).astype(float)
gp.loc[gp.actual_total==gp.open_total,'over_open']=np.nan

L(f"\n[edge stats]")
L(f"  b15 edge mean={gp.edge_b15.mean():+.2f}  std={gp.edge_b15.std():.2f}")
L(f"  b55 edge mean={gp.edge_b55.mean():+.2f}  std={gp.edge_b55.std():.2f}")
L(f"  corr(edge_b15, edge_b55) = {gp.edge_b15.corr(gp.edge_b55):+.3f}  (lower = more independent = better for ensemble)")

def report(d, edge_col, label, thresholds=(1.0,2.0,3.0)):
    d=d.dropna(subset=['over_open',edge_col]).copy()
    L(f"\n  {label}:")
    for thr in thresholds:
        bo=d[d[edge_col]>=thr]; bu=d[d[edge_col]<=-thr]
        won=pd.concat([bo.over_open,1-bu.over_open]).dropna(); k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0)
        roi=(k*100/110-(n-k))/n*100 if n else 0
        L(f"    edge>={thr}: n={n:4d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+5.1f}%")

L(f"\n{'='*88}\nINDIVIDUAL MODELS — vs opener\n{'='*88}")
report(gp,'edge_b15','b15 LOCKED direct totals')
report(gp,'edge_b55','b55 PRUNED+SCH team-points -> totals')

L(f"\n{'='*88}\n(A) AVERAGE PREDICTIONS — bet edge of (avg pred) - opener\n{'='*88}")
gp['edge_avg']=((gp.pt_b15+gp.pt_b55)/2)-gp.open_total
report(gp,'edge_avg','avg(b15, b55) - open_total')

L(f"\n{'='*88}\n(B) AGREEMENT FILTER — bet only when both agree on direction\n{'='*88}")
gp['agree']=(np.sign(gp.edge_b15)==np.sign(gp.edge_b55))
ga=gp[gp.agree].copy()
L(f"  Games where both models agree on direction: {len(ga)} / {len(gp)} ({len(ga)/len(gp)*100:.0f}%)")
ga['edge_min']=np.where(ga.edge_b15>0,np.minimum(ga.edge_b15,ga.edge_b55),np.maximum(ga.edge_b15,ga.edge_b55))
report(ga,'edge_min','agreement filter, |edge| = min of two (more conservative)')
ga['edge_avg']=(ga.edge_b15+ga.edge_b55)/2
report(ga,'edge_avg','agreement filter, |edge| = avg of two')

L(f"\n{'='*88}\n(C) SUM OF EDGES quintile\n{'='*88}")
gp['edge_sum']=gp.edge_b15+gp.edge_b55
sub=gp.dropna(subset=['over_open','edge_sum']).copy()
sub['q']=pd.qcut(sub.edge_sum.rank(method='first'),5,labels=[1,2,3,4,5])
L(f"\n  Quintile of edge_sum (n={len(sub)}):")
for q in [1,2,3,4,5]:
    s=sub[sub.q==q]; c=s.over_open.mean(); n=len(s); k=int(s.over_open.sum()); lo,hi=wilson_ci(k,n)
    L(f"    Q{q}: n={n:4d} hit={c*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
bh=sub[sub.q==5]; ba=sub[sub.q==1]; w=pd.concat([bh.over_open,1-ba.over_open]).dropna(); k=int(w.sum()); n=len(w); lo,hi=wilson_ci(k,n)
roi=(k*100/110-(n-k))/n*100 if n else 0
L(f"    BET Q5+flip-Q1: n={n} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

# Per-season breakdown of best ensemble strategy
L(f"\n{'='*88}\nPER-SEASON BREAKDOWN — best ensemble (agreement filter, edge_avg>=2)\n{'='*88}")
for Y in [2024,2025]:
    sub=ga[ga.season==Y].dropna(subset=['over_open','edge_avg']).copy()
    bo=sub[sub.edge_avg>=2]; bu=sub[sub.edge_avg<=-2]
    won=pd.concat([bo.over_open,1-bu.over_open]).dropna(); k=int(won.sum()); n=len(won)
    if n>0: lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
    else: lo,hi=0,0; roi=0
    L(f"  {Y}: n={n} hit={(k/n*100 if n else 0):.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")
