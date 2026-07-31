#!/usr/bin/env python3
"""The one cell that survived the RAPM leak audit, put under adversarial control.

THE RULE, stated before any of the controls below were run:

    For each team, value the rotation players (>=16 prior min/game) who are out TONIGHT and
    were also out LAST GAME, in RAPM margin points per 48, weighted by their share of the
    team's rotation minutes. Call that the team's OUT value. Take the side whose OPPONENT
    is missing more:  gap = away_out - home_out  ->  bet HOME when gap > 0.

    Market: the FIRST-HALF spread. Not the full game.

WHY DURABLE-ONLY. A player out tonight who also sat last game is public knowledge days
ahead, so the bet is placeable at the T-60 close. Same-day scratches are deliberately
treated as PRESENT -- the conservative error. This is also what makes the rule survive the
leak that killed the full model: the raw count of players who did not play is over half
determined by the final margin (corr(|margin|, #DNP) = -0.50) because blowouts empty both
benches. Requiring >=16 prior minutes drives that to -0.004.

WHY THE FIRST HALF, pre-registered in nba_player_ceiling.py before any of this data
existed: starters take ~90% of first-half minutes against ~65% of full-game minutes, and
the book prices the 1H line as a fraction of the FG line rather than re-deriving it from
tonight's rotation. A missing starter therefore hits the half harder than the book's ratio
assumes. That prediction FAILED on box-score aggregates and is being retested here on
impact data, which is the entire reason the stint/RAPM layer was built.

CONTROLS RUN HERE, any one of which can kill it:
  placebo      the gap permuted across games within season -- the real zero
  naive side   the same bet count taken blindly on the favoured side, in-subset
  open line    graded against the OPENER as well as T-60; a signal known days ahead must
               work at both, and a rule that only works at the close is a CLV artifact
  both-out     restricted to games where BOTH teams are missing someone, which removes
               "this is just the healthier team" as an explanation
  FG control   the same rule on the full-game spread, which should be WEAKER if the
               mechanism is real and EQUAL if this is generic injury information
  season split every threshold reported per season, never pooled alone
"""
import glob
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(11)
BOOT = 5000


def to_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    return np.where((a >= 1.01) & (a <= 40.0), a,
                    np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a)))


def load():
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    F = F[~F["game.id"].duplicated(keep=False)].copy()
    A = pd.read_parquet(f"{OUT}/nba_rapm_team_agg.parquet")
    B = pd.concat([pd.read_parquet(f, columns=["game_id", "team_id", "home_away"])
                   for f in sorted(glob.glob(f"{ROOT}/data/raw/nba_pbp/player_box_*.parquet"))],
                  ignore_index=True).drop_duplicates(["game_id", "team_id"])
    A = A.merge(B, on=["game_id", "team_id"], how="left")
    cols = ["dur_out_m", "dur_out_t", "dur_out_min", "dur_out_n"]
    H = A[A["home_away"] == "home"][["game.id"] + cols].rename(
        columns={c: f"h_{c}" for c in cols})
    V = A[A["home_away"] == "away"][["game.id"] + cols].rename(
        columns={c: f"a_{c}" for c in cols})
    d = F.merge(H, on="game.id", how="inner").merge(V, on="game.id", how="inner")
    # positive gap = the AWAY team is the more depleted one, so the bet is on HOME
    d["gap"] = d["a_dur_out_m"] - d["h_dur_out_m"]
    return d


def evaluate(d, gap, ycol, ph, pl, thr):
    y = d[ycol].to_numpy(dtype=float)
    m = np.isfinite(y) & np.isfinite(gap) & (y != 0) & (np.abs(gap) >= thr)
    if m.sum() < 40:
        return None
    hi = gap[m] > 0
    win = np.where(hi, y[m] > 0, y[m] < 0)
    dec = np.where(hi, to_dec(d[ph])[m], to_dec(d[pl])[m])
    return {"n": int(m.sum()), "win": win, "roi": np.where(win, dec - 1.0, -1.0),
            "base": max((y[m] > 0).mean(), (y[m] < 0).mean()),
            "home_pct": hi.mean(), "season": d["season"].to_numpy()[m]}


def line(tag, r):
    if r is None:
        return f"| {tag} | — | | | | |"
    per = " ".join(f"{s}:{100*r['win'][r['season'] == s].mean():.0f}/"
                   f"{(r['season'] == s).sum()}" for s in sorted(set(r["season"])))
    return (f"| {tag} | {r['n']:,} | {100*r['win'].mean():.1f} | {100*r['base']:.1f} | "
            f"{100*r['roi'].mean():+.1f} | {per} |")


