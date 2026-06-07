"""
2026 FORWARD-TEST HARNESS — freezes the locked assets and produces a weekly pick ledger with CLV tracking.

Locked assets (see LOCKED_MODELS.md):
  SIDES   : walk-forward HistGBM on home_cover (vs close); bet the confident side (|p-.5|>=.03) vs the OPENER.
            Feature set = b14 "base" (Madden-independent so it runs before Aug-2026 launch ratings exist).
  TOTALS  : spot alerts (slate-level totals live in consensus_totals.py):
            * key WR/TE out (NGS air-share>=35%) -> OVER ; high-conviction tier adds Madden OVR>=80
            * wind >= 15mph -> UNDER
            * total_low_line_over: both teams' total_miss_sum_last3 <=-8 AND line >=+2 vs avg -> OVER (b62, 68% n=25)
            * total_high_line_under: sum_last3 >=4 AND line <=-2 vs avg -> UNDER (b62, 55% n=200+)
            * spread_dog_cover_fade_away / fade_home (b62, 63-70% n=10-11 small but suggestive)
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
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data")
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"out"); L=print
CONF=0.03; AIR_THR=35.0; OVR_THR=80.0; WIND_THR=15.0
REG_EDGE=1.5   # regression-margin edge (points) for confluence; magnitude that historically tracks classification conf=.03
FADE_HI=0.80; FADE_LO=0.20   # legacy-model fade: >=.80 (model loves home) -> bet away; <=.20 -> bet home
BYE_GAP=15.0; BYE_MIN_N=5    # bye-collision: bet the coach w/ better career pre/post-bye ATS% if gap>=15 & both n>=5
# TRACKING-ONLY rules: still fire and grade, but NOT presented as active bet flags on the website.
# Demoted because 2025 per-season performance regressed sharply (variance OR market adaptation).
# 2026 live data will determine whether to promote (revert) or remove.
TRACKING_ONLY={"bye_collision","week1_def_under","primetime_tight_favorite","primetime_tight_under","bot_vs_bot_under"}
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}

# 2-team 6pt teaser product (b71-b74, vaulted 2026-06-01)
# Eligible rules = those whose 6-pt teased hit rate >= 78% historically (b73 validation 2024+2025).
# sides_model is eligible ONLY when confluence=1 (regression-layer agreement).
TEASER_RULES = {"receiver_over_HC","top_vs_top_pt_home","legacy_fade","fade_pr_in_tight_game"}
TEASER_SHARP_LOOKBACK = 2   # use prior 2 seasons to compute team Vegas-sharpness
TEASER_SHARP_PCT = 0.50     # max_sharp threshold = league 50th percentile (both teams in sharper half)

# CFB-replication survivor picks (b77-b83, vaulted 2026-06-07). Two independent UNDER signals:
#   S1: cross-book total gap (microstructure) — sharp/soft books disagree, bet UNDER at soft
#   S2: both teams' season-to-date over-rate >=60% AND mid-band total (42-46.5) → UNDER
# TIER 1 (high conviction): late line move CONTRADICTS the pick direction. NFL specific finding:
#   contradicting late move = market overshoot, pick hits 65% vs 53% when move agrees (b83).
CFB_REPL_BUCKET_BAND = (42.0, 46.5)   # S2 mid-band constraint (b78 confound passes here)
CFB_REPL_PRIOR_OR = 0.60              # S2: both teams need >=60% prior over-rate
CFB_REPL_GAP_THR = 0.5                # S1: soft - sharp total gap threshold

def load_dk_open(target):
    """Load DraftKings OPENING-line snapshot per game for target season. Used by dk_giant_fav_over
    and dk_heavy_home_juice spots (b63). Trigger AT OPEN + bet AT OPEN = honest, no CLV inflation.
    Returns empty df if odds_hist missing — spots just don't fire."""
    hp=os.path.join(DATA,"odds_hist.parquet")
    if not os.path.exists(hp): return pd.DataFrame(columns=["season","home_ab","away_ab"])
    o=pd.read_parquet(hp)
    dk=o[o.book=="draftkings"].copy()
    if len(dk)==0: return pd.DataFrame(columns=["season","home_ab","away_ab"])
    dk["snap_ts"]=pd.to_datetime(dk.snap_ts,errors="coerce",utc=True)
    dk["commence_time"]=pd.to_datetime(dk.commence_time,errors="coerce",utc=True)
    dk=dk.dropna(subset=["snap_ts","commence_time"])
    dk=dk[dk.snap_ts<=dk.commence_time]
    dk_close=dk.sort_values("snap_ts").drop_duplicates(["season","home_team","away_team","commence_time"],keep="first")
    TM={'Arizona':'ARI','Atlanta':'ATL','Baltimore':'BAL','Buffalo':'BUF','Carolina':'CAR','Chicago':'CHI','Cincinnati':'CIN','Cleveland':'CLE','Dallas':'DAL','Denver':'DEN','Detroit':'DET','Green Bay':'GB','Houston':'HOU','Indianapolis':'IND','Jacksonville':'JAX','Kansas City':'KC','Los Angeles Chargers':'LAC','Los Angeles Rams':'LAR','Las Vegas':'LV','Miami':'MIA','Minnesota':'MIN','New England':'NE','New Orleans':'NO','New York Giants':'NYG','New York Jets':'NYJ','Philadelphia':'PHI','Pittsburgh':'PIT','San Francisco':'SF','Seattle':'SEA','Tampa Bay':'TB','Tennessee':'TEN','Washington':'WAS'}
    dk_close["home_ab"]=dk_close.home_team.map(TM); dk_close["away_ab"]=dk_close.away_team.map(TM)
    out=dk_close[dk_close.season==target][["season","home_ab","away_ab","commence_time","spread_home","spread_home_price","ml_home","ml_away"]].rename(
        columns={"spread_home":"dk_spread","spread_home_price":"dk_juice","ml_home":"dk_ml_home","ml_away":"dk_ml_away"})
    # de-dupe to one row per (season,home,away) — keep earliest (regular season before playoffs)
    out=out.sort_values("commence_time").drop_duplicates(["season","home_ab","away_ab"],keep="first").drop(columns=["commence_time"])
    return out.dropna(subset=["home_ab","away_ab"])

def build_spread_lookup():
    """Empirical spread -> SU favorite win rate (b63 lookup table)."""
    m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
    m["am"]=m.home_score-m.away_score
    m["fav_won"]=((m.home_spread<0)&(m.am>0))|((m.home_spread>0)&(m.am<0))
    m["sp_b"]=(m.home_spread.abs()/0.5).round()*0.5
    return dict(zip(m.groupby("sp_b").fav_won.mean().index, m.groupby("sp_b").fav_won.mean().values))

def load_legacy():
    """Legacy EPA model's spread cover prob per game (earliest=pregame snapshot). Empty -> legacy rules just don't fire.
    Pulled FRESH each run so 2026 weekly use picks up new predictions from nfl_predictions_epa."""
    try:
        from fetch import fetch_table
        leg=fetch_table("nfl_predictions_epa", select="unique_id,home_away_spread_cover_prob,as_of_ts")
        if leg is None or len(leg)==0: return pd.DataFrame(columns=["unique_id","leg_sp"])
        leg["leg_sp"]=pd.to_numeric(leg.home_away_spread_cover_prob,errors="coerce")
        leg["as_of_ts"]=pd.to_datetime(leg.as_of_ts,errors="coerce",utc=True)
        leg=leg.sort_values("as_of_ts").groupby("unique_id",as_index=False).first()
        return leg[["unique_id","leg_sp"]]
    except Exception as e:
        print(f"  ! legacy preds unavailable ({e}); legacy rules disabled"); return pd.DataFrame(columns=["unique_id","leg_sp"])

