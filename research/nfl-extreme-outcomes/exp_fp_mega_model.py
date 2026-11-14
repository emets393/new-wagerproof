#!/usr/bin/env python3
"""MEGA model: EVERY numeric charted column, own + opponent, entering-game ->
team points. Walk-forward ridge 2023-2025, totals/spread eval vs close, and the
TOP-50 feature ranking so nothing in the warehouse goes unexamined.

Feature source: all 9 FP team tables + lineMatchups + unit composites +
nflverse team_week + context + market. Every teamStats*/opponentStats* numeric
column becomes an entering-game (shifted expanding mean, within team-season)
feature, for BOTH the team and its opponent. ~500-700 features total.
"""
import glob
import numpy as np
import pandas as pd

AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
NICK = {"Cardinals":"ARZ","Falcons":"ATL","Ravens":"BLT","Bills":"BUF","Panthers":"CAR",
"Bears":"CHI","Bengals":"CIN","Browns":"CLV","Cowboys":"DAL","Broncos":"DEN","Lions":"DET",
"Packers":"GB","Texans":"HST","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA",
"Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE",
"Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA",
"49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}

TABLES = {
    "toP": "team_offense_passing-advanced", "toR": "team_offense_rushing-advanced",
    "toC": "team_offense_receiving-advanced", "toM": "team_offense_coverage-matrix",
    "tdP": "team_defense_passing-advanced", "tdR": "team_defense_rushing-advanced",
    "tdC": "team_defense_receiving-advanced", "tdM": "team_defense_coverage-matrix",
    "rpr": "team_run-pass-report",
}


def build_team_features():
    base = None
    for tag, name in TABLES.items():
        df = pd.read_parquet(f"data/fpdata/{name}.parquet")
        df["ab"] = df.teamNickname.map(NICK).map(lambda a: AB_NV.get(a, a))
        stat_cols = [c for c in df.columns
                     if (c.startswith("teamStats") or c.startswith("opponentStats"))
                     and not c.endswith("Label")]
        keep = {}
        for c in stat_cols:
            v = pd.to_numeric(df[c], errors="coerce")
            if v.notna().mean() > 0.6:
                keep[f"{tag}_{c.replace('teamStats','t').replace('opponentStats','o')}"] = v
        sub = pd.DataFrame({"ab": df.ab, "season": df.__season, "week": df.__week, **keep})
        sub = sub.groupby(["ab", "season", "week"], as_index=False).mean()
        base = sub if base is None else base.merge(sub, on=["ab", "season", "week"], how="outer")
    lm = pd.read_parquet("data/fpdata/lineMatchups__team.parquet")
    lm["ab"] = lm.teamNickname.map(NICK).map(lambda a: AB_NV.get(a, a))
    for c in [c for c in lm.columns if "Pressured" in c or "Contact" in c]:
        base = base.merge(
            pd.DataFrame({"ab": lm.ab, "season": lm.__season, "week": lm.__week,
                          "lm_" + c[:40]: pd.to_numeric(lm[c], errors="coerce")})
            .groupby(["ab", "season", "week"], as_index=False).mean(),
            on=["ab", "season", "week"], how="outer")
    feat_cols = [c for c in base.columns if c not in ("ab", "season", "week")]
    base = base.sort_values(["ab", "season", "week"])
    for c in feat_cols:
        base["f_" + c] = base.groupby(["ab", "season"])[c].transform(
            lambda s: s.shift(1).expanding(min_periods=3).mean())
    return base[["ab", "season", "week"] + ["f_" + c for c in feat_cols]], ["f_" + c for c in feat_cols]


tf, FCOLS = build_team_features()
print(f"team-feature matrix: {tf.shape[0]} team-weeks × {len(FCOLS)} entering-game features/side")

g = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv",
                low_memory=False)
g = g[(g.game_type == "REG") & g.result.notna() & g.spread_line.notna()
      & g.total_line.notna() & (g.season >= 2021) & (g.season <= 2025)]
rows = []
for _, r in g.iterrows():
    for team, opp, home in ((r.home_team, r.away_team, 1), (r.away_team, r.home_team, 0)):
        rows.append(dict(season=r.season, week=r.week, game_id=r.game_id, team=team, opp=opp,
                         home=home, pts=r.home_score if home else r.away_score,
                         margin=r.result if home else -r.result,
                         line=-r.spread_line if home else r.spread_line, total=r.total_line,
                         act_total=r.home_score + r.away_score))
