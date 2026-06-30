"""Actionable-close re-validation for the close-dependent K-signals (2026-06-27).

User rule: "closing line" = the last betting snapshot still >=60 min before kickoff,
so users get >=1h to bet. Question: do the close-dependent signals still fire + win
when the close is cut off at T-60 (in practice ~T-125, snapshot cadence ~2h) instead
of the true kickoff close (~T-34)?

Method: rebuild the h1tt consensus frame at two cutoffs from odds_hist.parquet
(close=last pre-kick; act60=last snapshot with >=60min lead), recompute each K-signal
across ALL games 2023-25, grade vs finals/half-scores. Report close vs act60 side-by-side.

Read-only research. No DB writes.
"""
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"

CITY_NAMES = {
    "Arizona": "ARI", "Atlanta": "ATL", "Baltimore": "BAL", "Buffalo": "BUF",
    "Carolina": "CAR", "Chicago": "CHI", "Cincinnati": "CIN", "Cleveland": "CLE",
    "Dallas": "DAL", "Denver": "DEN", "Detroit": "DET", "Green Bay": "GB",
    "Houston": "HOU", "Indianapolis": "IND", "Jacksonville": "JAX",
    "Kansas City": "KC", "LA Chargers": "LAC", "LA Rams": "LA", "Las Vegas": "LV",
    "Miami": "MIA", "Minnesota": "MIN", "NY Giants": "NYG", "NY Jets": "NYJ",
    "New England": "NE", "New Orleans": "NO", "Philadelphia": "PHI",
    "Pittsburgh": "PIT", "San Francisco": "SF", "Seattle": "SEA",
    "Tampa Bay": "TB", "Tennessee": "TEN", "Washington": "WAS"}

MARKETS = {
    "spread":    (["spread_home"], ["spread_home_price", "spread_away_price"]),
    "total":     (["total_point"], ["total_over_price", "total_under_price"]),
    "h1_spread": (["h1_spread_home"], ["h1_spread_home_price", "h1_spread_away_price"]),
    "h1_total":  (["h1_total_point"], ["h1_total_over_price", "h1_total_under_price"]),
    "tt_home":   (["tt_home_point"], ["tt_home_over_price", "tt_home_under_price"]),
    "tt_away":   (["tt_away_point"], ["tt_away_over_price", "tt_away_under_price"]),
}


def payout(o):
    o = pd.to_numeric(o, errors="coerce")
    return np.where(o > 0, o / 100, 100 / -o)


def build_frame(min_lead):
    """Rebuild the open/close consensus frame. 'close' = last snapshot with
    (commence-snap) >= min_lead minutes; 'open' = first pre-kickoff snapshot."""
    d = pd.read_parquet(DATA / "odds_hist.parquet")
    d["snap_dt"] = pd.to_datetime(d.snap_ts, utc=True, format="ISO8601")
    comm = pd.to_datetime(d.commence_time, utc=True, format="ISO8601")
    d["mins_before"] = (comm - d.snap_dt).dt.total_seconds() / 60.0
    d["gameday"] = comm.dt.tz_convert("America/New_York").dt.strftime("%Y-%m-%d")
    d["home_ab"] = d.home_team.map(CITY_NAMES)
    d["away_ab"] = d.away_team.map(CITY_NAMES)
    d = d[d.mins_before > 0]
    d_close = d[d.mins_before >= min_lead]      # snapshots eligible to be "close"
    for c in ["spread_home_price", "spread_away_price", "total_over_price",
              "total_under_price", "h1_spread_home_price", "h1_spread_away_price",
              "h1_total_over_price", "h1_total_under_price",
              "tt_home_over_price", "tt_home_under_price",
              "tt_away_over_price", "tt_away_under_price"]:
        d[f"pay__{c}"] = payout(d[c]); d_close[f"pay__{c}"] = payout(d_close[c])

    gk = ["season", "gameday", "home_ab", "away_ab"]
    frames = []
    for mkt, (lines, prices) in MARKETS.items():
        anchor = lines[0] if lines else prices[0]
        agg = {c: (c, "median") for c in lines}
        agg.update({f"pay__{c}": (f"pay__{c}", "median") for c in prices})
        # OPEN from full pre-kick set; CLOSE from the >=min_lead set
        so = d[d[anchor].notna()]
        sc = d_close[d_close[anchor].notna()]
        if not len(so) or not len(sc):
            continue
        cons_o = so.groupby(gk + ["snap_dt"]).agg(**agg).reset_index().sort_values(gk + ["snap_dt"])
        cons_c = sc.groupby(gk + ["snap_dt"]).agg(**agg).reset_index().sort_values(gk + ["snap_dt"])
        first = cons_o.groupby(gk).first().reset_index()
        last = cons_c.groupby(gk).last().reset_index()
        ren_f = {c: f"{mkt}_open_{c.replace('pay__', 'pay_')}" for c in cons_o.columns if c not in gk + ["snap_dt"]}
        ren_l = {c: f"{mkt}_close_{c.replace('pay__', 'pay_')}" for c in cons_c.columns if c not in gk + ["snap_dt"]}
        f = first.rename(columns=ren_f).merge(last.rename(columns=ren_l), on=gk)
        frames.append(f.set_index(gk))
    wide = pd.concat(frames, axis=1).reset_index()

    q = pd.read_parquet(DATA / "quarter_scores.parquet")
    g = pd.read_parquet(DATA / "nflverse_games.parquet")
    g["gameday"] = pd.to_datetime(g.gameday).dt.strftime("%Y-%m-%d")
    q = q.merge(g[["game_id", "gameday", "gametime", "weekday"]], on="game_id", how="left")
    out = wide.merge(q.rename(columns={"home_team": "home_ab", "away_team": "away_ab"}),
                     on=["season", "gameday", "home_ab", "away_ab"], how="inner")
    return out


