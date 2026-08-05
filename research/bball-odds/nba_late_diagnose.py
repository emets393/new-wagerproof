#!/usr/bin/env python3
"""Where does the late-season inversion live? Regrade saved predictions by standings context.

No fitting. `nba_spread_v2_margin.parquet` already holds walk-forward predictions from nine
families; `nba_standings_feats.parquet` now holds the motivation context those models never
saw. Joining them asks one question:

    when the late-season model loses, is it losing in the games where the standings say
    somebody has stopped trying?

If yes, the inversion is a missing-feature problem and adding standings should fix it. If
the loss is spread evenly across contexts, it is something else and building the feature
set further would be wasted work. Cheap enough to run before committing to a refit.

READING THE NUMBERS -- every win% below is against a 50% coin, not against a good model.
Spread betting is a two-way market: absent skill you win half. Breakeven at -110 is 52.4%.
So 55% is a large number here, and 47% is an equally large number pointing the other way --
a rule that loses at 47% is a rule that wins at 53% flipped. That is the opposite of the
player-prop markets, where unders already hit 54-56% before any model touches them and a
56% under model is worth almost nothing. Same digits, different baselines.

`delta cell` is the model's ROI minus the naive rule for that window (blind favourite,
late), reweighted to the selection's own |open spread| bucket mix -- so a split cannot
score well merely by drifting toward big favourites.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
CUT = 50   # top 50% of |edge| -- tight enough to show the effect, loose enough to split


def american_to_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def cell_matched(sp, live, sel, nwin, ndec):
    edges = np.array([0, 2.5, 5.5, 8.5, 12.5, 99.0])
    b = np.digitize(np.abs(sp), edges[1:-1])
    tot = wsum = 0.0
    for k in np.unique(b[sel]):
        w = (b[sel] == k).sum()
        pool = live & (b == k)
        if pool.sum() < 40:
            continue
        tot += w * roi(nwin[pool], ndec[pool])
        wsum += w
    return tot / wsum if wsum else np.nan


def main():
    M = pd.read_parquet(f"{OUT}/nba_spread_v2_margin.parquet")
    S = pd.read_parquet(f"{OUT}/nba_standings_feats.parquet")
    d = M.merge(S, on="game.id", how="inner")
    names = [c[2:] for c in M.columns if c.startswith("p_")]
    print(f"{len(d):,} of {len(M):,} predictions joined to standings", flush=True)

    L = ["# NBA late-season spread — is the inversion a motivation blind spot?", "",
         "No refitting. Saved walk-forward predictions from `nba_spread_v2.py` regraded "
         "against standings context the models never saw.", "",
         "**Baseline for every win% below is 50%**, because a spread is a two-way market "
         "and a coin wins half. Breakeven at -110 is 52.4%. A 47% row is as far from "
         "random as a 53% row — it is the same edge with the sign flipped.", "",
         "Selection is the top "
         f"{CUT}% of |edge| on the AVERAGE of all nine families, so no single learner and "
         "no cell-picking can drive a row. `delta cell` subtracts blind-favourite ROI "
         "reweighted to the selection's own |open spread| mix.", ""]

    for ph in ("late", "mid", "early"):
        f = d[d["phase"] == ph].reset_index(drop=True)
        if len(f) < 300:
            continue
        sp = f["open_spread_home_point"].to_numpy(dtype=float)
        y = f["y_fg_margin"].to_numpy(dtype=float)
        dh = american_to_dec(f["open_spread_home_price"])
        da = american_to_dec(f["open_spread_away_price"])
        live = (y != -sp) & np.isfinite(sp) & np.isfinite(dh) & np.isfinite(da)
        # naive comparator: blind favourite late, blind home otherwise
        n_home = (sp < 0) if ph == "late" else np.ones(len(sp), dtype=bool)
        nwin = np.where(n_home, (y > -sp).astype(float), (y < -sp).astype(float))
        ndec = np.where(n_home, dh, da)

        E = np.mean([(f[f"p_{n}"] + f["open_spread_home_point"]).to_numpy(dtype=float)
                     for n in names], axis=0)
        take_home = E > 0
        win = np.where(take_home, (y > -sp).astype(float), (y < -sp).astype(float))
        dec = np.where(take_home, dh, da)
        ok = live & np.isfinite(E)
        a = np.abs(E)
        m = ok & (a >= np.nanquantile(a[ok], 1 - CUT / 100))

        L += [f"\n## {ph} — {int(m.sum())} bets, {100*win[m].mean():.1f}%, "
              f"{roi(win[m], dec[m]):+.2f} ROI\n",
              "| split | n | win% | ROI | delta cell |", "|---|---|---|---|---|"]

        pe_h = f["st_h_playin_edge"].to_numpy(dtype=float)
        pe_a = f["st_a_playin_edge"].to_numpy(dtype=float)
        both_done = f["st_both_done"].to_numpy(dtype=float) > 0
        # "stakes" = the side with less on the line, so a game is only low-stakes when
        # NEITHER team needs it
        min_urgency = np.minimum(np.abs(pe_h), np.abs(pe_a))
        splits = [
            ("both sides settled (clinched or out)", both_done),
            ("at least one side still racing", ~both_done),
            ("either side within 3 of the bubble",
             f["st_one_needs_it"].to_numpy(dtype=float) > 0),
            ("neither side near the bubble",
             f["st_one_needs_it"].to_numpy(dtype=float) == 0),
            ("a tanking team involved",
             (f["st_h_tank"].to_numpy() + f["st_a_tank"].to_numpy()) > 0),
            ("no tanking team", (f["st_h_tank"].to_numpy()
                                 + f["st_a_tank"].to_numpy()) == 0),
            ("post trade deadline", f["st_post_deadline"].to_numpy() > 0),
            ("pre trade deadline", f["st_post_deadline"].to_numpy() == 0),
            ("min urgency < 4 games", min_urgency < 4),
            ("min urgency >= 8 games", min_urgency >= 8),
        ]
        for lab, mask in splits:
            k = m & mask
            if k.sum() < 40:
                L.append(f"| {lab} | {int(k.sum())} | — | — | — |")
                continue
            nc = cell_matched(sp, live, k, nwin, ndec)
            L.append(f"| {lab} | {int(k.sum())} | {100*win[k].mean():.1f} | "
                     f"{roi(win[k], dec[k]):+.2f} | **{roi(win[k], dec[k]) - nc:+.2f}** |")

        # does the model KNOW it is in a dead game? if the settled-game rows are also the
        # ones it is most confident about, the blind spot is actively harmful
        for lab, mask in (("settled", both_done), ("racing", ~both_done)):
            if (ok & mask).sum() >= 60:
                L.append(f"| _mean \\|edge\\| in {lab} games_ | "
                         f"{int((ok & mask).sum())} | | "
                         f"{a[ok & mask].mean():.2f} pts | |")

    path = os.path.join(ROOT, "NBA_LATE_DIAGNOSE_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
