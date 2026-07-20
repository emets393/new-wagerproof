import numpy as np, pandas as pd, glob, warnings
warnings.filterwarnings("ignore")
DEC=1.909
ga=pd.concat([pd.read_parquet(f) for f in glob.glob("data/cfbd/game_advanced_20*.parquet")],ignore_index=True).rename(columns={"gameId":"game_id"})
ga=ga[["game_id","team","offense.ppa"]].rename(columns={"offense.ppa":"off_ppa"})
tg=pd.read_parquet("data/cfb_team_games_profiled.parquet")
opp=tg[["game_id","team","DEF_type"]].rename(columns={"team":"opponent","DEF_type":"opp_DEF"})
tg=tg.merge(opp,on=["game_id","opponent"],how="left").merge(ga,on=["game_id","team"],how="left")
mk=pd.read_parquet("data/cfb_markets_2325.parquet")
tg=tg.merge(mk[["game_id","team","tt_over","team_pts","tt_line"]],on=["game_id","team"],how="left")
tg=tg.sort_values(["season","team","week"]).reset_index(drop=True)
D,NP=[],[]
for (s,t),sub in tg.groupby(["season","team"]):
    sub=sub.sort_values("week"); ppa=sub.off_ppa.values; od=sub.opp_DEF.values
    for i in range(len(sub)):
        pp=ppa[:i]; pd_=od[:i]; base=np.nanmean(pp) if i>0 and np.isfinite(pp).any() else np.nan
        m=(pd_==od[i])&np.isfinite(pp); vs=np.nanmean(pp[m]) if m.sum()>0 else np.nan
        D.append(vs-base if np.isfinite(vs) and np.isfinite(base) else np.nan); NP.append(int(m.sum()))
tg["delta"]=D; tg["n_priors_vs"]=NP
e=tg[tg.n_priors_vs>=2].copy()
def st(d,col,hi):
    d=d.dropna(subset=[col]);
    if not len(d):return None
    p=d[col].mean() if hi else 1-d[col].mean(); by=d.groupby("season")[col].apply(lambda x:x.mean() if hi else 1-x.mean())
    return f"{p*100:5.1f}%  n={len(d):5d}  ROI {(p*DEC-1)*100:+6.1f}  seasons {(by>=0.5).sum()}/{by.notna().sum()} [{round(by.min()*100)}-{round(by.max()*100)}]"
print("GAME UNDER dose-response (underperformers, 2016-25, dedup game):")
for thr in [-0.03,-0.05,-0.10,-0.15]:
    print(f"  delta<= {thr:+.2f}: ",st(e[e.delta<=thr].drop_duplicates("game_id"),"over",False))
print("  complement over-performers -> OVER:")
for thr in [0.05,0.10]:
    print(f"  delta>= {thr:+.2f}: ",st(e[e.delta>=thr].drop_duplicates("game_id"),"over",True))
print("\nTEAM-TOTAL UNDER dose-response (2023-25):")
for thr in [-0.03,-0.05,-0.10,-0.15]:
    print(f"  delta<= {thr:+.2f}: ",st(e[e.delta<=thr],"tt_over",False))
print("\nMECHANISM (is the number inflated? actual - line):")
for lbl,d in [("underperf delta<=-.10 (team total)",e[e.delta<=-0.10].dropna(subset=["tt_over"])),
              ("baseline eligible (team total)",e.dropna(subset=["tt_over"]))]:
    print(f"  {lbl:38s}: line {d.tt_line.mean():.1f} actual {d.team_pts.mean():.1f} diff {d.team_pts.mean()-d.tt_line.mean():+.2f} n={len(d)}")
g=e[e.delta<=-0.10].drop_duplicates("game_id").dropna(subset=["over"]); b=e.drop_duplicates("game_id").dropna(subset=["over"])
print(f"  {'underperf game total':38s}: line {g.total_close.mean():.1f} actual {g.actual_total.mean():.1f} diff {g.actual_total.mean()-g.total_close.mean():+.2f} n={len(g)}")
print(f"  {'baseline game total':38s}: line {b.total_close.mean():.1f} actual {b.actual_total.mean():.1f} diff {b.actual_total.mean()-b.total_close.mean():+.2f}")
