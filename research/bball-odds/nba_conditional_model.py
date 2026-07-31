#!/usr/bin/env python3
"""Model as a CONVICTION LAYER on the validated signals, not as a standalone bet.

The zoo's verdict is unambiguous: no algorithm, in any NBA market, in any framing,
produced a number more accurate than the closing line (model MAE >= market MAE in
every one of the 13 market x framing cells). Standalone, the model is worthless.

That is not the only way a model can be worth something. The NCAAB precedent is
explicit: the sides GBM was useless on its own, but gating S1 on model AGREEMENT
lifted it 57.8% -> 61.7%. A model can carry information that is real but too small to
overcome the vig alone, and still be decisive as a second filter on a population the
market is already known to misprice.

The NBA has two such populations, both validated, both mechanism-measured:
  S7  both teams riding the same 3+ game 1H over/under streak -> FADE it in the 1H
      total (61.9% / +18.1%, n=113)
  S8  one moderate scorer (18-25 ppg) freshly out, opponent clean, |FG spread| < 8
      -> BACK the depleted team on the 1H spread (60.9% / +16.0%, n=271)

So this asks three questions, in increasing order of what would be new:
  A  do S7/S8 reproduce on this exact frame? (sanity — different builder, same data)
  B  does the model's edge AGREE-tier them? (the NCAAB play)
  C  is the model's edge better INSIDE those populations than outside? If the market's
     half-split error is concentrated where we already know it is, a model diluted
     across 3,900 games would look dead even if it sees the structure clearly on the
     300 that matter.

Predictions come from nba_h1_total_model.py's rolling-origin walk-forward — the honest
ones, not the season-level split that flattered itself.
"""
import os

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def grade(win, dec, mask, seasons=None, season_col=None):
    m = mask & win.notna() & dec.notna()
    n = int(m.sum())
    if n == 0:
        return 0, np.nan, np.nan, "-"
    w, d = win[m].values, dec[m].values
    per = "-"
    if seasons is not None:
        parts = []
        for s in seasons:
            mm = m & (season_col == s)
            k = int(mm.sum())
            parts.append(f"{100*win[mm].mean():.0f}" if k >= 20 else "-")
        per = "/".join(parts)
    return n, 100 * w.mean(), 100 * (w * (d - 1) - (1 - w)).mean(), per


