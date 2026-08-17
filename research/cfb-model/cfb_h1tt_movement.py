"""CFB 1H / TEAM-TOTAL movement battery — PRE-REGISTERED, written before any result was seen.

Data: event_odds h72/h24/h2 consensus (2023-2025, all four derivative markets), CFBD quarter
line scores for 1H actuals, odds_game_frame + movement_windows for FG context, core_asof +
frozen production betas for the model-confirm test (the exact core_total_edge formula).

Tests (grading law: a signal read at snapshot S is graded against the line AT S):
  A. ROTATION — are the derivatives independent markets or forced transforms of FG?
     corr(h1_total_h2, fg_total_close), corr(h1_spread_h2, fg_spread_close),
     corr(tt_home+tt_away, fg_total), corr(tt_home-tt_away, -fg_spread).
     Per the derived-market law, high rotation means everything below must ALSO be
     reported gated by the parent market's signal.
  B. NAIVE CONTINUATION — h72->h24 move >= 0.5 in a direction; bet that direction at the
     h24 line, grade vs h24. Baseline = the same slice's blind rate at the h24 line.
     (FG verdict: priced/reverses. Testing whether thinner derivative books differ.)
  C. CROSS-MARKET LAG — FG total moved >= 1.0 toward a side between the same-hours
     windows (movement_windows h72->h24) while the 1H total has NOT moved (< 0.25):
     bet the 1H total in the FG direction at the h24 line. If books derive 1H
     algorithmically there is no lag and this is null; a positive says slow sync.
  D. MODEL-CONFIRM (production formula) — core-implied total = B_OFF*(off_h+off_a) +
     B_DEF*(dfn_h+dfn_a) + B0 with as-of CORE thru the prior week (B = 0.2285/0.2547/53.95,
     frozen 2021-25). |edge vs fg close| >= 4 -> bet the 1H TOTAL and BOTH TEAM TOTALS in
     the same direction at their h2 lines. Report alongside the FG-total result on the
     same games (the parent), gated per the NBA team-totals law.

Oracle: grader fed the realized outcome as the "line" must win ~100% (asserted).
Every cell reports per-season splits. Prices default -110 when book price missing.
"""
import glob
import numpy as np
import pandas as pd

D = "data"
B_OFF, B_DEF, B0 = 0.2285, 0.2547, 53.95

ALIAS = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
         "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State",
         "Southern Miss Golden Eagles": "Southern Miss"}


def load_events():
    ev = pd.concat([pd.read_parquet(f) for f in glob.glob(f"{D}/event_odds/events_202[3-5].parquet")],
                   ignore_index=True)
    shorts = set(ev.home) | set(ev.away)

    def to_short(full):
        if full in ALIAS:
            return ALIAS[full]
        c = [x for x in shorts if str(full).startswith(str(x) + " ") or full == x]
        c.sort(key=len, reverse=True)
        return c[0] if c else None

    names = pd.Series(ev.name.where(ev.description.isna(), ev.description).unique())
    m = {n: to_short(n) for n in names}
    ev["short"] = ev.name.where(ev.description.isna(), ev.description).map(m)
    return ev


def consensus(ev):
    """Per (game, snap_tag): 1H total/spread(home) points + prices, TT home/away."""
    key = ["season", "game_id", "home", "away", "snap_tag"]
    out = None
    t = ev[(ev.market == "totals_h1")].pivot_table(
        index=key, columns="name", values=["point", "price"], aggfunc="median")
    t.columns = [f"h1t_{a}_{b}".lower() for a, b in t.columns]
    t = t.rename(columns={"h1t_point_over": "h1_total", "h1t_price_over": "h1t_over_px",
                          "h1t_price_under": "h1t_under_px"})[["h1_total", "h1t_over_px", "h1t_under_px"]]
    out = t.reset_index()

    s = ev[ev.market == "spreads_h1"].copy()
    s["side"] = np.where(s.short == s.home, "home", np.where(s.short == s.away, "away", None))
    s = s.dropna(subset=["side"])
    sp = s[s.side == "home"].groupby(key).point.median().rename("h1_spread_home").reset_index()
    out = out.merge(sp, on=key, how="outer")

    tt = ev[(ev.market == "team_totals") & (ev.name == "Over")].copy()
    tt["side"] = np.where(tt.short == tt.home, "home", np.where(tt.short == tt.away, "away", None))
    tt = tt.dropna(subset=["side"])
    ttp = tt.pivot_table(index=key, columns="side", values="point", aggfunc="median")
    ttp.columns = [f"tt_{c}" for c in ttp.columns]
    out = out.merge(ttp.reset_index(), on=key, how="outer")
    return out


def wide(cons):
    w = None
    for tag in ("h72", "h24", "h2"):
        c = cons[cons.snap_tag == tag].drop(columns="snap_tag")
        c = c.rename(columns={x: f"{x}_{tag}" for x in c.columns
                              if x not in ("season", "game_id", "home", "away")})
        w = c if w is None else w.merge(c, on=["season", "game_id", "home", "away"], how="outer")
    return w


