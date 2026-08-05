#!/usr/bin/env python3
"""Where inside the absence signal does the edge actually live -- and is any of it free?

nba_out_controls.py established two things. Control A: the RAPM VALUATION of who is missing
beats counting minutes or bodies, so the impact layer earns its keep. Control B: a strictly
pregame version that assumes "missed the last two games -> still out tonight" collapses to
its baseline. The obvious reading of B is "the edge needs same-day availability." This
script tests a different reading, because two confounds sit inside Control B and neither was
controlled:

  !! CORRECTION (nba_out_null.py, run after this file). Confound 1 below is stated
  !! backwards. The decaying baseline is the MECHANISM, not a bug: it acts as an automatic
  !! recency filter, and recency is the whole effect. Against a 2,000-permutation null the
  !! decaying baseline is significant at every bet count and strengthens with sample size
  !! (p .039 -> .001), while the "corrected" played-only baseline below is significant
  !! nowhere (p .215, .071, .102) and its ROI goes negative. Read this file's tables, not
  !! its reasoning; the adjudication is in nba_out_null.py and nba_out_final.py.

  CONFOUND 1 -- the baseline decays, so the feature was never measuring long absences.
      nba_rapm_agg.py sets a player's rotation-minute baseline from a 10-game rolling mean
      that COUNTS ABSENCES AS ZERO MINUTES. A player out ten straight games has a baseline
      of 0 and fails the >=16 rotation filter, so he silently stops counting as missing. The
      durable feature is therefore made almost entirely of FRESH absences. Control B, which
      keys on players out at least two straight, selects a partly DIFFERENT population --
      longer absences -- and those are exactly the ones the market has had days to price.
      Here the baseline is rebuilt from the last ten games the player ACTUALLY PLAYED, so
      absence length becomes a free variable instead of being silently truncated.

  CONFOUND 2 -- rows go missing, so streak length was measured wrong.
      A player absent long enough stops appearing on the box score at all, rather than
      appearing with did_not_play=True. Shifting over a player's own listed rows therefore
      reads a five-game absence as consecutive appearances. Every player is reindexed onto
      his TEAM'S schedule here, and a missing row is an absence.

The decomposition then answers the question directly:

    FRESH  (out tonight, out last game, and playing the game before that)
    MID    (2-4 straight games missed before tonight)
    LONG   (5+ straight missed before tonight)

If the edge is concentrated in FRESH and absent from LONG, the market prices known absences
and misprices new ones, which is a coherent mechanism rather than a fluke -- and it also
means Control B failed for a reason that has nothing to do with needing a live feed.

And the free version is tested on its own terms: predict tonight from the streak alone,
never inspecting tonight, at streak thresholds where persistence is high enough to be worth
betting. The persistence rate P(actually out tonight | missed the last k) is printed next to
every threshold, because a rule that is right about availability 95% of the time is a
different object from one that is right 70% of the time.
"""
import glob
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RAW = os.path.join(ROOT, "data", "raw", "nba_pbp")
SHRINK_MIN = 600.0
ROT_MIN = 16.0

MKT = {"FG spread (open)": ("y_open", "open_spread_home_price", "open_spread_away_price"),
       "FG spread (T-60)": ("y_fg_marg_resid", "t60_spread_home_price",
                            "t60_spread_away_price"),
       "1H spread (T-60)": ("y_h1_marg_resid", "t60_spread_home_price",
                            "t60_spread_away_price")}


def to_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    return np.where((a >= 1.01) & (a <= 40.0), a,
                    np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a)))


def row(tag, d, gap, ycol, ph, pl, thr, minn=50):
    y = d[ycol].to_numpy(dtype=float)
    m = np.isfinite(y) & np.isfinite(gap) & (y != 0) & (np.abs(gap) >= thr)
    if m.sum() < minn:
        return None
    hi = gap[m] > 0
    win = np.where(hi, y[m] > 0, y[m] < 0)
    dec = np.where(hi, to_dec(d[ph])[m], to_dec(d[pl])[m])
    base = max((y[m] > 0).mean(), (y[m] < 0).mean())
    s = d["season"].to_numpy()[m]
    per = " ".join(f"{x}:{100*win[s == x].mean():.0f}/{(s == x).sum()}"
                   for x in sorted(set(s)))
    return (f"| {tag} | {m.sum():,} | {100*win.mean():.1f} | {100*base:.1f} | "
            f"{100*np.where(win, dec - 1.0, -1.0).mean():+.1f} | {per} |")


HDR = ["| rule / min gap | n | win % | slice base % | ROI % | by season |",
       "|---|---|---|---|---|---|"]


