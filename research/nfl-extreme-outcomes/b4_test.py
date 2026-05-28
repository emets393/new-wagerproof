"""
Brief #4 — test stakes spots vs ATS / O-U / ML (2002-2025), with per-season + per-era + guarding principle.
Joins MC stakes (b4_stakes) to game outcomes from games_enriched. Orthogonality check on 2018-25 vs PR.
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
L = print
g = pd.read_parquet(os.path.join(DATA, "games_enriched.parquet"))
S = pd.read_parquet(os.path.join(DATA, "b4_stakes.parquet"))

# ---------- team-game outcomes from games_enriched (2002-2025, REG, played, lines present) ----------
gg = g[(g.game_type == "REG") & g.home_score.notna() & g.spread_line.notna() & g.total_line.notna()].copy()
gg["result"] = gg.home_score - gg.away_score
gg["total_pts"] = gg.home_score + gg.away_score
rows = []
for r in gg.itertuples():
    for team, opp, ishome, sf in ((r.home_team, r.away_team, 1, r.result), (r.away_team, r.home_team, 0, -r.result)):
        # home covers if result > spread_line (nflverse spread_line>0 = home favored)
        cov = (r.result > r.spread_line) if ishome else (r.result < r.spread_line)
        push = (r.result == r.spread_line)
        ml = r.home_moneyline if ishome else r.away_moneyline
        rows.append(dict(season=r.season, week=r.week, team=team, opp=opp, is_home=ishome,
                         team_cover=(np.nan if push else float(cov)),
                         su_win=float(sf > 0), ml_price=ml,
                         over=(np.nan if r.total_pts == r.total_line else float(r.total_pts > r.total_line)),
                         total_pts=r.total_pts, total_line=r.total_line, spread_line=r.spread_line,
                         div_game=int(r.home_div == r.away_div), team_fav=int((sf < 0) == False and False) ))
tgo = pd.DataFrame(rows)
tgo["team_fav"] = np.where(tgo.is_home == 1, tgo.spread_line > 0, tgo.spread_line < 0)
L(f"[build] team-game outcomes 2002-2025: {len(tgo)} rows")

# validate cover vs Brief #1 master (2018-25)
try:
    m = pd.read_parquet(os.path.join(DATA, "master.parquet"))
    tm = pd.read_parquet(os.path.join(DATA, "team_mapping.parquet"))
    nv2ab = {"LA": "LAR", "SD": "LAC", "STL": "LAR", "OAK": "OAK", "LV": "LV"}
    chk = tgo[tgo.is_home == 1].copy()
    chk["home_ab"] = chk.team.replace(nv2ab); chk["away_ab"] = chk.opp.replace(nv2ab)
    mm = m.copy(); mm["ats_home"] = np.where(mm.spread_diff > 0, 1.0, np.where(mm.spread_diff < 0, 0.0, np.nan))
    j = chk.merge(mm[["season", "week", "home_ab", "away_ab", "ats_home"]], on=["season", "week", "home_ab", "away_ab"], how="inner").dropna(subset=["team_cover", "ats_home"])
    L(f"[validate] ATS cover vs master agreement: {(j.team_cover==j.ats_home).mean()*100:.1f}% (n={len(j)})")
except Exception as e:
    L(f"[validate] skipped ({e})")

# ---------- merge stakes (team) + opp stakes ----------
st = S[["season", "week", "team", "playoff_pct", "div_pct", "leverage", "po_if_win", "po_if_lose",
        "eliminated", "clinched", "must_win", "win_and_in", "no_stakes"]]
d = tgo.merge(st, on=["season", "week", "team"], how="inner")
opp = st.rename(columns={"team": "opp", "playoff_pct": "opp_po", "leverage": "opp_lev",
                         "eliminated": "opp_elim", "clinched": "opp_clinch", "must_win": "opp_mustwin",
                         "no_stakes": "opp_nostakes"})[["season", "week", "opp", "opp_po", "opp_lev",
                         "opp_elim", "opp_clinch", "opp_mustwin", "opp_nostakes"]]
d = d.merge(opp, on=["season", "week", "opp"], how="left")
d["lev_diff"] = d.leverage - d.opp_lev
d["era"] = np.where(d.season <= 2019, "2002-19(6tm)", np.where(d.season == 2020, "2020(7/16)", "2021-25(7/17)"))
L(f"[merge] stakes+outcomes joined: {len(d)} team-games (weeks>=4)\n")


def cut(label, sub, outcome, price=-110, minyr=5):
    rows = []
    for s in sorted(sub.season.dropna().unique()):
        oc = sub[sub.season == s][outcome].dropna()
        rows.append(bet_summary(int((oc == 1).sum()), int(oc.isin([0, 1]).sum()), str(int(s)), price))
    oc = sub[outcome].dropna()
    allr = bet_summary(int((oc == 1).sum()), int(oc.isin([0, 1]).sum()), "ALL", price)
    nyr = sum(1 for r in rows if r.get("n", 0) >= minyr)
    beat = sum(1 for r in rows if r.get("n", 0) >= minyr and r.get("hit", 0) >= 0.524)
    L(f"  >> {label}  [{beat}/{nyr} seasons beat vig | ALL {fmt(allr)}]")
    return allr, beat, nyr


def era_table(label, sub, outcome):
    L(f"  -- {label} by era --")
    for e in ["2002-19(6tm)", "2020(7/16)", "2021-25(7/17)"]:
        oc = sub[sub.era == e][outcome].dropna()
        if int(oc.isin([0, 1]).sum()) >= 10:
            L("     " + fmt(bet_summary(int((oc == 1).sum()), int(oc.isin([0, 1]).sum()), e)))


L("="*90); L("STAKES TESTS — ATS (team_cover), O/U (over), ML"); L("="*90)

L("\n[1] MUST-WIN team (lose->out, win->alive) — ATS & ML & total")
mw = d[d.must_win]
cut("must-win team ATS", mw, "team_cover"); era_table("must-win ATS", mw, "team_cover")
cut("must-win team -> OVER", mw, "over"); cut("must-win team UNDER (fade over)", mw.assign(u=1-mw.over), "u")

L("\n[2] ELIMINATED team — fade ATS? and totals UNDER?")
el = d[d.eliminated]
cut("eliminated team ATS (back)", el, "team_cover"); era_table("eliminated ATS", el, "team_cover")
cut("eliminated team games -> OVER", el, "over")

L("\n[3] NO-STAKES team (elim or clinched) — fade ATS & totals UNDER")
ns = d[d.no_stakes]
cut("no-stakes team ATS", ns, "team_cover")
cut("no-stakes team -> UNDER", ns.assign(u=1-ns.over), "u"); era_table("no-stakes UNDER", ns.assign(u=1-ns.over), "u")
L("   (esp. late season wk>=16):")
cut("no-stakes wk>=16 -> UNDER", ns[ns.week>=16].assign(u=1-ns[ns.week>=16].over), "u")

L("\n[4] HIGH LEVERAGE (top quartile |lev|) team ATS")
thr = d.leverage.abs().quantile(0.75)
cut(f"high-leverage(|lev|>={thr:.2f}) team ATS", d[d.leverage.abs() >= thr], "team_cover")

L("\n[5] LEVERAGE DIFFERENTIAL — back the higher-leverage side ATS")
cut("higher-leverage side ATS (lev_diff>0.10)", d[d.lev_diff > 0.10], "team_cover")
cut("lower-leverage side ATS (lev_diff<-0.10)", d[d.lev_diff < -0.10], "team_cover")

L("\n[6] MISMATCH — must-win/high-lev team vs NO-STAKES opponent")
mm2 = d[(d.must_win) & (d.opp_nostakes == True)]
cut("must-win vs no-stakes opp ATS", mm2, "team_cover")
cut("must-win vs no-stakes opp ML (SU)", mm2, "su_win", price=-110)
hi = d[(d.leverage > 0.15) & (d.opp_nostakes == True)]
cut("high-lev(>0.15) vs no-stakes opp ATS", hi, "team_cover"); era_table("hi-lev vs dead ATS", hi, "team_cover")

L("\n[7] DIVISION-RACE SHOWDOWN — both high leverage + divisional")
sd = d[(d.div_game == 1) & (d.leverage > 0.12) & (d.opp_lev > 0.12)]
cut("div showdown -> UNDER", sd.assign(u=1-sd.over), "u")
cut("div showdown favorite ATS", sd[sd.team_fav], "team_cover")

L("\n[8] EARLY-SEASON high leverage (wk8-13) vs LATE (wk16-18) — ATS")
cut("early hi-lev wk8-13 ATS", d[(d.week.between(8,13)) & (d.leverage.abs()>=thr)], "team_cover")
cut("late hi-lev wk16-18 ATS", d[(d.week.between(16,18)) & (d.leverage.abs()>=thr)], "team_cover")

# ---------- ORTHOGONALITY (2018-25): does the line already price stakes? ----------
L("\n"+"="*90); L("ORTHOGONALITY (2018-25) — is stakes already in the closing line?"); L("="*90)
try:
    m = pd.read_parquet(os.path.join(DATA, "master.parquet"))
    m["pr_diff"] = m.home_predictive_pr - m.away_predictive_pr; m["mkt_margin"] = -m.home_spread
    nv2ab = {"LA": "LAR", "SD": "LAC", "STL": "LAR"}
    dd = d.copy(); dd["team_ab"] = dd.team.replace(nv2ab)
    # team's expected margin from PR (home/away) vs the line; does must-win get extra line love?
    hm = m[["season","week","home_ab","mkt_margin","pr_diff"]].rename(columns={"home_ab":"team_ab"})
    j = dd[dd.is_home==1].merge(hm, on=["season","week","team_ab"], how="inner")
    j["line_minus_pr"] = j.mkt_margin - (j.pr_diff + 1.6)   # +=market gives team more than PR
    for lab, sub in [("must-win home teams", j[j.must_win]), ("no-stakes home teams", j[j.no_stakes]),
                     ("baseline home teams", j)]:
        if len(sub) >= 20:
            L(f"  {lab:24s} n={len(sub)} mean(line - PR_expectation)={sub.line_minus_pr.mean():+.2f} pts "
              f"| ATS cover={sub.team_cover.dropna().mean()*100:.1f}%")
    L("  (if must-win line≈PR and cover≈50%, the market already prices the motivation -> no edge)")
except Exception as e:
    L(f"  orthogonality skipped ({e})")
