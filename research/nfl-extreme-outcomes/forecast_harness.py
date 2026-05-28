"""
2026 FORWARD-TEST HARNESS — freezes the locked assets and produces a weekly pick ledger with CLV tracking.

Locked assets (see LOCKED_MODELS.md):
  SIDES   : walk-forward HistGBM on home_cover (vs close); bet the confident side (|p-.5|>=.03) vs the OPENER.
            Feature set = b14 "base" (Madden-independent so it runs before Aug-2026 launch ratings exist).
  TOTALS  : spot alerts only (the slate is breakeven) —
            * key WR/TE out (NGS air-share>=35%) -> OVER ; high-conviction tier adds Madden OVR>=80 if available
            * wind >= 15mph -> UNDER
Every pick is logged at the OPENER with the model edge; grade() later fills result + CLOSE + CLV; report()
summarizes hit%, ROI, CLV by market/rule. Validated here with a 2025 dry-run (train 2018-2024).

USAGE
  python3 forecast_harness.py --dry-run 2025      # validate against the held-out year
  python3 forecast_harness.py --season 2026 --week 3   # weekly live use (once 2026 data is loaded)
  python3 forecast_harness.py --grade 2026        # fill results/close/CLV for finished games
  python3 forecast_harness.py --report 2026
"""
import os, sys, argparse, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingClassifier
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data")
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"out"); L=print
CONF=0.03; AIR_THR=35.0; OVR_THR=80.0; WIND_THR=15.0
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}

def carry(df,kid,col,out):
    df=df.sort_values([kid,"season","week"]).copy(); df["_c"]=df.groupby([kid,"season"])[col].apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
    pl=df[["season",kid]].drop_duplicates(); grid=pl.merge(pd.DataFrame({"week":range(1,23)}),how="cross").merge(df[["season",kid,"week","_c"]],on=["season",kid,"week"],how="left").sort_values(["season",kid,"week"]); grid[out]=grid.groupby(["season",kid])["_c"].ffill(); return grid[["season","week",kid,out]]

