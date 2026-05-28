"""
Injury -> totals, WAVE 2: snap-usage-weighted, both sides of the ball.
- Per-player prior snap% (leak-safe carry-forward), keyed by pfr_id; injuries crosswalked gsis->pfr.
- OFFENSE injury burden (skill snap% out) -> confirm the air-share OVER finding with an independent weight.
- DEFENSE injury burden (pass-rush / coverage snap% out) -> the untested mirror: weak D -> opp scores -> OVER,
  and the team FACING an injured defense covers? Dose-response + per-season + null.
"""
import os, sys
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
from scipy import stats as st
rng = np.random.default_rng(0)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
L = print
inj = pd.read_parquet(os.path.join(DATA, "injuries_raw.parquet"))
sc = pd.read_parquet(os.path.join(DATA, "snap_counts.parquet"))
px = pd.read_parquet(os.path.join(DATA, "players_xwalk.parquet"))
g = pd.read_parquet(os.path.join(DATA, "games_enriched.parquet"))
g2p = dict(zip(px.gsis_id, px.pfr_id))

# ---- per-player prior snap usage (carry-forward across weeks), keyed by pfr_player_id ----
sc = sc[sc.game_type == "REG"].copy()
sc["off_pct"] = sc.offense_pct.fillna(0); sc["def_pct"] = sc.defense_pct.fillna(0)
def carry(df, col, out):
    df = df.sort_values(["pfr_player_id", "season", "week"]).copy()
    df["_c"] = df.groupby(["pfr_player_id", "season"])[col].apply(lambda s: s.shift(1).expanding().mean()).reset_index(level=[0,1], drop=True)
    pl = df[["season", "pfr_player_id"]].drop_duplicates()
    grid = pl.merge(pd.DataFrame({"week": range(1, 23)}), how="cross").merge(
        df[["season", "pfr_player_id", "week", "_c"]], on=["season", "pfr_player_id", "week"], how="left").sort_values(["season","pfr_player_id","week"])
    grid[out] = grid.groupby(["season", "pfr_player_id"])["_c"].ffill()
    return grid[["season", "week", "pfr_player_id", out]]
offu = carry(sc, "off_pct", "off_pct_prior"); defu = carry(sc, "def_pct", "def_pct_prior")
usage = offu.merge(defu, on=["season", "week", "pfr_player_id"], how="outer")

# ---- injuries (Out+Doubtful) -> pfr -> usage + position group ----
miss = inj[inj.report_status.isin(["Out", "Doubtful"])].copy()
miss["pfr"] = miss.player_id.map(g2p)
miss = miss.merge(usage, left_on=["season", "week", "pfr"], right_on=["season", "week", "pfr_player_id"], how="left")
SKILL = {"WR", "TE", "RB", "FB"}; OL = {"T","G","C","OL","OT","OG"}
RUSH = {"DE","DT","NT","OLB","EDGE"}; COV = {"CB","S","SS","FS","DB"}; OLB = {"LB","ILB","MLB"}
miss["off_w"] = np.where(miss.position.isin(SKILL), miss.off_pct_prior.fillna(0), 0.0)
miss["ol_w"] = np.where(miss.position.isin(OL), miss.off_pct_prior.fillna(0), 0.0)
miss["rush_w"] = np.where(miss.position.isin(RUSH), miss.def_pct_prior.fillna(0), 0.0)
miss["cov_w"] = np.where(miss.position.isin(COV | OLB), miss.def_pct_prior.fillna(0), 0.0)
miss["def_w"] = np.where(miss.position.isin(RUSH | COV | OLB), miss.def_pct_prior.fillna(0), 0.0)
ti = miss.groupby(["season", "week", "team"]).agg(
    off_out=("off_w", "sum"), ol_out=("ol_w", "sum"),
    rush_out=("rush_w", "sum"), cov_out=("cov_w", "sum"), def_out=("def_w", "sum")).reset_index()

# ---- outcomes ----
gg = g[(g.game_type == "REG") & (g.season >= 2018) & g.home_score.notna() & g.spread_line.notna()].copy()
gg["result"] = gg.home_score - gg.away_score; gg["tot"] = gg.home_score + gg.away_score
rows = []
for r in gg.itertuples():
    for team, ishome in ((r.home_team, 1), (r.away_team, 0)):
        cov = (r.result > r.spread_line) if ishome else (r.result < r.spread_line); push = (r.result == r.spread_line)
        rows.append(dict(season=r.season, week=r.week, team=team, opp=(r.away_team if ishome else r.home_team),
                         team_cover=(np.nan if push else float(cov)), over=(np.nan if r.tot == r.total_line else float(r.tot > r.total_line)),
                         tot=r.tot, total_line=r.total_line))
