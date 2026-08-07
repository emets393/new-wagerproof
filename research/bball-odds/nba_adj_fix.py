#!/usr/bin/env python3
"""The opponent-adjusted SCORING ratings are broken. This proves it and fixes it.

THE SYMPTOM. `h_adj_off`, `h_adj_def` and `h_adj_tempo_pts` in nba_model_features correlate
-0.015, +0.026 and +0.006 with the closing total. A rating that carries nothing is not a
subtle problem -- these are supposed to be the opponent-adjusted offence and defence, the
single most important input any totals model has, and they are the closest thing in our frame
to what `run_nba_predictions.py` ships to the site.

THE CONTROL THAT LOCATES THE BUG. Two ridges are fit in `adjusted_ratings()`. The MARGIN one
is healthy: `adj_net` correlates -0.607 with the closing spread, exactly as a real power
rating should. The SCORING one is dead. So the problem is not the leak-safe refit loop, not
the data, and not ridge -- it is specific to the scoring design matrix.

THE BUG. In the scoring model the intercept column is set on the home rows only:

    Xo[r,     2*nt] = 1.0      # home-court scoring bump   <- r = 0..n-1 only
    Xo[n + r, ai]   = 1.0      # away offence
    Xo[n + r, nt+hi]= 1.0      # home defence
                               # ...and nothing sets Xo[n+r, 2*nt]

There is therefore NO GLOBAL INTERCEPT. Every row's ~114-point base level has to be carried by
the off/def coefficients themselves, and those are the ones alpha=25 shrinks toward zero. The
arithmetic gives the bug away: adj_off + adj_def averages 65.5 when an NBA team scores about
114. Forty-eight points per team have been absorbed into the penalty, and with the shrinkage
that large the team-to-team differences -- the entire point of the exercise -- are crushed
flat against it.

The margin model does not have this problem because margin is already centred near zero, so
"no intercept" costs it nothing.

THE FIX. Give the scoring model an unpenalised global intercept, keep the home bump as a
separate unpenalised column, and centre offence and defence against the intercept rather than
against zero. Ratings then read in real points: adj_off is a team's points scored against an
average defence, adj_def is points allowed to an average offence, and their sum is the team's
expected scoring environment -- which is what a total is.
"""
import importlib.util
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
spec = importlib.util.spec_from_file_location("bnf", os.path.join(ROOT, "build_nba_features.py"))
bnf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bnf)


def adjusted_ratings_fixed(T, alpha=25.0):
    """Same leak-safe refit loop as the original; correct scoring design matrix.

    Column layout, 2n rows (each game contributes a home-scored row and an away-scored row):
        [0     .. nt-1 ]  offence, one per team, PENALISED, centred on the intercept
        [nt    .. 2nt-1]  defence, one per team, PENALISED
        [2nt          ]  global intercept       UNPENALISED  <- this is what was missing
        [2nt+1        ]  home-court scoring bump UNPENALISED, home rows only
    """
    games = T[T["is_home"]].copy()
    games = games[["game.id", "season", "date", "team.id", "opp_id",
                   "margin", "total", "own_score", "opp_score"]].rename(
        columns={"team.id": "h_id", "opp_id": "a_id"})
    out = []
    for season, gs in games.groupby("season"):
        gs = gs.sort_values("date")
        teams = sorted(set(gs["h_id"]) | set(gs["a_id"]))
        tix = {t: i for i, t in enumerate(teams)}
        nt = len(teams)
        for d in sorted(gs["date"].unique()):
            prior = gs[gs["date"] < d]
            if len(prior) < nt:
                continue
            n = len(prior)
            hi = prior["h_id"].map(tix).values
            ai = prior["a_id"].map(tix).values
            r = np.arange(n)

            # margin ridge — unchanged, it was never broken
            X = np.zeros((n, nt + 1))
            X[r, hi], X[r, ai], X[:, nt] = 1.0, -1.0, 1.0
            P = X.T @ X + alpha * np.eye(nt + 1)
            P[nt, nt] -= alpha
            net = np.linalg.solve(P, X.T @ prior["margin"].values)

            # scoring ridge — now with a global intercept on BOTH halves
            K = 2 * nt + 2
            Xo = np.zeros((2 * n, K))
            y = np.concatenate([prior["own_score"].values, prior["opp_score"].values])
            Xo[r, hi] = 1.0                 # home offence
            Xo[r, nt + ai] = 1.0            # away defence
            Xo[n + r, ai] = 1.0             # away offence
            Xo[n + r, nt + hi] = 1.0        # home defence
            Xo[:, 2 * nt] = 1.0             # THE FIX: league scoring level, every row
            Xo[r, 2 * nt + 1] = 1.0         # home-court bump, home rows only
            Po = Xo.T @ Xo + alpha * np.eye(K)
            Po[2 * nt, 2 * nt] -= alpha              # do not shrink the level
            Po[2 * nt + 1, 2 * nt + 1] -= alpha      # do not shrink the home bump
            od = np.linalg.solve(Po, Xo.T @ y)
            lvl = od[2 * nt]
            for t, i in tix.items():
                # report in points, centred on the league level, so adj_off is "points this
                # team scores against an average defence" and off+def is its total environment
                out.append((season, d, t, net[i], lvl + od[i], lvl + od[nt + i], net[nt]))
    R = pd.DataFrame(out, columns=["season", "date", "team.id", "adj_net", "adj_off",
                                   "adj_def", "adj_hca"])
    R["adj_tempo_pts"] = R["adj_off"] + R["adj_def"]
    return R


