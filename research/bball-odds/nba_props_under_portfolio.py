#!/usr/bin/env python3
"""The under-selection edge as a bettable portfolio, and the last checks before vaulting.

`nba_props_under_control.py` cleared the pre-registered controls, which no other finding
in this props programme has done:

    delta vs blind under, cell-matched   +5.73  (vs +6.31 uncontrolled -- ~9% was cells)
    consensus, no shopping at all        56.27% / +2.59 ROI / n=20,707
    2nd-best line                        +3.42 ROI   -- degrades GRACEFULLY, which is the
                                                        signature the two dead findings
                                                        in this folder failed
    mainstream US books only             +4.46 ROI   -- executable, not offshore-only

Ridge wins at every cut and venue, which is the right shape: the simplest learner beating
the boosters means the signal is smooth and low-dimensional, not a memorised interaction.

What is left before this can be vaulted:

  MARKET SCREEN   two markets are not carrying their weight. rebounds runs -0.1/-0.0/-5.7
                  by season and rebounds_assists -0.7/-3.2/-3.5. Both decay, both are
                  negative in 2025-26. Drop them and re-pool -- and report what the drop
                  is worth, because screening on the same data that found the decay is
                  itself a selection step and has to be named as one.
  SEASON HOLDOUT  the honest version of the market screen: choose the keepers on 2023-24
                  and 2024-25 ONLY, then report 2025-26 as a clean holdout. If the
                  portfolio only works when the screen sees the test season, it is fitted.
  BANKROLL SHAPE  n, bets per day, and the per-season path. A +4% edge on 20k bets is a
                  different product from the same edge on 200.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
MODEL = "_p_ridge"
CUTS = (25, 10, 5)
VENUES = (("cons", "cons_line", "cons_under_dec"), ("best", "u0_line", "u0_dec"),
          ("second", "u1_line", "u1_dec"), ("main", "m_u0_line", "m_u0_dec"))


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def load():
    panel = pd.read_parquet(f"{OUT}/nba_props_panel.parquet").rename(
        columns={"season_x": "season"})
    panel["date"] = pd.to_datetime(panel["date"])
    from nba_props_combo_exec import per_book, ranked, MAINSTREAM
    pb = per_book()
    R = ranked(pb)
    Rm = ranked(pb[pb["book"].isin(MAINSTREAM)])
    base = panel[["event_id", "market", "pkey", "date", "season", "actual", "cons_line",
                  "cons_under_dec", "cons_p_over"]].drop_duplicates(
        ["event_id", "market", "pkey"])
    out = []
    for f in sorted(os.listdir(OUT)):
        if not f.startswith("nba_props_stack_player_"):
            continue
        S = pd.read_parquet(os.path.join(OUT, f)).drop(columns=["date"])
        S = S.merge(base, on=["event_id", "market", "pkey"], how="inner")
        S = S.merge(R, on=["event_id", "market", "pkey"], how="left")
        S = S.merge(Rm.rename(columns=lambda c: "m_" + c if c.startswith(("u", "o"))
                              else c), on=["event_id", "market", "pkey"], how="left")
        out.append(S.dropna(subset=["cons_line", "actual", "cons_p_over", MODEL]))
    D = pd.concat(out, ignore_index=True)
    # rank WITHIN market: markets have wildly different confidence scales, so a global
    # quantile would just hand the whole slate to whichever market has the widest spread
    D["_conf"] = D["cons_p_over"] - D[MODEL]
    D["_pct"] = D.groupby("market")["_conf"].rank(pct=True)
    return D


def grade(D, lc, du):
    live = (D["actual"] != D[lc]) & np.isfinite(D[du].to_numpy(dtype=float))
    d = D[live]
    if len(d) < 100:
        return None
    y = (d["actual"] < d[lc]).to_numpy(dtype=float)
    dec = d[du].to_numpy(dtype=float)
    return len(d), 100 * y.mean(), roi(y, dec), d, y, dec


def main():
    D = load()
    seasons = sorted(D["season"].unique())
    print(f"{len(D):,} scored props, seasons {seasons}", flush=True)

    L = ["# NBA props — the under-selection portfolio", "",
         "One-sided under-selection, ranked by `cons_p_over - p_ridge` **within each "
         "market** so a market with a wide confidence spread cannot swallow the slate. "
         "This is the only finding in the NBA props programme to clear the "
         "cell-matched, 2nd-best-line and mainstream-book controls; see "
         "`NBA_PROPS_UNDER_CONTROL_BRIEF.md`.", ""]

    # --------------------------------------------------------- 1. per-market, per-season
    L += ["## 1 — Per market by season (top10%, consensus)\n",
          "Consensus, not best line: no shopping, so nothing here can be a stale-outlier "
          "artifact. The screen below is built off the first two seasons only.", "",
          "| market | n | win% | ROI | " + " | ".join(f"{s} ROI" for s in seasons) + " |",
          "|---|---|---|---|" + "---|" * len(seasons)]
    keep_stats = {}
    sel = D[D["_pct"] >= 0.90]
    for mk in sorted(D["market"].unique()):
        g = grade(sel[sel["market"] == mk], "cons_line", "cons_under_dec")
        if not g:
            continue
        n, w, r, d, y, dec = g
        per = []
        for s in seasons:
            k = (d["season"] == s).to_numpy()
            per.append(roi(y[k], dec[k]) if k.sum() >= 200 else np.nan)
        keep_stats[mk] = per
        L.append(f"| {mk} | {n:,} | {w:.2f} | {r:+.2f} | "
                 + " | ".join("-" if np.isnan(v) else f"{v:+.2f}" for v in per) + " |")

    # screen on the FIRST TWO seasons only -- screening on all three and then reporting
    # all three is choosing the winners with the answer key in hand
    train_seasons = seasons[:-1]
    holdout = seasons[-1]
    keepers = [mk for mk, per in keep_stats.items()
               if np.nanmean(per[:len(train_seasons)]) > 0]
    dropped = [mk for mk in keep_stats if mk not in keepers]
    L += ["", f"**Screen.** Markets are kept on mean ROI over {train_seasons} ONLY, so "
          f"{holdout} is a clean holdout for the portfolio below.", "",
          f"- keep ({len(keepers)}): {', '.join(keepers)}",
          f"- drop ({len(dropped)}): {', '.join(dropped) or 'none'}", ""]
    print(f"keepers {keepers}\ndropped {dropped}", flush=True)

    # ------------------------------------------------------------- 2. the portfolio
    P = D[D["market"].isin(keepers)]
    L += ["\n## 2 — Portfolio: keeper markets, every cut and venue\n",
          f"`{holdout}` is out of sample for the market screen. `all` is pooled across "
          "seasons and is shown next to the split, never instead of it.", "",
          "| cut | venue | n | win% | ROI all | "
          + " | ".join(f"{s}" for s in seasons) + " | bets/day |",
          "|---|---|---|---|" + "---|" * (len(seasons) + 1)]
    for pct in CUTS:
        S = P[P["_pct"] >= 1 - pct / 100]
        for venue, lc, du in VENUES:
            if lc not in S.columns:
                continue
            g = grade(S, lc, du)
            if not g:
                continue
            n, w, r, d, y, dec = g
            per = []
            for s in seasons:
                k = (d["season"] == s).to_numpy()
                per.append(f"{roi(y[k], dec[k]):+.2f}" if k.sum() >= 200 else "-")
            bpd = n / d["date"].dt.date.nunique()
            L.append(f"| top{pct}% | {venue} | {n:,} | {w:.2f} | {r:+.2f} | "
                     + " | ".join(per) + f" | {bpd:.1f} |")

    # ------------------------------------------------- 3. holdout season, keepers only
    H = P[P["season"] == holdout]
    L += [f"\n## 3 — {holdout} holdout only, keepers chosen without seeing it\n",
          "The number that decides whether the market screen was fitted.", "",
          "| cut | venue | n | win% | ROI |", "|---|---|---|---|---|"]
    for pct in CUTS:
        S = H[H["_pct"] >= 1 - pct / 100]
        for venue, lc, du in VENUES:
            if lc not in S.columns:
                continue
            g = grade(S, lc, du)
            if not g:
                continue
            n, w, r, *_ = g
            L.append(f"| top{pct}% | {venue} | {n:,} | {w:.2f} | {r:+.2f} |")

    # --------------------------------------------- 4. what the market screen was worth
    L += ["\n## 4 — Was the screen worth anything? (top10%, consensus)\n",
          "If dropping the two decaying markets barely moves the number, the screen is "
          "noise and the honest portfolio is all ten markets.", "",
          "| universe | n | win% | ROI all | " + " | ".join(seasons) + " |",
          "|---|---|---|---|" + "---|" * len(seasons)]
    for lab, U in (("all 10 markets", D), ("keepers only", P)):
        g = grade(U[U["_pct"] >= 0.90], "cons_line", "cons_under_dec")
        if not g:
            continue
        n, w, r, d, y, dec = g
        per = []
        for s in seasons:
            k = (d["season"] == s).to_numpy()
            per.append(f"{roi(y[k], dec[k]):+.2f}" if k.sum() >= 200 else "-")
        L.append(f"| {lab} | {n:,} | {w:.2f} | {r:+.2f} | " + " | ".join(per) + " |")

    path = os.path.join(ROOT, "NBA_PROPS_UNDER_PORTFOLIO_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
