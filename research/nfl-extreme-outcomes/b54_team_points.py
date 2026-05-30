"""
b54: TEAM POINTS as target. Use everything in matchup.parquet (300+ features) EXCEPT betting lines
(no cheating). Build per-team-game frame (2 rows per game with offense/defense orientation),
walk-forward train HistGradientBoostingRegressor, permutation importance to rank features.
Then derive sides + totals from team-points predictions, compare vs market opener.
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
L(f"[load] matchup: {m.shape} | odds_consensus: {od.shape}")

# ---- Exclusion rules ----
# Betting lines: anything that's market-derived. Exclude 'oline'/'dline' false-positives.
BL_TERMS=['spread','total_line','_line','odds','money','juice','implied','vegas','book','ml_','_ml','open_','close_']
BL_KEEP=['oline','dline']  # OL/DL personnel cols contain 'line' but are not betting
def is_betting(c):
    cl=c.lower()
    if any(k in cl for k in BL_KEEP): return False
    return any(t in cl for t in BL_TERMS)
# Outcomes (would leak): post-game / outcome / residual / actual columns. Aggressive.
OUTCOME_TERMS=['cover','spread_miss','spread_diff','away_favorite','total_points','actual_','_actual',
               'resid_','fav_margin','fav_won','_won','_final','total_score',
               'winning_','losing_','final_','points_scored','points_allowed_actual',
               'upset','outright','total_diff','total_miss','total_won','margin_won','margin_loss',
               'underdog_covered','favorite_covered','_outcome','_result',
               'over_win','under_win','ats_win','ml_win','mkt_','exp_margin','exp_total','exp_pts']
# whitelist: prior/rolling stats are SAFE even if they contain outcome-like terms
SAFE_SUFFIXES=('_s2d','_last3','_last5','_pr','_rate','_pct','_streak','_per_game','_per_play','_per_drive')
def is_outcome(c):
    cl=c.lower()
    if cl.endswith(SAFE_SUFFIXES): return False
    if '_s2d_' in cl or '_last3_' in cl or '_last5_' in cl: return False
    return any(t in cl for t in OUTCOME_TERMS)

betting=[c for c in m.columns if is_betting(c)]
outcomes=[c for c in m.columns if is_outcome(c)]
ID_KEYS={'season','week','home_ab','away_ab','game_id','gameday','game_date','date','home_coach','away_coach','home_score','away_score'}
exclude=set(betting)|set(outcomes)|ID_KEYS
L(f"\n[exclude] {len(betting)} betting cols: {betting}")
L(f"[exclude] {len(outcomes)} outcome cols: {outcomes}")

# LEAK DETECTOR: corr against home, away, AND sum/diff combinations (catches derived outcome cols)
candidate=[c for c in m.columns if c not in exclude]
ht=m.home_score; at=m.away_score; tot=ht+at; mar=ht-at
suspected=[]
for c in candidate:
    s=pd.to_numeric(m[c],errors='coerce')
    if s.notna().sum()<200: continue
    corrs={'h':s.corr(ht),'a':s.corr(at),'tot':s.corr(tot),'mar':s.corr(mar)}
    mx=max([abs(v) if pd.notna(v) else 0 for v in corrs.values()])
    if mx>0.80:
        suspected.append((c,corrs,mx))
L(f"\n[LEAK SCAN] columns with |corr|>0.80 vs home/away/total/margin (auto-excluded):")
for c,co,mx in suspected: L(f"  {c:40s} h={co['h']:+.2f} a={co['a']:+.2f} tot={co['tot']:+.2f} mar={co['mar']:+.2f}")
exclude |= set([s[0] for s in suspected])

# Identify home_/away_ pairs
feats=[c for c in m.columns if c not in exclude]
home_cols=sorted([c for c in feats if c.startswith('home_')])
away_cols=sorted([c for c in feats if c.startswith('away_')])
pairs=[]
for hc in home_cols:
    base=hc[5:]
    if f"away_{base}" in away_cols: pairs.append((hc,f"away_{base}",base))
paired={p for tup in pairs for p in tup[:2]}
unpaired_h=[c for c in home_cols if c not in paired]
unpaired_a=[c for c in away_cols if c not in paired]
neutral=[c for c in feats if c not in paired and not c.startswith('home_') and not c.startswith('away_')]
L(f"\n[features] {len(pairs)} paired, {len(unpaired_h)} unpaired-home, {len(unpaired_a)} unpaired-away, {len(neutral)} neutral")

# ---- Build team-game frame: 2 rows per game with offense/defense orientation ----
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
L(f"\n[build] team-game frame: {len(tg)} rows ({len(tg)//2} games)")

# Coerce numeric, drop sparse + non-numeric
feature_cols=[c for c in tg.columns if c not in ('season','week','off_abv','def_abv','target')]
for c in feature_cols:
    if tg[c].dtype=='object': tg[c]=pd.to_numeric(tg[c],errors='coerce')
feature_cols=[c for c in feature_cols if tg[c].notna().sum()/len(tg)>=0.5]
L(f"[features] {len(feature_cols)} retained (>=50% non-null)")

# ---- Walk-forward train, test 2024+2025 ----
results=[]
for Y in [2024,2025]:
    tr=tg[tg.season<Y].copy(); te=tg[tg.season==Y].copy()
    L(f"\n[fit] test={Y}: train n={len(tr)} test n={len(te)}")
    gbm=HistGradientBoostingRegressor(max_depth=4,learning_rate=0.05,max_iter=500,min_samples_leaf=40,l2_regularization=1.0,random_state=0).fit(tr[feature_cols],tr.target)
    pred=gbm.predict(te[feature_cols])
    mae=np.mean(np.abs(te.target-pred)); rmse=np.sqrt(np.mean((te.target-pred)**2))
    avg=tr.target.mean(); mae_avg=np.mean(np.abs(te.target-avg))
    L(f"  MODEL  MAE {mae:.2f}  RMSE {rmse:.2f}")
    L(f"  naive-mean baseline ({avg:.1f}): MAE {mae_avg:.2f}")
    # market benchmark: implied team total from market spread+total
    mk=m[m.season==Y][['season','week','home_ab','away_ab','nv_spread_line','nv_total_line','home_score','away_score']].copy()
    mk=mk.dropna(subset=['nv_spread_line','nv_total_line'])
    mk['h_imp']=(mk.nv_total_line-mk.nv_spread_line)/2; mk['a_imp']=(mk.nv_total_line+mk.nv_spread_line)/2
    h=mk[['season','week','home_ab','away_ab','home_score','h_imp']].rename(columns={'home_ab':'off_abv','away_ab':'def_abv','home_score':'actual','h_imp':'imp'})
    a=mk[['season','week','home_ab','away_ab','away_score','a_imp']].rename(columns={'away_ab':'off_abv','home_ab':'def_abv','away_score':'actual','a_imp':'imp'})
    imp=pd.concat([h,a],ignore_index=True).dropna()
    L(f"  market implied team total: MAE {np.mean(np.abs(imp.actual-imp.imp)):.2f}  <- the BENCHMARK")
    results.append((Y,te,pred,gbm,tr))

# ---- Permutation importance on latest test fold ----
Y,te,pred,gbm,tr=results[-1]
L(f"\n[importance] permutation importance on {Y} (n_repeats=5)...")
t0=time.time()
imp=permutation_importance(gbm,te[feature_cols],te.target,n_repeats=5,random_state=0,n_jobs=-1)
L(f"  done in {time.time()-t0:.0f}s")
idf=pd.DataFrame({'feature':feature_cols,'imp':imp.importances_mean,'std':imp.importances_std}).sort_values('imp',ascending=False)
L(f"\n=== TOP 30 features by permutation importance (test={Y}) ===")
for _,r in idf.head(30).iterrows(): L(f"  {r.feature:55s} {r.imp:+.4f} ± {r['std']:.4f}")
L(f"\n=== Categorized — OFFENSE features in top 30 ===")
for _,r in idf.head(30).iterrows():
    if r.feature.startswith('off_'): L(f"  {r.feature:55s} {r.imp:+.4f}")
L(f"\n=== Categorized — DEFENSE features in top 30 ===")
for _,r in idf.head(30).iterrows():
    if r.feature.startswith('def_'): L(f"  {r.feature:55s} {r.imp:+.4f}")
L(f"\n=== Categorized — NEUTRAL (game-level) features in top 30 ===")
for _,r in idf.head(30).iterrows():
    if not r.feature.startswith('off_') and not r.feature.startswith('def_'): L(f"  {r.feature:55s} {r.imp:+.4f}")

# save full importance
idf.to_csv(os.path.join(DATA,"b54_feature_importance.csv"),index=False)
L(f"\n[save] full importance ranking -> data/b54_feature_importance.csv ({len(idf)} features)")

# ---- Derive sides + totals from team-points predictions, compare vs market ----
L(f"\n{'='*88}\nDERIVED SIDES + TOTALS — does team-points model beat market opener?\n{'='*88}")
# Build pred-by-team table (one prediction per team per game), then attach to m directly
all_p=[]
for Y,te,pred,_,_ in results:
    L(f"[debug] te {Y}: shape={te.shape}, off_abv notna={te.off_abv.notna().sum()}, season notna={te.season.notna().sum()}, week notna={te.week.notna().sum()}, target notna={te.target.notna().sum()}")
    L(f"[debug]   te.off_abv head: {te.off_abv.head(3).tolist()}")
    t=te[['season','week','off_abv','target']].copy(); t['pred']=pred
    L(f"[debug] t shape={t.shape}, t.off_abv head: {t.off_abv.head(3).tolist()}, t.pred head: {t.pred.head(3).tolist()}")
    all_p.append(t)
preds=pd.concat(all_p,ignore_index=True)
L(f"[debug] preds shape={preds.shape}, off_abv notna={preds.off_abv.notna().sum()}, pred notna={preds.pred.notna().sum()}")
ptab=preds.groupby(['season','week','off_abv']).agg(pred=('pred','first'),actual=('target','first')).reset_index()
L(f"[debug] ptab shape after groupby: {ptab.shape}")
L(f"[debug] ptab head:\n{ptab.head(3)}")
L(f"[debug] ptab dtypes: {ptab.dtypes.to_dict()}")
L(f"[debug] gp head:\n{m[m.season.isin([2024,2025])][['season','week','home_ab','away_ab']].head(3)}")
# Attach home + away predictions to m
gp=m[m.season.isin([2024,2025])][['season','week','home_ab','away_ab','home_score','away_score','nv_spread_line','nv_total_line']].copy()
gp=gp.rename(columns={'nv_spread_line':'close_spread','nv_total_line':'close_total'})
gp=gp.merge(ptab.rename(columns={'off_abv':'home_ab','pred':'h_pred','actual':'h_actual'}),on=['season','week','home_ab'],how='left')
gp=gp.merge(ptab.rename(columns={'off_abv':'away_ab','pred':'a_pred','actual':'a_actual'}),on=['season','week','away_ab'],how='left')
gp['pred_margin']=gp.h_pred-gp.a_pred; gp['pred_total']=gp.h_pred+gp.a_pred
gp['act_margin']=gp.home_score-gp.away_score; gp['act_total']=gp.home_score+gp.away_score
gp=gp.merge(od[['season','home_ab','away_ab','open_spread','open_total']],on=['season','home_ab','away_ab'],how='left')
L(f"\n[debug] gp shape: {gp.shape}  pred_margin notna {gp.pred_margin.notna().sum()}  close_spread notna {gp.close_spread.notna().sum()}  open_spread notna {gp.open_spread.notna().sum()}")
# DIAGNOSTIC: is pred_margin just learning the market, or beating it?
g=gp.dropna(subset=['pred_margin','act_margin','close_spread']).copy()
L(f"\n[diagnostic] n={len(g)}")
L(f"  corr(pred_margin,  act_margin)       = {g.pred_margin.corr(g.act_margin):+.3f}")
L(f"  corr(pred_margin, -close_spread)     = {g.pred_margin.corr(-g.close_spread):+.3f}  <- if very high, model just learned market")
L(f"  corr(act_margin,  -close_spread)     = {g.act_margin.corr(-g.close_spread):+.3f}  <- market's predictive power")
L(f"  MAE pred_margin vs act_margin        = {(g.pred_margin-g.act_margin).abs().mean():.2f}")
L(f"  MAE (-close_spread) vs act_margin    = {(-g.close_spread-g.act_margin).abs().mean():.2f}  <- if pred MAE << market MAE -> LEAK")
L(f"  pred_margin range [{g.pred_margin.min():.1f}, {g.pred_margin.max():.1f}]  -close_spread range [{(-g.close_spread).min():.1f}, {(-g.close_spread).max():.1f}]")

def quintile_ats(d, edge_col, win_col, label, breakeven=52.4):
    d=d.dropna(subset=[win_col,edge_col]).copy()
    if len(d)<25: L(f"  {label}: too few games ({len(d)})"); return
    d['q']=pd.qcut(d[edge_col].rank(method='first'),5,labels=[1,2,3,4,5])
    L(f"\n  {label}: n={len(d)}")
    for q in [1,2,3,4,5]:
        s=d[d.q==q]; c=s[win_col].mean(); n=len(s); k=int(s[win_col].sum()); lo,hi=wilson_ci(k,n)
        L(f"    Q{q}: n={n:4d}  hit={c*100:5.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]")
    bh=d[d.q==5]; ba=d[d.q==1]
    w=pd.concat([bh[win_col],1-ba[win_col]]).dropna(); k=int(w.sum()); n=len(w); lo,hi=wilson_ci(k,n)
    L(f"    BET Q5+flip-Q1: n={n} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]  ({breakeven}% breakeven)")

# NOTE: nv_spread_line is POSITIVE when home is favored (opposite of open_spread).
# Verified empirically via diagnostic: corr(act_margin, close_spread) is +0.5 (positive => home wins more when "spread" is high).
# Sides — vs CLOSE (close_spread = positive when home favored)
gp['hco_close']=(gp.act_margin-gp.close_spread>0).astype(float); gp.loc[gp.act_margin-gp.close_spread==0,'hco_close']=np.nan
gp['s_edge_close']=gp.pred_margin-gp.close_spread
quintile_ats(gp,'s_edge_close','hco_close','SIDES vs CLOSE (home_cover quintile of pred_margin - close_spread)')
# Sides — vs OPEN if available (open_spread = standard convention: positive when home dog, negative when home fav)
gp['hco_open']=(gp.act_margin+gp.open_spread>0).astype(float); gp.loc[gp.act_margin+gp.open_spread==0,'hco_open']=np.nan
gp['s_edge_open']=gp.pred_margin+gp.open_spread
quintile_ats(gp,'s_edge_open','hco_open','SIDES vs OPEN  (subset with opener data)')
# Totals — vs CLOSE
gp['ov_close']=(gp.act_total>gp.close_total).astype(float); gp.loc[gp.act_total==gp.close_total,'ov_close']=np.nan
gp['t_edge_close']=gp.pred_total-gp.close_total
quintile_ats(gp,'t_edge_close','ov_close','TOTALS vs CLOSE (over_close quintile of pred_total - close_total)')
gp['ov_open']=(gp.act_total>gp.open_total).astype(float); gp.loc[gp.act_total==gp.open_total,'ov_open']=np.nan
gp['t_edge_open']=gp.pred_total-gp.open_total
quintile_ats(gp,'t_edge_open','ov_open','TOTALS vs OPEN  (subset with opener data)')
