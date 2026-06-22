"""Do aggregated player-prop lines predict game totals / spreads?

Per team-game: consensus (median across books) close prop lines aggregated:
QB pass yds/TDs (max per team = starter), summed rush yds, reception yds,
receptions, summed ATD yes-probs (expected # of TD scorers), prop count.

Honesty: prop closes vs game close lines (same timestamp class). Predictive
tests are cross-season: fit OLS on one season, evaluate residual buckets on
the other. Grading vs nflverse close total/spread with close juice.
"""
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)


def payout(o):
    o = pd.to_numeric(o, errors="coerce")
    return np.where(o > 0, o / 100, 100 / -o)


def team_aggregates():
    f = pd.read_parquet(ROOT / "data" / "props_frame.parquet")
    f = f[f.team.notna()].copy()
    # Odds API gives full names; nflverse + frame `team` use abbreviations
    tm = pd.read_parquet(ROOT / "data" / "team_mapping.parquet")
    name2ab = dict(zip(tm.city_and_name, tm["Team Abbrev"]))
    f["home_team"] = f.home_team.map(name2ab)
    f["away_team"] = f.away_team.map(name2ab)
    f = f[f.home_team.notna() & f.away_team.notna()]

    ou = f[f.close_line.notna() & f.market.ne("player_anytime_td")]
    cons = (ou.groupby(["season", "week", "event_id", "home_team", "away_team",
                        "team", "player_id", "market"])
            .close_line.median().reset_index())
    w = cons.pivot_table(index=["season", "week", "event_id", "home_team",
                                "away_team", "team"],
                         columns="market", values="close_line",
                         aggfunc=["sum", "max", "count"])
    w.columns = [f"{a}_{b.replace('player_', '')}" for a, b in w.columns]
    w = w.reset_index()

    atd = f[(f.market == "player_anytime_td") & f.close_yes_prob.notna()]
    aexp = (atd.groupby(["season", "week", "event_id", "team", "player_id"])
            .close_yes_prob.median().reset_index()
            .groupby(["season", "week", "event_id", "team"])
            .close_yes_prob.agg(atd_exp="sum", atd_n="count").reset_index())
    t = w.merge(aexp, on=["season", "week", "event_id", "team"], how="left")

    t["qb_pass_yds"] = t.get("max_pass_yds")
    t["qb_pass_tds"] = t.get("max_pass_tds")
    t["rush_sum"] = t.get("sum_rush_yds")
    t["recyd_sum"] = t.get("sum_reception_yds")
    t["rec_sum"] = t.get("sum_receptions")
    t["n_props"] = t[[c for c in t.columns if c.startswith("count_")]].sum(axis=1)
    return t[["season", "week", "event_id", "home_team", "away_team", "team",
              "qb_pass_yds", "qb_pass_tds", "rush_sum", "recyd_sum", "rec_sum",
              "atd_exp", "atd_n", "n_props"]]


FEATS = ["qb_pass_yds", "qb_pass_tds", "rush_sum", "recyd_sum", "atd_exp"]


def build_games():
    t = team_aggregates()
    home = t[t.team == t.home_team].set_index("event_id")
    away = t[t.team == t.away_team].set_index("event_id")
    g = home.join(away[FEATS + ["rec_sum", "n_props"]], rsuffix="_aw", how="inner")
    g = g.rename(columns={c: f"{c}_hm" for c in FEATS + ["rec_sum", "n_props"]})

    games = pd.read_parquet(ROOT / "data" / "nflverse_games.parquet")
    games = games[games.season.isin([2024, 2025])]
    g = g.reset_index().merge(
        games[["season", "week", "home_team", "away_team", "total_line",
               "spread_line", "over_odds", "under_odds", "home_spread_odds",
               "away_spread_odds", "home_score", "away_score"]],
        on=["season", "week", "home_team", "away_team"], how="inner")
    g["total_actual"] = g.home_score + g.away_score
    g["margin"] = g.home_score - g.away_score
    for c in FEATS:
        g[f"{c}_gm"] = g[f"{c}_hm"] + g[f"{c}_aw"]
        g[f"{c}_df"] = g[f"{c}_hm"] - g[f"{c}_aw"]
    g = g.dropna(subset=[f"{c}_gm" for c in FEATS] + ["total_line", "spread_line"])
    return g


