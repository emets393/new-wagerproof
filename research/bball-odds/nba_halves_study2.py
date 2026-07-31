#!/usr/bin/env python3
"""NBA halves deep dive #2 — the three tests asked for explicitly.

A. BOTH-TEAMS 1H spread cross: a team that's been hitting 1H spreads meeting a
   team that's been terrible at it — every combination of (own tier x opp tier),
   both directions, fav/dog split, and a continuous record-gap ladder.
B. GAME-COUNT gating: everything run at min(gp) >= 30 (the ask) with the >= 20
   row alongside so the maturity effect is visible instead of assumed.
C. BOTH-TEAMS season 1H OVER% as-of-date -> does the game go OVER, or has the
   book already priced it (overpriced)? Both-high / both-low / mismatch cells,
   over-streak cells, plus a diagnostic table (line level vs actual 1H points
   by cell) that answers "priced or not" directly rather than by inference.

Grading at 1H consensus close (decimal median). BE 52.4%. Per-season always.
Scan honesty: ~5% of cells clear |ROI|>=5% by chance — treat single-season-driven
cells as noise.
"""
import os

import numpy as np
import pandas as pd

from nba_halves_study import build

ROOT = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------- game frame
def game_frame():
    g, t = build()
    cols = ["event_id", "gnum", "s_cov_pct", "cov_streak", "s_ov_pct",
            "ov_streak", "team_spread"]
    th = t[t["is_home"]][cols].add_prefix("h_").rename(columns={"h_event_id": "event_id"})
    ta = t[~t["is_home"]][cols].add_prefix("a_").rename(columns={"a_event_id": "event_id"})
    G = g.merge(th, on="event_id", how="left").merge(ta, on="event_id", how="left")
    G["min_gp"] = G[["h_gnum", "a_gnum"]].min(axis=1)
    G["h1_total_line"] = G["h1_total"]
    return G


def bet(G, mask, win, dec, label, lines, min_n=40):
    """win: float series 1/0/NaN (NaN = push or ungradeable)."""
    sub = G[mask]
    w = pd.Series(win, index=G.index)[mask]
    d = pd.Series(dec, index=G.index)[mask]
    ok = w.notna()
    n = int(ok.sum())
    if n < min_n:
        return
    hit = (w == 1) & ok
    profit = np.where(~ok, 0.0, np.where(hit, d.fillna(1.909) - 1, -1.0))
    per = " ".join(f"{s}:{gg.mean()*100:.0f}" for s, gg in
                   sub.assign(w=hit.astype(float), ok=ok).loc[ok].groupby("season")["w"])
    lines.append(f"| {label} | {n:,} | {hit.sum()/n*100:.1f}% | "
                 f"{profit[ok].mean()*100:+.1f}% | {per} |")


def side_win_dec(G):
    """1H spread win/dec for backing home and backing away."""
    cov = G["h1_cov_home"]
    home = pd.Series(np.where(cov > 0, 1.0, np.where(cov < 0, 0.0, np.nan)), index=G.index)
    away = 1 - home
    return home, G["h1_sp_h"], away, G["h1_sp_a"]


def team_bet(G, mask_h, mask_a, label, lines, fade=False):
    """Back (or fade) the 'target' team where target = home on mask_h, away on mask_a."""
    hw, hd, aw, ad = side_win_dec(G)
    m = mask_h.fillna(False) | mask_a.fillna(False)
    if fade:
        win = pd.Series(np.where(mask_h.fillna(False), aw, np.where(mask_a.fillna(False), hw, np.nan)), index=G.index)
        dec = pd.Series(np.where(mask_h.fillna(False), ad, np.where(mask_a.fillna(False), hd, np.nan)), index=G.index)
    else:
        win = pd.Series(np.where(mask_h.fillna(False), hw, np.where(mask_a.fillna(False), aw, np.nan)), index=G.index)
        dec = pd.Series(np.where(mask_h.fillna(False), hd, np.where(mask_a.fillna(False), ad, np.nan)), index=G.index)
    bet(G, m, win, dec, label, lines)


