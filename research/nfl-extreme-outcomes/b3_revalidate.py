"""
Brief #3 PART 1 — re-validate the proven/candidate trends on full data with PER-SEASON tables.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
from sklearn.ensemble import HistGradientBoostingClassifier
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
L = print
m = pd.read_parquet(os.path.join(DATA, "matchup.parquet"))
tg = pd.read_parquet(os.path.join(DATA, "tg.parquet"))
m["abs_spread"] = m["home_spread"].abs()
m["ats_home"] = np.where(m["spread_diff"] > 0, 1.0, np.where(m["spread_diff"] < 0, 0.0, np.nan))
m["under_win"] = np.where(m["total_diff"] < 0, 1.0, np.where(m["total_diff"] > 0, 0.0, np.nan))
m["is_outdoor"] = (~m["dome_closed"].astype("boolean").fillna(False)).astype(int)


def per_season(label, df, outcome, price=-110):
    rows = []
    for s in sorted(df["season"].dropna().unique()):
        oc = df[df["season"] == s][outcome].dropna()
        rows.append(bet_summary(int((oc == 1).sum()), int(oc.isin([0, 1]).sum()), str(int(s)), price))
    oc = df[outcome].dropna()
    allr = bet_summary(int((oc == 1).sum()), int(oc.isin([0, 1]).sum()), "ALL", price)
    pos = sum(1 for r in rows if r.get("n", 0) >= 5 and r.get("hit", 0) >= 0.524)
    nyr = sum(1 for r in rows if r.get("n", 0) >= 5)
    L(f"\n  >> {label}   [{pos}/{nyr} seasons beat vig]")
    for r in rows + [allr]:
        L("     " + fmt(r))


L("="*86); L("P1.1  +7.5 to +9.5 DOG -> take the dog ATS (band edges + full history)"); L("="*86)
for lo, hi in [(7.0, 7.0), (7.5, 9.5), (7.5, 10.5), (10.0, 13.5)]:
    dog = m[m["abs_spread"].between(lo, hi)].copy()
    dog["dog_cover"] = np.where(dog["spread_diff"].abs() == 0, np.nan,
                               1 - dog["ats_home"] if False else np.where(
                                   (dog["home_spread"] > 0), dog["ats_home"], 1 - dog["ats_home"]))
    # dog is the team getting points; dog covers when underdog beats the number
    dog["dog_cover"] = np.where(dog["spread_diff"] == 0, np.nan,
                                np.where(dog["home_spread"] > 0, dog["ats_home"], 1 - dog["ats_home"]))
    per_season(f"dog band +{lo} to +{hi}", dog, "dog_cover")

L("\n"+"="*86); L("P1.2  BIG-FAVORITE late-season -> UNDER (refine size/week)"); L("="*86)
for wk in [10]:
    for sp in [7, 10]:
        sub = m[(m["week"] >= wk) & (m["abs_spread"] >= sp)]
        per_season(f"spread>={sp}, week>={wk} -> UNDER", sub, "under_win")

L("\n"+"="*86); L("P1.3  CONFIDENT TOTALS MODEL — top-confidence O/U picks (walk-forward)"); L("="*86)
m["pace_sum"] = m["home_off_plays_per_game_s2d"] + m["away_off_plays_per_game_s2d"]
TF = ["ou_vegas_line", "home_off_pass_epa_neutral_s2d", "away_off_pass_epa_neutral_s2d",
      "home_def_pass_epa_allowed_neutral_s2d", "away_def_pass_epa_allowed_neutral_s2d",
      "wind_mph", "dome_closed", "primetime", "pace_sum", "home_predictive_pr", "away_predictive_pr",
      "temp_f", "home_backup_qb", "away_backup_qb"]
for f in TF:
    m[f] = pd.to_numeric(m[f], errors="coerce")
W = m[m["week"] >= 4].copy(); W["over_t"] = W["over"] if "over" in W else None
W["over_t"] = np.where(W["total_diff"] > 0, 1, np.where(W["total_diff"] < 0, 0, np.nan))
oof = []
for Y in range(2021, 2026):
    tr = W[(W.season < Y) & W.over_t.notna()]; te = W[(W.season == Y) & W.over_t.notna()]
    clf = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300,
                                         l2_regularization=1.0, min_samples_leaf=40, random_state=0)
    clf.fit(tr[TF], tr.over_t.astype(int)); p = clf.predict_proba(te[TF])[:, 1]
    t = te[["season", "over_t"]].copy(); t["p"] = p; t["conf"] = np.abs(p - 0.5); oof.append(t)
oof = pd.concat(oof)
for q in [0.70, 0.50, 0.30]:
    thr = oof["conf"].quantile(q); sub = oof[oof["conf"] >= thr]
    pick_over = sub[sub.p >= 0.5]; pick_under = sub[sub.p < 0.5]
    won = pd.concat([pick_over["over_t"], 1 - pick_under["over_t"]]).dropna()
    k = int((won == 1).sum()); n = int(won.isin([0, 1]).sum())
    L(f"  top {int((1-q)*100)}% confident picks: " + fmt(bet_summary(k, n, f"top{int((1-q)*100)}%")))
# per season top-30%
L("  per-season, top-30% confident:")
thr = oof["conf"].quantile(0.70)
for Y in sorted(oof.season.unique()):
    ss = oof[(oof.season == Y) & (oof.conf >= thr)]
    won = pd.concat([ss[ss.p >= .5]["over_t"], 1 - ss[ss.p < .5]["over_t"]]).dropna()
    L("     " + fmt(bet_summary(int((won == 1).sum()), int(won.isin([0, 1]).sum()), str(int(Y)))))

L("\n"+"="*86); L("P1.4  BYE WEEK — pre-bye home ATS / fade post-bye favorite"); L("="*86)
per_season("pre-bye HOME team ATS", tg[(tg.pre_bye == 1) & (tg.is_home == 1)], "team_cover")
fade = tg[(tg.off_bye == 1) & (tg.team_fav == 1)].copy(); fade["fade"] = 1 - fade["team_cover"]
per_season("FADE post-bye favorite (bet opp)", fade, "fade")
per_season("pre-bye ANY team ATS", tg[tg.pre_bye == 1], "team_cover")

L("\n"+"="*86); L("P1.5  UPSET BOUNCE/FADE — top-5 PR loses SU to bottom-10 PR"); L("="*86)
# rank PR within (season, week)
m2 = m.copy()
allteams = pd.concat([
    m2[["season", "week", "home_ab", "home_predictive_pr"]].rename(columns={"home_ab": "team", "home_predictive_pr": "pr"}),
    m2[["season", "week", "away_ab", "away_predictive_pr"]].rename(columns={"away_ab": "team", "away_predictive_pr": "pr"})])
allteams["pr_rank"] = allteams.groupby(["season", "week"])["pr"].rank(ascending=False)
rk = allteams.set_index(["season", "week", "team"])["pr_rank"]
tg2 = tg.copy()
tg2["team_rank"] = tg2.set_index(["season", "week", "team"]).index.map(rk)
tg2["opp_rank"] = tg2.set_index(["season", "week", "opp"]).index.map(rk)
# upset this game: team is bottom-10 and beat a top-5 opp (team won SU as big dog by rank)
tg2 = tg2.sort_values(["team", "season", "week"])
g2 = tg2.groupby(["team", "season"], group_keys=False)
tg2["prev_team_rank"] = g2["team_rank"].shift(1)
tg2["prev_opp_rank"] = g2["opp_rank"].shift(1)
tg2["prev_su_win"] = g2["su_win"].shift(1)
# good team that LOST last week as top-5 to a bottom-10 -> back them now
good_bounce = tg2[(tg2.prev_team_rank <= 5) & (tg2.prev_opp_rank >= 23) & (tg2.prev_su_win == 0)]
# bad team that WON last week as bottom-10 over top-5 -> fade them now
bad_fade = tg2[(tg2.prev_team_rank >= 23) & (tg2.prev_opp_rank <= 5) & (tg2.prev_su_win == 1)].copy()
bad_fade["fade"] = 1 - bad_fade["team_cover"]
per_season("BACK good team after upset loss (top5 lost to bot10)", good_bounce, "team_cover")
per_season("FADE bad team after upset win (bot10 beat top5)", bad_fade, "fade")

L("\n"+"="*86); L("P1.6  WIND UNDER — threshold + total interaction"); L("="*86)
for thr in [13, 15, 17, 20]:
    per_season(f"outdoor wind>={thr} -> UNDER", m[(m.is_outdoor == 1) & (m.wind_mph >= thr)], "under_win")

L("\n"+"="*86); L("P1.7  FAVORITE-LONGSHOT ML (vig-sane real prices)"); L("="*86)
fav = tg[(tg.ml_vig_ok) & (tg.ml_price < 0)].copy()
for lo, hi, lab in [(-140, -101, "small fav -101..-140"), (-200, -141, "moderate fav -141..-200"),
                    (-250, -201, "heavy fav -201..-250"), (-100000, -251, "very heavy <=-251")]:
    sub = fav[(fav.ml_price >= lo) & (fav.ml_price <= hi)].copy()
    if len(sub) < 20:
        continue
    dec = np.where(sub.ml_price < 0, 100/sub.ml_price.abs(), sub.ml_price/100)
    prof = np.where(sub.su_win == 1, dec, -1.0)
    rows = []
    for s in sorted(sub.season.unique()):
        ss = sub[sub.season == s]; d2 = np.where(ss.ml_price < 0, 100/ss.ml_price.abs(), ss.ml_price/100)
        pr = np.where(ss.su_win == 1, d2, -1.0); n = len(ss)
        rows.append(f"{int(s)}:{ss.su_win.mean()*100:.0f}%/{pr.sum()/n*100:+.0f}%" if n >= 8 else f"{int(s)}:n{n}")
    L(f"  {lab:24s} n={len(sub)} win={sub.su_win.mean()*100:.1f}% ROI={prof.sum()/len(sub)*100:+.1f}% | "
      + " ".join(rows))
