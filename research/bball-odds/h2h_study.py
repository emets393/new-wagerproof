#!/usr/bin/env python3
"""Head-to-head matchup study (H2H_BRIEF1.md), NBA emphasis + NCAAB rematches.

For each game, prior meetings of the same two teams within the past 730 days
(both venues). Prior-meeting stats, all market-relative (vs that meeting's own
T-60 line, so team strength is already netted out):

  h2h_cover     current home team's ATS record in prior meetings
  h2h_tot_err   mean (actual total - closing total) of prior meetings

Signals: if matchup history predicts, teams that dominated the H2H ATS keep
covering, and matchups that run hot keep running hot — graded at T-60.
"""
import os
from collections import defaultdict

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def load(sport):
    mg = pd.read_parquet(f"{OUT}/movement_games_{sport}.parquet")
    mg = mg.dropna(subset=["home_score", "t60_spread_home_point", "t60_total_point"])
    mg["ts"] = pd.to_datetime(mg["commence_time"]).dt.tz_localize(None)
    mg = mg.sort_values("ts").reset_index(drop=True)
    mg["cover_amt"] = (mg["home_score"] - mg["away_score"]) + mg["t60_spread_home_point"]
    mg["tot_err"] = (mg["home_score"] + mg["away_score"]) - mg["t60_total_point"]
    return mg


def h2h_features(mg):
    hist = defaultdict(list)  # pair -> list of (ts, home_team, cover_amt, tot_err)
    rows = []
    for r in mg.itertuples():
        pair = frozenset((r.home_team, r.away_team))
        prior = [(t, h, c, e) for (t, h, c, e) in hist[pair]
                 if (r.ts - t).days <= 730]
        covers = [(c > 0) if h == r.home_team else (c < 0) for (_, h, c, _) in prior
                  if c != 0]
        errs = [e for (_, _, _, e) in prior]
        rows.append((len(prior),
                     np.mean(covers) if covers else np.nan,
                     np.mean(errs) if errs else np.nan))
        hist[pair].append((r.ts, r.home_team, r.cover_amt, r.tot_err))
    mg[["h2h_n", "h2h_cover", "h2h_tot_err"]] = pd.DataFrame(rows, index=mg.index)
    return mg


def bet(df, win, push, dec, label, lines, min_n=50):
    ok = ~push
    n = int(ok.sum())
    if n < min_n:
        return
    profit = np.where(push, 0.0, np.where(win, dec.fillna(1.909) - 1, -1.0))
    per = []
    for s, g in df.assign(w=win & ok, ok=ok, pr=profit).groupby("season"):
        m = int(g["ok"].sum())
        if m:
            per.append(f"{s}: {g['w'].sum()}/{m} {g['w'].sum()/m*100:.0f}% {g[g['ok']]['pr'].mean()*100:+.0f}%")
    lines.append(f"| {label} | {n:,} | {(win & ok).sum()/n*100:.1f}% | "
                 f"{profit[ok].mean()*100:+.1f}% | {' · '.join(per)} |")


def run(sport, lines):
    mg = h2h_features(load(sport))
    have = mg[mg["h2h_n"] >= 2]
    lines.append(f"\n## {sport.upper()} — {len(have):,} games with ≥2 prior meetings (730d)\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")

    push = have["cover_amt"] == 0
    home_cover = have["cover_amt"] > 0
    for lo, tag in ((0.75, "home covered ≥75% of prior H2H"),):
        sub = have[have["h2h_cover"] >= lo]
        bet(sub, home_cover[sub.index] & ~push[sub.index], push[sub.index],
            sub["t60_spread_home_price"], f"{tag} → BACK HOME", lines)
        bet(sub, ~home_cover[sub.index] & ~push[sub.index], push[sub.index],
            sub["t60_spread_away_price"], f"{tag} → FADE (away)", lines)
        sub = have[have["h2h_cover"] <= 1 - lo]
        bet(sub, ~home_cover[sub.index] & ~push[sub.index], push[sub.index],
            sub["t60_spread_away_price"], f"home covered ≤{100-lo*100:.0f}% of prior H2H → BACK AWAY", lines)
        bet(sub, home_cover[sub.index] & ~push[sub.index], push[sub.index],
            sub["t60_spread_home_price"], f"home covered ≤{100-lo*100:.0f}% → BACK HOME (regress)", lines)

    opush = have["tot_err"] == 0
    over = have["tot_err"] > 0
    for thr in (4, 8):
        sub = have[have["h2h_tot_err"] >= thr]
        bet(sub, over[sub.index] & ~opush[sub.index], opush[sub.index],
            sub["t60_total_over_price"], f"prior H2H ran OVER by ≥{thr} → OVER", lines)
        bet(sub, ~over[sub.index] & ~opush[sub.index], opush[sub.index],
            sub["t60_total_under_price"], f"prior H2H ran OVER by ≥{thr} → UNDER (regress)", lines)
        sub = have[have["h2h_tot_err"] <= -thr]
        bet(sub, ~over[sub.index] & ~opush[sub.index], opush[sub.index],
            sub["t60_total_under_price"], f"prior H2H ran UNDER by ≥{thr} → UNDER", lines)
        bet(sub, over[sub.index] & ~opush[sub.index], opush[sub.index],
            sub["t60_total_over_price"], f"prior H2H ran UNDER by ≥{thr} → OVER (regress)", lines)


def main():
    lines = ["# H2H Matchup Brief #1 — does matchup history beat the close?",
             "",
             "Prior meetings ≤730 days, both venues, market-relative (each meeting",
             "measured vs its own T-60 line). Bets at T-60 consensus. Breakeven 52.4%."]
    for sport in ("nba", "ncaab"):
        run(sport, lines)
    path = os.path.join(ROOT, "H2H_BRIEF1.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
