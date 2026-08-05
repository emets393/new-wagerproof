#!/usr/bin/env python3
"""Confirm or kill the one cell that survived `nba_props_streaks.py`.

THE SURVIVOR. Player has gone UNDER {RUN} straight, the book RAISES his line by >= 0.75 of his own
game-to-game standard deviation, and you bet the UNDER anyway -- with his cold form, against the
direction the book just moved. One ticket per player-game, biggest line. It came in at +6.60% over
598 bets, 60.9% against a 56.5% breakeven, positive in 3/3 seasons, across 290 distinct players.
Its two parents both LOSE (streak alone -1.12, gap alone -1.03), which is the interaction shape.

Nothing above is believed yet. Six ways to kill it, and it has to survive all of them:

  A  STREAK LENGTH is not an argmax. Walk RUN 2..5. A real effect strengthens or holds; it does not
     live only at exactly 3.
  B  THE SURFACE is a ridge, not a pixel. The full RUN x z grid, printed whole.
  C  IT IS NOT THE LINE-SCALE RULE WE ALREADY OWN. `NBA_PROPS_VERDICT.md` section 7 already pays
     +9.90 on PRA >= 30.5 with no other filter. A matched-count cut on line size alone is the
     control; if it scores the same, this is that rule wearing a costume.
  D  IT WORKS AT BOTH ENDS OF THE LINE LADDER. Split the cell by line size. If the money is only in
     the big-line half it IS C.
  E  THE FALSIFIER, AND THE MOST IMPORTANT ONE. The claim is specifically that the book RAISED him.
     So run the mirror: same cold streak, book CUT him by the same z. If the under pays there too,
     the finding is "cold players go under when their line moves at all" -- a volatility effect --
     and the raise is irrelevant.
  F  THE MODEL DOES NOT ALREADY OWN IT. Split by whether the originator independently says under.

usage: python3 nba_props_streaks_confirm.py
"""
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nba_props_originator import grade
from nba_props_report import md
from nba_props_streaks import MARKETS, MAX_LAYOFF, cell, prep, seasons, sigma

ROOT = os.path.dirname(os.path.abspath(__file__))
DOC = os.path.join(ROOT, "NBA_PROPS_STREAKS_CONFIRM.md")
V = "best"
Z0 = 0.75
RUN0 = 3

PRIORITY = {m: i for i, m in enumerate(
    ["player_points_rebounds_assists", "player_points_rebounds", "player_points_assists",
     "player_points", "player_rebounds_assists", "player_rebounds", "player_assists",
     "player_threes"])}


def stacked(D):
    """All eight markets in one frame, with the dedupe key and priority attached."""
    out = []
    for mk, R in D.items():
        S = R[R["ok"]].copy()
        S["mk"] = mk
        S["prio"] = PRIORITY.get(mk, 99)
        out.append(S)
    P = pd.concat(out, ignore_index=True)
    P["ok"] = True
    return P


def dedupe(P, mask):
    """One ticket per player-game, biggest line preferred. Returns a frame with ok=True."""
    U = P[mask].sort_values("prio").drop_duplicates(["date", "pkey"]).reset_index(drop=True)
    U["ok"] = True
    return U


def score(U, side="under"):
    n, w, r, d, need = cell(U, U["ok"], side, V)
    return dict(n=n, win=w, need=need, roi=r,
                one_sigma=sigma(n, w / 100 if np.isfinite(w) else .5, d),
                seasons=seasons(U, U["ok"], side, V))


