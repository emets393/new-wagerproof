#!/usr/bin/env python3
"""College look-ahead spots, six seasons 2020-21 .. 2025-26, graded at the T-60 close from the team's side.

Owner question (2026-10-26): a top-25 matchup next, a conference rival next, two ranked teams facing off next -- does the
game BEFORE that give us anything? The earlier port (CBB_PORT_BRIEF.md) asked only "favored tonight, ranked opponent
next" (52.0%). This run builds the next game from the panel itself (sort each team-season by date, look one row ahead).

⛔ RANKS AS OF TONIGHT. The AP poll published between tonight and the next game already contains tonight's result, so
the next game's rank columns leak. Every rank here is the team's (or the next opponent's) AP rank on its most recent
game ON OR BEFORE tonight.

Reads: ../bball-odds/data/parquet/cbb_sit_panel.parquet (one row per team-game, T-60 lines, AP rank at tip, TV).
"""
import numpy as np
import pandas as pd

RNG = np.random.default_rng(20261026)
P = pd.read_parquet("../bball-odds/data/parquet/cbb_sit_panel.parquet",
                    columns=["season", "teamId", "opponentId", "team", "opponent", "conference", "opponentConference", "date", "month", "gnum",
                             "neutral", "is_home", "conf_game", "post", "spread", "ats_pts", "win", "margin", "total_line",
                             "tot_resid", "h1_ats_pts", "ap_rank", "o_ap_rank", "nat_tv", "spread_price"])
P["date"] = pd.to_datetime(P.date)
P = P.sort_values(["teamId", "season", "date"]).reset_index(drop=True)
g = P.groupby(["teamId", "season"])
for c in ("opponent", "opponentId", "neutral", "is_home", "conf_game", "nat_tv", "date", "spread", "post"):
    P["n_" + c] = g[c].shift(-1)
P["n_days"] = (P.n_date - P.date).dt.days
# rank as of tonight: the team's AP rank at its latest game on or before each date (asof merge per team-season)
R = P[["teamId", "season", "date", "ap_rank"]].rename(columns={"teamId": "opponentId", "date": "rdate", "ap_rank": "n_o_rank_asof"}).sort_values("rdate")
# merge_asof needs the key to be the NEXT opponent, so do it explicitly (int keys, NaN rows out, both sides sorted)
Q = P[["teamId", "season", "date", "n_opponentId"]].dropna(subset=["n_opponentId"]).copy()
Q["key"] = Q.n_opponentId.astype("int64"); Q["season"] = Q.season.astype(str)
Q = Q.sort_values("date")
R2 = R.rename(columns={"opponentId": "key"}).dropna(subset=["key"]).copy()
R2["key"] = R2.key.astype("int64"); R2["season"] = R2.season.astype(str); R2 = R2.sort_values("rdate")
Q = pd.merge_asof(Q, R2[["key", "season", "rdate", "n_o_rank_asof"]], left_on="date", right_on="rdate", by=["key", "season"], direction="backward")
P = P.merge(Q[["teamId", "season", "date", "n_o_rank_asof"]], on=["teamId", "season", "date"], how="left")
P = P.sort_values(["teamId", "season", "date"]).reset_index(drop=True)

