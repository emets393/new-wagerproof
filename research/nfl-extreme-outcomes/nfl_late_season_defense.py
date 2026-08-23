"""LATE-SEASON DEFENSE theory — PRE-REGISTERED battery (owner 2026-08-23).

Theory: from late November (wk12+) good defenses peak and bad/average offenses regress, so
(a) teams with the better defense cover more, (b) games go UNDER more, (c) team totals of
offenses facing good defenses go under. Test by THRESHOLDS of the quality gap, not "better".

Data: team_week.parquet entering-week season-to-date EPA (2018-2025; leak-safe, asserted),
nfl_analysis_base results/lines (closing). Regular season only, week >= 5 so s2d is real.
Periods: MID = wk5-11, LATE = wk12-18 (the comparison the theory needs).
Metrics: def_epa = 0.6*pass_epa_allowed + 0.4*rush_epa_allowed (lower = better);
         off_epa = 0.6*pass + 0.4*rush (higher = better).
Grading: fg_covered / ou_result / tt_over flags from the warehouse (closing lines).
Per-season splits on every LATE cell; baselines = the same period's blind rate.
"""
import numpy as np, pandas as pd

tw = pd.read_parquet("data/team_week.parquet")
tw["def_epa"] = 0.6 * tw.def_pass_epa_allowed_neutral_s2d + 0.4 * tw.def_rush_epa_allowed_neutral_s2d
tw["off_epa"] = 0.6 * tw.off_pass_epa_neutral_s2d + 0.4 * tw.off_rush_epa_neutral_s2d
# leak-safety: entering-week convention => week-1 rows carry no plays
wk1 = tw[tw.week == 1]
entering = wk1.off_plays_seen.fillna(0).eq(0).mean() > 0.9
if not entering:   # stats include the current game -> shift one week within season
    tw = tw.sort_values(["season", "team", "week"])
    for c in ("def_epa", "off_epa", "def_pts_per_drive_allowed_s2d", "off_pts_per_drive_s2d"):
        tw[c] = tw.groupby(["season", "team"])[c].shift(1)
print(f"team_week entering-week convention: {entering} (shift applied: {not entering})")

NORM = {"LAR": "LA", "WSH": "WAS", "JAC": "JAX", "OAK": "LV", "SD": "LAC"}
CITY2AB = {"Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR","Chicago":"CHI","Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN","Detroit":"DET","Green Bay":"GB","Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX","Kansas City":"KC","LA Rams":"LA","LA Chargers":"LAC","Las Vegas":"LV","Miami":"MIA","Minnesota":"MIN","New England":"NE","New Orleans":"NO","NY Giants":"NYG","NY Jets":"NYJ","Philadelphia":"PHI","Pittsburgh":"PIT","Seattle":"SEA","San Francisco":"SF","Tampa Bay":"TB","Tennessee":"TEN","Washington":"WAS","Oakland":"LV","San Diego":"LAC","St. Louis":"LA"}
tw["team"] = tw.team.map(CITY2AB).fillna(tw.team).replace(NORM)
nab = pd.read_parquet("data/nab_cache.parquet")
nab = nab[(nab.season_type == "regular") & (nab.week >= 5)].copy()
nab["team_abbr"] = nab.team_abbr.replace(NORM); nab["opponent_abbr"] = nab.opponent_abbr.replace(NORM)
f = tw[["season", "week", "team", "def_epa", "off_epa", "def_pts_per_drive_allowed_s2d", "off_pts_per_drive_s2d"]]
d = nab.merge(f, left_on=["season", "week", "team_abbr"], right_on=["season", "week", "team"], how="inner") \
       .merge(f.rename(columns={"team": "opp", "def_epa": "opp_def_epa", "off_epa": "opp_off_epa",
                                "def_pts_per_drive_allowed_s2d": "opp_def_ppd", "off_pts_per_drive_s2d": "opp_off_ppd"}),
              left_on=["season", "week", "opponent_abbr"], right_on=["season", "week", "opp"], how="inner")
d["period"] = np.where(d.week >= 12, "LATE", "MID")
d["def_gap"] = d.opp_def_epa - d.def_epa          # + = this team's defense is better
d["avg_def"] = (d.def_epa + d.opp_def_epa) / 2    # lower = two good defenses
print(f"team-games: {len(d)} | seasons {sorted(d.season.unique())} | LATE share {(d.period=='LATE').mean()*100:.0f}%")
SEAS = sorted(d.season.unique())

def cell(lbl, s, col, per_season=True):
    s = s.dropna(subset=[col])
    if len(s) < 25:
        print(f"    {lbl:46s} n={len(s)} (<25)"); return
    hit = s[col].mean() * 100
    ps = " ".join(f"{y}:{s[s.season==y][col].mean()*100:.0f}" for y in SEAS if (s.season==y).sum() >= 5) if per_season else ""
    print(f"    {lbl:46s} n={len(s):4d} {hit:5.1f}%  [{ps}]")

