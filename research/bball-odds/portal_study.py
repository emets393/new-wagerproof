#!/usr/bin/env python3
"""Transfer-portal / roster-continuity study, NCAAB (PORTAL_BRIEF1.md).

Hypothesis (from COMBO_BRIEF3 sleeper): the market is slow to rate rebuilt
(low-continuity) rosters — backing them early season wins ≈55%. Here we map
the full surface: home/away, month-by-month catch-up curve, continuity
percentile within season (portal era shifts the distribution), era split,
experience interaction, KenPom-rating interaction, ML and totals versions.

Continuity = KenPom season-end roster continuity (static roster attribute).
All bets at T-60 consensus; per-season shown. BE 52.4%.
"""
import os

import numpy as np
import pandas as pd

import style_matchup_study as sm
from combo3_study import height_table

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


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


def load():
    df = sm.load()
    names = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet",
                            columns=["gameId", "team", "isHome"]).drop_duplicates(
        ["gameId", "isHome"])
    ht = height_table()
    from name_maps import norm
    for side, is_home in (("h", True), ("a", False)):
        nm = names[names["isHome"] == is_home].rename(
            columns={"gameId": "game_key", "team": f"{side}_nm"})
        df = df.merge(nm[["game_key", f"{side}_nm"]], on="game_key", how="left")
        df[f"{side}_key"] = df[f"{side}_nm"].map(norm)
        hh = ht.rename(columns={"key": f"{side}_key",
                                **{c: f"{side}_{c}" for c in
                                   ("HgtEff", "Hgt5", "Exp", "Bench", "Continuity")}})
        df = df.merge(hh[[f"{side}_key", "season", f"{side}_Exp", f"{side}_Continuity"]],
                      on=[f"{side}_key", "season"], how="left")
    mgt = pd.read_parquet(f"{OUT}/movement_games_ncaab.parquet",
                          columns=["event_id", "commence_time",
                                   "t60_ml_home_price", "t60_ml_away_price"])
    df = df.merge(mgt, on="event_id", how="left")
    df["month"] = pd.to_datetime(df["commence_time"]).dt.month
    # continuity percentile WITHIN season (portal era shifted the whole distribution)
    for side in ("h", "a"):
        df[f"{side}_cont_pct"] = df.groupby("season")[f"{side}_Continuity"].rank(pct=True)
        df[f"{side}_exp_pct"] = df.groupby("season")[f"{side}_Exp"].rank(pct=True)
    return df.dropna(subset=["home_score", "t60_spread_home_point"]).copy()


def main():
    df = load()
    cover = (df["home_score"] - df["away_score"]) + df["t60_spread_home_point"]
    push = cover == 0
    total = df["home_score"] + df["away_score"]
    tline = df["t60_total_point"]
    has_t = tline.notna()
    won_a = df["away_score"] > df["home_score"]
    won_h = df["home_score"] > df["away_score"]
    no_push = pd.Series(False, index=df.index)

    lines = ["# Portal Brief #1 — roster continuity vs the market (NCAAB)",
             "",
             f"{len(df):,} games. Continuity pct = within-season rank. T-60 prices. BE 52.4%."]

    REBUILT = 0.25
    lines.append("\n## Backing rebuilt (low-continuity) rosters\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for side, w_ats, dec_ats, w_ml, dec_ml, tag in (
            ("a", cover < 0, df["t60_spread_away_price"], won_a, df["t60_ml_away_price"], "AWAY"),
            ("h", cover > 0, df["t60_spread_home_price"], won_h, df["t60_ml_home_price"], "HOME")):
        rb = df[f"{side}_cont_pct"] <= REBUILT
        for label, mask in (
                (f"rebuilt {tag}, Nov-Dec", rb & df["month"].isin([11, 12])),
                (f"rebuilt {tag}, Jan+", rb & ~df["month"].isin([11, 12]))):
            bet(df[mask], w_ats[mask], push[mask], dec_ats[mask],
                f"{label} → BACK ATS", lines)
        mask = rb & df["month"].isin([11, 12])
        bet(df[mask], w_ml[mask], no_push[mask], dec_ml[mask],
            f"rebuilt {tag}, Nov-Dec → ML", lines)

    lines.append("\n## Month-by-month catch-up curve (rebuilt AWAY, back ATS)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    rb_a = df["a_cont_pct"] <= REBUILT
    for m in (11, 12, 1, 2, 3):
        mask = rb_a & (df["month"] == m)
        bet(df[mask], (cover < 0)[mask], push[mask], df["t60_spread_away_price"][mask],
            f"month={m:02d} → BACK rebuilt AWAY", lines)

    lines.append("\n## Interactions\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    early = df["month"].isin([11, 12])
    combos = [
        ("rebuilt AWAY + EXPERIENCED (old transfers), Nov-Dec",
         rb_a & (df["a_exp_pct"] >= 0.6) & early, cover < 0, df["t60_spread_away_price"]),
        ("rebuilt AWAY + YOUNG, Nov-Dec",
         rb_a & (df["a_exp_pct"] <= 0.4) & early, cover < 0, df["t60_spread_away_price"]),
        ("rebuilt AWAY as DOG ≥4, Nov-Dec",
         rb_a & (df["t60_spread_home_point"] <= -4) & early, cover < 0, df["t60_spread_away_price"]),
        ("rebuilt AWAY as FAV, Nov-Dec",
         rb_a & (df["t60_spread_home_point"] > 0) & early, cover < 0, df["t60_spread_away_price"]),
        ("BOTH rebuilt, Nov-Dec (chaos game)",
         rb_a & (df["h_cont_pct"] <= REBUILT) & early, cover < 0, df["t60_spread_away_price"]),
        ("rebuilt vs HIGH-continuity home (max roster asymmetry), Nov-Dec",
         rb_a & (df["h_cont_pct"] >= 0.75) & early, cover < 0, df["t60_spread_away_price"]),
    ]
    for label, mask, w, dec in combos:
        bet(df[mask], w[mask], push[mask], dec[mask], f"{label} → BACK rebuilt", lines)

    # totals: rebuilt teams early = unders (no chemistry)?
    for label, mask in (
            ("rebuilt AWAY, Nov-Dec", rb_a & early),
            ("BOTH rebuilt, Nov-Dec", rb_a & (df["h_cont_pct"] <= REBUILT) & early)):
        bet(df[mask], (total < tline).where(has_t)[mask], (~has_t | (total == tline))[mask],
            df["t60_total_under_price"][mask], f"{label} → game UNDER", lines)
        bet(df[mask], (total > tline).where(has_t)[mask], (~has_t | (total == tline))[mask],
            df["t60_total_over_price"][mask], f"{label} → game OVER", lines)

    path = os.path.join(ROOT, "PORTAL_BRIEF1.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
