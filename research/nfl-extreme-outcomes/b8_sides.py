"""
DEDICATED sides/ML test on the player-injury layer (does it beat spreads/moneylines, not just totals?).
Value-weighted injury features (air-share, QB, def snap%). Tests, per-season + null, vs CLOSE and vs OPENER:
 A) fade the more-injured team ATS (injury differential)
 B) injured FAVORITE ATS (does losing a key receiver make a favorite miss the cover?)
 C) back the OPPONENT of a key-receiver-out team (the spread side of the totals finding)
 D) team facing an injured DEFENSE -> cover/ML?
 E) QB starter out -> ATS/ML, by QB quality
"""
import os, sys
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt, ml_roi
rng = np.random.default_rng(0)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
L = print
inj = pd.read_parquet(os.path.join(DATA, "injuries_raw.parquet"))
rec = pd.read_parquet(os.path.join(DATA, "ngs_receiving.parquet"))
pas = pd.read_parquet(os.path.join(DATA, "ngs_passing.parquet"))
sc = pd.read_parquet(os.path.join(DATA, "snap_counts.parquet"))
px = pd.read_parquet(os.path.join(DATA, "players_xwalk.parquet"))
g = pd.read_parquet(os.path.join(DATA, "games_enriched.parquet"))
od = pd.read_parquet(os.path.join(DATA, "odds_consensus.parquet"))
g2p = dict(zip(px.gsis_id, px.pfr_id))

def carry(df, kid, col, out):
    df = df.sort_values([kid, "season", "week"]).copy()
    df["_c"] = df.groupby([kid, "season"])[col].apply(lambda s: s.shift(1).expanding().mean()).reset_index(level=[0,1], drop=True)
    pl = df[["season", kid]].drop_duplicates()
    grid = pl.merge(pd.DataFrame({"week": range(1,23)}), how="cross").merge(df[["season", kid, "week", "_c"]], on=["season", kid, "week"], how="left").sort_values(["season", kid, "week"])
    grid[out] = grid.groupby(["season", kid])["_c"].ffill(); return grid[["season","week",kid,out]]
air = carry(rec,"player_id","percent_share_of_intended_air_yards","airshare")
qrt = carry(pas,"player_id","passer_rating","qb_rating"); qat = carry(pas,"player_id","attempts","qb_att")
sc=sc[sc.game_type=="REG"].copy(); sc["def_pct"]=sc.defense_pct.fillna(0); dsnap=carry(sc,"pfr_player_id","def_pct","def_pct_prior")
miss=inj[inj.report_status.isin(["Out","Doubtful"])].copy(); miss["pfr"]=miss.player_id.map(g2p)
miss=miss.merge(air,on=["season","week","player_id"],how="left").merge(qrt,on=["season","week","player_id"],how="left").merge(qat,on=["season","week","player_id"],how="left").merge(dsnap.rename(columns={"pfr_player_id":"pfr"}),on=["season","week","pfr"],how="left")
SK={"WR","TE","RB","FB"}; DEFP={"DE","DT","NT","OLB","EDGE","CB","S","SS","FS","DB","LB","ILB","MLB"}
miss["air_w"]=np.where(miss.position.isin(SK),miss.airshare.clip(lower=0).fillna(0),0.0)
miss["kr"]=(miss.position.isin(SK)&(miss.airshare>=35)).astype(int)
miss["qb_out"]=((miss.position=="QB")&(miss.qb_att>=15)).astype(int)
miss["def_w"]=np.where(miss.position.isin(DEFP),miss.def_pct_prior.fillna(0),0.0)
ti=miss.groupby(["season","week","team"]).agg(air_out=("air_w","sum"),kr=("kr","max"),qb_out=("qb_out","max"),def_out=("def_w","sum")).reset_index()

# team-game outcomes + ML
gg=g[(g.game_type=="REG")&(g.season>=2018)&g.home_score.notna()&g.spread_line.notna()].copy()
gg["result"]=gg.home_score-gg.away_score
rows=[]
for r in gg.itertuples():
    for team,ishome,ml in ((r.home_team,1,r.home_moneyline),(r.away_team,0,r.away_moneyline)):
        cov=(r.result>r.spread_line) if ishome else (r.result<r.spread_line); push=(r.result==r.spread_line)
        rows.append(dict(season=r.season,week=r.week,team=team,opp=(r.away_team if ishome else r.home_team),is_home=ishome,
                         team_cover=(np.nan if push else float(cov)), su_win=float((r.result>0)==bool(ishome)), ml=ml,
                         is_fav=int((r.spread_line>0)==bool(ishome)), spread_line=r.spread_line))
d=pd.DataFrame(rows).merge(ti,on=["season","week","team"],how="left").fillna({"air_out":0,"kr":0,"qb_out":0,"def_out":0})
opp=ti.rename(columns={"team":"opp","air_out":"opp_air","kr":"opp_kr","qb_out":"opp_qb","def_out":"opp_def"})
d=d.merge(opp[["season","week","opp","opp_air","opp_kr","opp_qb","opp_def"]],on=["season","week","opp"],how="left").fillna({"opp_air":0,"opp_kr":0,"opp_qb":0,"opp_def":0})
d["air_diff"]=d.air_out-d.opp_air
L(f"[build] team-games 2018-25: {len(d)}")

