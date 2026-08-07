#!/usr/bin/env python3
"""Prove the NBA frame before modelling on it. Every check either passes or prints its failures.

This exists because two separate construction bugs shipped in this directory and both produced
tables that looked fine: a first-half spread anchor with the sign flipped, and team totals fit as
two independent models on one row per game. Neither was caught by reading output. So the frame now
gets audited against arithmetic it must satisfy, not against whether the numbers look plausible.

The checks are of four kinds:

  IDENTITY   - things that are true by definition. Points must sum to the total, differ by the
               margin, and the stored residual columns must equal result-minus-line under the
               convention build_nba_features.py claims. If these fail, everything downstream is
               meaningless regardless of how good the model looks.
  RANGE      - values that must sit inside physical bounds. First-half points cannot exceed
               full-game points; decimal odds cannot be below 1; an NBA team does not score 12.
  COVERAGE   - which seasons actually carry each market, stated as a table rather than assumed.
               The "only two seasons of team totals" error was a coverage question answered by
               guessing instead of counting.
  LEAK       - a legitimate pregame feature correlates with the LINE at least as strongly as with
               the RESULT. A feature that predicts the result better than the market does, before
               any modelling, has usually seen the box score. This is the screen that caught
               style_nba bare columns at +0.55 and the player_team_agg orc_* block.

Exit code is non-zero if any check in the first three groups fails, so a modelling run can be
gated on it. Leak findings are reported but not fatal -- the modelling code screens them per
target, and the borderline ones need a human read.
"""
import os
import sys
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, "data", "parquet", "_nba_wide_cache.parquet")

FAIL = []
LINES = []


def note(s=""):
    print(s, flush=True)
    LINES.append(s)


def check(name, ok, detail=""):
    """Record one check. `ok` is a bool; `detail` explains a failure or quantifies a pass."""
    tag = "PASS" if ok else "FAIL"
    if not ok:
        FAIL.append(name)
    note(f"| {name} | {tag} | {detail} |")
    return ok


def close(a, b, tol=1e-6):
    """Elementwise equality ignoring rows where either side is missing. Returns (n_bad, n_cmp)."""
    a, b = pd.to_numeric(a, errors="coerce"), pd.to_numeric(b, errors="coerce")
    m = a.notna() & b.notna()
    return int((~np.isclose(a[m], b[m], atol=tol)).sum()), int(m.sum())


