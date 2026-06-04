"""
CFB FORECAST HARNESS — production prediction + spot flags + CLV grading.

Trains LEAN totals + sides models (no priors — the betting edge) walk-forward, then for the
target season generates, for EVERY game: a predicted total + spread (website display) and any
validated SPOT flags (the high-confidence bets). Grades vs OPEN + computes CLV when results exist.

Usage:
  python3 cfb_forecast.py                 # 2025 dry-run (train on <2025)
  python3 cfb_forecast.py --season 2026 --week 6   # weekly production (needs 2026 data pulled)
Outputs:
  out/cfb_predictions_<season>.csv  — every game (display)
  out/cfb_bets_<season>.csv         — games where >=1 spot fires (the ledger)
"""
import os, sys, argparse
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out"); os.makedirs(OUT, exist_ok=True)
DATA = os.path.join(HERE, "data", "cfbd")
P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}

EXCLUDE = {"game_id", "season", "date", "homeTeam", "awayTeam", "homeConference", "awayConference",
           "homePoints", "awayPoints", "venueId", "actual_total", "actual_margin",
           "spread_close", "spread_open", "total_close", "total_open"}


def load():
    gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
    num = gm.select_dtypes(include=[np.number, "Int64", "boolean"])
    feats = [c for c in num.columns if c not in EXCLUDE]
    gm[feats] = gm[feats].apply(pd.to_numeric, errors="coerce")
    return gm, feats


def add_situational_flags(df):
    """ranked-upset, primetime-rr letdown, rival look-ahead, backup-QB (home/away + either)."""
    YEARS = sorted(df.season.unique().tolist())
    import rivalry_spots as RIV
    rivpairs = {frozenset(p) for p in RIV.RIVALRIES}
    rk = pd.read_parquet(os.path.join(DATA, "rankings_weekly.parquet")).rename(columns={"year": "season"})
    rk = rk[rk.poll == "AP Top 25"]; ranked = set(zip(rk.season, rk.asof_week, rk.team))
    # sequence over ALL seasons for lag continuity
    allyears = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025] + [y for y in YEARS if y >= 2026]
    rows = []
    for y in sorted(set(allyears)):
        p = os.path.join(DATA, f"games_{y}.parquet")
        if not os.path.exists(p):
            continue
        g = pd.read_parquet(p); g = g[(g.seasonType == "regular") & g.homePoints.notna()]
        kt = pd.to_datetime(g.startDate, utc=True, errors="coerce") - pd.Timedelta(hours=4)
        g = g.assign(_h=kt.dt.hour, _d=kt.dt.dayofweek)
        for _, r in g.iterrows():
            pt = 1 if ((r._h >= 19 or r._h <= 2) and r._d == 5) else 0
            for who, opp in (("home", "away"), ("away", "home")):
                rows.append({"season": y, "week": int(r.week), "team": r[f"{who}Team"], "opp": r[f"{opp}Team"],
                             "won": int(r[f"{who}Points"] > r[f"{opp}Points"]), "pt": pt})
    tg = pd.DataFrame(rows)
    tg["opp_ranked"] = [1 if (s, w, o) in ranked else 0 for s, w, o in zip(tg.season, tg.week, tg.opp)]
    tg["self_ranked"] = [1 if (s, w, t) in ranked else 0 for s, w, t in zip(tg.season, tg.week, tg.team)]
    tg["is_riv"] = [frozenset((t, o)) in rivpairs for t, o in zip(tg.team, tg.opp)]
    tg = tg.sort_values(["team", "season", "week"]); gb = tg.groupby(["team", "season"], group_keys=False)
    for c in ["won", "opp_ranked", "self_ranked", "pt", "is_riv"]:
        tg[f"last_{c}"] = gb[c].shift(1)
    tg["rival_next"] = gb["is_riv"].shift(-1)
    tg["f_ranked_upset"] = ((tg.last_self_ranked == 1) & (tg.last_won == 0) & (tg.last_opp_ranked == 0)).astype(int)
    tg["f_pt_letdown"] = ((tg.last_pt == 1) & (tg.last_opp_ranked == 1) & (tg.last_self_ranked == 1)).astype(int)
    tg["f_rival_next"] = (tg.rival_next == True).astype(int)
    FL = ["f_ranked_upset", "f_pt_letdown", "f_rival_next"]
    # QB backup
    qbp = os.path.join(DATA, "qb_starts.parquet")
    if os.path.exists(qbp):
        qb = pd.read_parquet(qbp).sort_values(["team", "season", "week"])
        def est(grp):
            out, cum = [], {}
            for _, r in grp.iterrows():
                out.append(max(cum, key=cum.get) if cum else None); cum[r.qb] = cum.get(r.qb, 0) + r.att
            grp = grp.copy(); grp["established"] = out; return grp
        qb = qb.groupby(["team", "season"], group_keys=False).apply(est)
        qb["f_backup"] = ((qb.established.notna()) & (qb.qb != qb.established) & (qb.att >= 10)).astype(int)
        qb = qb.sort_values("att").drop_duplicates(["season", "week", "team"], keep="last")  # dup games in source
        tg = tg.merge(qb[["season", "week", "team", "f_backup"]], on=["season", "week", "team"], how="left")
        FL.append("f_backup")
    flagtab = tg[["season", "week", "team"] + FL].drop_duplicates(["season", "week", "team"])  # guard fan-out
    for side in ["homeTeam", "awayTeam"]:
        df = df.merge(flagtab.rename(
            columns={"team": side, **{f: f"{side[:4]}_{f}" for f in FL}}), on=["season", "week", side], how="left")
    for f in FL:
        for pre in ["home", "away "]:
            pass
    for f in FL:
        df[f"home_{f}"] = df.get(f"home_{f}", pd.Series(0, index=df.index)).fillna(0)
        df[f"away_{f}"] = df.get(f"away_{f}", pd.Series(0, index=df.index)).fillna(0)
        df[f"either_{f}"] = ((df[f"home_{f}"] + df[f"away_{f}"]) >= 1).astype(int)
    return df


