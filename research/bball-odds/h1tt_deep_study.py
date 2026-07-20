#!/usr/bin/env python3
"""1H + team-totals DEEP battery (H1TT_BBALL_BRIEF2.md) — every FG-sides
strategy applied to the derivative markets.

A. WEIRD LINES: KP-implied 1H spread/total (scaling fit on 2022-23 actuals,
   no line data needed) and KP-implied team scores vs posted TT → dev buckets,
   line-side vs ratings-side, explained-by-absence splits.
B. AVAILABILITY: fresh big/guard out → 1H ATS fade, 1H total, shorthanded TT.
C. FAST/SLOW STARTERS: team's prior 1H-vs-FG margin profile (front-runner
   index) → 1H spread; prior 1H scoring share → 1H totals.
D. STYLE: composite both-advantaged → 1H over; slow-pace collisions → 1H.
E. CONTEXT: marquee/primetime vs obscure, month, neutral for 1H markets.

1H/TT lines = T-60 consensus (2023-24 →). Halves actuals = 4 seasons.
BE 52.4%.
"""
import glob
import os

import numpy as np
import pandas as pd

import h1tt_study as hs
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
    df, _ = hs.load("ncaab")   # h1tt consensus + FG market + results
    ct = pd.read_parquet(f"{OUT}/movement_games_ncaab.parquet",
                         columns=["event_id", "commence_time"])
    df = df.merge(ct, on="event_id", how="left")
    ke = kes.load()[["event_id", "HomePred", "VisitorPred"]]
    df = df.merge(ke, on="event_id", how="left")
    st = pd.read_parquet(f"{OUT}/sides_table_ncaab.parquet")
    ctx_cols = ["event_id", "h_big_out", "a_big_out", "h_guard_out", "a_guard_out",
                "h_reg_out_n", "a_reg_out_n", "h_stale_out_n", "a_stale_out_n",
                "h_style_adv", "a_style_adv", "h_pct_pace", "a_pct_pace",
                "home_kp_rank", "away_kp_rank", "month", "neutralSite",
                "h_team", "a_team"]
    df = df.merge(st[ctx_cols], on="event_id", how="left")
    df["h1_margin"] = df["home_h1"] - df["away_h1"]
    df["h1_total"] = df["home_h1"] + df["away_h1"]
    df["fg_margin"] = df["home_score"] - df["away_score"]
    df["kp_margin"] = df["HomePred"] - df["VisitorPred"]
    df["kp_total"] = df["HomePred"] + df["VisitorPred"]
    return df


def graders(df):
    g = {}
    g["h1_cover_amt"] = df["h1_margin"] + df["h1_spread_home_point"]
    g["h1_push"] = g["h1_cover_amt"] == 0
    g["h1t_push"] = (df["h1_total"] == df["h1_total_point"]) | df["h1_total_point"].isna()
    return g


