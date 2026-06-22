"""Exhaustive team-total mining (2023-25, market-only -> reproducible, no model/missing files).

Two target families:
  (1) TEAM-TOTAL O/U  -- does the team beat its posted team-total line?
  (2) SPREAD / ATS    -- do team-total lines/odds/movement predict the cover? (NOVEL: no such signal exists)

Features mined (all from odds_hist team totals + odds_consensus spread/total + scores):
  line level, tt_sum vs game total, tt_split vs spread (book-implied margin),
  open->close TT movement, over/under JUICE asymmetry, dome, plus interactions.

Methodology (per the locked grading framework): grade vs the CLOSE line the feature is read at;
report pooled AND per-season; only trust segments durable across >=2/3 seasons. ROI @ -110 for
spreads & for O/U we use the actual median price when available, else -110.
"""
import numpy as np
import pandas as pd
import os
from forecast_harness import DATA

RELOC = {"LAR": "LA", "OAK": "LV", "SD": "LAC", "STL": "LA", "WSH": "WAS", "JAC": "JAX"}
BE = 52.38  # break-even % at -110


def amer_prob(o):
    o = pd.to_numeric(o, errors="coerce")
    return np.where(o < 0, -o / (-o + 100), 100 / (o + 100))


def build():
    oh = pd.read_parquet(os.path.join(DATA, "odds_hist.parquet"))
    tm = pd.read_parquet(os.path.join(DATA, "team_mapping.parquet"))
    nm = {r.team_name: RELOC.get(r["Team Abbrev"], r["Team Abbrev"]) for _, r in tm.iterrows()}
    dome = {RELOC.get(r["Team Abbrev"], r["Team Abbrev"]): bool(r.dome_stadium) for _, r in tm.iterrows()}
    oh = oh.dropna(subset=["tt_home_point", "tt_away_point"]).copy()
    oh["h"] = oh.home_team.map(nm); oh["a"] = oh.away_team.map(nm)
    oh = oh.dropna(subset=["h", "a"]); oh["snap_ts"] = pd.to_datetime(oh.snap_ts)
    grp = oh.groupby(["season", "h", "a"])
    first = grp.snap_ts.transform("min"); last = grp.snap_ts.transform("max")
    op = oh[oh.snap_ts == first].groupby(["season", "h", "a"]).agg(
        tt_h_open=("tt_home_point", "median"), tt_a_open=("tt_away_point", "median")).reset_index()
    cl = oh[oh.snap_ts == last].groupby(["season", "h", "a"]).agg(
        tt_h=("tt_home_point", "median"), tt_a=("tt_away_point", "median"),
        tt_h_ov=("tt_home_over_price", "median"), tt_h_un=("tt_home_under_price", "median"),
        tt_a_ov=("tt_away_over_price", "median"), tt_a_un=("tt_away_under_price", "median")).reset_index()
    g = op.merge(cl, on=["season", "h", "a"]).rename(columns={"h": "home_ab", "a": "away_ab"})
    oc = pd.read_parquet(os.path.join(DATA, "odds_consensus.parquet"))[
        ["season", "home_ab", "away_ab", "open_spread", "close_spread", "open_total", "close_total"]]
    m = pd.read_parquet(os.path.join(DATA, "matchup.parquet"))[
        ["season", "home_ab", "away_ab", "home_score", "away_score"]]
    g = g.merge(oc, on=["season", "home_ab", "away_ab"], how="left").merge(
        m, on=["season", "home_ab", "away_ab"], how="inner").dropna(
        subset=["tt_h", "tt_a", "home_score", "away_score"])
    g["dome"] = g.home_ab.map(dome)
    g["margin"] = g.home_score - g.away_score
    g["tot"] = g.home_score + g.away_score
    # derived market features
    g["tt_sum"] = g.tt_h + g.tt_a
    g["tt_sum_vs_total"] = g.tt_sum - g.close_total
    g["tt_split"] = g.tt_h - g.tt_a                       # book-implied home margin
    g["tt_vs_spread"] = g.tt_split + g.close_spread       # >0: TTs imply home MORE dominant than spread
    g["tt_h_move"] = g.tt_h - g.tt_h_open
    g["tt_a_move"] = g.tt_a - g.tt_a_open
    g["h_over_juice"] = amer_prob(g.tt_h_ov) - amer_prob(g.tt_h_un)   # >0: home OVER juiced (market leans over)
    g["a_over_juice"] = amer_prob(g.tt_a_ov) - amer_prob(g.tt_a_un)
    return g


def rep(label, win, n, season_hits=None):
    if n < 40:
        return None
    hit = win / n * 100
    roi = (win * 0.9091 - (n - win)) / n * 100
    star = "  <<<" if (hit >= 54 and (season_hits is None or sum(1 for x in season_hits if x is not None and x >= BE) >= 2)) else ""
    sh = " [" + ",".join(f"{x:.0f}" if x is not None else "-" for x in season_hits) + "]" if season_hits else ""
    print(f"  {label:40s} n={n:4d}  hit={hit:5.1f}%  ROI={roi:+6.1f}%{sh}{star}")
    return hit