def ols(X, y):
    X1 = np.column_stack([np.ones(len(X)), X])
    beta, *_ = np.linalg.lstsq(X1, y, rcond=None)
    return beta


def pred(X, beta):
    return np.column_stack([np.ones(len(X)), X]) @ beta


def bucket_table(test, resid, label, target):
    test = test.copy()
    test["resid"] = resid
    qs = test.resid.quantile([0.2, 0.4, 0.6, 0.8]).values
    test["b"] = pd.cut(test.resid, [-np.inf, *qs, np.inf],
                       labels=["much lower", "lower", "mid", "higher", "much higher"])
    rows = []
    for b, gg in test.groupby("b", observed=True):
        if target == "total":
            win_o = gg.total_actual > gg.total_line
            push = gg.total_actual == gg.total_line
            roi_o = np.where(push, 0, np.where(win_o, payout(gg.over_odds), -1.0))
            roi_u = np.where(push, 0, np.where(~win_o & ~push, payout(gg.under_odds), -1.0))
            rows.append((b, len(gg), f"{win_o[~push].mean():.1%}",
                         f"{np.nanmean(roi_o)*100:+.1f}%", f"{np.nanmean(roi_u)*100:+.1f}%"))
        else:
            cov = gg.margin > gg.spread_line
            push = gg.margin == gg.spread_line
            roi_h = np.where(push, 0, np.where(cov, payout(gg.home_spread_odds), -1.0))
            roi_a = np.where(push, 0, np.where(~cov & ~push, payout(gg.away_spread_odds), -1.0))
            rows.append((b, len(gg), f"{cov[~push].mean():.1%}",
                         f"{np.nanmean(roi_h)*100:+.1f}%", f"{np.nanmean(roi_a)*100:+.1f}%"))
    hdr = ["bucket", "n", "over%" if target == "total" else "home_cov%",
           "ROI_over" if target == "total" else "ROI_home",
           "ROI_under" if target == "total" else "ROI_away"]
    print(f"\n== {label} ==")
    print(pd.DataFrame(rows, columns=hdr).to_string(index=False))


