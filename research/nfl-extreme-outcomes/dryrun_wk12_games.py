"""Week 12 2025 DRY RUN — games + flags staging load.

Pretend it's Wednesday of Week 12, 2025: every model number is walk-forward
(FG models trained <2025, 1H model trained 2023-24), every signal is
point-in-time (K1/P11 ranked within the Week 12 slate only), every line is the
real consensus close snapshot. Loads nfl_dryrun_games + nfl_dryrun_flags on the
research Supabase project. See DRYRUN_WK12_SPEC.md for the data contract.

Usage:  python3 dryrun_wk12_games.py [--no-load]
"""
import argparse
import json
import math
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
BASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
# Target slate — override per week via env NFL_SEASON / NFL_WEEK; defaults to the
# Wk12-2025 dry-run so an unparameterized run stays byte-for-byte the original.
SEASON = int(os.environ.get("NFL_SEASON", 2025))
WEEK = int(os.environ.get("NFL_WEEK", 12))
GK = ["season", "week", "home_ab", "away_ab"]
# harness/odds_consensus use nflfastR-style codes; h1tt frames use Odds-API-derived
NORM = {"LAR": "LA", "WSH": "WAS", "JAC": "JAX"}
_tm = pd.read_parquet(DATA / "team_mapping.parquet")
_tm["ab"] = _tm["Team Abbrev"].replace(NORM)
NAME_AB = dict(zip(_tm.city_and_name, _tm.ab))      # "Los Angeles Rams" -> "LA"
AB_NAME = dict(zip(_tm.ab, _tm.city_and_name))
TRACKING_HARNESS = {"primetime_tight_favorite", "primetime_tight_under",
                    "bot_vs_bot_under", "bye_collision", "week1_def_under"}

# NFL tier vocabulary -> shared CFB conviction enum (so one Swift component renders both)
REC = {"mammoth": "MAMMOTH Play", "high": "High Conviction", "med": "Solid Play",
       "low": "Lean", "lean": "Small Lean", "none": "No Bet"}
STAKE = {"mammoth": 3.0, "high": 1.5, "med": 1.0, "low": 0.5, "lean": 0.25, "none": 0.0}
CONV_RANK = {"none": 0, "lean": 1, "low": 2, "med": 3, "high": 4, "mammoth": 5}
# the line a signal was computed from -> the line we GRADE against (grading framework)
GRADE_LINE = {"fg_harness": "open", "consensus_totals": "open",
              "props": "close", "h1_model": "close", "k_signal": "close"}
# default conviction per source/tier for a flag row (mirrors nfl_signal_defs.default_conviction)
ACTIVE_HIGH = {"legacy_primetime", "legacy_fade", "tight_soft_ml_fade_home",
               "top_vs_top_pt_home", "dk_heavy_home_juice", "dk_giant_fav_over",
               "receiver_over_HC", "wind_under", "consensus_totals_HC",
               "P11_atd_implied_over"}
ODDS_AB = dict(zip(_tm.team_name, _tm.ab))   # "LA Rams"/"Houston" (odds_hist names) -> ab


def best_pick(df, kind, side):
    """Most favorable line across books for (kind, side).
    Returns (book_key, best_line, best_odds). Lines: more points = better for the
    bettor on handicaps; Over takes the lowest number, Under the highest; ML/totals
    ties break to the best price. ML returns line=None."""
    if df is None or df.empty:
        return None, None, None
    cfg = {
        "spread_home": ("spread_home", "spread_home_price", "max"),
        "spread_away": ("spread_away", "spread_away_price", "max"),
        "h1_spread_home": ("h1_spread_home", "h1_spread_home_price", "max"),
        "h1_spread_away": ("h1_spread_away", "h1_spread_away_price", "max"),
        "total_over": ("total_point", "total_over_price", "min"),
        "total_under": ("total_point", "total_under_price", "max"),
        "h1_total_over": ("h1_total_point", "h1_total_over_price", "min"),
        "h1_total_under": ("h1_total_point", "h1_total_under_price", "max"),
        "tt_home_over": ("tt_home_point", "tt_home_over_price", "min"),
        "tt_home_under": ("tt_home_point", "tt_home_under_price", "max"),
        "tt_away_over": ("tt_away_point", "tt_away_over_price", "min"),
        "tt_away_under": ("tt_away_point", "tt_away_under_price", "max"),
        "ml_home": ("ml_home", None, "max"),
        "ml_away": ("ml_away", None, "max"),
        "h1_ml_home": ("h1_ml_home", None, "max"),
        "h1_ml_away": ("h1_ml_away", None, "max"),
    }
    key = f"{kind}_{side}" if kind in ("spread", "h1_spread", "total", "h1_total") else (
        f"{kind}_{side}")
    pt_col, pr_col, how = cfg[key]
    sub = df[df[pt_col].notna()].copy()
    if sub.empty:
        return None, None, None
    if pr_col is None:                       # moneyline: best price only
        r = sub.loc[sub[pt_col].idxmax()]
        return r.book, None, int(r[pt_col])
    sub = sub[sub[pr_col].notna()]
    if sub.empty:
        return None, None, None
    best_pt = sub[pt_col].min() if how == "min" else sub[pt_col].max()
    cand = sub[sub[pt_col] == best_pt]
    r = cand.loc[cand[pr_col].idxmax()]      # tie-break on price
    return r.book, float(r[pt_col]), int(r[pr_col])


def load_books(g):
    """Per-book CLOSING snapshot for each Week 12 matchup + kickoff time.
    Returns books[(home_ab, away_ab)] -> DataFrame(one row per book) and
    kickoff[(home_ab, away_ab)] -> commence_time ISO string (UTC)."""
    o = pd.read_parquet(DATA / "odds_hist.parquet")
    o = o[o.season == SEASON].copy()
    o["home_ab"] = o.home_team.map(ODDS_AB)
    o["away_ab"] = o.away_team.map(ODDS_AB)
    o = o.dropna(subset=["home_ab", "away_ab"])
    o["st"] = pd.to_datetime(o.snap_ts)
    o["ct"] = pd.to_datetime(o.commence_time)
    books, kickoff = {}, {}
    for _, r in g.iterrows():
        sub = o[(o.home_ab == r.home_ab) & (o.away_ab == r.away_ab)]
        if sub.empty:
            continue
        ct = sub.ct.iloc[0]
        kickoff[(r.home_ab, r.away_ab)] = ct.isoformat()
        pre = sub[sub.st <= ct]
        pre = pre if not pre.empty else sub
        close = pre.loc[pre.groupby("book").st.idxmax()]   # latest snap per book
        books[(r.home_ab, r.away_ab)] = close.reset_index(drop=True)
    return books, kickoff


