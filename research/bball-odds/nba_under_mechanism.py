#!/usr/bin/env python3
"""WHY the under-selection works. A number without a mechanism is a number waiting to die.

Two independent pipelines now agree, which is the reason this is worth explaining rather
than just booking:

  the stack (main consensus lines, 10 markets)   model-under +2.4 to +3.5 ROI, all three
                                                 seasons positive, cell-matched
  the ladder (ALTERNATE lines, different books)  model-under +1.85 / reachable +2.05 at
                                                 15%+ edge, rising monotonically with
                                                 distance from the book's middle rung
                                                 (-0.49 -> +0.12 -> +1.14 -> +5.62), while
                                                 model-OVER is -8 to -9 ROI everywhere

Different books, different line levels, different construction, same asymmetry: the model
adds information on the under side and none on the over side. That is a structural fact
about the market, not a quirk of one fit, and it should have a readable cause.

Candidate causes, each of which predicts a different pattern in the data:

  SHADE       the market's standing over-lean. Predicts the edge is flat in everything
              and just reflects a constant. Already partly ruled out -- the cell-matched
              control kept +5.73 of +6.31 -- but it should show up as a level, not a slope.
  BLOWOUT     starters sit in decided games. Predicts the edge concentrates in games with
              a large predicted margin, and in players on the favourite.
  MINUTES     the line is set off a role the player no longer has. Predicts the edge
              concentrates where recent minutes are falling and where the line sits high
              relative to recent production.
  SKEW        counting stats are bounded at zero and right-tailed; a symmetric fill
              overprices the under's true probability. Predicts the edge concentrates at
              LOW lines, where the bound bites hardest.
  REST        back-to-backs and load management. Predicts concentration on the second leg.

Each is tested as a conditional ROI slice against the same top-10% under selection, at
consensus, so no result here can be a shopping artifact.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
MODEL = "_p_ridge"
KEEPERS = ["player_blocks", "player_points", "player_points_assists",
           "player_points_rebounds", "player_points_rebounds_assists", "player_steals"]


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def slice_table(L, d, title, note, col, labels=None, nq=5):
    """Conditional ROI along one axis. A cause shows a SLOPE; the shade shows a level."""
    L += [f"\n## {title}\n", note, "",
          "| bucket | n | win% | ROI | mean value |", "|---|---|---|---|---|"]
    v = d[col]
    ok = v.notna()
    if ok.sum() < 500:
        L.append("| — insufficient coverage | | | | |")
        return
    s = d[ok]
    if labels is not None:
        groups = [(lab, s[s[col] == val]) for val, lab in labels]
    else:
        q = np.unique(np.quantile(s[col], np.linspace(0, 1, nq + 1)))
        b = np.clip(np.digitize(s[col], q[1:-1]), 0, len(q) - 2)
        groups = [(f"{q[i]:.2f}–{q[i+1]:.2f}", s[b == i]) for i in range(len(q) - 1)]
    for lab, g in groups:
        if len(g) < 200:
            continue
        L.append(f"| {lab} | {len(g):,} | {100*g['_y'].mean():.2f} | "
                 f"{roi(g['_y'].to_numpy(), g['_dec'].to_numpy()):+.2f} | "
                 f"{g[col].mean():.2f} |")


def main():
    panel = pd.read_parquet(f"{OUT}/nba_props_panel.parquet").rename(
        columns={"season_x": "season"})
    panel["date"] = pd.to_datetime(panel["date"])
    print(f"panel {panel.shape}", flush=True)

    preds = []
    for f in sorted(os.listdir(OUT)):
        if f.startswith("nba_props_stack_player_"):
            preds.append(pd.read_parquet(os.path.join(OUT, f)).drop(columns=["date"]))
    P = pd.concat(preds, ignore_index=True)

    D = panel.merge(P, on=["event_id", "market", "pkey"], how="inner")
    D = D.dropna(subset=["cons_line", "actual", "cons_p_over", MODEL, "cons_under_dec"])
    D = D[D["market"].isin(KEEPERS)]
    D["_conf"] = D["cons_p_over"] - D[MODEL]
    D["_pct"] = D.groupby("market")["_conf"].rank(pct=True)
    d = D[(D["_pct"] >= 0.90) & (D["actual"] != D["cons_line"])].copy()
    d["_y"] = (d["actual"] < d["cons_line"]).to_numpy(dtype=float)
    d["_dec"] = d["cons_under_dec"].to_numpy(dtype=float)
    d = d[np.isfinite(d["_dec"])].reset_index(drop=True)
    print(f"{len(d):,} selected unders, {d['_y'].mean()*100:.2f}% win, "
          f"{roi(d['_y'].to_numpy(), d['_dec'].to_numpy()):+.2f} ROI", flush=True)

    # derived axes the panel does not carry directly
    d["line_vs_proj_pct"] = (d["cons_line"] - d["proj_ref"]) / d["proj_ref"].abs()
    d["mins_drift"] = d["mins_l3"] - d["mins_l10"]        # role shrinking or growing
    d["blowout"] = d["t60_spread_home_point"].abs()       # how lopsided the game projects
    d["own_absences"] = np.where(d["team_id"] == d.get("home_team_id", d["team_id"]),
                                 d["h_abs_fresh_sum_ppg"], d["a_abs_fresh_sum_ppg"])
    cols = set(d.columns)

    L = ["# NBA props — why the under-selection works", "",
         f"{len(d):,} selected unders (keeper markets, top 10% within market, consensus "
         f"line and price). Pooled: **{100*d['_y'].mean():.2f}%**, "
         f"**{roi(d['_y'].to_numpy(), d['_dec'].to_numpy()):+.2f} ROI**.", "",
         "Two independent pipelines agree on the asymmetry -- the main-line stack and the "
         "alternate-line ladders at different books entirely -- so it is worth asking "
         "what causes it. Each slice below is a different candidate cause, and each "
         "predicts a different shape. A cause shows a SLOPE; the market's standing "
         "over-shade would show only a level.", ""]

    # SKEW: the bound at zero bites hardest at low lines
    slice_table(L, d, "SKEW — does the edge concentrate at low lines?",
                "Counting stats are bounded below at zero and right-tailed. If a "
                "symmetric fill is the cause, the edge is biggest where the bound bites: "
                "at low lines.", "cons_line")

    # LEVEL vs the player's own recent production
    for c, title, note, kw in (
        ("line_vs_proj_pct", "ROLE — line vs the panel's own projection",
         "If the line is set off a role the player no longer has, the edge concentrates "
         "where the line sits HIGH relative to what the player projects for.", {}),
        ("mins_drift", "MINUTES — is the player's role shrinking? (L3 minus L10)",
         "Negative = the player is playing fewer minutes lately than his ten-game book. "
         "A line set on the stale role is the most direct version of this mechanism.",
         {}),
        ("blowout", "BLOWOUT — how lopsided does the game project? (|T-60 spread|)",
         "Starters sit in decided games. If this is the cause, the edge concentrates in "
         "the games most likely to be over early.", {}),
        ("b2b", "REST — second leg of a back-to-back",
         "Load management and tired legs both cut counting stats.",
         {"labels": [(0, "not a b2b"), (1, "b2b")]}),
        ("rest_days", "REST — days off before the game", "", {}),
        ("mins_sd10", "VOLATILITY — how erratic is the player's workload?",
         "A high-variance role is harder for the market to price than for a model that "
         "sees the whole distribution rather than a mean.", {}),
        ("own_absences", "TEAMMATES OUT — usage vacated on the player's own team",
         "The opposite prediction to the rest of this list: teammates out should push "
         "usage UP and make the under worse. If the edge survives here it is not simply "
         "a bet on reduced opportunity.", {}),
        ("d_s_pace", "PACE — how many possessions does the game project?", "", {}),
        ("gp_prior", "SAMPLE — does the edge need a long book on the player?",
         "A thin book means the market is guessing too. This says which way that cuts.",
         {}),
        ("cons_p_over", "PRICE — where in the market's own probability is the edge?",
         "If the edge tracks the market's price rather than anything about the player, "
         "it is a pricing artifact rather than a handicap.", {}),
    ):
        if c in cols:
            slice_table(L, d, title, note, c, **kw)

    # per market, so the mechanism can be read against which stats it applies to
    L += ["\n## Per market\n", "| market | n | win% | ROI | mean line |",
          "|---|---|---|---|---|"]
    for mk in sorted(d["market"].unique()):
        g = d[d["market"] == mk]
        L.append(f"| {mk} | {len(g):,} | {100*g['_y'].mean():.2f} | "
                 f"{roi(g['_y'].to_numpy(), g['_dec'].to_numpy()):+.2f} | "
                 f"{g['cons_line'].mean():.2f} |")

    path = os.path.join(ROOT, "NBA_UNDER_MECHANISM_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