def ps(label, sub, outcome="team_cover", price=-110):
    rows=[]
    for s in sorted(sub.season.dropna().unique()):
        oc=sub[sub.season==s][outcome].dropna(); rows.append(bet_summary(int((oc==1).sum()),int(oc.isin([0,1]).sum()),str(int(s)),price))
    oc=sub[outcome].dropna(); allr=bet_summary(int((oc==1).sum()),int(oc.isin([0,1]).sum()),"ALL",price)
    nyr=sum(1 for r in rows if r.get("n",0)>=6); beat=sum(1 for r in rows if r.get("n",0)>=6 and r.get("hit",0)>=0.524)
    L(f"  >> {label:44s} [{beat}/{nyr}szn] {fmt(allr)}")

L("\n"+"="*88); L("SIDES / ML on the injury layer (vs close, 2018-25)"); L("="*88)
L("\n[A] FADE the more-injured team ATS (air-share differential):")
ps("we 15%+ more air-out -> our ATS (expect fade)", d[d.air_diff>=15], "team_cover")
ps("opp 15%+ more air-out -> our ATS (expect back)", d[d.air_diff<=-15], "team_cover")
L("\n[B] INJURED FAVORITE ATS (favorite missing a key receiver):")
ps("favorite w/ key-rec-out: ATS", d[(d.kr==1)&(d.is_fav==1)], "team_cover")
ps("favorite w/ key-rec-out: ML(SU)", d[(d.kr==1)&(d.is_fav==1)], "su_win")
L("\n[C] BACK the OPPONENT of a key-receiver-out team ATS:")
ps("opp has key-rec-out -> our ATS", d[d.opp_kr==1], "team_cover")
ps("opp key-rec-out & we're dog -> ATS", d[(d.opp_kr==1)&(d.is_fav==0)], "team_cover")
L("\n[D] Facing an injured DEFENSE (opp_def high) -> ATS:")
ps("opp def-out top-quartile -> our ATS", d[d.opp_def>=d[d.opp_def>0].opp_def.quantile(.75)], "team_cover")
L("\n[E] QB starter OUT -> ATS / ML (vs close):")
ps("own QB out -> our ATS", d[d.qb_out==1], "team_cover")
ps("opp QB out -> our ATS (back us)", d[d.opp_qb==1], "team_cover")
# ML ROI for backing the opponent of a QB-out team (with real prices, vig-sane)
mlb=d[(d.opp_qb==1)&d.ml.notna()].copy()
mlb=mlb[mlb.ml.abs().between(100,2000)]
if len(mlb)>20:
    r=ml_roi(mlb,"su_win","ml"); L(f"   opp QB out -> back us ML: n={r['n']} hit={r.get('hit',0):.3f} roi={r.get('roi',0)*100:+.1f}% (impl_be~{r.get('avg_implied_be',0):.3f})")

L("\n[null] best-looking cut: opponent-of-key-rec-out ATS vs chance:")
sub=d[d.opp_kr==1].dropna(subset=["team_cover"]); real=sub.team_cover.mean(); n=len(sub)
allc=d.team_cover.dropna().values; nulls=[rng.choice(allc,n,replace=False).mean() for _ in range(4000)]
L(f"  ATS cover={real*100:.1f}% (n={n}) p(|dev|>=)={np.mean([abs(x-.5)>=abs(real-.5) for x in nulls]):.3f}")

# vs OPENER (2023-25): does fading the injured team beat the OPENING spread?
L("\n"+"="*88); L("vs OPENER (2023-25): injured-team ATS at the opening number"); L("="*88)
key=["season","home_ab","away_ab"] if "home_ab" in od.columns else None
oo=od.copy(); tm=pd.read_parquet(os.path.join(DATA,"team_mapping.parquet")); name2ab=dict(zip(tm.team_name,tm["Team Abbrev"]))
# odds_consensus uses our abbrev (LAR); games_enriched uses nflverse (LA). map nflverse->our for join
nv2our={"LA":"LAR","SD":"LAC","STL":"LAR","OAK":"OAK","LV":"LV"}
dd=d.copy(); dd["ab"]=dd.team.replace(nv2our); dd["opp_ab"]=dd.opp.replace(nv2our)
home=dd[dd.is_home==1].merge(oo[["season","home_ab","away_ab","open_spread","close_spread"]].rename(columns={"home_ab":"ab","away_ab":"opp_ab"}),on=["season","ab","opp_ab"],how="inner")
home["open_cov"]=np.where(home.result> -home.open_spread,1.0,np.where(home.result< -home.open_spread,0.0,np.nan))  # home covers open
# back the opponent of a home team with key-rec-out, vs OPEN
sub=home[home.kr==1].dropna(subset=["open_cov"])  # home team injured -> fade home = back away vs open
if len(sub)>=20:
    fade=1-sub.open_cov; k=int((fade==1).sum()); n=len(fade); lo,hi=wilson_ci(k,n)
    L(f"  fade injured home team vs OPEN spread: n={n} cover={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")
