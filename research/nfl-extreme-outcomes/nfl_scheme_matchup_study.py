"""Scheme-matchup battery — SIDES + TOTALS (RESEARCH ONLY). Grades at the close
(nflverse_games spread_line/total_line), weeks 4-18 (as-of windows populated), per-season, with
complements and sigma. Perspective = one row per (game, offense-team).

H1  VERTICAL vs TWO-HIGH: top-quartile deep-ball offense vs top-quartile two-high defense ->
    fewer explosive completions -> UNDER? and fade the offense ATS?
H2  RECENT FORM vs DEFENSE TYPE (the owner's hypothesis): an offense whose pass EPA in its RECENT
    games against two-high-heavy defenses is bottom-quartile, facing another two-high-heavy defense
    -> fade the offense ATS / UNDER. (Also the man-heavy version.)
H3  BLITZ vs SLOW RELEASE (2022+, FTN): top-quartile blitz defense vs top-quartile time-to-throw
    offense -> pressure -> UNDER / fade offense.
Each with its COMPLEMENT cell (the opposite matchup) — a real effect should flip or vanish.
"""
import numpy as np
import pandas as pd
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"
DEC = 1.909

ds = pd.read_parquet(DATA / "nfl_def_scheme.parquet")
os_ = pd.read_parquet(DATA / "nfl_off_scheme.parquet")
g = pd.read_parquet(DATA / "nflverse_games.parquet")
g = g[(g.game_type == "REG") & g.spread_line.notna() & g.result.notna() & g.total_line.notna() & g.total.notna()]

rows = []
for _, r in g.iterrows():
    rows.append(dict(season=r.season, week=r.week, off=r.home_team, deft=r.away_team,
                     ats_margin=r.result - r.spread_line, total=r.total, total_line=r.total_line))
    rows.append(dict(season=r.season, week=r.week, off=r.away_team, deft=r.home_team,
                     ats_margin=-r.result + r.spread_line, total=r.total, total_line=r.total_line))
t = pd.DataFrame(rows)
t = t.merge(os_.rename(columns={"team": "off"}), on=["season", "week", "off"], how="left")
t = t.merge(ds.rename(columns={"team": "deft"}), on=["season", "week", "deft"], how="left")
t = t[(t.week >= 4) & (t.week <= 18)].copy()
t["cover"] = np.where(t.ats_margin == 0, np.nan, (t.ats_margin > 0).astype(float))
t["over"] = np.where(t.total == t.total_line, np.nan, (t.total > t.total_line).astype(float))
# within-season quartile ranks (leak-safe: the profile cols are already as-of)
for c in ["deep_rate_l8", "adot_l8", "tt_l8"]:
    t[f"{c}_q"] = t.groupby("season")[c].transform(lambda s: s.rank(pct=True))
for c in ["two_high_rate_l8", "man_rate_l8", "blitzers_l8", "pressure_rate_l8"]:
    t[f"{c}_q"] = t.groupby("season")[c].transform(lambda s: s.rank(pct=True))


def cell(d, col, want_true=True, lbl=""):
    d = d.dropna(subset=[col])
    if len(d) < 40:
        print(f"    {lbl:44} n={len(d)} (thin)"); return
    p = d[col].mean() if want_true else 1 - d[col].mean()
    roi = (p * DEC - 1) * 100
    sg = 100 * np.sqrt(p * (1 - p)) * DEC / np.sqrt(len(d))
    by = d.groupby("season")[col].apply(lambda x: (x.mean() if want_true else 1 - x.mean()))
    ok = (by >= 0.5).sum()
    print(f"    {lbl:44} n={len(d):4d} hit={p*100:5.1f}% ROI={roi:+6.1f} sig={sg:4.1f} seasons {ok}/{by.notna().sum()}")


print("=" * 100)
print("H1 — VERTICAL offense (deep_rate_l8 top-25%) vs TWO-HIGH defense (two_high_rate_l8 top-25%)")
print("=" * 100)
h1 = t[(t.deep_rate_l8_q >= 0.75) & (t.two_high_rate_l8_q >= 0.75)]
cell(h1, "over", False, "UNDER the total")
cell(h1, "cover", False, "FADE the vertical offense ATS")
print("  complement: vertical offense vs SINGLE-high-heavy D (two_high bottom-25%)")
c1 = t[(t.deep_rate_l8_q >= 0.75) & (t.two_high_rate_l8_q <= 0.25)]
cell(c1, "over", False, "UNDER the total")
cell(c1, "cover", False, "FADE the offense ATS")

print("\n" + "=" * 100)
print("H2 — OWNER: offense's RECENT pass EPA vs THIS defense type is poor -> fade when it faces the type again")
print("=" * 100)
# offense's per-game pass EPA came from off_scheme's weekly base... recompute per-game pass EPA quickly
sp = pd.read_parquet(DATA / "scheme_plays.parquet")
pe = sp[sp["pass"] == 1].groupby(["season", "week", "posteam"]).epa.mean().reset_index().rename(
    columns={"posteam": "off", "epa": "game_pass_epa"})
t2 = t.merge(pe, on=["season", "week", "off"], how="left")
# tag each historical game by whether the DEFENSE faced was two-high-heavy (top-half within season)
t2["opp_was_2high"] = (t2.two_high_rate_l8_q >= 0.5).astype(float)
t2 = t2.sort_values(["off", "season", "week"])
# rolling as-of: offense's mean pass EPA over its LAST 4 games vs two-high-heavy defenses
def roll_vs_type(d, flagcol, valcol, w=4):
    v = d[valcol].where(d[flagcol] == 1)
    return v.shift(1).rolling(window=12, min_periods=2).apply(lambda s: np.nanmean(s[-w:]) if np.isfinite(s).any() else np.nan, raw=True)
t2["epa_vs_2high_recent"] = t2.groupby("off", group_keys=False).apply(
    lambda d: roll_vs_type(d, "opp_was_2high", "game_pass_epa")).values
t2["epa_vs_2high_q"] = t2.groupby("season").epa_vs_2high_recent.transform(lambda s: s.rank(pct=True))
h2 = t2[(t2.epa_vs_2high_q <= 0.25) & (t2.two_high_rate_l8_q >= 0.75)]
cell(h2, "cover", False, "FADE offense (struggled vs 2-high, faces 2-high)")
cell(h2, "over", False, "UNDER the total")
print("  complement: offense that THRIVED vs 2-high recently, facing 2-high")
c2 = t2[(t2.epa_vs_2high_q >= 0.75) & (t2.two_high_rate_l8_q >= 0.75)]
cell(c2, "cover", True, "BACK offense ATS")
cell(c2, "over", True, "OVER the total")

print("\n" + "=" * 100)
print("H3 — BLITZ-heavy defense (top-25%, 2022+) vs SLOW-release offense (tt_l8 top-25%)")
print("=" * 100)
h3 = t[(t.season >= 2022) & (t.blitzers_l8_q >= 0.75) & (t.tt_l8_q >= 0.75)]
cell(h3, "over", False, "UNDER the total")
cell(h3, "cover", False, "FADE the slow-release offense ATS")
print("  complement: blitz-heavy D vs QUICK-release offense (tt bottom-25%)")
c3 = t[(t.season >= 2022) & (t.blitzers_l8_q >= 0.75) & (t.tt_l8_q <= 0.25)]
cell(c3, "over", False, "UNDER the total")
cell(c3, "cover", False, "FADE the offense ATS")