def build():
    """Build the game-level feature frame + totals triggers. Pure function of the cached data layer."""
    m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
    inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet")); rec=pd.read_parquet(os.path.join(DATA,"ngs_receiving.parquet"))
    dfd=pd.read_parquet(os.path.join(DATA,"player_stats_def.parquet")); tg=pd.read_parquet(os.path.join(DATA,"tg.parquet"))
    mad_p=os.path.join(DATA,"madden_ratings.parquet"); mad=pd.read_parquet(mad_p) if os.path.exists(mad_p) else None
    m["actual_margin"]=m.home_score-m.away_score; m["actual_total"]=m.home_score+m.away_score
    m["home_cover"]=(m.actual_margin+m.home_spread>0).astype(int)
    # ---- sides BASE features (locked b14) ----
    air=carry(rec,"player_id","percent_share_of_intended_air_yards","airshare")
    dfd["dprod"]=dfd.def_sacks.fillna(0)*2+dfd.def_qb_hits.fillna(0)+dfd.def_pass_defended.fillna(0)+dfd.def_interceptions.fillna(0)*2+dfd.def_tackles_for_loss.fillna(0)
    miss=inj[inj.report_status.isin(["Out","Doubtful"])].merge(air,on=["season","week","player_id"],how="left")
    miss["air_w"]=np.where(miss.position.astype(str).str.strip().isin(["WR","TE","RB","FB"]),miss.airshare.clip(lower=0).fillna(0),0)
    ai=miss.groupby(["season","week","team"]).air_w.sum().reset_index(); ai["ab"]=ai.team.replace(nv2our)
    dteam=dfd.groupby(["season","week","team"]).dprod.sum().reset_index().sort_values(["team","season","week"])
    dteam["dpt"]=dteam.groupby(["team","season"]).dprod.apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True); dteam["ab"]=dteam.team.replace(nv2our)
    for side,p in [("home","h_"),("away","a_")]:
        m=m.merge(ai.rename(columns={"ab":f"{side}_ab","air_w":f"{p}air"})[["season","week",f"{side}_ab",f"{p}air"]],on=["season","week",f"{side}_ab"],how="left")
        m=m.merge(dteam.rename(columns={"ab":f"{side}_ab","dpt":f"{p}dpt"})[["season","week",f"{side}_ab",f"{p}dpt"]],on=["season","week",f"{side}_ab"],how="left")
    for c in ["h_air","a_air","h_dpt","a_dpt"]: m[c]=m[c].fillna(0)
    flags=["pre_bye","blowout_win_last","blowout_loss_last","third_road","div_revenge"]
    H=tg[tg.is_home==1][["unique_id"]+flags].rename(columns={f:f"h_{f}" for f in flags}); Aw=tg[tg.is_home==0][["unique_id"]+flags].rename(columns={f:f"a_{f}" for f in flags})
    m=m.merge(H,on="unique_id",how="left").merge(Aw,on="unique_id",how="left")
    m["pr_diff"]=m.home_predictive_pr-m.away_predictive_pr; m["last5_diff"]=m.home_last5_pr-m.away_last5_pr
    m["abs_spread"]=m.home_spread.abs()
    m["home_dog_7_10"]=((m.home_spread>=7.5)&(m.home_spread<=10.5)).astype(int); m["away_dog_7_10"]=((m.home_spread<=-7.5)&(m.home_spread>=-10.5)).astype(int)
    m["div_game_i"]=m.div_game.astype(int); m["conf_game_i"]=m.conference_game.astype(int); m["league_game_i"]=m.league_game.astype(int)
    m["primetime_i"]=m.primetime.fillna(0).astype(int); m["home_fav"]=(m.home_spread<0).astype(int)
    m["air_diff"]=m.h_air-m.a_air; m["dprod_team_diff"]=m.h_dpt-m.a_dpt
    sched=[f"{s}_{f}" for s in ["h","a"] for f in flags]
    for c in sched: m[c]=pd.to_numeric(m[c],errors="coerce").fillna(0)
    ref=[c for c in ["ref_total_pts_avg","ref_home_cover_pct","ref_under_pct","ref_fav_cover_pct"] if c in m.columns]
    BASE=["pr_diff","home_predictive_pr","away_predictive_pr","last5_diff","home_consistency_pr","away_consistency_pr",
          "home_dog_7_10","away_dog_7_10","div_game_i","conf_game_i","league_game_i","primetime_i","week","home_fav","abs_spread",
          "air_diff","dprod_team_diff","h_dpt","a_dpt"]+ref+sched
    for c in BASE: m[c]=pd.to_numeric(m[c],errors="coerce")
    # ---- totals triggers ----
    msk=inj[inj.report_status.isin(["Out","Doubtful"])].merge(air,on=["season","week","player_id"],how="left")
    msk=msk[msk.position.astype(str).str.strip().isin(["WR","TE","RB","FB"])]; msk["airshare"]=msk.airshare.fillna(0)
    if mad is not None:
        mov=mad[mad.status=="matched"][["season","gsis_id","ovr"]].dropna(subset=["gsis_id"]).drop_duplicates(["season","gsis_id"])
        msk=msk.merge(mov.rename(columns={"gsis_id":"player_id"}),on=["season","player_id"],how="left")
    else: msk["ovr"]=np.nan
    msk=msk[msk.airshare>=AIR_THR]
    trg=msk.groupby(["season","week","team"]).agg(max_air=("airshare","max"),max_ovr=("ovr","max")).reset_index(); trg["ab"]=trg.team.replace(nv2our)
    for side,p in [("home","h_"),("away","a_")]:
        m=m.merge(trg.rename(columns={"ab":f"{side}_ab","max_air":f"{p}rcv_air","max_ovr":f"{p}rcv_ovr"})[["season","week",f"{side}_ab",f"{p}rcv_air",f"{p}rcv_ovr"]],on=["season","week",f"{side}_ab"],how="left")
    m["wind_mph"]=pd.to_numeric(m.get("wind_mph"),errors="coerce").fillna(pd.to_numeric(m.get("wind_speed"),errors="coerce"))
    return m, BASE

def train_predict(m, BASE, target):
    """Train on all seasons < target, predict target. Returns target games with ph (P home covers close)."""
    tr=m[(m.season<target)&(m.week>=4)].dropna(subset=["home_cover"])
    clf=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[BASE],tr.home_cover)
    te=m[m.season==target].copy(); te["ph"]=clf.predict_proba(te[BASE])[:,1]
    return te

