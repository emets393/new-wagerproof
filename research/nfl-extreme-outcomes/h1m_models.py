"""1st-half models: total, spread (margin), moneyline (home 1H win prob).

Product framing (see wagerproof-nfl-model-purpose memory): per-game prediction
for EVERY game; betting layer = edge buckets + signal confluence on top.

Honesty framework: all features are close-time market lines + pre-game stats
-> bets placed AND graded at 1H consensus CLOSE (median line, median payout).
Validation: leave-one-season-out (fit two seasons, predict the third) so every
prediction is out-of-sample. CLV check: model edge vs 1H OPEN compared to the
open->close move direction.

Outputs: data/h1m_preds.parquet (per-game OOS predictions, all 3 targets).
"""
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingRegressor, HistGradientBoostingClassifier
from sklearn.linear_model import Ridge, LogisticRegression

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)
# Auto-detect the seasons present in the 1H context, so a new season is predicted once its
# data lands (no hardcoded year list to bump each offseason; mirrors the CFB model). The model
# fits leave-one-season-out, so the live target (e.g. 2026) is predicted on the other seasons.
try:
    SEASONS = tuple(sorted(int(s) for s in
                    pd.read_parquet(ROOT / "data" / "h1tt_context.parquet")["season"].unique()))
except Exception:
    SEASONS = (2023, 2024, 2025)

MARKET = ["fg_sp", "fg_tot", "tt_h", "tt_a", "tt_sum", "tt_diff",
          "h1_sp_open", "h1_tot_open"]
CONTEXT = ["h_l3_pf", "h_l3_pa", "a_l3_pf", "a_l3_pa", "h_std_pf", "a_std_pf",
           "h_h1_pf_avg", "a_h1_pf_avg", "h_h1_cov_rate", "a_h1_cov_rate",
           "h_h1_win_rate", "a_h1_win_rate", "h_streak", "a_streak",
           "home_rest", "away_rest", "div_game", "outdoor", "windy",
           "temp_n", "wind_n", "is_primetime", "is_thu", "is_sun_early"]
FEATS = MARKET + CONTEXT


def build_frame():
    f = pd.read_parquet(ROOT / "data" / "h1tt_context.parquet").copy()
    f["fg_sp"] = f.spread_close_spread_home
    f["fg_tot"] = f.total_close_total_point
    f["tt_h"] = f.tt_home_close_tt_home_point
    f["tt_a"] = f.tt_away_close_tt_away_point
    f["tt_sum"] = f.tt_h + f.tt_a
    f["tt_diff"] = f.tt_h - f.tt_a
    f["h1_sp_open"] = f.h1_spread_open_h1_spread_home
    f["h1_tot_open"] = f.h1_total_open_h1_total_point
    f["temp_n"] = pd.to_numeric(f.temp, errors="coerce")
    f["wind_n"] = pd.to_numeric(f.wind, errors="coerce")
    f["is_primetime"] = f.slot.isin(["snf", "monday"]).astype(int)
    f["is_thu"] = (f.slot == "thu_fri").astype(int)
    f["is_sun_early"] = (f.slot == "sun_early").astype(int)
    for c in ("div_game", "outdoor", "windy"):
        f[c] = f[c].astype(float)
    # targets
    f["y_tot"] = f.h1_home + f.h1_away
    f["y_m"] = f.h1_home - f.h1_away
    f["y_w"] = (f.y_m > 0).astype(int)
    # market lines to beat
    f["h1_sp_close"] = f.h1_spread_close_h1_spread_home
    f["h1_tot_close"] = f.h1_total_close_h1_total_point
    return f


def loso(f, model_fn, target, clf=False):
    """Leave-one-season-out OOS predictions."""
    out = pd.Series(np.nan, index=f.index)
    for s in SEASONS:
        tr, te = f[f.season != s], f[f.season == s]
        m = model_fn()
        m.fit(tr[FEATS], tr[target])
        out.loc[te.index] = (m.predict_proba(te[FEATS])[:, 1] if clf
                             else m.predict(te[FEATS]))
    return out


def gbr():
    return HistGradientBoostingRegressor(
        max_iter=220, max_depth=3, learning_rate=0.05, min_samples_leaf=40,
        l2_regularization=1.0, random_state=7)


def gbc():
    return HistGradientBoostingClassifier(
        max_iter=220, max_depth=3, learning_rate=0.05, min_samples_leaf=40,
        l2_regularization=1.0, random_state=7)


def ridge_loso(f, target):
    out = pd.Series(np.nan, index=f.index)
    X = f[FEATS].fillna(f[FEATS].median())
    for s in SEASONS:
        tr_i, te_i = f.season != s, f.season == s
        m = Ridge(alpha=10.0)
        m.fit(X[tr_i], f.loc[tr_i, target])
        out.loc[f.index[te_i]] = m.predict(X[te_i])
    return out