def identities(D):
    note("\n## Identity checks — arithmetic that must hold by definition\n")
    note("| check | result | detail |")
    note("|---|---|---|")

    for nm, a, b in [
        ("full-game total = home pts + away pts", D["y_fg_total"], D["y_home_pts"] + D["y_away_pts"]),
        ("full-game margin = home pts - away pts", D["y_fg_margin"], D["y_home_pts"] - D["y_away_pts"]),
        ("first-half total = home 1H + away 1H", D["y_h1_total"], D["y_home_h1"] + D["y_away_h1"]),
        ("first-half margin = home 1H - away 1H", D["y_h1_margin"], D["y_home_h1"] - D["y_away_h1"]),
    ]:
        bad, n = close(a, b)
        check(nm, bad == 0, f"{bad:,} mismatches of {n:,}")

    # Residual sign conventions. These are the columns every grader keys off, so a flipped sign
    # here inverts a whole market silently -- exactly the h1_spread failure mode, one layer down.
    for nm, a, b in [
        ("spread residual = margin + home spread",
         D["y_fg_marg_resid"], D["y_fg_margin"] + D["t60_spread_home_point"]),
        ("total residual = total - line",
         D["y_fg_tot_resid"], D["y_fg_total"] - D["t60_total_point"]),
        ("1H spread residual = 1H margin + 1H spread",
         D["y_h1_marg_resid"], D["y_h1_margin"] + D["h1_spread"]),
        ("1H total residual = 1H total - 1H line",
         D["y_h1_tot_resid"], D["y_h1_total"] - D["h1_total_line"]),
        ("home TT residual = home pts - home TT", D["y_tt_h_resid"], D["y_home_pts"] - D["tt_h"]),
        ("away TT residual = away pts - away TT", D["y_tt_a_resid"], D["y_away_pts"] - D["tt_a"]),
    ]:
        bad, n = close(a, b)
        check(nm, bad == 0, f"{bad:,} mismatches of {n:,}")

    check("event_id unique", bool(D["event_id"].is_unique),
          f"{D['event_id'].nunique():,} ids over {len(D):,} rows")

    # A home favourite must actually win more often than it loses. If the spread sign convention
    # were inverted the correlation below would come out negative, and every spread market in the
    # directory would be backwards while still printing ~50% win rates.
    # Sign, not strength. A spread and a margin correlate around -0.49 in the NBA because a single
    # game's margin is mostly noise around the line; demanding a stronger number would fail a
    # correct frame. Three independent corroborations are asserted alongside it, because any one
    # of them alone could be satisfied by a subtly wrong frame.
    c = D["t60_spread_home_point"].corr(D["y_fg_margin"])
    check("home spread sign convention (favourite lays points)", c < -0.30,
          f"corr(home spread, home margin) {c:+.3f} — negative is what correct looks like")
    ms, mm = D["t60_spread_home_point"].mean(), D["y_fg_margin"].mean()
    check("mean home spread mirrors mean home margin", abs(ms + mm) < 0.75,
          f"spread {ms:+.2f} vs margin {mm:+.2f} — should be near-exact negatives")
    cov = ((D["y_fg_margin"] + D["t60_spread_home_point"]) > 0).mean()
    check("home ATS cover rate near 50%", 0.46 < cov < 0.54, f"{100*cov:.1f}%")
    wr = (D["y_fg_margin"] > 0).mean()
    check("home outright win rate near 55%", 0.52 < wr < 0.59, f"{100*wr:.1f}%")
    c = D["t60_total_point"].corr(D["y_fg_total"])
    check("total line tracks the total scored", c > 0.15, f"corr {c:+.3f}")


def ranges(D):
    note("\n## Range checks — physically impossible values\n")
    note("| check | result | detail |")
    note("|---|---|---|")

    for side in ("home", "away"):
        bad = int((D[f"y_{side}_h1"] > D[f"y_{side}_pts"]).sum())
        check(f"{side} first-half points <= full-game points", bad == 0, f"{bad:,} violations")

    pts = pd.concat([D["y_home_pts"], D["y_away_pts"]])
    bad = int(((pts < 55) | (pts > 190)).sum())
    check("team score inside 55-190", bad == 0,
          f"{bad:,} outside; observed {pts.min():.0f}-{pts.max():.0f}")

    h1 = pd.concat([D["y_home_h1"], D["y_away_h1"]])
    bad = int(((h1 < 20) | (h1 > 100)).sum())
    check("first-half score inside 20-100", bad == 0,
          f"{bad:,} outside; observed {h1.min():.0f}-{h1.max():.0f}")

    # Prices in this frame are DECIMAL, not American: -110 is stored as 1.909. v2.to_dec passes
    # decimals through and only converts values with |x| >= 100, so it is safe either way -- but
    # the check has to test the encoding that is actually here. A decimal price below 1.0 would
    # mean a bet that loses money when it wins.
    price = [c for c in D.columns if c.endswith("_price") or c in
             ("h1_sp_h", "h1_sp_a", "h1_ov", "h1_un", "tt_h_o", "tt_h_u", "tt_a_o", "tt_a_u")]
    bad = {}
    for c in price:
        v = pd.to_numeric(D[c], errors="coerce").dropna()
        n = int(((v <= 1.0) | (v > 51)).sum())
        if n:
            bad[c] = n
    check("decimal prices inside (1.0, 51]", not bad, str(bad) if bad else
          f"{len(price)} price columns clean")

    # Both sides of a two-way market must overround. Under 100% would be a arbitrage on every
    # game, which means the two prices came from different books or different lines.
    for nm, o, u in (("full-game total", "t60_total_over_price", "t60_total_under_price"),
                     ("full-game spread", "t60_spread_home_price", "t60_spread_away_price"),
                     ("moneyline", "t60_ml_home_price", "t60_ml_away_price"),
                     ("home team total", "tt_h_o", "tt_h_u"),
                     ("first-half total", "h1_ov", "h1_un")):
        v = (1 / pd.to_numeric(D[o], errors="coerce") + 1 / pd.to_numeric(D[u], errors="coerce"))
        v = v.dropna()
        check(f"{nm} vig between 0% and 15%", bool(((v > 1.0) & (v < 1.15)).mean() > 0.98),
              f"median overround {100*(v.median()-1):.2f}%, "
              f"{int(((v <= 1.0) | (v >= 1.15)).sum())} outside")

    # Phantom listings. The Odds API has shipped duplicate events at :00/:30 alongside the real
    # :10/:40 tip time, and those carried corrupted lines for 46 games once already.
    tip = pd.to_datetime(D["date"]).dt.minute.value_counts().to_dict()
    check("no duplicate (date, home id) rows",
          not D.duplicated(["date", "hid"]).any(),
          f"{int(D.duplicated(['date', 'hid']).sum())} duplicates; tip-minute spread {tip}")