p = pd.DataFrame(rows)
p["mkt_pts"] = p.total / 2 - p.line / 2
tw = pd.read_parquet("data/team_week.parquet")
_C2A = {"Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR",
"Chicago":"CHI","Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN",
"Detroit":"DET","Green Bay":"GB","Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX",
"Kansas City":"KC","LA Rams":"LA","LA Chargers":"LAC","Las Vegas":"LV","Miami":"MIA",
"Minnesota":"MIN","New England":"NE","New Orleans":"NO","NY Giants":"NYG","NY Jets":"NYJ",
"Philadelphia":"PHI","Pittsburgh":"PIT","Seattle":"SEA","San Francisco":"SF",
"Tampa Bay":"TB","Tennessee":"TEN","Washington":"WAS"}
tw["team"] = tw.team.map(_C2A).fillna(tw.team)
TWC = [c for c in tw.columns if c not in ("season", "week", "team") and tw[c].notna().mean() > 0.5]
p = p.merge(tw[["season", "week", "team"] + TWC], on=["season", "week", "team"], how="left")
p = p.merge(tf, left_on=["team", "season", "week"], right_on=["ab", "season", "week"], how="left")
p = p.merge(tf.add_prefix("O_"), left_on=["opp", "season", "week"],
            right_on=["O_ab", "O_season", "O_week"], how="left")
FEATS = (["line", "total", "mkt_pts", "home", "week"] + TWC + FCOLS
         + ["O_" + c for c in FCOLS])
p = p[p.week >= 4].dropna(subset=["pts", "line", "total"]).copy()
for c in FEATS:
    p[c] = pd.to_numeric(p[c], errors="coerce")
dead = [c for c in FEATS if p[c].isna().all()]
FEATS = [c for c in FEATS if c not in dead]
p[FEATS] = p[FEATS].fillna(p[FEATS].mean())
FEATS = [c for c in FEATS if not p[c].isna().any()]
print(f"panel: {len(p)} team-games × {len(FEATS)} features (dropped {len(dead)} dead)")


def ridge_fit(X, y, lam):
    Xb = np.hstack([X, np.ones((len(X), 1))])
    A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam
    return np.linalg.solve(A, Xb.T @ y)


preds, coefs = [], None
for season in (2023, 2024, 2025):
    tr, te = p[p.season < season], p[p.season == season].copy()
    X = tr[FEATS].values.astype(float)
    m, s = X.mean(0), X.std(0); s[s == 0] = 1
    w = ridge_fit((X - m) / s, tr.pts.values.astype(float), lam=300.0)
    te["pred"] = np.hstack([(te[FEATS].values.astype(float) - m) / s,
                            np.ones((len(te), 1))]) @ w
    preds.append(te)
    coefs = w[:-1]
pr = pd.concat(preds)
own = pr.set_index(["game_id", "team"]).pred
pr["opp_pred"] = own.reindex(pd.MultiIndex.from_arrays([pr.game_id, pr.opp])).values
pr["pm"] = pr.pred - pr.opp_pred
pr["pt"] = pr.pred + pr.opp_pred
gg = pr.drop_duplicates("game_id")

om = gg.margin - (-gg.line)
ow = np.where(om >= 0, (gg.margin + gg.line) > 0, (gg.margin + gg.line) < 0)
ok = (gg.margin + gg.line) != 0
assert ow[ok].mean() > 0.99
print("oracle OK")

print("\nTOTALS vs close:")
for thr in (1, 2, 3, 4, 5):
    m = (gg.pt - gg.total).abs() >= thr
    pick_ov = (gg.pt - gg.total) >= thr
    w = np.where(pick_ov, gg.act_total > gg.total, gg.act_total < gg.total)
    okk = m & (gg.act_total != gg.total)
    if okk.sum() >= 20:
        z = (w[okk].mean() - .5) * 2 * np.sqrt(okk.sum())
        print(f"  thr {thr}: {w[okk].sum()}-{okk.sum()-w[okk].sum()} ({100*w[okk].mean():.1f}%) z={z:+.2f}")
print("SPREAD vs close:")
for thr in (1, 2, 3, 4):
    m = (gg.pm - (-gg.line)).abs() >= thr
    pick = (gg.pm - (-gg.line)) >= thr
    w = np.where(pick, (gg.margin + gg.line) > 0, (gg.margin + gg.line) < 0)
    okk = m & ((gg.margin + gg.line) != 0)
    if okk.sum() >= 20:
        z = (w[okk].mean() - .5) * 2 * np.sqrt(okk.sum())
        print(f"  thr {thr}: {w[okk].sum()}-{okk.sum()-w[okk].sum()} ({100*w[okk].mean():.1f}%) z={z:+.2f}")

print("\nTOP-50 features by |standardized coef| (2025 fit):")
order = np.argsort(-np.abs(coefs))
for i in order[:50]:
    print(f"  {coefs[i]:+7.3f}  {FEATS[i]}")
