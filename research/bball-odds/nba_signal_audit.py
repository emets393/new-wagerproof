#!/usr/bin/env python3
"""Does the SIGN BUG that inverted every spread bet in nba_panel_all.py also live in the signals?

WHY THIS FILE EXISTS. `nba_panel_all.py` compared a model margin expressed in POSTED convention
(home favourite lays points, so negative) against a posted line by SUBTRACTION, while the outcome
column it graded against is a margin RESIDUAL built by ADDITION. The two disagreed about which
direction is a home bet, so every full-game and first-half spread bet was placed on the wrong side
and the market read -8.3% ROI when the honest number is -0.7%. If the same confusion sits anywhere
in the signal layer, then S9/S10/S11/S12/S14/S15/S17 are all backwards and the ledger is fiction.

Reading the signal scripts is not enough to answer that. This file therefore rebuilds everything
from the RAW score and price files -- `games_nba.parquet` and `movement_games_nba.parquet`, which no
signal script writes -- with outcome definitions written out longhand here, and never imports a
grader from the code under test.

FOUR PARTS, in order of how much they would hurt if they failed:

  A  OUTCOME COLUMNS. Recompute home_cover / over / home_win / h1_home_cover / h1_over / tt_*_over /
     ats_pts from raw scores and the posted line, and diff against what the frames actually store.
     A sign flip here corrupts every signal at once.

  B  PRICE CALIBRATION -- the model-free oracle. `nba_panel_all.py` could be oracle-checked by
     feeding it the realised result, but a signal has no model to feed. The equivalent invariant is
     that a market's outcome must be calibrated to the price it is PAIRED WITH: bucket by the
     implied probability of the decimal price and the realised win rate has to rise with it. If y is
     inverted, or the home outcome got glued to the away price, the slope goes negative. This
     catches a mis-pairing that Part A cannot, because Part A never looks at prices.

  C  THE SIGNALS THEMSELVES, reimplemented. Every trigger is rewritten from the raw frame and graded
     with the ~10-line grader at the bottom of this docstring's file rather than `nba_hunt_deepdive.grade`,
     then compared against the number published in NBA_PROVEN.md §2. Reimplementation is the point:
     an independent path that lands on the same number cannot be sharing a bug with the original.

  D  DIRECTION SANITY. Three facts about basketball that no amount of clever code can argue with --
     favourites cover about half the time, home teams win about 55%, and moneyline favourites win far
     more often than they cover. Any inversion breaks at least one of them loudly.

    python3 nba_signal_audit.py
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")
FAIL = []


def check(ok, msg):
    print(f"  [{'PASS' if ok else 'FAIL'}] {msg}", flush=True)
    if not ok:
        FAIL.append(msg)


def dec(price):
    """Price -> decimal, detecting the format per value.

    The two price sources in this repo disagree and it is not documented anywhere but in a comment:
    the movement columns (open/t24/t4/t60) are ALREADY DECIMAL -- a -110 spread reads 1.909 -- while
    the h1tt/tt columns store raw American. Blindly running an American converter over a decimal
    price turns 1.909 into 1.019 and every market prints an impossible -46% blind ROI, which is
    exactly what the first run of this file did. American odds are never strictly inside
    (-100, +100), so the band is a safe discriminator.
    """
    a = pd.to_numeric(price, errors="coerce").to_numpy(float)
    return np.where((a >= 1.01) & (a <= 40.0), a,
                    np.where(a >= 100.0, 1.0 + a / 100.0,
                             np.where(a <= -100.0, 1.0 + 100.0 / np.abs(a), np.nan)))


def diff(name, mine, theirs):
    """Compare two 1/0/nan outcome vectors and report where they disagree."""
    mine, theirs = np.asarray(mine, float), np.asarray(theirs, float)
    both = np.isfinite(mine) & np.isfinite(theirs)
    bad = int((mine[both] != theirs[both]).sum())
    n = int(both.sum())
    check(bad == 0, f"{name}: {n:,} comparable rows, {bad} disagreements"
                    + ("" if bad == 0 else f"  <-- {100*bad/max(n,1):.1f}% wrong"))
    return bad


# ------------------------------------------------------------------ my own grader ---

def grade(win, price, universe_win, universe_price, label, n_floor=0):
    """One bet per row. `win` is 1/0, `price` the decimal odds of the side actually taken.

    Baseline is the same market over the whole universe, per the standing rule that a win rate is
    only meaningful next to ITS OWN slice's base rate -- never next to 50%.
    """
    ok = np.isfinite(win) & np.isfinite(price) & (price > 1.01) & (price < 26.0)
    bok = np.isfinite(universe_win) & np.isfinite(universe_price) & \
        (universe_price > 1.01) & (universe_price < 26.0)
    n = int(ok.sum())
    if n < n_floor:
        return None
    prof = np.where(win[ok] > 0, price[ok] - 1.0, -1.0)
    bprof = np.where(universe_win[bok] > 0, universe_price[bok] - 1.0, -1.0)
    return {"label": label, "n": n, "win": 100 * win[ok].mean(),
            "base": 100 * universe_win[bok].mean(), "roi": 100 * prof.mean(),
            "base_roi": 100 * bprof.mean(),
            "z": (prof.mean() - bprof.mean()) / (bprof.std() / np.sqrt(n))}


def side(mask, y_home, price_home, price_away, take_home):
    """Resolve a per-row bet side into (win, price). `take_home` may be a bool array."""
    w = np.where(take_home, y_home, 1.0 - y_home)
    p = np.where(take_home, price_home, price_away)
    return np.where(mask, w, np.nan), np.where(mask, p, np.nan)


def show(rows, title):
    rows = [r for r in rows if r]
    print(f"\n-- {title}")
    if not rows:
        print("   (nothing met the floor)")
        return
    print(pd.DataFrame(rows).to_string(index=False, float_format=lambda v: f"{v:8.2f}"))


def near(got, want, tol, what):
    check(abs(got - want) <= tol, f"{what}: reimplementation {got:+.2f} vs published {want:+.2f} "
                                  f"(tolerance {tol})")


# ============================================================================ MAIN ===

def main():
    # ---------------------------------------------------------------- raw truth ---
    G = pd.read_parquet(f"{PQ}/games_nba.parquet")
    L = pd.read_parquet(f"{PQ}/movement_games_nba.parquet")
    RAW = G.merge(L.drop(columns=[c for c in L.columns
                                  if c in G.columns and c != "event_id"]), on="event_id")
    RAW = RAW.set_index("event_id")
    print(f"raw truth: {len(RAW):,} games from games_nba.parquet x movement_games_nba.parquet")

    d = (pd.read_parquet(f"{PQ}/nba_hunt_frame.parquet")
           .sort_values("game_date").reset_index(drop=True))
    R = RAW.reindex(d["event_id"].to_numpy())
    print(f"hunt frame: {len(d):,} rows, {R['home_score'].notna().sum():,} matched to raw scores")

    hs, as_ = R["home_score"].to_numpy(float), R["away_score"].to_numpy(float)
    h1h, h1a = R["home_h1"].to_numpy(float), R["away_h1"].to_numpy(float)
    sp = R["t60_spread_home_point"].to_numpy(float)
    tp = R["t60_total_point"].to_numpy(float)

    # ============================================================ A. outcome columns
    print("\n" + "=" * 92)
    print("A  OUTCOME COLUMNS -- rebuilt from raw scores and the posted line, longhand")
    print("=" * 92)
    print("""  The definitions, stated so they can be argued with rather than trusted:
    margin      = home_score - away_score                    (positive = home won by that much)
    home_cover  = (margin + t60_spread_home_point) > 0       ADDITION, because a home favourite's
                  spread is NEGATIVE and it has to win by more than the number it lays
    over        = (home_score + away_score) > t60_total_point
    home_win    = margin > 0""")

    def tri(x):
        """1 / 0 / nan, with a push graded as neither -- not as a loss."""
        return np.where(x > 0, 1.0, np.where(x < 0, 0.0, np.nan))

    my_margin = hs - as_
    my_cover = tri(my_margin + sp)
    my_over = tri((hs + as_) - tp)
    my_hw = tri(my_margin)

    check(np.nanmax(np.abs(my_margin - d["margin"].to_numpy(float))) == 0,
          "margin == home_score - away_score in the hunt frame")
    diff("home_cover", my_cover, d["home_cover"])
    diff("over", my_over, d["over"])
    diff("home_win", my_hw, d["home_win"])

    h1sp = d["c_h1_spread_home_point"].to_numpy(float)
    h1tp = d["c_h1_total_point"].to_numpy(float)
    diff("h1_home_cover", tri((h1h - h1a) + h1sp), d["h1_home_cover"])
    diff("h1_over", tri((h1h + h1a) - h1tp), d["h1_over"])
    diff("tt_home_over", tri(hs - d["c_tt_home_point"].to_numpy(float)), d["tt_home_over"])
    diff("tt_away_over", tri(as_ - d["c_tt_away_point"].to_numpy(float)), d["tt_away_over"])

    # the same thing at the opening line, because three signals are also quoted at the open
    osp = R["open_spread_home_point"].to_numpy(float)
    my_cover_open = tri(my_margin + osp)
    check(np.isfinite(my_cover_open).sum() > 4000,
          f"opening-line cover computable on {int(np.isfinite(my_cover_open).sum()):,} games")

    # ============================================================ B. price calibration
    print("\n" + "=" * 92)
    print("B  PRICE CALIBRATION -- the model-free oracle")
    print("=" * 92)
    print("""  A signal has no model to feed a realised result into, so the panel's oracle check does not
  transfer. This is the equivalent invariant: whatever y is paired with a price, the realised win
  rate must RISE with that price's implied probability. Inverting y, or gluing the home outcome to
  the away price, turns the slope negative. Slope is measured over the whole universe, no signal.""")

    def calib(y, price, label, bins=5):
        """Spread of the implied probability is reported alongside, because it IS the test's power.

        Spread and total prices in this sample are almost all -110 (sd 0.006 in decimal), so their
        correlation is noise around zero no matter which side y sits on and the check has nothing to
        say. Only the moneyline prices a real range, and it is where an inversion would be loudest.
        """
        y, price = np.asarray(y, float), np.asarray(price, float)
        ok = np.isfinite(y) & np.isfinite(price) & (price > 1.01) & (price < 26.0)
        imp = 1.0 / price[ok]
        q = pd.qcut(imp, bins, labels=False, duplicates="drop")
        obs = pd.Series(y[ok]).groupby(q).mean().to_numpy()
        exp = pd.Series(imp).groupby(q).mean().to_numpy()
        return {"market": label, "n": int(ok.sum()),
                "implied p1-p99 span": 100 * (np.quantile(imp, .99) - np.quantile(imp, .01)),
                "corr(implied,win)": np.corrcoef(imp, y[ok])[0, 1],
                "low bucket obs": 100 * obs[0], "low exp": 100 * exp[0],
                "high bucket obs": 100 * obs[-1], "high exp": 100 * exp[-1]}

    sp_h, sp_a = dec(d["t60_spread_home_price"]), dec(d["t60_spread_away_price"])
    ml_h, ml_a = dec(d["t60_ml_home_price"]), dec(d["t60_ml_away_price"])
    ov_p, un_p = dec(d["t60_total_over_price"]), dec(d["t60_total_under_price"])
    h1_h, h1_a = dec(d["c_h1_spread_home_price"]), dec(d["c_h1_spread_away_price"])
    hc, ov, hw = d["home_cover"].to_numpy(float), d["over"].to_numpy(float), d["home_win"].to_numpy(float)
    h1c = d["h1_home_cover"].to_numpy(float)
    home_fav = (sp < 0)

    rows = [calib(hc, sp_h, "fg_spread_home"), calib(1 - hc, sp_a, "fg_spread_away"),
            calib(np.where(home_fav, hc, 1 - hc), np.where(home_fav, sp_h, sp_a), "fg_spread_fav"),
            calib(hw, ml_h, "fg_ml_home"), calib(1 - hw, ml_a, "fg_ml_away"),
            calib(ov, ov_p, "fg_total_over"), calib(1 - ov, un_p, "fg_total_under"),
            calib(h1c, h1_h, "h1_spread_home"), calib(1 - h1c, h1_a, "h1_spread_away")]
    show(rows, "implied probability vs realised win rate, by price bucket")
    for r in rows:
        if r["implied p1-p99 span"] < 3.0:
            print(f"  [n/a ] {r['market']}: prices span only {r['implied p1-p99 span']:.1f} points "
                  f"of implied probability -- flat-priced, this test has no power here")
            continue
        check(r["corr(implied,win)"] > 0,
              f"{r['market']}: win rate rises with the price it is paired with "
              f"(corr {r['corr(implied,win)']:+.3f})")
    # the moneyline is the loud one -- its prices span 1.03 to 20, so a flip is unmissable
    mlr = [r for r in rows if r["market"] == "fg_ml_home"][0]
    check(mlr["high bucket obs"] - mlr["low bucket obs"] > 40,
          f"fg_ml_home spans {mlr['low bucket obs']:.0f}% to {mlr['high bucket obs']:.0f}% "
          f"across price buckets (a flip would reverse this)")

    # ============================================================ D. direction sanity
    print("\n" + "=" * 92)
    print("D  DIRECTION SANITY -- three facts about basketball that an inversion cannot survive")
    print("=" * 92)
    favc = np.where(home_fav, hc, 1 - hc)
    m = np.isfinite(favc)
    print(f"  favourites cover           {100*np.nanmean(favc):.1f}%  on {int(m.sum()):,}")
    check(46 <= 100 * np.nanmean(favc) <= 54, "favourites cover ~46-54% (the market is roughly fair)")
    print(f"  home teams win outright    {100*np.nanmean(hw):.1f}%")
    check(52 <= 100 * np.nanmean(hw) <= 60, "home teams win 52-60% outright")
    mlfav = np.where(home_fav, hw, 1 - hw)
    print(f"  moneyline favourites win   {100*np.nanmean(mlfav):.1f}%")
    check(np.nanmean(mlfav) > np.nanmean(favc) + 0.10,
          "moneyline favourites win far more often than they cover (spread handicaps them)")
    print(f"  overs hit                  {100*np.nanmean(ov):.1f}%")
    check(46 <= 100 * np.nanmean(ov) <= 54, "overs hit ~46-54%")

    # ============================================================ C. the signals
    print("\n" + "=" * 92)
    print("C  THE SHIPPED SIGNALS, REIMPLEMENTED FROM THE RAW FRAME")
    print("=" * 92)
    print("""  Each trigger is rewritten here and graded with this file's own grader. Published numbers
  are from NBA_PROVEN.md §2. A reimplementation landing on the same win% and ROI cannot be
  sharing a bug with the original, because it does not share any code with it.""")

    reg = (d["postseason"] == 0).to_numpy()
    gp50 = reg & (d["min_gp"] >= 50).to_numpy()
    U_all = np.isfinite(hc)

    # universe-level (win, price) for each named side, used as every baseline
    fav_w, fav_p = np.where(home_fav, hc, 1 - hc), np.where(home_fav, sp_h, sp_a)
    ovr_w, ovr_p = ov, ov_p

    def bet_fav(mask, uni, label):
        w, p = np.where(mask, fav_w, np.nan), np.where(mask, fav_p, np.nan)
        bw, bp = np.where(uni, fav_w, np.nan), np.where(uni, fav_p, np.nan)
        return grade(w, p, bw, bp, label)

    def bet_over(mask, uni, label):
        w, p = np.where(mask, ovr_w, np.nan), np.where(mask, ovr_p, np.nan)
        bw, bp = np.where(uni, ovr_w, np.nan), np.where(uni, ovr_p, np.nan)
        return grade(w, p, bw, bp, label)

    def bet_home(mask, uni, label):
        return grade(np.where(mask, hc, np.nan), np.where(mask, sp_h, np.nan),
                     np.where(uni, hc, np.nan), np.where(uni, sp_h, np.nan), label)

    def bet_away(mask, uni, label):
        return grade(np.where(mask, 1 - hc, np.nan), np.where(mask, sp_a, np.nan),
                     np.where(uni, 1 - hc, np.nan), np.where(uni, sp_a, np.nan), label)

    # ---- S9 / S11: dead home team, late season -> back the favourite
    dead_h = ((d["st_h_eliminated"] > 0) | (d["st_h_tank"] > 0)).to_numpy()
    tired_h = (d["h_venues_7d"] >= 2).to_numpy()
    s9, s11 = gp50 & dead_h, gp50 & dead_h & tired_h
    # ---- S12: final ~2 weeks -> OVER
    s12 = reg & (d["st_h_season_frac"] >= 0.94).to_numpy()
    # ---- S15: home has exactly two more days of rest -> back HOME
    dr = d["h_rest_days"].to_numpy(float) - d["a_rest_days"].to_numpy(float)
    s15 = reg & (dr == 2)

    # S9's headline is quoted at the OPENING spread (NBA_DEAD_HOME_ROBUST_BRIEF grades on `open`),
    # with the T-60 number carried in the ledger's "T-60?" column. Both are reproduced.
    osp_h, osp_a = dec(d["open_spread_home_price"]), dec(d["open_spread_away_price"])
    ohc = my_cover_open
    ofav = osp < 0
    ofav_w, ofav_p = np.where(ofav, ohc, 1 - ohc), np.where(ofav, osp_h, osp_a)

    def bet_fav_open(mask, uni, label):
        return grade(np.where(mask, ofav_w, np.nan), np.where(mask, ofav_p, np.nan),
                     np.where(uni, ofav_w, np.nan), np.where(uni, ofav_p, np.nan), label)

    show([bet_fav_open(s9, gp50, "S9  dead home, late season -> back the favourite @ OPEN"),
          bet_fav(s9, gp50, "S9  same rule @ T-60"),
          bet_fav(s11, gp50, "S11 S9 + home in 2+ arenas in 7 days"),
          bet_over(s12, reg, "S12 final ~2 weeks -> OVER"),
          bet_home(s15, reg, "S15 home exactly +2 days rest -> back HOME")],
         "S9 / S11 / S12 / S15 -- reimplemented on nba_hunt_frame.parquet")

    r9o, r9, r11, r12 = (bet_fav_open(s9, gp50, ""), bet_fav(s9, gp50, ""),
                         bet_fav(s11, gp50, ""), bet_over(s12, reg, ""))
    near(r9o["win"], 62.3, 1.5, "S9 win% at the open")
    near(r9["win"], 58.7, 1.0, "S9 win% at T-60")
    near(r11["win"], 60.8, 1.0, "S11 win%")
    near(r11["roi"], 16.08, 1.5, "S11 ROI")
    near(r12["win"], 56.8, 1.0, "S12 win%")
    near(r12["roi"], 8.38, 1.5, "S12 ROI")

    # S14 and S15 are quoted off frame2, which carries the pair_l3 projection columns
    d2 = (pd.read_parquet(f"{PQ}/nba_hunt_frame2.parquet")
            .sort_values("game_date").reset_index(drop=True))
    R2 = RAW.reindex(d2["event_id"].to_numpy())
    hs2, as2 = R2["home_score"].to_numpy(float), R2["away_score"].to_numpy(float)
    sp2 = R2["t60_spread_home_point"].to_numpy(float)
    my_cover2 = tri((hs2 - as2) + sp2)
    diff("home_cover (frame2)", my_cover2, d2["home_cover"])

    hc2 = d2["home_cover"].to_numpy(float)
    sp2_h, sp2_a = dec(d2["t60_spread_home_price"]), dec(d2["t60_spread_away_price"])
    reg2 = (d2["postseason"] == 0).to_numpy()
    gp2 = pd.to_numeric(d2["min_gp"], errors="coerce").to_numpy(float)
    uni2 = reg2 & (gp2 >= 25)

    def bet2(mask, uni, home, label):
        w = hc2 if home else 1 - hc2
        p = sp2_h if home else sp2_a
        return grade(np.where(mask, w, np.nan), np.where(mask, p, np.nan),
                     np.where(uni, w, np.nan), np.where(uni, p, np.nan), label)

    # ---- S14: the naive scoring projection minus what the line asks, top 15% -> back AWAY
    proj = pd.to_numeric(d2["pair_l3_margin_vs_line"], errors="coerce").to_numpy(float)
    thr = np.nanquantile(proj[uni2 & np.isfinite(proj)], 0.85)
    s14 = uni2 & np.isfinite(proj) & (proj >= thr)
    dr2 = pd.to_numeric(d2["h_rest_days"], errors="coerce").to_numpy(float) - \
        pd.to_numeric(d2["a_rest_days"], errors="coerce").to_numpy(float)
    s15b = reg2 & (dr2 == 2)
    show([bet2(s14, uni2, False, "S14 naive projection screams HOME, top 15% -> back AWAY"),
          bet2(s15b, reg2, True, "S15 home exactly +2 days rest -> back HOME")],
         "S14 / S15 -- reimplemented on nba_hunt_frame2.parquet")
    r14, r15b = bet2(s14, uni2, False, ""), bet2(s15b, reg2, True, "")
    near(r14["win"], 55.5, 1.5, "S14 win%")
    near(r15b["win"], 58.7, 1.5, "S15 win%")
    near(r15b["roi"], 12.17, 1.5, "S15 ROI")

    # ---- S17: away favourite off a 20+ point win -> back it. This one lives on a TEAM-GAME
    #      panel with its own outcome column (`ats_pts`), so it is a second grading path and
    #      has to be audited separately rather than assumed to match.
    print("\n" + "=" * 92)
    print("C-ii  S17 -- the team-game panel, a SECOND grading path with its own outcome column")
    print("=" * 92)
    p = pd.read_parquet(f"{PQ}/nba_dims_panel.parquet")
    p = p[(p["postseason"] != 1) | p["postseason"].isna()]
    p = p[p["spread"].notna() & p["total_line"].notna()].copy()
    RP = RAW.reindex(p["event_id"].to_numpy())
    own = np.where(p["is_home"].to_numpy() == 1,
                   RP["home_score"].to_numpy(float) - RP["away_score"].to_numpy(float),
                   RP["away_score"].to_numpy(float) - RP["home_score"].to_numpy(float))
    check(np.nanmax(np.abs(own - p["margin"].to_numpy(float))) == 0,
          "panel `margin` is the OWN team's margin, rebuilt from raw scores")
    my_ats = own + p["spread"].to_numpy(float)
    check(np.nanmax(np.abs(my_ats - p["ats_pts"].to_numpy(float))) < 1e-9,
          "panel `ats_pts` == own margin + own posted spread (addition, same convention)")
    sp_own = np.where(p["is_home"].to_numpy() == 1,
                      RP["t60_spread_home_point"].to_numpy(float),
                      -RP["t60_spread_home_point"].to_numpy(float))
    check(np.nanmax(np.abs(sp_own - p["spread"].to_numpy(float))) < 1e-9,
          "panel `spread` is the own team's number, sign-flipped for the away row")

    af = (p["is_home"] == 0) & (p["is_fav"] == 1)
    s17 = (af & (p["prev_margin"] >= 20)).to_numpy()
    ats = p["ats_pts"].to_numpy(float)
    pr = dec(p["spread_price"])          # already decimal here too; dec() detects and passes through
    wall = np.where(ats > 0, 1.0, np.where(ats < 0, 0.0, np.nan))
    awayfav = af.to_numpy()
    show([grade(np.where(s17, wall, np.nan), np.where(s17, pr, np.nan),
                np.where(awayfav, wall, np.nan), np.where(awayfav, pr, np.nan),
                "S17 away fav off a 20+ win -> back it (base = any away fav)"),
          grade(np.where(awayfav, wall, np.nan), np.where(awayfav, pr, np.nan),
                np.where(awayfav, wall, np.nan), np.where(awayfav, pr, np.nan),
                "  control: every away favourite")],
         "S17 -- reimplemented on nba_dims_panel.parquet")
    r17 = grade(np.where(s17, wall, np.nan), np.where(s17, pr, np.nan),
                np.where(awayfav, wall, np.nan), np.where(awayfav, pr, np.nan), "")
    near(r17["win"], 57.4, 1.5, "S17 win%")
    near(r17["base"], 49.23, 1.0, "S17 in-slice base (any away favourite)")
    near(r17["roi"], 9.64, 1.5, "S17 ROI")

    # ============================================================ verdict
    print("\n" + "=" * 92)
    print("VERDICT")
    print("=" * 92)
    if FAIL:
        print(f"  {len(FAIL)} CHECK(S) FAILED -- the signal layer is NOT clean:")
        for f in FAIL:
            print(f"    - {f}")
        raise SystemExit(1)
    print("  Every check passed. The signal layer does NOT share the panel's sign bug.")
    print("  The reason is structural, and worth writing down so it is not re-litigated: the signal")
    print("  scripts grade a NAMED SIDE (fg_spread_fav, fg_spread_home, tt_away_over) off an outcome")
    print("  built by ADDITION from the raw margin and the posted line. They never convert a model")
    print("  number into posted convention, which is the only place the bug could live.")


if __name__ == "__main__":
    main()