# ------------------------------------------------------- A/B: 1H spread cross
def spread_cross(G, lines):
    hw, hd, aw, ad = side_win_dec(G)

    for gp in (20, 30):
        gate = G["min_gp"] >= gp
        lines.append(f"\n### min {gp}+ games played, both teams\n")
        lines.append("| signal | n | win% | ROI | per-season |")
        lines.append("|---|---|---|---|---|")

        # record-tier crosses: hot team vs terrible team, both directions
        for hi, lo in ((.55, .45), (.58, .42), (.60, .40)):
            mh = gate & (G["h_s_cov_pct"] >= hi) & (G["a_s_cov_pct"] <= lo)
            ma = gate & (G["a_s_cov_pct"] >= hi) & (G["h_s_cov_pct"] <= lo)
            tag = f"hot({hi:.0%} 1H cov) vs terrible({lo:.0%})"
            team_bet(G, mh, ma, f"{tag} → BACK hot team", lines)
            team_bet(G, mh, ma, f"{tag} → FADE hot team (back terrible)", lines, fade=True)
            # fav/dog split of the hot team
            mhf, maf = mh & (G["h_team_spread"] < 0), ma & (G["a_team_spread"] < 0)
            team_bet(G, mhf, maf, f"{tag}, hot team FAVORED → BACK", lines)
            team_bet(G, mhf, maf, f"{tag}, hot team FAVORED → FADE", lines, fade=True)
            mhd, mad = mh & (G["h_team_spread"] > 0), ma & (G["a_team_spread"] > 0)
            team_bet(G, mhd, mad, f"{tag}, hot team DOG → BACK", lines)
            team_bet(G, mhd, mad, f"{tag}, hot team DOG → FADE", lines, fade=True)
            # home/away split of the hot team
            team_bet(G, mh, pd.Series(False, index=G.index), f"{tag}, hot team HOME → BACK", lines)
            team_bet(G, pd.Series(False, index=G.index), ma, f"{tag}, hot team AWAY → BACK", lines)

        # streak crosses
        for k in (3, 4):
            mh = gate & (G["h_cov_streak"] >= k) & (G["a_cov_streak"] <= -k)
            ma = gate & (G["a_cov_streak"] >= k) & (G["h_cov_streak"] <= -k)
            tag = f"streak: {k}+ 1H covers vs {k}+ fails"
            team_bet(G, mh, ma, f"{tag} → BACK hot", lines)
            team_bet(G, mh, ma, f"{tag} → FADE hot", lines, fade=True)
            mhf, maf = mh & (G["h_team_spread"] < 0), ma & (G["a_team_spread"] < 0)
            team_bet(G, mhf, maf, f"{tag}, hot FAVORED → BACK", lines)
            mhd, mad = mh & (G["h_team_spread"] > 0), ma & (G["a_team_spread"] > 0)
            team_bet(G, mhd, mad, f"{tag}, hot DOG → BACK", lines)
            # owner's exact cell: cold team is the FAVORITE
            mh2 = gate & (G["h_cov_streak"] <= -k) & (G["h_team_spread"] < 0) & (G["a_cov_streak"] >= k)
            ma2 = gate & (G["a_cov_streak"] <= -k) & (G["a_team_spread"] < 0) & (G["h_cov_streak"] >= k)
            team_bet(G, mh2, ma2, f"cold({k}+ fails) FAVORITE vs hot dog → BACK cold fav", lines)
            team_bet(G, mh2, ma2, f"cold({k}+ fails) FAVORITE vs hot dog → FADE cold fav", lines, fade=True)

        # streak AND record together (the strongest form of the ask)
        mh = gate & (G["h_cov_streak"] >= 3) & (G["h_s_cov_pct"] >= .55) \
            & (G["a_cov_streak"] <= -3) & (G["a_s_cov_pct"] <= .45)
        ma = gate & (G["a_cov_streak"] >= 3) & (G["a_s_cov_pct"] >= .55) \
            & (G["h_cov_streak"] <= -3) & (G["h_s_cov_pct"] <= .45)
        team_bet(G, mh, ma, "streak AND record: hot both ways vs cold both ways → BACK hot", lines, )
        team_bet(G, mh, ma, "streak AND record → FADE hot", lines, fade=True)

        # continuous record gap ladder
        gap = G["h_s_cov_pct"] - G["a_s_cov_pct"]
        for lo_, hi_ in ((.10, .15), (.15, .20), (.20, .99)):
            mh = gate & (gap >= lo_) & (gap < hi_)
            ma = gate & (-gap >= lo_) & (-gap < hi_)
            team_bet(G, mh, ma, f"1H cover% gap [{lo_:.2f},{hi_:.2f}) → BACK better team", lines)
            team_bet(G, mh, ma, f"1H cover% gap [{lo_:.2f},{hi_:.2f}) → FADE better team", lines, fade=True)


