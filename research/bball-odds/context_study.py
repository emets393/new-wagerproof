#!/usr/bin/env python3
"""Game-class + scheduling deep dive (CONTEXT_BRIEF1.md).

A. GAME CLASSES (the P5/G5 analog): power/mid/low conference pairings,
   blue-blood nonconference, ranked conference games, conference tournaments
   (TRNMNT+March), MTEs (TRNMNT+Nov/Dec), NCAA/NIT, neutral courts.
   Market-efficiency and MODEL-accuracy per class (does the model — or the
   market — degrade in small-school games?).

B. SCHEDULING done properly: travel distance (venue state centroids),
   cumulative 7-day trips, road-blowout-then-home spots, games-per-week,
   OT carryover, top-3-player minutes load (fatigue).

All bets T-60. BE 52.4%.
"""
import glob
import gzip
import json
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

POWER = {"B12", "B10", "SEC", "ACC", "BE"}
HIGHMID = {"MWC", "A10", "WCC", "AAC"}
BLUE = {"Duke", "Kentucky", "Kansas", "North Carolina", "UCLA", "Indiana",
        "Louisville", "Villanova", "UConn", "Michigan State", "Arizona", "Gonzaga"}

STATE_LL = {
 'AL':(32.8,-86.8),'AK':(64.0,-152.0),'AZ':(34.2,-111.6),'AR':(34.8,-92.4),
 'CA':(37.2,-119.3),'CO':(39.0,-105.5),'CT':(41.6,-72.7),'DE':(39.0,-75.5),
 'DC':(38.9,-77.0),'FL':(28.6,-82.4),'GA':(32.6,-83.4),'HI':(20.3,-156.4),
 'ID':(44.4,-114.6),'IL':(40.0,-89.2),'IN':(39.9,-86.3),'IA':(42.0,-93.5),
 'KS':(38.5,-98.4),'KY':(37.5,-85.3),'LA':(31.0,-92.0),'ME':(45.4,-69.2),
 'MD':(39.0,-76.8),'MA':(42.3,-71.8),'MI':(44.3,-85.4),'MN':(46.3,-94.3),
 'MS':(32.7,-89.7),'MO':(38.4,-92.5),'MT':(47.0,-109.6),'NE':(41.5,-99.8),
 'NV':(39.3,-116.6),'NH':(43.7,-71.6),'NJ':(40.2,-74.7),'NM':(34.4,-106.1),
 'NY':(42.9,-75.5),'NC':(35.6,-79.4),'ND':(47.4,-100.5),'OH':(40.3,-82.8),
 'OK':(35.6,-97.5),'OR':(43.9,-120.6),'PA':(40.9,-77.8),'RI':(41.7,-71.6),
 'SC':(33.9,-80.9),'SD':(44.4,-100.2),'TN':(35.9,-86.4),'TX':(31.5,-99.4),
 'UT':(39.3,-111.7),'VT':(44.1,-72.7),'VA':(37.5,-78.9),'WA':(47.4,-120.4),
 'WV':(38.6,-80.6),'WI':(44.6,-89.7),'WY':(43.0,-107.6)}


def haversine(a, b):
    if a is None or b is None:
        return np.nan
    la1, lo1 = np.radians(a)
    la2, lo2 = np.radians(b)
    h = np.sin((la2-la1)/2)**2 + np.cos(la1)*np.cos(la2)*np.sin((lo2-lo1)/2)**2
    return 3959 * 2 * np.arcsin(np.sqrt(h))


def venue_states():
    rows = []
    for path in glob.glob(f"{ROOT}/data/results_raw/ncaab/*.json.gz"):
        for g in json.load(gzip.open(path, "rt")):
            rows.append((g["id"], g.get("state")))
    return pd.DataFrame(rows, columns=["cbbd_id", "venue_state"]).drop_duplicates("cbbd_id")


