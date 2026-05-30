"""
consensus_totals.py — TOTALS MODEL for 2026 forward use (vaulted 2026-05-29, FINAL 2026-05-29 after b58).

WHY THIS EXISTS
  Predicts totals for every NFL game (for website display) and identifies a high-confidence BET subset.
  Strict-open mode is the ONLY production mode — injury news is priced into the line before we can
  capture it, so we use a model that NEVER saw injury features (no leak).

STRATEGY (locked production rule)
  Ensemble of b15 (direct totals, env+weather features) and b55 (team-points, top-100 importance +
  b50 scheme priors). Trained WITHOUT injury features (b57 ablation showed those are timing-leaks
  we can't realistically capture live). HC tier = the bet:

      both models agree on direction  AND  3 <= min |edge| <= 7

  Edge below 3 = no clear signal. Edge above 7 = model overconfidence (per b58 — extreme predictions
  collapse to ~50% hit rate, the model is usually wrong when it's that far off the market).

REALISTIC LIVE EXPECTATIONS (b58_edge_magnitude.py, strict-open + 3-7 sweet spot, 2024+2025):
  HC tier (edge 3-7, both agree):  ~57-58% / +8-10% ROI on n=172 over 2 seasons (~85/yr)
  + positive CLV (+0.5+ pts) — the line moves toward our picks even without injury info.

  We do NOT bet edges >7 — historically 50%/-5% ROI in strict-open mode. Display as "EXTREME LEAN"
  for transparency but don't act on them.

WHY FULL-MODE (with injuries) ISN'T A REAL PRODUCT
  By the time NFL injury reports finalize (Friday), the market has already moved the total. The
  +13.5% ROI in the original FULL-mode backtest was a timing artifact (post-opener info used to
  bet opener). For live use, by the time we know "Justin Jefferson out," sportsbooks know too and
  the total has dropped. The --include-injuries flag is preserved for RESEARCH/BACKTEST only.

DATA DEPENDENCIES (refresh during 2026 season):
  data/matchup.parquet            — refreshed by main pipeline (must include 2026 games + lines)
  data/scheme_plays.parquet       — refresh weekly via b46_pull_scheme.py (nflverse PBP + participation)
  data/odds_consensus.parquet     — refresh weekly (opener/close lines)
  data/injuries_raw.parquet       — kept for the spot rules in forecast_harness.py; ignored by us
  data/ngs_receiving.parquet      — kept for the spot rules; ignored by us
  data/players_xwalk.parquet      — refresh occasionally (gsis_id ↔ display_name)
  data/b54_feature_importance.csv — FROZEN snapshot (don't re-rank; use as-is for 2026)

USAGE (production = no flag needed)
  python3 consensus_totals.py --dry-run 2025                   # validate strict-open vs 2025
  python3 consensus_totals.py --season 2026 --week 4           # weekly live picks (strict-open is default)
  python3 consensus_totals.py --grade 2026                     # fill results + CLV after games
  python3 consensus_totals.py --report 2026                    # summary
  python3 consensus_totals.py --dry-run 2025 --include-injuries  # RESEARCH/BACKTEST only

FILE OUTPUTS
  out/predictions_totals_<season>.csv               — EVERY game (for website DISPLAY)
                                                       columns: display_total, pt_b15, pt_b55, open/close_total,
                                                       edge_open, direction (OVER/UNDER/NEUTRAL),
                                                       tier, bet_quality
  out/consensus_totals_ledger_<season>.csv          — HC bet-quality picks only + grade + CLV

TIER SYSTEM
  HC          = both agree + 3 <= min|edge| <= 7   -> THE BET (bet_quality=1)
  EXTREME     = both agree + min|edge| > 7          -> display lean, DO NOT BET (model overconfident)
  LEAN        = both agree + min|edge| 2-3          -> display lean, marginal — display only
  WEAK        = both agree + min|edge| < 2          -> display only
  LEAN_EARLY  = W1-3 (b55 only) + |edge| >= 2       -> display lean, no bet (b15 warming up)
  NONE        = no signal / models disagree         -> display total only, no direction
"""
import os, sys, argparse, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from sklearn.ensemble import HistGradientBoostingRegressor
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data")
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"out"); os.makedirs(OUT,exist_ok=True); L=print

