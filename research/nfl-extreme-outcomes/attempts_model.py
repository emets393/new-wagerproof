"""Model pass_attempts / pass_completions / rush_attempts from team-offense + opponent-defense
+ game-script context, then hunt edges vs the market line (T-60, bettable).

Idea (what the pure signal-mining missed): don't just react to line movement — actually PREDICT
the stat from our data and bet where the model disagrees with the line.

Features (all ENTERING / leak-free):
  player form   : L3, L5, season-to-date mean of the player's own actual (shifted)
  team offense  : pace (plays/gm, sec/play), PROE (pass lean), success rates, 3&out, EPA  [team_week s2d]
  opp defense   : pass/rush EPA & success allowed, 3&out forced, pts/drive allowed, explosive [team_week s2d]
  game script   : team_spread (neg=fav), total, is_home                                    [games_enriched]

Train on 2018-2025 actuals (walk-forward: predict week W using only games strictly before it).
Evaluate the model-vs-line edge ONLY on 2024-25 rows that have a prop line, graded at the T-60
actionable close + T-60 price. Read-only.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingRegressor
from stats_helpers import wilson_ci

DATA = Path(__file__).resolve().parent / "data"
NORM = {"LAR": "LA", "WSH": "WAS", "JAC": "JAX", "OAK": "LV", "SD": "LAC", "STL": "LA"}
MKT = {"player_pass_attempts": "attempts", "player_rush_attempts": "carries",
       "player_pass_completions": "completions"}
# minimal season-to-date usage to count as a "real" contributor for that market
USE_FLOOR = {"attempts": 8.0, "completions": 5.0, "carries": 4.0}
T60 = 60.0

OFF = ["off_plays_per_game_s2d", "off_proe_s2d", "off_sec_per_play_neutral_s2d",
       "off_no_huddle_rate_s2d", "off_pass_success_rate_s2d", "off_rush_success_rate_s2d",
       "off_three_and_out_rate_s2d", "off_plays_per_drive_s2d",
       "off_early_down_pass_epa_s2d", "off_early_down_rush_epa_s2d", "off_pts_per_drive_s2d"]
DEF = ["def_pass_epa_allowed_neutral_s2d", "def_rush_epa_allowed_neutral_s2d",
       "def_pass_success_allowed_s2d", "def_rush_success_allowed_s2d",
       "def_three_and_out_forced_s2d", "def_pts_per_drive_allowed_s2d",
       "def_explosive_pass_allowed_s2d", "def_explosive_rush_allowed_s2d"]


def amer_profit(o):
    o = pd.to_numeric(pd.Series(o), errors="coerce").values.astype(float)
    o = np.where(np.abs(o) < 100, np.nan, o)
    return np.where(np.isnan(o) | (o == 0), np.nan, np.where(o > 0, o/100.0, 100.0/np.abs(np.where(o == 0, 1, o))))


def team_feats():
    tw = pd.read_parquet(DATA / "team_week.parquet")
    tm = pd.read_parquet(DATA / "team_mapping.parquet")[["Team Abbrev", "team_name"]]
    tw = tw.merge(tm, left_on="team", right_on="team_name", how="left")
    tw["ab"] = tw["Team Abbrev"].replace(NORM)
    off = tw[["season", "week", "ab"] + OFF].rename(columns={"ab": "team"})
    dfn = tw[["season", "week", "ab"] + DEF].rename(columns={"ab": "opp"})
    return off, dfn


def games():
    ge = pd.read_parquet(DATA / "games_enriched.parquet")
    ge = ge[["season", "week", "home_team", "away_team", "spread_line", "total_line"]].copy()
    for c in ("home_team", "away_team"):
        ge[c] = ge[c].replace(NORM)
    rows = []
    for _, r in ge.iterrows():
        rows.append(dict(season=r.season, week=r.week, team=r.home_team, opp=r.away_team,
                         team_spread=-r.spread_line, total=r.total_line, is_home=1))
        rows.append(dict(season=r.season, week=r.week, team=r.away_team, opp=r.home_team,
                         team_spread=r.spread_line, total=r.total_line, is_home=0))
    return pd.DataFrame(rows)


def props_t60():
    ex = pd.read_parquet(DATA / "props_rows_extra.parquet")
    ex = ex[ex.market.isin(MKT)].copy()
    ex["team"] = ex.team.replace(NORM)
    ex["snap"] = pd.to_datetime(ex.snapshot_time, utc=True, format="ISO8601")
    ex["comm"] = pd.to_datetime(ex.commence_time, utc=True, format="ISO8601")
    ex["mins"] = (ex.comm - ex.snap).dt.total_seconds() / 60.0
    keys = ["season", "week", "player_id", "market"]
    c = ex.groupby(keys + ["snap", "mins"]).agg(line=("line", "median"),
        over=("over_odds", "median"), under=("under_odds", "median")).reset_index().sort_values(keys + ["snap"])
    op = c.groupby(keys).first().reset_index()[keys + ["line"]].rename(columns={"line": "open_line"})
    act = c[c.mins >= T60]
    cl = act.groupby(keys).last().reset_index()[keys + ["line", "over", "under"]].rename(
        columns={"line": "close_line", "over": "over_px", "under": "under_px"})
    return op.merge(cl, on=keys)


def panel():
    po = pd.read_parquet(DATA / "player_offense.parquet")
    po["team"] = po.team.replace(NORM)
    off, dfn = team_feats()
    gm = games()
    frames = []
    for mkt, col in MKT.items():
        d = po[["season", "week", "player_id", "player_name", "position", "team", col]].copy()
        d = d.rename(columns={col: "actual"})
        d["market"] = mkt
        d = d.sort_values(["player_id", "season", "week"])
        g = d.groupby("player_id").actual
        d["l5"] = g.transform(lambda s: s.shift(1).rolling(5, min_periods=2).mean())
        d["l3"] = g.transform(lambda s: s.shift(1).rolling(3, min_periods=2).mean())
        d["szn"] = g.transform(lambda s: s.shift(1).expanding(min_periods=3).mean())
        d = d.dropna(subset=["l5", "szn"])
        d = d[d.szn >= USE_FLOOR[col]]               # real contributors only
        frames.append(d)
    p = pd.concat(frames, ignore_index=True)
    p = p.merge(gm, on=["season", "week", "team"], how="left")
    p = p.merge(off, on=["season", "week", "team"], how="left")
    p = p.merge(dfn, on=["season", "week", "opp"], how="left")
    return p


FEATS = ["l3", "l5", "szn", "team_spread", "total", "is_home"] + OFF + DEF


def walk_forward(p, mkt):
    m = p[p.market == mkt].dropna(subset=["actual", "team_spread"]).copy()
    m["t"] = m.season * 100 + m.week
    m["pred"] = np.nan
    evals = sorted(m[m.season.isin([2024, 2025])].t.unique())
    for t in evals:
        tr = m[m.t < t]
        te = m[m.t == t]
        if len(tr) < 500 or len(te) == 0:
            continue
        mdl = HistGradientBoostingRegressor(max_depth=4, learning_rate=0.05,
                                            max_iter=400, min_samples_leaf=40, l2_regularization=1.0)
        mdl.fit(tr[FEATS], tr.actual)
        m.loc[m.t == t, "pred"] = mdl.predict(te[FEATS])
    return m[m.pred.notna()]


def grade(sub, thr):
    over = sub[sub.edge > thr]
    under = sub[sub.edge < -thr]
    def side(s, is_over):
        s = s[s.actual != s.close_line]
        if len(s) == 0:
            return None
        win = (s.actual > s.close_line).values if is_over else (s.actual < s.close_line).values
        px = s.over_px if is_over else s.under_px
        roi = np.nanmean(np.where(win, amer_profit(px.values), -1.0)) * 100
        k, n = int(win.sum()), len(s)
        per = " ".join(f"{y}:{(((s[s.season==y].actual>s[s.season==y].close_line) if is_over else (s[s.season==y].actual<s[s.season==y].close_line)).mean()*100):.0f}%"
                       for y in (2024, 2025) if len(s[s.season == y]))
        lo, hi = wilson_ci(k, n)
        return n, k/n*100, roi, per, (lo*100, hi*100)
    return side(over, True), side(under, False)


def line(lbl, res):
    if res is None:
        print(f"    {lbl:26s} n=0"); return
    n, hp, roi, per, ci = res
    print(f"    {lbl:26s} n={n:4d} hit={hp:5.1f}% ROI={roi:+6.1f}% [{per}] CI[{ci[0]:.0f},{ci[1]:.0f}]")


def main():
    p = panel()
    prop = props_t60()
    for mkt in MKT:
        pr = walk_forward(p, mkt)
        pr = pr.merge(prop[prop.market == mkt].drop(columns="market"),
                      on=["season", "week", "player_id"], how="inner")
        pr = pr.dropna(subset=["close_line"])
        pr["edge"] = pr.pred - pr.close_line
        # model accuracy vs the line
        mae_model = np.abs(pr.pred - pr.actual).mean()
        mae_line = np.abs(pr.close_line - pr.actual).mean()
        print(f"\n===== {mkt}  (eval n={len(pr)}) =====")
        print(f"  model MAE={mae_model:.2f}  vs  line MAE={mae_line:.2f}  "
              f"({'MODEL BEATS LINE' if mae_model < mae_line else 'line beats model'})  "
              f"mean|edge|={pr.edge.abs().mean():.2f}")
        for thr in (0.5, 1.0, 1.5, 2.0):
            ov, un = grade(pr, thr)
            print(f"  edge threshold > {thr}:")
            line("model OVER (pred>>line)", ov)
            line("model UNDER (pred<<line)", un)


if __name__ == "__main__":
    main()
