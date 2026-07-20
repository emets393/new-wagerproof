#!/usr/bin/env python3
"""Architecture combo battery #2, NCAAB (STYLE_BRIEF2.md).

Availability × style tiers:
  guard_out (flagged team) × opponent TO-FORCING defense — the owner's
    turnover scenario as an interaction
  big_out × opponent OREB-heavy offense (second-chance feast)
New standalone architecture clashes:
  TO-prone offense vs TO-forcing defense (possession bleed)
  OREB-heavy offense vs weak defensive rebounding
  3-heavy UNDERDOG (variance play: threes help dogs cover/win)
  pace battles (fast vs slow: who imposes; both-fast, both-slow)
  5-channel composite (3P/paint/FT/OREB/TO) both-advantaged -> game over

All strictly-prior profiles; bets at T-60 consensus; per-season shown.
"""
import glob
import os

import numpy as np
import pandas as pd

import availability_study as av
from movement_study import am_to_dec

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


def availability_tiers(lines):
    df = av.team_view("ncaab")
    st = pd.read_parquet(f"{OUT}/style_ncaab.parquet")
    pct_cols = [c for c in st.columns if c.startswith("pct_")]

    # attacker = opponent of the flagged team
    df["att_is_home"] = ~df["is_home"].astype(bool)
    att = st[["game_key", "is_home"] + pct_cols].rename(
        columns={"is_home": "att_is_home", **{c: f"att_{c}" for c in pct_cols}})
    df = df.merge(att, on=["game_key", "att_is_home"], how="left")
    own = st[["game_key", "is_home"] + pct_cols].rename(
        columns={**{c: f"own_{c}" for c in pct_cols}})
    df = df.merge(own, on=["game_key", "is_home"], how="left")

    margin = df["home_score"] - df["away_score"]
    cover = margin + df["t60_spread_home_point"]
    att_cover = pd.Series(np.where(df["att_is_home"], cover > 0, cover < 0), index=df.index)
    push = cover == 0
    att_dec = pd.Series(np.where(df["att_is_home"], df["t60_spread_home_price"],
                                 df["t60_spread_away_price"]), index=df.index)
    att_pts = pd.Series(np.where(df["att_is_home"], df["home_score"], df["away_score"]),
                        index=df.index)
    att_ttl = pd.Series(np.where(df["att_is_home"], df["tt_home_point"],
                                 df["tt_away_point"]), index=df.index)
    att_tto = pd.Series(np.where(df["att_is_home"], df["tt_home_over_price"],
                                 df["tt_away_over_price"]), index=df.index)
    total = df["home_score"] + df["away_score"]
    has_tt = att_ttl.notna()

    lines.append("\n## Availability × style tiers (flagged team's opponent = attacker)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")

    combos = [
        ("guard_out × att TO-FORCING D hi", (df["guard_out"] > 0) & (df["att_pct_d_to_forced"] >= HI)),
        ("guard_out × att TO-forcing NOT hi", (df["guard_out"] > 0) & (df["att_pct_d_to_forced"] < HI)),
        ("lowto_guard_out × att TO-FORCING D hi", (df["lowto_guard_out"] > 0) & (df["att_pct_d_to_forced"] >= HI)),
        ("lowto_guard_out × att TO-forcing NOT hi", (df["lowto_guard_out"] > 0) & (df["att_pct_d_to_forced"] < HI)),
        ("big_out × att OREB-heavy hi", (df["big_out"] > 0) & (df["att_pct_oreb"] >= HI)),
        ("big_out × att OREB NOT hi", (df["big_out"] > 0) & (df["att_pct_oreb"] < HI)),
        ("big_out × att paint OR oreb hi", (df["big_out"] > 0)
         & ((df["att_pct_oreb"] >= HI) | (df["att_pct_paint_share"] >= HI))),
        ("guard_out × own TO-prone hi (fragile handle)", (df["guard_out"] > 0) & (df["own_pct_to_rate"] >= HI)),
    ]
    for label, mask in combos:
        sub = df[mask]
        bet(sub, att_cover[mask], push[mask], att_dec[mask], f"{label} → BACK attacker ATS", lines)
        bet(sub, (att_pts > att_ttl).where(has_tt)[mask], (~has_tt | (att_pts == att_ttl))[mask],
            att_tto[mask], f"{label} → attacker TT OVER", lines)

    tline = df["t60_total_point"]
    has_t = tline.notna()
    for label, mask in [("guard_out × att TO-FORCING D hi", (df["guard_out"] > 0) & (df["att_pct_d_to_forced"] >= HI))]:
        sub = df[mask]
        bet(sub, (total < tline).where(has_t)[mask], (~has_t | (total == tline))[mask],
            df["t60_total_under_price"][mask], f"{label} → game UNDER", lines)


