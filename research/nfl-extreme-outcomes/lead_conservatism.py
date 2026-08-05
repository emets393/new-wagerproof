"""LEAD CONSERVATISM study (owner-corrected construct, pre-registered 2026-08-05).

Not season stakes — IN-GAME behavior: when a coach's team reaches a lead state, how much
does his play-calling tighten vs his own neutral baseline?

INDEX (per coach-season, offensive plays only):
  PROE_state = mean(pass - xpass)  [xpass controls for score/down/distance -> isolates choice]
  states: NEUTRAL  wp .25-.75, Q1-3     LEAD  wp .75-.95, Q3-4      (min 60 plays each)
  conservatism = PROE_neutral - PROE_lead   (positive = tightens up with a lead)

TESTS (prior-season index = leak-safe; graded at the close; per-season; sign-asserted):
  0. STABILITY  year-over-year corr of the index per coach — if ~0, stop (b42 lesson).
  1. FAV CELL   favorites laying 7+ : cover% by fav coach's index tercile.
  2. BACKDOOR   games entering Q4 at wp .80-.95 for the leader: trailing side ATS by the
                LEADING coach's tercile.
  3. TOTALS     both coaches top-tercile conservative -> under%.
  4. PLACEBO    cell 1 re-run 200x with indices shuffled across coaches within season.
"""
import numpy as np
import pandas as pd
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"
rng = np.random.default_rng(0)

# ---- plays 2012-2025 ----
frames = []
for y in range(2012, 2026):
    d = pd.read_parquet(DATA / "pbp_cache" / f"pbpslim_{y}.parquet",
                        columns=["game_id", "season", "week", "season_type", "posteam",
                                 "home_team", "away_team", "pass", "rush", "xpass", "wp", "qtr",
                                 "half_seconds_remaining"])
    frames.append(d)
pl = pd.concat(frames, ignore_index=True)
pl = pl[(pl.season_type == "REG") & pl.posteam.notna() & pl.xpass.notna()
        & ((pl["pass"] == 1) | (pl.rush == 1)) & pl.wp.notna()]

g = pd.read_parquet(DATA / "nflverse_games.parquet")
g = g[g.game_type == "REG"].copy()
coach_map = {}
for r in g.itertuples():
    coach_map[(r.game_id, r.home_team)] = r.home_coach
    coach_map[(r.game_id, r.away_team)] = r.away_coach
pl["coach"] = [coach_map.get((gi, t)) for gi, t in zip(pl.game_id, pl.posteam)]
pl = pl[pl.coach.notna()]
pl["proe"] = pl["pass"] - pl.xpass
pl["state"] = np.where((pl.wp.between(0.25, 0.75)) & (pl.qtr <= 3), "neutral",
              np.where((pl.wp.between(0.75, 0.95)) & (pl.qtr >= 3), "lead", None))

prof = (pl[pl.state.notna()].groupby(["season", "coach", "state"])
        .agg(proe=("proe", "mean"), n=("proe", "size")).reset_index()
        .pivot_table(index=["season", "coach"], columns="state", values=["proe", "n"]))
prof.columns = [f"{a}_{b}" for a, b in prof.columns]
prof = prof.reset_index()
prof = prof[(prof.n_neutral >= 100) & (prof.n_lead >= 60)]
prof["conserv"] = prof.proe_neutral - prof.proe_lead
print(f"coach-seasons with an index: {len(prof)} | mean shift {prof.conserv.mean():+.3f} "
      f"(positive = tightens with a lead)")

# ---- 0) STABILITY ----
a = prof[["season", "coach", "conserv"]].copy(); a["season"] += 1
st = prof.merge(a, on=["season", "coach"], suffixes=("", "_prev"))
r = np.corrcoef(st.conserv, st.conserv_prev)[0, 1]
print(f"[stability] year-over-year corr (same coach, n={len(st)}): {r:+.3f}")

# 2025 leaderboard for the report
p25 = prof[prof.season == 2025].sort_values("conserv")
print("\n2025 most AGGRESSIVE with a lead (smallest tighten):")
print(p25.head(5)[["coach", "conserv"]].round(3).to_string(index=False))
print("2025 most CONSERVATIVE with a lead:")
print(p25.tail(5)[["coach", "conserv"]].round(3).to_string(index=False))

# ---- betting frame (prior-season index) ----
ge = pd.read_parquet(DATA / "games_enriched.parquet")
ge = ge[(ge.game_type == "REG") & ge.result.notna() & ge.spread_line.notna()
        & (ge.season >= 2013)].copy()
ge["ats_h"] = ge.result - ge.spread_line          # nflverse: spread_line>0 = home favored
fav = ge.spread_line > 0
cover_rate = ((ge.ats_h > 0)[fav]).mean()
assert 0.43 < cover_rate < 0.57, f"sign check failed {cover_rate:.3f}"

idx = prof.set_index(["season", "coach"]).conserv
ge["h_coach"] = [coach_map.get((gi, t)) for gi, t in zip(ge.game_id, ge.home_team)]
ge["a_coach"] = [coach_map.get((gi, t)) for gi, t in zip(ge.game_id, ge.away_team)]
ge["h_cons"] = [idx.get((s - 1, c), np.nan) for s, c in zip(ge.season, ge.h_coach)]
ge["a_cons"] = [idx.get((s - 1, c), np.nan) for s, c in zip(ge.season, ge.a_coach)]
# within-season terciles of the PRIOR-year index (relative, handles league drift)
terc = {}
for s, grp in prof.groupby("season"):
    terc[s + 1] = (grp.conserv.quantile(1 / 3), grp.conserv.quantile(2 / 3))
