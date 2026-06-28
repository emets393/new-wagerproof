"""Open vs Close re-validation for P11, P12, P13 (2026-06 reconciliation).

WHY: memory/nfl_signal_defs claim P11-P13 are "open-safe / worst-line robust",
but the committed validation (props_signal_mine.py, props_p8_gamelines.py) and the
dry-run loaders all TRIGGER + GRADE on the CLOSE line. This settles it empirically:
re-run each signal's exact trigger on OPEN, PREGAME, and CLOSE side-by-side, self-
grading vs actuals so the three line bases are directly comparable.

Read-only. Prints a table per signal. No DB writes.
"""
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"

# Locked production cutoffs (from props_signal_mine refinement; hardcoded in dryrun).
P12_SEP_Q80 = 3.6335   # entering L3 avg_separation, receiving
P13_EFF_Q80 = 4.8384   # entering L3 rush efficiency, rushing


def amer_profit(odds):
    odds = pd.to_numeric(pd.Series(odds), errors="coerce").values.astype(float)
    return np.where(np.isnan(odds) | (odds == 0), np.nan,
                    np.where(odds > 0, odds / 100.0, 100.0 / np.abs(np.where(odds == 0, 1, odds))))


def entering_roll(df, key, col, n=3):
    return df.groupby(key)[col].transform(lambda x: x.shift(1).rolling(n, min_periods=1).mean())


def grade(line, actual, price):
    """Return (win bool|nan for push, roi_units) self-graded OVER vs `line`."""
    line = np.asarray(line, float); actual = np.asarray(actual, float)
    prof = amer_profit(price)
    win = actual > line
    push = actual == line
    roi = np.where(push, 0.0, np.where(win, prof, -1.0))
    w = np.where(push, np.nan, win.astype(float))
    return w, roi


def report(label, mask, line, actual, price, season):
    sub = pd.DataFrame({"win": grade(line, actual, price)[0],
                        "roi": grade(line, actual, price)[1],
                        "season": np.asarray(season)})[np.asarray(mask)]
    sub = sub.dropna(subset=["win"])
    sub = sub[np.isfinite(sub.roi)]
    n = len(sub)
    if n == 0:
        print(f"  {label:30s} n=   0  (no qualifying bets)")
        return
    hit = sub.win.mean() * 100
    roi = sub.roi.mean() * 100
    per = []
    for s in sorted(sub.season.unique()):
        ss = sub[sub.season == s]
        per.append(f"{int(s)}:{ss.win.mean()*100:.0f}%/{len(ss)}")
    print(f"  {label:30s} n={n:4d}  hit={hit:5.1f}%  ROI={roi:+6.1f}%   [{'  '.join(per)}]")


# =========================================================================
# P12 / P13 — featured WR / RB receiving|rushing yards OVER
# =========================================================================
def build_props_spine():
    pf = pd.read_parquet(DATA / "props_frame.parquet")
    pf = pf[pf.market.isin(["player_reception_yds", "player_rush_yds"])].copy()
    g = pf.groupby(["season", "week", "player_id", "player_name", "position",
                    "team", "opp", "market"]).agg(
        close_line=("close_line", "median"), open_line=("open_line", "median"),
        pregame_line=("pregame_line", "median"),
        close_over=("close_over", "median"), open_over=("open_over", "median"),
        pregame_over=("pregame_over", "median"),
        actual=("actual", "first"),
        l3_avg=("l3_avg", "first")).reset_index()
    return g


def add_ngs_entering(spine):
    rec = pd.read_parquet(DATA / "ngs_receiving.parquet").sort_values(["player_id", "season", "week"])
    rec["sep_l3"] = entering_roll(rec, "player_id", "avg_separation")
    rsh = pd.read_parquet(DATA / "ngs_rushing.parquet").sort_values(["player_id", "season", "week"])
    rsh["eff_l3"] = entering_roll(rsh, "player_id", "efficiency")
    spine = spine.merge(rec[["season", "week", "player_id", "sep_l3"]].drop_duplicates(
        ["season", "week", "player_id"]), on=["season", "week", "player_id"], how="left")
    spine = spine.merge(rsh[["season", "week", "player_id", "eff_l3"]].drop_duplicates(
        ["season", "week", "player_id"]), on=["season", "week", "player_id"], how="left")
    return spine


def reval_p12_p13():
    s = add_ngs_entering(build_props_spine())
    print("\n" + "=" * 84)
    print("P12  featured WR reception_yds OVER  (line<=L3 AND entering-L3 separation>=P80)")
    print("=" * 84)
    d = s[s.market == "player_reception_yds"].copy()
    for basis in ["open", "pregame", "close"]:
        line = d[f"{basis}_line"]; price = d[f"{basis}_over"]
        mask = line.notna() & d.l3_avg.notna() & (line <= d.l3_avg) & (d.sep_l3 >= P12_SEP_Q80)
        report(f"P12 @ {basis.upper()}", mask, line, d.actual, price, d.season)

    print("\n" + "=" * 84)
    print("P13  featured RB rush_yds OVER  (line<=L3 AND entering-L3 efficiency>=P80)")
    print("=" * 84)
    d = s[s.market == "player_rush_yds"].copy()
    for basis in ["open", "pregame", "close"]:
        line = d[f"{basis}_line"]; price = d[f"{basis}_over"]
        mask = line.notna() & d.l3_avg.notna() & (line <= d.l3_avg) & (d.eff_l3 >= P13_EFF_Q80)
        report(f"P13 @ {basis.upper()}", mask, line, d.actual, price, d.season)


