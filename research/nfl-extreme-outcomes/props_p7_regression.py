"""Regression / trap-line / inflated-form analysis on week-over-week prop lines.

Panel: one row per (season, week, player, market) = consensus close line
(median across books) + median juice. Lags computed over the player's prop
appearances within a season. All signals graded vs the consensus close line.
"""
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)
OU = ["player_pass_yds", "player_pass_tds", "player_receptions",
      "player_reception_yds", "player_rush_yds"]


def payout(o):
    o = pd.to_numeric(o, errors="coerce")
    return np.where(o > 0, o / 100, 100 / -o)


def table(df, by, label, min_n=30):
    rows = []
    for keys, g in df.groupby(by, observed=True):
        if len(g) < min_n:
            continue
        over = g.win_over.mean()
        roi_o = np.where(g.push, 0, np.where(g.win_over, g.pay_over, -1.0))
        roi_u = np.where(g.push, 0, np.where(g.win_under, g.pay_under, -1.0))
        rows.append((*np.atleast_1d(keys), len(g), f"{over:.1%}",
                     f"{np.nanmean(roi_o)*100:+.1f}%", f"{np.nanmean(roi_u)*100:+.1f}%"))
    cols = (by if isinstance(by, list) else [by]) + ["n", "over%", "ROI_over", "ROI_under"]
    print(f"\n== {label} ==")
    print(pd.DataFrame(rows, columns=cols).to_string(index=False))


