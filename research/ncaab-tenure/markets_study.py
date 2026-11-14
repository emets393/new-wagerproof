#!/usr/bin/env python3
"""Owner follow-up 2026-11-03: take the SAME conditions graded yesterday on the full-game spread (tenure / cohesion quintiles,
the young-and-new cell, the tenured-and-cohesive corner, preseason KenPom bands, both-team KenPom grids) and grade them on the
OTHER markets: full-game TOTAL, first-half TOTAL, first-half SPREAD.
Conventions: tot_resid / h1_tot_resid = actual minus T-60 line (>0 = OVER won); h1_ats_pts = team's 1H cover amount (>0 = BACKing
the team won). Totals are graded ONCE PER GAME (a game where both teams qualify counts once). Records from the bet's side, per
season, Jan-Feb placebo, shuffle null (permute outcome within season x month), ROI at -110. Non-power = not ACC/B12/B10/SEC/BE/P12."""
import sys, numpy as np, pandas as pd
rng = np.random.default_rng(11)
B = "../bball-odds/data/parquet/"
D = pd.read_parquet("tenure_games.parquet")
# -- sanity on sign conventions --
chk = D.dropna(subset=["total_line", "tot_resid"]).head(2000)
assert np.allclose(chk.total_actual - chk.total_line, chk.tot_resid, atol=0.01), "tot_resid is not actual - line"
c1 = D.dropna(subset=["h1_total_point", "h1_tot_resid", "own_h1"]).head(2000)
assert np.allclose(c1.own_h1 + c1.opp_h1 - c1.h1_total_point, c1.h1_tot_resid, atol=0.01), "h1_tot_resid is not 1H actual - 1H line"
c2 = D.dropna(subset=["h1_spread", "h1_ats_pts"]).head(2000)
assert np.allclose(c2.own_h1 - c2.opp_h1 + c2.h1_spread, c2.h1_ats_pts, atol=0.01), "h1_ats_pts is not own margin + own 1H spread"
# -- preseason KenPom, same build as kenpom_profile.py --
ka = pd.read_parquet(B + "kenpom_archive_daily.parquet")
first = ka[ka.ArchiveDate == ka.groupby("Season").ArchiveDate.transform("min")]
mp = pd.read_parquet("../ncaab-hype/data/team_mapping.parquet").dropna(subset=["KenPom_Name"])[["KenPom_Name", "api_team_id"]]
K = first.merge(mp, left_on="TeamName", right_on="KenPom_Name")[["Season", "api_team_id", "RankAdjOE", "RankAdjDE", "AdjTempo", "RankAdjTempo", "RankAdjEM"]]
K = K.rename(columns={"Season": "season_end", "api_team_id": "teamId", "RankAdjOE": "oe_rk", "RankAdjDE": "de_rk", "AdjTempo": "tempo", "RankAdjTempo": "tempo_rk", "RankAdjEM": "em_rk"})
K["teamId"] = K.teamId.astype(int)
D = D.merge(K, on=["season_end", "teamId"], how="left").merge(K.rename(columns={"teamId": "opponentId"}).add_prefix("o_").rename(columns={"o_season_end": "season_end", "o_opponentId": "opponentId"}), on=["season_end", "opponentId"], how="left")
D["imb_rk"] = D.oe_rk - D.de_rk; D["tempo_gap"] = D.tempo - D.o_tempo
D["over"] = np.sign(D.tot_resid); D["h1_over"] = np.sign(D.h1_tot_resid); D["h1_back"] = np.sign(D.h1_ats_pts); D["back"] = np.sign(D.win_ats)
D["dog7"] = D.spread >= 7; D["fav7"] = D.spread <= -7
D["young_new"] = (D.q_upper_share == 1) & (D.core_share == 0) & D.small
D["tenured_cohesive"] = (D.q_upper_share == 5) & (D.q_core_share == 5) & D.small
D["o_young_new"] = (D.o_upper_share <= D.groupby("season_end").upper_share.transform(lambda s: s[D.loc[s.index, "q_upper_share"] == 1].max())) & (D.o_core_share == 0)
MK = {"FG TOTAL": ("over", "OVER", "UNDER", True), "1H TOTAL": ("h1_over", "OVER", "UNDER", True), "1H SPREAD": ("h1_back", "BACK", "FADE", False),
      "FG SPREAD (yesterday, reference)": ("back", "BACK", "FADE", False)}
def games(s, per_game):
    return s.drop_duplicates("cbbd_id") if per_game else s
