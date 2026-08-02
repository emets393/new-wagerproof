"""Bet test for the NFL coach scheme-transfer finding (port of cfb-model/coach_pace_betting.py).
When a new HC's prior team played much FASTER/slower than his new team, the early total is anchored on
last year's tempo — but the team adopts the coach's pace (~59% of the gap in yr 1). So wk1-3 should lean
OVER when a fast coach takes a slow team, UNDER when a slow coach takes a fast team. Test totals at the
CLOSE, per-season, wk1-3 vs wk4+, with complement + mechanism. Also a light ATS look.

Close/finals from nflverse_games.parquet (total_line/spread_line = closing lines; total/result = finals).
This is the documented full-history fallback (the Odds-API archive only covers 2023+); single-source
rule governs the LIVE product, this is the research backtest.
"""
import numpy as np
import pandas as pd
import warnings
warnings.filterwarnings("ignore")
DEC = 1.909

mv = pd.read_parquet("data/nfl_coach_moves.parquet")
mv = mv.dropna(subset=["coach_prior_pace", "new_prior_pace"]).copy()
mv["pace_gap"] = mv.coach_prior_pace - mv.new_prior_pace       # >0 = coach faster than the team was
gapmap = {(int(r.year), r.team): r.pace_gap for _, r in mv.iterrows()}

g = pd.read_parquet("data/nflverse_games.parquet")
g = g[g.game_type == "REG"].dropna(subset=["total_line", "total", "spread_line", "result"]).copy()
rows = []
for s in ("home", "away"):
    d = g[["season", "week", f"{s}_team", "total_line", "total", "spread_line", "result"]].rename(
        columns={f"{s}_team": "team"})
    # this team's ATS margin vs close: home covers if (result + spread_line_home) ; nflverse spread_line
    # is the HOME line (home_score-away_score+spread_line>0 => home covers). away margin = -result.
    d["ats_margin"] = (g["result"] + g["spread_line"]).values if s == "home" else (-g["result"] - g["spread_line"]).values
    rows.append(d)
tg = pd.concat(rows, ignore_index=True)
tg["pace_gap"] = [gapmap.get((int(se), t), np.nan) for se, t in zip(tg.season, tg.team)]
tg = tg.dropna(subset=["pace_gap"]).copy()
tg["over"] = np.where(tg.total == tg.total_line, np.nan, (tg.total > tg.total_line).astype(float))
tg["cover"] = np.where(tg.ats_margin == 0, np.nan, (tg.ats_margin > 0).astype(float))

def stat(d, col="over", want=True):
    d = d.dropna(subset=[col])
    if len(d) < 20:
        return f"  n={len(d):3d} (thin) {'hit '+format(d[col].mean() if want else 1-d[col].mean(),'.0%') if len(d) else ''}"
    p = d[col].mean() if want else 1 - d[col].mean()
    by = d.groupby("season")[col].apply(lambda x: x.mean() if want else 1 - x.mean())
    return f"{p*100:5.1f}%  n={len(d):3d}  ROI {(p*DEC-1)*100:+6.1f}  seasons {(by>=0.5).sum()}/{by.notna().sum()}"

early = tg[tg.week <= 3]; late = tg[tg.week >= 4]
print("=" * 90); print("NEW-COACH team TOTALS by pace gap (grade at close, wk1-3 vs wk4+)"); print("=" * 90)
print("FAST coach -> slow team (pace_gap >= +8) -> expect OVER:")
print("  weeks 1-3:", stat(early[early.pace_gap >= 8], "over", True))
print("  weeks 4+ :", stat(late[late.pace_gap >= 8], "over", True))
print("SLOW coach -> fast team (pace_gap <= -8) -> expect UNDER:")
print("  weeks 1-3:", stat(early[early.pace_gap <= -8], "over", False))
print("  weeks 4+ :", stat(late[late.pace_gap <= -8], "over", False))
print("\nDose-response (weeks 1-3, OVER side, rising fast-coach gap):")
for thr in [4, 8, 12]:
    print(f"  pace_gap >= +{thr:2d}: {stat(early[early.pace_gap >= thr], 'over', True)}")
print("Complement (weeks 1-3, slow-coach gap, OVER side — should be < 50%):")
for thr in [4, 8, 12]:
    print(f"  pace_gap <= -{thr:2d}: {stat(early[early.pace_gap <= -thr], 'over', True)}")

# mechanism: is the early total inflated/deflated vs actual for the fast-coach cell?
c = early[early.pace_gap >= 8].dropna(subset=["over"]); b = early.dropna(subset=["over"])
if len(c):
    print(f"\nMECHANISM (wk1-3, fast-coach>=+8): line {c.total_line.mean():.1f} actual {c.total.mean():.1f} "
          f"diff {c.total.mean()-c.total_line.mean():+.2f}  vs baseline diff {b.total.mean()-b.total_line.mean():+.2f}")

print("\n" + "=" * 90); print("Light ATS look — do new-coach teams cover more early? (secondary; pace drives totals not sides)"); print("=" * 90)
print("  new-coach teams wk1-3 ATS:", stat(early, "cover", True))
print("  new-coach teams wk4+  ATS:", stat(late, "cover", True))
print("  fast-coach (gap>=+8) wk1-3 ATS:", stat(early[early.pace_gap >= 8], "cover", True))
