"""1H models v2 — market-anchored residual design (like consensus_totals).

prediction = 1H close line + predicted residual. Residual models fit on
context + cross-market features only. LOSO OOS. Bets+grades at 1H close
(median line/payout) — fully aligned. ML = logistic calibration of the 1H
spread + residual tilt.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge, LogisticRegression

from h1m_models import build_frame, SEASONS

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)

# cross-market structure (close-time) + situational context. No raw lines that
# would let the model rebuild the target level — residual only.
XMKT = ["fgimp_tot_gap", "fgimp_sp_gap", "ttsum_gap", "ttdiff_gap"]
CTX = ["h_h1_pf_avg", "a_h1_pf_avg", "h_h1_cov_rate", "a_h1_cov_rate",
       "h_h1_win_rate", "a_h1_win_rate", "h_l3_pf", "a_l3_pf",
       "h_l3_pa", "a_l3_pa", "h_std_pf", "a_std_pf", "h_streak", "a_streak",
       "home_rest", "away_rest", "div_game", "outdoor", "windy",
       "temp_n", "wind_n", "is_primetime", "is_thu", "is_sun_early",
       "fg_sp", "fg_tot"]
FEATS = XMKT + CTX


def add_xmkt(f):
    # FG-implied 1H (league ratios measured in-sample 2023-25 are stable ~0.5/0.55;
    # use fixed structural ratios, not fitted, to avoid leakage)
    f["fgimp_tot_gap"] = 0.49 * f.fg_tot - f.h1_tot_close
    f["fgimp_sp_gap"] = 0.55 * f.fg_sp - f.h1_sp_close
    f["ttsum_gap"] = f.tt_sum - f.fg_tot
    f["ttdiff_gap"] = -f.tt_diff - f.fg_sp   # tt-implied home margin vs spread
    return f


def gbr():
    return HistGradientBoostingRegressor(
        max_iter=150, max_depth=2, learning_rate=0.04, min_samples_leaf=60,
        l2_regularization=2.0, random_state=7)


def loso_pred(f, target):
    gb = pd.Series(np.nan, index=f.index)
    rg = pd.Series(np.nan, index=f.index)
    Xr = f[FEATS].fillna(f[FEATS].median())
    for s in SEASONS:
        tr, te = f.season != s, f.season == s
        m = gbr()
        m.fit(f.loc[tr, FEATS], f.loc[tr, target])
        gb.loc[f.index[te]] = m.predict(f.loc[te, FEATS])
        r = Ridge(alpha=50.0)
        r.fit(Xr[tr], f.loc[tr, target])
        rg.loc[f.index[te]] = r.predict(Xr[te])
    return gb, rg


def bucket_report(d, edge, win_over, win_under, push, pay_o, pay_u, label):
    print(f"\n== {label} ==  (n={len(d)})")
    e = edge.abs()
    for lo, hi in ((0.5, 1.0), (1.0, 1.5), (1.5, 2.5), (2.5, 99), (1.0, 99), (1.5, 99)):
        idx = (e >= lo) & (e < hi)
        sub = d[idx]
        if len(sub) < 15:
            continue
        win = np.where(edge[idx] > 0, win_over[idx], win_under[idx])
        pu = push[idx].values
        pay = np.where(edge[idx] > 0, sub[pay_o], sub[pay_u])
        r = np.where(pu, 0.0, np.where(win, pay, -1.0))
        wr = pd.Series(win)[~pd.Series(pu)].mean()
        per = []
        for s in SEASONS:
            si = idx & (d.season == s)
            if si.sum() < 3:
                continue
            w = np.where(edge[si] > 0, win_over[si], win_under[si])
            p = push[si].values
            py = np.where(edge[si] > 0, d.loc[si, pay_o], d.loc[si, pay_u])
            rr = np.where(p, 0.0, np.where(w, py, -1.0))
            per.append(f"{s}: {np.nanmean(rr)*100:+.0f}% (n={si.sum()})")
        print(f"  |edge| {lo}-{hi}: n={len(sub):<4} win {wr:.1%} "
              f"roi {np.nanmean(r)*100:+.1f}%   [" + " | ".join(per) + "]")


def main():
    f = build_frame()
    f = add_xmkt(f)
    f["r_tot"] = f.y_tot - f.h1_tot_close          # actual minus line
    f["r_cov"] = f.y_m + f.h1_sp_close             # home cover margin

    # ---------- totals residual
    gb_t, rg_t = loso_pred(f, "r_tot")
    print("RESIDUAL MODEL — 1H TOTAL  (pred = close line + residual)")
    print(f"  resid std {f.r_tot.std():.2f} | gb resid-pred std {gb_t.std():.2f} "
          f"corr w/ actual resid {gb_t.corr(f.r_tot):.3f} | ridge corr {rg_t.corr(f.r_tot):.3f}")
    win_o, win_u = f.y_tot > f.h1_tot_close, f.y_tot < f.h1_tot_close
    push = f.y_tot == f.h1_tot_close
    bucket_report(f, gb_t, win_o, win_u, push,
                  "h1_total_close_pay_h1_total_over_price",
                  "h1_total_close_pay_h1_total_under_price", "1H TOTAL gb-resid")
    bucket_report(f, rg_t, win_o, win_u, push,
                  "h1_total_close_pay_h1_total_over_price",
                  "h1_total_close_pay_h1_total_under_price", "1H TOTAL ridge-resid")

    # ---------- spread residual
    gb_m, rg_m = loso_pred(f, "r_cov")
    print("\nRESIDUAL MODEL — 1H SPREAD (edge>0 = home side)")
    print(f"  resid std {f.r_cov.std():.2f} | gb corr {gb_m.corr(f.r_cov):.3f} "
          f"| ridge corr {rg_m.corr(f.r_cov):.3f}")
    win_h, win_a = f.r_cov > 0, f.r_cov < 0
    push_s = f.r_cov == 0
    bucket_report(f, gb_m, win_h, win_a, push_s,
                  "h1_spread_close_pay_h1_spread_home_price",
                  "h1_spread_close_pay_h1_spread_away_price", "1H SPREAD gb-resid")
    bucket_report(f, rg_m, win_h, win_a, push_s,
                  "h1_spread_close_pay_h1_spread_home_price",
                  "h1_spread_close_pay_h1_spread_away_price", "1H SPREAD ridge-resid")

    # ---------- ML: calibrated line prob + residual tilt
    print("\n1H ML — logistic calibration of h1 close spread (LOSO) + gb tilt")
    from sklearn.metrics import brier_score_loss
    pb = pd.Series(np.nan, index=f.index)
    pt = pd.Series(np.nan, index=f.index)
    for s in SEASONS:
        tr, te = f.season != s, f.season == s
        base = LogisticRegression()
        base.fit(f.loc[tr, ["h1_sp_close"]], f.loc[tr, "y_w"])
        pb.loc[f.index[te]] = base.predict_proba(f.loc[te, ["h1_sp_close"]])[:, 1]
        X2 = pd.DataFrame({"sp": f.h1_sp_close, "tilt": gb_m})
        tilt = LogisticRegression()
        tilt.fit(X2[tr], f.loc[tr, "y_w"])
        pt.loc[f.index[te]] = tilt.predict_proba(X2[te])[:, 1]
    ph, pa = f.h1_ml_close_pay_h1_ml_home, f.h1_ml_close_pay_h1_ml_away
    imp = (1 / (1 + ph)) / ((1 / (1 + ph)) + (1 / (1 + pa)))
    ok = f.y_w.notna() & imp.notna()
    print(f"  brier: line-calibrated {brier_score_loss(f.y_w[ok], pb[ok]):.4f} | "
          f"+tilt {brier_score_loss(f.y_w[ok], pt[ok]):.4f} | "
          f"market {brier_score_loss(f.y_w[ok], imp[ok]):.4f}")
    d = pd.DataFrame(dict(season=f.season, p=pt, ph=ph, pa=pa, ym=f.y_m)).dropna()
    d["ev_h"] = d.p * d.ph - (1 - d.p)
    d["ev_a"] = (1 - d.p) * d.pa - d.p
    d["ev"] = d[["ev_h", "ev_a"]].max(axis=1)
    d["side_h"] = d.ev_h >= d.ev_a
    for thr in (0.02, 0.05, 0.08):
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
        print(f"  EV>={thr:.2f}: n={len(sub):<4} win {pd.Series(win)[~pd.Series(push.values)].mean():.1%} "
              f"roi {np.nanmean(r)*100:+.1f}%   [" + " | ".join(per) + "]")

    # save v2 OOS predictions for confluence work
    out = pd.read_parquet(ROOT / "data" / "h1m_preds.parquet")
    out["resid_tot"] = gb_t.values
    out["resid_cov"] = gb_m.values
    out["prob_home_1h"] = pt.values
    out["pred_tot_anch"] = (f.h1_tot_close + gb_t).values
    out["pred_m_anch"] = (-f.h1_sp_close + gb_m).values
    out.to_parquet(ROOT / "data" / "h1m_preds.parquet", index=False)
    print("\nsaved anchored preds -> data/h1m_preds.parquet")


if __name__ == "__main__":
    main()
