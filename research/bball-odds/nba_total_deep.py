#!/usr/bin/env python3
"""The total is the only live market. Stress it.

The open-line sweep produced exactly one survivor: the full-game TOTAL, where the blend
sharpens monotonically across five nested cuts in win%, ROI and CLV simultaneously. That
pattern is hard to fake -- a noise ranking sharpens in at most one of the three, and not
in the same direction across all of them. But the top cut is n=191, so before anything
gets vaulted it has to survive the checks that have killed every other finding here.

  TRIMMED BLEND   `mlp` posts MAE 19.178 on the 2025-26 totals against 14.81 for the
                  opener -- it did not converge on this target and it is inside the blend
                  that produced the result. If the finding is real it should get BETTER
                  with the broken member removed, not worse.
  CALIBRATION     bucket by predicted edge and read the win rate. A real edge is monotone
                  in its own magnitude across the whole range; a lucky tail is flat
                  everywhere except the last bucket.
  PERMUTATION     shuffle the edge within each month and re-rank 2,000 times. This asks
                  the only question that matters at n=191: how often does a ranking with
                  no information produce a top cut this good?
  SIDE SPLIT      over-selections and under-selections graded apart. An edge that lives
                  entirely on one side is a bias in the model's level, not a handicap.
  SEASON          per this repo's rule, pooled numbers get shown next to the season split
                  always. 2022 has almost no open-total coverage and is reported as such.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
NPERM = 2000
SEED = 0
CUTS = (100, 50, 25, 10, 5)
# mlp is excluded on sight: MAE 19.18 vs the opener's 14.81 on 2025-26 is a failed fit,
# not a weak one, and averaging a failed fit into a blend is how a result becomes fragile
TRIM = ["p_lgbm", "p_xgb", "p_hgb", "p_rf", "p_et", "p_ridge", "p_enet"]


def as_dec(a):
    a = pd.to_numeric(a, errors="coerce").to_numpy(dtype=float)
    dec = np.where(a > 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))
    return np.where((a >= 1.01) & (a <= 40.0), a, dec)


def roi(win, dec):
    return 100 * (win * (dec - 1) - (1 - win)).mean()


def load():
    F = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    F["date"] = pd.to_datetime(F["date"])
    dup = set(F.loc[F.duplicated("game.id", keep=False), "game.id"])
    F = F[~F["game.id"].isin(dup)]
    price = F[["game.id", "open_total_over_price", "open_total_under_price"]]

    T = pd.read_parquet(f"{OUT}/nba_open_total_preds.parquet")
    T = T[~T["game.id"].isin(dup)].merge(price, on="game.id")
    T["season"] = T["season"].astype(str)
    T["date"] = pd.to_datetime(T["date"])
    T["p_trim"] = T[TRIM].mean(axis=1)

    T = T.dropna(subset=["open_total_point", "y_fg_total"])
    T = T[T["y_fg_total"] != T["open_total_point"]]              # pushes are not bets
    return T.sort_values("date").reset_index(drop=True)


def prep(T, pcol):
    d = T[T[pcol].notna()].copy()
    d["edge"] = d[pcol] - d["open_total_point"]
    over = (d["edge"] > 0).to_numpy()
    d["_win"] = np.where(over, d["y_fg_total"] > d["open_total_point"],
                         d["y_fg_total"] < d["open_total_point"]).astype(float)
    d["_dec"] = np.where(over, as_dec(d["open_total_over_price"]),
                         as_dec(d["open_total_under_price"]))
    d["_clv"] = np.where(over, d["t60_total_point"] - d["open_total_point"],
                         d["open_total_point"] - d["t60_total_point"])
    d["_over"] = over
    return d[np.isfinite(d["_dec"])].reset_index(drop=True)


def cut_rows(d, seasons, label):
    rows = []
    e = d["edge"].abs().to_numpy()
    for pct in CUTS:
        thr = np.quantile(e, 1 - pct / 100) if pct < 100 else -1
        m = e >= thr
        if m.sum() < 50:
            continue
        s = d[m]
        per = []
        for ss in seasons:
            k = (s["season"] == ss).to_numpy()
            per.append(f"{100*s['_win'].to_numpy()[k].mean():.0f}" if k.sum() >= 25
                       else "-")
        rows.append(f"| {label} | top{pct}% | {m.sum():,} | {100*s['_win'].mean():.1f} | "
                    f"{roi(s['_win'].to_numpy(), s['_dec'].to_numpy()):+.2f} | "
                    f"{s['_clv'].mean():+.3f} | {100*(s['_clv'] > 0).mean():.1f} | "
                    f"{'/'.join(per)} |")
    return rows


def permutation(d, pct):
    """How often does an information-free ranking beat this cut?

    The shuffle is WITHIN MONTH, so it destroys the model's ordering while preserving the
    month-to-month mix of games -- shuffling globally would let the test beat a result
    just by reweighting a hot stretch of the calendar.
    """
    rng = np.random.default_rng(SEED)
    e, win, dec = d["edge"].abs().to_numpy(), d["_win"].to_numpy(), d["_dec"].to_numpy()
    mo = d["date"].dt.to_period("M").to_numpy()
    thr = np.quantile(e, 1 - pct / 100)
    obs_w = win[e >= thr].mean()
    obs_r = roi(win[e >= thr], dec[e >= thr])
    hw = hr = 0
    idx_by_mo = [np.where(mo == m)[0] for m in np.unique(mo)]
    for _ in range(NPERM):
        sh = e.copy()
        for ix in idx_by_mo:
            sh[ix] = rng.permutation(e[ix])
        m = sh >= np.quantile(sh, 1 - pct / 100)
        if win[m].mean() >= obs_w:
            hw += 1
        if roi(win[m], dec[m]) >= obs_r:
            hr += 1
    return obs_w, obs_r, (hw + 1) / (NPERM + 1), (hr + 1) / (NPERM + 1)


def main():
    T = load()
    seasons = sorted(T["season"].unique())
    print(f"{len(T):,} gradeable totals, seasons {seasons}", flush=True)

    L = ["# NBA TOTAL at the open — the one live market, stressed", "",
         f"{len(T):,} gradeable games (pushes removed), seasons {seasons}. Predictions "
         "are the same walk-forward, open-line-only fits from `nba_open_model.py`; "
         "nothing is refit here. Breakeven at 1.909 is **52.36%**.", "",
         "`p_trim` is the blend with `mlp` removed. That member posts MAE 19.18 against "
         "the opener's 14.81 on 2025-26 -- a failed fit, not a weak one. If the finding "
         "is real, dropping it should help.", ""]

    # ------------------------------------------------------- 1. does the trim hold up?
    L += ["## 1 — Full blend vs trimmed blend\n",
          "| model | cut | n | win% | ROI | CLV pts | CLV+ % | win by season |",
          "|---|---|---|---|---|---|---|---|"]
    D = {}
    for pcol, lab in (("p_blend", "blend"), ("p_trim", "trim")):
        D[lab] = prep(T, pcol)
        L += cut_rows(D[lab], seasons, lab)
        print(f"  {lab}: n={len(D[lab]):,}", flush=True)

    best = "trim" if (D["trim"]["_win"].mean() >= D["blend"]["_win"].mean()) else "blend"
    d = D[best]

    # -------------------------------------------------- 2. calibration in edge magnitude
    L += [f"\n## 2 — Calibration: does win% track the size of the edge? (`{best}`)\n",
          "A real handicap is monotone in its own magnitude across the WHOLE range. A "
          "lucky tail is flat everywhere and jumps only in the last bucket.", "",
          "| edge bucket | n | mean edge | win% | ROI | CLV pts |",
          "|---|---|---|---|---|---|"]
    q = np.quantile(d["edge"].abs(), np.linspace(0, 1, 9))
    b = np.clip(np.digitize(d["edge"].abs(), q[1:-1]), 0, 7)
    for i in range(8):
        s = d[b == i]
        if len(s) < 50:
            continue
        L.append(f"| {q[i]:.1f}–{q[i+1]:.1f} | {len(s):,} | "
                 f"{s['edge'].abs().mean():.2f} | {100*s['_win'].mean():.1f} | "
                 f"{roi(s['_win'].to_numpy(), s['_dec'].to_numpy()):+.2f} | "
                 f"{s['_clv'].mean():+.3f} |")

    # ------------------------------------------------------------- 3. over vs under side
    L += [f"\n## 3 — Which side is the edge on? (`{best}`)\n",
          "An edge sitting entirely on one side is a bias in the model's level, not a "
          "handicap, and would not survive a season where scoring shifts.", "",
          "| side | cut | n | win% | ROI | CLV pts | win by season |",
          "|---|---|---|---|---|---|---|"]
    for side, lab in ((True, "over"), (False, "under")):
        for pct in (100, 25, 10):
            thr = np.quantile(d["edge"].abs(), 1 - pct / 100) if pct < 100 else -1
            s = d[(d["_over"] == side) & (d["edge"].abs() >= thr)]
            if len(s) < 50:
                continue
            per = []
            for ss in seasons:
                k = (s["season"] == ss).to_numpy()
                per.append(f"{100*s['_win'].to_numpy()[k].mean():.0f}"
                           if k.sum() >= 25 else "-")
            L.append(f"| {lab} | top{pct}% | {len(s):,} | {100*s['_win'].mean():.1f} | "
                     f"{roi(s['_win'].to_numpy(), s['_dec'].to_numpy()):+.2f} | "
                     f"{s['_clv'].mean():+.3f} | {'/'.join(per)} |")

    # ------------------------------------------------------------- 4. permutation test
    L += [f"\n## 4 — Permutation test on the ranking (`{best}`, {NPERM:,} shuffles)\n",
          "The edge is shuffled WITHIN each month, so the model's ordering is destroyed "
          "while the calendar mix is preserved. `p` = share of information-free rankings "
          "that matched or beat the observed cut.", "",
          "| cut | n | win% | p(win) | ROI | p(ROI) |", "|---|---|---|---|---|---|"]
    for pct in (50, 25, 10, 5):
        n = int((d["edge"].abs() >= np.quantile(d["edge"].abs(), 1 - pct / 100)).sum())
        w, r, pw, pr = permutation(d, pct)
        L.append(f"| top{pct}% | {n:,} | {100*w:.1f} | {pw:.4f} | {r:+.2f} | {pr:.4f} |")
        print(f"  perm top{pct}%: win {100*w:.1f} p={pw:.4f}  roi {r:+.2f} p={pr:.4f}",
              flush=True)

    path = os.path.join(ROOT, "NBA_TOTAL_DEEP_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
