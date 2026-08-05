#!/usr/bin/env python3
"""NBA player availability × 1H markets (NBA_AVAIL_1H_BRIEF.md).

The reason to look: NBA absences are ANNOUNCED and the full-game line prices
them (PROPS/REGRESSION briefs both found NBA availability priced). But S7 showed
the NBA 1H market is a thinner, lazier derivative — the book cut the 1H total
2.8 pts for a shared under-streak while actual 1H scoring barely moved. So the
question is not "does availability matter" (it does, and FG prices it) but
"does the DERIVATIVE line adjust for it proportionally?"

Every test therefore runs FG and 1H SIDE BY SIDE on the identical bet set. A
signal that is dead on FG and alive on 1H is a derivative-pricing edge; one that
is alive on both is just a mispriced absence and should already be priced.

Absence detail from build_nba_absence.py (prior-only roles, fresh vs stale,
points-removed dials, returning players). Grading at T-60 consensus, decimal.
BE 52.4%. Per-season always shown.
"""
import os

import numpy as np
import pandas as pd

from name_maps import norm
from nba_halves_study2 import bet, game_frame

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def load():
    G = game_frame()
    fg = pd.read_parquet(f"{OUT}/movement_games_nba.parquet")[
        ["event_id", "t60_spread_home_price", "t60_spread_away_price",
         "t60_total_point", "t60_total_over_price", "t60_total_under_price"]]
    G = G.merge(fg, on="event_id", how="left")

    # bridge to balldontlie game/team ids (same key recipe as nba_halves_study)
    bg = pd.read_parquet(f"{OUT}/bdl_games.parquet").drop_duplicates("id")
    bg["dkey"] = pd.to_datetime(bg["date"]).dt.strftime("%Y-%m-%d")
    bg["hk"] = bg["home_team.full_name"].map(norm)
    G["hk"] = G["home_team"].map(norm)
    G["dkey"] = (G["date"] - pd.Timedelta(hours=5)).dt.strftime("%Y-%m-%d")
    G = G.merge(bg[["hk", "dkey", "id", "home_team.id", "visitor_team.id"]],
                on=["hk", "dkey"], how="left").rename(
        columns={"id": "bdl_id", "home_team.id": "h_tid", "visitor_team.id": "a_tid"})

    ab = pd.read_parquet(f"{OUT}/nba_absence.parquet")
    keep = ["fresh_n", "fresh_max_ppg", "fresh_sum_ppg", "fresh_max_min",
            "stale_n", "stale_sum_ppg", "ret_n", "ret_max_ppg",
            "top1_out", "big_out", "guard_out", "n_regulars"]
    for side, tid in (("h", "h_tid"), ("a", "a_tid")):
        s = ab[["game_key", "team_id"] + keep].rename(
            columns={c: f"{side}_{c}" for c in keep})
        G = G.merge(s, left_on=["bdl_id", tid], right_on=["game_key", "team_id"],
                    how="left").drop(columns=["game_key", "team_id"])
    n = G["h_fresh_n"].notna() & G["a_fresh_n"].notna()
    print(f"{len(G):,} games, absence joined on {n.mean()*100:.1f}%", flush=True)
    return G[n].copy()


def markets(G):
    """(win, dec) pairs for backing home / away / over / under on FG and 1H."""
    cov = G["h1_cov_home"]
    h1_h = pd.Series(np.where(cov > 0, 1.0, np.where(cov < 0, 0.0, np.nan)), index=G.index)
    fgcov = (G["home_score"] - G["away_score"]) + G["t60_spread_home_point"]
    fg_h = pd.Series(np.where(fgcov > 0, 1.0, np.where(fgcov < 0, 0.0, np.nan)), index=G.index)
    ftot = G["home_score"] + G["away_score"]
    fg_o = pd.Series(np.where(ftot > G["t60_total_point"], 1.0,
                              np.where(ftot < G["t60_total_point"], 0.0, np.nan)), index=G.index)
    h1_o = pd.Series(np.where(G["h1_over"] > 0, 1.0,
                              np.where(G["h1_over"] < 0, 0.0, np.nan)), index=G.index)
    return {
        "FG spread": (fg_h, G["t60_spread_home_price"], 1 - fg_h, G["t60_spread_away_price"]),
        "1H spread": (h1_h, G["h1_sp_h"], 1 - h1_h, G["h1_sp_a"]),
        "FG total": (fg_o, G["t60_total_over_price"], 1 - fg_o, G["t60_total_under_price"]),
        "1H total": (h1_o, G["h1_ov"], 1 - h1_o, G["h1_un"]),
    }