def weather(r):
    """Actual Week 12 conditions from h1tt_frame (roof/temp/wind). NOTE: these are
    realized values, not a pregame forecast — acceptable for a dry run, flagged in
    the data contract."""
    roof = str(r.roof) if pd.notna(r.roof) else None
    indoors = roof in ("closed", "dome")
    temp = None if indoors or pd.isna(r.temp) else float(r.temp)
    wind = None if indoors or pd.isna(r.wind) else float(r.wind)
    if indoors:
        icon, summary = "indoor", f"Indoors ({roof})"
    elif wind is not None and wind >= 15:
        icon, summary = "wind", f"{int(temp) if temp is not None else '?'}°F, wind {int(wind)} mph"
    elif temp is not None and temp <= 32:
        icon, summary = "cold", f"{int(temp)}°F, wind {int(wind) if wind is not None else 0} mph"
    elif temp is not None:
        icon = "clear"
        summary = f"{int(temp)}°F, wind {int(wind) if wind is not None else 0} mph"
    else:
        icon, summary = "clear", "Outdoors"
    return dict(wx_indoors=indoors, wx_temp_f=temp, wx_wind_mph=wind,
                wx_precip_mm=None, wx_icon=icon, wx_summary=summary)


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found in .env.local")


def amer(pay):
    """Decimal profit-per-1 -> American odds."""
    if pd.isna(pay) or pay <= 0:
        return None
    return int(round(pay * 100)) if pay >= 1 else int(round(-100 / pay))


def norm_ab(s):
    return s.replace(NORM)


def win_prob(margin):
    # standard NFL margin sigma ~13.86 (no walk-forward ML model exists; documented in spec)
    return 0.5 * (1 + math.erf(margin / (13.86 * math.sqrt(2))))


def build_games():
    f = pd.read_parquet(DATA / "h1tt_frame.parquet")
    f = f[(f.season == SEASON) & (f.week == WEEK)].copy()
    hp = pd.read_parquet(DATA / "h1m_preds.parquet")
    hp = hp[(hp.season == SEASON) & (hp.week == WEEK)]
    g = f.merge(hp[["slot", "season", "week", "home_ab", "away_ab", "fg_sp", "fg_tot",
                    "pred_tot_anch", "pred_m_anch", "prob_home_1h",
                    "resid_tot", "resid_cov"]], on=GK, how="left")
    ctx = pd.read_parquet(DATA / "h1tt_context.parquet")
    g = g.merge(ctx[GK + ["h_h1_pf_avg", "a_h1_pf_avg"]], on=GK, how="left")

    od = pd.read_parquet(DATA / "odds_consensus.parquet")
    od["home_ab"] = norm_ab(od.home_ab); od["away_ab"] = norm_ab(od.away_ab)
    g = g.merge(od[od.season == SEASON][
        ["season", "home_ab", "away_ab", "open_spread", "open_total",
         "close_ml_home", "close_ml_away"]],
        on=["season", "home_ab", "away_ab"], how="left")

    # FG totals model (locked consensus ensemble, strict-open artifact)
    ct = pd.read_csv(ROOT / "out" / "predictions_totals_2025.csv")
    ct = ct[ct.week == WEEK].copy()
    ct["home_ab"] = norm_ab(ct.home_ab); ct["away_ab"] = norm_ab(ct.away_ab)
    g = g.merge(ct[["season", "week", "home_ab", "away_ab", "display_total",
                    "edge_open", "direction", "tier", "bet_quality"]],
                on=GK, how="left")

    # FG sides model (locked harness BASE+21), trained on seasons < 2025
    from forecast_harness import build, train_predict, CONF, REG_EDGE
    m, BASE = build()
    te = train_predict(m, BASE, SEASON)
    te = te[te.week == WEEK][["season", "week", "home_ab", "away_ab", "ph", "pred_margin"]].copy()
    te["home_ab"] = norm_ab(te.home_ab); te["away_ab"] = norm_ab(te.away_ab)
    g = g.merge(te, on=GK, how="left")

    g["reg_edge"] = g.pred_margin - (-g.open_spread)
    g["confluence"] = (((g.ph >= 0.5 + CONF) & (g.reg_edge >= REG_EDGE)) |
                       ((g.ph <= 0.5 - CONF) & (g.reg_edge <= -REG_EDGE))).astype(int)

    def spread_pick(r):
        if pd.isna(r.ph) or abs(r.ph - 0.5) < CONF or pd.isna(r.open_spread):
            return "NEUTRAL"
        return (f"{r.home_ab} {r.open_spread:+g}" if r.ph >= 0.5
                else f"{r.away_ab} {-r.open_spread:+g}")
    g["fg_spread_pick"] = g.apply(spread_pick, axis=1)
    g["fg_home_win_prob"] = g.pred_margin.map(lambda x: round(win_prob(x), 4) if pd.notna(x) else None)

    # derived team totals: split FG pred total by pred margin (DISPLAY ONLY)
    g["tt_home_pred"] = (g.display_total + g.pred_margin) / 2
    g["tt_away_pred"] = (g.display_total - g.pred_margin) / 2

    # K1 point-in-time: within-slate rank of TT-sum minus posted total
    g["tt_sum"] = g.tt_home_close_tt_home_point + g.tt_away_close_tt_away_point
    g["k1"] = ((g.tt_sum - g.total_close_total_point).rank(pct=True) >= 0.8).fillna(False)
    return g


def p11_flag(g):
    """ATD-implied total vs posted total, mapping fit on 2024 only (point-in-time)."""
    pf = pd.read_parquet(DATA / "props_frame.parquet")
    atd = pf[(pf.market == "player_anytime_td") & pf.close_yes_prob.notna()].copy()
    per_player = (atd.groupby(["season", "week", "home_team", "away_team", "player_id"])
                  .close_yes_prob.median().reset_index())
    gm = (per_player.groupby(["season", "week", "home_team", "away_team"])
          .close_yes_prob.sum().reset_index(name="atd_sum"))
    gm["home_ab"] = gm.home_team.map(NAME_AB)
    gm["away_ab"] = gm.away_team.map(NAME_AB)

    f = pd.read_parquet(DATA / "h1tt_frame.parquet")
    f["actual_total"] = f.final_home + f.final_away
    gm = gm.merge(f[GK + ["actual_total", "total_close_total_point"]], on=GK, how="inner")

    fit = gm[gm.season == 2024].dropna(subset=["atd_sum", "actual_total"])
    b, a = np.polyfit(fit.atd_sum, fit.actual_total, 1)
    wk = gm[(gm.season == SEASON) & (gm.week == WEEK)].copy()
    wk["resid"] = (a + b * wk.atd_sum) - wk.total_close_total_point
    wk["p11"] = wk.resid.rank(pct=True) >= 0.8
    return g.merge(wk[GK + ["p11", "resid"]].rename(columns={"resid": "p11_resid"}),
                   on=GK, how="left")


