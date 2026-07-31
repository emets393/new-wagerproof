#!/usr/bin/env python3
"""Every remaining market, priced off the full-game model's margin and total.

`nba_open_model.py` produces two numbers per game: a predicted margin and a predicted
total. Those two numbers imply a price for every other market on the board, so nothing
here refits a model -- it PROJECTS the existing one and asks where the projection pays.

  MONEYLINE   P(home win) = P(margin > 0), from the empirical distribution of the model's
              own margin residuals. Graded at the open ML price.
  TEAM TOTALS predicted team score = (total +/- margin) / 2.
  1H SPREAD   the full-game number scaled by the share of itself that lands in the first
  1H TOTAL    half, estimated walk-forward from strictly earlier games.

The 1H projection is the one with a real prior behind it. Every NBA edge this project has
ever validated -- S7 and S8 both -- lives in a first-half derivative, and both died when
the same idea was tested on the full-game market. The mechanism is that the 1H line is not
independently handicapped; it is generated from the full-game number by a rule. So a
full-game model that is only mildly better than the opener can still be meaningfully
better than the 1H line derived from it, because the derivation adds its own error.

Empirical residual CDFs everywhere rather than a normal: NBA margins are close to normal
but totals are not, and the ML prices at the extremes are exactly where a normal tail
assumption would quietly invent an edge.

CAVEAT, stated up front: only the moneyline has an OPENING price in this data. The 1H and
team-total markets exist at T-60 only, so those cells are graded against the close and
carry the full difficulty that implies. They are labelled accordingly and must not be read
as if they were open-line results.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
PRED = os.environ.get("PRED", "p_blend")
MIN_HIST = 800


def american_to_dec(a):
    """Decimal odds, whichever format the column is actually in.

    The price columns in nba_model_features are ALREADY decimal (spread/total sit at
    1.909, i.e. -110). Blind-converting them as American turns 1.909 into 1.019 and
    every ROI comes out near -49% at a 50% win rate. Anything in [1.01, 40] is a
    decimal price -- American odds never live there.
    """
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def devig(do, du):
    """Two-way de-vig in probability space, proportional to the raw implied prices."""
    po, pu = 1 / do, 1 / du
    return po / (po + pu)


def resid_cdf_prob(D, pcol, ycol, thrcol, greater=True):
    """P(outcome > threshold) from the model's own residuals, walk-forward by month.

    Uses only residuals from STRICTLY EARLIER months, so the distribution the bet is
    priced against never contains the game being priced.
    """
    D = D.sort_values("date").reset_index(drop=True)
    mo = D["date"].dt.to_period("M")
    out = np.full(len(D), np.nan)
    for m in sorted(mo.unique()):
        te = np.where(mo == m)[0]
        tr = np.where(mo < m)[0]
        if len(te) == 0 or len(tr) < MIN_HIST:
            continue
        r = np.sort((D[ycol].to_numpy()[tr] - D[pcol].to_numpy()[tr]))
        r = r[~np.isnan(r)]
        if len(r) < MIN_HIST:
            continue
        need = D[thrcol].to_numpy()[te] - D[pcol].to_numpy()[te]
        p = 1.0 - np.searchsorted(r, need, side="right") / len(r)
        out[te] = p if greater else 1.0 - p
    D["_p"] = out
    return D


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def report(L, title, note, rows):
    L += [f"\n## {title}\n", note, "",
          "| cut | n | win% | ROI | edge sign | per-season |", "|---|---|---|---|---|---|"]
    L += rows


def grade_prob(d, p, dec_a, dec_b, win_a, seasons, pcts=(100, 50, 25, 10)):
    """Bet side A when p exceeds the market's de-vigged price, side B when it falls short."""
    rows = []
    mkt = devig(dec_a, dec_b)
    edge = p - mkt
    ok = np.isfinite(edge) & np.isfinite(dec_a) & np.isfinite(dec_b) & np.isfinite(win_a)
    if ok.sum() < 200:
        return rows
    for pct in pcts:
        thr = np.quantile(np.abs(edge[ok]), 1 - pct / 100) if pct < 100 else -1
        m = ok & (np.abs(edge) >= thr)
        if m.sum() < 60:
            continue
        a = edge[m] > 0
        win = np.where(a, win_a[m], 1 - win_a[m])
        dec = np.where(a, dec_a[m], dec_b[m])
        per = []
        ss = d["season"].to_numpy()[m]
        for s in seasons:
            k = ss == s
            per.append(f"{100*win[k].mean():.0f}" if k.sum() >= 25 else "-")
        rows.append(f"| top{pct}% | {m.sum():,} | {100*win.mean():.1f} | "
                    f"{roi(win, dec):+.1f} | {100*a.mean():.0f}% A | {'/'.join(per)} |")
    return rows


