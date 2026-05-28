"""
Avenue E (last-game effects), F (look-ahead/trap), plus rigorous per-season checks on
the primetime-under and playoff-home-cover patterns surfaced in avenue I.
"""
import os, sys
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt

pd.set_option("display.width", 200)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
m = pd.read_parquet(os.path.join(DATA, "master.parquet"))
L = print
m["ats_home"] = np.where(m["spread_diff"] > 0, 1.0, np.where(m["spread_diff"] < 0, 0.0, np.nan))
m["under_win"] = np.where(m["total_diff"] < 0, 1.0, np.where(m["total_diff"] > 0, 0.0, np.nan))
m["over_win"] = 1 - m["under_win"]


def season_bet(label, sub, outcome, price=-110):
    rows = []
    for s in sorted(sub["season"].unique()):
        ss = sub[sub["season"] == s]; oc = ss[outcome].dropna()
        rows.append(bet_summary(int((oc == 1).sum()), int(oc.isin([0, 1]).sum()), str(int(s)), price))
    oc = sub[outcome].dropna()
    allr = bet_summary(int((oc == 1).sum()), int(oc.isin([0, 1]).sum()), "ALL", price)
    L(f"\n  >> {label}")
    for r in rows + [allr]:
        L("     " + fmt(r))
    return allr


L("="*90); L("AVENUE I (robustness) — PRIMETIME UNDER & PLAYOFF HOME-COVER per season"); L("="*90)
season_bet("UNDER in primetime (kick>=19 ET)", m[m["primetime"] == 1], "under_win")
season_bet("UNDER on Monday", m[m["is_mon"] == 1], "under_win")
season_bet("HOME ATS in playoffs (wk>=19)", m[m["week"] >= 19], "ats_home")
# confound check: are primetime totals lower? do primetime games involve better defenses?
m["is_outdoor"] = (m["roof"].isin(["outdoors", "open"])).astype(int)
pt = m[m["primetime"] == 1]; non = m[m["primetime"] == 0]
L(f"\n  confound: primetime mean total line={pt['ou_vegas_line'].mean():.1f} vs non={non['ou_vegas_line'].mean():.1f}; "
  f"actual total={pt['actual_total'].mean():.1f} vs {non['actual_total'].mean():.1f}")
L(f"  primetime outdoor share={pt['is_outdoor'].mean():.2f} vs {non['is_outdoor'].mean():.2f}; "
  f"mean wind={pt['wind_mph'].mean():.1f} vs {non['wind_mph'].mean():.1f} (dome doesn't explain under)")

# ===================== build team-game long table =====================
def long_table(df):
    h = df.assign(team=df["home_ab"], opp=df["away_ab"], is_home=1,
                  margin=df["actual_margin"], team_pts=df["home_score"], opp_pts=df["away_score"],
                  team_cover=df["ats_home"], opp_pr=df["away_predictive_pr"],
                  team_pr=df["home_predictive_pr"])
    a = df.assign(team=df["away_ab"], opp=df["home_ab"], is_home=0,
                  margin=-df["actual_margin"], team_pts=df["away_score"], opp_pts=df["home_score"],
                  team_cover=1 - df["ats_home"], opp_pr=df["home_predictive_pr"],
                  team_pr=df["away_predictive_pr"])
    cols = ["season", "week", "team", "opp", "is_home", "margin", "team_pts", "opp_pts",
            "team_cover", "opp_pr", "team_pr", "div_game", "spread_miss", "home_spread",
            "home_fav", "total_diff", "unique_id"]
    lt = pd.concat([h[cols], a[cols]], ignore_index=True).sort_values(["team", "season", "week"])
    # team's own spread: positive number = team getting points
    lt["team_spread"] = np.where(lt["is_home"] == 1, lt["home_spread"], -lt["home_spread"])
    lt["team_fav"] = (lt["team_spread"] < 0).astype(int)
    # prior game (same season)
    g = lt.groupby(["team", "season"])
    lt["prev_margin"] = g["margin"].shift(1)
    lt["prev_cover"] = g["team_cover"].shift(1)
    lt["prev_week"] = g["week"].shift(1)
    # next game (same season) -> look-ahead
    lt["next_opp_pr"] = g["opp_pr"].shift(-1)
    lt["next_div"] = g["div_game"].shift(-1)
    lt["next_week"] = g["week"].shift(-1)
    lt["next_team_spread"] = g["team_spread"].shift(-1)
    return lt

