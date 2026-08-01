"""
Early-season (Weeks 1-3) feature carryover for the NFL sides model.

PROBLEM: Week 1 has no in-season data, so the s2d EPA features (the model's core matchup-net signal)
are null on the LIVE scoring frame -> the model collapses into a blanket "fade the favorite" lean
(every home-cover prob < 0.5). The historical TRAINING frame never had this because it carried each
team's PRIOR-YEAR season-end s2d values into Week 1 (verified: 2024 wk1 == 2023 season-end, corr
0.998). The live scoring path just doesn't reproduce that carryover.

FIX (this module): reproduce the carryover for the live frame, refined by CONTINUITY — the carried
prior-year value is shrunk toward the league mean by how much of the team actually returns, so a
gutted roster / new staff regresses hard while a stable team keeps last year's identity:

  prior_reg[f] = c * prior_year_end[team][f] + (1 - c) * league_mean[f]
  blended[f]   = (n * current_s2d[f] + K*c * prior_reg[f]) / (n + K*c)     # n = games played this season

Week 1 (n=0) -> pure prior_reg; Weeks 2-3 fold in the accumulating current-season s2d (K = prior's
pseudo-game weight). CONTINUITY c blends returning roster (Madden OVR-weighted gsis overlap vs last
year, top-30) with returning head coach (nflverse coach column — the upcoming-season coaches ARE
correct, including new hires; don't assume otherwise). c = 0.75*roster + 0.25*coach.

Usage:  fill_early_season(m, target_season)  -> mutates m, filling early-week s2d columns in place.
Self-test:  python3 early_season_blend.py [season]
"""
import os
import sys
import numpy as np
import pandas as pd

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
EARLY_WEEKS = 3
K_PRIOR = 6.0          # prior is worth ~6 games; current-season s2d overtakes it by ~mid-Sept
ROSTER_W = 0.75        # continuity = ROSTER_W*roster_return + (1-ROSTER_W)*coach_return (coach opt-in)

NICK = {'49ers':'SF','cardinals':'ARI','falcons':'ATL','ravens':'BAL','bills':'BUF','panthers':'CAR',
        'bears':'CHI','bengals':'CIN','browns':'CLE','cowboys':'DAL','broncos':'DEN','lions':'DET',
        'packers':'GB','texans':'HOU','colts':'IND','jaguars':'JAX','chiefs':'KC','chargers':'LAC',
        'rams':'LAR','dolphins':'MIA','vikings':'MIN','patriots':'NE','saints':'NO','giants':'NYG',
        'jets':'NYJ','eagles':'PHI','steelers':'PIT','seahawks':'SEA','buccaneers':'TB','titans':'TEN',
        'commanders':'WAS','redskins':'WAS','team':'WAS'}


def _ab(fullname, season):
    last = str(fullname).split()[-1].lower()
    if last == 'raiders':
        return 'OAK' if season <= 2019 else 'LV'
    return NICK.get(last)


def _stems(cols):
    """s2d feature stems present on BOTH home_ and away_ sides (team-level, off_*/def_*)."""
    hs = {c[5:] for c in cols if c.startswith('home_') and c.endswith('_s2d')
          and (c[5:].startswith('off_') or c[5:].startswith('def_'))}
    return sorted(s for s in hs if f'away_{s}' in set(cols))


def team_season_end(m, stems):
    """Per (season, ab), each stem's value at the team's LAST populated week = season-end s2d."""
    recs = []
    for side in ('home', 'away'):
        cols = [f'{side}_ab', 'season', 'week'] + [f'{side}_{s}' for s in stems]
        d = m[[c for c in cols if c in m.columns]].rename(
            columns={f'{side}_ab': 'ab', **{f'{side}_{s}': s for s in stems}})
        recs.append(d)
    t = pd.concat(recs, ignore_index=True).dropna(subset=['ab'])
    # last week per (season, ab) that has any stem populated
    t = t.sort_values('week')
    end = t.groupby(['season', 'ab']).tail(1).set_index(['season', 'ab'])[stems]
    return end


