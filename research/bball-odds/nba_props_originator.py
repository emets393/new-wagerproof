#!/usr/bin/env python3
"""NBA player props as an ORIGINATOR: predict the stat, then look at the line.

WHAT CHANGED FROM `nba_props_model.py`. That file asked a classifier "did this go over?" and got a
model that never beat a blind under at any cut, at either venue -- top100% -2.52 v -1.18, top5%
+0.19 v +0.38. A model with real information separates from the blind baseline SOMEWHERE. It never
did, which is an information problem, not a pricing problem, and it means the question "is there an
edge in NBA player props" was never actually asked.

Three changes, the same three that took the NBA full-game spread from -0.46% to +9.5%:

  1. RAW TARGET. This predicts `actual` -- how many points the man scores -- not the sign of the
     residual. Owner-raised and validated on the NBA: raw margin with the line as a feature ran
     oos corr +0.474 / +3.9% ROI where the residual-vs-line route ran +0.011 / -1.2%.

  2. THE LINE IS A FEATURE, AND THAT IS DELIBERATE. It breaks the standing originator rule
     ("compare to the Vegas line, do not feed it in") ON PURPOSE and only here. Withholding it
     kills the raw-quantity route outright; the same law that says predict the raw quantity says
     the anchor has to be in the features. The originator discipline is preserved where it
     matters -- the BET is |model - line|, and the product test below is model-vs-line -- but do
     not copy this into the team models, which stay clean.

  3. CONTEXT. `nba_props_blocks.py` supplies opponent quality (the panel had NONE -- all 45 of its
     opponent columns were injury counts), what that defence has allowed to this player's position,
     and the RAPM / regression / style blocks built the same afternoon the panel was frozen.

HOW IT IS GRADED. Two questions, kept apart:

  THE PRODUCT -- paired MAE of the model against the line over every row, nothing filtered. The
  line IS the market's point forecast, so this is a like-for-like forecast comparison, and with
  the game-level noise differenced out it is roughly 20x the power of any ROI cell. This is the
  adjudicator.

  THE BET -- disjoint bands by |model - line|. Every row lands in exactly one band, nothing is
  filtered, no band is a subset of another, so unlike a cumulative ladder these rows cannot
  inherit each other's selection. Each band prints the MARKET's own MAE next to the model's,
  because a gradient with no market column is uninterpretable -- the model getting better and the
  book getting worse look identical without it.

  AND EVERY CELL PRINTS THE BLIND UNDER BESIDE IT. Unders win 52-58% before juice in this data;
  a props number that is not shown against a blind under is not evidence of anything.

usage:  python3 nba_props_originator.py --stage fit [--markets player_points,player_rebounds]
        python3 nba_props_originator.py --stage report
"""
import argparse
import os
import sys
import warnings

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nba_props_blocks import pkey_norm

warnings.filterwarnings("ignore")
import lightgbm as lgb
from sklearn.linear_model import Ridge

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")
OUT = os.path.join(PQ, "_props_preds")
SEED = 7
MIN_TRAIN = 4000
BLOCK_MONTHS = 2

MARKETS = ["player_points", "player_rebounds", "player_assists", "player_threes",
           "player_blocks", "player_steals", "player_points_rebounds", "player_points_assists",
           "player_rebounds_assists", "player_points_rebounds_assists"]

# Outcomes and their derivatives. `mins` is in here because minutes played is the single biggest
# determinant of every one of these stats and it is only known afterwards.
LEAK = {"actual", "over", "push", "mins", "pts", "reb", "ast", "fg3m", "blk", "stl",
        "resid_cons", "y_cons", "y_best_over", "y_best_under", "line", "over_dec", "under_dec"}
IDS = {"event_id", "player", "pkey", "pk", "date", "date_et", "commence_time", "season",
       "season_x", "season_y", "home_team", "away_team", "market", "best_over_book",
       "best_under_book", "game.id", "tid", "pid", "team_id", "opp_id", "gid", "def_tid",
       "pos", "hid", "aid"}