def coverage(D):
    note("\n## Coverage — which seasons actually carry each market\n")
    note("Counted, not assumed. The claim that team totals covered two seasons was a coverage "
         "question answered by guessing.\n")
    mk = {"full-game spread": "t60_spread_home_point", "full-game total": "t60_total_point",
          "moneyline": "t60_ml_home_price", "home team total": "tt_h", "away team total": "tt_a",
          "first-half spread": "h1_spread", "first-half total": "h1_total_line",
          "first-half box score": "y_home_h1"}
    ssn = sorted(D["season"].dropna().unique())
    note("| market | " + " | ".join(str(int(s)) for s in ssn) + " | total |")
    note("|---" * (len(ssn) + 2) + "|")
    for nm, c in mk.items():
        n = D.groupby("season")[c].apply(lambda x: int(x.notna().sum()))
        note(f"| {nm} | " + " | ".join(f"{int(n.get(s, 0)):,}" for s in ssn) +
             f" | {int(D[c].notna().sum()):,} |")
    note("")
    g = D.groupby("season").size()
    note("| games per season | " + " | ".join(f"{int(g.get(s, 0)):,}" for s in ssn) + " | |")

    note("\n### Feature-block completeness by season\n")
    note("A block that is empty in an early season silently makes the walk-forward train on a "
         "different feature set than it grades on.\n")
    note("| block | " + " | ".join(str(int(s)) for s in ssn) + " |")
    note("|---" * (len(ssn) + 1) + "|")
    for nm, pre in (("base h_/a_", ("h_", "a_")), ("repaired ratings", ("radj_",)),
                    ("dimensions", ("dm_",)), ("matchup nets", ("raw_", "net_")),
                    ("adjusted", ("adj_own_", "adj_net_")), ("market structure", ("mk_",))):
        cs = [c for c in D.columns if c.startswith(pre)]
        if not cs:
            continue
        fill = D.groupby("season")[cs].apply(lambda x: 100 * x.notna().mean().mean())
        note(f"| {nm} ({len(cs)}) | " + " | ".join(f"{fill.get(s, 0):.0f}%" for s in ssn) + " |")


