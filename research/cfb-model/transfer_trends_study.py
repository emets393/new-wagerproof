"""Weeks-1-3 CFB trends from TRANSFER-PORTAL volume, overall + BY POSITION (2021-25, the portal era).
Hypothesis: heavy portal churn (esp. at cohesion-dependent spots like OL, or a new portal QB) mis-prices a
team early before the new roster gels / before the market has current-season data.
Guardrails: grade at close, decimal -110 (BE 52.4%), per-season ALWAYS, within-season percentile buckets
(era-normalized), dose-response, complement, mechanism, scan-honesty (many cells → belief needs consistency)."""
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
DEC = 1.909

p = pd.read_parquet("data/cfbd/portal.parquet")
p = p.dropna(subset=["destination"]).copy()
GRP = {"QB": ["QB", "DUAL", "PRO"], "OL": ["IOL", "OT", "OG", "OC"], "WR": ["WR"], "RB": ["RB", "APB"],
       "TE": ["TE"], "DL": ["DL", "EDGE", "DT", "WDE", "SDE"], "LB": ["LB", "OLB", "ILB"], "DB": ["CB", "S"]}
pos2grp = {pos: g for g, lst in GRP.items() for pos in lst}
p["grp"] = p.position.map(pos2grp)
p["is4"] = (p.stars >= 4).astype(int)

# transfer features per (season, team)
agg = p.groupby(["season", "destination"]).agg(tot=("position", "size"), stars_sum=("stars", "sum"),
                                                hi4=("is4", "sum")).reset_index().rename(columns={"destination": "team"})
for g in GRP:
    c = p[p.grp == g].groupby(["season", "destination"]).size().rename(f"{g}_in").reset_index().rename(columns={"destination": "team"})
    agg = agg.merge(c, on=["season", "team"], how="left")
agg["skill_in"] = agg[["WR_in", "RB_in", "TE_in"]].sum(axis=1)
feat_cols = ["tot", "stars_sum", "hi4", "skill_in"] + [f"{g}_in" for g in GRP]
agg[feat_cols] = agg[feat_cols].fillna(0)
# within-season percentile per feature (era-normalized: portal volume grew 2021->2025)
for c in feat_cols:
    agg[c + "_pct"] = agg.groupby("season")[c].rank(pct=True)

# weeks 1-3 games (team perspective), portal seasons only
mg = pd.read_parquet("data/model_games.parquet")
rows = []
for s in ("home", "away"):
    d = mg[["season", "week", f"{s}Team", "spread_close", "actual_margin", "total_close", "actual_total"]].rename(columns={f"{s}Team": "team"})
    d["team_spread"] = d.spread_close * (1 if s == "home" else -1)
    d["team_margin"] = d.actual_margin * (1 if s == "home" else -1)
    rows.append(d)
tg = pd.concat(rows, ignore_index=True)
tg = tg[(tg.season >= 2021) & (tg.week <= 3)].merge(agg, on=["season", "team"], how="left")
tg[feat_cols] = tg[feat_cols].fillna(0)
for c in feat_cols: tg[c + "_pct"] = tg[c + "_pct"].fillna(0.0)
tg["covered"] = np.where((tg.team_margin + tg.team_spread) == 0, np.nan, ((tg.team_margin + tg.team_spread) > 0).astype(float))
tg["over"] = np.where(tg.actual_total == tg.total_close, np.nan, (tg.actual_total > tg.total_close).astype(float))

def st(d, col, hi=True):
    d = d.dropna(subset=[col])
    if len(d) < 30: return f"n={len(d):4d} (thin)"
    pv = d[col].mean() if hi else 1 - d[col].mean()
    by = d.groupby("season")[col].apply(lambda x: x.mean() if hi else 1 - x.mean())
    return f"{pv*100:5.1f}%  n={len(d):4d}  ROI {(pv*DEC-1)*100:+6.1f}  seasons {(by>=0.5).sum()}/{by.notna().sum()}"

print("=" * 92); print("WEEKS 1-3 — ATS by TOTAL portal volume + star quality (within-season percentile)"); print("=" * 92)
for lbl, c in [("total incoming", "tot"), ("star-weighted (stars_sum)", "stars_sum"), ("4-star+ adds", "hi4")]:
    print(f"  {lbl}:")
    print(f"    HIGH (top 25%) covers: {st(tg[tg[c+'_pct']>=0.75], 'covered')}")
    print(f"    LOW  (bot 25%) covers: {st(tg[tg[c+'_pct']<=0.25], 'covered')}")

print("\n" + "=" * 92); print("WEEKS 1-3 — ATS + TOTALS by POSITION-GROUP transfer volume (HIGH = top 25% that season)"); print("=" * 92)
for g in ["QB", "OL", "WR", "RB", "TE", "DL", "LB", "DB"]:
    hi = tg[tg[f"{g}_in_pct"] >= 0.75]
    print(f"  {g:3s} heavy: ATS {st(hi,'covered')}  | OVER {st(hi,'over')}")

print("\n" + "=" * 92); print("QB TRANSFER (brought >=1 portal QB = likely new starter) — wk1-3"); print("=" * 92)
qb = tg[tg.QB_in >= 1]; noqb = tg[tg.QB_in == 0]
print(f"  new portal QB   — ATS {st(qb,'covered')} | OVER {st(qb,'over')} | UNDER {st(qb,'over',hi=False)}")
print(f"  no portal QB    — ATS {st(noqb,'covered')} | OVER {st(noqb,'over')}")

print("\n" + "=" * 92); print("OL churn dose-response (cohesion story) — wk1-3 team-total UNDER via game over proxy"); print("=" * 92)
for thr in [0.60, 0.75, 0.90]:
    d = tg[tg.OL_in_pct >= thr]
    print(f"  OL-in ≥ {int(thr*100)}pct: ATS {st(d,'covered')} | game UNDER {st(d,'over',hi=False)}")

# mechanism helper for any cell that looks live
print("\n[scan honesty] ~20 cells tested (2 sides each) — belief needs dose-response + 4/5-season consistency + complement, not a lone %.")
tg.to_parquet("data/cfb_transfer_wk13.parquet", index=False)
print(f"wrote data/cfb_transfer_wk13.parquet ({len(tg)} wk1-3 team-games 2021-25)")
