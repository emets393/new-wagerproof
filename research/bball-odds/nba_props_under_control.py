#!/usr/bin/env python3
"""The pre-registered control on the one positive result in the props programme.

`nba_props_stack.py` found that ONE-SIDED under-selection is positive at CONSENSUS with
large n -- ridge top5% cons 56.27% / +2.59 ROI / n=20,716, delta +6.27 over blind under.
Positive at consensus cannot be a line-shopping artifact, which is what killed the two
earlier props findings, so it is the first thing here worth a dedicated control.

The way it can still be fake, stated before running it: the comparator is blind under on
the FULL population. Props carry a standing over-shade whose strength varies enormously by
market and by line level. If the model merely learns to select the cells where that shade
is strongest, it beats the pooled blind-under baseline while adding no information at all.

  CELL-MATCHED    the decisive test. Compare the selection against blind under REWEIGHTED
                  to the selection's own market x line-bucket mix. If the delta survives,
                  the model is picking props within a cell; if it collapses, it was
                  picking cells.
  SECOND-BEST     the control that killed shopping and combo-consistency in this folder.
                  A real edge degrades gracefully one rung down the book list.
  PER-SEASON      pooled numbers hide late-year decay. 2025-26 is the season that matters.
  MAINSTREAM      restricted to books a user can actually reach.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
MODELS = ["ridge", "qreg", "stack", "clf", "resid", "mlp"]
CUTS = (25, 10, 5)
NBUCK = 6


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def cell_matched_blind(D, sel, cellcol, lc, du):
    """Blind under, reweighted to the SELECTION's own cell mix.

    This is the whole point of the run. Blind under on the full population answers "is
    the under good?", which is a known yes. Blind under inside the same market x
    line-bucket cells answers "is the under better on the props this model picked than on
    the props it passed?" -- which is the only question that separates information from
    cell-picking.
    """
    y = (D["actual"] < D[lc]).to_numpy(dtype=float)
    dec = D[du].to_numpy(dtype=float)
    live = (D["actual"] != D[lc]).to_numpy() & np.isfinite(dec) & np.isfinite(y)
    cells = D[cellcol].to_numpy()
    tot, wsum = 0.0, 0.0
    for c, w in pd.Series(cells[sel & live]).value_counts().items():
        k = live & (cells == c)
        if k.sum() < 30:
            continue
        tot += w * roi(y[k], dec[k])
        wsum += w
    return tot / wsum if wsum else np.nan


def main():
    panel = pd.read_parquet(f"{OUT}/nba_props_panel.parquet").rename(
        columns={"season_x": "season"})
    panel["date"] = pd.to_datetime(panel["date"])
    from nba_props_combo_exec import per_book, ranked, MAINSTREAM
    pb = per_book()
    R = ranked(pb)
    Rm = ranked(pb[pb["book"].isin(MAINSTREAM)])

    keep = ["event_id", "market", "pkey", "date", "season", "actual", "cons_line",
            "cons_over_dec", "cons_under_dec", "cons_p_over"]
    base = panel[keep].drop_duplicates(["event_id", "market", "pkey"])

    rows = []
    for f in sorted(os.listdir(OUT)):
        if not f.startswith("nba_props_stack_player_"):
            continue
        S = pd.read_parquet(os.path.join(OUT, f))
        mk = S["market"].iloc[0]
        S = S.drop(columns=["date"]).merge(base, on=["event_id", "market", "pkey"],
                                           how="inner")
        S = S.merge(R, on=["event_id", "market", "pkey"], how="left")
        S = S.merge(Rm.rename(columns=lambda c: "m_" + c if c.startswith(("u", "o"))
                              else c), on=["event_id", "market", "pkey"], how="left")
        S = S.dropna(subset=["cons_line", "actual", "cons_p_over"]).reset_index(drop=True)
        if len(S) < 5000:
            continue

        # cells: market is fixed inside this loop, so the cell IS the line bucket. Bucket
        # on the line itself, not the model's view of it, or the cells move with the model
        q = np.unique(np.quantile(S["cons_line"], np.linspace(0, 1, NBUCK + 1)))
        S["_cell"] = np.clip(np.digitize(S["cons_line"], q[1:-1]), 0, len(q) - 2)

        for name in MODELS:
            pc = f"_p_{name}"
            if pc not in S.columns or S[pc].notna().sum() < 2000:
                continue
            conf = (S["cons_p_over"] - S[pc]).to_numpy()   # model says the line is high
            ok = np.isfinite(conf)
            for pct in CUTS:
                thr = np.nanquantile(conf[ok], 1 - pct / 100)
                sel = ok & (conf >= thr)
                for venue, lc, du in (("cons", "cons_line", "cons_under_dec"),
                                      ("best", "u0_line", "u0_dec"),
                                      ("second", "u1_line", "u1_dec"),
                                      ("main", "m_u0_line", "m_u0_dec")):
                    if lc not in S.columns:
                        continue
                    live = sel & (S["actual"] != S[lc]).to_numpy() \
                        & np.isfinite(S[du].to_numpy(dtype=float))
                    if live.sum() < 200:
                        continue
                    y = (S["actual"] < S[lc]).to_numpy(dtype=float)[live]
                    dec = S[du].to_numpy(dtype=float)[live]
                    full = S["actual"] != S[lc]
                    full &= np.isfinite(S[du].to_numpy(dtype=float))
                    blind_all = roi((S["actual"] < S[lc]).to_numpy(dtype=float)[full],
                                    S[du].to_numpy(dtype=float)[full])
                    blind_cell = cell_matched_blind(S, sel, "_cell", lc, du)
                    per = {}
                    for ss in sorted(S["season"].unique()):
                        k = (S["season"].to_numpy()[live] == ss)
                        if k.sum() >= 200:
                            per[ss] = roi(y[k], dec[k])
                    rows.append(dict(
                        market=mk, model=name, cut=f"top{pct}%", venue=venue,
                        n=int(live.sum()), win=100 * y.mean(), roi=roi(y, dec),
                        blind_all=blind_all, blind_cell=blind_cell,
                        delta_all=roi(y, dec) - blind_all,
                        delta_cell=roi(y, dec) - blind_cell,
                        per="/".join(f"{v:+.1f}" for v in per.values())))
        print(f"  {mk}: done", flush=True)

    T = pd.DataFrame(rows)
    T.to_csv(os.path.join(ROOT, "nba_props_under_control_results.csv"), index=False)

    L = ["# NBA props — the under-selection control", "",
         "The stack's one-sided under-selection was the only positive result in the props "
         "programme: positive at CONSENSUS, which no shopping artifact can be. This is "
         "the pre-registered control on it.", "",
         "`delta all` is the original comparator: blind under on the whole population. "
         "`delta cell` reweights blind under to the selection's own market x line-bucket "
         "mix, and is the number that decides the question. If the model is picking "
         "PROPS, `delta cell` survives. If it is picking CELLS where the standing "
         "over-shade is strongest, `delta cell` goes to zero and the finding is a "
         "restatement of a bias we already knew about.", ""]

    for venue in ("cons", "best", "second", "main"):
        s0 = T[T["venue"] == venue]
        if not len(s0):
            continue
        L += [f"\n## Pooled across markets — {venue}\n",
              "| model | cut | n | win% | ROI | blind all | delta all | blind cell | "
              "delta cell |", "|---|---|---|---|---|---|---|---|---|"]
        for name in MODELS:
            for pct in CUTS:
                s = s0[(s0["model"] == name) & (s0["cut"] == f"top{pct}%")].dropna(
                    subset=["roi"])
                n = s["n"].sum()
                if n < 1000:
                    continue
                w = lambda c: (s[c] * s["n"]).sum() / n              # noqa: E731
                L.append(f"| {name} | top{pct}% | {n:,} | {w('win'):.2f} | "
                         f"{w('roi'):+.2f} | {w('blind_all'):+.2f} | "
                         f"{w('roi')-w('blind_all'):+.2f} | {w('blind_cell'):+.2f} | "
                         f"**{w('roi')-w('blind_cell'):+.2f}** |")

    L += ["\n## Per market — ridge, top10%, consensus\n",
          "| market | n | win% | ROI | delta all | delta cell | ROI by season |",
          "|---|---|---|---|---|---|---|"]
    for _, r in T[(T["model"] == "ridge") & (T["cut"] == "top10%")
                  & (T["venue"] == "cons")].sort_values("market").iterrows():
        L.append(f"| {r['market']} | {r['n']:,} | {r['win']:.2f} | {r['roi']:+.2f} | "
                 f"{r['delta_all']:+.2f} | **{r['delta_cell']:+.2f}** | {r['per']} |")

    path = os.path.join(ROOT, "NBA_PROPS_UNDER_CONTROL_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
