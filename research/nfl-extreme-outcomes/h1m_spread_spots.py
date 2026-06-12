"""Port the vaulted FG spread/structure spots to the 1H spread market.

FG spots being replicated (LOCKED_MODELS.md §3):
  S1 tight_soft_ml_fade_home  -> 1H-native: tight 1H spread + home 1H ML softer
                                 than the 1H spread implies -> bet AWAY at OPEN
  S2 same trigger on FG market (the vaulted signal itself) -> bet AWAY 1H spread
  S3 dk_heavy_home_juice      -> DK juices 1H home spread <= -120 -> bet HOME
                                 (also consensus-close version)
  S4 dk_giant_fav_over        -> DK giant fav + soft ML -> 1H total OVER
                                 (FG trigger and 1H-native trigger)
  S5 spread_dog_cover_fade    -> 1H cov-rate version of the dog-cover trap fade

Grading framework: bet line == grade line (open signals graded vs open, DK
signals graded vs DK's own line/price). Spread->prob calibration fit LOSO so
no season grades on a curve fit to itself.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.linear_model import LogisticRegression

from h1tt_frame import CITY_NAMES, payout
from h1m_walkforward import wilson

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)
SEASONS = (2023, 2024, 2025)


def novig(pay_h, pa):
    ih, ia = 1 / (1 + pay_h), 1 / (1 + pa)
    return ih / (ih + ia)


def loso_prob(f, sp_col, y_col, tie_col=None):
    """LOSO logistic: spread -> P(home wins). No season sees its own curve.

    tie_col: 1H MLs push on a tied half, so the de-vigged ML is P(win | no tie).
    Fit the curve on non-tie games only to match that conditioning.
    """
    out = pd.Series(np.nan, index=f.index)
    ok = f[sp_col].notna() & f[y_col].notna()
    fit_ok = ok if tie_col is None else ok & (f[tie_col] != 0)
    for s in SEASONS:
        tr = f[fit_ok & (f.season != s)]
        te = f[ok & (f.season == s)]
        m = LogisticRegression()
        m.fit(tr[[sp_col]], tr[y_col])
        out.loc[te.index] = m.predict_proba(te[[sp_col]])[:, 1]
    return out


def report(d, win, push, pay, lab):
    win, push, pay = (np.asarray(x, dtype=float) for x in (win, push, pay))
    if len(d) == 0:
        print(f"  {lab:<46} n=0")
        return
    push_b = push.astype(bool)
    r = np.where(push_b, 0.0, np.where(win.astype(bool), pay, -1.0))
    w = int(win[~push_b].sum())
    n = int((~push_b).sum())
    lo, hi = wilson(w, max(n, 1))
    per = []
    for s in SEASONS:
        i = (d.season == s).values
        if i.sum() == 0:
            continue
        nzs = i & ~push_b
        ws = int(win[nzs].sum())
        per.append(f"{s}: {ws}/{nzs.sum()} {np.nanmean(r[i])*100:+.0f}%")
    print(f"  {lab:<46} n={len(d):<4} win {w}/{n} = {w/max(n,1):.1%} "
          f"roi {np.nanmean(r)*100:+.1f}%  CI[{lo:.0%}-{hi:.0%}]  [" + " | ".join(per) + "]")


def dk_snap(d, cols, anchor):
    """Per-game DK open/close rows for a market (first/last pre-KO snapshot)."""
    dk = d[(d.book == "draftkings") & d[anchor].notna()].sort_values("snap_dt")
    g = dk.groupby(["season", "gameday", "home_ab", "away_ab"], as_index=False)
    op = g.first()[["season", "gameday", "home_ab", "away_ab"] + cols]
    cl = g.last()[["season", "gameday", "home_ab", "away_ab"] + cols]
    return op, cl


def main():
    f = pd.read_parquet(ROOT / "data" / "h1tt_frame.parquet").copy()
    f["y_m"] = f.h1_home - f.h1_away                       # 1H margin
    f["y_w"] = (f.y_m > 0).astype(int)
    f["fg_w"] = (f.final_home > f.final_away).astype(int)
    f["h1_sp_open"] = f.h1_spread_open_h1_spread_home
    f["h1_sp_close"] = f.h1_spread_close_h1_spread_home
    f["h1_tot_close"] = f.h1_total_close_h1_total_point
    f["y_tot"] = f.h1_home + f.h1_away

    # LOSO spread->prob curves (1H curve conditioned on no-tie to match ML pushes)
    f["imp_h1sp"] = loso_prob(f, "h1_sp_open", "y_w", tie_col="y_m")
    f["imp_fgsp"] = loso_prob(f, "spread_open_spread_home", "fg_w")
    f["ml_h1_open"] = novig(f.h1_ml_open_pay_h1_ml_home, f.h1_ml_open_pay_h1_ml_away)
    f["ml_fg_open"] = novig(f.ml_open_pay_ml_home, f.ml_open_pay_ml_away)

    home_cov_open = f.y_m + f.h1_sp_open
    home_cov_close = f.y_m + f.h1_sp_close

    print(f"1H SPREAD SPOTS — FG vault ports, {len(f)} games 2023-25\n")

    # ---------- S1: 1H-native tight + soft home ML -> AWAY at 1H open
    print("S1 tight_soft_ml_fade_home, 1H-NATIVE (bet AWAY at 1H open, grade vs open)")
    soft1 = f.imp_h1sp - f.ml_h1_open          # spread says home better than ML does
    for tight, pp in ((2.0, 0.04), (2.0, 0.03), (1.5, 0.04), (3.0, 0.04)):
        i = (f.h1_sp_open.abs() <= tight) & (soft1 >= pp) & home_cov_open.notna()
        d = f[i]
        report(d, home_cov_open[i] < 0, home_cov_open[i] == 0,
               d.h1_spread_open_pay_h1_spread_away_price,
               f"|1H sp|<={tight} soft>={pp:.0%}")

    print("\nS1b same trigger -> bet HOME (sanity mirror, should be the loser)")
    i = (f.h1_sp_open.abs() <= 2.0) & (soft1 >= 0.04) & home_cov_open.notna()
    d = f[i]
    report(d, home_cov_open[i] > 0, home_cov_open[i] == 0,
           d.h1_spread_open_pay_h1_spread_home_price, "mirror HOME side")

    # ---------- S2: the vaulted FG trigger -> bet the 1H spread away
    print("\nS2 FG tight_soft_ml trigger (vaulted spot) -> bet AWAY on 1H spread at 1H open")
    soft2 = f.imp_fgsp - f.ml_fg_open
    for tight, pp in ((3.0, 0.04), (3.0, 0.03)):
        i = (f.spread_open_spread_home.abs() <= tight) & (soft2 >= pp) & home_cov_open.notna()
        d = f[i]
        report(d, home_cov_open[i] < 0, home_cov_open[i] == 0,
               d.h1_spread_open_pay_h1_spread_away_price,
               f"|FG sp|<={tight} soft>={pp:.0%} -> 1H away")

    # ---------- S3: heavy home juice -> bet HOME 1H spread
    print("\nS3 heavy_home_juice -> HOME 1H spread")
    pay_h_cl = f.h1_spread_close_pay_h1_spread_home_price
    for thr, lab in ((100/120, "consensus close juice <= -120"),
                     (100/115, "consensus close juice <= -115")):
        i = (pay_h_cl <= thr + 1e-9) & home_cov_close.notna()
        d = f[i]
        report(d, home_cov_close[i] > 0, home_cov_close[i] == 0,
               pay_h_cl[i], lab)

    oh = pd.read_parquet(ROOT / "data" / "odds_hist.parquet")
    oh["snap_dt"] = pd.to_datetime(oh.snap_ts, utc=True, format="ISO8601")
    comm = pd.to_datetime(oh.commence_time, utc=True, format="ISO8601")
    oh["gameday"] = comm.dt.tz_convert("America/New_York").dt.strftime("%Y-%m-%d")
    oh["home_ab"] = oh.home_team.map(CITY_NAMES)
    oh["away_ab"] = oh.away_team.map(CITY_NAMES)
    oh = oh[oh.snap_dt < comm]

    gk = ["season", "gameday", "home_ab", "away_ab"]
    res = f[gk + ["y_m", "y_tot", "h1_tot_close",
                  "h1_total_close_pay_h1_total_over_price"]]

    _, dk_cl = dk_snap(oh, ["h1_spread_home", "h1_spread_home_price"], "h1_spread_home")
    d3 = dk_cl.merge(res, on=gk, how="inner")
    d3["pay_h"] = payout(d3.h1_spread_home_price)
    d3["hcov"] = d3.y_m + d3.h1_spread_home
    for thr in (-120, -115):
        i = (d3.h1_spread_home_price <= thr) & d3.hcov.notna()
        d = d3[i]
        report(d, d.hcov > 0, d.hcov == 0, d.pay_h,
               f"DK close h1 home price <= {thr} (DK line/price)")

    # ---------- S4: giant fav + soft ML -> 1H total OVER
    print("\nS4 dk_giant_fav_over -> 1H TOTAL OVER (at 1H consensus close)")
    _, dkfg = dk_snap(oh, ["spread_home", "spread_home_price", "ml_home", "ml_away"],
                      "spread_home")
    d4 = dkfg.merge(res, on=gk, how="inner")
    d4 = d4.merge(f[gk + ["imp_fgsp"]], on=gk, how="left")
    d4["ml_nv"] = novig(payout(d4.ml_home), payout(d4.ml_away))
    # soft ML on the favorite: |gap between DK spread-implied and DK ML-implied|
    fav_soft = np.where(d4.spread_home < 0, d4.imp_fgsp - d4.ml_nv,
                        d4.ml_nv - d4.imp_fgsp)
    win_o = d4.y_tot > d4.h1_tot_close
    push_o = d4.y_tot == d4.h1_tot_close
    pay_o = d4.h1_total_close_pay_h1_total_over_price
    for pp in (0.05, 0.03):
        i = (d4.spread_home.abs() >= 7) & (fav_soft >= pp) & d4.h1_tot_close.notna()
        report(d4[i], win_o[i], push_o[i], pay_o[i],
               f"DK FG |sp|>=7 fav ML soft>={pp:.0%} -> 1H over")
    # 1H-native: big 1H fav + soft 1H ML
    i = (f.h1_sp_close.abs() >= 3.5) & ((f.imp_h1sp - f.ml_h1_open).abs() >= 0.05) \
        & f.h1_tot_close.notna()
    d = f[i]
    report(d, d.y_tot > d.h1_tot_close, d.y_tot == d.h1_tot_close,
           d.h1_total_close_pay_h1_total_over_price,
           "1H-native |1H sp|>=3.5 soft>=5% -> 1H over")

    # ---------- S5: dog-cover trap fade, 1H cov-rate version
    print("\nS5 dog_cover_fade (1H cov-rate >=.7 dog vs <=.3 fav, min 4 graded) at close")
    c = pd.read_parquet(ROOT / "data" / "h1tt_context.parquet")
    c = c.merge(f[gk + ["y_m", "h1_sp_close",
                        "h1_spread_close_pay_h1_spread_home_price",
                        "h1_spread_close_pay_h1_spread_away_price"]],
                on=gk, how="left", suffixes=("", "_f"))
    c["fg_sp"] = c.spread_close_spread_home
    cov = c.y_m + c.h1_sp_close
    # home dog covering, away fav not -> bet AWAY (fade the dog)
    i = (c.fg_sp > 0) & (c.h_h1_cov_rate >= 0.7) & (c.a_h1_cov_rate <= 0.3) & cov.notna()
    report(c[i], cov[i] < 0, cov[i] == 0,
           c[i].h1_spread_close_pay_h1_spread_away_price, "home dog hot / away fav cold -> AWAY")
    # away dog covering, home fav not -> bet HOME
    i = (c.fg_sp < 0) & (c.a_h1_cov_rate >= 0.7) & (c.h_h1_cov_rate <= 0.3) & cov.notna()
    report(c[i], cov[i] > 0, cov[i] == 0,
           c[i].h1_spread_close_pay_h1_spread_home_price, "away dog hot / home fav cold -> HOME")


if __name__ == "__main__":
    main()
