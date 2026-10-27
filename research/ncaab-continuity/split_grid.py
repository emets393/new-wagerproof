#!/usr/bin/env python3
"""Owner follow-up 2026-10-27: split every early-season continuity / new-coach rule by conference size, AP ranked vs unranked,
and KenPom PRESEASON quintiles (own, opponent, gap). Windows: first 10 games and Nov-Dec. Shuffle null + Jan-Feb placebo per cell.
Writes SPLIT_GRID.csv (every cell) and prints the cells that clear n>=150 and shuffle p<.05, then the full ladder per split."""
import numpy as np, pandas as pd, importlib.util, io, contextlib
spec = importlib.util.spec_from_file_location("cs", "continuity_study.py"); cs = importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(cs)
D = cs.D.copy(); rng = np.random.default_rng(11)
POWER = {"ACC", "Big 12", "Big Ten", "SEC", "Big East", "Pac-12"}
MID = {"American Athletic", "Mountain West", "Atlantic 10", "West Coast", "Missouri Valley", "Conference USA", "Mid-American", "Sun Belt", "Big West", "WAC", "Ivy", "Colonial", "Horizon", "MAAC", "Summit", "Southern", "Big Sky", "Ohio Valley", "CAA", "Atlantic Sun", "ASUN", "America East", "Patriot", "Big South", "Southland", "Northeast", "MEAC", "SWAC", "Metro Atlantic"}
def csize(c):
    if c in POWER: return "power"
    if c in {"American Athletic", "Mountain West", "Atlantic 10", "West Coast", "Missouri Valley", "Conference USA", "Mid-American", "Sun Belt"}: return "mid-major"
    return "low-major"
D["csize"] = D.conference.map(csize); D["o_csize"] = D.opponentConference.map(csize)
# preseason KenPom = the as-of rating at the team's FIRST priced game of the season
first = D.sort_values("date").groupby(["season_end", "teamId"]).own_kp_em.first().rename("kp_pre").reset_index()
D = D.merge(first, on=["season_end", "teamId"]).merge(first.rename(columns={"teamId": "opponentId", "kp_pre": "o_kp_pre"}), on=["season_end", "opponentId"], how="left")
D["kp_q"] = D.groupby("season_end").kp_pre.transform(lambda s: pd.qcut(s.rank(method="first"), 5, labels=["Q1 worst", "Q2", "Q3", "Q4", "Q5 best"]))
D["o_kp_q"] = D.groupby("season_end").o_kp_pre.transform(lambda s: pd.qcut(s.rank(method="first"), 5, labels=["Q1 worst", "Q2", "Q3", "Q4", "Q5 best"]))
D["kp_gap"] = D.kp_pre - D.o_kp_pre
D["gap_b"] = pd.cut(D.kp_gap, [-99, -15, -5, 5, 15, 99], labels=["much worse", "worse", "even", "better", "much better"])
D["ranked"] = D.ap_rank.notna(); D["o_ranked"] = D.o_ap_rank.notna()
D["rank_sit"] = np.select([D.ranked & ~D.o_ranked, ~D.ranked & D.o_ranked, D.ranked & D.o_ranked], ["ranked vs unranked", "unranked vs ranked", "both ranked"], "neither ranked")
lo = D.ret_min <= 0.30; hi = D.ret_min >= 0.70
RULES = {
    "kept 70%+ minutes": hi, "rebuilt (<=30% kept)": lo, "continuity gap +35 vs opp": D.ret_diff >= 0.35, "continuity gap -35 vs opp": D.ret_diff <= -0.35,
    "4-5 starters back": D.starters_back >= 4, "0-1 starters back": D.starters_back <= 1, "3+ more starters back than opp": D.sb_diff >= 3,
    "leading scorer back, opp's gone": (D.top_back == 1) & (D.o_top_back == 0), "6+ transfers in": D.xfer_in >= 6, "new players 60%+ of minutes": D.new_share >= 0.6,
    "new head coach": D.new_coach, "new coach + rebuilt": D.new_coach & lo, "new coach + rebuilt, underdog": D.new_coach & lo & (D.spread > 0),
}
SPLITS = {"conference size": "csize", "opp conference size": "o_csize", "AP rank situation": "rank_sit", "KenPom preseason quintile": "kp_q", "opp KenPom quintile": "o_kp_q", "KenPom gap vs opp": "gap_b"}
WIN = {"first 10": D.early10, "Nov-Dec": D.novdec}
codes = pd.factorize(D.season_end.astype(str) + "_" + D.mon.astype(str))[0]; vals = D.win_ats.values
groups = [np.where(codes == c)[0] for c in np.unique(codes)]
def shuffle_p(m, n=1000):
    obs = vals[m].sum(); sims = np.empty(n)
    for i in range(n):
        perm = np.empty_like(vals)
        for idx in groups: perm[idx] = vals[rng.permutation(idx)]
        sims[i] = perm[m].sum()
    return float((np.abs(sims) >= abs(obs)).mean())