def main():
    T = bnf.team_game_panel()
    print(f"[panel] {len(T):,} team-games", flush=True)

    old = bnf.adjusted_ratings(T)
    new = adjusted_ratings_fixed(T)
    print(f"[old] adj_off {old.adj_off.mean():7.2f}  adj_def {old.adj_def.mean():7.2f}  "
          f"tempo {old.adj_tempo_pts.mean():7.2f}", flush=True)
    print(f"[new] adj_off {new.adj_off.mean():7.2f}  adj_def {new.adj_def.mean():7.2f}  "
          f"tempo {new.adj_tempo_pts.mean():7.2f}   (a team scores ~114, a game totals ~228)",
          flush=True)

    D = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    D = D[D[["y_fg_total", "t60_total_point"]].notna().all(axis=1)].copy()
    D["date"] = pd.to_datetime(D["date"])
    # the frame already carries the OLD adj_ columns; drop them or the merge below silently
    # suffixes everything to _x/_y and the comparison reads the wrong build
    D = D.drop(columns=[c for c in D.columns if "_adj_" in c])

    # the frame does not carry raw team ids; recover them from the team-game panel
    hg = T[T["is_home"]][["game.id", "team.id", "opp_id"]].rename(
        columns={"team.id": "home_team_id", "opp_id": "away_team_id"})
    D = D.merge(hg, on="game.id", how="left")

    rows = []
    for tag, R in (("old", old), ("new", new)):
        R = R.copy()
        R["date"] = pd.to_datetime(R["date"])
        cols = ["adj_net", "adj_off", "adj_def", "adj_tempo_pts"]
        H = R[["date", "team.id"] + cols].rename(
            columns={"team.id": "home_team_id", **{c: f"h_{c}" for c in cols}})
        A = R[["date", "team.id"] + cols].rename(
            columns={"team.id": "away_team_id", **{c: f"a_{c}" for c in cols}})
        E = D.merge(H, on=["date", "home_team_id"], how="left") \
             .merge(A, on=["date", "away_team_id"], how="left")
        E["sum_tempo"] = E["h_adj_tempo_pts"] + E["a_adj_tempo_pts"]
        # the honest test for a TOTAL rating: what the book's own line thinks of it
        for c in ("h_adj_off", "h_adj_def", "h_adj_tempo_pts", "sum_tempo", "h_adj_net"):
            m = E[c].notna()
            rows.append((tag, c, int(m.sum()),
                         np.corrcoef(E[c][m], E["t60_total_point"][m])[0, 1],
                         np.corrcoef(E[c][m], E["y_fg_total"][m])[0, 1],
                         np.corrcoef(E[c][m], E["t60_spread_home_point"][m])[0, 1]))

    L = ["# NBA opponent-adjusted ratings — the scoring ridge was broken", "",
         "`adjusted_ratings()` in `build_nba_features.py` fits two ridges. The margin one is "
         "fine. The scoring one had no global intercept — the intercept column was set on the "
         "home-scored rows only — so every row's ~114-point base level had to be carried by "
         "the penalised off/def coefficients, and alpha=25 flattened them against it. "
         "`adj_off + adj_def` averaged 65.5 where a team scores ~114.", "",
         "| build | column | n | corr vs closing TOTAL | corr vs final total | corr vs spread |",
         "|---|---|---|---|---|---|"]
    for tag, c, n, a, b, s in rows:
        L.append(f"| {tag} | `{c}` | {n:,} | {a:+.4f} | {b:+.4f} | {s:+.4f} |")
        print(L[-1], flush=True)
    L += ["", "A working rating correlates strongly with the market's own number for the same "
              "quantity — that is what says it measures the thing it claims to. `adj_net` "
              "already did (−0.607 vs the spread); the scoring ratings did not.", ""]

    path = os.path.join(ROOT, "NBA_ADJ_RATINGS_FIX.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    new.to_parquet(f"{OUT}/nba_adj_ratings_fixed.parquet", index=False)
    print(f"\nwrote {path} and nba_adj_ratings_fixed.parquet", flush=True)


if __name__ == "__main__":
    main()
