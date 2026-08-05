#!/usr/bin/env python3
"""Does the team with more to play for cover? A standings signal with no model in it.

WHERE THIS CAME FROM

`nba_late_diagnose.py` split the late-season spread model by standings context and found
the opposite of what was expected. The model is FINE when neither team has anything left
to play for -- 54.5% on 187 bets, +1.8 over blind favourite. It collapses when at least one
side is still racing: 44.3% on 499 bets, -16.6 against the same comparator. Its mean |edge|
is 1.80 points in both groups, so it does not know which situation it is in.

A model that loses at 44% is a rule that wins at 56% with the sign flipped, and the natural
reading is that it keeps backing the team with the better box score against the team that
actually needs the game. If that reading is right the model is unnecessary: the standings
alone should carry it.

So this script throws the model away. Everything here is computed from the schedule and
final scores of games played strictly before tip, and bets the higher-motivation side
against the OPENING spread -- the line the signal uses is the line it is graded against.

READING THE NUMBERS. Baseline is 50%, because a spread is a two-way market and a coin wins
half of it. Breakeven at -110 is 52.4%. So 55% is a big number and 45% is an equally big
number pointing the other way.

THREE CONTROLS, because a late-season standings rule has three obvious ways to be fake:

  CELL-MATCHED   a motivated team is often also the better team, hence the favourite, and
                 favourites cover 53.05% late. Every ROI is quoted against blind-favourite
                 ROI reweighted to the selection's own |open spread| bucket mix.
  NAIVE SHARE    what fraction of the signal's picks simply IS the favourite. A rule that
                 is 90% favourites is a favourite rule wearing a costume.
  PER SEASON     four seasons. If one carries it, it is one spring.

A fourth check is built into the definitions rather than reported: motivation is measured
from standings position only, never from recent results, so "motivated" cannot smuggle in
"hot".
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def american_to_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def cell_matched(sp, live, sel, nwin, ndec):
    """Comparator ROI reweighted to the selection's own |open spread| bucket mix."""
    edges = np.array([0, 2.5, 5.5, 8.5, 12.5, 99.0])
    b = np.digitize(np.abs(sp), edges[1:-1])
    tot = wsum = 0.0
    for k in np.unique(b[sel]):
        w = (b[sel] == k).sum()
        pool = live & (b == k)
        if pool.sum() < 40:
            continue
        tot += w * roi(nwin[pool], ndec[pool])
        wsum += w
    return tot / wsum if wsum else np.nan


def motivation(S, pre):
    """A team's reason to try, from standings position ONLY.

    Deliberately excludes form, streaks and ratings. If recent results leaked in here,
    "more motivated" would quietly become "hotter" and the signal would be a momentum bet
    with a standings label on it.
    """
    edge = S[f"st_{pre}_playin_edge"].to_numpy(dtype=float)   # + = inside the play-in cut
    gb6 = S[f"st_{pre}_gb_6"].to_numpy(dtype=float)           # + = below the auto-berth cut
    left = S[f"st_{pre}_games_left"].to_numpy(dtype=float)
    m = np.zeros(len(S))
    # a live bubble fight is the strongest reason to care; the closer to the cut, the more
    # a single game is worth
    m += np.where(np.abs(edge) <= 2, 2.0, np.where(np.abs(edge) <= 5, 1.0, 0.0))
    # fighting for the 6 seed means avoiding the play-in entirely -- a real prize
    m += np.where(np.abs(gb6) <= 3, 1.0, 0.0)
    # nothing left to win: out of it, or safe, or openly tanking
    m -= 2.0 * (S[f"st_{pre}_eliminated"].to_numpy(dtype=float) > 0)
    m -= 2.0 * (S[f"st_{pre}_tank"].to_numpy(dtype=float) > 0)
    m -= 1.0 * (S[f"st_{pre}_clinched"].to_numpy(dtype=float) > 0)
    # everything above only means anything once the season is nearly resolved
    return np.where(left <= 30, m, 0.0)


