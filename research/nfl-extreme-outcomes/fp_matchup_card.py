#!/usr/bin/env python3
"""Matchup card generator — the per-game breakdown engine (owner spec 2026-09-16).

Usage: fp_matchup_card.py AWAY_AB HOME_AB [--season 2026]
(FP abbreviations: ARZ BLT CLV HST LA etc.)

For each side, prints: defense scheme identity (man/zone/two-high, pressure-over-
expected), QB conditional volume vs scheme buckets, top receivers (alignment mix,
separation score, per-alignment production, vs-shell splits when available), RB
usage, and trench matchup. Identity = last full season + current season to date,
sample sizes always shown. Data: data/fpdata/ (see FPDATA_RESEARCH_PROGRAM.md).
"""
import sys

import numpy as np
import pandas as pd

NICK = {"Cardinals":"ARZ","Falcons":"ATL","Ravens":"BLT","Bills":"BUF","Panthers":"CAR",
"Bears":"CHI","Bengals":"CIN","Browns":"CLV","Cowboys":"DAL","Broncos":"DEN","Lions":"DET",
"Packers":"GB","Texans":"HST","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA",
"Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE",
"Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA",
"49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}

DIR = "data/fpdata/"


def num(s):
    return pd.to_numeric(s, errors="coerce")


def load():
    d = {}
    d["cov"] = pd.read_parquet(DIR + "team_defense_coverage-matrix.parquet")
    d["cov"]["ab"] = d["cov"].teamNickname.map(NICK)
    for k, c in (("man", "Man"), ("zone", "Zone"), ("twohigh", "TwoHigh"), ("onehigh", "SingleHigh")):
        d["cov"][k] = num(d["cov"][f"opponentStatsCoverageScheme{c}PassingDropbacksPercentage"])
    d["lm"] = pd.read_parquet(DIR + "lineMatchups__team.parquet")
    d["qb"] = pd.read_parquet(DIR + "player_passing-advanced.parquet")
    d["alg"] = pd.read_parquet(DIR + "split_recv_adv_x_alignment.parquet")
    d["sep"] = pd.read_parquet(DIR + "player_receiving-separation-by-alignment.parquet")
    d["rb"] = pd.read_parquet(DIR + "player_rushing-bell-cow.parquet")
    d["rushP"] = pd.read_parquet(DIR + "player_rushing-advanced.parquet")
    d["rushT"] = pd.read_parquet(DIR + "team_offense_rushing-advanced.parquet")
    d["rushD"] = pd.read_parquet(DIR + "team_defense_rushing-advanced.parquet")
    return d


def pct(x):
    return "-" if pd.isna(x) else f"{100*x:.0f}%"


def defense_block(d, ab, seasons):
    c = d["cov"][(d["cov"].ab == ab) & d["cov"].__season.isin(seasons)]
    lm = d["lm"][(d["lm"].teamNickname.map(NICK) == ab) & d["lm"].__season.isin(seasons)]
    poe = num(lm["opponentStatsPassingPressuredOverExpected"]).mean()
    print(f"  DEFENSE ({len(c)} gms): man {pct(c.man.mean())} | zone {pct(c.zone.mean())}"
          f" | two-high {pct(c.twohigh.mean())} | single-high {pct(c.onehigh.mean())}"
          f" | pressure-over-expected {poe:+.1%}" if len(c) else "  DEFENSE: no data")


def qb_block(d, ab, seasons, scheme_ident):
    q = d["qb"][(d["qb"].teamAbbreviation == ab) & d["qb"].__season.isin(seasons)].copy()
    dbcol = next(c for c in q.columns if "Dropback" in c and "Total" in c)
    q["db"] = num(q[dbcol])
    q = q[q.db >= 10]
    if not len(q):
        print("  QB: no data")
        return
    name = q.groupby(["playerFirstName", "playerLastName"]).db.sum().idxmax()
    qq = q[(q.playerFirstName == name[0]) & (q.playerLastName == name[1])].copy()
    for bucket in ("man", "twohigh"):
        hv = set(scheme_ident[scheme_ident[bucket] >= scheme_ident[bucket].quantile(0.67)].index)
        qq[f"vs_{bucket}"] = qq.opponentAbbreviation.isin(hv)
    print(f"  QB {name[0]} {name[1]} ({len(qq)} gms): {qq.db.mean():.1f} dropbacks/g"
          f" | vs man-heavy {qq[qq.vs_man].db.mean():.1f} (n={int(qq.vs_man.sum())})"
          f" | vs two-high-heavy {qq[qq.vs_twohigh].db.mean():.1f} (n={int(qq.vs_twohigh.sum())})")


def receivers_block(d, ab, seasons):
    a = d["alg"][(d["alg"].teamAbbreviation == ab) & d["alg"].__season.isin(seasons)].copy()
    a["tgt"] = num(a.playerStatsReceivingTargetsTotal)
    a["yds"] = num(a.playerStatsReceivingYardsTotal)
    top = (a.groupby(["playerPlayerId", "playerFirstName", "playerLastName", "playerPosition"])
           .tgt.sum().sort_values(ascending=False).head(4))
    s = d["sep"][d["sep"].__season.isin(seasons)].copy()
    s["ss"] = num(s.playerStatsReceivingSeparationScorePercentage)
    lg_ss = s[s.playerPosition == "WR"].ss.mean()
    for (pid, fn, ln, pos), _ in top.items():
        pa = a[a.playerPlayerId == pid]
        mix = pa.groupby("playPlayerAlignmentFamily").agg(t=("tgt", "sum"), y=("yds", "sum"))
        tot = mix.t.sum()
        mixstr = " / ".join(f"{fam} {100*row.t/tot:.0f}% ({row.y:.0f}y)"
                            for fam, row in mix.sort_values("t", ascending=False).iterrows() if row.t >= 2)
        ss = s[s.playerPlayerId == pid].ss.mean()
        ssstr = f" | sep {100*ss:.1f}% (lg {100*lg_ss:.1f}%)" if pd.notna(ss) else ""
        print(f"  {pos} {fn} {ln} ({int(tot)} tgt): {mixstr}{ssstr}")


def trench_block(d, off_ab, def_ab, seasons):
    """OL vs DL: pass protection (pressure over expected) + run blocking (YBC)."""
    lm = d["lm"].copy()
    lm["ab"] = lm.teamNickname.map(NICK)
    ol = lm[(lm.ab == off_ab) & lm.__season.isin(seasons)]
    dl = lm[(lm.ab == def_ab) & lm.__season.isin(seasons)]
    ol_poe = num(ol["teamStatsPassingPressuredOverExpected"]).mean()      # own QB pressured vs expected = OL quality
    dl_poe = num(dl["opponentStatsPassingPressuredOverExpected"]).mean()  # pressure generated vs expected = DL quality
    ro = d["rushT"][(d["rushT"].teamNickname.map(NICK) == off_ab) & d["rushT"].__season.isin(seasons)]
    rd = d["rushD"][(d["rushD"].teamNickname.map(NICK) == def_ab) & d["rushD"].__season.isin(seasons)]
    ol_ybc = num(ro["teamStatsRushingYardsBeforeContactPerAttempt"]).mean() if "teamStatsRushingYardsBeforeContactPerAttempt" in ro.columns else np.nan
    dl_ybc = num(rd["opponentStatsRushingYardsBeforeContactPerAttempt"]).mean()
    dl_stuff = num(rd["opponentStatsRushingAttemptsStuffsPercentage"]).mean()
    print(f"  TRENCHES: OL pressure-allowed-over-exp {ol_poe:+.1%} | DL pressure-gen-over-exp {dl_poe:+.1%}"
          f"\n            OL run-block YBC/att {ol_ybc:.2f} | DL YBC allowed/att {dl_ybc:.2f} | DL stuff rate {pct(dl_stuff)}")


def qb_pressure_block(d, ab, seasons):
    q = d["qb"][(d["qb"].teamAbbreviation == ab) & d["qb"].__season.isin(seasons)].copy()
    dbcol = next(c for c in q.columns if "Dropback" in c and "Total" in c)
    q["db"] = num(q[dbcol])
    q = q[q.db >= 10]
    if not len(q):
        return
    name = q.groupby(["playerFirstName", "playerLastName"]).db.sum().idxmax()
    qq = q[(q.playerFirstName == name[0]) & (q.playerLastName == name[1])]
    pr = num(qq["playerStatsPassingPressuredPercentage"]).mean()
    poe = num(qq["playerStatsPassingPressuredOverExpected"]).mean()
    sack_when_pr = num(qq["playerStatsPassingSackedPressuredPercentage"]).mean()
    print(f"  QB pressure profile: pressured {pct(pr)} (over-exp {poe:+.1%}) | sacked-when-pressured {pct(sack_when_pr)}")


def rb_block(d, ab, seasons):
    r = d["rb"][(d["rb"].teamAbbreviation == ab) & d["rb"].__season.isin(seasons)
                & (d["rb"].playerPosition == "RB")].copy()
    att = next((c for c in r.columns if c.startswith("playerStats") and "RushingAttemptsTotal" in c), None)
    if att is None or not len(r):
        return
    r["att"] = num(r[att])
    adv = d["rushP"][(d["rushP"].teamAbbreviation == ab) & d["rushP"].__season.isin(seasons)
                     & (d["rushP"].playerPosition == "RB")].copy()
    for c, k in (("playerStatsRushingYardsBeforeContactPerAttempt", "ybc"),
                 ("playerStatsRushingYardsAfterContactPerAttempt", "yac"),
                 ("playerStatsRushingMissedTacklesForcedPerAttempt", "mtf"),
                 ("playerStatsRushingAttemptsStuffsPercentage", "stuff")):
        adv[k] = num(adv[c])
    top = (r.groupby(["playerFirstName", "playerLastName"]).att
           .agg(["sum", "mean", "count"]).sort_values("sum", ascending=False).head(2))
    for (fn, ln), row in top.iterrows():
        a = adv[(adv.playerFirstName == fn) & (adv.playerLastName == ln)]
        det = (f" | YBC/att {a.ybc.mean():.2f} | YAC/att {a.yac.mean():.2f}"
               f" | MTF/att {a.mtf.mean():.2f} | stuffed {pct(a.stuff.mean())}") if len(a) else ""
        print(f"  RB {fn} {ln}: {row['mean']:.1f} att/g over {int(row['count'])} gms{det}")


def main():
    away, home = sys.argv[1].upper(), sys.argv[2].upper()
    season = 2026
    d = load()
    seasons = [season - 1, season]
    ident = d["cov"][d["cov"].__season.isin(seasons)].groupby("ab")[["man", "zone", "twohigh"]].mean()
    print(f"=== MATCHUP CARD: {away} @ {home} (identity {season-1}+{season} to date) ===")
    for label, off_ab, def_ab in ((f"{away} OFFENSE vs {home} DEFENSE", away, home),
                                  (f"{home} OFFENSE vs {away} DEFENSE", home, away)):
        print(f"\n--- {label} ---")
        defense_block(d, def_ab, seasons)
        trench_block(d, off_ab, def_ab, seasons)
        qb_block(d, off_ab, seasons, ident)
        qb_pressure_block(d, off_ab, seasons)
        receivers_block(d, off_ab, seasons)
        rb_block(d, off_ab, seasons)


if __name__ == "__main__":
    main()