P["n_top25_opp"] = P.n_o_rank_asof <= 25
P["n_top10_opp"] = P.n_o_rank_asof <= 10
P["n_ranked_vs_ranked"] = (P.ap_rank <= 25) & (P.n_o_rank_asof <= 25)
P["n_conf_ranked"] = (P.n_conf_game == 1) & (P.n_o_rank_asof <= 25)
P["n_road_ranked"] = (P.n_o_rank_asof <= 25) & (P.n_is_home == 0) & (P.n_neutral == 0)
RIV = [("Duke", "North Carolina"), ("Kentucky", "Louisville"), ("Kansas", "Kansas State"), ("Kansas", "Missouri"), ("Indiana", "Purdue"),
       ("Michigan", "Michigan State"), ("Michigan", "Ohio State"), ("Cincinnati", "Xavier"), ("Villanova", "Georgetown"), ("Syracuse", "Georgetown"),
       ("UConn", "Syracuse"), ("Arizona", "Arizona State"), ("UCLA", "USC"), ("Oregon", "Oregon State"), ("Washington", "Washington State"),
       ("Alabama", "Auburn"), ("Kentucky", "Tennessee"), ("Florida", "Florida State"), ("Iowa", "Iowa State"), ("Illinois", "Northwestern"),
       ("Wisconsin", "Marquette"), ("Indiana", "Notre Dame"), ("North Carolina", "NC State"), ("Duke", "NC State"), ("Virginia", "Virginia Tech"),
       ("Clemson", "South Carolina"), ("Texas", "Texas A&M"), ("Texas", "Oklahoma"), ("Oklahoma", "Oklahoma State"), ("Baylor", "Texas Tech"),
       ("BYU", "Utah"), ("Gonzaga", "Saint Mary's"), ("Xavier", "Dayton"), ("Memphis", "Tennessee"), ("Louisville", "Cincinnati"),
       ("Pittsburgh", "West Virginia"), ("Maryland", "Virginia"), ("Georgia", "Georgia Tech"), ("Butler", "Xavier"), ("Creighton", "Nebraska"),
       ("Kentucky", "Indiana"), ("Illinois", "Missouri"), ("Iowa", "Minnesota"), ("Purdue", "Notre Dame"), ("Providence", "UConn"),
       ("St. John's", "Villanova"), ("Seton Hall", "Villanova"), ("Colorado", "Colorado State"), ("Utah", "Utah State"), ("San Diego State", "UNLV"),
       ("Wichita State", "Kansas"), ("Ole Miss", "Mississippi State"), ("Arkansas", "Missouri"), ("LSU", "Alabama"), ("Vanderbilt", "Tennessee"),
       ("Temple", "Villanova"), ("Saint Joseph's", "Villanova"), ("La Salle", "Saint Joseph's"), ("VCU", "Richmond"), ("Davidson", "VCU"),
       ("Dayton", "Saint Louis"), ("Boise State", "Nevada"), ("New Mexico", "UNLV"), ("Houston", "Cincinnati")]
RIVS = {frozenset(p) for p in RIV}
P["n_rival"] = [frozenset((t, o)) in RIVS for t, o in zip(P.team, P.n_opponent.fillna(""))]
P["n_conf_rival"] = P.n_rival & (P.n_conf_game == 1)

# the mirror: does tonight's OPPONENT have a look-ahead? pull the opponent's own row for the same game
mir = P[["season", "teamId", "date", "n_top25_opp", "n_ranked_vs_ranked", "n_rival", "n_conf_ranked"]].rename(
    columns={"teamId": "opponentId", "n_top25_opp": "opp_la", "n_ranked_vs_ranked": "opp_rvr", "n_rival": "opp_riv", "n_conf_ranked": "opp_cr"})
P = P.merge(mir, on=["season", "opponentId", "date"], how="left")
for c in ("opp_la", "opp_rvr", "opp_riv", "opp_cr"):
    P[c] = P[c].fillna(False).astype(bool)

U = P[(P.post == 0) & P.spread.notna() & P.n_date.notna() & (P.n_days <= 7) & (P.n_post == 0)].copy().reset_index(drop=True)
U["fav"] = U.spread < 0
U["tonight_unranked_opp"] = U.o_ap_rank.isna()


def pay(p):
    return (p - 1.0) if pd.notna(p) and p > 1 else 100 / 110


def rec(df, col="ats_pts"):
    w, l, p = int((df[col] > 0).sum()), int((df[col] < 0).sum()), int((df[col] == 0).sum()); n = w + l
    pct = w / max(n, 1); lo = pct - 1.96 * np.sqrt(pct * (1 - pct) / max(n, 1))
    roi = (sum(pay(x) for x in df.loc[df[col] > 0, "spread_price"]) - l) / max(n, 1) * 100 if col == "ats_pts" else (w * 100 / 110 - l) / max(n, 1) * 100
    return w, l, p, pct, lo, roi


