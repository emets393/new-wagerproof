#!/usr/bin/env python3
"""TRUE regression study via possession data (REGRESSION_BRIEF2.md).

The plays data separates shot QUALITY from shot MAKING:
  exp_eFG   = what a team's shot mix (rim/jumper/three) SHOULD yield at
              league-average conversion by zone
  shot luck = actual eFG − exp_eFG (recent window, strictly prior)
  def-3P luck = opponent 3P% in recent games vs league average — college
              defenses barely control opponent 3P%; deviation is luck.

Signals: teams riding good shooting luck → fade / unders next game; unlucky →
back / overs. Luck DIFFERENTIAL between the two teams → ATS. Month splits.
All bets T-60 consensus. BE 52.4%.
"""
import os

import numpy as np
import pandas as pd

import build_possession_features as bp

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


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


def luck_table():
    g = bp.per_game()
    g["jump_att"] = g["fga"] - g["rim_att"] - g["three_att"]
    g["jump_made"] = g["fg_made"] - g["rim_made"] - g["three_made"]
    # league zone conversion per season
    lg = g.groupby("season_lbl").agg(
        rim=("rim_made", "sum"), rim_a=("rim_att", "sum"),
        jmp=("jump_made", "sum"), jmp_a=("jump_att", "sum"),
        thr=("three_made", "sum"), thr_a=("three_att", "sum"))
    lg["lg_rim"] = lg["rim"] / lg["rim_a"]
    lg["lg_jmp"] = lg["jmp"] / lg["jmp_a"]
    lg["lg_thr"] = lg["thr"] / lg["thr_a"]
    g = g.merge(lg[["lg_rim", "lg_jmp", "lg_thr"]], on="season_lbl")

    shoot_pts = 2 * (g["rim_made"] + g["jump_made"]) + 3 * g["three_made"]
    exp_pts = 2 * (g["rim_att"] * g["lg_rim"] + g["jump_att"] * g["lg_jmp"]) \
        + 3 * g["three_att"] * g["lg_thr"]
    g["efg"] = shoot_pts / (2 * g["fga"].replace(0, np.nan))
    g["exp_efg"] = exp_pts / (2 * g["fga"].replace(0, np.nan))
    g["luck"] = g["efg"] - g["exp_efg"]

    # defensive 3P luck: opponent 3P% vs league
    opp = g[["gameId", "teamId", "three_att", "three_made"]].copy()
    opp.columns = ["gameId", "opp_id", "o3a", "o3m"]
    m = g.merge(opp, on="gameId")
    m = m[m["teamId"] != m["opp_id"]].drop_duplicates(["gameId", "teamId"])
    m["d3_luck"] = (m["o3m"] / m["o3a"].replace(0, np.nan)) - m["lg_thr"]

    dates = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet",
                            columns=["gameId", "teamId", "startDate"]
                            ).drop_duplicates(["gameId", "teamId"])
    m = m.merge(dates, on=["gameId", "teamId"], how="left")
    m["date"] = pd.to_datetime(m["startDate"]).dt.tz_localize(None)
    m["tkey"] = m["teamId"].astype(str) + "_" + m["season_lbl"]
    m = m.sort_values(["tkey", "date"])
    grp = m.groupby("tkey")
    for c, w in (("luck", 5), ("d3_luck", 5)):
        m[f"l{w}_{c}"] = grp[c].transform(lambda s: s.shift(1).rolling(w, min_periods=3).mean())
    return m[["gameId", "teamId", "l5_luck", "l5_d3_luck"]]