def build_grid():
    """Every player reindexed onto his team's schedule; a missing row is an absence."""
    B = pd.concat([pd.read_parquet(f, columns=[
        "game_id", "game_date", "athlete_id", "team_id", "minutes", "did_not_play",
        "home_away"]) for f in sorted(glob.glob(f"{RAW}/player_box_*.parquet"))],
        ignore_index=True)
    B["minutes"] = pd.to_numeric(B["minutes"], errors="coerce").fillna(0.0)
    B["athlete_id"] = pd.to_numeric(B["athlete_id"], errors="coerce")
    B["team_id"] = pd.to_numeric(B["team_id"], errors="coerce")
    B = B.dropna(subset=["athlete_id", "team_id"])
    B["date"] = pd.to_datetime(B["game_date"])
    # NBA season straddles the new year; the label is the START year, matching `season`
    # in the odds features.
    B["season"] = np.where(B["date"].dt.month >= 8, B["date"].dt.year,
                           B["date"].dt.year - 1)
    B = B.drop_duplicates(["game_id", "athlete_id"])

    sched = B.drop_duplicates(["game_id", "team_id"])[
        ["season", "team_id", "game_id", "date", "home_away"]]
    # A stint is bounded by the first and last game the player appears in for that team,
    # so trades do not manufacture phantom absences on the team he already left.
    span = B.groupby(["athlete_id", "team_id", "season"])["date"].agg(
        ["min", "max"]).reset_index()
    G = span.merge(sched, on=["season", "team_id"])
    G = G[(G["date"] >= G["min"]) & (G["date"] <= G["max"])]
    G = G[["athlete_id", "team_id", "season", "game_id", "date", "home_away"]]
    G = G.merge(B[["game_id", "athlete_id", "minutes", "did_not_play"]],
                on=["game_id", "athlete_id"], how="left")
    listed = G["did_not_play"].notna()
    G["minutes"] = G["minutes"].fillna(0.0)
    G["out"] = G["minutes"] <= 0
    G = G.sort_values(["athlete_id", "season", "date"]).reset_index(drop=True)

    # consecutive absences STRICTLY BEFORE tonight, over team games
    prev = G.groupby(["athlete_id", "season"])["out"].shift(1).fillna(False).astype(int)
    key = G["athlete_id"].astype("int64").astype(str) + "_" + G["season"].astype(str)
    brk = (prev == 0) | (key != key.shift(1))
    G["streak"] = prev.groupby(brk.cumsum()).cumsum().to_numpy()

    # baseline from the last ten games he actually PLAYED, so a long absence no longer
    # decays him out of the rotation filter. Leak-safe: the value carried into a game is
    # the rolling mean as of his previous played game.
    P = G[G["minutes"] > 0].copy()
    P["ri"] = P.groupby(["athlete_id", "season"])["minutes"].transform(
        lambda s: s.rolling(10, min_periods=3).mean())
    G = G.merge(P[["athlete_id", "game_id", "ri"]], on=["athlete_id", "game_id"], how="left")
    G = G.sort_values(["athlete_id", "season", "date"]).reset_index(drop=True)
    G["base"] = G.groupby(["athlete_id", "season"])["ri"].transform(
        lambda s: s.shift(1).ffill())
    chk = G.groupby(["athlete_id", "season"]).head(1)
    assert chk["base"].isna().all(), "BASELINE MINUTES LEAKED INTO A PLAYER'S FIRST GAME"

    R = pd.read_parquet(f"{OUT}/nba_player_rapm.parquet")
    R["asof"] = pd.PeriodIndex(R["asof_month"], freq="M").to_timestamp()
    R["pid"] = R["player_id"].astype("int64")
    R = R.sort_values("asof")
    G["month"] = G["date"].dt.to_period("M").dt.to_timestamp()
    G["pid"] = G["athlete_id"].astype("int64")
    o = pd.merge_asof(G[["pid", "month"]].reset_index().sort_values("month"),
                      R.drop(columns=["player_id"]), left_on="month", right_on="asof",
                      by="pid", direction="backward").set_index("index").sort_index()
    assert (o["asof"].dropna() <= o.loc[o["asof"].notna(), "month"]).all(), \
        "RAPM RATING FROM THE FUTURE LEAKED INTO A GAME"
    k = o["prior_minutes"].fillna(0.0) / (o["prior_minutes"].fillna(0.0) + SHRINK_MIN)
    G["rapm_m"] = (o["rapm_margin"].fillna(0.0) * k).to_numpy()

    frac_unlisted = 1.0 - listed.mean()
    return G, frac_unlisted