def main():
    D = {mk: prep(mk) for mk in MARKETS}
    P = stacked(D)
    P["line_pct"] = P.groupby("mk")["cons_line"].rank(pct=True)

    cold = P["run_under"] >= RUN0
    zc = P["z_prev_line"]

    # ---------- A. streak length is not an argmax ----------
    A = []
    for run in [2, 3, 4, 5]:
        for z in [0.5, 0.75]:
            U = dedupe(P, (P["run_under"] >= run) & (zc >= z) & zc.notna())
            if len(U) < 40:
                continue
            A.append(dict(run=run, z=z, **score(U)))
    A = pd.DataFrame(A)

    # ---------- B. the whole surface ----------
    B = []
    for run in [1, 2, 3, 4, 5]:
        row = {"run": run}
        for z in [0.0, 0.25, 0.5, 0.75, 1.0]:
            U = dedupe(P, (P["run_under"] >= run) & (zc >= z) & zc.notna())
            s = score(U)
            row[f"z{z}"] = s["roi"] if s["n"] >= 40 else np.nan
            row[f"n{z}"] = s["n"]
        B.append(row)
    B = pd.DataFrame(B)

    # ---------- C. matched-count control on line size alone ----------
    sig = dedupe(P, cold & (zc >= Z0) & zc.notna())
    N = len(sig)
    pool = dedupe(P, P["ok"])
    ctl = pool.nlargest(N, "line_pct")
    ctl = ctl.reset_index(drop=True)
    ctl["ok"] = True
    C = pd.DataFrame([dict(rule="cold + book raised (the signal)", **score(sig)),
                      dict(rule=f"top-{N} by line size alone (control)", **score(ctl)),
                      dict(rule="every row, blind under (market)", **score(pool))])

    # ---------- D. does it work at both ends of the line ladder ----------
    Dd = []
    for lab, lo, hi in [("small lines (bottom half)", 0.0, 0.5), ("big lines (top half)", 0.5, 1.01)]:
        U = dedupe(P, cold & (zc >= Z0) & zc.notna()
                   & (P["line_pct"] >= lo) & (P["line_pct"] < hi))
        if len(U) < 40:
            continue
        Dd.append(dict(half=lab, **score(U)))
    Dd = pd.DataFrame(Dd)

    # ---------- E. THE FALSIFIER: same cold streak, book CUT him instead ----------
    E = []
    for lab, m in [("book RAISED him (the signal)", cold & (zc >= Z0)),
                   ("book CUT him (the mirror)", cold & (zc <= -Z0)),
                   ("book barely moved (|z| < 0.25)", cold & (zc.abs() < 0.25))]:
        U = dedupe(P, m & zc.notna())
        if len(U) < 40:
            continue
        E.append(dict(spot=lab, **score(U)))
    E = pd.DataFrame(E)

    # ---------- F. does the originator already own it ----------
    S = dedupe(P, cold & (zc >= Z0) & zc.notna())
    S = S[S["lgbm"].notna()].reset_index(drop=True)
    S["ok"] = True
    F = []
    for lab, m in [("model also says under", ~S["model_over"]),
                   ("model says OVER (disagrees)", S["model_over"])]:
        U = S[m].reset_index(drop=True)
        U["ok"] = True
        if len(U) < 40:
            continue
        F.append(dict(split=lab, **score(U)))
    F = pd.DataFrame(F)

    # ---------- H. the partial: hold line size FIXED and ask if the signal still adds ----------
    # Sections C and D between them say most of this cell's money sits in big lines, and big lines
    # already pay on their own (verdict section 7). The only question left that matters: INSIDE a
    # line-size band, do the cold+raised rows beat the band's own blind under? That is the partial
    # effect, and it is the number that decides whether this is a new rule or the old one restained.
    H = []
    P["line_q"] = pd.qcut(P["line_pct"], 4, labels=["Q1 smallest", "Q2", "Q3", "Q4 biggest"])
    for q in ["Q1 smallest", "Q2", "Q3", "Q4 biggest"]:
        band = P["line_q"] == q
        U = dedupe(P, cold & (zc >= Z0) & zc.notna() & band)
        Bl = dedupe(P, band)
        if len(U) < 40:
            continue
        su, sb = score(U), score(Bl)
        H.append(dict(band=q, med_line=Bl["cons_line"].median(), signal_n=su["n"],
                      signal_roi=su["roi"], band_blind_roi=sb["roi"],
                      lift=su["roi"] - sb["roi"], one_sigma=su["one_sigma"],
                      signal_szn=su["seasons"]))
    H = pd.DataFrame(H)

    # ---------- I. the interaction control: does the RAISE pay without the streak? ----------
    # The single most important control on this page. If "book raised him" pays on its own, the
    # cold streak is decoration and this is a line-movement rule. It does not: the raise alone
    # LOSES over 4,000+ bets, and only turns positive once the cold streak is required.
    I = []
    for lab, m in [("raise z>=%.2f alone, no streak" % Z0, zc >= Z0),
                   ("cold streak >=%d alone, any line move" % RUN0, cold),
                   ("BOTH (the signal)", cold & (zc >= Z0))]:
        U = dedupe(P, m & zc.notna())
        I.append(dict(rule=lab, **score(U)))
    I = pd.DataFrame(I)

    # ---------- J. is it a role promotion, or a routine reprice? ----------
    # Eyeballing the biggest raises suggests role changes (one PRA line goes 11.5 -> 30.0). Eyeballs
    # are not a population: bucketing by raise-as-share-of-line shows the big-percentage bucket is
    # mostly SMALL lines (2.5 -> 3.5 threes and rebounds), not promoted starters. Kept because the
    # tempting story is wrong and someone will re-derive it.
    Sg = dedupe(P, cold & (zc >= Z0) & zc.notna())
    Sg["pct_raise"] = 100 * Sg["vs_prev_line"] / Sg["prev_line"]
    J = []
    for lab, lo, hi in [("modest reprice (<20%)", 0, 20), ("clear bump (20-40%)", 20, 40),
                        ("big jump (>40%)", 40, 1e9)]:
        U = Sg[(Sg["pct_raise"] >= lo) & (Sg["pct_raise"] < hi)].reset_index(drop=True)
        U["ok"] = True
        if len(U) >= 40:
            J.append(dict(bucket=lab, med_prev_line=U["prev_line"].median(),
                          med_new_line=U["cons_line"].median(), **score(U)))
    J = pd.DataFrame(J)

    VOL = (Sg.groupby("season_x").size().rename("bets").reset_index())

    # ---------- concentration ----------
    G = sig.copy()
    yv = G["y_best_under"]
    dc = G["best_under_dec"]
    win = 1 - yv                        # y_best_under is coded "did it go OVER"; flip for the under
    ok = dc.notna() & win.notna()
    G, win, dc = G[ok], win[ok].to_numpy(), dc[ok].to_numpy()
    G["u"] = win * (dc - 1) - (1 - win)
    ref = score(sig)["roi"]
    assert abs(100 * G["u"].mean() - ref) < 0.05, f"hand {100*G['u'].mean():.2f} != grade {ref:.2f}"
    per = G.groupby("pkey")["u"].agg(["count", "mean"])
    best = per["mean"].idxmax()
    CONC = pd.DataFrame([dict(n=len(G), roi=100 * G["u"].mean(), players=len(per),
                              top10_pct=100 * per["count"].nlargest(10).sum() / len(G),
                              drop_best_player=100 * G.loc[G["pkey"] != best, "u"].mean(),
                              median_line=G["cons_line"].median(),
                              mean_raise_z=G["z_prev_line"].mean(),
                              mean_raise_units=G["vs_prev_line"].mean())])
    MKMIX = (sig.groupby("mk").size().rename("bets").reset_index()
             .assign(pct=lambda d: 100 * d["bets"] / d["bets"].sum())
             .sort_values("bets", ascending=False))

    doc = f"""# NBA props — confirming the "book raised a cold player" under

`nba_props_streaks_confirm.py`. **Regenerated wholesale; do not edit.**

The spot: a player has gone **UNDER {RUN0} straight**, the book **RAISES** his line by **≥{Z0}** of
his own game-to-game standard deviation, and you bet the **UNDER** anyway — with his cold form,
against the way the book just moved. One ticket per player-game, biggest line, venue `{V}`.

Its two parents both lose (cold streak alone −1.12, big raise alone −1.03), so if this is real it is
an interaction, not a signal with a filter bolted on.

## A. Streak length is not an argmax

{md(A)}

## B. The whole surface — ridge or pixel?

ROI by consecutive unders (rows) × size of the raise in player sigmas (columns). `n*` are bet counts.

{md(B)}

## C. Is this just the line-scale rule we already own?

Section 7 of `NBA_PROPS_VERDICT.md` already pays +9.90 on PRA ≥30.5 with no other filter. The
control takes the same number of bets, chosen by line size alone.

{md(C)}

## D. Does it work at both ends of the line ladder?

If the money is only in the big-line half, section C is the real explanation.

{md(Dd)}

## E. THE FALSIFIER — the mirror spot

The claim is specifically that the book RAISED him. Same cold streak, book CUT him by the same
amount, and the barely-moved control.

{md(E)}

**If the under pays on the cut rows too, this is not about the raise** — it is "cold players go
under whenever their number moves," a volatility effect, and the story is wrong.

## I. The interaction control — does the raise pay WITHOUT the streak?

The most important control here. If "the book raised him" pays on its own, the cold streak is
decoration and this is just a line-movement rule.

{md(I)}

**It does not.** The raise alone loses over 4,000+ bets and the cold streak alone loses too; only
the conjunction pays. That is the interaction shape from [[ncaab-bigout-fade-signal]] — combine
signals, do not univariate-screen.

## J. Is it a role promotion?

The biggest raises look like role changes (one PRA line runs 11.5 → 30.0). Eyeballs are not a
population — bucketing by raise-as-a-share-of-line shows the big-percentage bucket is mostly SMALL
lines, not promoted starters. Recorded because the tempting story is the wrong one.

{md(J)}

Volume, for sizing:

{md(VOL)}

## H. The partial — hold line size fixed

Sections C and D between them say most of this cell's money sits in big lines, and big lines already
pay on their own. So: INSIDE a line-size quartile, do the cold+raised rows beat that quartile's own
blind under? That lift is the partial effect, and it is what decides whether this is a new rule.

{md(H)}

## F. Does the originator model already own it?

{md(F)}

## G. Concentration and what the bets actually look like

{md(CONC)}

{md(MKMIX)}

Units recomputed by hand and asserted against `grade()`.
"""
    open(DOC, "w").write(doc)
    print(f"wrote {DOC}\n", flush=True)
    for nm, t in [("A streak", A), ("B surface", B), ("C control", C), ("D ladder", Dd),
                  ("E FALSIFIER", E), ("I interaction", I), ("J role", J), ("H partial", H),
                  ("F model", F), ("G conc", CONC), ("mix", MKMIX), ("vol", VOL)]:
        print(f"===== {nm} =====", flush=True)
        print(t.to_string(index=False, float_format="%.2f"), flush=True)
        print("", flush=True)


if __name__ == "__main__":
    main()
