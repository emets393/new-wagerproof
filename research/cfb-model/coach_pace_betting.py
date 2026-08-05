"""Betting angle for the coach scheme-transfer finding: when a NEW coach's prior team played much FASTER
(or slower) than his new team did, the preseason/early total is anchored on last year's pace — but the team
adopts the coach's tempo (~66% of the gap in year 1). So weeks 1-3 should lean OVER when a fast coach takes
a slow team, UNDER when a slow coach takes a fast team. Test totals at the close, per-season, wk1-3 vs wk4+.
Grading close = model_games.total_close (historical Vegas close; the Odds-API single-source rule governs the
LIVE product, this is the research backtest)."""
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
DEC = 1.909

mv = pd.read_parquet("data/coach_moves.parquet")
mv = mv.dropna(subset=["coach_prior_pace", "new_prior_pace"]).copy()
mv["pace_gap"] = mv.coach_prior_pace - mv.new_prior_pace   # >0 = coach faster than the team was
gapmap = {(int(r.year), r.school): r.pace_gap for _, r in mv.iterrows()}

mg = pd.read_parquet("data/model_games.parquet")
rows = []
for s in ("home", "away"):
    d = mg[["season", "week", f"{s}Team", "total_close", "actual_total"]].rename(columns={f"{s}Team": "team"})
    rows.append(d)
tg = pd.concat(rows, ignore_index=True)
tg["pace_gap"] = [gapmap.get((int(se), t), np.nan) for se, t in zip(tg.season, tg.team)]
tg = tg.dropna(subset=["pace_gap", "total_close", "actual_total"]).copy()
tg["over"] = np.where(tg.actual_total == tg.total_close, np.nan, (tg.actual_total > tg.total_close).astype(float))

def stat(d, over=True):
    d = d.dropna(subset=["over"])
    if len(d) < 20: return f"  n={len(d):3d} (thin)"
    p = d.over.mean() if over else 1 - d.over.mean()
    by = d.groupby("season").over.apply(lambda x: x.mean() if over else 1 - x.mean())
    return f"{p*100:5.1f}%  n={len(d):3d}  ROI {(p*DEC-1)*100:+6.1f}  seasons {(by>=0.5).sum()}/{by.notna().sum()}"

print("=" * 88); print("NEW-COACH team totals by pace gap (coach faster/slower than the team was)"); print("=" * 88)
early = tg[tg.week <= 3]; late = tg[tg.week >= 4]
print("FAST coach → slow team (pace_gap ≥ +8) → expect OVER:")
print("  weeks 1-3:", stat(early[early.pace_gap >= 8], over=True))
print("  weeks 4+ :", stat(late[late.pace_gap >= 8], over=True))
print("SLOW coach → fast team (pace_gap ≤ -8) → expect UNDER:")
print("  weeks 1-3:", stat(early[early.pace_gap <= -8], over=False))
print("  weeks 4+ :", stat(late[late.pace_gap <= -8], over=False))
print("\nDose-response (weeks 1-3, OVER side, rising fast-coach gap):")
for thr in [4, 8, 12]:
    print(f"  pace_gap ≥ +{thr:2d}: {stat(early[early.pace_gap >= thr], over=True)}")
print("Complement (weeks 1-3, slow-coach gap, OVER side — should be < 50%):")
for thr in [4, 8, 12]:
    print(f"  pace_gap ≤ -{thr:2d}: {stat(early[early.pace_gap <= -thr], over=True)}")

# mechanism: is the early total inflated/deflated vs actual for the fast-coach cell?
c = early[early.pace_gap >= 8].dropna(subset=["over"]); b = early.dropna(subset=["over"])
print(f"\nMECHANISM (wk1-3, fast-coach≥+8): line {c.total_close.mean():.1f} actual {c.actual_total.mean():.1f} "
      f"diff {c.actual_total.mean()-c.total_close.mean():+.2f}  vs baseline diff {b.actual_total.mean()-b.total_close.mean():+.2f}")