def tt_history():
    """Per-team prior-game TT line + points (2025 season-to-date) for K5/K6."""
    f = pd.read_parquet(DATA / "h1tt_frame.parquet")
    f = f[(f.season == SEASON) & (f.week <= WEEK)]
    rows = []
    for side, ab, tt, pts in (("h", "home_ab", "tt_home_close_tt_home_point", "final_home"),
                              ("a", "away_ab", "tt_away_close_tt_away_point", "final_away")):
        s = f[["week", ab, tt, pts]].copy()
        s.columns = ["week", "team", "tt", "pts"]
        rows.append(s)
    t = pd.concat(rows).sort_values("week")
    t["prior_tt"] = t.groupby("team").tt.shift(1)
    t["prior_pts"] = t.groupby("team").pts.shift(1)
    return t[t.week == WEEK].set_index("team")


def build_flags(g):
    flags = []

    def add(r, source, rule, tier, market, side, line, price, edge, mammoth=False):
        if mammoth:
            conv = "mammoth"
        elif tier == "tracking":
            conv = "low"
        elif rule in ACTIVE_HIGH:
            conv = "high"
        else:
            conv = "med"
        flags.append(dict(
            game_id=r.game_id, season=SEASON, week=WEEK,
            game=f"{r.away_ab}@{r.home_ab}", source=source, rule=rule, tier=tier,
            market=market, side=side,
            line=float(line) if pd.notna(line) else None,
            price=price, edge=float(edge) if pd.notna(edge) else None,
            mammoth=bool(mammoth),
            signal_key=rule, conviction=conv, stake_units=STAKE[conv],
            grade_line=GRADE_LINE.get(source, "close")))

    # ---- FG harness ledger (already generated walk-forward at the opener)
    led = pd.read_csv(ROOT / "out" / "forecast_ledger_2025.csv")
    led = led[led.week == WEEK]
    gmap = {f"{r.away_ab}@{r.home_ab}": r for _, r in g.iterrows()}
    for _, p in led.iterrows():
        game, side = p.game, p.side
        for k, v in NORM.items():
            game = game.replace(k, v); side = side.replace(k, v)
        p = p.copy(); p.side = side
        r = gmap[game]
        tier = "tracking" if p.rule in TRACKING_HARNESS else "active"
        add(r, "fg_harness", p.rule, tier, p.market, p.side, p.open_num, None,
            p.edge, mammoth=bool(p.get("mammoth", 0)))

    # ---- consensus totals HC (the locked totals bet tier)
    for _, r in g[g.bet_quality == 1].iterrows():
        add(r, "consensus_totals", "consensus_totals_HC", "active", "total",
            f"{r.direction} {r.open_total:g}", r.open_total, None, r.edge_open)

    # ---- 1H confluence flags M1-M4 (vaulted tracking tier, paper-trade 2026)
    for _, r in g.iterrows():
        h1t, h1s = r.h1_total_close_h1_total_point, r.h1_spread_close_h1_spread_home
        fav_home = r.fg_sp < 0
        if pd.notna(r.resid_tot) and 1.25 <= r.resid_tot < 2.75 and r.k1 and pd.notna(h1t):
            add(r, "h1_model", "M1_window_over_k1", "tracking", "h1_total",
                f"1H OVER {h1t:g}", h1t, amer(r.h1_total_close_pay_h1_total_over_price), r.resid_tot)
        if r.k1 and pd.notna(r.resid_tot) and r.resid_tot > 0.5:
            add(r, "h1_model", "M2_k1_model_lean", "tracking", "total",
                f"OVER {r.total_close_total_point:g}", r.total_close_total_point,
                amer(r.total_close_pay_total_over_price), r.resid_tot)
        if r.slot in ("snf", "monday") and pd.notna(r.resid_cov) and pd.notna(h1s):
            if (fav_home and r.resid_cov > 0) or (not fav_home and r.resid_cov < 0):
                side = (f"{r.home_ab} 1H {h1s:+g}" if fav_home
                        else f"{r.away_ab} 1H {-h1s:+g}")
                pay = (r.h1_spread_close_pay_h1_spread_home_price if fav_home
                       else r.h1_spread_close_pay_h1_spread_away_price)
                add(r, "h1_model", "M3_primetime_fav_tilt", "tracking", "h1_spread",
                    side, h1s, amer(pay), r.resid_cov)
        for pf_col, is_dog, bet_home in (("h_h1_pf_avg", r.fg_sp > 0, False),
                                         ("a_h1_pf_avg", r.fg_sp < 0, True)):
            pf = getattr(r, pf_col)
            if pd.notna(pf) and pf <= 8 and is_dog and pd.notna(h1s):
                agree = r.resid_cov > 0 if bet_home else r.resid_cov < 0
                if pd.notna(r.resid_cov) and agree:
                    side = (f"{r.home_ab} 1H {h1s:+g}" if bet_home
                            else f"{r.away_ab} 1H {-h1s:+g}")
                    pay = (r.h1_spread_close_pay_h1_spread_home_price if bet_home
                           else r.h1_spread_close_pay_h1_spread_away_price)
                    add(r, "h1_model", "M4_slow_start_dog_fade", "tracking", "h1_spread",
                        side, h1s, amer(pay), r.resid_cov)

    # ---- K-signals (H1TT_BRIEF1 keepers; K4 needs offshore polling -> not in dry run)
    tt_hist = tt_history()
    for _, r in g.iterrows():
        h1s, h1so = r.h1_spread_close_h1_spread_home, r.h1_spread_open_h1_spread_home
        fav_home = r.fg_sp < 0
        if r.k1:
            add(r, "k_signal", "K1_tt_sum_q5_over", "tracking", "total",
                f"OVER {r.total_close_total_point:g}", r.total_close_total_point,
                amer(r.total_close_pay_total_over_price), r.tt_sum - r.total_close_total_point)
        if pd.notna(r.fg_sp) and r.fg_sp <= -7 and pd.notna(r.tt_home_close_tt_home_point):
            add(r, "k_signal", "K2_bigfav_home_tt_over", "tracking", "team_total",
                f"{r.home_ab} TT OVER {r.tt_home_close_tt_home_point:g}",
                r.tt_home_close_tt_home_point,
                amer(r.tt_home_close_pay_tt_home_over_price), abs(r.fg_sp))
        if pd.notna(h1s) and pd.notna(h1so) and abs(h1s - h1so) >= 1.0 and abs(r.fg_sp) < 7:
            steam_home = h1s < h1so          # line moved toward home -> follow home
            side = (f"{r.home_ab} 1H {h1s:+g}" if steam_home
                    else f"{r.away_ab} 1H {-h1s:+g}")
            pay = (r.h1_spread_close_pay_h1_spread_home_price if steam_home
                   else r.h1_spread_close_pay_h1_spread_away_price)
            add(r, "k_signal", "K3_h1_steam_follow_small", "tracking", "h1_spread",
                side, h1s, amer(pay), h1s - h1so)
        for team, ab_col, tt_col, pay_col in (
                (r.home_ab, "home", "tt_home_close_tt_home_point", "tt_home_close_pay_tt_home_over_price"),
                (r.away_ab, "away", "tt_away_close_tt_away_point", "tt_away_close_pay_tt_away_over_price")):
            tt_now = getattr(r, tt_col)
            if team not in tt_hist.index or pd.isna(tt_now):
                continue
            h = tt_hist.loc[team]
            if pd.isna(h.prior_tt) or pd.isna(h.prior_pts):
                continue
            miss = h.prior_pts - h.prior_tt
            move = tt_now - h.prior_tt
            if miss <= -8 and move <= -2:
                add(r, "k_signal", "K5_tt_cut_bounceback_over", "tracking", "team_total",
                    f"{team} TT OVER {tt_now:g}", tt_now, amer(getattr(r, pay_col)), miss)
            if miss >= 10 and move >= 3:
                add(r, "k_signal", "K6_tt_raise_momentum_over", "tracking", "team_total",
                    f"{team} TT OVER {tt_now:g}", tt_now, amer(getattr(r, pay_col)), miss)
        for pf_col, is_dog, bet_home in (("h_h1_pf_avg", r.fg_sp > 0, False),
                                         ("a_h1_pf_avg", r.fg_sp < 0, True)):
            pf = getattr(r, pf_col)
            if pd.notna(pf) and pf <= 8 and is_dog and pd.notna(h1s):
                side = (f"{r.home_ab} 1H {h1s:+g}" if bet_home
                        else f"{r.away_ab} 1H {-h1s:+g}")
                pay = (r.h1_spread_close_pay_h1_spread_home_price if bet_home
                       else r.h1_spread_close_pay_h1_spread_away_price)
                add(r, "k_signal", "K7_slow_start_dog_fade_1h", "tracking", "h1_spread",
                    side, h1s, amer(pay), pf)
        if r.slot in ("snf", "monday") and pd.notna(h1s) and pd.notna(r.fg_sp) and r.fg_sp != 0:
            side = (f"{r.home_ab} 1H {h1s:+g}" if fav_home
                    else f"{r.away_ab} 1H {-h1s:+g}")
            pay = (r.h1_spread_close_pay_h1_spread_home_price if fav_home
                   else r.h1_spread_close_pay_h1_spread_away_price)
            add(r, "k_signal", "K8_primetime_1h_fav", "tracking", "h1_spread",
                side, h1s, amer(pay), abs(r.fg_sp))
        # ---- team-total trend keepers (TT_TREND_BRIEF). Home TT lines run ~0.8-1.1pt
        # soft every season (2023-25) so home OVER is the structural edge; away TTs are
        # efficiently priced and yielded nothing durable. All tracking/paper-trade.
        tt_h = r.tt_home_close_tt_home_point
        tt_h_open = r.tt_home_open_tt_home_point
        if pd.notna(tt_h) and tt_h >= 24:                            # 55.4% / +5.7% [54,60,51]
            add(r, "k_signal", "K9_home_tt_high_over", "tracking", "team_total",
                f"{r.home_ab} TT OVER {tt_h:g}", tt_h,
                amer(r.tt_home_close_pay_tt_home_over_price), tt_h - 24)
        if pd.notna(tt_h) and pd.notna(tt_h_open) and (tt_h - tt_h_open) >= 0.5:  # 55.3% / +5.5% [54,59,52]
            add(r, "k_signal", "K10_home_tt_steam_over", "tracking", "team_total",
                f"{r.home_ab} TT OVER {tt_h:g}", tt_h,
                amer(r.tt_home_close_pay_tt_home_over_price), tt_h - tt_h_open)
        ov, un = r.tt_home_close_pay_tt_home_over_price, r.tt_home_close_pay_tt_home_under_price
        if pd.notna(tt_h) and pd.notna(ov) and pd.notna(un):
            juice = 1.0 / (ov + 1) - 1.0 / (un + 1)   # >0: market juices home OVER
            if juice > 0.03:                                          # fade -> UNDER 54.6% / +4.3% [50,59,55]
                add(r, "k_signal", "K11_home_tt_over_juiced_fade", "tracking", "team_total",
                    f"{r.home_ab} TT UNDER {tt_h:g}", tt_h,
                    amer(r.tt_home_close_pay_tt_home_under_price), juice)
        # NOVEL: TTs imply home LESS dominant than the spread -> back the away side ATS
        tt_a = r.tt_away_close_tt_away_point
        csp = r.spread_close_spread_home          # close spread, neg = home favored
        if pd.notna(tt_h) and pd.notna(tt_a) and pd.notna(csp):
            tt_vs_spread = (tt_h - tt_a) + csp
            if tt_vs_spread <= -1.5:                                  # away cover 60% / +14.5% [-,57,55]
                add(r, "k_signal", "K12_tt_implies_away_cover", "tracking", "spread",
                    f"{r.away_ab} {-csp:+g}", -csp,
                    amer(r.spread_close_pay_spread_away_price), tt_vs_spread)

    # ---- P11 (vaulted active): ATD-implied total top slate quintile -> game OVER
    for _, r in g[g.p11.fillna(False)].iterrows():
        add(r, "props", "P11_atd_implied_over", "active", "total",
            f"OVER {r.total_close_total_point:g}", r.total_close_total_point,
            amer(r.total_close_pay_total_over_price), r.p11_resid)

    return pd.DataFrame(flags)


