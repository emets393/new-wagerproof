#!/usr/bin/env python3
"""
Intersections: live-line state (view-shift grid) x turnover/last-possession
tells (owner request 2026-09-12). NFL 2023-25.

Registered family (each with a football rationale, judged vs its PARENT):
  A big-fav-crashed (spot 2, dog ~57%) split by WHY:
    A1 crash + dog CONVERTED a takeaway (earned it)     -> dog stronger?
    A2 crash + dog had gifts but cashed NONE            -> fav bounce-back?
  B fav-blowout (spot 1, fav 64%) split by HOW the lead was built:
    B1 blowout + fav converted takeaway(s) (gifted lead) -> weaker?
    B2 blowout + no fav takeaway points (earned lead)    -> stronger?
  C squandered-gift (fav late TO + dog no points, fav 68.6%) x live state:
    C1 ... AND fav's live line crashed (<= -2 shift)     -> discounted fav?
    C2 ... AND fav still on/ahead of pace (> -2)
  D dog-blew-all-takeaways (fav 55.8%) x fav behind pace (<= -2) -> value fav?
"""
import os
import numpy as np
import pandas as pd

import exp_2h_nfl_deep as D
from exp_2h_turnovers import turnover_flags

PBP = os.path.join(D.X.NFLX, "data", "pbp_cache")


def last_poss():
    rows = []
    for y in (2023, 2024, 2025):
        p = pd.read_parquet(os.path.join(PBP, f"pbp_{y}.parquet"),
            columns=["game_id", "qtr", "posteam", "fixed_drive", "fixed_drive_result", "qb_kneel"])
        h1 = p[(p.qtr <= 2) & p.posteam.notna()]
        dm = h1.groupby(["game_id", "fixed_drive"]).agg(
            team=("posteam", "first"), res=("fixed_drive_result", "first"),
            kneels=("qb_kneel", "sum"), npl=("qb_kneel", "size")).reset_index()
        ko = ((dm.kneels > 0) & (dm.kneels >= dm.npl - 1)) | dm.res.isin(["End of half", "End of game"])
        dm["dcat"] = np.select([dm.res == "Touchdown", dm.res == "Field goal",
            dm.res.isin(["Turnover", "Interception", "Fumble", "Turnover on downs"]),
            dm.res == "Missed field goal", dm.res == "Punt"],
            ["TD", "FG", "TO", "MISS_FG", "PUNT"], default="NOINFO")
        dm.loc[ko, "dcat"] = "NOINFO"
        last = dm[dm.dcat != "NOINFO"].sort_values("fixed_drive").groupby(["game_id", "team"]).tail(1).copy()
        dres = dm.set_index(["game_id", "fixed_drive"]).res
        resp = []
        for _, r in last.iterrows():
            if r["dcat"] != "TO":
                resp.append("NA"); continue
            nxt = dres.get((r["game_id"], r["fixed_drive"] + 1))
            resp.append("TD" if nxt == "Touchdown" else ("FG" if nxt == "Field goal" else "NONE"))
        last["to_resp"] = resp
        rows.append(last)
    return pd.concat(rows, ignore_index=True).set_index(["game_id", "team"])


def main():
    d = D.load()
    sp_diff = d.h2m + d.close_h2_spread
    wh = pd.Series(np.where(sp_diff == 0, np.nan, (sp_diff > 0).astype(float)), index=d.index)
    d = d[d.fg_sp != 0].copy()
    fav_home = d.fg_sp < 0
    parts = d.game_id.str.split("_")
    d["home_pb"], d["away_pb"] = parts.str[3], parts.str[2]
    d["fav_pb"] = np.where(fav_home, d.home_pb, d.away_pb)
    d["dog_pb"] = np.where(fav_home, d.away_pb, d.home_pb)
    d["fav_cov"] = np.where(fav_home, wh.loc[d.index], 1 - wh.loc[d.index])
    d["fav_lay"] = d.fg_sp.abs()
    fav_h2line = np.where(fav_home, -d.close_h2_spread, d.close_h2_spread)
    d["shift_v"] = np.where(fav_home, d.h1m, -d.h1m) + fav_h2line - d.fav_lay

    to = turnover_flags()
    agg = to.groupby(["game_id", "team"]).agg(n_to=("conv", "size"), n_conv=("conv", "sum")).reset_index()
    ag = agg.set_index(["game_id", "team"])
    for s_, tc in (("dog", "dog_pb"), ("fav", "fav_pb")):
        idx = pd.MultiIndex.from_arrays([d.game_id, d[tc]])
        d[f"{s_}_to"] = ag.n_to.reindex(idx).fillna(0).values
        d[f"{s_}_conv"] = ag.n_conv.reindex(idx).fillna(0).values
    lp = last_poss()
    idxf = pd.MultiIndex.from_arrays([d.game_id, d.fav_pb])
    d["fav_dcat"] = lp.dcat.reindex(idxf).values
    d["fav_resp"] = lp.to_resp.reindex(idxf).values

    def cell(name, m, side_is_dog, parent=""):
        w = pd.Series((1 - d.fav_cov) if side_is_dog else d.fav_cov, index=d.index)
        mm = pd.Series(m, index=d.index) & w.notna()
        n = int(mm.sum())
        if n < 15:
            print(f"{name:58s} n={n} (tiny)")
            return
        ww = w[mm].astype(float)
        per = " | ".join(f"{yr}:{100*ww[d.season[mm]==yr].mean():.0f}%" for yr in sorted(d.season[mm].unique()))
        print(f"{name:58s} n={n:3d}  win {100*ww.mean():.1f}%  {parent}   {per}")

    crash = (d.fav_lay >= 6.5) & (d.shift_v <= -7)
    blow = (d.fav_lay >= 3) & (d.fav_lay <= 6) & (d.shift_v >= 7)
    sq = (d.fav_dcat == "TO") & (d.fav_resp == "NONE")
    u2 = (d.dog_to > 0) & (d.dog_conv == 0)

    print("== A: big fav crashed (parent: DOG 55.8%) ==")
    cell("A1 crash + dog CONVERTED a takeaway: bet DOG", crash & (d.dog_conv > 0), True, "[parent 55.8]")
    cell("A2 crash + dog blew its takeaways: bet FAV", crash & u2, False, "[flip of parent]")
    cell("A3 crash + dog had NO takeaway: bet DOG", crash & (d.dog_to == 0), True, "[parent 55.8]")
    print("\n== B: 3-6 fav blowout (parent: FAV 64.0%) ==")
    cell("B1 blowout + fav scored off takeaway(s): bet FAV", blow & (d.fav_conv > 0), False, "[parent 64.0]")
    cell("B2 blowout + NO fav takeaway points (earned): bet FAV", blow & (d.fav_conv == 0), False, "[parent 64.0]")
    print("\n== C: squandered gift (parent: FAV 68.6%) x live state ==")
    cell("C1 squander + fav line crashed (shift<=-2): bet FAV", sq & (d.shift_v <= -2), False, "[parent 68.6]")
    cell("C2 squander + fav on/ahead of pace: bet FAV", sq & (d.shift_v > -2), False, "[parent 68.6]")
    print("\n== D: dog blew ALL takeaways (parent: FAV 55.8%) x state ==")
    cell("D1 ... AND fav behind pace (shift<=-2): bet FAV", u2 & (d.shift_v <= -2), False, "[parent 55.8]")
    cell("D2 ... AND fav on/ahead of pace: bet FAV", u2 & (d.shift_v > -2), False, "[parent 55.8]")


if __name__ == "__main__":
    main()
