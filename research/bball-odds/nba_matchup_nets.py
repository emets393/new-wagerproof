#!/usr/bin/env python3
"""NBA matchup nets — team A's offence measured against team B's defence, NFL-style.

THE GAP THIS FILLS. Every feature the NBA models have used so far is a team's own trailing
profile: h_l10_ortg, a_s2d_efg, and so on, with `sum` and `diff` pairings. That construction
can express "these are two good offences" but it CANNOT express "this offence attacks the rim
and that defence concedes the rim", which is the question a matchup actually poses. The NFL
sides model gets its edge from exactly that construction -- BASE + 21 matchup nets -- and it
was never ported to basketball.

WHERE THE ALLOWED SIDE COMES FROM, AND A TRAP TO AVOID. `possession_team_games.parquet` looks
like the answer -- it has `p_rim_rate_alwd`, `p_three_pct_alwd` and friends already built. It
is NOT NBA data. `build_possession_features.py` sources it from `cbbd_team_box.parquet`, and
the file holds 1,008 teams across ~6,100 games a season. That is college basketball wearing a
sport-neutral filename. Joining it to the NBA frame returns 0.0% and, if the coverage filter
had been looser, would have quietly trained an NBA model on college possessions.

The allowed side is instead derived here from `bdl_player_box.parquet`, which is
unambiguously NBA (30 teams, balldontlie ids that already match the model frame's `bdl_id` and
`hid`/`aid`). The construction is the identity that makes this free: **team A's offensive line
in a game IS team B's allowed line in that same game.** Aggregating the box to team-game and
self-joining on opponent yields both halves of eight matched pairs -- the complete Four
Factors in both directions, which is more than the college file carried:

    off_eff     <-> def_eff           points per 100 possessions, scored vs allowed
    efg         <-> efg_alwd          effective field-goal %, shot vs conceded
    tov_rate    <-> tov_forced        turnovers given up vs forced
    oreb_pct    <-> oreb_alwd         offensive rebounding vs defensive rebounding conceded
    ftr         <-> ftr_alwd          free-throw rate, drawn vs conceded
    three_rate  <-> three_rate_alwd   three-point volume, taken vs allowed
    three_pct   <-> three_pct_alwd    three-point accuracy, made vs allowed
    two_pct     <-> two_pct_alwd      interior finishing vs interior defence

Not one of these appears in `nba_model_features.parquet` in allowed form. The models have
only ever seen a team's own offence.

THE EXPERIMENT THAT MATTERS. Adding this data and seeing the model improve would prove
nothing about matchup nets -- it would only prove the possession data is informative, which
is a different and much less interesting claim. So the blocks are tested separately:

    RAW   each team's own offensive and allowed levels, as h_/a_/sum/diff       (the ingredients)
    NET   home offence MINUS away allowed, and vice versa                       (the construction)

If NET beats RAW, the matchup construction is doing work that the ingredients alone cannot.
If NET only matches RAW, then the nets are a re-parameterisation and the honest report is that
the possession data helped and the matchup idea did not.

LEAK DISCIPLINE. Every rolling column is shifted one game inside team-season before use, so a
game never sees itself. The join is on balldontlie ids (gameId -> bdl_id, teamId -> team.id),
which is the same spine the repaired ratings use.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


v2 = _load("v2", "nba_total_v2.py")
v3 = _load("v3", "nba_total_v3.py")
v4 = _load("v4", "nba_total_v4.py")

# (offensive column, the opponent column that answers it, short name)
PAIRS = [
    ("off_eff",    "def_eff",          "eff"),
    ("efg",        "efg_alwd",         "efg"),
    ("tov_rate",   "tov_forced",       "tov"),
    ("oreb_pct",   "oreb_alwd",        "oreb"),
    ("ftr",        "ftr_alwd",         "ftr"),
    ("three_rate", "three_rate_alwd",  "trate"),
    ("three_pct",  "three_pct_alwd",   "tpct"),
    ("two_pct",    "two_pct_alwd",     "twopct"),
]
WINDOWS = (5, 10)      # plus season-to-date, built separately
K_TOT, K_SPR = 2.0, 1.5


def team_game_box():
    """Aggregate the NBA player box to team-game, then self-join to get the ALLOWED side.

    Everything a team concedes is just what its opponent recorded in the same game, so one
    self-join on game.id turns an offence-only table into offence + defence.
    """
    b = pd.read_parquet(f"{OUT}/bdl_player_box.parquet",
                        columns=["fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb",
                                 "turnover", "pts", "team.id", "game.id", "game.date"])
    b["game.date"] = pd.to_datetime(b["game.date"])
    g = b.groupby(["game.id", "team.id"], as_index=False).agg(
        fgm=("fgm", "sum"), fga=("fga", "sum"), fg3m=("fg3m", "sum"), fg3a=("fg3a", "sum"),
        ftm=("ftm", "sum"), fta=("fta", "sum"), oreb=("oreb", "sum"), dreb=("dreb", "sum"),
        tov=("turnover", "sum"), pts=("pts", "sum"), date=("game.date", "first"))

    # possessions, then the offensive four factors plus shot mix
    g["poss"] = (g["fga"] - g["oreb"] + g["tov"] + 0.44 * g["fta"]).clip(lower=1)
    g["off_eff"] = 100 * g["pts"] / g["poss"]
    g["efg"] = (g["fgm"] + 0.5 * g["fg3m"]) / g["fga"].clip(lower=1)
    g["tov_rate"] = g["tov"] / g["poss"]
    g["ftr"] = g["fta"] / g["fga"].clip(lower=1)
    g["three_rate"] = g["fg3a"] / g["fga"].clip(lower=1)
    g["three_pct"] = g["fg3m"] / g["fg3a"].clip(lower=1)
    g["two_pct"] = (g["fgm"] - g["fg3m"]) / (g["fga"] - g["fg3a"]).clip(lower=1)

    # the self-join: the other team in the same game
    o = g[["game.id", "team.id", "off_eff", "efg", "tov_rate", "ftr", "three_rate",
           "three_pct", "two_pct", "oreb", "dreb"]].rename(
        columns={"team.id": "opp_id", "off_eff": "def_eff", "efg": "efg_alwd",
                 "tov_rate": "tov_forced", "ftr": "ftr_alwd",
                 "three_rate": "three_rate_alwd", "three_pct": "three_pct_alwd",
                 "two_pct": "two_pct_alwd", "oreb": "opp_oreb", "dreb": "opp_dreb"})
    m = g.merge(o, on="game.id")
    m = m[m["team.id"] != m["opp_id"]].drop_duplicates(["game.id", "team.id"])

    # rebounding percentages need both teams, so they are built after the join
    m["oreb_pct"] = m["oreb"] / (m["oreb"] + m["opp_dreb"]).clip(lower=1)
    m["oreb_alwd"] = m["opp_oreb"] / (m["opp_oreb"] + m["dreb"]).clip(lower=1)
    m = m.rename(columns={"game.id": "gameId", "team.id": "teamId"})
    print(f"[box] {len(m):,} NBA team-games, {m['teamId'].nunique()} teams, "
          f"{m['gameId'].nunique():,} games", flush=True)
    assert m["teamId"].nunique() <= 32, "team count says this is not the NBA"
    return m


def team_profiles():
    """Trailing offensive and allowed profiles per team-game, shifted so they are pregame."""
    P = team_game_box()
    P["season_lbl"] = np.where(P["date"].dt.month >= 8, P["date"].dt.year,
                               P["date"].dt.year - 1)
    P = P.sort_values(["teamId", "season_lbl", "date"]).reset_index(drop=True)
    stats = [c for pr in PAIRS for c in pr[:2]]

    out = P[["gameId", "teamId", "date"]].copy()
    for c in stats:
        s = pd.to_numeric(P[c], errors="coerce")
        # shift BEFORE rolling: tonight's game must not be in tonight's profile
        sh = s.groupby([P["teamId"], P["season_lbl"]]).shift(1)
        for w in WINDOWS:
            out[f"{c}_l{w}"] = sh.groupby([P["teamId"], P["season_lbl"]]).transform(
                lambda x: x.rolling(w, min_periods=max(3, w // 3)).mean())
        out[f"{c}_s2d"] = sh.groupby([P["teamId"], P["season_lbl"]]).transform(
            lambda x: x.expanding(min_periods=3).mean())
    print(f"[poss] {len(out):,} team-games, {len(stats)} stats x {len(WINDOWS)+1} windows",
          flush=True)
    return out


def attach(D):
    """Join home and away profiles, then build the RAW and NET blocks. Returns (D, blocks)."""
    prof = team_profiles()
    cols = [c for c in prof.columns if c not in ("gameId", "teamId", "date")]

    H = prof.rename(columns={"teamId": "hid", **{c: f"ph_{c}" for c in cols}})
    A = prof.rename(columns={"teamId": "aid", **{c: f"pa_{c}" for c in cols}})
    n0 = len(D)
    D = D.merge(H.drop(columns=["date"]), left_on=["bdl_id", "hid"],
                right_on=["gameId", "hid"], how="left").drop(columns=["gameId"])
    D = D.merge(A.drop(columns=["date"]), left_on=["bdl_id", "aid"],
                right_on=["gameId", "aid"], how="left").drop(columns=["gameId"])
    assert len(D) == n0, "possession join changed the row count"

    raw, net = [], []
    for w in [f"l{w}" for w in WINDOWS] + ["s2d"]:
        for off, alwd, nm in PAIRS:
            ho, hd = D[f"ph_{off}_{w}"], D[f"ph_{alwd}_{w}"]
            ao, ad = D[f"pa_{off}_{w}"], D[f"pa_{alwd}_{w}"]
            # RAW: the four levels plus the same-metric pairings the old frame would have used
            D[f"raw_{nm}_{w}_sum_off"] = ho + ao
            D[f"raw_{nm}_{w}_sum_alwd"] = hd + ad
            D[f"raw_{nm}_{w}_d_off"] = ho - ao
            D[f"raw_{nm}_{w}_d_alwd"] = hd - ad
            raw += [f"raw_{nm}_{w}_{s}" for s in
                    ("sum_off", "sum_alwd", "d_off", "d_alwd")]

            # NET: the construction. Home's offence answered by AWAY's defence, and vice versa.
            nh, na = ho - ad, ao - hd
            D[f"net_{nm}_{w}_h"] = nh          # home's edge in this phase of the game
            D[f"net_{nm}_{w}_a"] = na          # away's edge
            D[f"net_{nm}_{w}_sum"] = nh + na   # both edges together -> a TOTAL quantity
            D[f"net_{nm}_{w}_d"] = nh - na     # who wins the matchup -> a SPREAD quantity
            net += [f"net_{nm}_{w}_{s}" for s in ("h", "a", "sum", "d")]

    cov = D[net[0]].notna().mean()
    print(f"[nets] raw={len(raw)}  net={len(net)}  joined on {cov:.1%} of games", flush=True)
    return D, {"raw": raw, "net": net}


def run_market(D, blocks, y, yb, pw, pl, k, title, path, label_lo, label_hi):
    base_cols = [c for c in v2.feature_cols(D) if c not in v2.leak_screen(D, v2.feature_cols(D))]
    radj = [c for c in D.columns if c.startswith("radj_") and D[c].notna().mean() > 0.80]
    base = base_cols + radj
    raw = [c for c in blocks["raw"] if D[c].notna().mean() > 0.80]
    net = [c for c in blocks["net"] if D[c].notna().mean() > 0.80]
    print(f"[{title}] base={len(base)} raw={len(raw)} net={len(net)}", flush=True)

    L = [f"# {title}", "",
         f"{len(D):,} gradeable games, walk-forward ridge on the residual vs the T-60 close, "
         f"bets at |disagreement| ≥ {k} points. Breakeven at −110 is 52.4%.", "",
         "`RAW` is each team's own offensive and allowed levels. `NET` is the matchup "
         "construction — home offence minus away allowed, and the reverse. RAW is the control "
         "that stops a win being credited to the matchup idea when it belongs to the data.", "",
         "| feature set | cols | oos corr | n | win% | base% | edge | ROI |",
         "|---|---|---|---|---|---|---|---|"]
    P = {}
    for tag, cs in (("base (incumbent)", base),
                    ("base + RAW possession", base + raw),
                    ("base + NET matchup", base + net),
                    ("base + RAW + NET", base + raw + net),
                    ("NET alone", net)):
        P[tag] = v2.walk(D[cs].astype(float), D["date"], y, kind="ridge")
        v4.report(L, tag, P[tag], y, yb, pw, pl, len(cs), k=k)

    best_tag = max(("base + NET matchup", "base + RAW + NET", "base + RAW possession"),
                   key=lambda t: v2.grade(P[t], yb, pw, pl, k)["win"] -
                   v2.grade(P[t], yb, pw, pl, k)["base"])
    best = P[best_tag]

    L += ["", f"## Per-pair: which matchup actually carries it (added to base one at a time)", "",
          "| pair | cols | oos corr | n | win% | base% | edge | ROI |",
          "|---|---|---|---|---|---|---|---|"]
    for _, _, nm in PAIRS:
        cs = [c for c in net if f"_{nm}_" in c]
        if not cs:
            continue
        p = v2.walk(D[base + cs].astype(float), D["date"], y, kind="ridge")
        v4.report(L, nm, p, y, yb, pw, pl, len(base) + len(cs), k=k)

    L += ["", f"## Threshold ladder — {best_tag}", "",
          "| k (pts) | n | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    for kk in (0.0, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0):
        g = v2.grade(best, yb, pw, pl, kk)
        if g["n"]:
            L.append(f"| ≥{kk} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
            print(L[-1], flush=True)

    L += ["", "| slice | n | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    for lab, msk in ([(str(s), D["season"] == s) for s in sorted(D["season"].unique())] +
                     [(pz, D["phase"] == pz) for pz in ("EARLY", "MID", "LATE", "POST")]):
        g = v2.grade(best, yb, pw, pl, k, mask=msk)
        if g["n"]:
            L.append(f"| {lab} | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
            print(L[-1], flush=True)

    rng = np.random.default_rng(101)
    nr, ne = [], []
    for i in range(6):
        ys = y.copy()
        for s in D["season"].unique():
            m = (D["season"] == s) & y.notna()
            ys.loc[m] = rng.permutation(y.loc[m].values)
        ps = v2.walk(D[base + net].astype(float), D["date"], ys, kind="ridge")
        ybs = pd.Series(np.where(ys > 0, 1.0, np.where(ys < 0, 0.0, np.nan)), index=D.index)
        mm = ps.notna() & ys.notna()
        nr.append(np.corrcoef(ps[mm], ys[mm])[0, 1])
        gg = v2.grade(ps, ybs, pw, pl, k)
        ne.append(gg["win"] - gg["base"])
        print(f"[null {i+1}/6] corr {nr[-1]:+.4f} edge {ne[-1]:+.2f}", flush=True)

    mm = best.notna() & y.notna()
    rr = np.corrcoef(best[mm], y[mm])[0, 1]
    gg = v2.grade(best, yb, pw, pl, k)
    nr, ne = np.array(nr), np.array(ne)
    L += ["", "## Label-shuffle null (6 draws, within season)", "",
          "| statistic | real | null mean | null sd | z |", "|---|---|---|---|---|",
          f"| oos corr | {rr:+.4f} | {nr.mean():+.4f} | {nr.std(ddof=1):.4f} | "
          f"**{(rr-nr.mean())/nr.std(ddof=1):+.2f}** |",
          f"| edge | {gg['win']-gg['base']:+.2f} | {ne.mean():+.2f} | {ne.std(ddof=1):.2f} | "
          f"**{(gg['win']-gg['base']-ne.mean())/ne.std(ddof=1):+.2f}** |", ""]
    print("\n".join(L[-4:]), flush=True)
    with open(os.path.join(ROOT, path), "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"wrote {path}\n", flush=True)
    return {"base": base, "raw": raw, "net": net}


def main():
    # ---- TOTAL --------------------------------------------------------------------------
    D = v2.build()
    D = v3.with_fixed_ratings(D)
    D, blocks = attach(D)
    y = D["y_fg_tot_resid"].astype(float)
    yb = pd.Series(np.where(y > 0, 1.0, np.where(y < 0, 0.0, np.nan)), index=D.index)
    run_market(D, blocks, y, yb,
               pd.Series(v2.to_dec(D["t60_total_over_price"]), index=D.index),
               pd.Series(v2.to_dec(D["t60_total_under_price"]), index=D.index),
               K_TOT, "NBA total — matchup nets", "NBA_MATCHUP_NETS_TOTAL.md", "under", "over")

    # ---- SPREAD -------------------------------------------------------------------------
    import nba_spread_dims as sd
    S = sd.build_spread()
    S = v3.with_fixed_ratings(S)
    S, blocks_s = attach(S)
    ys = S["y_fg_marg_resid"].astype(float)
    ybs = pd.Series(np.where(ys > 0, 1.0, np.where(ys < 0, 0.0, np.nan)), index=S.index)
    run_market(S, blocks_s, ys, ybs,
               pd.Series(v2.to_dec(S["t60_spread_home_price"]), index=S.index),
               pd.Series(v2.to_dec(S["t60_spread_away_price"]), index=S.index),
               K_SPR, "NBA spread — matchup nets", "NBA_MATCHUP_NETS_SPREAD.md", "away", "home")


if __name__ == "__main__":
    main()
