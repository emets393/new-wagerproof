"""
Brief #3 PART 3 — exhaustive trend scan (singles + 2-way + 3-way) vs ATS / O-U / ML.
GUARDING PRINCIPLE baked into qualify(): a trend must appear in >=2 separate seasons (n>=5 each),
same direction, >= breakeven, with a high fraction of seasons leaning right + pooled margin.
Reports how many combos were screened and surfaces only survivors, ranked by per-season consistency.
"""
import os, sys, warnings, itertools
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
L = print
tg = pd.read_parquet(os.path.join(DATA, "tg.parquet"))
BREAKEVEN = 0.5238

# ---------------- ATS / ML condition library (team-game perspective) ----------------
def conds_team(d):
    c = {}
    c["home_dog"] = (d.is_home == 1) & (d.team_spread > 0)
    c["road_dog"] = (d.is_home == 0) & (d.team_spread > 0)
    c["road_fav"] = (d.is_home == 0) & (d.team_spread < 0)
    c["home_fav"] = (d.is_home == 1) & (d.team_spread < 0)
    c["big_dog>=7"] = d.team_spread >= 7
    c["big_fav<=-7"] = d.team_spread <= -7
    c["dog"] = d.team_spread > 0
    c["fav"] = d.team_spread < 0
    c["off_bye"] = d.off_bye == 1
    c["pre_bye"] = d.pre_bye == 1
    c["short_week"] = d.short_week == 1
    c["long_rest>=10"] = d.long_rest == 1
    c["rest_edge>=3"] = d.rest_edge >= 3
    c["rest_edge<=-3"] = d.rest_edge <= -3
    c["blowout_win_last"] = d.blowout_win_last == 1
    c["blowout_loss_last"] = d.blowout_loss_last == 1
    c["off_cover"] = d.off_cover == 1
    c["off_noncover"] = d.off_noncover == 1
    c["cover_streak>=2"] = d.cover_streak >= 2
    c["cover_streak>=3"] = d.cover_streak >= 3
    c["win_streak>=2"] = d.win_streak >= 2
    c["win_streak>=3"] = d.win_streak >= 3
    c["lookahead"] = d.lookahead == 1
    c["letdown"] = d.letdown == 1
    c["div_game"] = d.div_game == 1
    c["div_revenge"] = d.div_revenge == 1
    c["third_road"] = d.third_road == 1
    c["third_home"] = d.third_home == 1
    c["primetime"] = d.primetime == 1
    c["thursday"] = d.is_thu == 1
    c["monday"] = d.is_mon == 1
    c["outdoor"] = d.is_outdoor == 1
    c["good_form_l3>0"] = d.l3_margin > 3
    c["bad_form_l3<0"] = d.l3_margin < -3
    c["pr_better>=3"] = d.pr_edge >= 3
    c["pr_worse<=-3"] = d.pr_edge <= -3
    c["line_toward_team"] = d.spread_move_team <= -1.0
    c["line_away_team"] = d.spread_move_team >= 1.0
    return c


def per_season_rates(sub, outcome, min_n=5):
    rates = []
    for s in sorted(sub["season"].dropna().unique()):
        oc = sub[sub.season == s][outcome].dropna()
        n = int(oc.isin([0, 1]).sum())
        if n >= min_n:
            rates.append((int(s), oc.mean(), n))
    return rates


def qualify(sub, outcome):
    """Return (direction, metrics) if a trend meets the guarding principle, else None.
    Tests both BACK (cover) and FADE (1-cover)."""
    oc = sub[outcome].dropna()
    n = int(oc.isin([0, 1]).sum())
    if n < 25:
        return None
    for direction, series in [("BACK", oc), ("FADE", 1 - oc)]:
        rates = per_season_rates(sub.assign(_o=series if direction == "BACK" else None), outcome) if direction == "BACK" \
            else [(s, 1 - r, nn) for s, r, nn in per_season_rates(sub, outcome)]
        if direction == "BACK":
            rates = per_season_rates(sub, outcome)
        nyr = len(rates)
        if nyr < 2:
            continue
        beat = sum(1 for _, r, _ in rates if r >= BREAKEVEN)
        right = sum(1 for _, r, _ in rates if r >= 0.50)
        pooled = series.mean()
        if beat >= 2 and right / nyr >= 0.67 and pooled >= 0.534:
            lo, hi = wilson_ci(int(series.sum()), n)
            return dict(direction=direction, n=n, pooled=pooled, beat=beat, nyr=nyr,
                        right=right, lo=lo, hi=hi, rates=rates)
    return None