def load_bye_collisions(target, gap_thr=BYE_GAP, min_n=BYE_MIN_N):
    """Bye-collision signal for target season: coach career pre/post-bye ATS% from seasons < target (walk-forward
    boundary), applied to the target schedule's bye-spot collisions. Fires when gap>=gap_thr & both coaches n>=min_n.
    Bets the better-record coach's team ATS. Empty if data missing -> rule just doesn't fire."""
    gp=os.path.join(DATA,"nflverse_games.parquet")
    if not os.path.exists(gp): return pd.DataFrame(columns=["season","home_ab","away_ab"])
    g=pd.read_parquet(gp); g=g[g.game_type=="REG"].copy()
    def teamgames(df, cover):
        h=df[["season","week","home_team","home_coach"]].rename(columns={"home_team":"team","home_coach":"coach"})
        h["line"]=df.spread_line; h["margin"]=(df.home_score-df.away_score) if cover else np.nan
        a=df[["season","week","away_team","away_coach"]].rename(columns={"away_team":"team","away_coach":"coach"})
        a["line"]=-df.spread_line; a["margin"]=(df.away_score-df.home_score) if cover else np.nan
        return pd.concat([h,a],ignore_index=True)
    def add_spot(t):
        def bw(wk):
            wk=set(wk)
            for w in range(min(wk),max(wk)+1):
                if w not in wk: return w
            return None
        bye=t.groupby(["season","team"]).week.apply(lambda s:bw(s.tolist())).rename("bye").reset_index()
        t=t.merge(bye,on=["season","team"],how="left")
        t["spot"]=np.where(t.week==t.bye-1,"pre",np.where(t.week==t.bye+1,"post",None)); return t
    prior=g[g.season<target].dropna(subset=["home_score","away_score","spread_line"])
    if len(prior)<200: return pd.DataFrame(columns=["season","home_ab","away_ab"])
    pt=add_spot(teamgames(prior,True)); pt["cover"]=np.where(pt.margin>pt.line,1.0,np.where(pt.margin<pt.line,0.0,np.nan))
    ps=pt[pt.spot.notna()].dropna(subset=["cover"]); agg=ps.groupby(["coach","spot"]).cover.agg(p="mean",c="size")
    pct={idx:(r.p*100,int(r.c)) for idx,r in agg.iterrows()}
    tgt=g[(g.season==target)&g.spread_line.notna()]
    if len(tgt)==0: return pd.DataFrame(columns=["season","home_ab","away_ab"])
    spotmap={(r.season,r.week,r.team):r.spot for _,r in add_spot(teamgames(tgt,False)).iterrows() if r.spot is not None}
    out=[]
    for _,r in tgt.iterrows():
        hs=spotmap.get((r.season,r.week,r.home_team)); az=spotmap.get((r.season,r.week,r.away_team))
        if hs is None or az is None: continue
        hp=pct.get((r.home_coach,hs)); ap=pct.get((r.away_coach,az))
        if not hp or not ap or hp[1]<min_n or ap[1]<min_n or abs(hp[0]-ap[0])<gap_thr: continue
        eh=hp[0]>=ap[0]
        out.append(dict(season=int(r.season),home_ab=nv2our.get(r.home_team,r.home_team),away_ab=nv2our.get(r.away_team,r.away_team),
            bye_edge_home=int(eh),bye_gap=round(abs(hp[0]-ap[0]),1),bye_edge_coach=(r.home_coach if eh else r.away_coach)))
    return pd.DataFrame(out)

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
    # ---- legacy EPA model spread prob (for fade + primetime-follow rules) ----
    leg=load_legacy()
    m=m.merge(leg,on="unique_id",how="left") if len(leg) else m.assign(leg_sp=np.nan)
    # ---- Week-1 Madden team off/def ratings (PRESEASON expected starters by OVR; forward-usable at bet time) ----
    if mad is not None and len(mad):
        NICK={'49ers':'SF','cardinals':'ARI','falcons':'ATL','ravens':'BAL','bills':'BUF','panthers':'CAR','bears':'CHI',
         'bengals':'CIN','browns':'CLE','cowboys':'DAL','broncos':'DEN','lions':'DET','packers':'GB','texans':'HOU',
         'colts':'IND','jaguars':'JAX','chiefs':'KC','chargers':'LAC','rams':'LAR','dolphins':'MIA','vikings':'MIN',
         'patriots':'NE','saints':'NO','giants':'NYG','jets':'NYJ','eagles':'PHI','steelers':'PIT','seahawks':'SEA',
         'buccaneers':'TB','titans':'TEN','commanders':'WAS','redskins':'WAS','team':'WAS'}
        def _ab(t,s):
            tok=str(t).split(); last=tok[-1].lower() if tok else ''
            return ('OAK' if s<=2019 else 'LV') if last=='raiders' else NICK.get(last)
        mm=mad[mad.status=="matched"].copy(); mm["ab"]=[_ab(t,s) for t,s in zip(mm.team,mm.season)]; mm=mm.dropna(subset=["ab"])
        OFFP={'QB','HB','FB','WR','TE','LT','LG','C','RG','RT'}; DEFP={'LE','RE','DT','NT','LOLB','MLB','ROLB','CB','FS','SS'}
        offr=mm[mm.pos.isin(OFFP)].sort_values("ovr",ascending=False).groupby(["season","ab"]).head(11).groupby(["season","ab"]).ovr.mean().rename("off_rtg")
        defr=mm[mm.pos.isin(DEFP)].sort_values("ovr",ascending=False).groupby(["season","ab"]).head(11).groupby(["season","ab"]).ovr.mean().rename("def_rtg")
        rr=pd.concat([offr,defr],axis=1).reset_index()
        for side in ["home","away"]:
            m=m.merge(rr.rename(columns={"ab":f"{side}_ab","off_rtg":f"{side}_off_rtg","def_rtg":f"{side}_def_rtg"}),on=["season",f"{side}_ab"],how="left")
        m["o_minus_d"]=(m.home_off_rtg-m.away_def_rtg)+(m.away_off_rtg-m.home_def_rtg)  # high=offenses favored, low=defenses dominate
    else:
        m["o_minus_d"]=np.nan
    # ---- PR TIER classification (within-season percentile, for b66 spots) ----
    m["h_pr_pct"]=m.groupby("season").home_predictive_pr.rank(pct=True)
    m["a_pr_pct"]=m.groupby("season").away_predictive_pr.rank(pct=True)
    m["h_tier"]=pd.cut(m.h_pr_pct,bins=[0,0.33,0.67,1.01],labels=["bot","mid","top"]).astype(str)
    m["a_tier"]=pd.cut(m.a_pr_pct,bins=[0,0.33,0.67,1.01],labels=["bot","mid","top"]).astype(str)
    # ---- ROLLING TEAM-vs-LINE MISS (b61/b62 trap-fade spots) ----
    # team_total_miss = actual_team_pts - implied_team_total; team_margin_miss = actual_margin + team_spread
    mb=m.copy()
    mb["h_implied"]=(mb.nv_total_line - mb.home_spread)/2; mb["a_implied"]=(mb.nv_total_line + mb.home_spread)/2
    mb["h_total_miss"]=mb.home_score - mb.h_implied; mb["a_total_miss"]=mb.away_score - mb.a_implied
    mb["h_margin_miss"]=mb.actual_margin + mb.home_spread; mb["a_margin_miss"]=-(mb.actual_margin + mb.home_spread)
    h=mb[["season","week","home_ab","h_total_miss","h_margin_miss"]].rename(columns={"home_ab":"team","h_total_miss":"total_miss","h_margin_miss":"margin_miss"})
    a=mb[["season","week","away_ab","a_total_miss","a_margin_miss"]].rename(columns={"away_ab":"team","a_total_miss":"total_miss","a_margin_miss":"margin_miss"})
    tgm=pd.concat([h,a],ignore_index=True).sort_values(["team","season","week"]).reset_index(drop=True)
    for col in ["total_miss","margin_miss"]:
        tgm[f"{col}_s2d"]=tgm.groupby(["team","season"])[col].transform(lambda s:s.shift(1).expanding().mean())
        tgm[f"{col}_last3"]=tgm.groupby(["team","season"])[col].transform(lambda s:s.shift(1).rolling(3,min_periods=1).mean())
    roll_cols=["total_miss_s2d","total_miss_last3","margin_miss_s2d","margin_miss_last3"]
    for side,p in [("home","h_"),("away","a_")]:
        sub=tgm[["season","week","team"]+roll_cols].rename(columns={"team":f"{side}_ab",**{c:f"{p}{c}" for c in roll_cols}})
        m=m.merge(sub,on=["season","week",f"{side}_ab"],how="left")
    m["total_miss_sum_last3"]=m.h_total_miss_last3 + m.a_total_miss_last3
    # league avg total per season for "line vs avg" trap detection
    league_tot=m.groupby("season").nv_total_line.transform("mean")
    m["line_vs_league"]=m.nv_total_line - league_tot
    return m, BASE

