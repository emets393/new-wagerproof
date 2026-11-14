#!/usr/bin/env python3
"""Historical-frame integrity screen for the NFL and CFB training frames.

WHY THIS EXISTS (2026-10-23). `feature_drift_guard.py` asserts that the features a FROZEN
MODEL CONSUMES look at serve like they looked in training. That is the right contract, and
it caught the 2026 `net_*_s2d` break. But it is blind by construction to two defect classes
that live in the frame itself:

  1. OUTCOME LEAKS. `matchup.parquet` carries `actual_margin`, `resid_margin`,
     `resid_home_pts`, `resid_away_pts` and `spread_diff` — post-game residuals, correlating
     0.61-1.00 with the final margin and 0.008-0.03 with the betting line. Production is safe
     (the sides model takes an explicit 54-feature whitelist, `consensus_totals.py` a
     blacklist), so the drift guard never looks at them and nothing errors. They are a loaded
     gun for research: they corrupted the b68 sides run via `game_time`, and on 2026-10-23
     they silently produced a "model" with MAE 0.37 and corr 1.000 that read as a triumph
     until the third attempt. A screen the researcher cannot forget to run is worth more than
     a convention they can.

  2. UNIT BREAKS INSIDE THE TRAINING SPAN. `game_time` was hour-of-day through 2024 (mean
     15.26) and minutes-since-midnight from 2025 (mean 1082.05). `precipitation_pct` went from
     a 0-1 fraction to a 0-100 percent. A train/serve comparison CANNOT see either: the break
     is baked into the baseline it compares against. It shows up as one season's blind-model
     MAE blowing out to 16.85 while every neighbour sits near 10.

Both checks run against history alone, so this screen needs no frozen model and no slate. Run
it on any frame before fitting anything on it.

THE LEAK RULE. A legitimate feature is PRICED: the market has seen it, so it correlates at
least as well with the line as with the result. A leak is the inverse — it knows the outcome
and the line does not. So the test is `corr(col, result) - corr(col, line) > 0` rather than a
flat correlation ceiling, which would condemn genuinely strong ratings. CFB `elo_diff`
correlates 0.609 with the final margin and would fail any flat ceiling that catches real
leaks; it passes this one, because the line correlates 0.66 with it.

Usage:
    python frame_integrity_screen.py nfl
    python frame_integrity_screen.py cfb
    python frame_integrity_screen.py nfl --self-test   # prove it still catches the 3 known defects

Exit codes: 0 = clean, 1 = FINDINGS (loud, and the caller decides whether that's fatal).
"""
import argparse
import os
import sys
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

HERE = os.path.dirname(os.path.abspath(__file__))

# PRIMARY ALARM. Excess = |corr(col, result)| - |corr(col, line)|. Calibrated against the
# 2026-10-23 measurement of both frames: the worst LEGITIMATE feature measured +0.047
# (`home_consistency_pr`, NFL) and the weakest TRUE leak measured +0.134 (`fav_margin`, NFL),
# with the rest of the leaks at 0.19-0.89. 0.10 sits in that gap with room on both sides.
# Tightening toward 0.05 starts flagging real features; loosening past 0.13 lets a leak through.
LEAK_EXCESS_MAX = 0.10
# A column needs enough rows for both correlations to mean anything. An NFL season is ~285
# games, so 200 keeps the screen usable on a single-season frame while rejecting sparse
# per-player joins that happen to land in a team frame.
LEAK_MIN_N = 200
LEAK_MIN_DISTINCT = 3

# SECONDARY. Unit breaks are enormous and nothing else is: `game_time` read z=380 and
# `precipitation_pct` z=46, while the worst legitimate season-over-season shift among the live
# model's own features was `week` at z=0.99 (a short in-progress season, not a defect). 8.0 is
# two orders of magnitude clear of the noise floor, which is the point — this check should
# never be the reason someone stops trusting the screen.
UNIT_BREAK_Z_MAX = 8.0
UNIT_BREAK_MIN_SEASON_N = 50
# Identifiers are monotonic by construction — ESPN game ids climb every season, so CFB's
# `game_id` reads z=39.1 and is not a defect. They carry no units, so the scale check has
# nothing to say about them. Excluded from the UNIT screen only; they still face the leak
# screen, where a correlated id would be a genuine (and alarming) finding.
IDENTIFIER_HINTS = ("_id", "id_", "gsis", "guid", "uuid")

