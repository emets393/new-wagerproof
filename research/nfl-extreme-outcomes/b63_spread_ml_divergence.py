"""
b63: SPREAD-ML DIVERGENCE analysis (DraftKings odds, 2023-2025).

Handicapper theory: when ML implied prob diverges from spread-implied prob, the book is encoding
non-spread info (variance expectations, key-number risk, public square pressure, etc.).

Compute per-game (DK closing line):
  ml_imp = no-vig ML implied home win probability
  spread_imp = empirical historical win rate at that spread
  divergence = ml_imp - spread_imp
    Positive: ML TIGHTER than spread (book extra confident in SU win)
    Negative: ML SOFTER than spread (book expects cover but not SU win — variance/upset risk)

Bucket games by divergence. Test for:
  - Favorite spread cover rate
  - Favorite SU win rate
  - OVER/UNDER hit rate
  - Margin distribution
  - Blowout rate
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

# Load DK odds
o=pd.read_parquet(os.path.join(DATA,"odds_hist.parquet"))
dk=o[o.book=="draftkings"].copy()
dk["snap_ts"]=pd.to_datetime(dk.snap_ts,utc=True)
dk["commence_time"]=pd.to_datetime(dk.commence_time,utc=True)
dk["mins_to_kickoff"]=(dk.commence_time-dk.snap_ts).dt.total_seconds()/60
# Closing snap = latest snap BEFORE kickoff
dk_close=dk[dk.mins_to_kickoff>=0].sort_values("snap_ts").drop_duplicates(["season","home_team","away_team","commence_time"],keep="last")
# Opening snap = first snap
dk_open=dk[dk.mins_to_kickoff>=0].sort_values("snap_ts").drop_duplicates(["season","home_team","away_team","commence_time"],keep="first")
L(f"[dk] {len(dk_close)} unique games (close), {len(dk_open)} (open)")

# Team name mapping
TM={'Arizona':'ARI','Atlanta':'ATL','Baltimore':'BAL','Buffalo':'BUF','Carolina':'CAR','Chicago':'CHI',
    'Cincinnati':'CIN','Cleveland':'CLE','Dallas':'DAL','Denver':'DEN','Detroit':'DET','Green Bay':'GB',
    'Houston':'HOU','Indianapolis':'IND','Jacksonville':'JAX','Kansas City':'KC','Los Angeles Chargers':'LAC',
    'Los Angeles Rams':'LAR','Las Vegas':'LV','Miami':'MIA','Minnesota':'MIN','New England':'NE','New Orleans':'NO',
    'New York Giants':'NYG','New York Jets':'NYJ','Philadelphia':'PHI','Pittsburgh':'PIT','San Francisco':'SF',
    'Seattle':'SEA','Tampa Bay':'TB','Tennessee':'TEN','Washington':'WAS'}

# ML to implied prob
def ml_p(ml):
    return np.where(ml<0, -ml/(-ml+100), 100/(ml+100))

# Empirical spread -> SU win rate (build from all-season matchup data)
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
m["actual_margin"]=m.home_score-m.away_score; m["actual_total"]=m.home_score+m.away_score
m["fav_won"]=((m.home_spread<0)&(m.actual_margin>0))|((m.home_spread>0)&(m.actual_margin<0))
m["abs_spread"]=m.home_spread.abs()
# Bucket spreads at 0.5pt resolution
m["sp_b"]=(m.abs_spread/0.5).round()*0.5
sp_tbl=m.groupby("sp_b").fav_won.agg(["mean","size"]).reset_index().rename(columns={"mean":"emp_winp","size":"n"})
L(f"\n[spread -> empirical SU win rate, NFL 2018-2025]")
L(sp_tbl.head(20).to_string(index=False))
sp_lookup=dict(zip(sp_tbl.sp_b, sp_tbl.emp_winp))
def sp_to_winp(s):
    if pd.isna(s): return np.nan
    return sp_lookup.get(round(abs(s)/0.5)*0.5, 0.5)

# Build DK close frame with divergence
dk_close["home_ab"]=dk_close.home_team.map(TM)
dk_close["away_ab"]=dk_close.away_team.map(TM)
dk_close=dk_close.dropna(subset=["home_ab","away_ab","spread_home","ml_home","ml_away"])
dk_close["ml_imp_home"]=ml_p(dk_close.ml_home)
dk_close["ml_imp_away"]=ml_p(dk_close.ml_away)
dk_close["ml_imp_home_nv"]=dk_close.ml_imp_home/(dk_close.ml_imp_home+dk_close.ml_imp_away)
dk_close["spread_imp_home"]=dk_close.spread_home.apply(lambda s: sp_to_winp(s) if s<0 else (1-sp_to_winp(s)) if s>0 else 0.5)
dk_close["divergence"]=dk_close.ml_imp_home_nv - dk_close.spread_imp_home

# Orient to FAVORITE perspective (where user's theory lives)
dk_close["is_home_fav"]=(dk_close.spread_home<0).astype(int)
dk_close["fav_ab"]=np.where(dk_close.is_home_fav==1, dk_close.home_ab, dk_close.away_ab)
dk_close["dog_ab"]=np.where(dk_close.is_home_fav==1, dk_close.away_ab, dk_close.home_ab)
dk_close["fav_spread"]=-dk_close.spread_home.abs()
dk_close["fav_ml"]=np.where(dk_close.is_home_fav==1, dk_close.ml_home, dk_close.ml_away)
dk_close["fav_ml_imp_nv"]=np.where(dk_close.is_home_fav==1, dk_close.ml_imp_home_nv, 1-dk_close.ml_imp_home_nv)
dk_close["fav_spread_imp"]=dk_close.fav_spread.apply(lambda s: sp_to_winp(s))
dk_close["fav_divergence"]=dk_close.fav_ml_imp_nv - dk_close.fav_spread_imp
# Positive fav_divergence: ML tight (book confident SU)
# Negative fav_divergence: ML soft (book uncertain SU — spread cover expected, upset risk)

L(f"\n[fav_divergence stats]")
L(f"  mean: {dk_close.fav_divergence.mean():+.3f}")
L(f"  std:  {dk_close.fav_divergence.std():+.3f}")
L(f"  range: [{dk_close.fav_divergence.min():+.3f}, {dk_close.fav_divergence.max():+.3f}]")
L(f"  pctiles: 10%={dk_close.fav_divergence.quantile(0.1):+.3f}, 50%={dk_close.fav_divergence.quantile(0.5):+.3f}, 90%={dk_close.fav_divergence.quantile(0.9):+.3f}")

# Join with matchup outcomes
mj=m[["season","home_ab","away_ab","home_score","away_score","actual_margin","actual_total","nv_total_line"]].copy()
g=dk_close[["season","home_ab","away_ab","spread_home","ml_home","ml_away","ml_imp_home_nv","spread_imp_home","divergence",
            "is_home_fav","fav_ab","fav_spread","fav_ml","fav_ml_imp_nv","fav_spread_imp","fav_divergence"]].merge(mj,on=["season","home_ab","away_ab"],how="inner")
L(f"\n[joined] {len(g)} games with DK close + outcomes")

# Outcomes
g["fav_won"]=((g.spread_home<0)&(g.actual_margin>0))|((g.spread_home>0)&(g.actual_margin<0))
g["fav_covered"]=((g.spread_home<0)&(g.actual_margin>-g.spread_home))|((g.spread_home>0)&(g.actual_margin<-g.spread_home))
g.loc[(g.spread_home<0)&(g.actual_margin==-g.spread_home),"fav_covered"]=np.nan
g.loc[(g.spread_home>0)&(g.actual_margin==-g.spread_home),"fav_covered"]=np.nan
g["over_close"]=(g.actual_total>g.nv_total_line).astype(float)
g.loc[g.actual_total==g.nv_total_line,"over_close"]=np.nan
g["margin_abs"]=g.actual_margin.abs()
g["blowout"]=(g.margin_abs>=14).astype(int)
g["close_game"]=(g.margin_abs<=3).astype(int)

# Bucket by divergence (favorite perspective)
g["div_b"]=pd.cut(g.fav_divergence, bins=[-1,-0.05,-0.02,0.02,0.05,1],
                  labels=["very_soft_ml","soft_ml","neutral","tight_ml","very_tight_ml"])
L(f"\n{'='*92}\nDIVERGENCE BUCKETS — favorite ML vs spread implied prob\n{'='*92}")
agg=g.groupby("div_b").agg(
    n=("fav_ab","size"),
    fav_won_pct=("fav_won","mean"),
    fav_cov_pct=("fav_covered","mean"),
    over_pct=("over_close","mean"),
    avg_margin=("margin_abs","mean"),
    blowout_pct=("blowout","mean"),
    close_pct=("close_game","mean"),
).round(3)
L(agg.to_string())

# Per-season for the most-fired buckets
L(f"\n{'='*92}\nPER-SEASON breakdown (FAV COVERED %)\n{'='*92}")
for b in ["very_soft_ml","soft_ml","neutral","tight_ml","very_tight_ml"]:
    sub=g[g.div_b==b]
    if len(sub)<10: continue
    L(f"\n  {b} (n={len(sub)}):")
    for Y in sorted(sub.season.unique()):
        sy=sub[sub.season==Y].dropna(subset=["fav_covered"])
        if len(sy)<5: continue
        k=int(sy.fav_covered.sum()); n=len(sy); lo,hi=wilson_ci(k,n)
        L(f"    {int(Y)}: n={n} fav_cov={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")

# Heavy spread juice analysis (separate angle)
L(f"\n{'='*92}\nSPREAD JUICE analysis — when juice deviates from -110 standard\n{'='*92}")
g_juice=g.merge(dk_close[["season","home_ab","away_ab","spread_home_price"]].rename(columns={"spread_home_price":"home_sp_price"}),on=["season","home_ab","away_ab"],how="left")
# Standard -110 baseline; juiced lines mean book is steering
g_juice["heavy_home_juice"]=(g_juice.home_sp_price<=-120).astype(int)   # book makes home spread expensive -> steering toward AWAY
g_juice["soft_home_juice"]=(g_juice.home_sp_price>=-105).astype(int)    # book makes home spread cheap -> steering toward HOME
for lab, mask in [("heavy home juice (price<=-120, book pushes AWAY)", g_juice.heavy_home_juice==1),
                   ("soft home juice (price>=-105, book pushes HOME)", g_juice.soft_home_juice==1)]:
    sub=g_juice[mask].dropna(subset=["fav_covered"])
    if len(sub)<10: L(f"  {lab}: n={len(sub)} (too few)"); continue
    hc=sub[sub.is_home_fav==1].dropna(subset=["fav_covered"])
    if len(hc)>=5:
        k=int(hc.fav_covered.sum()); n=len(hc); lo,hi=wilson_ci(k,n)
        L(f"  {lab}: home-fav cover n={n} = {k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
    ad=sub[sub.is_home_fav==0].dropna(subset=["fav_covered"])
    if len(ad)>=5:
        k=int(ad.fav_covered.sum()); n=len(ad); lo,hi=wilson_ci(k,n)
        L(f"  {lab}: away-fav cover n={n} = {k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