print("\n=== A. SPREAD: better-DEFENSE team covers? (one row per game = the better-defense side) ===")
for per in ("MID", "LATE"):
    base = d[d.period == per].fg_covered.mean() * 100
    print(f"  {per}: blind cover baseline {base:.1f}%")
    for thr in (0.03, 0.06, 0.10):
        cell(f"def gap >= {thr:.2f} EPA/play", d[(d.period == per) & (d.def_gap >= thr)], "fg_covered", per_season=(per == "LATE"))
    cell("def gap >= 0.06 AND team is DOG", d[(d.period == per) & (d.def_gap >= 0.06) & (~d.is_favorite.astype(bool))], "fg_covered", per == "LATE")
    cell("def gap >= 0.06 AND team is FAV", d[(d.period == per) & (d.def_gap >= 0.06) & (d.is_favorite.astype(bool))], "fg_covered", per == "LATE")
    cell("pts/drive-allowed gap >= 0.4 (robustness)", d[(d.period == per) & ((d.opp_def_ppd - d.def_pts_per_drive_allowed_s2d) >= 0.4)], "fg_covered", per == "LATE")

print("\n=== B. TOTALS: UNDER rate (home rows only, one per game) ===")
h = d[d.is_home.astype(bool)].copy(); h["under"] = 1 - h.ou_result
for per in ("MID", "LATE"):
    hp = h[h.period == per]
    print(f"  {per}: blind UNDER baseline {hp.under.mean()*100:.1f}%")
    for thr in (-0.03, -0.05, -0.08):
        cell(f"both defenses good: avg def_epa <= {thr:+.2f}", hp[hp.avg_def <= thr], "under", per == "LATE")
    cell("one ELITE defense (either <= -0.10)", hp[(hp.def_epa <= -0.10) | (hp.opp_def_epa <= -0.10)], "under", per == "LATE")
    cell("both defenses BAD (avg >= +0.05)", hp[hp.avg_def >= 0.05], "under", per == "LATE")
    cell("good D vs bad O (either matchup)", hp[((hp.def_epa <= -0.05) & (hp.opp_off_epa <= -0.03)) | ((hp.opp_def_epa <= -0.05) & (hp.off_epa <= -0.03))], "under", per == "LATE")

print("\n=== C. TEAM TOTALS (2023-25 only): this team's TT UNDER rate ===")
t = d.dropna(subset=["tt_over"]).copy(); t["tt_under"] = 1 - t.tt_over
for per in ("MID", "LATE"):
    tp = t[t.period == per]
    print(f"  {per}: blind TT-under baseline {tp.tt_under.mean()*100:.1f}%")
    for thr in (-0.05, -0.08, -0.10):
        cell(f"facing good defense: opp def_epa <= {thr:+.2f}", tp[tp.opp_def_epa <= thr], "tt_under", per == "LATE")
    cell("own offense bad/avg: off_epa <= median", tp[tp.off_epa <= tp.off_epa.median()], "tt_under", per == "LATE")
    cell("bad/avg offense FACING good D (<=-0.05)", tp[(tp.off_epa <= tp.off_epa.median()) & (tp.opp_def_epa <= -0.05)], "tt_under", per == "LATE")
    cell("good offense facing good D", tp[(tp.off_epa > tp.off_epa.median()) & (tp.opp_def_epa <= -0.05)], "tt_under", per == "LATE")

print("\n=== D. MECHANISM: does good D get better / bad O get worse late? (realized points) ===")
d["def_q"] = d.groupby(["season", "week"]).def_epa.rank(pct=True)   # low pct = best defense entering
d["off_q"] = d.groupby(["season", "week"]).off_epa.rank(pct=True)   # high pct = best offense
for lbl, mask in [("top-quartile DEFENSES: pts ALLOWED", d.def_q <= 0.25), ("bottom-quartile DEFENSES: pts ALLOWED", d.def_q >= 0.75),
                  ("top-quartile OFFENSES: pts SCORED", d.off_q >= 0.75), ("bottom-half OFFENSES: pts SCORED", d.off_q <= 0.5),
                  ("ALL teams: pts scored", d.def_q.notna())]:
    col = "opp_score" if "ALLOWED" in lbl else "team_score"
    m, l = d[mask & (d.period == "MID")][col].mean(), d[mask & (d.period == "LATE")][col].mean()
    print(f"    {lbl:40s} MID {m:5.1f}  LATE {l:5.1f}  delta {l-m:+.1f}")
tot = h.groupby("period").apply(lambda s: pd.Series({"avg_total_line": s.fg_total.mean(), "avg_actual": (s.team_score + s.opp_score).mean()}))
print("    league total line vs actual:\n" + tot.round(1).to_string())