def load_team_sharpness(target, lookback=TEASER_SHARP_LOOKBACK):
    """Compute per-team Vegas-line sharpness from PRIOR seasons only (walk-forward, no leak).
    Returns DataFrame indexed by team with sharp_spread, sharp_total (lower = sharper line).
    Used by generate_teasers() — see b74 vault for derivation."""
    ma = pd.read_parquet(os.path.join(DATA,"matchup_arch.parquet"))
    ma["actual_margin"] = ma.home_score - ma.away_score
    ma["actual_total"]  = ma.home_score + ma.away_score
    ma["spread_err"]    = (ma.actual_margin - (-ma.home_spread)).abs()
    ma["total_err"]     = (ma.actual_total - ma.ou_vegas_line).abs()
    prior = ma[(ma.season>=target-lookback) & (ma.season<target)]
    if len(prior)==0: return pd.DataFrame(columns=["team","sharp_spread","sharp_total","n"])
    home = prior[["season","week","home_ab","spread_err","total_err"]].rename(columns={"home_ab":"team"})
    away = prior[["season","week","away_ab","spread_err","total_err"]].rename(columns={"away_ab":"team"})
    tg = pd.concat([home,away], ignore_index=True)
    return tg.groupby("team").agg(n=("spread_err","count"),
                                  sharp_spread=("spread_err","mean"),
                                  sharp_total=("total_err","mean")).reset_index()

def build_teaser_buckets(target, min_n=15):
    """Walk-forward 6-pt teaser bucket hit rates from matchup_arch (seasons < target only).
    Returns 4 dicts keyed by exact line value: HOME, AWAY, OVER, UNDER → (hit_pct, lo_ci, n).
    See b75/b75b for the empirical derivation — these are the structural edges (e.g. HOME +4
    teased to +10 hits ~93% historically, AWAY -2 teased to +4 hits ~86%)."""
    ma = pd.read_parquet(os.path.join(DATA,"matchup_arch.parquet"))
    od = pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
    ma["actual_margin"] = ma.home_score - ma.away_score
    ma["actual_total"]  = ma.home_score + ma.away_score
    hist = ma.merge(od[["season","home_ab","away_ab","open_spread","open_total"]],
                    on=["season","home_ab","away_ab"], how="left")
    hist["spread"] = hist.open_spread.fillna(hist.home_spread)
    hist["total"]  = hist.open_total.fillna(hist.ou_vegas_line)
    hist = hist[(hist.season<target) & hist.spread.notna() & hist.total.notna()].copy()
    hist["spread_r"] = (hist.spread*2).round()/2
    hist["total_r"]  = (hist.total*2).round()/2
    # 4 teaser outcomes per game
    hist["h"] = (hist.actual_margin + hist.spread + 6 > 0).astype(float)
    hist.loc[hist.actual_margin + hist.spread + 6 == 0, "h"] = np.nan
    hist["a"] = (hist.actual_margin + hist.spread - 6 < 0).astype(float)
    hist.loc[hist.actual_margin + hist.spread - 6 == 0, "a"] = np.nan
    hist["o"] = (hist.actual_total > hist.total - 6).astype(float)
    hist.loc[hist.actual_total == hist.total - 6, "o"] = np.nan
    hist["u"] = (hist.actual_total < hist.total + 6).astype(float)
    hist.loc[hist.actual_total == hist.total + 6, "u"] = np.nan
    def bucket(df, key, col):
        out={}
        for v in sorted(df[key].unique()):
            w = df[df[key]==v][col].dropna()
            if len(w)<min_n: continue
            n=len(w); k=int(w.sum()); lo,hi = wilson_ci(k,n)
            out[v] = (k/n, lo, n)
        return out
    return bucket(hist,"spread_r","h"), bucket(hist,"spread_r","a"), bucket(hist,"total_r","o"), bucket(hist,"total_r","u")

# Teaser combined-score weights — bucket history is the primary signal, with model + sharpness as bonuses
TEASER_BUCKET_MIN = 0.74     # eligibility: bucket historical hit must clear this (~-110 BE pool)
TEASER_SIG_BONUS  = 0.05     # bonus for a signal pick on this side
TEASER_SHRP_BONUS = 0.03     # bonus for both teams in sharper half of league

def generate_teasers(target, week=None):
    """COMBINED teaser strategy (b76, vaulted 2026-06-01) — replaces the prior signal-only approach.
    Every game on the slate is evaluated through 3 lenses for each of its 4 possible legs
    (HOME spread tease, AWAY spread tease, OVER total tease, UNDER total tease):
      bucket_p  : historical 6-pt teaser hit % for this EXACT line value, walk-forward only
      signal_ok : 1 if any TEASER_RULES pick (or sides_model confluence=1) fires on this side
      sharp_ok  : 1 if matchup avg Vegas-error in prior 2 seasons <= league median for that market
    combined_score = bucket_p + 0.05*signal_ok + 0.03*sharp_ok
    Eligibility: bucket_p >= 0.74 AND (signal_ok OR sharp_ok). Take top 2 distinct games per week.
    See LOCKED_MODELS.md §4 for the b75/b75b/b76 derivation and honest 2024+2025 backtest."""
    HOME, AWAY, OVER, UNDER = build_teaser_buckets(target)
    if len(HOME)==0: L(f"[teasers] no historical buckets for target={target}"); return None,None
    sharp = load_team_sharpness(target)
    if len(sharp)==0: L(f"[teasers] no prior-season sharpness for {target}"); return None,None
    SHARP_S = dict(zip(sharp.team, sharp.sharp_spread))
    SHARP_T = dict(zip(sharp.team, sharp.sharp_total))
    # League medians for sharpness qualification (cuts on the prior-2-seasons pool, NOT target year)
    med_s = float(np.median(list(SHARP_S.values())))
    med_t = float(np.median(list(SHARP_T.values())))

    # Signal-eligible side selections from the harness pick ledger
    led_path = os.path.join(OUT, f"forecast_ledger_{target}.csv")
    sig=set()
    if os.path.exists(led_path):
        led_picks = pd.read_csv(led_path)
        for _,r in led_picks.iterrows():
            if not (r.rule in TEASER_RULES or (r.rule=="sides_model" and r.get("confluence",0)==1)): continue
            if r.market=="spread":
                side = "HOME" if r.bet_home==1 else "AWAY"
            else:
                side = "OVER" if r.bet_home==-1 else "UNDER"
            ab_away, ab_home = r.game.split("@")
            sig.add((int(r.season), int(r.week), ab_home, ab_away, r.market, side))

    # Build target slate: every game with opening spread + total
    od = pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
    ma = pd.read_parquet(os.path.join(DATA,"matchup_arch.parquet"))
    slate = ma[ma.season==target].merge(
        od[["season","home_ab","away_ab","open_spread","open_total","close_spread","close_total"]],
        on=["season","home_ab","away_ab"], how="left")
    slate = slate.dropna(subset=["open_spread","open_total"]).copy()
    if week is not None: slate = slate[slate.week==week]

    def round_half(x): return round(x*2)/2

    legs=[]
    for _,g in slate.iterrows():
        sp = round_half(g.open_spread); tt = round_half(g.open_total)
        sharp_spread = np.nanmean([SHARP_S.get(g.home_ab,np.nan), SHARP_S.get(g.away_ab,np.nan)])
        sharp_total  = np.nanmean([SHARP_T.get(g.home_ab,np.nan), SHARP_T.get(g.away_ab,np.nan)])
        # 4 candidate legs
        # bet_home convention preserved: 1=HOME spread, 0=AWAY spread, -1=OVER, -2=UNDER
        candidates = [
            ("HOME","spread",sp,HOME, g.open_spread+6, sharp_spread, med_s, 1),
            ("AWAY","spread",sp,AWAY, g.open_spread-6, sharp_spread, med_s, 0),
            ("OVER","total", tt,OVER, g.open_total-6,  sharp_total,  med_t,-1),
            ("UNDER","total",tt,UNDER,g.open_total+6,  sharp_total,  med_t,-2),
        ]
        for side, market, line, lookup, teased, sharp_val, med, bet_home in candidates:
            if line not in lookup: continue
            bucket_p, bucket_lo, bucket_n = lookup[line]
            if bucket_p < TEASER_BUCKET_MIN: continue
            signal_ok = int((target, int(g.week), g.home_ab, g.away_ab, market, side) in sig)
            sharp_ok  = int(pd.notna(sharp_val) and sharp_val <= med)
            if signal_ok==0 and sharp_ok==0: continue   # need at least one confirmation
            score = bucket_p + TEASER_SIG_BONUS*signal_ok + TEASER_SHRP_BONUS*sharp_ok
            # Side string consistent with pick ledger format
            if market=="spread":
                disp = f"{g.home_ab} {g.open_spread:+g}" if side=="HOME" else f"{g.away_ab} {-g.open_spread:+g}"
            else:
                disp = f"{side} {g.open_total:g}"
            legs.append({"season":int(target),"week":int(g.week),"home_ab":g.home_ab,"away_ab":g.away_ab,
                         "side":side,"market":market,"line":line,"teased":teased,
                         "bucket_p":round(bucket_p,3),"bucket_n":bucket_n,
                         "signal_ok":signal_ok,"sharp_ok":sharp_ok,
                         "matchup_sharp":round(float(sharp_val),2) if pd.notna(sharp_val) else None,
                         "score":round(score,4),"bet_home":bet_home,"display":disp})
    if not legs:
        L(f"[teasers] no eligible legs for {target}"); return None,None
    ldf = pd.DataFrame(legs)

    # Top-2 distinct games per week by combined score
    rows=[]
    for (sea,wk), grp in ldf.groupby(["season","week"]):
        grp = grp.sort_values("score", ascending=False)
        seen=set(); top=[]
        for _,r in grp.iterrows():
            gid = (r.home_ab, r.away_ab)
            if gid in seen: continue
            seen.add(gid); top.append(r)
            if len(top)==2: break
        if len(top)<2: continue
        l1,l2 = top
        rows.append({
            "teaser_id": f"{sea}-W{int(wk):02d}-T2",
            "season":int(sea),"week":int(wk),
            "leg1_game":f"{l1.away_ab}@{l1.home_ab}","leg1_market":l1.market,"leg1_side":l1.display,
            "leg1_open":l1.line,"leg1_teased":l1.teased,
            "leg1_bucket":l1.bucket_p,"leg1_signal":int(l1.signal_ok),"leg1_sharp":int(l1.sharp_ok),
            "leg1_score":l1.score,
            "leg2_game":f"{l2.away_ab}@{l2.home_ab}","leg2_market":l2.market,"leg2_side":l2.display,
            "leg2_open":l2.line,"leg2_teased":l2.teased,
            "leg2_bucket":l2.bucket_p,"leg2_signal":int(l2.signal_ok),"leg2_sharp":int(l2.sharp_ok),
            "leg2_score":l2.score,
            "combo":"+".join(sorted([l1.market, l2.market])),
        })
    out_df = pd.DataFrame(rows)
    out_path = os.path.join(OUT, f"teaser_ledger_{target}.csv")
    out_df.to_csv(out_path, index=False)
    L(f"[teasers] {len(out_df)} 2-team teasers logged -> {out_path}")
    return out_df, out_path

