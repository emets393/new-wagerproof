#!/usr/bin/env python3
"""NCAAB early-season roster-continuity + new-coach signals vs the T-60 close (owner ask 2026-10-27).

The owner's theory: who came back (returning minutes, starters back, star back), who is new (transfers, freshmen) and a
new head coach are preseason facts the public does not price, especially at small schools, so the first games of the
season should carry an edge the way the CFB early-roster signals do.

Data (research/bball-odds caches): cbbd_player_box (minutes per player-game, athleteSourceId = the stable id),
cbb_sit_panel (one row per team-game: T-60 spread, ats_pts, coach, coach_yr, gnum, conference, KenPom as-of).

Roster for season S = players who appear in the team's box in its first 10 games of S (the NBA study's definition;
who is on the roster is known preseason). Prior-season production = minutes / points / gameScore in S-1 at ANY team.
  ret_min   share of the team's S-1 minutes played by players on the S roster
  ret_pts   same for points
  starters_back  number of S-1 regular starters (started >= half of S-1 games, team) on the S roster
  top_back  S-1 leading scorer (team) on the S roster
  new_share share of S roster-minutes (first 10 games) by players with zero S-1 minutes at this team
  xfer_in   players on the S roster with S-1 minutes at a DIFFERENT team (>= 200 min)
  coach_yr  1 = first season under this head coach (sports-reference)

Grading: every rule is a team-side bet vs the T-60 spread; records from the winning side, wins first; per season;
shuffle null = permute the trigger within (season, window) 2,000x; Jan-Feb placebo for every early rule.
Run: /usr/bin/python3 continuity_study.py  (pandas 1.5 env) -> CONTINUITY_RUN.txt
"""
import sys, numpy as np, pandas as pd
rng = np.random.default_rng(7)
B = "../bball-odds/data/parquet/"
pb = pd.read_parquet(B + "cbbd_player_box.parquet", columns=["gameId", "season", "startDate", "teamId", "athleteSourceId", "name", "starter", "minutes", "points", "gameScore"])
pb = pb.dropna(subset=["athleteSourceId"]); pb["pid"] = pb.athleteSourceId.astype("int64")
pb["startDate"] = pd.to_datetime(pb.startDate, utc=True)
P = pd.read_parquet(B + "cbb_sit_panel.parquet")
P = P[P.spread.notna() & P.ats_pts.notna()].copy()
P["season_end"] = P.season.str[:4].astype(int) + 1
P["date"] = pd.to_datetime(P.startDate, utc=True)
P["team_gnum"] = P.sort_values("date").groupby(["season_end", "teamId"]).cumcount() + 1    # includes unpriced? no -- priced games only; use gnum from panel when present
P["gn"] = P.gnum.fillna(P.team_gnum)

# ---------------------------------------------------------------- roster + prior-season production per team-season
pb = pb.sort_values("startDate")
pb["team_gidx"] = pb.groupby(["season", "teamId"]).gameId.transform(lambda s: pd.factorize(s)[0] + 1)
roster = pb[pb.team_gidx <= 10].groupby(["season", "teamId", "pid"]).minutes.sum().reset_index().rename(columns={"minutes": "early_min"})
prior = pb.groupby(["season", "teamId", "pid"]).agg(min_prev=("minutes", "sum"), pts_prev=("points", "sum"), gs_prev=("gameScore", "sum"),
                                                   starts_prev=("starter", "sum"), games_prev=("gameId", "nunique")).reset_index()
