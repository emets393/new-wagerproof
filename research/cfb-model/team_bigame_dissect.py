"""
DISSECT: fade the G5 top-2 conference-PR team coming off a LOSS to a high-PR opponent (they cover only ~38%,
so the opponent covers ~62%). Is it robust, or a 2022-24 hot streak? road-only (overlap w/ padded-road)? does
loss margin / next-opp / fav-dog sharpen it? Grade OPPONENT cover @ close. per-season + 2025.
"""
import numpy as np
import pandas as pd

gm = pd.read_parquet("data/model_games.parquet")
g = gm[gm.spread_close.notna() & gm.actual_margin.notna() & gm.net_rating_diff.notna()].copy()
P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
TS = [2021, 2022, 2023, 2024, 2025]
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0
def per(b, w): return "/".join(f"{100*w[b.season==s].mean():.0f}({(b.season==s).sum()})" if (b.season==s).sum()>=4 else "--" for s in TS)

rows = []
for _, r in g.iterrows():
    rows.append({"season": r.season, "week": r.week, "team": r.homeTeam, "conf": r.homeConference, "net": r.home_net_rating})
    rows.append({"season": r.season, "week": r.week, "team": r.awayTeam, "conf": r.awayConference, "net": r.away_net_rating})
panel = pd.DataFrame(rows).dropna(subset=["net"])
panel["pr_rank"] = panel.groupby(["season", "week", "conf"]).net.rank(ascending=False, method="min")
prr = panel.set_index(["season", "week", "team"]).pr_rank

L = []
for _, r in g.iterrows():
    for who, opp in [("home", "away"), ("away", "home")]:
        tm = r.actual_margin if who == "home" else -r.actual_margin
        tsp = r.spread_close if who == "home" else -r.spread_close
        if tm + tsp == 0: continue
        L.append({"season": r.season, "week": r.week, "team": r[f"{who}Team"], "conf": r[f"{who}Conference"],
                  "is_p5": r[f"{who}Conference"] in P5, "is_home": who == "home",
                  "self_net": r[f"{who}_net_rating"], "last_opp_net": r[f"{who}_last_opp_net"],
                  "last_win": r[f"{who}_last_win"], "last_margin": r[f"{who}_last_margin"],
                  "opp_net": r[f"{opp}_net_rating"], "team_cover": int(tm + tsp > 0),
                  "team_spread": tsp})
L = pd.DataFrame(L)
L["pr_rank"] = [prr.get((s, w, t), np.nan) for s, w, t in zip(L.season, L.week, L.team)]
hi = L.last_opp_net.quantile(0.66)

base = L[(~L.is_p5) & (L.pr_rank <= 2) & (L.last_opp_net >= hi) & (L.last_win == 0)].copy()
base["opp_cover"] = 1 - base.team_cover
n = len(base); w = int(base.opp_cover.sum())
print(f"BASE: fade G5 top-2 after loss to hi-PR opp -> opp covers {100*w/n:.1f}% (n={n}) roi{roi(w,n):+.1f}")
print(f"  per-season opp-cover%(n): {per(base, base.opp_cover)}\n")

def cut(label, sub):
    if len(sub) < 20: print(f"  {label:<40} n={len(sub)} (thin)"); return
    w = sub.opp_cover; pool = sub[sub.season <= 2024]; hold = sub[sub.season == 2025]
    print(f"  {label:<40} n={len(sub):<4} {100*w.mean():4.1f}% | pool {100*pool.opp_cover.mean():4.1f}% | 2025 {100*hold.opp_cover.mean():4.1f}%(n{len(hold)}) [{per(sub,w)}]")

print("=== dissect ===")
cut("G5 team HOME next game", base[base.is_home])
cut("G5 team AWAY next game (overlap padded-road)", base[~base.is_home])
cut("lost CLOSE (margin>=-10)", base[base.last_margin >= -10])
cut("lost BLOWOUT (margin<-10)", base[base.last_margin < -10])
cut("G5 team FAVORED next (spread<0)", base[base.team_spread < 0])
cut("G5 team DOG next (spread>0)", base[base.team_spread > 0])
cut("next opp also strong (opp_net>=median)", base[base.opp_net >= base.opp_net.median()])
cut("next opp weak (opp_net<median)", base[base.opp_net < base.opp_net.median()])
# the 2021 anomaly + most robust combo
print("\n2021 detail:", per(base[base.season==2021], base[base.season==2021].opp_cover))
print("\n=== best robust combo candidates (need pool>52.4 AND 2025>50) ===")
cut("HOME & FAVORED next", base[base.is_home & (base.team_spread < 0)])
cut("FAVORED next (any site)", base[base.team_spread < 0])