# LOCKED HYPERPARAMETERS — do not change without re-validating
B15_PARAMS=dict(max_depth=3,learning_rate=0.05,max_iter=350,l2_regularization=2.0,min_samples_leaf=40,random_state=0)
B55_PARAMS=dict(max_depth=4,learning_rate=0.05,max_iter=500,l2_regularization=1.0,min_samples_leaf=40,random_state=0)
TOP_N=100                # b54 importance: use top-N features for b55
# Production tier (b58 sweet spot): bet when 3 <= min|edge| <= 7
MIN_EDGE_BET=3.0         # below this = no clear signal, ~50% hit rate
MAX_EDGE_BET=7.0         # above this = model overconfidence, drops to ~50% (b58 finding)
MIN_EDGE_LEAN=2.0        # display "LEAN" tier (still 50% range, no bet)
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR"}

# Injury features stripped in --strict-open mode (these are the post-opener-info leaks per b57)
B15_INJURY_FEATS={"key_recv_out","h_max_air_out","a_max_air_out"}
def _is_b55_injury(c):
    cl=c.lower()
    if cl in ('def_injury_severity','off_injury_severity'): return True
    if 'backup_qb' in cl or 'starters_out' in cl or 'qb_out' in cl: return True
    if '_out_or_' in cl or '_max_air_out' in cl: return True
    return False

# =========================================================================
# b15 — LOCKED direct totals predictor
# =========================================================================
def _carry(df,kid,col,out):
    df=df.sort_values([kid,"season","week"]).copy()
    df["_c"]=df.groupby([kid,"season"])[col].apply(lambda s:s.shift(1).expanding().mean()).reset_index(level=[0,1],drop=True)
    pl=df[["season",kid]].drop_duplicates()
    grid=pl.merge(pd.DataFrame({"week":range(1,23)}),how="cross").merge(df[["season",kid,"week","_c"]],on=["season",kid,"week"],how="left").sort_values(["season",kid,"week"])
    grid[out]=grid.groupby(["season",kid])["_c"].ffill(); return grid[["season","week",kid,out]]

