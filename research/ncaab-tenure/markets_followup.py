#!/usr/bin/env python3
"""Controls on the one finding from markets_study.py: a PRESEASON-KenPom top-100 NON-POWER team laying 7+ -> the full-game total
goes OVER. Checks: power-conference version, rank dose (preseason and as-of), spread dose, opponent rank, home/away, conf/non-conf,
month, line level, vs opener, conference of the favorite, the other markets in the same spot, shuffle null on the game frame.
Also controls on the 'both good defenses -> UNDER' Nov-Dec cell (fails: full-season 50.1%, Jan-Feb flips)."""
import numpy as np, pandas as pd
rng = np.random.default_rng(3)
B = "../bball-odds/data/parquet/"
D = pd.read_parquet("tenure_games.parquet")
ka = pd.read_parquet(B + "kenpom_archive_daily.parquet"); first = ka[ka.ArchiveDate == ka.groupby("Season").ArchiveDate.transform("min")]
mp = pd.read_parquet("../ncaab-hype/data/team_mapping.parquet").dropna(subset=["KenPom_Name"])[["KenPom_Name", "api_team_id"]]
K = first.merge(mp, left_on="TeamName", right_on="KenPom_Name")[["Season", "api_team_id", "RankAdjEM", "RankAdjDE"]].rename(columns={"Season": "season_end", "api_team_id": "teamId", "RankAdjEM": "em_rk", "RankAdjDE": "de_rk"}); K["teamId"] = K.teamId.astype(int)
D = D.merge(K, on=["season_end", "teamId"], how="left").merge(K.rename(columns={"teamId": "opponentId", "em_rk": "o_em_rk", "de_rk": "o_de_rk"}), on=["season_end", "opponentId"], how="left")
D["power"] = ~D.small
G = D.drop_duplicates("cbbd_id").dropna(subset=["tot_resid"]).copy()
def rec(s, col="tot_resid", pos="OVER"):
    s = s.drop_duplicates("cbbd_id").dropna(subset=[col]); w = int((s[col] > 0).sum()); l = int((s[col] < 0).sum())
    per = " ".join(f"{str(y)[2:]}:{int((g[col]>0).sum())}-{int((g[col]<0).sum())}" for y, g in s.groupby("season_end"))
    return f"{pos} {w}-{l} ({100*w/max(1,w+l):.1f}%, ROI {100*(w*100/110-l)/max(1,w+l):+.1f}%) | {per}"
def openrec(s):
    s = s.drop_duplicates("cbbd_id").dropna(subset=["open_total", "total_actual"]); r = s.total_actual - s.open_total; w = int((r > 0).sum()); l = int((r < 0).sum())
    return f"vs OPENER over {w}-{l} ({100*w/max(1,w+l):.1f}%), close-open {(s.total_line-s.open_total).mean():+.2f}"
def shuffle_p(ids, n=2000):
    m = G.cbbd_id.isin(ids).values; vals = np.sign(G.tot_resid.values); obs = vals[m].sum(); codes = pd.factorize(G.season_end.astype(str) + "_" + G.mon.astype(str))[0]
    order = np.argsort(codes, kind="stable"); groups = np.split(order, np.flatnonzero(np.diff(codes[order])) + 1); sims = np.empty(n)
    for i in range(n):
        perm = np.empty_like(vals)
        for idx in groups: perm[idx] = vals[rng.permutation(idx)]
        sims[i] = perm[m].sum()
    return (np.abs(sims) >= abs(obs)).mean()
nd = D.novdec; jf = D.janfeb; f7 = D.spread <= -7; t100 = D.em_rk <= 100
P = lambda lab, s, **k: print(f"   {lab:<50} {rec(s, **k)}")
print("=== 1. Who is it specific to? (full-game total, Nov-Dec unless stated) ===")
P("non-power fav 7+, ANY rank", D[nd & D.small & f7]); P("non-power fav 7+, rank 101-200", D[nd & D.small & f7 & (D.em_rk > 100) & (D.em_rk <= 200)]); P("non-power fav 7+, rank 200+", D[nd & D.small & f7 & (D.em_rk > 200)])
P("** non-power fav 7+, preseason top 100", D[nd & D.small & f7 & t100]); print(f"   {'':<50} {openrec(D[nd & D.small & f7 & t100])}  shuffle p {shuffle_p(D[nd & D.small & f7 & t100].cbbd_id):.4f}")
P("   same, Jan-Feb", D[jf & D.small & f7 & t100]); P("   same, FULL season", D[D.small & f7 & t100]); print(f"   {'':<50} {openrec(D[D.small & f7 & t100])}  shuffle p {shuffle_p(D[D.small & f7 & t100].cbbd_id):.4f}")
P("POWER fav 7+, preseason top 100", D[nd & D.power & f7 & t100]); P("POWER fav 7+, any", D[nd & D.power & f7]); P("ALL fav 7+", D[nd & f7]); P("ALL top-100 fav 7+", D[nd & f7 & t100])
print("\n=== 2. Rank dose (favorite's PRESEASON rank), non-power favorite of 7+ ===")
F = D[(D.spread <= -7) & D.small].dropna(subset=["tot_resid"]).drop_duplicates("cbbd_id"); fnd = F.novdec
for lo, hi in [(1, 25), (26, 50), (51, 75), (76, 100), (101, 150), (151, 200), (201, 400)]:
    m = (F.em_rk >= lo) & (F.em_rk <= hi); print(f"   rank {lo}-{hi:<4} Nov-Dec {rec(F[fnd & m]):<72} full {rec(F[m])}")
