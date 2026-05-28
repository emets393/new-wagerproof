"""
LOCKED 'INJURY OVER' RULE — self-contained build + full evaluation.

Rule (fixed, forward-usable thresholds — defined ONCE):
  Bet OVER the closing total if EITHER:
   (OFF) a team has a WR/TE/RB whose prior-weeks NGS air-yards-share >= 35% ruled Out or Doubtful, OR
   (DEF) the two teams' Out/Doubtful defenders' combined prior defensive snap% sums to >= 2.00
         (~2.5+ defensive regulars missing across the game).
Mechanism: the market mis-prices injured-game totals (over-lowers for a star receiver out; under-raises
for defensive attrition) -> games land OVER. Graded vs the CLOSING total (pricing inefficiency, leak-safe).
Outputs per-game flag table out/injury_over_rule.csv + full per-season ROI, CI, null, sensitivity.
"""
import os, sys
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
rng = np.random.default_rng(0)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
L = print
inj = pd.read_parquet(os.path.join(DATA, "injuries_raw.parquet"))
rec = pd.read_parquet(os.path.join(DATA, "ngs_receiving.parquet"))
sc = pd.read_parquet(os.path.join(DATA, "snap_counts.parquet"))
px = pd.read_parquet(os.path.join(DATA, "players_xwalk.parquet"))
g = pd.read_parquet(os.path.join(DATA, "games_enriched.parquet"))
g2p = dict(zip(px.gsis_id, px.pfr_id))

AIRSHARE_THR = 35.0   # % of team intended air yards
DEF_SNAP_THR = 2.00   # combined prior defensive snap-equivalents missing in the game


def carry(df, key_id, col, out):
    df = df.sort_values([key_id, "season", "week"]).copy()
    df["_c"] = df.groupby([key_id, "season"])[col].apply(lambda s: s.shift(1).expanding().mean()).reset_index(level=[0, 1], drop=True)
    pl = df[["season", key_id]].drop_duplicates()
    grid = pl.merge(pd.DataFrame({"week": range(1, 23)}), how="cross").merge(
        df[["season", key_id, "week", "_c"]], on=["season", key_id, "week"], how="left").sort_values(["season", key_id, "week"])
    grid[out] = grid.groupby(["season", key_id])["_c"].ffill()
    return grid[["season", "week", key_id, out]]

# OFF: per-player prior air-yards-share (carry-forward), keyed by gsis player_id
air = carry(rec, "player_id", "percent_share_of_intended_air_yards", "airshare_prior")
# DEF: per-player prior defensive snap%, keyed by pfr id
sc = sc[sc.game_type == "REG"].copy(); sc["def_pct"] = sc.defense_pct.fillna(0)
dsnap = carry(sc, "pfr_player_id", "def_pct", "def_pct_prior")

miss = inj[inj.report_status.isin(["Out", "Doubtful"])].copy()
miss["pfr"] = miss.player_id.map(g2p)
miss = miss.merge(air, on=["season", "week", "player_id"], how="left")
miss = miss.merge(dsnap.rename(columns={"pfr_player_id": "pfr"}), on=["season", "week", "pfr"], how="left")
SKILL = {"WR", "TE", "RB", "FB"}; DEFP = {"DE","DT","NT","OLB","EDGE","CB","S","SS","FS","DB","LB","ILB","MLB"}
miss["is_keyrec_out"] = (miss.position.isin(SKILL) & (miss.airshare_prior >= AIRSHARE_THR)).astype(int)
miss["def_snap_out"] = np.where(miss.position.isin(DEFP), miss.def_pct_prior.fillna(0), 0.0)
ti = miss.groupby(["season", "week", "team"]).agg(keyrec_out=("is_keyrec_out", "max"),
                                                  def_out=("def_snap_out", "sum")).reset_index()

# ---- game level ----
gg = g[(g.game_type == "REG") & (g.season >= 2018) & g.home_score.notna() & g.total_line.notna()].copy()
gg["tot"] = gg.home_score + gg.away_score
gg = gg.merge(ti.rename(columns={"team": "home_team", "keyrec_out": "h_keyrec", "def_out": "h_def"}),
              on=["season", "week", "home_team"], how="left")
gg = gg.merge(ti.rename(columns={"team": "away_team", "keyrec_out": "a_keyrec", "def_out": "a_def"}),
              on=["season", "week", "away_team"], how="left")
for c in ["h_keyrec", "a_keyrec", "h_def", "a_def"]:
    gg[c] = gg[c].fillna(0)
