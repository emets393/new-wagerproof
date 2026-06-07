"""
RECURRING-MATCHUP / SERIES history trends. For each game, link the PRIOR meeting of the same two teams.
Test: revenge ATS (lost last -> cover now?), blowout-revenge (lost by 21+), keep-losing (SU), winner regression,
the specific 'beaten by 21+ by a ranked opp last time -> avenge now', coach-dependence, and TOTAL persistence
(do specific matchups stay high/low scoring; do rivalry games go under/over). Graded @ close, holdout-disciplined.
NOTE: revenge is a WATCHED narrative -> expect priced; totals/style persistence is the less-watched angle.
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
gm = gm[gm.spread_close.notna() & gm.actual_margin.notna() & gm.actual_total.notna() & gm.date.notna()].copy()
gm["dt"] = pd.to_datetime(gm.date, errors="coerce")
gm = gm.sort_values("dt")
gm["pair"] = [tuple(sorted([h, a])) for h, a in zip(gm.homeTeam, gm.awayTeam)]
TS = sorted(gm.season.unique())
HOLD = [2021, 2022, 2023, 2024, 2025]
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0
def per(b, w): return "/".join(f"{100*w[b.season==s].mean():.0f}" if (b.season==s).sum()>=6 else "--" for s in HOLD)

# coaches (primary per team-season)
co = pd.read_parquet(os.path.join(HERE, "data", "cfbd", "coaches.parquet")); co["g"] = co.wins + co.losses
prim = co.sort_values("g").drop_duplicates(["school", "season"], keep="last").set_index(["school", "season"]).coach

# prior meeting linkage
gm = gm.reset_index(drop=True)
prior_idx = {}
last_seen = {}
for i, r in gm.iterrows():
    p = r.pair
    if p in last_seen: prior_idx[i] = last_seen[p]
    last_seen[p] = i
rows = []
for i, r in gm.iterrows():
    if i not in prior_idx: continue
    pj = gm.loc[prior_idx[i]]
    if r.season - pj.season > 2 or r.season == pj.season: continue   # recurring (annual-ish), diff season
    # prior result from CURRENT home team's perspective
    if pj.homeTeam == r.homeTeam: prior_margin_home = pj.actual_margin; prior_home_was_home = True
    else: prior_margin_home = -pj.actual_margin; prior_home_was_home = False
    # was the team that WON last time ranked & away (for the specific cut)?
    prior_winner_away_ranked = (pj.away_self_rank_is == 1) and (pj.actual_margin < 0)  # away won & ranked
    rows.append({"season": r.season, "game_id": r.game_id, "homeTeam": r.homeTeam, "awayTeam": r.awayTeam,
                 "spread_close": r.spread_close, "actual_margin": r.actual_margin, "actual_total": r.actual_total,
                 "total_close": r.total_close, "prior_margin_home": prior_margin_home, "prior_total": pj.actual_total,
                 "prior_winner_away_ranked": prior_winner_away_ranked, "yrs_ago": r.season - pj.season,
                 "h_coach": prim.get((r.homeTeam, r.season)), "h_coach_prior": prim.get((r.homeTeam, pj.season)),
                 "is_riv": False})
M = pd.DataFrame(rows)
# rivalry flag
try:
    import rivalry_spots as RIV
    rivset = {frozenset(p) for p in RIV.RIVALRIES}
    M["is_riv"] = [frozenset((h, a)) in rivset for h, a in zip(M.homeTeam, M.awayTeam)]
except Exception: pass
M["home_cover"] = (M.actual_margin + M.spread_close) > 0
M = M[(M.actual_margin + M.spread_close) != 0]
M["over"] = M.actual_total > M.total_close
M = M[M.actual_total != M.total_close]
M["home_lost_last"] = M.prior_margin_home < 0
M["home_blowout_loss_last"] = M.prior_margin_home <= -21
M["same_coach"] = (M.h_coach == M.h_coach_prior) & M.h_coach.notna()
print(f"recurring-matchup games (prior meeting within 2yr): {len(M)} | rivalry: {M.is_riv.sum()}\n")

def t(label, mask, col, side=True):  # side True=as-is(cover/over), measures home_cover or over
    b = M[mask]
    if len(b) < 30: print(f"  {label:<44} n={len(b)} (thin)"); return
    w = b[col] if side else (~b[col]);
    hold = b[b.season >= 2021]; wh = (hold[col] if side else ~hold[col])
    print(f"  {label:<44} n={len(b):<4} {100*w.mean():4.1f}% | 2021-25 {100*wh.mean():.1f}% roi{roi(int(w.sum()),len(b)):+.1f} [{per(b,w)}]")

print("=== REVENGE ATS (home team's perspective) ===")
t("home LOST last mtg -> home cover (revenge)", M.home_lost_last, "home_cover")
t("home WON last mtg -> home cover (stay hot?)", ~M.home_lost_last, "home_cover")
t("home BLOWN OUT last (>=21) -> home cover", M.home_blowout_loss_last, "home_cover")
t("home blown out by RANKED-away last -> cover (AVENGE)", M.home_blowout_loss_last & M.prior_winner_away_ranked, "home_cover")
print("\n=== keep-losing (SU) ===")
M["home_won_su"] = M.actual_margin > 0
t("home lost last -> home WIN SU now", M.home_lost_last, "home_won_su")
print("\n=== COACH dependence (revenge w/ same coach vs changed) ===")
t("home lost last & SAME coach -> cover", M.home_lost_last & M.same_coach, "home_cover")
t("home lost last & coach CHANGED -> cover", M.home_lost_last & ~M.same_coach, "home_cover")
print("\n=== TOTALS: series/style persistence (less-watched angle) ===")
t("RIVALRY games -> OVER", M.is_riv, "over")
t("RIVALRY games -> UNDER", M.is_riv, "over", side=False)
M["prior_over_hi"] = M.prior_total >= M.prior_total.median()
t("prior mtg was HIGH-scoring -> OVER now", M.prior_over_hi, "over")
t("prior mtg was LOW-scoring -> UNDER now", ~M.prior_over_hi, "over", side=False)
# prior total vs current line
M["prior_vs_line"] = M.prior_total - M.total_close
t("prior total >> current line (+10) -> OVER", M.prior_vs_line >= 10, "over")
t("prior total << current line (-10) -> UNDER", M.prior_vs_line <= -10, "over", side=False)