rows = []
for rname, rm in RULES.items():
    for wname, wm in WIN.items():
        for sname, scol in SPLITS.items():
            for lev in [l for l in D[scol].dropna().unique()]:
                m = (rm & wm & (D[scol] == lev)).values
                n = int(m.sum())
                if n < 150: continue
                w, l = int((vals[m] > 0).sum()), int((vals[m] < 0).sum())
                side = "BACK" if w >= l else "FADE"; w2, l2 = (w, l) if w >= l else (l, w)
                pm = (rm & D.janfeb & (D[scol] == lev)).values; pw, pl = int((vals[pm] > 0).sum()), int((vals[pm] < 0).sum())
                pwin = pw if side == "BACK" else pl; plos = pl if side == "BACK" else pw
                per = {y: (int((vals[m & (D.season_end == y).values] > 0).sum()), int((vals[m & (D.season_end == y).values] < 0).sum())) for y in sorted(D.season_end.unique())}
                per_s = " ".join(f"{str(y)[2:]}:{a if side=='BACK' else b}-{b if side=='BACK' else a}" for y, (a, b) in per.items() if a + b)
                nwin = sum(1 for a, b in per.values() if (a > b if side == "BACK" else b > a))
                rows.append(dict(rule=rname, window=wname, split=sname, level=str(lev), n=n, side=side, w=w2, l=l2, pct=round(100 * w2 / max(1, w2 + l2), 1),
                                 z=round((w2 - l2) / np.sqrt(max(1, w2 + l2)), 2), p=shuffle_p(m), placebo=f"{pwin}-{plos}", placebo_pct=round(100 * pwin / max(1, pwin + plos), 1),
                                 seasons_winning=f"{nwin}/{sum(1 for a,b in per.values() if a+b)}", per_season=per_s, spread=round(float(D.spread.values[m].mean()), 1)))
G = pd.DataFrame(rows); G.to_csv("SPLIT_GRID.csv", index=False)
print(f"{len(G)} cells with n>=150 (13 rules x 2 windows x 6 splits). Expected false positives at p<.05: ~{len(G)*0.05:.0f}.\n")
hits = G[(G.p < 0.05)].sort_values("z", ascending=False)
print(f"=== {len(hits)} cells with shuffle p < .05 ===")
pd.set_option("display.width", 250); pd.set_option("display.max_colwidth", 60)
print(hits[["rule", "window", "split", "level", "side", "w", "l", "pct", "p", "placebo", "placebo_pct", "seasons_winning", "per_season"]].to_string(index=False))
print("\n=== cells that ALSO have the placebo on the same side <= 50.5% (market has not learned it) and 4+/5 seasons ===")
good = hits[(hits.placebo_pct <= 50.5) & hits.seasons_winning.str.startswith(("4", "5"))]
print(good[["rule", "window", "split", "level", "side", "w", "l", "pct", "p", "placebo", "seasons_winning", "spread"]].to_string(index=False))
print("\n=== full ladders, first 10 games, BACK % (so a number under 50 is a fade) ===")
for rname in ["kept 70%+ minutes", "rebuilt (<=30% kept)", "4-5 starters back", "0-1 starters back", "new head coach", "new coach + rebuilt"]:
    sub = G[(G.rule == rname) & (G.window == "first 10")]
    print(f"\n {rname}")
    for sname in SPLITS:
        s = sub[sub.split == sname]
        if not len(s): continue
        print(f"   {sname:<26}", " | ".join(f"{r.level}: {(r.pct if r.side=='BACK' else 100-r.pct):.1f}% n={r.n}" for r in s.itertuples()))