def tt_history(f):
    """Per-team prior-game TT line + actual points, season-to-date (K5/K6)."""
    rows = []
    for ab, tt, pts in (("home_ab", "tt_home_close_tt_home_point", "final_home"),
                        ("away_ab", "tt_away_close_tt_away_point", "final_away")):
        s = f[["season", "week", ab, tt, pts]].copy()
        s.columns = ["season", "week", "team", "tt", "pts"]
        rows.append(s)
    t = pd.concat(rows).sort_values(["season", "week"])
    t["prior_tt"] = t.groupby(["season", "team"]).tt.shift(1)
    t["prior_pts"] = t.groupby(["season", "team"]).pts.shift(1)
    return t


def run_signals(f):
    """Return list of bet dicts: signal, win(0/1/nan push), roi_units, season."""
    f = f.copy()
    f["fg_sp"] = f.spread_close_spread_home
    f["tt_sum"] = f.tt_home_close_tt_home_point + f.tt_away_close_tt_away_point
    f["k1_rank"] = f.groupby("season").apply(
        lambda d: ((d.tt_sum - d.total_close_total_point).rank(pct=True))
    ).reset_index(level=0, drop=True)
    th = tt_history(f)
    th_idx = {(r.season, r.week, r.team): r for _, r in th.iterrows()}
    bets = []

    def emit(sig, win, roi, season):
        bets.append(dict(signal=sig, win=win, roi=roi, season=season))

    def grade_over(actual, line, pay):
        if pd.isna(actual) or pd.isna(line) or pd.isna(pay):
            return None
        if actual == line: return (np.nan, 0.0)
        win = actual > line
        return (1.0 if win else 0.0, pay if win else -1.0)

    def grade_under(actual, line, pay):
        r = grade_over(actual, line, pay)
        if r is None or np.isnan(r[0]): return r
        win = r[0] == 0.0
        return (1.0 if win else 0.0, pay if win else -1.0)

    for _, r in f.iterrows():
        sea = int(r.season)
        ft = r.final_home + r.final_away
        # K1 game OVER (within-season top quintile of tt_sum - total)
        if pd.notna(r.k1_rank) and r.k1_rank >= 0.8:
            g = grade_over(ft, r.total_close_total_point, r.total_close_pay_total_over_price)
            if g: emit("K1_game_over", *g, sea)
        # K2 big home fav -> home TT OVER
        if pd.notna(r.fg_sp) and r.fg_sp <= -7:
            g = grade_over(r.final_home, r.tt_home_close_tt_home_point, r.tt_home_close_pay_tt_home_over_price)
            if g: emit("K2_bigfav_home_tt_over", *g, sea)
        # K3 1H spread steam-follow (|move|>=1, |fg_sp|<7) -- PURE MOVEMENT
        h1s, h1so = r.h1_spread_close_h1_spread_home, r.h1_spread_open_h1_spread_home
        if pd.notna(h1s) and pd.notna(h1so) and abs(h1s - h1so) >= 1.0 and pd.notna(r.fg_sp) and abs(r.fg_sp) < 7:
            steam_home = h1s < h1so
            h1m = (r.h1_home - r.h1_away)
            if steam_home:
                line, pay = h1s, r.h1_spread_close_pay_h1_spread_home_price
                g = grade_over(h1m, -line, pay)   # home covers if h1m > -line
            else:
                line, pay = -h1s, r.h1_spread_close_pay_h1_spread_away_price
                g = grade_over(-h1m, -line, pay)  # away covers if -h1m > -line
            if g: emit("K3_h1_steam_follow", *g, sea)
        # K5 / K6 TT bounce-back / momentum (need prior game)
        for ab, tt_col, pts_now, ov_pay in (
                ("home_ab", "tt_home_close_tt_home_point", "final_home", "tt_home_close_pay_tt_home_over_price"),
                ("away_ab", "tt_away_close_tt_away_point", "final_away", "tt_away_close_pay_tt_away_over_price")):
            key = (sea, int(r.week), getattr(r, ab))
            h = th_idx.get(key)
            tt_now = getattr(r, tt_col)
            if h is None or pd.isna(h.prior_tt) or pd.isna(h.prior_pts) or pd.isna(tt_now):
                continue
            miss = h.prior_pts - h.prior_tt
            move = tt_now - h.prior_tt
            if miss <= -8 and move <= -2:
                g = grade_over(getattr(r, pts_now), tt_now, getattr(r, ov_pay))
                if g: emit("K5_tt_cut_bounceback_over", *g, sea)
            if miss >= 10 and move >= 3:
                g = grade_over(getattr(r, pts_now), tt_now, getattr(r, ov_pay))
                if g: emit("K6_tt_raise_momentum_over", *g, sea)
        # K9 home TT high -> OVER
        tt_h = r.tt_home_close_tt_home_point
        if pd.notna(tt_h) and tt_h >= 24:
            g = grade_over(r.final_home, tt_h, r.tt_home_close_pay_tt_home_over_price)
            if g: emit("K9_home_tt_high_over", *g, sea)
        # K10 home TT steam (open->close >= 0.5) -> OVER -- MOVEMENT
        tt_h_open = r.tt_home_open_tt_home_point
        if pd.notna(tt_h) and pd.notna(tt_h_open) and (tt_h - tt_h_open) >= 0.5:
            g = grade_over(r.final_home, tt_h, r.tt_home_close_pay_tt_home_over_price)
            if g: emit("K10_home_tt_steam_over", *g, sea)
        # K11 home TT over-juiced -> fade UNDER
        ov, un = r.tt_home_close_pay_tt_home_over_price, r.tt_home_close_pay_tt_home_under_price
        if pd.notna(tt_h) and pd.notna(ov) and pd.notna(un):
            juice = 1.0 / (ov + 1) - 1.0 / (un + 1)
            if juice > 0.03:
                g = grade_under(r.final_home, tt_h, un)
                if g: emit("K11_home_tt_over_juiced_fade", *g, sea)
        # K12 TTs imply away cover -> back away ATS
        tt_a = r.tt_away_close_tt_away_point
        csp = r.spread_close_spread_home
        if pd.notna(tt_h) and pd.notna(tt_a) and pd.notna(csp):
            if (tt_h - tt_a) + csp <= -1.5:
                away_margin = r.final_away - r.final_home
                g = grade_over(away_margin, csp, r.spread_close_pay_spread_away_price)  # away line = -csp; cover if away_margin > -(-csp)=csp...
                if g: emit("K12_tt_implies_away_cover", *g, sea)
    return pd.DataFrame(bets)


