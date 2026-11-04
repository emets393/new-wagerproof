#!/usr/bin/env python3
"""Train/serve feature-drift guard for the NFL and CFB production models.

WHY THIS EXISTS (2026-10-02). The NFL sides model spent 2026 being fed a different
statistic than it was fit on: the pregame feeds' weekly upserts wrote this-season-only
values under cumulative-since-2018 column names, so the 21 `net_*_s2d` matchup features
arrived 2.4-7.2x wider than their training distribution. Nothing failed. No null, no
exception, no missing row — the MEANS were fine, only the SPREAD changed. The board just
quietly went flat (BUF -7 and SEA -7 both modelled as 1-point pick'ems) and it took a
human noticing two implausible numbers to catch it, four weeks in.

A frozen model is a contract with a distribution. This asserts the contract.

What it checks, per feature the frozen model actually consumes:
  1. sd ratio      — serve sd / train sd. The signature that caught the NFL bug.
  2. out-of-range  — share of serve rows outside the train 1st-99th percentile. ~2% is
                     the floor BY CONSTRUCTION, so the threshold scales off that.
  3. null delta    — serve null rate minus train null rate. Catches a feed that went
                     missing rather than wrong (and the `_aligned()`-style reindex-to-NaN
                     path in cfb_forecast, which silently fills absent columns).
  4. absent        — a feature the frozen model expects that the frame no longer builds.
  5. mean shift    — the serve LEVEL, in training sd units. Added 2026-11-04: checks 1-4
                     are all spread/presence tests, so they are blind to a feature that
                     arrives at the right width in the wrong place.
  6. family shift  — the MEDIAN |mean shift| across a model's features. The sharp one. A
                     seasonal artifact moves one feature; a feed that changed SOURCE moves
                     the whole family together.

Models covered: NFL sides, NFL totals-b15, CFB total, CFB spread. The NFL TOTALS model was
uncovered until 2026-11-04, which is why its break ran five weeks before a human spotted it:
nflverse never published 2026 pbp_participation, so the 8 b50 scheme features first served
100% NaN (wk1-4: the board ran ANTI-correlated with the market at -0.272 and went 13-33) and
were then back-filled from plain pbp + Fantasy Points, which fixed the nulls but left the
features measured differently (qb_epa_vs_zone -0.879 sd, family median 0.491). Checks 1-4
pass all of that. Checks 5-6 do not. b55 keeps reporting coverage in its own b50 block --
it builds its own frame internally -- while b15 is banded here against
consensus_totals.b15_frame(), the same derivation the model trains on.

⚠ COMPARE WEEK-MATCHED WHERE THE HISTORY ALLOWS IT. Pooling all training weeks makes
early-season rows look broken because season-to-date stats are genuinely wilder in week 2
than in week 12. Pooled, CFB week 2 reads 21.8 features out of range; week-matched against
other seasons' week 2 it reads 6.6 and the median sd ratio is 1.07x. The first number is
an artifact of the test, not a defect in the feed. Getting this wrong means crying wolf
every September, which is how a guard gets ignored and then removed.

Usage:
    python feature_drift_guard.py nfl [--season 2026] [--week 4]
    python feature_drift_guard.py cfb [--season 2026] [--week 5]
    python feature_drift_guard.py nfl --self-test   # prove it still catches the 2026 bug

Exit codes: 0 = clean, 1 = DRIFT (loud, and the caller decides whether that's fatal).
"""
import argparse
import os
import sys

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))

