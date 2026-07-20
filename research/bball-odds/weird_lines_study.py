#!/usr/bin/env python3
"""Weird lines study (WEIRD_LINES_BRIEF1.md) — market line vs PR-implied line.

Implied home margin = KenPom fanmatch (his ratings + HCA + tempo, dated).
dev = market_implied_margin − kp_implied_margin
  dev > 0: the LINE rates home BETTER than power ratings say (line "long")
  dev < 0: the line is SHORT of the ratings (the owner's example: PR says
           home −11.5, line only −5.5 → dev < 0)

Batteries:
  A. dev buckets × direction → back line-side vs ratings-side (FG spread)
  B. WHY is it weird: explained (visible absence flags) vs UNEXPLAINED;
     opened weird vs BECAME weird (movement); segment & month splits
  C. totals: fanmatch total vs market total dev buckets
  D. moneyline: fanmatch win prob vs market implied prob dev → ML value
All bets T-60 consensus. BE 52.4%.
"""
import os

import numpy as np
import pandas as pd

import kenpom_edge_study as kes

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


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


def load():
    ke = kes.load()  # movement_games + fanmatch preds, event-level
    ke = ke[["event_id", "HomePred", "VisitorPred", "HomeWP",
             "open_spread_home_point", "t60_ml_home_price", "t60_ml_away_price"]]
    df = pd.read_parquet(f"{OUT}/sides_table_ncaab.parquet")
    df = df.merge(ke, on="event_id", how="inner", suffixes=("", "_ke"))
    df["kp_margin"] = df["HomePred"] - df["VisitorPred"]
    df["mkt_margin"] = -df["t60_spread_home_point"]
    df["dev"] = df["mkt_margin"] - df["kp_margin"]
    op = "open_spread_home_point_ke" if "open_spread_home_point_ke" in df.columns \
        else "open_spread_home_point"
    df["dev_open"] = -df[op] - df["kp_margin"]
    df["kp_total"] = df["HomePred"] + df["VisitorPred"]
    df["tdev"] = df["t60_total_point"] - df["kp_total"]
    return df.dropna(subset=["dev", "cover_amt"]).copy()


