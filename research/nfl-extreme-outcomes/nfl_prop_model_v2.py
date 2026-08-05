"""NFL player-props model v2 — RESEARCH ONLY (does not touch production / dryrun / P-flags / RPCs).

Redo of prop_model.py after the NBA post-mortem found the same two structural defects here:
  DEFECT 1: the close LINE is merged only for grading, never a feature. Predicting a RAW quantity
            requires the market anchor in the features (raw-quantity law; props-only exception).
  DEFECT 2: 25 features, none positional. The disk holds a positional-allowed source + NGS + matchup
            + madden that were written AFTER the frame was last built and never wired in.

This module: builds a leak-safe positional-defence-allowed table, attaches the unused families with a
leak screen, adds close_line, then grades the decomposition SEPARATELY:
  (a) current model as-is   (b) + line as a feature   (c) + attached context (full)
plus the PRODUCT test (paired per-row MAE, model vs line, every row) and a LINE-SCALE ladder.

Grading guardrails (from the NBA work): product test unfiltered; each ROI cell scored vs its OWN
unconditional rate (degenerate-baseline guard); per-season always; one sigma printed next to every
cell; oracle-check the grader; bet one line per player (no cross-market confluence).
"""
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingRegressor
from prop_model import panel as base_panel, t60_lines, MKT_STAT, NORM
from attempts_model import FEATS as BASE_FEATS, amer_profit, games

DATA = Path(__file__).resolve().parent / "data"
SKILL = {"WR", "TE", "RB", "FB", "QB"}
# per market, the opponent-allowed stat that matches the player's own production
MKT_ALLOWED = {"player_pass_yds": "passing_yards", "player_pass_tds": "passing_tds",
               "player_receptions": "receptions", "player_reception_yds": "receiving_yards",
               "player_rush_yds": "rushing_yards", "player_pass_attempts": "attempts",
               "player_rush_attempts": "carries", "player_pass_completions": "completions"}


def _roll(s, w):
    return s.shift(1).rolling(w, min_periods=2).mean()


def positional_allowed():
    """What each DEFENSE allows per game to WR/TE/RB/QB, as s2d/l5/l3 (shift(1) BEFORE the window).
    Built from the OFFENSIVE box (player_offense) attributed to each game's opponent defense."""
    po = pd.read_parquet(DATA / "player_offense.parquet")
    po["team"] = po.team.replace(NORM)
    po = po[po.season_type == "REG"] if "season_type" in po.columns else po
    gm = games()[["season", "week", "team", "opp"]]               # team -> opponent (defense faced)
    po = po.merge(gm, on=["season", "week", "team"], how="left").dropna(subset=["opp"])
    po = po[po.position.isin(SKILL)].copy()
    stats = ["receiving_yards", "receptions", "targets", "rushing_yards", "carries",
             "passing_yards", "passing_tds", "completions", "attempts"]
    stats = [s for s in stats if s in po.columns]
    # per (defense, position, game): total the offense's production of that position vs this D
    g = po.groupby(["season", "week", "opp", "position"], as_index=False)[stats].sum()
    g = g.sort_values(["opp", "position", "season", "week"])
    out = g[["season", "week", "opp", "position"]].copy()
    key = ["opp", "position"]
    for st in stats:
        gr = g.groupby(key)[st]
        out[f"oppallow_{st}_s2d"] = gr.transform(lambda s: s.shift(1).expanding(min_periods=2).mean())
        out[f"oppallow_{st}_l5"] = gr.transform(lambda s: _roll(s, 5))
        out[f"oppallow_{st}_l3"] = gr.transform(lambda s: _roll(s, 3))
    # LEAK ASSERT: the s2d allowance must not equal the current game's value (shift worked).
    # Ignore zero-current rows: a D that held a position to 0 with a prior s2d ~0 collides by
    # coincidence (low-volume FB/TE/passing_tds), which is not a shift failure.
    for st in stats:
        cur = g.sort_values(["opp", "position", "season", "week"])[st].values
        s2d = out[f"oppallow_{st}_s2d"].values
        mask = (~np.isnan(s2d)) & (np.abs(cur) > 1e-6)
        eqrate = np.mean(np.isclose(cur[mask], s2d[mask])) if mask.sum() else 0.0
        assert eqrate < 0.01, f"LEAK: oppallow_{st}_s2d == nonzero current on {eqrate:.1%} of rows"
    return out


def own_ngs():
    """Player's own prior-form NGS quality (avg_separation, catch%, YAC, cpoe, ttt) as s2d, shift(1)."""
    frames = []
    specs = {"ngs_receiving.parquet": ["avg_separation", "avg_cushion", "catch_percentage",
                                       "avg_yac_above_expectation", "percent_share_of_intended_air_yards"],
             "ngs_rushing.parquet": ["efficiency", "percent_attempts_gte_eight_defenders",
                                     "avg_time_to_los", "rush_yards_over_expected_per_att"],
             "ngs_passing.parquet": ["avg_time_to_throw", "completion_percentage_above_expectation",
                                    "aggressiveness", "avg_air_yards_differential"]}
    for f, cols in specs.items():
        d = pd.read_parquet(DATA / f)
        cols = [c for c in cols if c in d.columns]
        d = d[["season", "week", "player_id"] + cols].sort_values(["player_id", "season", "week"])
        for c in cols:
            d[f"own_{c}_s2d"] = d.groupby("player_id")[c].transform(lambda s: s.shift(1).expanding(min_periods=2).mean())
        frames.append(d[["season", "week", "player_id"] + [f"own_{c}_s2d" for c in cols]])
    out = frames[0]
    for fr in frames[1:]:
        out = out.merge(fr, on=["season", "week", "player_id"], how="outer")
    return out