# PRIMARY ALARM. A feature whose serve spread is a different multiple of its training
# spread is reporting a different quantity, not an unusual week. The NFL break ran
# 2.4-7.2x; a healthy week-matched board sits at 0.85-1.15x on both sports.
#
# There is deliberately NO lower bound. A cumulative-since-2018 stat NARROWS every year
# by construction (2026 wk4 carries ~1,550 drives of history, 2019 wk4 carried ~190), so
# those features sit at 0.33-0.40x against week-matched history forever and a lower bound
# flags seven of them every single week. The dead-feature case a lower bound was meant to
# catch is handled precisely by the constant-at-serve check instead.
SD_RATIO_MAX = 2.0
# A continuous feature with ZERO variance across the slate is not a narrow week, it is a
# dead feed. This is how player_stats_def being frozen at 2024 surfaced: h_dpt / a_dpt /
# dprod_team_diff were fillna(0)'d to a constant for all 16 games. Low-cardinality flags
# (pre_bye, blowout_last, div_game) are legitimately all-zero in a 16-game week, so the
# check only applies where training showed real continuous spread.
MIN_DISTINCT_FOR_RATIO = 10
# SECONDARY, DELIBERATELY BLUNT. A 1st-99th band puts ~2% of in-distribution rows outside
# itself, but a single-week band estimated from ~500 historical rows is noisy and CFB has
# real year-to-year roster/realignment churn: healthy wk4 features sit at 7-12% and
# calibrating near that floor flags ~12 good features every week, which is how a guard
# earns the ignore. 20% is where values have genuinely left the training support — the
# real NFL break averaged 26% per broken feature. The COUNT floor matters too: an NFL week
# is 16 games, so one out-of-band game is already 6.25%.
OUT_OF_RANGE_MAX = 0.20
OUT_OF_RANGE_MIN_N = 3
# A feed that stopped arriving. Look-ahead features legitimately trip this (next week's
# opponent isn't built yet), so they're named as known exceptions per sport rather than
# silently tolerated.
# A LEVEL break, which the spread checks above are blind to by construction. This guard was
# built for the 2026 sides bug where "the MEANS were fine, only the SPREAD changed" -- so it
# has no mean test at all, and the NFL TOTALS model then broke the opposite way and went
# unnoticed for five weeks. nflverse never published 2026 pbp_participation, so the 8 b50
# scheme features first served 100% NaN (wk1-4: the board ran ANTI-correlated with the
# market, -0.272, and went 13-33) and were then back-filled from plain pbp + Fantasy Points
# (618ac4bf), which fixed the nulls but left the features MEASURED DIFFERENTLY:
#
#     qb_epa_vs_zone    mean shift -0.879 sd   sd ratio 0.88   <- caught only by this check
#     qb_epa_vs_man     mean shift -0.669 sd   sd ratio 0.86
#     def_pressure_rate mean shift +0.497 sd   sd ratio 1.27
#     def_man_rate      mean shift +0.485 sd   sd ratio 0.71
#
# Every one of those passes SD_RATIO_MAX, NULL_DELTA_MAX and the out-of-range band.
# 0.75 sd is set from BOTH sides of the measured evidence: the break's worst feature sits at
# 0.879, while the widest HEALTHY shift on the same board is temp_f at +0.56 -- a real
# seasonal effect (a warm early-season sample), not a defect. Tightening below ~0.6 would
# flag that every September, which is how a guard earns the ignore.
MEAN_SHIFT_MAX = 0.75
# GROUP signature, and the sharper of the two level checks. A seasonal artifact moves ONE
# or two features (temp_f runs +0.56 sd on a warm early sample); a feed that changed source
# moves the whole family together. Measured on the same 2026 board:
#
#     healthy b15 matchup features   median |shift| 0.070   8% of features over 0.4 sd
#     broken  b50 scheme features    median |shift| 0.491  75% of features over 0.4 sd
#
# Calibrated against three MEASURED boards, not a guess:
#
#     healthy b15 matchup features (2026)      median |shift| 0.070
#     healthy NFL sides, 38 feats, wk5/wk6     median |shift| 0.222 / 0.152
#     broken  b50 scheme features (2026)       median |shift| 0.491
#
# 0.35 sits above the worst HEALTHY board seen (0.222, the 38-feature sides model, whose
# variety legitimately widens the median) and well below the broken one. 0.25 was the first
# cut and it left only a 0.03 margin over healthy sides -- near enough to flag a good board,
# which is how a guard earns the ignore.
GROUP_SHIFT_MAX = 0.35
NULL_DELTA_MAX = 0.50
MIN_TRAIN_N = 40
MIN_SERVE_N = 5

# Features that are structurally unavailable at serve time. Each needs a REASON — this
# list is how a real regression gets excused, so it must never grow casually.
KNOWN_NULL_AT_SERVE = {
    "cfb": {
        # Next opponent's as-of net rating: the following week's ratings don't exist when
        # the current week is scored. 15% null in training, 100% at serve, 2 of 187 feats.
        "home_next_opp_net", "away_next_opp_net",
    },
    "nfl": set(),
}

