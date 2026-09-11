#!/usr/bin/env python3
"""
NFL 2H deep study — decompose how the halftime line is made and test whether the
market's in-game learning is optimal (owner push 2026-09-11).

Sign conventions (oracle-checked):
  fg_sp / h1_sp_close are HOME-relative spreads (negative = home favored).
  E_M  = -fg_sp        expected full-game home margin (pregame)
  E_M1 = -h1_sp_close  expected 1H home margin (pregame)
  E_M2_pre = E_M - E_M1        the pregame 2H expectation (no halftime info)
  S    = h1m - E_M1            the 1H margin SURPRISE
  E_M2_mkt = -close_h2_spread  what the halftime market posts
  Totals analog: E_T2_pre = fg_tot - h1_tot_close, S_T = h1t - h1_tot_close.

Sections:
  1. LEARNING RATE: market's update per point of 1H surprise vs reality's.
  2. NESTED LOSO MODEL: does ANY feature (pregame expectation, surprise, our
     1H model) beat the posted 2H line out-of-season? Edge buckets ATS.
  3. FOOTBALL MECHANISMS: coasting favorite (already covered FG number at
     half), garbage-time blowouts (2H total), shootout persistence.
  4. BOOK DISPERSION: when one book is >=1pt off the 2H consensus, does its
     direction win? (cross-book disagreement was the one real CFB move edge)
"""
import os
import numpy as np
import pandas as pd

import exp_2h_nfl as X

HERE = os.path.dirname(os.path.abspath(__file__))


def load():
    f2 = pd.read_parquet(os.path.join(HERE, "data", "nfl_2h_frame.parquet"))
    f2["home_ab"] = f2.home.map(X.NAME_AB)
    f2["gameday"] = (pd.to_datetime(f2.commence) - pd.Timedelta(hours=9)).dt.strftime("%Y-%m-%d")
    h1 = pd.read_parquet(os.path.join(X.NFLX, "data", "h1m_preds.parquet"))
    qs = pd.read_parquet(os.path.join(X.NFLX, "data", "quarter_scores.parquet"))
    h1 = h1.merge(qs[["game_id", "h1_home", "h1_away", "final_home", "final_away"]], on="game_id")
    h1["gameday"] = pd.to_datetime(h1.gameday).dt.strftime("%Y-%m-%d")
    d = f2.merge(h1, on=["gameday", "home_ab"], how="inner", suffixes=("", "_h1"))
    d["h1m"] = d.h1_home - d.h1_away
    d["h1t"] = d.h1_home + d.h1_away
    d["h2m"] = (d.final_home - d.h1_home) - (d.final_away - d.h1_away)
    d["h2t"] = (d.final_home + d.final_away) - d.h1t
    d["E_M"] = -d.fg_sp
    d["E_M1"] = -d.h1_sp_close
    d["E_M2_pre"] = d.E_M - d.E_M1
    d["S"] = d.h1m - d.E_M1
    d["E_M2_mkt"] = -d.close_h2_spread
    d["E_T2_pre"] = d.fg_tot - d.h1_tot_close
    d["S_T"] = d.h1t - d.h1_tot_close
    return d.dropna(subset=["close_h2_spread", "close_h2_total", "fg_sp", "h1_sp_close"]).reset_index(drop=True)


def ols(y, Xm):
    Xm = np.column_stack([Xm, np.ones(len(y))])
    b, *_ = np.linalg.lstsq(Xm, y, rcond=None)
    resid = y - Xm @ b
    se = np.sqrt(np.diag(np.linalg.inv(Xm.T @ Xm)) * (resid ** 2).sum() / (len(y) - Xm.shape[1]))
    return b, se


def bucket_ats(name, d, edge, win_home_float, prices_home, th_list=(1.0, 1.5, 2.0)):
    """edge > 0 -> bet HOME 2H side; < 0 -> AWAY. Reports both tails per threshold."""
    for th in th_list:
        for side, m in (("HOME", edge >= th), ("AWAY", edge <= -th)):
            w = win_home_float if side == "HOME" else 1 - win_home_float
            pr = prices_home if side == "HOME" else pd.Series(-110.0, index=d.index)
            mm = m & w.notna()
            n = int(mm.sum())
            if n < 25:
                continue
            ww = w[mm].astype(float)
            p = pr[mm].fillna(-110.0)
            dec = np.where(p > 0, 1 + p / 100, 1 + 100 / (-p))
            roi = np.where(ww > 0.5, dec - 1, -1.0).mean()
            per = " | ".join(f"{yr}:{100*ww[d.season[mm]==yr].mean():.0f}%" for yr in sorted(d.season[mm].unique()))
            print(f"  {name} edge>={th} bet {side:4s}: n={n:3d}  win {100*ww.mean():.1f}%  roi {100*roi:+.1f}%   {per}")