def fmt(df, col="ats_pts"):
    w, l, p, pct, lo, roi = rec(df, col)
    return f"{w}-{l}{('-' + str(p)) if p else ''}  {pct:6.1%} [lo {lo:5.1%}] roi {roi:+5.1f}% n={w + l}"


def spot(name, m, base_m=None):
    m = np.asarray(m, bool)
    s = U[m]
    if len(s) < 30:
        print(f"\n{name}: n={len(s)} (too thin)"); return
    print(f"\n{name}: n={len(s)}")
    print(f"   team ATS tonight (the look-ahead team covers)   {fmt(s)}")
    if base_m is not None:
        print(f"   blind baseline, same cut without the look-ahead {fmt(U[np.asarray(base_m, bool)])}")
    print(f"   SU: wins {s.win.mean():.1%}, avg spread {s.spread.mean():+.1f}, avg margin {s.margin.mean():+.1f}, avg cover amount {s.ats_pts.mean():+.2f}")
    ou = s[s.tot_resid.notna() & (s.tot_resid != 0)]
    print(f"   game total: OVER {int((ou.tot_resid > 0).sum())}-{int((ou.tot_resid < 0).sum())} ({(ou.tot_resid > 0).mean():.1%}), avg total residual {ou.tot_resid.mean():+.2f}")
    h1 = s[s.h1_ats_pts.notna() & (s.h1_ats_pts != 0)]
    if len(h1) >= 30:
        print(f"   first-half ATS: {fmt(h1, 'h1_ats_pts')}")
    print("   by season: " + "  ".join(f"{k} {int((x.ats_pts > 0).sum())}-{int((x.ats_pts < 0).sum())}" for k, x in s.groupby("season")))
    for lab, mm in (("favored tonight", s.fav), ("favored by 7+", s.spread <= -7), ("favored by 15+", s.spread <= -15), ("dog tonight", ~s.fav),
                    ("tonight at home", s.is_home == 1), ("tonight on the road", (s.is_home == 0) & (s.neutral == 0)),
                    ("tonight non-conference", s.conf_game == 0), ("tonight conference game", s.conf_game == 1),
                    ("tonight's opponent unranked", s.tonight_unranked_opp), ("tonight's opponent ranked", s.o_ap_rank <= 25),
                    ("next game within 3 days", s.n_days <= 3), ("team itself ranked tonight", s.ap_rank <= 25)):
        ss = s[mm]
        if len(ss) >= 30:
            print(f"      {lab:30s} {fmt(ss)}")


print(f"universe: {len(U)} team-games with a next game inside 7 days, regular season, {U.season.nunique()} seasons")
print(f"baseline, every row: {fmt(U)} | ranked teams tonight {fmt(U[U.ap_rank <= 25])} | favorites 15+ {fmt(U[U.spread <= -15])}")
none = ~U.n_top25_opp
spot("A. next opponent is AP top-25 (rank as of tonight)", U.n_top25_opp, none)
spot("B. next game is RANKED vs RANKED (team ranked tonight, next opponent ranked as of tonight)", U.n_ranked_vs_ranked, (U.ap_rank <= 25) & ~U.n_top25_opp)
spot("C. next opponent is top-10", U.n_top10_opp, none)
spot("D. next game is a conference showdown (conference game vs a ranked opponent)", U.n_conf_ranked, (U.n_conf_game == 1) & ~U.n_top25_opp)
spot("E. next game is a RIVALRY (curated list)", U.n_rival, ~U.n_rival)
spot("F. next game is a conference rivalry", U.n_conf_rival, (U.n_conf_game == 1) & ~U.n_rival)
spot("G. next game is a ROAD game at a ranked opponent", U.n_road_ranked, none)
spot("H. next game on national TV, tonight not", (U.n_nat_tv == 1) & (U.nat_tv == 0), (U.n_nat_tv == 0) & (U.nat_tv == 0))
spot("I. MIRROR: tonight's opponent looks ahead to a top-25 team, team does not -> the team covers?", U.opp_la & ~U.n_top25_opp, ~U.opp_la & ~U.n_top25_opp)
spot("J. MIRROR: tonight's opponent has ranked-vs-ranked next, team does not", U.opp_rvr & ~U.n_ranked_vs_ranked, ~U.opp_rvr & ~U.n_ranked_vs_ranked)
spot("K. MIRROR: tonight's opponent has a rivalry next, team does not", U.opp_riv & ~U.n_rival, ~U.opp_riv & ~U.n_rival)
spot("L. BOTH teams look ahead to a top-25 opponent", U.opp_la & U.n_top25_opp)