def build_b15(target, strict_open=False):
    """Train b15 walk-forward on seasons<target, predict target. Returns df with [season,week,home_ab,away_ab,pt_b15].
    strict_open=True strips injury-derived features (key_recv_out, h_max_air_out, a_max_air_out) so the
    model is fair to grade against the OPENING line (per b57 honesty test)."""
    m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
    inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet")); rec=pd.read_parquet(os.path.join(DATA,"ngs_receiving.parquet"))
    m["actual_total"]=m.home_score+m.away_score
    air=_carry(rec,"player_id","percent_share_of_intended_air_yards","airshare")
    miss=inj[inj.report_status.isin(["Out","Doubtful"])].merge(air,on=["season","week","player_id"],how="left")
    miss=miss[miss.position.isin({"WR","TE","RB","FB"})]
    keyout=miss.groupby(["season","week","team"]).airshare.max().reset_index().rename(columns={"airshare":"max_air_out"})
    keyout["ab"]=keyout.team.replace(nv2our)
    for side,p in [("home","h_"),("away","a_")]:
        m=m.merge(keyout.rename(columns={"ab":f"{side}_ab","max_air_out":f"{p}max_air_out"})[["season","week",f"{side}_ab",f"{p}max_air_out"]],on=["season","week",f"{side}_ab"],how="left")
    m["h_max_air_out"]=m.h_max_air_out.fillna(0); m["a_max_air_out"]=m.a_max_air_out.fillna(0)
    m["key_recv_out"]=((m.h_max_air_out>=35)|(m.a_max_air_out>=35)).astype(int)
    m["wind_mph"]=pd.to_numeric(m.wind_mph,errors="coerce").fillna(pd.to_numeric(m.wind_speed,errors="coerce"))
    m["temp_f"]=pd.to_numeric(m.temp_f,errors="coerce").fillna(pd.to_numeric(m.temperature,errors="coerce"))
    m["dome"]=(m.dome_closed.fillna(0).astype(float)>0).astype(int) if "dome_closed" in m else 0
    m["wind_under"]=(m.wind_mph>=15).astype(int); m["cold"]=(m.temp_f<=32).astype(int); m["primetime_i"]=m.primetime.fillna(0).astype(int)
    def s(c): return pd.to_numeric(m[c],errors="coerce") if c in m.columns else np.nan
    m["off_ppd_sum"]=s("home_off_ppd_s2d")+s("away_off_ppd_s2d")
    m["def_ppd_sum"]=s("home_def_ppd_allowed_s2d")+s("away_def_ppd_allowed_s2d")
    m["pace_sum"]=s("home_off_pace_s2d")+s("away_off_pace_s2d")
    m["pass_epa_sum"]=s("home_off_pass_epa_neutral_s2d")+s("away_off_pass_epa_neutral_s2d")
    m["rush_epa_sum"]=s("home_off_rush_epa_neutral_s2d")+s("away_off_rush_epa_neutral_s2d")
    m["def_pass_allowed_sum"]=s("home_def_pass_epa_allowed_neutral_s2d")+s("away_def_pass_epa_allowed_neutral_s2d")
    m["def_rush_allowed_sum"]=s("home_def_rush_epa_allowed_neutral_s2d")+s("away_def_rush_epa_allowed_neutral_s2d")
    m["expl_pass_sum"]=s("home_off_explosive_pass_rate_s2d")+s("away_off_explosive_pass_rate_s2d")
    m["td_per_drive_sum"]=s("home_off_td_per_drive_s2d")+s("away_off_td_per_drive_s2d")
    m["last_pts_sum"]=s("home_last_points")+s("away_last_points")+s("home_last_allowed_points")+s("away_last_allowed_points")
    m["no_huddle_sum"]=s("home_off_no_huddle_rate_s2d")+s("away_off_no_huddle_rate_s2d")
    B15=["off_ppd_sum","def_ppd_sum","pace_sum","pass_epa_sum","rush_epa_sum","def_pass_allowed_sum",
         "def_rush_allowed_sum","expl_pass_sum","td_per_drive_sum","last_pts_sum","no_huddle_sum",
         "wind_mph","temp_f","dome","key_recv_out","wind_under","cold","primetime_i","h_max_air_out","a_max_air_out"]
    if strict_open: B15=[c for c in B15 if c not in B15_INJURY_FEATS]
    B15=[c for c in B15 if c in m.columns and pd.to_numeric(m[c],errors="coerce").notna().mean()>0.5]
    for c in B15: m[c]=pd.to_numeric(m[c],errors="coerce")
    W=m[m.week>=4].copy(); W["pt_b15"]=np.nan
    trn=W[W.season<target].dropna(subset=["actual_total"]+B15)
    te=W[W.season==target]
    if len(trn)<200 or len(te)==0: return pd.DataFrame(columns=['season','week','home_ab','away_ab','pt_b15'])
    gb=HistGradientBoostingRegressor(**B15_PARAMS).fit(trn[B15],trn.actual_total)
    W.loc[te.index,"pt_b15"]=gb.predict(te[B15])
    return W[W.season==target][['season','week','home_ab','away_ab','pt_b15']].dropna(subset=['pt_b15'])

# =========================================================================
# b55 — PRUNED + SCHEME team-points predictor
# =========================================================================
BL_TERMS=['spread','total_line','_line','odds','money','juice','implied','vegas','book','ml_','_ml','open_','close_']
BL_KEEP=['oline','dline']
OUTCOME_TERMS=['cover','spread_miss','spread_diff','away_favorite','total_points','actual_','_actual',
               'resid_','fav_margin','fav_won','_won','_final','total_score','winning_','losing_','final_',
               'points_scored','points_allowed_actual','upset','outright','total_diff','total_miss',
               'total_won','margin_won','margin_loss','underdog_covered','favorite_covered','_outcome',
               '_result','over_win','under_win','ats_win','ml_win','mkt_','exp_margin','exp_total','exp_pts']
SAFE_SUFFIXES=('_s2d','_last3','_last5','_pr','_rate','_pct','_streak','_per_game','_per_play','_per_drive')
def _is_betting(c):
    cl=c.lower()
    if any(k in cl for k in BL_KEEP): return False
    return any(t in cl for t in BL_TERMS)