def grade_teasers(m, target):
    """Grade the combined teaser ledger. Each leg vs its teased line; both legs must hit. Push
    handling (rare on 6-pt): both-push → void; one-push → demote to single straight bet at -110."""
    path = os.path.join(OUT, f"teaser_ledger_{target}.csv")
    if not os.path.exists(path): L(f"[grade_teasers] no ledger at {path}"); return None
    led = pd.read_csv(path)
    if len(led)==0: return led
    res = m[["season","week","home_ab","away_ab","home_score","away_score"]].dropna(subset=["home_score","away_score"]).copy()
    res["actual_margin"] = res.home_score - res.away_score
    res["actual_total"]  = res.home_score + res.away_score

    def grade_leg(season, week, game, market, teased, side_disp):
        # Match by (season, week, home_ab, away_ab) — divisional matchups recur with same
        # home/away pair every year, so we MUST filter by season+week. Earlier version missed
        # this and silently graded against the wrong game's outcome (b76 vs harness divergence).
        ab_away, ab_home = game.split("@")
        r = res[(res.season==season)&(res.week==week)&(res.home_ab==ab_home)&(res.away_ab==ab_away)]
        if len(r)==0: return (np.nan, np.nan)
        r = r.iloc[0]
        if market=="spread":
            home_pick = side_disp.startswith(ab_home)
            if home_pick:
                if r.actual_margin + teased == 0: return (np.nan, r.actual_margin)
                return (int(r.actual_margin + teased > 0), r.actual_margin)
            else:
                if r.actual_margin + teased == 0: return (np.nan, r.actual_margin)
                return (int(r.actual_margin + teased < 0), r.actual_margin)
        else:
            over = side_disp.startswith("OVER")
            if r.actual_total == teased: return (np.nan, r.actual_total)
            return (int((r.actual_total > teased) if over else (r.actual_total < teased)), r.actual_total)

    led[["leg1_win","leg1_outcome"]] = led.apply(
        lambda r: pd.Series(grade_leg(r.season, r.week, r.leg1_game, r.leg1_market, r.leg1_teased, r.leg1_side)), axis=1)
    led[["leg2_win","leg2_outcome"]] = led.apply(
        lambda r: pd.Series(grade_leg(r.season, r.week, r.leg2_game, r.leg2_market, r.leg2_teased, r.leg2_side)), axis=1)

    def joint(r):
        if pd.isna(r.leg1_win) and pd.isna(r.leg2_win): return ("void",0.0,np.nan)
        if pd.isna(r.leg1_win): return ("push1", (100/110 if r.leg2_win==1 else -1.0), float(r.leg2_win))
        if pd.isna(r.leg2_win): return ("push1", (100/110 if r.leg1_win==1 else -1.0), float(r.leg1_win))
        both = int(r.leg1_win==1 and r.leg2_win==1)
        return ("graded", (100/120) if both else -1.0, float(both))
    led[["status","pnl_120","both"]] = led.apply(lambda r: pd.Series(joint(r)), axis=1)
    led["pnl_110"] = np.where(led.status=="graded",
        np.where(led.both==1, 100/110, -1.0),
        led.pnl_120)
    led.to_csv(path, index=False)
    return led

def _cfb_team_map():
    return {"Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR","Chicago":"CHI",
            "Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN","Detroit":"DET","Green Bay":"GB",
            "Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX","Kansas City":"KC","Las Vegas":"LV",
            "Los Angeles Chargers":"LAC","Los Angeles Rams":"LAR","LA Chargers":"LAC","LA Rams":"LAR",
            "Miami":"MIA","Minnesota":"MIN","New England":"NE","New Orleans":"NO",
            "New York Giants":"NYG","New York Jets":"NYJ","NY Giants":"NYG","NY Jets":"NYJ",
            "Philadelphia":"PHI","Pittsburgh":"PIT","San Francisco":"SF","Seattle":"SEA","Tampa Bay":"TB",
            "Tennessee":"TEN","Washington":"WAS"}

def _book_sharpness_total(target):
    """Walk-forward per-book total-sharpness ranking from odds_hist (seasons<target only).
    Returns (sharp_books_set, soft_books_set) — top-3 sharps and bottom-3 softs per b77/b82."""
    oh = pd.read_parquet(os.path.join(DATA,"odds_hist.parquet"))
    ma = pd.read_parquet(os.path.join(DATA,"matchup_arch.parquet"))
    oh["snap_ts"] = pd.to_datetime(oh.snap_ts); oh["commence_time"] = pd.to_datetime(oh.commence_time)
    ma["actual_total"] = ma.home_score + ma.away_score
    coverage = oh.groupby("book").season.nunique()
    full = coverage[coverage>=3].index.tolist()
    oh = oh[oh.book.isin(full) & (oh.snap_ts<=oh.commence_time)].copy()
    oh = oh.sort_values("snap_ts").drop_duplicates(subset=["season","home_team","away_team","book"], keep="last")
    tm = _cfb_team_map()
    oh["home_ab"] = oh.home_team.map(tm); oh["away_ab"] = oh.away_team.map(tm)
    oh = oh.dropna(subset=["home_ab","away_ab"])
    oh = oh.merge(ma[["season","home_ab","away_ab","actual_total"]], on=["season","home_ab","away_ab"], how="inner")
    train = oh[oh.season<target]
    if len(train)==0: return set(), set(), None
    cons = train.groupby(["season","home_ab","away_ab"]).total_point.mean().rename("cons_total").reset_index()
    train = train.merge(cons, on=["season","home_ab","away_ab"])
    rows=[]
    for book in train.book.unique():
        sub = train[train.book==book]
        if len(sub)<50: continue
        sub = sub.copy(); sub["lean"] = sub.total_point-sub.cons_total; sub["resid"] = sub.actual_total-sub.cons_total
        c = sub[["lean","resid"]].corr().iloc[0,1]
        rows.append((book,c))
    rk = pd.DataFrame(rows, columns=["book","sharp"]).sort_values("sharp",ascending=False)
    return set(rk.head(3).book.tolist()), set(rk.tail(3).book.tolist()), oh

