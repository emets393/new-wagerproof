#!/usr/bin/env python3
"""PLAYER regression, phase by phase — who is playing above or below their own talent.

Two things the earlier college work got wrong, both fixed here.

WRONG 1: everything was pooled. College teams are not the same team in November and March.
Freshmen develop, rotations settle, conference familiarity compounds, and the postseason is
played by a selected field on neutral floors. S1 already says the big-out fade runs 59.5% in
conference play against 54.2% out of conference, so we KNOW phase matters in this sport, and
pooling averages a real effect against a dead one. Every table here is cut by phase, and
Section 0 shows the phases really do price differently before any signal is tested.

WRONG 2: the absence work answered "who is missing", which is not the question. The question
is PLAYER PERFORMANCE REGRESSION -- which players have been scoring above or below what they
are actually capable of, and what that implies for how the GAME plays out. A team whose
rotation has been shooting over its head is going to score less than its recent results
suggest, and the market anchors on recent results.

THE ESTIMATOR, and why it is not the team-luck null in disguise. The team-luck study compared
a TEAM rate against that team's own baseline and found nothing. This works bottom-up: each
player gets an empirical-Bayes talent estimate shrunk toward the league mean by his own
attempt volume (a bench player with 40 shots is pulled most of the way to league average; a
starter with 600 barely moves), and the team signal is the volume-weighted sum of how far each
player's recent form sits from HIS OWN shrunk talent. That handles roster churn, minutes
redistribution and small-sample bench players in a way a team rate cannot -- and college has
40% roster turnover a year, so the difference is not cosmetic. Section B runs the team-level
version on the identical games so we can see whether the player granularity earns its keep;
in the NBA that comparison is exactly what separated the real heat signal from the fake one.

DIRECTION IS PRE-REGISTERED, never learned:
  a team due for POSITIVE offensive regression should score MORE than the market expects
    -> its team total goes OVER, its side covers, and the game total goes OVER when both
       teams are due up.
So the sign is fixed before grading and no table below is free to pick the direction that won.

PLACEBO: shot RATE drift (attempts per minute) instead of shot EFFICIENCY drift. How often a
player shoots is style and role, not luck, so it has no mechanism for regressing. It is
carried through every table. It killed the luck port and the non-shooting-heat port; if it
scores here too, nothing here is real.

MULTIPLICITY: 7 phases x 8 markets is a grid, and the best cell in any grid looks good. The
family-wise permutation at the end shuffles the signal inside each phase and asks how often
the best cell ANYWHERE beats the real best cell. That is the number to read, not the cell.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from ncaab_frame import MARKETS, load, usable, grade

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(20260731)

ROLL = 6            # games in the "recent form" window
MIN_ATT = 12        # minimum attempts in that window before a drift is meaningful
MIN_ROLE = 0.08     # prior share of team shot attempts to count in the team aggregate
TOP = 0.70          # magnitude cut, threshold taken GLOBALLY so no phase gets a tuned cut
N_PERM = 300
MIN_N = 400         # cells smaller than this are excluded from the family-wise statistic

PHASES = ["NONCONF", "MTE", "CONF_EARLY", "CONF_LATE", "CONF_TOURN", "NCAAT", "POST_OTHER"]

# rate -> (numerator, denominator, prior strength in attempts). Three-point percentage is the
# noisiest thing in basketball, so it gets the heaviest shrinkage.
RATES = {
    "efg":   ("_efg_num", "fieldGoals.attempted", 150.0),
    "three": ("threePointFieldGoals.made", "threePointFieldGoals.attempted", 200.0),
    "ft":    ("freeThrows.made", "freeThrows.attempted", 60.0),
}
# style, cannot regress -- the control
PLACEBO = {"fga_rate": ("fieldGoals.attempted", "minutes", 200.0),
           "fta_rate": ("freeThrows.attempted", "minutes", 200.0)}


def phases():
    """Game-level season phase. Order matters: postseason wins over tournament-type, and a
    November multi-team event is its own animal (neutral floor, three games in three days)."""
    T = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet")
    T = T.drop_duplicates("gameId").copy()
    m = pd.to_datetime(T["startDate"], utc=True).dt.month
    tr, gt, cf = T["tournament"], T["gameType"], T["conferenceGame"]
    p = np.where(tr.eq("NCAA"), "NCAAT",
        np.where(tr.isin(["NIT", "CBI", "CIT"]), "POST_OTHER",
        np.where(gt.eq("TRNMNT") & m.isin([11, 12]), "MTE",
        np.where(gt.eq("TRNMNT"), "CONF_TOURN",
        np.where(~cf.astype(bool), "NONCONF",
        np.where(m.isin([12, 1]), "CONF_EARLY", "CONF_LATE"))))))
    return pd.DataFrame({"game_id": T["gameId"].astype("int64"), "phase": p})


def player_panel():
    """Per player-game shooting drift: recent form minus his own shrunk talent.

    Talent is EXPANDING over the player's whole prior career in the panel (across seasons),
    shrunk toward the league mean by attempts. Form is the trailing ROLL games. Both are
    shifted, so tonight's shooting can never enter either side of the subtraction.
    """
    B = pd.read_parquet(f"{OUT}/cbbd_player_box.parquet")
    # athleteId is a per-row surrogate that increments down the file; athleteSourceId is the
    # stable player. Using the wrong one gives every player a one-game career.
    B = B.rename(columns={"athleteSourceId": "pid"})
    B["date"] = pd.to_datetime(B["startDate"], utc=True)
    need = {c for v in {**RATES, **PLACEBO}.values() for c in v[:2]} | {"minutes"}
    for c in need - {"_efg_num"}:
        B[c] = pd.to_numeric(B[c], errors="coerce")
    B["_efg_num"] = B["fieldGoals.made"] + 0.5 * B["threePointFieldGoals.made"]
    B = B[B["minutes"].fillna(0) > 0].copy()          # drift is only defined for games played
    B = B.sort_values(["pid", "date"]).reset_index(drop=True)

    g = B.groupby("pid", sort=False)
    for name, (num, den, K) in {**RATES, **PLACEBO}.items():
        lg = B[num].sum() / max(B[den].sum(), 1)      # league rate, stable to 3+ decimals
        pn = g[num].transform(lambda s: s.shift(1).expanding().sum())
        pd_ = g[den].transform(lambda s: s.shift(1).expanding().sum())
        rn = g[num].transform(lambda s: s.shift(1).rolling(ROLL, min_periods=3).sum())
        rd = g[den].transform(lambda s: s.shift(1).rolling(ROLL, min_periods=3).sum())
        talent = (pn + K * lg) / (pd_ + K)            # empirical-Bayes shrink toward league
        form = rn / rd.replace(0, np.nan)
        B[f"d_{name}"] = np.where(rd >= MIN_ATT, form - talent, np.nan)

    first = B.groupby("pid").head(1)
    assert first[[f"d_{k}" for k in RATES]].isna().all().all(), \
        "A PLAYER'S OWN SHOOTING LEAKED INTO HIS FIRST GAME"

    # weight: prior share of the team's shots. A hot player who never shoots cannot move a
    # team's scoring, so weighting by role is what makes the aggregate mean anything.
    B["pr_fga"] = g["fieldGoals.attempted"].transform(
        lambda s: s.shift(1).rolling(ROLL, min_periods=2).mean())
    B["exp_games"] = g.cumcount()                     # career games PRIOR to tonight
    return B


def team_rows(B):
    """Volume-weighted team drift per team-game, plus role-weighted roster experience."""
    tot = B.groupby(["gameId", "teamId"])["pr_fga"].transform("sum")
    B = B[(B["pr_fga"] / tot.clip(lower=1e-9)) >= MIN_ROLE].copy()
    tot = B.groupby(["gameId", "teamId"])["pr_fga"].transform("sum")
    B["w"] = B["pr_fga"] / tot.clip(lower=1e-9)

    out = []
    for k in list(RATES) + list(PLACEBO):
        v, w = B[f"d_{k}"], B["w"]
        ok = v.notna() & (w > 0)
        num = (v.where(ok) * w.where(ok)).groupby([B["gameId"], B["teamId"]]).sum()
        den = w.where(ok).groupby([B["gameId"], B["teamId"]]).sum()
        # NEGATED: positive = the rotation has been shooting BELOW its talent, so the team is
        # due UP. Every direction downstream reads off that convention.
        out.append((-(num / den.replace(0, np.nan))).rename(f"reg_{k}"))
    E = B.assign(x=B["w"] * B["exp_games"]).groupby(["gameId", "teamId"])["x"].sum()
    out.append(E.rename("exper"))
    return pd.concat(out, axis=1).reset_index()


def team_control():
    """The SAME idea at team level -- team eFG form minus the team's own expanding baseline.

    This is the estimator the luck study already found null. It is here so the player-level
    number has something to be compared against: if the two score the same, the shrinkage and
    the per-player bookkeeping bought us nothing.
    """
    T = pd.read_parquet(f"{OUT}/cbbd_team_box.parquet").copy()
    T["date"] = pd.to_datetime(T["startDate"], utc=True)
    num = (pd.to_numeric(T["teamStats.fieldGoals.made"], errors="coerce")
           + 0.5 * pd.to_numeric(T["teamStats.threePointFieldGoals.made"], errors="coerce"))
    den = pd.to_numeric(T["teamStats.fieldGoals.attempted"], errors="coerce")
    T["_n"], T["_d"] = num, den
    T = T.sort_values(["teamId", "season", "date"])
    g = T.groupby(["teamId", "season"], sort=False)
    pn = g["_n"].transform(lambda s: s.shift(1).expanding(min_periods=5).sum())
    pdn = g["_d"].transform(lambda s: s.shift(1).expanding(min_periods=5).sum())
    rn = g["_n"].transform(lambda s: s.shift(1).rolling(ROLL, min_periods=3).sum())
    rd = g["_d"].transform(lambda s: s.shift(1).rolling(ROLL, min_periods=3).sum())
    T["reg_team_efg"] = -((rn / rd.replace(0, np.nan)) - (pn / pdn.replace(0, np.nan)))
    # cbbd_team_box carries 810 gameIds with FOUR rows instead of two. Returning them
    # un-deduplicated multiplies the frame on merge, and a duplicated game is its own
    # "previous meeting" -- which handed the rematch study a 64% look-ahead leak before this
    # line existed. Dedup at the source, and build() asserts one row per game afterwards.
    return T[["gameId", "teamId", "reg_team_efg"]].drop_duplicates(["gameId", "teamId"])


def build():
    B = player_panel()
    T = team_rows(B).merge(team_control(), on=["gameId", "teamId"], how="left")
    H = pd.read_parquet(f"{OUT}/ncaab_player_heat.parquet")[["gameId", "teamId", "is_home"]]
    T = T.merge(H.drop_duplicates(["gameId", "teamId"]), on=["gameId", "teamId"], how="inner")

    G = load().dropna(subset=["cbbd_id"]).copy()
    G["game_id"] = G["cbbd_id"].astype("int64")
    cols = [c for c in T.columns if c.startswith("reg_")] + ["exper"]
    for side, flag in (("h", True), ("a", False)):
        s = T[T["is_home"] == flag][["gameId"] + cols].add_prefix(f"{side}_")
        s = s.drop_duplicates(f"{side}_gameId")
        G = G.merge(s.rename(columns={f"{side}_gameId": "game_id"}), on="game_id", how="left")
    G = G.merge(phases(), on="game_id", how="left")
    # Tripwire. A merge that multiplies rows is invisible in every table it feeds -- it just
    # looks like more data -- until something time-ordered (here, "have these two met before?")
    # reads a duplicate as a separate earlier game and grades tonight's result as history.
    assert G["event_id"].is_unique, "FRAME MULTIPLIED ON MERGE"
    return G


def signal(G, col, mkt):
    """Home-minus-away for sides, home-plus-away for totals, one side for a team total.

    Each side is z-scored within season first so a scale drift between seasons cannot pose as
    a signal. The mapping below IS the pre-registration -- it fixes which way we bet.
    """
    s = G["season"].astype(str)
    z = {}
    for side in ("h", "a"):
        v = pd.to_numeric(G[f"{side}_{col}"], errors="coerce")
        gp = v.groupby(s)
        z[side] = (v - gp.transform("mean")) / gp.transform("std").replace(0, np.nan)
    fam = MARKETS[mkt][3]
    if fam == "side":
        d = z["h"] - z["a"]          # home due up more -> home covers
    elif fam == "tot":
        d = z["h"] + z["a"]          # both due up -> over
    elif fam == "tt_h":
        d = z["h"]
    else:
        d = z["a"]
    d = d.to_numpy(float)
    return np.where(d == 0, np.nan, d)


def cell(G, d, mkt, ph, thr, rng=None):
    """One phase x market cell. Direction is the pre-registered sign, never fitted."""
    ok = usable(G, pd.Series(d, index=G.index), mkt) & (G["phase"] == ph).to_numpy()
    m = ok & (np.abs(np.nan_to_num(d)) >= thr)
    if m.sum() < 60:
        return None
    return grade(G, mkt, m, np.sign(np.nan_to_num(d)), rng=rng)


def zstat(g):
    """Edge in standard errors, not percentage points.

    The first version of the family-wise test maximised raw |edge| and was useless: NCAAT has
    86 gradeable bets and POST_OTHER 182, so a shuffled signal reached a mean best-edge of 16
    points purely from those two cells and no real result could ever clear it. Standardising
    by the cell's own sampling error, and refusing to score cells under MIN_N, makes the max
    comparable across a grid whose cells differ by a factor of twenty-five in size.
    """
    if g is None or g["n"] < MIN_N:
        return 0.0
    b = g["base"] / 100.0
    se = np.sqrt(max(b * (1 - b), 1e-9) / g["n"])
    return abs(g["edge"] / 100.0) / se


def main():
    print("building player panel...", flush=True)
    G = build()
    n_ph = G["phase"].value_counts()
    print("  games by phase:", dict(n_ph), flush=True)

    L = ["# NCAAB player regression, phase by phase", "",
         "Who has been shooting above or below their OWN shrunk talent, aggregated by share "
         "of team shots, graded inside each season phase. Direction is pre-registered: a team "
         "due for positive regression scores more, so it covers and goes over.", ""]

    # ---- Section 0: the phases price differently -------------------------------------
    L += ["## 0 — the phases are not the same market", "",
          "Before any signal. If these rows were identical, pooling would be harmless.", "",
          "| phase | games | home covers T-60 % | over T-60 % | favourite covers % |",
          "|---|---|---|---|---|"]
    sp = pd.to_numeric(G["t60_spread_home_point"], errors="coerce").to_numpy(float)
    for ph in PHASES:
        s = G["phase"] == ph
        ysp = pd.to_numeric(G["y_sp_t60"], errors="coerce").to_numpy(float)
        ytt = pd.to_numeric(G["y_tot_t60"], errors="coerce").to_numpy(float)
        a = s.to_numpy() & np.isfinite(ysp) & (ysp != 0)
        b = s.to_numpy() & np.isfinite(ytt) & (ytt != 0)
        f = a & np.isfinite(sp) & (sp != 0)
        fav = 100 * (np.where(sp[f] < 0, ysp[f] > 0, ysp[f] < 0)).mean() if f.sum() else np.nan
        L.append(f"| {ph} | {int(s.sum()):,} | {100 * (ysp[a] > 0).mean():.1f} | "
                 f"{100 * (ytt[b] > 0).mean():.1f} | {fav:.1f} |")

    HDR = ["| signal | phase | market | bets | win % | base % | edge | ROI % | p | by season |",
           "|---|---|---|---|---|---|---|---|---|---|"]

    # ---- Sections A-C: the grid --------------------------------------------------------
    fams = ([(f"reg_{k}", k, "PLAYER") for k in RATES]
            + [("reg_team_efg", "team_efg", "TEAM CONTROL")]
            + [(f"reg_{k}", k + " (placebo)", "PLACEBO") for k in PLACEBO])
    best = {}
    for col, tag, kind in fams:
        L += ["", f"## {kind} — {tag}", ""] + HDR
        for mkt in MARKETS:
            d = signal(G, col, mkt)
            thr = np.nanquantile(np.abs(d), TOP)      # GLOBAL cut, phases get no tuned edge
            for ph in PHASES:
                g = cell(G, d, mkt, ph, thr, rng=RNG)
                if g is None:
                    continue
                L.append(f"| {tag} | {ph} | {mkt} | {g['n']:,} | {g['win']:.1f} | "
                         f"{g['base']:.1f} | **{g['edge']:+.1f}** | {g['roi']:+.1f} | "
                         f"{g['p']:.3f} | {g['per']} |")
                k = (kind, ph, mkt, tag)
                best[k] = g

    # ---- Section D: experience / development curve --------------------------------------
    L += ["", "## D — roster experience by phase (the development curve)", "",
          "Role-weighted career games of the rotation. Pre-registered: inexperienced teams "
          "improve fastest across a season, so if the market lags that, backing the LESS "
          "experienced side should pay LATE and not early. Sides markets only.", ""] + HDR
    for mkt in ("FG spread OPEN", "FG spread T-60", "1H spread"):
        d = -signal(G, "exper", mkt)      # positive = home is the LESS experienced side
        thr = np.nanquantile(np.abs(d), TOP)
        for ph in PHASES:
            g = cell(G, d, mkt, ph, thr, rng=RNG)
            if g is None:
                continue
            L.append(f"| back less experienced | {ph} | {mkt} | {g['n']:,} | {g['win']:.1f} | "
                     f"{g['base']:.1f} | **{g['edge']:+.1f}** | {g['roi']:+.1f} | "
                     f"{g['p']:.3f} | {g['per']} |")

    # ---- Section E: family-wise permutation ---------------------------------------------
    print("running family-wise permutation...", flush=True)
    real = max((zstat(g) for (k, _, _, _), g in best.items() if k == "PLAYER"), default=0.0)
    ph_arr = G["phase"].to_numpy()
    draws = np.empty(N_PERM)
    for i in range(N_PERM):
        top = 0.0
        for col, tag, kind in fams:
            if kind != "PLAYER":
                continue
            for mkt in MARKETS:
                d = signal(G, col, mkt)
                # shuffle INSIDE each phase, so phase composition is preserved and only the
                # link between signal and outcome is broken
                sh = d.copy()
                for ph in PHASES:
                    idx = np.flatnonzero(ph_arr == ph)
                    sh[idx] = RNG.permutation(d[idx])
                thr = np.nanquantile(np.abs(sh), TOP)
                for ph in PHASES:
                    top = max(top, zstat(cell(G, sh, mkt, ph, thr)))
        draws[i] = top
    fw = float((draws >= real).mean())
    L += ["", "## E — family-wise permutation over the PLAYER grid", "",
          f"Best |edge| in STANDARD ERRORS anywhere in the player grid (cells of at least "
          f"{MIN_N} bets): **{real:.2f}**. Shuffling the signal inside each phase {N_PERM} "
          f"times, the best cell anywhere reaches a mean of **{draws.mean():.2f}** by chance "
          f"alone (95th pct {np.quantile(draws, .95):.2f}). "
          f"**Family-wise p = {fw:.3f}.**", "",
          "Anything below 0.05 here is worth a second look. Anything above it means the grid "
          "produced exactly what noise produces, however good an individual cell looks."]

    path = os.path.join(ROOT, "NCAAB_PLAYER_REGRESSION.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L[-12:]))
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
