#!/usr/bin/env python3
"""The control the first motivation pass was missing: blind favourite INSIDE the same games.

`nba_motivation_signal.py` found late-season rules that beat the cell-matched blind-favourite
comparator by +5 to +10 ROI. But two of the best rows carry a fav share of 94% and 97% --
"fade the eliminated team" is, 97 times out of 100, the same ticket as "bet the favourite".

The cell-matched comparator does not catch that. It reweights blind-favourite ROI across ALL
late-season games to match the selection's |open spread| mix, which answers "is this better
than betting favourites generally, at these prices". That is the right question for a rule
that picks sides. It is the wrong question for a rule whose picks ARE the favourites: there
the honest question is whether the SUBSET is unusual, i.e.

    do favourites cover better than usual in games with a dead team in them?

If yes, the finding is real but it is a FILTER on when to back favourites, not a fade of
dead teams -- same bet, different and much more testable claim. If the two numbers match,
there is no separate motivation effect at all and the first brief overstated it.

So every row below carries `fav in-subset`: blind-favourite win% computed on the identical
games the rule fires on. The gap between `win%` and `fav in-subset` is what the rule adds
over just knowing which games to look at.

Also here:
  FAV/DOG SPLIT   the motivation rules are run separately on their favourite picks and
                  their underdog picks. A rule that only works on favourites and a rule
                  that works on both are different animals.
  BOOTSTRAP       10k resamples of the bet list, 5th percentile of win%. With n in the low
                  hundreds a 56% point estimate routinely has a p5 below breakeven, and
                  that is the number that decides whether to bet it.
  NO PLACEBO ROW  "back the lower-motivation side" is the exact complement of "back the
                  higher" on the same games, so its 46.9% is arithmetic, not evidence. It
                  is dropped rather than reported as confirmation.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(7)
BOOT = 10_000


def american_to_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def boot_p5(win):
    """5th percentile of win% under resampling of the bet list."""
    if len(win) < 30:
        return np.nan
    idx = RNG.integers(0, len(win), size=(BOOT, len(win)))
    return 100 * np.percentile(win[idx].mean(axis=1), 5)


def motivation(S, pre, gate=30.0):
    edge = S[f"st_{pre}_playin_edge"].to_numpy(dtype=float)
    gb6 = S[f"st_{pre}_gb_6"].to_numpy(dtype=float)
    left = S[f"st_{pre}_games_left"].to_numpy(dtype=float)
    m = np.zeros(len(S))
    m += np.where(np.abs(edge) <= 2, 2.0, np.where(np.abs(edge) <= 5, 1.0, 0.0))
    m += np.where(np.abs(gb6) <= 3, 1.0, 0.0)
    m -= 2.0 * (S[f"st_{pre}_eliminated"].to_numpy(dtype=float) > 0)
    m -= 2.0 * (S[f"st_{pre}_tank"].to_numpy(dtype=float) > 0)
    m -= 1.0 * (S[f"st_{pre}_clinched"].to_numpy(dtype=float) > 0)
    return np.where(left <= gate, m, 0.0)


def main():
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    S = pd.read_parquet(f"{OUT}/nba_standings_feats.parquet")
    F = F[~F["game.id"].duplicated(keep=False)].copy()
    d = F.merge(S, on="game.id", how="inner").reset_index(drop=True)

    sp = d["open_spread_home_point"].to_numpy(dtype=float)
    y = d["y_fg_margin"].to_numpy(dtype=float)
    dh, da = american_to_dec(d["open_spread_home_price"]), \
        american_to_dec(d["open_spread_away_price"])
    live = (y != -sp) & np.isfinite(sp) & np.isfinite(dh) & np.isfinite(da)
    home_cover, away_cover = (y > -sp).astype(float), (y < -sp).astype(float)
    fav_home = sp < 0
    fav_win = np.where(fav_home, home_cover, away_cover)

    mh, ma = motivation(d, "h"), motivation(d, "a")
    diff = mh - ma
    gp = np.minimum(d["st_h_gp"].to_numpy(dtype=float),
                    d["st_a_gp"].to_numpy(dtype=float))
    post = d["game.postseason"].to_numpy(dtype=float) > 0
    late = live & (~post) & (gp >= 50)
    seasons = sorted(d["season"].unique())

    tank_h = d["st_h_tank"].to_numpy(dtype=float) > 0
    tank_a = d["st_a_tank"].to_numpy(dtype=float) > 0
    elim_h = d["st_h_eliminated"].to_numpy(dtype=float) > 0
    elim_a = d["st_a_eliminated"].to_numpy(dtype=float) > 0
    dead_h, dead_a = tank_h | elim_h, tank_a | elim_a

    L = ["# NBA motivation signal — controlled against favourites in the same games", "",
         "Baseline is 50%; breakeven at -110 is 52.4%. Blind favourite covers **"
         f"{100*fav_win[late].mean():.2f}%** across all "
         f"{int(late.sum()):,} late-season games, so that — not 50% — is what a "
         "favourite-heavy rule has to beat.", "",
         "`fav in-subset` is blind favourite on the identical games the rule fires on. "
         "**That gap, not the raw win%, is what the rule adds.** `p5` is the 5th "
         "percentile of win% over 10,000 bootstrap resamples of the bet list.", ""]

    def row(lab, mask, take_home):
        k = live & mask
        if k.sum() < 40:
            L.append(f"| {lab} | {int(k.sum())} | — | — | — | — | — | — |")
            return
        win = np.where(take_home, home_cover, away_cover)
        dec = np.where(take_home, dh, da)
        per = []
        for s in seasons:
            j = k & (d["season"].to_numpy() == s)
            per.append(f"{100*win[j].mean():.0f}" if j.sum() >= 25 else "-")
        L.append(f"| {lab} | {int(k.sum())} | {100*win[k].mean():.1f} | "
                 f"{100*fav_win[k].mean():.1f} | "
                 f"**{100*(win[k].mean() - fav_win[k].mean()):+.1f}** | "
                 f"{roi(win[k], dec[k]):+.2f} | {boot_p5(win[k]):.1f} | "
                 f"{'/'.join(per)} |")

    HDR = ["| rule | n | win% | fav in-subset | rule − fav | ROI | p5 | by season |",
           "|---|---|---|---|---|---|---|---|"]

    L += ["\n## Is the rule anything more than the favourite?\n"] + HDR
    row("back higher-motivation side, gap >= 2", late & (np.abs(diff) >= 2), diff > 0)
    row("back higher-motivation side, gap >= 3", late & (np.abs(diff) >= 3), diff > 0)
    row("fade the tanking team", late & (tank_h ^ tank_a), tank_a)
    row("fade the eliminated team", late & (elim_h ^ elim_a), elim_a)
    row("fade any dead team (out or tanking)", late & (dead_h ^ dead_a), dead_a)

    L += ["\n## Split by whether the pick is the favourite or the dog\n",
          "A rule that only fires on favourites is a favourite filter. One that also wins "
          "on dogs is picking sides.", ""] + HDR
    for lab, mask, th in (
            ("motivation gap >= 2", late & (np.abs(diff) >= 2), diff > 0),
            ("fade any dead team", late & (dead_h ^ dead_a), dead_a)):
        is_fav = th == fav_home
        row(f"{lab} — pick is the FAVOURITE", mask & is_fav, th)
        row(f"{lab} — pick is the DOG", mask & ~is_fav, th)

    L += ["\n## The away-team result, stressed\n",
          "The first pass found the motivation gap works only when the motivated side is "
          "the AWAY team (56.1% vs 50.0% at home). Road teams are dogs more often, so this "
          "is the row least likely to be a favourite effect — and the one most likely to "
          "be noise, since it is half the sample.", ""] + HDR
    row("motivated side is AWAY, gap >= 2", late & (diff <= -2), np.zeros(len(d), bool))
    row("motivated side is HOME, gap >= 2", late & (diff >= 2), np.ones(len(d), bool))
    row("dead team is the HOME team (fade it)", late & dead_h & ~dead_a,
        np.zeros(len(d), bool))
    row("dead team is the AWAY team (fade it)", late & dead_a & ~dead_h,
        np.ones(len(d), bool))

    L += ["\n## Placebo: the same rule where standings cannot matter\n",
          "Same score, gate removed so it can fire in November. If it scores here it is "
          "reading team quality, not motivation.", ""] + HDR
    d2 = d.copy()
    dany = motivation(d2, "h", gate=999) - motivation(d2, "a", gate=999)
    mid = live & (~post) & (gp >= 15) & (gp < 50)
    row("mid season, gap >= 2", mid & (np.abs(dany) >= 2), dany > 0)
    row("mid season, gap >= 3", mid & (np.abs(dany) >= 3), dany > 0)

    path = os.path.join(ROOT, "NBA_MOTIVATION_CONTROL_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