# Columns that ARE the outcome or the line. Excluding them is not an excuse list — they are
# the screen's own reference axes, and a frame that lacks them cannot be screened at all.
FRAMES = {
    "nfl": {
        "path": os.path.join(HERE, "nfl-extreme-outcomes", "data", "matchup.parquet"),
        "home_pts": "home_score",
        "away_pts": "away_score",
        # Home-perspective line. Negated below so it points the same way as the margin:
        # home_spread -3 (home favored by 3) becomes an expected home margin of +3.
        "line": "home_spread",
    },
    "cfb": {
        "path": os.path.join(HERE, "cfb-model", "data", "model_games.parquet"),
        "home_pts": "homePoints",
        "away_pts": "awayPoints",
        "line": "spread_close",
    },
}

# Known-benign outcome columns: the frame is EXPECTED to carry the result, that is what makes
# it a training frame. They are reported as context, never as findings. Anything else with the
# leak signature is a finding, because nothing else has a reason to know the score.
EXPECTED_OUTCOME_COLS = {
    "nfl": {"home_score", "away_score", "actual_margin", "actual_total", "total_points"},
    "cfb": {"homePoints", "awayPoints", "actual_margin", "actual_total"},
}


# Columns a FIT MUST NOT USE, beyond whatever the screen finds dynamically. Each entry records
# what is actually wrong, because "quarantined" without a reason becomes cargo cult and gets
# deleted by the next person who needs the column.
#
# These are NOT production defects: neither column is in the sides model's 54-feature whitelist
# (`forecast_harness.py` BASE) and `consensus_totals.py` blacklists the leak family, so no live
# pick depends on them. They are quarantined because they corrupted RESEARCH — `game_time` is in
# `data/b68_sides_importance.csv`, meaning that sides run was fit on a column carrying three
# mutually incompatible encodings.
QUARANTINE = {
    "nfl": {
        # THREE encodings across nine seasons (measured 2026-10-23):
        #   2018-2024  integer hour of day, 9-22
        #   2025       ET HHMM minus 500 — a UTC->ET conversion done as integer subtraction.
        #              Recovers exactly: 800->1300 (n=75), 1125->1625, 1105->1605, 1515->2015,
        #              1520->2020, 430->930. Decoded by mode-matching against 2026, NOT by
        #              reading the producer, so do not trust the +500 rule far enough to
        #              rewrite history with it — fix it upstream instead.
        #   2026       correct ET HHMM (1300, 1605, 1625, 2015, 2020, 930)
        "game_time": "3 incompatible encodings: hours (2018-24), ET-HHMM-minus-500 (2025), ET HHMM (2026)",
        # Unit flip AND a bad season AND unstable coverage:
        #   2018-22, 2024  0-1 fraction
        #   2023           mean 0.95 on 10% coverage — not a plausible precipitation distribution
        #   2025-26        0-100 percent
        # Coverage swings 10% -> 96% -> 67% season to season, so even the good seasons cannot
        # carry a stable fit.
        "precipitation_pct": "0-1 fraction through 2024 then 0-100 percent; 2023 implausible; coverage 10-96%",
    },
    "cfb": {},
}


def unusable_columns(sport, frame=None):
    """Columns no fit on this frame may consume: the static QUARANTINE plus everything the leak
    and unit screens find right now.

    This is the point of the module. A report tells a researcher what is broken; this lets them
    enforce it, which is the difference between a convention and a guardrail:

        from frame_integrity_screen import unusable_columns
        X = df.drop(columns=unusable_columns("nfl"), errors="ignore")

    Pass `frame` to screen a frame you built yourself rather than the canonical one on disk."""
    d = frame if frame is not None else _load(sport)[0]
    if "_result" not in d.columns or "_line" not in d.columns:
        d, _ = _load(sport)
    leaks, ctx = leak_screen(d, sport)
    breaks = unit_break_screen(d)
    out = set(QUARANTINE.get(sport, {}))
    out |= {r[0] for r in leaks} | {r[0] for r in ctx} | {r[0] for r in breaks}
    return sorted(out)