def _is_outcome(c):
    cl=c.lower()
    if cl.endswith(SAFE_SUFFIXES): return False
    if '_s2d_' in cl or '_last3_' in cl or '_last5_' in cl: return False
    return any(t in cl for t in OUTCOME_TERMS)

def build_b55(target, strict_open=False):
    """Train b55 PRUNED+SCH walk-forward on seasons<target, predict target's team-game points,
    derive home/away predictions, return total per game.
    strict_open=True strips injury-derived features (off/def_backup_qb, off/def_injury_severity,
    off/def_starters_out, off/def_qb_out_or_doubtful) so the model is fair to grade against OPEN."""
    m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
    sp=pd.read_parquet(os.path.join(DATA,"scheme_plays.parquet"))
    imp_b54=pd.read_csv(os.path.join(DATA,"b54_feature_importance.csv"))
    # ---- per-team-game frame from matchup (leak-filtered) ----
    betting=[c for c in m.columns if _is_betting(c)]
    outcomes=[c for c in m.columns if _is_outcome(c)]
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
    def build_side(side, df):
        if side=='home':
            off_cols=[p[0] for p in pairs]; def_cols=[p[1] for p in pairs]
            target_col=df.home_score; is_home=1; off_t=df.home_ab; def_t=df.away_ab
        else:
            off_cols=[p[1] for p in pairs]; def_cols=[p[0] for p in pairs]
            target_col=df.away_score; is_home=0; off_t=df.away_ab; def_t=df.home_ab
        out=pd.DataFrame({'season':df.season,'week':df.week,'off_abv':off_t,'def_abv':def_t,'target':target_col,'is_home':is_home})
        for c,base in zip(off_cols,[p[2] for p in pairs]): out[f'off_{base}']=df[c].values
        for c,base in zip(def_cols,[p[2] for p in pairs]): out[f'def_{base}']=df[c].values
        for c in neutral: out[c]=df[c].values
        return out
    tg=pd.concat([build_side('home',m),build_side('away',m)],ignore_index=True).dropna(subset=['target']).copy()
    # NOTE: rows where target is NaN (future games not yet played) are dropped — we need to predict them.
    # Build a SEPARATE frame for target year (no target dropping) so we can predict 2026 future games.
    tg_predict=pd.concat([build_side('home',m),build_side('away',m)],ignore_index=True).copy()

    # ---- b50 scheme priors (walk-forward, target year Y uses Y-2..Y-1) ----
    sp["posteam"]=sp.posteam.replace(nv2our); sp["defteam"]=sp.defteam.replace(nv2our)
    lab=sp[(sp["pass"]==1)&sp.defense_man_zone_type.isin(["MAN_COVERAGE","ZONE_COVERAGE"])].copy()
    lab["mz"]=np.where(lab.defense_man_zone_type=="MAN_COVERAGE","M","Z")
    lab["pr"]=pd.to_numeric(lab.was_pressure,errors="coerce").fillna(0).astype(int)
    lab["epa"]=pd.to_numeric(lab.epa,errors="coerce")
    def _scheme_priors(Y):
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
    for Y in sorted(tg.season.unique().tolist()+[target]):
        if Y<2020: continue
        qM,qZ,wr,dpri=_scheme_priors(Y)
        p=sp[(sp["pass"]==1)&(sp.season==Y)].copy()
        if len(p)==0: continue  # future year may have no PBP yet
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
    off_sch=pd.concat(all_off,ignore_index=True) if all_off else pd.DataFrame()
    def_sch=pd.concat(all_def,ignore_index=True) if all_def else pd.DataFrame()
    for frame in [tg, tg_predict]:
        if len(off_sch): frame_=frame.merge(off_sch,on=["season","week","off_abv"],how="left",suffixes=('','_dup'))
        else: frame_=frame.assign(qb_epa_vs_man=np.nan,qb_epa_vs_zone=np.nan,wr_zNP_w=np.nan)
        if len(def_sch): frame_=frame_.merge(def_sch[["season","def_abv","def_man_rate","def_pressure_rate","def_zone_rate"]],on=["season","def_abv"],how="left",suffixes=('','_dup'))
        else: frame_=frame_.assign(def_man_rate=np.nan,def_pressure_rate=np.nan,def_zone_rate=np.nan)
        frame_["int_qbman_x_def"]=(-frame_.qb_epa_vs_man)*frame_.def_man_rate*frame_.def_pressure_rate
        frame_["int_wrzNP_x_def"]=frame_.wr_zNP_w*frame_.def_zone_rate*(1-frame_.def_pressure_rate)
        if frame is tg: tg=frame_
        else: tg_predict=frame_
    NEW=["qb_epa_vs_man","qb_epa_vs_zone","wr_zNP_w","def_man_rate","def_pressure_rate","def_zone_rate","int_qbman_x_def","int_wrzNP_x_def"]

    # ---- feature selection: top-N from b54 importance + scheme priors ----
    top_b54=imp_b54.sort_values('imp',ascending=False).head(TOP_N).feature.tolist()
    top_b54=[f for f in top_b54 if f in tg.columns]
    if strict_open: top_b54=[f for f in top_b54 if not _is_b55_injury(f)]
    for c in top_b54+NEW:
        if c in tg.columns and tg[c].dtype=='object': tg[c]=pd.to_numeric(tg[c],errors='coerce')
        if c in tg_predict.columns and tg_predict[c].dtype=='object': tg_predict[c]=pd.to_numeric(tg_predict[c],errors='coerce')
    top_b54=[f for f in top_b54 if tg[f].notna().sum()/len(tg)>=0.5]
    final_feats=top_b54+NEW

    # ---- train walk-forward, predict target ----
    tr=tg[tg.season<target].dropna(subset=['target']).copy()
    te=tg_predict[tg_predict.season==target].copy()
    if len(tr)<500 or len(te)==0: return pd.DataFrame(columns=['season','week','home_ab','away_ab','pt_b55'])
    gbm=HistGradientBoostingRegressor(**B55_PARAMS).fit(tr[final_feats],tr.target)
    te['pred']=gbm.predict(te[final_feats])

    # ---- derive per-game total ----
    ptab=te.groupby(['season','week','off_abv']).agg(pred=('pred','first')).reset_index()
    games=m[m.season==target][['season','week','home_ab','away_ab']].copy()
    games=games.merge(ptab.rename(columns={'off_abv':'home_ab','pred':'h_pred'}),on=['season','week','home_ab'],how='left')
    games=games.merge(ptab.rename(columns={'off_abv':'away_ab','pred':'a_pred'}),on=['season','week','away_ab'],how='left')
    games['pt_b55']=games.h_pred+games.a_pred
    return games[['season','week','home_ab','away_ab','pt_b55']].dropna(subset=['pt_b55'])