def main():
    f = pd.read_parquet(ROOT / "data" / "props_frame.parquet")
    ou = f[f.market.isin(OU) & f.close_line.notna()].copy()
    # median PAYOUT across books, not median american odds (medians straddling 0 explode)
    ou["pay_over"] = payout(ou.close_over)
    ou["pay_under"] = payout(ou.close_under)

    # ---- weekly consensus panel
    p = (ou.groupby(["season", "week", "player_id", "player_name", "position", "market"])
         .agg(line=("close_line", "median"), pay_over=("pay_over", "median"),
              pay_under=("pay_under", "median"), actual=("actual", "first"),
              played=("played", "first"), def_idx=("def_matchup_idx", "first"),
              l3_avg=("l3_avg", "first"), szn_avg=("szn_avg", "first"),
              gp_prior=("gp_prior", "first"))
         .reset_index())
    p = p.sort_values(["player_id", "market", "season", "week"])
    grp = p.groupby(["player_id", "market", "season"])

    p["win_over"] = p.played & (p.actual > p.line)
    p["win_under"] = p.played & (p.actual < p.line)
    p["push"] = p.played & (p.actual == p.line)
    p["beat"] = np.where(p.played, np.sign(p.actual - p.line), np.nan)

    # lags over prop appearances (skips byes/DNP weeks naturally)
    for k in (1, 2, 3):
        p[f"line_lag{k}"] = grp.line.shift(k)
        p[f"beat_lag{k}"] = grp.beat.shift(k)
        p[f"def_idx_lag{k}"] = grp.def_idx.shift(k)
    p["line_chg"] = (p.line - p.line_lag1) / p.line_lag1.clip(lower=0.5)
    p["line_chg_prev"] = (p.line_lag1 - p.line_lag2) / p.line_lag2.clip(lower=0.5)
    p["over_streak3"] = (p.beat_lag1 > 0) & (p.beat_lag2 > 0) & (p.beat_lag3 > 0)
    p["under_streak3"] = (p.beat_lag1 < 0) & (p.beat_lag2 < 0) & (p.beat_lag3 < 0)
    p["over_streak2"] = (p.beat_lag1 > 0) & (p.beat_lag2 > 0)
    p["under_streak2"] = (p.beat_lag1 < 0) & (p.beat_lag2 < 0)
    p["soft_slate3"] = p[["def_idx_lag1", "def_idx_lag2", "def_idx_lag3"]].mean(axis=1)
    p["hot"] = (p.gp_prior >= 4) & (p.szn_avg > 0) & (p.l3_avg >= 1.2 * p.szn_avg)
    p["cold"] = (p.gp_prior >= 4) & (p.szn_avg > 0) & (p.l3_avg <= 0.8 * p.szn_avg)

    d = p[p.played & p.line_lag1.notna()].copy()
    print(f"panel rows with prior prop week: {len(d):,}")

    # ---------- 1. pure streak regression
    print("\n" + "=" * 90)
    print("1. STREAK REGRESSION (beat consensus line 3 / 2 straight prop-weeks)")
    s3 = d[d.over_streak3]
    table(s3, ["market", "season"], "went OVER 3 straight -> next game")
    u3 = d[d.under_streak3]
    table(u3, ["market", "season"], "went UNDER 3 straight -> next game")
    table(d[d.over_streak2], ["season"], "OVER 2 straight (all markets)")
    table(d[d.under_streak2], ["season"], "UNDER 2 straight (all markets)")

    # ---------- 2. line momentum (rising/falling lines)
    print("\n" + "=" * 90)
    print("2. LINE MOMENTUM (consensus line vs player's previous prop-week)")
    d["mom_b"] = pd.cut(d.line_chg, [-np.inf, -.15, -.05, .05, .15, np.inf],
                        labels=["dropped big", "dropped", "flat", "raised", "raised big"])
    table(d, ["mom_b", "season"], "all markets x 1-week line change")
    d["two_up"] = (d.line_chg > 0.03) & (d.line_chg_prev > 0.03)
    d["two_dn"] = (d.line_chg < -0.03) & (d.line_chg_prev < -0.03)
    table(d[d.two_up], ["market", "season"], "line RAISED 2 consecutive weeks", 25)
    table(d[d.two_dn], ["market", "season"], "line DROPPED 2 consecutive weeks", 25)

    # ---------- 3. trap lines
    print("\n" + "=" * 90)
    print("3. TRAP LINES")
    trap_dn = d[d.over_streak2 & (d.line_chg <= -0.05)]
    table(trap_dn, ["season"], "TRAP DOWN: beat line 2+ straight BUT line dropped >=5% (all mkts)")
    table(trap_dn, ["market", "season"], "trap down by market", 20)
    trap_up = d[d.under_streak2 & (d.line_chg >= 0.05)]
    table(trap_up, ["season"], "TRAP UP: lost to line 2+ straight BUT line raised >=5% (all mkts)")
    table(trap_up, ["market", "season"], "trap up by market", 20)
    # confirm lines (book agrees with streak)
    conf_up = d[d.over_streak2 & (d.line_chg >= 0.05)]
    table(conf_up, ["season"], "CONFIRM UP: beat 2+ straight AND line raised >=5%")
    conf_dn = d[d.under_streak2 & (d.line_chg <= -0.05)]
    table(conf_dn, ["season"], "CONFIRM DOWN: lost 2+ straight AND line dropped >=5%")

    # ---------- 4. schedule-inflated vs legit form
    print("\n" + "=" * 90)
    print("4. INFLATED vs LEGIT FORM (hot = L3 >= 1.2x season avg; slate = avg def idx of last 3 opp)")
    hot = d[d.hot & d.soft_slate3.notna()]
    hot_soft = hot[hot.soft_slate3 >= 1.08]
    hot_tough = hot[hot.soft_slate3 <= 0.92]
    table(hot_soft, ["season"], "HOT vs soft slate (inflated tear) - all mkts")
    table(hot_soft, ["market", "season"], "inflated tear by market", 20)
    table(hot_soft[hot_soft.position == "RB"], ["season"], "inflated tear, RBs only", 20)
    table(hot_tough, ["season"], "HOT vs tough slate (legit tear) - all mkts")
    cold = d[d.cold & d.soft_slate3.notna()]
    table(cold[cold.soft_slate3 <= 0.92], ["season"], "COLD vs tough slate (deflated, due for breakout)")
    table(cold[cold.soft_slate3 >= 1.08], ["season"], "COLD vs soft slate (genuinely bad)")
    # interaction with current opponent
    hs_now_tough = hot_soft[hot_soft.def_idx <= 0.95]
    table(hs_now_tough, ["season"], "inflated tear NOW facing tough defense", 20)

    # ---------- 5. ATD: scoring streaks vs price
    print("\n" + "=" * 90)
    print("5. ANYTIME TD: scoring streak vs week-over-week price change")
    atd = f[(f.market == "player_anytime_td") & f.close_yes_prob.notna()].copy()
    atd["pay_yes"] = payout(atd.close_over)
    a = (atd.groupby(["season", "week", "player_id", "position"])
         .agg(prob=("close_yes_prob", "median"), pay_yes=("pay_yes", "median"),
              actual=("actual", "first"), played=("played", "first")).reset_index())
    a = a.sort_values(["player_id", "season", "week"])
    ag = a.groupby(["player_id", "season"])
    a["scored"] = np.where(a.played, (a.actual > 0).astype(float), np.nan)
    for k in (1, 2, 3):
        a[f"sc{k}"] = ag.scored.shift(k)
        a[f"prob_lag{k}"] = ag.prob.shift(k)
    a["prob_chg"] = a.prob - a.prob_lag1
    a["streak3"] = (a.sc1 > 0) & (a.sc2 > 0) & (a.sc3 > 0)
    a["drought3"] = (a.sc1 == 0) & (a.sc2 == 0) & (a.sc3 == 0)
    aa = a[a.played & a.prob_lag1.notna()].copy()

    def atd_tab(df, label, min_n=50):
        rows = []
        for s, g in df.groupby("season"):
            if len(g) < min_n:
                continue
            pnl = np.where(g.actual > 0, g.pay_yes, -1.0)
            rows.append((s, len(g), f"{g.prob.mean():.3f}", f"{(g.actual>0).mean():.3f}",
                         f"{pnl.mean()*100:+.1f}%"))
        print(f"\n== {label} ==")
        print(pd.DataFrame(rows, columns=["season", "n", "implied", "actual_td%", "ROI_yes"]).to_string(index=False))

    atd_tab(aa[aa.streak3], "scored 3 straight games -> bet YES next")
    atd_tab(aa[aa.streak3 & (aa.prob_chg < -0.02)], "scored 3 straight BUT price drifted cheaper (trap?)")
    atd_tab(aa[aa.streak3 & (aa.prob_chg > 0.02)], "scored 3 straight AND price steamed up")
    atd_tab(aa[aa.drought3], "0 TDs in last 3 -> bet YES next")
    atd_tab(aa[aa.drought3 & (aa.prob_chg > 0.02)], "drought BUT price RISING (book expects breakout)")
    atd_tab(aa[aa.drought3 & (aa.prob_chg < -0.02)], "drought AND price falling")


if __name__ == "__main__":
    main()