def grade_play(kind, pick_side, line, r):
    """Grade a spread/total play against `line` using finals. None if ungradeable."""
    if pd.isna(line) or pd.isna(r.final_home) or pd.isna(r.final_away):
        return None
    fh, fa = int(r.final_home), int(r.final_away)
    if kind == "spread":
        margin = (fh - fa) if pick_side == "HOME" else (fa - fh)
        m = margin + line                      # line is the picked side's number
        return "win" if m > 0 else ("loss" if m < 0 else "push")
    if kind == "total":
        tp = fh + fa
        if tp == line:
            return "push"
        over = tp > line
        return "win" if (over == (pick_side == "OVER")) else "loss"
    return None


def book_meta():
    """book_key -> (display_name, logo_url) from nfl_sportsbooks (frontend also joins this)."""
    key = load_key()
    hdr = {"apikey": key, "Authorization": f"Bearer {key}"}
    resp = requests.get(f"{BASE_URL}/nfl_sportsbooks?select=book_key,display_name,logo_url",
                        headers=hdr, timeout=30)
    return {b["book_key"]: (b["display_name"], b["logo_url"]) for b in resp.json()}


def sig_objs(sub, pick_side, market, home_ab):
    """Per-signal display objects for a card: which TEAM/side each fired signal backs
    and whether it agrees with the card's pick. The frontend groups these under
    'Supporting Signals' (stance=support) vs 'Contradicting Signals' (stance=counter)
    and shows the resolved team so the user knows who the signal points at."""
    out = []
    for _, f in sub.iterrows():
        side = str(f.side)
        tok = side.split()
        team = None
        half = " 1H" if market.startswith("h1_") else ""
        if market in ("spread", "h1_spread"):
            ab = tok[0]
            team = AB_NAME.get(ab, ab)
            ha = "home" if ab == home_ab else "away"
            stance = "support" if (ab == home_ab) == (pick_side == "HOME") else "counter"
            # explicit per-game directive: name the team + which side it is
            action = f"{team} ({ha}{half})"
        elif market == "team_total":
            ab = tok[0]
            team = AB_NAME.get(ab, ab)
            dirn = "OVER" if "OVER" in side else ("UNDER" if "UNDER" in side else None)
            stance = "support" if dirn == pick_side else "counter"
            action = f"{team} team total {('Over' if dirn == 'OVER' else 'Under')}".strip() if dirn else team
        else:                                    # total / h1_total: side starts with OVER/UNDER
            stance = "support" if tok[0].upper() == pick_side else "counter"
            dirn = "Over" if tok[0].upper() == "OVER" else ("Under" if tok[0].upper() == "UNDER" else None)
            action = f"{dirn}{half}" if dirn else side
        out.append(dict(key=f.signal_key, label=side, team=team,
                        action=action, stance=stance, tier=f.tier))
    return sorted(out, key=lambda x: (x["stance"] != "support", x["key"]))


