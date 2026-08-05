#!/usr/bin/env python3
"""The weird line: a player is hot and the book CUTS his number (or cold and the book RAISES it).

THE OWNER'S QUESTION. A guy goes over three straight and then tonight's line comes in BELOW his
recent average. Nobody betting the over is going to understand why -- it looks like the book handed
out free money. The claim under test is that it is not free, that a line moving against a player's
own form is the book pricing something the box score does not show yet (minutes, a returning
teammate, a role change, a nagging injury), and that the side to take is the LINE, not the form.
And the mirror: cold player, line goes UP, the under looks free, take the over.

TWO WAYS TO SAY "THE LINE MOVED AGAINST HIM", AND THEY ARE NOT THE SAME SPOT.

  vs_form      gap = line - avg5.       Where the number sits against his recent scoring.
  vs_prev_line gap = line - prev_line.  Whether the book actually CUT him off his own last number.

`vs_form` is badly entangled with the selection: picking "went over three straight" drags avg5 up
by construction, so a hot player faces a below-average line whether or not the book did anything.
`vs_prev_line` is the literal reading of the question and is far cleaner -- the previous posted line
is not a mechanical function of the streak. Both are run; the second is the one to believe.

WHY THIS IS NOT THE BLIND SWEEP THE STANDING RULE FORBIDS ([[nba-blind-sweep-fails]]). The spot is
pre-registered in words before any number is computed, it has a stated mechanism, and it is
adjudicated on the SHAPE of a dose-response curve, on agreement across 3 seasons, and on a pooled
cell -- never on the best cell in the grid. The argmax is not reported as a finding.

BASELINES. A directional rule on a fixed row set IS the blind bet on that slice, so its ROI cannot
be scored against the blind on those same rows -- that comparison is 0 by construction, the
degenerate baseline documented in [[nba-player-props-originator]]. Every cell is instead scored
against that side's UNCONDITIONAL rate across the whole market, which is the question that matters:
does this filter select?

usage: python3 nba_props_streaks.py [--markets a,b] [--venue best]
"""
import argparse
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nba_props_originator import grade
from nba_props_report import md

ROOT = os.path.dirname(os.path.abspath(__file__))
PRED = os.path.join(ROOT, "data", "parquet", "_props_preds")
DOC = os.path.join(ROOT, "NBA_PROPS_STREAKS.md")

# blocks and steals are excluded: every line is 0.5, so "the line moved off his recent average" has
# no room to mean anything, and the owner has already called them low-volume.
MARKETS = ["player_points", "player_points_rebounds_assists", "player_points_rebounds",
           "player_points_assists", "player_rebounds", "player_assists",
           "player_rebounds_assists", "player_threes"]

RUN = 3            # consecutive prior overs (or unders) that define "hot" / "cold"
MAX_LAYOFF = 10    # days; a "previous line" from three weeks ago is not the book reacting to him
MIN_N = 60

# (pattern, streak column, sign that makes the gap "against him", line side, form side)
PATTERNS = [("hot-cheap", "run_over", -1, "under", "over"),
            ("cold-rich", "run_under", +1, "over", "under")]
GAPDEFS = ["vs_prev_line", "vs_form"]
THETAS = {"vs_prev_line": [0.0, 0.5, 1.0, 1.5, 2.0, 2.5],
          "vs_form": [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0]}


def sigma(n, p, dec):
    """One sigma of ROI in points. Quoted next to every delta so a reader can size it."""
    if n < 1 or not np.isfinite(p) or not np.isfinite(dec):
        return np.nan
    return 100 * np.sqrt(max(p, 1e-9) * max(1 - p, 1e-9)) * dec / np.sqrt(n)


def trailing_run(s):
    """Length of the run of 1s ending at each position, on an ALREADY-SHIFTED series.

    Reset-on-zero cumsum. NaNs (pushes, ungraded games) break the run, which is the conservative
    reading -- an ungraded game is not evidence the streak continued.
    """
    v = s.fillna(0).astype(float)
    return v.groupby((v <= 0).cumsum()).cumsum()


