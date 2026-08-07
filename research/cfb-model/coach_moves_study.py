"""Coaching scheme-transfer study: when a head coach moves from school A to school B, does B's STYLE
(pace, pass rate, explosiveness) shift TOWARD how A played under that coach? Validates the OK-State←North-Texas
(Eric Morris, fast) intuition across all 2016-2025 HC moves, then checks an early-season (wk1-3) betting angle.
Coach moves from CFBD /coaches (per-coach seasons array). Style from CFBD game_advanced (regular season)."""
import cfbd, glob, numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")

# 1) coach-season table (dedupe career arrays; keep the school where the coach had the most games that year)
rows = []
for yr in range(2014, 2026):
    try:
        for c in cfbd.get("/coaches", year=yr):
            nm = f"{c.get('firstName','')} {c.get('lastName','')}".strip()
            for s in c.get("seasons", []):
                rows.append({"cid": c["id"], "coach": nm, "year": s["year"], "school": s["school"], "games": s.get("games") or 0})
    except Exception as e:
        print("coach fetch", yr, "err", str(e)[:60])
cs = pd.DataFrame(rows).drop_duplicates(["cid", "year", "school"])
cs = cs.sort_values("games", ascending=False).drop_duplicates(["cid", "year"]).sort_values(["cid", "year"])

# 2) team-season offensive STYLE from game_advanced (regular season)
ga = pd.concat([pd.read_parquet(f) for f in glob.glob("data/cfbd/game_advanced_20*.parquet")], ignore_index=True)
if "seasonType" in ga: ga = ga[ga.seasonType == "regular"]
style = ga.groupby(["season", "team"]).agg(
    pace=("offense.plays", "mean"), explos=("offense.explosiveness", "mean"),
    ppa=("offense.ppa", "mean"), success=("offense.successRate", "mean")).reset_index()
# pass_rate = last as-of value per team-season (≈ full season) from model_games
mg = pd.read_parquet("data/model_games.parquet")
pr = pd.concat([mg[["season", f"{s}Team", "week", f"{s}_pass_rate"]].rename(
    columns={f"{s}Team": "team", f"{s}_pass_rate": "pass_rate"}) for s in ("home", "away")])
pr = pr.dropna(subset=["pass_rate"]).sort_values("week").groupby(["season", "team"]).pass_rate.last().reset_index()
style = style.merge(pr, on=["season", "team"], how="left")
S = {(r.season, r.team): r for _, r in style.iterrows()}
def sty(season, team, col):
    r = S.get((season, team));  return getattr(r, col) if r is not None else np.nan

# 3) HC moves: consecutive years, different school
cs["prev_school"] = cs.groupby("cid").school.shift(); cs["prev_year"] = cs.groupby("cid").year.shift()
moves = cs[(cs.prev_school.notna()) & (cs.school != cs.prev_school) & (cs.year - cs.prev_year == 1) & (cs.year >= 2017)].copy()

# 4) attach coach's prior-team style, new-team prior style, new-team style under the coach
for col in ["pace", "pass_rate", "explos", "ppa"]:
    moves[f"coach_prior_{col}"] = [sty(y - 1, fr, col) for y, fr in zip(moves.year, moves.prev_school)]
    moves[f"new_prior_{col}"] = [sty(y - 1, to, col) for y, to in zip(moves.year, moves.school)]
    moves[f"new_now_{col}"] = [sty(y, to, col) for y, to in zip(moves.year, moves.school)]

# 5) CONVERGENCE test (does the new team move toward the coach's old style?)
print("=" * 90); print("COACH SCHEME TRANSFER — does the new team shift TOWARD the coach's prior style?"); print("=" * 90)
for col, lbl in [("pace", "PACE (plays/game)"), ("pass_rate", "PASS RATE"), ("explos", "EXPLOSIVENESS")]:
    m = moves.dropna(subset=[f"coach_prior_{col}", f"new_prior_{col}", f"new_now_{col}"])
    gap = m[f"coach_prior_{col}"] - m[f"new_prior_{col}"]      # how different the coach's old team was
    shift = m[f"new_now_{col}"] - m[f"new_prior_{col}"]        # how the new team actually changed
    b1, b0 = np.polyfit(gap, shift, 1)
    # of the gap, what fraction does the team close in year 1?
    big = m[gap.abs() >= gap.abs().quantile(0.75)]
    bigshift = (big[f"new_now_{col}"] - big[f"new_prior_{col}"]); biggap = (big[f"coach_prior_{col}"] - big[f"new_prior_{col}"])
    frac = (bigshift / biggap.replace(0, np.nan)).median()
    print(f"\n{lbl}: n={len(m)}  corr(gap, actual shift)={np.corrcoef(gap, shift)[0,1]:+.2f}  "
          f"shift={b0:+.2f}{b1:+.2f}*gap  |  big-gap moves close {frac*100:.0f}% of the gap in year 1")

# 6) the biggest PACE shifts (the OK-State-type cases) — did fast coaches speed up slow teams?
print("\n" + "=" * 90); print("Biggest coach-vs-newteam PACE gaps (fast coach → slow team, or vice-versa)"); print("=" * 90)
m = moves.dropna(subset=["coach_prior_pace", "new_prior_pace", "new_now_pace"]).copy()
m["gap"] = m.coach_prior_pace - m.new_prior_pace; m["shift"] = m.new_now_pace - m.new_prior_pace
for _, r in m.reindex(m["gap"].abs().sort_values(ascending=False).index).head(12).iterrows():
    sh = r["shift"]
    arrow = "→ sped up" if sh > 1 else ("→ slowed down" if sh < -1 else "→ ~same")
    print(f"  {int(r['year'])} {r['school']:16s} <- {r['coach']:20s} (from {r['prev_school']:15s}): "
          f"coach {r['coach_prior_pace']:4.1f} vs team-was {r['new_prior_pace']:4.1f} → became {r['new_now_pace']:4.1f}  {arrow}")

moves.to_parquet("data/coach_moves.parquet", index=False)
print(f"\nwrote data/coach_moves.parquet  ({len(moves)} HC moves 2017-2025)")
