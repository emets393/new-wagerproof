"""
b55: Take b54's team-points pipeline; PRUNE to top-N features by importance, then ADD b50's player-level
scheme priors (walk-forward Y-2..Y-1): QB EPA vs MAN/ZONE, target-weighted WR EPA on zone-no-pressure,
def man/zone/pressure rates, plus 2 interaction features. Run ablation: pruned-only vs pruned+scheme to
isolate the scheme contribution. Same leak filters + sign conventions as fixed-b54.
"""
import os, sys, warnings, time
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
sp=pd.read_parquet(os.path.join(DATA,"scheme_plays.parquet"))
imp_b54=pd.read_csv(os.path.join(DATA,"b54_feature_importance.csv"))
L(f"[load] matchup {m.shape}  scheme_plays {sp.shape}  b54_imp {imp_b54.shape}")

# Same exclusion rules as b54 (post-fix)
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
L(f"[build] team-game frame: {len(tg)} rows  ({len(tg)//2} games)")

# ============ ADD b50 PLAYER-SCHEME PRIORS (walk-forward Y-2..Y-1) ============
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}
sp["posteam"]=sp.posteam.replace(nv2our); sp["defteam"]=sp.defteam.replace(nv2our)
lab=sp[(sp["pass"]==1)&sp.defense_man_zone_type.isin(["MAN_COVERAGE","ZONE_COVERAGE"])].copy()
lab["mz"]=np.where(lab.defense_man_zone_type=="MAN_COVERAGE","M","Z")
lab["pr"]=pd.to_numeric(lab.was_pressure,errors="coerce").fillna(0).astype(int)
lab["epa"]=pd.to_numeric(lab.epa,errors="coerce")

def scheme_priors(Y):
    s=lab[lab.season.isin([Y-2,Y-1])]
    qM=s[s.mz=="M"].groupby("passer_player_id").agg(n=("epa","size"),v=("epa","mean")).reset_index()
    qM=qM[qM.n>=60].rename(columns={"v":"qb_epa_vs_man"})[["passer_player_id","qb_epa_vs_man"]]
    qZ=s[s.mz=="Z"].groupby("passer_player_id").agg(n=("epa","size"),v=("epa","mean")).reset_index()
    qZ=qZ[qZ.n>=60].rename(columns={"v":"qb_epa_vs_zone"})[["passer_player_id","qb_epa_vs_zone"]]
    w=s[(s.mz=="Z")&(s.pr==0)&s.receiver_player_id.notna()].groupby("receiver_player_id").agg(n=("epa","size"),v=("epa","mean")).reset_index()
    w=w[w.n>=40].rename(columns={"v":"wr_epa_zNP"})[["receiver_player_id","wr_epa_zNP"]]
    d=s.groupby("defteam").agg(man_rate=("mz",lambda x:(x=="M").mean()),pressure_rate=("pr","mean")).reset_index()
    d["zone_rate"]=1-d.man_rate
    return qM,qZ,w,d

# Build per-team-game offense scheme features for each available year (>=2020)
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
    off_feats=off_q.merge(ww,on=["season","week","off_abv"],how="outer")
    all_off.append(off_feats)
    dd=dpri.rename(columns={"defteam":"def_abv","man_rate":"def_man_rate","pressure_rate":"def_pressure_rate","zone_rate":"def_zone_rate"})
    dd["season"]=Y; all_def.append(dd)

off_sch=pd.concat(all_off,ignore_index=True)
def_sch=pd.concat(all_def,ignore_index=True)
tg=tg.merge(off_sch,on=["season","week","off_abv"],how="left")
tg=tg.merge(def_sch[["season","def_abv","def_man_rate","def_pressure_rate","def_zone_rate"]],on=["season","def_abv"],how="left")
# 2 interaction features (compound matchup spots)
tg["int_qbman_x_def"]=(-tg.qb_epa_vs_man)*tg.def_man_rate*tg.def_pressure_rate
tg["int_wrzNP_x_def"]=tg.wr_zNP_w*tg.def_zone_rate*(1-tg.def_pressure_rate)
NEW=["qb_epa_vs_man","qb_epa_vs_zone","wr_zNP_w","def_man_rate","def_pressure_rate","def_zone_rate","int_qbman_x_def","int_wrzNP_x_def"]
L(f"\n[scheme] new features added: {NEW}")
L(f"[scheme] coverage on test seasons (2024+2025): " + ", ".join([f"{nf}={tg[tg.season.isin([2024,2025])][nf].notna().mean()*100:.0f}%" for nf in NEW]))

