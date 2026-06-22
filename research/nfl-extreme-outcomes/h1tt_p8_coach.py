"""Battery 8: coach 1st-half profiles.

Descriptive: per-coach 1H ATS cover rate + 1H ML win rate + avg 1H margin
vs 1H expectation (h1_m + h1_sp), 2023-25.

Honest tests (no peeking):
  A. Coach 1H cover rate 2023-24 (min 15 graded) -> bet top/bottom quartile
     coaches ON/AGAINST in 2025.
  B. Within-season: cover rate weeks 1-9 (min 5) -> bet weeks 10+ (all seasons).
"""
import numpy as np
import pandas as pd
from pathlib import Path

from h1tt_p7_situational import team_rows, bet, rep

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)


def main():
    f = pd.read_parquet(ROOT / "data" / "h1tt_context.parquet")
    t = team_rows(f)
    t = t[t.h1_sp.notna()]
    t["cov_val"] = np.where(t.h1_push, np.nan, t.h1_cov)
    t["mlw_val"] = np.where(t.h1_mlp, np.nan, t.h1_mlw)
    t["ats_edge"] = t.h1_m + t.h1_sp   # >0 = beat the 1H number

    # ---------- descriptive
    print("=" * 100)
    print("COACH 1H PROFILES 2023-25 (min 30 games)")
    g = (t.groupby("coach")
         .agg(n=("cov_val", "size"), covr=("cov_val", "mean"),
              mlw=("mlw_val", "mean"), ats_edge=("ats_edge", "mean"),
              h1_ppg=("h1_m", lambda x: np.nan))  # placeholder
         .query("n >= 30").sort_values("covr", ascending=False))
    g["covr"] = (g.covr * 100).round(1)
    g["mlw"] = (g.mlw * 100).round(1)
    g["ats_edge"] = g.ats_edge.round(2)
    print(g.drop(columns="h1_ppg").to_string())

    # ---------- A. cross-season
    print("\n" + "=" * 100)
    print("A. COACH 1H ATS 2023-24 (min 15) -> 2025 bets")
    tr = t[t.season.isin([2023, 2024])]
    prof = (tr.groupby("coach").cov_val.agg(["mean", "count"])
            .query("count >= 15"))
    hi = prof[prof["mean"] >= prof["mean"].quantile(0.75)].index
    lo = prof[prof["mean"] <= prof["mean"].quantile(0.25)].index
    te = t[t.season == 2025]
    print(f"top-quartile coaches ({len(hi)}): {sorted(hi)[:12]}")
    print(f"bottom-quartile ({len(lo)}): {sorted(lo)[:12]}")
    rep(bet(te[te.coach.isin(hi)], "h1sp", "on"), "2025: ON top-quartile 1H coaches", always=True)
    rep(bet(te[te.coach.isin(lo)], "h1sp", "against"), "2025: AGAINST bottom-quartile", always=True)
    rep(bet(te[te.coach.isin(hi) & te.opp_coach.isin(lo)], "h1sp", "on"),
        "2025: top coach vs bottom coach, ON top", always=True)
    # ML version: fast-start coaches by 1H ML
    profm = (tr.groupby("coach").mlw_val.agg(["mean", "count"]).query("count >= 15"))
    him = profm[profm["mean"] >= profm["mean"].quantile(0.75)].index
    rep(bet(te[te.coach.isin(him)], "h1ml", None), "2025: 1H ML on top 1H-ML coaches", always=True)

    # ---------- B. within-season
    print("\n" + "=" * 100)
    print("B. WITHIN-SEASON: coach 1H cover rate wks 1-9 (min 5) -> bets wks 10+")
    rows_on, rows_against = [], []
    for s in (2023, 2024, 2025):
        early = t[(t.season == s) & (t.week <= 9)]
        prof = early.groupby("coach").cov_val.agg(["mean", "count"]).query("count >= 5")
        hi = prof[prof["mean"] >= 0.65].index
        lo = prof[prof["mean"] <= 0.35].index
        late = t[(t.season == s) & (t.week >= 10)]
        rows_on.append(late[late.coach.isin(hi)])
        rows_against.append(late[late.coach.isin(lo)])
    rep(bet(pd.concat(rows_on), "h1sp", "on"),
        "wks10+: ON coaches covering >=65% early", always=True)
    rep(bet(pd.concat(rows_against), "h1sp", "against"),
        "wks10+: AGAINST coaches covering <=35% early", always=True)


if __name__ == "__main__":
    main()
