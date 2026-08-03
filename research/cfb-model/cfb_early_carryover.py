"""CFB early-season feature carryover — the CFB analog of NFL early_season_blend.py.

PROBLEM: model_games' opponent-adjusted features are within-season as-of -> week 1 is 100% NULL and
weeks 2-3 run on 1-2 noisy games, so the in-season harness (cfb_forecast) is degenerate early and its
model-edge spots are suppressed (EARLY_SUPPRESS). The DISPLAY predictions already come from the
separate cfb_early_week priors blend; this module makes the HARNESS itself sane early.

FIX: fill weeks 1-3 with the team's PRIOR-SEASON END values shrunk by CONTINUITY, then blend with the
accumulating current season:
    prior_reg[f] = c * prior_end[team][f] + (1-c) * league_mean[f]
    filled[f]    = (n * current[f] + K*c * prior_reg[f]) / (n + K*c)      n = games played (~week-1)
CONTINUITY c = 0.75 * returning-production percentPPA (validated S-CFB2 input) + 0.25 * same-HC
(coach_seasons cache; scheme-transfer research says a new HC's team plays like HIS old team, so a
coach change deserves a hard shrink), clipped to [0.20, 0.95]. Prior season = latest season < S with
data (2021 -> 2019 across the COVID gap). Leak-safe: prior-year data + preseason-known continuity.
"""
import numpy as np
import pandas as pd
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"
K_PRIOR = 6.0
RET_W = 0.75


def team_feature_stems(cols):
    """Team-level stems present as BOTH home_X and away_X among the adjusted/tendency families."""
    stems = set()
    for c in cols:
        if c.startswith("home_") and ("adj_" in c or "havoc" in c or c.endswith(("pace_off_plays", "pace_off_drives", "pass_rate"))):
            s = c[5:]
            if f"away_{s}" in cols:
                stems.add(s)
    return sorted(stems)


def season_end_values(m, stems):
    """Per (season, team): each stem's value at the team's LAST game of that season (end-of-season as-of)."""
    recs = []
    for side in ("home", "away"):
        d = m[["season", "week", f"{side}Team"] + [f"{side}_{s}" for s in stems]].rename(
            columns={f"{side}Team": "team", **{f"{side}_{s}": s for s in stems}})
        recs.append(d)
    t = pd.concat(recs, ignore_index=True)
    t = t.dropna(subset=stems, how="all").sort_values("week")
    return t.groupby(["season", "team"]).tail(1).set_index(["season", "team"])[stems]


def fetch_coach_seasons(y0=2015, y1=2025):
    """Rebuild data/cfbd/coach_seasons.parquet from CFBD /coaches (one row per year-school, the HC
    with the most games). The parquet is gitignored; this makes it reproducible anywhere."""
    import cfbd
    rows = []
    for yr in range(y0, y1 + 1):
        for c in cfbd.get("/coaches", year=yr):
            nm = f"{c.get('firstName','')} {c.get('lastName','')}".strip()
            for s in c.get("seasons", []):
                if s.get("year") == yr:
                    rows.append({"year": yr, "school": s["school"], "coach": nm, "games": s.get("games") or 0})
    cs = pd.DataFrame(rows).sort_values("games", ascending=False).drop_duplicates(["year", "school"])
    (DATA / "cfbd").mkdir(parents=True, exist_ok=True)
    cs.to_parquet(DATA / "cfbd" / "coach_seasons.parquet", index=False)
    return cs


def continuity(season):
    """Per team: continuity in [0.20, 0.95] for `season` (returning production + same-HC)."""
    rp = pd.read_parquet(DATA / "cfbd" / "returning_production.parquet")
    r = rp[rp.season == season].set_index("team").percentPPA.to_dict()
    cs_path = DATA / "cfbd" / "coach_seasons.parquet"
    if not cs_path.exists():
        fetch_coach_seasons()
    cs = pd.read_parquet(cs_path)
    prior_years = sorted(y for y in cs.year.unique() if y < season)
    same_hc = {}
    if prior_years:
        py = prior_years[-1]
        cur = cs[cs.year == season].set_index("school").coach.to_dict()
        prv = cs[cs.year == py].set_index("school").coach.to_dict()
        same_hc = {t: 1.0 if (t in prv and cur.get(t) == prv[t]) else 0.0 for t in cur}
    lg_ret = np.nanmean(list(r.values())) if r else 0.6
    out = {}
    for team in set(list(r.keys()) + list(same_hc.keys())):
        ret = r.get(team, lg_ret)
        hc = same_hc.get(team, 0.5)
        out[team] = float(np.clip(RET_W * ret + (1 - RET_W) * hc, 0.20, 0.95))
    return out


def fill_early(m, target_season, early_weeks=3):
    """Fill weeks 1..early_weeks of target_season in-place. Returns (n_rows, n_stems)."""
    stems = team_feature_stems(m.columns)
    ends = season_end_values(m, stems)
    seasons = sorted(m.season.unique())
    priors = [s for s in seasons if s < target_season and s in ends.index.get_level_values(0)]
    if not priors:
        return 0, 0
    ps = priors[-1]
    prior = ends.xs(ps, level="season")
    lgm = prior.mean()
    cont = continuity(target_season)
    rows = m[(m.season == target_season) & (m.week <= early_weeks)]
    n = 0
    for idx, r in rows.iterrows():
        gp = max(int(r.week) - 1, 0)
        for side, team in (("home", r.homeTeam), ("away", r.awayTeam)):
            c = cont.get(team)
            if c is None:
                c = 0.5
            for s in stems:
                col = f"{side}_{s}"
                pv = prior.at[team, s] if team in prior.index else np.nan
                if pd.isna(pv):
                    pv = lgm[s]
                prior_reg = c * pv + (1 - c) * lgm[s]
                cur = m.at[idx, col]
                if pd.isna(cur):
                    m.at[idx, col] = prior_reg
                else:
                    m.at[idx, col] = (gp * cur + K_PRIOR * c * prior_reg) / (gp + K_PRIOR * c)
        n += 1
    return n, len(stems)


if __name__ == "__main__":
    m = pd.read_parquet(DATA / "model_games.parquet")
    stems = team_feature_stems(m.columns)
    w1 = m[(m.season == 2024) & (m.week == 1)]
    print(f"stems: {len(stems)} | 2024 wk1 null% before: "
          f"{w1[[f'home_{s}' for s in stems]].isna().mean().mean()*100:.0f}%")
    n, k = fill_early(m, 2024)
    w1 = m[(m.season == 2024) & (m.week == 1)]
    print(f"filled {n} rows x {k} stems | after: "
          f"{w1[[f'home_{s}' for s in stems]].isna().mean().mean()*100:.0f}% null")
    c = continuity(2024)
    sc = pd.Series(c).sort_values()
    print("continuity lo:", {k: round(v, 2) for k, v in sc.head(4).items()},
          "| hi:", {k: round(v, 2) for k, v in sc.tail(4).items()})
