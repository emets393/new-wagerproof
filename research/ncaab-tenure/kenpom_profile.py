#!/usr/bin/env python3
"""Owner follow-up 2026-11-02: do the PRESEASON KenPom components (adjusted offense, adjusted defense, tempo) add signal for
non-power schools early in the season -- on their own and inside the young-and-new cell?
Preseason KenPom = the first archive date of each season (kenpom_archive_daily, 2022-23..2025-26), names -> CBBD ids via
ncaab-hype/data/team_mapping.parquet. Ranks are national (1 = best offense / best defense / fastest). Ladders BACK the team."""
import numpy as np, pandas as pd
rng = np.random.default_rng(5)
B = "../bball-odds/data/parquet/"
D = pd.read_parquet("tenure_games.parquet")
ka = pd.read_parquet(B + "kenpom_archive_daily.parquet")
first = ka[ka.ArchiveDate == ka.groupby("Season").ArchiveDate.transform("min")]
mp = pd.read_parquet("../ncaab-hype/data/team_mapping.parquet").dropna(subset=["KenPom_Name"])[["KenPom_Name", "api_team_id"]]
K = first.merge(mp, left_on="TeamName", right_on="KenPom_Name")[["Season", "api_team_id", "AdjOE", "RankAdjOE", "AdjDE", "RankAdjDE", "AdjTempo", "RankAdjTempo", "RankAdjEM"]]
K = K.rename(columns={"Season": "season_end", "api_team_id": "teamId", "AdjOE": "oe", "RankAdjOE": "oe_rk", "AdjDE": "de", "RankAdjDE": "de_rk", "AdjTempo": "tempo", "RankAdjTempo": "tempo_rk", "RankAdjEM": "em_rk"})
K["teamId"] = K.teamId.astype(int)
print(f"preseason KenPom rows mapped: {len(K)} ({K.groupby('season_end').size().to_dict()}); archive dates {first.groupby('Season').ArchiveDate.first().to_dict()}")
D = D.merge(K, on=["season_end", "teamId"], how="inner").merge(K.rename(columns={"teamId": "opponentId"}).add_prefix("o_").rename(columns={"o_season_end": "season_end", "o_opponentId": "opponentId"}), on=["season_end", "opponentId"], how="left")
D["imb_rk"] = D.oe_rk - D.de_rk                       # negative = offense ranks better than defense (offense-led)
D["tempo_gap"] = D.tempo - D.o_tempo
print(f"games with preseason KenPom both sides: {D.o_oe.notna().sum():,} of {len(D):,}")
def rec(s): return int((s.win_ats > 0).sum()), int((s.win_ats < 0).sum())
def shuffle_p(mask, x, n=1000):
    obs = x.loc[mask, "win_ats"].sum(); codes = pd.factorize(x.season_end.astype(str) + "_" + x.mon.astype(str))[0]; vals = x.win_ats.values; m = mask.values
    order = np.argsort(codes, kind="stable"); groups = np.split(order, np.flatnonzero(np.diff(codes[order])) + 1); sims = np.empty(n)
    for i in range(n):
        perm = np.empty_like(vals)
        for idx in groups: perm[idx] = vals[rng.permutation(idx)]
        sims[i] = perm[m].sum()
    return float((np.abs(sims) >= abs(obs)).mean())
def line(mask, label, x, shuffle=False, placebo=None):
    s = x[mask]
    if len(s) < 40: print(f"   {label:<58} n={len(s)} thin"); return
    w, l = rec(s); roi = 100 * (w * 100 / 110 - l) / (w + l); per = " ".join(f"{str(y)[2:]}:{rec(g)[0]}-{rec(g)[1]}" for y, g in s.groupby("season_end"))
    ex = f" | shuffle p {shuffle_p(mask, x):.3f}" if shuffle else ""
    if placebo is not None:
        p = x[placebo]; pw, pl = rec(p); ex += f" | Jan-Feb {pw}-{pl} ({100*pw/max(1,pw+pl):.1f}%)"
    print(f"   {label:<58} BACK {w}-{l} ({100*w/(w+l):.1f}%, ROI {roi:+.1f}%) spr {s.spread.mean():+.1f} SU {100*(s.win>0).mean():.0f}% | {per}{ex}")
def ladder(x, col, bins, labels, title, win, placebo_win):
    print(f"\n   {title}")
    b = pd.cut(x[col], bins, labels=labels)
    for lab in labels:
        m = win & (b == lab); line(m, f"  {lab}", x, placebo=placebo_win & (b == lab))