def generate_cfb_picks(target, week=None):
    """Generate Survivor #1 (cross-book total gap) + Survivor #2 (form mean-rev UNDER) picks
    for target season. Tags each with TIER (1 = high conviction when late line move contradicts;
    2 = standard). See LOCKED_MODELS.md §5 and b77-b83 for derivation.
    Writes out/cfb_repl_ledger_<target>.csv."""
    sharps, softs, oh = _book_sharpness_total(target)
    if oh is None: L(f"[cfb_picks] no training data for {target}"); return None,None
    od = pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
    ma = pd.read_parquet(os.path.join(DATA,"matchup_arch.parquet"))
    ma["actual_total"] = ma.home_score + ma.away_score

    # ---- S1: cross-book total gap ----
    tgt = oh[oh.season==target]
    s1_rows=[]
    for (sea,hm,aw), g in tgt.groupby(["season","home_ab","away_ab"]):
        s_in = g[g.book.isin(sharps)]; so_in = g[g.book.isin(softs)]
        if s_in.empty or so_in.empty: continue
        sp = s_in.total_point.mean(); so = so_in.total_point.mean()
        gap = so - sp
        if abs(gap) < CFB_REPL_GAP_THR: continue
        pick = "UNDER" if gap>0 else "OVER"
        s1_rows.append(dict(source="S1_cross_book", season=sea, home_ab=hm, away_ab=aw,
                            pick=pick, bet_line=so, open_total=g.total_point.iloc[0], gap=gap,
                            week=int(g.commence_time.iloc[0].isocalendar().week) if False else np.nan))
    s1_df = pd.DataFrame(s1_rows)

    # ---- S2: both teams over-hot, mid-band totals → UNDER ----
    ma2 = ma.merge(od[["season","home_ab","away_ab","open_total","close_total","total_move"]],
                   on=["season","home_ab","away_ab"], how="left")
    ma2["total_line"] = ma2.open_total.fillna(ma2.ou_vegas_line)
    ma2 = ma2.dropna(subset=["total_line","actual_total","week","season"]).copy()
    ma2["went_over"] = (ma2.actual_total > ma2.total_line).astype(int)
    ma2.loc[ma2.actual_total==ma2.total_line, "went_over"] = np.nan
    # As-of over-rate per team
    hr = ma2[["season","week","home_ab","went_over"]].rename(columns={"home_ab":"team"})
    ar = ma2[["season","week","away_ab","went_over"]].rename(columns={"away_ab":"team"})
    tg = pd.concat([hr,ar], ignore_index=True).sort_values(["season","team","week"])
    def asof(group):
        group = group.sort_values("week")
        cn = group.went_over.expanding().count().shift(1)
        co = group.went_over.expanding().sum().shift(1)
        group["prior_n"] = cn; group["prior_or"] = co/cn
        return group
    tg = tg.groupby(["season","team"], group_keys=False).apply(asof)
    m_y = ma2[ma2.season==target].copy()
    m_y = m_y.merge(tg[["season","week","team","prior_or","prior_n"]].rename(
        columns={"team":"home_ab","prior_or":"h_or","prior_n":"h_n"}), on=["season","week","home_ab"], how="left")
    m_y = m_y.merge(tg[["season","week","team","prior_or","prior_n"]].rename(
        columns={"team":"away_ab","prior_or":"a_or","prior_n":"a_n"}), on=["season","week","away_ab"], how="left")
    band_lo, band_hi = CFB_REPL_BUCKET_BAND
    qual = m_y[(m_y.h_n>=3) & (m_y.a_n>=3) &
               (m_y.h_or>=CFB_REPL_PRIOR_OR) & (m_y.a_or>=CFB_REPL_PRIOR_OR) &
               (m_y.total_line>=band_lo) & (m_y.total_line<=band_hi)].copy()
    s2_df = pd.DataFrame({"source":"S2_form_under_mid", "season":qual.season, "week":qual.week,
                          "home_ab":qual.home_ab, "away_ab":qual.away_ab, "pick":"UNDER",
                          "bet_line":qual.total_line, "open_total":qual.total_line,
                          "h_or":qual.h_or.round(3), "a_or":qual.a_or.round(3)})

    # Attach week + line movement to S1 from odds_consensus
    if len(s1_df):
        s1_df = s1_df.drop(columns=["week"], errors="ignore").merge(
            ma2[["season","week","home_ab","away_ab"]].drop_duplicates(),
            on=["season","home_ab","away_ab"], how="left")
        s1_df = s1_df.merge(od[["season","home_ab","away_ab","total_move","close_total"]],
                            on=["season","home_ab","away_ab"], how="left")

    # Add total_move to S2 (already merged via ma2)
    if len(s2_df):
        s2_df = s2_df.merge(od[["season","home_ab","away_ab","total_move","close_total"]],
                            on=["season","home_ab","away_ab"], how="left")

    # Combine + dedup + week filter + tier classification
    picks = pd.concat([s1_df, s2_df], ignore_index=True, sort=False)
    if week is not None and len(picks):
        picks = picks[picks.week==week]
    if len(picks)==0:
        L(f"[cfb_picks] no eligible picks for {target}"); return None,None
    # Drop conflicts: same game flagged for opposite picks
    picks = picks.sort_values(["season","week","home_ab","away_ab"])
    keep_idx=[]
    for (sea,hm,aw), g in picks.groupby(["season","home_ab","away_ab"]):
        if g.pick.nunique()>1: continue
        keep_idx.extend(g.index.tolist())
    picks = picks.loc[keep_idx].copy()
    # Tier classification per b83: contradicting late line move = TIER 1 (high conviction)
    picks["move_contradicts"] = ((picks.pick=="UNDER")&(picks.total_move>0)) | ((picks.pick=="OVER")&(picks.total_move<0))
    picks["tier"] = np.where(picks.move_contradicts, 1, 2)
    # Pick id
    picks["pick_id"] = picks.apply(lambda r: f"{int(r.season)}-W{int(r.week):02d}-{r.away_ab}@{r.home_ab}-{r.source[:2]}-{r.pick}", axis=1)

    out_cols = ["pick_id","season","week","home_ab","away_ab","source","pick","bet_line","open_total",
                "close_total","total_move","tier","move_contradicts"]
    out_cols = [c for c in out_cols if c in picks.columns]
    out_df = picks[out_cols].copy()
    out_path = os.path.join(OUT, f"cfb_repl_ledger_{target}.csv")
    out_df.to_csv(out_path, index=False)
    L(f"[cfb_picks] {len(out_df)} survivor picks logged -> {out_path}")
    L(f"  TIER 1 (move contradicts, high conv): {(out_df.tier==1).sum()}")
    L(f"  TIER 2 (move agrees/neutral):         {(out_df.tier==2).sum()}")
    return out_df, out_path

def grade_cfb_picks(m, target):
    """Grade the CFB-replication ledger. Filters by (season, week, home_ab, away_ab) to avoid
    the divisional-rematch bug we caught in grade_teasers."""
    path = os.path.join(OUT, f"cfb_repl_ledger_{target}.csv")
    if not os.path.exists(path): L(f"[grade_cfb] no ledger at {path}"); return None
    led = pd.read_csv(path)
    if len(led)==0: return led
    res = m[["season","week","home_ab","away_ab","home_score","away_score"]].dropna(subset=["home_score","away_score"]).copy()
    res["actual_total"] = res.home_score + res.away_score
    def grade(r):
        sub = res[(res.season==r.season)&(res.week==r.week)&(res.home_ab==r.home_ab)&(res.away_ab==r.away_ab)]
        if len(sub)==0: return (np.nan, np.nan)
        actual = sub.iloc[0].actual_total
        if actual == r.bet_line: return (np.nan, actual)   # push
        if r.pick=="UNDER":
            return (int(actual < r.bet_line), actual)
        return (int(actual > r.bet_line), actual)
    led[["won","actual_total"]] = led.apply(lambda r: pd.Series(grade(r)), axis=1)
    led["pnl_110"] = np.where(led.won.isna(), 0.0, np.where(led.won==1, 100/110, -1.0))
    led.to_csv(path, index=False); return led

def report_cfb_picks(target):
    """Per-tier and total summary of CFB-replication survivors."""
    path = os.path.join(OUT, f"cfb_repl_ledger_{target}.csv")
    if not os.path.exists(path): return
    led = pd.read_csv(path)
    if len(led)==0 or "won" not in led.columns: return
    g = led.dropna(subset=["won"])
    if len(g)==0: L(f"\nCFB-REPL REPORT {target}: {len(led)} picks, none graded yet"); return
    L(f"\n{'='*82}\nCFB-REPLICATION SURVIVOR REPORT {target} (graded: {len(g)} / logged: {len(led)})\n{'='*82}")
    n=len(g); k=int(g.won.sum()); lo,hi=wilson_ci(k,n)
    L(f"  ALL picks @ -110: {k}/{n}={k/n*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]  ROI={g.pnl_110.mean()*100:+.1f}%  units={g.pnl_110.sum():+.1f}")
    L(f"  By tier:")
    for tier_n, tier_name in [(1,"TIER 1 (late move contradicts — high conv)"),(2,"TIER 2 (move neutral/agrees)")]:
        sub = g[g.tier==tier_n]
        if len(sub)==0: L(f"    {tier_name}: (none)"); continue
        ksub=int(sub.won.sum()); nsub=len(sub); lo,hi=wilson_ci(ksub,nsub)
        L(f"    {tier_name}: n={nsub:2d} hit={ksub}/{nsub}={ksub/nsub*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={sub.pnl_110.mean()*100:+.1f}%")
    L(f"  By source:")
    for src in ["S1_cross_book","S2_form_under_mid"]:
        sub = g[g.source==src]
        if len(sub)==0: continue
        ksub=int(sub.won.sum()); nsub=len(sub); lo,hi=wilson_ci(ksub,nsub)
        L(f"    {src:24s}: n={nsub:2d} hit={ksub}/{nsub}={ksub/nsub*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={sub.pnl_110.mean()*100:+.1f}%")

