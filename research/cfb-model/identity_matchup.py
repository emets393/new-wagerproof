"""
IDENTITY x OPPONENT-DEFENSE matchup. Identity (run/pass lean) is STABLE (0.69 YoY) so it's reliable. Theory:
a team FORCED off its identity underperforms (it's not built for plan B). Test the 4 quadrants on team ATS
(cover vs close) + game total + team scoring-vs-own-norm.
  run-heavy vs STOUT run-D  -> forced to pass -> fade team? under?
  run-heavy vs SOFT  run-D  -> feast on ground -> back team? (over or under-via-clock?)
  pass-heavy vs LOCKDOWN sec -> forced to run -> fade team?
  pass-heavy vs WEAK     sec -> feast -> back team?
As-of: identity = team season-to-date run-rate (>=4 prior g); opp D = adj_*_epa_allowed (as-of). holdout-disciplined.
"""
import glob
import numpy as np
import pandas as pd

gm = pd.read_parquet("data/model_games.parquet")
box = pd.concat([pd.read_parquet(f) for f in glob.glob("data/cfbd/teamgame_box_*.parquet")], ignore_index=True)
box["run_rate"] = box.rush_att / (box.rush_att + box.pass_att)
box = box.merge(gm[["season", "game_id", "date"]], on=["season", "game_id"], how="left").sort_values(["season", "team", "date"])
g = box.groupby(["season", "team"], group_keys=False)
box["id_run"] = g["run_rate"].apply(lambda s: s.shift().expanding().mean())   # as-of identity (run lean)
box["id_np"] = g.cumcount()
ident = box[["season", "game_id", "team", "id_run", "id_np", "points"]]

# long team-game: team identity + opp run-D/pass-D + ATS + total
rows = []
for _, r in gm.iterrows():
    for who, opp in [("home", "away"), ("away", "home")]:
        tm = r.actual_margin if who == "home" else -r.actual_margin
        tsp = r.spread_close if who == "home" else -r.spread_close
        if pd.isna(tsp) or pd.isna(r.actual_margin): continue
        rows.append({"season": r.season, "game_id": r.game_id, "team": r[f"{who}Team"],
                     "opp_runD_soft": r[f"{opp}_adj_rushing_epa_allowed"], "opp_passD_weak": r[f"{opp}_adj_passing_epa_allowed"],
                     "cover": np.nan if tm + tsp == 0 else int(tm + tsp > 0),
                     "total_close": r.total_close, "actual_total": r.actual_total})
L = pd.DataFrame(rows).merge(ident, on=["season", "game_id", "team"], how="left")
L = L[(L.id_np >= 4) & L.id_run.notna() & L.opp_runD_soft.notna()].copy()
# tercile thresholds
rhi = L.id_run.quantile(0.66); rlo = L.id_run.quantile(0.34)   # run-heavy / pass-heavy identity
# opp run-D: HIGH epa_allowed = soft; LOW = stout. opp pass-D: HIGH = weak; LOW = lockdown
rd_stout = L.opp_runD_soft.quantile(0.34); rd_soft = L.opp_runD_soft.quantile(0.66)
pd_lock = L.opp_passD_weak.quantile(0.34); pd_weak = L.opp_passD_weak.quantile(0.66)
TS = [2021, 2022, 2023, 2024, 2025]
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0
def per(b, w): return "/".join(f"{100*w[b.season==s].mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)

def spot(label, mask, bet):
    b = L[mask].dropna(subset=["cover"])
    if len(b) < 40: print(f"  {label:<42} n={len(b)} (thin)"); return
    w = b.cover if bet == "team" else (1 - b.cover)
    pool = b[b.season <= 2024]; hold = b[b.season == 2025]
    pw = (pool.cover if bet=="team" else 1-pool.cover); hw = (hold.cover if bet=="team" else 1-hold.cover)
    flag = "  <<HOLDS" if (pw.mean()>0.524 and hw.mean()>0.524 and len(hold)>=15) else ""
    print(f"  {label:<42} n={len(b):<4} bet {bet:<4} {100*w.mean():4.1f}% | pool {100*pw.mean():4.1f}% | 2025 {100*hw.mean():4.1f}%(n{len(hold)}) roi{roi(int(w.sum()),len(b)):+.1f} [{per(b,w)}]{flag}")

print("=== ATS: forced-off-identity -> FADE; in-identity -> BACK ===")
spot("run-heavy vs STOUT run-D (forced pass)", (L.id_run >= rhi) & (L.opp_runD_soft <= rd_stout), "opp")
spot("run-heavy vs SOFT run-D (feast)", (L.id_run >= rhi) & (L.opp_runD_soft >= rd_soft), "team")
spot("pass-heavy vs LOCKDOWN sec (forced run)", (L.id_run <= rlo) & (L.opp_passD_weak <= pd_lock), "opp")
spot("pass-heavy vs WEAK sec (feast)", (L.id_run <= rlo) & (L.opp_passD_weak >= pd_weak), "team")

# ---- totals: forced-off-identity -> under? (offense stalls) ----
print("\n=== TOTALS @ close: identity-mismatch -> UNDER? ===")
G = gm[gm.total_close.notna() & gm.actual_total.notna()].copy()
G = G[G.actual_total != G.total_close]; G["over"] = G.actual_total > G.total_close
# bring identity for both teams
idm = ident.rename(columns={"team": "homeTeam", "id_run": "h_id", "id_np": "h_np"})
ida = ident.rename(columns={"team": "awayTeam", "id_run": "a_id", "id_np": "a_np"})
G = G.merge(idm[["season","game_id","homeTeam","h_id","h_np"]], on=["season","game_id","homeTeam"], how="left")
G = G.merge(ida[["season","game_id","awayTeam","a_id","a_np"]], on=["season","game_id","awayTeam"], how="left")
G = G[(G.h_np>=4)&(G.a_np>=4)].copy()
# home run-heavy vs away stout run-D, OR away run-heavy vs home stout run-D = a forced-off-identity offense
hm = (G.h_id>=rhi)&(G.away_adj_rushing_epa_allowed<=rd_stout)
am = (G.a_id>=rhi)&(G.home_adj_rushing_epa_allowed<=rd_stout)
def tspot(label, mask):
    b = G[mask]; w = ~b.over; hold=b[b.season==2025]; pool=b[b.season<=2024]
    print(f"  {label:<46} n={len(b):<4} UNDER {100*w.mean():4.1f}% | pool {100*(~pool.over).mean():.0f}% | 2025 {100*(~hold.over).mean():.0f}%(n{len(hold)}) [{per(b,~b.over)}]")
tspot(">=1 run-heavy O vs stout run-D (forced pass)", hm|am)
tspot("BOTH offenses forced off-identity", hm&am)
