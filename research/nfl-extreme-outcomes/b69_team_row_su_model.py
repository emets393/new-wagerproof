"""
b69: TEAM-ROW SU-WIN MODEL — predict each team's straight-up win probability, then compare to
Vegas ML implied probability. Bet the side with biggest positive divergence (the value side).

Same approach as MLB ML modeling:
  1. Team-game frame (one row per team per game)
  2. Predict team_won (binary)
  3. Combine both teams' predictions, normalize to no-vig
  4. Compare to Vegas ML implied prob
  5. Bet on direction + magnitude of divergence
  6. Compare ROI vs current sides_model (ATS) and to baseline

Tests if predicting SU outcome + comparing to ML gives an edge that ATS doesn't.
"""
import os, sys, warnings, time
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m["actual_margin"]=m.home_score-m.away_score
m["home_won_su"]=(m.actual_margin>0).astype(int)
m.loc[m.actual_margin==0,"home_won_su"]=np.nan   # ties (rare in NFL)

# Same leak filter as b54
BL=['spread','total_line','_line','odds','money','juice','implied','vegas','book','ml_','_ml','open_','close_']
BL_KEEP=['oline','dline']
OUTCOME=['cover','spread_miss','spread_diff','away_favorite','total_points','actual_','_actual','resid_',
         'fav_margin','fav_won','_won','_final','total_score','winning_','losing_','final_',
         'points_scored','points_allowed_actual','upset','outright','total_diff','total_miss',
         'total_won','margin_won','margin_loss','underdog_covered','favorite_covered','_outcome',
         '_result','over_win','under_win','ats_win','ml_win','mkt_','exp_margin','exp_total','exp_pts']
SAFE_SFX=('_s2d','_last3','_last5','_pr','_rate','_pct','_streak','_per_game','_per_play','_per_drive')
def is_bet(c):
    cl=c.lower()
    if any(k in cl for k in BL_KEEP): return False
    return any(t in cl for t in BL)
def is_outc(c):
    cl=c.lower()
    if cl.endswith(SAFE_SFX): return False
    if '_s2d_' in cl or '_last3_' in cl or '_last5_' in cl: return False
    return any(t in cl for t in OUTCOME)
betting=[c for c in m.columns if is_bet(c)]
outc=[c for c in m.columns if is_outc(c)]
ID={'season','week','home_ab','away_ab','game_id','gameday','game_date','date','home_coach','away_coach',
    'home_score','away_score','home_cover','actual_margin','actual_total','home_won_su'}
exclude=set(betting)|set(outc)|ID

# Build paired team-game frame
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
        team_cols=[p[0] for p in pairs]; opp_cols=[p[1] for p in pairs]
        won=df.home_won_su; is_home=1; team=df.home_ab; opp=df.away_ab
    else:
        team_cols=[p[1] for p in pairs]; opp_cols=[p[0] for p in pairs]
        won=1-df.home_won_su; is_home=0; team=df.away_ab; opp=df.home_ab
    out=pd.DataFrame({'season':df.season,'week':df.week,'team':team,'opp':opp,'won':won,'is_home':is_home})
    for c,p in zip(team_cols,[p[2] for p in pairs]): out[f'team_{p}']=df[c].values
    for c,p in zip(opp_cols,[p[2] for p in pairs]): out[f'opp_{p}']=df[c].values
    for c in neutral: out[c]=df[c].values
    return out

tg=pd.concat([build('home',m),build('away',m)],ignore_index=True).dropna(subset=['won']).copy()
L(f"[team-row] {len(tg)} rows from {len(tg)//2} games")

features=[c for c in tg.columns if c not in ('season','week','team','opp','won')]
for c in features:
    if tg[c].dtype=='object': tg[c]=pd.to_numeric(tg[c],errors='coerce')
features=[c for c in features if tg[c].notna().sum()/len(tg)>=0.5]
L(f"[features] {len(features)} after coverage filter")

# Leak scan
y=tg.won.astype(float); suspect=[]
for c in features:
    cc=tg[c].corr(y)
    if pd.notna(cc) and abs(cc)>0.5: suspect.append(c)
features=[f for f in features if f not in set(suspect)]
L(f"[features] {len(features)} after leak scan (excluded {len(suspect)} with |corr|>0.5)")

# Walk-forward train, predict 2024+2025
all_p=[]
for Y in [2024,2025]:
    tr=tg[tg.season<Y].dropna(subset=['won']+features).copy()
    te=tg[tg.season==Y].dropna(subset=features).copy()
    clf=HistGradientBoostingClassifier(max_depth=4,learning_rate=0.05,max_iter=400,l2_regularization=2.0,min_samples_leaf=50,random_state=0).fit(tr[features],tr.won)
    pred=clf.predict_proba(te[features])[:,1]
    t=te[['season','week','team','opp','won','is_home']].copy(); t['p_win']=pred
    all_p.append(t)
preds=pd.concat(all_p,ignore_index=True)
L(f"\n[predictions] {len(preds)} team-game rows")

# Combine both teams' preds per game
home_p=preds[preds.is_home==1][['season','week','team','opp','p_win']].rename(columns={'team':'home_ab','opp':'away_ab','p_win':'p_home_raw'})
away_p=preds[preds.is_home==0][['season','week','team','opp','p_win']].rename(columns={'team':'away_ab','opp':'home_ab','p_win':'p_away_raw'})
gp=home_p.merge(away_p,on=['season','week','home_ab','away_ab'],how='inner')
# Normalize: home + away should sum to 1 (forces consistency)
gp['p_home_nv']=gp.p_home_raw/(gp.p_home_raw+gp.p_away_raw)
gp['p_away_nv']=1-gp.p_home_nv

