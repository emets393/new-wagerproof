#!/usr/bin/env python3
"""FULL originator-style sides/totals model (owner mandate 2026-09-17).

ALL families, not a toy: nflverse EPA/pace/situational s2d (36 per side) +
FP unit composites + FP scheme identities + gaps + context + market. One row
per TEAM-GAME, target = team points (raw quantity, line as feature). Ridge,
walk-forward (train < S, test S in 2023-2025). Family drop-one ablation, then
fixed-threshold spread/totals eval vs CLOSE with dose + per-season splits.
"""
import numpy as np
import pandas as pd

AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
NICK = {"Cardinals":"ARZ","Falcons":"ATL","Ravens":"BLT","Bills":"BUF","Panthers":"CAR",
"Bears":"CHI","Bengals":"CIN","Browns":"CLV","Cowboys":"DAL","Broncos":"DEN","Lions":"DET",
"Packers":"GB","Texans":"HST","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA",
"Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE",
"Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA",
"49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}


def num(s):
    return pd.to_numeric(s, errors="coerce")


# ---- base game rows ---------------------------------------------------------
g = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv",
                low_memory=False)
g = g[(g.game_type == "REG") & g.result.notna() & g.spread_line.notna()
      & g.total_line.notna() & (g.season >= 2021) & (g.season <= 2025)]
rows = []
for _, r in g.iterrows():
    for team, opp, home in ((r.home_team, r.away_team, 1), (r.away_team, r.home_team, 0)):
        rows.append(dict(
            season=r.season, week=r.week, game_id=r.game_id, team=team, opp=opp, home=home,
            pts=r.home_score if home else r.away_score,
            margin=r.result if home else -r.result,
            line=-r.spread_line if home else r.spread_line, total=r.total_line,
            rest_diff=(r.home_rest - r.away_rest) if home else (r.away_rest - r.home_rest),
            div_game=r.div_game, dome=1 if str(r.roof) in ("dome", "closed") else 0,
            temp=r.temp if pd.notna(r.temp) else 65, wind=r.wind if pd.notna(r.wind) else 0))
p = pd.DataFrame(rows)
p["mkt_pts"] = p.total / 2 - p.line / 2

# ---- family: nflverse team_week (own + opp) ---------------------------------
tw = pd.read_parquet("data/team_week.parquet")
_C2A = {"Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR",
"Chicago":"CHI","Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN",
"Detroit":"DET","Green Bay":"GB","Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX",
"Kansas City":"KC","LA Rams":"LA","LA Chargers":"LAC","Las Vegas":"LV","Miami":"MIA",
"Minnesota":"MIN","New England":"NE","New Orleans":"NO","NY Giants":"NYG","NY Jets":"NYJ",
"Philadelphia":"PHI","Pittsburgh":"PIT","Seattle":"SEA","San Francisco":"SF",
"Tampa Bay":"TB","Tennessee":"TEN","Washington":"WAS"}
tw["team"] = tw.team.map(_C2A).fillna(tw.team)
TW = [c for c in tw.columns if c not in ("season", "week", "team", "off_plays_seen",
                                         "def_plays_seen", "off_drives_seen")]
p = p.merge(tw[["season", "week", "team"] + TW], on=["season", "week", "team"], how="left")
p = p.merge(tw[["season", "week", "team"] + TW].rename(columns={"team": "opp"}).add_prefix("o_")
            .rename(columns={"o_season": "season", "o_week": "week", "o_opp": "opp"}),
            on=["season", "week", "opp"], how="left")

# ---- family: FP composites + gaps (own + opp) -------------------------------
uc = pd.read_parquet("data/fpdata/unit_composites.parquet")
uc["ab_nv"] = uc.ab.map(lambda a: AB_NV.get(a, a))
UNITS = ["pass_pro", "pass_rush", "run_block", "run_front", "rb_room", "tackling",
         "recv_corps", "coverage", "qb_resilience"]
p = p.merge(uc[["ab_nv", "__season", "__week"] + UNITS],
            left_on=["team", "season", "week"], right_on=["ab_nv", "__season", "__week"], how="left")
p = p.merge(uc[["ab_nv", "__season", "__week"] + UNITS].add_prefix("o_"),
            left_on=["opp", "season", "week"], right_on=["o_ab_nv", "o___season", "o___week"], how="left")
p["gap_pass"] = p.pass_pro - p.o_pass_rush
p["gap_recv"] = p.recv_corps - p.o_coverage
p["gap_run"] = p.run_block - p.o_run_front
p["gap_rbtk"] = p.rb_room - p.o_tackling

# ---- family: FP scheme identity (opp defense faced + own defense) -----------
cov = pd.read_parquet("data/fpdata/team_defense_coverage-matrix.parquet")
cov["ab_nv"] = cov.teamNickname.map(NICK).map(lambda a: AB_NV.get(a, a))
for k, c in (("man", "Man"), ("twohigh", "TwoHigh"), ("zone", "Zone")):
    cov[k] = num(cov[f"opponentStatsCoverageScheme{c}PassingDropbacksPercentage"])
cov = cov.sort_values(["ab_nv", "__season", "__week"])
for k in ("man", "twohigh", "zone"):
    cov["pre_" + k] = cov.groupby(["ab_nv", "__season"])[k].transform(
        lambda s: s.shift(1).expanding(min_periods=2).mean())
SCH = ["pre_man", "pre_twohigh", "pre_zone"]
p = p.merge(cov[["ab_nv", "__season", "__week"] + SCH].rename(
    columns={c: "oppdef_" + c for c in SCH}),
    left_on=["opp", "season", "week"], right_on=["ab_nv", "__season", "__week"],
    how="left", suffixes=("", "_c1"))