def payout_med(prices):
    return prices


def report_reg(f, pred, line_col, y_col, pay_o, pay_u, label, over_under=True):
    """Edge buckets vs close line; bet at close median payout."""
    d = f[[line_col, y_col, "season", pay_o, pay_u]].copy()
    d["pred"] = pred
    d = d.dropna(subset=["pred", line_col])
    d["edge"] = d.pred - d[line_col]
    print(f"\n== {label} ==  (n={len(d)}, MAE vs actual "
          f"{np.abs(d.pred - d[y_col]).mean():.2f}, "
          f"market MAE {np.abs(d[line_col] - d[y_col]).mean():.2f}, "
          f"corr(pred,line)={d.pred.corr(d[line_col]):.3f})")
    for lo, hi in ((0.0, 0.5), (0.5, 1.0), (1.0, 1.5), (1.5, 2.5), (2.5, 99)):
        sub = d[(d.edge.abs() >= lo) & (d.edge.abs() < hi)]
        if len(sub) < 10:
            continue
        if over_under:
            win = np.where(sub.edge > 0, sub[y_col] > sub[line_col],
                           sub[y_col] < sub[line_col])
            push = sub[y_col] == sub[line_col]
            pay = np.where(sub.edge > 0, sub[pay_o], sub[pay_u])
        else:
            # spread: edge>0 means model likes home vs line (pred margin + line > 0 form)
            win = np.where(sub.edge > 0, sub[y_col] + sub[line_col] > 0,
                           sub[y_col] + sub[line_col] < 0)
            push = sub[y_col] + sub[line_col] == 0
            pay = np.where(sub.edge > 0, sub[pay_o], sub[pay_u])
        r = np.where(push, 0.0, np.where(win, pay, -1.0))
        wr = pd.Series(win)[~pd.Series(push.values).astype(bool)].mean()
        line = f"  |edge| {lo}-{hi}: n={len(sub):<4} win {wr:.1%} roi {np.nanmean(r)*100:+.1f}%"
        per = []
        for s in SEASONS:
            g = sub[sub.season == s]
            if not len(g):
                continue
            if over_under:
                w = np.where(g.edge > 0, g[y_col] > g[line_col], g[y_col] < g[line_col])
                p = g[y_col] == g[line_col]
                py = np.where(g.edge > 0, g[pay_o], g[pay_u])
            else:
                w = np.where(g.edge > 0, g[y_col] + g[line_col] > 0,
                             g[y_col] + g[line_col] < 0)
                p = g[y_col] + g[line_col] == 0
                py = np.where(g.edge > 0, g[pay_o], g[pay_u])
            rr = np.where(p, 0.0, np.where(w, py, -1.0))
            per.append(f"{s}: {np.nanmean(rr)*100:+.0f}% (n={len(g)})")
        print(line + "   [" + " | ".join(per) + "]")
    return d


def clv_check(d, f, open_col, label):
    """Does model edge vs OPEN predict the open->close move?"""
    x = d.join(f[open_col]).dropna(subset=[open_col])
    edge_open = x.pred - x[open_col]
    move = x[d.columns[0]] - x[open_col]   # close - open  (line_col is first col)
    big = edge_open.abs() >= 1.0
    agree = (np.sign(edge_open[big]) == np.sign(move[big])) & (move[big] != 0)
    print(f"  CLV {label}: corr(edge_open, move)={edge_open.corr(move):.3f}; "
          f"|edge_open|>=1 n={big.sum()}, move agrees {agree.mean():.1%} "
          f"(moved at all: {(move[big] != 0).mean():.1%})")