def main():
    g = build_games()
    print(f"games joined: {len(g)} "
          f"(2024: {(g.season==2024).sum()}, 2025: {(g.season==2025).sum()})")

    # ---------- 1. how tightly do prop aggregates track the posted lines?
    print("\n1. CORRELATION of prop aggregates with posted game lines (per season)")
    for s in (2024, 2025):
        gs = g[g.season == s]
        cors_t = {c: round(np.corrcoef(gs[f"{c}_gm"], gs.total_line)[0, 1], 3) for c in FEATS}
        cors_s = {c: round(np.corrcoef(gs[f"{c}_df"], -gs.spread_line)[0, 1], 3) for c in FEATS}
        print(f"  {s} vs TOTAL : {cors_t}")
        print(f"  {s} vs SPREAD (home-away diff vs away-favored): {cors_s}")
    for s in (2024, 2025):
        gs = g[g.season == s]
        bt = ols(gs[[f"{c}_gm" for c in FEATS]].values, gs.total_line.values)
        r2 = 1 - np.var(gs.total_line - pred(gs[[f"{c}_gm" for c in FEATS]].values, bt)) / np.var(gs.total_line)
        print(f"  {s} R^2 props->total_line: {r2:.3f}")

    # ---------- 2. TOTALS: cross-season residual test
    print("\n" + "=" * 90)
    print("2. TOTALS: prop-implied total vs posted total (fit one season, test the other)")
    for tr, te in ((2024, 2025), (2025, 2024)):
        train, test = g[g.season == tr], g[g.season == te]
        Xc = [f"{c}_gm" for c in FEATS]
        beta = ols(train[Xc].values, train.total_actual.values)
        imp = pred(test[Xc].values, beta)
        resid = imp - test.total_line.values
        r_line = np.corrcoef(imp, test.total_line)[0, 1]
        print(f"\nfit {tr} -> test {te} | corr(prop_implied, posted total)={r_line:.3f} "
              f"| MAE vs actual: props {np.abs(imp-test.total_actual).mean():.2f}, "
              f"line {np.abs(test.total_line-test.total_actual).mean():.2f}")
        bucket_table(test, resid, f"test {te}: prop-implied MINUS posted total (quintiles)", "total")
        # fixed thresholds too
        for thr in (2, 3):
            hi = test[resid >= thr]
            lo = test[resid <= -thr]
            for nm, sub, side in (("props say HIGHER", hi, "over"), ("props say LOWER", lo, "under")):
                if len(sub) < 15:
                    continue
                win_o = sub.total_actual > sub.total_line
                push = sub.total_actual == sub.total_line
                if side == "over":
                    roi = np.where(push, 0, np.where(win_o, payout(sub.over_odds), -1.0))
                    w = win_o[~push].mean()
                else:
                    roi = np.where(push, 0, np.where(~win_o & ~push, payout(sub.under_odds), -1.0))
                    w = (~win_o[~push]).mean()
                print(f"  thr {thr:+}: {nm} (n={len(sub)}): bet {side} -> "
                      f"win {w:.1%} ROI {np.nanmean(roi)*100:+.1f}%")

    # ---------- 3. SPREADS: cross-season residual test
    print("\n" + "=" * 90)
    print("3. SPREADS: prop-implied margin vs posted spread (fit one season, test other)")
    for tr, te in ((2024, 2025), (2025, 2024)):
        train, test = g[g.season == tr], g[g.season == te]
        Xc = [f"{c}_df" for c in FEATS]
        beta = ols(train[Xc].values, train.margin.values)
        imp = pred(test[Xc].values, beta)
        resid = imp - test.spread_line.values
        print(f"\nfit {tr} -> test {te} | corr(prop_implied_margin, spread)="
              f"{np.corrcoef(imp, test.spread_line)[0,1]:.3f} "
              f"| MAE vs actual margin: props {np.abs(imp-test.margin).mean():.2f}, "
              f"line {np.abs(test.spread_line-test.margin).mean():.2f}")
        bucket_table(test, resid, f"test {te}: prop-implied margin MINUS spread (quintiles)", "spread")
        for thr in (2, 3):
            hi = test[resid >= thr]
            lo = test[resid <= -thr]
            for nm, sub, side in (("props like HOME more", hi, "home"), ("props like AWAY more", lo, "away")):
                if len(sub) < 15:
                    continue
                cov = sub.margin > sub.spread_line
                push = sub.margin == sub.spread_line
                if side == "home":
                    roi = np.where(push, 0, np.where(cov, payout(sub.home_spread_odds), -1.0))
                    w = cov[~push].mean()
                else:
                    roi = np.where(push, 0, np.where(~cov & ~push, payout(sub.away_spread_odds), -1.0))
                    w = (~cov[~push]).mean()
                print(f"  thr {thr:+}: {nm} (n={len(sub)}): bet {side} -> "
                      f"win {w:.1%} ROI {np.nanmean(roi)*100:+.1f}%")

    # ---------- 4. simple descriptive: raw ATD-exp vs total, shootout/rockfight
    print("\n" + "=" * 90)
    print("4. RAW CHECK: combined expected TD scorers (sum ATD probs) vs game character")
    g["atd_b"] = pd.qcut(g.atd_exp_gm, 5, labels=["very low", "low", "mid", "high", "very high"])
    rows = []
    for (b, s), gg in g.groupby(["atd_b", "season"], observed=True):
        win_o = gg.total_actual > gg.total_line
        push = gg.total_actual == gg.total_line
        rows.append((b, s, len(gg), f"{gg.total_line.mean():.1f}",
                     f"{gg.total_actual.mean():.1f}", f"{win_o[~push].mean():.1%}"))
    print(pd.DataFrame(rows, columns=["atd_exp bucket", "season", "n", "avg posted total",
                                      "avg actual total", "over%"]).to_string(index=False))


if __name__ == "__main__":
    main()
