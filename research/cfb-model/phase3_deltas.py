"""Phase 3 (proper) — STYLE-SPLIT DELTAS, the S5 press-fade analog for football.
Per team, within season, prior-only: mean ACTUAL offensive efficiency (game_advanced offense.ppa) vs each
opponent DEFENSE archetype MINUS the team's overall prior baseline. If a team has UNDER-performed its own
baseline vs a D-archetype across ≥2 prior same-season meetings (magnitude trigger, not sign-consistency),
does it keep underperforming the next meeting? Test FADE ATS + team-total UNDER + game UNDER, every market,
per-season, dose-response on delta magnitude, complement (over-performers should be symmetric/null).
Leak-safe: only PRIOR games' actuals feed the delta."""
import numpy as np, pandas as pd, glob, warnings
warnings.filterwarnings("ignore")
DEC = 1.909

# actual per-game offensive efficiency
ga = pd.concat([pd.read_parquet(f) for f in glob.glob("data/cfbd/game_advanced_20*.parquet")], ignore_index=True)
ga = ga.rename(columns={"gameId": "game_id"})[["game_id", "team", "offense.ppa", "offense.successRate"]]
ga = ga.rename(columns={"offense.ppa": "off_ppa", "offense.successRate": "off_sr"})

tg = pd.read_parquet("data/cfb_team_games_profiled.parquet")
opp = tg[["game_id", "team", "DEF_type", "OFF_type"]].rename(columns={"team": "opponent", "DEF_type": "opp_DEF", "OFF_type": "opp_OFF"})
tg = tg.merge(opp, on=["game_id", "opponent"], how="left").merge(ga, on=["game_id", "team"], how="left")
mk = pd.read_parquet("data/cfb_markets_2325.parquet")
tg = tg.merge(mk[["game_id", "team", "tt_over", "h1_over", "h1_covered"]], on=["game_id", "team"], how="left")

# ── leak-safe prior deltas: offense.ppa vs opponent DEF archetype minus own prior baseline ──
tg = tg.sort_values(["season", "team", "week"]).reset_index(drop=True)
rows_delta, rows_np = [], []
for (ssn, team), sub in tg.groupby(["season", "team"]):
    sub = sub.sort_values("week")
    ppa = sub.off_ppa.values; oppdef = sub.opp_DEF.values
    for i in range(len(sub)):
        prior_ppa = ppa[:i]; prior_def = oppdef[:i]
        base = np.nanmean(prior_ppa) if i > 0 and np.isfinite(prior_ppa).any() else np.nan
        arche = oppdef[i]
        msk = (prior_def == arche) & np.isfinite(prior_ppa)
        vs = np.nanmean(prior_ppa[msk]) if msk.sum() > 0 else np.nan
        rows_delta.append(vs - base if (np.isfinite(vs) and np.isfinite(base)) else np.nan)
        rows_np.append(int(msk.sum()))
tg["delta"] = rows_delta          # <0 = team underperforms its baseline vs this D-archetype
tg["n_priors_vs"] = rows_np

def stats(d, col, side_hi=True):
    d = d.dropna(subset=[col])
    if len(d) == 0: return None
    p = d[col].mean() if side_hi else 1 - d[col].mean()
    by = d.groupby("season")[col].apply(lambda x: x.mean() if side_hi else 1 - x.mean())
    return dict(n=len(d), pct=round(p*100,1), roi=round((p*DEC-1)*100,1),
                seasons=f"{(by>=0.5).sum()}/{by.notna().sum()}", rng=f"{round(by.min()*100)}-{round(by.max()*100)}")
def line(lbl, s):
    print(f"  {lbl:46s} " + (f"{s['pct']:5.1f}%  n={s['n']:5d}  ROI {s['roi']:+6.1f}  seasons {s['seasons']:>4} [{s['rng']}]" if s else "  — no sample"))

elig = tg[tg.n_priors_vs >= 2].copy()
print(f"eligible team-games (≥2 prior meetings vs the archetype): {len(elig)}  ({len(elig)/len(tg)*100:.0f}% of rows)")

# ── DOSE-RESPONSE: underperformers (delta ≤ -x) → FADE ATS (bet against team) ──
print("\n"+"="*96); print("UNDER-PERFORMERS vs a D-archetype → FADE the team ATS (magnitude dose-response, ≥2 priors)"); print("="*96)
for thr in [-0.05, -0.10, -0.15, -0.20]:
    line(f"delta ≤ {thr:+.2f}  → fade ATS", stats(elig[elig.delta <= thr], "covered", side_hi=False))
print("  complement (over-performers, should be null/symmetric):")
for thr in [0.05, 0.10, 0.15]:
    line(f"delta ≥ {thr:+.2f}  → team covers", stats(elig[elig.delta >= thr], "covered", side_hi=True))

# ── every market for the primary underperformer cell (delta ≤ -0.10) ──
print("\n"+"="*96); print("EVERY MARKET — underperformers (delta ≤ -0.10 vs the D-archetype, ≥2 priors)"); print("="*96)
u = elig[elig.delta <= -0.10]
line("FADE ATS (bet against team)", stats(u, "covered", side_hi=False))
line("team total UNDER (2023-25)", stats(u, "tt_over", side_hi=False))
line("game total UNDER (dedup)", stats(u.drop_duplicates("game_id"), "over", side_hi=False))
line("1H total UNDER (2023-25)", stats(u, "h1_over", side_hi=False))
line("1H spread FADE (2023-25)", stats(u, "h1_covered", side_hi=False))

# ── same idea on DEFENSE: team's defense underperforms vs an OFFENSE archetype → fade / over ──
print("\n"+"="*96); print("DEFENSE side — team D underperforms vs an O-archetype (points-allowed proxy via opp scoring)"); print("="*96)
# defensive delta: opponent's actual off_ppa AGAINST this team, vs this team's baseline points allowed — approximated by
# how much THIS team's defense gets torched vs an O-archetype relative to baseline. Reuse: build from opp perspective.
print("  (offense-delta above is the primary S5 analog; defense mirror deferred to writeup if offense is null)")