def report(name, df):
    print(f"\n{'='*78}\n{name}\n{'='*78}")
    print(f"  {'signal':30s} {'n':>4s} {'hit':>7s} {'ROI':>8s}   per-season")
    for sig in sorted(df.signal.unique()):
        s = df[df.signal == sig].dropna(subset=["win"])
        s = s[np.isfinite(s.roi)]
        n = len(s)
        if n == 0:
            print(f"  {sig:30s} {0:4d}"); continue
        hit = s.win.mean() * 100; roi = s.roi.mean() * 100
        per = "  ".join(f"{yr}:{ss.win.mean()*100:.0f}%/{len(ss)}"
                        for yr in sorted(s.season.unique())
                        for ss in [s[s.season == yr]])
        print(f"  {sig:30s} {n:4d} {hit:6.1f}% {roi:+7.1f}%   [{per}]")


if __name__ == "__main__":
    print("Building frames (close=last pre-kick vs act60=last snapshot >=60min out)...")
    f_close = build_frame(0)
    f_act60 = build_frame(60)
    print(f"close frame: {len(f_close)} games | act60 frame: {len(f_act60)} games")
    rc = run_signals(f_close)
    ra = run_signals(f_act60)
    report("BASELINE  — true close (last pre-kick, ~T-34)", rc)
    report("ACTIONABLE — last snapshot >=60min out (~T-125)", ra)
    # side-by-side delta
    print(f"\n{'='*78}\nDELTA (actionable - baseline)\n{'='*78}")
    print(f"  {'signal':30s} {'close hit/n':>14s} {'act60 hit/n':>14s} {'Δhit':>7s} {'Δroi':>7s}")
    for sig in sorted(set(rc.signal) | set(ra.signal)):
        sc = rc[rc.signal == sig].dropna(subset=["win"]); sc = sc[np.isfinite(sc.roi)]
        sa = ra[ra.signal == sig].dropna(subset=["win"]); sa = sa[np.isfinite(sa.roi)]
        if not len(sc) or not len(sa): continue
        ch, cr = sc.win.mean()*100, sc.roi.mean()*100
        ah, ar = sa.win.mean()*100, sa.roi.mean()*100
        print(f"  {sig:30s} {ch:6.1f}%/{len(sc):<5d} {ah:6.1f}%/{len(sa):<5d} "
              f"{ah-ch:+6.1f} {ar-cr:+6.1f}")
    print("\n[done]")