def main():
    df = load()
    G = graders(df)
    h1cov = G["h1_cover_amt"]
    h1p = G["h1_push"] | df["h1_spread_home_point"].isna()
    h1tp = G["h1t_push"]
    lines = ["# H1TT Deep Brief #2 — full strategy battery on 1H + team totals",
             "",
             f"{len(df):,} games with 1H/TT closes. T-60 consensus prices. BE 52.4%."]

    # ---- A: weird lines ----
    tr = df["season"] == "2023-24"   # earliest season WITH lines used to sanity-fit
    alpha = (df["h1_margin"] / df["fg_margin"].replace(0, np.nan)).median()
    a_fit = np.polyfit(df.loc[tr, "kp_margin"].fillna(0), df.loc[tr, "h1_margin"].fillna(0), 1)[0]
    b_fit = np.polyfit(df.loc[tr, "kp_total"].fillna(0), df.loc[tr, "h1_total"].fillna(0), 1)[0]
    df["imp_h1_margin"] = a_fit * df["kp_margin"]
    df["imp_h1_total"] = b_fit * df["kp_total"]
    df["h1_dev"] = -df["h1_spread_home_point"] - df["imp_h1_margin"]
    df["h1t_dev"] = df["h1_total_point"] - df["imp_h1_total"]
    df["tt_h_dev"] = df["tt_home_point"] - df["HomePred"]
    df["tt_a_dev"] = df["tt_away_point"] - df["VisitorPred"]
    lines.append(f"\n## A — weird lines (fit: 1H margin = {a_fit:.2f}×KP margin, "
                 f"1H total = {b_fit:.2f}×KP total)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for lo in (1.5, 2.5):
        m = df["h1_dev"] >= lo
        bet(df[m], (h1cov > 0)[m], h1p[m], df["h1_spread_home_price"][m],
            f"1H line LONG home ≥{lo} → HOME (line side)", lines)
        bet(df[m], (h1cov < 0)[m] & ~h1p[m], h1p[m], df["h1_spread_away_price"][m],
            f"1H line LONG home ≥{lo} → AWAY (ratings side)", lines)
        m = df["h1_dev"] <= -lo
        bet(df[m], (h1cov < 0)[m] & ~h1p[m], h1p[m], df["h1_spread_away_price"][m],
            f"1H line SHORT home ≥{lo} → AWAY (line side)", lines)
        bet(df[m], (h1cov > 0)[m], h1p[m], df["h1_spread_home_price"][m],
            f"1H line SHORT home ≥{lo} → HOME (ratings side)", lines)
    for lo in (2, 3):
        m = df["h1t_dev"] >= lo
        bet(df[m], (df["h1_total"] > df["h1_total_point"])[m], h1tp[m],
            df["h1_total_over_price"][m], f"1H total ≥{lo} ABOVE KP-implied → OVER (line)", lines)
        bet(df[m], (df["h1_total"] < df["h1_total_point"])[m] & ~h1tp[m], h1tp[m],
            df["h1_total_under_price"][m], f"1H total ≥{lo} ABOVE KP-implied → UNDER (ratings)", lines)
        m = df["h1t_dev"] <= -lo
        bet(df[m], (df["h1_total"] < df["h1_total_point"])[m] & ~h1tp[m], h1tp[m],
            df["h1_total_under_price"][m], f"1H total ≥{lo} BELOW KP-implied → UNDER (line)", lines)
        bet(df[m], (df["h1_total"] > df["h1_total_point"])[m], h1tp[m],
            df["h1_total_over_price"][m], f"1H total ≥{lo} BELOW KP-implied → OVER (ratings)", lines)
    for side, dev, pts, ttl, tto, ttu in (
            ("home", "tt_h_dev", df["home_score"], df["tt_home_point"],
             df["tt_home_over_price"], df["tt_home_under_price"]),
            ("away", "tt_a_dev", df["away_score"], df["tt_away_point"],
             df["tt_away_over_price"], df["tt_away_under_price"])):
        tpush = (pts == ttl) | ttl.isna()
        for lo in (3, 5):
            m = df[dev] >= lo
            bet(df[m], (pts < ttl)[m] & ~tpush[m], tpush[m], ttu[m],
                f"{side} TT ≥{lo} ABOVE KP score → UNDER (ratings says too high)", lines)
            bet(df[m], (pts > ttl)[m], tpush[m], tto[m],
                f"{side} TT ≥{lo} ABOVE KP score → OVER (line side)", lines)
            m = df[dev] <= -lo
            bet(df[m], (pts > ttl)[m], tpush[m], tto[m],
                f"{side} TT ≥{lo} BELOW KP score → OVER (ratings side)", lines)
            bet(df[m], (pts < ttl)[m] & ~tpush[m], tpush[m], ttu[m],
                f"{side} TT ≥{lo} BELOW KP score → UNDER (line side)", lines)
    # explained: TT below KP + that team has an absence
    m = (df["tt_h_dev"] <= -3) & ((df["h_reg_out_n"].fillna(0) > 0))
    tpush = (df["home_score"] == df["tt_home_point"]) | df["tt_home_point"].isna()
    bet(df[m], (df["home_score"] < df["tt_home_point"])[m] & ~tpush[m], tpush[m],
        df["tt_home_under_price"][m], "home TT ≥3 BELOW KP + home absence → UNDER (explained)", lines)

    # ---- B: availability → 1H markets ----
    lines.append("\n## B — availability → 1H markets (fresh absences)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for side, flag, win_fade, dec_fade in (
            ("home", "h_big_out", (h1cov < 0) & ~h1p, df["h1_spread_away_price"]),
            ("away", "a_big_out", (h1cov > 0) & ~h1p, df["h1_spread_home_price"])):
        m = df[flag].fillna(0) > 0
        bet(df[m], win_fade[m], h1p[m], dec_fade[m],
            f"{side} big freshly out → FADE in 1H ATS", lines)
    m = (df["h_big_out"].fillna(0) > 0) | (df["a_big_out"].fillna(0) > 0)
    bet(df[m], (df["h1_total"] < df["h1_total_point"])[m] & ~h1tp[m], h1tp[m],
        df["h1_total_under_price"][m], "any big freshly out → 1H UNDER", lines)
    for side, flag in (("home", "h_guard_out"), ("away", "a_guard_out")):
        m = df[flag].fillna(0) > 0
        win_fade = (h1cov < 0) & ~h1p if side == "home" else (h1cov > 0) & ~h1p
        dec_fade = df["h1_spread_away_price"] if side == "home" else df["h1_spread_home_price"]
        bet(df[m], win_fade[m], h1p[m], dec_fade[m],
            f"{side} guard freshly out → FADE in 1H ATS", lines)

    # ---- C: fast/slow starters ----
    lines.append("\n## C — fast/slow starter profiles (prior 1H tendencies)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    long_ = []
    for side, sign in (("h", 1), ("a", -1)):
        long_.append(pd.DataFrame({
            "team": df[f"{side}_team"], "season": df["season"],
            "event_id": df["event_id"], "side": side,
            "date": pd.to_datetime(df["commence_time"]),
            "fr": sign * (df["h1_margin"] - 0.5 * df["fg_margin"]),
            "h1s": np.where(side == "h", df["home_h1"] / df["home_score"].replace(0, np.nan),
                            df["away_h1"] / df["away_score"].replace(0, np.nan))}))
    t = pd.concat(long_, ignore_index=True).sort_values(["team", "season", "date"])
    g = t.groupby(["team", "season"])
    t["fr10"] = g["fr"].transform(lambda s: s.shift(1).rolling(10, min_periods=5).mean())
    t["h1s10"] = g["h1s"].transform(lambda s: s.shift(1).rolling(10, min_periods=5).mean())
    for side in ("h", "a"):
        m2 = t[t["side"] == side][["event_id", "fr10", "h1s10"]]
        m2.columns = ["event_id", f"{side}_fr10", f"{side}_h1s10"]
        df = df.merge(m2, on="event_id", how="left")
    q = lambda s, p: s.quantile(p)
    for side, tag in (("h", "HOME"), ("a", "AWAY")):
        F = df[f"{side}_fr10"]
        fast = F >= q(F, .85)
        slow = F <= q(F, .15)
        win_own = (h1cov > 0) if side == "h" else (h1cov < 0)
        dec_own = df["h1_spread_home_price"] if side == "h" else df["h1_spread_away_price"]
        dec_opp = df["h1_spread_away_price"] if side == "h" else df["h1_spread_home_price"]
        bet(df[fast], win_own[fast] & ~h1p[fast], h1p[fast], dec_own[fast],
            f"{tag} FAST starter (top 15% front-runner idx) → BACK 1H", lines)
        bet(df[slow], (~win_own)[slow] & ~h1p[slow], h1p[slow], dec_opp[slow],
            f"{tag} SLOW starter → FADE 1H", lines)
    both_fast = (df["h_h1s10"] >= q(df["h_h1s10"], .75)) & (df["a_h1s10"] >= q(df["a_h1s10"], .75))
    both_slow = (df["h_h1s10"] <= q(df["h_h1s10"], .25)) & (df["a_h1s10"] <= q(df["a_h1s10"], .25))
    bet(df[both_fast], (df["h1_total"] > df["h1_total_point"])[both_fast], h1tp[both_fast],
        df["h1_total_over_price"][both_fast], "BOTH front-loaded scorers → 1H OVER", lines)
    bet(df[both_slow], (df["h1_total"] < df["h1_total_point"])[both_slow] & ~h1tp[both_slow],
        h1tp[both_slow], df["h1_total_under_price"][both_slow],
        "BOTH back-loaded scorers → 1H UNDER", lines)

    # ---- D: style + E: context ----
    lines.append("\n## D/E — style + context on 1H markets\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    adv_hi = (df["h_style_adv"] >= df["h_style_adv"].quantile(.8)) \
        & (df["a_style_adv"] >= df["a_style_adv"].quantile(.8))
    bet(df[adv_hi], (df["h1_total"] > df["h1_total_point"])[adv_hi], h1tp[adv_hi],
        df["h1_total_over_price"][adv_hi], "BOTH style-advantaged → 1H OVER", lines)
    slowpace = (df["h_pct_pace"] <= .3) & (df["a_pct_pace"] <= .3)
    bet(df[slowpace], (df["h1_total"] > df["h1_total_point"])[slowpace], h1tp[slowpace],
        df["h1_total_over_price"][slowpace], "both SLOW pace → 1H OVER (over-shaded?)", lines)
    marquee = (df["home_kp_rank"] <= 40) & (df["away_kp_rank"] <= 40)
    bet(df[marquee], (df["h1_total"] < df["h1_total_point"])[marquee] & ~h1tp[marquee],
        h1tp[marquee], df["h1_total_under_price"][marquee], "MARQUEE game → 1H UNDER", lines)
    obscure = (df["home_kp_rank"] > 100) & (df["away_kp_rank"] > 100)
    bet(df[obscure], (h1cov < 0)[obscure] & ~h1p[obscure], h1p[obscure],
        df["h1_spread_away_price"][obscure], "OBSCURE game → 1H BACK AWAY", lines)
    neu = df["neutralSite"] == True
    bet(df[neu], (h1cov > 0)[neu], h1p[neu], df["h1_spread_home_price"][neu],
        "NEUTRAL site → 1H nominal-home", lines)
    for months, tag in (([11, 12], "Nov-Dec"), ([1, 2, 3], "Jan+")):
        m = df["month"].isin(months)
        bet(df[m], (df["h1_total"] < df["h1_total_point"])[m] & ~h1tp[m], h1tp[m],
            df["h1_total_under_price"][m], f"ALL games {tag} → 1H UNDER (baseline)", lines)

    with open(os.path.join(ROOT, "H1TT_BBALL_BRIEF2.md"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote H1TT_BBALL_BRIEF2.md", flush=True)


if __name__ == "__main__":
    main()
