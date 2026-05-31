"""
b65: TIMING of line movement (Mon-Wed = sharp signal, Fri-Sun = public) + DEEP DIVE on 1.5 line games.

Part A: For each game, segment line movement into time windows using snap_ts:
  - Early window:   4-7+ days before kickoff (Tue-Wed snapshots) — typically sharp money
  - Mid window:     2-4 days before kickoff (Thu-Fri) — mix of sharp + early public
  - Late window:    0-48 hrs before kickoff (Sat-Sun) — public/squares
Theory: EARLY moves should be more predictive of cover than LATE moves (sharp vs square money).

Part B: 1.5-line games (|open_spread| <= 1.5). Layer in:
  - Movement timing
  - Juice movement
  - PR differential
  - Open-to-close cross of 0
Find the specific edge.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

# Load DK snapshots
o=pd.read_parquet(os.path.join(DATA,"odds_hist.parquet"))
dk=o[o.book=="draftkings"].copy()
dk["snap_ts"]=pd.to_datetime(dk.snap_ts,utc=True)
dk["commence_time"]=pd.to_datetime(dk.commence_time,utc=True)
dk["hrs_to_ko"]=(dk.commence_time-dk.snap_ts).dt.total_seconds()/3600
dk=dk[dk.hrs_to_ko>=0]
L(f"[load] DK snapshots: {len(dk):,} | unique games: {dk.groupby(['season','home_team','away_team','commence_time']).ngroups}")

# Team mapping
TM={'Arizona':'ARI','Atlanta':'ATL','Baltimore':'BAL','Buffalo':'BUF','Carolina':'CAR','Chicago':'CHI','Cincinnati':'CIN','Cleveland':'CLE','Dallas':'DAL','Denver':'DEN','Detroit':'DET','Green Bay':'GB','Houston':'HOU','Indianapolis':'IND','Jacksonville':'JAX','Kansas City':'KC','Los Angeles Chargers':'LAC','Los Angeles Rams':'LAR','Las Vegas':'LV','Miami':'MIA','Minnesota':'MIN','New England':'NE','New Orleans':'NO','New York Giants':'NYG','New York Jets':'NYJ','Philadelphia':'PHI','Pittsburgh':'PIT','San Francisco':'SF','Seattle':'SEA','Tampa Bay':'TB','Tennessee':'TEN','Washington':'WAS'}
dk["home_ab"]=dk.home_team.map(TM); dk["away_ab"]=dk.away_team.map(TM)
dk=dk.dropna(subset=["home_ab","away_ab","spread_home"])

# For each game, find spreads at OPEN, EARLY (~96hr), MID (~48hr), LATE (~12hr), CLOSE
def snap_at(g, hrs_min, hrs_max):
    """Get the snapshot CLOSEST to (hrs_min + hrs_max)/2 within the window, or None"""
    in_win=g[(g.hrs_to_ko>=hrs_min)&(g.hrs_to_ko<hrs_max)]
    if len(in_win)==0: return None
    target=(hrs_min+hrs_max)/2
    return in_win.iloc[(in_win.hrs_to_ko-target).abs().argsort().iloc[0]]

# Aggregate per-game timing snapshots
rows=[]
for (s,h,a,ct), grp in dk.groupby(["season","home_ab","away_ab","commence_time"]):
    g=grp.sort_values("snap_ts")
    open_row=g.iloc[0]
    close_row=g.iloc[-1]
    # Time windows (hours before kickoff)
    early=snap_at(g, 96, 168)   # 4-7 days
    mid=snap_at(g, 48, 96)      # 2-4 days
    late=snap_at(g, 12, 48)     # 12hr-2days
    rows.append({
        "season":s,"home_ab":h,"away_ab":a,"commence_time":ct,
        "open_spread":open_row.spread_home,"close_spread":close_row.spread_home,
        "open_total":open_row.total_point,"close_total":close_row.total_point,
        "open_juice_h":open_row.spread_home_price,"close_juice_h":close_row.spread_home_price,
        "open_ml_h":open_row.ml_home,"close_ml_h":close_row.ml_home,
        "early_spread":early.spread_home if early is not None else np.nan,
        "mid_spread":mid.spread_home if mid is not None else np.nan,
        "late_spread":late.spread_home if late is not None else np.nan,
        "early_total":early.total_point if early is not None else np.nan,
        "late_total":late.total_point if late is not None else np.nan,
        "n_snaps":len(g),
    })
tg=pd.DataFrame(rows)
L(f"\n[snapshots] games with timing data: open+close={len(tg)}, +early={tg.early_spread.notna().sum()}, +late={tg.late_spread.notna().sum()}")

# Compute timing-window moves
tg["early_move"]=tg.early_spread-tg.open_spread          # open -> early week (Tue-Wed-ish)
tg["mid_move"]=tg.mid_spread-tg.early_spread             # early -> mid (Thu-Fri)
tg["late_move"]=tg.close_spread-tg.late_spread           # late (12-48hr) -> close (game time)
tg["total_move"]=tg.close_spread-tg.open_spread
tg["early_tot_move"]=tg.early_total-tg.open_total
tg["late_tot_move"]=tg.close_total-tg.late_total

# Join with outcomes
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
m["actual_margin"]=m.home_score-m.away_score; m["actual_total"]=m.home_score+m.away_score
m["pr_diff"]=m.home_predictive_pr-m.away_predictive_pr
mj=m[["season","week","home_ab","away_ab","actual_margin","actual_total","pr_diff","home_predictive_pr","away_predictive_pr","home_spread"]]
g=tg.merge(mj,on=["season","home_ab","away_ab"],how="inner")
g["hco_open"]=(g.actual_margin+g.open_spread>0).astype(float); g.loc[g.actual_margin+g.open_spread==0,"hco_open"]=np.nan
g["over_open"]=(g.actual_total>g.open_total).astype(float); g.loc[g.actual_total==g.open_total,"over_open"]=np.nan
L(f"[joined] games with timing + outcomes: {len(g)}")

# Helper
def bet_move_side(d, move_col, win_col, thr, label):
    """Bet the side the line moved TOWARD (negative move = bet home; positive move = bet away)"""
    bh=d[d[move_col]<=-thr]; ba=d[d[move_col]>=thr]
    won=pd.concat([bh[win_col], 1-ba[win_col]]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  {label:55s} |move|>={thr}: n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

# ================================ PART A: TIMING analysis ================================
L(f"\n{'='*92}\nPART A: LINE MOVEMENT TIMING — early (sharp) vs late (square)?\n{'='*92}")
g_e=g.dropna(subset=["early_spread"])
g_l=g.dropna(subset=["late_spread"])

L(f"\nEARLY-WEEK moves (open -> 4-7 days before kickoff):")
for thr in [0.5,1.0,1.5,2.0]: bet_move_side(g_e, "early_move", "hco_open", thr, "  early_move bet movement")
L(f"\nLATE-WEEK moves (late window 12-48hr -> close):")
for thr in [0.5,1.0,1.5,2.0]: bet_move_side(g_l, "late_move", "hco_open", thr, "  late_move bet movement")
L(f"\nFADE late-week moves (assume public is wrong late):")
for thr in [0.5,1.0,1.5,2.0]:
    bh=g_l[g_l.late_move>=thr]; ba=g_l[g_l.late_move<=-thr]
    won=pd.concat([bh.hco_open, 1-ba.hco_open]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  late_move FADE |move|>={thr}: n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

L(f"\nTOTAL movement timing (similar test for over/under):")
L(f"Early total move (open -> 4-7 days):")
for thr in [0.5,1.0,1.5,2.0]:
    bo=g_e[g_e.early_tot_move>=thr]; bu=g_e[g_e.early_tot_move<=-thr]
    won=pd.concat([bo.over_open, 1-bu.over_open]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  early_total_move bet movement |>={thr}: n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")
L(f"Late total move (late -> close):")
for thr in [0.5,1.0,1.5,2.0]:
    bo=g_l[g_l.late_tot_move>=thr]; bu=g_l[g_l.late_tot_move<=-thr]
    won=pd.concat([bo.over_open, 1-bu.over_open]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  late_total_move bet movement |>={thr}: n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

# Sharp early move + late move CONFIRMS (same direction)
L(f"\nCONFLUENCE: early & late move SAME direction (sharps + late confirms)")
g_b=g.dropna(subset=["early_spread","late_spread"])
g_b["both_same_dir"]=(np.sign(g_b.early_move)==np.sign(g_b.late_move))&(g_b.early_move.abs()>=1)&(g_b.late_move.abs()>=0.5)
conf=g_b[g_b.both_same_dir].copy()
# Bet direction
bh=conf[conf.total_move<=-1]; ba=conf[conf.total_move>=1]
won=pd.concat([bh.hco_open, 1-ba.hco_open]).dropna()
k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
L(f"  early(>=1)+late(>=0.5) same direction, total_move >=1: n={n} hit={(k/n*100 if n else 0):.1f}% ROI={roi:+.1f}%")

# DIVERGENCE: early one way, late the other (reverse line)
L(f"\nDIVERGENCE: early & late move OPPOSITE directions (sharp gets faded by public)")
g_b["divergent"]=(np.sign(g_b.early_move)!=np.sign(g_b.late_move))&(g_b.early_move.abs()>=0.5)&(g_b.late_move.abs()>=0.5)
div=g_b[g_b.divergent].copy()
L(f"  divergent games: n={len(div)}")
if len(div)>=10:
    # Bet the EARLY direction (sharps were right, late public faded them)
    bh=div[div.early_move<=-0.5]; ba=div[div.early_move>=0.5]
    won=pd.concat([bh.hco_open, 1-ba.hco_open]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  divergent: bet EARLY-move side n={n} hit={(k/n*100 if n else 0):.1f}% ROI={roi:+.1f}%")
    # Bet the LATE direction
    bh=div[div.late_move<=-0.5]; ba=div[div.late_move>=0.5]
    won=pd.concat([bh.hco_open, 1-ba.hco_open]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  divergent: bet LATE-move side  n={n} hit={(k/n*100 if n else 0):.1f}% ROI={roi:+.1f}%")

# ================================ PART B: 1.5 LINE DEEP DIVE ================================
L(f"\n{'='*92}\nPART B: 1.5 LINE GAMES — comprehensive analysis\n{'='*92}")
pe=g[g.open_spread.abs()<=1.5].copy()
L(f"\n[data] 1.5 line games (|open_spread|<=1.5): n={len(pe)}")
L(f"  with early snapshot: {pe.early_spread.notna().sum()}")
L(f"  with late snapshot:  {pe.late_spread.notna().sum()}")

L(f"\nB1: Movement TIMING in 1.5 games")
pe_e=pe.dropna(subset=["early_spread"])
pe_l=pe.dropna(subset=["late_spread"])
for thr in [0.5,1.0,1.5]: bet_move_side(pe_e, "early_move", "hco_open", thr, "  1.5 early_move")
for thr in [0.5,1.0,1.5]: bet_move_side(pe_l, "late_move", "hco_open", thr, "  1.5 late_move")

L(f"\nB2: JUICE in 1.5 games")
pe["juice_change_h"]=pe.close_juice_h-pe.open_juice_h
pe["heavy_home_juice_close"]=(pe.close_juice_h<=-120).astype(int)
pe["heavy_away_juice_close"]=(pe.close_juice_h>=-100).astype(int)   # away gets juiced when home cheap
L(f"  games with home juice <=-120 at close: {pe.heavy_home_juice_close.sum()}")
sub=pe[pe.heavy_home_juice_close==1]
if len(sub)>=10:
    k=int(sub.hco_open.sum()); n=int(sub.hco_open.notna().sum()); lo,hi=wilson_ci(k,n)
    L(f"  1.5 game + heavy home juice -> bet HOME: n={n} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
sub=pe[pe.heavy_away_juice_close==1]
if len(sub)>=10:
    k=int((1-sub.hco_open).sum()); n=int(sub.hco_open.notna().sum()); lo,hi=wilson_ci(k,n)
    L(f"  1.5 game + heavy away juice -> bet AWAY: n={n} hit={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")

L(f"\nB3: POWER RATINGS in 1.5 games")
# Bet the team with HIGHER PR — does pr_diff matter when line is tight?
for thr in [1,2,3,4,5]:
    bh=pe[pe.pr_diff>=thr]; ba=pe[pe.pr_diff<=-thr]
    won=pd.concat([bh.hco_open, 1-ba.hco_open]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  1.5 + |pr_diff|>={thr} bet better-PR team: n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

L(f"\nB4: PR + line CROSSED 0 in 1.5 games")
pe["crossed_zero"]=(pe.open_spread*pe.close_spread)<0
crossed=pe[pe.crossed_zero].copy()
L(f"  crossed-zero 1.5 games: n={len(crossed)}")
if len(crossed)>=10:
    # When line crosses 0, does PR direction matter?
    crossed["close_fav_is_home"]=crossed.close_spread<0
    # Bet team that is BOTH the closer favorite AND has higher PR (confluence)
    conf_home=crossed[(crossed.close_fav_is_home==True)&(crossed.pr_diff>=0)]
    conf_away=crossed[(crossed.close_fav_is_home==False)&(crossed.pr_diff<=0)]
    L(f"    confluence (close-fav AND PR-fav same team) home={len(conf_home)} away={len(conf_away)}")
    won=pd.concat([conf_home.hco_open, 1-conf_away.hco_open]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"    bet confluence team: n={n} hit={(k/n*100 if n else 0):.1f}% ROI={roi:+.1f}%")
    # Anti-confluence (close-fav is OPPOSITE PR-fav)
    anti_home=crossed[(crossed.close_fav_is_home==True)&(crossed.pr_diff<0)]
    anti_away=crossed[(crossed.close_fav_is_home==False)&(crossed.pr_diff>0)]
    L(f"    anti-confluence (close-fav opposite PR-fav) home={len(anti_home)} away={len(anti_away)}")
    # In anti-confluence, market is going against power ratings — fade or follow?
    # Bet the close fav (follow market)
    won_f=pd.concat([anti_home.hco_open, 1-anti_away.hco_open]).dropna()
    k=int(won_f.sum()); n=len(won_f); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"    anti-conf: bet close fav (follow market): n={n} hit={(k/n*100 if n else 0):.1f}% ROI={roi:+.1f}%")
    # Bet the PR-fav (fade market, trust ratings)
    won_p=pd.concat([anti_away.hco_open, 1-anti_home.hco_open]).dropna()
    k=int(won_p.sum()); n=len(won_p); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"    anti-conf: bet PR fav (fade market):    n={n} hit={(k/n*100 if n else 0):.1f}% ROI={roi:+.1f}%")

L(f"\nB5: TOTAL movement in 1.5 games")
for thr in [0.5,1.0,1.5,2.0]:
    bo=pe[pe.close_total-pe.open_total>=thr]; bu=pe[pe.close_total-pe.open_total<=-thr]
    won=pd.concat([bo.over_open, 1-bu.over_open]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  1.5 game total_move bet movement |>={thr}: n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

L(f"\nB6: ML MOVEMENT in 1.5 games")
pe["ml_h_move"]=pe.close_ml_h - pe.open_ml_h
# Negative ml_h_move means home ML got tighter (book more confident in home SU)
for thr in [10,20,30,50]:
    bh=pe[pe.ml_h_move<=-thr]; ba=pe[pe.ml_h_move>=thr]
    won=pd.concat([bh.hco_open, 1-ba.hco_open]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  1.5 ml_move bet movement |>={thr}: n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")
