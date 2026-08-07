"""NFL coaching scheme-transfer study — port of research/cfb-model/coach_moves_study.py.

When an NFL head coach moves team A -> B, does B's STYLE (pace, PROE/pass-rate, EPA/play, explosive
rate) shift TOWARD how A played under him? Measures year-1 convergence, then a wk1-3 betting angle
(see nfl_coach_moves_betting.py). Same method + guardrails as the validated CFB study.

Coach -> team -> season from nflverse_games.parquet (home_coach/away_coach, full history).
Style from nflverse PBP 2012-2025 (data/pbp_cache/pbpslim_*.parquet). PROE = pass-over-expected
(pass - xpass) on neutral early downs — the cleanest scheme-identity metric.

NB: NFL's biggest scheme lever is often the OC, not the HC; nflverse only carries HC, so this is the
tractable v1. OC moves = a follow-up (needs a PFR scrape).
"""
import glob
import numpy as np
import pandas as pd
import warnings
warnings.filterwarnings("ignore")

DIMS = ["pace", "proe", "pass_rate", "epa_play", "explosive"]

# 1) coach-season table: per (season, team) the head coach (mode of home/away_coach) --------------
g = pd.read_parquet("data/nflverse_games.parquet")
g = g[g.game_type == "REG"] if "game_type" in g.columns else g
cr = []
for _, r in g.iterrows():
    if pd.notna(r.get("home_coach")): cr.append((r.season, r.home_team, r.home_coach))
    if pd.notna(r.get("away_coach")): cr.append((r.season, r.away_team, r.away_coach))
cs = pd.DataFrame(cr, columns=["year", "team", "coach"])
cs = cs.groupby(["year", "team"]).coach.agg(lambda s: s.mode().iloc[0]).reset_index()

# 2) team-season STYLE from PBP -----------------------------------------------------------------
pbp = pd.concat([pd.read_parquet(f) for f in sorted(glob.glob("data/pbp_cache/pbpslim_*.parquet"))],
                ignore_index=True)
pbp = pbp[(pbp.season_type == "REG") & (pbp.play_type.isin(["pass", "run"])) & (pbp.posteam.notna())].copy()
pbp["is_pass"] = pd.to_numeric(pbp["pass"], errors="coerce")
pbp["xpass"] = pd.to_numeric(pbp["xpass"], errors="coerce")
pbp["epa"] = pd.to_numeric(pbp["epa"], errors="coerce")
pbp["yards_gained"] = pd.to_numeric(pbp["yards_gained"], errors="coerce")
# neutral early-down mask for tendency metrics (strip game-script + clock-stop noise)
neu = ((pbp.wp >= 0.20) & (pbp.wp <= 0.80) & (pbp.down.isin([1, 2]))
       & (pbp.half_seconds_remaining > 120) & (pbp.qtr <= 4))

def agg_team_season(df):
    out = {}
    n_games = df.groupby(["season", "posteam"]).game_id.nunique().rename("g")
    plays = df.groupby(["season", "posteam"]).size().rename("plays")
    out["pace"] = (plays / n_games).rename("pace")                                   # off plays / game
    out["epa_play"] = df.groupby(["season", "posteam"]).epa.mean().rename("epa_play")
    out["explosive"] = df.groupby(["season", "posteam"]).apply(
        lambda d: (d.yards_gained >= 20).mean()).rename("explosive")
    nd = df[neu.loc[df.index]]
    out["pass_rate"] = nd.groupby(["season", "posteam"]).is_pass.mean().rename("pass_rate")
    out["proe"] = (nd.groupby(["season", "posteam"]).is_pass.mean()
                   - nd.groupby(["season", "posteam"]).xpass.mean()).rename("proe")
    st = pd.concat(out.values(), axis=1).reset_index().rename(columns={"posteam": "team"})
    return st

style = agg_team_season(pbp)
S = {(int(r.season), r.team): r for _, r in style.iterrows()}
def sty(season, team, col):
    r = S.get((int(season), team))
    return getattr(r, col) if r is not None else np.nan

