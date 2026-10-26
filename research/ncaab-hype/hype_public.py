#!/usr/bin/env python3
"""Do public betting percentages matter in the early-hype games? Two seasons (2024-25, 2025-26) of Action Network splits
joined to the hype panel on slate date + team name. Reads: where the tickets and money sat relative to the hype team,
who covered, and whether a tickets/money split picked the right side. Also the whole early power-vs-power universe as context.
"""
import re
import numpy as np
import pandas as pd

A = pd.read_parquet("../ncaab-splits/data/ncaab_splits.parquet")
P = pd.read_parquet("../bball-odds/data/parquet/cbb_sit_panel.parquet",
                    columns=["season", "teamId", "opponentId", "team", "opponent", "conference", "opponentConference", "date", "month", "neutral", "is_home",
                             "post", "spread", "ats_pts", "win", "margin", "o_kp_rank"])
P["season_end"] = P.season.str[:4].astype(int) + 1
H = pd.read_parquet("data/hype_index.parquet")[["season", "teamId", "n_top50"]].rename(columns={"season": "season_end"})
P = P.merge(H, on=["season_end", "teamId"], how="left").merge(H.rename(columns={"teamId": "opponentId", "n_top50": "o_n_top50"}), on=["season_end", "opponentId"], how="left")
POWER = {"ACC", "Big 12", "Big Ten", "SEC", "Big East", "Pac-12"}
U = P[(P.post == 0) & P.month.isin([11, 12]) & P.spread.notna() & (P.spread.abs() <= 12) & P.conference.isin(POWER)
      & (P.opponentConference.isin(POWER) | (P.o_kp_rank <= 40)) & P.season_end.isin([2025, 2026])].copy()
U["hype"] = (U.n_top50 >= 3) & (U.o_n_top50 <= 1)
U["anti"] = (U.o_n_top50 >= 3) & (U.n_top50 <= 1)


def norm(s):
    s = str(s).lower().replace("&", "and").replace("st.", "state").replace(".", "")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = s.replace("north carolina state", "nc state").replace("southern california", "usc").replace("connecticut", "uconn") \
         .replace("mississippi", "ole miss") if "ole" in s or "mississippi" == s.strip() else s
    return " ".join(s.split())


ALIAS = {"n carolina": "north carolina", "s carolina": "south carolina", "w virginia": "west virginia", "miami fl": "miami", "miami (fl)": "miami",
         "pitt": "pittsburgh", "uconn": "uconn", "ole miss": "ole miss", "nc state": "nc state", "st johns": "st john s", "texas aandm": "texas a and m",
         "g tech": "georgia tech", "v tech": "virginia tech", "n western": "northwestern", "mich state": "michigan state", "ohio state": "ohio state",
         "mississippi st": "mississippi state", "oklahoma st": "oklahoma state", "kansas st": "kansas state", "iowa st": "iowa state", "penn st": "penn state",
         "florida st": "florida state", "arizona st": "arizona state", "oregon st": "oregon state", "wash state": "washington state", "michigan st": "michigan state"}
A["hk"] = A.home.map(lambda x: ALIAS.get(norm(x), norm(x))); A["ak"] = A.away.map(lambda x: ALIAS.get(norm(x), norm(x)))
A["hk_full"] = A.home_full.map(norm); A["ak_full"] = A.away_full.map(norm)
A["d"] = A.slate_date.dt.normalize()
U["tk"] = U.team.map(norm); U["ok"] = U.opponent.map(norm); U["d"] = pd.to_datetime(U.date).dt.normalize()


def find(r):
    cand = A[(A.d >= r.d - pd.Timedelta(days=1)) & (A.d <= r.d + pd.Timedelta(days=1))]
    for _, a in cand.iterrows():
        names_h = {a.hk, a.hk_full}; names_a = {a.ak, a.ak_full}
        th = any(r.tk == n or r.tk in n or n in r.tk for n in names_h) and any(r.ok == n or r.ok in n or n in r.ok for n in names_a)
        ta = any(r.tk == n or r.tk in n or n in r.tk for n in names_a) and any(r.ok == n or r.ok in n or n in r.ok for n in names_h)
        if th or ta:
            own_home = th
            tix = (100 - a.tix_away) if own_home else a.tix_away
            mny = (100 - a.mny_away) if own_home else a.mny_away
            return pd.Series(dict(an_id=a.game_id, tix_own=tix, mny_own=mny, an_spread=(a.home_spread if own_home else -a.home_spread), tickets=a.tickets))
    return pd.Series(dict(an_id=None, tix_own=np.nan, mny_own=np.nan, an_spread=np.nan, tickets=np.nan))


J = U.join(U.apply(find, axis=1))
print(f"universe rows {len(U)}; matched to AN {J.an_id.notna().sum()} ({J.an_id.notna().mean():.0%}); hype rows {int(U.hype.sum())}, matched {int((J.hype & J.an_id.notna()).sum())}")
print(f"spread agreement (panel vs AN close) within 1.5 pts: {((J.spread - J.an_spread).abs() <= 1.5).mean():.0%} of matched")
J = J[J.an_id.notna() & J.tix_own.notna() & ~J.tix_own.isin([0, 100]) & ~J.mny_own.isin([0, 100])].copy()   # 0/100 = feed placeholder, not a crowd
J["cover"] = J.ats_pts > 0