def prep(mk):
    R = pd.read_parquet(os.path.join(PRED, f"{mk}.parquet"))
    R = R.sort_values(["pkey", "season_x", "date"]).reset_index(drop=True)
    g = R.groupby(["pkey", "season_x"], sort=False)

    # shift(1) FIRST, then roll, and inside a season -- eight months and a new roster is not
    # "he has been hot".
    R["avg5"] = g["actual"].transform(lambda s: s.shift(1).rolling(5, min_periods=5).mean())
    R["sd10"] = g["actual"].transform(lambda s: s.shift(1).rolling(10, min_periods=6).std())
    R["prev_line"] = g["cons_line"].transform(lambda s: s.shift(1))
    R["layoff"] = (R["date"] - g["date"].transform(lambda s: s.shift(1))).dt.days

    y = g["y_cons"].transform(lambda s: s.shift(1))
    R["run_over"] = trailing_run(y)
    R["run_under"] = trailing_run(1 - y)
    R.loc[g.cumcount() == 0, ["run_over", "run_under"]] = 0

    R["vs_form"] = R["cons_line"] - R["avg5"]
    R["vs_prev_line"] = (R["cons_line"] - R["prev_line"]).where(R["layoff"] <= MAX_LAYOFF)
    R["z_form"] = R["vs_form"] / R["sd10"]
    R["z_prev_line"] = R["vs_prev_line"] / R["sd10"]
    R["ok"] = (R["y_cons"].notna() & R["avg5"].notna()
               & R["y_best_over"].notna() & R["y_best_under"].notna())
    R["edge"] = (R["lgbm"] - R["cons_line"]).abs()
    R["model_over"] = R["lgbm"] > R["cons_line"]
    return R


def cell(R, mask, side, venue):
    """(n, win%, roi, dec, need) for betting one fixed side on the masked rows."""
    return grade(R, mask, pd.Series(side == "over", index=R.index), venue, price=True)


def seasons(R, mask, side, venue):
    out = []
    for s in sorted(R["season_x"].dropna().unique()):
        n, w, r, _, _ = cell(R, mask & (R["season_x"] == s), side, venue)
        out.append("%.1f" % r if n >= 25 else "-")
    return "/".join(out)