def leaks(D):
    """A pregame feature must correlate with the LINE at least as strongly as with the RESULT."""
    note("\n## Leak screen — features that know the result better than the market does\n")
    note("A genuine pregame feature is information the market has already priced, so its "
         "correlation with the LINE should be at least as strong as with the RESULT. The reverse "
         "means the column saw the box score. Reported per market; not fatal, because the "
         "modelling code screens per target, but anything with a large gap needs a look.\n")
    feat = [c for c in D.columns
            if c.startswith(("h_", "a_", "sum_", "d_", "radj_", "dm_", "raw_", "net_",
                             "adj_own_", "adj_net_", "mk_", "ph_", "pa_"))
            and pd.api.types.is_numeric_dtype(D[c]) and D[c].notna().mean() > 0.60]
    note(f"{len(feat):,} feature columns screened.\n")
    note("| market | worst offender | corr w/ line | corr w/ result | gap | # flagged |")
    note("|---|---|---|---|---|---|")
    tot = 0
    for nm, line, res in (("full-game spread", D["t60_spread_home_point"], D["y_fg_margin"]),
                          ("full-game total", D["t60_total_point"], D["y_fg_total"]),
                          ("home team total", D["tt_h"], D["y_home_pts"]),
                          ("away team total", D["tt_a"], D["y_away_pts"]),
                          ("first-half total", D["h1_total_line"], D["y_h1_total"])):
        m = pd.to_numeric(line, errors="coerce").notna() & pd.to_numeric(res, errors="coerce").notna()
        X = D.loc[m, feat]
        cl = X.corrwith(pd.to_numeric(line[m], errors="coerce")).abs()
        cr = X.corrwith(pd.to_numeric(res[m], errors="coerce")).abs()
        gapv = (cr - cl).dropna()
        # 0.05 of slack: sampling noise alone moves a correlation by a few points at n~4-5k, and
        # a real leak of the kind seen before shows up at +0.3 or more, not at +0.06.
        flag = gapv[gapv > 0.05].sort_values(ascending=False)
        tot += len(flag)
        if len(flag):
            w = flag.index[0]
            note(f"| {nm} | `{w}` | {cl[w]:.3f} | {cr[w]:.3f} | **{flag.iloc[0]:+.3f}** | "
                 f"{len(flag)} |")
        else:
            note(f"| {nm} | — | — | — | — | 0 |")
    note("")
    if tot:
        note(f"**{tot} flagged column-market pairs.** Listed in full in `NBA_AUDIT_LEAKS.txt`.")
    else:
        note("**No column predicts any result better than that market's line does.**")
    return tot


def main():
    D = pd.read_parquet(CACHE)
    D["date"] = pd.to_datetime(D["date"])
    note(f"# NBA data audit\n")
    note(f"`{os.path.relpath(CACHE, ROOT)}` — **{len(D):,} games, {D.shape[1]:,} columns**, "
         f"seasons {int(D['season'].min())}-{int(D['season'].max())}.\n")
    note("Written after two construction bugs shipped tables that read as fine: a first-half "
         "spread anchor with the sign flipped, and team totals fit as two independent models on "
         "one row per game. The frame is now checked against arithmetic it must satisfy rather "
         "than against whether the output looks plausible.")

    identities(D)
    ranges(D)
    coverage(D)
    nleak = leaks(D)

    note("\n## Verdict\n")
    if FAIL:
        note(f"**{len(FAIL)} checks FAILED.** Modelling on this frame is not safe until they are "
             f"fixed:\n")
        for f in FAIL:
            note(f"- {f}")
    else:
        note("**All identity, range and coverage checks pass.** The scores reconcile with the "
             "totals and margins, every stored residual matches result-minus-line under the "
             "stated convention, the spread sign is oriented correctly, no impossible scores or "
             "prices are present, and no duplicate listings survive.")
        if nleak:
            note(f"\n{nleak} column-market pairs tripped the leak screen and are excluded per "
                 "target by the modelling code.")

    with open(os.path.join(ROOT, "NBA_AUDIT.md"), "w") as f:
        f.write("\n".join(LINES) + "\n")
    print("wrote NBA_AUDIT.md", flush=True)
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