# =========================================================================
# P11 — prop-implied game total > posted total -> game OVER (top quintile)
# =========================================================================
FEATS = ["qb_pass_yds", "qb_pass_tds", "rush_sum", "recyd_sum", "atd_exp"]


def team_aggregates(basis):
    """basis in {open, close}: build per-team-game prop aggregates from that snapshot."""
    line_col = f"{basis}_line"; yes_col = f"{basis}_yes_prob"
    f = pd.read_parquet(DATA / "props_frame.parquet")
    f = f[f.team.notna()].copy()
    tm = pd.read_parquet(DATA / "team_mapping.parquet")
    name2ab = dict(zip(tm.city_and_name, tm["Team Abbrev"]))
    f["home_team"] = f.home_team.map(name2ab); f["away_team"] = f.away_team.map(name2ab)
    f = f[f.home_team.notna() & f.away_team.notna()]
    ou = f[f[line_col].notna() & f.market.ne("player_anytime_td")]
    cons = (ou.groupby(["season", "week", "event_id", "home_team", "away_team",
                        "team", "player_id", "market"])[line_col].median().reset_index())
    w = cons.pivot_table(index=["season", "week", "event_id", "home_team", "away_team", "team"],
                         columns="market", values=line_col, aggfunc=["sum", "max", "count"])
    w.columns = [f"{a}_{b.replace('player_', '')}" for a, b in w.columns]
    w = w.reset_index()
    atd = f[(f.market == "player_anytime_td") & f[yes_col].notna()]
    aexp = (atd.groupby(["season", "week", "event_id", "team", "player_id"])[yes_col].median().reset_index()
            .groupby(["season", "week", "event_id", "team"])[yes_col].agg(atd_exp="sum").reset_index())
    t = w.merge(aexp, on=["season", "week", "event_id", "team"], how="left")
    t["qb_pass_yds"] = t.get("max_pass_yds"); t["qb_pass_tds"] = t.get("max_pass_tds")
    t["rush_sum"] = t.get("sum_rush_yds"); t["recyd_sum"] = t.get("sum_reception_yds")
    return t[["season", "week", "event_id", "home_team", "away_team", "team"] + FEATS]


def build_games(basis):
    t = team_aggregates(basis)
    home = t[t.team == t.home_team].set_index("event_id")
    away = t[t.team == t.away_team].set_index("event_id")
    g = home.join(away[FEATS], rsuffix="_aw", how="inner")
    g = g.rename(columns={c: f"{c}_hm" for c in FEATS})
    games = pd.read_parquet(DATA / "nflverse_games.parquet")
    games = games[games.season.isin([2024, 2025])]
    g = g.reset_index().merge(
        games[["season", "week", "home_team", "away_team", "home_score", "away_score"]],
        on=["season", "week", "home_team", "away_team"], how="inner")
    # posted total for THIS basis from odds_consensus (open_total / close_total)
    oc = pd.read_parquet(DATA / "odds_consensus.parquet")
    oc = oc.rename(columns={"home_ab": "home_team", "away_ab": "away_team"})
    g = g.merge(oc[["season", "home_team", "away_team", f"{basis}_total"]],
                on=["season", "home_team", "away_team"], how="inner")
    g["posted_total"] = g[f"{basis}_total"]
    g["total_actual"] = g.home_score + g.away_score
    for c in FEATS:
        g[f"{c}_gm"] = g[f"{c}_hm"] + g[f"{c}_aw"]
    g = g.dropna(subset=[f"{c}_gm" for c in FEATS] + ["posted_total"])
    return g


def ols(X, y):
    X1 = np.column_stack([np.ones(len(X)), X])
    beta, *_ = np.linalg.lstsq(X1, y, rcond=None)
    return beta


def reval_p11():
    print("\n" + "=" * 84)
    print("P11  prop-implied total > posted total -> game OVER (top-quintile residual)")
    print("     cross-season fit; bet OVER vs posted total; ROI graded at -110")
    print("=" * 84)
    for basis in ["open", "close"]:
        g = build_games(basis)
        rows_win, rows_roi, rows_season = [], [], []
        for tr, te in ((2024, 2025), (2025, 2024)):
            train, test = g[g.season == tr], g[g.season == te]
            if len(train) < 30 or len(test) < 30:
                continue
            Xc = [f"{c}_gm" for c in FEATS]
            beta = ols(train[Xc].values, train.total_actual.values)
            imp = np.column_stack([np.ones(len(test)), test[Xc].values]) @ beta
            resid = imp - test.posted_total.values
            thr = np.quantile(resid, 0.8)               # top-20% slate
            top = test[resid >= thr]
            w, roi = grade(top.posted_total.values, top.total_actual.values,
                           np.full(len(top), -110.0))    # -110 standard juice
            rows_win.extend(w); rows_roi.extend(roi); rows_season.extend(top.season.values)
        sub = pd.DataFrame({"win": rows_win, "roi": rows_roi, "season": rows_season}).dropna(subset=["win"])
        n = len(sub)
        if n == 0:
            print(f"  P11 OVER @ {basis.upper():5s} n=0"); continue
        per = "  ".join(f"{int(s)}:{sub[sub.season==s].win.mean()*100:.0f}%/{len(sub[sub.season==s])}"
                        for s in sorted(sub.season.unique()))
        print(f"  P11 OVER @ {basis.upper():5s}  n={n:4d}  hit={sub.win.mean()*100:5.1f}%  "
              f"ROI={sub.roi.mean()*100:+6.1f}%   [{per}]")


if __name__ == "__main__":
    reval_p12_p13()
    reval_p11()
    print("\n[done] open vs pregame vs close re-validation complete.")