def fmt_rates(rates):
    return " ".join(f"{s}:{r*100:.0f}%(n{n})" for s, r, n in rates)


# ================= ATS SCAN =================
def run_scan(d, outcome, market, anchors, max3=None):
    C = conds_team(d) if market != "OU" else conds_game(d)
    names = list(C.keys())
    screened = 0; hits = []
    # singles
    for nm in names:
        screened += 1
        r = qualify(d[C[nm]], outcome)
        if r:
            hits.append((f"{nm}", r))
    # 2-way
    for a, b in itertools.combinations(names, 2):
        mask = C[a] & C[b]
        if mask.sum() < 40:
            continue
        screened += 1
        r = qualify(d[mask], outcome)
        if r:
            hits.append((f"{a} & {b}", r))
    # 3-way (anchor-restricted)
    for anch in anchors:
        if anch not in C:
            continue
        rest = [n for n in names if n != anch]
        for a, b in itertools.combinations(rest, 2):
            mask = C[anch] & C[a] & C[b]
            if mask.sum() < 40:
                continue
            screened += 1
            r = qualify(d[mask], outcome)
            if r:
                hits.append((f"{anch} & {a} & {b}", r))
    return screened, hits


# ================= OU condition library (game-level) =================
def conds_game(d):
    c = {}
    c["wind>=13"] = (d.is_outdoor == 1) & (d.wind_mph >= 13)
    c["wind>=15"] = (d.is_outdoor == 1) & (d.wind_mph >= 15)
    c["wind>=17"] = (d.is_outdoor == 1) & (d.wind_mph >= 17)
    c["cold<=32"] = (d.is_outdoor == 1) & (d.temp_f <= 32)
    c["precip>=0.5"] = (d.is_outdoor == 1) & (d.precip >= 0.5)
    c["dome"] = d.dome_closed == 1
    c["outdoor"] = d.is_outdoor == 1
    c["primetime"] = d.primetime == 1
    c["thursday"] = d.is_thu == 1
    c["monday"] = d.is_mon == 1
    c["div_game"] = d.div_game == 1
    c["high_total>=49"] = d.ou_line >= 49
    c["low_total<=40"] = d.ou_line <= 40
    c["wk>=15"] = d.week >= 15
    c["wk<=4"] = d.week <= 4
    c["big_fav_game"] = d.team_spread.abs() >= 7
    c["off_bye_team"] = d.off_bye == 1
    c["pre_bye_team"] = d.pre_bye == 1
    return c


# de-dup game-level: one row per game for OU
gl = tg.drop_duplicates("unique_id").copy()


def report(market, screened, hits):
    L(f"\n{'#'*94}\n{market}: screened {screened} conditions/combos -> {len(hits)} passed guarding principle\n{'#'*94}")
    hits = sorted(hits, key=lambda x: (-x[1]["beat"], -(x[1]["right"]/x[1]["nyr"]), -x[1]["pooled"]))
    for name, r in hits[:30]:
        L(f"  [{r['direction']}] {name}")
        L(f"      n={r['n']} pooled={r['pooled']*100:.1f}% CI[{r['lo']*100:.0f},{r['hi']*100:.0f}] "
          f"| seasons beat vig {r['beat']}/{r['nyr']}, right-dir {r['right']}/{r['nyr']}")
        L(f"      per-season: {fmt_rates(r['rates'])}")


if __name__ == "__main__":
    L("="*94); L("EXHAUSTIVE TREND SCAN — guarding principle: >=2 seasons (n>=5) beat vig, same dir"); L("="*94)
    ATS_ANCHORS = ["home_dog", "road_fav", "pre_bye", "off_bye", "big_dog>=7", "blowout_loss_last", "div_revenge"]
    sc_ats, hits_ats = run_scan(tg, "team_cover", "ATS", ATS_ANCHORS)
    sc_ou, hits_ou = run_scan(gl, "over", "OU", ["wind>=13", "primetime", "dome", "big_fav_game"])
    report("ATS (team cover)", sc_ats, hits_ats)
    report("O/U (over)", sc_ou, hits_ou)
    L(f"\n[TOTAL screened] ATS={sc_ats} + OU={sc_ou} = {sc_ats+sc_ou} conditions/combinations")