def oracle(R, venue):
    """Feed the realised result into the bet rule; it must win ~100%. [[grading-sign-oracle-check]]

    One sign flip inverted every NBA spread bet once and produced three wrong verdicts, so nothing
    below is believed until this asserts.
    """
    yo = "y_best_over" if venue == "best" else "y_cons"
    n, w, r, _, _ = grade(R, R["ok"], R[yo] == 1, venue, price=True)
    assert w > 99.0, f"oracle failed: {w:.2f}% -- the grader is inverted somewhere"
    return n, w


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--markets", default=",".join(MARKETS))
    ap.add_argument("--venue", default="best")
    a = ap.parse_args()
    mks = [m for m in a.markets.split(",") if m]
    V = a.venue

    D = {mk: prep(mk) for mk in mks}
    on, ow = oracle(D[mks[0]], V)

    # ---------- 1. how often the spot happens ----------
    freq = []
    for mk, R in D.items():
        o = R["ok"]
        row = dict(market=mk.replace("player_", ""), rows=int(o.sum()),
                   med_line=R.loc[o, "cons_line"].median())
        for pat, rc, sgn, _, _ in PATTERNS:
            st = o & (R[rc] >= RUN)
            row[f"{pat.split('-')[0]}_pct"] = 100 * st.sum() / max(o.sum(), 1)
            for gd in GAPDEFS:
                row[f"{pat.split('-')[0]}_{gd}_mean"] = R.loc[st, gd].mean()
                row[f"{pat.split('-')[0]}_{gd}_n1"] = int((st & (R[gd] * sgn >= 1.0)).sum())
        freq.append(row)
    FREQ = pd.DataFrame(freq)

    # ---------- 2. the 2x2 -- is "both" more than either parent, on EITHER side ----------
    dec2 = []
    for mk, R in D.items():
        o = R["ok"]
        for pat, rc, sgn, line_side, form_side in PATTERNS:
            for gd in GAPDEFS:
                have = o & R[gd].notna()
                streak = have & (R[rc] >= RUN)
                gapm = have & (R[gd] * sgn >= 1.0)
                both = streak & gapm
                if both.sum() < MIN_N:
                    continue
                row = dict(market=mk.replace("player_", ""), pattern=pat, gapdef=gd)
                for lab, sd in [("line", line_side), ("form", form_side)]:
                    bn, bw, br, bd, _ = cell(R, have, sd, V)
                    row[f"{lab}_market"] = br
                    for nm, m in [("streak", streak), ("gap", gapm), ("both", both)]:
                        n, w, r, _, _ = cell(R, m, sd, V)
                        row[f"{lab}_{nm}"] = r
                    row[f"{lab}_lift"] = row[f"{lab}_both"] - br
                row["both_n"] = int(both.sum())
                row["one_sigma"] = sigma(both.sum(), 0.5, 1.87)
                dec2.append(row)
    DEC = pd.DataFrame(dec2)

    # ---------- 3. dose-response: walk the gap with the streak held fixed ----------
    dose = []
    for mk, R in D.items():
        o = R["ok"]
        for pat, rc, sgn, line_side, form_side in PATTERNS:
            for gd in GAPDEFS:
                streak = o & R[gd].notna() & (R[rc] >= RUN)
                for th in THETAS[gd]:
                    m = streak & (R[gd] * sgn >= th)
                    if m.sum() < MIN_N:
                        continue
                    n, w, r, d, need = cell(R, m, line_side, V)
                    nf, wf, rf, _, _ = cell(R, m, form_side, V)
                    dose.append(dict(market=mk.replace("player_", ""), pattern=pat, gapdef=gd,
                                     theta=th, n=n, need=need,
                                     roi_line=r, line_szn=seasons(R, m, line_side, V),
                                     roi_form=rf, form_szn=seasons(R, m, form_side, V)))
    DOSE = pd.DataFrame(dose)

    # ---------- 4. pooled across markets on the volatility-scaled gap ----------
    pool = []
    for pat, rc, sgn, line_side, form_side in PATTERNS:
        for gd in GAPDEFS:
            zc = "z_prev_line" if gd == "vs_prev_line" else "z_form"
            for th in [0.0, 0.25, 0.5, 0.75, 1.0]:
                frames = []
                for mk, R in D.items():
                    m = R["ok"] & (R[rc] >= RUN) & R[zc].notna() & (R[zc] * sgn >= th)
                    if m.sum():
                        S = R[m].copy()
                        S["mk"] = mk
                        frames.append(S)
                if not frames:
                    continue
                P = pd.concat(frames, ignore_index=True)
                P["ok"] = True
                n, w, r, d, need = cell(P, P["ok"], line_side, V)
                nf, wf, rf, _, _ = cell(P, P["ok"], form_side, V)
                if n < MIN_N:
                    continue
                pool.append(dict(pattern=pat, gapdef=gd, z_theta=th, n=n, need=need,
                                 roi_line=r, line_szn=seasons(P, P["ok"], line_side, V),
                                 roi_form=rf, form_szn=seasons(P, P["ok"], form_side, V),
                                 one_sigma=sigma(n, wf / 100 if np.isfinite(wf) else .5, d)))
    POOL = pd.DataFrame(pool)

    # ---------- 4b. pooled 2x2, and de-duplicated to one ticket per player-game ----------
    # Two things the pooled table above cannot answer. First: at a z threshold, is "both" beating
    # its parents, or is the streak decoration on a gap rule? Second, and worse: the eight markets
    # are not eight bets. PRA = pts+reb+ast and three of the others are sub-sums, so one player-game
    # can appear four times and inflate n fourfold with near-duplicate rows
    # ([[derived-market-gating-law]]). DEDUP keeps ONE ticket per player-game, preferring the
    # biggest line, which is also the ticket the verdict already tells you to bet.
    PRIORITY = {m: i for i, m in enumerate(
        ["player_points_rebounds_assists", "player_points_rebounds", "player_points_assists",
         "player_points", "player_rebounds_assists", "player_rebounds", "player_assists",
         "player_threes"])}

    def stack(rc, zc, sgn, th, need_streak, need_gap):
        frames = []
        for mk, R in D.items():
            m = R["ok"] & R[zc].notna()
            if need_streak:
                m &= R[rc] >= RUN
            if need_gap:
                m &= R[zc] * sgn >= th
            if m.sum():
                S = R[m].copy()
                S["mk"] = mk
                S["prio"] = PRIORITY.get(mk, 99)
                frames.append(S)
        if not frames:
            return None
        P = pd.concat(frames, ignore_index=True)
        P["ok"] = True
        return P

    pooldec, dedup = [], []
    for pat, rc, sgn, line_side, form_side in PATTERNS:
        for gd in GAPDEFS:
            zc = "z_prev_line" if gd == "vs_prev_line" else "z_form"
            for th in [0.25, 0.5, 0.75]:
                row = dict(pattern=pat, gapdef=gd, z_theta=th)
                for nm, ns, ng in [("streak", True, False), ("gap", False, True),
                                   ("both", True, True)]:
                    P = stack(rc, zc, sgn, th, ns, ng)
                    if P is None:
                        continue
                    row[f"{nm}_n"] = int(len(P))
                    for lab, sd in [("line", line_side), ("form", form_side)]:
                        row[f"{nm}_{lab}"] = cell(P, P["ok"], sd, V)[2]
                if "both_n" in row:
                    pooldec.append(row)

                B = stack(rc, zc, sgn, th, True, True)
                if B is None or len(B) < MIN_N:
                    continue
                U = B.sort_values("prio").drop_duplicates(["date", "pkey"]).reset_index(drop=True)
                U["ok"] = True
                n, w, r, d, need = cell(U, U["ok"], form_side, V)
                nl, wl, rl, _, _ = cell(U, U["ok"], line_side, V)
                if n < 40:
                    continue
                dedup.append(dict(pattern=pat, gapdef=gd, z_theta=th, stacked_n=len(B),
                                  unique_n=n, dupe_factor=len(B) / max(len(U), 1), win=w,
                                  need=need, roi_form=r, form_szn=seasons(U, U["ok"], form_side, V),
                                  roi_line=rl, one_sigma=sigma(n, w / 100 if np.isfinite(w) else .5, d),
                                  players=U["pkey"].nunique()))
    POOLDEC, DEDUP = pd.DataFrame(pooldec), pd.DataFrame(dedup)

    # ---------- 5. does the originator model already know? ----------
    orth = []
    for mk, R in D.items():
        o = R["ok"] & R["lgbm"].notna()
        for pat, rc, sgn, line_side, form_side in PATTERNS:
            for gd in GAPDEFS:
                m = o & R[gd].notna() & (R[rc] >= RUN) & (R[gd] * sgn >= 1.0)
                if m.sum() < MIN_N:
                    continue
                # score the side the dose curve favours: whichever the market-wide result says
                for lab, sd in [("line", line_side), ("form", form_side)]:
                    want = sd == "over"
                    ag = m & (R["model_over"] == want)
                    ds = m & (R["model_over"] != want)
                    na, wa, ra, _, _ = cell(R, ag, sd, V)
                    nd, wd, rd, _, _ = cell(R, ds, sd, V)
                    orth.append(dict(market=mk.replace("player_", ""), pattern=pat, gapdef=gd,
                                     side=lab, n=int(m.sum()),
                                     agrees_pct=100 * ag.sum() / max(m.sum(), 1),
                                     agree_n=na, agree_roi=ra, disagree_n=nd, disagree_roi=rd))
    ORTH = pd.DataFrame(orth)

    # ---------- 6. concentration ----------
    conc = []
    for mk, R in D.items():
        for pat, rc, sgn, line_side, form_side in PATTERNS:
            for gd in GAPDEFS:
                m = R["ok"] & R[gd].notna() & (R[rc] >= RUN) & (R[gd] * sgn >= 1.0)
                if m.sum() < MIN_N:
                    continue
                for lab, sd in [("line", line_side), ("form", form_side)]:
                    S = R[m].copy()
                    is_over = sd == "over"
                    yv = S["y_best_over"] if is_over else S["y_best_under"]
                    dc = S["best_over_dec"] if is_over else S["best_under_dec"]
                    # BOTH y_best_* columns are coded "did it go OVER", so the under leg needs the
                    # 1-y flip. Omitting it inverts half the book and reads as a huge fake loss.
                    win = yv if is_over else (1 - yv)
                    gd_ok = dc.notna() & win.notna()
                    S, win, dc = S[gd_ok], win[gd_ok].to_numpy(), dc[gd_ok].to_numpy()
                    S["u"] = win * (dc - 1) - (1 - win)
                    ref = cell(R, m, sd, V)[2]
                    # asserted against grade(): dropping the flip on an under leg silently inverts
                    # half the book, and that exact bug has fired once already on this project
                    assert abs(100 * S["u"].mean() - ref) < 0.05, \
                        f"{mk}/{pat}/{gd}/{lab}: hand {100*S['u'].mean():.2f} != grade {ref:.2f}"
                    per = S.groupby("pkey")["u"].agg(["count", "mean"])
                    best = per["mean"].idxmax()
                    conc.append(dict(market=mk.replace("player_", ""), pattern=pat, gapdef=gd,
                                     side=lab, n=len(S), roi=100 * S["u"].mean(),
                                     players=len(per),
                                     top10_pct=100 * per["count"].nlargest(10).sum() / len(S),
                                     drop_best=100 * S.loc[S["pkey"] != best, "u"].mean()))
    CONC = pd.DataFrame(conc)

    doc = f"""# NBA props — the line that moves against the player's own form

`nba_props_streaks.py`. **Regenerated wholesale; do not edit — put conclusions in
`NBA_PROPS_VERDICT.md`.**

The spot, stated in words before anything was computed: a player clears his number **{RUN} straight
games** and tonight the book posts a number that has moved DOWN on him — or he misses {RUN}
straight and the book moves it UP. Either way the line looks wrong to anyone reading his box
scores, and the question is whether the book is telling you something.

**Two readings of "the line moved against him", and they are different spots:**

| gapdef | definition | what it means |
|---|---|---|
| `vs_prev_line` | `line − his previous posted line` | did the book actually CUT him. **The literal question, and the clean one.** |
| `vs_form` | `line − his last-5 average` | where the number sits against his recent scoring. Entangled: a hot streak raises `avg5` by construction. |

**Two sides, both graded on every cell:**

- **`roi_line`** — side WITH the line. Under on hot-cheap, over on cold-rich. The "book knows" read.
- **`roi_form`** — side WITH the player's form. Over on hot, under on cold. What it looks like it offers.

`*_market` is that same side bet blind on every row of the market — the only honest reference for a
row filter, since betting one fixed side on a slice IS the blind bet on that slice. Venue `{V}`,
T-60 prices, {len(mks)} markets, 3 seasons. Everything is `shift(1)`-then-roll, inside a season, and
`vs_prev_line` additionally requires the previous game within {MAX_LAYOFF} days.

**Grader oracle:** feeding the realised result into the bet rule returns **{ow:.2f}%** over
{on:,} rows. Signs are not inverted.

## 1. How often the spot happens

{md(FREQ)}

Read the `vs_form_mean` columns first — they are the mechanical part. A hot player's line already
sits below his 5-game average on average, before the book does anything unusual, purely because the
streak is what raised the average. `vs_prev_line_mean` is the honest measure of what the book did.

## 2. Is "both" more than either parent?

Streak alone (≥{RUN}), gap alone (≥1.0 stat unit, no streak required), and both. Both sides shown.

{md(DEC)}

## 3. Dose–response, streak held fixed

`theta` = how far the line has to have moved against him, in stat units. **A real threshold effect
is a slope.** If the money appears at one theta only it is an argmax, not a finding. Season strings
are in slate order.

{md(DOSE)}

## 4. Pooled across markets, gap scaled by the player's own volatility

`z = gap / sd10`. Scaling matters: 2 points off a 30-point line and 2 rebounds off a 5-rebound line
are not the same event, and pooling raw gaps would let the points market write the answer.

{md(POOL)}

## 4b. The pooled 2×2, and the duplicate-ticket problem

Same z thresholds, decomposed. `both` has to beat `streak` and `gap` or the streak is decoration.

{md(POOLDEC)}

And the sample above is **not** what it looks like. PRA = points + rebounds + assists and three
other markets are sub-sums of it, so a single player-game can appear four times as four
near-identical rows ([[derived-market-gating-law]]). `DEDUP` keeps ONE ticket per player-game,
preferring the biggest line — which is also the ticket `NBA_PROPS_VERDICT.md` §6 already says to
bet. `dupe_factor` is how much the stacked count was overstating the bet count.

{md(DEDUP)}

## 5. Does the originator model already know this?

Rows in the ≥1.0 spot, split by whether the model independently takes that side.

{md(ORTH)}

If the money lives only in `agree`, this is the model restated, not a new signal.

## 6. Concentration — is it six players?

{md(CONC)}

Units recomputed by hand and **asserted against `grade()`** before printing.
"""
    open(DOC, "w").write(doc)
    print(f"wrote {DOC}\n", flush=True)
    for nm, t in [("FREQ", FREQ), ("2x2", DEC), ("DOSE", DOSE), ("POOL", POOL),
                  ("ORTH", ORTH), ("CONC", CONC)]:
        print(f"===== {nm} =====", flush=True)
        print(t.to_string(index=False, float_format="%.2f"), flush=True)
        print("", flush=True)


if __name__ == "__main__":
    main()