def main():
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    S = pd.read_parquet(f"{OUT}/nba_standings_feats.parquet")
    dup = F["game.id"].duplicated(keep=False)
    F = F[~dup].copy()          # 45 ambiguous odds joins, dropped everywhere in this repo
    d = F.merge(S, on="game.id", how="inner").reset_index(drop=True)
    d["date"] = pd.to_datetime(d["date"])
    print(f"{len(d):,} games joined to standings", flush=True)

    sp = d["open_spread_home_point"].to_numpy(dtype=float)
    y = d["y_fg_margin"].to_numpy(dtype=float)
    dh = american_to_dec(d["open_spread_home_price"])
    da = american_to_dec(d["open_spread_away_price"])
    live = (y != -sp) & np.isfinite(sp) & np.isfinite(dh) & np.isfinite(da)
    home_cover = (y > -sp).astype(float)
    away_cover = (y < -sp).astype(float)

    fav_home = sp < 0
    fav_win = np.where(fav_home, home_cover, away_cover)
    fav_dec = np.where(fav_home, dh, da)

    mh, ma = motivation(d, "h"), motivation(d, "a")
    diff = mh - ma
    gp = np.minimum(d["st_h_gp"].to_numpy(dtype=float),
                    d["st_a_gp"].to_numpy(dtype=float))
    post = d["game.postseason"].to_numpy(dtype=float) > 0
    late = live & (~post) & (gp >= 50)
    seasons = sorted(d["season"].unique())

    L = ["# NBA — back the team that needs the game", "",
         "No model. Standings position only, computed from games played strictly before "
         "tip, bet and graded against the OPENING spread.", "",
         "**Baseline is 50%** — a spread is a two-way market and a coin wins half of it. "
         "Breakeven at -110 is 52.4%. A 45% row is as informative as a 55% row.", "",
         "`delta cell` subtracts blind-favourite ROI reweighted to the selection's own "
         "|open spread| bucket mix. `fav share` is how often the signal's pick simply IS "
         "the favourite — a rule near 90% there is a favourite rule in disguise.", ""]

    def row(lab, mask, take_home):
        k = live & mask
        if k.sum() < 40:
            L.append(f"| {lab} | {int(k.sum())} | — | — | — | — | — |")
            return
        win = np.where(take_home, home_cover, away_cover)
        dec = np.where(take_home, dh, da)
        nc = cell_matched(sp, live, k, fav_win, fav_dec)
        per = []
        for s in seasons:
            j = k & (d["season"].to_numpy() == s)
            per.append(f"{100*win[j].mean():.0f}" if j.sum() >= 25 else "-")
        L.append(f"| {lab} | {int(k.sum())} | {100*win[k].mean():.1f} | "
                 f"{roi(win[k], dec[k]):+.2f} | **{roi(win[k], dec[k]) - nc:+.2f}** | "
                 f"{100*(take_home[k] == fav_home[k]).mean():.0f}% | "
                 f"{'/'.join(per)} |")

    L += ["\n## Late season (both teams 50+ games in), by motivation gap\n",
          "| rule | n | win% | ROI | delta cell | fav share | by season |",
          "|---|---|---|---|---|---|---|"]
    for thr in (1, 2, 3):
        row(f"back higher-motivation side, gap >= {thr}",
            late & (np.abs(diff) >= thr), diff > 0)
    row("gap >= 2, and it is the AWAY team", late & (diff <= -2), np.zeros(len(d), bool))
    row("gap >= 2, and it is the HOME team", late & (diff >= 2), np.ones(len(d), bool))
    row("placebo: back the LOWER-motivation side, gap >= 2",
        late & (np.abs(diff) >= 2), diff < 0)

    L += ["\n## The component parts, late season\n",
          "Which piece of the motivation score is doing the work. A composite that is "
          "really one flag should show it here.", "",
          "| rule | n | win% | ROI | delta cell | fav share | by season |",
          "|---|---|---|---|---|---|---|"]
    tank_h = d["st_h_tank"].to_numpy(dtype=float) > 0
    tank_a = d["st_a_tank"].to_numpy(dtype=float) > 0
    elim_h = d["st_h_eliminated"].to_numpy(dtype=float) > 0
    elim_a = d["st_a_eliminated"].to_numpy(dtype=float) > 0
    bub_h = np.abs(d["st_h_playin_edge"].to_numpy(dtype=float)) <= 2
    bub_a = np.abs(d["st_a_playin_edge"].to_numpy(dtype=float)) <= 2
    row("fade the tanking team (one side tanking)",
        late & (tank_h ^ tank_a), tank_a)
    row("fade the eliminated team (one side out)",
        late & (elim_h ^ elim_a), elim_a)
    row("back the bubble team (one side on the bubble)",
        late & (bub_h ^ bub_a), bub_h)
    row("bubble team vs a settled team",
        late & (bub_h ^ bub_a) & ((elim_h | tank_h) | (elim_a | tank_a)), bub_h)

    L += ["\n## Sanity: does this exist BEFORE the standings mean anything?\n",
          "The same score applied when it should be meaningless. A rule that scores just "
          "as well in November is not a motivation rule — it is picking up team quality.",
          "", "| rule | n | win% | ROI | delta cell | fav share | by season |",
          "|---|---|---|---|---|---|---|"]
    # recompute the score with the games-left gate removed, so it can fire early
    d2 = d.copy()
    d2["st_h_games_left"] = 0.0
    d2["st_a_games_left"] = 0.0
    diff_any = motivation(d2, "h") - motivation(d2, "a")
    mid = live & (~post) & (gp >= 15) & (gp < 50)
    early = live & (~post) & (gp < 15)
    row("mid season, gap >= 2", mid & (np.abs(diff_any) >= 2), diff_any > 0)
    row("early season, gap >= 2", early & (np.abs(diff_any) >= 2), diff_any > 0)

    L += ["\n## Playoff-race context in the postseason\n",
          "Seeds are settled but series position is not. Included for completeness; the "
          "sample is four postseasons and decides nothing.", "",
          "| rule | n | win% | ROI | delta cell | fav share | by season |",
          "|---|---|---|---|---|---|---|"]
    row("postseason, seed gap >= 4 -> back the better seed",
        live & post & (np.abs(d["st_d_rank"].to_numpy(dtype=float)) >= 4),
        d["st_d_rank"].to_numpy(dtype=float) < 0)

    path = os.path.join(ROOT, "NBA_MOTIVATION_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
