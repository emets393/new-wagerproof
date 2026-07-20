#!/usr/bin/env python3
"""Style-vs-style matchup study, NCAAB (STYLE_BRIEF1.md).

Interaction signals — offense profile MEETS opponent defense profile — on all
markets, not univariate screens. hi = season-percentile ≥0.70, lo = ≤0.30 of
strictly-prior profiles (build_style_features.py).

Scenario battery (attacking team i vs defender j):
  3-heavy O vs elite 3PT D / bad 3PT D
  paint-heavy O vs bad paint D / good paint D
  FT-drawing O vs foul-prone D
  BOTH paint-heavy + both bad paint D (+ slow-pace variant)
  both 3-heavy + both bad 3PT D
Composite: per-channel advantage = (off_pct_i - .5) x (def_weak_pct_j - .5),
summed over 3PT/paint/FT channels -> deciles -> ATS/TT.

All bets at T-60 consensus. Per-season always shown.
"""
import glob
import os

import numpy as np
import pandas as pd

from movement_study import am_to_dec

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

HI, LO = 0.70, 0.30


def load():
    st = pd.read_parquet(f"{OUT}/style_ncaab.parquet")
    pct_cols = [c for c in st.columns if c.startswith("pct_")]
    spine = pd.read_parquet(f"{OUT}/games_ncaab.parquet").dropna(subset=["cbbd_id"])
    spine = spine[["event_id", "cbbd_id"]].rename(columns={"cbbd_id": "game_key"})

    mg = pd.read_parquet(f"{OUT}/movement_games_ncaab.parquet")[
        ["event_id", "season", "home_score", "away_score",
         "t60_spread_home_point", "t60_spread_home_price", "t60_spread_away_price",
         "t60_total_point", "t60_total_over_price", "t60_total_under_price"]]
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
    print(f"{len(df):,} games with both style profiles + market", flush=True)
    return df


def bet(df, win, push, dec, label, lines, min_n=40):
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


def team_bets(df, mask, att, label, lines):
    """All-market bets from attacking team `att` ('h'/'a') perspective."""
    sub = df[mask]
    if len(sub) < 40:
        return
    total = sub["home_score"] + sub["away_score"]
    tline = sub["t60_total_point"]
    cover_amt = (sub["home_score"] - sub["away_score"]) + sub["t60_spread_home_point"]
    att_cover = cover_amt > 0 if att == "h" else cover_amt < 0
    push = cover_amt == 0
    own = sub["t60_spread_home_price"] if att == "h" else sub["t60_spread_away_price"]
    opp = sub["t60_spread_away_price"] if att == "h" else sub["t60_spread_home_price"]
    pts = sub["home_score"] if att == "h" else sub["away_score"]
    ttl = sub["tt_home_point"] if att == "h" else sub["tt_away_point"]
    tto = sub["tt_home_over_price"] if att == "h" else sub["tt_away_over_price"]
    ttu = sub["tt_home_under_price"] if att == "h" else sub["tt_away_under_price"]

    bet(sub, att_cover, push, own, f"{label} → BACK team ATS", lines)
    bet(sub, ~att_cover & ~push, push, opp, f"{label} → FADE team ATS", lines)
    # TT lines start 2023-24 — a NaN line must not grade as a loss
    has_tt = ttl.notna()
    bet(sub, (pts > ttl).where(has_tt), (pts == ttl) | ~has_tt, tto,
        f"{label} → team TT OVER", lines)
    bet(sub, (pts < ttl).where(has_tt), (pts == ttl) | ~has_tt, ttu,
        f"{label} → team TT UNDER", lines)
    has_t = tline.notna()
    bet(sub, (total > tline).where(has_t), (total == tline) | ~has_t,
        sub["t60_total_over_price"], f"{label} → game OVER", lines)
    bet(sub, (total < tline).where(has_t), (total == tline) | ~has_t,
        sub["t60_total_under_price"], f"{label} → game UNDER", lines)


def game_bets(df, mask, label, lines):
    sub = df[mask]
    if len(sub) < 40:
        return
    total = sub["home_score"] + sub["away_score"]
    tline = sub["t60_total_point"]
    has = tline.notna()
    bet(sub, (total > tline).where(has), (total == tline) | ~has,
        sub["t60_total_over_price"], f"{label} → game OVER", lines)
    bet(sub, (total < tline).where(has), (total == tline) | ~has,
        sub["t60_total_under_price"], f"{label} → game UNDER", lines)