def main():
    lk = luck_table()
    df = pd.read_parquet(f"{OUT}/sides_table_ncaab.parquet")
    for side in ("h", "a"):
        s = lk.rename(columns={"gameId": "cbbd_id", "teamId": f"{side}_team_id",
                               "l5_luck": f"{side}_luck", "l5_d3_luck": f"{side}_d3luck"})
        df = df.merge(s, on=["cbbd_id", f"{side}_team_id"], how="left")
    df = df.dropna(subset=["h_luck", "a_luck"]).copy()
    print(f"{len(df):,} games with luck features", flush=True)

    cover = df["cover_amt"]
    push = cover == 0
    hdec, adec = df["t60_spread_home_price"], df["t60_spread_away_price"]
    total = df["home_score"] + df["away_score"]
    tline = df["t60_total_point"]
    has_t = tline.notna()
    over_dec, under_dec = df["t60_total_over_price"], df["t60_total_under_price"]

    q = lambda s, p: s.quantile(p)
    lines = ["# Regression Brief #2 — TRUE luck regression via possession data",
             "",
             f"{len(df):,} games. luck = L5 (eFG − shot-mix-expected eFG), strictly prior.",
             "d3luck = L5 opponent-3P% vs league (defensive 3P luck). T-60 prices. BE 52.4%."]

    lines.append("\n## Shooting luck → next game (fade the hot hand?)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for side, tag in (("h", "HOME"), ("a", "AWAY")):
        L = df[f"{side}_luck"]
        hot = L >= q(L, .9)
        cold = L <= q(L, .1)
        win_own = (cover > 0) if side == "h" else (cover < 0)
        dec_own = hdec if side == "h" else adec
        dec_opp = adec if side == "h" else hdec
        bet(df[hot], (~win_own & ~push)[hot], push[hot], dec_opp[hot],
            f"{tag} LUCKY (top decile) → FADE", lines)
        bet(df[cold], win_own[cold], push[cold], dec_own[cold],
            f"{tag} UNLUCKY (bottom decile) → BACK", lines)
    # luck differential ATS
    df["luck_diff"] = df["h_luck"] - df["a_luck"]
    hi, lo = q(df["luck_diff"], .9), q(df["luck_diff"], .1)
    bet(df[df["luck_diff"] >= hi], (cover < 0)[df["luck_diff"] >= hi] & ~push[df["luck_diff"] >= hi],
        push[df["luck_diff"] >= hi], adec[df["luck_diff"] >= hi],
        f"home much luckier (diff ≥{hi:.3f}) → BACK AWAY", lines)
    bet(df[df["luck_diff"] <= lo], (cover > 0)[df["luck_diff"] <= lo],
        push[df["luck_diff"] <= lo], hdec[df["luck_diff"] <= lo],
        f"away much luckier (diff ≤{lo:.3f}) → BACK HOME", lines)

    lines.append("\n## Shooting luck → totals\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    both_lucky = (df["h_luck"] >= q(df["h_luck"], .75)) & (df["a_luck"] >= q(df["a_luck"], .75))
    both_unlucky = (df["h_luck"] <= q(df["h_luck"], .25)) & (df["a_luck"] <= q(df["a_luck"], .25))
    for label, mask, side in (("BOTH lucky → UNDER (regress)", both_lucky, "under"),
                              ("BOTH lucky → OVER", both_lucky, "over"),
                              ("BOTH unlucky → OVER (regress)", both_unlucky, "over"),
                              ("BOTH unlucky → UNDER", both_unlucky, "under")):
        win = (total < tline) if side == "under" else (total > tline)
        dec = under_dec if side == "under" else over_dec
        bet(df[mask], win.where(has_t)[mask], (~has_t | (total == tline))[mask],
            dec[mask], label, lines)

    lines.append("\n## Defensive 3P luck (the Torvik insight)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for side, tag in (("h", "HOME"), ("a", "AWAY")):
        D = df[f"{side}_d3luck"]
        blessed = D <= q(D, .1)   # opponents shot badly → defense overrated
        cursed = D >= q(D, .9)    # opponents shot hot → defense underrated
        win_own = (cover > 0) if side == "h" else (cover < 0)
        dec_own = hdec if side == "h" else adec
        dec_opp = adec if side == "h" else hdec
        bet(df[blessed], (~win_own & ~push)[blessed], push[blessed], dec_opp[blessed],
            f"{tag} D-3P blessed (opp shot cold) → FADE", lines)
        bet(df[cursed], win_own[cursed], push[cursed], dec_own[cursed],
            f"{tag} D-3P cursed (opp shot hot) → BACK", lines)
        bet(df[blessed], (total > tline).where(has_t)[blessed],
            (~has_t | (total == tline))[blessed], over_dec[blessed],
            f"{tag} D-3P blessed → game OVER (regression)", lines)

    lines.append("\n## Month splits (unlucky-back signals by phase)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for months, tag in (([11, 12], "Nov-Dec"), ([1, 2], "Jan-Feb"), ([3, 4], "Mar+")):
        pm = df["month"].isin(months)
        for side in ("h", "a"):
            L = df[f"{side}_luck"]
            cold = (L <= q(L, .15)) & pm
            win_own = (cover > 0) if side == "h" else (cover < 0)
            dec_own = hdec if side == "h" else adec
            bet(df[cold], win_own[cold], push[cold], dec_own[cold],
                f"{side.upper()} unlucky (≤15th) {tag} → BACK", lines)

    path = os.path.join(ROOT, "REGRESSION_BRIEF2.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