def shuffle_p(mask, x, col, per_game, n=600):
    base = games(x, per_game).dropna(subset=[col]); 
    if per_game: m = base.cbbd_id.isin(x.loc[mask, "cbbd_id"]).values
    else: m = mask.reindex(base.index).fillna(False).values
    vals = base[col].values; obs = vals[m].sum()
    codes = pd.factorize(base.season_end.astype(str) + "_" + base.mon.astype(str))[0]; order = np.argsort(codes, kind="stable")
    groups = np.split(order, np.flatnonzero(np.diff(codes[order])) + 1); sims = np.empty(n)
    for i in range(n):
        perm = np.empty_like(vals)
        for idx in groups: perm[idx] = vals[rng.permutation(idx)]
        sims[i] = perm[m].sum()
    return float((np.abs(sims) >= abs(obs)).mean())
def line(mask, label, x, mkt, shuffle=False, placebo=None, min_n=40):
    col, pos, neg, per_game = MK[mkt]
    s = games(x[mask].dropna(subset=[col]), per_game)
    if len(s) < min_n: print(f"   {label:<60} n={len(s)} thin"); return
    w = int((s[col] > 0).sum()); l = int((s[col] < 0).sum()); pct = 100 * w / (w + l)
    side, sw, sl = (pos, w, l) if w >= l else (neg, l, w)      # report from the winning side
    roi = 100 * (sw * 100 / 110 - sl) / (sw + sl)
    per = " ".join(f"{str(y)[2:]}:{int((g[col]>0).sum())}-{int((g[col]<0).sum())}" for y, g in s.groupby("season_end"))
    ex = f" | shuffle p {shuffle_p(mask, x, col, per_game):.3f}" if shuffle else ""
    if placebo is not None:
        p = games(x[placebo].dropna(subset=[col]), per_game); pw = int((p[col] > 0).sum()); pl = int((p[col] < 0).sum())
        ex += f" | Jan-Feb {pos} {pw}-{pl} ({100*pw/max(1,pw+pl):.1f}%)"
    extra = f" line {s.total_line.mean():.1f}" if mkt == "FG TOTAL" else (f" 1H line {s.h1_total_point.mean():.1f}" if mkt == "1H TOTAL" else f" spr {s.spread.mean():+.1f}")
    print(f"   {label:<60} {side} {sw}-{sl} ({100*sw/(sw+sl):.1f}%, ROI {roi:+.1f}%) [{pos} {pct:.1f}%]{extra} | {pos} by yr {per}{ex}")
def ladder(x, col, bins, labels, title, win, placebo_win, mkt, q=False):
    print(f"\n   {title}")
    b = pd.qcut(x[col].rank(method="first"), bins, labels=labels) if q else pd.cut(x[col], bins, labels=labels)
    for lab in labels: line(win & (b == lab), f"  {lab}", x, mkt, placebo=placebo_win & (b == lab))
