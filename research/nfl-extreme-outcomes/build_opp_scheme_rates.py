#!/usr/bin/env python3
"""Per-defense MAN-coverage and BLITZ rates by week, carried through the CURRENT season.

WHY (owner, 2026-10-02). coach_tendencies.py gated its vs_man_heavy / vs_blitz_heavy
situation splits on data/_completions_deep_frame.parquet, which holds 2023-25 only, so
every 2026 play fell out of those splits. The underlying man/zone labels came from
nflverse pbp_participation and **pbp_participation_2026 is a 404** — nflverse has not
published it, so that source cannot be made current at all.

Fantasy Points carries the same thing and IS current:
  man    coverageMatrix__opponent  -> Man / Zone dropback COUNTS per team-game
  blitz  FTN charting n_pass_rushers >= 5 on a dropback (what dc_tendencies already uses)

VALIDATED against nflverse before adopting (scripts in the session log):
  - ORIENTATION. In the __opponent scope the `opponentStats*` coverage columns describe
    the defense of the row's OWN teamNickname, not the named opponent. Tested both ways
    against nflverse per team-week, 2024-25: correct reading r=+0.64, the inverted one
    r=+0.08. This is the same orientation trap that produced a backwards PIT/CLE man
    read earlier in the session, so it is asserted by test, not by reasoning.
  - AGREEMENT. The two sources are NOT interchangeable on level: FP says ~27% man,
    nflverse ~41%. They agree on RANKING, which is all a tercile gate needs — by
    team-season, spearman +0.80 (2024) and +0.89 (2025), with top-third agreement 81%
    and 94%. The consumer thresholds against its own source's 2/3 quantile, so the level
    offset cancels.
  - Nflverse's own man rate moved 49% -> 32% between 2024 and 2025 while FP held
    29% -> 26%. A 17-point league-wide swing in one year is far more likely a charting
    change than a real one, which is a second reason to prefer FP here.

Writes data/_opp_scheme_rates.parquet: defteam, season, week, opp_rate_man,
opp_rate_blitz, man_dropbacks, blitz_dropbacks — the same column names the consumer
already expects from the old frame, so the swap is a one-line source change.

Usage: python3 build_opp_scheme_rates.py
"""
import ast
import glob
import os
import re

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
num = lambda s: pd.to_numeric(s, errors="coerce")

# Team maps live in prop_engine, but importing it pulls a heavy data load — read the two
# literals out of the source instead.
_src = open("prop_engine.py").read()
AB_NV = ast.literal_eval(re.search(r"^AB_NV = (\{.*?\})", _src, re.S | re.M).group(1))
NICK = ast.literal_eval(re.search(r"^NICK = (\{.*?\})\n", _src, re.S | re.M).group(1))
norm = lambda a: AB_NV.get(str(a), str(a))

# ---------------------------------------------------------------- MAN rate (Fantasy Points)
cm = pd.read_parquet("data/fpdata/coverageMatrix__opponent.parquet")
_man = [c for c in cm.columns if c.endswith("CoverageSchemeManPassingDropbacksTotal")][0]
_zone = [c for c in cm.columns if c.endswith("CoverageSchemeZonePassingDropbacksTotal")][0]
# teamNickname is the DEFENSE in this scope (see the orientation test in the docstring).
cm["defteam"] = cm.teamNickname.map(NICK).map(norm)
cm["_m"], cm["_z"] = num(cm[_man]), num(cm[_zone])
MAN = (cm.groupby(["gameSeason", "gameWeek", "defteam"], as_index=False)[["_m", "_z"]].sum()
         .rename(columns={"gameSeason": "season", "gameWeek": "week"}))
MAN["man_dropbacks"] = MAN._m + MAN._z
MAN["opp_rate_man"] = np.where(MAN.man_dropbacks > 0, MAN._m / MAN.man_dropbacks, np.nan)
MAN = MAN.drop(columns=["_m", "_z"])

# ---------------------------------------------------------------- BLITZ rate (FTN charting)
PCOLS = ["season", "week", "defteam", "game_id", "play_id", "qb_dropback", "season_type"]
parts = []
for f in (["data/pbp_cache/_dl_2022.parquet"] + sorted(glob.glob("data/pbp_cache/pbp_202[345].parquet"))
          + sorted(glob.glob("data/pbp_cache/_pbp202[6789].parquet"))):
    d = pd.read_parquet(f)
    parts.append(d[[c for c in PCOLS if c in d.columns]])
pbp = pd.concat(parts, ignore_index=True)
pbp = pbp[(pbp.get("season_type", "REG").fillna("REG") == "REG") & pbp.defteam.notna() & (pbp.qb_dropback == 1)]
pbp["defteam"] = pbp.defteam.replace({"LAR": "LA"}).map(norm)

ftn = pd.concat([pd.read_parquet(f) for f in
                 ["data/ftn_charting.parquet", "data/ftn_charting_2025.parquet"]
                 + sorted(glob.glob("data/ftn_charting_202[6789].parquet")) if os.path.exists(f)],
                ignore_index=True)
for x, y in (("nflverse_game_id", "game_id"), ("nflverse_play_id", "play_id")):
    if y in ftn.columns and x in ftn.columns:
        ftn[y] = ftn[y].fillna(ftn[x]); ftn = ftn.drop(columns=x)
    elif x in ftn.columns:
        ftn = ftn.rename(columns={x: y})
ftn["play_id"] = num(ftn.play_id)
ftn = ftn[["game_id", "play_id", "n_pass_rushers"]].drop_duplicates(["game_id", "play_id"])
B = pbp.merge(ftn, on=["game_id", "play_id"], how="left")
B["_blitz"] = (num(B.n_pass_rushers) >= 5)
B = B[num(B.n_pass_rushers).notna()]
BLZ = B.groupby(["season", "week", "defteam"], as_index=False).agg(
    opp_rate_blitz=("_blitz", "mean"), blitz_dropbacks=("_blitz", "size"))

# ---------------------------------------------------------------- join + sanity
out = MAN.merge(BLZ, on=["season", "week", "defteam"], how="outer").sort_values(["season", "week", "defteam"])
# A team-game is ~30-40 charted dropbacks; anything under 10 is too thin to call a rate.
out.loc[out.man_dropbacks.fillna(0) < 10, "opp_rate_man"] = np.nan
out.loc[out.blitz_dropbacks.fillna(0) < 10, "opp_rate_blitz"] = np.nan
out.to_parquet("data/_opp_scheme_rates.parquet", index=False)

print(f"[opp-scheme] {len(out)} team-weeks -> data/_opp_scheme_rates.parquet")
for s in sorted(out.season.dropna().unique()):
    g = out[out.season == s]
    print(f"   {int(s)}: weeks {int(g.week.min())}-{int(g.week.max())}  man {g.opp_rate_man.mean():.3f} "
          f"({int(g.opp_rate_man.notna().sum())} wk-rows)  blitz {g.opp_rate_blitz.mean():.3f} "
          f"({int(g.opp_rate_blitz.notna().sum())} wk-rows)")
_cur = int(out.season.max())
if out[(out.season == _cur)].opp_rate_man.notna().sum() == 0:
    print(f"  ⛔ [opp-scheme] no {_cur} MAN rows — FP coverageMatrix needs a pull "
          f"(fp_pull.py --tools coverageMatrix --seasons {_cur} --weeks 1-18, then --consolidate)")