def spot_library(df):
    """Return ordered dict: spot_name -> (boolean mask, side, market). Each spot is curated &
    selective. Tiers: T1 = beats-close high conviction; T2 = bettable-at-open leans."""
    ep = pd.to_numeric(df.get("expected_plays"), errors="coerce"); ep66 = ep.quantile(0.66)
    to = df["total_open"]
    df["tier"] = np.where(df.homeConference.isin(P5) & df.awayConference.isin(P5), "P5",
                  np.where(~df.homeConference.isin(P5) & ~df.awayConference.isin(P5), "G5", "mix"))
    thr = pd.to_numeric(pd.concat([df.get("home_adj_passing_epa_allowed"), df.get("away_adj_passing_epa_allowed")]), errors="coerce").quantile(0.66)
    both_weak = (pd.to_numeric(df.get("home_adj_passing_epa_allowed"), errors="coerce") >= thr) & \
                (pd.to_numeric(df.get("away_adj_passing_epa_allowed"), errors="coerce") >= thr)
    eb = lambda c: df.get(c, pd.Series(0, index=df.index)).fillna(0) == 1
    z = pd.Series(np.nan, index=df.index)
    gap = pd.to_numeric(df.get("soft_gap", z), errors="coerce")        # sharp_close - soft_close (<0 sharp=home)
    dk = pd.to_numeric(df.get("dk_sp_close", z), errors="coerce")      # DraftKings close home-spread
    ec = pd.to_numeric(df.get("side_edge_close", z), errors="coerce")  # pred_margin + spread_close (model lean @ close)
    sc = pd.to_numeric(df.get("spread_close", z), errors="coerce")
    tc = pd.to_numeric(df.get("total_close", z), errors="coerce")
    conf = pd.Series(np.where(df.homeConference == df.awayConference, df.homeConference, "NON"), index=df.index)
    # reversal veto: a late spread reversal that CONTRADICTS the model -> model only 40% (combo_model_lines)
    se = pd.to_numeric(df.get("sp_early", z), errors="coerce"); sl = pd.to_numeric(df.get("sp_late", z), errors="coerce")
    rev_exists = (np.sign(se) != np.sign(sl)) & (se.abs() >= 1) & (sl.abs() >= 1)
    mh = ec > 0                                                        # model lean home @ close
    rev_contra = (rev_exists & ((sl < 0) != mh)).fillna(False)         # reversal opposes model -> veto
    df["rev_veto"] = rev_contra.astype(int)
    S = {}
    # ===== MODEL x SOFT-BOOK STACK (headline: two INDEPENDENT edges agree) — grade @ close =====
    # combo_model_lines.py: model+gap>=1 AGREE 72.7% (2025 77.8%); model+gap.5-1 ~55%. Vetoed on contra-reversal.
    base = (ec.abs() >= 2) & ~rev_contra
    S["STACK model+gap>=1 HOME"] = ((base & mh & (gap <= -1.0)).fillna(False), "HOME", "side", "close")
    S["STACK model+gap>=1 AWAY"] = ((base & ~mh & (gap >= 1.0)).fillna(False), "AWAY", "side", "close")
    S["STACK model+gap.5-1 HOME"] = ((base & mh & (gap <= -0.5) & (gap > -1.0)).fillna(False), "HOME", "side", "close")
    S["STACK model+gap.5-1 AWAY"] = ((base & ~mh & (gap >= 0.5) & (gap < 1.0)).fillna(False), "AWAY", "side", "close")
    # ===== SOFT-BOOK STANDALONE (line discrepancy) — bet SHARP side at best SOFT number =====
    # book_consensus_blend.py: gap>=1.0 64.2%/+22.6%; gap>=0.5 56.8%/+8.4%.
    S["SB premium gap>=1 (sharp=HOME)"] = ((gap <= -1.0).fillna(False), "HOME", "side", "soft")
    S["SB premium gap>=1 (sharp=AWAY)"] = ((gap >= 1.0).fillna(False), "AWAY", "side", "soft")
    S["SB volume gap.5-1 (sharp=HOME)"] = (((gap <= -0.5) & (gap > -1.0)).fillna(False), "HOME", "side", "soft")
    S["SB volume gap.5-1 (sharp=AWAY)"] = (((gap >= 0.5) & (gap < 1.0)).fillna(False), "AWAY", "side", "soft")
    # ===== KEY NUMBERS (DraftKings close) — dk_keynumbers.py =====
    S["KEY dog +2.5/3/3.5 (HOME dog)"] = (dk.isin([2.5, 3.0, 3.5]).fillna(False), "HOME", "side", "dk")
    S["KEY dog +2.5/3/3.5 (AWAY dog)"] = (dk.isin([-2.5, -3.0, -3.5]).fillna(False), "AWAY", "side", "dk")
    S["KEY lay -6.5 (HOME fav)"] = ((dk == -6.5).fillna(False), "HOME", "side", "dk")
    S["KEY lay -6.5 (AWAY fav)"] = ((dk == 6.5).fillna(False), "AWAY", "side", "dk")
    # ===== CONFERENCE structural numbers (conf_numbers.py) — grade @ close =====
    S["CONF SunBelt fade home-fav (dog)"] = (((conf == "Sun Belt") & (sc < 0)).fillna(False), "AWAY", "side", "close")
    S["CONF BigTen away-fav cover"] = (((conf == "Big Ten") & (sc > 0)).fillna(False), "AWAY", "side", "close")
    S["CONF SEC total 52+ UNDER"] = (((conf == "SEC") & (tc > 52)).fillna(False), "UNDER", "total", "close")
    S["CONF AAC total 52-59 OVER"] = (((conf == "American Athletic") & (tc > 52) & (tc <= 59)).fillna(False), "OVER", "total", "close")
    S["CONF SunBelt total 59-66 UNDER"] = (((conf == "Sun Belt") & (tc > 59) & (tc <= 66)).fillna(False), "UNDER", "total", "close")
    # ===== TOTALS (fundamentals model spots) — grade @ open =====
    S["T1 under: model+high-total/weakD"] = (((df.total_edge <= -3) & ((to >= 62) | both_weak) & (df.tier != "mix")).fillna(False), "UNDER", "total", "open")
    S["T1 over: low-total+fast (P5)"] = (((to <= 48) & (ep >= ep66) & (df.tier == "P5")).fillna(False), "OVER", "total", "open")
    S["T2 over: week 13 rivalry wk"] = ((df.week == 13), "OVER", "total", "open")
    S["T2 under: week 1 opener"] = ((df.week == 1), "UNDER", "total", "open")
    S["T2 under: ranked upset last wk"] = (eb("either_f_ranked_upset"), "UNDER", "total", "open")
    S["T2 under: PT rr letdown"] = (eb("either_f_pt_letdown"), "UNDER", "total", "open")
    S["T2 under: backup QB (open>=50)"] = (eb("either_f_backup") & (to >= 50), "UNDER", "total", "open")
    # ===== SIDES (fundamentals model spots) — grade @ open =====
    # TOP tier: |edge|>=8 backing the FAVORITE at line<21 (market underrates strong favs) -> 68.6%/62.5% close.
    hi = (df.side_edge.abs() >= 8) & (df.tier == "P5") & (df.spread_open.abs() < 21)
    fav_away = hi & (df.side_edge <= -8) & (df.spread_open > 0)   # away favored, model loves away more
    fav_home = hi & (df.side_edge >= 8) & (df.spread_open < 0)    # home favored, model loves home more
    S["PREMIUM lay-fav away (P5 edge<=-8)"] = (fav_away.fillna(False), "AWAY", "side", "open")
    S["PREMIUM lay-fav home (P5 edge>=8)"] = (fav_home.fillna(False), "HOME", "side", "open")
    S["T2 high-edge dog away (P5)"] = (((df.side_edge <= -8) & (df.tier == "P5") & (df.spread_open <= 0)).fillna(False), "AWAY", "side", "open")
    S["T2 high-edge dog home (P5)"] = (((df.side_edge >= 8) & (df.tier == "P5") & (df.spread_open >= 0)).fillna(False), "HOME", "side", "open")
    S["T3 away: P5 edge -4to-8"] = (((df.side_edge <= -4) & (df.side_edge > -8) & (df.tier == "P5")).fillna(False), "AWAY", "side", "open")
    S["T3 fade home backup QB (bet away)"] = (eb("home_f_backup"), "AWAY", "side", "open")
    return S