# ============ FEATURE SELECTION ============
TOP_N=100
top_b54=imp_b54.sort_values('imp',ascending=False).head(TOP_N).feature.tolist()
top_b54=[f for f in top_b54 if f in tg.columns]
# numeric coerce
for c in top_b54+NEW:
    if c in tg.columns and tg[c].dtype=='object': tg[c]=pd.to_numeric(tg[c],errors='coerce')
top_b54=[f for f in top_b54 if tg[f].notna().sum()/len(tg)>=0.5]
L(f"\n[features] top-{TOP_N} from b54 (after coverage filter): {len(top_b54)} | + {len(NEW)} new = {len(top_b54)+len(NEW)}")

# ============ MODEL FITS: 3 variants ============
def fit_eval(feats, label, do_imp=False):
    out={}
    for Y in [2024,2025]:
        tr=tg[tg.season<Y].dropna(subset=['target']).copy()
        te=tg[tg.season==Y].dropna(subset=['target']).copy()
        gbm=HistGradientBoostingRegressor(max_depth=4,learning_rate=0.05,max_iter=500,min_samples_leaf=40,l2_regularization=1.0,random_state=0).fit(tr[feats],tr.target)
        pred=gbm.predict(te[feats])
        mae=np.mean(np.abs(te.target-pred))
        L(f"  [{label}] {Y}: MAE {mae:.3f}")
        out[Y]=(te,pred,gbm,tr)
    if do_imp:
        Y,te,pred,gbm,tr=2025,*out[2025]
        L(f"  [{label}] permutation importance on 2025 ...")
        t0=time.time(); imp=permutation_importance(gbm,te[feats],te.target,n_repeats=5,random_state=0,n_jobs=-1); L(f"    done in {time.time()-t0:.0f}s")
        idf=pd.DataFrame({'feature':feats,'imp':imp.importances_mean,'std':imp.importances_std}).sort_values('imp',ascending=False)
        return out, idf
    return out, None

L(f"\n{'='*80}\nVARIANT 1: BASELINE (top {TOP_N} from b54 only — PRUNING only)\n{'='*80}")
res_prune, _ = fit_eval(top_b54, "PRUNED")

L(f"\n{'='*80}\nVARIANT 2: PRUNED + SCHEME priors (NEW features added)\n{'='*80}")
res_plus, idf_plus = fit_eval(top_b54+NEW, "PRUNED+SCH", do_imp=True)

L(f"\n=== Where do the 8 NEW scheme features rank? ===")
for nf in NEW:
    row=idf_plus[idf_plus.feature==nf]
    if len(row):
        rank=idf_plus.feature.tolist().index(nf)+1
        L(f"  {nf:25s}  imp={row.iloc[0].imp:+.4f}  (rank #{rank}/{len(top_b54)+len(NEW)})")

L(f"\n=== Top 20 features in PRUNED+SCH model ===")
for _,r in idf_plus.head(20).iterrows():
    star=" <-- NEW" if r.feature in NEW else ""
    L(f"  {r.feature:55s} {r.imp:+.4f}{star}")

# ============ DERIVED SIDES + TOTALS for the PRUNED+SCH model ============
L(f"\n{'='*80}\nDERIVED SIDES + TOTALS — PRUNED+SCH model vs market\n{'='*80}")
all_p=[]
for Y in [2024,2025]:
    te,pred,_,_=res_plus[Y]; t=te[['season','week','off_abv','target']].copy(); t['pred']=pred; all_p.append(t)
preds=pd.concat(all_p,ignore_index=True)
ptab=preds.groupby(['season','week','off_abv']).agg(pred=('pred','first'),actual=('target','first')).reset_index()
gp=m[m.season.isin([2024,2025])][['season','week','home_ab','away_ab','home_score','away_score','nv_spread_line','nv_total_line']].copy()
gp=gp.rename(columns={'nv_spread_line':'close_spread','nv_total_line':'close_total'})
gp=gp.merge(ptab.rename(columns={'off_abv':'home_ab','pred':'h_pred','actual':'h_actual'}),on=['season','week','home_ab'],how='left')
gp=gp.merge(ptab.rename(columns={'off_abv':'away_ab','pred':'a_pred','actual':'a_actual'}),on=['season','week','away_ab'],how='left')
gp['pred_margin']=gp.h_pred-gp.a_pred; gp['pred_total']=gp.h_pred+gp.a_pred
gp['act_margin']=gp.home_score-gp.away_score; gp['act_total']=gp.home_score+gp.away_score
gp=gp.merge(od[['season','home_ab','away_ab','open_spread','open_total']],on=['season','home_ab','away_ab'],how='left')

