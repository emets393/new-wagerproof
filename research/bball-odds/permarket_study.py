#!/usr/bin/env python3
"""Per-market feature engineering + per-market ablations (PERMARKET_BRIEF.md).

Stops the kitchen-sink: each market gets candidate feature GROUPS and we
measure, per market, which groups carry information (ablation deltas on the
validation season) — then bet-test the best per-market model.

New features built here (never used before):
  1H-SPECIFIC (from plays, period==1): prior 1H pace, 1H off/def efficiency,
    1H three-rate, front-load index (1H share of scoring).
  STARTER-UNIT (from player box `starter` flag): starters' prior scoring
    share + starter ppg vs bench (1H is starter-dominated).
  TT-ASYMMETRIC: home-TT candidates = home OFFENSE + away DEFENSE only.

Markets: 1H spread, 1H total, home TT, away TT.
Protocol: train 22-23+23-24, validate 24-25; walk-forward bet test at the end.
"""
import glob
import os

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

import model_lab as ml
import context_study as cs
from movement_study import am_to_dec

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def build_1h_team_features():
    path = f"{OUT}/h1_team_profiles.parquet"
    if os.path.exists(path):
        return pd.read_parquet(path)
    frames = []
    for p in sorted(glob.glob(f"{OUT}/plays_ncaab_*.parquet")):
        pl = pd.read_parquet(p, columns=["gameId", "teamId", "isHomeTeam", "season",
                                         "period", "playType", "shootingPlay",
                                         "scoringPlay", "scoreValue", "shot_range"])
        h1 = pl[pl["period"] == 1]
        is_fga = h1["shootingPlay"] & h1["shot_range"].notna() & (h1["shot_range"] != "free_throw")
        is_ft = h1["shot_range"] == "free_throw"
        is_to = h1["playType"].str.contains("Turnover", na=False)
        is_oreb = h1["playType"] == "Offensive Rebound"
        pts = np.where(h1["scoringPlay"].fillna(False), h1["scoreValue"].fillna(0), 0)
        c = h1.assign(fga=is_fga.astype(int), fta=is_ft.astype(int),
                      to=is_to.astype(int), oreb=is_oreb.astype(int), pts=pts,
                      three=(h1["shot_range"] == "three_pointer").astype(int))
        g = c.groupby(["gameId", "teamId", "season"]).agg(
            fga=("fga", "sum"), fta=("fta", "sum"), to=("to", "sum"),
            oreb=("oreb", "sum"), pts=("pts", "sum"), three=("three", "sum")).reset_index()
        frames.append(g)
    t = pd.concat(frames, ignore_index=True)
    t["poss1h"] = t["fga"] - t["oreb"] + t["to"] + 0.475 * t["fta"]
    t["off1h"] = t["pts"] / t["poss1h"].replace(0, np.nan) * 100
    t["three_rate1h"] = t["three"] / t["fga"].replace(0, np.nan)

    opp = t[["gameId", "teamId", "pts", "poss1h"]].copy()
    opp.columns = ["gameId", "opp_id", "opp_pts", "opp_poss"]
    m = t.merge(opp, on="gameId")
    m = m[m["teamId"] != m["opp_id"]].drop_duplicates(["gameId", "teamId"])
    m["def1h"] = m["opp_pts"] / m["opp_poss"].replace(0, np.nan) * 100

    dates = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet",
                            columns=["gameId", "teamId", "startDate",
                                     "teamStats.points.total"]
                            ).drop_duplicates(["gameId", "teamId"])
    m = m.merge(dates, on=["gameId", "teamId"], how="left")
    m["date"] = pd.to_datetime(m["startDate"]).dt.tz_localize(None)
    m["front_load"] = m["pts"] / m["teamStats.points.total"].replace(0, np.nan)
    m["tkey"] = m["teamId"].astype(str) + "_" + m["season"].astype(str)
    m = m.sort_values(["tkey", "date"])
    g = m.groupby("tkey")
    for c in ("poss1h", "off1h", "def1h", "three_rate1h", "front_load"):
        m[f"p_{c}"] = g[c].transform(lambda s: s.shift(1).expanding(min_periods=4).mean())
    keep = m[["gameId", "teamId"] + [f"p_{c}" for c in
              ("poss1h", "off1h", "def1h", "three_rate1h", "front_load")]]
    keep.to_parquet(path, index=False)
    print(f"h1_team_profiles: {len(keep):,}", flush=True)
    return keep