def report_teasers(target):
    """Summary of 2-team teaser performance — printed alongside the standard pick report."""
    path = os.path.join(OUT, f"teaser_ledger_{target}.csv")
    if not os.path.exists(path): return
    led = pd.read_csv(path)
    if len(led)==0 or "status" not in led.columns: return
    g = led[led.status=="graded"]
    if len(g)==0:
        L(f"\nTEASER REPORT {target}: {len(led)} teasers logged, none graded yet"); return
    L(f"\n{'='*82}\n2-TEAM 6-PT TEASER REPORT {target}  (graded: {len(g)} / logged: {len(led)})\n{'='*82}")
    n=len(g); k=int(g.both.sum()); lo,hi=wilson_ci(k,n)
    L(f"  ALL teasers @ -120: {k}/{n}={k/n*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]  ROI={g.pnl_120.mean()*100:+.1f}%  units={g.pnl_120.sum():+.1f}")
    L(f"  ALL teasers @ -110: {k}/{n}={k/n*100:.1f}%                  ROI={g.pnl_110.mean()*100:+.1f}%  units={g.pnl_110.sum():+.1f}")
    L(f"  By market combo:")
    for combo in ["total+total","spread+total","spread+spread"]:
        c = g[g.combo==combo]
        if len(c)==0: L(f"    {combo:14s}: (none)"); continue
        kc=int(c.both.sum()); nc=len(c); lo,hi=wilson_ci(kc,nc)
        L(f"    {combo:14s}: n={nc:2d}  hit={kc}/{nc}={kc/nc*100:.1f}%  CI[{lo*100:.0f},{hi*100:.0f}]  ROI@-120={c.pnl_120.mean()*100:+.1f}%")
    L(f"  By confirmation profile:")
    for tag, mask in [("both legs signal=1",      (g.leg1_signal==1)&(g.leg2_signal==1)),
                      ("both legs sharp=1",       (g.leg1_sharp==1)&(g.leg2_sharp==1)),
                      ("at least one signal",     (g.leg1_signal==1)|(g.leg2_signal==1)),
                      ("at least one sharp",      (g.leg1_sharp==1)|(g.leg2_sharp==1))]:
        sub = g[mask]
        if len(sub)==0: continue
        kc=int(sub.both.sum()); nc=len(sub)
        L(f"    {tag:24s}: n={nc:2d}  hit={kc}/{nc}={kc/nc*100:.1f}%  ROI@-120={sub.pnl_120.mean()*100:+.1f}%")

def train_predict(m, BASE, target):
    """Train on all seasons < target, predict target. Returns target games with:
       - ph: P(home covers close) from classification model (primary sides signal)
       - pred_margin: predicted home margin from regression model (internal confirmation layer; b70)
    The regression model is NOT bet on directly — it provides confluence flag when its direction
    agrees with classification (~3pp hit-rate boost, ~+4pp ROI). See LOCKED_MODELS.md §1 + b70 vault.
    """
    tr=m[(m.season<target)&(m.week>=4)].dropna(subset=["home_cover"])
    clf=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr[BASE],tr.home_cover)
    # Regression model: same features, same train fold, target = actual_margin. Leak profile identical
    # to classification (see b70 audit) — uses BASE only, no betting lines added.
    tr_r=tr.dropna(subset=["actual_margin"])
    reg=HistGradientBoostingRegressor(max_depth=3,learning_rate=0.05,max_iter=300,l2_regularization=2.0,min_samples_leaf=40,random_state=0).fit(tr_r[BASE],tr_r.actual_margin)
    te=m[m.season==target].copy()
    te["ph"]=clf.predict_proba(te[BASE])[:,1]
    te["pred_margin"]=reg.predict(te[BASE])
    return te

