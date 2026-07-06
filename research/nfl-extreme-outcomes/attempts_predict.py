"""Production volume-model prediction for the attempts markets.

Exposes predict_slate(season, week) -> DataFrame[player_id, market, pred, l5, szn].
Trains a HistGBR on ALL completed player-games strictly before (season, week) — point-in-time,
no leakage — and predicts that week's contributors. This is the weekly-retrain form of the
walk-forward model validated in attempts_model.py (retrain is cheap, ~1s, and preserves the
validated ROI because it only ever trains on completed games).

Signal markets: player_pass_attempts, player_rush_attempts (completions predicted too, for the
card's context, but it fires no flag — no validated edge).

Data sources (dry-run reads the parquets; production reads the mirrored DB tables — identical
construction): player form = player_offense / nfl_player_game_logs; team+opp features =
team_week / nfl_pregame_advanced_team_week; game script = games_enriched / the slate.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from attempts_model import panel, FEATS, MKT

SIGNAL_MARKETS = ("player_pass_attempts", "player_rush_attempts")   # completions: predict, no flag


def _fit_predict(p, target_t):
    tr = p[p.t < target_t].dropna(subset=["actual", "team_spread"])
    te = p[p.t == target_t]
    if len(tr) < 500 or len(te) == 0:
        return te.assign(pred=np.nan)
    mdl = HistGradientBoostingRegressor(max_depth=4, learning_rate=0.05, max_iter=400,
                                        min_samples_leaf=40, l2_regularization=1.0)
    mdl.fit(tr[FEATS], tr.actual)
    return te.assign(pred=mdl.predict(te[FEATS]))


def predict_slate(season, week, p=None):
    """Model prediction per (player_id, market) for one upcoming slate. Trains only on games
    strictly before it. Returns pred + entering form so the caller can build the signal."""
    if p is None:
        p = panel()
    p = p.copy()
    p["t"] = p.season * 100 + p.week
    target_t = season * 100 + week
    out = []
    for mkt in MKT:                                  # includes completions (predicted, not flagged)
        m = p[p.market == mkt]
        pr = _fit_predict(m, target_t)
        pr = pr[pr.pred.notna()]
        out.append(pr[["season", "week", "player_id", "player_name", "position", "team",
                       "market", "pred", "l5", "szn"]])
    return pd.concat(out, ignore_index=True) if out else pd.DataFrame()


if __name__ == "__main__":
    import sys
    s = int(sys.argv[1]) if len(sys.argv) > 1 else 2025
    w = int(sys.argv[2]) if len(sys.argv) > 2 else 12
    pr = predict_slate(s, w)
    print(f"predict_slate({s},{w}): {len(pr)} rows across {pr.market.nunique()} markets")
    print(pr.groupby("market").size().to_string())
    print("\nsample pass/rush attempts predictions:")
    show = pr[pr.market.isin(SIGNAL_MARKETS)].sort_values("pred", ascending=False)
    print(show[["player_name", "position", "team", "market", "pred", "l5", "szn"]].head(12).to_string(index=False))
