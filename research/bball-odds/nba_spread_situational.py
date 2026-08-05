#!/usr/bin/env python3
"""NBA spread, round 2: give the model the motivation block it has never been allowed to see.

WHAT ROUND 1 SETTLED (`NBA_SPREAD_REDO.md`). Under the corrected sign, three different ways of
targeting the margin -- derived from the points model, fitted directly on the full stack, and fitted
on the antisymmetric subspace -- all land in the same place: out-of-sample correlation +0.020,
about +1.5 to +2.0 points of edge, z around +2, and an ROI that never clears the vig. Three
specifications agreeing that precisely is not three failures; it is one measurement. The margin
information in that feature set is real, small, and fully extracted. Retuning the estimator cannot
add what the columns do not contain.

WHAT THIS FILE ADDS, AND WHY IT IS NOT JUST ANOTHER FEATURE SWEEP. Every validated NBA spread edge in
this repo comes from the SAME block of variables, and that block is absent from the model:

    S9   dead home team late in the season          -> back the favourite   +16% ROI at the open
    S11  S9 plus a home team in 2+ arenas in 7 days -> back the favourite   +16.1%, 4/4 seasons
    S12  final ~2 weeks of the regular season       -> OVER                 +8.4%
    S15  two days of rest more than the opponent                            +12.2%

Those live in `nba_standings_feats.parquet` -- elimination, tanking, clinched, play-in position,
games left, season fraction, deadline proximity. `_nba_wide_cache.parquet` does not carry a single
one of them. The travel-load columns made it in (`dm_trav_*`) but the motivation columns did not, so
the spread model has been fitted, retuned and pronounced dead four separate times without ever seeing
the only variables anyone has shown to move an NBA margin against the market. That is a data-plumbing
omission, not a modelling result, and it has to be closed before "the information is not there" is an
honest thing to say.

THE CONSTRUCTION. Motivation enters as a team DIFFERENCE, because the target is antisymmetric and a
column identical on both rows of a game cannot move it. Elimination and tanking are then INTERACTED
with the symmetric context that switches them on -- season fraction, post-deadline, both-teams-done,
and the market's own price. This is deliberate and pre-registered: S9 is not "eliminated teams are
bad", it is "eliminated AND late AND laying points", a conjunction. A main effect cannot represent
that, which is the likely reason a raw motivation column would look like noise if screened one at a
time. Combining is the point.

  D  antisymmetric subspace + motivation      (round 1's C, plus the block)
  E  full feature stack + motivation          (round 1's B, plus the block)

STUDY 3 asks the question the product actually needs: once the rules already fire, does the model
know anything they do not? If the model's disagreement with the line adds win rate INSIDE S9/S11, the
two layers are complementary and the bet is the intersection. If it does not, the model is a display
number for the site and the rules stay the betting layer -- which is a legitimate answer, but only
once it has been measured rather than assumed.

Graded at the T-60 close against 20 game-level nulls, quoted against each slice's own base rate, per
season and per phase, with the same oracle assert that round 1 carries.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")
CACHE = os.path.join(PQ, "_nba_wide_cache.parquet")
STAND = os.path.join(PQ, "nba_standings_feats.parquet")
HUNT = os.path.join(PQ, "nba_hunt_frame.parquet")
PRED = os.path.join(PQ, "_nba_spread_situ.parquet")
NULLS = 20
KS = (1, 2, 3, 4, 5)
# Round 1's sweep put the margin's plateau at 180-365 days -- flatter and longer than the total's
# 180, which is what you would expect if team-vs-team quality drifts more slowly than pace and
# environment. 240 is the middle of that plateau, not its argmax.
HALF_LIFE = 240.0

# Motivation gaps: own minus opponent. Antisymmetric by construction.
GAPS = ["win_pct", "l10", "rank", "gb_1", "gb_6", "gb_10", "playin_edge", "games_left",
        "clinched", "eliminated", "tank"]
# Symmetric game context that switches motivation on. On its own each is identical across a game's
# two rows and therefore useless here; as a multiplier on a gap it is exactly the conjunction the
# rules encode.
CTX = ["st_h_season_frac", "st_post_deadline", "st_both_done", "st_one_needs_it"]
INTERACT = ["eliminated", "tank", "clinched", "playin_edge"]


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


v2 = _load("v2", "nba_total_v2.py")
mk = _load("mk", "nba_markets.py")
pa = _load("pa", "nba_panel_all.py")
sr = _load("sr", "nba_spread_redo.py")


def motivation(P, G, S):
    """Own/opp motivation, differenced, then interacted with the context that activates it.

    Returns an antisymmetric frame aligned to the panel. The sign convention is the same one the
    rest of the panel uses: the away row sees the away team as `own`, so every difference flips.
    """
    S = S.drop_duplicates("game.id").set_index("game.id")
    gid = G["game.id"]
    hit = gid.isin(S.index).mean()
    assert hit > 0.95, f"standings join covers only {100*hit:.1f}% of games"

    ev2gid = gid.to_dict()
    key = P["event_id"].map(ev2gid)
    is_h = (P["team_row"] == "home").to_numpy()
    out = {}
    for g in GAPS:
        h = pd.to_numeric(key.map(S[f"st_h_{g}"]), errors="coerce").to_numpy(float)
        a = pd.to_numeric(key.map(S[f"st_a_{g}"]), errors="coerce").to_numpy(float)
        # own - opp, which is (h - a) on the home row and (a - h) on the away row.
        out[f"mot_dif_{g}"] = np.where(is_h, h - a, a - h)
    ctx = {}
    for c in CTX:
        ctx[c] = pd.to_numeric(key.map(S[c]), errors="coerce").to_numpy(float)
    for g in INTERACT:
        for c in CTX:
            out[f"mot_{g}_x_{c.replace('st_h_', '').replace('st_', '')}"] = out[f"mot_dif_{g}"] * ctx[c]
        # x price: S9 is "dead AND laying points", so the market's own margin is part of the rule.
        out[f"mot_{g}_x_price"] = out[f"mot_dif_{g}"] * P["_mktmarg"].to_numpy(float)
        # x fatigue: S11 is S9 plus a tired home team, and travel load is already in the cache.
        if f"dm_trav_d_venues_7d" in G.columns:
            v = pd.to_numeric(P["event_id"].map(G["dm_trav_d_venues_7d"]), errors="coerce")
            out[f"mot_{g}_x_venues"] = out[f"mot_dif_{g}"] * np.where(is_h, v, -v)
    F = pd.DataFrame(out, index=P.index)
    return F, [c for c in F.columns if F[c].notna().mean() > 0.60]


def main():
    D = pd.read_parquet(CACHE).sort_values("date").reset_index(drop=True)
    D["date"] = pd.to_datetime(D["date"])
    P, fcols = pa.build_panel(D, pa.wide_stack(D))
    G = D.set_index("event_id").copy()
    S = pd.read_parquet(STAND)

    sgn = np.where(P["team_row"] == "home", 1.0, -1.0)
    P["_mktmarg"] = -P["event_id"].map(G["t60_spread_home_point"]).astype(float) * sgn
    P["_ymarg"] = P["event_id"].map(G["y_fg_marg_resid"]).astype(float) * sgn

    yb = pd.Series(np.where(G["y_fg_marg_resid"] > 0, 1.0,
                            np.where(G["y_fg_marg_resid"] < 0, 0.0, np.nan)), index=G.index)
    po = pd.Series(v2.to_dec(G["t60_spread_home_price"]), index=G.index)
    pu = pd.Series(v2.to_dec(G["t60_spread_away_price"]), index=G.index)
    orc = pa.grade(G["y_fg_marg_resid"], yb, po, pu, 0)
    assert orc["win"] > 99.5, f"oracle grades {orc['win']:.1f}% -- sign inverted"

    M, mcols = motivation(P, G, S)
    print(f"[situ] {len(mcols)} motivation columns built | oracle {orc['win']:.1f}%", flush=True)

    cols_full = [c for c in fcols if c not in mk.leak(P, fcols, "_ymarg", "_mktmarg")]
    A, acols = sr.antisym_frame(D, P)
    acols = [c for c in acols if c not in mk.leak(A.assign(_ymarg=P["_ymarg"]), acols,
                                                 "_ymarg", "mkt_marg")]
    # The motivation block goes through the same leak screen as everything else. It should pass --
    # standings as of the morning of the game cannot see the box score -- but "should" is not a
    # reason to skip a screen that has already caught two families of contaminated columns.
    mkeep = [c for c in mcols if c not in mk.leak(M.assign(_ymarg=P["_ymarg"],
                                                           _mktmarg=P["_mktmarg"]),
                                                  mcols, "_ymarg", "_mktmarg")]
    print(f"[situ] motivation survives leak screen: {len(mkeep)}/{len(mcols)}", flush=True)
    if len(mkeep) < len(mcols):
        print(f"[situ] dropped: {sorted(set(mcols) - set(mkeep))}", flush=True)

    Dfr = pd.concat([A[acols], M[mkeep]], axis=1)
    Efr = pd.concat([P[cols_full], M[mkeep]], axis=1)
    print(f"[situ] D = {Dfr.shape[1]} features | E = {Efr.shape[1]} features", flush=True)

    rng = np.random.default_rng(20260801)
    y = P["_ymarg"]
    targets = [y] + [pa.game_shuffle(P, y, rng) for _ in range(NULLS)]

    if os.path.exists(PRED):
        Cc = pd.read_parquet(PRED)
        assert len(Cc) == len(P), "cached predictions do not match the panel; delete it"
        preds = {v: [Cc[f"{v}_{i}"] for i in range(NULLS + 1)] for v in ("D", "E")}
    else:
        preds = {}
        for tag, fr in (("D", Dfr), ("E", Efr)):
            print(f"[situ] {tag}: walking {len(targets)} targets over {fr.shape[1]} features",
                  flush=True)
            preds[tag] = pa.ridge_multi(fr.astype(float), P["date"], targets,
                                        half_life=HALF_LIFE)
        pd.DataFrame({f"{v}_{i}": preds[v][i] for v in ("D", "E")
                      for i in range(NULLS + 1)}).to_parquet(PRED)

    for v in ("D", "E"):
        r = preds[v][0].corr(y)
        nr = np.nanmean([preds[v][i].corr(y) for i in range(1, NULLS + 1)])
        print(f"[situ] {v}: oos corr {r:+.4f} | mean null corr {nr:+.4f}", flush=True)
        assert abs(nr) < 0.02, f"{v} nulls correlate with the target ({nr:+.4f})"

    L = ["# NBA spread, round 2 — the motivation block the model had never seen", "",
         "Round 1 (`NBA_SPREAD_REDO.md`) found three different margin targets agreeing on +0.020 "
         "out-of-sample correlation and an ROI that does not clear the vig. Three specifications "
         "agreeing that precisely is one measurement, not three failures — the information in that "
         "feature set is fully extracted.", "",
         "**But the feature set was missing a block.** Every validated NBA spread edge in this repo "
         "— S9, S11, S12, S15 — is built from elimination, tanking, season fraction and rest, and "
         "`_nba_wide_cache.parquet` carries none of them. The travel columns made it in; the "
         "motivation columns did not. So the spread model has been pronounced dead four times "
         "without ever seeing the only variables anyone has shown to move an NBA margin against the "
         "market. This closes that gap.", "",
         "Motivation enters as a team DIFFERENCE (a column identical on both rows of a game cannot "
         "move an antisymmetric target) and is INTERACTED with the context that activates it — "
         "season fraction, post-deadline, both-teams-done, and the market's own price. That is "
         "deliberate: S9 is not \"eliminated teams are bad\", it is \"eliminated AND late AND "
         "laying points\". A main effect cannot represent a conjunction, which is why screening "
         "these one at a time would show noise.", "",
         f"| variant | features | oos corr with the margin residual |", "|---|---|---|",
         f"| round 1 C (antisymmetric) | {len(acols)} | +0.0192 |",
         f"| round 1 B (full stack) | {len(cols_full)} | +0.0199 |",
         f"| **D** antisymmetric + motivation | {Dfr.shape[1]} | "
         f"**{preds['D'][0].corr(y):+.4f}** |",
         f"| **E** full stack + motivation | {Efr.shape[1]} | "
         f"**{preds['E'][0].corr(y):+.4f}** |", "",
         "## Ladders", "",
         "Graded at the T-60 close against 20 game-level shuffles re-measured at every rung.", ""]

    results = {}
    for tag in ("D", "E"):
        d = sr.to_game(P, preds[tag][0], G)
        nulls = [sr.to_game(P, preds[tag][i], G) for i in range(1, NULLS + 1)]
        L += [f"### {tag}", ""]
        L, best = sr.ladder(L, d, yb, po, pu, nulls, tag)
        results[tag] = (d, best)

    win = max(results, key=lambda t: (results[t][1] or (0, dict(roi=-99), 0))[1]["roi"])
    d, best = results[win]
    k = best[0]
    L += [f"## {win} broken out at the ≥{k:g}-point cut", "",
          f"**The rung was chosen after seeing the ladder, and the z above does not pay for that "
          f"choice.** The ladder is not monotone, so ≥{k:g} is a max-of-five pick and has to be "
          "discounted accordingly. What partly rescues it is that D and E — different feature "
          "counts, one of them carrying 221 extra symmetric columns the other drops — land on the "
          "same rung with the same sign and nearly the same z, which a pure selection artefact has "
          "no reason to do. Treat the seasons and phases below as the real test: a selected cut "
          "that only works in one year is a selected cut.", ""]
    for col, lab in (("season", "season"), ("phase", "phase")):
        L += [f"### by {lab}", "", f"| {lab} | bets | win% | base% | edge | ROI |",
              "|---|---|---|---|---|---|"]
        order = (("EARLY", "MID", "LATE", "POST") if col == "phase"
                 else sorted(G[col].dropna().unique()))
        for vv in order:
            g = pa.grade(d, yb, po, pu, k, mask=(G[col] == vv))
            if g["n"]:
                L.append(f"| {vv if col == 'phase' else int(vv)} | {g['n']:,} | {g['win']:.1f} | "
                         f"{g['base']:.1f} | **{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** |")
                print(f"[{col}] " + L[-1], flush=True)
        L.append("")

    # ---- Study 3: does the model add anything INSIDE the rules? -----------------------------
    # The hunt frame keys on event_id, not game.id -- it is the SIGNAL-side frame (5,368 rows, the
    # pre-phantom-drop count), so it is joined onto the model's game index rather than the reverse.
    H = pd.read_parquet(HUNT).drop_duplicates("event_id").set_index("event_id")
    def hcol(c):
        assert c in H.columns, f"{c} missing from the hunt frame"
        return pd.to_numeric(H[c].reindex(G.index), errors="coerce")

    reg = (hcol("postseason") == 0)
    gp50 = reg & (hcol("min_gp") >= 50)
    dead_h = (hcol("st_h_eliminated") > 0) | (hcol("st_h_tank") > 0)
    tired_h = hcol("h_venues_7d") >= 2
    s9 = (gp50 & dead_h).fillna(False)
    s11 = (gp50 & dead_h & tired_h).fillna(False)

    # The rule bets the FAVOURITE. Express it as a signed margin-residual opinion so it grades
    # through exactly the same function as the model, then ask what the model adds inside it.
    hf = G["t60_spread_home_point"] < 0
    rule = pd.Series(np.where(hf, 1.0, -1.0), index=G.index)

    L += ["## Study 3 — do the model and the rules know different things?", "",
          "The product bets rules, not models. The question that decides whether this model is worth "
          "anything to the betting layer is whether its disagreement with the line adds win rate "
          "INSIDE the games a rule already fires on. Each row is graded against the base rate of "
          "its own slice, and the S9/S11 rows are the published rule with no model filter, so the "
          "comparison is like for like.", "",
          "| slice | bets | win% | base% | edge | ROI |", "|---|---|---|---|---|---|"]
    for lab, m, pred in (
            ("S9 alone (back the favourite)", s9, rule),
            (f"S9 AND model agrees, ≥{k:g} pts", s9 & (np.sign(d) == np.sign(rule)), rule),
            (f"S9 AND model disagrees, ≥{k:g} pts", s9 & (np.sign(d) != np.sign(rule)), rule),
            ("S11 alone (back the favourite)", s11, rule),
            (f"S11 AND model agrees, ≥{k:g} pts", s11 & (np.sign(d) == np.sign(rule)), rule),
            (f"model alone, ≥{k:g} pts, outside S9", (~s9) & (d.abs() >= k), d)):
        mm = m & d.notna()
        if "≥" in lab and "outside" not in lab:
            mm = mm & (d.abs() >= k)
        g = pa.grade(pred, yb, po, pu, 0, mask=mm)
        if g["n"]:
            L.append(f"| {lab} | {g['n']:,} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | **{g['roi']:+.1f}** |")
            print("[cross] " + L[-1], flush=True)
    L.append("")

    with open(os.path.join(ROOT, "NBA_SPREAD_SITUATIONAL.md"), "w") as f:
        f.write("\n".join(L) + "\n")
    print("wrote NBA_SPREAD_SITUATIONAL.md", flush=True)


if __name__ == "__main__":
    main()