# DISTRIBUTION checks do not apply to weather. A windy or warm week is a real week, not a
# feed that changed definition: on a 13-game 2026 wk6 slate wind_mph alone ran 2.17x the
# training spread at +0.83 sd, which is one storm. Left in, the totals model would flag
# weather most windy weeks and the guard would get ignored -- the failure mode this file
# warns about twice. Exempt from the SPREAD/LEVEL/range checks ONLY: the null, absent and
# constant-at-serve checks still apply, so a weather feed that DIES is still caught, and
# that is the failure that actually matters (a frozen feed reads as constant, not as wide).
DIST_EXEMPT = {"wind_mph", "temp_f", "wind_speed", "temperature", "precipitation_pct",
               "precipitation_type", "wind_under", "cold"}


def _num(s):
    """Coerce to float64 and drop nulls. The float64 cast matters: a boolean column goes
    through np.percentile and raises on the subtract."""
    return pd.to_numeric(pd.Series(s).astype("float64"), errors="coerce").dropna()


def load_nfl(season, week):
    sys.path.insert(0, os.path.join(HERE, "nfl-extreme-outcomes"))
    os.chdir(os.path.join(HERE, "nfl-extreme-outcomes"))
    import joblib
    from forecast_harness import build
    m, BASE = build()
    clf, reg, feats = joblib.load(os.path.join("data", f"sides_models_{season}.pkl"))
    # The harness trains on week>=4 only, so that IS the training distribution.
    tr_all = m[(m.season < season) & (m.week >= 4)].dropna(subset=["home_cover"])
    te = m[(m.season == season) & (m.week == week)]
    # Week-matched here too: ~15 prior seasons x 16 games = ~240 same-week rows, plenty to
    # band. Pooling flagged home/away_consistency_pr at 1.5-1.9x sd, which is just a
    # 3-game-old "consistency" rating being legitimately wilder than a full-season one —
    # the same early-season artifact that made pooled CFB week 2 read 21.8 features bad.
    tr_wk = tr_all[tr_all.week == week]
    tr = tr_wk if len(tr_wk) >= MIN_TRAIN_N else tr_all
    basis = f"week {week}" if len(tr_wk) >= MIN_TRAIN_N else "all weeks 4+ (too few same-week rows)"
    out = {"sides": (list(feats), tr, te, basis)}

    # The TOTALS model was uncovered, which is why its 2026 break ran five weeks before a
    # human spotted it. Its features are DERIVED (off_ppd_sum, pass_epa_sum, ...) and do not
    # exist in the raw matchup frame, so band them against consensus_totals.b15_frame() --
    # the same function the model trains on -- never a re-derivation here.
    # (b55 builds its own frame internally and reports coverage in its own b50 block.)
    # Best-effort: a missing artifact must not take down the sides check, which is the one
    # that has caught real breaks.
    try:
        import consensus_totals as CT
        _b15 = os.path.join("data", f"totals_b15_{season}.pkl")
        if os.path.exists(_b15):
            _gb, _f15 = joblib.load(_b15)
            _mf, _ = CT.b15_frame(strict_open=True)      # production mode is strict-open
            _mf = _mf[_mf.week >= 4]
            _tr15 = _mf[(_mf.season < season) & _mf.actual_total.notna()]
            _te15 = _mf[(_mf.season == season) & (_mf.week == week)]
            _trw = _tr15[_tr15.week == week]
            out["totals-b15"] = (list(_f15), _trw if len(_trw) >= MIN_TRAIN_N else _tr15, _te15,
                                 f"week {week}" if len(_trw) >= MIN_TRAIN_N else "all weeks 4+")
    except Exception as _e:
        print(f"[drift] totals-b15 skipped ({type(_e).__name__}: {_e})")
    return out


