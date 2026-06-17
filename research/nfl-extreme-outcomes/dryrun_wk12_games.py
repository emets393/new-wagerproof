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
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
BASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
SEASON, WEEK = 2025, 12
GK = ["season", "week", "home_ab", "away_ab"]
# harness/odds_consensus use nflfastR-style codes; h1tt frames use Odds-API-derived
NORM = {"LAR": "LA", "WSH": "WAS", "JAC": "JAX"}
_tm = pd.read_parquet(DATA / "team_mapping.parquet")
_tm["ab"] = _tm["Team Abbrev"].replace(NORM)
NAME_AB = dict(zip(_tm.city_and_name, _tm.ab))      # "Los Angeles Rams" -> "LA"
AB_NAME = dict(zip(_tm.ab, _tm.city_and_name))
TRACKING_HARNESS = {"primetime_tight_favorite", "primetime_tight_under",
                    "bot_vs_bot_under", "bye_collision", "week1_def_under"}


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
        flags.append(dict(
            game_id=r.game_id, season=SEASON, week=WEEK,
            game=f"{r.away_ab}@{r.home_ab}", source=source, rule=rule, tier=tier,
            market=market, side=side,
            line=float(line) if pd.notna(line) else None,
            price=price, edge=float(edge) if pd.notna(edge) else None,
            mammoth=bool(mammoth)))

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
        if pd.notna(r.fg_sp) and abs(r.fg_sp) >= 7 and pd.notna(r.tt_home_close_tt_home_point):
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

    # ---- P11 (vaulted active): ATD-implied total top slate quintile -> game OVER
    for _, r in g[g.p11.fillna(False)].iterrows():
        add(r, "props", "P11_atd_implied_over", "active", "total",
            f"OVER {r.total_close_total_point:g}", r.total_close_total_point,
            amer(r.total_close_pay_total_over_price), r.p11_resid)

    return pd.DataFrame(flags)


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

    rows = []
    for _, r in g.iterrows():
        rows.append(dict(
            game_id=r.game_id, season=SEASON, week=WEEK, gameday=r.gameday,
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
            fg_spread_pick=r.fg_spread_pick, fg_spread_confluence=int(r.confluence),
            fg_home_win_prob=r.fg_home_win_prob,
            tt_home_pred=round(float(r.tt_home_pred), 2) if pd.notna(r.tt_home_pred) else None,
            tt_away_pred=round(float(r.tt_away_pred), 2) if pd.notna(r.tt_away_pred) else None,
            h1_pred_total=round(float(r.pred_tot_anch), 2) if pd.notna(r.pred_tot_anch) else None,
            h1_total_edge=round(float(r.resid_tot), 2) if pd.notna(r.resid_tot) else None,
            h1_pred_margin=round(float(r.pred_m_anch), 2) if pd.notna(r.pred_m_anch) else None,
            h1_home_win_prob=round(float(r.prob_home_1h), 4) if pd.notna(r.prob_home_1h) else None,
            h1_cover_tilt=round(float(r.resid_cov), 2) if pd.notna(r.resid_cov) else None,
            flags_active=int(r.flags_active), flags_tracking=int(r.flags_tracking),
            mammoth=bool(r.mammoth),
            final_home=int(r.final_home), final_away=int(r.final_away),
            h1_home=int(r.h1_home), h1_away=int(r.h1_away)))
    games = pd.DataFrame(rows).replace({np.nan: None})
    fl = fl.replace({np.nan: None})

    print(f"{len(games)} games, {len(fl)} flags "
          f"({(fl.tier == 'active').sum()} active / {(fl.tier == 'tracking').sum()} tracking)")
    print(fl[["game", "source", "rule", "tier", "side"]].to_string(index=False))

    if args.no_load:
        return
    key = load_key()
    hdr = {"apikey": key, "Authorization": f"Bearer {key}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}
    # idempotent reload: children first (FK), then games
    for t in ("nfl_dryrun_flags", "nfl_dryrun_props", "nfl_dryrun_games"):
        resp = requests.delete(f"{BASE_URL}/{t}?season=eq.{SEASON}&week=eq.{WEEK}",
                               headers=hdr, timeout=60)
        if resp.status_code not in (200, 204):
            sys.exit(f"delete {t}: {resp.status_code} {resp.text[:300]}")
    for t, df in (("nfl_dryrun_games", games), ("nfl_dryrun_flags", fl)):
        recs = json.loads(df.to_json(orient="records"))   # to_json handles numpy types
        resp = requests.post(f"{BASE_URL}/{t}", headers=hdr, json=recs, timeout=60)
        if resp.status_code != 201:
            sys.exit(f"insert {t}: {resp.status_code} {resp.text[:300]}")
        print(f"loaded {len(recs)} rows -> {t}")


if __name__ == "__main__":
    main()