p = p.merge(cov[["ab_nv", "__season", "__week"] + SCH].rename(
    columns={c: "owndef_" + c for c in SCH}),
    left_on=["team", "season", "week"], right_on=["ab_nv", "__season", "__week"],
    how="left", suffixes=("", "_c2"))

FAMILIES = {
    "market": ["line", "total", "mkt_pts"],
    "context": ["home", "rest_diff", "div_game", "dome", "temp", "wind", "week"],
    "epa_own": TW,
    "epa_opp": ["o_" + c for c in TW],
    "fp_units": UNITS + ["o_" + u for u in UNITS],
    "fp_gaps": ["gap_pass", "gap_recv", "gap_run", "gap_rbtk"],
    "fp_scheme": ["oppdef_" + c for c in SCH] + ["owndef_" + c for c in SCH],
}
ALLF = [f for fam in FAMILIES.values() for f in fam]
p = p[p.week >= 4].copy()
for c in ALLF:
    p[c] = num(p[c])
p = p.dropna(subset=["pts", "line", "total"])
p[ALLF] = p[ALLF].fillna(p[ALLF].mean())
_dead = [c for c in ALLF if p[c].isna().any()]
if _dead:
    ALLF = [c for c in ALLF if c not in _dead]
    for fam in FAMILIES:
        FAMILIES[fam] = [c for c in FAMILIES[fam] if c not in _dead]
    print(f"dropped {len(_dead)} dead cols: {_dead}")
print(f"panel: {len(p)} team-games | features: {len(ALLF)}")


def ridge_fit(X, y, lam=30.0):
    Xb = np.hstack([X, np.ones((len(X), 1))])
    A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam
    return np.linalg.solve(A, Xb.T @ y)


def run(feats):
    preds = []
    for season in (2023, 2024, 2025):
        tr, te = p[p.season < season], p[p.season == season].copy()
        X = tr[feats].values.astype(float)
        m, s = X.mean(0), X.std(0); s[s == 0] = 1
        w = ridge_fit((X - m) / s, tr.pts.values.astype(float))
        te["pred"] = np.hstack([(te[feats].values.astype(float) - m) / s,
                                np.ones((len(te), 1))]) @ w
        preds.append(te)
    return pd.concat(preds)


def evaluate(pr, label, quiet=False):
    own = pr.set_index(["game_id", "team"]).pred
    pr = pr.copy()
    pr["opp_pred"] = own.reindex(pd.MultiIndex.from_arrays([pr.game_id, pr.opp])).values
    pr["pm"] = pr.pred - pr.opp_pred
    pr["pt"] = pr.pred + pr.opp_pred
    pr["act_total"] = pr.groupby("game_id").pts.transform("sum")
    gg = pr.drop_duplicates("game_id")
    # oracle checks (grading-sign law): realized values as predictions must win ~100%
    om = gg.margin - (-gg.line)
    ow = np.where(om >= 0, (gg.margin + gg.line) > 0, (gg.margin + gg.line) < 0)
    ok = (gg.margin + gg.line) != 0
    assert ow[ok].mean() > 0.99, f"spread oracle FAILED {ow[ok].mean():.3f}"
    ot = np.where(gg.act_total >= gg.total, gg.act_total > gg.total, gg.act_total < gg.total)
    okt = gg.act_total != gg.total
    assert ot[okt].mean() > 0.99, f"total oracle FAILED {ot[okt].mean():.3f}"
    out = {}
    for thr in (1, 2, 3, 4):
        m = (gg.pm - (-gg.line)).abs() >= thr
        pick_own = (gg.pm - (-gg.line)) >= thr
        w = np.where(pick_own, (gg.margin + gg.line) > 0, (gg.margin + gg.line) < 0)
        okk = m & ((gg.margin + gg.line) != 0)
        out[f"sp{thr}"] = (w[okk].sum(), okk.sum())
    for thr in (1, 2, 3, 4):
        m = (gg.pt - gg.total).abs() >= thr
        pick_ov = (gg.pt - gg.total) >= thr
        w = np.where(pick_ov, gg.act_total > gg.total, gg.act_total < gg.total)
        okk = m & (gg.act_total != gg.total)
        out[f"tot{thr}"] = (w[okk].sum(), okk.sum())
    if not quiet:
        line = f"{label:24s}"
        for k, (wn, n) in out.items():
            line += f" | {k} {100*wn/max(n,1):.1f}% ({n})"
        print(line)
    return out


print("\n== FULL MODEL ==")
full = run(ALLF)
evaluate(full, "ALL families")
print("\n== FAMILY ABLATION (drop one) ==")
for fam in FAMILIES:
    feats = [f for k, fs in FAMILIES.items() if k != fam for f in fs]
    evaluate(run(feats), f"minus {fam}")
print("\n== per-season, full model, spread thr>=2 ==")
own = full.set_index(["game_id", "team"]).pred
full["opp_pred"] = own.reindex(pd.MultiIndex.from_arrays([full.game_id, full.opp])).values
full["pm"] = full.pred - full.opp_pred
gg = full.drop_duplicates("game_id")
for s in (2023, 2024, 2025):
    d = gg[(gg.season == s) & ((gg.pm + gg.line).abs() >= 2) & ((gg.margin + gg.line) != 0)]
    pick_own = (d.pm + d.line) >= 2
    w = np.where(pick_own, (d.margin + d.line) > 0, (d.margin + d.line) < 0)
    print(f"  {s}: {w.sum()}-{len(d)-w.sum()} ({100*w.mean():.0f}%)" if len(d) else f"  {s}: n=0")
