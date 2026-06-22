"""1H model signals (validated): NOSTR spread model (strength removed + nets, confirm 53.7%) and PRUNED-15
tempo totals model (55.8U/54.8O shopped). build(gm, season) -> per-game pm (h1 margin pred), pt (h1 total pred)."""
import numpy as np, pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
STR={"elo_diff","talent_diff","net_rating_diff","home_elo","away_elo","home_talent","away_talent","home_net_rating","away_net_rating"}
P15T=['home_poss_secs_pg','home_pass_yds_pg','home_points_pg','sum_off_epa','away_poss_secs_pg','home_first_downs_pg','away_talent','away_adj_rush_explosiveness_allowed','expected_plays','away_def_ppo','wx_wind','away_adj_passing_epa_allowed','home_adj_epa','home_last_pts_against','away_off_start']
def gbm(s=0): return HistGradientBoostingRegressor(max_iter=300,learning_rate=0.05,max_depth=4,l2_regularization=1.0,random_state=s)
def build(gm, feats, nets, season):
    g=gm.copy(); qs=[]
    import os
    for y in [2016,2017,2018,2019,2021,2022,2023,2024,2025,season]:
        p=f"data/cfbd/games_{y}.parquet"
        if not os.path.exists(p): continue
        d=pd.read_parquet(p)
        d["h1h"]=d.homeLineScores.apply(lambda a:sum(a[:2]) if a is not None and len(a)>=2 else np.nan)
        d["h1a"]=d.awayLineScores.apply(lambda a:sum(a[:2]) if a is not None and len(a)>=2 else np.nan)
        qs.append(d[["id","h1h","h1a"]].rename(columns={"id":"game_id"}))
    Q=pd.concat(qs).drop_duplicates("game_id")
    g=g.merge(Q,on="game_id",how="left")
    g["h1m"]=g.h1h-g.h1a; g["h1t"]=g.h1h+g.h1a
    FE=[f for f in feats if f not in STR]+nets
    tr=g[(g.season<season)&g.h1m.notna()]; te=g[g.season==season].copy()
    te["h1_pm"]=np.mean([gbm(s).fit(tr[FE],tr.h1m).predict(te[FE]) for s in range(5)],axis=0)
    te["h1_pt"]=gbm().fit(tr[tr.h1t.notna()][P15T],tr[tr.h1t.notna()].h1t).predict(te[P15T])
    return te[["season","game_id","h1_pm","h1_pt","h1m","h1t"]]
