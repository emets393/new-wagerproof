"""
ARCHETYPE MATCHUP MIXTURES -> ATS/totals trends. Long per-team-game frame: team OFFENSE tags vs OPPONENT
DEFENSE tags, team ATS cover vs CLOSE. Test strength-vs-weakness clashes. Discipline (post-explosiveness
lesson): show pooled 2021-24 AND 2025 holdout side by side; believe only what holds out.
"""
import numpy as np
import pandas as pd
import archetypes as AR

out, tg, AX = AR.build_archetypes()
# long per-team-game: team offense + opponent defense + ATS cover vs close
rows = []
for _, r in out.iterrows():
    if pd.isna(r.spread_close) or pd.isna(r.actual_margin): continue
    for who, opp in [("home", "away"), ("away", "home")]:
        tm = r.actual_margin if who == "home" else -r.actual_margin
        tsp = r.spread_close if who == "home" else -r.spread_close
        ats = tm + tsp
        if ats == 0: continue
        d = {"season": r.season, "week": r.week, "cover": int(ats > 0), "total_close": r.total_close,
             "actual_total": r.actual_total, "fav": tsp < 0}
        for a in AX:
            d["off_" + a if a.startswith("A_") else "Doff_" + a] = r[f"{who}_{a}"]
            d["def_" + a if a.startswith("D_") else "Aopp_" + a] = r[f"{opp}_{a}"]
        rows.append(d)
L = pd.DataFrame(rows)
def col(a): return ("off_" if a.startswith("A_") else "def_") + a
base = 100 * L.cover.mean()
print(f"team-games: {len(L)} | baseline cover {base:.1f}%\n")

def clash(name, mask, fade=False):
    b = L[mask.reindex(L.index, fill_value=False)]
    if len(b) < 40: print(f"  {name:<46} n={len(b)} (thin, skip)"); return
    cov = b.cover if not fade else 1 - b.cover
    pool = b[b.season <= 2024]; hold = b[b.season == 2025]
    pc = (pool.cover if not fade else 1 - pool.cover); hc = (hold.cover if not fade else 1 - hold.cover)
    per = "/".join(f"{100*(cov[b.season==s]).mean():.0f}" if (b.season==s).sum() >= 8 else "--" for s in [2021,2022,2023,2024,2025])
    tag = "FADE team" if fade else "back team"
    print(f"  {name:<46} n={len(b):<4} {tag} ALL {100*cov.mean():4.1f}% | 21-24 {100*pc.mean():4.1f}%(n{len(pool)}) | 2025 {100*hc.mean():4.1f}%(n{len(hold)})  [{per}]")

O = lambda a: L["off_" + a]; D = lambda a: L["def_" + a]
print("=== STRENGTH-vs-WEAKNESS clashes (team offense exploits opp defense) -> team cover? ===")
clash("Run-heavy+Elite-OL  vs Soft-runD", (O("A_identity")=="Run-heavy") & (O("A_OL")=="Elite-OL") & (D("D_run")=="Soft-runD"))
clash("Elite-OL            vs Weak-front", (O("A_OL")=="Elite-OL") & (D("D_front7")=="Weak-front"))
clash("Vertical-WR         vs Weak-secondary", (O("A_pass")=="Vertical-WR") & (D("D_secondary")=="Weak-secondary"))
clash("Dual-threat-QB      vs Blitz-D", (O("A_QB")=="Dual-threat") & (D("D_aggression")=="Blitz-D"))
clash("Methodical          vs Soft-runD", (O("A_style")=="Methodical") & (D("D_run")=="Soft-runD"))
print("\n=== STRENGTH-NEUTRALIZED / MISMATCH-AGAINST -> FADE team ===")
clash("Pocket-QB           vs Blitz-D", (O("A_QB")=="Pocket-QB") & (D("D_aggression")=="Blitz-D"), fade=True)
clash("Pocket-QB           vs Dominant-front", (O("A_QB")=="Pocket-QB") & (D("D_front7")=="Dominant-front"), fade=True)
clash("Weak-pass           vs Lockdown-secondary", (O("A_pass")=="Weak-pass") & (D("D_secondary")=="Lockdown-secondary"), fade=True)
clash("Run-heavy+Elite-OL  vs Stout-runD", (O("A_identity")=="Run-heavy") & (O("A_OL")=="Elite-OL") & (D("D_run")=="Stout-runD"), fade=True)
clash("Vertical-WR         vs Lockdown-secondary", (O("A_pass")=="Vertical-WR") & (D("D_secondary")=="Lockdown-secondary"), fade=True)

# ---- TOTALS clashes (game level) ----
print("\n=== TOTALS clashes (game level, over% vs close) ===")
g = out[out.actual_total.notna() & out.total_close.notna()].copy()
g = g[g.actual_total != g.total_close]
g["over"] = (g.actual_total > g.total_close).astype(int)
gb = 100 * g.over.mean()
print(f"  totals baseline over {gb:.1f}% (n={len(g)})")
def tclash(name, mask, under=False):
    b = g[mask.reindex(g.index, fill_value=False)]
    if len(b) < 40: print(f"  {name:<48} n={len(b)} (thin)"); return
    w = b.over if not under else 1 - b.over
    pool = b[b.season<=2024]; hold=b[b.season==2025]
    pw = (pool.over if not under else 1-pool.over); hw=(hold.over if not under else 1-hold.over)
    side = "UNDER" if under else "OVER"
    print(f"  {name:<48} n={len(b):<4} {side} ALL {100*w.mean():4.1f}% | 21-24 {100*pw.mean():4.1f}% | 2025 {100*hw.mean():4.1f}%(n{len(hold)})")
ho, ao, hd, ad = [lambda a,s=s: out[f"{s}_{a}"] for s in ["home","away","home","away"]]
tclash("both Up-tempo", (out.home_A_tempo=="Up-tempo") & (out.away_A_tempo=="Up-tempo"))
tclash("both Methodical + a BendDontBreak D", (out.home_A_style=="Methodical") & (out.away_A_style=="Methodical") & ((out.home_D_bigplay=="BendDontBreak")|(out.away_D_bigplay=="BendDontBreak")), under=True)
tclash("Vertical-WR vs Weak-secondary (either side)", ((out.home_A_pass=="Vertical-WR")&(out.away_D_secondary=="Weak-secondary"))|((out.away_A_pass=="Vertical-WR")&(out.home_D_secondary=="Weak-secondary")))
tclash("both Weak-pass / Lockdown (grind)", ((out.home_A_pass=="Weak-pass")|(out.away_A_pass=="Weak-pass")) & ((out.home_D_secondary=="Lockdown-secondary")|(out.away_D_secondary=="Lockdown-secondary")), under=True)