def bet(df, win, push, dec, label, lines, min_n=50):
    ok = ~push & win.notna()
    n = int(ok.sum())
    if n < min_n:
        return
    w = win.fillna(False) & ok
    profit = np.where(~ok, 0.0, np.where(w, dec.fillna(1.909) - 1, -1.0))
    per = []
    for s, g in df.assign(w=w, ok=ok, pr=profit).groupby("season"):
        m = int(g["ok"].sum())
        if m:
            per.append(f"{s}: {g['w'].sum()}/{m} {g['w'].sum()/m*100:.0f}% {g[g['ok']]['pr'].mean()*100:+.0f}%")
    lines.append(f"| {label} | {n:,} | {w.sum()/n*100:.1f}% | "
                 f"{profit[ok].mean()*100:+.1f}% | {' · '.join(per)} |")


def load():
    df = pd.read_parquet(f"{OUT}/sides_table_ncaab.parquet")
    tb = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet").drop_duplicates("gameId")[
        ["gameId", "conference", "opponentConference", "gameType", "seasonType",
         "tournament"]].rename(columns={"gameId": "cbbd_id"})
    hb = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet").drop_duplicates(
        ["gameId", "isHome"])
    hconf = hb[hb["isHome"]][["gameId", "conference"]].rename(
        columns={"gameId": "cbbd_id", "conference": "h_conf"})
    aconf = hb[~hb["isHome"]][["gameId", "conference"]].rename(
        columns={"gameId": "cbbd_id", "conference": "a_conf"})
    df = df.merge(hconf, on="cbbd_id", how="left").merge(aconf, on="cbbd_id", how="left")
    df = df.merge(tb[["cbbd_id", "gameType", "seasonType", "tournament"]],
                  on="cbbd_id", how="left")
    df = df.merge(venue_states(), on="cbbd_id", how="left")
    ot_path = f"{OUT}/game_ot_ncaab.parquet"
    if os.path.exists(ot_path):
        ot = pd.read_parquet(ot_path).rename(columns={"gameId": "cbbd_id"})
        df = df.merge(ot[["cbbd_id", "went_ot"]], on="cbbd_id", how="left")
    else:
        df["went_ot"] = np.nan

    tier = lambda c: np.where(c.isin(POWER), 2, np.where(c.isin(HIGHMID), 1, 0))
    df["h_tier"] = tier(df["h_conf"])
    df["a_tier"] = tier(df["a_conf"])
    df["blue_game"] = (df["h_team"].isin(BLUE) | df["a_team"].isin(BLUE)).astype(int)
    df["conf_tourney"] = ((df["gameType"] == "TRNMNT") & (df["month"].isin([3]))
                          & (df["seasonType"] == "regular")).astype(int)
    df["mte"] = ((df["gameType"] == "TRNMNT") & df["month"].isin([11, 12])).astype(int)
    df["ncaa"] = (df["tournament"] == "NCAA").astype(int)
    df["ranked_conf"] = ((df["home_kp_rank"] <= 25) & (df["away_kp_rank"] <= 25)
                         & (df["conferenceGame"] == True)).astype(int)
    return df