def build_starter_features():
    path = f"{OUT}/starter_units.parquet"
    if os.path.exists(path):
        return pd.read_parquet(path)
    pb = pd.read_parquet(f"{OUT}/cbbd_player_box.parquet",
                         columns=["gameId", "teamId", "athleteSourceId", "startDate",
                                  "season", "starter", "points", "minutes"]
                         ).drop_duplicates(["gameId", "athleteSourceId"])
    pb["date"] = pd.to_datetime(pb["startDate"]).dt.tz_localize(None)
    g = pb.groupby(["gameId", "teamId", "season"])
    agg = g.agg(team_pts=("points", "sum")).reset_index()
    st = pb[pb["starter"] == True].groupby(["gameId", "teamId"]).agg(
        starter_pts=("points", "sum"), starter_min=("minutes", "sum")).reset_index()
    agg = agg.merge(st, on=["gameId", "teamId"], how="left")
    d = pb[["gameId", "teamId", "date"]].drop_duplicates(["gameId", "teamId"])
    agg = agg.merge(d, on=["gameId", "teamId"])
    agg["starter_share"] = agg["starter_pts"] / agg["team_pts"].replace(0, np.nan)
    agg["tkey"] = agg["teamId"].astype(str) + "_" + agg["season"].astype(str)
    agg = agg.sort_values(["tkey", "date"])
    gg = agg.groupby("tkey")
    for c in ("starter_share", "starter_pts"):
        agg[f"p_{c}"] = gg[c].transform(lambda s: s.shift(1).expanding(min_periods=4).mean())
    keep = agg[["gameId", "teamId", "p_starter_share", "p_starter_pts"]]
    keep.to_parquet(path, index=False)
    print(f"starter_units: {len(keep):,}", flush=True)
    return keep