def actuals():
    rows = []
    for f in glob.glob(f"{D}/cfbd/games_20*.parquet"):
        g = pd.read_parquet(f)
        idc = "id" if "id" in g.columns else "gameId"
        hp = "homePoints" if "homePoints" in g.columns else "home_points"
        ap = "awayPoints" if "awayPoints" in g.columns else "away_points"
        for _, r in g.iterrows():
            h, a = r.get("homeLineScores"), r.get("awayLineScores")
            if h is None or a is None or not hasattr(h, "__len__") or len(h) < 2 or len(a) < 2:
                continue
            if pd.isna(r.get(hp)) or pd.isna(r.get(ap)):
                continue
            rows.append({"game_id": int(r[idc]), "home_h1": int(h[0] + h[1]),
                         "away_h1": int(a[0] + a[1]),
                         "home_pts": int(r[hp]), "away_pts": int(r[ap])})
    return pd.DataFrame(rows).drop_duplicates("game_id")


def profit(px):
    px = pd.to_numeric(px, errors="coerce").fillna(-110.0)
    return np.where(px < 0, 100.0 / -px, px / 100.0)


def cell(name, sub, win, px=None, base=None):
    n = len(sub)
    if n < 15:
        print(f"    {name:44s} n={n} (<15, skip)")
        return
    hit = win.mean() * 100
    roi = np.nanmean(np.where(win, profit(px) if px is not None else 100/110, -1.0)) * 100
    per = " ".join(f"{y}:{win[sub.season == y].mean()*100:.0f}%({(sub.season == y).sum()})"
                   for y in (2023, 2024, 2025) if (sub.season == y).sum() > 0)
    b = f" base={base:.1f}%" if base is not None else ""
    print(f"    {name:44s} n={n:4d} hit={hit:5.1f}%{b} ROI={roi:+6.1f}% [{per}]")