lt = long_table(m)

L("\n"+"="*90); L("AVENUE E — LAST-GAME EFFECTS (team perspective; cover next game?)"); L("="*90)
L("[E1] off a blowout WIN (prev margin>=14) -> team ATS next:")
season_bet("off blowout WIN, team ATS", lt[lt["prev_margin"] >= 14], "team_cover")
L("\n[E2] off a blowout LOSS (prev margin<=-14) -> team ATS next (bounce-back?):")
season_bet("off blowout LOSS, team ATS", lt[lt["prev_margin"] <= -14], "team_cover")
L("\n[E3] off a COVER vs off a NON-COVER -> team ATS next:")
season_bet("off a cover, team ATS", lt[lt["prev_cover"] == 1], "team_cover")
season_bet("off a non-cover, team ATS", lt[lt["prev_cover"] == 0], "team_cover")
L("\n[E4] off BYE (rest>=13 ~ prev_week gap>=2) team ATS:")
lt["off_bye"] = (lt["week"] - lt["prev_week"]) >= 2
season_bet("off bye, team ATS", lt[lt["off_bye"] == True], "team_cover")
L("\n[E5] FAVORITE coming off a blowout win (overvalued?) ATS:")
season_bet("fav off blowout win, ATS", lt[(lt["prev_margin"] >= 17) & (lt["team_fav"] == 1)], "team_cover")
L("\n[E6] magnitude: does prev blowout raise next-game |spread_miss|?")
for lab, mask in [("off blowout (|prev|>=17)", lt["prev_margin"].abs() >= 17),
                  ("off close (|prev|<=7)", lt["prev_margin"].abs() <= 7)]:
    sub = lt[mask]
    L(f"   {lab:26s} n={len(sub)} mean|sprmiss|={sub['spread_miss'].mean():.2f} "
      f"blowup%={(sub['spread_miss']>=21).mean()*100:.1f}")

L("\n"+"="*90); L("AVENUE F — LOOK-AHEAD / TRAP (strong opponent NEXT week)"); L("="*90)
L("[F1] FAVORITE this week with a strong opponent NEXT week (next_opp_pr high) -> underperform ATS?")
# trap: team is favorite now, next opponent is strong (top tier) and/or divisional
strong_next = lt["next_opp_pr"] >= lt["next_opp_pr"].quantile(.75)
for lab, mask in [
    ("fav now + strong opp next", (lt["team_fav"] == 1) & strong_next),
    ("fav now + strong+div opp next", (lt["team_fav"] == 1) & strong_next & (lt["next_div"] == 1)),
    ("heavy fav(-7+) + strong opp next", (lt["team_spread"] <= -7) & strong_next),
]:
    season_bet(lab + " -> team ATS", lt[mask], "team_cover")
L("\n[F2] magnitude: trap-spot favorites' |spread_miss| vs other favorites:")
trap = lt[(lt["team_fav"] == 1) & strong_next]
notrap = lt[(lt["team_fav"] == 1) & ~strong_next]
L(f"   trap favs: n={len(trap)} mean|miss|={trap['spread_miss'].mean():.2f} cover%={trap['team_cover'].mean()*100:.1f}")
L(f"   other favs: n={len(notrap)} mean|miss|={notrap['spread_miss'].mean():.2f} cover%={notrap['team_cover'].mean()*100:.1f}")