# ------------------------------------------------------------- C: 1H over%
def over_cross(G, lines):
    over = pd.Series(np.where(G["h1_over"] > 0, 1.0,
                              np.where(G["h1_over"] < 0, 0.0, np.nan)), index=G.index)
    under = 1 - over
    G["avg_ov"] = (G["h_s_ov_pct"] + G["a_s_ov_pct"]) / 2

    for gp in (20, 30):
        gate = G["min_gp"] >= gp
        lines.append(f"\n### min {gp}+ games played, both teams\n")
        lines.append("| signal | n | win% | ROI | per-season |")
        lines.append("|---|---|---|---|---|")
        for hi, lo in ((.55, .45), (.58, .42), (.60, .40)):
            both_hi = gate & (G["h_s_ov_pct"] >= hi) & (G["a_s_ov_pct"] >= hi)
            both_lo = gate & (G["h_s_ov_pct"] <= lo) & (G["a_s_ov_pct"] <= lo)
            mismatch = gate & (((G["h_s_ov_pct"] >= hi) & (G["a_s_ov_pct"] <= lo)) |
                               ((G["a_s_ov_pct"] >= hi) & (G["h_s_ov_pct"] <= lo)))
            bet(G, both_hi, over, G["h1_ov"], f"BOTH teams 1H over% ≥{hi:.0%} → 1H OVER", lines)
            bet(G, both_hi, under, G["h1_un"], f"BOTH teams 1H over% ≥{hi:.0%} → 1H UNDER (overpriced?)", lines)
            bet(G, both_lo, under, G["h1_un"], f"BOTH teams 1H over% ≤{lo:.0%} → 1H UNDER", lines)
            bet(G, both_lo, over, G["h1_ov"], f"BOTH teams 1H over% ≤{lo:.0%} → 1H OVER", lines)
            bet(G, mismatch, over, G["h1_ov"], f"MISMATCH (≥{hi:.0%} vs ≤{lo:.0%}) → 1H OVER", lines)
            bet(G, mismatch, under, G["h1_un"], f"MISMATCH (≥{hi:.0%} vs ≤{lo:.0%}) → 1H UNDER", lines)
        # continuous ladder on the average
        for lo_, hi_ in ((.00, .45), (.45, .50), (.50, .55), (.55, .60), (.60, 1.01)):
            m = gate & (G["avg_ov"] >= lo_) & (G["avg_ov"] < hi_)
            bet(G, m, over, G["h1_ov"], f"avg 1H over% [{lo_:.2f},{hi_:.2f}) → OVER", lines)
            bet(G, m, under, G["h1_un"], f"avg 1H over% [{lo_:.2f},{hi_:.2f}) → UNDER", lines)
        # over-streak cells
        for k in (3, 4):
            both = gate & (G["h_ov_streak"] >= k) & (G["a_ov_streak"] >= k)
            bet(G, both, over, G["h1_ov"], f"BOTH on {k}+ 1H OVER streak → OVER", lines)
            bet(G, both, under, G["h1_un"], f"BOTH on {k}+ 1H OVER streak → UNDER (overpriced?)", lines)
            bothu = gate & (G["h_ov_streak"] <= -k) & (G["a_ov_streak"] <= -k)
            bet(G, bothu, under, G["h1_un"], f"BOTH on {k}+ 1H UNDER streak → UNDER", lines)
            bet(G, bothu, over, G["h1_ov"], f"BOTH on {k}+ 1H UNDER streak → OVER", lines)
        # streak + record stacked
        m = gate & (G["h_ov_streak"] >= 3) & (G["a_ov_streak"] >= 3) \
            & (G["h_s_ov_pct"] >= .55) & (G["a_s_ov_pct"] >= .55)
        bet(G, m, over, G["h1_ov"], "BOTH 3+ over streak AND ≥55% season → OVER", lines)
        bet(G, m, under, G["h1_un"], "BOTH 3+ over streak AND ≥55% season → UNDER", lines)