def build_picks(g, fl, books, kickoff, meta):
    """Eight normalized prediction rows per game (7 card groups; team_total = 2 rows).
    Mirrors cfb_dryrun_picks. team_total / moneyline / 1H cards are display-only for
    NFL (TT bets come only from tracking K-signals; the 1H model is paper-traded)."""
    picks = []

    def emit(r, **k):
        bk = k.get("best_book")
        nm, lg = meta.get(bk, (None, None)) if bk else (None, None)
        conv = k["conviction"]
        k.setdefault("recommendation", REC[conv])
        picks.append(dict(
            game_id=r.game_id, season=SEASON, week=WEEK,
            best_book_name=nm, best_book_logo=lg,
            is_mammoth=bool(k.pop("is_mammoth", False)),
            stake_units=STAKE[conv], result=k.pop("result", None), **k))

    for _, r in g.iterrows():
        bdf = books.get((r.home_ab, r.away_ab))
        gf = fl[fl.game_id == r.game_id]
        act_sp = gf[(gf.market == "spread") & (gf.tier == "active")]
        act_tot = gf[(gf.market == "total") & (gf.tier == "active")]
        home_nm, away_nm = AB_NAME.get(r.home_ab), AB_NAME.get(r.away_ab)

        # ---- 1. spread (the SCORE/MARGIN model is the prediction) ----
        # Single source of truth: the regression margin model. The pick side is whichever
        # side that model says covers the opener (reg_edge sign), and model_line is its
        # signed spread — both derived from the predicted score, so the spread can NEVER
        # conflict with the team totals / score header. The classification cover model (ph)
        # is no longer the headline; it rides along as the `sides_model` SIGNAL (support
        # when it agrees with the margin side, counter when it disagrees).
        # Conviction is gated on that agreement (walk-forward validated in bt_margin_ats.py:
        # AGREE 53.5%/+2.1%, DISAGREE 46%/-12%) and elevated when a validated spot aligns.
        side = "HOME" if (pd.notna(r.reg_edge) and r.reg_edge >= 0) else "AWAY"
        clf_home = pd.notna(r.ph) and r.ph >= 0.5
        agree = (side == "HOME") == clf_home
        re_mag = abs(float(r.reg_edge)) if pd.notna(r.reg_edge) else 0.0
        # a validated active spot (anything but the classification model) backing the SAME side
        spot_aligned = any(
            f.rule != "sides_model"
            and ((str(f.side).split()[0] == r.home_ab) == (side == "HOME"))
            for _, f in act_sp.iterrows())
        if not agree:
            conv = "none"                       # models split -> show prediction, no confident play
        elif re_mag >= 3 or spot_aligned:
            conv = "high"
        elif re_mag >= 1.5:
            conv = "med"
        elif re_mag > 0:
            conv = "lean"
        else:
            conv = "none"
        is_mam = bool(r.mammoth) and agree        # locked mammoth gate (confluence=1 + spot)
        if is_mam:
            conv = "mammoth"
        vline = r.open_spread if side == "HOME" else -r.open_spread
        edge = round(re_mag, 2) if conv != "none" else None
        team = home_nm if side == "HOME" else away_nm
        bbk, bln, bod = best_pick(bdf, "spread", side.lower())
        model_line = round(-r.pred_margin, 1) if side == "HOME" else round(r.pred_margin, 1)
        disp = conv == "none"
        emit(r, card_group="spread", bet_type="spread", sort_order=1, pick_side=side,
             pick_team=team, pick_label=f"{team} {(bln if bln is not None else vline):+g}",
             model_number=model_line, model_line=model_line,
             vegas_line=float(vline) if pd.notna(vline) else None, vegas_price=-110.0,
             edge=edge,
             best_book=bbk, best_line=bln, best_odds=bod, conviction=conv,
             is_mammoth=is_mam,
             has_play=not disp, display_only=disp,
             signal_keys=sorted(act_sp.signal_key.tolist()),
             signals=sig_objs(act_sp, side, "spread", r.home_ab),
             result=None if disp else grade_play("spread", side, vline, r))

        # ---- 2. total ----
        tdir = r.direction if r.direction in ("OVER", "UNDER") else (
            "OVER" if (pd.notna(r.edge_open) and r.edge_open > 0) else "UNDER")
        agree = act_tot[act_tot.side.str.contains(tdir, case=False, na=False)]
        hc = (r.tier == "HC")
        cons = agree[agree.rule == "consensus_totals_HC"]
        if r.direction == "NEUTRAL" or r.tier in (None, "NONE"):
            conv = "none"
        elif hc or not agree.empty:
            conv = "high"
        elif r.tier == "LEAN":
            conv = "low"
        elif r.tier == "WEAK":
            conv = "lean"
        else:
            conv = "none"
        vline = (cons.iloc[0].line if not cons.empty else r.open_total)
        edge = abs(r.edge_open) if pd.notna(r.edge_open) else None
        bbk, bln, bod = best_pick(bdf, "total", tdir.lower())
        disp = conv == "none"
        emit(r, card_group="total", bet_type="total", sort_order=2, pick_side=tdir,
             pick_team=None,
             pick_label=f"{tdir.title()} {(bln if bln is not None else vline):g}",
             model_number=round(float(r.display_total), 1) if pd.notna(r.display_total) else None,
             model_line=round(float(r.display_total), 1) if pd.notna(r.display_total) else None,
             vegas_line=float(vline) if pd.notna(vline) else None, vegas_price=-110.0,
             edge=round(edge, 2) if edge is not None else None,
             best_book=bbk, best_line=bln, best_odds=bod, conviction=conv,
             has_play=not disp, display_only=disp,
             signal_keys=sorted(act_tot.signal_key.tolist()),
             signals=sig_objs(act_tot, tdir, "total", r.home_ab),
             result=None if disp else grade_play("total", tdir, vline, r))

        # ---- 3-4. team totals (display-only; conviction only if a K-signal attaches) ----
        for bt, so, ab, nm, pred, close, opx, upx in (
                ("team_total_home", 3, r.home_ab, home_nm, r.tt_home_pred,
                 r.tt_home_close_tt_home_point, "tt_home_close_pay_tt_home_over_price",
                 "tt_home_close_pay_tt_home_under_price"),
                ("team_total_away", 4, r.away_ab, away_nm, r.tt_away_pred,
                 r.tt_away_close_tt_away_point, "tt_away_close_pay_tt_away_over_price",
                 "tt_away_close_pay_tt_away_under_price")):
            tside = "OVER" if (pd.notna(pred) and pd.notna(close) and pred >= close) else "UNDER"
            ksig = gf[(gf.market == "team_total") & (gf.side.str.startswith(f"{ab} TT", na=False))]
            conv = "low" if not ksig.empty else "none"
            side_key = ("home" if "home" in bt else "away") + "_" + tside.lower()
            bbk, bln, bod = best_pick(bdf, "tt", side_key)
            edge = (abs(pred - close) if pd.notna(pred) and pd.notna(close) else None)
            emit(r, card_group="team_total", bet_type=bt, sort_order=so, pick_side=tside,
                 pick_team=nm,
                 pick_label=f"{nm} {tside.title()} {(bln if bln is not None else close):g}"
                            if pd.notna(close) else None,
                 model_number=round(float(pred), 1) if pd.notna(pred) else None,
                 model_line=round(float(pred), 1) if pd.notna(pred) else None,
                 vegas_line=float(close) if pd.notna(close) else None,
                 vegas_price=amer(getattr(r, opx)) if tside == "OVER" else amer(getattr(r, upx)),
                 edge=round(edge, 2) if edge is not None else None,
                 best_book=bbk, best_line=bln, best_odds=bod, conviction=conv,
                 recommendation=REC[conv], has_play=False, display_only=True,
                 signal_keys=sorted(ksig.signal_key.tolist()),
                 signals=sig_objs(ksig, tside, "team_total", r.home_ab), result=None)

        # ---- 5. moneyline (display-only "Predicted Winner") ----
        ml_home = pd.notna(r.fg_home_win_prob) and r.fg_home_win_prob >= 0.5
        side = "HOME" if ml_home else "AWAY"
        bbk, bln, bod = best_pick(bdf, "ml", "home" if ml_home else "away")
        emit(r, card_group="moneyline", bet_type="moneyline", sort_order=5, pick_side=side,
             pick_team=home_nm if ml_home else away_nm,
             pick_label=f"{home_nm if ml_home else away_nm} ML",
             model_number=round(float(r.fg_home_win_prob if ml_home else 1 - r.fg_home_win_prob), 3)
                          if pd.notna(r.fg_home_win_prob) else None,
             model_line=None,
             vegas_line=None, vegas_price=(r.close_ml_home if ml_home else r.close_ml_away),
             edge=None, best_book=bbk, best_line=None, best_odds=bod, conviction="none",
             recommendation="Predicted Winner", has_play=False, display_only=True,
             signal_keys=[], signals=[], result=None)

        # ---- 6. h1 spread (tracking/display-only) ----
        # Single source: the 1H margin model (pred_m_anch). Pick the side that COVERS the
        # 1H spread, never the predicted winner and never the signal's side. h1c is the home
        # 1H spread (negative = home favored); home covers iff pred_m_anch + h1c >= 0. Tracking
        # signals attach as support/counter pills but DO NOT change the pick side.
        h1c = r.h1_spread_close_h1_spread_home
        h1f = gf[gf.market == "h1_spread"]
        h1_cov = (r.pred_m_anch + h1c) if (pd.notna(r.pred_m_anch) and pd.notna(h1c)) \
            else r.pred_m_anch
        side = "HOME" if (pd.notna(h1_cov) and h1_cov >= 0) else "AWAY"
        conv = "low" if not h1f.empty else "none"
        sk = sorted(h1f.signal_key.tolist())
        vline = h1c if side == "HOME" else (-h1c if pd.notna(h1c) else None)
        bbk, bln, bod = best_pick(bdf, "h1_spread", side.lower())
        m_line = (round(-r.pred_m_anch, 1) if side == "HOME" else round(r.pred_m_anch, 1)) \
            if pd.notna(r.pred_m_anch) else None
        emit(r, card_group="h1_spread", bet_type="h1_spread", sort_order=6, pick_side=side,
             pick_team=home_nm if side == "HOME" else away_nm,
             pick_label=f"{home_nm if side=='HOME' else away_nm} 1H "
                        f"{(bln if bln is not None else vline):+g}" if pd.notna(vline) or bln is not None else None,
             model_number=m_line,
             model_line=m_line,
             vegas_line=float(vline) if pd.notna(vline) else None,
             vegas_price=amer(r.h1_spread_close_pay_h1_spread_home_price if side == "HOME"
                              else r.h1_spread_close_pay_h1_spread_away_price),
             edge=None, best_book=bbk, best_line=bln, best_odds=bod, conviction=conv,
             recommendation=REC[conv], has_play=False, display_only=True,
             signal_keys=sk, signals=sig_objs(h1f, side, "h1_spread", r.home_ab),
             result=None)

        # ---- 7. h1 total (tracking/display-only) ----
        h1tf = gf[gf.market == "h1_total"]
        tside = "OVER" if (pd.notna(r.pred_tot_anch) and pd.notna(r.h1_total_close_h1_total_point)
                           and r.pred_tot_anch >= r.h1_total_close_h1_total_point) else "UNDER"
        conv = "low" if not h1tf.empty else "none"
        h1t = r.h1_total_close_h1_total_point
        bbk, bln, bod = best_pick(bdf, "h1_total", tside.lower())
        emit(r, card_group="h1_total", bet_type="h1_total", sort_order=7, pick_side=tside,
             pick_team=None,
             pick_label=f"1H {tside.title()} {(bln if bln is not None else h1t):g}"
                        if pd.notna(h1t) else None,
             model_number=round(float(r.pred_tot_anch), 1) if pd.notna(r.pred_tot_anch) else None,
             model_line=round(float(r.pred_tot_anch), 1) if pd.notna(r.pred_tot_anch) else None,
             vegas_line=float(h1t) if pd.notna(h1t) else None,
             vegas_price=amer(r.h1_total_close_pay_h1_total_over_price if tside == "OVER"
                              else r.h1_total_close_pay_h1_total_under_price),
             edge=None, best_book=bbk, best_line=bln, best_odds=bod, conviction=conv,
             recommendation=REC[conv], has_play=False, display_only=True,
             signal_keys=sorted(h1tf.signal_key.tolist()),
             signals=sig_objs(h1tf, tside, "h1_total", r.home_ab), result=None)

        # ---- 8. h1 moneyline (display-only "Predicted Winner") ----
        h1_home = pd.notna(r.prob_home_1h) and r.prob_home_1h >= 0.5
        side = "HOME" if h1_home else "AWAY"
        bbk, bln, bod = best_pick(bdf, "h1_ml", "home" if h1_home else "away")
        emit(r, card_group="h1_ml", bet_type="h1_ml", sort_order=8, pick_side=side,
             pick_team=home_nm if h1_home else away_nm,
             pick_label=f"{home_nm if h1_home else away_nm} 1H ML",
             model_number=round(float(r.prob_home_1h if h1_home else 1 - r.prob_home_1h), 3)
                          if pd.notna(r.prob_home_1h) else None,
             model_line=None, vegas_line=None,
             vegas_price=amer(r.h1_ml_close_pay_h1_ml_home if h1_home else r.h1_ml_close_pay_h1_ml_away),
             edge=None, best_book=bbk, best_line=None, best_odds=bod, conviction="none",
             recommendation="Predicted Winner", has_play=False, display_only=True,
             signal_keys=[], signals=[], result=None)

    return pd.DataFrame(picks)


