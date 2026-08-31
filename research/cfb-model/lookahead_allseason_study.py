"""Extension of lookahead_cupcake_study (owner, 2026-08-31): the weak-opp-before-
strong-opp spot across ALL weeks.

Discipline: the favored/dog-next split was DISCOVERED on weeks 1-3, so weeks 4+
serve as its out-of-sample replication test — that comes first. Everything after
is labeled exploratory.
Universe: seasons 2016-2025 lined+graded games, team-perspective long frame.
Trigger: AP top-20 (as-of), laying >= 14, next opponent AP-ranked (as-of).
"""
import pandas as pd

mg = pd.read_parquet("data/model_games.parquet")
mg = mg[(mg.season <= 2025) & mg.spread_close.notna() & mg.actual_margin.notna()]

rows = []
for side, opp in (("home", "away"), ("away", "home")):
    rows.append(pd.DataFrame({
        "season": mg.season, "week": mg.week, "date": mg.get("date"),
        "team": mg[f"{side}Team"], "opp": mg[f"{opp}Team"], "is_home": 1 if side == "home" else 0,
        "self_rank": mg[f"{side}_self_rank"], "self_ranked": mg[f"{side}_self_rank_is"],
        "next_ranked": mg[f"{side}_next_opp_rank_is"],
        "cur_opp_net": mg.get(f"{side}_cur_opp_net"),
        "lay_close": (-mg.spread_close) if side == "home" else mg.spread_close,
        "lay_open": (-mg.spread_open) if side == "home" else mg.spread_open,
        "margin": mg.actual_margin if side == "home" else -mg.actual_margin,
        "total_close": mg.total_close, "actual_total": mg.actual_total,
        "neutral": mg.get("neutralSite", 0),
        "conf_game": mg.get("conferenceGame", 0),
    }))
t = pd.concat(rows, ignore_index=True)
t["date"] = pd.to_datetime(t["date"], errors="coerce")
t = t.sort_values(["season", "team", "date"]).reset_index(drop=True)
grp = t.groupby(["season", "team"], group_keys=False)
t["next_lay"] = grp["lay_close"].shift(-1)
t["next_is_home"] = grp["is_home"].shift(-1)
t["next_neutral"] = grp["neutral"].shift(-1)
t["next_opp_team"] = grp["opp"].shift(-1)
rank_now = t.set_index(["season", "week", "team"]).self_rank.to_dict()

BASE = (t.self_ranked == 1) & (t.self_rank <= 20) & (t.lay_close >= 14) & (t.next_ranked == 1)

def rec(d, lay_col="lay_close"):
    w = int((d.margin > d[lay_col]).sum()); l = int((d.margin < d[lay_col]).sum())
    return w, l, (w / (w + l) * 100 if w + l else 0)

def show(name, d, seasons=False):
    if len(d) < 5:
        print(f"  {name:46s} n={len(d)} (too small)"); return
    w, l, p = rec(d)
    yr = d.assign(covd=d.margin > d.lay_close).groupby("season")["covd"].agg(["sum", "count"])
    sp = int((yr["sum"] / yr["count"] > 0.5).sum())
    ow, ol, op = rec(d[d.lay_open.notna()], "lay_open")
    print(f"  {name:46s} {w}-{l}  {p:.1f}%  ({sp}/{yr.shape[0]} seasons>50%) | open {ow}-{ol} ({op:.0f}%)")
    if seasons:
        print("     per-season:", {int(s): f"{int(r['sum'])}-{int(r['count'] - r['sum'])}" for s, r in yr.iterrows()})

print("========== 1. OUT-OF-SAMPLE REPLICATION (weeks 4+) of the wk1-3 split ==========")
late = t[BASE & (t.week >= 4)]
show("wk4+  FAVORED in next game", late[late.next_lay > 0], seasons=True)
show("wk4+  DOG in next game", late[late.next_lay < 0], seasons=True)
show("wk4+  base cell (all lookahead)", late, seasons=True)

print("\n========== 2. FULL SEASON pooled (all weeks) ==========")
allw = t[BASE]
show("all-weeks FAVORED next", allw[allw.next_lay > 0])
show("all-weeks DOG next", allw[allw.next_lay < 0])

print("\n========== 3. EXPLORATORY splits, weeks 4+ lookahead cell ==========")
show("next game HOME", late[(late.next_is_home == 1) & (late.next_neutral != 1)])
show("next game ROAD", late[(late.next_is_home == 0) & (late.next_neutral != 1)])
nr = pd.Series([rank_now.get((s, w, o)) for s, w, o in
                zip(late.season, late.week, late.next_opp_team)], index=late.index)
show("next opp ranked HIGHER than self", late[nr < late.self_rank])
show("next opp ranked LOWER than self", late[nr > late.self_rank])
show("current game IS conference game", late[late.conf_game == 1])
show("current game non-conference", late[late.conf_game != 1])
show("lay >= 21 (bigger cupcake)", late[late.lay_close >= 21])
show("lay 14-21", late[late.lay_close < 21])
show("mid-season wk4-8", late[late.week <= 8])
show("late-season wk9+", late[late.week >= 9])
u = int((late.actual_total < late.total_close).sum()); o = int((late.actual_total > late.total_close).sum())
print(f"  wk4+ lookahead UNDER rate: {u}-{o} ({u/(u+o)*100:.0f}%)")

print("\n========== 4. placebo: wk4+ unranked big favorites, ranked next ==========")
pl = t[(t.self_ranked == 0) & (t.lay_close >= 14) & (t.next_ranked == 1) & (t.week >= 4)]
show("unranked lookahead", pl)
show("unranked lookahead, DOG next", pl[pl.next_lay < 0])
show("unranked lookahead, FAVORED next", pl[pl.next_lay > 0])

print("\n========== 5. control: wk4+ top-20 big favorites, UNRANKED next ==========")
ctl = t[(t.self_ranked == 1) & (t.self_rank <= 20) & (t.lay_close >= 14)
        & (t.next_ranked == 0) & (t.week >= 4)]
show("control (no lookahead)", ctl)
show("control, DOG next", ctl[ctl.next_lay < 0])
show("control, FAVORED next", ctl[ctl.next_lay > 0])
