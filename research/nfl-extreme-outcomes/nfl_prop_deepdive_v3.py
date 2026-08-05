"""Deep-dive: per-market feature-GROUP ablation (which metrics help/hurt) + per-side bet sweep.
RESEARCH ONLY. Stage 1 = fast single-split (train<=2023, test 24-25) add-one-group MAE per market ->
tells us which groups lower MAE for which market. Stage 2 = walk-forward on the per-market chosen set,
then a per-side / per-threshold bet sweep (recover deployable cells) with full guardrails.
"""
import sys
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingRegressor
from attempts_model import OFF, DEF, amer_profit

DATA = Path(__file__).resolve().parent / "data"
p = pd.read_parquet(DATA / "nfl_prop_v3_panel.parquet")
MKTS = ["player_pass_yds", "player_pass_tds", "player_receptions", "player_reception_yds",
        "player_rush_yds", "player_pass_attempts", "player_rush_attempts", "player_pass_completions"]
G = {
    "FORM": ["l3", "l5", "szn"], "SCRIPT": ["team_spread", "total", "is_home"], "LINE": ["close_line"],
    "OFF": OFF, "DEF": DEF,
    "POS": ["opp_pos_allow_s2d", "opp_pos_allow_l5", "opp_pos_allow_l3", "opp_pos_vol_s2d"],
    "TM": [c for c in p.columns if c.startswith("tm_")], "MAD": ["own_madden_ovr"],
    "USAGE": [f"{b}_{w}" for b in ("tgt_share", "carry_share", "att_share") for w in ("s2d", "l5", "l3")],
    "SNAP": ["snap_pct_s2d", "snap_pct_l5", "snap_pct_l3"],
}
HP = dict(max_depth=4, learning_rate=0.05, max_iter=400, min_samples_leaf=40, l2_regularization=1.0)
BASE = G["FORM"] + G["SCRIPT"]                       # always-on core (form + script)
ADDABLE = ["OFF", "DEF", "POS", "TM", "MAD", "USAGE", "SNAP", "LINE"]  # LINE can't train pre-2024 in a
# single split (lines only exist 2024-25) -> judged via walk-forward, shown here for completeness.


def split_mae(m, feats):
    tr = m[m.season <= 2023].dropna(subset=["actual", "team_spread"])
    te = m[m.season.isin([2024, 2025])].dropna(subset=["actual", "team_spread", "close_line"])
    if len(tr) < 500 or len(te) < 50:
        return None, None
    mdl = HistGradientBoostingRegressor(**HP).fit(tr[feats], tr.actual)
    pr = mdl.predict(te[feats])
    return np.abs(pr - te.actual).mean(), np.abs(te.close_line - te.actual).mean()


if __name__ == "__main__":
    print("=" * 104)
    print("STAGE 1 — per-market add-one-group MAE (Δ vs BASE=form+script+line). negative Δ = HELPS.")
    print("=" * 104)
    print(f"{'market':22} {'lineMAE':>7} {'BASE':>7} " + " ".join(f"{g:>7}" for g in ADDABLE))
    chosen = {}
    for mkt in MKTS:
        m = p[p.market == mkt].dropna(subset=["actual", "team_spread"]).copy()
        base_mae, line_mae = split_mae(m, BASE)
        if base_mae is None:
            print(f"{mkt:22} thin"); continue
        deltas = {}
        for g in ADDABLE:
            mae, _ = split_mae(m, BASE + G[g])
            deltas[g] = mae - base_mae
        chosen[mkt] = [g for g in ADDABLE if deltas[g] < -0.001]
        cells = " ".join(f"{deltas[g]:>+7.3f}" for g in ADDABLE)
        print(f"{mkt:22} {line_mae:>7.2f} {base_mae:>7.2f} {cells}")
    print("\nper-market groups that HELP (added to BASE):")
    for mkt in MKTS:
        print(f"  {mkt:22} {chosen.get(mkt, [])}")
    import json
    (DATA / "nfl_prop_chosen_v3.json").write_text(json.dumps(chosen))
    print("\n[cache] wrote data/nfl_prop_chosen_v3.json")