def team_pair(G, mk, mask_h, mask_a, label, lines, min_n=40):
    """Side-by-side FG vs 1H: back the flagged team, and fade it."""
    m = mask_h.fillna(False) | mask_a.fillna(False)
    mh, ma = mask_h.fillna(False), mask_a.fillna(False)
    for mname in ("FG spread", "1H spread"):
        hw, hd, aw, ad = mk[mname]
        for direction in ("BACK", "FADE"):
            if direction == "BACK":
                win = pd.Series(np.where(mh, hw, np.where(ma, aw, np.nan)), index=G.index)
                dec = pd.Series(np.where(mh, hd, np.where(ma, ad, np.nan)), index=G.index)
            else:
                win = pd.Series(np.where(mh, aw, np.where(ma, hw, np.nan)), index=G.index)
                dec = pd.Series(np.where(mh, ad, np.where(ma, hd, np.nan)), index=G.index)
            bet(G, m, win, dec, f"{label} → {direction} team [{mname}]", lines, min_n)


def total_pair(G, mk, mask, label, lines, min_n=40):
    for mname in ("FG total", "1H total"):
        ow, od, uw, ud = mk[mname]
        bet(G, mask, ow, od, f"{label} → OVER [{mname}]", lines, min_n)
        bet(G, mask, uw, ud, f"{label} → UNDER [{mname}]", lines, min_n)