def continuity(target_season, use_coach=True):
    """Per ab, continuity c in [0,1] for target vs prior season (roster overlap [+ coach])."""
    mad = pd.read_parquet(os.path.join(DATA, 'madden_ratings.parquet'))
    mad['ab'] = [_ab(t, s) for t, s in zip(mad.team, mad.season)]
    mad = mad.dropna(subset=['ab', 'gsis_id'])

    def roster_ret(ab, S):
        cur = mad[(mad.season == S) & (mad.ab == ab)].sort_values('ovr', ascending=False).head(30)
        prev = set(mad[(mad.season == S - 1) & (mad.ab == ab)].gsis_id)
        if not len(cur) or cur.ovr.sum() == 0:
            return np.nan
        return cur[cur.gsis_id.isin(prev)].ovr.sum() / cur.ovr.sum()

    teams = sorted(mad[mad.season == target_season].ab.unique())
    coach_same = {}
    if use_coach:
        g = pd.read_parquet(os.path.join(DATA, 'nflverse_games.parquet'))
        def tc(S):
            h = g[g.season == S][['home_team', 'home_coach']].rename(columns={'home_team': 'ab', 'home_coach': 'c'})
            a = g[g.season == S][['away_team', 'away_coach']].rename(columns={'away_team': 'ab', 'away_coach': 'c'})
            return pd.concat([h, a]).dropna().groupby('ab').c.agg(lambda s: s.mode().iloc[0])
        c_t, c_p = tc(target_season), tc(target_season - 1)
        for t in teams:
            coach_same[t] = 1.0 if (t in c_t.index and t in c_p.index and c_t[t] == c_p[t]) else 0.0

    out = {}
    for t in teams:
        rc = roster_ret(t, target_season)
        if pd.isna(rc):
            continue
        c = ROSTER_W * rc + (1 - ROSTER_W) * coach_same.get(t, 0.0) if use_coach else rc
        out[t] = float(np.clip(c, 0.20, 0.95))
    return out


def fill_early_season(m, target_season, early_weeks=EARLY_WEEKS, use_coach=True, fill_null_only=True):
    """Fill early-week s2d features for target_season by continuity-weighted prior-year carryover.
    Mutates m in place; returns (n_rows_filled, n_cols)."""
    stems = _stems(m.columns)
    if not stems:
        return 0, 0
    end = team_season_end(m, stems)                       # season-end s2d per (season, ab)
    prior = end.xs(target_season - 1, level='season', drop_level=True) if (target_season - 1) in end.index.get_level_values('season') else pd.DataFrame(columns=stems)
    if not len(prior):
        return 0, 0
    lgmean = prior.mean()                                 # prior-season league mean per stem
    cont = continuity(target_season, use_coach=use_coach)

    early = m[(m.season == target_season) & (m.week <= early_weeks)]
    n_filled = 0
    for idx, r in early.iterrows():
        n = int(r.week) - 1                               # games played entering this week
        for side, ab in (('home', r.get('home_ab')), ('away', r.get('away_ab'))):
            if ab not in cont or ab not in prior.index:
                continue
            c = cont[ab]
            for s in stems:
                col = f'{side}_{s}'
                cur = m.at[idx, col]
                if fill_null_only and pd.notna(cur):
                    continue
                pv = prior.at[ab, s]
                if pd.isna(pv):
                    pv = lgmean[s]
                prior_reg = c * pv + (1 - c) * lgmean[s]
                cur_v = cur if pd.notna(cur) else 0.0
                nn = n if pd.notna(cur) else 0             # only weight current where it exists
                m.at[idx, col] = (nn * cur_v + K_PRIOR * c * prior_reg) / (nn + K_PRIOR * c)
        n_filled += 1
    return n_filled, len(stems)


if __name__ == '__main__':
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    m = pd.read_parquet(os.path.join(DATA, 'matchup.parquet'))
    stems = _stems(m.columns)
    wk1 = m[(m.season == season) & (m.week == 1)]
    probe = f'home_{stems[0]}' if stems else None
    print(f"stems: {len(stems)} | {season} wk1 rows: {len(wk1)} | {probe} null% before:",
          round(wk1[probe].isna().mean() * 100, 1) if probe else 'na')
    cont = continuity(season)
    print("continuity sample:", {k: round(v, 2) for k, v in sorted(cont.items(), key=lambda x: x[1])[:4]},
          "...", {k: round(v, 2) for k, v in sorted(cont.items(), key=lambda x: -x[1])[:4]})
    n, ncols = fill_early_season(m, season)
    wk1b = m[(m.season == season) & (m.week == 1)]
    print(f"filled {n} early rows x {ncols} stems | {probe} null% after:",
          round(wk1b[probe].isna().mean() * 100, 1) if probe else 'na',
          "| sample:", [round(v, 3) for v in wk1b[probe].dropna().head(4)])
