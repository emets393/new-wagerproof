"""Owner theory (2026-08-31): an AP-ranked team playing a cupcake in weeks 1-3
with a RANKED opponent on deck 'holds back' -> fails to cover vs the cupcake.

Pre-registered design:
  Universe   weeks 1-3, lined+graded games, 2016-2025 (model_games.parquet).
  Trigger    team AP top-20 (as-of), laying >= THRESH points, next opponent
             AP-ranked (as-of schedule shift, leak-safe builder cols).
  Control    identical minus the ranked-next-opponent condition.
  Outcomes   ATS cover vs CLOSE (primary) and OPEN; game UNDER rate (holding
             back implies fewer points). Per-season rows mandatory.
  Sweeps     favorite threshold 14/17/20/24; top-20 vs any ranked.
"""
import pandas as pd

mg = pd.read_parquet("data/model_games.parquet")
mg = mg[(mg.week <= 3) & mg.spread_close.notna() & mg.actual_margin.notna() & (mg.season <= 2025)]

rows = []
for side, opp in (("home", "away"), ("away", "home")):
    d = pd.DataFrame({
        "season": mg.season, "week": mg.week,
        "team": mg[f"{side}Team"], "opp": mg[f"{opp}Team"],
        "self_rank": mg[f"{side}_self_rank"],
        "self_ranked": mg[f"{side}_self_rank_is"],
        "next_ranked": mg[f"{side}_next_opp_rank_is"],
        # home-perspective close; team-perspective lay = -close for home, +close for away
        "lay_close": (-mg.spread_close) if side == "home" else mg.spread_close,
        "lay_open": (-mg.spread_open) if side == "home" else mg.spread_open,
        "margin": mg.actual_margin if side == "home" else -mg.actual_margin,
        "total_close": mg.total_close, "actual_total": mg.actual_total,
    })
    rows.append(d)
t = pd.concat(rows, ignore_index=True)

def grade(d, lay_col):
    diff = d.margin - d[lay_col]
    return pd.Series(["win" if x > 0 else "loss" if x < 0 else "push" for x in diff], index=d.index)

def summarize(d, label):
    if not len(d):
        print(f"{label:44s} n=0")
        return
    for lay_col, tag in (("lay_close", "close"), ("lay_open", "open ")):
        g = grade(d, lay_col)
        w, l, p = (g == "win").sum(), (g == "loss").sum(), (g == "push").sum()
        pct = w / (w + l) * 100 if w + l else 0
        extra = ""
        if tag == "close":
            u = (d.actual_total < d.total_close).sum()
            o = (d.actual_total > d.total_close).sum()
            extra = f" | UNDER {u}-{o} ({u/(u+o)*100:.0f}%)" if u + o else ""
        print(f"{label:44s} vs {tag}  {w}-{l}" + (f"-{p}" if p else "  ")
              + f"  cover {pct:.1f}% (n={w+l})" + extra)

print("=== ranked top-20 team laying big early (wk<=3) — lookahead vs control ===")
for thresh in (14, 17, 20, 24):
    base = t[(t.self_ranked == 1) & (t.self_rank <= 20) & (t.lay_close >= thresh)]
    look = base[base.next_ranked == 1]
    ctrl = base[base.next_ranked == 0]
    print(f"\n-- favorite laying >= {thresh} --")
    summarize(look, f"  LOOKAHEAD (ranked next opp)")
    summarize(ctrl, f"  control (unranked next opp)")

print("\n=== per-season, primary cell (top-20, lay>=17, ranked next) vs close ===")
base = t[(t.self_ranked == 1) & (t.self_rank <= 20) & (t.lay_close >= 17)]
look = base[base.next_ranked == 1]
for season, d in look.groupby("season"):
    g = grade(d, "lay_close")
    w, l = (g == "win").sum(), (g == "loss").sum()
    print(f"  {season}: {w}-{l}")

print("\n=== placebo: UNRANKED big favorites with ranked next opp ===")
pl = t[(t.self_ranked == 0) & (t.lay_close >= 17)]
summarize(pl[pl.next_ranked == 1], "  unranked + lookahead")
summarize(pl[pl.next_ranked == 0], "  unranked control")

print("\n=== sample games in the primary lookahead cell ===")
for _, r in look.sort_values(["season", "week"]).tail(12).iterrows():
    res = "COVER" if r.margin > r.lay_close else ("push" if r.margin == r.lay_close else "MISS")
    print(f"  {int(r.season)} wk{int(r.week)}  #{int(r.self_rank):>2} {r.team:20s} -{r.lay_close:g} vs {r.opp:22s} won by {r.margin:g}  {res}")