S = D[D.small].copy(); nd = S.novdec; e10 = S.early10; jf = S.janfeb
print("\n=== A. ALL NON-POWER TEAMS, Nov-Dec, by PRESEASON national rank band (BACK the team) ===")
RB = [0, 50, 100, 150, 200, 250, 300, 400]; RL = ["1-50", "51-100", "101-150", "151-200", "201-250", "251-300", "301+"]
ladder(S, "oe_rk", RB, RL, "adjusted OFFENSE rank", nd, jf)
ladder(S, "de_rk", RB, RL, "adjusted DEFENSE rank", nd, jf)
ladder(S, "tempo_rk", RB, RL, "TEMPO rank (1 = fastest)", nd, jf)
ladder(S, "imb_rk", [-400, -150, -75, -25, 25, 75, 150, 400], ["offense-led 150+", "offense-led 75-150", "offense-led 25-75", "balanced", "defense-led 25-75", "defense-led 75-150", "defense-led 150+"], "OFFENSE rank minus DEFENSE rank (is the team built on O or D?)", nd, jf)
print("\n   -- same, first 10 games only (offense / defense / imbalance) --")
ladder(S, "oe_rk", RB, RL, "adjusted OFFENSE rank, first 10", e10, jf); ladder(S, "de_rk", RB, RL, "adjusted DEFENSE rank, first 10", e10, jf)
ladder(S, "imb_rk", [-400, -150, -75, -25, 25, 75, 150, 400], ["offense-led 150+", "offense-led 75-150", "offense-led 25-75", "balanced", "defense-led 25-75", "defense-led 75-150", "defense-led 150+"], "imbalance, first 10", e10, jf)
print("\n=== B. NON-POWER, Nov-Dec, relative to the OPPONENT ===")
S["o_tempo_q"] = pd.cut(S.tempo_gap, [-30, -6, -2, 2, 6, 30], labels=["much slower", "slower", "even", "faster", "much faster"])
for lab in ["much slower", "slower", "even", "faster", "much faster"]: line(nd & (S.o_tempo_q == lab), f"tempo vs opponent: {lab}", S, placebo=jf & (S.o_tempo_q == lab))
line(nd & (S.oe_rk <= 100) & (S.o_de_rk >= 200), "good offense (top 100) vs bad defense (200+)", S, shuffle=True, placebo=jf & (S.oe_rk <= 100) & (S.o_de_rk >= 200))
line(nd & (S.de_rk <= 100) & (S.o_oe_rk >= 200), "good defense (top 100) vs bad offense (200+)", S, shuffle=True, placebo=jf & (S.de_rk <= 100) & (S.o_oe_rk >= 200))
line(nd & (S.de_rk <= 100) & (S.oe_rk >= 200), "defense-first team (D top 100, O 200+)", S, shuffle=True, placebo=jf & (S.de_rk <= 100) & (S.oe_rk >= 200))
line(nd & (S.oe_rk <= 100) & (S.de_rk >= 200), "offense-first team (O top 100, D 200+)", S, shuffle=True, placebo=jf & (S.oe_rk <= 100) & (S.de_rk >= 200))
line(nd & (S.tempo_rk <= 50), "fastest 50 nationally", S, shuffle=True, placebo=jf & (S.tempo_rk <= 50)); line(nd & (S.tempo_rk >= 300), "slowest (300+)", S, shuffle=True, placebo=jf & (S.tempo_rk >= 300))
line(nd & (S.tempo_rk <= 50) & (S.spread > 0), "fastest 50, as underdog", S, shuffle=True); line(nd & (S.tempo_rk >= 300) & (S.spread > 0), "slowest 300+, as underdog", S, shuffle=True)
line(nd & (S.tempo_rk <= 50) & (S.o_tempo_rk >= 300), "fastest 50 vs a slowest-300+ opponent", S, shuffle=True); line(nd & (S.tempo_rk >= 300) & (S.o_tempo_rk <= 50), "slowest 300+ vs a fastest-50 opponent", S, shuffle=True)
print("\n=== C. INSIDE THE YOUNG-AND-NEW CELL (young quintile, zero 3rd+-yr minutes, non-power), Nov-Dec ===")
Y = (D.q_upper_share == 1) & (D.core_share == 0) & D.small; C = D[Y].copy(); cnd = C.novdec; d7 = C.spread >= 7
line(cnd, "cell, all", C); line(cnd & d7, "cell, dog of 7+", C)
for col, nm in [("oe_rk", "offense rank"), ("de_rk", "defense rank"), ("tempo_rk", "tempo rank"), ("em_rk", "overall rank")]:
    t = pd.qcut(C[col].rank(method="first"), 3, labels=["best third", "middle", "worst third"]) if col != "tempo_rk" else pd.qcut(C[col].rank(method="first"), 3, labels=["fastest third", "middle", "slowest third"])
    print(f"   -- by preseason {nm} within the cell (terciles) --")
    for lab in t.cat.categories:
        line(cnd & (t == lab), f"  {lab}  [{nm} {int(C[t==lab][col].min())}-{int(C[t==lab][col].max())}]", C); line(cnd & d7 & (t == lab), f"    ... dog of 7+", C)
imb = pd.cut(C.imb_rk, [-400, -40, 40, 400], labels=["offense-led", "balanced", "defense-led"])
print("   -- by offense-led / defense-led within the cell --")
for lab in imb.cat.categories: line(cnd & (imb == lab), f"  {lab}", C); line(cnd & d7 & (imb == lab), f"    ... dog of 7+", C)
print("   -- opponent profile, cell as dog of 7+ --")
line(cnd & d7 & (C.o_tempo_rk <= 100), "  vs fast opponent (tempo top 100)", C); line(cnd & d7 & (C.o_tempo_rk >= 250), "  vs slow opponent (250+)", C)
line(cnd & d7 & (C.o_oe_rk <= 50), "  vs elite offense (top 50)", C); line(cnd & d7 & (C.o_de_rk <= 50), "  vs elite defense (top 50)", C)
line(cnd & d7 & (C.o_em_rk <= 50), "  vs top-50 opponent", C); line(cnd & d7 & (C.o_em_rk > 50), "  vs opponent outside the top 50", C)
