#!/usr/bin/env python3
"""The dead home team. Late-season games where the HOME side has nothing left to play for.

HOW THIS ARRIVED

Three scripts converged on it by elimination, and the route matters because it is the
opposite of what each step predicted:

  1. `nba_spread_phase.py`   the full-game spread model is anti-informative late -- worse
                             the more confident it is (-16.1 vs naive at top 10%).
  2. `nba_late_diagnose.py`  the loss is NOT in games where nobody cares. There the model
                             is fine (54.5%). It is concentrated in games where the
                             standings still mean something (44.3%). Predicted backwards.
  3. `nba_motivation_control.py`  a standings-based side-picking rule looked strong (56.1%)
                             until it was compared to blind favourite INSIDE its own games,
                             where it added +0.0 and often less. Dead as a side-picker.

But step 3 left something behind. Blind favourite covers 53.05% across all 1,817 late-season
games. Inside the subset where a dead team is involved it covers 56.7%, and inside the
subset where the DEAD TEAM IS THE HOME TEAM it covers 62.2% on 246 games. The same rule with
the dead team on the road covers 50.5%. So the signal was never the side -- it is WHICH
GAMES to back the favourite in, and it is entirely asymmetric by venue.

THE MECHANISM THAT WOULD EXPLAIN IT

The spread carries a standing home-court adjustment of roughly 2-3 points, applied because
home teams play harder in front of their own crowd. A home team that is mathematically out
or openly tanking is the one case where that premise fails, and the market cannot easily
drop the adjustment for it without saying out loud that the team has quit. A road team that
has quit gets no such premium in the first place, which is exactly why the effect should be
one-sided -- and it is. That prediction was available before the split was run, and the
split matched it.

WHAT THIS SCRIPT DOES

Everything is computed from the schedule and final scores of games played strictly before
tip. It bets and grades the OPENING spread. The four ways this could still be fake:

  SIZE          dead home teams draw big road favourites, and big favourites may cover
                better late for unrelated reasons. Every row is cell-matched on |open
                spread| against blind favourite across ALL late games.
  WHICH SIDE    if the dead home team is itself the favourite, "back the favourite" and
                "fade the dead team" are different bets. Split and reported separately.
  SEASON        four springs, and the sample is one spring's worth of games per season.
  DEFINITION    eliminated, tanking, and clinched are three different kinds of dead, and a
                result that needs all three fused is weaker than one that survives each.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(11)
BOOT = 10_000


def american_to_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def boot_p5(win):
    if len(win) < 30:
        return np.nan
    idx = RNG.integers(0, len(win), size=(BOOT, len(win)))
    return 100 * np.percentile(win[idx].mean(axis=1), 5)


def main():
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    S = pd.read_parquet(f"{OUT}/nba_standings_feats.parquet")
    F = F[~F["game.id"].duplicated(keep=False)].copy()
    d = F.merge(S, on="game.id", how="inner").reset_index(drop=True)

    sp = d["open_spread_home_point"].to_numpy(dtype=float)
    y = d["y_fg_margin"].to_numpy(dtype=float)
    dh, da = american_to_dec(d["open_spread_home_price"]), \
        american_to_dec(d["open_spread_away_price"])
    live = (y != -sp) & np.isfinite(sp) & np.isfinite(dh) & np.isfinite(da)
    home_cover, away_cover = (y > -sp).astype(float), (y < -sp).astype(float)
    fav_home = sp < 0
    fav_win = np.where(fav_home, home_cover, away_cover)
    fav_dec = np.where(fav_home, dh, da)

    gp = np.minimum(d["st_h_gp"].to_numpy(dtype=float),
                    d["st_a_gp"].to_numpy(dtype=float))
    post = d["game.postseason"].to_numpy(dtype=float) > 0
    late = live & (~post) & (gp >= 50)
    seasons = sorted(d["season"].unique())

    edges = np.array([0, 2.5, 5.5, 8.5, 12.5, 99.0])
    buck = np.digitize(np.abs(sp), edges[1:-1])

    def cell_matched(sel):
        tot = wsum = 0.0
        for k in np.unique(buck[sel]):
            w = (buck[sel] == k).sum()
            pool = late & (buck == k)
            if pool.sum() < 40:
                continue
            tot += w * roi(fav_win[pool], fav_dec[pool])
            wsum += w
        return tot / wsum if wsum else np.nan

    def flag(pre, kind):
        if kind == "dead":
            return ((d[f"st_{pre}_eliminated"].to_numpy(dtype=float) > 0)
                    | (d[f"st_{pre}_tank"].to_numpy(dtype=float) > 0))
        return d[f"st_{pre}_{kind}"].to_numpy(dtype=float) > 0

    base = 100 * fav_win[late].mean()
    L = ["# NBA — back the favourite when the HOME team has quit", "",
         f"**The number every row is measured against is {base:.2f}%** — blind favourite "
         f"across all {int(late.sum()):,} late-season games (both teams 50+ games in). "
         "Not 50%: favourites already cover above chance late, so a favourite-backing rule "
         "starts from there. Breakeven at -110 is 52.4%.", "",
         "`delta cell` subtracts blind-favourite ROI reweighted to the selection's own "
         "|open spread| bucket mix, so a row cannot score merely by drifting toward big "
         "favourites. `p5` is the 5th percentile of win% over 10,000 bootstrap resamples.",
         ""]

    HDR = ["| rule | n | win% | ROI | delta cell | p5 | by season |",
           "|---|---|---|---|---|---|---|"]

    def row(lab, mask, take_home=None):
        k = live & mask
        if k.sum() < 40:
            L.append(f"| {lab} | {int(k.sum())} | — | — | — | — | — |")
            return
        th = fav_home if take_home is None else take_home
        win = np.where(th, home_cover, away_cover)
        dec = np.where(th, dh, da)
        per = []
        for s in seasons:
            j = k & (d["season"].to_numpy() == s)
            per.append(f"{100*win[j].mean():.0f}" if j.sum() >= 20 else "-")
        L.append(f"| {lab} | {int(k.sum())} | {100*win[k].mean():.1f} | "
                 f"{roi(win[k], dec[k]):+.2f} | **{roi(win[k], dec[k]) - cell_matched(k):+.2f}** | "
                 f"{boot_p5(win[k]):.1f} | {'/'.join(per)} |")

    dead_h, dead_a = flag("h", "dead"), flag("a", "dead")

    L += ["\n## The venue asymmetry\n",
          "Same condition, two venues. If the effect is about a team having quit it should "
          "appear on both sides; if it is about the home-court adjustment being wrong it "
          "can only appear at home.", ""] + HDR
    row("back the fav — HOME team dead", late & dead_h)
    row("back the fav — AWAY team dead", late & dead_a)
    row("back the fav — home dead, away alive", late & dead_h & ~dead_a)
    row("back the fav — neither dead", late & ~dead_h & ~dead_a)
    row("back the fav — both dead", late & dead_h & dead_a)

    L += ["\n## Which flavour of dead\n",
          "Eliminated, tanking and clinched are different states. A result that needs all "
          "of them fused is weaker than one that survives each on its own.", ""] + HDR
    for kind in ("eliminated", "tank", "clinched"):
        row(f"back the fav — home team {kind}", late & flag("h", kind))
    row("back the fav — home eliminated AND tanking",
        late & flag("h", "eliminated") & flag("h", "tank"))

    L += ["\n## Is it the favourite, or is it fading the dead team?\n",
          "These are the same ticket only when the dead home team is the underdog. Split "
          "by who the favourite actually is.", ""] + HDR
    row("home dead AND home is the DOG — back the road fav",
        late & dead_h & ~fav_home)
    row("home dead AND home is the FAVOURITE — back the home fav",
        late & dead_h & fav_home)
    row("home dead — always fade the home team regardless of price",
        late & dead_h, np.zeros(len(d), dtype=bool))

    L += ["\n## Does it need the opponent to care?\n",
          "A dead home team hosting another dead team should be worth less if the story is "
          "about effort mismatch rather than a stale home-court adjustment.", ""] + HDR
    alive_a = ~dead_a & (np.abs(d["st_a_playin_edge"].to_numpy(dtype=float)) <= 5)
    row("home dead, away fighting for a spot", late & dead_h & alive_a)
    row("home dead, away neither dead nor fighting",
        late & dead_h & ~dead_a & ~alive_a)

    L += ["\n## Dose: how dead, and how late\n", ""] + HDR
    left_h = d["st_h_games_left"].to_numpy(dtype=float)
    row("home dead, 15+ games left", late & dead_h & (left_h >= 15))
    row("home dead, under 10 games left", late & dead_h & (left_h < 10))
    pe_h = d["st_h_playin_edge"].to_numpy(dtype=float)
    row("home dead, 8+ games out of the play-in", late & dead_h & (pe_h <= -8))
    row("home dead, within 8 of the play-in", late & dead_h & (pe_h > -8))

    L += ["\n## Placebo: the same flags before they can mean anything\n",
          "`eliminated` and `tank` both require the season to be nearly over, so they "
          "cannot fire in mid-season. The stand-in is the same home team quality — bottom-4 "
          "in its conference — with no games-left condition. If THAT scores, the finding is "
          "about bad home teams, not dead ones.", ""] + HDR
    mid = live & (~post) & (gp >= 15) & (gp < 50)
    bad_h = d["st_h_rank"].to_numpy(dtype=float) >= 12
    row("mid season, home team bottom-4 in conference — back the fav", mid & bad_h)
    row("late season, home team bottom-4 but NOT dead", late & bad_h & ~dead_h)

    path = os.path.join(ROOT, "NBA_DEAD_HOME_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