def main():
    f = build_frame()
    print(f"frame: {len(f)} games | feature NaN share: "
          f"{f[FEATS].isna().mean().mean():.2%}")

    # ---------------- 1H TOTAL
    pred_tot = loso(f, gbr, "y_tot")
    pred_tot_r = ridge_loso(f, "y_tot")
    d_tot = report_reg(f, pred_tot, "h1_tot_close", "y_tot",
                       "h1_total_close_pay_h1_total_over_price",
                       "h1_total_close_pay_h1_total_under_price",
                       "1H TOTAL — GBM, edge vs close, bet over/under at close")
    report_reg(f, pred_tot_r, "h1_tot_close", "y_tot",
               "h1_total_close_pay_h1_total_over_price",
               "h1_total_close_pay_h1_total_under_price",
               "1H TOTAL — Ridge")
    clv_check(d_tot, f, "h1_tot_open", "total")

    # ---------------- 1H SPREAD (margin; line is home spread, cover if m + sp > 0)
    pred_m = loso(f, gbr, "y_m")
    pred_m_r = ridge_loso(f, "y_m")
    # edge>0 -> model margin beats the line on the home side
    f2 = f.copy()
    f2["neg_sp"] = -f2.h1_sp_close   # model edge = pred_m - (-sp) = pred_m + sp
    d_m = report_reg(f2, pred_m, "neg_sp", "y_m",
                     "h1_spread_close_pay_h1_spread_home_price",
                     "h1_spread_close_pay_h1_spread_away_price",
                     "1H SPREAD — GBM, edge vs close (home side if edge>0)",
                     over_under=True)
    report_reg(f2, pred_m_r, "neg_sp", "y_m",
               "h1_spread_close_pay_h1_spread_home_price",
               "h1_spread_close_pay_h1_spread_away_price",
               "1H SPREAD — Ridge", over_under=True)
    f2["neg_sp_open"] = -f2.h1_sp_open
    clv_check(d_m, f2, "neg_sp_open", "spread")

    # ---------------- 1H ML (home 1H win prob)
    pred_w = loso(f, gbc, "y_w", clf=True)
    from sklearn.metrics import brier_score_loss, log_loss
    ok = pred_w.notna() & f.y_w.notna()
    print(f"\n== 1H ML — GBM home-win prob ==  brier {brier_score_loss(f.y_w[ok], pred_w[ok]):.4f}")
    # market implied from median payouts (de-vig two-way)
    ph, pa = f.h1_ml_close_pay_h1_ml_home, f.h1_ml_close_pay_h1_ml_away
    imp_h = (1 / (1 + ph)) / ((1 / (1 + ph)) + (1 / (1 + pa)))
    print(f"   market brier {brier_score_loss(f.y_w[ok & imp_h.notna()], imp_h[ok & imp_h.notna()]):.4f}")
    d = pd.DataFrame(dict(season=f.season, p=pred_w, imp=imp_h, y=f.y_w,
                          ph=ph, pa=pa, ym=f.y_m)).dropna()
    d["ev_h"] = d.p * d.ph - (1 - d.p)
    d["ev_a"] = (1 - d.p) * d.pa - d.p
    d["ev"] = d[["ev_h", "ev_a"]].max(axis=1)
    d["side_h"] = d.ev_h >= d.ev_a
    for thr in (0.0, 0.03, 0.06, 0.10):
        sub = d[d.ev >= thr]
        if len(sub) < 15:
            continue
        win = np.where(sub.side_h, sub.ym > 0, sub.ym < 0)
        push = sub.ym == 0
        pay = np.where(sub.side_h, sub.ph, sub.pa)
        r = np.where(push, 0.0, np.where(win, pay, -1.0))
        per = []
        for s in SEASONS:
            g = sub[sub.season == s]
            if len(g):
                w = np.where(g.side_h, g.ym > 0, g.ym < 0)
                p = g.ym == 0
                py = np.where(g.side_h, g.ph, g.pa)
                rr = np.where(p, 0.0, np.where(w, py, -1.0))
                per.append(f"{s}: {np.nanmean(rr)*100:+.0f}% (n={len(g)})")
        print(f"  EV >= {thr:.2f}: n={len(sub):<4} win {pd.Series(win)[~pd.Series(push.values)].mean():.1%} "
              f"roi {np.nanmean(r)*100:+.1f}%   [" + " | ".join(per) + "]")

    # straight pick accuracy (product display)
    pick_home = pred_w >= 0.5
    acc = (pick_home == (f.y_m > 0))[ok & (f.y_m != 0)].mean()
    fav_acc = ((f.fg_sp < 0) == (f.y_m > 0))[ok & (f.y_m != 0)].mean()
    print(f"  straight 1H winner acc: model {acc:.1%} vs FG-favorite baseline {fav_acc:.1%}")

    # save OOS predictions
    out = f[["game_id", "season", "week", "gameday", "home_ab", "away_ab",
             "h1_sp_close", "h1_tot_close", "y_tot", "y_m", "y_w",
             "h1_total_close_pay_h1_total_over_price",
             "h1_total_close_pay_h1_total_under_price",
             "h1_spread_close_pay_h1_spread_home_price",
             "h1_spread_close_pay_h1_spread_away_price",
             "h1_ml_close_pay_h1_ml_home", "h1_ml_close_pay_h1_ml_away",
             "fg_sp", "fg_tot", "slot"]].copy()
    out["pred_tot"], out["pred_m"], out["pred_w"] = pred_tot, pred_m, pred_w
    out.to_parquet(ROOT / "data" / "h1m_preds.parquet", index=False)
    print("\nsaved data/h1m_preds.parquet")


if __name__ == "__main__":
    main()
