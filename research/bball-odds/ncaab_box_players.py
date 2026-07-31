#!/usr/bin/env python3
"""Box-score player work: an INDEPENDENT replication of the absence edge, plus non-shooting heat.

Two jobs, both riding on the same panel.

A. REPLICATION. NCAAB_AVAIL_VALIDATION.md found that fading the team missing rotation minutes
   tonight is worth ~+10-12% on the full-game spread. That was built from `lineups_ncaab`, a
   derived five-man-unit table that only covers three seasons. `cbbd_player_box` is a
   different vendor feed with an explicit `minutes` column and FOUR seasons, so rebuilding the
   same rule on it is a genuine replication rather than a re-slice: different source, different
   id namespace, one extra season. If the edge is a quirk of how the lineup table was stitched
   together, it dies here.

B. NON-SHOOTING HEAT. The shooting-heat port failed (NCAAB_HEAT_BRIEF.md) -- but shooting is
   the one thing the market watches hardest. The untested question is whether the SECONDARY
   rates regress: free-throw percentage, turnovers, rebounding, assists. Free-throw percentage
   is the strongest a priori candidate in all of basketball -- it is nearly independent of the
   opponent, so a hot stretch is close to pure noise.

   Same discipline as everywhere else in this program: measured against the player's OWN
   expanding baseline, aggregated by PRIOR role (never tonight's minutes, which would leak),
   and carried alongside a rate-style PLACEBO that cannot regress -- how often a player gets
   to the line and how the minutes are distributed are style and skill, not luck.

ID NOTE. `athleteId` is a per-row surrogate key that increments down the file (506k values
over 620k rows). The stable player id is `athleteSourceId` -- 25,018 players at ~25 games
each. Using athleteId would silently give every player a one-game career and every rolling
window would be empty.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from ncaab_frame import MARKETS, load, usable, grade

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(3131)
ROLL, MIN_ROLE, TOP = 10, 0.10, 0.30
SPREADS = ("FG spread OPEN", "FG spread T-60")

# non-shooting rates -> (numerator, denominator). All per-minute except ft_pct.
RATES = {
    "ft_pct":   ("freeThrows.made", "freeThrows.attempted"),   # the purest luck candidate
    "tov_rate": ("turnovers", "minutes"),
    "reb_rate": ("rebounds.total", "minutes"),
    "ast_rate": ("assists", "minutes"),
}
PLACEBO = {                                    # style/skill, cannot regress -- the control
    "fta_rate": ("freeThrows.attempted", "minutes"),
    "fga_rate": ("fieldGoals.attempted", "minutes"),
}


def load_box():
    B = pd.read_parquet(f"{OUT}/cbbd_player_box.parquet")
    B = B.rename(columns={"athleteSourceId": "pid"})
    B["date"] = pd.to_datetime(B["startDate"], utc=True)
    # `minutes` is both a base field and a rate denominator -- dedupe, or the select below
    # yields two identical columns and every later assignment blows up
    num = sorted({"minutes", "netRating"}
                 | {c for p in (RATES, PLACEBO) for v in p.values() for c in v})
    for c in num:
        B[c] = pd.to_numeric(B[c], errors="coerce")
    return B[["gameId", "teamId", "season", "date", "pid", "starter"] + num]


def rectangle(B):
    """Cross every team-game with every player already established that season, so a player
    who did not dress becomes a real row with zero minutes instead of no row at all."""
    sched = B[["teamId", "season", "gameId", "date"]].drop_duplicates()
    first = (B.groupby(["teamId", "season", "pid"], as_index=False)["date"].min()
             .rename(columns={"date": "first_seen"}))
    R = sched.merge(first, on=["teamId", "season"])
    R = R[R["date"] >= R["first_seen"]].drop(columns="first_seen")
    R = R.merge(B.drop(columns=["season", "date"]), on=["gameId", "teamId", "pid"], how="left")
    R["played"] = R["minutes"].notna() & (R["minutes"] > 0)
    R["minutes"] = R["minutes"].fillna(0.0)
    tot = R.groupby(["gameId", "teamId"])["minutes"].transform("sum")
    R["role"] = R["minutes"] / tot.clip(lower=1)
    return R


def add_rates(R):
    """Own-baseline drift per rate: trailing-ROLL form minus the player's EXPANDING baseline
    over strictly prior games. Both shifted, so tonight can never enter either side."""
    R = R.sort_values(["teamId", "pid", "date"]).reset_index(drop=True)
    g = R.groupby(["teamId", "pid"], sort=False)
    for name, (num, den) in {**RATES, **PLACEBO}.items():
        # a game he missed says nothing about his rate, so both windows see played games only
        R["_n"] = R[num].where(R["played"])
        R["_d"] = R[den].where(R["played"])
        own_n = R.groupby(["teamId", "pid"])["_n"].transform(
            lambda s: s.shift(1).expanding(min_periods=5).sum())
        own_d = R.groupby(["teamId", "pid"])["_d"].transform(
            lambda s: s.shift(1).expanding(min_periods=5).sum())
        rec_n = R.groupby(["teamId", "pid"])["_n"].transform(
            lambda s: s.shift(1).rolling(ROLL, min_periods=3).sum())
        rec_d = R.groupby(["teamId", "pid"])["_d"].transform(
            lambda s: s.shift(1).rolling(ROLL, min_periods=3).sum())
        R[f"dr_{name}"] = (rec_n / rec_d.replace(0, np.nan)) - (own_n / own_d.replace(0, np.nan))
    R = R.drop(columns=["_n", "_d"])

    first = R.groupby(["teamId", "pid"]).head(1)
    assert first[[f"dr_{k}" for k in RATES]].isna().all().all(), \
        "A PLAYER'S OWN FORM LEAKED INTO HIS FIRST GAME"

    R["pr_role"] = g["role"].transform(lambda s: s.shift(1).rolling(ROLL, min_periods=2).mean())
    R["pr_net"] = g["netRating"].transform(
        lambda s: s.shift(1).rolling(ROLL, min_periods=2).mean())
    R["prev_min"] = g["minutes"].shift(1)
    return R


def team_rows(R):
    """One row per team-game: absence measures, and role-weighted drift for each rate."""
    P = R[R["pr_role"] >= MIN_ROLE].copy()
    z0, z1 = P["minutes"] == 0, P["prev_min"].fillna(0) == 0
    P["fresh"] = z0 & ~z1
    tm = P.groupby(["gameId", "teamId"])["pr_net"].transform("mean")
    P["val"] = (P["pr_net"] - tm).clip(lower=0).fillna(0.0)
    P["fresh_mn"] = np.where(P["fresh"], P["pr_role"], 0.0)
    P["fresh_vl"] = np.where(P["fresh"], P["pr_role"] * P["val"], 0.0)
    P["fresh_hc"] = P["fresh"].astype(float)
    A = P.groupby(["gameId", "teamId"], as_index=False)[["fresh_mn", "fresh_vl", "fresh_hc"]].sum()

    # heat is only meaningful for players who actually play tonight, weighted by PRIOR role
    H = R[(R["pr_role"] >= MIN_ROLE) & R["played"]].copy()
    w = H["pr_role"].fillna(0)
    out = []
    for k in {**RATES, **PLACEBO}:
        v = H[f"dr_{k}"]
        ok = v.notna() & (w > 0)
        num = (v.where(ok) * w.where(ok)).groupby([H["gameId"], H["teamId"]]).sum()
        den = w.where(ok).groupby([H["gameId"], H["teamId"]]).sum()
        out.append((num / den.replace(0, np.nan)).rename(f"hz_{k}"))
    return A.merge(pd.concat(out, axis=1).reset_index(), on=["gameId", "teamId"], how="outer")


def attach(T):
    G = load().dropna(subset=["cbbd_id"]).copy()
    G["gameId"] = G["cbbd_id"].astype("int64")
    H = pd.read_parquet(f"{OUT}/ncaab_player_heat.parquet")[["gameId", "teamId", "is_home"]]
    T = T.merge(H, on=["gameId", "teamId"], how="inner")
    cols = [c for c in T.columns if c.startswith(("fresh_", "hz_"))]
    for side, flag in (("h", True), ("a", False)):
        s = T[T["is_home"] == flag][["gameId"] + cols].add_prefix(f"{side}_")
        G = G.merge(s.rename(columns={f"{side}_gameId": "gameId"}), on="gameId", how="left")
    return G, cols


def zs(v, seas):
    d = pd.DataFrame({"v": pd.to_numeric(v, errors="coerce"), "s": seas.astype(str)})
    g = d.groupby("s")["v"]
    return ((d["v"] - g.transform("mean")) / g.transform("std").replace(0, np.nan)).to_numpy()


def bet(G, d, mkt, L, tag):
    ok = usable(G, pd.Series(d, index=G.index), mkt)
    if ok.sum() < 800:
        return
    thr = np.nanquantile(np.abs(d[ok]), 1 - TOP)
    m = ok & (np.abs(np.nan_to_num(d)) >= thr)
    if m.sum() < 200:
        return
    g = grade(G, mkt, m, -np.sign(np.nan_to_num(d)), rng=RNG)
    L.append(f"| {tag} | {mkt} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
             f"**{g['edge']:+.1f}** | {g['roi']:+.1f} | {g['p']:.3f} | {g['per']} |")


HDR = ["| signal | market | bets | win % | base % | edge | ROI % | p | by season |",
       "|---|---|---|---|---|---|---|---|---|"]


def main():
    print("building box panel...", flush=True)
    R = add_rates(rectangle(load_box()))
    print(f"  rectangular player-games: {len(R):,} "
          f"({100 * (~R['played']).mean():.1f}% did not play)", flush=True)
    G, _ = attach(team_rows(R))

    L = ["# NCAAB box-score players — absence replication and non-shooting heat", "",
         "Built from `cbbd_player_box` (four seasons, explicit minutes), independent of the "
         "`lineups_ncaab` table behind NCAAB_AVAIL_VALIDATION.md.", "",
         "## A — replicating the absence edge on a different feed", "",
         "Fade the team missing more rotation minutes tonight, top 30% of |differential|. The "
         "lineup-table version scored 58.8% / +12.2% (open) and 57.6% / +10.0% (T-60) over "
         "three seasons. **These rows still require a pregame availability feed** -- they read "
         "tonight's absences.", ""] + HDR
    for s, tag in (("mn", "raw minutes missing"), ("vl", "impact-valued"),
                   ("hc", "headcount")):
        d = (G[f"h_fresh_{s}"].fillna(0) - G[f"a_fresh_{s}"].fillna(0)).to_numpy(float)
        d = np.where(d == 0, np.nan, d)
        for mkt in SPREADS:
            bet(G, d, mkt, L, tag)

    L += ["", "## B — non-shooting heat", "",
          "Fade the team whose rotation is running hottest against its OWN baseline on each "
          "rate. `ft_pct` is the strongest a priori luck candidate in basketball (almost "
          "opponent-independent). The last two rows are the PLACEBO: how often a player "
          "shoots or gets to the line is style, not luck, so it cannot regress -- if it "
          "scores like the real rates, nothing here is about luck.", ""] + HDR
    for k in list(RATES) + list(PLACEBO):
        tag = k + (" (placebo)" if k in PLACEBO else "")
        d = zs(G[f"h_hz_{k}"], G["season"]) - zs(G[f"a_hz_{k}"], G["season"])
        for mkt in MARKETS:
            bet(G, d, mkt, L, tag)
        L.append("")

    path = os.path.join(ROOT, "NCAAB_BOX_PLAYERS.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