def main():
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    P = pd.read_parquet(f"{OUT}/nba_h1_total_model_preds.parquet")
    keep = ["event_id", "ens_share", "ens_anch", "ens_all"]
    G = F.merge(P[keep], on="event_id", how="inner")
    G = G[G["h1_total_line"].notna() & G["h1_ov"].notna()].copy()
    G["_resid_t"] = G["y_h1_total"] - G["h1_total_line"]
    G["_ou01"] = np.where(G["_resid_t"] > 0, 1.0, np.where(G["_resid_t"] < 0, 0.0, np.nan))
    G["_resid_s"] = G["y_h1_marg_resid"]
    G["_sp01"] = np.where(G["_resid_s"] > 0, 1.0, np.where(G["_resid_s"] < 0, 0.0, np.nan))
    seasons = sorted(G["season"].unique())
    sc = G["season"]

    L = ["# NBA model as a conviction layer on S7 / S8", "",
         f"{len(G):,} games with a T-60 1H line AND a rolling-origin model prediction, "
         f"seasons {seasons}. BE 52.4%. Model edges are the honest walk-forward ones.", ""]

    # ---------------------------------------------------------------- S7
    # both teams riding the same 3+ game 1H over/under streak -> fade that direction
    hr, ar = G["h_strk_h1ou_run"], G["a_strk_h1ou_run"]
    gp_ok = (G["h_gp"] >= 20) & (G["a_gp"] >= 20)
    both_over = (hr >= 3) & (ar >= 3) & gp_ok
    both_under = (hr <= -3) & (ar <= -3) & gp_ok
    s7 = both_over | both_under
    # fade: shared OVER streak -> bet UNDER, shared UNDER streak -> bet OVER
    s7_over_side = both_under                       # we bet the OVER when they ride unders
    win7 = pd.Series(np.where(G["_ou01"].isna(), np.nan,
                              np.where(s7_over_side, G["_ou01"], 1 - G["_ou01"])), index=G.index)
    dec7 = pd.Series(np.where(s7_over_side, G["h1_ov"], G["h1_un"]), index=G.index)

    L += ["## A — do the validated signals reproduce on this frame?\n",
          "| signal | n | win% | ROI | per-season |", "|---|---|---|---|---|"]
    n, w, r, p = grade(win7, dec7, s7, seasons, sc)
    L.append(f"| S7 shared 3+ 1H o/u streak -> FADE (1H total) | {n} | {w:.1f} | {r:+.1f} | {p} |")
    n, w, r, p = grade(win7, dec7, both_over, seasons, sc)
    L.append(f"| ...shared OVER streak -> bet UNDER | {n} | {w:.1f} | {r:+.1f} | {p} |")
    n, w, r, p = grade(win7, dec7, both_under, seasons, sc)
    L.append(f"| ...shared UNDER streak -> bet OVER | {n} | {w:.1f} | {r:+.1f} | {p} |")

    # S8 on the 1H spread
    mod_h = ((G["h_abs_fresh_max_ppg"] >= 18) & (G["h_abs_fresh_max_ppg"] < 25)
             & (G["a_abs_fresh_max_ppg"] < 18))
    mod_a = ((G["a_abs_fresh_max_ppg"] >= 18) & (G["a_abs_fresh_max_ppg"] < 25)
             & (G["h_abs_fresh_max_ppg"] < 18))
    close = G["t60_spread_home_point"].abs() < 8
    gp25 = (G["h_gp"] >= 25) & (G["a_gp"] >= 25)
    s8h, s8a = mod_h & close & gp25, mod_a & close & gp25
    s8 = s8h | s8a
    win8 = pd.Series(np.where(G["_sp01"].isna(), np.nan,
                              np.where(s8h, G["_sp01"], 1 - G["_sp01"])), index=G.index)
    dec8 = pd.Series(np.where(s8h, G["h1_sp_h"], G["h1_sp_a"]), index=G.index)
    n, w, r, p = grade(win8, dec8, s8, seasons, sc)
    L.append(f"| S8 moderate fresh absence -> BACK depleted (1H spread) | {n} | {w:.1f} | "
             f"{r:+.1f} | {p} |")

    # ---------------------------------------------------------------- B
    L += ["\n## B — model AGREEMENT as a second filter\n",
          "| population | model | tier | n | win% | ROI | per-season |",
          "|---|---|---|---|---|---|---|"]
    # the S7 bet is a side of the 1H total; model edge > 0 means the model likes the OVER
    for mname in ("ens_share", "ens_anch", "ens_all"):
        e = G[mname]
        bet_over = s7_over_side
        agree = (e > 0) == bet_over
        for tier, mm in (("AGREE", s7 & agree), ("DISAGREE", s7 & ~agree)):
            n, w, r, p = grade(win7, dec7, mm & e.notna(), seasons, sc)
            L.append(f"| S7 (1H total) | {mname} | {tier} | {n} | {w:.1f} | {r:+.1f} | {p} |")
    # S8 is a spread bet; the 1H-total model has nothing to say about a side, so gate on
    # |edge| instead — does the model seeing an unusual half at all mark better S8 spots?
    for mname in ("ens_share",):
        e = G[mname].abs()
        med = e[s8].median()
        for tier, mm in (("model |edge| high", s8 & (e >= med)), ("low", s8 & (e < med))):
            n, w, r, p = grade(win8, dec8, mm, seasons, sc)
            L.append(f"| S8 (1H spread) | {mname} | {tier} | {n} | {w:.1f} | {r:+.1f} | {p} |")

    # ---------------------------------------------------------------- C
    L += ["\n## C — is the model's own edge better INSIDE the mispriced populations?\n",
          "| population | cut | n | win% | ROI | per-season |", "|---|---|---|---|---|---|"]
    fresh_any = (G["h_abs_fresh_max_ppg"] >= 18) | (G["a_abs_fresh_max_ppg"] >= 18)
    streak_any = (hr.abs() >= 3) | (ar.abs() >= 3)
    pops = {"ALL games": pd.Series(True, index=G.index),
            "S7 shared-streak": s7,
            "either team 3+ 1H o/u streak": streak_any & gp_ok,
            "either team 18+ppg fresh out": fresh_any,
            "no absence, no streak": ~fresh_any & ~streak_any}
    e = G["ens_share"]
    win_m = pd.Series(np.where(G["_ou01"].isna(), np.nan,
                               np.where(e > 0, G["_ou01"], 1 - G["_ou01"])), index=G.index)
    dec_m = pd.Series(np.where(e > 0, G["h1_ov"], G["h1_un"]), index=G.index)
    for nm, pop in pops.items():
        base = pop & e.notna()
        for cut, lbl in ((0.0, "all"), (0.5, "top50%"), (0.75, "top25%")):
            thr = e[base].abs().quantile(cut) if cut else -1
            n, w, r, p = grade(win_m, dec_m, base & (e.abs() >= thr), seasons, sc)
            L.append(f"| {nm} | {lbl} | {n} | {w:.1f} | {r:+.1f} | {p} |")

    path = os.path.join(ROOT, "NBA_CONDITIONAL_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\nwrote {path}")


if __name__ == "__main__":
    main()
