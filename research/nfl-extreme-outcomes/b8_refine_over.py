"""
Refine the key-receiver-out OVER rule with VALUE weighting:
 - elite (air-share>=35 AND prior YAC-over-expected>0) vs volume target out -> bigger OVER?
 - QB starter out by QB QUALITY (prior passer rating) -> does direction flip (good QB out -> under)?
 - multiple receivers out (cumulative air-share) dose.
All leak-safe (prior weeks), graded vs closing total. Per-season + null.
"""
import os, sys
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
rng = np.random.default_rng(0)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
L = print
inj = pd.read_parquet(os.path.join(DATA, "injuries_raw.parquet"))
rec = pd.read_parquet(os.path.join(DATA, "ngs_receiving.parquet"))
pas = pd.read_parquet(os.path.join(DATA, "ngs_passing.parquet"))
g = pd.read_parquet(os.path.join(DATA, "games_enriched.parquet"))


def carry(df, col, out):
    df = df.sort_values(["player_id", "season", "week"]).copy()
    df["_c"] = df.groupby(["player_id", "season"])[col].apply(lambda s: s.shift(1).expanding().mean()).reset_index(level=[0, 1], drop=True)
    pl = df[["season", "player_id"]].drop_duplicates()
    grid = pl.merge(pd.DataFrame({"week": range(1, 23)}), how="cross").merge(
        df[["season", "player_id", "week", "_c"]], on=["season", "player_id", "week"], how="left").sort_values(["season", "player_id", "week"])
    grid[out] = grid.groupby(["season", "player_id"])["_c"].ffill()
    return grid[["season", "week", "player_id", out]]

rec["yac_oe"] = pd.to_numeric(rec.avg_yac_above_expectation, errors="coerce")
air = carry(rec, "percent_share_of_intended_air_yards", "airshare").merge(
    carry(rec, "yac_oe", "yacoe"), on=["season", "week", "player_id"], how="outer")
qb = carry(pas, "passer_rating", "qb_rating").merge(
    carry(pas, "attempts", "qb_att"), on=["season", "week", "player_id"], how="outer")

miss = inj[inj.report_status.isin(["Out", "Doubtful"])].copy()
miss = miss.merge(air, on=["season", "week", "player_id"], how="left").merge(qb, on=["season", "week", "player_id"], how="left")
SK = {"WR", "TE", "RB", "FB"}
miss["keyrec"] = (miss.position.isin(SK) & (miss.airshare >= 35)).astype(int)
miss["elite_rec"] = (miss.keyrec == 1) & (miss.yacoe > 0)
miss["volume_rec"] = (miss.keyrec == 1) & (miss.yacoe <= 0)
miss["qb_starter"] = (miss.position == "QB") & (miss.qb_att >= 15)
miss["good_qb_out"] = miss.qb_starter & (miss.qb_rating >= 95)   # above-avg passer out
miss["bad_qb_out"] = miss.qb_starter & (miss.qb_rating < 95)
ti = miss.groupby(["season", "week", "team"]).agg(
    keyrec=("keyrec", "max"), elite=("elite_rec", "max"), volume=("volume_rec", "max"),
    airshare_sum=("airshare", lambda s: s[miss.loc[s.index, "position"].isin(SK)].clip(lower=0).fillna(0).sum() if len(s) else 0),
    qb_out=("qb_starter", "max"), good_qb=("good_qb_out", "max"), bad_qb=("bad_qb_out", "max")).reset_index()
# simpler airshare_sum
asum = miss[miss.position.isin(SK)].assign(a=miss.airshare.clip(lower=0)).groupby(["season","week","team"]).a.sum().reset_index(name="airshare_sum2")
ti = ti.drop(columns=["airshare_sum"]).merge(asum, on=["season","week","team"], how="left").fillna({"airshare_sum2":0})

