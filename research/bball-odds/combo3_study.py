#!/usr/bin/env python3
"""Combo round 3 (COMBO_BRIEF3.md): height/experience architecture, bench-depth
tiers on availability, season-phase splits, rest interactions, NBA star-vs-role
big tiers.

KenPom height/exp/bench/continuity are season-end roster attributes (static-ish
within a season — mild threshold leak, flagged). Everything graded at T-60.
"""
import os

import numpy as np
import pandas as pd

import availability_study as av
import style_matchup_study as sm
from name_maps import norm, kp_to_cbbd

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
HI, LO = 0.70, 0.30


def bet(df, win, push, dec, label, lines, min_n=30):
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


def height_table():
    h = pd.read_parquet(f"{OUT}/kenpom_height.parquet")
    h["key"] = h["TeamName"].map(kp_to_cbbd).map(norm)
    h["season"] = (h["Season"] - 1).astype(str) + "-" + h["Season"].astype(str).str[2:]
    return h[["key", "season", "HgtEff", "Hgt5", "Exp", "Bench", "Continuity"]]


def cbb_game_frame():
    df = sm.load()  # spine + market + TT cons + style pcts both sides
    names = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet",
                            columns=["gameId", "team", "isHome"]).drop_duplicates(
        ["gameId", "isHome"])
    ht = height_table()
    for side, is_home in (("h", True), ("a", False)):
        nm = names[names["isHome"] == is_home].rename(
            columns={"gameId": "game_key", "team": f"{side}_team_cbbd"})
        df = df.merge(nm[["game_key", f"{side}_team_cbbd"]], on="game_key", how="left")
        df[f"{side}_key"] = df[f"{side}_team_cbbd"].map(norm)
        hh = ht.rename(columns={"key": f"{side}_key",
                                **{c: f"{side}_{c}" for c in
                                   ("HgtEff", "Hgt5", "Exp", "Bench", "Continuity")}})
        df = df.merge(hh, on=[f"{side}_key", "season"], how="left")
    df["month"] = pd.to_datetime(df["event_id"].map(
        pd.read_parquet(f"{OUT}/movement_games_ncaab.parquet",
                        columns=["event_id", "commence_time"])
        .set_index("event_id")["commence_time"])).dt.month
    df["phase"] = np.where(df["month"].isin([11, 12]), "nonconf", "conf")
    return df


