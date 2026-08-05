#!/usr/bin/env python3
"""Usage concentration: which LOOKBACK WINDOW carries it, and is the CHANGE its own signal?

THE LEAD THIS FILE CHASES. The per-feature audit ranked `a_l5_top_min_share` the single most
valuable column in the total model (delta -0.01017) and `a_l10_top_min_share` the single most
damaging (+0.00552). Same quantity -- what share of a team's minutes goes to its busiest
player -- measured over five games versus ten, pointing in opposite directions. Either the
short window genuinely carries something the long one does not, or the two are so collinear
that the ridge splits one coefficient across them and permutation importance reports the split
rather than the signal. Those are very different worlds and the audit cannot tell them apart,
because permuting one of two near-duplicate columns leaves the other standing in for it.

WHY THE BETTING EDGE CANNOT SETTLE THIS. Its label-shuffle null has a standard deviation near
0.86 points of win rate, so any single arm landing +0.5 is unreadable. Same lesson as the
opponent-adjustment work: when the money metric has no power, find a mechanism target that
does. Here that is the team's OWN NEXT GAME -- ten thousand rows, no market involved. If a
five-game window forecasts a team's next-game scoring better than a ten-game window, the
audit's story is real; if it does not, the audit was reading collinearity.

THE THIRD POSSIBILITY, which is the interesting one. Maybe neither LEVEL is the point and the
CHANGE is: a team whose minutes have just concentrated -- star loading up, rotation shortened
by an injury, a coach benching his bench in a playoff push -- is a different team from one
that has been concentrated all season, and a five-game mean minus a ten-game mean is exactly
that "just changed" quantity. That is a mechanism stated in plain English before it was
tested, which is the only kind worth testing.

FOUR SECTIONS:
  1. How collinear are the windows? Decides whether the audit could have resolved this at all.
  2. Mechanism -- window-by-window forecast of the team's next game, plus the partial test of
     whether the CHANGE adds anything over the LEVEL.
  3. Window ablation inside the model: restrict the usage block to one window at a time.
  4. Change features added, and the three zero-hit-rate blocks dropped, against the null.
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
bf = _load("bf", "build_nba_features.py")

K = 2.0
CONC = ["top_min_share", "min_hhi", "pts_hhi", "adv_usg_max", "adv_rot_n",
        "adv_usage_percentage"]
WINS = ("l3", "l5", "l10", "s2d")
SIDES = ("h", "a", "sum", "d")


# --------------------------------------------------------------------------------- section 1
def collinearity(T):
    """Correlation between the windows of the same concentration stat, on the team panel.

    This is the gate on the whole audit reading. Two columns correlated at 0.95 cannot be told
    apart by permutation importance -- shuffling one leaves the other to carry the prediction,
    so the reported delta is about which one the ridge happened to load, not about which window
    holds information.
    """
    rows = []
    for c in CONC:
        if c not in T.columns:
            continue
        s = pd.to_numeric(T[c], errors="coerce")
        prev = s.groupby(T["team_key"]).shift(1)
        W = {}
        for w in (3, 5, 10):
            W[f"l{w}"] = prev.groupby(T["team_key"]).rolling(w, min_periods=2).mean() \
                .reset_index(level=0, drop=True)
        W["s2d"] = prev.groupby(T["team_key"]).expanding(min_periods=2).mean() \
            .reset_index(level=0, drop=True)
        F = pd.DataFrame(W).dropna()
        rows.append({"stat": c, "n": len(F),
                     "l3~l5": F["l3"].corr(F["l5"]), "l5~l10": F["l5"].corr(F["l10"]),
                     "l3~l10": F["l3"].corr(F["l10"]), "l10~s2d": F["l10"].corr(F["s2d"])})
    return pd.DataFrame(rows)


# --------------------------------------------------------------------------------- section 2
def mechanism(T):
    """Does a 5-game window beat a 10-game window at forecasting the team's next game?

    Two targets, deliberately. Forecasting the concentration stat ITSELF answers "which window
    is the better estimator of this quantity"; forecasting the team's next-game POINTS answers
    "which window is the better predictor of the thing the total market cares about". A window
    can win the first and lose the second, and that would itself be the finding.

    The partial test is the one that matters for the CHANGE story: fit
    `target ~ l10_level + (l5 - l10)` and read the t-statistic on the change term. If the
    change is only a noisier restatement of the level, that t collapses toward zero.
    """
    T = T.sort_values(["team_key", "date"]).reset_index(drop=True)
    out_stat, out_pts = [], []
    for c in CONC:
        if c not in T.columns:
            continue
        s = pd.to_numeric(T[c], errors="coerce")
        prev = s.groupby(T["team_key"]).shift(1)
        W = {}
        for w in (3, 5, 10):
            W[f"l{w}"] = prev.groupby(T["team_key"]).rolling(w, min_periods=2).mean() \
                .reset_index(level=0, drop=True)
        W["s2d"] = prev.groupby(T["team_key"]).expanding(min_periods=2).mean() \
            .reset_index(level=0, drop=True)
        W = pd.DataFrame(W)
        W["d510"] = W["l5"] - W["l10"]

        for tgt_name, tgt, bag in (("stat itself", s, out_stat),
                                   ("own points", pd.to_numeric(T["own_score"],
                                                                errors="coerce"), out_pts)):
            m = tgt.notna()
            for k in ("l3", "l5", "l10", "s2d", "d510"):
                m = m & W[k].notna()
            if m.sum() < 500:
                continue
            r = {"stat": c, "n": int(m.sum())}
            for k in ("l3", "l5", "l10", "s2d"):
                r[k] = np.corrcoef(W.loc[m, k], tgt[m])[0, 1]
            # partial: does the CHANGE add over the LEVEL?
            X = np.column_stack([np.ones(m.sum()), W.loc[m, "l10"], W.loc[m, "d510"]])
            yv = tgt[m].to_numpy()
            beta, *_ = np.linalg.lstsq(X, yv, rcond=None)
            resid = yv - X @ beta
            dof = len(yv) - X.shape[1]
            cov = (resid @ resid / dof) * np.linalg.inv(X.T @ X)
            r["t_change"] = beta[2] / np.sqrt(cov[2, 2])
            r["target"] = tgt_name
            bag.append(r)
    return pd.DataFrame(out_stat), pd.DataFrame(out_pts)


# --------------------------------------------------------------------------------- section 3+4
def usage_cols(D):
    """Every usage-concentration column the incumbent feature set contains, keyed by window."""
    by_win = {w: [] for w in WINS}
    for w in WINS:
        for s in SIDES:
            for st in CONC:
                c = f"{s}_{w}_{st}"
                if c in D.columns:
                    by_win[w].append(c)
    return by_win


def change_cols(D):
    """l5 minus l10, and l3 minus l10: 'concentration just moved', per side.

    Built from the columns already in the frame rather than recomputed from the panel, so the
    change is exactly the difference of the two features the model already has -- which is what
    makes this a clean test of whether the ridge was failing to form that contrast itself.
    """
    made = []
    for s in SIDES:
        for st in CONC:
            a, b, c = f"{s}_l5_{st}", f"{s}_l10_{st}", f"{s}_l3_{st}"
            if a in D.columns and b in D.columns:
                D[f"cw_d510_{s}_{st}"] = D[a] - D[b]
                made.append(f"cw_d510_{s}_{st}")
            if c in D.columns and b in D.columns:
                D[f"cw_d310_{s}_{st}"] = D[c] - D[b]
                made.append(f"cw_d310_{s}_{st}")
    return D, [c for c in made if D[c].notna().mean() > 0.80]


def main():
    # ---------------------------------------------------------------------------- 1 and 2
    T = bf.team_game_panel()
    print(f"[panel] {len(T):,} team-games", flush=True)
    C = collinearity(T)
    MS, MP = mechanism(T)

    L = ["# NBA usage concentration — which window, and does the CHANGE matter?", "",
         "The per-feature audit made `a_l5_top_min_share` the best column in the total model "
         "and `a_l10_top_min_share` the worst. This file decides whether that is a real "
         "short-window effect or an artefact of two near-identical columns splitting one "
         "coefficient.", "",
         "## 1. How collinear are the windows?", "",
         "If two windows of the same stat correlate above about 0.9, permutation importance "
         "cannot separate them: shuffling one leaves the other to carry the prediction. That "
         "would make the audit's L5-vs-L10 split a coin flip, not a finding.", "",
         "| stat | n | l3~l5 | l5~l10 | l3~l10 | l10~s2d |", "|---|---|---|---|---|---|"]
    for _, r in C.iterrows():
        L.append(f"| `{r['stat']}` | {int(r['n']):,} | {r['l3~l5']:.3f} | **{r['l5~l10']:.3f}** "
                 f"| {r['l3~l10']:.3f} | {r['l10~s2d']:.3f} |")
        print(L[-1], flush=True)

    for name, M in (("the stat itself", MS), ("the team's own points", MP)):
        L += ["", f"## 2{'a' if M is MS else 'b'}. Mechanism — forecasting {name} next game", "",
              "Correlation between each pregame window and what the team actually does in the "
              "next game. `t change` is the t-statistic on `l5 − l10` in a regression that "
              "already contains the `l10` level: it asks whether *concentration just moved* "
              "carries anything beyond *concentration is high*. |t| above ~2.6 is real at this "
              "sample size.", "",
              "| stat | n | L3 | L5 | L10 | season-to-date | t change |",
              "|---|---|---|---|---|---|---|"]
        for _, r in M.iterrows():
            best = max(("l3", "l5", "l10", "s2d"), key=lambda k: abs(r[k]))
            cells = {k: (f"**{r[k]:+.4f}**" if k == best else f"{r[k]:+.4f}")
                     for k in ("l3", "l5", "l10", "s2d")}
            L.append(f"| `{r['stat']}` | {int(r['n']):,} | {cells['l3']} | {cells['l5']} | "
                     f"{cells['l10']} | {cells['s2d']} | {r['t_change']:+.2f} |")
            print(L[-1], flush=True)

    # ---------------------------------------------------------------------------- 3 and 4
    D = v2.build()
    D = v3.with_fixed_ratings(D)
    D, themes = v4.dim_features(D)
    base = [c for c in v2.feature_cols(D) if c not in v2.leak_screen(D, v2.feature_cols(D))]
    radj = [c for c in D.columns if c.startswith("radj_") and D[c].notna().mean() > 0.80]
    dims = [c for t in themes.values() for c in t if D[c].notna().mean() > 0.80]
    inc = base + radj + dims                                   # the round-4 incumbent
    uw = usage_cols(D)
    all_usage = {c for cs in uw.values() for c in cs}
    D, chg = change_cols(D)
    print(f"[cols] incumbent={len(inc)} usage={len(all_usage)} change={len(chg)}", flush=True)

    y = D["y_fg_tot_resid"].astype(float)
    yb = pd.Series(np.where(y > 0, 1.0, np.where(y < 0, 0.0, np.nan)), index=D.index)
    po = pd.Series(v2.to_dec(D["t60_total_over_price"]), index=D.index)
    pu = pd.Series(v2.to_dec(D["t60_total_under_price"]), index=D.index)

    def run(tag, cs, bag):
        p = v2.walk(D[cs].astype(float), D["date"], y, kind="ridge")
        v4.report(bag, tag, p, y, yb, po, pu, len(cs), k=K)
        return p

    L += ["", "## 3. Window ablation — restrict the usage block to ONE window", "",
          "Each row keeps the whole incumbent model but allows the usage-concentration family "
          "only one lookback. Within an arm there is no collinearity between windows, so this "
          "measures the window directly instead of measuring how the ridge split a coefficient "
          "between two copies of the same number.", "",
          "| usage window | cols | oos corr | n | win% | base% | edge | ROI |",
          "|---|---|---|---|---|---|---|---|"]
    arms = {}
    for w in WINS:
        keep = [c for c in inc if c not in all_usage or c in uw[w]]
        arms[w] = run(f"{w} only ({len(uw[w])} usage cols)", keep, L)
    arms["all"] = run(f"all four windows (incumbent, {len(all_usage)} usage cols)", inc, L)
    run("usage block REMOVED", [c for c in inc if c not in all_usage], L)

    L += ["", "## 4. The change features, and dropping the dead blocks", "",
          "`cw_d510_*` is the five-game mean minus the ten-game mean: concentration just "
          "moved. The dead blocks are the three the audit found with a zero or near-zero hit "
          "rate — the situational interactions, the schedule theme, and the four structural "
          "columns.", "",
          "| feature set | cols | oos corr | n | win% | base% | edge | ROI |",
          "|---|---|---|---|---|---|---|---|"]
    dead = [c for c in inc if c.startswith("dm_ix_") or c.startswith("dm_sched_")
            or c.startswith("st_")]
    lean = [c for c in inc if c not in set(dead)]
    print(f"[cols] dead blocks = {len(dead)}", flush=True)
    run("incumbent", inc, L)
    run("incumbent + change features", inc + chg, L)
    run(f"incumbent − dead blocks ({len(dead)} cols)", lean, L)
    best_cols = lean + chg
    best = run("both: − dead blocks + change features", best_cols, L)

    # ---------------------------------------------------------------------------------- null
    rng = np.random.default_rng(707)
    nr, ne = [], []
    for i in range(6):
        ys = y.copy()
        for s in D["season"].unique():
            m = (D["season"] == s) & y.notna()
            ys.loc[m] = rng.permutation(y.loc[m].values)
        ps = v2.walk(D[best_cols].astype(float), D["date"], ys, kind="ridge")
        ybs = pd.Series(np.where(ys > 0, 1.0, np.where(ys < 0, 0.0, np.nan)), index=D.index)
        mm = ps.notna() & ys.notna()
        nr.append(np.corrcoef(ps[mm], ys[mm])[0, 1])
        g = v2.grade(ps, ybs, po, pu, K)
        ne.append(g["win"] - g["base"])
        print(f"[null {i+1}/6] corr {nr[-1]:+.4f} edge {ne[-1]:+.2f}", flush=True)

    mm = best.notna() & y.notna()
    rr = np.corrcoef(best[mm], y[mm])[0, 1]
    g = v2.grade(best, yb, po, pu, K)
    nr, ne = np.array(nr), np.array(ne)
    L += ["", "## 5. Label-shuffle null (6 draws, within season) — how big is 'nothing'?", "",
          "Nineteen feature sets were tried against one label above. The null prices that "
          "search: an arm has to clear the shuffle band, not zero.", "",
          "| statistic | real | null mean | null sd | z |", "|---|---|---|---|---|",
          f"| oos corr | {rr:+.4f} | {nr.mean():+.4f} | {nr.std(ddof=1):.4f} | "
          f"**{(rr-nr.mean())/nr.std(ddof=1):+.2f}** |",
          f"| edge @ ≥{K:.0f} | {g['win']-g['base']:+.2f} | {ne.mean():+.2f} | "
          f"{ne.std(ddof=1):.2f} | "
          f"**{(g['win']-g['base']-ne.mean())/ne.std(ddof=1):+.2f}** |", ""]
    print("\n".join(L[-4:]), flush=True)

    with open(os.path.join(ROOT, "NBA_CONC_WINDOW.md"), "w") as f:
        f.write("\n".join(L) + "\n")
    print("wrote NBA_CONC_WINDOW.md", flush=True)


if __name__ == "__main__":
    main()