def apply_spots(df):
    S = spot_library(df)
    # headline columns: first totals spot + first sides spot that fires (dict order = conviction order)
    df["totals_bet"] = ""; df["sides_bet"] = ""; df["spots"] = ""
    for name, (mask, side, mkt, gl) in S.items():
        col = "totals_bet" if mkt == "total" else "sides_bet"
        df.loc[mask & (df[col] == ""), col] = side
        df.loc[mask, "spots"] = df.loc[mask, "spots"].astype(str) + name + "; "
    return df, S


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=2025)
    ap.add_argument("--week", type=int, default=None)
    a = ap.parse_args()
    gm, feats = load()
    tr = gm[(gm.season < a.season) & gm.actual_total.notna()]
    te = gm[gm.season == a.season].copy()
    if a.week:
        te = te[te.week == a.week]
    tm = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4, l2_regularization=1.0, random_state=0).fit(tr[feats], tr.actual_total)
    sm = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4, l2_regularization=1.0, random_state=0).fit(tr[feats], tr.actual_margin)
    te["pred_total"] = tm.predict(te[feats]); te["pred_margin"] = sm.predict(te[feats])
    te["total_edge"] = te.pred_total - te.total_open
    te["side_edge"] = te.pred_margin + te.spread_open
    te["side_edge_close"] = te.pred_margin + te.spread_close   # model lean @ close (for the stack spots)
    te["pred_spread"] = -te.pred_margin   # home-perspective spread
    # market-microstructure signals (soft_gap, dk_sp_close, sp_early/late) from the odds archive
    import line_signals
    ls = line_signals.build(sorted(set(gm.homeTeam) | set(gm.awayTeam)))
    if len(ls):
        te = te.merge(ls, left_on=["season", "homeTeam", "awayTeam"], right_on=["season", "home", "away"], how="left")
    te = add_situational_flags(te)
    te, S = apply_spots(te)

    disp = te[["season", "week", "homeTeam", "awayTeam", "total_open", "pred_total", "totals_bet",
               "spread_open", "pred_spread", "sides_bet", "rev_veto", "spots"]].copy()
    disp.to_csv(os.path.join(OUT, f"cfb_predictions_{a.season}.csv"), index=False)
    bets = te[(te.totals_bet != "") | (te.sides_bet != "")]

    def r(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0
    # grade-line -> the home-spread / total column the spot is bet & graded on (honest: signal==grade line)
    def line_for(b, side, gl):
        if gl == "open": return b.spread_open
        if gl == "close": return b.spread_close
        if gl == "dk": return b.get("dk_sp_close")
        if gl == "soft": return b.get("soft_best_home") if side == "HOME" else b.get("soft_best_away")
        return b.spread_open
    def tline_for(b, gl): return b.total_close if gl == "close" else b.total_open
    graded = te[te.actual_total.notna()].copy()
    if len(graded):
        print(f"=== {a.season} dry-run — per-spot (graded on each spot's own line) ===")
        print(f"{'spot':<36}{'line':>6}{'n':>5}{'hit%':>7}{'roi%':>8}")
        for name, (mask, side, mkt, gl) in S.items():
            b = graded[mask.reindex(graded.index, fill_value=False)].copy()
            if mkt == "total":
                L = pd.to_numeric(tline_for(b, gl), errors="coerce"); b = b[b.actual_total.notna() & L.notna()]
                L = pd.to_numeric(tline_for(b, gl), errors="coerce"); b = b[b.actual_total != L]
                L = pd.to_numeric(tline_for(b, gl), errors="coerce")
                win = (b.actual_total > L) if side == "OVER" else (b.actual_total < L)
            else:
                L = pd.to_numeric(line_for(b, side, gl), errors="coerce"); b = b[L.notna()]
                L = pd.to_numeric(line_for(b, side, gl), errors="coerce"); b = b[(b.actual_margin + L) != 0]
                L = pd.to_numeric(line_for(b, side, gl), errors="coerce")
                hc = (b.actual_margin + L) > 0; win = ~hc if side == "AWAY" else hc
            n = len(b); w = int(win.sum())
            print(f"{name:<36}{gl:>6}{n:>5}{100*w/n if n else 0:>7.1f}{r(w,n):>8.1f}")
        # CLV of the MODEL's own lean (the website-product claim) — open->close move toward our side.
        ml = graded[graded.side_edge.abs() >= 2].copy()
        if len(ml):
            bet_home = ml.side_edge > 0
            # home bettor gains when line moves toward home (spread_close more negative): open - close
            clv = np.where(bet_home, ml.spread_open - ml.spread_close, ml.spread_close - ml.spread_open)
            print(f"\nMODEL CLV (|edge|>=2): n={len(ml)} avg {np.nanmean(clv):+.2f} pts, positive {100*np.nanmean(clv>0):.0f}%")
    bets.to_csv(os.path.join(OUT, f"cfb_bets_{a.season}.csv"), index=False)
    print(f"\n{len(disp)} games (display) | {len(bets)} with >=1 spot flag -> out/cfb_bets_{a.season}.csv")


if __name__ == "__main__":
    main()
