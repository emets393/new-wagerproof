"""Cross-market correlated confluence — the core hypothesis.

Game script is a shared latent factor across a team's whole prop slate. If the model projects a
team to pass LESS than the market expects, that offense's whole passing tree (QB yds/comp/att,
WR receptions/rec-yds) should lean UNDER together — and its run game lean OVER. When independent
same-team projections ALIGN with the script, each leg should hit higher than it does alone.

Tests (all graded at T-60, both seasons, vs the unconditional model-signal baseline):
  H1  WR under (rec/rec-yds) — does the SAME-TEAM QB also being model-under on passing lift it?
  H2  RB rush over — does the same-team QB being model-UNDER on passing (run script) lift it?
  H3  QB pass under — does a same-team WR also being model-under reinforce it (mutual)?

Reads data/prop_model_eval.parquet. Read-only.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from stats_helpers import wilson_ci
from prop_model import amer_profit

DATA = Path(__file__).resolve().parent / "data"
PASS_MKT = ("player_pass_yds", "player_pass_completions", "player_pass_attempts")
REC_MKT = ("player_receptions", "player_reception_yds")


def load():
    return pd.read_parquet(DATA / "prop_model_eval.parquet")


def team_pass_lean(ev):
    """Team passing script = starter QB's passing model lean (edge_pct), via the QB with the
    biggest pass-yds line per team-game. Negative = model projects fewer pass yards than posted."""
    qb = ev[ev.market == "player_pass_yds"]
    idx = qb.groupby(["season", "week", "team"]).close_line.idxmax()
    return qb.loc[idx, ["season", "week", "team", "edge_pct"]].rename(columns={"edge_pct": "qb_pass_lean"})


def grade(df, is_over):
    s = df[df.actual != df.close_line]
    if len(s) < 12:
        return None
    win = (s.actual < s.close_line).values if not is_over else (s.actual > s.close_line).values
    px = s.under_px if not is_over else s.over_px
    roi = np.nanmean(np.where(win, amer_profit(px.values), -1.0)) * 100
    k, n = int(win.sum()), len(s)
    lo, hi = wilson_ci(k, n)
    per = " ".join(f"{y}:{(((s[s.season==y].actual<s[s.season==y].close_line) if not is_over else (s[s.season==y].actual>s[s.season==y].close_line)).mean()*100):.0f}%"
                   for y in (2024, 2025) if len(s[s.season == y]))
    return n, k/n*100, roi, per, (lo*100, hi*100)


def line(lbl, res):
    if res is None:
        print(f"    {lbl:38s} n<12"); return
    n, hp, roi, per, ci = res
    print(f"    {lbl:38s} n={n:4d} hit={hp:5.1f}% ROI={roi:+6.1f}% [{per}] CI[{ci[0]:.0f},{ci[1]:.0f}]")


def main():
    ev = load()
    lean = team_pass_lean(ev)
    ev = ev.merge(lean, on=["season", "week", "team"], how="left")
    TR, TQ = 0.03, 0.02       # receiver/rb lean threshold, QB script threshold (edge_pct)

    print("=== H1: WR UNDER (receptions/rec-yds) — lifted by same-team QB also passing-under? ===")
    rec = ev[ev.market.isin(REC_MKT)]
    ru = rec[rec.edge_pct <= -TR].dropna(subset=["qb_pass_lean"])
    line("WR under ALONE (baseline)", grade(ru, False))
    line("WR under + QB also under (script)", grade(ru[ru.qb_pass_lean <= -TQ], False))
    line("WR under + QB NOT under (no script)", grade(ru[ru.qb_pass_lean > -TQ], False))

    print("\n=== H2: RB rush-yds OVER — lifted by same-team QB passing-UNDER (run script)? ===")
    rb = ev[ev.market == "player_rush_yds"]
    ro = rb[rb.edge_pct >= TR].dropna(subset=["qb_pass_lean"])
    line("RB over ALONE (baseline)", grade(ro, True))
    line("RB over + QB passing under (run script)", grade(ro[ro.qb_pass_lean <= -TQ], True))
    line("RB over + QB NOT under", grade(ro[ro.qb_pass_lean > -TQ], True))
    # and the RB-UNDER direction (phase-1 rush edge) with script agreement
    rud = rb[rb.edge_pct <= -TR].dropna(subset=["qb_pass_lean"])
    print("   (contrast) RB rush-yds UNDER:")
    line("RB under ALONE", grade(rud, False))
    line("RB under + QB also under (whole offense down)", grade(rud[rud.qb_pass_lean <= -TQ], False))

    print("\n=== H3: QB pass-yds UNDER — reinforced by a same-team WR also model-under? ===")
    # team WR-under presence: any receiver on the team-game with a meaningful under lean
    wru = ev[ev.market.isin(REC_MKT) & (ev.edge_pct <= -TR)]
    wr_flag = wru.groupby(["season", "week", "team"]).size().rename("n_wr_under").reset_index()
    qb = ev[ev.market == "player_pass_yds"].merge(wr_flag, on=["season", "week", "team"], how="left")
    qb["n_wr_under"] = qb.n_wr_under.fillna(0)
    qu = qb[qb.edge_pct <= -TR]
    line("QB pass under ALONE", grade(qu, False))
    line("QB pass under + >=1 WR also under", grade(qu[qu.n_wr_under >= 1], False))
    line("QB pass under + >=2 WR also under", grade(qu[qu.n_wr_under >= 2], False))
    line("QB pass under + NO WR under", grade(qu[qu.n_wr_under == 0], False))


if __name__ == "__main__":
    main()