def run(df, lines):
    for att, deff in (("h", "a"), ("a", "h")):
        tag = "HOME" if att == "h" else "AWAY"
        o = lambda c: df[f"{att}_pct_{c}"]
        d = lambda c: df[f"{deff}_pct_{c}"]

        lines.append(f"\n### Attacking team = {tag}\n")
        lines.append("| signal | n | win% | ROI | per season |")
        lines.append("|---|---|---|---|---|")
        team_bets(df, (o("p3_share") >= HI) & (d("d_p3_pct") <= LO), att,
                  "3-heavy O vs ELITE 3PT D", lines)
        team_bets(df, (o("p3_share") >= HI) & (d("d_p3_pct") >= HI), att,
                  "3-heavy O vs BAD 3PT D", lines)
        team_bets(df, (o("paint_share") >= HI) & (d("d_paint100") >= HI), att,
                  "paint-heavy O vs BAD paint D", lines)
        team_bets(df, (o("paint_share") >= HI) & (d("d_paint100") <= LO), att,
                  "paint-heavy O vs GOOD paint D", lines)
        team_bets(df, (o("ftr") >= HI) & (d("d_ftr") >= HI), att,
                  "FT-drawing O vs FOUL-PRONE D", lines)
        team_bets(df, (o("paint_share") >= HI) & (d("d_paint100") >= HI)
                  & (o("ftr") >= HI) & (d("d_ftr") >= HI), att,
                  "paint+FT feast (both channels)", lines)

    lines.append("\n### Game-level style collisions\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    both_paint = ((df["h_pct_paint_share"] >= HI) & (df["a_pct_paint_share"] >= HI)
                  & (df["h_pct_d_paint100"] >= HI) & (df["a_pct_d_paint100"] >= HI))
    game_bets(df, both_paint, "BOTH paint-heavy + both bad paint D", lines)
    slow = (df["h_pct_pace"] <= LO) & (df["a_pct_pace"] <= LO)
    game_bets(df, both_paint & slow, "…AND both slow pace", lines)
    both_paint_soft = ((df["h_pct_paint_share"] >= 0.6) & (df["a_pct_paint_share"] >= 0.6)
                       & (df["h_pct_d_paint100"] >= 0.6) & (df["a_pct_d_paint100"] >= 0.6))
    game_bets(df, both_paint_soft, "both paint-heavy + bad paint D (soft ≥0.6)", lines)
    both3 = ((df["h_pct_p3_share"] >= HI) & (df["a_pct_p3_share"] >= HI)
             & (df["h_pct_d_p3_pct"] >= HI) & (df["a_pct_d_p3_pct"] >= HI))
    game_bets(df, both3, "both 3-heavy + both bad 3PT D", lines)
    foulfest = ((df["h_pct_ftr"] >= 0.6) & (df["a_pct_ftr"] >= 0.6)
                & (df["h_pct_d_ftr"] >= 0.6) & (df["a_pct_d_ftr"] >= 0.6))
    game_bets(df, foulfest, "mutual foul-fest (FTR + foul-prone both sides)", lines)
    game_bets(df, foulfest & slow, "…AND both slow pace", lines)

    # composite style advantage
    for side, opp_ in (("h", "a"), ("a", "h")):
        adv = ((df[f"{side}_pct_p3_share"] - .5) * (df[f"{opp_}_pct_d_p3_pct"] - .5)
               + (df[f"{side}_pct_paint_share"] - .5) * (df[f"{opp_}_pct_d_paint100"] - .5)
               + (df[f"{side}_pct_ftr"] - .5) * (df[f"{opp_}_pct_d_ftr"] - .5))
        df[f"{side}_style_adv"] = adv
    df["net_adv"] = df["h_style_adv"] - df["a_style_adv"]
    lines.append("\n### Composite style advantage (sum of strength×weakness channels)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    q9, q1 = df["net_adv"].quantile([0.9, 0.1])
    team_bets(df, df["net_adv"] >= q9, "h", f"net style adv to HOME (top decile ≥{q9:.3f})", lines)
    team_bets(df, df["net_adv"] <= q1, "a", f"net style adv to AWAY (bottom decile ≤{q1:.3f})", lines)
    both_adv = (df["h_style_adv"] >= df["h_style_adv"].quantile(0.8)) \
        & (df["a_style_adv"] >= df["a_style_adv"].quantile(0.8))
    game_bets(df, both_adv, "BOTH offenses style-advantaged (top quintile each)", lines)
    both_dis = (df["h_style_adv"] <= df["h_style_adv"].quantile(0.2)) \
        & (df["a_style_adv"] <= df["a_style_adv"].quantile(0.2))
    game_bets(df, both_dis, "BOTH offenses style-disadvantaged", lines)


def main():
    df = load()
    lines = ["# Style Matchup Brief #1 — NCAAB offense-profile × opponent-defense interactions",
             "",
             f"{len(df):,} games with prior style profiles both sides. hi ≥70th pct,",
             "lo ≤30th within season. All bets at T-60 consensus. Breakeven 52.4%."]
    run(df, lines)
    df.to_parquet(f"{OUT}/style_games_ncaab.parquet", index=False)
    path = os.path.join(ROOT, "STYLE_BRIEF1.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