def game_conviction(pk):
    """Game-level conviction from its has_play picks (top by CONV_RANK).
    Returns (tier, stake_units, summary_jsonb). 'none' if no actionable play."""
    plays = [p for p in pk if p.get("has_play")]
    if not plays:
        return "none", 0.0, {"top_card": None, "top_conviction": "none", "plays": []}
    top = max(plays, key=lambda p: CONV_RANK.get(p["conviction"], 0))
    summary = {
        "top_card": top["bet_type"], "top_conviction": top["conviction"],
        "plays": sorted(
            ({"card_group": p["card_group"], "conviction": p["conviction"],
              "recommendation": p["recommendation"], "pick_label": p.get("pick_label")}
             for p in plays),
            key=lambda x: -CONV_RANK.get(x["conviction"], 0)),
    }
    return top["conviction"], STAKE[top["conviction"]], summary


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-load", action="store_true", help="print only, skip Supabase load")
    args = ap.parse_args()

    g = build_games()
    g = p11_flag(g)
    fl = build_flags(g)

    counts = fl.groupby(["game_id", "tier"]).size().unstack(fill_value=0)
    g["flags_active"] = g.game_id.map(counts.get("active", pd.Series(dtype=int))).fillna(0).astype(int)
    g["flags_tracking"] = g.game_id.map(counts.get("tracking", pd.Series(dtype=int))).fillna(0).astype(int)
    mam = fl[fl.mammoth].game_id.unique()
    g["mammoth"] = g.game_id.isin(mam)

    books, kickoff = load_books(g)
    meta = book_meta() if not args.no_load else {}
    picks = build_picks(g, fl, books, kickoff, meta)
    pk_by_game = {gid: sub.to_dict("records") for gid, sub in picks.groupby("game_id")}

    def best_tt(bdf, side_key):
        _, ln, _ = best_pick(bdf, "tt", side_key)
        return ln

    rows = []
    for _, r in g.iterrows():
        pk = pk_by_game.get(r.game_id, [])
        bm = {p["bet_type"]: p for p in pk}
        conv_tier, stake_u, summary = game_conviction(pk)
        bdf = books.get((r.home_ab, r.away_ab))
        wx = weather(r)
        rows.append(dict(
            game_id=r.game_id, season=SEASON, week=WEEK, gameday=r.gameday,
            kickoff=kickoff.get((r.home_ab, r.away_ab)),
            slot=r.slot, home_ab=r.home_ab, away_ab=r.away_ab,
            home_team=AB_NAME.get(r.home_ab), away_team=AB_NAME.get(r.away_ab),
            fg_spread_open=r.open_spread, fg_spread_close=r.spread_close_spread_home,
            fg_total_open=r.open_total, fg_total_close=r.total_close_total_point,
            fg_ml_home_close=r.close_ml_home, fg_ml_away_close=r.close_ml_away,
            tt_home_close=r.tt_home_close_tt_home_point,
            tt_home_over_price=amer(r.tt_home_close_pay_tt_home_over_price),
            tt_home_under_price=amer(r.tt_home_close_pay_tt_home_under_price),
            tt_away_close=r.tt_away_close_tt_away_point,
            tt_away_over_price=amer(r.tt_away_close_pay_tt_away_over_price),
            tt_away_under_price=amer(r.tt_away_close_pay_tt_away_under_price),
            h1_spread_close=r.h1_spread_close_h1_spread_home,
            h1_spread_home_price=amer(r.h1_spread_close_pay_h1_spread_home_price),
            h1_spread_away_price=amer(r.h1_spread_close_pay_h1_spread_away_price),
            h1_total_close=r.h1_total_close_h1_total_point,
            h1_total_over_price=amer(r.h1_total_close_pay_h1_total_over_price),
            h1_total_under_price=amer(r.h1_total_close_pay_h1_total_under_price),
            h1_ml_home_close=amer(r.h1_ml_close_pay_h1_ml_home),
            h1_ml_away_close=amer(r.h1_ml_close_pay_h1_ml_away),
            fg_pred_total=round(float(r.display_total), 2) if pd.notna(r.display_total) else None,
            fg_total_edge=r.edge_open, fg_total_pick=r.direction, fg_total_tier=r.tier,
            fg_home_cover_prob=round(float(r.ph), 4) if pd.notna(r.ph) else None,
            fg_pred_margin=round(float(r.pred_margin), 2) if pd.notna(r.pred_margin) else None,
            # slate spread pick = the margin model's covering side (matches the spread card).
            # fg_home_cover_prob (classification) is the agreement signal, not the headline.
            fg_spread_pick=(
                f"{(r.home_ab if bm['spread']['pick_side'] == 'HOME' else r.away_ab)} "
                f"{(r.open_spread if bm['spread']['pick_side'] == 'HOME' else -r.open_spread):+g}"
                if bm.get("spread") and pd.notna(r.open_spread) else None),
            fg_spread_confluence=int(r.confluence),
            fg_home_win_prob=r.fg_home_win_prob,
            # FG predicted box score (DISPLAY): split of pred total by pred margin
            fg_pred_home_pts=round(float(r.tt_home_pred), 1) if pd.notna(r.tt_home_pred) else None,
            fg_pred_away_pts=round(float(r.tt_away_pred), 1) if pd.notna(r.tt_away_pred) else None,
            fg_pred_spread=round(float(-r.pred_margin), 1) if pd.notna(r.pred_margin) else None,
            fg_spread_edge=round(float(r.reg_edge), 2) if pd.notna(r.reg_edge) else None,
            tt_home_pred=round(float(r.tt_home_pred), 2) if pd.notna(r.tt_home_pred) else None,
            tt_away_pred=round(float(r.tt_away_pred), 2) if pd.notna(r.tt_away_pred) else None,
            tt_home_pick=bm.get("team_total_home", {}).get("pick_side"),
            tt_away_pick=bm.get("team_total_away", {}).get("pick_side"),
            tt_home_edge=bm.get("team_total_home", {}).get("edge"),
            tt_away_edge=bm.get("team_total_away", {}).get("edge"),
            tt_home_best_over=best_tt(bdf, "home_over"),
            tt_home_best_under=best_tt(bdf, "home_under"),
            tt_away_best_over=best_tt(bdf, "away_over"),
            tt_away_best_under=best_tt(bdf, "away_under"),
            h1_pred_total=round(float(r.pred_tot_anch), 2) if pd.notna(r.pred_tot_anch) else None,
            h1_total_edge=round(float(r.resid_tot), 2) if pd.notna(r.resid_tot) else None,
            h1_pred_margin=round(float(r.pred_m_anch), 2) if pd.notna(r.pred_m_anch) else None,
            h1_home_win_prob=round(float(r.prob_home_1h), 4) if pd.notna(r.prob_home_1h) else None,
            h1_cover_tilt=round(float(r.resid_cov), 2) if pd.notna(r.resid_cov) else None,
            h1_spread_pick=bm.get("h1_spread", {}).get("pick_label"),
            h1_total_pick=bm.get("h1_total", {}).get("pick_label"),
            h1_ml_pick=bm.get("h1_ml", {}).get("pick_label"),
            conviction_tier=conv_tier, stake_units=stake_u, conviction_summary=summary,
            flags_active=int(r.flags_active), flags_tracking=int(r.flags_tracking),
            mammoth=bool(r.mammoth),
            **wx,
            final_home=int(r.final_home), final_away=int(r.final_away),
            h1_home=int(r.h1_home), h1_away=int(r.h1_away)))
    games = pd.DataFrame(rows)
    fl = fl.replace({np.nan: None})

    print(f"{len(games)} games, {len(fl)} flags "
          f"({(fl.tier == 'active').sum()} active / {(fl.tier == 'tracking').sum()} tracking), "
          f"{len(picks)} picks")
    print(fl[["game", "source", "rule", "tier", "side"]].to_string(index=False))
    print(picks.groupby(["card_group", "conviction"]).size().to_string())

    if args.no_load:
        return
    key = load_key()
    hdr = {"apikey": key, "Authorization": f"Bearer {key}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}
    # idempotent reload: children first (FK), then games.
    # Props have their own loader (dryrun_wk12_props.py) — don't delete them here
    # or a games-only reload leaves the Props tab empty until props are re-run.
    for t in ("nfl_dryrun_picks", "nfl_dryrun_flags", "nfl_dryrun_games"):
        resp = requests.delete(f"{BASE_URL}/{t}?season=eq.{SEASON}&week=eq.{WEEK}",
                               headers=hdr, timeout=60)
        if resp.status_code not in (200, 204):
            sys.exit(f"delete {t}: {resp.status_code} {resp.text[:300]}")
    for t, df in (("nfl_dryrun_games", games), ("nfl_dryrun_flags", fl),
                  ("nfl_dryrun_picks", picks)):
        recs = json.loads(df.to_json(orient="records"))   # to_json handles numpy types
        resp = requests.post(f"{BASE_URL}/{t}", headers=hdr, json=recs, timeout=60)
        if resp.status_code != 201:
            sys.exit(f"insert {t}: {resp.status_code} {resp.text[:300]}")
        print(f"loaded {len(recs)} rows -> {t}")


if __name__ == "__main__":
    main()
