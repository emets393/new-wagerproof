"""
BIRTHDAY anytime-TD analysis (expected-vs-actual, so non-playing players don't skew it).
Anytime TD = rushing_tds + receiving_tds (incl QB rushing; EXCL passing TDs — the QB didn't score).
Method: each player's EXPECTED anytime-TD rate/game = their rate in NON-birthday games (per season, career
fallback). For games played ON the player's birthday, compare OBSERVED TDs to SUM of expected rates.
Test: Poisson-binomial Monte Carlo (each birthday game ~ Bernoulli(player's baseline)); is observed > expected?
Split by position (QB/RB/WR/TE) + a +/-3-day 'birthday week' sensitivity.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
o=pd.read_parquet(os.path.join(DATA,"player_offense.parquet"))
px=pd.read_parquet(os.path.join(DATA,"players_xwalk.parquet"))[["gsis_id","birth_date","display_name"]]
g=pd.read_parquet(os.path.join(DATA,"nflverse_games.parquet"))
# anytime TD (binary) + count
o["td"]=(pd.to_numeric(o.rushing_tds,errors="coerce").fillna(0)+pd.to_numeric(o.receiving_tds,errors="coerce").fillna(0))
o["any_td"]=(o.td>0).astype(int)
# game dates (team-game level)
gg=g[["season","week","gameday","home_team","away_team"]].copy()
gd=pd.concat([gg.rename(columns={"home_team":"team"})[["season","week","gameday","team"]],
              gg.rename(columns={"away_team":"team"})[["season","week","gameday","team"]]],ignore_index=True)
o=o.merge(gd,on=["season","week","team"],how="left")
o=o.merge(px,left_on="player_id",right_on="gsis_id",how="left")
o["gameday"]=pd.to_datetime(o.gameday,errors="coerce"); o["bd"]=pd.to_datetime(o.birth_date,errors="coerce")
o=o.dropna(subset=["gameday","bd"]).copy()
L(f"[build] player-games w/ date+birthdate: {len(o)} ({o.gameday.notna().mean()*100:.0f}% dated)")
# day-of-year distance from birthday (handle year wrap)
gmd=o.gameday.dt.strftime("%m-%d"); bmd=o.bd.dt.strftime("%m-%d")
o["is_bday"]=(gmd==bmd).astype(int)
doy_g=o.gameday.dt.dayofyear; doy_b=o.bd.dt.dayofyear
dd=(doy_g-doy_b).abs(); o["bday_dist"]=np.minimum(dd,365-dd)
L(f"[build] exact-birthday games played: {int(o.is_bday.sum())} | within +/-3 days: {int((o.bday_dist<=3).sum())}")

def expected_rate(df):
    # per (player, season) baseline anytime-TD rate from NON-birthday games; career fallback if thin
    nb=df[df.is_bday==0]
    ps=nb.groupby(["player_id","season"]).any_td.agg(["mean","size"]).rename(columns={"mean":"r_ps","size":"n_ps"})
    car=nb.groupby("player_id").any_td.mean().rename("r_car")
    df=df.merge(ps,on=["player_id","season"],how="left").merge(car,on="player_id",how="left")
    df["exp_rate"]=np.where(df.n_ps>=3, df.r_ps, df.r_car)
    df["exp_rate"]=df.exp_rate.fillna(df.r_car).fillna(nb.any_td.mean())
    return df
o=expected_rate(o)

def test(sub,label):
    sub=sub.dropna(subset=["exp_rate"]); n=len(sub)
    if n<5: L(f"  {label:26s} n={n} (too few)"); return
    K=int(sub.any_td.sum()); E=sub.exp_rate.sum(); p=sub.exp_rate.values
    rng=np.random.default_rng(0); sims=(rng.random((20000,n))<p).sum(1)
    pval=2*min((sims>=K).mean(),(sims<=K).mean())
    ratio=K/E if E else float("nan")
    L(f"  {label:26s} games={n:4d}  observed={K:3d}  expected={E:5.1f}  ratio={ratio:4.2f}  MC p={pval:.3f}")

L("\n"+"="*78); L("EXACT BIRTHDAY — observed anytime-TDs vs expected (player's own baseline)"); L("="*78)
bd=o[o.is_bday==1]
test(bd,"ALL players")
for pg in ["QB","RB","WR","TE"]:
    test(bd[bd.position_group==pg] if "position_group" in bd else bd[bd.position==pg], pg)
L("\n  raw rates: birthday anytime-TD rate vs baseline:")
L(f"    birthday games anytime-TD rate = {bd.any_td.mean()*100:.1f}%  |  their expected baseline = {bd.exp_rate.mean()*100:.1f}%  |  league all-games = {o.any_td.mean()*100:.1f}%")

L("\n"+"="*78); L("SENSITIVITY — 'birthday week' windows (more games, less exact)"); L("="*78)
for w in [0,1,3,7]:
    test(o[o.bday_dist<=w], f"within +/-{w} days")
