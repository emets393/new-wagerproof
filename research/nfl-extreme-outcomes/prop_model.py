"""Per-market volume/yardage models for ALL player-prop markets, graded vs the T-60 line.

Generalizes attempts_model.py to the original 6 markets (the 3 attempts markets already have
their own module). For each market: walk-forward HistGBR predicts the actual from player form +
team-offense + opponent-defense + game script, then we hunt model-vs-line edges at the bettable
T-60 close. Same lesson expected as attempts (overs shaded -> under-side edges), but measured
per market so we know which props the model actually helps.

Markets modeled (regression): pass_yds, pass_tds, receptions, reception_yds, rush_yds.
(anytime_td is a YES/NO probability market -> handled separately, not here.)

Data: T-60 lines from props_rows.parquet (6-market raw snapshots, same schema as _extra);
actuals + features from player_offense / team_week / games_enriched (all 2018-2025).
Read-only. Caches the eval frame to data/prop_model_eval.parquet for the confluence scripts.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingRegressor
from stats_helpers import wilson_ci
from attempts_model import team_feats, games, amer_profit, FEATS

DATA = Path(__file__).resolve().parent / "data"
NORM = {"LAR": "LA", "WSH": "WAS", "JAC": "JAX", "OAK": "LV", "SD": "LAC", "STL": "LA"}
# All 9 O/U markets (6 original + 3 volume) in one cache so the confluence scripts can
# cross-reference a team's whole prop slate. Maps market -> player_offense actual column.
MKT_STAT = {"player_pass_yds": "passing_yards", "player_pass_tds": "passing_tds",
            "player_receptions": "receptions", "player_reception_yds": "receiving_yards",
            "player_rush_yds": "rushing_yards",
            "player_pass_attempts": "attempts", "player_rush_attempts": "carries",
            "player_pass_completions": "completions"}
# minimal season-to-date usage to count as a real contributor (skip deep bench noise)
USE_FLOOR = {"passing_yards": 100.0, "passing_tds": 0.4, "receptions": 2.0,
             "receiving_yards": 18.0, "rushing_yards": 5.0,
             "attempts": 8.0, "carries": 4.0, "completions": 5.0}
T60 = 60.0


def t60_lines():
    # 6-market snapshots (props_rows) + 3 volume-market snapshots (props_rows_extra), same schema
    cols = ["season", "week", "player_id", "market", "line", "over_odds", "under_odds",
            "commence_time", "snapshot_time", "team"]
    ex = pd.concat([pd.read_parquet(DATA / f)[cols]
                    for f in ("props_rows.parquet", "props_rows_extra.parquet")], ignore_index=True)
    ex = ex[ex.market.isin(MKT_STAT)].copy()
    ex["team"] = ex.team.replace(NORM)
    ex["snap"] = pd.to_datetime(ex.snapshot_time, utc=True, format="ISO8601")
    ex["comm"] = pd.to_datetime(ex.commence_time, utc=True, format="ISO8601")
    ex["mins"] = (ex.comm - ex.snap).dt.total_seconds() / 60.0
    keys = ["season", "week", "player_id", "market"]
    c = ex.groupby(keys + ["snap", "mins"]).agg(
        line=("line", "median"), over=("over_odds", "median"), under=("under_odds", "median")
    ).reset_index().sort_values(keys + ["snap"])
    op = c.groupby(keys).first().reset_index()[keys + ["line"]].rename(columns={"line": "open_line"})
    act = c[c.mins >= T60]
    cl = act.groupby(keys).last().reset_index()[keys + ["line", "over", "under"]].rename(
        columns={"line": "close_line", "over": "over_px", "under": "under_px"})
    return op.merge(cl, on=keys)


def panel():
    """All player-games 2018-2025 with the market's actual + form + team/opp/script features.
    Training uses every row; evaluation only the 2024-25 rows that have a T-60 line."""
    po = pd.read_parquet(DATA / "player_offense.parquet")
    po["team"] = po.team.replace(NORM)
    off, dfn = team_feats()
    gm = games()
    frames = []
    for mkt, stat in MKT_STAT.items():
        d = po[["season", "week", "player_id", "player_name", "position", "team", stat]].copy()
        d = d.rename(columns={stat: "actual"})
        d["market"] = mkt
        d = d.sort_values(["player_id", "season", "week"])
        g = d.groupby("player_id").actual
        d["l5"] = g.transform(lambda s: s.shift(1).rolling(5, min_periods=2).mean())
        d["l3"] = g.transform(lambda s: s.shift(1).rolling(3, min_periods=2).mean())
        d["szn"] = g.transform(lambda s: s.shift(1).expanding(min_periods=3).mean())
        d = d.dropna(subset=["l5", "szn"])
        d = d[d.szn >= USE_FLOOR[stat]]
        frames.append(d)
    p = pd.concat(frames, ignore_index=True)
    p = p.merge(gm, on=["season", "week", "team"], how="left")
    p = p.merge(off, on=["season", "week", "team"], how="left")
    p = p.merge(dfn, on=["season", "week", "opp"], how="left")
    return p


def walk_forward(p, mkt):
    m = p[p.market == mkt].dropna(subset=["actual", "team_spread"]).copy()
    m["t"] = m.season * 100 + m.week
    m["pred"] = np.nan
    for t in sorted(m[m.season.isin([2024, 2025])].t.unique()):
        tr = m[m.t < t]
        te = m[m.t == t]
        if len(tr) < 500 or len(te) == 0:
            continue
        mdl = HistGradientBoostingRegressor(max_depth=4, learning_rate=0.05, max_iter=400,
                                            min_samples_leaf=40, l2_regularization=1.0)
        mdl.fit(tr[FEATS], tr.actual)
        m.loc[m.t == t, "pred"] = mdl.predict(te[FEATS])
    return m[m.pred.notna()]


def predict_slate(season, week, markets=None, p=None):
    """Production prediction per (player_id, market) for one slate. Trains each market's model on
    all completed games strictly before it (point-in-time). Mirrors attempts_predict.predict_slate
    but for the original markets — used by the props generator to fire the model prop flags.
    Model number stays internal (drives the flag only, never displayed)."""
    if p is None:
        p = panel()
    p = p.copy()
    p["t"] = p.season * 100 + p.week
    target = season * 100 + week
    out = []
    for mkt in (markets or list(MKT_STAT)):
        m = p[p.market == mkt].dropna(subset=["actual", "team_spread"])
        tr, te = m[m.t < target], m[m.t == target]
        if len(tr) < 500 or len(te) == 0:
            continue
        mdl = HistGradientBoostingRegressor(max_depth=4, learning_rate=0.05, max_iter=400,
                                            min_samples_leaf=40, l2_regularization=1.0)
        mdl.fit(tr[FEATS], tr.actual)
        out.append(te.assign(pred=mdl.predict(te[FEATS]))[["season", "week", "player_id", "market", "pred"]])
    return pd.concat(out, ignore_index=True) if out else pd.DataFrame()


def side(sub, is_over):
    s = sub[sub.actual != sub.close_line]
    if len(s) < 12:
        return None
    win = (s.actual > s.close_line).values if is_over else (s.actual < s.close_line).values
    px = s.over_px if is_over else s.under_px
    roi = np.nanmean(np.where(win, amer_profit(px.values), -1.0)) * 100
    k, n = int(win.sum()), len(s)
    lo, hi = wilson_ci(k, n)
    per = " ".join(f"{y}:{(((s[s.season==y].actual>s[s.season==y].close_line) if is_over else (s[s.season==y].actual<s[s.season==y].close_line)).mean()*100):.0f}%"
                   for y in (2024, 2025) if len(s[s.season == y]))
    return n, k/n*100, roi, per, (lo*100, hi*100)


def line(lbl, res):
    if res is None:
        print(f"    {lbl:28s} n<12"); return
    n, hp, roi, per, ci = res
    print(f"    {lbl:28s} n={n:4d} hit={hp:5.1f}% ROI={roi:+6.1f}% [{per}] CI[{ci[0]:.0f},{ci[1]:.0f}]")


def main():
    p = panel()
    prop = t60_lines()
    allrows = []
    for mkt in MKT_STAT:
        pr = walk_forward(p, mkt).merge(prop[prop.market == mkt].drop(columns="market"),
                                        on=["season", "week", "player_id"], how="inner").dropna(subset=["close_line"])
        if not len(pr):
            print(f"\n===== {mkt}: no eval rows ====="); continue
        pr["edge"] = pr.pred - pr.close_line          # + = model above line, - = model below
        pr["edge_pct"] = pr.edge / pr.close_line.replace(0, np.nan)
        mae_m, mae_l = np.abs(pr.pred - pr.actual).mean(), np.abs(pr.close_line - pr.actual).mean()
        base_o = (pr.actual > pr.close_line).mean() * 100
        print(f"\n===== {mkt} (n={len(pr)}, base OVER={base_o:.1f}%) =====")
        print(f"  model MAE={mae_m:.2f} vs line MAE={mae_l:.2f} "
              f"({'MODEL BEATS LINE' if mae_m < mae_l else 'line sharper'}) mean|edge|={pr.edge.abs().mean():.2f}")
        # relative thresholds so it scales across markets (tds ~small, pass_yds ~large)
        for q in (0.5, 0.65, 0.8):
            thr = pr.edge.abs().quantile(q)
            print(f"  |edge| >= p{int(q*100)} ({thr:.2f}):")
            line("model UNDER (pred<<line)", side(pr[pr.edge <= -thr], False))
            line("model OVER (pred>>line)", side(pr[pr.edge >= thr], True))
        allrows.append(pr.assign(market=mkt))
    if allrows:
        out = pd.concat(allrows, ignore_index=True)
        out.to_parquet(DATA / "prop_model_eval.parquet", index=False)
        print(f"\n[cache] {len(out)} eval rows -> data/prop_model_eval.parquet")


if __name__ == "__main__":
    main()
