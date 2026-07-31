#!/usr/bin/env python3
"""Last set of ways the dead-home-team rule could be fake. Run these before it gets vaulted.

The rule: late season (both teams 50+ games in), the HOME team is eliminated or tanking,
back the favourite at the opening spread. 324 bets, 62.3%, +19.03 ROI, +17.34 against
cell-matched blind favourite, bootstrap p5 58.0%, seasons 60/58/68/63. The venue placebo
(away team dead: 53.7%, +0 delta) and the quality placebo (bad-but-not-dead home team:
50.8%) both came back clean.

That is a big number, and big numbers on 324 bets earn more scepticism, not less. Four
remaining ways it could be an artefact:

  CONCENTRATION   dead late-season home teams are not 30 random franchises. They are the
                  same handful of tanking rosters, four springs running. If two teams carry
                  the P&L this is a story about those rosters. This is the check that
                  demoted the playoff window from "biggest number in the sweep" to
                  "unproven" and it has to be applied here too.
  LINE TIMING     the rule is graded at the open because that is the line it uses. But if
                  the market fixes this by tip, the edge is real and short-lived, and
                  anyone acting on stale data captures nothing. Regraded at T-24, T-4 and
                  T-60 (the house closing-line definition) to see whether it decays.
  MOVEMENT        if the line moves hard toward the favourite in these games, the opener is
                  simply stale and the rule is a slow-data proxy rather than a handicap.
  CALENDAR        every one of these games falls in March and April. Both teams are also
                  deep in a schedule. Split by month, and check rest, because "dead home
                  team" and "home team on the second night of a back-to-back in April" may
                  be the same games.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(23)


def american_to_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def main():
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    S = pd.read_parquet(f"{OUT}/nba_standings_feats.parquet")
    G = pd.read_parquet(f"{OUT}/bdl_games.parquet")[
        ["id", "home_team.abbreviation", "visitor_team.abbreviation"]].rename(
        columns={"id": "game.id", "home_team.abbreviation": "h_abbr",
                 "visitor_team.abbreviation": "a_abbr"}).drop_duplicates("game.id")
    F = F[~F["game.id"].duplicated(keep=False)].copy()
    d = F.merge(S, on="game.id", how="inner").merge(
        G, on="game.id", how="left").reset_index(drop=True)
    d["date"] = pd.to_datetime(d["date"])

    y = d["y_fg_margin"].to_numpy(dtype=float)
    gp = np.minimum(d["st_h_gp"].to_numpy(dtype=float),
                    d["st_a_gp"].to_numpy(dtype=float))
    post = d["game.postseason"].to_numpy(dtype=float) > 0
    dead_h = ((d["st_h_eliminated"].to_numpy(dtype=float) > 0)
              | (d["st_h_tank"].to_numpy(dtype=float) > 0))

    def grade(prefix):
        """Win/dec/live for backing the favourite at a given line snapshot."""
        sp = d[f"{prefix}_spread_home_point"].to_numpy(dtype=float)
        dh = american_to_dec(d[f"{prefix}_spread_home_price"])
        da = american_to_dec(d[f"{prefix}_spread_away_price"])
        lv = (y != -sp) & np.isfinite(sp) & np.isfinite(dh) & np.isfinite(da)
        fh = sp < 0
        return sp, lv, np.where(fh, (y > -sp).astype(float),
                                (y < -sp).astype(float)), np.where(fh, dh, da), fh

    sp0, live0, win0, dec0, fav0 = grade("open")
    late = live0 & (~post) & (gp >= 50)
    sel = late & dead_h
    seasons = sorted(d["season"].unique())

    L = ["# NBA dead-home-team rule — concentration, timing, movement, calendar", "",
         "Rule: late season (both teams 50+ games in), HOME team eliminated or tanking, "
         "back the favourite. Graded at the opening spread unless stated.", "",
         f"**Comparator is {100*win0[late].mean():.2f}%** — blind favourite across all "
         f"{int(late.sum()):,} late-season games. Breakeven at -110 is 52.4%.", "",
         f"Base row: **{int(sel.sum())} bets, {100*win0[sel].mean():.1f}%, "
         f"{roi(win0[sel], dec0[sel]):+.2f} ROI**.", ""]

    # ---- concentration -----------------------------------------------------------
    L += ["\n## Is the profit a handful of tanking rosters?\n",
          "Units won, grouped by the DEAD HOME TEAM being faded. Four springs of dead teams "
          "is a small, repeating cast. If one or two lines carry the total, this is a story "
          "about those rosters and not a rule.", "",
          "| dead home team | n | win% | units |", "|---|---|---|---|"]
    u = win0 * (dec0 - 1) - (1 - win0)
    rows = []
    for t in pd.unique(d["h_abbr"][sel]):
        k = sel & (d["h_abbr"].to_numpy() == t)
        if k.sum() < 5:
            continue
        rows.append((str(t), int(k.sum()), 100 * win0[k].mean(), u[k].sum()))
    rows.sort(key=lambda r: -r[3])
    for r in rows[:6] + [None] + rows[-4:]:
        if r is None:
            L.append("| … | | | |")
            continue
        L.append(f"| {r[0]} | {r[1]} | {r[2]:.1f} | {r[3]:+.2f} |")
    tot = sum(r[3] for r in rows)
    L += ["", f"{len(rows)} distinct dead home teams with 5+ games. Top team "
          f"**{rows[0][3]:+.2f}** of **{tot:+.2f}** total (**{100*rows[0][3]/tot:.0f}%**); "
          f"top three **{100*sum(r[3] for r in rows[:3])/tot:.0f}%**. The playoff window "
          "failed this check at 60% for one team — that is the bar being cleared or not.",
          "",
          "Leave-one-team-out: worst case when the single best team is removed entirely."]
    worst = min(
        (100 * win0[sel & (d["h_abbr"].to_numpy() != r[0])].mean(), r[0]) for r in rows)
    L += ["", f"Dropping **{worst[1]}** leaves **{worst[0]:.1f}%** on "
          f"{int((sel & (d['h_abbr'].to_numpy() != worst[1])).sum())} bets."]

    # ---- line timing -------------------------------------------------------------
    L += ["\n## Does the market fix it before tip?\n",
          "Same games, same side, different line snapshots. T-60 is the house definition of "
          "the closing line. A rule that survives to T-60 is bettable on a live feed; one "
          "that only exists at the open needs the open.", "",
          "| snapshot | n | win% | ROI | vs all-late fav |", "|---|---|---|---|---|"]
    for pre, lab in (("open", "opening line"), ("t24", "T-24h"),
                     ("t4", "T-4h"), ("t60", "T-60m (close)")):
        spx, lvx, winx, decx, _ = grade(pre)
        k = sel & lvx
        allk = late & lvx
        if k.sum() < 40:
            L.append(f"| {lab} | {int(k.sum())} | — | — | — |")
            continue
        L.append(f"| {lab} | {int(k.sum())} | {100*winx[k].mean():.1f} | "
                 f"{roi(winx[k], decx[k]):+.2f} | "
                 f"**{100*(winx[k].mean() - winx[allk].mean()):+.1f} pts** |")

    # ---- movement ----------------------------------------------------------------
    sp60 = d["t60_spread_home_point"].to_numpy(dtype=float)
    mv = np.abs(sp60) - np.abs(sp0)   # + = favourite got MORE expensive by the close
    ok = sel & np.isfinite(mv)
    okl = late & np.isfinite(mv)
    L += ["\n## Is the opener just stale?\n",
          "If these lines march toward the favourite between open and close, the rule is "
          "reading slow data rather than handicapping. `move` is |T-60 spread| minus |open "
          "spread| — positive means the favourite grew.", "",
          f"- dead-home games: mean move **{mv[ok].mean():+.2f}** pts, "
          f"favourite grew in **{100*(mv[ok] > 0).mean():.0f}%** of them",
          f"- all late games: mean move **{mv[okl].mean():+.2f}** pts, "
          f"favourite grew in **{100*(mv[okl] > 0).mean():.0f}%**", "",
          "| move bucket | n | win% | ROI |", "|---|---|---|---|"]
    for lab, m2 in (("favourite grew 1+ pt", ok & (mv >= 1)),
                    ("line barely moved (<1 pt)", ok & (np.abs(mv) < 1)),
                    ("favourite shrank 1+ pt", ok & (mv <= -1))):
        if m2.sum() < 30:
            L.append(f"| {lab} | {int(m2.sum())} | — | — |")
            continue
        L.append(f"| {lab} | {int(m2.sum())} | {100*win0[m2].mean():.1f} | "
                 f"{roi(win0[m2], dec0[m2]):+.2f} |")

    # ---- calendar and rest -------------------------------------------------------
    L += ["\n## Calendar and rest\n",
          "'Dead home team' and 'home team on no rest in April' may be the same games. "
          "If the effect is really fatigue it should concentrate in the no-rest rows.", "",
          "| split | n | win% | ROI |", "|---|---|---|---|"]
    mo = d["date"].dt.month.to_numpy()
    splits = [("March", sel & (mo == 3)), ("April", sel & (mo == 4)),
              ("Feb or earlier", sel & (mo <= 2))]
    rest = d["h_sched_rest"].to_numpy(dtype=float)
    b2b = d["h_sched_b2b"].to_numpy(dtype=float)
    splits += [("home on 0-1 days rest", sel & (rest <= 1)),
               ("home on 2+ days rest", sel & (rest >= 2)),
               ("home NOT on a back-to-back", sel & (b2b <= 0)),
               ("home on a back-to-back", sel & (b2b > 0)),
               # the fatigue story requires the away team to be fresher; if the effect is
               # just as big when the road side is the tired one, it is not fatigue
               ("away team more rested than home",
                sel & (d["a_sched_rest"].to_numpy(dtype=float) > rest)),
               ("home team more rested than away",
                sel & (d["a_sched_rest"].to_numpy(dtype=float) < rest))]
    for lab, m2 in splits:
        if m2.sum() < 30:
            L.append(f"| {lab} | {int(m2.sum())} | — | — |")
            continue
        L.append(f"| {lab} | {int(m2.sum())} | {100*win0[m2].mean():.1f} | "
                 f"{roi(win0[m2], dec0[m2]):+.2f} |")

    # ---- per-season volume -------------------------------------------------------
    L += ["\n## Volume per season\n",
          "A rule that fires 80 times a season is bettable. One that fires 12 times is a "
          "curiosity.", "", "| season | n | win% | ROI |", "|---|---|---|---|"]
    for s in seasons:
        k = sel & (d["season"].to_numpy() == s)
        if k.sum() < 5:
            L.append(f"| {s} | {int(k.sum())} | — | — |")
            continue
        L.append(f"| {s} | {int(k.sum())} | {100*win0[k].mean():.1f} | "
                 f"{roi(win0[k], dec0[k]):+.2f} |")

    path = os.path.join(ROOT, "NBA_DEAD_HOME_ROBUST_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
