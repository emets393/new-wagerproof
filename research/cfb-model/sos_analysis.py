"""
STRENGTH OF SCHEDULE (as-of, season-to-date) incl HOME/AWAY split. Each model_games row carries BOTH teams'
as-of net_rating, so a team's SOS = avg opponent net_rating over prior games; road-SOS = same over prior AWAY
games only. Leak-free (prior games, opponent strength as recorded at game time).

Exploratory (holdout-disciplined): does road-SOS of the away team help its road ATS? does the tougher-overall-
schedule team cover? are weak-SOS teams (gaudy vs cupcakes) overvalued -> fade? Grade ATS @ close, per-season+2025.
"""
import numpy as np
import pandas as pd

gm = pd.read_parquet("data/model_games.parquet")
g = gm[gm.spread_close.notna() & gm.actual_margin.notna() & gm.net_rating_diff.notna()].copy()
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0
TS = [2021, 2022, 2023, 2024, 2025]

# long per-team-game: opp_net (strength of opponent at game time), is_home
rows = []
for _, r in g.iterrows():
    rows.append({"season": r.season, "week": r.week, "game_id": r.game_id, "team": r.homeTeam,
                 "opp_net": r.away_net_rating, "is_home": 1})
    rows.append({"season": r.season, "week": r.week, "game_id": r.game_id, "team": r.awayTeam,
                 "opp_net": r.home_net_rating, "is_home": 0})
L = pd.DataFrame(rows).sort_values(["team", "season", "week"])
gb = L.groupby(["team", "season"], group_keys=False)
# as-of (prior games) cumulative SOS overall, home, away
L["sos_all"] = gb["opp_net"].apply(lambda s: s.shift().expanding().mean())
def cond_mean(df, home):
    s = df.opp_net.where(df.is_home == home)
    return s.shift().expanding().mean()
L["sos_home"] = gb.apply(lambda d: cond_mean(d, 1)).reset_index(level=0, drop=True)
L["sos_away"] = gb.apply(lambda d: cond_mean(d, 0)).reset_index(level=0, drop=True)
L["n_prior"] = gb.cumcount()
L["n_away_prior"] = gb["is_home"].apply(lambda s: (s == 0).shift().expanding().sum())
asof = L[["season", "game_id", "team", "sos_all", "sos_away", "n_prior", "n_away_prior"]]

# rejoin to games
h = asof.rename(columns={"team": "homeTeam", "sos_all": "h_sos", "sos_away": "h_sos_away", "n_prior": "h_np", "n_away_prior": "h_nap"})
a = asof.rename(columns={"team": "awayTeam", "sos_all": "a_sos", "sos_away": "a_sos_away", "n_prior": "a_np", "n_away_prior": "a_nap"})
G = g.merge(h, on=["season", "game_id", "homeTeam"]).merge(a, on=["season", "game_id", "awayTeam"])
G = G[(G.h_np >= 4) & (G.a_np >= 4)].copy()
G["home_cover"] = (G.actual_margin + G.spread_close) > 0
G = G[(G.actual_margin + G.spread_close) != 0]
G["sos_gap"] = G.h_sos - G.a_sos                       # >0 home faced tougher schedule
def per(b, w): return "/".join(f"{100*w[b.season==s].mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)

def T(name, mask, bet):  # bet: 'home','away'
    b = G[mask.reindex(G.index, fill_value=False)]
    if len(b) < 40: print(f"  {name:<48} n={len(b)} (thin)"); return
    w = b.home_cover if bet == "home" else ~b.home_cover
    pool = b[b.season <= 2024]; hold = b[b.season == 2025]
    pw = (pool.home_cover if bet=="home" else ~pool.home_cover); hw = (hold.home_cover if bet=="home" else ~hold.home_cover)
    flag = "  <<HOLDS" if (pw.mean()>0.524 and hw.mean()>0.524 and len(hold)>=15) else ""
    print(f"  {name:<48} n={len(b):<4} bet {bet:<4} {100*w.mean():4.1f}% | pool {100*pw.mean():4.1f}% | 2025 {100*hw.mean():4.1f}%(n{len(hold)}) [{per(b,w)}]{flag}")

print(f"games (both >=4 prior): {len(G)} | mean sos_away {G.a_sos_away.mean():.3f}\n")
print("=== A. ROAD-TESTED away team (high road-SOS) -> away covers this road game? ===")
qhi = G.a_sos_away.quantile(0.66); qlo = G.a_sos_away.quantile(0.33)
T("away road-SOS HIGH (top third), bet away", (G.a_sos_away >= qhi) & (G.a_nap >= 2), "away")
T("away road-SOS LOW (bottom third), bet away", (G.a_sos_away <= qlo) & (G.a_nap >= 2), "away")
T("away road-SOS HIGH, bet HOME (fade soft road team)", (G.a_sos_away <= qlo) & (G.a_nap >= 2), "home")

print("\n=== B. SCHEDULE-GAP: tougher-overall-schedule team covers? ===")
T("home faced tougher sched (gap>=+.15), bet home", G.sos_gap >= 0.15, "home")
T("away faced tougher sched (gap<=-.15), bet away", G.sos_gap <= -0.15, "away")

print("\n=== C. WEAK-SOS overvalued (gaudy net_rating vs soft sched) -> fade ===")
# team with strong net_rating but weak SOS = padded stats -> fade
G["h_padded"] = (G.home_net_rating > G.home_net_rating.median()) & (G.h_sos < G.h_sos.quantile(0.4))
G["a_padded"] = (G.away_net_rating > G.away_net_rating.median()) & (G.a_sos < G.a_sos.quantile(0.4))
T("home padded (good rating/weak SOS), bet AWAY", G.h_padded, "away")
T("away padded (good rating/weak SOS), bet HOME", G.a_padded, "home")