def cbb_height_exp(df, lines):
    total = df["home_score"] + df["away_score"]
    tline = df["t60_total_point"]
    has_t = tline.notna()
    cover = (df["home_score"] - df["away_score"]) + df["t60_spread_home_point"]
    push = cover == 0

    df["hgt_diff"] = df["h_HgtEff"] - df["a_HgtEff"]
    df["c_diff"] = df["h_Hgt5"] - df["a_Hgt5"]
    df["exp_diff"] = df["h_Exp"] - df["a_Exp"]

    lines.append("\n## CBB height / experience architecture\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    q9, q1 = df["hgt_diff"].quantile([0.9, 0.1])
    for label, mask, side in (
            (f"TALL home vs small away (eff hgt diff ≥{q9:.1f})", df["hgt_diff"] >= q9, "h"),
            (f"TALL away vs small home (diff ≤{q1:.1f})", df["hgt_diff"] <= q1, "a")):
        own = df["t60_spread_home_price"] if side == "h" else df["t60_spread_away_price"]
        win = (cover > 0) if side == "h" else (cover < 0)
        bet(df[mask], win[mask], push[mask], own[mask], f"{label} → BACK TALL ATS", lines)
        bet(df[mask], (total < tline).where(has_t)[mask], (~has_t | (total == tline))[mask],
            df["t60_total_under_price"][mask], f"{label} → game UNDER", lines)
    # tall + paint-heavy vs small (architecture exploit)
    for att, deff in (("h", "a"), ("a", "h")):
        mask = ((df[f"{att}_Hgt5"] - df[f"{deff}_Hgt5"] >= df["c_diff"].abs().quantile(0.8))
                & (df[f"{att}_pct_paint_share"] >= HI))
        if att == "a":
            mask = ((df[f"{att}_Hgt5"] - df[f"{deff}_Hgt5"]) >= df["c_diff"].abs().quantile(0.8)) \
                   & (df[f"{att}_pct_paint_share"] >= HI)
        win = (cover > 0) if att == "h" else (cover < 0)
        own = df["t60_spread_home_price"] if att == "h" else df["t60_spread_away_price"]
        bet(df[mask], win[mask], push[mask], own[mask],
            f"BIG CENTER + paint-heavy ({att}) vs small → BACK ATS", lines)
    # experience in nonconf vs conf
    q9e = df["exp_diff"].quantile(0.9)
    for phase in ("nonconf", "conf"):
        mask = (df["exp_diff"] >= q9e) & (df["phase"] == phase)
        bet(df[mask], (cover > 0)[mask], push[mask], df["t60_spread_home_price"][mask],
            f"EXPERIENCED home vs young away, {phase} → BACK HOME ATS", lines)
    # continuity: new roster early season
    q1c = df["h_Continuity"].quantile(0.15)
    mask = (df["h_Continuity"] <= q1c) & (df["phase"] == "nonconf")
    bet(df[mask], (cover < 0)[mask], push[mask], df["t60_spread_away_price"][mask],
        "LOW-continuity home roster, nonconf → FADE HOME", lines)
    mask = (df["a_Continuity"] <= q1c) & (df["phase"] == "nonconf")
    bet(df[mask], (cover > 0)[mask], push[mask], df["t60_spread_home_price"][mask],
        "LOW-continuity away roster, nonconf → FADE AWAY", lines)


def cbb_phase_and_bench(lines):
    df = av.team_view("ncaab")
    st = pd.read_parquet(f"{OUT}/style_ncaab.parquet")
    pct = st[["game_key", "is_home", "pct_paint_share"]]
    df["att_is_home"] = ~df["is_home"].astype(bool)
    df = df.merge(pct.rename(columns={"is_home": "att_is_home",
                                      "pct_paint_share": "att_paint"}),
                  on=["game_key", "att_is_home"], how="left")
    ht = height_table()
    names = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet",
                            columns=["gameId", "teamId", "team"]).drop_duplicates(
        ["gameId", "teamId"])
    df = df.merge(names.rename(columns={"gameId": "game_key", "teamId": "team_id",
                                        "team": "own_name"}),
                  on=["game_key", "team_id"], how="left")
    df["own_key"] = df["own_name"].map(norm)
    df = df.merge(ht.rename(columns={"key": "own_key", "Bench": "own_bench",
                                     "Hgt5": "own_hgt5"})[
        ["own_key", "season", "own_bench", "own_hgt5"]], on=["own_key", "season"], how="left")
    df["month"] = pd.to_datetime(df["date"]).dt.month
    df["phase"] = np.where(df["month"].isin([10, 11, 12]), "nonconf", "conf")

    margin = df["home_score"] - df["away_score"]
    cover = margin + df["t60_spread_home_point"]
    att_cover = pd.Series(np.where(df["att_is_home"], cover > 0, cover < 0), index=df.index)
    push = cover == 0
    att_dec = pd.Series(np.where(df["att_is_home"], df["t60_spread_home_price"],
                                 df["t60_spread_away_price"]), index=df.index)

    lines.append("\n## CBB big_out fade: phase splits + bench-depth tiers\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    base = df["big_out"] > 0
    for label, mask in (
            ("big_out, NONCONF (Nov-Dec)", base & (df["phase"] == "nonconf")),
            ("big_out, CONFERENCE (Jan+)", base & (df["phase"] == "conf")),
            ("big_out × THIN bench (own bench ≤30th pct)",
             base & (df["own_bench"] <= df["own_bench"].quantile(0.3))),
            ("big_out × DEEP bench (≥70th)",
             base & (df["own_bench"] >= df["own_bench"].quantile(0.7))),
            ("big_out × TALL center lost (own Hgt5 ≥70th)",
             base & (df["own_hgt5"] >= df["own_hgt5"].quantile(0.7))),
            ("PREMIUM (×paint attacker) NONCONF",
             base & (df["att_paint"] >= HI) & (df["phase"] == "nonconf")),
            ("PREMIUM (×paint attacker) CONFERENCE",
             base & (df["att_paint"] >= HI) & (df["phase"] == "conf")),
            ("PREMIUM × thin bench",
             base & (df["att_paint"] >= HI)
             & (df["own_bench"] <= df["own_bench"].quantile(0.5)))):
        bet(df[mask], att_cover[mask], push[mask], att_dec[mask],
            f"{label} → BACK attacker", lines)

    # rest interaction: attacker rested vs flagged team on short rest
    df = df.sort_values(["team_key", "gidx"])
    df["own_rest"] = df.groupby("team_key")["date"].transform(lambda s: s.diff().dt.days)
    for label, mask in (
            ("big_out × flagged team short rest (≤2d)", base & (df["own_rest"] <= 2)),
            ("big_out × flagged team rested (≥4d)", base & (df["own_rest"] >= 4))):
        bet(df[mask], att_cover[mask], push[mask], att_dec[mask],
            f"{label} → BACK attacker", lines)


def nba_star_tiers(lines):
    df = av.team_view("nba")
    st = pd.read_parquet(f"{OUT}/style_nba.parquet")
    df["att_is_home"] = ~df["is_home"].astype(bool)
    att = st[["game_key", "is_home", "pct_ftr", "pct_pace"]].rename(
        columns={"is_home": "att_is_home", "pct_ftr": "att_ftr", "pct_pace": "att_pace"})
    df = df.merge(att, on=["game_key", "att_is_home"], how="left")

    total = df["home_score"] + df["away_score"]
    tline = df["t60_total_point"]
    has_t = tline.notna()
    opush = ~has_t | (total == tline)

    lines.append("\n## NBA big_out → game OVER: star vs role tiers\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    star = (df["big_out"] > 0) & (df["top1_out"] > 0)   # top-mins AND top-reb out
    role = (df["big_out"] > 0) & (df["top1_out"] == 0)
    for label, mask in (
            ("STAR big out (also top-minutes)", star),
            ("ROLE big out (not top-minutes)", role),
            ("ROLE big × att FT-drawing hi", role & (df["att_ftr"] >= HI)),
            ("STAR big × att FT-drawing hi", star & (df["att_ftr"] >= HI)),
            ("ROLE big × att pace hi", role & (df["att_pace"] >= HI)),
            ("multi regulars out (≥2) any", df["reg_out_n"] >= 2),
            ("multi out × att pace ≥50th", (df["reg_out_n"] >= 2) & (df["att_pace"] >= .5))):
        sub = df[mask]
        bet(sub, (total > tline).where(has_t)[mask], opush[mask],
            df["t60_total_over_price"][mask], f"{label} → game OVER", lines)


def main():
    lines = ["# Combo Brief #3 — height/exp architecture, phase, bench, rest, NBA star tiers",
             "",
             "KenPom height/exp/bench/continuity = season-end roster attributes (static-ish;",
             "mild threshold caveat). T-60 prices. BE 52.4%."]
    df = cbb_game_frame()
    cbb_height_exp(df, lines)
    cbb_phase_and_bench(lines)
    nba_star_tiers(lines)
    path = os.path.join(ROOT, "COMBO_BRIEF3.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