S = D[D.small].copy(); nd = S.novdec; e10 = S.early10; jf = S.janfeb
Q = ["Q1 (lowest)", "Q2", "Q3", "Q4", "Q5 (highest)"]
for mkt in MK:
    col = MK[mkt][0]
    print("\n" + "#" * 110 + f"\n#  MARKET: {mkt}   (rows with a line: {S[col].notna().sum():,} team-games; non-power only)\n" + "#" * 110)
    print(f"\n=== A. {mkt}: TENURE / COHESION quintiles (within-season, D1 teams), non-power, Nov-Dec. Placebo = Jan-Feb ===")
    for qc, nm in [("q_upper_share", "Jr/Sr minutes share"), ("q_core_share", "3rd+-year-at-school minutes share"), ("q_avg_exp", "avg prior D1 seasons"),
                   ("q_avg_here", "avg prior seasons at THIS school"), ("q_pair_core", "pairwise shared-years cohesion"), ("q_fresh_share", "freshman minutes share")]:
        print(f"\n   {nm}")
        for k in range(1, 6): line(nd & (S[qc] == k), f"  {Q[k-1]}", S, mkt, placebo=jf & (S[qc] == k))
    print(f"\n   opponent-relative: own Jr/Sr share minus opponent's (gap), Nov-Dec")
    ladder(S, "upper_share_gap", [-1.01, -0.3, -0.1, 0.1, 0.3, 1.01], ["much younger (-.3)", "younger", "even", "older", "much older (+.3)"], "", nd, jf, mkt)
    print(f"\n   both teams' Jr/Sr quintile, Nov-Dec (totals angle: two young teams vs two old teams)")
    oq = S.groupby("season_end").o_upper_share.transform(lambda s: pd.qcut(s.rank(method="first"), 5, labels=[1, 2, 3, 4, 5]).astype(int))
    for a, bq, lab in [((1, 2), (1, 2), "both young (Q1-2 vs Q1-2)"), ((4, 5), (4, 5), "both old (Q4-5 vs Q4-5)"), ((1, 2), (4, 5), "young vs old"), ((4, 5), (1, 2), "old vs young")]:
        line(nd & S.q_upper_share.isin(a) & oq.isin(bq), f"  {lab}", S, mkt, shuffle=True, placebo=jf & S.q_upper_share.isin(a) & oq.isin(bq))
    print(f"\n=== B. {mkt}: the two CORNERS from yesterday, Nov-Dec ===")
    line(nd & S.young_new, "young-and-new cell (Q1 Jr/Sr, zero 3rd-yr minutes)", S, mkt, shuffle=True, placebo=jf & S.young_new)
    line(nd & S.young_new & S.dog7, "  ... as dog of 7+", S, mkt, shuffle=True, placebo=jf & S.young_new & S.dog7)
    line(nd & S.young_new & S.dog7 & (S.o_em_rk > 50), "  ... dog of 7+ vs opponent outside KenPom top 50", S, mkt, shuffle=True)
    line(nd & S.young_new & S.dog7 & (S.o_em_rk <= 50), "  ... dog of 7+ vs top-50 opponent", S, mkt, shuffle=True)
    line(nd & S.young_new & (S.spread.abs() < 7), "  ... inside 7 either way", S, mkt, shuffle=True)
    line(e10 & S.young_new, "  ... first 10 games (instead of Nov-Dec)", S, mkt, shuffle=True)
    line(nd & S.young_new & S.low, "  ... low-major only", S, mkt, shuffle=True); line(nd & S.young_new & ~S.low, "  ... mid-major only", S, mkt, shuffle=True)
    line(nd & S.tenured_cohesive, "tenured-and-cohesive corner (Q5 Jr/Sr AND Q5 3rd-yr share)", S, mkt, shuffle=True, placebo=jf & S.tenured_cohesive)
    line(nd & S.tenured_cohesive & S.fav7, "  ... as favorite of 7+", S, mkt, shuffle=True); line(nd & S.tenured_cohesive & S.dog7, "  ... as dog of 7+", S, mkt, shuffle=True)
    line(nd & S.tenured_cohesive & (S.spread.abs() < 7), "  ... inside 7 either way", S, mkt, shuffle=True)
    line(e10 & S.tenured_cohesive, "  ... first 10 games", S, mkt, shuffle=True)
    line(nd & (S.q_avg_here == 5), "most-seasons-at-this-school quintile (Q5 avg_here)", S, mkt, shuffle=True, placebo=jf & (S.q_avg_here == 5))
    line(nd & (S.q_pair_core == 5), "most pairwise-cohesive quintile (Q5 pair_core)", S, mkt, shuffle=True, placebo=jf & (S.q_pair_core == 5))
    print(f"\n=== C. {mkt}: PRESEASON KenPom bands, non-power, Nov-Dec (own team) ===")
    RB = [0, 50, 100, 150, 200, 250, 300, 400]; RL = ["1-50", "51-100", "101-150", "151-200", "201-250", "251-300", "301+"]
    ladder(S, "oe_rk", RB, RL, "adjusted OFFENSE rank", nd, jf, mkt); ladder(S, "de_rk", RB, RL, "adjusted DEFENSE rank", nd, jf, mkt)
    ladder(S, "tempo_rk", RB, RL, "TEMPO rank (1 = fastest)", nd, jf, mkt); ladder(S, "em_rk", RB, RL, "OVERALL rank", nd, jf, mkt)
    ladder(S, "imb_rk", [-400, -150, -75, -25, 25, 75, 150, 400], ["offense-led 150+", "offense-led 75-150", "offense-led 25-75", "balanced", "defense-led 25-75", "defense-led 75-150", "defense-led 150+"], "OFFENSE rank minus DEFENSE rank", nd, jf, mkt)
    print(f"\n   rated non-power FAVORITE of 7+ (yesterday's sub-vig fade on the FG spread)")
    line(nd & (S.em_rk <= 100) & S.fav7, "  overall top 100, favorite 7+", S, mkt, shuffle=True, placebo=jf & (S.em_rk <= 100) & S.fav7)
    line(nd & (S.oe_rk <= 100) & S.fav7, "  offense top 100, favorite 7+", S, mkt, shuffle=True); line(nd & (S.de_rk <= 100) & S.fav7, "  defense top 100, favorite 7+", S, mkt, shuffle=True)
    line(nd & (S.em_rk > 200) & S.dog7, "  overall 200+, dog of 7+", S, mkt, shuffle=True, placebo=jf & (S.em_rk > 200) & S.dog7)
    print(f"\n=== D. {mkt}: BOTH TEAMS' preseason KenPom (own x opponent), non-power own team, Nov-Dec ===")
    band = lambda r: pd.cut(r, [0, 100, 225, 400], labels=["good 1-100", "mid 101-225", "bad 226+"])
    def grid(rcol, ccol, title):
        print(f"\n   {title}  (rows = own, cols = opponent; cell = winning side, record, {MK[mkt][1]} %)")
        rb, cb = band(S[rcol]), band(S[ccol]); col_, pos, neg, pg = MK[mkt]
        print(f"   {'':<14}" + "".join(f"{c:>30}" for c in cb.cat.categories))
        for r in rb.cat.categories:
            row = f"   {r:<14}"
            for c in cb.cat.categories:
                s = games(S[nd & (rb == r) & (cb == c)].dropna(subset=[col_]), pg); w = int((s[col_] > 0).sum()); l = int((s[col_] < 0).sum())
                if w + l < 40: row += f"{'thin':>30}"; continue
                side, sw, sl = (pos, w, l) if w >= l else (neg, l, w)
                row += f"{f'{side} {sw}-{sl} ({100*sw/(sw+sl):.1f}%)':>30}"
            print(row)
    grid("tempo_rk", "o_tempo_rk", "TEMPO x TEMPO (1-100 = fast)"); grid("oe_rk", "o_de_rk", "own OFFENSE x opp DEFENSE"); grid("de_rk", "o_oe_rk", "own DEFENSE x opp OFFENSE"); grid("em_rk", "o_em_rk", "OVERALL x OVERALL")
    print(f"\n   tempo gap (own minus opponent, possessions)")
    ladder(S, "tempo_gap", [-30, -6, -2, 2, 6, 30], ["much slower", "slower", "even", "faster", "much faster"], "", nd, jf, mkt)
    line(nd & (S.tempo_rk <= 100) & (S.o_tempo_rk <= 100), "both fast (both tempo top 100)", S, mkt, shuffle=True, placebo=jf & (S.tempo_rk <= 100) & (S.o_tempo_rk <= 100))
    line(nd & (S.tempo_rk >= 250) & (S.o_tempo_rk >= 250), "both slow (both tempo 250+)", S, mkt, shuffle=True, placebo=jf & (S.tempo_rk >= 250) & (S.o_tempo_rk >= 250))
    line(nd & (S.oe_rk <= 100) & (S.o_oe_rk <= 100), "both good offenses (top 100)", S, mkt, shuffle=True, placebo=jf & (S.oe_rk <= 100) & (S.o_oe_rk <= 100))
    line(nd & (S.de_rk <= 100) & (S.o_de_rk <= 100), "both good defenses (top 100)", S, mkt, shuffle=True, placebo=jf & (S.de_rk <= 100) & (S.o_de_rk <= 100))
    line(nd & (S.oe_rk >= 250) & (S.o_oe_rk >= 250), "both bad offenses (250+)", S, mkt, shuffle=True, placebo=jf & (S.oe_rk >= 250) & (S.o_oe_rk >= 250))
    line(nd & (S.de_rk >= 250) & (S.o_de_rk >= 250), "both bad defenses (250+)", S, mkt, shuffle=True, placebo=jf & (S.de_rk >= 250) & (S.o_de_rk >= 250))
    print(f"\n=== E. {mkt}: young-and-new cell x KenPom, Nov-Dec ===")
    C = S[S.young_new]; cnd = C.novdec
    line(cnd & (C.tempo_rk <= 100), "cell, own tempo fast (top 100)", C, mkt, shuffle=True); line(cnd & (C.tempo_rk >= 250), "cell, own tempo slow (250+)", C, mkt, shuffle=True)
    line(cnd & (C.o_tempo_rk <= 100), "cell vs fast opponent", C, mkt, shuffle=True); line(cnd & (C.o_tempo_rk >= 250), "cell vs slow opponent", C, mkt, shuffle=True)
    line(cnd & (C.o_oe_rk <= 50), "cell vs elite offense (top 50)", C, mkt, shuffle=True); line(cnd & (C.o_de_rk <= 50), "cell vs elite defense (top 50)", C, mkt, shuffle=True)
    line(cnd & (C.imb_rk <= -40), "cell, offense-led team", C, mkt, shuffle=True); line(cnd & (C.imb_rk >= 40), "cell, defense-led team", C, mkt, shuffle=True)
print("\n=== F. 1H vs FG agreement check: when the young-and-new cell covers FG as a dog of 7+, how often did it cover 1H? ===")
s = S[nd & S.young_new & S.dog7].dropna(subset=["h1_ats_pts"]); ct = pd.crosstab(np.sign(s.win_ats), np.sign(s.h1_ats_pts)); print(ct)