def _load(sport):
    cfg = FRAMES[sport]
    if not os.path.exists(cfg["path"]):
        sys.exit(f"frame not found: {cfg['path']}")
    d = pd.read_parquet(cfg["path"])
    d = d.copy()
    d["_result"] = pd.to_numeric(d[cfg["home_pts"]], errors="coerce") - pd.to_numeric(
        d[cfg["away_pts"]], errors="coerce"
    )
    # Negate so the line is an expected home margin, directly comparable to _result.
    d["_line"] = -pd.to_numeric(d[cfg["line"]], errors="coerce")
    return d, cfg


def _corr(a, b):
    """Pearson on the rows where both are present. Returns nan rather than raising on a
    degenerate slice — a constant column has no correlation, it is not an error."""
    m = a.notna() & b.notna()
    if m.sum() < LEAK_MIN_N or a[m].nunique() < LEAK_MIN_DISTINCT:
        return np.nan
    sa, sb = a[m].std(), b[m].std()
    if not sa or not sb or not np.isfinite(sa) or not np.isfinite(sb):
        return np.nan
    return float(np.corrcoef(a[m], b[m])[0, 1])


def leak_screen(d, sport):
    """Flag columns that know the result better than the market did."""
    expected = EXPECTED_OUTCOME_COLS[sport]
    findings, context = [], []
    for c in d.columns:
        if c in ("_result", "_line") or not pd.api.types.is_numeric_dtype(d[c]):
            continue
        cr, cl = _corr(d[c], d["_result"]), _corr(d[c], d["_line"])
        if not (np.isfinite(cr) and np.isfinite(cl)):
            continue
        excess = abs(cr) - abs(cl)
        if excess <= LEAK_EXCESS_MAX:
            continue
        row = (c, abs(cr), abs(cl), excess)
        (context if c in expected else findings).append(row)
    return (
        sorted(findings, key=lambda r: -r[3]),
        sorted(context, key=lambda r: -r[3]),
    )


def unit_break_screen(d):
    """Flag columns whose scale changes between seasons — the signature of a unit change.

    ADJACENT seasons, not each season against the pooled others. The pooled form was the first
    attempt and it missed both known breaks: `game_time` is minutes in BOTH 2025 and 2026, so
    the "other seasons" baseline mixes hours with minutes, its sd explodes, and the z collapses
    below threshold. Any break spanning more than one season hides from that test. A step
    change between consecutive seasons cannot hide from this one.

    The denominator is the EARLIER season's sd — the question is whether the column left the
    distribution it used to have."""
    if "season" not in d.columns:
        return []
    seasons = sorted(d.season.dropna().unique())
    findings = []
    for c in d.columns:
        if c.startswith("_") or not pd.api.types.is_numeric_dtype(d[c]):
            continue
        lc = c.lower()
        if lc == "id" or any(h in lc for h in IDENTIFIER_HINTS):
            continue
        s = pd.to_numeric(d[c], errors="coerce")
        worst = None
        for a, b in zip(seasons, seasons[1:]):
            prev, cur = s[d.season == a].dropna(), s[d.season == b].dropna()
            if len(prev) < UNIT_BREAK_MIN_SEASON_N or len(cur) < UNIT_BREAK_MIN_SEASON_N:
                continue
            sd = prev.std()
            # A column that was constant has no distribution to leave; the drift guard's
            # constant-at-serve check is the right test for that case, not this one.
            if not sd or not np.isfinite(sd) or sd == 0:
                continue
            z = abs(cur.mean() - prev.mean()) / sd
            if z > UNIT_BREAK_Z_MAX and (worst is None or z > worst[1]):
                worst = (f"{int(a)}->{int(b)}", z, prev.mean(), cur.mean())
        if worst:
            findings.append((c, *worst))
    return sorted(findings, key=lambda r: -r[2])