def tier(s, v):
    if pd.isna(v) or s not in terc: return None
    lo, hi = terc[s]
    return "aggr" if v <= lo else ("cons" if v >= hi else "mid")
ge["h_tier"] = [tier(s, v) for s, v in zip(ge.season, ge.h_cons)]
ge["a_tier"] = [tier(s, v) for s, v in zip(ge.season, ge.a_cons)]

# ---- 1) FAV CELL ----
print("\n=== 1) favorites laying 7+ — cover% by the FAVORITE coach's lead-conservatism tier ===")
d = ge[ge.ats_h != 0].copy()
d["fav_home"] = d.spread_line > 0
d["fav_lay"] = d.spread_line.abs()
d["fav_tier"] = np.where(d.fav_home, d.h_tier, d.a_tier)
d["fav_cover"] = np.where(d.fav_home, d.ats_h > 0, d.ats_h < 0)
big = d[(d.fav_lay >= 7) & d.fav_tier.notna()]
for t in ("aggr", "mid", "cons"):
    b = big[big.fav_tier == t]
    by = b.groupby("season").fav_cover.mean()
    print(f"  {t:4s}: n={len(b):4d} fav covers {b.fav_cover.mean()*100:5.1f}% | +szn {(by>=0.5).sum()}/{by.notna().sum()}")

# ---- 2) BACKDOOR ----
print("\n=== 2) leader at Q4 start wp .80-.95 — TRAILING side ATS by LEADING coach's tier ===")
q4 = pl_first = None
q4rows = []
first_q4 = (pd.concat(frames, ignore_index=True))
first_q4 = first_q4[(first_q4.qtr == 4) & first_q4.wp.notna() & first_q4.posteam.notna()]
first_q4 = first_q4.sort_values("half_seconds_remaining", ascending=False).groupby("game_id").head(1)
for r in first_q4.itertuples():
    lead_team = r.posteam if r.wp >= 0.5 else (r.away_team if r.posteam == r.home_team else r.home_team)
    lead_wp = r.wp if r.wp >= 0.5 else 1 - r.wp
    q4rows.append(dict(game_id=r.game_id, lead_team=lead_team, lead_wp=lead_wp))
q4 = pd.DataFrame(q4rows)
m = ge.merge(q4, on="game_id", how="inner")
m = m[m.lead_wp.between(0.80, 0.95) & (m.ats_h != 0)].copy()
m["lead_is_home"] = m.lead_team == m.home_team
m["lead_tier"] = np.where(m.lead_is_home, m.h_tier, m.a_tier)
m["trail_covers"] = np.where(m.lead_is_home, m.ats_h < 0, m.ats_h > 0)
for t in ("aggr", "mid", "cons"):
    b = m[m.lead_tier == t]
    if len(b) < 40: print(f"  {t:4s}: n={len(b)} thin"); continue
    by = b.groupby("season").trail_covers.mean()
    print(f"  {t:4s}: n={len(b):4d} trailer covers {b.trail_covers.mean()*100:5.1f}% | +szn {(by>=0.5).sum()}/{by.notna().sum()}")

# ---- 3) TOTALS ----
print("\n=== 3) BOTH coaches top-tercile conservative — game under% ===")
tt = ge[ge.total_line.notna() & (ge.total.notna() if "total" in ge.columns else True)].copy()
tt["atot"] = tt.home_score + tt.away_score
tt = tt[tt.atot != tt.total_line]
both = tt[(tt.h_tier == "cons") & (tt.a_tier == "cons")]
base = tt[tt.h_tier.notna() & tt.a_tier.notna()]
for lab, b in (("both conservative", both), ("all matched games", base)):
    if len(b) < 40: print(f"  {lab}: n={len(b)} thin"); continue
    by = b.groupby("season").apply(lambda x: (x.atot < x.total_line).mean())
    print(f"  {lab:18s}: n={len(b):4d} under {(b.atot < b.total_line).mean()*100:5.1f}% | +szn {(by>=0.5).sum()}/{by.notna().sum()}")

# ---- 4) PLACEBO for cell 1 ----
obs = (big[big.fav_tier == "cons"].fav_cover.mean() - big[big.fav_tier == "aggr"].fav_cover.mean())
diffs = []
coach_vals = prof.groupby("season").apply(lambda ggg: ggg[["coach", "conserv"]])
for _ in range(200):
    sh = {}
    for s, grp in prof.groupby("season"):
        v = grp.conserv.values.copy(); rng.shuffle(v)
        for c, vv in zip(grp.coach, v): sh[(s, c)] = vv
    hv = [sh.get((s - 1, c), np.nan) for s, c in zip(d.season, d.h_coach)]
    av = [sh.get((s - 1, c), np.nan) for s, c in zip(d.season, d.a_coach)]
    d["_ht"] = [tier(s, v) for s, v in zip(d.season, hv)]
    d["_at"] = [tier(s, v) for s, v in zip(d.season, av)]
    ft = np.where(d.fav_home, d._ht, d._at)
    bb = d[(d.fav_lay >= 7) & pd.Series(ft, index=d.index).notna()]
    fts = pd.Series(ft, index=d.index).loc[bb.index]
    diffs.append(bb[fts == "cons"].fav_cover.mean() - bb[fts == "aggr"].fav_cover.mean())
diffs = pd.Series(diffs)
print(f"\n=== 4) placebo (200 shuffles) === observed cons-aggr gap {obs*100:+.1f}pp | "
      f"null 5-95%: [{diffs.quantile(.05)*100:+.1f}, {diffs.quantile(.95)*100:+.1f}]pp | "
      f"p(|null|>=|obs|) = {(diffs.abs() >= abs(obs)).mean():.2f}")