def load(market):
    D = pd.read_parquet(os.path.join(PQ, "nba_props_panel_v2.parquet"))
    D = D[D["market"] == market].copy()
    D["event_id"] = D["event_id"].astype(str)
    D["team_id"] = D["team_id"].astype(float)
    D["pk"] = pkey_norm(D["pkey"])
    n0 = len(D)

    T = pd.read_parquet(os.path.join(PQ, "_props_team_ctx.parquet"))
    T = T.drop(columns=[c for c in ("date",) if c in T.columns])
    D = D.merge(T, on=["event_id", "team_id"], how="left")

    A = pd.read_parquet(os.path.join(PQ, "_props_pattr.parquet"))
    D = D.merge(A, on="pk", how="left")

    # positional defence is keyed on the OPPONENT and on this player's own position bucket
    P = pd.read_parquet(os.path.join(PQ, "_props_posdef.parquet"))
    P["gid"] = pd.to_numeric(P["gid"], errors="coerce")
    P["def_tid"] = pd.to_numeric(P["def_tid"], errors="coerce")
    D["gid"] = pd.to_numeric(D["game.id"], errors="coerce")
    D = D.merge(P, left_on=["gid", "opp_id", "pos"], right_on=["gid", "def_tid", "pos"], how="left")

    assert len(D) == n0, f"context merge changed row count {n0} -> {len(D)}"
    D = D[D["actual"].notna() & D["cons_line"].notna()].copy()
    D = D.sort_values("date").reset_index(drop=True)
    print(f"[{market}] {len(D):,} rows | ctx {D['opp_adj_def'].notna().mean():.1%} "
          f"| posdef {D['opd_s2d_pts'].notna().mean():.1%} "
          f"| pattr {D['pa_height_in'].notna().mean():.1%}", flush=True)
    return D


# Which of the three moves did the work? `panel` is the original 235-column panel with only the
# target changed, so panel-vs-all decomposes the rebuild into "new target" and "new information".
NEW = ("own_", "opp_", "d_", "opd_", "pa_", "ctx_")


def feature_cols(D, mode="all"):
    cols = [c for c in D.columns
            if c not in LEAK and c not in IDS and D[c].dtype.kind in "fiub"]
    if mode == "panel":                       # target change only, no attached context
        cols = [c for c in cols if not c.startswith(NEW)]
    elif mode == "noposdef":                  # everything except positional defence
        cols = [c for c in cols if not c.startswith("opd_")]
    elif mode == "ctxonly":                   # panel market/own-form dropped, context kept
        cols = [c for c in cols if c.startswith(NEW) or c == "cons_line"]
    assert not (set(cols) & LEAK), f"LEAK COLUMN IN X: {set(cols) & LEAK}"
    assert "cons_line" in cols, "the anchor must be a feature for a raw-quantity target"
    return cols


def walk(D, cols):
    """Rolling origin, refit every BLOCK_MONTHS on everything strictly earlier."""
    P = pd.DataFrame(index=D.index, columns=["lgbm", "ridge"], dtype=float)
    mo = D["date"].dt.to_period("M")
    uniq = sorted(mo.unique())
    blocks = [uniq[i:i + BLOCK_MONTHS] for i in range(0, len(uniq), BLOCK_MONTHS)]
    for blk in blocks:
        te = D.index[mo.isin(blk)]
        tr = D.index[(mo < blk[0]) & D["actual"].notna()]
        if len(te) == 0 or len(tr) < MIN_TRAIN:
            continue
        Xtr = D.loc[tr, cols].to_numpy(dtype=np.float32)
        ytr = D.loc[tr, "actual"].to_numpy(dtype=np.float32)
        Xte = D.loc[te, cols].to_numpy(dtype=np.float32)

        m = lgb.LGBMRegressor(n_estimators=600, learning_rate=0.03, num_leaves=31,
                              min_child_samples=60, subsample=0.8, subsample_freq=1,
                              colsample_bytree=0.4, reg_lambda=5.0,
                              random_state=SEED, verbose=-1, n_jobs=-1)
        m.fit(Xtr, ytr)
        P.loc[te, "lgbm"] = m.predict(Xte)

        # ridge needs a dense finite frame; impute on TRAIN statistics only
        med = np.nanmedian(Xtr, axis=0)
        med = np.where(np.isfinite(med), med, 0.0)
        A = np.where(np.isfinite(Xtr), Xtr, med)
        B = np.where(np.isfinite(Xte), Xte, med)
        mu, sd = A.mean(0), A.std(0)
        sd = np.where(sd > 1e-9, sd, 1.0)
        r = Ridge(alpha=300.0).fit((A - mu) / sd, ytr)
        P.loc[te, "ridge"] = r.predict((B - mu) / sd)
        print(f"    {blk[0]}..{blk[-1]}  train {len(tr):,}  test {len(te):,}", flush=True)
    return P


