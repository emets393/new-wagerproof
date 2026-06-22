"""
ARCHETYPE MIXTURES within SPECIFIC CONFERENCES (conf games only), spread + totals. Smallest-sample cut ->
EXPLORATORY. Theory-driven hypotheses only (no full dredge): defense-conferences (SEC/BigTen) should favor
fades/unders; offense-conferences (Big12/AAC/SunBelt) overs. Per-season consistency is the filter; thin flagged.
Graded @ close. baseline cover 50%, over ~49.6%.
"""
import numpy as np
import pandas as pd
import archetypes as AR

out, tg, AX = AR.build_archetypes()
out["conf"] = np.where(out.homeTeam.notna() & (out.get("homeConference").isna() if "homeConference" in out else False), "x", "x")
# need conferences -> pull from model_games
gm = pd.read_parquet("data/model_games.parquet")[["season","game_id","homeConference","awayConference"]]
out = out.merge(gm, on=["season","game_id"], how="left")
out["confgame"] = out.homeConference == out.awayConference
out["conf"] = np.where(out.confgame, out.homeConference, "NON")
SEAS = [2021,2022,2023,2024,2025]
CONfS = ["SEC","Big Ten","Big 12","ACC","American Athletic","Sun Belt","Mountain West","Mid-American","Conference USA"]

# ---- TOTALS game-level mixtures ----
g = out[out.actual_total.notna() & out.total_close.notna() & out.confgame].copy()
g = g[g.actual_total != g.total_close]
g["over"] = (g.actual_total > g.total_close).astype(int)
def cnt(d, base, val): return (d[f"home_{base}"]==val).astype(int) + (d[f"away_{base}"]==val).astype(int)
g["shootout"] = ((cnt(g,"A_style","Explosive")>=1) & (cnt(g,"D_bigplay","Leaky")>=1))
g["rockfight"] = ((cnt(g,"D_front7","Dominant-front")+cnt(g,"D_secondary","Lockdown-secondary")+cnt(g,"D_run","Stout-runD"))>=3) & (cnt(g,"A_style","Explosive")==0)
g["twovert"] = cnt(g,"A_pass","Vertical-WR")==2

def per(b, w): return "/".join(f"{100*w[b.season==s].mean():.0f}" if (b.season==s).sum()>=6 else "--" for s in SEAS)
print("=== TOTALS archetype mixtures BY CONFERENCE (conf games) ===")
print(f"{'conf':<18}{'shootout->OVER':>22}{'rockfight->UNDER':>22}{'2vertWR->OVER':>20}")
for c in CONfS:
    s = g[g.conf==c]; row=f"{c:<18}"
    for col,under in [("shootout",False),("rockfight",True),("twovert",False)]:
        b=s[s[col]]; n=len(b)
        if n>=20:
            w=(1-b.over) if under else b.over
            row+=f"{f'{100*w.mean():.0f}%(n{n})':>22}" if col!='twovert' else f"{f'{100*w.mean():.0f}%(n{n})':>20}"
        else:
            row+=f"{f'--(n{n})':>22}" if col!='twovert' else f"{f'--(n{n})':>20}"
    print(row)

# spotlight: shootout/rockfight per-season for confs with n>=25
print("\n=== per-season detail (n>=25 cells) ===")
for c in CONfS:
    s=g[g.conf==c]
    for col,lab,under in [("shootout","shootout OVER",False),("rockfight","rockfight UNDER",True),("twovert","2vertWR OVER",False)]:
        b=s[s[col]]
        if len(b)>=25:
            w=(1-b.over) if under else b.over
            print(f"  {c:<16} {lab:<16} n={len(b):<3} {100*w.mean():.1f}% [{per(b,w)}]")

# ---- SPREAD team-game: fade neutralized strength, by conference ----
rows=[]
for _,r in out[out.confgame & out.spread_close.notna() & out.actual_margin.notna()].iterrows():
    for who,opp in [("home","away"),("away","home")]:
        tm=r.actual_margin if who=="home" else -r.actual_margin
        tsp=r.spread_close if who=="home" else -r.spread_close
        if tm+tsp==0: continue
        rows.append({"season":r.season,"conf":r.conf,"cover":int(tm+tsp>0),
            "pocket_vs_pressure": (r[f"{who}_A_QB"]=="Pocket-QB") and (r[f"{opp}_D_front7"]=="Dominant-front" or r[f"{opp}_D_aggression"]=="Blitz-D"),
            "run_vs_stout": (r[f"{who}_A_identity"]=="Run-heavy") and (r[f"{who}_A_OL"]=="Elite-OL") and (r[f"{opp}_D_run"]=="Stout-runD")})
L=pd.DataFrame(rows)
print("\n=== SPREAD: FADE neutralized-strength team BY CONFERENCE (conf games) ===")
print(f"{'conf':<18}{'fade pocketQB-v-press':>24}{'fade run+OL-v-stout':>24}")
for c in CONfS:
    s=L[L.conf==c]; row=f"{c:<18}"
    for col in ["pocket_vs_pressure","run_vs_stout"]:
        b=s[s[col]]; n=len(b)
        cell = f"{100*(1-b.cover).mean():.0f}%(n{n})" if n>=20 else f"--(n{n})"
        row += f"{cell:>24}"
    print(row)
print("\n=== spread per-season detail (n>=25) ===")
for c in CONfS:
    s=L[L.conf==c]
    for col,lab in [("pocket_vs_pressure","fade pocketQB-v-press"),("run_vs_stout","fade run+OL-v-stout")]:
        b=s[s[col]]
        if len(b)>=25:
            w=1-b.cover
            print(f"  {c:<16} {lab:<22} n={len(b):<3} {100*w.mean():.1f}% [{per(b,w)}]")