def rec(m, won):
    w, l = int(won[m].sum()), int((~won[m]).sum()); n = w + l
    return f"{w}-{l}  {w / max(n, 1):5.1%}  n={n}"


def block(name, S):
    print(f"\n=== {name}: n={len(S)} ===")
    print(f"  tickets on the hype team, mean {S.tix_own.mean():.0f}%  (median {S.tix_own.median():.0f}%); money {S.mny_own.mean():.0f}%")
    print(f"  crowd (ticket majority) on the HYPE team in {(S.tix_own > 50).mean():.0%} of games; money majority on hype in {(S.mny_own > 50).mean():.0%}")
    print(f"  hype team covers:                 {rec(np.ones(len(S), bool), S.cover.values)}")
    print(f"  hype team covers, crowd ON hype:  {rec((S.tix_own > 50).values, S.cover.values)}")
    print(f"  hype team covers, crowd AGAINST:  {rec((S.tix_own < 50).values, S.cover.values)}")
    for lo, hi in ((50, 60), (60, 70), (70, 101)):
        print(f"     crowd {lo}-{hi - 1}% on hype -> hype covers {rec(((S.tix_own >= lo) & (S.tix_own < hi)).values, S.cover.values)}")
    for lo, hi in ((50, 60), (60, 70), (70, 101)):
        print(f"     crowd {lo}-{hi - 1}% AGAINST hype -> hype covers {rec(((100 - S.tix_own >= lo) & (100 - S.tix_own < hi)).values, S.cover.values)}")
    pub_won = np.where(S.tix_own > 50, S.cover, ~S.cover)
    mny_won = np.where(S.mny_own > 50, S.cover, ~S.cover)
    print(f"  CROWD side covers (either side):  {rec((S.tix_own != 50).values, pd.Series(pub_won, index=S.index).values)}")
    print(f"  MONEY side covers:                {rec((S.mny_own != 50).values, pd.Series(mny_won, index=S.index).values)}")
    both = ((S.tix_own > 50) == (S.mny_own > 50)) & (S.tix_own != 50)
    print(f"  tickets AND money same side -> that side covers: {rec(both.values, pd.Series(pub_won, index=S.index).values)}")
    flip = ((S.tix_own > 50) != (S.mny_own > 50)) & (S.tix_own != 50) & (S.mny_own != 50)
    print(f"  FLIP (tickets one side, money the other) -> MONEY side covers: {rec(flip.values, pd.Series(mny_won, index=S.index).values)}")
    gap = S.mny_own - S.tix_own
    print(f"  money leans toward hype (money% - tickets% >= +10) -> hype covers {rec((gap >= 10).values, S.cover.values)};  away from hype (<= -10) -> hype covers {rec((gap <= -10).values, S.cover.values)}")
    heavy = (S.tix_own >= 65) & (S.mny_own >= 65)
    print(f"  everyone on the hype team (tickets and money both 65%+) -> hype covers {rec(heavy.values, S.cover.values)}")
    heavy2 = (S.tix_own <= 35) & (S.mny_own <= 35)
    print(f"  everyone AGAINST the hype team (both 35%-) -> hype covers {rec(heavy2.values, S.cover.values)}")


block("HYPE games (3+ top-50 vs 0-1), Nov-Dec major opponent, from the hype team's side", J[J.hype])
block("CONTEXT: every early power-vs-power row in the universe, from the row team's side (hype = own side)", J)
S = J[J.hype].sort_values("date")
print("\n--- the hype games, one line each ---")
print(S[["season", "date", "team", "opponent", "neutral", "spread", "tix_own", "mny_own", "margin", "ats_pts"]].to_string(index=False))

# the context cell, deduplicated to one row per GAME (the crowd's side) and split by season
C = J[(J.tix_own > 50)].copy()
print("\n=== CONTEXT, one row per game from the CROWD's side (early power-vs-power, |spread|<=12) ===")
for lo in (50, 60, 70, 80):
    m = (C.tix_own >= lo)
    print(f"  crowd {lo}%+ side covers: {rec(m.values, C.cover.values)}   by season: " +
          "  ".join(f"{s} {int(g.cover.sum())}-{int((~g.cover).sum())}" for s, g in C[m].groupby('season')))
m = (C.tix_own >= 65) & (C.mny_own >= 65)
print(f"  tickets AND money both 65%+ on a side -> that side covers: {rec(m.values, C.cover.values)}   by season: " +
      "  ".join(f"{s} {int(g.cover.sum())}-{int((~g.cover).sum())}" for s, g in C[m].groupby('season')))
m = (C.tix_own >= 70) & (C.hype)
print(f"  crowd 70%+ on the HYPE team specifically -> hype covers: {rec(m.values, C.cover.values)}")
m = (C.tix_own >= 70) & (~C.hype) & (~C.anti)
print(f"  crowd 70%+ in games with NO hype roster on either side -> crowd covers: {rec(m.values, C.cover.values)}")
