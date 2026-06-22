"""
TEAM TOTALS (contrived from game total + spread): implied_team_total = (total_close - team_spread)/2
(favorite's spread is negative -> higher implied team total). team_over = actual team pts > implied.
Note: team_over == (game total result) + (team ATS result) > 0 -> recombines totals+sides; useful because the
ACTUAL team-total market is softer/thinner. Isolates ONE offense -> cleaner test of adaptation/identity.
Test: identity-matchup (forced off identity -> under own total), favorite bias, form, padded, conf, G5. holdout.
"""
import glob
import numpy as np
import pandas as pd

gm = pd.read_parquet("data/model_games.parquet")
box = pd.concat([pd.read_parquet(f) for f in glob.glob("data/cfbd/teamgame_box_*.parquet")], ignore_index=True)
box["run_rate"] = box.rush_att / (box.rush_att + box.pass_att)
box = box.merge(gm[["season", "game_id", "date"]], on=["season", "game_id"], how="left").sort_values(["season", "team", "date"])
gg = box.groupby(["season", "team"], group_keys=False)
box["id_run"] = gg["run_rate"].apply(lambda s: s.shift().expanding().mean()); box["id_np"] = gg.cumcount()
# team over-rate form (as-of) for team-total context: did team go over its OWN implied total recently? -> build below
ident = box[["season", "game_id", "team", "id_run", "id_np"]]
P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
TS = [2021, 2022, 2023, 2024, 2025]
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0
def per(b, w): return "/".join(f"{100*w[b.season==s].mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)

rows = []
for _, r in gm.iterrows():
    if pd.isna(r.total_close) or pd.isna(r.spread_close) or pd.isna(r.homePoints): continue
    for who, opp in [("home", "away"), ("away", "home")]:
        tsp = r.spread_close if who == "home" else -r.spread_close
        implied = (r.total_close - tsp) / 2.0
        pts = r.homePoints if who == "home" else r.awayPoints
        rows.append({"season": r.season, "game_id": r.game_id, "team": r[f"{who}Team"], "conf": r[f"{who}Conference"],
                     "is_p5": r[f"{who}Conference"] in P5, "team_spread": tsp, "implied": implied, "pts": pts,
                     "is_fav": tsp < 0, "opp_runD_soft": r[f"{opp}_adj_rushing_epa_allowed"],
                     "opp_passD_weak": r[f"{opp}_adj_passing_epa_allowed"]})
L = pd.DataFrame(rows).merge(ident, on=["season", "game_id", "team"], how="left")
L = L[L.pts != L.implied].copy()
L["over"] = (L.pts > L.implied).astype(int)
print(f"team-games: {len(L)} | baseline team-total OVER {100*L.over.mean():.1f}%  (mean implied {L.implied.mean():.1f})\n")

def spot(label, mask, side):  # side: 'over' or 'under'
    b = L[mask]
    if len(b) < 50: print(f"  {label:<44} n={len(b)} (thin)"); return
    w = b.over if side == "over" else 1 - b.over
    pool = b[b.season <= 2024]; hold = b[b.season == 2025]
    pw = (pool.over if side=="over" else 1-pool.over); hw = (hold.over if side=="over" else 1-hold.over)
    flag = "  <<HOLDS" if (pw.mean()>0.524 and hw.mean()>0.524 and len(hold)>=20) else ""
    print(f"  {label:<44} n={len(b):<4} {side.upper():<5} {100*w.mean():4.1f}% | pool {100*pw.mean():4.1f}% | 2025 {100*hw.mean():4.1f}%(n{len(hold)}) roi{roi(int(w.sum()),len(b)):+.1f} [{per(b,w)}]{flag}")

L2 = L[(L.id_np >= 4) & L.id_run.notna() & L.opp_runD_soft.notna()].copy()
rhi = L2.id_run.quantile(.66); rlo = L2.id_run.quantile(.34)
rd_stout = L2.opp_runD_soft.quantile(.34); rd_soft = L2.opp_runD_soft.quantile(.66)
pd_lock = L2.opp_passD_weak.quantile(.34); pd_weak = L2.opp_passD_weak.quantile(.66)
def spot2(label, mask, side):
    b = L2[mask]
    if len(b) < 50: print(f"  {label:<44} n={len(b)} (thin)"); return
    w = b.over if side == "over" else 1 - b.over
    pool = b[b.season <= 2024]; hold = b[b.season == 2025]
    pw = (pool.over if side=="over" else 1-pool.over); hw = (hold.over if side=="over" else 1-hold.over)
    flag = "  <<HOLDS" if (pw.mean()>0.524 and hw.mean()>0.524 and len(hold)>=20) else ""
    print(f"  {label:<44} n={len(b):<4} {side.upper():<5} {100*w.mean():4.1f}% | pool {100*pw.mean():4.1f}% | 2025 {100*hw.mean():4.1f}%(n{len(hold)}) roi{roi(int(w.sum()),len(b)):+.1f} [{per(b,w)}]{flag}")

print("=== FAVORITE / DOG team-total bias ===")
spot("favorites (team total)", L.is_fav, "under")
spot("dogs (team total)", ~L.is_fav, "over")
print("\n=== ADAPTATION / IDENTITY (isolates the offense) ===")
spot2("run-heavy vs STOUT run-D -> team UNDER own total", (L2.id_run>=rhi)&(L2.opp_runD_soft<=rd_stout), "under")
spot2("run-heavy vs SOFT run-D -> team OVER own total", (L2.id_run>=rhi)&(L2.opp_runD_soft>=rd_soft), "over")
spot2("pass-heavy vs LOCKDOWN sec -> team UNDER", (L2.id_run<=rlo)&(L2.opp_passD_weak<=pd_lock), "under")
spot2("pass-heavy vs WEAK sec -> team OVER", (L2.id_run<=rlo)&(L2.opp_passD_weak>=pd_weak), "over")
print("\n=== by tier ===")
spot("G5 dogs OVER own total", (~L.is_fav)&(~L.is_p5), "over")
spot("P5 favorites UNDER own total", (L.is_fav)&(L.is_p5), "under")