def generate(m, BASE, target, week=None):
    """Produce ledger rows (picks logged at the OPENER) for target season (optionally one week)."""
    od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
    W1CUT=m[m.week==1].o_minus_d.quantile(0.33) if m.o_minus_d.notna().any() else None  # defense-dominant W1 cutoff
    te=train_predict(m,BASE,target)
    te=te.merge(od[["season","home_ab","away_ab","open_spread","open_total","close_spread","close_total","open_ml_home","open_ml_away","close_ml_home","close_ml_away"]],on=["season","home_ab","away_ab"],how="left")
    bc=load_bye_collisions(target)
    te=te.merge(bc,on=["season","home_ab","away_ab"],how="left") if len(bc) else te.assign(bye_edge_home=np.nan,bye_gap=np.nan)
    dk=load_dk_open(target); sp_lookup=build_spread_lookup()
    te=te.merge(dk,on=["season","home_ab","away_ab"],how="left") if len(dk) else te.assign(dk_spread=np.nan,dk_juice=np.nan,dk_ml_home=np.nan,dk_ml_away=np.nan)
    # Recompute line_vs_league using OPEN total (was using CLOSE total in build() — fixed per framework
    # rule: signal uses OPEN-line data when bet+grade are at OPEN)
    open_league=te.groupby("season").open_total.transform("mean")
    te["line_vs_league"]=te.open_total - open_league   # overrides the close-based version from build()
    def _ml_p(ml):
        if pd.isna(ml) or ml==0: return np.nan
        return -ml/(-ml+100) if ml<0 else 100/(ml+100)
    if week is not None: te=te[te.week==week]
    rows=[]
    for _,g in te.iterrows():
        gid=f"{g.season}-W{int(g.week):02d}-{g.away_ab}@{g.home_ab}"; mtchp=f"{g.away_ab}@{g.home_ab}"
        # SIDES (needs opener + confident model)
        # Regression model runs in parallel as INTERNAL confirmation layer (b70). When both classification
        # and regression agree on direction with |reg_edge|>=REG_EDGE, we flag confluence=1. UI uses this
        # as a confidence indicator but does NOT show the regression number directly to users.
        if pd.notna(g.open_spread) and pd.notna(g.ph) and abs(g.ph-0.5)>=CONF:
            home_pick=g.ph>=0.5+CONF
            # reg_edge = predicted home margin vs market expected home margin (-open_spread). +ve = model
            # expects home to outperform market. Confluence = clf says home & reg_edge>=+REG_EDGE, or vice versa.
            reg_edge=(g.pred_margin - (-g.open_spread)) if pd.notna(g.pred_margin) else np.nan
            if pd.notna(reg_edge):
                reg_picks_home = reg_edge >= REG_EDGE
                reg_picks_away = reg_edge <= -REG_EDGE
                confluence = int((home_pick and reg_picks_home) or ((not home_pick) and reg_picks_away))
            else:
                confluence = 0
            rows.append(dict(pick_id=gid+"-S",season=g.season,week=int(g.week),game=mtchp,rule="sides_model",
                market="spread",side=(f"{g.home_ab} {g.open_spread:+g}" if home_pick else f"{g.away_ab} {-g.open_spread:+g}"),
                bet_home=int(home_pick),open_num=g.open_spread,close_num=g.close_spread,edge=round(g.ph-0.5,3),
                confluence=confluence,reg_edge=round(float(reg_edge),2) if pd.notna(reg_edge) else None))
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
        # LEGACY spread signals (vs opener): primetime -> FOLLOW the model; non-primetime extreme -> FADE it
        lsp=g.get("leg_sp",np.nan)
        if pd.notna(lsp) and pd.notna(g.open_spread):
            if int(g.primetime_i)==1:                                  # FOLLOW legacy in primetime (61.8% in 2025)
                home_pick=lsp>=0.5
                rows.append(dict(pick_id=gid+"-LPT",season=g.season,week=int(g.week),game=mtchp,rule="legacy_primetime",
                    market="spread",side=(f"{g.home_ab} {g.open_spread:+g}" if home_pick else f"{g.away_ab} {-g.open_spread:+g}"),
                    bet_home=int(home_pick),open_num=g.open_spread,close_num=g.close_spread,edge=round(lsp-0.5,3)))
            elif lsp>=FADE_HI or lsp<=FADE_LO:                          # FADE legacy at non-primetime extremes (dose-response to 65%+)
                home_pick=lsp<=FADE_LO                                 # model loves away(<=.20)->bet home; loves home(>=.80)->bet away
                rows.append(dict(pick_id=gid+"-LF",season=g.season,week=int(g.week),game=mtchp,rule="legacy_fade",
                    market="spread",side=(f"{g.home_ab} {g.open_spread:+g}" if home_pick else f"{g.away_ab} {-g.open_spread:+g}"),
                    bet_home=int(home_pick),open_num=g.open_spread,close_num=g.close_spread,edge=round(abs(lsp-0.5),3)))
        # WEEK-1 WATCH: defenses out-class offenses -> UNDER (b35 ~60%, thin -> tracking flag only)
        omd=g.get("o_minus_d",np.nan)
        if int(g.week)==1 and W1CUT is not None and pd.notna(omd) and omd<=W1CUT and pd.notna(g.open_total):
            rows.append(dict(pick_id=gid+"-W1U",season=g.season,week=int(g.week),game=mtchp,rule="week1_def_under",
                market="total",side=f"UNDER {g.open_total:g}",bet_home=-2,open_num=g.open_total,close_num=g.close_total,edge=round(float(omd),1)))
        # BYE-COLLISION: both teams in a bye-spot -> bet the coach with the better career pre/post-bye ATS% (signal, unproven)
        beh=g.get("bye_edge_home",np.nan)
        if pd.notna(beh) and pd.notna(g.open_spread):
            home_pick=int(beh)==1
            rows.append(dict(pick_id=gid+"-BC",season=g.season,week=int(g.week),game=mtchp,rule="bye_collision",
                market="spread",side=(f"{g.home_ab} {g.open_spread:+g}" if home_pick else f"{g.away_ab} {-g.open_spread:+g}"),
                bet_home=int(home_pick),open_num=g.open_spread,close_num=g.close_spread,edge=round(float(g.bye_gap),1)))
        # TIGHT + SOFT HOME ML (b66): |open_spread|<=3 + home no-vig ML implies >=4pp softer than spread -> bet AWAY
        # Signal source = OPEN spread + OPEN ML, grade vs OPEN spread (framework-compliant)
        # Computed FIRST so fade_pr can defer to it per b67 conflict resolution
        softml_fires=False
        if pd.notna(g.open_spread) and abs(g.open_spread)<=3 and pd.notna(g.open_ml_home) and pd.notna(g.open_ml_away):
            ml_h_i=_ml_p(g.open_ml_home); ml_a_i=_ml_p(g.open_ml_away)
            if pd.notna(ml_h_i) and pd.notna(ml_a_i) and (ml_h_i+ml_a_i)>0:
                ml_h_nv=ml_h_i/(ml_h_i+ml_a_i)
                sp_imp_h=sp_lookup.get(round(abs(g.open_spread)/0.5)*0.5,0.5)
                if g.open_spread>0: sp_imp_h=1-sp_imp_h
                elif g.open_spread==0: sp_imp_h=0.5
                div_h=ml_h_nv - sp_imp_h
                if div_h<=-0.04:
                    softml_fires=True
                    rows.append(dict(pick_id=gid+"-TSML",season=g.season,week=int(g.week),game=mtchp,
                        rule="tight_soft_ml_fade_home",market="spread",
                        side=f"{g.away_ab} {-g.open_spread:+g}",bet_home=0,
                        open_num=g.open_spread,close_num=g.close_spread,edge=round(float(-div_h*100),1)))
        # DK GIANT FAV OVER (b63): spread >=7 + ML softer than spread implies (div<=-0.05) -> OVER
        if pd.notna(g.dk_spread) and pd.notna(g.dk_ml_home) and pd.notna(g.dk_ml_away) and pd.notna(g.open_total):
            abs_dk=abs(g.dk_spread)
            if abs_dk>=7:
                ml_h=_ml_p(g.dk_ml_home); ml_a=_ml_p(g.dk_ml_away)
                if pd.notna(ml_h) and pd.notna(ml_a) and (ml_h+ml_a)>0:
                    ml_h_nv=ml_h/(ml_h+ml_a)
                    is_h_fav=g.dk_spread<0
                    fav_ml_nv=ml_h_nv if is_h_fav else (1-ml_h_nv)
                    fav_sp_imp=sp_lookup.get(round(abs_dk/0.5)*0.5,0.5)
                    fav_div=fav_ml_nv - fav_sp_imp
                    if fav_div<=-0.05:
                        rows.append(dict(pick_id=gid+"-DKO",season=g.season,week=int(g.week),game=mtchp,
                            rule="dk_giant_fav_over",market="total",side=f"OVER {g.open_total:g}",
                            bet_home=-1,open_num=g.open_total,close_num=g.close_total,edge=round(float(-fav_div*100),1)))
        # DK HEAVY HOME JUICE (b63): DK spread_home_price <=-120 -> bet HOME spread side
        if pd.notna(g.dk_juice) and g.dk_juice<=-120 and pd.notna(g.open_spread):
            rows.append(dict(pick_id=gid+"-DKJ",season=g.season,week=int(g.week),game=mtchp,
                rule="dk_heavy_home_juice",market="spread",
                side=f"{g.home_ab} {g.open_spread:+g}",bet_home=1,
                open_num=g.open_spread,close_num=g.close_spread,edge=round(float(-g.dk_juice),0)))
        # FADE-PR IN TIGHT GAME (b65): 1.5 line + |pr_diff|>=3 -> bet AGAINST better-PR team
        # CONFLICT RESOLUTION (b67): if soft_ml ALSO fires here and they'd clash (soft_ml picks AWAY,
        # fade_pr picks HOME because pr_diff<0), SKIP fade_pr. Soft_ml wins 6/7 historical clashes.
        pr_d=g.get("pr_diff",np.nan)
        if pd.notna(pr_d) and pd.notna(g.open_spread) and abs(g.open_spread)<=1.5 and abs(pr_d)>=3:
            home_pick=pr_d<0   # home has worse PR -> bet home (FADE the better-PR away team)
            # Conflict: soft_ml fires + fade_pr would pick HOME (clashing with soft_ml's AWAY pick)
            if not (softml_fires and home_pick):
                rows.append(dict(pick_id=gid+"-FPR",season=g.season,week=int(g.week),game=mtchp,
                    rule="fade_pr_in_tight_game",market="spread",
                    side=(f"{g.home_ab} {g.open_spread:+g}" if home_pick else f"{g.away_ab} {-g.open_spread:+g}"),
                    bet_home=int(home_pick),open_num=g.open_spread,close_num=g.close_spread,edge=round(float(abs(pr_d)),2)))
        # ============ b66 TIGHT-GAME SPOTS ============
        # primetime_tight_favorite (b66): PT + tight -> bet the favorite (home or away)
        pt=int(g.primetime_i) if pd.notna(g.primetime_i) else 0
        if pt==1 and pd.notna(g.open_spread) and abs(g.open_spread)<=3 and g.open_spread!=0:
            home_pick=g.open_spread<0   # home is fav
            rows.append(dict(pick_id=gid+"-PTF",season=g.season,week=int(g.week),game=mtchp,
                rule="primetime_tight_favorite",market="spread",
                side=(f"{g.home_ab} {g.open_spread:+g}" if home_pick else f"{g.away_ab} {-g.open_spread:+g}"),
                bet_home=int(home_pick),open_num=g.open_spread,close_num=g.close_spread,edge=round(float(abs(g.open_spread)),2)))
        # primetime_tight_under (b66): PT + tight -> bet UNDER
        if pt==1 and pd.notna(g.open_spread) and abs(g.open_spread)<=3 and pd.notna(g.open_total):
            rows.append(dict(pick_id=gid+"-PTU",season=g.season,week=int(g.week),game=mtchp,
                rule="primetime_tight_under",market="total",
                side=f"UNDER {g.open_total:g}",bet_home=-2,
                open_num=g.open_total,close_num=g.close_total,edge=round(float(g.open_total),1)))
        # top_vs_top_pt_home (b66): PT + tight + both top PR tier -> bet HOME
        if pt==1 and pd.notna(g.open_spread) and abs(g.open_spread)<=3 and g.get("h_tier","")=="top" and g.get("a_tier","")=="top":
            rows.append(dict(pick_id=gid+"-TTH",season=g.season,week=int(g.week),game=mtchp,
                rule="top_vs_top_pt_home",market="spread",
                side=f"{g.home_ab} {g.open_spread:+g}",bet_home=1,
                open_num=g.open_spread,close_num=g.close_spread,edge=0))
        # bot_vs_bot_under (b66): tight + both bottom PR tier -> bet UNDER
        if pd.notna(g.open_spread) and abs(g.open_spread)<=3 and g.get("h_tier","")=="bot" and g.get("a_tier","")=="bot" and pd.notna(g.open_total):
            rows.append(dict(pick_id=gid+"-BBU",season=g.season,week=int(g.week),game=mtchp,
                rule="bot_vs_bot_under",market="total",
                side=f"UNDER {g.open_total:g}",bet_home=-2,
                open_num=g.open_total,close_num=g.close_total,edge=round(float(g.open_total),1)))
        # ROLLING TEAM-vs-LINE MISS spots (b61/b62 — FADE the trap, mean reversion)
        sum_l3=g.get("total_miss_sum_last3",np.nan); lvl=g.get("line_vs_league",np.nan)
        # EXTREME UNDER-reversion (star signal): both teams way under-performed + line high -> bet OVER (68% n=25)
        if pd.notna(sum_l3) and pd.notna(lvl) and sum_l3<=-8 and lvl>=2 and pd.notna(g.open_total):
            rows.append(dict(pick_id=gid+"-LLO",season=g.season,week=int(g.week),game=mtchp,rule="total_low_line_over",
                market="total",side=f"OVER {g.open_total:g}",bet_home=-1,open_num=g.open_total,close_num=g.close_total,edge=round(float(sum_l3),2)))
        # Broad FADE-OVER-trap: teams over-performed + line low -> bet UNDER (55% n=200+)
        if pd.notna(sum_l3) and pd.notna(lvl) and sum_l3>=4 and lvl<=-2 and pd.notna(g.open_total):
            rows.append(dict(pick_id=gid+"-HLU",season=g.season,week=int(g.week),game=mtchp,rule="total_high_line_under",
                market="total",side=f"UNDER {g.open_total:g}",bet_home=-2,open_num=g.open_total,close_num=g.close_total,edge=round(float(sum_l3),2)))
        # Spread cover FADE traps
        hmm=g.get("h_margin_miss_s2d",np.nan); amm=g.get("a_margin_miss_s2d",np.nan)
        if pd.notna(hmm) and pd.notna(amm) and pd.notna(g.open_spread):
            # Use OPEN spread for fav/dog direction (signal uses open-line data, bets at open)
            # home-dog covering vs away-fav not-covering -> FADE = bet AWAY
            if hmm>=3 and amm<=-3 and g.open_spread>0:
                rows.append(dict(pick_id=gid+"-SDFA",season=g.season,week=int(g.week),game=mtchp,rule="spread_dog_cover_fade_away",
                    market="spread",side=f"{g.away_ab} {-g.open_spread:+g}",bet_home=0,open_num=g.open_spread,close_num=g.close_spread,edge=round(float(hmm-amm),2)))
            # away-dog covering vs home-fav not-covering -> FADE = bet HOME
            if amm>=3 and hmm<=-3 and g.open_spread<0:
                rows.append(dict(pick_id=gid+"-SDFH",season=g.season,week=int(g.week),game=mtchp,rule="spread_dog_cover_fade_home",
                    market="spread",side=f"{g.home_ab} {g.open_spread:+g}",bet_home=1,open_num=g.open_spread,close_num=g.close_spread,edge=round(float(amm-hmm),2)))
    led=pd.DataFrame(rows)
    path=os.path.join(OUT,f"forecast_ledger_{target}.csv")
    if os.path.exists(path):
        old=pd.read_csv(path); led=pd.concat([old[~old.pick_id.isin(led.pick_id)],led],ignore_index=True)
    led.to_csv(path,index=False); return led,path