# Merge actual outcomes + Vegas ML (open)
gp=gp.merge(m[['season','week','home_ab','away_ab','home_won_su','actual_margin','home_spread']],on=['season','week','home_ab','away_ab'],how='inner')
gp=gp.merge(od[['season','home_ab','away_ab','open_ml_home','open_ml_away','close_ml_home','close_ml_away','open_spread','close_spread']],on=['season','home_ab','away_ab'],how='inner')
def ml_p(ml):
    if pd.isna(ml) or ml==0: return np.nan
    return -ml/(-ml+100) if ml<0 else 100/(ml+100)
gp['vegas_h_imp']=gp.open_ml_home.apply(ml_p)
gp['vegas_a_imp']=gp.open_ml_away.apply(ml_p)
gp['vegas_h_nv']=gp.vegas_h_imp/(gp.vegas_h_imp+gp.vegas_a_imp)
gp['divergence']=gp.p_home_nv-gp.vegas_h_nv   # +ve = model says home more likely than vegas

L(f"\n[joined] {len(gp)} games with model preds + vegas ML")
L(f"Divergence stats: mean={gp.divergence.mean():+.4f}, std={gp.divergence.std():.4f}")
L(f"  Model SU prediction accuracy (raw): {(((gp.p_home_nv>=0.5)==(gp.home_won_su==1)).mean()*100):.1f}% (n={len(gp)})")
L(f"  Vegas ML SU prediction accuracy:    {(((gp.vegas_h_nv>=0.5)==(gp.home_won_su==1)).mean()*100):.1f}% (n={len(gp)})")

# Test: bet ML on direction of divergence
def ml_payoff(ml):
    if pd.isna(ml) or ml==0: return np.nan
    return ml/100 if ml>0 else 100/abs(ml)

L(f"\n{'='*92}")
L(f"BET ML on direction of divergence (vs OPEN ML, framework-compliant)")
L(f"{'='*92}")
for thr in [0.01,0.02,0.03,0.05,0.07,0.10]:
    bh=gp[gp.divergence>=thr].copy()   # bet HOME ML
    ba=gp[gp.divergence<=-thr].copy()  # bet AWAY ML
    if len(bh)+len(ba)<5: continue
    # Compute payoff for each bet
    bh['payoff']=bh.apply(lambda r: ml_payoff(r.open_ml_home) if r.home_won_su==1 else -1, axis=1)
    ba['payoff']=ba.apply(lambda r: ml_payoff(r.open_ml_away) if r.home_won_su==0 else -1, axis=1)
    all_bets=pd.concat([bh,ba])
    n=len(all_bets); wins=(all_bets.payoff>0).sum()
    if n>=5:
        lo,hi=wilson_ci(wins,n); roi=all_bets.payoff.mean()*100
        L(f"  |div|>={thr*100:.0f}pp: n={n:4d} SU_win={wins/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+5.1f}%")

# Per-season at one threshold
L(f"\nPER-SEASON breakdown at |div|>=5pp:")
for Y in [2024,2025]:
    sy=gp[gp.season==Y]
    bh=sy[sy.divergence>=0.05].copy(); ba=sy[sy.divergence<=-0.05].copy()
    bh['payoff']=bh.apply(lambda r: ml_payoff(r.open_ml_home) if r.home_won_su==1 else -1, axis=1)
    ba['payoff']=ba.apply(lambda r: ml_payoff(r.open_ml_away) if r.home_won_su==0 else -1, axis=1)
    ab=pd.concat([bh,ba]); n=len(ab); wins=(ab.payoff>0).sum()
    if n>=5: roi=ab.payoff.mean()*100; L(f"  {Y}: n={n} SU_win={wins/n*100:.1f}% ROI={roi:+.1f}%")

# Also test betting SPREAD using SU model prediction
L(f"\n{'='*92}")
L(f"ALSO TEST: use SU model prediction to bet the SPREAD instead of ML")
L(f"{'='*92}")
# Convert SU win prob to "should win by what spread" — rough: pred_home_margin = invert spread->winp lookup
# Or: just bet home spread if p_home_nv > prob implied by spread, bet away otherwise
m["fav_won"]=((m.home_spread<0)&(m.actual_margin>0))|((m.home_spread>0)&(m.actual_margin<0))
m["sp_b"]=(m.home_spread.abs()/0.5).round()*0.5
sp_lookup=dict(zip(m.groupby("sp_b").fav_won.mean().index,m.groupby("sp_b").fav_won.mean().values))
def sp_to_winp(s):
    if pd.isna(s): return np.nan
    return sp_lookup.get(round(abs(s)/0.5)*0.5,0.5) if pd.notna(s) else np.nan
gp['sp_imp_h']=gp.open_spread.apply(lambda s: sp_to_winp(s) if s<0 else (1-sp_to_winp(s)) if s>0 else 0.5)
gp['div_vs_spread']=gp.p_home_nv-gp.sp_imp_h
gp['hco_open']=(gp.actual_margin+gp.open_spread>0).astype(float)
gp.loc[gp.actual_margin+gp.open_spread==0,'hco_open']=np.nan
for thr in [0.02,0.03,0.05,0.07]:
    bh=gp[gp.div_vs_spread>=thr]; ba=gp[gp.div_vs_spread<=-thr]
    won=pd.concat([bh.hco_open, 1-ba.hco_open]).dropna(); n=len(won); k=int(won.sum())
    if n>=10:
        lo,hi=wilson_ci(k,n); roi=(k*100/110-(n-k))/n*100
        L(f"  |div_vs_spread|>={thr*100:.0f}pp: n={n} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")
