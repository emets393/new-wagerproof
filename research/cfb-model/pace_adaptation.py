"""
PACE / POSSESSION ADAPTATION. Game pace = a tug-of-war, not an average. Theory: a ball-control (slow) team
facing a fast/explosive team drags tempo down (fewer possessions) -> lower total than the market expects.
Per-game drives (=possessions) from game_advanced. Team pace norm = as-of avg total drives in their games.
A. Who controls tempo? regress actual game drives on slow-team norm vs fast-team norm (bigger coef = controls).
B. Does a pace-MISMATCH game (slow vs fast) come in UNDER the market? esp slow=ball-control vs fast=explosive.
Holdout-disciplined (pool vs 2025).
"""
import glob
import numpy as np
import pandas as pd

ga = pd.concat([pd.read_parquet(f) for f in glob.glob("data/cfbd/game_advanced_*.parquet")], ignore_index=True)
ga = ga[ga.seasonType == "regular"][["season", "week", "gameId", "team", "offense.drives", "offense.plays"]]
gt = ga.groupby(["season", "week", "gameId"]).agg(tot_drives=("offense.drives", "sum"), nt=("team", "nunique")).reset_index()
gt = gt[gt.nt == 2]
# per-team game involvement -> as-of avg total drives in that team's games (their pace norm)
tg = ga.merge(gt[["season", "gameId", "tot_drives"]], on=["season", "gameId"]).sort_values(["team", "season", "week"])
g = tg.groupby(["team", "season"], group_keys=False)
tg["pace_norm"] = g["tot_drives"].apply(lambda s: s.shift().expanding().mean())
tg["pace_np"] = g.cumcount()
asof = tg[["season", "gameId", "team", "pace_norm", "pace_np"]].drop_duplicates(["season", "gameId", "team"])

gm = pd.read_parquet("data/model_games.parquet")
mg = gm[["season", "game_id", "homeTeam", "awayTeam", "total_close", "actual_total",
         "home_adj_explosiveness", "away_adj_explosiveness"]].rename(columns={"game_id": "gameId"})
G = mg.merge(gt[["season", "gameId", "tot_drives"]], on=["season", "gameId"])
G = G.merge(asof.rename(columns={"team": "homeTeam", "pace_norm": "h_pace", "pace_np": "h_np"}), on=["season", "gameId", "homeTeam"])
G = G.merge(asof.rename(columns={"team": "awayTeam", "pace_norm": "a_pace", "pace_np": "a_np"}), on=["season", "gameId", "awayTeam"])
G = G[(G.h_np >= 4) & (G.a_np >= 4) & G.total_close.notna() & G.actual_total.notna()].copy()
G["slow_norm"] = G[["h_pace", "a_pace"]].min(axis=1)
G["fast_norm"] = G[["h_pace", "a_pace"]].max(axis=1)
G["pace_gap"] = G.fast_norm - G.slow_norm
G["over"] = G.actual_total > G.total_close
TS = [2021, 2022, 2023, 2024, 2025]
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0
def per(b, w): return "/".join(f"{100*w[b.season==s].mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)

print(f"games: {len(G)} | mean pace_gap {G.pace_gap.mean():.1f}\n")
# ---- A. who controls tempo? ----
from numpy.linalg import lstsq
X = np.column_stack([np.ones(len(G)), (G.slow_norm - G.slow_norm.mean())/G.slow_norm.std(), (G.fast_norm - G.fast_norm.mean())/G.fast_norm.std()])
coef, *_ = lstsq(X, G.tot_drives.values, rcond=None)
print(f"A. actual game drives ~ slow_norm + fast_norm (standardized): slow coef {coef[1]:+.2f}, fast coef {coef[2]:+.2f}")
print(f"   ({'SLOW team controls more' if coef[1]>coef[2] else 'FAST team controls more'} -> {'ball-control wins tug-of-war' if coef[1]>coef[2] else 'tempo team wins'})")
# where does actual fall vs slow/avg/fast (mismatch games)?
mm = G[G.pace_gap >= G.pace_gap.quantile(0.66)]
print(f"   in big-mismatch games (n={len(mm)}): actual {mm.tot_drives.mean():.1f} vs slow_norm {mm.slow_norm.mean():.1f}, avg {((mm.slow_norm+mm.fast_norm)/2).mean():.1f}, fast_norm {mm.fast_norm.mean():.1f}")

# ---- B. pace-mismatch -> under the market? ----
print("\nB. PACE-MISMATCH games -> UNDER the market?")
for q, lab in [(0.50, "gap>=median"), (0.66, "gap>=p66"), (0.80, "gap>=p80")]:
    thr = G.pace_gap.quantile(q); b = G[(G.pace_gap >= thr) & (G.actual_total != G.total_close)]
    w = ~b.over; pool = b[b.season <= 2024]; hold = b[b.season == 2025]
    print(f"  {lab:<12}(gap>={thr:.1f}) n={len(b):<4} UNDER {100*w.mean():4.1f}% | pool {100*(~pool.over).mean():.0f}% | 2025 {100*(~hold.over).mean():.0f}%(n{len(hold)}) [{per(b,~b.over)}]")

# ---- C. the specific theory: slow/ball-control team vs FAST + EXPLOSIVE team -> under ----
print("\nC. ball-control (slow) vs FAST+EXPLOSIVE team -> UNDER (your exact theory)")
G["fast_is_home"] = G.h_pace > G.a_pace
G["fast_expl"] = np.where(G.fast_is_home, G.home_adj_explosiveness, G.away_adj_explosiveness)
ex66 = pd.concat([G.home_adj_explosiveness, G.away_adj_explosiveness]).quantile(0.60)
for lab, m in [("mismatch + fast team explosive", (G.pace_gap >= G.pace_gap.quantile(0.6)) & (G.fast_expl >= ex66)),
               ("mismatch + fast explosive + total>=52", (G.pace_gap >= G.pace_gap.quantile(0.6)) & (G.fast_expl >= ex66) & (G.total_close >= 52))]:
    b = G[m & (G.actual_total != G.total_close)]; w = ~b.over; hold = b[b.season == 2025]; pool = b[b.season <= 2024]
    print(f"  {lab:<38} n={len(b):<4} UNDER {100*w.mean():4.1f}% | pool {100*(~pool.over).mean():.0f}% | 2025 {100*(~hold.over).mean():.0f}%(n{len(hold)}) roi{roi(int(w.sum()),len(b)):+.1f} [{per(b,~b.over)}]")
