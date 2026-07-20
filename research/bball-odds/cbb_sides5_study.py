#!/usr/bin/env python3
"""CBB sides round 5 (CBB_SIDES_BRIEF5.md) — owner's battery:

  A. Ranked dynamics (KP top-25 as ranking proxy): ranked away, ranked vs
     unranked with the UNRANKED favored, conference/nonconf splits.
  B. Cross-team streak interactions: Team A hot ATS vs Team B cold ATS,
     conditioned on who's favored (the interaction, not single-team streaks).
  C. Meeting 2 conditioned on meeting-1 DETAILS: blowout covers, venue flip,
     upsets, days between meetings.

All from sides_table_ncaab.parquet, T-60 prices. BE 52.4%.
"""
import os

import numpy as np
import pandas as pd

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


def main():
    df = pd.read_parquet(f"{OUT}/sides_table_ncaab.parquet")
    hc = df["cover_amt"] > 0
    push = df["cover_amt"] == 0
    hdec, adec = df["t60_spread_home_price"], df["t60_spread_away_price"]
    hfav = df["t60_spread_home_point"] < 0

    lines = ["# CBB Sides Brief #5 — ranked dynamics, streak interactions, meeting-2 detail",
             "",
             f"{len(df):,} games. 'Ranked' = KenPom top-25 that morning (AP proxy).",
             "T-60 prices. BE 52.4%."]

    # ---- A: ranked dynamics ----
    h_rk = df["home_kp_rank"] <= 25
    a_rk = df["away_kp_rank"] <= 25
    lines.append("\n## A — ranked (KP top-25) dynamics\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    combos = [
        ("RANKED AWAY at unranked → back ranked (away)", a_rk & ~h_rk, "a"),
        ("RANKED AWAY at unranked → fade ranked (home)", a_rk & ~h_rk, "h"),
        ("RANKED AWAY at unranked, NONCONF → back ranked", a_rk & ~h_rk & (df["nonconf"] == 1), "a"),
        ("RANKED AWAY at unranked, CONF → back ranked", a_rk & ~h_rk & (df["nonconf"] == 0), "a"),
        ("UNRANKED home FAVORED over ranked → back unranked", ~h_rk & a_rk & hfav, "h"),
        ("UNRANKED home FAVORED over ranked → back ranked dog", ~h_rk & a_rk & hfav, "a"),
        ("UNRANKED away FAVORED over ranked → back unranked", ~a_rk & h_rk & ~hfav, "a"),
        ("UNRANKED away FAVORED over ranked → back ranked dog", ~a_rk & h_rk & ~hfav, "h"),
        ("ranked home BIG fav (≤-15) vs unranked → back home", h_rk & ~a_rk
         & (df["t60_spread_home_point"] <= -15), "h"),
        ("ranked home BIG fav (≤-15) vs unranked → fade", h_rk & ~a_rk
         & (df["t60_spread_home_point"] <= -15), "a"),
        ("TOP-10 KP away anywhere → back", (df["away_kp_rank"] <= 10), "a"),
        ("TOP-10 KP away anywhere → fade", (df["away_kp_rank"] <= 10), "h"),
    ]
    for label, mask, side in combos:
        win = hc if side == "h" else (~hc & ~push)
        dec = hdec if side == "h" else adec
        bet(df[mask], win[mask], push[mask], dec[mask], label, lines)

    # ---- B: streak interactions ----
    lines.append("\n## B — cross-team ATS streak interactions\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    h_hot = df["h_l5_covers"] >= 4
    h_cold = df["h_l5_covers"] <= 1
    a_hot = df["a_l5_covers"] >= 4
    a_cold = df["a_l5_covers"] <= 1
    combos = [
        ("HOT home (4+/5) vs COLD away (≤1/5) → back hot home", h_hot & a_cold, "h"),
        ("HOT home vs COLD away → back cold away", h_hot & a_cold, "a"),
        ("HOT away vs COLD home → back hot away", a_hot & h_cold, "a"),
        ("HOT away vs COLD home → back cold home", a_hot & h_cold, "h"),
        ("HOT home vs COLD away, COLD side FAVORED → back hot dog",
         h_hot & a_cold & ~hfav, "h"),
        ("HOT away vs COLD home, COLD side FAVORED → back hot dog",
         a_hot & h_cold & hfav, "a"),
        ("HOT home vs COLD away, HOT side favored → back hot fav",
         h_hot & a_cold & hfav, "h"),
        ("HOT away vs COLD home, HOT side favored → back hot fav",
         a_hot & h_cold & ~hfav, "a"),
        ("cover_diff ≥3 (home much hotter) → back home", df["cover_diff"] >= 3, "h"),
        ("cover_diff ≥3 → back away (regress)", df["cover_diff"] >= 3, "a"),
        ("cover_diff ≤-3 (away much hotter) → back away", df["cover_diff"] <= -3, "a"),
        ("cover_diff ≤-3 → back home (regress)", df["cover_diff"] <= -3, "h"),
        ("BOTH cold (≤1/5 each) → back home", h_cold & a_cold, "h"),
        ("BOTH hot (4+/5 each) → back home", h_hot & a_hot, "h"),
    ]
    for label, mask, side in combos:
        win = hc if side == "h" else (~hc & ~push)
        dec = hdec if side == "h" else adec
        bet(df[mask], win[mask], push[mask], dec[mask], label, lines)

    # ---- C: meeting 2 details ----
    lines.append("\n## C — meeting 2 conditioned on meeting-1 details\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    m2 = df["meet_no"] == 2
    combos = [
        ("m1 home-side BLOWOUT cover (≥12) → back home again", m2 & (df["m1_covamt_home"] >= 12), "h"),
        ("m1 home-side blowout cover → back away (regress)", m2 & (df["m1_covamt_home"] >= 12), "a"),
        ("m1 home-side blown out ATS (≤-12) → back home (bounce)", m2 & (df["m1_covamt_home"] <= -12), "h"),
        ("m1 home-side blown out ATS → back away again", m2 & (df["m1_covamt_home"] <= -12), "a"),
        ("VENUE FLIP + m1 host won big (home now lost m1 away? m1_margin_home ≤ -10) → back home",
         m2 & (df["venue_flip"] == 1) & (df["m1_margin_home"] <= -10), "h"),
        ("SAME VENUE rematch (rare) → back m1 winner-side (home if won)",
         m2 & (df["venue_flip"] == 0) & (df["m1_margin_home"] > 0), "h"),
        ("QUICK rematch (≤14d), m1 decided by ≤5 → back home", m2 & (df["m1_days_ago"] <= 14)
         & (df["m1_margin_home"].abs() <= 5), "h"),
        ("LONG gap (≥45d) rematch → back home", m2 & (df["m1_days_ago"] >= 45), "h"),
        ("m1 UPSET: home-now was dog and WON m1 → back home again",
         m2 & (df["m1_margin_home"] > 0) & (df["m1_covamt_home"] > df["m1_margin_home"]), "h"),
    ]
    for label, mask, side in combos:
        win = hc if side == "h" else (~hc & ~push)
        dec = hdec if side == "h" else adec
        bet(df[mask], win[mask], push[mask], dec[mask], label, lines)

    path = os.path.join(ROOT, "CBB_SIDES_BRIEF5.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