def main():
    G = load()
    mk = markets(G)
    lines = ["# NBA availability × 1H markets",
             "",
             f"{len(G):,} games with absence detail both sides (2023-24 → 2025-26 for 1H "
             "lines). Every signal graded on FG **and** 1H so the derivative question is "
             "answerable: FG dead + 1H alive = derivative mispricing; alive on both = the "
             "absence itself is mispriced. T-60 consensus, decimal. BE 52.4%.",
             ""]

    # ---------------- 1. does any absence matter at all
    lines.append("## 1 — Fresh absence, spread (does the market price it?)\n")
    lines.append("| signal | n | win% | ROI | per-season |")
    lines.append("|---|---|---|---|---|")
    fh, fa = G["h_fresh_n"] > 0, G["a_fresh_n"] > 0
    team_pair(G, mk, fh & ~fa, fa & ~fh, "any fresh regular OUT (other side full)", lines)
    t1h, t1a = G["h_top1_out"] > 0, G["a_top1_out"] > 0
    team_pair(G, mk, t1h & ~t1a, t1a & ~t1h, "TOP-MINUTES regular OUT", lines)
    for thr in (18, 20, 25):
        sh = (G["h_fresh_max_ppg"] >= thr) & (G["a_fresh_max_ppg"] < thr)
        sa = (G["a_fresh_max_ppg"] >= thr) & (G["h_fresh_max_ppg"] < thr)
        team_pair(G, mk, sh, sa, f"STAR out (fresh absentee ≥{thr} ppg)", lines)
    m2h = (G["h_fresh_n"] >= 2) & (G["a_fresh_n"] == 0)
    m2a = (G["a_fresh_n"] >= 2) & (G["h_fresh_n"] == 0)
    team_pair(G, mk, m2h, m2a, "2+ fresh regulars out (other side full)", lines)
    # stale (long-term) absence — should be fully priced
    sth = (G["h_stale_sum_ppg"] >= 15) & (G["a_stale_sum_ppg"] < 15)
    sta = (G["a_stale_sum_ppg"] >= 15) & (G["h_stale_sum_ppg"] < 15)
    team_pair(G, mk, sth, sta, "STALE 15+ ppg out (long-term, control)", lines)

    # ---------------- 2. totals: points removed
    lines.append("\n## 2 — Points removed → totals\n")
    lines.append("| signal | n | win% | ROI | per-season |")
    lines.append("|---|---|---|---|---|")
    G["tot_out_ppg"] = G["h_fresh_sum_ppg"] + G["a_fresh_sum_ppg"]
    for lo, hi in ((0.01, 15), (15, 25), (25, 40), (40, 999)):
        m = (G["tot_out_ppg"] >= lo) & (G["tot_out_ppg"] < hi)
        total_pair(G, mk, m, f"game-wide fresh ppg removed [{lo:.0f},{hi:.0f})", lines)
    total_pair(G, mk, G["tot_out_ppg"] == 0, "NOBODY out either side (control)", lines)
    both = (G["h_fresh_n"] > 0) & (G["a_fresh_n"] > 0)
    total_pair(G, mk, both, "BOTH teams missing a fresh regular", lines)
    starm = (G["h_fresh_max_ppg"] >= 20) | (G["a_fresh_max_ppg"] >= 20)
    total_pair(G, mk, starm, "either side missing a ≥20ppg star", lines)
    total_pair(G, mk, starm & ~both, "one side missing a ≥20ppg star, other full", lines)

    # ---------------- 3. returning players
    lines.append("\n## 3 — RETURNING players (minutes ramp hits the 4th, not the 1st)\n")
    lines.append("| signal | n | win% | ROI | per-season |")
    lines.append("|---|---|---|---|---|")
    rh, ra = G["h_ret_n"] > 0, G["a_ret_n"] > 0
    team_pair(G, mk, rh & ~ra, ra & ~rh, "regular RETURNS (other side no return)", lines)
    for thr in (18, 20):
        rsh = (G["h_ret_max_ppg"] >= thr) & (G["a_ret_max_ppg"] < thr)
        rsa = (G["a_ret_max_ppg"] >= thr) & (G["h_ret_max_ppg"] < thr)
        team_pair(G, mk, rsh, rsa, f"STAR RETURNS (≥{thr} ppg)", lines)
    anyret = rh | ra
    total_pair(G, mk, anyret, "any regular returning", lines)
    starret = (G["h_ret_max_ppg"] >= 20) | (G["a_ret_max_ppg"] >= 20)
    total_pair(G, mk, starret, "≥20ppg star returning (either side)", lines)

    # ---------------- 4. mechanism: does the 1H line adjust proportionally?
    lines.append("\n## 4 — Mechanism: is the 1H line a constant fraction of the FG line?\n")
    lines.append("If the book just halves the FG number, the 1H/FG ratio is flat across "
                 "absence cells even when the true first-half impact differs.\n")
    lines.append("| cell | n | FG total | 1H total | 1H/FG | actual FG | actual 1H | "
                 "actual 1H share |")
    lines.append("|---|---|---|---|---|---|---|---|")
    sub = G[G["t60_total_point"].notna() & G["h1_total"].notna() & G["h1_tot"].notna()].copy()
    sub["ftot"] = sub["home_score"] + sub["away_score"]
    cells = {
        "nobody out (control)": sub["tot_out_ppg"] == 0,
        "1-15 ppg removed": (sub["tot_out_ppg"] > 0) & (sub["tot_out_ppg"] < 15),
        "15-25 ppg removed": (sub["tot_out_ppg"] >= 15) & (sub["tot_out_ppg"] < 25),
        "25+ ppg removed": sub["tot_out_ppg"] >= 25,
        "≥20ppg star out": (sub["h_fresh_max_ppg"] >= 20) | (sub["a_fresh_max_ppg"] >= 20),
        "≥20ppg star returning": (sub["h_ret_max_ppg"] >= 20) | (sub["a_ret_max_ppg"] >= 20),
    }
    for lbl, m in cells.items():
        gg = sub[m]
        if len(gg) < 40:
            continue
        lines.append(f"| {lbl} | {len(gg):,} | {gg['t60_total_point'].mean():.1f} | "
                     f"{gg['h1_total'].mean():.1f} | {(gg['h1_total']/gg['t60_total_point']).mean():.4f} | "
                     f"{gg['ftot'].mean():.1f} | {gg['h1_tot'].mean():.1f} | "
                     f"{(gg['h1_tot']/gg['ftot']).mean():.4f} |")

    lines.append("")
    lines.append("| cell | n | FG spread | 1H spread | 1H/FG | actual FG margin | "
                 "actual 1H margin | actual 1H share |")
    lines.append("|---|---|---|---|---|---|---|---|")
    s2 = G[G["t60_spread_home_point"].abs() >= 2].copy()   # ratio is unstable near pick'em
    s2["fmargin"] = s2["home_score"] - s2["away_score"]
    scells = {
        "nobody out (control)": (s2["h_fresh_n"] == 0) & (s2["a_fresh_n"] == 0),
        "home missing ≥20ppg star": s2["h_fresh_max_ppg"] >= 20,
        "away missing ≥20ppg star": s2["a_fresh_max_ppg"] >= 20,
        "home 2+ regulars out": s2["h_fresh_n"] >= 2,
        "away 2+ regulars out": s2["a_fresh_n"] >= 2,
    }
    for lbl, m in scells.items():
        gg = s2[m]
        if len(gg) < 40:
            continue
        lines.append(f"| {lbl} | {len(gg):,} | {gg['t60_spread_home_point'].mean():+.2f} | "
                     f"{gg['h1_spread'].mean():+.2f} | "
                     f"{(gg['h1_spread']/gg['t60_spread_home_point']).mean():.4f} | "
                     f"{gg['fmargin'].mean():+.2f} | {gg['h1_margin'].mean():+.2f} | "
                     f"{(gg['h1_margin'].mean()/gg['fmargin'].mean()):.4f} |")

    path = os.path.join(ROOT, "NBA_AVAIL_1H_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