prior["season"] = prior.season + 1                                       # align S-1 production to season S
team_prev = prior.groupby(["season", "teamId"]).agg(team_min_prev=("min_prev", "sum"), team_pts_prev=("pts_prev", "sum"), team_games_prev=("games_prev", "max")).reset_index()
# S-1 production of the roster AT THIS TEAM
r = roster.merge(prior, on=["season", "teamId", "pid"], how="left").merge(team_prev, on=["season", "teamId"], how="left")
r["min_prev"] = r.min_prev.fillna(0); r["pts_prev"] = r.pts_prev.fillna(0); r["starts_prev"] = r.starts_prev.fillna(0)
r["starter_prev"] = r.starts_prev >= 0.5 * r.team_games_prev
top = prior.sort_values("pts_prev", ascending=False).drop_duplicates(["season", "teamId"])[["season", "teamId", "pid"]].rename(columns={"pid": "top_pid"})
# S-1 minutes anywhere (transfers): prior at any team, keyed by pid+season
any_prev = prior.groupby(["season", "pid"]).agg(min_any=("min_prev", "sum"), teams_any=("teamId", "nunique")).reset_index()
r = r.merge(any_prev, on=["season", "pid"], how="left"); r["min_any"] = r.min_any.fillna(0)
r["xfer_in"] = (r.min_prev == 0) & (r.min_any >= 200)
r["fresh"] = r.min_any == 0
TS = r.groupby(["season", "teamId"]).apply(lambda g: pd.Series(dict(
    ret_min=g.min_prev.sum() / g.team_min_prev.max() if g.team_min_prev.max() > 0 else np.nan,
    ret_pts=g.pts_prev.sum() / g.team_pts_prev.max() if g.team_pts_prev.max() > 0 else np.nan,
    starters_back=int(g.starter_prev.sum()), xfer_in=int(g.xfer_in.sum()), n_fresh=int(g.fresh.sum()),
    new_share=g.early_min[g.min_prev == 0].sum() / g.early_min.sum() if g.early_min.sum() > 0 else np.nan,
    xfer_min_share=g.early_min[g.xfer_in].sum() / g.early_min.sum() if g.early_min.sum() > 0 else np.nan,
    n_roster=len(g)))).reset_index()
TS = TS.merge(top, on=["season", "teamId"], how="left").merge(roster[["season", "teamId", "pid"]], left_on=["season", "teamId", "top_pid"], right_on=["season", "teamId", "pid"], how="left")
TS["top_back"] = TS.pid.notna().astype(int); TS = TS.drop(columns=["pid", "top_pid"])
TS = TS[TS.season >= 2022]                                              # 2021 has no prior season in the cache
print(f"team-seasons with continuity: {len(TS):,}; ret_min mean {TS.ret_min.mean():.2f} sd {TS.ret_min.std():.2f}; starters_back dist {TS.starters_back.value_counts().sort_index().to_dict()}")
print(f"xfer_in mean {TS.xfer_in.mean():.1f}; new_share mean {TS.new_share.mean():.2f}; top_back {TS.top_back.mean():.2f}")

# ---------------------------------------------------------------- attach to team-games (own + opponent)
D = P.merge(TS.rename(columns={"season": "season_end"}), on=["season_end", "teamId"], how="left")
opp = TS.rename(columns={"season": "season_end", "teamId": "opponentId"}).add_prefix("o_").rename(columns={"o_season_end": "season_end", "o_opponentId": "opponentId"})
D = D.merge(opp, on=["season_end", "opponentId"], how="left")
D = D[D.ret_min.notna() & D.o_ret_min.notna()].copy()
D["ret_diff"] = D.ret_min - D.o_ret_min; D["sb_diff"] = D.starters_back - D.o_starters_back
D["new_coach"] = D.coach_yr == 1; D["o_new_coach"] = D.o_coach.notna() & False   # opponent coach year not in panel; own side only
# conference tier by season mean KenPom of the conference (own_kp_em as-of; preseason approx = season mean)
ck = D.groupby(["season_end", "conference"]).own_kp_em.mean().reset_index().rename(columns={"own_kp_em": "conf_em"})
ck["tier"] = ck.groupby("season_end").conf_em.transform(lambda s: pd.qcut(s.rank(method="first"), 3, labels=["low", "mid", "high"]))
D = D.merge(ck[["season_end", "conference", "tier"]], on=["season_end", "conference"], how="left")
D["win_ats"] = np.sign(D.ats_pts)
D["mon"] = D.date.dt.month
D["early5"] = D.gn <= 5; D["early10"] = D.gn <= 10; D["nov"] = D.mon == 11; D["novdec"] = D.mon.isin([11, 12]); D["janfeb"] = D.mon.isin([1, 2])
print(f"team-games graded: {len(D):,} across {D.season_end.nunique()} seasons {sorted(D.season_end.unique())}")

def rec(x):
    w, l = int((x.win_ats > 0).sum()), int((x.win_ats < 0).sum()); return w, l