# 3) HC moves: coach's FIRST year at a new team, with a prior HC stint at a DIFFERENT team --------
# NFL HCs rarely jump team->team in consecutive years (they get fired and sit out), so unlike the CFB
# port we allow a gap (up to 5 yrs) and take the coach's identity from his LAST HC season. Consecutive
# moves are the gap==1 subset. Keep only the coach's FIRST season at the new team (the transfer year).
cs = cs.sort_values(["coach", "year"])
cs["prev_team"] = cs.groupby("coach").team.shift()
cs["prev_year"] = cs.groupby("coach").year.shift()
cs["team_first_yr"] = cs.groupby(["coach", "team"]).year.transform("min")   # coach's first yr at THIS team
moves = cs[(cs.prev_team.notna()) & (cs.team != cs.prev_team) & (cs.year == cs.team_first_yr)
          & (cs.year - cs.prev_year <= 5) & (cs.year >= 2013)].copy()

# 4) attach coach's prior-team style (his LAST HC season), new-team prior style, new-team style now -
for col in DIMS:
    moves[f"coach_prior_{col}"] = [sty(py, fr, col) for py, fr in zip(moves.prev_year, moves.prev_team)]
    moves[f"new_prior_{col}"] = [sty(y - 1, to, col) for y, to in zip(moves.year, moves.team)]
    moves[f"new_now_{col}"] = [sty(y, to, col) for y, to in zip(moves.year, moves.team)]

# 5) CONVERGENCE test ---------------------------------------------------------------------------
print("=" * 92)
print("NFL COACH SCHEME TRANSFER — does the new team shift TOWARD the coach's prior style? (year 1)")
print("=" * 92)
LBL = {"pace": "PACE (off plays/game)", "proe": "PROE (pass over expected)", "pass_rate": "PASS RATE (neutral ED)",
       "epa_play": "EPA / PLAY", "explosive": "EXPLOSIVE RATE (yds>=20)"}
for col in DIMS:
    m = moves.dropna(subset=[f"coach_prior_{col}", f"new_prior_{col}", f"new_now_{col}"])
    if len(m) < 8:
        print(f"\n{LBL[col]}: n={len(m)} (thin)"); continue
    gap = m[f"coach_prior_{col}"] - m[f"new_prior_{col}"]
    shift = m[f"new_now_{col}"] - m[f"new_prior_{col}"]
    b1, b0 = np.polyfit(gap, shift, 1)
    big = m[gap.abs() >= gap.abs().quantile(0.75)]
    bigshift = big[f"new_now_{col}"] - big[f"new_prior_{col}"]
    biggap = big[f"coach_prior_{col}"] - big[f"new_prior_{col}"]
    frac = (bigshift / biggap.replace(0, np.nan)).median()
    print(f"\n{LBL[col]}: n={len(m)}  corr(gap, shift)={np.corrcoef(gap, shift)[0,1]:+.2f}  "
          f"shift={b0:+.2f}{b1:+.2f}*gap  |  big-gap moves close {frac*100:.0f}% of the gap in year 1")

# 6) biggest PACE + PROE shifts (real coach examples) -------------------------------------------
for col in ["pace", "proe"]:
    print("\n" + "=" * 92)
    print(f"Biggest coach-vs-newteam {col.upper()} gaps (did the coach drag the new team toward his identity?)")
    print("=" * 92)
    m = moves.dropna(subset=[f"coach_prior_{col}", f"new_prior_{col}", f"new_now_{col}"]).copy()
    m["gap"] = m[f"coach_prior_{col}"] - m[f"new_prior_{col}"]
    m["shift"] = m[f"new_now_{col}"] - m[f"new_prior_{col}"]
    for _, r in m.reindex(m["gap"].abs().sort_values(ascending=False).index).head(10).iterrows():
        print(f"  {int(r['year'])} {r['team']:4s} <- {r['coach']:20s} (from {r['prev_team']:4s}): "
              f"coach {r[f'coach_prior_{col}']:+6.2f} vs team-was {r[f'new_prior_{col}']:+6.2f} "
              f"-> became {r[f'new_now_{col}']:+6.2f}  (shift {r['shift']:+.2f})")

moves.to_parquet("data/nfl_coach_moves.parquet", index=False)
print(f"\nwrote data/nfl_coach_moves.parquet  ({len(moves)} HC moves 2013-{int(moves.year.max())})")