def main():
    df = cs.load()
    e = ml.engineered(df)
    df = pd.concat([df, e], axis=1)
    df["is_conf"] = df["conferenceGame"].astype(float)
    df["is_neutral"] = (df["neutralSite"] == True).astype(float)
    G = ml.groups(df)
    klass = ["is_neutral", "is_conf", "h_tier", "a_tier", "blue_game",
             "conf_tourney", "mte", "ncaa", "ranked_conf", "month"]

    h1f = build_1h_team_features()
    stf = build_starter_features()
    poss = pd.read_parquet(f"{OUT}/possession_team_games.parquet")
    pcols = [c for c in poss.columns if c.startswith("p_")]
    for side, is_home in (("h", True), ("a", False)):
        s = h1f.rename(columns={"gameId": "cbbd_id", "teamId": f"{side}_team_id",
                                **{c: f"{side}_{c}" for c in h1f.columns[2:]}})
        df = df.merge(s, on=["cbbd_id", f"{side}_team_id"], how="left")
        s2 = stf.rename(columns={"gameId": "cbbd_id", "teamId": f"{side}_team_id",
                                 **{c: f"{side}_{c}" for c in stf.columns[2:]}})
        df = df.merge(s2, on=["cbbd_id", f"{side}_team_id"], how="left")
        s3 = poss[poss["isHomeTeam"] == is_home][["gameId"] + pcols]
        s3.columns = ["cbbd_id"] + [f"{side}_{c}" for c in pcols]
        df = df.merge(s3, on="cbbd_id", how="left")

    h = pd.concat([pd.read_parquet(p) for p in
                   sorted(glob.glob(f"{OUT}/h1tt_ncaab_*.parquet"))], ignore_index=True)
    for c in ("h1_spread_home_price", "h1_spread_away_price", "h1_total_over_price",
              "h1_total_under_price", "tt_home_over_price", "tt_home_under_price",
              "tt_away_over_price", "tt_away_under_price"):
        h[c] = am_to_dec(h[c])
    cons = h.groupby("event_id")[[c for c in h.columns if c.startswith(("h1_", "tt_"))
                                  and c != "h1_total_actual"]].median(numeric_only=True)
    df = df.merge(cons, on="event_id", how="left")
    df["h1_margin"] = df["home_h1"] - df["away_h1"]
    df["h1_total"] = df["home_h1"] + df["away_h1"]

    # feature groups per market
    kp = G["kp_raw"]
    style = G["style"]
    eng = list(e.columns)
    h1_spec = [c for c in df.columns if "_p_poss1h" in c or "_p_off1h" in c
               or "_p_def1h" in c or "_p_three_rate1h" in c or "_p_front_load" in c]
    starters = [c for c in df.columns if "_p_starter_" in c]
    poss_f = [c for c in df.columns if "_p_adj_game_" in c or "_p_rim_" in c
              or "_p_three_pct" in c or "_p_ftr" in c]
    home_off = [c for c in kp + style + poss_f + eng if c.startswith(("home_kp_oe", "h_"))
                and "d_" not in c] + ["home_kp_tempo"]
    away_def = [c for c in kp + style + poss_f if c.startswith("away_kp_de")
                or (c.startswith("a_") and ("d_" in c or "alwd" in c))]
    away_off = [c for c in kp + style + poss_f + eng if c.startswith(("away_kp_oe", "a_"))
                and "d_" not in c] + ["away_kp_tempo"]
    home_def = [c for c in kp + style + poss_f if c.startswith("home_kp_de")
                or (c.startswith("h_") and ("d_" in c or "alwd" in c))]

    MARKETS = {
        "1H margin": ("h1_margin", {"kp": kp, "engineered": eng, "style": style,
                                    "1h_specific": h1_spec, "starters": starters,
                                    "class": klass}),
        "1H total": ("h1_total", {"kp": kp, "engineered": eng, "style": style,
                                  "1h_specific": h1_spec, "starters": starters,
                                  "class": klass}),
        "home TT": ("home_score", {"kp": kp, "asym(homeO+awayD)": home_off + away_def,
                                   "style": style, "possession": poss_f,
                                   "class": klass}),
        "away TT": ("away_score", {"kp": kp, "asym(awayO+homeD)": away_off + home_def,
                                   "style": style, "possession": poss_f,
                                   "class": klass}),
    }
    best = dict(learning_rate=0.05, max_leaf_nodes=15, min_samples_leaf=80, max_iter=700)

    lines = ["# Per-Market Brief — which features matter to which market",
             "", "Train 22-23+23-24, validate 24-25. Cell = val MAE (delta vs all-groups)."]
    for mkt, (target, groups) in MARKETS.items():
        allf = sorted(set(sum(groups.values(), [])))
        tr = df[df["season"].isin(ml.TRAIN) & df[target].notna()]
        te = df[(df["season"] == ml.VAL) & df[target].notna()]
        def run(feats):
            m = HistGradientBoostingRegressor(**best, l2_regularization=1.0, random_state=7)
            m.fit(tr[feats], tr[target])
            return np.abs(te[target] - m.predict(te[feats])).mean()
        base = run(allf)
        lines.append(f"\n## {mkt} (target {target}) — ALL groups: {base:.3f}\n")
        lines.append("| variant | val MAE | delta |")
        lines.append("|---|---|---|")
        for gname, cols in groups.items():
            drop = [c for c in allf if c not in cols]
            only = sorted(set(cols))
            if not only:
                continue
            mae_minus = run(drop) if drop else np.nan
            mae_only = run(only)
            lines.append(f"| minus {gname} | {mae_minus:.3f} | {mae_minus-base:+.3f} |")
            lines.append(f"| ONLY {gname} | {mae_only:.3f} | {mae_only-base:+.3f} |")
        print(f"[{mkt}] done", flush=True)

    with open(os.path.join(ROOT, "PERMARKET_BRIEF.md"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote PERMARKET_BRIEF.md", flush=True)


if __name__ == "__main__":
    main()
