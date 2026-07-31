#!/usr/bin/env python3
"""Does the NBA market price roster quality? The ceiling test for the bottom-up model.

Before building a minutes-projection model -- the expensive part of any player-level
system -- this asks the only question that decides whether it is worth building: is there
ANY information in minutes-weighted player ratings that the posted line does not already
contain?

The target is the MARKET RESIDUAL, not the score. Predicting that Denver scores 118 is
worthless if the line already said so. Predicting that Denver beats the posted spread is
the entire game. So every model here is fit on (actual - market line) and scored on how
much of that residual it explains OUT OF SAMPLE.

FOUR FEATURE SETS, and the comparisons between them are the whole point:

  oracle     player ratings weighted by minutes ACTUALLY played. Peeks at the box score,
             unbettable. This is the CEILING -- no amount of minutes-projection work can
             beat knowing the answer.
  projected  weighted by prior rolling minutes and last-game availability. Honest and
             bettable today, with no injury feed at all.
  placebo    projected features with the home/away assignment shuffled within date. Any
             apparent skill here is the harness lying, and its score is the real zero.
  market     intercept only. Scores exactly 0.00 by construction; printed as a sanity rail.

The oracle-minus-projected gap is the dollar value of a minutes model. If oracle scores
nothing, the idea is dead and the minutes model never gets built.

TWO PREDICTIONS, REGISTERED BEFORE THE NUMBERS WERE SEEN (in the owner-facing message, and
here):
  1. Player aggregates add MORE to the 1H markets than to the full game, because starters
     take ~90% of first-half minutes vs ~65% of full-game minutes while the book prices the
     1H as a fraction of the FG line rather than re-deriving it from the rotation.
  2. They add MORE in the early-season phase than mid-season, because player ratings carry
     across the offseason and team ratings do not.
If the lift is flat across both splits, the mechanism story is wrong and the result is a
fitting artifact regardless of how good the headline number looks.

Ridge, not GBM, on purpose. 116 features on ~4k games with a walk-forward split is exactly
where a boosted model invents structure. Ridge with a fixed alpha cannot, so if a linear
combination of player ratings has real signal it shows up here honestly, and only then is a
non-linear model worth its risk.
"""
import os
import warnings

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
RNG = np.random.default_rng(7)
ALPHA = 50.0          # heavy: 116 correlated features, small n
MIN_TRAIN = 700       # months before this are burn-in, never scored


def american_to_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def load():
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    # the 45 games whose odds join is ambiguous are dropped everywhere in this project
    F = F[~F["game.id"].duplicated(keep=False)].copy()
    A = pd.read_parquet(f"{OUT}/nba_player_team_agg.parquet")
    G = pd.read_parquet(f"{OUT}/bdl_games.parquet")[
        ["id", "home_team.id", "visitor_team.id", "postseason"]].rename(
        columns={"id": "game.id"})

    feats = [c for c in A.columns if c.startswith(("orc_", "sem_", "prj_", "shk_"))]
    H = A.merge(G[["game.id", "home_team.id"]], left_on=["game.id", "team.id"],
                right_on=["game.id", "home_team.id"], how="inner")[["game.id"] + feats]
    V = A.merge(G[["game.id", "visitor_team.id"]], left_on=["game.id", "team.id"],
                right_on=["game.id", "visitor_team.id"], how="inner")[["game.id"] + feats]
    H = H.rename(columns={c: f"h_{c}" for c in feats})
    V = V.rename(columns={c: f"a_{c}" for c in feats})

    d = F.merge(H, on="game.id", how="inner").merge(V, on="game.id", how="inner")
    d = d.merge(G[["game.id", "postseason"]], on="game.id", how="left")
    # margin markets care about the DIFFERENCE between rosters, totals about the SUM.
    # Handing the model both raw sides and asking it to find that itself just burns
    # degrees of freedom on something already known.
    for c in feats:
        d[f"d_{c}"] = d[f"h_{c}"] - d[f"a_{c}"]
        d[f"s_{c}"] = d[f"h_{c}"] + d[f"a_{c}"]
    d["date"] = pd.to_datetime(d["date"])
    return d.sort_values("date").reset_index(drop=True), feats


def cols_for(feats, kind, market):
    """kind is a column-name prefix; market in {margin, total} picks diff vs sum framing."""
    pre = "d_" if market == "margin" else "s_"
    return [f"{pre}{c}" for c in feats if c.startswith(kind)]


def walk_forward(d, X, y, mask):
    """Expanding-window monthly refit. Returns OOS predictions aligned to d's index."""
    pred = np.full(len(d), np.nan)
    per = d["date"].dt.to_period("M")
    for p in sorted(per.unique()):
        te = (per == p).to_numpy() & mask
        tr = (per < p).to_numpy() & mask
        if te.sum() == 0 or tr.sum() < MIN_TRAIN:
            continue
        sc = StandardScaler().fit(X[tr])
        m = Ridge(alpha=ALPHA).fit(sc.transform(X[tr]), y[tr])
        pred[te] = m.predict(sc.transform(X[te]))
    return pred


def score(y, p, mask):
    k = mask & np.isfinite(p) & np.isfinite(y)
    if k.sum() < 100:
        return np.nan, np.nan, int(k.sum())
    # R2 against the MARKET, i.e. against predicting "residual = 0". Negative means the
    # player features are worse than simply trusting the line, which is a real outcome.
    r2 = 100 * (1 - ((y[k] - p[k]) ** 2).sum() / (y[k] ** 2).sum())
    return 100 * np.corrcoef(y[k], p[k])[0, 1], r2, int(k.sum())