def shuffle_p(mask, x, n=2000):
    """p-value of the observed BACK record vs permuting the trigger within season x window-month."""
    obs = x.loc[mask, "win_ats"].sum(); k = int(mask.sum())
    if k < 40: return np.nan
    grp = x.season_end.astype(str) + "_" + x.mon.astype(str)
    sims = np.empty(n)
    vals = x.win_ats.values; codes = pd.factorize(grp)[0]; m = mask.values
    for i in range(n):
        perm = np.empty_like(vals)
        for c in np.unique(codes):
            idx = np.where(codes == c)[0]; perm[idx] = vals[rng.permutation(idx)]
        sims[i] = perm[m].sum()
    return float((np.abs(sims) >= abs(obs)).mean())
def ats(mask, label, x=None, placebo=None):
    x = D if x is None else x
    s = x[mask]
    if len(s) < 40: print(f"   {label:<70} n={len(s)} (thin)"); return
    w, l = rec(s); side = "BACK" if w >= l else "FADE"; w2, l2 = (w, l) if w >= l else (l, w)
    per = " ".join(f"{str(y)[2:]}:{(rec(g)[0] if side=='BACK' else rec(g)[1])}-{(rec(g)[1] if side=='BACK' else rec(g)[0])}" for y, g in s.groupby("season_end"))
    z = (w2 - l2) / np.sqrt(w2 + l2)
    p = shuffle_p(mask, x)
    pl = ""
    if placebo is not None:
        sp = x[placebo]; 
        if len(sp) >= 40:
            pw, pl_ = rec(sp); pl = f"  | Jan-Feb placebo {side} {(pw if side=='BACK' else pl_)}-{(pl_ if side=='BACK' else pw)} ({100*(pw if side=='BACK' else pl_)/(pw+pl_):.1f}%)"
    print(f"   {label:<70} {side} {w2}-{l2} ({100*w2/(w2+l2):.1f}%, z {z:+.1f}, shuffle p {p:.3f})  margin vs spread {s.ats_pts.mean():+.2f} | {per}{pl}")

print("\n=== A. IS CONTINUITY REAL AND IS IT PRICED? (team-season regression, first 10 games) ===")
ts = D[D.early10].groupby(["season_end", "teamId"]).agg(ret_min=("ret_min", "first"), sb=("starters_back", "first"), nc=("new_coach", "first"),
                                                    margin=("margin", "mean"), spread=("spread", "mean"), ats=("ats_pts", "mean"), kp=("own_kp_em", "mean"), pm=("pm_margin", "first")).reset_index()
import numpy.linalg as la
def ols(y, X, names):
    X = np.column_stack([np.ones(len(y))] + X); b = la.lstsq(X, y, rcond=None)[0]; res = y - X @ b
    se = np.sqrt(np.diag(la.inv(X.T @ X)) * res.var(ddof=X.shape[1])); return {n: (round(b[i+1], 2), round(b[i+1]/se[i+1], 1)) for i, n in enumerate(names)}
t = ts.dropna(subset=["ret_min", "margin", "spread", "pm"])
print(" realised margin first 10 ~ ret_min + prior-season margin:", ols(t.margin.values, [t.ret_min.values, t.pm.values], ["ret_min", "prior_margin"]))
print(" market (-spread) first 10 ~ ret_min + prior-season margin:", ols(-t.spread.values, [t.ret_min.values, t.pm.values], ["ret_min", "prior_margin"]))
print(" ATS margin first 10 ~ ret_min + prior-season margin:      ", ols(t.ats.values, [t.ret_min.values, t.pm.values], ["ret_min", "prior_margin"]), "  <- the gap the market leaves")
t2 = t.dropna(subset=["sb"]); print(" ATS margin first 10 ~ starters_back:", ols(t2.ats.values, [t2.sb.values], ["starters_back"]))