d = pd.DataFrame(rows).merge(ti, on=["season","week","team"], how="left").fillna(0)
oppi = ti.rename(columns={"team":"opp","off_out":"opp_off_out","def_out":"opp_def_out","rush_out":"opp_rush_out","cov_out":"opp_cov_out"})
d = d.merge(oppi[["season","week","opp","opp_off_out","opp_def_out","opp_rush_out","opp_cov_out"]], on=["season","week","opp"], how="left").fillna(0)
# game-level injury (either team) for totals
d["game_off_out"] = d.off_out + d.opp_off_out      # total offensive production missing in the game
d["game_def_out"] = d.def_out + d.opp_def_out      # total defensive production missing in the game
L(f"[build] team-games 2018-25: {len(d)}; off_out>0: {(d.off_out>0).sum()}, def_out>0: {(d.def_out>0).sum()}")


def dose(label, col, outcome, qs=(0.50, 0.75, 0.90, 0.95)):
    nz = d[d[col] > 0][col]
    L(f"\n  {label} (OVER% by {col}; thresholds = pctiles of nonzero):")
    for q in qs:
        t = nz.quantile(q)
        sub = d[d[col] >= t].dropna(subset=[outcome]); n = len(sub)
        if n >= 25:
            k = int(sub[outcome].sum()); lo, hi = wilson_ci(k, n)
            td = (sub.tot - sub.total_line).mean()
            L(f"    {col}>={t:5.2f} (p{int(q*100)}): {outcome}%={k/n*100:5.1f} n={n:4d} CI[{lo*100:.0f},{hi*100:.0f}] actual-line={td:+.1f}")
    return nz.quantile(0.90)


def per_season(label, sub, outcome):
    parts = []
    for s in sorted(sub.season.unique()):
        ss = sub[sub.season == s].dropna(subset=[outcome])
        if len(ss) >= 8: parts.append(f"{int(s)}:{ss[outcome].mean()*100:.0f}%(n{len(ss)})")
    L(f"    {label}: " + " ".join(parts))


L("="*86); L("WAVE 2 — injury -> totals, snap-usage-weighted (2018-25)"); L("="*86)
allo = d.over.dropna().values
def nulltest(label, mask):
    sub = d[mask].dropna(subset=["over"]); real = sub.over.mean(); n = len(sub)
    if n < 20: L(f"  [null] {label}: n={n} too small"); return
    nulls = [rng.choice(allo, n, replace=False).mean() for _ in range(3000)]
    L(f"  [null] {label}: over={real*100:.1f}% (n={n}) p(|dev|>=)={np.mean([abs(x-.5)>=abs(real-.5) for x in nulls]):.3f}")

L("\n[A] OFFENSE injury -> OVER (snap-weighted; robustness check on the air-share finding)")
t_off = dose("game OFFENSE production out -> OVER", "game_off_out", "over")
per_season("game_off_out top-decile OVER", d[d.game_off_out >= t_off], "over")
nulltest("game_off_out top-decile OVER", d.game_off_out >= t_off)

L("\n[B] DEFENSE injury -> OVER (the MIRROR: weak D -> opp scores)")
t_def = dose("game DEFENSE production out -> OVER", "game_def_out", "over")
per_season("game_def_out top-decile OVER", d[d.game_def_out >= t_def], "over")
nulltest("game_def_out top-decile OVER", d.game_def_out >= t_def)
dose("opp PASS-RUSH out -> team's game OVER", "opp_rush_out", "over")

L("\n[C] Facing an injured DEFENSE -> does that offense COVER?")
t_od = d[d.opp_def_out > 0].opp_def_out.quantile(0.90)
dose("opp DEFENSE out -> OVER", "opp_def_out", "over")
sub = d[d.opp_def_out >= t_od].dropna(subset=["team_cover"]); k=int(sub.team_cover.sum()); n=len(sub)
if n>=25:
    lo,hi=wilson_ci(k,n); L(f"  facing opp_def_out>={t_od:.2f} (top decile): team ATS cover={k/n*100:.1f}% n={n} CI[{lo*100:.0f},{hi*100:.0f}]")
    per_season("facing injured-D: team ATS", d[d.opp_def_out >= t_od], "team_cover")