def grade(m, target):
    """Fill result + CLV for finished games in the ledger."""
    path=os.path.join(OUT,f"forecast_ledger_{target}.csv")
    led=pd.read_csv(path)
    for c in ["away_ab","home_ab","actual_margin","actual_total","win","clv_pts","roi_u"]:  # idempotent re-grade
        if c in led.columns: led=led.drop(columns=c)
    res=m[m.season==target][["home_ab","away_ab","actual_margin","actual_total"]]
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
    L(f"\n{'='*82}\nFORWARD-TEST REPORT {target}  (graded picks: {len(g)} / logged: {len(led)})\n{'='*82}")
    L("ACTIVE BET FLAGS (recommended picks):")
    active_rules=["sides_model","receiver_over","receiver_over_HC","wind_under","legacy_fade","legacy_primetime","total_low_line_over","total_high_line_under","spread_dog_cover_fade_away","spread_dog_cover_fade_home","fade_pr_in_tight_game","dk_giant_fav_over","dk_heavy_home_juice","tight_soft_ml_fade_home","top_vs_top_pt_home"]
    tracking_rules=["bye_collision","week1_def_under","primetime_tight_favorite","primetime_tight_under","bot_vs_bot_under"]
    for rule in active_rules:
        s=g[g.rule==rule]
        if len(s)==0: L(f"  {rule:28s}: (none yet)"); continue
        k=int(s.win.sum()); n=len(s); lo,hi=wilson_ci(k,n); clv=s.clv_pts.mean(); roi=s.roi_u.sum()/n*100
        L(f"  {rule:28s}: {k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}% CLV={clv:+.2f}pts")
    active=g[g.rule.isin(active_rules)]
    if len(active)>0:
        k=int(active.win.sum()); n=len(active); lo,hi=wilson_ci(k,n); roi=active.roi_u.sum()/n*100
        L(f"  {'ACTIVE TOTAL':28s}: {k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}%")
    L(f"\nTRACKING ONLY (still graded but NOT presented as bet flags; demoted due to 2025 regression):")
    for rule in tracking_rules:
        s=g[g.rule==rule]
        if len(s)==0: L(f"  {rule:28s}: (none yet)"); continue
        k=int(s.win.sum()); n=len(s); lo,hi=wilson_ci(k,n); clv=s.clv_pts.mean(); roi=s.roi_u.sum()/n*100
        L(f"  {rule:28s}: {k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}% CLV={clv:+.2f}pts")
    L(f"\nTOTAL (all rules): {int(g.win.sum())}/{len(g)}={g.win.sum()/len(g)*100:.1f}% ROI={g.roi_u.sum()/len(g)*100:+.1f}% units {g.roi_u.sum():+.1f}")
    # Confluence breakdown — INTERNAL signal only (not a separate bet flag). Shows how sides_model picks
    # perform when the regression confirmation layer agrees on direction (b70). Frontend uses this as a
    # confidence badge ("high conviction"), but never exposes the underlying margin prediction.
    if "confluence" in g.columns:
        sm=g[g.rule=="sides_model"].copy()
        if len(sm)>0:
            sm["confluence"]=sm.confluence.fillna(0).astype(int)
            L(f"\nSIDES_MODEL CONFLUENCE BREAKDOWN (internal confidence layer — not a separate bet flag):")
            for tag,sub in [("BOTH MODELS AGREE (high conv)",sm[sm.confluence==1]),("clf only (std conv)",sm[sm.confluence==0])]:
                if len(sub)==0: L(f"  {tag:34s}: (none)"); continue
                k=int(sub.win.sum()); n=len(sub); lo,hi=wilson_ci(k,n); roi=sub.roi_u.sum()/n*100; clv=sub.clv_pts.mean()
                L(f"  {tag:34s}: {k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}% CLV={clv:+.2f}pts")

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--dry-run",type=int); ap.add_argument("--season",type=int); ap.add_argument("--week",type=int)
    ap.add_argument("--grade",type=int); ap.add_argument("--report",type=int)
    ap.add_argument("--teasers",type=int,help="generate+grade+report teasers for season")
    a=ap.parse_args()
    if a.dry_run:
        m,BASE=build(); led,path=generate(m,BASE,a.dry_run); grade(m,a.dry_run); report(a.dry_run)
        # Teaser pipeline runs after the standard pick grading so it has graded outcomes available
        generate_teasers(a.dry_run); grade_teasers(m, a.dry_run); report_teasers(a.dry_run)
        # CFB-replication survivors (b77-b83) — independent UNDER signals
        generate_cfb_picks(a.dry_run); grade_cfb_picks(m, a.dry_run); report_cfb_picks(a.dry_run)
        L(f"\n[dry-run] ledger written to {path}")
    elif a.season:
        m,BASE=build(); led,path=generate(m,BASE,a.season,a.week)
        L(f"[generate] {len(led)} picks logged for {a.season}" + (f" week {a.week}" if a.week else "") + f" -> {path}")
        generate_teasers(a.season, a.week)
    elif a.grade:
        m,BASE=build(); grade(m,a.grade); report(a.grade)
        grade_teasers(m, a.grade); report_teasers(a.grade)
    elif a.report: report(a.report); report_teasers(a.report)
    elif a.teasers:
        m,BASE=build(); generate_teasers(a.teasers); grade_teasers(m, a.teasers); report_teasers(a.teasers)
    else: ap.print_help()
