#!/usr/bin/env python3
"""Does PLAYER-level regression beat the TEAM-level aggregate? The question that matters.

nba_regression_build produced `d_luck_net` -- a team's recent points above shot-model
expectation, averaged over whoever happened to shoot. nba_player_regression produced
`d_pheat` -- the same idea rebuilt per player against HIS OWN career finishing rate and
re-aggregated over tonight's projected rotation, weighted by his own shot volume.

They will correlate. The only thing worth knowing is whether the player version carries
information the team version does not, so the decisive test here is not "does d_pheat
predict" but the NESTED one: residualise d_pheat on d_luck_net and ask whether what is left
still predicts. If it does not, going to player level bought nothing and the honest answer
is that the team aggregate was already sufficient.

Signs pre-registered in nba_player_regression.py:
  P1  corr(d_pheat, residual) < 0        hot shooting regresses, market priced the results
  P2  concentrated heat regresses harder than diffuse heat at equal magnitude
  P3  corr(d_pownx, residual) > 0        rotation shot-selection quality is underpriced

Graded at BOTH the opener and the T-60 close. Every win rate sits next to the max-side
baseline OF ITS OWN SLICE, and because that baseline is hindsight-picked a coin flip scores
about -2 on it, so the comparison is the 2,000-permutation null mean, never zero.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from nba_out_isolate import to_dec
from nba_regression_model import MKT, load

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
N_PERM = 2000
RNG = np.random.default_rng(41)

PHASES = [("early (<=15 gp)", 0, 15), ("mid (16-45)", 16, 45),
          ("late (46-81)", 46, 81), ("playoffs (82+)", 82, 200)]
PCOLS = ["p_heat", "p_conc", "p_top", "p_ownx", "n_rot"]


def load_all():
    d = load()
    P = pd.read_parquet(f"{OUT}/nba_player_regression.parquet")
    H = P[P["is_home"]][["game.id"] + PCOLS].rename(columns={c: f"hp_{c}" for c in PCOLS})
    A = P[~P["is_home"]][["game.id"] + PCOLS].rename(columns={c: f"ap_{c}" for c in PCOLS})
    d = d.merge(H, on="game.id", how="inner").merge(A, on="game.id", how="inner")
    for c in PCOLS:
        d[f"d_{c}"] = d[f"hp_{c}"] - d[f"ap_{c}"]
    # P2's conditioning variable: how concentrated is the heat on the side that HAS the
    # heat. Taking a plain average of both teams' HHI would blur the driving side away.
    hot_home = d["hp_p_heat"].abs() >= d["ap_p_heat"].abs()
    d["conc_drv"] = np.where(hot_home, d["hp_p_conc"], d["ap_p_conc"])
    d["gp"] = d[["h_gp", "a_gp"]].astype(float).min(axis=1)
    return d


def corr(a, b):
    m = np.isfinite(a) & np.isfinite(b)
    return (100 * np.corrcoef(a[m], b[m])[0, 1], int(m.sum())) if m.sum() > 30 else (np.nan, 0)


def resid_on(d, y_col, x_col):
    """Least-squares residual of y_col on x_col, NaN-safe, returned aligned to d."""
    y = d[y_col].to_numpy(dtype=float)
    x = d[x_col].to_numpy(dtype=float)
    m = np.isfinite(y) & np.isfinite(x)
    beta = np.polyfit(x[m], y[m], 1)
    r = np.full(len(d), np.nan)
    r[m] = y[m] - np.polyval(beta, x[m])
    return r


def bet(d, sig, mkt, n_target, tag, L):
    ycol, phc, plc = MKT[mkt]
    y = d[ycol].to_numpy(dtype=float)
    dh, da = to_dec(d[phc]), to_dec(d[plc])
    seas = d["season"].to_numpy()
    ok = np.isfinite(y) & (y != 0) & np.isfinite(sig) & (sig != 0)
    if ok.sum() < max(120, n_target):
        return
    idxs = [ix[ok[ix]] for ix in (np.where(seas == s)[0] for s in np.unique(seas))]
    idxs = [ix for ix in idxs if len(ix) > 1]

    def score(g):
        thr = np.quantile(np.abs(g[ok]), max(0.0, 1.0 - n_target / ok.sum()))
        m = ok & (np.abs(g) >= thr)
        if m.sum() < 20:
            return None
        hi = g[m] > 0
        win = np.where(hi, y[m] > 0, y[m] < 0)
        base = max((y[m] > 0).mean(), (y[m] < 0).mean())
        roi = np.where(win, np.where(hi, dh[m], da[m]) - 1.0, -1.0).mean()
        return 100 * (win.mean() - base), 100 * win.mean(), 100 * base, 100 * roi, m, win

    r = score(sig)
    if r is None:
        return
    e, w, b, roi, m, win = r
    per = " ".join(f"{s}:{100*win[seas[m] == s].mean():.0f}" for s in sorted(set(seas[m])))
    null = np.empty(N_PERM)
    pg = sig.copy()
    for i in range(N_PERM):
        for ix in idxs:
            pg[ix] = sig[RNG.permutation(ix)]
        q = score(pg)
        null[i] = q[0] if q else np.nan
    null = null[np.isfinite(null)]
    L.append(f"| {tag} | {mkt} | {m.sum():,} | {w:.1f} | {b:.1f} | **{e:+.1f}** | "
             f"{null.mean():+.1f} | {(null >= e).mean():.3f} | {roi:+.1f} | {per} |")
    print(L[-1], flush=True)


def main():
    d = load_all()
    L = ["# NBA player-level regression to the mean vs the team aggregate", "",
         f"n = {len(d):,} games with both feature sets.", ""]

    # ---- P1 / P3 main effects, signs committed before the fit ----------------------
    L += ["## Pre-registered signs", "",
          "| feature | corr vs T-60 resid | corr vs OPEN resid | n | predicted |",
          "|---|---|---|---|---|"]
    preds = [("d_p_heat", "P1 player heat", "NEGATIVE"),
             ("d_p_top", "P1b single hottest player", "NEGATIVE"),
             ("d_p_ownx", "P3 rotation shot selection", "POSITIVE"),
             ("d_luck_net", "team aggregate luck (incumbent)", "NEGATIVE"),
             ("d_xefg_net", "team process xEFG (incumbent)", "POSITIVE")]
    for c, lab, pr in preds:
        v = d[c].to_numpy(dtype=float)
        o = [corr(v, d[MKT[k][0]].to_numpy(dtype=float)) for k in ("T-60", "OPEN")]
        L.append(f"| {lab} (`{c}`) | {o[0][0]:+.2f} | {o[1][0]:+.2f} | {o[0][1]:,} | {pr} |")
    print("\n".join(L[-7:]), flush=True)

    # ---- the decisive nested test --------------------------------------------------
    L += ["", "## Does player level add anything over the team aggregate?", "",
          "`d_p_heat ⟂ d_luck_net` is player heat with the team aggregate projected out. "
          "If it goes flat, player granularity bought nothing.", "",
          "| quantity | corr vs T-60 | corr vs OPEN | n |", "|---|---|---|---|"]
    d["d_pheat_res"] = resid_on(d, "d_p_heat", "d_luck_net")
    d["d_luck_res"] = resid_on(d, "d_luck_net", "d_p_heat")
    ra, _ = corr(d["d_p_heat"].to_numpy(float), d["d_luck_net"].to_numpy(float))
    for c, lab in [("d_pheat_res", "player heat ⟂ team luck"),
                   ("d_luck_res", "team luck ⟂ player heat (mirror)")]:
        v = d[c].to_numpy(dtype=float)
        o = [corr(v, d[MKT[k][0]].to_numpy(dtype=float)) for k in ("T-60", "OPEN")]
        L.append(f"| {lab} | {o[0][0]:+.2f} | {o[1][0]:+.2f} | {o[0][1]:,} |")
    L += ["", f"corr(d_p_heat, d_luck_net) = {ra:+.1f} — they share this much and no more."]
    print("\n".join(L[-5:]), flush=True)

    # ---- P2: concentration ---------------------------------------------------------
    L += ["", "## P2 — does CONCENTRATED heat regress harder than diffuse heat?", "",
          "Split on the HHI of the side carrying the heat. Prediction: the top tercile "
          "(one player carrying it) shows a more negative correlation than the bottom.", "",
          "| concentration | n | corr(d_p_heat, T-60) | corr(d_p_heat, OPEN) |",
          "|---|---|---|---|"]
    q = d["conc_drv"].quantile([1 / 3, 2 / 3]).to_numpy()
    for lab, lo, hi in [("diffuse (bottom 3rd)", -1, q[0]),
                        ("middle", q[0], q[1]), ("concentrated (top 3rd)", q[1], 9)]:
        s = d[(d["conc_drv"] > lo) & (d["conc_drv"] <= hi)]
        v = s["d_p_heat"].to_numpy(dtype=float)
        o = [corr(v, s[MKT[k][0]].to_numpy(dtype=float)) for k in ("T-60", "OPEN")]
        L.append(f"| {lab} | {o[0][1]:,} | {o[0][0]:+.2f} | {o[1][0]:+.2f} |")
    print("\n".join(L[-4:]), flush=True)

    # ---- phase split, per the standing rule about not pooling -----------------------
    L += ["", "## By season phase", "",
          "| phase | n | corr d_p_heat | corr d_p_ownx | corr d_pheat_res |",
          "|---|---|---|---|---|"]
    for name, lo, hi in PHASES:
        s = d[(d["gp"] >= lo) & (d["gp"] <= hi)]
        y = s[MKT["T-60"][0]].to_numpy(dtype=float)
        row = [corr(s[c].to_numpy(dtype=float), y)
               for c in ("d_p_heat", "d_p_ownx", "d_pheat_res")]
        if row[0][1] < 100:
            continue
        L.append(f"| {name} | {row[0][1]:,} | {row[0][0]:+.2f} | {row[1][0]:+.2f} | "
                 f"{row[2][0]:+.2f} |")
    print("\n".join(L[-5:]), flush=True)

    # ---- bet tests: fade the hot side, and the concentrated subset -------------------
    L += ["", "## Bet test", "",
          "Signal is NEGATED where the prediction is negative, so a positive signal always "
          "means 'back the home side'. `edge` = win% − the hindsight max-side baseline of "
          "the same subset; a coin flip scores ≈ −2, so compare `null mean`, not 0.", "",
          "| signal | market | bets | win % | base % | edge | null mean | p | ROI % | by season |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    conc_hi = d["conc_drv"] > q[1]
    tests = [("fade player heat", d, -d["d_p_heat"].to_numpy(dtype=float), 600),
             ("fade heat ⟂ team luck", d, -d["d_pheat_res"].to_numpy(dtype=float), 600),
             ("rotation shot selection", d, d["d_p_ownx"].to_numpy(dtype=float), 600),
             ("fade heat, CONCENTRATED only", d[conc_hi].reset_index(drop=True),
              -d.loc[conc_hi, "d_p_heat"].to_numpy(dtype=float), 400)]
    for tag, sub, sig, n in tests:
        for mkt in ("OPEN", "T-60"):
            bet(sub, sig.copy(), mkt, n, tag, L)

    path = os.path.join(ROOT, "NBA_PLAYER_REGRESSION_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
