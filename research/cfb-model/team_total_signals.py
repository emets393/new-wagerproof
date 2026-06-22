"""
TEAM-TOTAL signals (validated in team_total_model.py). Two team-points models, mutually-exclusive triggers:
  UNDER = ANCHORED model (fundamentals + adaptation + open lines) edge <= -3  (~54-56%, catches over-shaded totals)
  OVER  = UNANCHORED fundamentals model edge >= +6                  (~54%, catches lines set too low)
edge = pred_team_points - implied_team_total, implied = (total_close - team_spread)/2.
The two never both fire (mechanically exclusive). build(gm, season) -> per (game_id, team) bets for that season.
"""
import glob
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

_HERE = __file__.rsplit("/", 1)[0]


def _frame(gm):
    homecols = [c for c in gm.columns if c.startswith("home_")]
    bases = [c[5:] for c in homecols if ("away_" + c[5:]) in gm.columns]
    box = pd.concat([pd.read_parquet(f) for f in glob.glob(_HERE + "/data/cfbd/teamgame_box_*.parquet")], ignore_index=True)
    box["run_rate"] = box.rush_att / (box.rush_att + box.pass_att); box["sec_play"] = box.poss_secs / box.plays
    box = box.merge(gm[["season", "game_id", "date"]], on=["season", "game_id"], how="left").sort_values(["season", "team", "date"])
    g = box.groupby(["season", "team"], group_keys=False)
    box["id_run"] = g["run_rate"].apply(lambda s: s.shift().expanding().mean())
    box["id_pace"] = g["sec_play"].apply(lambda s: s.shift().expanding().mean())
    idd = box[["season", "game_id", "team", "id_run", "id_pace"]]
    rows = []
    for _, r in gm.iterrows():
        for who, opp in [("home", "away"), ("away", "home")]:
            d = {"season": r.season, "game_id": r.game_id, "team": r[f"{who}Team"], "week": r.week,
                 "neutralSite": int(bool(r.neutralSite)), "conferenceGame": int(bool(r.conferenceGame)),
                 "pts": r.homePoints if who == "home" else r.awayPoints, "total_open": r.total_open,
                 "tso": r.spread_open if who == "home" else -r.spread_open,
                 "tsc": r.spread_close if who == "home" else -r.spread_close, "total_close": r.total_close}
            for b in bases:
                d["self_" + b] = r[f"{who}_{b}"]; d["opp_" + b] = r[f"{opp}_{b}"]
            rows.append(d)
    T = pd.DataFrame(rows).merge(idd, on=["season", "game_id", "team"], how="left")
    selfopp = [c for c in T.columns if c.startswith("self_") or c.startswith("opp_")]
    for c in selfopp + ["week", "neutralSite", "conferenceGame", "id_run", "id_pace", "total_open", "tso"]:
        T[c] = pd.to_numeric(T[c], errors="coerce")
    FUND = [c for c in selfopp if c not in ("self_net_rating", "opp_net_rating")] + \
           ["week", "neutralSite", "conferenceGame", "id_run", "id_pace"]
    return T, FUND


def build(gm, season):
    T, FUND = _frame(gm)
    MKT = FUND + ["total_open", "tso"]
    tr = T[(T.season < season) & T.pts.notna()]
    te = T[(T.season == season) & T.total_close.notna()].copy()
    if not len(tr) or not len(te):
        return pd.DataFrame(columns=["season", "game_id", "team", "tt_under", "tt_over"])
    ma = HistGradientBoostingRegressor(max_iter=350, learning_rate=0.05, max_depth=5, l2_regularization=1.0, random_state=0).fit(tr[MKT], tr.pts)
    mf = HistGradientBoostingRegressor(max_iter=350, learning_rate=0.05, max_depth=5, l2_regularization=1.0, random_state=0).fit(tr[FUND], tr.pts)
    te["implied"] = (te.total_close - te.tsc) / 2
    te["anch_edge"] = ma.predict(te[MKT]) - te.implied      # <=-3 -> UNDER (anchored)
    te["fund_edge"] = mf.predict(te[FUND]) - te.implied     # >=+6 -> OVER (unanchored)
    te["tt_under"] = (te.anch_edge <= -3).astype(int)
    te["tt_over"] = (te.fund_edge >= 6).astype(int)
    return te[["season", "game_id", "team", "implied", "anch_edge", "fund_edge", "tt_under", "tt_over", "pts"]]