def main():
    df = load()
    cover = df["cover_amt"]
    push = cover == 0
    hdec, adec = df["t60_spread_home_price"], df["t60_spread_away_price"]
    lines = ["# Weird Lines Brief #1 — market vs PR-implied (NCAAB FG/total/ML)",
             "",
             f"{len(df):,} games. dev = market home margin − KenPom fanmatch margin",
             "(his ratings+HCA+tempo, dated). T-60 prices. BE 52.4%.",
             f"dev distribution: sd {df['dev'].std():.2f}, |dev|≥3 in "
             f"{(df['dev'].abs()>=3).mean()*100:.0f}% of games, ≥5 in "
             f"{(df['dev'].abs()>=5).mean()*100:.0f}%."]

    lines.append("\n## A — dev buckets: back the LINE side or the RATINGS side?\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for lo, hi in ((2, 4), (3, 6), (4, 8), (5, 99), (7, 99)):
        m = (df["dev"] >= lo) & (df["dev"] < hi)   # line long on home vs ratings
        bet(df[m], (cover > 0)[m], push[m], hdec[m],
            f"line LONG home [{lo},{hi}) → HOME (line side)", lines)
        bet(df[m], (cover < 0)[m] & ~push[m], push[m], adec[m],
            f"line LONG home [{lo},{hi}) → AWAY (ratings side)", lines)
        m = (df["dev"] <= -lo) & (df["dev"] > -hi)  # line short of ratings (owner ex.)
        bet(df[m], (cover < 0)[m] & ~push[m], push[m], adec[m],
            f"line SHORT home [{lo},{hi}) → AWAY (line side)", lines)
        bet(df[m], (cover > 0)[m], push[m], hdec[m],
            f"line SHORT home [{lo},{hi}) → HOME (ratings side)", lines)

    lines.append("\n## B — WHY weird: explained vs unexplained, opened vs became\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    any_flag_h = (df["h_reg_out_n"].fillna(0) + df["h_stale_out_n"].fillna(0)) > 0
    any_flag_a = (df["a_reg_out_n"].fillna(0) + df["a_stale_out_n"].fillna(0)) > 0
    weird = df["dev"].abs() >= 4
    # line moved against home => market down on home; is home short-side explained?
    short_home = df["dev"] <= -4   # market rates home worse than ratings
    long_home = df["dev"] >= 4
    combos = [
        ("SHORT home, home has visible absence (explained)", short_home & any_flag_h, "a"),
        ("SHORT home, NO visible absence (unexplained)", short_home & ~any_flag_h, "a"),
        ("SHORT home, unexplained → HOME (ratings side)", short_home & ~any_flag_h, "h"),
        ("LONG home, away has visible absence (explained)", long_home & any_flag_a, "h"),
        ("LONG home, NO visible absence (unexplained)", long_home & ~any_flag_a, "h"),
        ("LONG home, unexplained → AWAY (ratings side)", long_home & ~any_flag_a, "a"),
    ]
    for label, mask, side in combos:
        win = (cover > 0) if side == "h" else (cover < 0)
        dec = hdec if side == "h" else adec
        bet(df[mask], win[mask] & ~push[mask], push[mask], dec[mask], label, lines)
    # opened weird vs became weird
    opened_weird = weird & (df["dev_open"].abs() >= 4)
    became_weird = weird & (df["dev_open"].abs() < 2)
    for label, mask in (("OPENED weird (books born confident)", opened_weird),
                        ("BECAME weird (moved away from ratings)", became_weird)):
        line_side_win = np.where(df["dev"] > 0, cover > 0, cover < 0)
        line_dec = pd.Series(np.where(df["dev"] > 0, hdec, adec), index=df.index)
        bet(df[mask], pd.Series(line_side_win, index=df.index)[mask] & ~push[mask],
            push[mask], line_dec[mask], f"{label} → LINE side", lines)
        rat_side_win = np.where(df["dev"] > 0, cover < 0, cover > 0)
        rat_dec = pd.Series(np.where(df["dev"] > 0, adec, hdec), index=df.index)
        bet(df[mask], pd.Series(rat_side_win, index=df.index)[mask] & ~push[mask],
            push[mask], rat_dec[mask], f"{label} → RATINGS side", lines)
    # segments & month
    lowlow = (df["h_tier"] == 0) & (df["a_tier"] == 0) if "h_tier" in df.columns else None
    for label, mask in (("weird ≥4 in Nov (KP priors stale)", weird & (df["month"] == 11)),
                        ("weird ≥4 Jan+ (ratings mature)", weird & df["month"].isin([1, 2, 3]))):
        line_side_win = np.where(df["dev"] > 0, cover > 0, cover < 0)
        line_dec = pd.Series(np.where(df["dev"] > 0, hdec, adec), index=df.index)
        bet(df[mask], pd.Series(line_side_win, index=df.index)[mask] & ~push[mask],
            push[mask], line_dec[mask], f"{label} → LINE side", lines)

    lines.append("\n## C — totals: market total vs KenPom total\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    total = df["home_score"] + df["away_score"]
    tline = df["t60_total_point"]
    has_t = tline.notna()
    tpush = ~has_t | (total == tline)
    for lo in (4, 6, 8):
        m = df["tdev"] >= lo   # market total ABOVE kenpom total
        bet(df[m], (total > tline).where(has_t)[m], tpush[m], df["t60_total_over_price"][m],
            f"total {lo}+ ABOVE KP → OVER (line side)", lines)
        bet(df[m], (total < tline).where(has_t)[m], tpush[m], df["t60_total_under_price"][m],
            f"total {lo}+ ABOVE KP → UNDER (ratings side)", lines)
        m = df["tdev"] <= -lo
        bet(df[m], (total < tline).where(has_t)[m], tpush[m], df["t60_total_under_price"][m],
            f"total {lo}+ BELOW KP → UNDER (line side)", lines)
        bet(df[m], (total > tline).where(has_t)[m], tpush[m], df["t60_total_over_price"][m],
            f"total {lo}+ BELOW KP → OVER (ratings side)", lines)

    lines.append("\n## D — moneyline: KP win prob vs market implied\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    ml_h = "t60_ml_home_price_ke" if "t60_ml_home_price_ke" in df.columns else "t60_ml_home_price"
    ml_a = "t60_ml_away_price_ke" if "t60_ml_away_price_ke" in df.columns else "t60_ml_away_price"
    imp_h = 1 / df[ml_h]
    wp = df["HomeWP"] / 100.0
    df["wp_dev"] = wp - imp_h   # >0: KP likes home more than market
    won_h = df["margin"] > 0
    no_push = pd.Series(False, index=df.index)
    for lo in (0.05, 0.10, 0.15):
        m = (df["wp_dev"] >= lo) & (imp_h < 0.7)
        bet(df[m], won_h[m], no_push[m], df[ml_h][m],
            f"KP WP {lo*100:.0f}pp+ ABOVE market → HOME ML (ratings side)", lines)
        m = (df["wp_dev"] <= -lo) & (imp_h > 0.3)
        bet(df[m], (~won_h)[m], no_push[m], df[ml_a][m],
            f"KP WP {lo*100:.0f}pp+ BELOW market → AWAY ML (ratings side)", lines)
        m = (df["wp_dev"] >= lo) & (imp_h < 0.7)
        bet(df[m], (~won_h)[m], no_push[m], df[ml_a][m],
            f"KP WP {lo*100:.0f}pp+ ABOVE market → AWAY ML (line side)", lines)

    with open(os.path.join(ROOT, "WEIRD_LINES_BRIEF1.md"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote WEIRD_LINES_BRIEF1.md", flush=True)


if __name__ == "__main__":
    main()