# =========================================================================
# ENSEMBLE — combine b15 + b55, identify consensus picks
# =========================================================================
def predict_all(target, week=None, strict_open=False):
    """Produce a prediction for EVERY game in target (optionally one week). Used by the website to
    DISPLAY a totals number on every game card. Weeks 1-3: b55 alone (b15 needs s2d warmup);
    Week 4+: ensemble. Confidence tier separately tags which subset are bet-quality."""
    b15=build_b15(target, strict_open=strict_open); b55=build_b55(target, strict_open=strict_open)
    od=pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
    m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
    gp=m[m.season==target][['season','week','home_ab','away_ab','home_score','away_score']].copy()
    gp['actual_total']=gp.home_score+gp.away_score
    gp=gp.merge(b15,on=['season','week','home_ab','away_ab'],how='left')
    gp=gp.merge(b55,on=['season','week','home_ab','away_ab'],how='left')
    gp=gp.merge(od[['season','home_ab','away_ab','open_total','close_total']],on=['season','home_ab','away_ab'],how='left')
    if week is not None: gp=gp[gp.week==week]
    rows=[]
    for _,g in gp.iterrows():
        has_b15=pd.notna(g.pt_b15); has_b55=pd.notna(g.pt_b55)
        if not has_b55: continue                                  # b55 is the floor; if missing, skip
        # Display total: ensemble avg when both, else b55 alone
        display_total=(g.pt_b15+g.pt_b55)/2 if has_b15 else g.pt_b55
        edge_b15_open=g.pt_b15-g.open_total if (has_b15 and pd.notna(g.open_total)) else np.nan
        edge_b55_open=g.pt_b55-g.open_total if pd.notna(g.open_total) else np.nan
        edge_disp_open=display_total-g.open_total if pd.notna(g.open_total) else np.nan
        # Tier decision (b58 sweet spot: bet when 3 <= min_edge <= 7; extreme edges drop to ~50%)
        tier="NONE"; direction="NEUTRAL"; bet_quality=0
        if has_b15 and pd.notna(g.open_total):
            if np.sign(edge_b15_open)==np.sign(edge_b55_open) and edge_b15_open!=0 and edge_b55_open!=0:
                min_edge=min(abs(edge_b15_open),abs(edge_b55_open))
                direction="OVER" if edge_b15_open>0 else "UNDER"
                if MIN_EDGE_BET<=min_edge<=MAX_EDGE_BET: tier="HC"; bet_quality=1          # THE BET
                elif min_edge>MAX_EDGE_BET: tier="EXTREME"                                  # display only, model overconfident
                elif min_edge>=MIN_EDGE_LEAN: tier="LEAN"                                   # display only, marginal
                else: tier="WEAK"                                                            # display only, no signal
        elif has_b55 and pd.notna(g.open_total):
            # Early season (W1-3): b55 only, display-only lean
            if abs(edge_b55_open)>=MIN_EDGE_LEAN: tier="LEAN_EARLY"; direction="OVER" if edge_b55_open>0 else "UNDER"
        rows.append(dict(season=int(g.season),week=int(g.week),
            game=f"{g.away_ab}@{g.home_ab}",away_ab=g.away_ab,home_ab=g.home_ab,
            display_total=round(float(display_total),2),
            pt_b15=round(float(g.pt_b15),2) if has_b15 else None,
            pt_b55=round(float(g.pt_b55),2),
            open_total=float(g.open_total) if pd.notna(g.open_total) else None,
            close_total=float(g.close_total) if pd.notna(g.close_total) else None,
            edge_open=round(float(edge_disp_open),2) if pd.notna(edge_disp_open) else None,
            edge_b15=round(float(edge_b15_open),2) if pd.notna(edge_b15_open) else None,
            edge_b55=round(float(edge_b55_open),2) if pd.notna(edge_b55_open) else None,
            direction=direction, tier=tier, bet_quality=bet_quality,
            actual_total=float(g.actual_total) if pd.notna(g.actual_total) else None))
    return pd.DataFrame(rows)

