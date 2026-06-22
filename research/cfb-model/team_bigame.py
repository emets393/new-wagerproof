"""
AFTER A BIG GAME (bounce-back vs regression). Team of interest = ranked (P5) / top-2 conference PR (G5) with
high PR, whose PREVIOUS opponent was also ranked/high-PR. Split by whether they WON or LOST that big game:
  theory -> LOST = bounce back (cover next game); WON = regression (fade next game).
As-of, leak-free (prior game already happened). Grade team's ATS @ close, per-season + 2025 holdout.
"""
import numpy as np
import pandas as pd

gm = pd.read_parquet("data/model_games.parquet")
g = gm[gm.spread_close.notna() & gm.actual_margin.notna() & gm.net_rating_diff.notna()].copy()
P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
TS = [2021, 2022, 2023, 2024, 2025]
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0
def per(b, w): return "/".join(f"{100*w[b.season==s].mean():.0f}" if (b.season==s).sum()>=6 else "--" for s in TS)

# as-of conference PR rank (for G5 "top-2 in conference"): each team's latest net_rating up to each week
rows = []
for _, r in g.iterrows():
    rows.append({"season": r.season, "week": r.week, "team": r.homeTeam, "conf": r.homeConference, "net": r.home_net_rating})
    rows.append({"season": r.season, "week": r.week, "team": r.awayTeam, "conf": r.awayConference, "net": r.away_net_rating})
panel = pd.DataFrame(rows).dropna(subset=["net"]).sort_values(["season", "week"])
# rank within (season, week, conf) by net (as-of that week's recorded rating)
panel["pr_rank"] = panel.groupby(["season", "week", "conf"]).net.rank(ascending=False, method="min")
prr = panel.set_index(["season", "week", "team"]).pr_rank

# long team-game with as-of big-game conditions + ATS result
L = []
for _, r in g.iterrows():
    for who in ["home", "away"]:
        tm = r.actual_margin if who == "home" else -r.actual_margin
        tsp = r.spread_close if who == "home" else -r.spread_close
        if tm + tsp == 0: continue
        team = r[f"{who}Team"]; conf = r[f"{who}Conference"]
        L.append({"season": r.season, "week": r.week, "team": team, "conf": conf, "is_p5": conf in P5,
                  "self_rank_is": r[f"{who}_self_rank_is"], "self_net": r[f"{who}_net_rating"],
                  "last_opp_rank_is": r[f"{who}_last_opp_rank_is"], "last_opp_net": r[f"{who}_last_opp_net"],
                  "last_win": r[f"{who}_last_win"], "cover": int(tm + tsp > 0)})
L = pd.DataFrame(L)
# attach conference PR rank (as-of this week)
L["pr_rank"] = [prr.get((s, w, t), np.nan) for s, w, t in zip(L.season, L.week, L.team)]
hi_opp = L.last_opp_net.quantile(0.66)   # "high-PR previous opponent" threshold

def block(label, mask):
    b = L[mask & L.last_win.notna() & L.last_opp_net.notna()]
    for res, lw, bet in [("LOST big game -> BOUNCE (back team)", 0, "team"), ("WON big game -> REGRESS (fade team)", 1, "fade")]:
        sub = b[b.last_win == lw]
        if len(sub) < 25: print(f"  {label} | {res:<38} n={len(sub)} (thin)"); continue
        w = sub.cover if bet == "team" else (1 - sub.cover)
        pool = sub[sub.season <= 2024]; hold = sub[sub.season == 2025]
        pw = (pool.cover if bet=="team" else 1-pool.cover); hw = (hold.cover if bet=="team" else 1-hold.cover)
        flag = "  <<HOLDS" if (pw.mean()>0.524 and hw.mean()>0.524 and len(hold)>=12) else ""
        print(f"  {label} | {res:<38} n={len(sub):<4} {100*w.mean():4.1f}% | pool {100*pw.mean():4.1f}% | 2025 {100*hw.mean():4.1f}%(n{len(hold)}) roi{roi(int(w.sum()),len(sub)):+.1f} [{per(sub,w)}]{flag}")

print("=== P5: ranked team, last opp ranked -> split by last result ===")
block("P5 ranked+lastoppRanked", (L.is_p5) & (L.self_rank_is == 1) & (L.last_opp_rank_is == 1))
block("P5 ranked+lastoppRanked+lastoppHiPR", (L.is_p5) & (L.self_rank_is == 1) & (L.last_opp_rank_is == 1) & (L.last_opp_net >= hi_opp))
print("\n=== G5: top-2 conference PR, last opp high-PR -> split by last result ===")
block("G5 top2confPR + lastoppHiPR", (~L.is_p5) & (L.pr_rank <= 2) & (L.last_opp_net >= hi_opp))
block("G5 top2confPR + lastopp top-tier(rank or PR)", (~L.is_p5) & (L.pr_rank <= 2) & ((L.last_opp_rank_is == 1) | (L.last_opp_net >= hi_opp)))
print("\n=== combined (P5 ranked OR G5 top2) + big-PR last opp ===")
elig = ((L.is_p5 & (L.self_rank_is == 1)) | (~L.is_p5 & (L.pr_rank <= 2)))
block("ALL eligible + lastoppHiPR", elig & (L.last_opp_net >= hi_opp))