def team_matchup():
    """Team-level opponent pressure/coverage + WR/CB physical mismatch from offense_matchup (s2d/static)."""
    d = pd.read_parquet(DATA / "offense_matchup.parquet")
    cols = ["opp_def_pressure_rate_s2d", "opp_def_pass_epa_allowed_neutral_s2d",
            "opp_def_explosive_pass_allowed_s2d", "opp_def_pass_sr_allowed_s2d",
            "off_pass_quality_diff", "m_wr_cb_speed", "m_wr_cb_wt", "m_wr_cb_ht", "m_ol_pr_str"]
    cols = [c for c in cols if c in d.columns]
    d = d[["season", "week", "off_ab"] + cols].rename(columns={"off_ab": "team"})
    d["team"] = d.team.replace(NORM)
    return d.rename(columns={c: f"tm_{c}" for c in cols})


def own_madden():
    """Player's positional talent proxy (Madden OVR) by season+gsis."""
    m = pd.read_parquet(DATA / "madden_ratings.parquet").dropna(subset=["gsis_id"])
    m = m.sort_values("ovr", ascending=False).drop_duplicates(["season", "gsis_id"])
    return m[["season", "gsis_id", "ovr"]].rename(columns={"gsis_id": "player_id", "ovr": "own_madden_ovr"})


def build():
    """Base panel + close_line + all attached families. Returns (frame, context_col_lists)."""
    p = base_panel()
    prop = t60_lines()
    p = p.merge(prop, on=["season", "week", "player_id", "market"], how="left")
    # DEFECT 1: line as a feature
    # DEFECT 2: positional-allowed matched to the player's own position + market stat
    pa = positional_allowed()
    p = p.merge(pa, on=["season", "week", "opp", "position"], how="left")
    # collapse per-market to a single "opp allows to my position in my stat" trio
    for w in ("s2d", "l5", "l3"):
        p[f"opp_pos_allow_{w}"] = np.nan
        for mkt, st in MKT_ALLOWED.items():
            col = f"oppallow_{st}_{w}"
            if col in p.columns:
                mask = p.market == mkt
                p.loc[mask, f"opp_pos_allow_{w}"] = p.loc[mask, col]
    # also volume allowed to my position (targets for rec, carries for rush, attempts for pass)
    p["opp_pos_vol_s2d"] = np.nan
    volmap = {"player_receptions": "targets", "player_reception_yds": "targets",
              "player_rush_yds": "carries", "player_rush_attempts": "carries",
              "player_pass_yds": "attempts", "player_pass_completions": "attempts",
              "player_pass_attempts": "attempts", "player_pass_tds": "attempts"}
    for mkt, st in volmap.items():
        col = f"oppallow_{st}_s2d"
        if col in p.columns:
            p.loc[p.market == mkt, "opp_pos_vol_s2d"] = p.loc[p.market == mkt, col]
    p = p.merge(own_ngs(), on=["season", "week", "player_id"], how="left")
    p = p.merge(team_matchup(), on=["season", "week", "team"], how="left")
    p = p.merge(own_madden(), on=["season", "player_id"], how="left")

    POS = ["opp_pos_allow_s2d", "opp_pos_allow_l5", "opp_pos_allow_l3", "opp_pos_vol_s2d"]
    NGS = [c for c in p.columns if c.startswith("own_") and c.endswith("_s2d")]
    TM = [c for c in p.columns if c.startswith("tm_")]
    MAD = ["own_madden_ovr"]
    CTX = POS + NGS + TM + MAD
    return p, {"POS": POS, "NGS": NGS, "TM": TM, "MAD": MAD, "CTX": CTX}


def leak_screen(p, cols):
    """A legit pregame feature correlates with the LINE >= with the RESULT. Flag/drop the exceptions."""
    ev = p.dropna(subset=["close_line", "actual"])
    flagged = []
    for c in cols:
        s = ev.dropna(subset=[c])
        if len(s) < 200:
            continue
        cl = abs(np.corrcoef(s[c], s.close_line)[0, 1])
        cr = abs(np.corrcoef(s[c], s.actual)[0, 1])
        if cr > cl + 0.03:
            flagged.append((c, round(cl, 3), round(cr, 3)))
    return flagged


if __name__ == "__main__":
    p, fam = build()
    print(f"[build] {len(p)} panel rows | context cols: {len(fam['CTX'])}")
    fl = leak_screen(p, fam["CTX"])
    print(f"[leak screen] flagged {len(fl)}: {fl}")
    p.to_parquet(DATA / "nfl_prop_v2_panel.parquet", index=False)
    print("[cache] wrote data/nfl_prop_v2_panel.parquet")