# ------------------------------------------------------------------ grading

def _venue(venue):
    if venue == "cons":
        return "y_cons", "cons_over_dec", "y_cons", "cons_under_dec"
    return "y_best_over", "best_over_dec", "y_best_under", "best_under_dec"


def grade(D, mask, over, venue, price=False):
    """ROI on the selected rows. `over` is a boolean Series; pass all-False for the blind under.

    `price=True` also returns the mean decimal odds actually taken and the win rate that price
    requires to break even. That pair is not decoration -- it is why this model makes money on a
    26.5-point PRA line and loses on a 0.5-block line while hitting the same 58% on both.
    """
    yo, do, yu, du = _venue(venue)
    m = mask & D[yo].notna() & D[yu].notna()
    if m.sum() < 30:
        return (0, np.nan, np.nan) + ((np.nan, np.nan) if price else ())
    o = over[m]
    y = np.where(o, D.loc[m, yo], D.loc[m, yu])
    win = np.where(o, y, 1 - y)
    dec = np.where(o, D.loc[m, do], D.loc[m, du])
    g = ~np.isnan(dec) & ~np.isnan(win)
    win, dec = win[g], dec[g]
    if len(win) < 30:
        return (0, np.nan, np.nan) + ((np.nan, np.nan) if price else ())
    out = (len(win), 100 * win.mean(), 100 * (win * (dec - 1) - (1 - win)).mean())
    return out + ((dec.mean(), 100 / dec.mean()) if price else ())


def product_table(D, pred):
    """Paired per-row MAE, model against the posted line. Nothing filtered."""
    ok = pred.notna() & D["actual"].notna() & D["cons_line"].notna()
    e_m = (D.loc[ok, "actual"] - pred[ok]).abs()
    e_k = (D.loc[ok, "actual"] - D.loc[ok, "cons_line"]).abs()
    d = e_k - e_m                                     # positive => model beat the line
    t = d.mean() / (d.std(ddof=1) / np.sqrt(len(d))) if d.std(ddof=1) > 0 else np.nan
    return dict(n=int(ok.sum()), model=e_m.mean(), market=e_k.mean(), better=d.mean(), t=t)


BANDS = [(0.00, 0.50), (0.50, 0.75), (0.75, 0.90), (0.90, 0.97), (0.97, 1.01)]


def band_table(D, pred, venue):
    edge = (pred - D["cons_line"]).abs()
    ok = pred.notna() & D["y_cons"].notna()
    q = edge[ok].rank(pct=True)
    rows = []
    for lo, hi in BANDS:
        sel = pd.Series(False, index=D.index)
        sel.loc[q.index[(q >= lo) & (q < hi)]] = True
        if sel.sum() < 30:
            continue
        over = (pred > D["cons_line"])
        n, w, roi = grade(D, sel, over, venue)
        bn, bw, broi = grade(D, sel, pd.Series(False, index=D.index), venue)
        on, ow, oroi = grade(D, sel, pd.Series(True, index=D.index), venue)
        e_m = (D.loc[sel, "actual"] - pred[sel]).abs().mean()
        e_k = (D.loc[sel, "actual"] - D.loc[sel, "cons_line"]).abs().mean()
        rows.append(dict(band=f"{int(lo*100)}-{min(int(hi*100),100)}%",
                         med_edge=edge[sel].median(), n=n, model_mae=e_m, market_mae=e_k,
                         better=e_k - e_m, win=w, roi=roi, blind_un=broi, blind_ov=oroi,
                         vs_blind=roi - max(broi, oroi), over_share=100 * over[sel].mean()))
    return pd.DataFrame(rows)


