"""Phase 5 (NFL port) — replicate the validated CFB 'offense-underperformance → UNDER' delta signal on NFL.
Per team-game actual offensive EPA/play (from PBP); opponent DEFENSE archetype from prior-only within-season
percentiles; delta = team's prior off-EPA vs that D-archetype MINUS own prior baseline (≥2 priors, magnitude
trigger). Test game-total UNDER at the closing total, per season. 3 seasons (2023-25) → directional check,
sample-thin by construction (guardrail #1)."""
import numpy as np, pandas as pd, glob, warnings
from sklearn.cluster import KMeans
warnings.filterwarnings("ignore")
DEC = 1.909

pbp = pd.concat([pd.read_parquet(f) for f in sorted(glob.glob("data/pbp_cache/pbp_20*.parquet"))], ignore_index=True)
pl = pbp[(pbp.epa.notna()) & ((pbp["pass"] == 1) | (pbp["rush"] == 1))].copy()

# per (game, offense) and (game, defense) actual efficiency
off = pl.groupby(["game_id", "season", "week", "posteam"]).agg(
    off_epa=("epa", "mean"), plays=("epa", "size"), pass_rate=("pass", "mean")).reset_index().rename(columns={"posteam": "team"})
dfn = pl.groupby(["game_id", "defteam"]).agg(
    d_epa_all=("epa", "mean"),
    d_pass_epa_all=("epa", lambda s: s[pl.loc[s.index, "pass"] == 1].mean()),
    d_rush_epa_all=("epa", lambda s: s[pl.loc[s.index, "rush"] == 1].mean()),
    d_plays=("epa", "size")).reset_index().rename(columns={"defteam": "team"})

# game frame (one row/game) for outcomes
gm = pbp.groupby("game_id").agg(season=("season", "first"), week=("week", "first"),
    home=("home_team", "first"), away=("away_team", "first"),
    total_line=("total_line", "first"), total=("total", "first")).reset_index()
gm["over"] = np.where(gm.total == gm.total_line, np.nan, (gm.total > gm.total_line).astype(float))

# team-game table with opponent identity
rows = []
for _, r in gm.iterrows():
    rows.append({"game_id": r.game_id, "season": r.season, "week": r.week, "team": r.home, "opp": r.away, "over": r.over, "total_line": r.total_line, "total": r.total})
    rows.append({"game_id": r.game_id, "season": r.season, "week": r.week, "team": r.away, "opp": r.home, "over": r.over, "total_line": r.total_line, "total": r.total})
tg = pd.DataFrame(rows).merge(off[["game_id", "team", "off_epa"]], on=["game_id", "team"], how="left")

# ── prior-only within-season DEFENSE profile → percentile → KMeans archetype ──
dfn = dfn.merge(gm[["game_id", "season", "week"]], on="game_id", how="left").sort_values(["season", "team", "week"])
for c in ["d_epa_all", "d_pass_epa_all", "d_rush_epa_all"]:
    dfn["prior_" + c] = dfn.groupby(["season", "team"])[c].apply(lambda s: s.shift().expanding().mean()).reset_index(level=[0,1], drop=True)
pcols = ["prior_d_epa_all", "prior_d_pass_epa_all", "prior_d_rush_epa_all"]
for c in pcols:
    dfn[c + "_pct"] = dfn.groupby(["season", "week"])[c].rank(pct=True)
km_in = dfn.dropna(subset=[c + "_pct" for c in pcols])
km = KMeans(n_clusters=4, n_init=10, random_state=0).fit(km_in[[c + "_pct" for c in pcols]])
dfn.loc[km_in.index, "opp_DEF"] = km.labels_
opp_arch = dfn[["game_id", "team", "opp_DEF"]].rename(columns={"team": "opp"})
tg = tg.merge(opp_arch, on=["game_id", "opp"], how="left")

# ── leak-safe delta: prior off_epa vs opp DEF archetype minus own prior baseline ──
tg = tg.sort_values(["season", "team", "week"]).reset_index(drop=True)
D, NP = [], []
for (s, t), sub in tg.groupby(["season", "team"]):
    sub = sub.sort_values("week"); ep = sub.off_epa.values; od = sub.opp_DEF.values
    for i in range(len(sub)):
        pe = ep[:i]; po = od[:i]; base = np.nanmean(pe) if i > 0 and np.isfinite(pe).any() else np.nan
        m = (po == od[i]) & np.isfinite(pe); vs = np.nanmean(pe[m]) if m.sum() > 0 else np.nan
        D.append(vs - base if np.isfinite(vs) and np.isfinite(base) else np.nan); NP.append(int(m.sum()))
tg["delta"] = D; tg["n_priors_vs"] = NP

def st(d, hi=False):
    d = d.dropna(subset=["over"])
    if not len(d): return "  — no sample"
    p = 1 - d.over.mean() if not hi else d.over.mean()
    by = d.groupby("season").over.apply(lambda x: 1 - x.mean())
    return f"{p*100:5.1f}%  n={len(d):4d}  ROI {(p*DEC-1)*100:+6.1f}  seasons {(by>=0.5).sum()}/{by.notna().sum()} [{round(by.min()*100)}-{round(by.max()*100)}]"

e = tg[tg.n_priors_vs >= 2]
print("NFL offense-underperformance → GAME UNDER (2023-25, ≥2 priors vs archetype)")
print(f"eligible team-games: {len(e)}")
for thr in [-0.05, -0.10, -0.15, -0.20]:
    print(f"  delta ≤ {thr:+.2f} → UNDER (dedup game): ", st(e[e.delta <= thr].drop_duplicates('game_id')))
print("  complement over-performers → OVER:")
for thr in [0.10]:
    d = e[e.delta >= thr].drop_duplicates('game_id').dropna(subset=['over'])
    print(f"  delta ≥ {thr:+.2f} → OVER: {d.over.mean()*100:.1f}% n={len(d)}")
# mechanism
u = e[e.delta <= -0.10].drop_duplicates('game_id').dropna(subset=['over'])
b = e.drop_duplicates('game_id').dropna(subset=['over'])
print(f"mechanism: underperf line {u.total_line.mean():.1f} actual {u.total.mean():.1f} diff {u.total.mean()-u.total_line.mean():+.2f} n={len(u)}")
print(f"           baseline  line {b.total_line.mean():.1f} actual {b.total.mean():.1f} diff {b.total.mean()-b.total_line.mean():+.2f}")