def main():
    d = load()
    gap = d["gap"].to_numpy(dtype=float)
    L = [__doc__.split("\n")[0], "",
         "Rule: value each team's DURABLE absences (out tonight and last game, >=16 prior "
         "min/game) in RAPM margin points per 48; back the side whose opponent is more "
         "depleted. Every win % sits next to the baseline of ITS OWN slice.", ""]

    MKT = {"1H spread": ("y_h1_marg_resid", "t60_spread_home_price",
                         "t60_spread_away_price"),
           "FG spread": ("y_fg_marg_resid", "t60_spread_home_price",
                         "t60_spread_away_price")}

    L += ["## Headline — 1H spread vs the full game", "",
          "If the mechanism (starters own the first half; the book prices 1H as a ratio "
          "of FG) is real, 1H must beat FG. If they are equal, this is generic injury "
          "information and the 1H story is decoration.", "",
          "| market / min gap | n | win % | slice base % | ROI % | by season |",
          "|---|---|---|---|---|---|"]
    for mk, (ycol, ph, pl) in MKT.items():
        for thr in (0.5, 1.0, 1.5, 2.0, 2.5):
            L.append(line(f"{mk} ≥{thr}", evaluate(d, gap, ycol, ph, pl, thr)))

    # ---- placebo -----------------------------------------------------------------
    L += ["", "## Placebo — the gap permuted within season", "",
          "| market / min gap | n | win % | slice base % | ROI % | by season |",
          "|---|---|---|---|---|---|"]
    pg = gap.copy()
    for s in d["season"].unique():
        idx = np.where(d["season"].to_numpy() == s)[0]
        pg[idx] = RNG.permutation(gap[idx])
    for mk, (ycol, ph, pl) in MKT.items():
        for thr in (1.0, 1.5):
            L.append(line(f"{mk} ≥{thr} PLACEBO", evaluate(d, pg, ycol, ph, pl, thr)))

    # ---- opener --------------------------------------------------------------------
    # A signal that is knowable days in advance must also beat the OPENING line. A rule
    # that works only at the close is capturing line movement, not the outcome.
    L += ["", "## Graded against the OPENER instead of T-60", "",
          "The absence is public days ahead, so the bet is placeable at the open. If the "
          "edge exists only at the close it is a CLV artifact, not a forecast.", "",
          "| market / min gap | n | win % | slice base % | ROI % | by season |",
          "|---|---|---|---|---|---|"]
    d["y_fg_open"] = d["y_fg_margin"] + d["open_spread_home_point"]
    # the 1H opener is not captured separately, so only the full game can be re-graded
    for thr in (1.0, 1.5, 2.0):
        L.append(line(f"FG spread ≥{thr} (open)",
                      evaluate(d, gap, "y_fg_open", "open_spread_home_price",
                               "open_spread_away_price", thr)))

    # ---- both teams depleted -------------------------------------------------------
    L += ["", "## Both teams missing someone", "",
          "Removes 'this is just the healthier team' as the explanation: every game here "
          "has absences on both sides, so only the RAPM VALUATION of them differs.", "",
          "| market / min gap | n | win % | slice base % | ROI % | by season |",
          "|---|---|---|---|---|---|"]
    both = (d["h_dur_out_n"] > 0) & (d["a_dur_out_n"] > 0)
    db = d[both].reset_index(drop=True)
    gb = db["gap"].to_numpy(dtype=float)
    for mk, (ycol, ph, pl) in MKT.items():
        for thr in (0.5, 1.0):
            L.append(line(f"{mk} ≥{thr} both-out", evaluate(db, gb, ycol, ph, pl, thr)))

    # ---- home/away balance and bootstrap -------------------------------------------
    r = evaluate(d, gap, "y_h1_marg_resid", "t60_spread_home_price",
                 "t60_spread_away_price", 1.0)
    bs = RNG.choice(r["win"], size=(BOOT, r["n"]), replace=True).mean(axis=1)
    L += ["", "## Headline cell in detail — 1H spread, gap ≥ 1.0", "",
          f"- n = {r['n']:,}, win {100*r['win'].mean():.1f}%, slice base "
          f"{100*r['base']:.1f}%, ROI {100*r['roi'].mean():+.1f}%",
          f"- bets HOME {100*r['home_pct']:.0f}% of the time, so this is not a disguised "
          f"home-team rule",
          f"- bootstrap 5th pct {100*np.quantile(bs, .05):.1f}%, 95th "
          f"{100*np.quantile(bs, .95):.1f}%, breakeven 52.4%",
          f"- P(win% <= breakeven) = {100*(bs <= 0.524).mean():.1f}%", ""]

    path = os.path.join(ROOT, "NBA_OUT_SIGNAL_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
