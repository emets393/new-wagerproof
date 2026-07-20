#!/usr/bin/env python3
"""KenPom fanmatch vs market study (NCAAB): model edge alone + edge x movement.

The MLB playbook's durable signals were movement x MODEL interactions, not
movement alone. Here the "model" is KenPom's own game predictions (fanmatch),
which we have dated historically — no lookahead.

Edge conventions (home perspective):
  kp_margin   = HomePred - VisitorPred        (KenPom predicted home margin)
  spread_edge = kp_margin + t60_spread        (>0: KenPom likes HOME vs the line)
  total_edge  = (HomePred+VisitorPred) - t60_total  (>0: KenPom leans OVER)

All bets trigger and are graded at the T-60 consensus line/price.
Writes KENPOM_BRIEF1.md.
"""
import os

import numpy as np
import pandas as pd

from movement_study import grade_side, grade_total, summarize
from name_maps import norm, kp_to_cbbd
from join_results import NCAAB_OVERRIDES

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def load():
    mg = pd.read_parquet(f"{OUT}/movement_games_ncaab.parquet")
    mg = mg.dropna(subset=["home_score"]).copy()
    fm = pd.read_parquet(f"{OUT}/kenpom_fanmatch.parquet")

    mapping = pd.read_parquet(f"{OUT}/ncaab_team_mapping.parquet")
    dedup = mapping.drop_duplicates("odds_api_format", keep="first")
    slug_to_cbbd = {norm(s): norm(n) for s, n in
                    zip(dedup["odds_api_format"], dedup["api_team_name"])}
    lookup = {**slug_to_cbbd, **NCAAB_OVERRIDES}

    mg["home_key"] = mg["home_team"].map(norm).map(lookup)
    mg["away_key"] = mg["away_team"].map(norm).map(lookup)
    mg["ts"] = pd.to_datetime(mg["commence_time"]).dt.tz_localize(None)

    fm["home_key"] = fm["Home"].map(kp_to_cbbd).map(norm)
    fm["away_key"] = fm["Visitor"].map(kp_to_cbbd).map(norm)
    fm["ts_r"] = pd.to_datetime(fm["DateOfGame"])
    fm = fm[["home_key", "away_key", "ts_r", "HomePred", "VisitorPred", "HomeWP"]]

    m = mg.merge(fm, on=["home_key", "away_key"], how="left")
    m["dt"] = (m["ts_r"] - m["ts"]).abs()
    m.loc[m["dt"] > pd.Timedelta(hours=36), ["HomePred", "VisitorPred", "HomeWP"]] = None
    m = m.sort_values("dt").drop_duplicates("event_id", keep="first")
    matched = m["HomePred"].notna().mean()
    print(f"fanmatch matched: {matched*100:.1f}% of {len(m):,} games", flush=True)

    m["kp_margin"] = m["HomePred"] - m["VisitorPred"]
    m["spread_edge"] = m["kp_margin"] + m["t60_spread_home_point"]
    m["total_edge"] = (m["HomePred"] + m["VisitorPred"]) - m["t60_total_point"]
    m["smove"] = m["t60_spread_home_point"] - m["open_spread_home_point"]
    m["tmove"] = m["t60_total_point"] - m["open_total_point"]
    return m.dropna(subset=["HomePred"]).copy()


def main():
    df = load()
    lines = ["# KenPom Brief #1 — fanmatch model edge vs market (NCAAB)",
             "",
             f"{len(df):,} games with KenPom predictions joined. All bets at T-60 line/price.",
             "spread_edge>0 = KenPom likes HOME vs the line; total_edge>0 = KenPom leans OVER."]

    lines.append("\n## KenPom spread edge alone — bet the KenPom side\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for lo, hi in ((1, 3), (2, 4), (3, 6), (4, 99), (6, 99)):
        sub = df[(df["spread_edge"] >= lo) & (df["spread_edge"] < hi)]
        summarize(sub, *grade_side(sub, "home"), f"KP likes HOME by [{lo},{hi}) → HOME", lines)
        sub = df[(df["spread_edge"] <= -lo) & (df["spread_edge"] > -hi)]
        summarize(sub, *grade_side(sub, "away"), f"KP likes AWAY by [{lo},{hi}) → AWAY", lines)

    lines.append("\n## KenPom total edge alone\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for lo, hi in ((2, 4), (3, 6), (4, 99), (6, 99), (8, 99)):
        sub = df[(df["total_edge"] >= lo) & (df["total_edge"] < hi)]
        summarize(sub, *grade_total(sub, "over"), f"KP over-lean [{lo},{hi}) → OVER", lines)
        sub = df[(df["total_edge"] <= -lo) & (df["total_edge"] > -hi)]
        summarize(sub, *grade_total(sub, "under"), f"KP under-lean [{lo},{hi}) → UNDER", lines)

    # ---- MLB-playbook interactions: movement x model ----
    lines.append("\n## Interaction: total moved toward/away from KenPom's lean\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for mv in (1.0, 2.0):
        # market moved TOWARD KenPom (confirming) — follow model at worse number
        sub = df[(df["total_edge"] >= 2) & (df["tmove"] >= mv)]
        summarize(sub, *grade_total(sub, "over"), f"KP over-lean≥2 + line ROSE ≥{mv} → OVER (confirm)", lines)
        sub = df[(df["total_edge"] <= -2) & (df["tmove"] <= -mv)]
        summarize(sub, *grade_total(sub, "under"), f"KP under-lean≥2 + line DROPPED ≥{mv} → UNDER (confirm)", lines)
        # market moved AGAINST KenPom — model gets better number (MLB 'follow model on dip')
        sub = df[(df["total_edge"] >= 2) & (df["tmove"] <= -mv)]
        summarize(sub, *grade_total(sub, "over"), f"KP over-lean≥2 + line DROPPED ≥{mv} → OVER (buy dip)", lines)
        sub = df[(df["total_edge"] <= -2) & (df["tmove"] >= mv)]
        summarize(sub, *grade_total(sub, "under"), f"KP under-lean≥2 + line ROSE ≥{mv} → UNDER (buy dip)", lines)

    lines.append("\n## Interaction: spread steam toward/away from KenPom's side\n")
    lines.append("| signal | n | win% | ROI | per season |")
    lines.append("|---|---|---|---|---|")
    for mv in (0.5, 1.0):
        sub = df[(df["spread_edge"] >= 2) & (df["smove"] <= -mv)]
        summarize(sub, *grade_side(sub, "home"), f"KP HOME edge≥2 + steam HOME ≥{mv} → HOME (confirm)", lines)
        sub = df[(df["spread_edge"] <= -2) & (df["smove"] >= mv)]
        summarize(sub, *grade_side(sub, "away"), f"KP AWAY edge≥2 + steam AWAY ≥{mv} → AWAY (confirm)", lines)
        sub = df[(df["spread_edge"] >= 2) & (df["smove"] >= mv)]
        summarize(sub, *grade_side(sub, "home"), f"KP HOME edge≥2 + steam AWAY ≥{mv} → HOME (buy dip)", lines)
        sub = df[(df["spread_edge"] <= -2) & (df["smove"] <= -mv)]
        summarize(sub, *grade_side(sub, "away"), f"KP AWAY edge≥2 + steam HOME ≥{mv} → AWAY (buy dip)", lines)

    path = os.path.join(ROOT, "KENPOM_BRIEF1.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
