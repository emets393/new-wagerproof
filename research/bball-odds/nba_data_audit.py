#!/usr/bin/env python3
"""Is the NBA model's input data actually correct? An independent audit of the frame everything sits on.

WHY. Four modelling rounds have now been run on `_nba_wide_cache.parquet` without anyone checking
that its contents are what they claim to be. The two things this repo has already been burned by are
exactly the two things a modelling script cannot catch on its own: the Odds API silently listed ~46
games TWICE and fanned them to 8 rows each (caught by an `is_unique` assert, not by reading code),
and `nba_panel.py` graded a whole market with an inverted sign for months (caught by the owner). Both
produced perfectly plausible-looking output. So does bad data, always.

WHAT THIS DOES NOT DO. It does not import the model, the panel builder, or any grader. Every quantity
is rebuilt longhand from the raw sources -- `games_nba.parquet` for scores and
`movement_games_nba.parquet` for prices -- and compared against what the cache says. A check that
reuses the code under test proves nothing.

THE SIX FAMILIES

  A  identity      row counts, uniqueness, the phantom-duplicate drop, the panel's 2-rows-per-game
  B  outcomes      every y_* column rebuilt from raw scores; must agree exactly
  C  prices        format consistency, de-vig sanity, and the calibration oracle (win rate must rise
                   with implied probability -- only meaningful where prices actually disperse)
  D  as-of         the leak screen, plus per-team lag-1 autocorrelation. A legitimate rolling feature
                   carries over from a team's previous game (autocorr high); a column that quietly
                   contains THIS game's box score does not (autocorr ~0). This is the check that
                   caught style_nba and the orc_* family.
  E  coverage      per-season non-null rates per feature family. A block that only exists in the last
                   two seasons trains on nothing in the first two, and any "lift" it shows is a
                   coverage artefact rather than a finding. This is the check the motivation block
                   has not yet been through.
  F  market        does the posted line behave like a real line -- right correlation with the margin,
                   right base rates, right home-field size

Exit code is nonzero if any check FAILs, so this can gate a modelling run.
"""
import os
import sys
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")
FAILS = []
NOTES = []


def check(ok, label, detail="", warn_only=False):
    tag = "PASS" if ok else ("WARN" if warn_only else "FAIL")
    if not ok and not warn_only:
        FAILS.append(label)
    if not ok and warn_only:
        NOTES.append(f"{label}: {detail}")
    print(f"  [{tag}] {label}" + (f"  --  {detail}" if detail else ""), flush=True)
    return ok


def dec(price):
    """Price -> decimal, format-detected per value.

    The movement columns are ALREADY DECIMAL in this repo (a -110 reads 1.909) while some other
    tables store raw American. Running an American converter over a decimal turns 1.909 into 1.019
    and prints an impossible ~-46% blind ROI, which is exactly what an earlier audit did on its first
    run. American odds are never strictly inside (-100, +100), so the band is a safe discriminator.
    """
    a = pd.to_numeric(price, errors="coerce").to_numpy(float)
    return np.where((a >= 1.01) & (a <= 40.0), a,
                    np.where(a >= 100.0, 1.0 + a / 100.0,
                             np.where(a <= -100.0, 1.0 + 100.0 / np.abs(a), np.nan)))