def generate(target, week=None, strict_open=True):
    """Wraps predict_all: writes the full predictions CSV (for the website) AND appends HC-tier
    bet-quality picks to the bet ledger (for tracking + grading).
    strict_open=True (DEFAULT, production): strips injury features — honest opener betting.
    strict_open=False (research/backtest only): uses full features incl. injuries (NOT live-usable
    because the line moves before we can capture injury news)."""
    mode="STRICT-OPEN (live production, no injury features)" if strict_open else "FULL (RESEARCH ONLY — injury features included, not live-usable)"
    L(f"[mode] {mode}")
    preds=predict_all(target, week=week, strict_open=strict_open)
    # Write FULL predictions table — for website display (every game gets a row)
    pred_path=os.path.join(OUT,f"predictions_totals_{target}.csv")
    if os.path.exists(pred_path):
        old=pd.read_csv(pred_path); key=['season','week','game']
        preds=pd.concat([old.merge(preds[key].assign(_new=1),on=key,how='left').query('_new!=1').drop(columns=['_new']),preds],ignore_index=True)
    preds.to_csv(pred_path,index=False)
    L(f"[display] {len(preds)} predictions written -> {pred_path}")
    # Filter to bet-quality picks (HC only — the 3-7 sweet spot) for the bet ledger
    bets=preds[preds.bet_quality==1].copy()
    rows=[]
    for _,g in bets.iterrows():
        gid=f"{int(g.season)}-W{int(g.week):02d}-{g.away_ab}@{g.home_ab}"
        rows.append(dict(pick_id=gid+"-CTHC",
            season=int(g.season),week=int(g.week),game=g.game,rule="consensus_totals_HC",market="total",
            side=f"{g.direction} {g.open_total:g}",bet_home=(-1 if g.direction=="OVER" else -2),
            open_num=g.open_total,close_num=g.close_total,
            edge=round(min(abs(g.edge_b15),abs(g.edge_b55)),2),
            pt_b15=g.pt_b15,pt_b55=g.pt_b55,edge_b15=g.edge_b15,edge_b55=g.edge_b55))
    led=pd.DataFrame(rows)
    path=os.path.join(OUT,f"consensus_totals_ledger_{target}.csv")
    if os.path.exists(path):
        old=pd.read_csv(path); led=pd.concat([old[~old.pick_id.isin(led.pick_id)],led],ignore_index=True)
    led.to_csv(path,index=False)
    L(f"[bet ledger] {len(led)} bet-quality picks (HC+STD) -> {path}")
    return led,path