def section_a(df, lines):
    lines.append("\n## A — game classes: market + model accuracy per segment\n")
    lines.append("| segment | n | home cover% | fav cover% | market MAE | model MAE | model win% at edge≥3 |")
    lines.append("|---|---|---|---|---|---|---|")
    import model_lab as ml
    e = ml.engineered(df)
    dfm = pd.concat([df, e], axis=1)
    dfm["is_conf"] = dfm["conferenceGame"].astype(float)
    G = ml.groups(dfm)
    pruned = G["kp_raw"] + G["style"] + list(e.columns)
    best = dict(learning_rate=0.05, max_leaf_nodes=15, min_samples_leaf=80, max_iter=700)
    preds = pd.Series(np.nan, index=dfm.index)
    for ts, trs in (("2023-24", ["2022-23"]), ("2024-25", ml.TRAIN),
                    ("2025-26", ml.TRAIN + [ml.VAL])):
        _, _, _, _, p = ml.fit_eval(dfm, pruned, best, train_seasons=trs, eval_season=ts)
        preds.loc[dfm["season"] == ts] = p
    dfm["pred"] = preds
    te = dfm[dfm["pred"].notna()]

    segs = [
        ("POWER vs POWER conf", (te["h_tier"] == 2) & (te["a_tier"] == 2) & (te["conferenceGame"] == True)),
        ("LOW vs LOW conf", (te["h_tier"] == 0) & (te["a_tier"] == 0) & (te["conferenceGame"] == True)),
        ("POWER vs LOW (buy games)", ((te["h_tier"] == 2) & (te["a_tier"] == 0)) | ((te["h_tier"] == 0) & (te["a_tier"] == 2))),
        ("blue-blood games", te["blue_game"] == 1),
        ("ranked conf games", te["ranked_conf"] == 1),
        ("conference tournaments", te["conf_tourney"] == 1),
        ("MTEs (Nov/Dec TRNMNT)", te["mte"] == 1),
        ("NCAA tournament", te["ncaa"] == 1),
        ("neutral courts (all)", te["neutralSite"] == True),
    ]
    for label, mask in segs:
        s = te[mask]
        if len(s) < 80:
            continue
        nopush = s["cover_amt"] != 0
        hc = (s["cover_amt"] > 0)[nopush].mean() * 100
        fav = np.where(s["t60_spread_home_point"] < 0, s["cover_amt"] > 0, s["cover_amt"] < 0)
        favc = fav[nopush].mean() * 100
        mkt = np.abs(s["margin"] + s["t60_spread_home_point"]).mean()
        mod = np.abs(s["margin"] - s["pred"]).mean()
        edge = s["pred"] + s["t60_spread_home_point"]
        big = (np.abs(edge) >= 3) & nopush
        cov = np.where(edge > 0, s["cover_amt"] > 0, s["cover_amt"] < 0)
        wr = cov[big].mean() * 100 if big.sum() > 40 else np.nan
        lines.append(f"| {label} | {len(s):,} | {hc:.1f}% | {favc:.1f}% | {mkt:.2f} | "
                     f"{mod:.2f} | {wr:.1f}% (n={int(big.sum())}) |")
    return dfm