# ---- robustness on B ------------------------------------------------------------------------------------------------
print("\n" + "=" * 100 + "\nROBUSTNESS on B (ranked team tonight, ranked opponent next)\n" + "=" * 100)
B = U[U.n_ranked_vs_ranked]
# spread-band matched baseline: ranked teams tonight, next opponent NOT ranked, same spread band distribution
bands = pd.cut(U.spread, [-99, -15, -7, -3, 0, 3, 7, 99])
U["band"] = bands
base = U[(U.ap_rank <= 25) & ~U.n_top25_opp]
w_b = B.groupby(U.band[B.index], observed=True).size()
print("  B by spread band vs the ranked-no-lookahead baseline in the same band:")
for b in w_b.index:
    sb, bb = B[U.band[B.index] == b], base[U.band[base.index] == b]
    print(f"     {str(b):12s} B {fmt(sb):45s} | baseline {fmt(bb)}")
exp = sum(rec(base[U.band[base.index] == b])[3] * n for b, n in w_b.items() if len(base[U.band[base.index] == b])) / w_b.sum()
print(f"  band-weighted expected cover rate for B from the baseline: {exp:.1%}  vs observed {rec(B)[3]:.1%}")
# within-date permutation: among ranked teams playing that night, shuffle who has the ranked-next flag
pool = U[U.ap_rank <= 25].copy()
obs = rec(B)[3]
sims = []
for _ in range(1000):
    pool["flag"] = pool.groupby("date").n_ranked_vs_ranked.transform(lambda s: RNG.permutation(s.values))
    sims.append(rec(pool[pool.flag])[3])
sims = np.array(sims)
print(f"  within-night permutation among ranked teams: null {sims.mean():.1%} ± {sims.std():.1%}, p(null >= obs) = {(sims >= obs).mean():.3f}")
# placebo: ranked team whose ranked-vs-ranked game is the one AFTER next (8-14 days out), i.e. no immediate look-ahead
P2 = P.sort_values(["teamId", "season", "date"]).reset_index(drop=True)
P2["nn_opponentId"] = P2.groupby(["teamId", "season"]).opponentId.shift(-2)
P2["nn_date"] = P2.groupby(["teamId", "season"]).date.shift(-2)
Q2 = P2[["teamId", "season", "date", "nn_opponentId"]].dropna(subset=["nn_opponentId"]).copy(); Q2["key"] = Q2.nn_opponentId.astype("int64"); Q2["season"] = Q2.season.astype(str); Q2 = Q2.sort_values("date")
Q2 = pd.merge_asof(Q2, R2[["key", "season", "rdate", "n_o_rank_asof"]].rename(columns={"n_o_rank_asof": "nn_rank"}), left_on="date", right_on="rdate", by=["key", "season"], direction="backward")
P2 = P2.merge(Q2[["teamId", "season", "date", "nn_rank"]], on=["teamId", "season", "date"], how="left")
pl = P2[(P2.post == 0) & P2.spread.notna() & (P2.ap_rank <= 25) & (P2.nn_rank <= 25) & ~(P2.n_o_rank_asof <= 25) & P2.n_date.notna() & ((P2.n_date - P2.date).dt.days <= 7)]
print(f"  placebo -- ranked team, ranked opponent two games out, next game NOT ranked: {fmt(pl)}")
print("  B top contributors (team, n, record):")
print("   " + "; ".join(f"{t} {int((x.ats_pts > 0).sum())}-{int((x.ats_pts < 0).sum())}" for t, x in sorted(B.groupby('team'), key=lambda kv: -len(kv[1]))[:12]))