gg = g[(g.game_type == "REG") & (g.season >= 2018) & g.home_score.notna() & g.total_line.notna()].copy()
gg["tot"] = gg.home_score + gg.away_score
gg = gg.merge(ti.add_prefix("h_").rename(columns={"h_season":"season","h_week":"week","h_team":"home_team"}), on=["season","week","home_team"], how="left")
gg = gg.merge(ti.add_prefix("a_").rename(columns={"a_season":"season","a_week":"week","a_team":"away_team"}), on=["season","week","away_team"], how="left")
for c in gg.columns:
    if c.startswith(("h_","a_")) and gg[c].dtype != object: gg[c] = gg[c].fillna(0)
gg["over"] = np.where(gg.tot > gg.total_line, 1.0, np.where(gg.tot < gg.total_line, 0.0, np.nan))
gg["edge"] = gg.tot - gg.total_line


def ev(label, mask):
    sub = gg[mask].dropna(subset=["over"]); n = len(sub)
    if n < 15: L(f"  {label}: n={n}"); return
    k = int(sub.over.sum()); lo, hi = wilson_ci(k, n)
    parts = " ".join(f"{int(s)}:{sub[sub.season==s].over.mean()*100:.0f}%(n{len(sub[sub.season==s])})" for s in sorted(sub.season.unique()))
    pos = sum(1 for s in sorted(sub.season.unique()) if len(sub[sub.season==s])>=5 and sub[sub.season==s].over.mean()>=0.524)
    nyr = sum(1 for s in sorted(sub.season.unique()) if len(sub[sub.season==s])>=5)
    L(f"  {label:38s} n={n:3d} OVER={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}] +pts={sub.edge.mean():+.1f} [{pos}/{nyr}szn]")
    L(f"      {parts}")


L("=" * 92); L("VALUE-WEIGHTED REFINEMENT of the key-receiver-out OVER (2018-25)"); L("=" * 92)
L("\n[baseline reproduce] any team with air-share>=35 receiver out -> OVER:")
ev("key receiver out (>=35)", (gg.h_keyrec == 1) | (gg.a_keyrec == 1))
L("\n[A] ELITE vs VOLUME target out (elite = air-share>=35 AND prior YAC-over-exp>0):")
ev("ELITE target out", (gg.h_elite == 1) | (gg.a_elite == 1))
ev("VOLUME target out", ((gg.h_volume == 1) | (gg.a_volume == 1)) & ~((gg.h_elite==1)|(gg.a_elite==1)))
L("\n[B] CUMULATIVE air-share out (game max of team air-share-sum) dose:")
gg["max_air_out"] = gg[["h_airshare_sum2", "a_airshare_sum2"]].max(axis=1)
for t in [30, 45, 60, 80]:
    ev(f"max team air-share-out>={t}", gg.max_air_out >= t)
L("\n[C] QB starter out, by QB QUALITY (does direction flip?):")
ev("any starter QB out -> OVER", (gg.h_qb_out == 1) | (gg.a_qb_out == 1))
ev("GOOD QB out (rating>=95) -> OVER", (gg.h_good_qb == 1) | (gg.a_good_qb == 1))
ev("BAD QB out (rating<95) -> OVER", (gg.h_bad_qb == 1) | (gg.a_bad_qb == 1))
# also test good-QB-out UNDER explicitly
sub = gg[(gg.h_good_qb == 1) | (gg.a_good_qb == 1)].dropna(subset=["over"])
if len(sub) >= 15:
    u = 1 - sub.over; L(f"\n  GOOD QB out -> UNDER: {int(u.sum())}/{len(u)}={u.mean()*100:.1f}%")

L("\n[null] ELITE target out OVER vs chance:")
sub = gg[(gg.h_elite == 1) | (gg.a_elite == 1)].dropna(subset=["over"]); real = sub.over.mean(); n = len(sub)
allo = gg.over.dropna().values; nulls = [rng.choice(allo, n, replace=False).mean() for _ in range(5000)]
L(f"  OVER={real*100:.1f}% (n={n}) p(|dev|>=)={np.mean([abs(x-.5)>=abs(real-.5) for x in nulls]):.4f}")