def grade(target):
    """Fill win + CLV for finished games in the ledger."""
    path=os.path.join(OUT,f"consensus_totals_ledger_{target}.csv")
    if not os.path.exists(path): L(f"  no ledger at {path}"); return None
    led=pd.read_csv(path)
    for c in ["home_ab","away_ab","actual_total","win","clv_pts","roi_u"]:
        if c in led.columns: led=led.drop(columns=c)
    m=pd.read_parquet(os.path.join(DATA,"matchup.parquet"))
    res=m[m.season==target][["home_ab","away_ab","home_score","away_score"]].copy()
    res["actual_total"]=res.home_score+res.away_score
    led["away_ab"]=led.game.str.split("@").str[0]; led["home_ab"]=led.game.str.split("@").str[1]
    led=led.merge(res[["home_ab","away_ab","actual_total"]],on=["home_ab","away_ab"],how="left")
    def gr(r):
        if pd.isna(r.actual_total): return pd.Series([np.nan,np.nan,np.nan])
        over=r.actual_total>r.open_num; push=r.actual_total==r.open_num
        if r.bet_home==-1: win=over; clv=r.close_num-r.open_num
        else: win=not over; clv=r.open_num-r.close_num
        if push: return pd.Series([np.nan,clv,0.0])
        return pd.Series([1.0 if win else 0.0, clv, (100/110 if win else -1.0)])
    led[["win","clv_pts","roi_u"]]=led.apply(gr,axis=1)
    led.to_csv(path,index=False); return led

def report(target):
    path=os.path.join(OUT,f"consensus_totals_ledger_{target}.csv")
    if not os.path.exists(path): L(f"  no ledger at {path}"); return
    led=pd.read_csv(path); g=led.dropna(subset=["win"])
    L(f"\n{'='*78}\nCONSENSUS TOTALS REPORT {target}  (graded: {len(g)} / logged: {len(led)})\n{'='*78}")
    for rule in ["consensus_totals","consensus_totals_HC","ALL"]:
        s=g if rule=="ALL" else g[g.rule==rule]
        if len(s)==0: L(f"  {rule:22s}: (none yet)"); continue
        k=int(s.win.sum()); n=len(s); lo,hi=wilson_ci(k,n); clv=s.clv_pts.mean(); roi=s.roi_u.sum()/n*100
        L(f"  {rule:22s}: {k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={roi:+.1f}% CLV={clv:+.2f}pts")
    L(f"  {'-'*64}\n  total units: {g.roi_u.sum():+.1f} on {len(g)} bets")

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--dry-run",type=int)
    ap.add_argument("--season",type=int); ap.add_argument("--week",type=int)
    ap.add_argument("--grade",type=int); ap.add_argument("--report",type=int)
    ap.add_argument("--include-injuries",action="store_true",
                    help="RESEARCH/BACKTEST ONLY: include injury features (NOT live-usable, line moves first)")
    a=ap.parse_args()
    strict=not a.include_injuries  # production default = strict-open
    if a.dry_run:
        led,path=generate(a.dry_run, strict_open=strict); grade(a.dry_run); report(a.dry_run)
        L(f"\n[dry-run] ledger -> {path}")
    elif a.season:
        led,path=generate(a.season, a.week, strict_open=strict)
        L(f"[generate] {len(led)} picks logged for {a.season}"+(f" week {a.week}" if a.week else "")+f" -> {path}")
    elif a.grade: grade(a.grade); report(a.grade)
    elif a.report: report(a.report)
    else: ap.print_help()