def section_b(df, lines):
    # per-team schedule frame
    long = []
    for side, sign in (("h", True), ("a", False)):
        long.append(pd.DataFrame({
            "team": df[f"{side}_team"], "season": df["season"],
            "date": pd.to_datetime(df["date_et"]), "event_id": df["event_id"],
            "side": side, "venue_state": df["venue_state"],
            "is_home": (df["neutralSite"] != True) & (side == "h"),
            "margin": df["margin"] * (1 if side == "h" else -1),
            "went_ot": df["went_ot"].fillna(False)}))
    t = pd.concat(long, ignore_index=True).sort_values(["team", "season", "date"])
    home_state = t[t["is_home"]].groupby("team")["venue_state"].agg(
        lambda s: s.mode().iloc[0] if len(s.mode()) else None)
    t["home_state"] = t["team"].map(home_state)
    ll = lambda s: STATE_LL.get(s)
    t["dist_from_home"] = [haversine(ll(a), ll(b)) for a, b in
                           zip(t["home_state"], t["venue_state"])]
    g = t.groupby(["team", "season"])
    t["prev_state"] = g["venue_state"].shift(1)
    t["leg_dist"] = [haversine(ll(a), ll(b)) for a, b in
                     zip(t["prev_state"], t["venue_state"])]
    t["prev_margin"] = g["margin"].shift(1)
    t["prev_ot"] = g["went_ot"].shift(1)
    t["prev_dist_home"] = g["dist_from_home"].shift(1)
    t["days_since"] = g["date"].transform(lambda s: s.diff().dt.days)
    # games + travel in last 7 days
    t["g7"] = 0.0
    t["trip7"] = 0.0
    for (team, season), sub in g:
        d = sub["date"].values
        legs = sub["leg_dist"].fillna(0).values
        g7, t7 = [], []
        for i in range(len(sub)):
            w = (d[i] - d[:i]).astype("timedelta64[D]").astype(int) <= 7
            g7.append(w.sum())
            t7.append(legs[:i][w].sum() if i else 0)
        t.loc[sub.index, "g7"] = g7
        t.loc[sub.index, "trip7"] = t7

    # star minutes load (top-3 prior mins, minutes last 7 days)
    pb = pd.read_parquet(f"{OUT}/cbbd_player_box.parquet").drop_duplicates(
        ["gameId", "athleteSourceId"])
    pb["date"] = pd.to_datetime(pb["startDate"]).dt.tz_localize(None)
    pb["tkey"] = pb["team"]
    pb = pb.sort_values(["athleteSourceId", "date"])
    pb["prior_mins"] = pb.groupby(["athleteSourceId", "season"])["minutes"].transform(
        lambda s: s.shift(1).expanding(min_periods=3).mean())
    # merge onto team-frame later is heavy; approximate team star-load with the
    # sum of minutes among players with prior_mins >= 28 over the last 7 days
    stars = pb[pb["prior_mins"] >= 28][["tkey", "date", "minutes"]]
    sload = stars.groupby(["tkey", "date"])["minutes"].sum().reset_index()
    sload = sload.sort_values(["tkey", "date"])
    out = []
    for team, sub in sload.groupby("tkey"):
        d = sub["date"].values
        m = sub["minutes"].values
        for i in range(len(sub)):
            w = ((d[i] - d[:i]).astype("timedelta64[D]").astype(int) <= 7) \
                & ((d[i] - d[:i]).astype("timedelta64[D]").astype(int) > 0)
            out.append((team, d[i], m[:i][w].sum()))
    sl = pd.DataFrame(out, columns=["team", "date", "star_mins_7d"])
    t = t.merge(sl, on=["team", "date"], how="left")

    for side in ("h", "a"):
        m = t[t["side"] == side][["event_id", "dist_from_home", "leg_dist", "trip7",
                                  "g7", "prev_margin", "prev_ot", "prev_dist_home",
                                  "days_since", "star_mins_7d"]]
        m.columns = ["event_id"] + [f"{side}_{c}" for c in m.columns[1:]]
        df = df.merge(m, on="event_id", how="left")

    cover = df["cover_amt"]
    push = cover == 0
    hdec, adec = df["t60_spread_home_price"], df["t60_spread_away_price"]
    lines.append("\n## B — scheduling deep dive\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    combos = [
        ("away LONG trip (≥1200mi from home)", df["a_dist_from_home"] >= 1200, "h"),
        ("away trip7 ≥2000mi (road warrior fatigue)", df["a_trip7"] >= 2000, "h"),
        ("HOME after road blowout loss (≤-15 away)", (df["h_prev_margin"] <= -15)
         & (df["h_prev_dist_home"] > 200), "h"),
        ("HOME after road blowout loss → fade", (df["h_prev_margin"] <= -15)
         & (df["h_prev_dist_home"] > 200), "a"),
        ("team 3+ games in 7 days (home)", df["h_g7"] >= 3, "a"),
        ("team 3+ games in 7 days (away)", df["a_g7"] >= 3, "h"),
        ("played OT last game (home) → fade", df["h_prev_ot"] == True, "a"),
        ("played OT last game (away) → fade", df["a_prev_ot"] == True, "h"),
        ("OT last + short rest (≤2d) away → fade", (df["a_prev_ot"] == True)
         & (df["a_days_since"] <= 2), "h"),
        ("star minutes load ≥95 last 7d (away) → fade", df["a_star_mins_7d"] >= 95, "h"),
        ("star minutes load ≥95 last 7d (home) → fade", df["h_star_mins_7d"] >= 95, "a"),
    ]
    for label, mask, side in combos:
        win = (cover > 0) if side == "h" else (cover < 0)
        dec = hdec if side == "h" else adec
        bet(df[mask.fillna(False)], win[mask.fillna(False)] & ~push[mask.fillna(False)],
            push[mask.fillna(False)], dec[mask.fillna(False)], label, lines)
    return df


def main():
    df = load()
    lines = ["# Context Brief #1 — game classes + scheduling deep dive (NCAAB)",
             "", f"{len(df):,} games. T-60 prices. BE 52.4%."]
    dfm = section_a(df, lines)
    section_b(df, lines)
    with open(os.path.join(ROOT, "CONTEXT_BRIEF1.md"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote CONTEXT_BRIEF1.md", flush=True)


if __name__ == "__main__":
    main()