def standalone_combos(lines):
    st = pd.read_parquet(f"{OUT}/style_ncaab.parquet")
    pct_cols = [c for c in st.columns if c.startswith("pct_")]
    spine = pd.read_parquet(f"{OUT}/games_ncaab.parquet").dropna(subset=["cbbd_id"])
    spine = spine[["event_id", "cbbd_id"]].rename(columns={"cbbd_id": "game_key"})
    mg = pd.read_parquet(f"{OUT}/movement_games_ncaab.parquet")[
        ["event_id", "season", "home_score", "away_score",
         "t60_spread_home_point", "t60_spread_home_price", "t60_spread_away_price",
         "t60_total_point", "t60_total_over_price", "t60_total_under_price",
         "t60_ml_home_price", "t60_ml_away_price"]]
    df = spine.merge(mg, on="event_id")
    h = pd.concat([pd.read_parquet(p) for p in
                   sorted(glob.glob(f"{OUT}/h1tt_ncaab_*.parquet"))], ignore_index=True)
    for c in ("tt_home_over_price", "tt_home_under_price",
              "tt_away_over_price", "tt_away_under_price"):
        h[c] = am_to_dec(h[c])
    cons = h.groupby("event_id")[["tt_home_point", "tt_home_over_price",
                                  "tt_home_under_price", "tt_away_point",
                                  "tt_away_over_price", "tt_away_under_price"]].median()
    df = df.merge(cons, on="event_id", how="left")
    for side, is_home in (("h", True), ("a", False)):
        s = st[st["is_home"] == is_home][["game_key"] + pct_cols]
        s.columns = ["game_key"] + [f"{side}_{c}" for c in pct_cols]
        df = df.merge(s, on="game_key", how="left")
    df = df.dropna(subset=["home_score", "t60_spread_home_point",
                           "h_pct_pace", "a_pct_pace"]).copy()

    total = df["home_score"] + df["away_score"]
    tline = df["t60_total_point"]
    has_t = tline.notna()
    cover = (df["home_score"] - df["away_score"]) + df["t60_spread_home_point"]

    def team_frame(att):
        deff = "a" if att == "h" else "h"
        return {
            "cover": (cover > 0) if att == "h" else (cover < 0),
            "push": cover == 0,
            "own": df["t60_spread_home_price"] if att == "h" else df["t60_spread_away_price"],
            "pts": df["home_score"] if att == "h" else df["away_score"],
            "ttl": df["tt_home_point"] if att == "h" else df["tt_away_point"],
            "tto": df["tt_home_over_price"] if att == "h" else df["tt_away_over_price"],
            "ttu": df["tt_home_under_price"] if att == "h" else df["tt_away_under_price"],
            "ml": df["t60_ml_home_price"] if att == "h" else df["t60_ml_away_price"],
            "spread": df["t60_spread_home_point"] * (1 if att == "h" else -1),
            "won": (df["home_score"] > df["away_score"]) if att == "h"
                   else (df["away_score"] > df["home_score"]),
            "o": lambda c: df[f"{att}_pct_{c}"],
            "d": lambda c: df[f"{deff}_pct_{c}"],
        }

    lines.append("\n## New architecture clashes (attacker perspective, home+away pooled per row)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for att in ("h", "a"):
        tag = "HOME" if att == "h" else "AWAY"
        f = team_frame(att)
        has_tt = f["ttl"].notna()
        clashes = [
            (f"TO-prone O vs TO-FORCING D ({tag})", (f["o"]("to_rate") >= HI) & (f["d"]("d_to_forced") >= HI)),
            (f"OREB-heavy O vs weak DREB ({tag})", (f["o"]("oreb") >= HI) & (f["d"]("d_oreb_allowed") >= HI)),
            (f"clean-handle O vs TO-FORCING D ({tag})", (f["o"]("to_rate") <= LO) & (f["d"]("d_to_forced") >= HI)),
        ]
        for label, mask in clashes:
            sub = df[mask]
            bet(sub, (f["pts"] > f["ttl"]).where(has_tt)[mask],
                (~has_tt | (f["pts"] == f["ttl"]))[mask], f["tto"][mask],
                f"{label} → TT OVER", lines)
            bet(sub, (f["pts"] < f["ttl"]).where(has_tt)[mask],
                (~has_tt | (f["pts"] == f["ttl"]))[mask], f["ttu"][mask],
                f"{label} → TT UNDER", lines)
            bet(sub, f["cover"][mask] & ~f["push"][mask], f["push"][mask], f["own"][mask],
                f"{label} → BACK ATS", lines)

        # 3-heavy dog variance play
        for dog_lo in (4, 7):
            mask = (f["o"]("p3_share") >= HI) & (f["spread"] >= dog_lo)
            sub = df[mask]
            bet(sub, f["cover"][mask] & ~f["push"][mask], f["push"][mask], f["own"][mask],
                f"3-HEAVY DOG +{dog_lo}+ ({tag}) → BACK ATS", lines)
            no_push = pd.Series(False, index=df.index)
            bet(sub, f["won"][mask], no_push[mask], f["ml"][mask],
                f"3-HEAVY DOG +{dog_lo}+ ({tag}) → DOG ML", lines)
            mask2 = (f["o"]("p3_share") <= LO) & (f["spread"] >= dog_lo)
            sub2 = df[mask2]
            bet(sub2, f["cover"][mask2] & ~f["push"][mask2], f["push"][mask2], f["own"][mask2],
                f"LOW-3 DOG +{dog_lo}+ ({tag}) → BACK ATS (contrast)", lines)

    lines.append("\n## Pace battles + 5-channel composite\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    fast_h_slow_a = (df["h_pct_pace"] >= HI) & (df["a_pct_pace"] <= LO)
    slow_h_fast_a = (df["h_pct_pace"] <= LO) & (df["a_pct_pace"] >= HI)
    both_fast = (df["h_pct_pace"] >= HI) & (df["a_pct_pace"] >= HI)
    both_slow = (df["h_pct_pace"] <= LO) & (df["a_pct_pace"] <= LO)
    for label, mask in (("fast HOME vs slow AWAY", fast_h_slow_a),
                        ("slow HOME vs fast AWAY", slow_h_fast_a),
                        ("both FAST", both_fast), ("both SLOW", both_slow)):
        sub = df[mask]
        bet(sub, (total > tline).where(has_t)[mask], (~has_t | (total == tline))[mask],
            df["t60_total_over_price"][mask], f"{label} → game OVER", lines)
        bet(sub, (total < tline).where(has_t)[mask], (~has_t | (total == tline))[mask],
            df["t60_total_under_price"][mask], f"{label} → game UNDER", lines)

    CH5 = (("p3_share", "d_p3_pct"), ("paint_share", "d_paint100"), ("ftr", "d_ftr"),
           ("oreb", "d_oreb_allowed"), ("to_rate", "d_to_forced"))
    for side, opp in (("h", "a"), ("a", "h")):
        adv = sum((df[f"{side}_pct_{oc}"] - .5) * (df[f"{opp}_pct_{dc}"] - .5)
                  * (-1 if oc == "to_rate" else 1)  # TO-prone vs TO-forcing = DISadvantage
                  for oc, dc in CH5)
        df[f"{side}_adv5"] = adv
    both_adv5 = ((df["h_adv5"] >= df["h_adv5"].quantile(0.8))
                 & (df["a_adv5"] >= df["a_adv5"].quantile(0.8)))
    sub = df[both_adv5]
    bet(sub, (total > tline).where(has_t)[both_adv5], (~has_t | (total == tline))[both_adv5],
        df["t60_total_over_price"][both_adv5], "BOTH adv (5-channel composite) → game OVER", lines)
    both_dis5 = ((df["h_adv5"] <= df["h_adv5"].quantile(0.2))
                 & (df["a_adv5"] <= df["a_adv5"].quantile(0.2)))
    sub = df[both_dis5]
    bet(sub, (total < tline).where(has_t)[both_dis5], (~has_t | (total == tline))[both_dis5],
        df["t60_total_under_price"][both_dis5], "BOTH disadv (5-channel) → game UNDER", lines)


def main():
    lines = ["# Style Brief #2 — architecture combos round 2 (NCAAB)",
             "",
             "hi ≥70th pct, lo ≤30th, strictly-prior profiles. T-60 prices. BE 52.4%."]
    availability_tiers(lines)
    standalone_combos(lines)
    path = os.path.join(ROOT, "STYLE_BRIEF2.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