def grade_ou(df, side, direction):
    """side: 'h'/'a'; direction OVER/UNDER. Returns wins,n,per-season-hit list."""
    line = df[f"tt_{side}"]; actual = df.home_score if side == "h" else df.away_score
    push = actual == line
    over = actual > line
    w = over if direction == "OVER" else ~over
    sub = df[~push]; ww = w[~push]
    sh = []
    for s in [2023, 2024, 2025]:
        ss = sub.season == s; n = ss.sum()
        sh.append((ww[ss].sum() / n * 100) if n >= 12 else None)
    return int(ww.sum()), int((~push).sum()), sh


def grade_ats(df, home_side):
    """home_side True -> bet home cover (margin+close_spread>0). Returns wins,n,per-season."""
    cov = df.margin + df.close_spread
    push = cov == 0
    home_cov = cov > 0
    w = home_cov if home_side else ~home_cov
    sub = df[~push]; ww = w[~push]
    sh = []
    for s in [2023, 2024, 2025]:
        ss = sub.season == s; n = ss.sum()
        sh.append((ww[ss].sum() / n * 100) if n >= 12 else None)
    return int(ww.sum()), int((~push).sum()), sh


def mine_ou(g):
    print("=" * 86)
    print("(1) TEAM-TOTAL OVER/UNDER  -- feature buckets, pooled + per-season [23,24,25], <<< = durable")
    print("=" * 86)
    feats = {
        "tt_sum_vs_total": [(-99, -1), (-1, 1), (1, 3), (3, 99)],
        "tt_vs_spread": [(-99, -2), (-2, -0.5), (-0.5, 0.5), (0.5, 2), (2, 99)],
        "line_level": None,
    }
    for side, sc in [("h", "HOME"), ("a", "AWAY")]:
        print(f"\n-- {sc} team total --")
        mv = g[f"tt_{side}_move"]; juice = g[f"{side}_over_juice"]
        bands = {
            "line>=24": g[f"tt_{side}"] >= 24, "line 21-24": (g[f"tt_{side}"] >= 21) & (g[f"tt_{side}"] < 24),
            "line<21": g[f"tt_{side}"] < 21,
            "tt_sum>total+1": g.tt_sum_vs_total > 1, "tt_sum<total-1": g.tt_sum_vs_total < -1,
            "line moved UP>=0.5": mv >= 0.5, "line moved DOWN<=-0.5": mv <= -0.5, "line flat": mv.abs() < 0.5,
            "OVER juiced(>+3%)": juice > 0.03, "UNDER juiced(>+3%)": juice < -0.03,
            "dome": g.dome, "outdoor": ~g.dome,
        }
        for name, mask in bands.items():
            for dr in ["OVER", "UNDER"]:
                w, n, sh = grade_ou(g[mask], side, dr)
                rep(f"{name} -> {dr}", w, n, sh)


def mine_ats(g):
    print("\n" + "=" * 86)
    print("(2) SPREAD / ATS from team-total signals  (NOVEL — grade home cover vs CLOSE spread)")
    print("=" * 86)
    bands = {
        "TTs imply home MORE dom (tt_vs_spread>=1.5)": (g.tt_vs_spread >= 1.5, True),
        "TTs imply home LESS dom (tt_vs_spread<=-1.5)": (g.tt_vs_spread <= -1.5, False),
        "TTs imply home MORE dom>=2.5": (g.tt_vs_spread >= 2.5, True),
        "TTs imply home LESS dom<=-2.5": (g.tt_vs_spread <= -2.5, False),
        "home TT moved UP>=0.5 -> home cover": (g.tt_h_move >= 0.5, True),
        "home TT moved DOWN<=-0.5 -> away cover": (g.tt_h_move <= -0.5, False),
        "away TT moved UP>=0.5 -> away cover": (g.tt_a_move >= 0.5, False),
        "home OVER juiced -> home cover": (g.h_over_juice > 0.03, True),
        "home UNDER juiced -> away cover": (g.h_over_juice < -0.03, False),
        "tt_sum>total+1 (shootout) -> home cover": (g.tt_sum_vs_total > 1, True),
    }
    for name, (mask, home_side) in bands.items():
        w, n, sh = grade_ats(g[mask], home_side)
        rep(name, w, n, sh)
    # baseline
    w, n, sh = grade_ats(g, True)
    print("\n  -- baseline --")
    rep("ALL home cover (vs close)", w, n, sh)


def main():
    g = build()
    print(f"games: {len(g)}  (per season: {g.season.value_counts().sort_index().to_dict()})")
    mine_ou(g)
    mine_ats(g)


if __name__ == "__main__":
    main()
