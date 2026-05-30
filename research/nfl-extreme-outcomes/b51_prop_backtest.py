"""
Backtest the two stable b50 signals as PROP PRIORS on 2025 actuals (leak-safe: priors are 2023-24 only).
1) QB UNDER: man-struggler (prior EPA vs man in bottom quartile) facing man-heavy + pressure-strong D
   -> expect actual passing yards << player's own non-spot baseline
2) WR OVER:  zone-killer (prior EPA on zone-no-pressure in top quartile) facing zone-heavy + pressure-weak D
   -> expect actual receiving yards >> baseline
Method: leave-one-out baseline (game excluded from its own player's avg), t-test spot vs same-player non-spot
games, and report the per-game roster honestly.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from scipy import stats
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); L=print
sp=pd.read_parquet(os.path.join(DATA,"scheme_plays.parquet"))
px=pd.read_parquet(os.path.join(DATA,"players_xwalk.parquet"))[["gsis_id","display_name"]]
nm=dict(zip(px.gsis_id,px.display_name))
def nn(p): return nm.get(p,p) if isinstance(p,str) else ""

# --- PRIORS from 2023-24, scheme-labeled pass plays only ---
lab=sp[(sp["pass"]==1)&sp.defense_man_zone_type.isin(["MAN_COVERAGE","ZONE_COVERAGE"])].copy()
lab["mz"]=np.where(lab.defense_man_zone_type=="MAN_COVERAGE","M","Z")
lab["pr"]=pd.to_numeric(lab.was_pressure,errors="coerce").fillna(0).astype(int)
lab["epa"]=pd.to_numeric(lab.epa,errors="coerce")
pri=lab[lab.season.isin([2023,2024])]

qb_pri=pri[pri.mz=="M"].groupby("passer_player_id").agg(n=("epa","size"),epa_vs_man=("epa","mean")).reset_index()
qb_pri=qb_pri[qb_pri.n>=60]
qb_pri["name"]=qb_pri.passer_player_id.map(nn)
q_lo=qb_pri.epa_vs_man.quantile(0.25); q_hi=qb_pri.epa_vs_man.quantile(0.75)
L(f"[priors] QB-vs-MAN EPA: {len(qb_pri)} QBs. Q25={q_lo:+.3f} (man-strugglers ≤ this), Q75={q_hi:+.3f}")

wr_pri=pri[(pri.mz=="Z")&(pri.pr==0)&pri.receiver_player_id.notna()].groupby("receiver_player_id").agg(n=("epa","size"),epa_zNP=("epa","mean")).reset_index()
wr_pri=wr_pri[wr_pri.n>=40]
wr_pri["name"]=wr_pri.receiver_player_id.map(nn)
w_lo=wr_pri.epa_zNP.quantile(0.25); w_hi=wr_pri.epa_zNP.quantile(0.75)
L(f"[priors] WR zone-no-pressure EPA: {len(wr_pri)} WRs. Q75={w_hi:+.3f} (zone-killers ≥ this)")

# Defense PRIOR rates (2023-24): man-rate, pressure-rate, zone-rate
dpri=lab[lab.season.isin([2023,2024])].groupby("defteam").agg(
    n=("epa","size"), man_rate=("mz",lambda s:(s=="M").mean()), pressure_rate=("pr","mean")).reset_index()
dpri["zone_rate"]=1-dpri.man_rate
dl_man=dpri.man_rate.quantile(0.75); dl_pr_hi=dpri.pressure_rate.quantile(0.75)
dl_zone=dpri.zone_rate.quantile(0.75); dl_pr_lo=dpri.pressure_rate.quantile(0.25)
L(f"[priors] DEF: man-heavy (Q75)≥{dl_man*100:.0f}%, pressure-strong (Q75)≥{dl_pr_hi*100:.0f}%, zone-heavy≥{dl_zone*100:.0f}%, pressure-weak (Q25)≤{dl_pr_lo*100:.0f}%")

# --- 2025 OUTCOMES (all pass plays, scheme-labeled where avail) ---
p25=sp[(sp["pass"]==1)&(sp.season==2025)].copy()
p25["yds"]=pd.to_numeric(p25.yards_gained,errors="coerce").fillna(0)
p25["cp"]=pd.to_numeric(p25.complete_pass,errors="coerce").fillna(0)
# QB per-game passing yards = sum yards on completed passes (matches prop convention)
qb25=p25[p25.cp==1].groupby(["game_id","passer_player_id","posteam","defteam","week"]).agg(
    pass_yds=("yds","sum")).reset_index()
qb_att=p25.groupby(["game_id","passer_player_id"]).size().rename("att").reset_index()
qb25=qb25.merge(qb_att,on=["game_id","passer_player_id"]); qb25=qb25[qb25.att>=15]
qb25["name"]=qb25.passer_player_id.map(nn)

wr25=p25[(p25.cp==1)&p25.receiver_player_id.notna()].groupby(
    ["game_id","receiver_player_id","posteam","defteam","week"]).agg(rec_yds=("yds","sum")).reset_index()
wr_tg=p25.dropna(subset=["receiver_player_id"]).groupby(["game_id","receiver_player_id"]).size().rename("tgts").reset_index()
wr25=wr25.merge(wr_tg,on=["game_id","receiver_player_id"]); wr25=wr25[wr25.tgts>=3]
wr25["name"]=wr25.receiver_player_id.map(nn)

# --- attach priors + define spots ---
qb=qb25.merge(qb_pri[["passer_player_id","epa_vs_man"]],on="passer_player_id",how="inner").merge(dpri[["defteam","man_rate","pressure_rate"]],on="defteam",how="left")
wr=wr25.merge(wr_pri[["receiver_player_id","epa_zNP"]],on="receiver_player_id",how="inner").merge(dpri[["defteam","zone_rate","pressure_rate"]],on="defteam",how="left")

# leave-one-out player baseline
def loo(df, key, col):
    g=df.groupby(key)[col]; s=g.transform("sum"); c=g.transform("size")
    return np.where(c>1,(s-df[col])/(c-1),np.nan)
qb["base"]=loo(qb,"passer_player_id","pass_yds"); qb["diff"]=qb.pass_yds-qb.base
wr["base"]=loo(wr,"receiver_player_id","rec_yds"); wr["diff"]=wr.rec_yds-wr.base

qb["spot"]=((qb.epa_vs_man<=q_lo)&(qb.man_rate>=dl_man)&(qb.pressure_rate>=dl_pr_hi)).astype(int)
wr["spot"]=((wr.epa_zNP>=w_hi)&(wr.zone_rate>=dl_zone)&(wr.pressure_rate<=dl_pr_lo)).astype(int)

L("\n"+"="*88); L("QB UNDER backtest: man-struggler (prior bottom-quartile vs man) vs man-heavy + pressure-strong D"); L("="*88)
s=qb[qb.spot==1].dropna(subset=["diff"]); c=qb[qb.spot==0].dropna(subset=["diff"])
L(f"  SPOT     n={len(s):3d} | actual yds {s.pass_yds.mean():5.1f}  vs LOO baseline {s.base.mean():5.1f}  diff {s['diff'].mean():+6.1f}  (median diff {s['diff'].median():+6.1f})")
L(f"  CONTROL  n={len(c):3d} | actual yds {c.pass_yds.mean():5.1f}  vs LOO baseline {c.base.mean():5.1f}  diff {c['diff'].mean():+6.1f}  (median diff {c['diff'].median():+6.1f})")
if len(s)>=5:
    t,pv=stats.ttest_ind(s["diff"],c["diff"],equal_var=False); L(f"  t-test: t={t:.2f}, p={pv:.4f} ({'SIGNIFICANT' if pv<0.05 else 'not sig'})")
    under=(s["diff"]<0).sum(); L(f"  UNDER baseline: {under}/{len(s)} = {under/len(s)*100:.1f}% (vs 50% null)")
    L("\n  spot games (sorted by diff ascending — biggest UNDER first):")
    L(f"  {'QB':22s} {'wk':>3s} matchup       {'yds':>4s} {'base':>5s} {'diff':>5s}  prior(EPA/M)  D(man%,pr%)")
    for _,r in s.sort_values("diff").iterrows():
        L(f"  {r['name']:22s} {int(r.week):3d} {r.posteam}@{r.defteam:3s}        {int(r.pass_yds):4d} {r.base:5.0f} {r['diff']:+5.0f}     {r.epa_vs_man:+.3f}     {r.man_rate*100:.0f}%, {r.pressure_rate*100:.0f}%")

L("\n"+"="*88); L("WR OVER backtest: zone-killer (prior top-quartile zone-no-pressure) vs zone-heavy + pressure-weak D"); L("="*88)
s=wr[wr.spot==1].dropna(subset=["diff"]); c=wr[wr.spot==0].dropna(subset=["diff"])
L(f"  SPOT     n={len(s):3d} | actual yds {s.rec_yds.mean():5.1f}  vs LOO baseline {s.base.mean():5.1f}  diff {s['diff'].mean():+6.1f}  (median diff {s['diff'].median():+6.1f})")
L(f"  CONTROL  n={len(c):3d} | actual yds {c.rec_yds.mean():5.1f}  vs LOO baseline {c.base.mean():5.1f}  diff {c['diff'].mean():+6.1f}  (median diff {c['diff'].median():+6.1f})")
if len(s)>=5:
    t,pv=stats.ttest_ind(s["diff"],c["diff"],equal_var=False); L(f"  t-test: t={t:.2f}, p={pv:.4f} ({'SIGNIFICANT' if pv<0.05 else 'not sig'})")
    over=(s["diff"]>0).sum(); L(f"  OVER baseline: {over}/{len(s)} = {over/len(s)*100:.1f}% (vs 50% null)")
    L("\n  spot games (sorted by diff descending — biggest OVER first):")
    L(f"  {'WR':22s} {'wk':>3s} matchup       {'yds':>4s} {'base':>5s} {'diff':>5s}  prior(EPA/Z-NP) D(zone%,pr%)")
    for _,r in s.sort_values("diff",ascending=False).iterrows():
        L(f"  {r['name']:22s} {int(r.week):3d} {r.posteam}@{r.defteam:3s}        {int(r.rec_yds):4d} {r.base:5.0f} {r['diff']:+5.0f}     {r.epa_zNP:+.3f}        {r.zone_rate*100:.0f}%, {r.pressure_rate*100:.0f}%")

# Sensitivity: try looser thresholds to see if signal survives bigger samples
L("\n"+"="*88); L("SENSITIVITY: vary thresholds, track spot diff vs control diff"); L("="*88)
def sweep(df, target, prior_col, prior_dir, def_cols, label):
    rows=[]
    for q in [0.10,0.15,0.20,0.25,0.30,0.35]:
        if prior_dir=="lo": cut=df[prior_col].quantile(q); pmask=df[prior_col]<=cut
        else: cut=df[prior_col].quantile(1-q); pmask=df[prior_col]>=cut
        dmask=np.ones(len(df),bool)
        for c,d,q2 in def_cols:
            t=dpri[c].quantile(1-q2 if d=="hi" else q2); dmask &= (df[c]>=t if d=="hi" else df[c]<=t)
        sp=df[pmask & dmask].dropna(subset=["diff"])
        co=df[~(pmask & dmask)].dropna(subset=["diff"])
        if len(sp)>=5:
            t,pv=stats.ttest_ind(sp["diff"],co["diff"],equal_var=False)
            rows.append((q,len(sp),sp["diff"].mean(),co["diff"].mean(),pv))
    L(f"\n  {label}")
    L(f"  {'qpct':>5s} {'n_spot':>7s} {'spot_diff':>10s} {'ctrl_diff':>10s} {'p':>7s}")
    for q,n,sd,cd,pv in rows: L(f"  {q:5.2f} {n:7d} {sd:+10.1f} {cd:+10.1f} {pv:7.4f}")
sweep(qb,"pass_yds","epa_vs_man","lo",[("man_rate","hi",0.25),("pressure_rate","hi",0.25)],"QB UNDER")
sweep(wr,"rec_yds","epa_zNP","hi",[("zone_rate","hi",0.25),("pressure_rate","lo",0.25)],"WR OVER")
