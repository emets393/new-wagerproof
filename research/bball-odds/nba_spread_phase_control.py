#!/usr/bin/env python3
"""Is the phase structure information, or a restatement of what the window already does?

`nba_spread_phase.py` found two things worth chasing: the model is monotone and positive
EARLY, and inverted across all eight families LATE. Both have a boring explanation sitting
right next to them in the baseline table:

    early   blind HOME covers 52.37%
    late    blind FAVOURITE covers 53.05%   (vs 48.67% early and mid)

If the early edge is the model discovering "take the home team in October", and the late
fade is it discovering "take the favourite in March", then neither is a model result. Both
are one-line rules that need no machine learning at all, and I would be re-selling a
calendar effect as a handicap.

This is the same control that decided the props programme -- blind bet reweighted to the
SELECTION's own cell mix -- ported to the spread. Cells here are |open spread| buckets,
because that is the axis a favourite/home rule lives on.

    delta_all    selection ROI minus the naive rule over the whole window
    delta_cell   selection ROI minus the naive rule reweighted to the selection's own
                 spread-bucket mix. This is the number that decides. If the model is
                 picking GAMES, delta_cell survives; if it is picking the buckets where
                 the window's rule is strongest, delta_cell goes to zero.

Also reported: what share of the selection IS the naive side. A fade that is 95% favourites
is the favourite rule wearing a hat, whatever its delta says.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
CUTS = (50, 25, 10)
# the naive rule each window is suspected of imitating
NAIVE = {"early": "home", "mid": "home", "late": "fav", "playoffs": "home"}


def american_to_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def sides(d):
    """Per-game arrays shared by every rule below: does taking HOME win, and at what price."""
    sp = d["open_spread_home_point"].to_numpy(dtype=float)
    y = d["y_fg_margin"].to_numpy(dtype=float)
    home_win = (y > -sp).astype(float)
    dh = american_to_dec(d["open_spread_home_price"])
    da = american_to_dec(d["open_spread_away_price"])
    live = (y != -sp) & np.isfinite(sp) & np.isfinite(dh) & np.isfinite(da)
    return sp, home_win, dh, da, live


def rule_side(sp, kind):
    """True = the rule takes the home side."""
    return sp < 0 if kind == "fav" else np.ones(len(sp), dtype=bool)


def apply_side(take_home, home_win, dh, da):
    win = np.where(take_home, home_win, 1 - home_win)
    dec = np.where(take_home, dh, da)
    return win, dec


def cell_matched(sp, live, sel_mask, naive_win, naive_dec):
    """Naive rule ROI, reweighted to the selection's own |spread| bucket mix."""
    edges = np.array([0, 2.5, 5.5, 8.5, 12.5, 99.0])
    b = np.digitize(np.abs(sp), edges[1:-1])
    tot, wsum = 0.0, 0.0
    for k in np.unique(b[sel_mask]):
        w = (b[sel_mask] == k).sum()
        pool = live & (b == k)
        if pool.sum() < 40:
            continue
        tot += w * roi(naive_win[pool], naive_dec[pool])
        wsum += w
    return tot / wsum if wsum else np.nan


def main():
    M = pd.read_parquet(f"{OUT}/nba_open_margin_preds.parquet")
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    dup = set(F.loc[F.duplicated("game.id", keep=False), "game.id"])
    F = F[~F["game.id"].isin(dup)][["game.id", "h_gp", "a_gp", "game.postseason",
                                    "open_spread_home_price",
                                    "open_spread_away_price"]].drop_duplicates("game.id")
    D = M.merge(F, on="game.id", how="inner")
    gp = np.minimum(D["h_gp"], D["a_gp"]).to_numpy(dtype=float)
    post = D["game.postseason"].to_numpy(dtype=float) > 0
    D["phase"] = np.where(post, "playoffs",
                          np.where(gp < 15, "early", np.where(gp < 50, "mid", "late")))
    seasons = sorted(D["season"].unique())
    pcols = [c for c in D.columns if c.startswith("p_")]

    L = ["# NBA spread by phase — the control", "",
         "The phase split found the model monotone-positive EARLY and inverted across all "
         "eight families LATE. Each window has a one-line rule that already works in it "
         "(home early, favourite late), so the only question that matters is whether the "
         "model adds anything on top of that rule.", "",
         "`delta cell` is the deciding column: the naive rule reweighted to the "
         "selection's own |open spread| bucket mix. `naive share` is how often the model's "
         "pick simply IS the naive side — a fade that is 95% favourites is the favourite "
         "rule wearing a hat, whatever its delta says.", ""]

    for ph in ("early", "late", "playoffs"):
        d = D[D["phase"] == ph].reset_index(drop=True)
        if len(d) < 250:
            continue
        sp, hw, dh, da, live = sides(d)
        nk = NAIVE[ph]
        n_home = rule_side(sp, nk)
        nwin, ndec = apply_side(n_home, hw, dh, da)
        base = roi(nwin[live], ndec[live])
        fade = ph == "late"
        L += [f"\n## {ph} — {'FADE' if fade else 'follow'} the model, "
              f"n={live.sum():,}\n",
              f"Naive rule for this window: **blind {nk}**, {roi(nwin[live], ndec[live]):+.2f} "
              f"ROI ({100*nwin[live].mean():.2f}%).", "",
              "| method | cut | n | win% | ROI | naive cell | delta cell | naive share | by season |",
              "|---|---|---|---|---|---|---|---|---|"]
        for pc in pcols:
            e = (d[pc] + d["open_spread_home_point"]).to_numpy(dtype=float)
            take_home = (e < 0) if fade else (e > 0)
            win, dec = apply_side(take_home, hw, dh, da)
            ok = live & np.isfinite(e)
            if ok.sum() < 150:
                continue
            a = np.abs(e)
            for pct in CUTS:
                thr = np.nanquantile(a[ok], 1 - pct / 100)
                m = ok & (a >= thr)
                if m.sum() < 60:
                    continue
                nc = cell_matched(sp, live, m, nwin, ndec)
                share = 100 * (take_home[m] == n_home[m]).mean()
                per = []
                for s in seasons:
                    k = d["season"].to_numpy()[m] == s
                    per.append(f"{100*win[m][k].mean():.0f}" if k.sum() >= 20 else "-")
                L.append(f"| {pc[2:]} | top{pct}% | {m.sum():,} | {100*win[m].mean():.1f} | "
                         f"{roi(win[m], dec[m]):+.2f} | {nc:+.2f} | "
                         f"**{roi(win[m], dec[m]) - nc:+.2f}** | {share:.0f}% | "
                         f"{'/'.join(per)} |")

    path = os.path.join(ROOT, "NBA_SPREAD_PHASE_CONTROL_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