def qats(d, edge_col, win_col, label, breakeven=52.4):
    d=d.dropna(subset=[win_col,edge_col]).copy()
    if len(d)<25: L(f"  {label}: too few ({len(d)})"); return
    d['q']=pd.qcut(d[edge_col].rank(method='first'),5,labels=[1,2,3,4,5])
    L(f"\n  {label}: n={len(d)}")
    for q in [1,2,3,4,5]:
        s=d[d.q==q]; c=s[win_col].mean(); n=len(s); k=int(s[win_col].sum()); lo,hi=wilson_ci(k,n)
        L(f"    Q{q}: n={n:4d}  hit={c*100:5.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")
    bh=d[d.q==5]; ba=d[d.q==1]
    w=pd.concat([bh[win_col],1-ba[win_col]]).dropna(); k=int(w.sum()); n=len(w); lo,hi=wilson_ci(k,n)
    L(f"    BET Q5+flip-Q1: n={n} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]  ({breakeven}% breakeven)")

gp['hco_close']=(gp.act_margin-gp.close_spread>0).astype(float); gp.loc[gp.act_margin-gp.close_spread==0,'hco_close']=np.nan
gp['s_edge_close']=gp.pred_margin-gp.close_spread
qats(gp,'s_edge_close','hco_close','SIDES vs CLOSE')
gp['hco_open']=(gp.act_margin+gp.open_spread>0).astype(float); gp.loc[gp.act_margin+gp.open_spread==0,'hco_open']=np.nan
gp['s_edge_open']=gp.pred_margin+gp.open_spread
qats(gp,'s_edge_open','hco_open','SIDES vs OPEN')
gp['ov_close']=(gp.act_total>gp.close_total).astype(float); gp.loc[gp.act_total==gp.close_total,'ov_close']=np.nan
gp['t_edge_close']=gp.pred_total-gp.close_total
qats(gp,'t_edge_close','ov_close','TOTALS vs CLOSE')
gp['ov_open']=(gp.act_total>gp.open_total).astype(float); gp.loc[gp.act_total==gp.open_total,'ov_open']=np.nan
gp['t_edge_open']=gp.pred_total-gp.open_total
qats(gp,'t_edge_open','ov_open','TOTALS vs OPEN')

# ============ COMPARISON TABLE ============
L(f"\n{'='*80}\nFINAL COMPARISON: b54 (all 333) vs PRUNED-only (top {TOP_N}) vs PRUNED+SCH (top {TOP_N} + 8 new)\n{'='*80}")
mae_b54={2024:7.56, 2025:7.64}
for Y in [2024,2025]:
    p_prune=res_prune[Y][1]; p_plus=res_plus[Y][1]; te=res_prune[Y][0]
    L(f"  {Y}: b54={mae_b54[Y]:.2f}  PRUNED({len(top_b54)})={np.mean(np.abs(te.target-p_prune)):.3f}  PRUNED+SCH({len(top_b54)+len(NEW)})={np.mean(np.abs(te.target-p_plus)):.3f}")

# ============ ABLATION: derived TOTALS for PRUNED-only (isolate scheme contribution) ============
L(f"\n{'='*80}\nABLATION: derived TOTALS for PRUNED-only (no scheme priors) to isolate the scheme effect\n{'='*80}")
all_p=[]
for Y in [2024,2025]:
    te,pred,_,_=res_prune[Y]; t=te[['season','week','off_abv','target']].copy(); t['pred']=pred; all_p.append(t)