def generate(m, BASE, target, week=None):
    """Produce ledger rows (picks logged at the OPENER) for target season (optionally one week)."""
    od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
    te=train_predict(m,BASE,target)
    te=te.merge(od[["season","home_ab","away_ab","open_spread","open_total","close_spread","close_total"]],on=["season","home_ab","away_ab"],how="left")
    if week is not None: te=te[te.week==week]
    rows=[]
    for _,g in te.iterrows():
        gid=f"{g.season}-W{int(g.week):02d}-{g.away_ab}@{g.home_ab}"; mtchp=f"{g.away_ab}@{g.home_ab}"
        # SIDES (needs opener + confident model)
        if pd.notna(g.open_spread) and pd.notna(g.ph) and abs(g.ph-0.5)>=CONF:
            home_pick=g.ph>=0.5+CONF
            rows.append(dict(pick_id=gid+"-S",season=g.season,week=int(g.week),game=mtchp,rule="sides_model",
                market="spread",side=(f"{g.home_ab} {g.open_spread:+g}" if home_pick else f"{g.away_ab} {-g.open_spread:+g}"),
                bet_home=int(home_pick),open_num=g.open_spread,close_num=g.close_spread,edge=round(g.ph-0.5,3)))
        # TOTALS: receiver-out OVER (two-tier)
        air=max(g.get("h_rcv_air",np.nan) if pd.notna(g.get("h_rcv_air")) else 0, g.get("a_rcv_air",0) if pd.notna(g.get("a_rcv_air")) else 0)
        ovr=np.nanmax([g.get("h_rcv_ovr",np.nan),g.get("a_rcv_ovr",np.nan)])
        if air>=AIR_THR and pd.notna(g.open_total):
            tier="receiver_over_HC" if (pd.notna(ovr) and ovr>=OVR_THR) else "receiver_over"
            rows.append(dict(pick_id=gid+"-O",season=g.season,week=int(g.week),game=mtchp,rule=tier,
                market="total",side=f"OVER {g.open_total:g}",bet_home=-1,open_num=g.open_total,close_num=g.close_total,edge=round(air,1)))
        # TOTALS: wind UNDER
        if pd.notna(g.wind_mph) and g.wind_mph>=WIND_THR and pd.notna(g.open_total):
            rows.append(dict(pick_id=gid+"-U",season=g.season,week=int(g.week),game=mtchp,rule="wind_under",
                market="total",side=f"UNDER {g.open_total:g}",bet_home=-2,open_num=g.open_total,close_num=g.close_total,edge=round(g.wind_mph,1)))
    led=pd.DataFrame(rows)
    path=os.path.join(OUT,f"forecast_ledger_{target}.csv")
    if os.path.exists(path):
        old=pd.read_csv(path); led=pd.concat([old[~old.pick_id.isin(led.pick_id)],led],ignore_index=True)
    led.to_csv(path,index=False); return led,path

def grade(m, target):
    """Fill result + CLV for finished games in the ledger."""
    path=os.path.join(OUT,f"forecast_ledger_{target}.csv")
    led=pd.read_csv(path); res=m[m.season==target][["home_ab","away_ab","actual_margin","actual_total"]]
    led["away_ab"]=led.game.str.split("@").str[0]; led["home_ab"]=led.game.str.split("@").str[1]
    led=led.merge(res,on=["home_ab","away_ab"],how="left")
    def grade_row(r):
        if pd.isna(r.actual_margin): return pd.Series([np.nan,np.nan,np.nan])
        if r.market=="spread":
            home_cov=r.actual_margin+r.open_num>0; push=r.actual_margin+r.open_num==0
            win=home_cov if r.bet_home==1 else (not home_cov)
            clv=(r.open_num-r.close_num) if r.bet_home==1 else (r.close_num-r.open_num)  # +=line moved our way
        else:
            over=r.actual_total>r.open_num; push=r.actual_total==r.open_num
            if r.bet_home==-1: win=over;  clv=r.close_num-r.open_num     # OVER: total rising = our way
            else:              win=not over; clv=r.open_num-r.close_num   # UNDER: total falling = our way
        if push: return pd.Series([np.nan,clv,0.0])
        return pd.Series([1.0 if win else 0.0, clv, (100/110 if win else -1.0)])
    led[["win","clv_pts","roi_u"]]=led.apply(grade_row,axis=1)
    led.to_csv(path,index=False); return led

def report(target):
    path=os.path.join(OUT,f"forecast_ledger_{target}.csv"); led=pd.read_csv(path)
    g=led.dropna(subset=["win"])
    L(f"\n{'='*78}\nFORWARD-TEST REPORT {target}  (graded picks: {len(g)} / logged: {len(led)})\n{'='*78}")
    for rule in ["sides_model","receiver_over","receiver_over_HC","wind_under","ALL"]:
        s=g if rule=="ALL" else g[g.rule==rule]
        if len(s)==0: L(f"  {rule:18s}: (none yet)"); continue
        k=int(s.win.sum()); n=len(s); lo,hi=wilson_ci(k,n); clv=s.clv_pts.mean(); roi=s.roi_u.sum()/n*100
        L(f"  {rule:18s}: {k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}% CLV={clv:+.2f}pts")
    L(f"  {'-'*60}\n  total units: {g.roi_u.sum():+.1f} on {len(g)} bets")

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--dry-run",type=int); ap.add_argument("--season",type=int); ap.add_argument("--week",type=int)
    ap.add_argument("--grade",type=int); ap.add_argument("--report",type=int)
    a=ap.parse_args()
    if a.dry_run:
        m,BASE=build(); led,path=generate(m,BASE,a.dry_run); grade(m,a.dry_run); report(a.dry_run)
        L(f"\n[dry-run] ledger written to {path}")
    elif a.season:
        m,BASE=build(); led,path=generate(m,BASE,a.season,a.week)
        L(f"[generate] {len(led)} picks logged for {a.season}" + (f" week {a.week}" if a.week else "") + f" -> {path}")
    elif a.grade:
        m,BASE=build(); grade(m,a.grade); report(a.grade)
    elif a.report: report(a.report)
    else: ap.print_help()
