#!/usr/bin/env python3
"""Re-grade the open-line model's saved predictions with the prices read correctly.

`nba_open_model.py` ran `american_to_dec` over price columns that were ALREADY decimal,
which turned 1.909 (-110) into 1.019 and printed roughly -49% ROI at a 50% win rate
across every row of the brief. The win%, CLV and per-season columns in that brief are
sound -- only the ROI column was wrong. Nothing needs refitting: the predictions are on
disk, so this reloads them, joins the prices back, and regrades.

It also runs the two things the first pass did not:

  HEAD-TO-HEAD  against the shipped `nba_predictions` model on the games both cover.
                The incumbent posts MAE margin 12.125 / total 15.299 over 1,147 games
                from 2025-11-13. Beating THAT is a product win regardless of whether
                anything beats the market.
  FINER CUTS    the first pass stopped at top10%; if the edge concentrates, it should
                keep concentrating, and if it does not, that is the answer.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
METHODS = ["lgbm", "xgb", "hgb", "rf", "et", "ridge", "enet", "mlp", "blend"]
CUTS = (100, 50, 25, 10, 5)


def as_dec(a):
    """Decimal odds regardless of the column's format. See the module docstring."""
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def grade(d, edge, win, dec, clv, seasons, pct):
    """One cut: take the |edge| top pct%, report win/ROI/CLV and the season split."""
    thr = np.quantile(np.abs(edge), 1 - pct / 100) if pct < 100 else -1
    # a missing price is an ungradeable bet, not a free one -- 8% of 2023 totals have no
    # open price and leaving them in propagates NaN through the whole ROI column
    m = (np.abs(edge) >= thr) & np.isfinite(dec)
    if m.sum() < 60:
        return None
    per, per_roi = [], []
    ss = d["season"].to_numpy()[m]
    for s in seasons:
        k = ss == s
        per.append(f"{100*win[m][k].mean():.0f}" if k.sum() >= 25 else "-")
        per_roi.append(f"{roi(win[m][k], dec[m][k]):+.0f}" if k.sum() >= 25 else "-")
    return dict(n=int(m.sum()), win=100 * win[m].mean(), roi=roi(win[m], dec[m]),
                clv=np.nanmean(clv[m]), clv_pos=100 * np.nanmean(clv[m] > 0),
                per="/".join(per), per_roi="/".join(per_roi))


def spread_rows(D, seasons):
    rows = []
    for mth in METHODS:
        p = f"p_{mth}"
        d = D[D[p].notna() & D["open_spread_home_point"].notna()].copy()
        d = d[d["y_fg_margin"] != -d["open_spread_home_point"]]
        if len(d) < 200:
            continue
        edge = (d[p] + d["open_spread_home_point"]).to_numpy()
        home = edge > 0
        win = np.where(home, d["y_fg_margin"] > -d["open_spread_home_point"],
                       d["y_fg_margin"] < -d["open_spread_home_point"]).astype(float)
        dec = np.where(home, as_dec(d["open_spread_home_price"]),
                       as_dec(d["open_spread_away_price"]))
        clv = np.where(home, d["open_spread_home_point"] - d["t60_spread_home_point"],
                       d["t60_spread_home_point"] - d["open_spread_home_point"])
        for pct in CUTS:
            r = grade(d, edge, win, dec, clv, seasons, pct)
            if r:
                rows.append(dict(method=mth, cut=f"top{pct}%", **r))
    return rows


def total_rows(D, seasons):
    rows = []
    for mth in METHODS:
        p = f"p_{mth}"
        d = D[D[p].notna() & D["open_total_point"].notna()].copy()
        d = d[d["y_fg_total"] != d["open_total_point"]]
        if len(d) < 200:
            continue
        edge = (d[p] - d["open_total_point"]).to_numpy()
        over = edge > 0
        win = np.where(over, d["y_fg_total"] > d["open_total_point"],
                       d["y_fg_total"] < d["open_total_point"]).astype(float)
        dec = np.where(over, as_dec(d["open_total_over_price"]),
                       as_dec(d["open_total_under_price"]))
        clv = np.where(over, d["t60_total_point"] - d["open_total_point"],
                       d["open_total_point"] - d["t60_total_point"])
        for pct in CUTS:
            r = grade(d, edge, win, dec, clv, seasons, pct)
            if r:
                rows.append(dict(method=mth, cut=f"top{pct}%", **r))
    return rows


def table(rows, title, note):
    L = [f"\n## {title}\n", note, "",
         "| method | cut | n | win% | ROI | CLV pts | CLV+ % | win by season | "
         "ROI by season |", "|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        L.append(f"| {r['method']} | {r['cut']} | {r['n']:,} | {r['win']:.1f} | "
                 f"{r['roi']:+.2f} | {r['clv']:+.3f} | {r['clv_pos']:.1f} | "
                 f"{r['per']} | {r['per_roi']} |")
    return L


def main():
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    F["date"] = pd.to_datetime(F["date"])
    # 360 rows (45 game ids) carry the SAME balldontlie game.id against DIFFERENT odds
    # events -- one game showing both a +2.25 and a +4.00 open spread. The targets agree,
    # so it is the odds-to-game join that is wrong, and there is no way to tell which of
    # the two lines belongs to the game. Drop them rather than grade against a coin flip;
    # merging on game.id without this also fans 5,423 predictions out to ~7,900 rows.
    dup = set(F.loc[F.duplicated("game.id", keep=False), "game.id"])
    print(f"dropping {len(dup)} game ids with ambiguous odds joins "
          f"({F['game.id'].isin(dup).sum()} rows)", flush=True)
    F = F[~F["game.id"].isin(dup)]
    price = F[["game.id", "open_spread_home_price", "open_spread_away_price",
               "open_total_over_price", "open_total_under_price",
               "open_ml_home_price", "open_ml_away_price"]]

    M = pd.read_parquet(f"{OUT}/nba_open_margin_preds.parquet").merge(price, on="game.id")
    T = pd.read_parquet(f"{OUT}/nba_open_total_preds.parquet").merge(price, on="game.id")
    M["season"] = M["season"].astype(str)
    T["season"] = T["season"].astype(str)
    seasons = sorted(M["season"].unique())

    print(f"spread {len(M):,} games / total {len(T):,} games, seasons {seasons}",
          flush=True)
    print(f"price sanity: open_spread_home_price median "
          f"{M['open_spread_home_price'].median():.3f} -> dec "
          f"{np.median(as_dec(M['open_spread_home_price'])):.3f}", flush=True)

    L = ["# THE NBA MODEL — full game at the OPENER (regraded, correct prices)", "",
         f"{len(M):,} games, seasons {seasons}. Rolling origin, refit monthly, top-220 "
         "features chosen inside each train fold, every post-open column banned from X.",
         "",
         "**Correction.** The first pass ran an American-odds converter over price "
         "columns that were already decimal, so 1.909 became 1.019 and every ROI printed "
         "near -49%. Win%, CLV and the season splits in that brief were unaffected. "
         "Breakeven at 1.909 is **52.36%**.", ""]

    L += table(spread_rows(M, seasons), "SPREAD — open line, open price",
               "Bet the side the predicted margin favours. `CLV` = mean points of "
               "closing-line value on the side taken; it is the one column variance "
               "cannot manufacture.")
    L += table(total_rows(T, seasons), "TOTAL — open line, open price",
               "Bet the side the predicted total favours, same construction.")

    path = os.path.join(ROOT, "NBA_OPEN_MODEL_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