print("   -- AS-OF rank (KenPom at game time; what production would use) --")
for lo, hi in [(1, 50), (51, 100), (101, 150), (151, 200), (201, 400)]:
    m = (F.own_kp_rank >= lo) & (F.own_kp_rank <= hi); print(f"   rank {lo}-{hi:<4} Nov-Dec {rec(F[fnd & m]):<72} full {rec(F[m])}")
a100 = F.own_kp_rank <= 100
print(f"   as-of top-100, Nov-Dec: {rec(F[fnd & a100])}  p={shuffle_p(F[fnd & a100].cbbd_id):.4f}"); print(f"   as-of top-100, full:    {rec(F[a100])}  p={shuffle_p(F[a100].cbbd_id):.4f}")
print("\n=== 3. Spread dose, preseason top-100 non-power favorite, full season ===")
for lo, hi in [(3, 5), (5, 7), (7, 10), (10, 14), (14, 20), (20, 60)]: P(f"fav {lo}-{hi}", D[D.small & t100 & (D.spread <= -lo) & (D.spread > -hi)])
print("\n=== 4. Splits, preseason top-100 non-power favorite 7+ ===")
X = D[D.small & f7 & t100]
for lo, hi in [(1, 100), (101, 200), (201, 300), (301, 400)]: P(f"opp as-of rank {lo}-{hi}, full", X[(X.o_kp_rank >= lo) & (X.o_kp_rank <= hi)])
P("home, Nov-Dec", X[X.novdec & (X.is_home == 1)]); P("away/neutral, Nov-Dec", X[X.novdec & (X.is_home != 1)]); P("conf game, Nov-Dec", X[X.novdec & (X.conf_game == 1)]); P("non-conf, Nov-Dec", X[X.novdec & (X.conf_game != 1)])
for m, g in X.groupby("mon"): P(f"month {m}", g)
for lo, hi in [(0, 135), (135, 145), (145, 155), (155, 200)]: P(f"total line {lo}-{hi}, full", X[(X.total_line >= lo) & (X.total_line < hi)])
print("   -- conference of the favorite, full season, n>=40 --")
for c, g in X.drop_duplicates("cbbd_id").groupby("conference"):
    if len(g) >= 40: P(f"  {c}", g)
print("\n=== 5. Same spot, other markets ===")
P("1H total", X[X.novdec], col="h1_tot_resid"); P("favorite's team total", X[X.novdec], col="tt_resid"); P("1H spread, BACK the favorite", X[X.novdec], col="h1_ats_pts", pos="BACK"); P("FG spread, BACK the favorite", X[X.novdec], col="win_ats", pos="BACK")
print(f"   mean total residual: this spot {X[X.novdec].tot_resid.mean():+.2f} pts | all non-power fav 7+ {D[nd & D.small & f7].drop_duplicates('cbbd_id').tot_resid.mean():+.2f} | all games {G[G.novdec].tot_resid.mean():+.2f}")
print("\n=== 6. 'Both good defenses -> UNDER' control ===")
bd = (D.de_rk <= 100) & (D.o_de_rk <= 100)
P("own non-power, Nov-Dec", D[nd & D.small & bd]); P("any own, Nov-Dec", D[nd & bd]); P("any own, Jan-Feb", D[jf & bd]); P("any own, full season", D[bd]); P("both top-50 defenses, Nov-Dec", D[nd & (D.de_rk <= 50) & (D.o_de_rk <= 50)])
print("\n=== 7. Young-and-new cell dog 7+: FG vs 1H spread agreement ===")
s = D[nd & D.small & (D.q_upper_share == 1) & (D.core_share == 0) & (D.spread >= 7)].dropna(subset=["h1_ats_pts"])
print(pd.crosstab(np.sign(s.win_ats).rename("FG cover"), np.sign(s.h1_ats_pts).rename("1H cover")))
