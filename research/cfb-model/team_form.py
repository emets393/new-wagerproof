"""
WALK-FORWARD TEAM FORM (as-of, season-to-date) -> does ATS / O-U form persist into the current game?
For each team, prior games THIS season: ATS cover rate, over rate, avg actual total, avg posted total.
Then test multi-layer combos: both teams hot/cold to over; form-implied total vs posted total; ATS streaks.
Grade @ close, pushes excluded. min 4 prior games (week>=5). Holdout discipline: pooled vs 2025, per-season.
"""
import numpy as np
import pandas as pd

gm = pd.read_parquet("data/model_games.parquet")
g = gm[gm.total_close.notna() & gm.actual_total.notna() & gm.spread_close.notna() & gm.actual_margin.notna()].copy()
def roi(w, n): return (w * 0.909 - (n - w)) / n * 100 if n else 0.0
TS = [2021, 2022, 2023, 2024, 2025]

# ---- long per-team-game with that team's O/U + ATS result ----
rows = []
for _, r in g.iterrows():
    over = int(r.actual_total > r.total_close) if r.actual_total != r.total_close else np.nan
    for who in ["home", "away"]:
        tm = r.actual_margin if who == "home" else -r.actual_margin
        tsp = r.spread_close if who == "home" else -r.spread_close
        cov = int(tm + tsp > 0) if (tm + tsp) != 0 else np.nan
        rows.append({"season": r.season, "week": r.week, "game_id": r.game_id, "team": r[f"{who}Team"],
                     "over": over, "cover": cov, "tot": r.actual_total, "posted": r.total_close})
L = pd.DataFrame(rows).sort_values(["team", "season", "week"])
# as-of cumulative (prior games this season)
gb = L.groupby(["team", "season"], group_keys=False)
L["gp"] = gb.cumcount()
for c in ["over", "cover", "tot", "posted"]:
    L[f"cum_{c}"] = gb[c].apply(lambda s: s.shift().expanding().sum())
L["over_rate"] = L.cum_over / L.gp
L["cover_rate"] = L.cum_cover / L.gp
L["avg_tot"] = L.cum_tot / L.gp
asof = L[["season", "game_id", "team", "gp", "over_rate", "cover_rate", "avg_tot"]]

# ---- rejoin home/away as-of form to games ----
h = asof.rename(columns={"team": "homeTeam", **{c: f"h_{c}" for c in ["gp","over_rate","cover_rate","avg_tot"]}})
a = asof.rename(columns={"team": "awayTeam", **{c: f"a_{c}" for c in ["gp","over_rate","cover_rate","avg_tot"]}})
G = g.merge(h, on=["season", "game_id", "homeTeam"]).merge(a, on=["season", "game_id", "awayTeam"])
G = G[(G.h_gp >= 4) & (G.a_gp >= 4)].copy()           # both have >=4 prior games
G["over"] = (G.actual_total > G.total_close)
G = G[G.actual_total != G.total_close]
G["form_total"] = (G.h_avg_tot + G.a_avg_tot) / 2     # form-implied total
G["form_resid"] = G.form_total - G.total_close        # >0 form scores more than posted
G["comb_over"] = (G.h_over_rate + G.a_over_rate) / 2
G["comb_cover"] = (G.h_cover_rate + G.a_cover_rate) / 2
def per(b, w): return "/".join(f"{100*w[b.season==s].mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)

def T(name, mask, side):
    b = G[mask.reindex(G.index, fill_value=False)]
    if len(b) < 40: print(f"  {name:<46} n={len(b)} (thin)"); return
    w = b.over if side == "over" else ~b.over
    pool = b[b.season <= 2024]; hold = b[b.season == 2025]
    pw = (pool.over if side=="over" else ~pool.over); hw = (hold.over if side=="over" else ~hold.over)
    flag = "  <<HOLDS" if (pw.mean()>0.524 and hw.mean()>0.524 and len(hold)>=15) else ""
    print(f"  {name:<46} n={len(b):<4} {side.upper():<5} ALL {100*w.mean():4.1f}% | 21-24 {100*pw.mean():4.1f}% | 2025 {100*hw.mean():4.1f}%(n{len(hold)}) [{per(b,w)}]{flag}")

print(f"games (both >=4 prior): {len(G)} | baseline over {100*G.over.mean():.1f}%\n")
print("=== O/U FORM persistence ===")
T("both teams over-rate >= .60 (hot to over)", (G.h_over_rate>=.6)&(G.a_over_rate>=.6), "over")
T("both teams over-rate >= .65", (G.h_over_rate>=.65)&(G.a_over_rate>=.65), "over")
T("both teams over-rate <= .40 (cold)", (G.h_over_rate<=.4)&(G.a_over_rate<=.4), "under")
T("both teams over-rate <= .35", (G.h_over_rate<=.35)&(G.a_over_rate<=.35), "under")
T("comb over-rate >= .60", G.comb_over>=.6, "over")
T("comb over-rate <= .40", G.comb_over<=.4, "under")
print("\n=== FORM-IMPLIED TOTAL vs POSTED (market lags scoring?) ===")
for R in [3,5,7]:
    T(f"form_total - posted >= +{R} (form hotter)", G.form_resid>=R, "over")
    T(f"form_total - posted <= -{R} (form colder)", G.form_resid<=-R, "under")
T("both avg_tot > posted", (G.h_avg_tot>G.total_close)&(G.a_avg_tot>G.total_close), "over")
T("both avg_tot < posted", (G.h_avg_tot<G.total_close)&(G.a_avg_tot<G.total_close), "under")

# ---- ATS form (team-game level) ----
print("\n=== ATS FORM persistence (team-game level) ===")
hc = asof.rename(columns={"team":"homeTeam"});
rows=[]
for _,r in G.iterrows():
    for who in ["home","away"]:
        tm=r.actual_margin if who=="home" else -r.actual_margin
        tsp=r.spread_close if who=="home" else -r.spread_close
        if tm+tsp==0: continue
        rows.append({"season":r.season,"cover":int(tm+tsp>0),
                     "self_cr":r.h_cover_rate if who=="home" else r.a_cover_rate,
                     "opp_cr":r.a_cover_rate if who=="home" else r.h_cover_rate})
A=pd.DataFrame(rows)
def TA(name, mask, fade=False):
    b=A[mask.reindex(A.index,fill_value=False)]
    if len(b)<40: print(f"  {name:<46} n={len(b)} (thin)"); return
    w=(1-b.cover) if fade else b.cover
    pool=b[b.season<=2024]; hold=b[b.season==2025]
    pw=(1-pool.cover) if fade else pool.cover; hw=(1-hold.cover) if fade else hold.cover
    per2="/".join(f"{100*w[b.season==s].mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in TS)
    flag="  <<HOLDS" if (pw.mean()>0.524 and hw.mean()>0.524 and len(hold)>=15) else ""
    lab="FADE" if fade else "back"
    print(f"  {name:<46} n={len(b):<4} {lab} ALL {100*w.mean():4.1f}% | 21-24 {100*pw.mean():4.1f}% | 2025 {100*hw.mean():4.1f}%(n{len(hold)}) [{per2}]{flag}")
TA("team ATS-hot >=.65 (back)", A.self_cr>=.65)
TA("team ATS-hot >=.65 (fade)", A.self_cr>=.65, fade=True)
TA("team ATS-cold <=.35 (back)", A.self_cr<=.35)
TA("team ATS-hot >=.6 & opp cold <=.4 (back)", (A.self_cr>=.6)&(A.opp_cr<=.4))
