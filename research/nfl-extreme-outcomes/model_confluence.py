"""Independent-signal confluence — the RIGHT way to stack (after cross_market.py showed that
stacking two MODEL outputs is redundant: the model already encodes game script).

A second signal only helps if it carries information the model did NOT use. Line MOVEMENT
(market behavior) qualifies; another model lean does not. Two tests:

  P2  WITHIN-market: model edge + own-line steam (the attempts finding, generalized to every
      edge market). Independent because the model never sees line movement.
  P3' CROSS-market MOVEMENT: does the whole passing tree steaming together (QB pass line + WR
      reception line both move) lift a WR under beyond the model alone?

Reads data/prop_model_eval.parquet. Read-only.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from stats_helpers import wilson_ci
from prop_model import amer_profit

DATA = Path(__file__).resolve().parent / "data"
# (market, bet side, model-edge sign) — the phase-1 edge direction per market
EDGES = [("player_rush_yds", "under"), ("player_rush_attempts", "under"),
         ("player_pass_attempts", "under"), ("player_pass_completions", "under"),
         ("player_receptions", "under"), ("player_pass_tds", "over"), ("player_pass_yds", "over")]


def load():
    d = pd.read_parquet(DATA / "prop_model_eval.parquet")
    d["move"] = d.close_line - d.open_line
    d["move_pct"] = d.move / d.open_line.replace(0, np.nan)
    return d


def grade(df, is_over):
    s = df[df.actual != df.close_line]
    if len(s) < 12:
        return None
    win = (s.actual > s.close_line).values if is_over else (s.actual < s.close_line).values
    px = s.over_px if is_over else s.under_px
    roi = np.nanmean(np.where(win, amer_profit(px.values), -1.0)) * 100
    k, n = int(win.sum()), len(s)
    lo, hi = wilson_ci(k, n)
    per = " ".join(f"{y}:{(((s[s.season==y].actual>s[s.season==y].close_line) if is_over else (s[s.season==y].actual<s[s.season==y].close_line)).mean()*100):.0f}%"
                   for y in (2024, 2025) if len(s[s.season == y]))
    return n, k/n*100, roi, per, (lo*100, hi*100)


def line(lbl, res):
    if res is None:
        print(f"    {lbl:40s} n<12"); return
    n, hp, roi, per, ci = res
    print(f"    {lbl:40s} n={n:4d} hit={hp:5.1f}% ROI={roi:+6.1f}% [{per}] CI[{ci[0]:.0f},{ci[1]:.0f}]")


def main():
    ev = load()
    TR = 0.03
    print("=== P2: model edge + OWN-line steam (independent: model never sees movement) ===")
    for mkt, sidestr in EDGES:
        is_over = sidestr == "over"
        m = ev[ev.market == mkt]
        sig = m[m.edge_pct >= TR] if is_over else m[m.edge_pct <= -TR]     # model on the bet side
        up = sig[sig.move >= 0.5]                                          # line steamed up
        dn = sig[sig.move <= -0.5]                                         # line steamed down
        print(f"  {mkt} model {sidestr.upper()}:")
        line("model alone", grade(sig, is_over))
        line("model + line steamed UP (fade)", grade(up, is_over))
        line("model + line steamed DOWN (follow)", grade(dn, is_over))

    print("\n=== P3': CROSS-market MOVEMENT — WR under + same-team QB pass line also moved down ===")
    qb = ev[ev.market == "player_pass_yds"]
    idx = qb.groupby(["season", "week", "team"]).close_line.idxmax()
    qbm = qb.loc[idx, ["season", "week", "team", "move"]].rename(columns={"move": "qb_move"})
    rec = ev[ev.market.isin(("player_receptions", "player_reception_yds"))].merge(
        qbm, on=["season", "week", "team"], how="left")
    ru = rec[rec.edge_pct <= -TR].dropna(subset=["qb_move"])
    line("WR under (model) ALONE", grade(ru, False))
    line("WR under + QB pass line moved DOWN", grade(ru[ru.qb_move <= -1.0], False))
    line("WR under + QB pass line moved UP", grade(ru[ru.qb_move >= 1.0], False))
    line("WR under + own rec line moved DOWN too", grade(ru[ru.move <= -0.5], False))


if __name__ == "__main__":
    main()