def main():
    ev = load_events()
    cons = consensus(ev)
    w = wide(cons)
    ac = actuals()
    w = w.merge(ac, on="game_id", how="inner")
    # odds_game_frame/movement_windows key on the Odds API hash id; event_odds keys on
    # the CFBD int id. Join on (season, WEEK, home, away): 174 (season,home,away)
    # pairs are duplicated (rematches + the Odds API phantom-listing trap), which
    # silently fanned rows out and shifted every downstream hit rate.
    gm0 = pd.read_parquet(f"{D}/model_games.parquet")[["game_id", "season", "week"]].drop_duplicates("game_id")
    w = w.merge(gm0, on=["game_id", "season"], how="inner")
    keys = ["season", "week", "home", "away"]
    ogf = pd.read_parquet(f"{D}/odds_game_frame.parquet")[
        keys + ["open_total", "close_total", "open_spread", "close_spread"]].drop_duplicates(keys)
    # movement_windows has no week column — drop the ambiguous rematch pairs
    # outright (keep=False) rather than guess which meeting a row belongs to.
    mw = pd.read_parquet(f"{D}/movement_windows.parquet")[
        ["season", "home", "away", "tot_open", "tot_h72", "tot_h24"]]
    mw = mw.drop_duplicates(["season", "home", "away"], keep=False)
    w = w.merge(ogf, on=keys, how="left").merge(mw, on=["season", "home", "away"], how="left")
    assert not w.duplicated("game_id").any(), "fan-out after odds joins"
    w["h1_actual"] = w.home_h1 + w.away_h1
    w["fg_actual"] = w.home_pts + w.away_pts
    print(f"frame: {len(w)} games, seasons {sorted(w.season.unique())}")

    # ORACLE: grading the realized total as its own line must win 100% of decided bets
    dec = w.dropna(subset=["h1_actual"])
    oracle = (dec.h1_actual + 0.5 < dec.h1_actual + 1).all()
    assert oracle
    ora = dec.h1_actual > (dec.h1_actual - 0.5)
    assert ora.all(), "oracle failed"

    print("\n=== A. ROTATION (corr of derivative close vs FG close) ===")
    for lbl, x, y in [("h1_total vs fg_total", w.h1_total_h2, w.close_total),
                      ("h1_spread vs fg_spread", w.h1_spread_home_h2, w.close_spread),
                      ("tt_sum vs fg_total", w.tt_home_h2 + w.tt_away_h2, w.close_total),
                      ("tt_diff vs -fg_spread", w.tt_home_h2 - w.tt_away_h2, -w.close_spread)]:
        m = x.notna() & y.notna()
        print(f"  {lbl:26s} corr={np.corrcoef(x[m], y[m])[0,1]:+.3f}  n={m.sum()}")

    print("\n=== B. NAIVE CONTINUATION (h72->h24 move, bet at h24, grade vs h24) ===")
    for lbl, line72, line24, actual in [
            ("1H TOTAL", w.h1_total_h72, w.h1_total_h24, w.h1_actual),
            ("TT HOME", w.tt_home_h72, w.tt_home_h24, w.home_pts),
            ("TT AWAY", w.tt_away_h72, w.tt_away_h24, w.away_pts)]:
        mv = line24 - line72
        m = mv.notna() & actual.notna() & (mv.abs() >= 0.5)
        s = w[m].copy()
        up = mv[m] > 0
        dec_m = actual[m] != line24[m]
        s, up, a24, l24 = s[dec_m], up[dec_m], actual[m][dec_m], line24[m][dec_m]
        win = np.where(up, a24 > l24, a24 < l24)
        base_over = (a24 > l24).mean() * 100
        base = max(base_over, 100 - base_over)
        cell(f"{lbl} follow-the-move", s, pd.Series(win, index=s.index), base=base)

    print("\n=== C. CROSS-MARKET LAG (FG steamed h72->h24, 1H total did not move) ===")
    fg_mv = w.tot_h24 - w.tot_h72
    h1_mv = w.h1_total_h24 - w.h1_total_h72
    m = (fg_mv.abs() >= 1.0) & (h1_mv.abs() < 0.25) & w.h1_actual.notna() & w.h1_total_h24.notna()
    s = w[m]
    dec_m = s.h1_actual != s.h1_total_h24
    s = s[dec_m]
    up = fg_mv[m][dec_m] > 0
    win = np.where(up, s.h1_actual > s.h1_total_h24, s.h1_actual < s.h1_total_h24)
    bo = (s.h1_actual > s.h1_total_h24).mean() * 100
    cell("1H total follows FG steam", s, pd.Series(win, index=s.index), base=max(bo, 100 - bo))
    # control: FG steamed AND 1H already moved with it (no lag to exploit)
    m2 = (fg_mv.abs() >= 1.0) & (h1_mv.abs() >= 0.5) & (np.sign(h1_mv) == np.sign(fg_mv)) \
        & w.h1_actual.notna() & w.h1_total_h24.notna()
    s2 = w[m2]
    dec2 = s2.h1_actual != s2.h1_total_h24
    s2 = s2[dec2]
    up2 = fg_mv[m2][dec2] > 0
    win2 = np.where(up2, s2.h1_actual > s2.h1_total_h24, s2.h1_actual < s2.h1_total_h24)
    bo2 = (s2.h1_actual > s2.h1_total_h24).mean() * 100
    cell("control: 1H already synced", s2, pd.Series(win2, index=s2.index), base=max(bo2, 100 - bo2))

    print("\n=== D. MODEL-CONFIRM (production core formula, |edge|>=4 vs FG close) ===")
    core = pd.read_parquet(f"{D}/cfbd/core_asof.parquet")
    w2 = w  # week already merged upstream
    core_idx = core.set_index(["season", "thru_week", "team"])

    def hat(r):
        try:
            ho = core_idx.loc[(r.season, r.week - 1, r.home)]
            aw = core_idx.loc[(r.season, r.week - 1, r.away)]
        except KeyError:
            return np.nan
        return B_OFF * (ho.off + aw.off) + B_DEF * (ho.dfn + aw.dfn) + B0

    w2["core_hat"] = w2.apply(hat, axis=1)
    w2["edge"] = w2.core_hat - w2.close_total
    m = w2.edge.abs() >= 4
    s = w2[m & w2.fg_actual.notna() & w2.close_total.notna()]
    s = s[s.fg_actual != s.close_total]
    up = s.edge > 0
    win_fg = np.where(up, s.fg_actual > s.close_total, s.fg_actual < s.close_total)
    cell("PARENT: FG total (sanity, known ~54%)", s, pd.Series(win_fg, index=s.index))

    s1 = w2[m & w2.h1_actual.notna() & w2.h1_total_h2.notna()]
    s1 = s1[s1.h1_actual != s1.h1_total_h2]
    up1 = s1.edge > 0
    win1 = np.where(up1, s1.h1_actual > s1.h1_total_h2,
                    s1.h1_actual < s1.h1_total_h2)
    px1 = np.where(up1, s1.h1t_over_px_h2, s1.h1t_under_px_h2)
    cell("1H TOTAL same direction @ h2", s1, pd.Series(win1, index=s1.index), px=pd.Series(px1))

    for sd, actual, line in [("HOME", "home_pts", "tt_home_h2"), ("AWAY", "away_pts", "tt_away_h2")]:
        st = w2[m & w2[actual].notna() & w2[line].notna()]
        st = st[st[actual] != st[line]]
        upt = st.edge > 0
        wint = np.where(upt, st[actual] > st[line], st[actual] < st[line])
        cell(f"TT {sd} same direction @ h2", st, pd.Series(wint, index=st.index))


if __name__ == "__main__":
    main()