def main():
    d, feats = load()
    print(f"{len(d):,} games with player aggregates joined", flush=True)

    # PLACEBO. The first version of this file flipped the home/away sign, which is a valid
    # null for margin markets and a NO-OP for totals -- home+away is unchanged by a swap,
    # so the "placebo" and the real features were byte-identical and scored identically
    # (+2.3/+2.3, +1.3/+1.3). That is not a null, it is a bug that prints a reassuring
    # number. Permuting whole feature ROWS across games within a season instead breaks the
    # game link for BOTH framings while preserving every marginal distribution.
    perm = np.arange(len(d))
    for s in d["season"].unique():
        idx = np.where(d["season"].to_numpy() == s)[0]
        perm[idx] = RNG.permutation(idx)

    phase = np.where(d[["h_gp", "a_gp"]].min(axis=1) < 15, "early",
                     np.where(d[["h_gp", "a_gp"]].min(axis=1) < 50, "mid", "late"))
    post = d["postseason"].fillna(False).to_numpy(dtype=bool)
    phase = np.where(post, "playoffs", phase)

    TARGETS = [("1H margin", "y_h1_marg_resid", "margin"),
               ("1H total", "y_h1_tot_resid", "total"),
               ("FG margin", "y_fg_marg_resid", "margin"),
               ("FG total", "y_fg_tot_resid", "total")]

    L = ["# NBA bottom-up player model — the ceiling test", "",
         "Fit on the MARKET RESIDUAL (actual − posted line), never on the raw score. "
         "Ridge, alpha=50, expanding monthly walk-forward. `R² vs market` is measured "
         "against predicting zero residual, so **negative means worse than just trusting "
         "the line**.", "",
         "`oracle` weights players by minutes ACTUALLY played (unbettable ceiling). "
         "`projected` uses prior rolling minutes + last-game availability (bettable "
         "today, no injury feed). `placebo` is projected with the home/away side "
         "shuffled — its score is the real zero.", ""]

    # LEVEL sets answer "how good is this roster"; SHOCK sets answer "how far is tonight's
    # roster from what this team normally plays". The market has all summer to price the
    # first and cannot pre-price the second, so the shock rows are the real hypothesis.
    SETS = [("orc", "oracle LEVEL (contaminated)"),
            ("sem", "semi-oracle LEVEL"),
            ("prj", "projected LEVEL"),
            ("shk_sem", "semi-oracle SHOCK"),
            ("shk_prj", "projected SHOCK")]

    store = {}
    L += ["| market | feature set | n | corr(pred, resid) % | R² vs market % |",
          "|---|---|---|---|---|"]
    for lab, ycol, mk in TARGETS:
        y = d[ycol].to_numpy(dtype=float)
        base = np.isfinite(y)
        for kind, kname in SETS:
            X = d[cols_for(feats, kind, mk)].to_numpy(dtype=float)
            X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
            p = walk_forward(d, X, np.nan_to_num(y), base)
            c, r2, n = score(y, p, base)
            store[(lab, kname)] = (p, y, base)
            L.append(f"| {lab} | {kname} | {n:,} | {c:+.1f} | {r2:+.2f} |")
        X = d[cols_for(feats, "shk_sem", mk)].to_numpy(dtype=float)
        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)[perm]
        p = walk_forward(d, X, np.nan_to_num(y), base)
        c, r2, n = score(y, p, base)
        L.append(f"| {lab} | **placebo (rows permuted)** | {n:,} | {c:+.1f} | {r2:+.2f} |")

    # ---- prediction 1: 1H should beat FG ------------------------------------------
    L += ["", "## Prediction 1 — does it help the 1H more than the full game?", "",
          "Registered before the run. Starters take ~90% of first-half minutes vs ~65% "
          "of full-game minutes, and the book prices the 1H as a fraction of the FG line "
          "rather than re-deriving it from the rotation. If the lift is flat across the "
          "two, the mechanism story is wrong.", "",
          "| feature set | 1H margin corr | FG margin corr | 1H total corr | FG total corr |",
          "|---|---|---|---|---|"]
    for kname in [s[1] for s in SETS]:
        row = []
        for lab in ("1H margin", "FG margin", "1H total", "FG total"):
            p, y, b = store[(lab, kname)]
            row.append(f"{score(y, p, b)[0]:+.1f}")
        L.append(f"| {kname} | {row[0]} | {row[1]} | {row[2]} | {row[3]} |")

    # ---- prediction 2: early season should beat mid --------------------------------
    L += ["", "## Prediction 2 — does it help most in the early season?", "",
          "Registered before the run. Player ratings survive the offseason; team ratings "
          "do not. In October a team model has ~zero games of information while this one "
          "has full career history for most of the roster.", "",
          "| market | feature set | early | mid | late | playoffs |",
          "|---|---|---|---|---|---|"]
    for lab, ycol, mk in TARGETS:
        for kname in [s[1] for s in SETS]:
            p, y, b = store[(lab, kname)]
            cells = []
            for ph in ("early", "mid", "late", "playoffs"):
                c, _, n = score(y, p, b & (phase == ph))
                cells.append("—" if not np.isfinite(c) else f"{c:+.1f} (n={n:,})")
            L.append(f"| {lab} | {kname} | " + " | ".join(cells) + " |")

    path = os.path.join(ROOT, "NBA_PLAYER_CEILING_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    np.save(os.path.join(OUT, "nba_player_ceiling_preds.npy"),
            {k: v[0] for k, v in store.items()}, allow_pickle=True)
    d[["game.id", "date", "season"]].to_parquet(f"{OUT}/nba_player_ceiling_keys.parquet")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
