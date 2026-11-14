#!/usr/bin/env python3
"""
NCAAF 2H replication battery — the honest test of every NFL 2H finding
(owner program 2026-09-11). Same constructs, ~2.3x the games, softer books.

Joins: ncaaf_2h_frame (Odds API names) -> CFBD school via live /teams
(school+mascot == Odds API name) -> CFBD games line scores (1H/final) ->
model_games_hist (Odds API openers/closers, 2021-25).

CFB has no historical 1H closes, so the 1H expectation uses the fitted share:
E_M1 = a*E_M with a = OLS(h1m ~ E_M) slope (documented deviation from NFL).

Battery (grade vs 2H close consensus, real prices, per-season, oracle):
  B1 blind rates + learning-rate decomposition (market vs reality)
  B2 continuation cells: home dominator, coasting favorite
  B3 totals reversion: hot/cold 1H -> 2H total
  B4 view-shift grid cells (fav 6.5+ improved; big fav crashed)
  B5 outlier-book dispersion (game-level net, dose)
  B6 market bespoke-move construct (dev from its own update rule)
"""
import os
import sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
CFB = os.path.join(HERE, "..", "cfb-model")
sys.path.insert(0, CFB)
import cfbd as CF


def ols(y, Xm):
    Xm = np.column_stack([Xm, np.ones(len(y))])
    b, *_ = np.linalg.lstsq(Xm, y, rcond=None)
    return b


def load():
    f2 = pd.read_parquet(os.path.join(HERE, "data", "ncaaf_2h_frame.parquet"))
    teams = pd.DataFrame(CF.get("/teams"))
    teams["odds_name"] = (teams.school.fillna("") + " " + teams.mascot.fillna("")).str.strip()
    name2school = dict(zip(teams.odds_name, teams.school))
    f2["home_s"] = f2.home.map(name2school)
    f2["away_s"] = f2.away.map(name2school)
    print(f"frame {len(f2)} | name-mapped: home {f2.home_s.notna().mean():.2f} away {f2.away_s.notna().mean():.2f}")

    gs = []
    for y in (2023, 2024, 2025):
        g = pd.read_parquet(os.path.join(CFB, "data", "cfbd", f"games_{y}.parquet"))
        need = g.completed & g.homeLineScores.notna()
        if need.mean() < 0.5:   # stale fetch-once cache -> refetch live
            g = pd.DataFrame(CF.get("/games", year=y, seasonType="both"))
        gs.append(g)
    g = pd.concat(gs, ignore_index=True)
    g = g[g.completed & g.homeLineScores.notna() & g.awayLineScores.notna()].copy()
    g["h1_home"] = g.homeLineScores.apply(lambda x: sum(x[:2]) if len(x) >= 2 else np.nan)
    g["h1_away"] = g.awayLineScores.apply(lambda x: sum(x[:2]) if len(x) >= 2 else np.nan)
    g["gameday"] = pd.to_datetime(g.startDate).dt.strftime("%Y-%m-%d")

    f2["gameday"] = (pd.to_datetime(f2.commence) - pd.Timedelta(hours=9)).dt.strftime("%Y-%m-%d")
    d = f2.merge(g[["id", "season", "gameday", "homeTeam", "awayTeam", "homePoints", "awayPoints",
                    "h1_home", "h1_away"]],
                 left_on=["gameday", "home_s", "away_s"], right_on=["gameday", "homeTeam", "awayTeam"],
                 how="inner")
    hist = pd.read_parquet(os.path.join(CFB, "data", "model_games_hist.parquet"))
    d = d.merge(hist[["game_id", "spread_open", "spread_close", "total_open", "total_close"]],
                left_on="id", right_on="game_id", how="left")
    print(f"joined to CFBD results: {len(d)} | with Odds-API pregame lines: {d.spread_close.notna().sum()}")

    d["h1m"] = d.h1_home - d.h1_away
    d["h1t"] = d.h1_home + d.h1_away
    d["h2m"] = (d.homePoints - d.h1_home) - (d.awayPoints - d.h1_away)
    d["h2t"] = (d.homePoints + d.awayPoints) - d.h1t
    d = d.dropna(subset=["close_h2_spread", "close_h2_total", "h1m"]).reset_index(drop=True)
    return d