def side_table(D, pred, venue, pct=25):
    """Split the model's picks by side.

    `vs_blind` against a blind under is DEGENERATE on the rows where the model itself says under --
    betting under IS the blind under there, so the column reads exactly 0 by construction. The
    honest question per side is whether the model's chosen rows beat that side's UNCONDITIONAL rate
    over the whole market, which is what `base_roi` is.
    """
    edge = (pred - D["cons_line"]).abs()
    ok = pred.notna() & D["y_cons"].notna()
    thr = edge[ok].quantile(1 - pct / 100)
    sel = ok & (edge >= thr)
    over = pred > D["cons_line"]
    rows = []
    for side, want in (("over", True), ("under", False)):
        m = sel & (over if want else ~over)
        n, w, roi, dec, be = grade(D, m, over, venue, price=True)
        bn, bw, broi = grade(D, ok, pd.Series(want, index=D.index), venue)   # all rows, this side
        rows.append(dict(side=side, n=n, win=w, need=be, roi=roi,
                         base_win=bw, base_roi=broi, vs_base=roi - broi))
    return pd.DataFrame(rows)


def ladder_table(D, pred, venue):
    """Top-X% by |model - line|, for continuity with NBA_PROPS_MODEL_BRIEF.md."""
    edge = (pred - D["cons_line"]).abs()
    ok = pred.notna() & D["y_cons"].notna()
    rows = []
    for pct in (100, 50, 25, 10, 5):
        thr = edge[ok].quantile(1 - pct / 100) if pct < 100 else -1
        sel = ok & (edge >= thr)
        over = (pred > D["cons_line"])
        n, w, roi, dec, be = grade(D, sel, over, venue, price=True)
        bn, bw, broi = grade(D, sel, pd.Series(False, index=D.index), venue)
        on, ow, oroi = grade(D, sel, pd.Series(True, index=D.index), venue)
        rows.append(dict(top=f"{pct}%", n=n, win=w, need=be, roi=roi, blind_un=broi,
                         blind_ov=oroi, vs_blind=roi - max(broi, oroi)))
    return pd.DataFrame(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--markets", default=",".join(MARKETS))
    ap.add_argument("--features", default="all", choices=["all", "panel", "noposdef", "ctxonly"])
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    tag = "" if args.features == "all" else f".{args.features}"

    for mk in args.markets.split(","):
        mk = mk.strip()
        if not mk:
            continue
        D = load(mk)
        cols = feature_cols(D, args.features)
        print(f"[{mk}] {len(cols)} features ({args.features})", flush=True)
        P = walk(D, cols)
        keep = ["date", "season_x", "pkey", "actual", "cons_line", "y_cons",
                "y_best_over", "y_best_under", "cons_over_dec", "cons_under_dec",
                "best_over_dec", "best_under_dec"]
        R = pd.concat([D[keep], P], axis=1)
        R.to_parquet(os.path.join(OUT, f"{mk}{tag}.parquet"), index=False)

        for mn in ("lgbm", "ridge"):
            pr = P[mn]
            pt = product_table(D, pr)
            print(f"\n[{mk}/{mn}] PRODUCT  n={pt['n']:,}  model MAE {pt['model']:.3f} "
                  f"vs line {pt['market']:.3f}  better by {pt['better']:+.4f}  t {pt['t']:+.2f}",
                  flush=True)
            for venue in ("cons", "best"):
                print(f"  ladder @{venue}:\n" +
                      ladder_table(D, pr, venue).to_string(index=False, float_format="%.2f"),
                      flush=True)
        print("=" * 100, flush=True)


if __name__ == "__main__":
    main()