def report(sport):
    d, _ = _load(sport)
    n = int(d["_result"].notna().sum())
    print(f"=== frame integrity screen: {sport.upper()} ===")
    print(f"  {d.shape[0]} rows ({n} with a final result), {d.shape[1]} columns\n")

    leaks, ctx = leak_screen(d, sport)
    print(f"[1] OUTCOME LEAK SCREEN  (flag when result-corr exceeds line-corr by >{LEAK_EXCESS_MAX})")
    if ctx:
        print("    expected outcome columns (context, not findings):")
        for c, cr, cl, ex in ctx:
            print(f"      {c:<34} result {cr:.3f}  line {cl:.3f}  excess +{ex:.3f}")
    if leaks:
        print(f"    !! {len(leaks)} LEAK(S) — must be excluded from any fit on this frame:")
        for c, cr, cl, ex in leaks:
            print(f"      {c:<34} result {cr:.3f}  line {cl:.3f}  excess +{ex:.3f}")
    else:
        print("    clean — no unexpected column knows the result better than the market")

    breaks = unit_break_screen(d)
    print(f"\n[2] UNIT BREAK SCREEN  (flag when a season's mean is >{UNIT_BREAK_Z_MAX} sd off the others)")
    if breaks:
        print(f"    !! {len(breaks)} SCALE BREAK(S) — a unit changed mid-history:")
        for c, step, z, pm, cm in breaks:
            print(f"      {c:<26} {step:<12} {pm:>12.3f} -> {cm:>12.3f}   z={z:,.1f}")
    else:
        print("    clean — no column changes scale between seasons")

    q = QUARANTINE.get(sport, {})
    if q:
        print(f"\n[3] QUARANTINE  (known-bad, excluded by unusable_columns() regardless of the screens)")
        for c, why in sorted(q.items()):
            print(f"      {c:<26} {why}")

    total = len(leaks) + len(breaks)
    print(f"\n{'FINDINGS: ' + str(total) if total else 'CLEAN'}")
    print(f"unusable_columns('{sport}') -> {len(unusable_columns(sport, d))} columns a fit must drop")
    return total


def self_test():
    """Prove the screen still catches the three defects it was written for (2026-10-23).

    If this fails, either the frame was fixed (good — update the expectations) or a threshold
    drifted far enough to stop catching a known-real defect (bad)."""
    d, _ = _load("nfl")
    leaks, _ = leak_screen(d, "nfl")
    breaks = unit_break_screen(d)
    got_leaks = {r[0] for r in leaks}
    got_breaks = {r[0] for r in breaks}
    ok = True
    for c in ("resid_margin", "resid_home_pts", "resid_away_pts", "spread_diff"):
        hit = c in got_leaks
        ok &= hit
        print(f"  leak  {c:<22} {'CAUGHT' if hit else 'MISSED'}")
    for c in ("game_time", "precipitation_pct"):
        hit = c in got_breaks
        ok &= hit
        print(f"  unit  {c:<22} {'CAUGHT' if hit else 'MISSED'}")
    # The screen must NOT flag strong-but-legitimate features. This is the half that keeps it
    # usable: a screen that cries wolf gets ignored and then deleted.
    for c in ("home_predictive_pr", "away_predictive_pr", "home_consistency_pr"):
        clean = c not in got_leaks and c not in got_breaks
        ok &= clean
        print(f"  legit {c:<22} {'ok (not flagged)' if clean else 'FALSE POSITIVE'}")
    # The enforcement path must carry everything the report prints, or callers get a guardrail
    # that is quieter than the screen it is based on.
    unusable = set(unusable_columns("nfl", d))
    for c in ("resid_margin", "spread_diff", "game_time", "precipitation_pct", "actual_margin"):
        hit = c in unusable
        ok &= hit
        print(f"  enforce {c:<20} {'in unusable_columns' if hit else 'ABSENT from unusable_columns'}")
    print("\nself-test:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("sport", choices=sorted(FRAMES))
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        sys.exit(self_test())
    sys.exit(1 if report(a.sport) else 0)