gg["off_trigger"] = ((gg.h_keyrec == 1) | (gg.a_keyrec == 1)).astype(int)
gg["def_trigger"] = ((gg.h_def + gg.a_def) >= DEF_SNAP_THR).astype(int)
gg["over_play"] = ((gg.off_trigger == 1) | (gg.def_trigger == 1)).astype(int)
gg["over"] = np.where(gg.tot > gg.total_line, 1.0, np.where(gg.tot < gg.total_line, 0.0, np.nan))
gg["edge_pts"] = gg.tot - gg.total_line


def evalrule(label, mask):
    sub = gg[mask].dropna(subset=["over"]); n = len(sub); k = int(sub.over.sum())
    if n == 0:
        L(f"  {label}: n=0"); return
    lo, hi = wilson_ci(k, n); roi = (k * 100 / 110 - (n - k)) / n
    L(f"\n  {label}: n={n} OVER={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI@-110={roi*100:+.1f}% "
      f"avg(actual-line)={sub.edge_pts.mean():+.1f} | fires {n}/{len(gg.dropna(subset=['over']))} games ({n/len(gg)*100:.0f}%)")
    parts = []
    for s in sorted(sub.season.unique()):
        ss = sub[sub.season == s]; parts.append(f"{int(s)}:{ss.over.mean()*100:.0f}%(n{len(ss)})")
    L("     per-season: " + " ".join(parts))
    pos = sum(1 for s in sorted(sub.season.unique()) if sub[sub.season == s].over.mean() >= 0.524 and len(sub[sub.season == s]) >= 5)
    L(f"     seasons beating vig: {pos}/{sub.season.nunique()}")


L("=" * 90); L("LOCKED INJURY-OVER RULE (2018-2025, vs closing total)"); L("=" * 90)
L(f"  thresholds: air-yards-share>={AIRSHARE_THR}% (WR/TE/RB Out/Dbt)  OR  combined def snap-out>={DEF_SNAP_THR}")
evalrule("COMBINED (off OR def trigger)  [THE RULE]", gg.over_play == 1)
evalrule("  component: OFF trigger only", (gg.off_trigger == 1))
evalrule("  component: DEF trigger only", (gg.def_trigger == 1))
evalrule("  baseline: NO trigger (control)", gg.over_play == 0)

L("\n  -- sensitivity (rule is not one magic cutoff) --")
for a_thr, d_thr in [(30, 1.5), (35, 2.0), (40, 2.5)]:
    m2 = (((gg.h_keyrec if a_thr == 35 else (gg.a_keyrec*0)) ) )  # recompute triggers at alt thresholds below
for a_thr in [30, 35, 40]:
    ot = ((miss.position.isin(SKILL) & (miss.airshare_prior >= a_thr)).groupby([miss.season, miss.week, miss.team]).max())
    # quick alt-threshold via recompute
    tia = miss.assign(kr=(miss.position.isin(SKILL) & (miss.airshare_prior >= a_thr)).astype(int)).groupby(["season","week","team"]).kr.max().reset_index()
    gh = gg[["season","week","home_team","away_team","over"]].merge(tia.rename(columns={"team":"home_team","kr":"hk"}),on=["season","week","home_team"],how="left").merge(tia.rename(columns={"team":"away_team","kr":"ak"}),on=["season","week","away_team"],how="left").fillna(0)
    mask = ((gh.hk==1)|(gh.ak==1)); sub=gh[mask].dropna(subset=["over"])
    if len(sub): L(f"    OFF air-share>={a_thr}: OVER={sub.over.mean()*100:.1f}% n={len(sub)}")
for d_thr in [1.5, 2.0, 2.5, 3.0]:
    sub = gg[(gg.h_def + gg.a_def) >= d_thr].dropna(subset=["over"])
    if len(sub): L(f"    DEF snap-out>={d_thr}: OVER={sub.over.mean()*100:.1f}% n={len(sub)}")

# null on the combined rule
sub = gg[gg.over_play == 1].dropna(subset=["over"]); real = sub.over.mean(); n = len(sub)
allo = gg.over.dropna().values
nulls = [rng.choice(allo, n, replace=False).mean() for _ in range(5000)]
L(f"\n  [null] combined rule OVER={real*100:.1f}% (n={n}) vs random-same-n: p(|dev|>=)={np.mean([abs(x-.5)>=abs(real-.5) for x in nulls]):.4f}")

# save codeable per-game flags
keep = gg[["season","week","home_team","away_team","total_line","tot","h_keyrec","a_keyrec","h_def","a_def","off_trigger","def_trigger","over_play","over"]].copy()
keep.to_csv(os.path.join(OUT, "injury_over_rule.csv"), index=False)
L(f"\n[saved] per-game rule flags -> out/injury_over_rule.csv ({len(keep)} games)")