def main():
    G = pd.read_parquet(f"{PQ}/games_nba.parquet")
    M = pd.read_parquet(f"{PQ}/movement_games_nba.parquet")
    D = pd.read_parquet(f"{PQ}/_nba_wide_cache.parquet")
    S = pd.read_parquet(f"{PQ}/nba_standings_feats.parquet")
    D["date"] = pd.to_datetime(D["date"])

    # ---------------------------------------------------------------- A. identity
    print("\nA. IDENTITY AND JOINS", flush=True)
    check(D["event_id"].is_unique, "cache event_id unique",
          f"{len(D):,} rows, {D['event_id'].nunique():,} ids")
    check(G["event_id"].is_unique, "raw games event_id unique", f"{len(G):,} rows")
    check(len(D) < len(G), "phantom duplicates dropped",
          f"raw {len(G):,} -> cache {len(D):,} ({len(G)-len(D)} removed)")

    # The phantom tell is the clock: real NBA tips sit on :10 and :40.
    inc = G["event_id"].isin(set(D["event_id"]))
    ct = pd.to_datetime(G["commence_time"], utc=True, errors="coerce")
    kept, drop = ct[inc], ct[~inc]
    r_keep = kept.dt.minute.isin([10, 40]).mean()
    r_drop = drop.dt.minute.isin([10, 40]).mean() if len(drop) else np.nan
    check(r_keep > r_drop, "dropped rows look like phantoms, not real games",
          f"kept on :10/:40 {100*r_keep:.1f}% vs dropped {100*r_drop:.1f}%")

    sj = D["game.id"].isin(S["game.id"]).mean()
    check(sj > 0.95, "standings join coverage", f"{100*sj:.1f}% of cache games")
    # A join that is complete in some seasons and empty in others is worse than a uniformly
    # incomplete one, because it silently makes a feature block season-specific.
    per = D.assign(hit=D["game.id"].isin(S["game.id"])).groupby("season")["hit"].mean()
    check(per.min() > 0.90, "standings join is not season-specific",
          " ".join(f"{int(s)}:{100*v:.0f}%" for s, v in per.items()))

    # ---------------------------------------------------------------- B. outcomes
    print("\nB. OUTCOMES REBUILT FROM RAW SCORES", flush=True)
    R = G.set_index("event_id").reindex(D["event_id"])
    hs, as_ = R["home_score"].to_numpy(float), R["away_score"].to_numpy(float)
    h1h, h1a = R["home_h1"].to_numpy(float), R["away_h1"].to_numpy(float)
    sp = pd.to_numeric(D["t60_spread_home_point"], errors="coerce").to_numpy(float)
    tot = pd.to_numeric(D["t60_total_point"], errors="coerce").to_numpy(float)

    def same(a, b, label, tol=1e-9):
        a, b = np.asarray(a, float), pd.to_numeric(b, errors="coerce").to_numpy(float)
        both = np.isfinite(a) & np.isfinite(b)
        bad = int((np.abs(a[both] - b[both]) > tol).sum())
        return check(bad == 0, label, f"{both.sum():,} comparable, {bad} disagree")

    same(hs, D["y_home_pts"], "y_home_pts == raw home_score")
    same(as_, D["y_away_pts"], "y_away_pts == raw away_score")
    same(hs - as_, D["y_fg_margin"], "y_fg_margin == home - away")
    same(hs + as_, D["y_fg_total"], "y_fg_total == home + away")
    same(h1h - h1a, D["y_h1_margin"], "y_h1_margin == h1 home - h1 away")
    # THE one that the sign bug lived next to. Residual is ADDITION: margin + posted line.
    same((hs - as_) + sp, D["y_fg_marg_resid"], "y_fg_marg_resid == margin + t60 spread")
    same((hs + as_) - tot, D["y_fg_tot_resid"], "y_fg_tot_resid == total - t60 total")

    # ---------------------------------------------------------------- C. prices
    print("\nC. PRICES", flush=True)
    pairs = [("spread", "t60_spread_home_price", "t60_spread_away_price"),
             ("total", "t60_total_over_price", "t60_total_under_price"),
             ("moneyline", "t60_ml_home_price", "t60_ml_away_price")]
    for lab, a, b in pairs:
        pa_, pb_ = dec(D[a]), dec(D[b])
        ok = np.isfinite(pa_) & np.isfinite(pb_)
        book = 1.0 / pa_[ok] + 1.0 / pb_[ok]
        check(bool(np.nanmedian(book) > 1.0) and bool(np.nanmedian(book) < 1.12),
              f"{lab} book sums to a plausible overround",
              f"median {np.nanmedian(book):.4f} on {ok.sum():,} games")
        check(bool(np.nanmin(pa_[ok]) >= 1.0) and bool(np.nanmax(pa_[ok]) < 40),
              f"{lab} prices are decimal and in range",
              f"[{np.nanmin(pa_[ok]):.2f}, {np.nanmax(pa_[ok]):.2f}]")

    # CALIBRATION ORACLE. Whatever y is paired with a price, the realised win rate must RISE with
    # that price's implied probability. This has power only where prices actually disperse: spread
    # and total are all ~-110, so the correlation there is noise and the check is skipped.
    hw = np.where(hs > as_, 1.0, np.where(hs < as_, 0.0, np.nan))
    hc = np.where((hs - as_) + sp > 0, 1.0, np.where((hs - as_) + sp < 0, 0.0, np.nan))
    ov = np.where((hs + as_) > tot, 1.0, np.where((hs + as_) < tot, 0.0, np.nan))
    for lab, y, pcol in (("moneyline", hw, "t60_ml_home_price"),
                         ("spread", hc, "t60_spread_home_price"),
                         ("total", ov, "t60_total_over_price")):
        p = dec(D[pcol])
        imp = 1.0 / p
        ok = np.isfinite(imp) & np.isfinite(y)
        span = 100 * (np.nanquantile(imp[ok], 0.99) - np.nanquantile(imp[ok], 0.01))
        r = np.corrcoef(imp[ok], y[ok])[0, 1]
        if span < 3.0:
            print(f"  [n/a ] {lab} calibration  --  implied span only {span:.1f} pts, "
                  f"no power (corr {r:+.3f})", flush=True)
        else:
            check(r > 0.10, f"{lab} calibration: win rate rises with implied prob",
                  f"corr {r:+.3f}, implied span {span:.0f} pts")

    # ---------------------------------------------------------------- D. as-of / leakage
    print("\nD. AS-OF CORRECTNESS", flush=True)
    # A pregame feature must correlate with the LINE at least as strongly as with the RESULT. A
    # column that saw the box score beats the line, because the line could not see it.
    marg = hs - as_
    feat = [c for c in D.columns
            if not c.startswith(("y_", "t60_", "t24_", "t4_", "open_", "c_"))
            and pd.api.types.is_numeric_dtype(D[c])
            and D[c].notna().mean() > 0.5 and D[c].nunique() > 5]
    rl = np.array([np.corrcoef(*_pair(D[c], -sp))[0, 1] for c in feat])
    rr = np.array([np.corrcoef(*_pair(D[c], marg))[0, 1] for c in feat])
    susp = [(feat[i], rl[i], rr[i]) for i in range(len(feat))
            if np.isfinite(rl[i]) and np.isfinite(rr[i])
            and abs(rr[i]) > abs(rl[i]) + 0.05 and abs(rr[i]) > 0.10]
    check(len(susp) == 0, "no column predicts the RESULT better than the LINE",
          f"{len(feat):,} screened, {len(susp)} suspicious"
          + ("" if not susp else "  ->  " + ", ".join(f"{n}({rl_:+.2f}/{rr_:+.2f})"
                                                      for n, rl_, rr_ in susp[:6])))

    # Per-team lag-1 autocorrelation. A rolling season-to-date or last-N feature carries over from a
    # team's previous game; a same-game realised stat does not. Sampled across families so the check
    # is cheap and still representative.
    fam = {}
    for c in feat:
        k = c.split("_")[0] + "_" + (c.split("_")[1] if "_" in c[len(c.split("_")[0]):] else "")
        fam.setdefault(k, c)
    # Not everything in the frame is rolling team state, and the ones that are not have no
    # business being tested for persistence. Rest days, this game's line movement, this
    # game's derivative prices and the team ids all legitimately look nothing like the same
    # team's last game -- rest in fact ANTI-correlates, since a back-to-back is followed by
    # a break. None of them can carry a box score, so skipping them costs the check nothing.
    def per_game(c):
        return ("sched_rest" in c or c.startswith(("mkt_", "mk_", "h1_"))
                or c in ("hid", "aid", "bdl_id", "h_tid", "a_tid"))

    samp = [c for c in list(fam.values())[:120] if not per_game(c)]
    if "hid" in D.columns and "aid" in D.columns:
        # A column has to be grouped by the team it DESCRIBES. The first version grouped
        # everything by hid, so every `a_*` column was being followed through the home
        # team's season -- an unrelated series, autocorr ~0 by construction, and the whole
        # away half of the frame reported as leaking. Diff/game-level columns have no
        # single owner; hid is as good a thread as any for them.
        lows = []
        for c in samp:
            away = c.startswith(("a_", "away_", "opp_")) or "_a_" in c
            tid = D["aid"] if away else D["hid"]
            z = pd.DataFrame({"date": D["date"], "tid": tid,
                              "v": pd.to_numeric(D[c], errors="coerce")})
            z = z.dropna(subset=["v"]).sort_values("date")
            if len(z) < 400:
                continue
            ac = z.groupby("tid")["v"].apply(lambda s: s.autocorr(1) if len(s) > 20 else np.nan)
            m = np.nanmean(ac)
            if np.isfinite(m) and m < 0.05:
                lows.append((c, m))
        check(len(lows) <= 2, "rolling features carry over between a team's games",
              f"{len(samp)} sampled, {len(lows)} with lag-1 autocorr < 0.05"
              + ("" if not lows else "  ->  " + ", ".join(f"{n}({v:+.2f})" for n, v in lows[:6])),
              warn_only=True)

    # The motivation block specifically: games played must be strictly BEFORE this game.
    Si = S.drop_duplicates("game.id").set_index("game.id")
    gp = pd.to_numeric(D["game.id"].map(Si["st_h_gp"]), errors="coerce")
    if "hid" in D.columns and "aid" in D.columns:
        # st_h_gp counts ALL of the home team's prior games. The first version compared it
        # against a cumcount over the cache's rows grouped by hid -- i.e. that team's prior
        # HOME games only, about half the true number -- and duly reported a +22 gap as if
        # the standings block were peeking at the future. Count both halves of the schedule.
        long = pd.concat([
            D[["season", "date", "event_id"]].assign(tid=D["hid"], side="h"),
            D[["season", "date", "event_id"]].assign(tid=D["aid"], side="a")],
            ignore_index=True)
        long["played"] = long.sort_values("date").groupby(["season", "tid"]).cumcount()
        o = (long[long["side"] == "h"].set_index("event_id")["played"]
             .reindex(D["event_id"]).to_numpy(float))
        o = pd.Series(o, index=D.index)
        ok = gp.notna() & o.notna()
        d_ = (gp[ok] - o[ok])
        # A LEAK IS ONE-SIDED: if st_h_gp counted tonight's game it would sit ABOVE the
        # prior-game count, always. What is actually here is a symmetric few-percent tail
        # in both directions -- standings-snapshot drift, plus games the odds feed never
        # listed so our own count runs low. So test the SIGN BALANCE, not the raw span.
        hi, lo = float((d_ >= 1).mean()), float((d_ <= -1).mean())
        check(bool(d_.median() == 0) and hi < lo + 0.02,
              "standings games-played is as-of, not after",
              f"{100*(d_ == 0).mean():.1f}% exact, ahead {100*hi:.1f}% vs behind "
              f"{100*lo:.1f}% (a leak would be one-sided high)", warn_only=True)

    # ---------------------------------------------------------------- E. coverage
    print("\nE. COVERAGE BY SEASON", flush=True)
    fams = {"motivation (st_*)": [c for c in S.columns if c.startswith("st_")],
            "travel (dm_trav_*)": [c for c in D.columns if c.startswith("dm_trav_")],
            "schedule (*_sched_*)": [c for c in D.columns if "_sched_" in c],
            "absences (*_abs_*)": [c for c in D.columns if "_abs_" in c],
            "adjusted (adj*/radj*)": [c for c in D.columns if c.startswith(("adj", "radj",
                                                                            "h_adj", "a_adj"))]}
    Dm = D.merge(Si, left_on="game.id", right_index=True, how="left", suffixes=("", "_st"))
    for lab, cols in fams.items():
        cols = [c for c in cols if c in Dm.columns]
        if not cols:
            print(f"  [n/a ] {lab}: no columns found", flush=True)
            continue
        per = Dm.groupby("season")[cols].apply(lambda x: x.notna().mean().mean())
        spread_ = per.max() - per.min()
        check(spread_ < 0.25, f"{lab} coverage is even across seasons",
              " ".join(f"{int(s)}:{100*v:.0f}%" for s, v in per.items()))

    # ---------------------------------------------------------------- F. market sanity
    print("\nF. DOES THE MARKET BEHAVE LIKE A MARKET", flush=True)
    ok = np.isfinite(sp) & np.isfinite(marg)
    r = np.corrcoef(-sp[ok], marg[ok])[0, 1]
    check(0.30 < r < 0.60, "posted spread correlates with the margin",
          f"corr {r:+.3f} (NBA sits near +0.45)")
    check(abs(100 * np.nanmean(hc) - 50) < 3, "home teams cover about half the time",
          f"{100*np.nanmean(hc):.1f}%")
    check(abs(100 * np.nanmean(ov) - 50) < 3, "overs hit about half the time",
          f"{100*np.nanmean(ov):.1f}%")
    check(abs(100 * np.nanmean(hw) - 55) < 4, "home teams win about 55%",
          f"{100*np.nanmean(hw):.1f}%")
    fav = np.where(sp < 0, hc, 1 - hc)
    check(abs(100 * np.nanmean(fav) - 50) < 3, "favourites cover about half the time",
          f"{100*np.nanmean(fav):.1f}%")
    hfa = -np.nanmean(sp)
    check(1.0 < hfa < 4.0, "posted home-field advantage is plausible",
          f"mean posted home line {np.nanmean(sp):+.2f} => HFA {hfa:.2f} pts")
    # The margin's own spread sets the ceiling on any spread model: a 13-point sd means a model has
    # to be worth ~1.5 points to move a 50% market to 52.4%.
    print(f"  [info] margin sd {np.nanstd(marg[ok]):.2f} pts | residual sd "
          f"{np.nanstd(((hs-as_)+sp)[ok]):.2f} pts | line sd {np.nanstd(sp[ok]):.2f} pts",
          flush=True)

    print("\n" + "=" * 78, flush=True)
    if NOTES:
        print("WARNINGS (not fatal, but read them):", flush=True)
        for n in NOTES:
            print(f"  - {n}", flush=True)
    if FAILS:
        print(f"{len(FAILS)} CHECK(S) FAILED: " + "; ".join(FAILS), flush=True)
        sys.exit(1)
    print("ALL CHECKS PASSED", flush=True)


def _pair(a, b):
    a = pd.to_numeric(a, errors="coerce").to_numpy(float)
    b = np.asarray(b, float)
    m = np.isfinite(a) & np.isfinite(b)
    if m.sum() < 100 or np.nanstd(a[m]) == 0:
        return np.array([0.0, 1.0]), np.array([0.0, 1.0])
    return a[m], b[m]


if __name__ == "__main__":
    main()