def load_cfb(season, week):
    sys.path.insert(0, os.path.join(HERE, "cfb-model"))
    os.chdir(os.path.join(HERE, "cfb-model"))
    import joblib
    import cfb_forecast as F
    gm, feats, nets = F.load()
    tm, sm = joblib.load(os.path.join("out", f"cfb_models_{season}.pkl"))
    tr_all = gm[(gm.season < season) & gm.actual_total.notna()]
    te = gm[(gm.season == season) & (gm.week == week)]
    out = {}
    for nm, mod in (("total", tm), ("spread", sm)):
        # Week-matched: CFB's season-to-date features are genuinely wilder in week 2 than
        # week 12, and 10 prior seasons give enough same-week rows to band properly.
        tr_wk = tr_all[tr_all.week == week]
        tr = tr_wk if len(tr_wk) >= MIN_TRAIN_N else tr_all
        out[nm] = (list(mod.feature_names_in_), tr, te,
                   f"week {week}" if len(tr_wk) >= MIN_TRAIN_N else "all weeks (too few same-week rows)")
    return out


def check(sport, feats, tr, te, basis, exempt):
    absent = [c for c in feats if c not in te.columns]
    rows, shifts = [], []
    for c in feats:
        if c in absent:
            continue
        a, b = _num(tr.get(c)), _num(te.get(c))
        tn = float(pd.Series(tr.get(c)).isna().mean())
        sn = float(pd.Series(te.get(c)).isna().mean())
        if len(a) < MIN_TRAIN_N or len(b) < MIN_SERVE_N:
            # Can't band it, but a feature that went fully null still has to be reported.
            if sn - tn > NULL_DELTA_MAX and c not in exempt:
                rows.append((c, np.nan, np.nan, sn - tn, "went null at serve"))
            continue
        lo, hi = a.quantile(0.01), a.quantile(0.99)
        n_out = int(((b < lo) | (b > hi)).sum())
        oor = n_out / len(b)
        ratio = (b.std() / a.std()) if a.std() > 1e-12 else np.nan
        continuous = a.nunique() >= MIN_DISTINCT_FOR_RATIO
        dead = continuous and a.std() > 1e-12 and b.std() <= 1e-12
        # Level shift, in TRAINING sd units, so it is comparable across features.
        shift = ((b.mean() - a.mean()) / a.std()) if a.std() > 1e-12 else np.nan
        shifted = continuous and np.isfinite(shift) and abs(shift) > MEAN_SHIFT_MAX
        _dx = c in DIST_EXEMPT          # weather: real variance, not a definition change
        bad = ((ratio > SD_RATIO_MAX) and not _dx) or dead or (shifted and not _dx) or \
              (oor > OUT_OF_RANGE_MAX and n_out >= OUT_OF_RANGE_MIN_N and not _dx) or \
              ((sn - tn > NULL_DELTA_MAX) and c not in exempt)
        if bad:
            note = "CONSTANT at serve — dead feed?" if dead else (
                   "LEVEL shift — same column, different measurement?" if shifted else "")
            rows.append((c, ratio, shift, oor, sn - tn, note))
        if continuous and np.isfinite(shift) and c not in DIST_EXEMPT:
            shifts.append(abs(shift))   # weather would inflate the family median on any storm
    group = {"n": len(shifts),
             "median_abs_shift": float(np.median(shifts)) if shifts else float("nan"),
             "share_over_0.4": float(np.mean([s > 0.4 for s in shifts])) if shifts else float("nan")}
    return absent, pd.DataFrame(rows, columns=["feature", "sd_ratio", "mean_shift_sd",
                                               "out_of_range", "null_delta", "note"]), group


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sport", choices=["nfl", "cfb"])
    ap.add_argument("--season", type=int, default=int(os.environ.get("NFL_SEASON") or os.environ.get("CFB_SEASON") or 2026))
    ap.add_argument("--week", type=int, default=int(os.environ.get("NFL_WEEK") or os.environ.get("CFB_WEEK") or 0))
    ap.add_argument("--self-test", action="store_true",
                    help="widen the matchup nets 3x and confirm the guard still fires")
    a = ap.parse_args()
    if not a.week:
        sys.exit("[drift] --week is required (or NFL_WEEK / CFB_WEEK in the env)")

    models = (load_nfl if a.sport == "nfl" else load_cfb)(a.season, a.week)
    exempt = KNOWN_NULL_AT_SERVE[a.sport]
    print(f"\n=== feature-drift guard :: {a.sport.upper()} {a.season} wk{a.week} ===")
    print(f"    thresholds: sd ratio >{SD_RATIO_MAX}x | out-of-range >{OUT_OF_RANGE_MAX:.0%} "
          f"| null delta >{NULL_DELTA_MAX:.0%} | mean shift >{MEAN_SHIFT_MAX} sd "
          f"| family median shift >{GROUP_SHIFT_MAX} sd")
    drift = False
    for nm, (feats, tr, te, basis) in models.items():
        if a.self_test:
            te = te.copy()
            nets = [c for c in feats if c.startswith("net_")] or feats[:10]
            for c in nets:
                te[c] = pd.to_numeric(te[c], errors="coerce") * 3.0
            print(f"  [self-test] widened {len(nets)} net features 3x on the serve frame")
        absent, bad, group = check(a.sport, feats, tr, te, basis, exempt)
        tag = f"{nm} model ({len(feats)} feats, n_train={len(tr)}, n_serve={len(te)}"
        tag += f", banded vs {basis})" if basis else ")"
        print(f"\n  {tag}")
        # An empty serve frame makes every per-feature check skip and the guard report
        # "clean" — a vacuous pass, which is worse than no guard at all. Treat it as a
        # failure: it means the frame wasn't rebuilt for this week.
        if len(te) < MIN_SERVE_N:
            drift = True
            print(f"    ⛔ serve frame has {len(te)} rows (<{MIN_SERVE_N}) — NOTHING WAS "
                  f"CHECKED. Rebuild the feature frame for {a.season} wk{a.week} before "
                  f"trusting this board.")
            continue
        if absent:
            drift = True
            print(f"    ⛔ {len(absent)} features the model expects are ABSENT from the frame "
                  f"(they become NaN silently): {absent[:8]}")
        if len(bad):
            drift = True
            print(f"    ⛔ {len(bad)} features drifted:")
            # Rank by WORST severity across the checks, not by sd_ratio: a level break has
            # a perfectly normal sd_ratio (0.88 on qb_epa_vs_zone) and would sort last,
            # which is how it would get missed a second time.
            _sev = pd.concat([
                (bad.sd_ratio.abs() / SD_RATIO_MAX),
                (bad.mean_shift_sd.abs() / MEAN_SHIFT_MAX),
                (bad.out_of_range / OUT_OF_RANGE_MAX),
                (bad.null_delta / NULL_DELTA_MAX),
            ], axis=1).max(axis=1)
            print(bad.assign(_sev=_sev).sort_values("_sev", ascending=False)
                     .drop(columns="_sev").head(15)
                     .to_string(index=False, float_format=lambda x: f"{x:.3f}"))
        # Group LEVEL signature. Checked even when no single feature crossed its own cut:
        # that is exactly the state the 2026 totals break was in (1 of 8 features over
        # MEAN_SHIFT_MAX, but a 0.49 median across the family).
        if group["n"] >= 5 and np.isfinite(group["median_abs_shift"]) \
                and group["median_abs_shift"] > GROUP_SHIFT_MAX:
            drift = True
            print(f"    ⛔ LEVEL SHIFT ACROSS THE FAMILY: median |mean shift| = "
                  f"{group['median_abs_shift']:.3f} sd over {group['n']} features "
                  f"({group['share_over_0.4']:.0%} past 0.4 sd), limit {GROUP_SHIFT_MAX}. "
                  f"A whole family moving together is a feed that changed SOURCE, not a "
                  f"strange week — check what now populates these columns.")
        elif np.isfinite(group["median_abs_shift"]):
            print(f"    level: median |mean shift| = {group['median_abs_shift']:.3f} sd "
                  f"over {group['n']} features (limit {GROUP_SHIFT_MAX})")
        if not absent and not len(bad):
            print("    ✅ clean — every feature is inside its training distribution")
    if drift:
        print(f"\n⛔ DRIFT: {a.sport.upper()} is being served features it was not fit on. "
              f"Do NOT trust this board. Find the feed that changed definition — check a "
              f"row-count column like off_drives_seen for a reset — and fix it upstream. "
              f"Dropping the features is NOT the fix (costs 55.3%->52.8% on NFL sides).")
        return 1
    print(f"\n✅ {a.sport.upper()} {a.season} wk{a.week}: no train/serve drift detected")
    return 0


if __name__ == "__main__":
    sys.exit(main())