print("\n\n######## PASS 2: percentile thresholds + midseason stability + week bands ########")
print(f"def_epa scale: std {d.def_epa.std():.3f}, p10 {d.def_epa.quantile(.1):+.3f}, p90 {d.def_epa.quantile(.9):+.3f}")
d["band"] = pd.cut(d.week, [4, 8, 11, 14, 18], labels=["wk5-8", "wk9-11", "wk12-14", "wk15-18"])
d["opp_def_q"] = d.groupby(["season", "week"]).opp_def_epa.rank(pct=True)
d["opp_off_q"] = d.groupby(["season", "week"]).opp_off_epa.rank(pct=True)
d["gap_q"] = d.opp_def_q - d.def_q      # + = this team's D ranks better (lower pct) than opp's
def cellp(lbl, s, col):
    s = s.dropna(subset=[col])
    if len(s) < 25: print(f"    {lbl:50s} n={len(s)} (<25)"); return
    ps = " ".join(f"{y}:{s[s.season==y][col].mean()*100:.0f}" for y in SEAS if (s.season==y).sum() >= 5)
    roi = np.mean(np.where(s[col] == 1, 100/110, -1.0)) * 100
    print(f"    {lbl:50s} n={len(s):4d} {s[col].mean()*100:5.1f}% ROI {roi:+5.1f} [{ps}]")

print("\n=== A2. SPREAD by week band: team whose DEFENSE ranks >=40 percentile points better than opp ===")
for b in ("wk5-8", "wk9-11", "wk12-14", "wk15-18"):
    cellp(f"{b}: better-D team covers", d[(d.band == b) & (d.gap_q >= 0.40)], "fg_covered")
print("  -- the FADE: bet AGAINST the better-defense team (its opponent), gap >= 40 pct pts --")
d["fade_cov"] = 1 - d.fg_covered
for per in ("MID", "LATE"):
    cellp(f"{per}: fade better-D team", d[(d.period == per) & (d.gap_q >= 0.40)], "fade_cov")
    cellp(f"{per}: fade better-D team, gap >= 60 pct pts", d[(d.period == per) & (d.gap_q >= 0.60)], "fade_cov")
    cellp(f"{per}: fade top-25% D vs bottom-25% D", d[(d.period == per) & (d.def_q <= 0.25) & (d.opp_def_q >= 0.75)], "fade_cov")

print("\n=== B2. TOTALS, percentile-defined (home rows) ===")
h = d[d.is_home.astype(bool)].copy(); h["under"] = 1 - h.ou_result
for per in ("MID", "LATE"):
    hp = h[h.period == per]
    print(f"  {per}: blind UNDER {hp.under.mean()*100:.1f}%")
    cellp("both defenses top-third", hp[(hp.def_q <= 1/3) & (hp.opp_def_q <= 1/3)], "under")
    cellp("an elite D (top 15%) in the game", hp[(hp.def_q <= 0.15) | (hp.opp_def_q <= 0.15)], "under")
    cellp("top-25% D vs bottom-25% O (either side)", hp[((hp.def_q <= .25) & (hp.opp_off_q <= .25)) | ((hp.opp_def_q <= .25) & (hp.off_q <= .25))], "under")
    cellp("both offenses bottom-third", hp[(hp.off_q <= 1/3) & (hp.opp_off_q <= 1/3)], "under")
    cellp("both defenses bottom-third", hp[(hp.def_q >= 2/3) & (hp.opp_def_q >= 2/3)], "under")

print("\n=== C2. TEAM TOTALS 2023-25, percentile-defined ===")
t = d.dropna(subset=["tt_over"]).copy(); t["tt_under"] = 1 - t.tt_over
for per in ("MID", "LATE"):
    tp = t[t.period == per]
    print(f"  {per}: blind TT-under {tp.tt_under.mean()*100:.1f}%")
    cellp("facing top-25% defense", tp[tp.opp_def_q <= 0.25], "tt_under")
    cellp("facing top-15% defense", tp[tp.opp_def_q <= 0.15], "tt_under")
    cellp("bottom-third offense (any opp)", tp[tp.off_q <= 1/3], "tt_under")
    cellp("bottom-third O facing top-25% D", tp[(tp.off_q <= 1/3) & (tp.opp_def_q <= .25)], "tt_under")
    cellp("top-third O facing top-25% D", tp[(tp.off_q >= 2/3) & (tp.opp_def_q <= .25)], "tt_under")
    cellp("top-third O facing bottom-25% D (TT OVER side)", tp[(tp.off_q >= 2/3) & (tp.opp_def_q >= .75)], "tt_over")

print("\n=== D2. mechanism by week band (realized points) ===")
for lbl, mask, col in [("top-25% D pts allowed", d.def_q <= .25, "opp_score"), ("bottom-25% D pts allowed", d.def_q >= .75, "opp_score"),
                       ("top-25% O pts scored", d.off_q >= .75, "team_score"), ("bottom-33% O pts scored", d.off_q <= 1/3, "team_score")]:
    print("    " + f"{lbl:26s}" + "  ".join(f"{b}:{d[mask & (d.band==b)][col].mean():5.1f}" for b in ("wk5-8","wk9-11","wk12-14","wk15-18")))