def main():
    d = load()
    n = len(d)
    print(f"frame: {n} games 2023-25\n")

    # ---- 1. LEARNING RATE ------------------------------------------------
    print("== 1. how the market makes the 2H line, vs how it should ==")
    b_mkt, se_mkt = ols(d.E_M2_mkt - d.E_M2_pre, np.column_stack([d.S, d.E_M2_pre]))
    b_act, se_act = ols(d.h2m - d.E_M2_pre, np.column_stack([d.S, d.E_M2_pre]))
    print(f"SPREAD: market update = {b_mkt[0]:+.3f} pts per 1H-surprise pt (se {se_mkt[0]:.3f}), "
          f"drift on pregame exp {b_mkt[1]:+.3f}")
    print(f"        reality       = {b_act[0]:+.3f} (se {se_act[0]:.3f}), drift {b_act[1]:+.3f}")
    b_mktT, se_mktT = ols(d.close_h2_total - d.E_T2_pre, np.column_stack([d.S_T, d.E_T2_pre]))
    b_actT, se_actT = ols(d.h2t - d.E_T2_pre, np.column_stack([d.S_T, d.E_T2_pre]))
    print(f"TOTAL : market update = {b_mktT[0]:+.3f} per 1H-total-surprise pt (se {se_mktT[0]:.3f}), "
          f"drift {b_mktT[1]:+.3f}")
    print(f"        reality       = {b_actT[0]:+.3f} (se {se_actT[0]:.3f}), drift {b_actT[1]:+.3f}")
    print("  (market coef > reality coef = OVERREACTION to the 1H; < = underreaction)")

    # persistence facts the lines imply
    r_h1_h2m = np.corrcoef(d.h1m, d.h2m)[0, 1]
    r_h1_h2t = np.corrcoef(d.h1t, d.h2t)[0, 1]
    print(f"  raw persistence: corr(1H margin, 2H margin) {r_h1_h2m:+.3f} | corr(1H total, 2H total) {r_h1_h2t:+.3f}")

    # ---- 2. NESTED LOSO: can anything beat the posted line? --------------
    print("\n== 2. nested LOSO — does any feature add to the posted 2H line? ==")
    sp_diff = d.h2m + d.close_h2_spread
    win_home = pd.Series(np.where(sp_diff == 0, np.nan, (sp_diff > 0).astype(float)), index=d.index)
    tot_diff = d.h2t - d.close_h2_total
    win_over = pd.Series(np.where(tot_diff == 0, np.nan, (tot_diff > 0).astype(float)), index=d.index)

    feats_sp = ["E_M2_mkt", "E_M2_pre", "S", "pred_m"]      # pred_m = our pregame 1H-margin model
    feats_to = ["close_h2_total", "E_T2_pre", "S_T", "resid_tot"]
    for lbl, target, feats, base in (("SPREAD (h2m)", "h2m", feats_sp, "E_M2_mkt"),
                                     ("TOTAL (h2t)", "h2t", feats_to, "close_h2_total")):
        preds_full = pd.Series(np.nan, index=d.index)
        preds_base = pd.Series(np.nan, index=d.index)
        for yr in sorted(d.season.unique()):
            tr, te = d.season != yr, d.season == yr
            bb, _ = ols(d.loc[tr, target].values, d.loc[tr, [base]].values)
            preds_base[te] = np.column_stack([d.loc[te, [base]].values, np.ones(te.sum())]) @ bb
            bf, _ = ols(d.loc[tr, target].values, d.loc[tr, feats].values)
            preds_full[te] = np.column_stack([d.loc[te, feats].values, np.ones(te.sum())]) @ bf
        rmse_b = float(np.sqrt(((d[target] - preds_base) ** 2).mean()))
        rmse_f = float(np.sqrt(((d[target] - preds_full) ** 2).mean()))
        print(f"{lbl}: LOSO rmse line-only {rmse_b:.2f} -> +features {rmse_f:.2f} "
              f"({'ADDS INFO' if rmse_f < rmse_b else 'no add'})")
        if lbl.startswith("SPREAD"):
            edge = preds_full - d.E_M2_mkt
            bucket_ats("model-vs-2H-line", d, edge, win_home, d.close_h2_spread_home_price)
        else:
            edge = preds_full - d.close_h2_total
            for th in (1.0, 1.5, 2.0):
                for side, m, w, pr in (("OVER", edge >= th, win_over, d.close_h2_over_price),
                                       ("UNDER", edge <= -th, 1 - win_over, d.close_h2_under_price)):
                    mm = m & w.notna()
                    if mm.sum() < 25:
                        continue
                    ww = w[mm].astype(float)
                    p = pr[mm].fillna(-110.0)
                    dec = np.where(p > 0, 1 + p / 100, 1 + 100 / (-p))
                    roi = np.where(ww > 0.5, dec - 1, -1.0).mean()
                    per = " | ".join(f"{yr}:{100*ww[d.season[mm]==yr].mean():.0f}%"
                                     for yr in sorted(d.season[mm].unique()))
                    print(f"  total model edge>={th} bet {side:5s}: n={int(mm.sum()):3d}  "
                          f"win {100*ww.mean():.1f}%  roi {100*roi:+.1f}%   {per}")

    # ---- 3. FOOTBALL MECHANISMS -----------------------------------------
    print("\n== 3. football mechanisms ==")
    fav_home = d.fg_sp < 0
    fav_m = np.where(fav_home, d.h1m, -d.h1m)                # favorite's halftime margin
    fav_lay = d.fg_sp.abs()
    coast = pd.Series(fav_m >= fav_lay + 3, index=d.index)   # fav already beat its FG number
    dog_cover = pd.Series(np.where(fav_home, 1 - win_home, win_home), index=d.index)
    mm = coast & dog_cover.notna()
    ww = dog_cover[mm].astype(float)
    per = " | ".join(f"{yr}:{100*ww[d.season[mm]==yr].mean():.0f}%" for yr in sorted(d.season[mm].unique()))
    print(f"COASTING FAV (fav margin >= lay+3 at half): bet 2H DOG  n={int(mm.sum())}  "
          f"win {100*ww.mean():.1f}%   {per}")

    blow = d.h1m.abs() >= 14
    mo = blow & win_over.notna()
    wo = win_over[mo].astype(float)
    print(f"GARBAGE TIME (|1H margin|>=14): 2H OVER {100*wo.mean():.1f}% (n={int(mo.sum())}) "
          f"-> UNDER {100*(1-wo.mean()):.1f}%")
    shoot = (d[["h1_home", "h1_away"]].min(axis=1) >= 13)
    ms = shoot & win_over.notna()
    ws = win_over[ms].astype(float)
    print(f"SHOOTOUT (both >=13 at half): 2H OVER {100*ws.mean():.1f}% (n={int(ms.sum())})")
    dead = (d.h1t <= 13)
    md = dead & win_over.notna()
    wd = win_over[md].astype(float)
    print(f"DEAD GAME (1H total <=13): 2H OVER {100*wd.mean():.1f}% (n={int(md.sum())})")

    # ---- 4. BOOK DISPERSION ----------------------------------------------
    print("\n== 4. per-book dispersion on the 2H spread (close snapshot) ==")
    raw = pd.read_parquet(os.path.join(HERE, "data", "nfl_2h_raw.parquet"))
    raw = raw[raw.fresh & (raw.market == "spreads_h2")]
    rows = []
    for (eid), g in raw.groupby("event_id"):
        g = g[g.snap_ts == g.snap_ts.max()]
        home = g.home.iloc[0]
        gh = g[g.name == home]
        if gh.book.nunique() < 3:
            continue
        med = gh.point.median()
        for _, r in gh.iterrows():
            if abs(r.point - med) >= 1.0:
                rows.append(dict(event_id=eid, book=r.book, off=r.point - med))
    off = pd.DataFrame(rows)
    if len(off):
        off = off.merge(d[["event_id", "season"]].assign(win_home=win_home), on="event_id")
        off = off[off.win_home.notna()]
        # off > 0: this book gives the HOME side MORE points than consensus -> book
        # thinks home side weaker -> its direction = AWAY. Follow the outlier book.
        follow_win = np.where(off.off > 0, 1 - off.win_home.astype(float), off.win_home.astype(float))
        print(f"outlier book >=1pt off consensus: n={len(off)}  follow-outlier win {100*follow_win.mean():.1f}%")
        for bk, g in off.groupby("book"):
            fw = np.where(g.off > 0, 1 - g.win_home.astype(float), g.win_home.astype(float))
            print(f"  {bk:12s} n={len(g):3d}  follow {100*fw.mean():.1f}%")
    else:
        print("no >=1pt outliers with 3+ books")


if __name__ == "__main__":
    main()