def team_values(G, masks):
    """OUT value per team-game for each named absence mask, in RAPM margin pts / 48."""
    rot = G[G["base"] >= ROT_MIN].copy()
    den = rot.groupby(["game_id", "team_id"])["base"].transform("sum")
    rot["share"] = rot["base"] / den.clip(lower=1e-9)
    for name, m in masks.items():
        rot[name] = 5.0 * rot["share"] * rot["rapm_m"] * m.reindex(rot.index).astype(float)
    agg = rot.groupby(["game_id", "team_id"])[list(masks)].sum().reset_index()
    ha = G.drop_duplicates(["game_id", "team_id"])[["game_id", "team_id", "home_away"]]
    return agg.merge(ha, on=["game_id", "team_id"])


def pairs(agg, cols):
    C = pd.read_parquet(f"{OUT}/nba_game_crosswalk.parquet")
    a = agg.merge(C, left_on="game_id", right_on="espn_game_id").rename(
        columns={"bdl_game_id": "game.id"})
    H = a[a["home_away"] == "home"][["game.id"] + cols].rename(
        columns={c: f"h_{c}" for c in cols})
    V = a[a["home_away"] == "away"][["game.id"] + cols].rename(
        columns={c: f"a_{c}" for c in cols})
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    F = F[~F["game.id"].duplicated(keep=False)].copy()
    d = F.merge(H, on="game.id", how="inner").merge(V, on="game.id", how="inner")
    d["y_open"] = d["y_fg_margin"] + d["open_spread_home_point"]
    return d


def main():
    G, unlisted = build_grid()
    L = ["# NBA absence signal — where the edge lives, and whether any of it is free", ""]

    n_rot_out = ((G["base"] >= ROT_MIN) & G["out"]).sum()
    sl = G.loc[(G["base"] >= ROT_MIN) & G["out"], "streak"]
    L += [f"Grid: {len(G):,} player-team-games, {100*unlisted:.1f}% of them reconstructed "
          f"(the player was absent and not listed on the box score at all — these are the "
          f"rows the old shift-over-listed-rows approach silently skipped).", "",
          f"Rotation-player absences: {n_rot_out:,}. Prior-streak mix: "
          f"fresh(0-1) {100*(sl <= 1).mean():.0f}%, mid(2-4) "
          f"{100*sl.between(2, 4).mean():.0f}%, long(5+) {100*(sl >= 5).mean():.0f}%.", ""]

    out = G["out"]
    masks = {
        "fresh": out & (G["streak"] == 1),
        "mid": out & G["streak"].between(2, 4),
        "long": out & (G["streak"] >= 5),
        "any_dur": out & (G["streak"] >= 1),
    }
    # free variants: tonight is NEVER inspected, availability predicted from the streak
    for k in (3, 5, 8):
        masks[f"pred{k}"] = G["streak"] >= k

    agg = team_values(G, masks)
    d = pairs(agg, list(masks))

    L += ["## Decomposition by how long the player has already been out", "",
          "Same rule throughout: value each side's absent rotation players in RAPM margin "
          "pts/48 weighted by rotation-minute share, back the side whose opponent is more "
          "depleted. The ONLY thing changing between blocks is which absences count.", ""]
    for name, label in [("fresh", "FRESH (out tonight + last game, played before that)"),
                        ("mid", "MID (2-4 straight missed)"),
                        ("long", "LONG (5+ straight missed)"),
                        ("any_dur", "ALL durable (the original feature)")]:
        L += [f"### {label}", ""] + HDR
        gap = (d[f"a_{name}"] - d[f"h_{name}"]).to_numpy(dtype=float)
        for mk, (ycol, ph, pl) in MKT.items():
            for thr in (1.0, 1.5, 2.0):
                r = row(f"{mk} ≥{thr}", d, gap, ycol, ph, pl, thr)
                if r:
                    L.append(r)
        L.append("")

    # ---- the free version, with its availability accuracy stated ----------------------
    L += ["## The free version — tonight is never inspected", "",
          "Availability is predicted from the streak alone. `persistence` is the share of "
          "those predictions that were correct (the player really was out tonight); it "
          "bounds how much of the signal survives the substitution.", ""]
    for k in (3, 5, 8):
        sel = G["streak"] >= k
        pers = G.loc[sel, "out"].mean()
        L.append(f"- missed the last {k}: persistence {100*pers:.1f}% "
                 f"(n={int(sel.sum()):,} player-games)")
    L += [""] + HDR
    for k in (3, 5, 8):
        gap = (d[f"a_pred{k}"] - d[f"h_pred{k}"]).to_numpy(dtype=float)
        for thr in (1.0, 2.0):
            r = row(f"predict from last {k} — FG open ≥{thr}", d, gap, "y_open",
                    "open_spread_home_price", "open_spread_away_price", thr)
            if r:
                L.append(r)
    L.append("")

    path = os.path.join(ROOT, "NBA_OUT_STREAKS_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