def main():
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    F["date"] = pd.to_datetime(F["date"])
    F["season"] = F["season"].astype(str)
    # 45 game ids are joined to two different odds events apiece (one game carrying both a
    # +2.25 and a +4.00 open spread). The targets agree, so it is the odds join that is
    # wrong and there is no way to pick the right line -- and merging on game.id without
    # dropping them fans every prediction out into duplicate graded bets.
    F = F[~F["game.id"].isin(set(F.loc[F.duplicated("game.id", keep=False), "game.id"]))]
    Mp = pd.read_parquet(f"{OUT}/nba_open_margin_preds.parquet")[["game.id", PRED]] \
        .rename(columns={PRED: "m_pred"})
    Tp = pd.read_parquet(f"{OUT}/nba_open_total_preds.parquet")[["game.id", PRED]] \
        .rename(columns={PRED: "t_pred"})
    D = F.merge(Mp, on="game.id", how="inner").merge(Tp, on="game.id", how="inner")
    D = D[D["m_pred"].notna() & D["t_pred"].notna()].sort_values("date").reset_index(
        drop=True)
    seasons = sorted(D["season"].unique())
    print(f"{len(D):,} games with both predictions, seasons {seasons}", flush=True)

    L = ["# NBA — every remaining market, projected from the full-game model", "",
         f"{len(D):,} games, seasons {seasons}, predictions from `{PRED}`. Nothing is "
         "refit here: the margin and total models are projected into each market and "
         "priced off their own empirical residual distribution, walk-forward.", "",
         "**Only the moneyline has an opening price in this data.** The 1H and team-total "
         "sections are graded at T-60 and inherit all the difficulty of betting into the "
         "close; they are not open-line results and must not be read as such.", ""]

    # ------------------------------------------------------------------------ MONEYLINE
    d = D.dropna(subset=["open_ml_home_price", "open_ml_away_price"]).copy()
    d["_z"] = 0.0                                  # the moneyline threshold is margin > 0
    d = resid_cdf_prob(d, "m_pred", "y_fg_margin", "_z", greater=True)
    dh, da = american_to_dec(d["open_ml_home_price"]), american_to_dec(
        d["open_ml_away_price"])
    rows = grade_prob(d, d["_p"].to_numpy(), dh, da,
                      (d["y_fg_margin"] > 0).to_numpy(dtype=float), seasons)
    report(L, "MONEYLINE — open price (side A = home)",
           "P(home win) = P(margin > 0) from the margin model's own residual CDF, against "
           "the de-vigged opening moneyline.", rows)

    # ---------------------------------------------------------------------- TEAM TOTALS
    d = D.dropna(subset=["tt_h", "tt_a", "tt_h_o", "tt_h_u"]).copy()
    if len(d) > 500:
        d["h_pred"] = (d["t_pred"] + d["m_pred"]) / 2
        d["y_home_pts_"] = d["y_home_pts"]
        d = resid_cdf_prob(d, "h_pred", "y_home_pts_", "tt_h", greater=True)
        rows = grade_prob(d, d["_p"].to_numpy(), american_to_dec(d["tt_h_o"]),
                          american_to_dec(d["tt_h_u"]),
                          (d["y_home_pts"] > d["tt_h"]).to_numpy(dtype=float), seasons)
        report(L, "HOME TEAM TOTAL — T-60 (side A = over)",
               "Predicted home score = (predicted total + predicted margin) / 2.", rows)

    # -------------------------------------------------------------- 1H, the derivative
    # The 1H line is generated FROM the full-game number, not handicapped independently,
    # so the derivation contributes its own error on top of the full-game line's. That is
    # the whole reason S7 and S8 survive in the first half and die in the full game.
    d = D.dropna(subset=["h1_spread", "h1_total_line", "y_h1_margin",
                         "y_h1_total"]).copy()
    if len(d) > 500:
        d = d.sort_values("date").reset_index(drop=True)
        mo = d["date"].dt.to_period("M")
        d["sh_tot"] = np.nan
        d["sh_marg"] = np.nan
        for m in sorted(mo.unique()):
            te, tr = np.where(mo == m)[0], np.where(mo < m)[0]
            if len(te) == 0 or len(tr) < 300:
                continue
            d.loc[d.index[te], "sh_tot"] = (d["y_h1_total"].iloc[tr]
                                            / d["y_fg_total"].iloc[tr]).mean()
            d.loc[d.index[te], "sh_marg"] = (d["y_h1_margin"].iloc[tr].sum()
                                             / d["y_fg_margin"].iloc[tr].sum())
        d = d[d["sh_tot"].notna()].reset_index(drop=True)
        d["h1t_pred"] = d["t_pred"] * d["sh_tot"]
        d["h1m_pred"] = d["m_pred"] * d["sh_marg"]

        e = resid_cdf_prob(d.copy(), "h1t_pred", "y_h1_total", "h1_total_line",
                           greater=True)
        rows = grade_prob(e, e["_p"].to_numpy(), american_to_dec(e["h1_ov"]),
                          american_to_dec(e["h1_un"]),
                          (e["y_h1_total"] > e["h1_total_line"]).to_numpy(dtype=float),
                          seasons)
        report(L, "1H TOTAL — T-60 (side A = over)",
               "Full-game total scaled by the first-half share of the total, estimated "
               "walk-forward.", rows)

        # h1_spread is the HOME first-half spread, so the home side needs margin > -line
        e = d.copy()
        e["_thr"] = -e["h1_spread"]
        e = resid_cdf_prob(e, "h1m_pred", "y_h1_margin", "_thr", greater=True)
        rows = grade_prob(e, e["_p"].to_numpy(), american_to_dec(e["h1_sp_h"]),
                          american_to_dec(e["h1_sp_a"]),
                          (e["y_h1_margin"] > -e["h1_spread"]).to_numpy(dtype=float),
                          seasons)
        report(L, "1H SPREAD — T-60 (side A = home)",
               "Full-game margin scaled by the first-half share of the margin, estimated "
               "walk-forward.", rows)

    path = os.path.join(ROOT, "NBA_OPEN_MARKETS_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
