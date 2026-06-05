"""
TOTALS via game-level ARCHETYPE MIXTURES. Totals depend on BOTH offenses + BOTH defenses, so build count
features (how many of the 2 teams are Explosive / Up-tempo / Leaky-D / Stout-D / etc.) and test shootout
stacks (OVER) vs rock-fight stacks (UNDER). Graded @ consensus close. Holdout discipline: pooled 21-24 AND
2025 both required; per-season shown. baseline over ~49.6%.
"""
import numpy as np
import pandas as pd
import archetypes as AR

out, tg, AX = AR.build_archetypes()
g = out[out.actual_total.notna() & out.total_close.notna()].copy()
g = g[g.actual_total != g.total_close]
g["over"] = (g.actual_total > g.total_close).astype(int)
def cnt(base, val): return (g[f"home_{base}"] == val).astype(int) + (g[f"away_{base}"] == val).astype(int)
# game-level mixture counts
g["n_explosive"]  = cnt("A_style", "Explosive")
g["n_methodical"] = cnt("A_style", "Methodical")
g["n_uptempo"]    = cnt("A_tempo", "Up-tempo")
g["n_slow"]       = cnt("A_tempo", "Slow")
g["n_vertWR"]     = cnt("A_pass", "Vertical-WR")
g["n_weakpass"]   = cnt("A_pass", "Weak-pass")
g["n_runheavy"]   = cnt("A_identity", "Run-heavy")
g["n_dualQB"]     = cnt("A_QB", "Dual-threat")
g["n_pocketQB"]   = cnt("A_QB", "Pocket-QB")
g["n_eliteOL"]    = cnt("A_OL", "Elite-OL")
g["n_leakyD"]     = cnt("D_bigplay", "Leaky")
g["n_bdb"]        = cnt("D_bigplay", "BendDontBreak")
g["n_weakfront"]  = cnt("D_front7", "Weak-front")
g["n_domfront"]   = cnt("D_front7", "Dominant-front")
g["n_weaksec"]    = cnt("D_secondary", "Weak-secondary")
g["n_locksec"]    = cnt("D_secondary", "Lockdown-secondary")
g["n_stoutrun"]   = cnt("D_run", "Stout-runD")
g["n_softrun"]    = cnt("D_run", "Soft-runD")
# cross-side pass mismatch (vertical WR vs weak secondary, either direction)
g["pass_mm"] = (((g.home_A_pass=="Vertical-WR")&(g.away_D_secondary=="Weak-secondary")).astype(int)
              + ((g.away_A_pass=="Vertical-WR")&(g.home_D_secondary=="Weak-secondary")).astype(int))
g["pocket_vs_pressure"] = (((g.home_A_QB=="Pocket-QB")&(g.away_D_front7=="Dominant-front")).astype(int)
                         + ((g.away_A_QB=="Pocket-QB")&(g.home_D_front7=="Dominant-front")).astype(int))

base = 100 * g.over.mean()
print(f"games: {len(g)} | baseline OVER {base:.1f}%\n")
SEAS = [2021, 2022, 2023, 2024, 2025]
def t(name, mask, under=False):
    b = g[mask.reindex(g.index, fill_value=False)]
    if len(b) < 40: print(f"  {name:<44} n={len(b)} (thin)"); return
    w = (1 - b.over) if under else b.over
    pool = b[b.season <= 2024]; hold = b[b.season == 2025]
    pw = (1-pool.over) if under else pool.over; hw = (1-hold.over) if under else hold.over
    per = "/".join(f"{100*w[b.season==s].mean():.0f}" if (b.season==s).sum()>=8 else "--" for s in SEAS)
    side = "UNDER" if under else "OVER "
    hit = "  <<HOLDS" if (pw.mean() > 0.524 and hw.mean() > 0.524 and len(hold) >= 20) else ""
    print(f"  {name:<44} n={len(b):<4} {side} ALL {100*w.mean():4.1f}% | 21-24 {100*pw.mean():4.1f}% | 2025 {100*hw.mean():4.1f}%(n{len(hold)}) [{per}]{hit}")

print("=== SHOOTOUT stacks -> OVER ===")
t("2 explosive offenses", g.n_explosive == 2)
t("2 explosive + >=1 leaky D", (g.n_explosive == 2) & (g.n_leakyD >= 1))
t(">=1 explosive + >=1 leaky D", (g.n_explosive >= 1) & (g.n_leakyD >= 1))
t("2 leaky D (both)", g.n_leakyD == 2)
t("2 weak fronts (no pass rush)", g.n_weakfront == 2)
t("2 weak secondaries", g.n_weaksec == 2)
t("2 vertical-WR offenses", g.n_vertWR == 2)
t("pass mismatch on BOTH sides", g.pass_mm == 2)
t("2 up-tempo", g.n_uptempo == 2)
t("2 dual-threat QB", g.n_dualQB == 2)
t(">=3 weak units (front+sec+leaky)", (g.n_weakfront + g.n_weaksec + g.n_leakyD) >= 3)

print("\n=== ROCK-FIGHT stacks -> UNDER ===")
t("2 methodical offenses", g.n_methodical == 2, under=True)
t("2 slow tempo", g.n_slow == 2, under=True)
t("2 lockdown secondaries", g.n_locksec == 2, under=True)
t("2 dominant fronts", g.n_domfront == 2, under=True)
t("2 stout run-D", g.n_stoutrun == 2, under=True)
t("2 BendDontBreak D", g.n_bdb == 2, under=True)
t("2 run-heavy (clock)", g.n_runheavy == 2, under=True)
t("2 weak-pass offenses", g.n_weakpass == 2, under=True)
t("pocket-QB vs pressure (>=1)", g.pocket_vs_pressure >= 1, under=True)
t(">=3 strong D units (front+sec+stout)", (g.n_domfront + g.n_locksec + g.n_stoutrun) >= 3, under=True)
t("2 slow + 2 run-heavy", (g.n_slow == 2) & (g.n_runheavy == 2), under=True)
t(">=3 strong-D + 0 explosive", ((g.n_domfront + g.n_locksec + g.n_stoutrun) >= 3) & (g.n_explosive == 0), under=True)
