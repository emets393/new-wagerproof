"""Phase 2 — CFB archetype-vs-archetype outcome grid (the primary tool per the sample caveat).
Cross each team's profile type with the OPPONENT's type; measure ATS cover (team perspective, graded at
the close spread) and game OVER, per cell, with per-season signs, complement checks, and SCAN HONESTY
(how many cells clear a threshold vs the ~5% expected by chance). Decimal price -110 (breakeven 52.4%).

Guardrails: grade at the line the signal uses; per-season ALWAYS; anti-signals are symmetric (report both
sides); belief = n + season-consistency + complement, not headline ROI."""
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
DEC = 1.909  # -110

tg = pd.read_parquet("data/cfb_team_games_profiled.parquet")

# attach OPPONENT types via self-join on game_id (the other perspective row)
opp = tg[["game_id", "team", "OFF_type", "DEF_type", "TRENCH_type"]].rename(
    columns={"team": "opponent", "OFF_type": "opp_OFF", "DEF_type": "opp_DEF", "TRENCH_type": "opp_TRENCH"})
tg = tg.merge(opp, on=["game_id", "opponent"], how="left")

def roi(p):  return (p * DEC - 1) * 100
def cell_stats(df, outcome):
    d = df.dropna(subset=[outcome])
    if len(d) == 0: return None
    p = d[outcome].mean()
    by = d.groupby("season")[outcome].mean()
    pos = (by >= 0.5).sum(); ns = by.notna().sum()
    return {"n": len(d), "pct": round(p * 100, 1), "roi": round(roi(p), 1),
            "seasons_on_side": f"{pos}/{ns}", "min_season": round(by.min() * 100), "max_season": round(by.max() * 100)}

def scan(df, row_type, col_type, outcome, label, nmin=150):
    print(f"\n{'='*88}\n{label}  (grade: {'ATS close' if outcome=='covered' else 'game total close'}, n≥{nmin})\n{'='*88}")
    cells = []
    for rt in sorted(df[row_type].dropna().unique()):
        for ct in sorted(df[col_type].dropna().unique()):
            s = cell_stats(df[(df[row_type] == rt) & (df[col_type] == ct)], outcome)
            if s and s["n"] >= nmin:
                s.update({"row": int(rt), "col": int(ct)})
                cells.append(s)
    cd = pd.DataFrame(cells)
    tested = len(cd)
    clears = cd[(cd.pct >= 55) | (cd.pct <= 45)]        # |edge| ≥ 5pts from 50
    exp_by_chance = round(tested * 0.05, 1)
    print(f"  cells tested (n≥{nmin}): {tested}   |   clearing |edge|≥5pts: {len(clears)}   |   expected by chance ≈ {exp_by_chance}")
    show = cd.reindex(cd.pct.sub(50).abs().sort_values(ascending=False).index).head(8)
    for _, r in show.iterrows():
        print(f"    {row_type[:3]}{r.row} vs {col_type}{r.col}: {r.pct:5.1f}% ({int(r.n):5d}) ROI {r.roi:+5.1f}  seasons {r.seasons_on_side} [{int(r.min_season)}-{int(r.max_season)}]")
    return cd

# ── ATS grids (team perspective) ──
g_od = scan(tg, "OFF_type", "opp_DEF", "covered", "ATS: team OFFENSE type vs opponent DEFENSE type")
g_do = scan(tg, "DEF_type", "opp_OFF", "covered", "ATS: team DEFENSE type vs opponent OFFENSE type")
g_tt = scan(tg, "TRENCH_type", "opp_TRENCH", "covered", "ATS: team TRENCH type vs opponent TRENCH type")

# ── game total grid: over% by the matchup of the two OFFENSE types (game-level, dedup) ──
gl = tg[tg.is_home == 1].copy()
gl["off_pair"] = gl[["OFF_type", "opp_OFF"]].min(axis=1).astype(int).astype(str) + "x" + gl[["OFF_type", "opp_OFF"]].max(axis=1).astype(int).astype(str)
print(f"\n{'='*88}\nTOTAL: game OVER by OFFENSE-type pairing (unordered), n≥120\n{'='*88}")
tp = []
for pr, s in gl.groupby("off_pair"):
    st = cell_stats(s, "over")
    if st and st["n"] >= 120: st["pair"] = pr; tp.append(st)
tpd = pd.DataFrame(tp)
print(f"  pairs tested: {len(tpd)} | clearing |edge|≥5: {len(tpd[(tpd.pct>=55)|(tpd.pct<=45)])} | expected by chance ≈ {round(len(tpd)*0.05,1)}")
for _, r in tpd.reindex(tpd.pct.sub(50).abs().sort_values(ascending=False).index).head(6).iterrows():
    print(f"    OFF {r.pair}: over {r.pct:5.1f}% ({int(r.n):4d}) ROI {r.roi:+5.1f}  seasons {r.seasons_on_side}")

# ── NARRATIVE-OVERPRICING tests (continuous extremity dials, not type splits) ──
# "great run D vs run team": run-leaning O (pass_rate ≤30th) vs run-stuff D (opp d_line_yds_all ≤30th) → does run team still cover?
print(f"\n{'='*88}\nNARRATIVE META-LAW tests (is the obvious storyline over-priced?)\n{'='*88}")
def narr(mask, label, outcome="covered"):
    s = cell_stats(tg[mask], outcome)
    if s: print(f"  {label}: {s['pct']}% (n={s['n']}) ROI {s['roi']:+.1f}  seasons {s['seasons_on_side']}")

runO = tg.o_pass_rate_pct <= 0.30
stuffD = tg.d_line_yds_all_pct <= 0.30            # opp allows few line yards = elite run D (lower raw = better, so low pct = elite)
# NOTE opp run-stuff must reference OPPONENT; approximate via opp DL trench type strong. Use opp_TRENCH run-stuff types (T2).
narr(runO & (tg.opp_TRENCH == 2), "run-leaning O vs DL-run-stuff trench (T2) — cover?")
narr((tg.t_ol_pass_pro_pct <= 0.30) & (tg.opp_TRENCH == 1), "weak pass-pro OL vs pressure/talent trench (opp T1) — cover?")
narr((tg.o_pass_rate_pct >= 0.70) & (tg.opp_DEF == 4), "pass-heavy O vs leaky pass D (opp DEF T4) — game OVER?", "over")
narr((tg.o_sec_per_play_pct >= 0.70) & (tg.opp_OFF.isin([3,4])), "slow O vs slow O — game OVER? (extremity dial next)", "over")

print("\n[scan honesty] belief requires: n + seasons-on-side consistency + a symmetric-negative complement.")