preds_pr=pd.concat(all_p,ignore_index=True)
ptab_pr=preds_pr.groupby(['season','week','off_abv']).agg(pred=('pred','first'),actual=('target','first')).reset_index()
gp_pr=m[m.season.isin([2024,2025])][['season','week','home_ab','away_ab','home_score','away_score','nv_spread_line','nv_total_line']].copy().rename(columns={'nv_spread_line':'close_spread','nv_total_line':'close_total'})
gp_pr=gp_pr.merge(ptab_pr.rename(columns={'off_abv':'home_ab','pred':'h_pred'}),on=['season','week','home_ab'],how='left')
gp_pr=gp_pr.merge(ptab_pr.rename(columns={'off_abv':'away_ab','pred':'a_pred'}),on=['season','week','away_ab'],how='left')
gp_pr['pred_total']=gp_pr.h_pred+gp_pr.a_pred; gp_pr['act_total']=gp_pr.home_score+gp_pr.away_score
gp_pr=gp_pr.merge(od[['season','home_ab','away_ab','open_total']],on=['season','home_ab','away_ab'],how='left')
gp_pr['ov_close']=(gp_pr.act_total>gp_pr.close_total).astype(float); gp_pr.loc[gp_pr.act_total==gp_pr.close_total,'ov_close']=np.nan
gp_pr['ov_open']=(gp_pr.act_total>gp_pr.open_total).astype(float); gp_pr.loc[gp_pr.act_total==gp_pr.open_total,'ov_open']=np.nan
gp_pr['t_edge_close']=gp_pr.pred_total-gp_pr.close_total
gp_pr['t_edge_open']=gp_pr.pred_total-gp_pr.open_total
qats(gp_pr,'t_edge_close','ov_close','TOTALS vs CLOSE (PRUNED-only, no scheme)')
qats(gp_pr,'t_edge_open','ov_open','TOTALS vs OPEN (PRUNED-only, no scheme)')

# ============ PER-SEASON BREAKDOWN of PRUNED+SCH totals (is it consistent?) ============
L(f"\n{'='*80}\nPER-SEASON BREAKDOWN — TOTALS PRUNED+SCH (check consistency)\n{'='*80}")
for Y in [2024,2025]:
    sub_c=gp[(gp.season==Y)].dropna(subset=['ov_close','t_edge_close']).copy()
    if len(sub_c)<30: continue
    sub_c['q']=pd.qcut(sub_c.t_edge_close.rank(method='first'),5,labels=[1,2,3,4,5])
    bh=sub_c[sub_c.q==5]; ba=sub_c[sub_c.q==1]
    w=pd.concat([bh.ov_close,1-ba.ov_close]).dropna(); k=int(w.sum()); n=len(w); lo,hi=wilson_ci(k,n)
    L(f"  {Y} TOTALS vs CLOSE: n={n}, hit={k/n*100:.1f}%, CI[{lo*100:.0f},{hi*100:.0f}]")
    sub_o=gp[(gp.season==Y)].dropna(subset=['ov_open','t_edge_open']).copy()
    sub_o['q']=pd.qcut(sub_o.t_edge_open.rank(method='first'),5,labels=[1,2,3,4,5])
    bh=sub_o[sub_o.q==5]; ba=sub_o[sub_o.q==1]
    w=pd.concat([bh.ov_open,1-ba.ov_open]).dropna(); k=int(w.sum()); n=len(w); lo,hi=wilson_ci(k,n)
    L(f"  {Y} TOTALS vs OPEN:  n={n}, hit={k/n*100:.1f}%, CI[{lo*100:.0f},{hi*100:.0f}]")

# ============ EDGE DISTRIBUTION — sanity check (Q5 / Q1 not degenerate) ============
L(f"\n{'='*80}\nEDGE DISTRIBUTION — t_edge_open for PRUNED+SCH\n{'='*80}")
L(f"  t_edge_open: mean={gp.t_edge_open.mean():.2f}, std={gp.t_edge_open.std():.2f}, range=[{gp.t_edge_open.min():.2f}, {gp.t_edge_open.max():.2f}]")
q_edge=gp.t_edge_open.quantile([0.2,0.4,0.6,0.8]).tolist()
L(f"  Q boundaries (20/40/60/80%): {[f'{x:+.2f}' for x in q_edge]}")
# Show Q5 spots
L(f"\n  TOP 10 OVER plays (highest t_edge_open):")
sub=gp.dropna(subset=['ov_open','t_edge_open']).copy()
for _,r in sub.nlargest(10,'t_edge_open').iterrows():
    L(f"    {int(r.season)} W{int(r.week):2d} {r.away_ab}@{r.home_ab:3s}  pred_tot={r.pred_total:5.1f}  open_tot={r.open_total:5.1f}  edge={r.t_edge_open:+5.2f}  act_tot={int(r.act_total)}  over={int(r.ov_open)}")
L(f"\n  TOP 10 UNDER plays (lowest t_edge_open):")
for _,r in sub.nsmallest(10,'t_edge_open').iterrows():
    L(f"    {int(r.season)} W{int(r.week):2d} {r.away_ab}@{r.home_ab:3s}  pred_tot={r.pred_total:5.1f}  open_tot={r.open_total:5.1f}  edge={r.t_edge_open:+5.2f}  act_tot={int(r.act_total)}  over={int(r.ov_open)}")