print("\n=== B. CONTINUITY RULES, first 10 games (all seasons 2021-22..2025-26), T-60 close ===")
hi = D.ret_min >= 0.70; lo = D.ret_min <= 0.30
for w_name, w in [("first 5 games", D.early5), ("first 10 games", D.early10), ("November", D.nov), ("Nov-Dec", D.novdec)]:
    print(f" -- window: {w_name}")
    ats(w & hi, "team kept 70%+ of last season's minutes", placebo=D.janfeb & hi)
    ats(w & lo, "team kept 30% or less of last season's minutes (rebuilt)", placebo=D.janfeb & lo)
    ats(w & hi & (D.o_ret_min <= 0.40), "kept 70%+ vs opponent that kept 40% or less", placebo=D.janfeb & hi & (D.o_ret_min <= 0.40))
    ats(w & (D.ret_diff >= 0.35), "continuity gap +35 points or more over the opponent", placebo=D.janfeb & (D.ret_diff >= 0.35))
    ats(w & (D.starters_back >= 4), "4-5 starters back", placebo=D.janfeb & (D.starters_back >= 4))
    ats(w & (D.starters_back <= 1), "0-1 starters back", placebo=D.janfeb & (D.starters_back <= 1))
    ats(w & (D.sb_diff >= 3), "3+ more returning starters than the opponent", placebo=D.janfeb & (D.sb_diff >= 3))
    ats(w & (D.top_back == 1) & (D.o_top_back == 0), "leading scorer back, opponent's gone", placebo=D.janfeb & (D.top_back == 1) & (D.o_top_back == 0))
    ats(w & (D.xfer_in >= 6), "6+ transfers in (portal rebuild)", placebo=D.janfeb & (D.xfer_in >= 6))
    ats(w & (D.xfer_min_share >= 0.5), "transfers playing 50%+ of early minutes", placebo=D.janfeb & (D.xfer_min_share >= 0.5))
    ats(w & (D.new_share >= 0.6), "new players 60%+ of early minutes", placebo=D.janfeb & (D.new_share >= 0.6))

print("\n=== C. NEW HEAD COACH (coach_yr == 1) ===")
for w_name, w in [("first 5 games", D.early5), ("first 10 games", D.early10), ("Nov-Dec", D.novdec), ("Jan-Feb", D.janfeb), ("all season", D.gn > 0)]:
    ats(w & D.new_coach, f"new head coach -- {w_name}")
for w_name, w in [("first 10 games", D.early10), ("Nov-Dec", D.novdec)]:
    ats(w & D.new_coach & hi, f"new coach + kept 70%+ minutes -- {w_name}")
    ats(w & D.new_coach & lo, f"new coach + rebuilt roster (<=30% kept) -- {w_name}")
    ats(w & D.new_coach & (D.xfer_in >= 5), f"new coach + 5+ transfers -- {w_name}")
    ats(w & D.new_coach & D.nonconf.astype(bool), f"new coach, non-conference -- {w_name}")
    ats(w & D.new_coach & (D.spread > 0), f"new coach as underdog -- {w_name}")
    ats(w & D.new_coach & (D.spread < 0), f"new coach as favorite -- {w_name}")

print("\n=== D. SMALL SCHOOLS (owner thesis: the public does not know these rosters) -- first 10 games ===")
for tier in ["low", "mid", "high"]:
    m = D.early10 & (D.tier == tier)
    print(f" -- conference tier {tier} ({int(m.sum()):,} team-games)")
    ats(m & hi, "kept 70%+ minutes", placebo=D.janfeb & (D.tier == tier) & hi)
    ats(m & lo, "rebuilt (<=30% kept)", placebo=D.janfeb & (D.tier == tier) & lo)
    ats(m & (D.ret_diff >= 0.35), "continuity gap +35 over opponent", placebo=D.janfeb & (D.tier == tier) & (D.ret_diff >= 0.35))
    ats(m & (D.starters_back >= 4), "4-5 starters back", placebo=D.janfeb & (D.tier == tier) & (D.starters_back >= 4))
    ats(m & D.new_coach, "new head coach")
    ats(m & D.new_coach & D.nonconf.astype(bool), "new head coach, non-conference")
m = D.early10 & (D.tier == "low") & (D.o_tier == "low") if "o_tier" in D else None

print("\n=== E. DOSE LADDERS, first 10 games (BACK the team; % cover) ===")
e = D[D.early10]
for col, bins in [("ret_min", [0, .2, .4, .6, .8, 1.01]), ("ret_diff", [-1.01, -.4, -.2, 0, .2, .4, 1.01]), ("starters_back", [-1, 0, 1, 2, 3, 4, 5]), ("xfer_in", [-1, 1, 3, 5, 7, 30]), ("new_share", [0, .2, .4, .6, .8, 1.01])]:
    g = e.groupby(pd.cut(e[col], bins)).apply(lambda s: f"{100*(s.win_ats>0).sum()/max(1,(s.win_ats!=0).sum()):.1f}% n={int((s.win_ats!=0).sum())} spread {s.spread.mean():+.1f}")
    print(f" {col:<14}", " | ".join(f"{k}: {v}" for k, v in g.items()))