def wl(name, m, w, prices, d, blind=None):
    m = m & w.notna()
    n = int(m.sum())
    if n < 30:
        print(f"{name:52s} n={n} (small)")
        return
    ww = w[m].astype(float)
    pr = prices[m].fillna(-110.0) if prices is not None else pd.Series(-110.0, index=ww.index)
    dec = np.where(pr > 0, 1 + pr / 100, 1 + 100 / (-pr))
    roi = np.where(ww > 0.5, dec - 1, -1.0).mean()
    per = " | ".join(f"{yr}:{100*ww[d.season[m]==yr].mean():.0f}%(n={(d.season[m]==yr).sum()})"
                     for yr in sorted(d.season[m].unique()))
    z = (ww.mean() - (blind if blind else 0.5)) * 2 * np.sqrt(n)
    print(f"{name:52s} n={n:4d}  win {100*ww.mean():.1f}%  roi {100*roi:+.1f}%  z={z:+.2f}   {per}")


def main():
    d = load()
    sp_diff = d.h2m + d.close_h2_spread
    wh = pd.Series(np.where(sp_diff == 0, np.nan, (sp_diff > 0).astype(float)), index=d.index)
    tot_diff = d.h2t - d.close_h2_total
    wo = pd.Series(np.where(tot_diff == 0, np.nan, (tot_diff > 0).astype(float)), index=d.index)
    o = d[wh.notna()]
    assert (((o.h2m + o.close_h2_spread) > 0) == wh[wh.notna()].astype(bool)).all()
    print(f"\nB1 blind: 2H home cover {100*np.nanmean(wh.astype(float)):.1f}% | "
          f"2H over {100*np.nanmean(wo.astype(float)):.1f}%")

    dl = d.dropna(subset=["spread_close", "total_close"]).copy()
    E_M = -dl.spread_close
    a = ols(dl.h1m.values, E_M.values.reshape(-1, 1))[0]
    E_M1 = a * E_M
    E_M2_pre = E_M - E_M1
    S = dl.h1m - E_M1
    E_M2_mkt = -dl.close_h2_spread
    b_mkt = ols((E_M2_mkt - E_M2_pre).values, np.column_stack([S, E_M2_pre]))
    b_act = ols((dl.h2m - E_M2_pre).values, np.column_stack([S, E_M2_pre]))
    aT = ols(dl.h1t.values, dl.total_close.values.reshape(-1, 1))[0]
    E_T2_pre = (1 - aT) * dl.total_close
    S_T = dl.h1t - aT * dl.total_close
    bT_mkt = ols((dl.close_h2_total - E_T2_pre).values, np.column_stack([S_T, E_T2_pre]))
    bT_act = ols((dl.h2t - E_T2_pre).values, np.column_stack([S_T, E_T2_pre]))
    print(f"B1 1H share of expectation: margin {a:.2f}, total {aT:.2f}")
    print(f"B1 SPREAD learning: market {b_mkt[0]:+.3f}/pt vs reality {b_act[0]:+.3f}/pt "
          f"({'OVER' if b_mkt[0] < b_act[0] else 'UNDER'}-prices reversion)")
    print(f"B1 TOTAL learning: market {bT_mkt[0]:+.3f}/pt vs reality {bT_act[0]:+.3f}/pt | "
          f"corr(1H,2H total) {np.corrcoef(dl.h1t, dl.h2t)[0,1]:+.3f}, margin {np.corrcoef(dl.h1m, dl.h2m)[0,1]:+.3f}")

    whl = wh.loc[dl.index]
    wol = wo.loc[dl.index]
    print("\nB2 continuation cells:")
    wl("home dominated 1H by 10+: back HOME 2H", pd.Series(dl.h1m >= 10, index=dl.index), whl,
       dl.close_h2_spread_home_price, dl, blind=np.nanmean(whl.astype(float)))
    fav_home = dl.spread_close < 0
    fav_m = np.where(fav_home, dl.h1m, -dl.h1m)
    coast = pd.Series(fav_m >= dl.spread_close.abs() + 3, index=dl.index)
    fav_cov = pd.Series(np.where(fav_home, whl, 1 - whl), index=dl.index)
    wl("coasting fav (margin >= lay+3): back FAV 2H", coast, fav_cov, None, dl)

    print("\nB3 totals reversion (vs fitted 1H share):")
    wl("1H hot (S_T>=+7): bet 2H UNDER", pd.Series(S_T >= 7, index=dl.index), 1 - wol,
       dl.close_h2_under_price, dl)
    wl("1H cold (S_T<=-7): bet 2H OVER", pd.Series(S_T <= -7, index=dl.index), wol,
       dl.close_h2_over_price, dl)

    print("\nB4 view-shift cells:")
    fav_lay = dl.spread_close.abs()
    fav_h2line = np.where(fav_home, -dl.close_h2_spread, dl.close_h2_spread)
    shift = pd.Series(fav_m + fav_h2line - fav_lay, index=dl.index)
    wl("fav 6.5+, live view >= +2: back FAV", (fav_lay >= 6.5) & (shift >= 2), fav_cov, None, dl)
    wl("fav 6.5+, view crashed <= -7: back DOG", (fav_lay >= 6.5) & (shift <= -7), 1 - fav_cov, None, dl)
    wl("fav 3-6 blowout mode (shift>=+7): back FAV", (fav_lay >= 3) & (fav_lay <= 6) & (shift >= 7),
       fav_cov, None, dl)

    print("\nB5 outlier-book dispersion (game-level net):")
    raw = pd.read_parquet(os.path.join(HERE, "data", "ncaaf_2h_raw.parquet"))
    raw = raw[raw.fresh & (raw.market == "spreads_h2")]
    rows = []
    for eid, g in raw.groupby("event_id"):
        g = g[g.snap_ts == g.snap_ts.max()]
        gh = g[g.name == g.home.iloc[0]]
        if gh.book.nunique() < 3:
            continue
        net = (gh.point - gh.point.median()).sum()
        if abs(net) >= 1:
            rows.append(dict(event_id=eid, net=net))
    off = pd.DataFrame(rows).merge(d[["event_id", "season"]].assign(w=wh), on="event_id")
    off = off[off.w.notna()]
    for th in (1.0, 2.0):
        oo = off[off.net.abs() >= th]
        fw = np.where(oo.net > 0, 1 - oo.w.astype(float), oo.w.astype(float))
        per = " | ".join(f"{yr}:{100*np.mean(np.where(g.net>0, 1-g.w.astype(float), g.w.astype(float))):.0f}%(n={len(g)})"
                         for yr, g in oo.groupby("season"))
        z = (fw.mean() - 0.5) * 2 * np.sqrt(len(oo))
        print(f"  follow outlier |net|>={th}: n={len(oo)}  win {100*fw.mean():.1f}%  z={z:+.2f}   {per}")

    print("\nB6 market bespoke move (dev from its own rule, LOSO):")
    dev = pd.Series(np.nan, index=dl.index)
    upd = (E_M2_mkt - E_M2_pre)
    for yr in sorted(dl.season.unique()):
        tr, te = dl.season != yr, dl.season == yr
        b = ols(upd[tr].values, S[tr].values.reshape(-1, 1))
        dev[te] = upd[te] - (b[0] * S[te] + b[1])
    for th in (2.0, 3.0):
        wl(f"dev>=+{th} (extra move toward HOME): back HOME", dev >= th, whl,
           dl.close_h2_spread_home_price, dl, blind=np.nanmean(whl.astype(float)))
        wl(f"dev<=-{th} (extra move toward AWAY): back AWAY", dev <= -th, 1 - whl, None, dl)


if __name__ == "__main__":
    main()