def diagnostics(G, lines):
    """Is the book already pricing the over-history? Compare line level and
    actual 1H points across cells — this is the direct 'overpriced' answer."""
    gate = G["min_gp"] >= 30
    G = G[gate].copy()
    G["cell"] = pd.cut(G["avg_ov"], [-.01, .45, .50, .55, .60, 1.01],
                       labels=["≤45%", "45-50%", "50-55%", "55-60%", ">60%"])
    lines.append("\n### Is the history already in the line? (min 30 gp)\n")
    lines.append("| avg 1H over% cell | n | mean 1H total line | mean actual 1H pts | "
                 "actual − line | over% realized |")
    lines.append("|---|---|---|---|---|---|")
    for c, gg in G.groupby("cell", observed=True):
        ok = gg["h1_tot"].notna() & gg["h1_total_line"].notna()
        gg = gg[ok]
        if len(gg) < 30:
            continue
        ov = (gg["h1_tot"] > gg["h1_total_line"]).mean() * 100
        lines.append(f"| {c} | {len(gg):,} | {gg['h1_total_line'].mean():.1f} | "
                     f"{gg['h1_tot'].mean():.1f} | {(gg['h1_tot']-gg['h1_total_line']).mean():+.2f} | {ov:.1f}% |")

    lines.append("\n### Same question for 1H spread records (min 30 gp)\n")
    lines.append("| 1H cover% gap (home − away) | n | mean 1H spread | mean 1H margin | "
                 "home 1H cover% |")
    lines.append("|---|---|---|---|---|")
    G["gapcell"] = pd.cut(G["h_s_cov_pct"] - G["a_s_cov_pct"],
                          [-1.01, -.15, -.05, .05, .15, 1.01],
                          labels=["≤-15pp", "-15..-5", "-5..+5", "+5..+15", "≥+15pp"])
    for c, gg in G.groupby("gapcell", observed=True):
        gg = gg[gg["h1_cov_home"].notna()]
        if len(gg) < 30:
            continue
        lines.append(f"| {c} | {len(gg):,} | {gg['h1_spread'].mean():+.2f} | "
                     f"{gg['h1_margin'].mean():+.2f} | {(gg['h1_cov_home']>0).mean()*100:.1f}% |")


def main():
    G = game_frame()
    lines = ["# NBA Halves Brief #2 — both-team crosses, 30+ game gating, 1H over% history",
             "",
             f"{len(G):,} games with 1H closes and as-of records for both sides. "
             "1H consensus close (decimal median), BE 52.4%. Per-season win% shown.",
             "",
             "## A — 1H SPREAD: hot team vs terrible team (both-team cross)"]
    spread_cross(G, lines)
    lines.append("\n## C — 1H TOTAL: both teams' season 1H OVER% as-of-date")
    over_cross(G, lines)
    diagnostics(G, lines)
    path = os.path.join(ROOT, "NBA_HALVES_BRIEF2.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
