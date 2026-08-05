#!/usr/bin/env python3
"""Why is the 1H spread's HOME side broken? +0.7% home vs +21.0% away on the same model.

The panel is symmetric by construction and `build_panel`'s mirror check passes, so a 20-point gap
between the two sides of one prediction should not be possible from the features. Three candidate
mechanisms, measured here rather than argued:

  A. GRADING/LINE MISMATCH -- `y_h1_marg_resid` is built as `y_h1_margin + h1_spread`, so the line
     the bet is graded against and the line the reducer adds must be the same number. If they ever
     differ (a re-snapped line, a stale median) the two sides absorb the error asymmetrically.
  B. LEVEL BIAS -- if the symmetrised margin estimate `(home-away)/2` sits off-centre by even half a
     point, `d = mhat + spread` shifts wholesale: one side's bets get pushed over the threshold on
     noise and the other side's get held back, which is exactly a one-sided ROI split.
  C. SHRINKAGE -- ridge pulls mhat toward zero. The market does not shrink. So `d = mhat - implied`
     is systematically negative wherever the home team is favoured, and home is favoured in most
     games. Under shrinkage alone the model becomes a FADE-THE-FAVOURITE rule wearing a model's
     clothes, and its away bets are simply "the home team is favoured" with extra steps.

C is the one that would make the away side an artefact rather than a finding, so the composition
table (side taken x who is favoured) is the load-bearing output here, not the ROI.

Two market-free repairs are then graded against the baseline: an expanding-window intercept fix and
an expanding-window slope fix, both estimated against the REALISED margin and never against the
line, so neither smuggles the market into the originator.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "NBA_H1_SPREAD_DIAG.md")
HALF_LIFE = 120.0
CUT = ["nets", "usage", "h1_streak", "raw_box", "form", "h1_form", "dims"]
KS = (1, 1.5, 2, 2.5, 3, 4, 5, 6)


def _mod(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def side_roi(pa, d, yb, po, pu, k, mask=None):
    """(n, win%, ROI) for the home-side bets and the away-side bets separately."""
    out = {}
    for lab, m in (("HOME", d > 0), ("AWAY", d < 0)):
        mm = m & (d.abs() >= k)
        if mask is not None:
            mm = mm & mask
        mm = mm & d.notna() & yb.notna() & po.notna() & pu.notna()
        if mm.sum() < 25:
            out[lab] = None
            continue
        win = (yb[mm] if lab == "HOME" else 1 - yb[mm])
        dec = (po if lab == "HOME" else pu)[mm]
        out[lab] = dict(n=int(mm.sum()), win=100 * win.mean(),
                        roi=100 * (win * (dec - 1) - (1 - win)).mean())
    return out


def expanding_fix(d_hat, truth, dates, min_n=1200):
    """Expanding-window intercept and slope calibration of mhat against the REALISED margin.

    Refit on the same 28-day cadence the model uses, always on strictly prior games, so this is a
    thing a bettor could have computed on the morning of the game. No line anywhere.
    """
    a = pd.Series(np.nan, index=d_hat.index)
    b = pd.Series(np.nan, index=d_hat.index)
    idx = pd.DatetimeIndex(dates)
    starts = sorted({t for t in pd.date_range(idx.min(), idx.max(), freq="28D")
                     if (idx < t).sum() >= min_n})
    for i, t0 in enumerate(starts):
        t1 = starts[i + 1] if i + 1 < len(starts) else idx.max() + pd.Timedelta(days=1)
        tr = (idx < t0) & d_hat.notna().values & truth.notna().values
        te = (idx >= t0) & (idx < t1)
        if tr.sum() < min_n or te.sum() == 0:
            continue
        x, y = d_hat[tr].values, truth[tr].values
        sl = np.polyfit(x, y, 1)
        a.iloc[np.where(te)[0]] = sl[1]
        b.iloc[np.where(te)[0]] = sl[0]
    return a, b


def main():
    hp = _mod("hp", "nba_h1_prune.py")
    pa, P, G, cols = hp.load()
    fam = pd.Series({c: hp.famof(c) for c in cols})
    S = hp.markets(pa, P, G)["1H_SPREAD"]
    resid = S["resid"]
    yb = pd.Series(np.where(resid > 0, 1.0, np.where(resid < 0, 0.0, np.nan)), index=G.index)
    po, pu = S["po"], S["pu"]

    L = ["# NBA 1H spread — why the home side is broken", "",
         "`nba_h1_spread_diag.py`. The model is the settled one: 475 features, half-life 120d, "
         "no market column. Question is not whether it makes money, it is whether "
         "**+0.7% home / +21.0% away** is a property of the market or an artefact of the rule.", ""]

    # --- A. is the graded line the same line the reducer adds? ------------------------------
    mar = G["y_h1_margin"].astype(float)
    spr = G["h1_spread"].astype(float)
    recon = mar + spr
    bad = (recon - resid).abs() > 1e-9
    both = resid.notna() & recon.notna()
    L += ["## A. Grading line vs reducer line", "",
          f"`y_h1_marg_resid` reconstructs from `y_h1_margin + h1_spread` on "
          f"**{int((~bad & both).sum()):,} of {int(both.sum()):,}** gradeable games "
          f"(mismatches: {int((bad & both).sum())}). "
          f"So the reducer adds exactly the number the bet is graded against.", ""]
    print(L[-2], flush=True)

    # --- fit ---------------------------------------------------------------------------------
    use = [c for c in cols if fam[c] not in CUT]
    p = pa.ridge_multi(P[use].astype(float), P["date"], [S["y"]], half_life=HALF_LIFE)[0]
    t = P.assign(p=p)[["event_id", "team_row", "p"]]
    g = t.pivot(index="event_id", columns="team_row", values="p").reindex(G.index)
    mhat = (g["home"] - g["away"]) / 2.0            # antisymmetric part = the margin estimate
    sym = (g["home"] + g["away"]) / 2.0             # symmetric part, discarded by the reducer
    d = mhat + spr
    impl = -spr                                     # the market's own first-half margin
    ok = d.notna() & yb.notna()

    # --- B. level bias ------------------------------------------------------------------------
    L += ["## B. Is the margin estimate centred?", "",
          "| quantity | mean | sd |", "|---|---|---|"]
    for lab, v in (("realised 1H margin", mar[ok]), ("market implied (−h1_spread)", impl[ok]),
                   ("model mhat", mhat[ok]), ("d = mhat + spread", d[ok]),
                   ("discarded symmetric part", sym[ok])):
        L.append(f"| {lab} | {v.mean():+.3f} | {v.std():.3f} |")
        print(L[-1], flush=True)
    L += ["",
          f"The model's mean margin is **{mhat[ok].mean():+.3f}** against a realised "
          f"**{mar[ok].mean():+.3f}** and a market **{impl[ok].mean():+.3f}**. A gap here shifts "
          f"every `d` by the same amount, which is the cheapest way to break one side.", ""]

    # --- C. shrinkage -------------------------------------------------------------------------
    sl_m = np.polyfit(mhat[ok], mar[ok], 1)
    sl_k = np.polyfit(impl[ok], mar[ok], 1)
    sd_ratio = mhat[ok].std() / impl[ok].std()
    L += ["## C. Shrinkage — does the model just fade whoever is favoured?", "",
          "| regression of realised 1H margin on… | intercept | slope | corr |", "|---|---|---|---|",
          f"| model mhat | {sl_m[1]:+.3f} | **{sl_m[0]:+.3f}** | {mhat[ok].corr(mar[ok]):+.4f} |",
          f"| market implied | {sl_k[1]:+.3f} | **{sl_k[0]:+.3f}** | {impl[ok].corr(mar[ok]):+.4f} |",
          "",
          f"Model sd is **{sd_ratio:.2f}x** the market's. A slope above 1 means the estimate is "
          f"SHRUNK — it has the right direction at too small a scale, and `d = mhat − implied` "
          f"then leans against the favourite mechanically.", "",
          f"corr(d, implied) = **{d[ok].corr(impl[ok]):+.4f}** — if this is strongly negative the "
          f"bet rule is a favourite-fader.", ""]
    print("\n".join(L[-8:]), flush=True)

    # --- composition: side taken x who is favoured ---------------------------------------------
    L += ["## The composition table — what the away bets actually are", "",
          "| cut | side | bets | of which home favoured | win% | ROI |", "|---|---|---|---|---|---|"]
    hf = impl > 0
    for k in (3, 4, 5, 6):
        for lab, m in (("HOME", d > 0), ("AWAY", d < 0)):
            mm = ok & m & (d.abs() >= k)
            if mm.sum() < 25:
                continue
            win = (yb[mm] if lab == "HOME" else 1 - yb[mm])
            dec = (po if lab == "HOME" else pu)[mm]
            L.append(f"| ≥{k:g} | {lab} | {int(mm.sum()):,} | {100*hf[mm].mean():.0f}% | "
                     f"{100*win.mean():.1f} | **{100*(win*(dec-1)-(1-win)).mean():+.1f}** |")
            print(L[-1], flush=True)
    L.append("")

    # A blind control for the composition: bet the away side of every home-favoured game.
    for lab, m in (("blind AWAY when home favoured", ok & hf),
                   ("blind AWAY when away favoured", ok & ~hf)):
        w = 1 - yb[m]
        L.append(f"- {lab}: n={int(m.sum()):,}, {100*w.mean():.2f}%, "
                 f"**{100*(w*(pu[m]-1)-(1-w)).mean():+.2f}%** ROI")
        print(L[-1], flush=True)
    L.append("")

    # --- repairs --------------------------------------------------------------------------------
    a_e, b_e = expanding_fix(mhat, mar, G["date"])
    variants = {
        "baseline  d = mhat + spread": d,
        "intercept fix  a + mhat": (a_e + mhat) + spr,
        "full calibration  a + b·mhat": (a_e + b_e * mhat) + spr,
        "de-shrink only  mhat·b": (b_e * mhat) + spr,
    }
    L += ["## Two market-free repairs", "",
          "Both calibrate mhat against the REALISED margin on an expanding window — never against "
          "the line — so the originator stays an originator. `a` and `b` are the intercept and "
          "slope of `margin ~ mhat` fit on strictly prior games, refit every 28 days.", "",
          "| variant | cut | HOME n | HOME ROI | AWAY n | AWAY ROI | both ROI |",
          "|---|---|---|---|---|---|---|"]
    for name, dv in variants.items():
        for k in (4, 5, 6):
            sr = side_roi(pa, dv, yb, po, pu, k)
            gg = pa.grade(dv, yb, po, pu, k)
            h, a = sr["HOME"], sr["AWAY"]
            hn, hr = (h["n"], f"{h['roi']:+.1f}") if h else (0, "—")
            an, ar = (a["n"], f"{a['roi']:+.1f}") if a else (0, "—")
            L.append(f"| {name} | ≥{k:g} | {hn} | **{hr}** | {an} | **{ar}** | {gg['roi']:+.1f} |")
            print(L[-1], flush=True)
    L.append("")

    open(OUT, "w").write("\n".join(L) + "\n")
    print(f"\nwrote {OUT}", flush=True)


if __name__ == "__main__":
    main()
