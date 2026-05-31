"""
b64: DEEPER line-movement / sharp-money signal mining.

Tests:
  1. Follow the line: bet the side the spread moved TOWARD (CLV-style sharp follow)
  2. Reverse line: bet AGAINST the side line moved toward (fade the public push)
  3. Total movement: same for over/under
  4. ML vs spread direction DIVERGENCE (sharps on one market not the other)
  5. PICKEM & 1.5 games — movement matters more on key tight lines
  6. Key-number CROSSING (line moves through 3, 7, etc.) — does crossing matter
  7. DK juice movement — when juice on home spread changes direction
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print

od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
m["actual_margin"]=m.home_score-m.away_score; m["actual_total"]=m.home_score+m.away_score
g=m[["season","week","home_ab","away_ab","home_score","away_score","actual_margin","actual_total","nv_total_line"]].merge(
    od[["season","home_ab","away_ab","open_spread","close_spread","open_total","close_total","open_ml_home","close_ml_home","open_ml_away","close_ml_away","spread_move","total_move","ml_home_move"]],
    on=["season","home_ab","away_ab"],how="inner")
# Outcomes vs OPENER (we're identifying sharp action — opener is the right reference)
g["hco"]=(g.actual_margin+g.open_spread>0).astype(float); g.loc[g.actual_margin+g.open_spread==0,"hco"]=np.nan
g["over_open"]=(g.actual_total>g.open_total).astype(float); g.loc[g.actual_total==g.open_total,"over_open"]=np.nan
L(f"[data] {len(g)} games with consensus open+close lines (2023-2025)")

# spread_move convention: close_spread - open_spread
#   spread_move < 0 = home spread shrunk (home favored MORE) -> sharps on HOME
#   spread_move > 0 = home spread expanded (home dog more / less favored) -> sharps on AWAY

# =================================================================
def report(d, mask, side, label):
    sub=d[mask].copy()
    if len(sub)<5: L(f"  {label:60s} n={len(sub)} (too few)"); return
    if side=="home": hit=sub.hco.dropna()
    elif side=="away": hit=(1-sub.hco).dropna()
    elif side=="over": hit=sub.over_open.dropna()
    elif side=="under": hit=(1-sub.over_open).dropna()
    k=int(hit.sum()); n=len(hit); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  {label:60s} n={n:4d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

# ================================ TEST 1: FOLLOW the spread movement ================================
L(f"\n{'='*92}\nTEST 1: FOLLOW spread movement (bet side line moved TOWARD, vs OPENER)\n{'='*92}")
for thr in [0.5,1.0,1.5,2.0,2.5,3.0]:
    # spread_move <= -thr: home favored MORE -> bet HOME (line moved to home)
    # spread_move >= +thr: home favored LESS -> bet AWAY (line moved to away)
    bh=g[g.spread_move<=-thr]; ba=g[g.spread_move>=thr]
    won=pd.concat([bh.hco, 1-ba.hco]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  |spread_move|>={thr}: BET MOVEMENT SIDE  n={n:4d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

# ================================ TEST 2: FADE the spread movement ================================
L(f"\n{'='*92}\nTEST 2: FADE spread movement (bet OPPOSITE of where line moved)\n{'='*92}")
for thr in [0.5,1.0,1.5,2.0,2.5,3.0]:
    # spread_move <= -thr: line moved to home -> FADE = bet AWAY
    # spread_move >= +thr: line moved to away -> FADE = bet HOME
    bh=g[g.spread_move>=thr]; ba=g[g.spread_move<=-thr]
    won=pd.concat([bh.hco, 1-ba.hco]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  |spread_move|>={thr}: BET OPPOSITE SIDE  n={n:4d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

# ================================ TEST 3: TOTAL movement ================================
L(f"\n{'='*92}\nTEST 3: TOTAL movement (bet over if total went up, under if down)\n{'='*92}")
for thr in [0.5,1.0,1.5,2.0,2.5]:
    bo=g[g.total_move>=thr]; bu=g[g.total_move<=-thr]
    won=pd.concat([bo.over_open, 1-bu.over_open]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  |total_move|>={thr}: BET MOVEMENT SIDE  n={n:4d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")
# Fade test
L(f"\nFADE total movement:")
for thr in [0.5,1.0,1.5,2.0]:
    bo=g[g.total_move<=-thr]; bu=g[g.total_move>=thr]   # opposite direction
    won=pd.concat([bo.over_open, 1-bu.over_open]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  |total_move|>={thr}: FADE  n={n:4d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

# ================================ TEST 4: ML vs SPREAD divergence ================================
L(f"\n{'='*92}\nTEST 4: ML moved DIFFERENTLY than spread (sharps on one market not the other)\n{'='*92}")
# spread_move > 0 (home spread up, home worse) AND ml_home_move < 0 (home ML BETTER): sharps still on HOME via ML
# spread_move < 0 (home favored more) AND ml_home_move > 0 (home ML WORSE): sharps fading home via ML
g["sm_sign"]=np.sign(g.spread_move); g["mlm_sign"]=np.sign(g.ml_home_move)
mask_sharp_home_ml=(g.spread_move>=0.5)&(g.ml_home_move<=-15)   # spread away but ML toward home
mask_sharp_away_ml=(g.spread_move<=-0.5)&(g.ml_home_move>=15)   # spread to home but ML away
L(f"  ML-sharp-on-HOME (spread softening home, ML hardening home):")
report(g, mask_sharp_home_ml, "home", "  bet HOME")
L(f"  ML-sharp-on-AWAY (spread to home, ML softening home):")
report(g, mask_sharp_away_ml, "away", "  bet AWAY")
# Larger ML divergence
mask_h_big=(g.spread_move>=1)&(g.ml_home_move<=-30)
mask_a_big=(g.spread_move<=-1)&(g.ml_home_move>=30)
L(f"  Bigger divergence (spread move >=1, ML move >=30):")
report(g, mask_h_big, "home", "  bet HOME (big ML-sharp on home)")
report(g, mask_a_big, "away", "  bet AWAY (big ML-sharp on away)")

# ================================ TEST 5: PICKEM & 1.5 games ================================
L(f"\n{'='*92}\nTEST 5: PICKEM (|open_spread| <= 1.5) — line movement signal\n{'='*92}")
p=g[g.open_spread.abs()<=1.5].copy()
L(f"  pickem games: n={len(p)}")
L(f"  games where line CROSSED 0 (open fav -> close dog or vice versa): {int(((p.open_spread*p.close_spread)<0).sum())}")
for thr in [0.5,1.0,1.5,2.0]:
    bh=p[p.spread_move<=-thr]; ba=p[p.spread_move>=thr]
    won=pd.concat([bh.hco, 1-ba.hco]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  pickem |spread_move|>={thr}: BET MOVEMENT SIDE  n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")
L(f"\n  FADE in pickem:")
for thr in [0.5,1.0,1.5,2.0]:
    bh=p[p.spread_move>=thr]; ba=p[p.spread_move<=-thr]
    won=pd.concat([bh.hco, 1-ba.hco]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  pickem |spread_move|>={thr}: BET OPPOSITE       n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")
# Line CROSSED 0
L(f"\n  Line CROSSED 0 (open fav became close dog, or vice versa):")
crossed=p[(p.open_spread*p.close_spread)<0].copy()
# In a crossed game, the team that BECAME the favorite (close side)
crossed["close_fav_home"]=(crossed.close_spread<0).astype(int)
# bet the NEW favorite (close side)
bn=crossed[crossed.close_fav_home==1]   # home is new fav, bet home
bo=crossed[crossed.close_fav_home==0]   # away is new fav, bet away
won=pd.concat([bn.hco, 1-bo.hco]).dropna()
k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
L(f"    bet NEW favorite (close side):  n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")
# bet the OLD favorite (open side)
bn=crossed[crossed.close_fav_home==0]   # close fav is away, OLD fav was home -> bet home
bo=crossed[crossed.close_fav_home==1]   # close fav is home, OLD fav was away -> bet away
won=pd.concat([bn.hco, 1-bo.hco]).dropna()
k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
L(f"    bet OLD favorite (open side):    n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

# Specific 1.5 games (between -1.5 and -0.5 or +0.5 and +1.5)
L(f"\n  Open at 1.5 (-1.5 to -0.5 or +0.5 to +1.5):")
g15=g[g.open_spread.abs().between(0.5,1.5)].copy()
L(f"    n={len(g15)} games at 1.5 lines")
for thr in [0.5,1.0]:
    bh=g15[g15.spread_move<=-thr]; ba=g15[g15.spread_move>=thr]
    won=pd.concat([bh.hco, 1-ba.hco]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"    1.5 line, |move|>={thr}: BET MOVEMENT  n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

# ================================ TEST 6: KEY NUMBER crossing (3, 7) ================================
L(f"\n{'='*92}\nTEST 6: Line CROSSED 3 (key NFL number)\n{'='*92}")
# Crossed 3: open between (open<3 close>=3) or vice versa, on either side
def crossed_thr(open_sp, close_sp, thr):
    return ((np.abs(open_sp)<thr)&(np.abs(close_sp)>=thr))|((np.abs(open_sp)>=thr)&(np.abs(close_sp)<thr))
g["crossed_3"]=crossed_thr(g.open_spread, g.close_spread, 3.0)
g["crossed_7"]=crossed_thr(g.open_spread, g.close_spread, 7.0)
L(f"  games crossing key 3: {int(g.crossed_3.sum())} / {len(g)}")
L(f"  games crossing key 7: {int(g.crossed_7.sum())} / {len(g)}")
# In games that crossed 3 toward favorite (line getting more aggressive on fav), bet which side?
c3=g[g.crossed_3].copy()
# Spread moved TO bigger favorite (|close|>|open|): bet favorite vs OPENER
c3["got_bigger"]=c3.close_spread.abs()>c3.open_spread.abs()
c3["fav_home_close"]=(c3.close_spread<0).astype(int)
# Cases where favorite got LARGER (spread moved to fav)
big=c3[c3.got_bigger]
# Bet the favorite (close side) vs the opener line
bh=big[big.fav_home_close==1]; ba=big[big.fav_home_close==0]
won=pd.concat([bh.hco, 1-ba.hco]).dropna()
k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
L(f"  crossed 3 toward FAV  -> bet FAV vs opener:  n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")
# Cases where favorite got SMALLER (line moved toward pickem)
small=c3[~c3.got_bigger]
bh=small[small.fav_home_close==1]; ba=small[small.fav_home_close==0]
won=pd.concat([bh.hco, 1-ba.hco]).dropna()
k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
L(f"  crossed 3 toward DOG  -> bet FAV vs opener:  n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")
# Or bet dog when line moved to dog
won=pd.concat([(1-bh.hco), ba.hco]).dropna()
k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
L(f"  crossed 3 toward DOG  -> bet DOG vs opener:  n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

# ================================ TEST 7: DK juice movement ================================
L(f"\n{'='*92}\nTEST 7: DraftKings JUICE movement (spread price changes)\n{'='*92}")
o=pd.read_parquet(os.path.join(DATA,"odds_hist.parquet"))
dk=o[o.book=="draftkings"].copy()
dk["snap_ts"]=pd.to_datetime(dk.snap_ts,utc=True); dk["commence_time"]=pd.to_datetime(dk.commence_time,utc=True)
dk["mins"]=(dk.commence_time-dk.snap_ts).dt.total_seconds()/60
dk_o=dk[dk.mins>=0].sort_values("snap_ts").drop_duplicates(["season","home_team","away_team","commence_time"],keep="first")
dk_c=dk[dk.mins>=0].sort_values("snap_ts").drop_duplicates(["season","home_team","away_team","commence_time"],keep="last")
TM={'Arizona':'ARI','Atlanta':'ATL','Baltimore':'BAL','Buffalo':'BUF','Carolina':'CAR','Chicago':'CHI','Cincinnati':'CIN','Cleveland':'CLE','Dallas':'DAL','Denver':'DEN','Detroit':'DET','Green Bay':'GB','Houston':'HOU','Indianapolis':'IND','Jacksonville':'JAX','Kansas City':'KC','Los Angeles Chargers':'LAC','Los Angeles Rams':'LAR','Las Vegas':'LV','Miami':'MIA','Minnesota':'MIN','New England':'NE','New Orleans':'NO','New York Giants':'NYG','New York Jets':'NYJ','Philadelphia':'PHI','Pittsburgh':'PIT','San Francisco':'SF','Seattle':'SEA','Tampa Bay':'TB','Tennessee':'TEN','Washington':'WAS'}
for x in [dk_o,dk_c]:
    x["home_ab"]=x.home_team.map(TM); x["away_ab"]=x.away_team.map(TM)
dk_o2=dk_o[["season","home_ab","away_ab","spread_home_price"]].rename(columns={"spread_home_price":"juice_open"})
dk_c2=dk_c[["season","home_ab","away_ab","spread_home_price"]].rename(columns={"spread_home_price":"juice_close"})
gdk=g.merge(dk_o2,on=["season","home_ab","away_ab"],how="inner").merge(dk_c2,on=["season","home_ab","away_ab"],how="inner")
gdk["juice_move"]=gdk.juice_close - gdk.juice_open
L(f"  games with DK juice (open+close): {len(gdk)}")
# Juice on home moved DOWN (more negative): sharps coming in on HOME -> bet HOME
# Juice on home moved UP (less negative or positive): sharps fading home / on AWAY -> bet AWAY
for thr in [5,10,15,20]:
    bh=gdk[gdk.juice_move<=-thr]; ba=gdk[gdk.juice_move>=thr]
    won=pd.concat([bh.hco, 1-ba.hco]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  |juice_move|>={thr}: FOLLOW (line moved AWAY from juiced side)  n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")

L(f"\nFADE juice movement:")
for thr in [5,10,15,20]:
    bh=gdk[gdk.juice_move>=thr]; ba=gdk[gdk.juice_move<=-thr]
    won=pd.concat([bh.hco, 1-ba.hco]).dropna()
    k=int(won.sum()); n=len(won); lo,hi=wilson_ci(k,n) if n else (0,0); roi=(k*100/110-(n-k))/n*100 if n else 0
    L(f"  |juice_move|>={thr}: FADE  n={n:3d} hit={(k/n*100 if n else 0):5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")
