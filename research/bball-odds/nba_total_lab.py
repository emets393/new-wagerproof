#!/usr/bin/env python3
"""NBA FULL-GAME TOTAL: what actually helps, family by family.

WHY THIS EXISTS. The model shipping on the site right now correlates -0.017 with the total's
deviation from the line over 1,147 graded games. That is not "the market is efficient" -- an
efficient market gives you ~0.00 and a mediocre model still gives +0.03. It is a model with
no information in it, and there are three candidate reasons:

  1. WRONG TARGET. Production trains on the total and subtracts the line afterwards. The
     line explains ~all of the variance in the total, so a model fit that way spends its
     capacity relearning the line and reports its leftovers as an edge.
  2. WRONG FEATURES. Production feeds 52 team box columns (adj off/def/pace, l3/l5 trends)
     and nothing else. No player information, no expected shooting, no absences, no style
     matchup, no schedule.
  3. NOBODY EVER CHECKED. There is no ablation anywhere in the pipeline. If a family hurts,
     nothing would have surfaced it.

This file tests all three. It trains DIRECTLY on the residual vs the closing line, it has
access to every family we have built across the whole program, and it reports each family
ALONE and LEFT OUT of the full set, so "helps" and "hurts" are measured rather than assumed.

READING THE NUMBERS. Overs hit 48.7% of these games, so blind UNDER is 51.3% and that -- not
50% -- is the number every win rate below has to beat. Breakeven at -110 is 52.4%. Any cell
quoted without its own in-slice baseline next to it is meaningless.

PHASES. Reported early (<20 games played) / mid (20-49) / late (50+) / postseason, because a
team in October and the same team in April are not the same team and the market prices them
with different amounts of information.
"""
import os
import sys
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from sklearn.ensemble import HistGradientBoostingClassifier
import lightgbm as lgb

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
REFIT_DAYS = 28          # rolling-origin refit cadence
MIN_TRAIN = 700
BASE_SEED = 0


# ---------------------------------------------------------------------------- frame
def props_lean(_=None):
    """Player-points props, aggregated up to the game. The NBA port of NFL's P11.

    P11 is the best-validated construction of this shape we have (58-61%, +11-16% ROI): take
    a market/model that prices PLAYERS, aggregate its collective lean, bet the GAME total with
    it. It is worth trying precisely because it is NOT another rearrangement of team box
    scores -- player props are priced by a different desk off different information, and the
    game-total model cannot see any of it.

    THE NORMALISATION MATTERS MORE THAN THE SIGNAL. Player coverage swings from 1 to 21 props
    per game (median 14), so a raw sum of projections is mostly a count of how many players
    got a line posted. Raw sums correlate 0.054 with the total; every aggregate below is
    therefore paired with its own denominator (pp_n, pp_line_sum, pp_line_share) so the model
    can divide the count back out instead of fitting it.
    """
    try:
        P = pd.read_parquet(f"{OUT}/nba_props_pred_player_points.parquet")
        # Whitelist, never blacklist: the panel also carries ACTUALS (pts, over, push,
        # resid_cons, y_cons). One stray outcome column here would leak the game result into
        # a "player props" feature and manufacture an edge that does not exist.
        pan = pd.read_parquet(f"{OUT}/nba_props_panel_v2.parquet",
                              columns=["event_id", "market", "pkey", "cons_line", "cons_p_over",
                                       "pts_proj", "pts_exp", "mins_exp", "use_exp", "fga_exp",
                                       "fg3a_exp"])
    except Exception as e:
        print(f"[WARN] props unavailable ({e}) — skipping the player-props family")
        return pd.DataFrame(columns=["event_id"])

    pan = pan[pan["market"] == "player_points"].drop_duplicates(["event_id", "pkey"])
    P = P[P["market"] == "player_points"][["event_id", "pkey", "_p"]]
    M = pan.merge(P, on=["event_id", "pkey"], how="left").dropna(subset=["cons_line"])
    if M.empty:
        return pd.DataFrame(columns=["event_id"])

    # _p is P(this player goes over his own points line); (_p - 0.5) is the lean and the line
    # is the weight, because a 28-point scorer leaning over moves a game total far more than a
    # 6-point bench guard leaning the same way.
    M["lean"] = (M["_p"] - 0.5) * M["cons_line"]
    M["gap"] = M["pts_proj"] - M["cons_line"]        # our projection vs the player's own line
    g = M.groupby("event_id")

    out = pd.DataFrame({
        "pp_n":          g.size(),
        "pp_line_sum":   g["cons_line"].sum(),
        "pp_proj_sum":   g["pts_proj"].sum(),
        "pp_gap_sum":    g["gap"].sum(),             # total points of disagreement
        "pp_gap_mean":   g["gap"].mean(),            # coverage-neutral version of the same
        "pp_lean_sum":   g["lean"].sum(),
        "pp_lean_wt":    g["lean"].sum() / g["cons_line"].sum(),
        "pp_p_mean":     g["_p"].mean(),
        "pp_p_sd":       g["_p"].std(),
        "pp_frac_over":  g["_p"].apply(lambda s: (s > 0.5).mean()),
        "pp_cons_p_mean": g["cons_p_over"].mean(),   # the market's own de-vigged over price
        "pp_mins_sum":   g["mins_exp"].sum(),
        "pp_use_sum":    g["use_exp"].sum(),
        "pp_fg3a_sum":   g["fg3a_exp"].sum(),        # 3-point volume is the main total driver
        "pp_fga_sum":    g["fga_exp"].sum(),
        "pp_top_line":   g["cons_line"].max(),
    }).reset_index()
    return out


def side_merge(G, path, key, prefix, keep=None):
    """Attach a team-keyed table as home/away/diff/sum columns.

    Everything here is a DIFFERENCE market -- the total is a sum, the spread is a difference --
    so a raw home column and a raw away column are worth less than their sum and gap.
    """
    try:
        T = pd.read_parquet(path)
    except Exception as e:
        print(f"[WARN] {path} unavailable ({e})")
        return G
    if keep is not None:
        T = T[[c for c in T.columns if c in ("game.id", "game_key", "team_id", "team.id",
                                             "team_key", "is_home", "home_team_id", key)
               or keep(c)]]
    drop = (key, "team_id", "team.id", "is_home", "date", "season", "season_yr", "game_id",
            "team_key", "game_key", "home_team_id")
    num = [c for c in T.columns if c not in drop and pd.api.types.is_numeric_dtype(T[c])]
    tk = next((c for c in ("team.id", "team_id", "team_key") if c in T.columns), None)
    # style_nba keys on team_key and nba_regression_features carries home_team_id instead of
    # a home flag. Both of those used to fall through the `return G` below and silently
    # contribute ZERO columns, which reads downstream as "this family does not help".
    if "is_home" not in T.columns and {"team_id", "home_team_id"} <= set(T.columns):
        T = T.assign(is_home=(T["team_id"] == T["home_team_id"]).astype(float))
    if tk is None or "is_home" not in T.columns:
        print(f"[WARN] {os.path.basename(path)}: no team/home key — family will be EMPTY")
        return G
    hk = "is_home"
    h = T[T[hk].astype(float) == 1].set_index(key)[num].add_prefix(f"{prefix}_h_")
    a = T[T[hk].astype(float) == 0].set_index(key)[num].add_prefix(f"{prefix}_a_")
    J = h.join(a, how="outer")
    for c in num:
        J[f"{prefix}_d_{c}"] = J[f"{prefix}_h_{c}"] - J[f"{prefix}_a_{c}"]
        J[f"{prefix}_sum_{c}"] = J[f"{prefix}_h_{c}"] + J[f"{prefix}_a_{c}"]
    return G.merge(J.reset_index().rename(columns={key: "game.id"}), on="game.id", how="left")


def build():
    D = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    n0 = len(D)
    D = D[D[["y_fg_total", "t60_total_point", "t60_total_over_price",
             "t60_total_under_price"]].notna().all(axis=1)].copy()
    D["date"] = pd.to_datetime(D["date"])
    D = D.sort_values("date").reset_index(drop=True)
    print(f"[frame] {n0:,} -> {len(D):,} games with a gradeable T-60 total", flush=True)

    # standings: the only source of "does this game matter", and the phase gate
    try:
        S = pd.read_parquet(f"{OUT}/nba_standings_feats.parquet")
        D = D.merge(S, on="game.id", how="left")
    except Exception as e:
        print(f"[WARN] standings unavailable ({e})")

    D = side_merge(D, f"{OUT}/nba_regression_features.parquet", "game.id", "reg")

    # style_nba: ONLY the s_ (season-to-date) and pct_ (percentile-rank) columns.
    # The bare columns -- pace, p3_pct, ftr, to_rate, d_* -- are THAT GAME'S OWN BOX SCORE.
    # Proof: lag-1 autocorrelation within a team is +0.12 for `pace` and -0.01 for `p3_pct`
    # (no persistence = a single realised game), against +0.94 / +0.91 for `s_pace` / `s_p3_pct`.
    # Merging them scored corr +0.55 with the total residual and would have been reported as
    # the biggest find in the study. It is the game's result read back as a prediction.
    D = side_merge(D, f"{OUT}/style_nba.parquet", "game_key", "sty",
                   keep=lambda c: c.startswith(("s_", "pct_")))

    # player aggregates: usage-weighted per-36 columns per team-game -- the "player regression
    # rolled up to the team" path, which nothing in production sees.
    try:
        A = pd.read_parquet(f"{OUT}/nba_player_team_agg.parquet")
        # prj_ = projected and sem_ = smoothed-empirical are pregame estimates. orc_ is the
        # OBSERVED roster for that game, i.e. who actually played and for how many minutes,
        # which is only knowable afterwards -- orc_minsum correlates +0.24 with the same
        # game's total purely because overtime games have more minutes in them.
        pref = [c for c in A.columns if c.startswith(("prj_", "sem_", "shk_prj_", "shk_sem_"))]
        assert not any("orc" in c for c in pref), "observed-roster columns leaked back in"
        if "game.id" in A.columns and "team.id" in A.columns:
            A = A[["game.id", "team.id"] + pref]
            # no is_home on this table -- rank the two team rows by id so the pairing is at
            # least stable, then let d_/sum_ carry the signal (sum is order-invariant, which
            # is what a TOTAL model actually wants)
            A["_r"] = A.groupby("game.id")["team.id"].rank(method="first")
            p1 = A[A["_r"] == 1].set_index("game.id")[pref].add_prefix("pl_1_")
            p2 = A[A["_r"] == 2].set_index("game.id")[pref].add_prefix("pl_2_")
            J = p1.join(p2, how="outer")
            for c in pref:
                J[f"pl_sum_{c}"] = J[f"pl_1_{c}"] + J[f"pl_2_{c}"]
                J[f"pl_absd_{c}"] = (J[f"pl_1_{c}"] - J[f"pl_2_{c}"]).abs()
            J = J[[c for c in J.columns if c.startswith(("pl_sum_", "pl_absd_"))]]
            D = D.merge(J.reset_index(), on="game.id", how="left")
    except Exception as e:
        print(f"[WARN] player agg unavailable ({e})")

    PP = props_lean()
    if not PP.empty:
        D = D.merge(PP, on="event_id", how="left")
        # The share of the game's total that the covered players account for. This is the
        # denominator that makes every other pp_ sum readable -- without it the model cannot
        # tell "these players project low" from "only four players got a line posted".
        D["pp_line_share"] = D["pp_line_sum"] / D["t60_total_point"]
        D["pp_proj_share"] = D["pp_proj_sum"] / D["t60_total_point"]
        print(f"[frame] props joined on {int(D['pp_n'].notna().sum()):,} games", flush=True)

    # phase. gp is the standings games-played; season_frac backs it up when standings missed.
    gp = D.get("st_h_gp")
    gp = pd.Series(np.nan, index=D.index) if gp is None else pd.to_numeric(gp, errors="coerce")
    gp = gp.fillna(pd.to_numeric(D.get("h_gp"), errors="coerce"))
    # the column is game.postseason, not postseason -- getting this wrong silently produced a
    # run with no POST phase at all
    post = D.get("game.postseason")
    post = (pd.Series(0, index=D.index) if post is None
            else pd.to_numeric(post.astype(float), errors="coerce").fillna(0))
    D["phase"] = np.where(post > 0, "POST",
                  np.where(gp < 20, "EARLY",
                   np.where(gp < 50, "MID", np.where(gp >= 50, "LATE", "UNK"))))
    print("[frame] phases:", D["phase"].value_counts().to_dict(), flush=True)
    return D


# ---------------------------------------------------------------------------- leak guard
def leak_screen(D, cols, tol=0.10):
    """Drop features that know the RESULT better than they know the LINE.

    The principle: any real pregame driver of scoring is already priced, so it must correlate
    with the closing total at least as strongly as with the final score. A column that
    correlates +0.55 with the result and +0.05 with the line has not found an inefficiency --
    it has seen the box score.

    This exists because two families in this very file were leaking on the first run
    (style_nba's bare columns, player_team_agg's orc_ columns) and both would have been
    reported as the study's headline finding. A screen that runs every time is worth more than
    remembering not to make the mistake again.
    """
    y, line = D["y_fg_total"], D["t60_total_point"]
    bad = []
    for c in cols:
        x = pd.to_numeric(D[c], errors="coerce")
        m = x.notna() & y.notna() & line.notna()
        if m.sum() < 500 or x[m].nunique() < 5:
            continue
        a = abs(np.corrcoef(x[m], y[m])[0, 1])
        b = abs(np.corrcoef(x[m], line[m])[0, 1])
        if a - b > tol:
            bad.append((c, a, b))
    if bad:
        bad.sort(key=lambda t: -(t[1] - t[2]))
        print(f"[LEAK] dropping {len(bad)} cols that track the result over the line:", flush=True)
        for c, a, b in bad[:15]:
            print(f"        {c:34s} |corr result|={a:.3f} vs |corr line|={b:.3f}", flush=True)
    return {c for c, _, _ in bad}


# ---------------------------------------------------------------------------- families
def families(D):
    C = [c for c in D.columns if pd.api.types.is_numeric_dtype(D[c])]

    def pick(*preds):
        return sorted({c for c in C if any(p(c) for p in preds)})

    # Only the outcome family is banned. t24_/t4_ are the 24-hour and 4-hour snapshots, both
    # strictly EARLIER than the T-60 line we bet -- verified by |t24-t60| = 2.19 and
    # |t4-t60| = 0.59, i.e. they converge toward t60, so the order is open -> t24 -> t4 -> t60.
    # They are legal pregame information, not look-ahead.
    ban = ("y_",)
    F = {
        "market":    pick(lambda c: c.startswith(("open_", "t60_", "t24_", "t4_", "mkt_"))),
        # The market's OWN decomposition of the full-game total: the first-half total and the
        # two team totals. tt_h + tt_a correlates 0.989 with the full-game line, so the value
        # is not the level -- it is the asymmetry and the half/full split, which say how the
        # book expects the points to be distributed. 72% coverage (3 of 4 seasons).
        "deriv_mkt": pick(lambda c: c.startswith(("h1_", "tt_"))),
        "box_form":  pick(lambda c: any(c.startswith(f"{s}_{w}_") for s in "ha" for w in
                                        ("s2d", "l3", "l5", "l10", "sd"))
                          or any(c.startswith(f"{s}_{w}_") for s in ("d", "sum") for w in
                                 ("s2d", "l3", "l5", "l10", "sd"))),
        "streaks":   pick(lambda c: "_strk_" in c),
        "style":     pick(lambda c: c.startswith(("sty_", "h_s_", "a_s_", "d_s_", "sum_s_"))),
        "absence":   pick(lambda c: "_abs_" in c),
        "schedule":  pick(lambda c: "_sched" in c or "_form" in c),
        "standings": pick(lambda c: c.startswith("st_")),
        "regress":   pick(lambda c: c.startswith("reg_")),
        "player_ag": pick(lambda c: c.startswith("pl_")),
        "props":     pick(lambda c: c.startswith("pp_")),
        # Opponent-adjusted ratings and the home/away splits. These are the closest thing in
        # the frame to what production actually feeds its total model, so they need their own
        # row rather than being lumped into box_form.
        "ratings":   pick(lambda c: any(c.startswith(f"{s}_adj_") for s in
                                        ("h", "a", "d", "sum"))),
        "ha_splits": pick(lambda c: any(c.startswith(f"{s}_{w}_") for s in ("h", "a", "d", "sum")
                                        for w in ("home", "away"))
                          or c in ("h_gp", "a_gp", "d_gp", "sum_gp")),
    }
    # The market family is exempt: t60_total_point IS the line, so of course it correlates
    # with itself. Everything else has to pass.
    cand = sorted({c for k, v in F.items() if k not in ("market", "deriv_mkt") for c in v})
    leaks = leak_screen(D, [c for c in cand if not c.startswith(ban)])

    seen = set()
    for k in list(F):
        F[k] = [c for c in F[k] if not c.startswith(ban) and c not in seen and c not in leaks
                and D[c].notna().mean() > 0.30]
        seen |= set(F[k])
        if not F[k]:
            del F[k]

    # A column that belongs to no family is a column no ablation can ever speak about. Say so
    # out loud instead of letting it vanish -- that silence is exactly how the current
    # production model ended up unexamined.
    orphan = [c for c in C if c not in seen and not c.startswith(ban)
              and D[c].notna().mean() > 0.30
              and c not in ("season", "game.id", "event_id", "bdl_game_id")]
    if orphan:
        print(f"[families] {len(orphan)} numeric cols in no family: {orphan[:20]}", flush=True)
    return F


# ---------------------------------------------------------------------------- grading
def walk(X, dates, y, seeds=(BASE_SEED,), refit=REFIT_DAYS, kinds=("lgbm", "hgb")):
    """Rolling-origin refit. Returns mean P(over) across seeds and classifier types.

    The ablation blocks run one seed / one classifier on a slower refit cadence: 28 ablation
    runs at full settings is ~90 minutes, and the ablation only has to RANK families, not
    produce the final number. The phase table at the end runs the full ensemble.
    """
    P = pd.DataFrame(index=X.index)
    idx = pd.DatetimeIndex(dates)
    starts = sorted({d for d in pd.date_range(idx.min(), idx.max(), freq=f"{refit}D")
                     if (idx < d).sum() >= MIN_TRAIN})
    for i, d0 in enumerate(starts):
        d1 = starts[i + 1] if i + 1 < len(starts) else idx.max() + pd.Timedelta(days=1)
        tr = X.index[(idx < d0) & y.notna()]
        te = X.index[(idx >= d0) & (idx < d1)]
        if len(te) == 0 or len(tr) < MIN_TRAIN:
            continue
        for s in seeds:
            for nm, m in [(k, v) for k, v in (
                ("lgbm", lgb.LGBMClassifier(n_estimators=300, learning_rate=0.03,
                                            num_leaves=8, min_child_samples=30,
                                            subsample=0.8, subsample_freq=1,
                                            colsample_bytree=0.6, reg_lambda=3.0,
                                            random_state=s, verbose=-1, n_jobs=2)),
                ("hgb", HistGradientBoostingClassifier(max_iter=250, learning_rate=0.03,
                                                       max_leaf_nodes=8, min_samples_leaf=30,
                                                       l2_regularization=3.0,
                                                       random_state=s)),
            ) if k in kinds]:
                m.fit(X.loc[tr], y.loc[tr])
                P.loc[te, f"{nm}{s}"] = m.predict_proba(X.loc[te])[:, 1]
    return P.mean(axis=1)


def to_dec(a):
    """Odds -> decimal, tolerating either convention.

    nba_model_features stores DECIMAL already (t60 total prices sit at 1.909 = -110). Running
    them through an American converter turns 1.909 into 1.019 and reports -53% ROI on a 45.6%
    win rate, which is arithmetically impossible at -110 and is how this got caught. The
    |a| >= 100 test is unambiguous: no decimal price reaches 100, no American price sits
    inside it.
    """
    a = pd.to_numeric(a, errors="coerce")
    am = a.abs() >= 100
    return np.where(am, np.where(a < 0, 1 + 100.0 / a.abs().clip(lower=1e-9), 1 + a / 100.0), a)


def cut(prob, y, po, pu, pct, mask=None):
    """Win% and ROI at a confidence cut, plus the blind baseline INSIDE the same rows."""
    ok = prob.notna() & y.notna()
    if mask is not None:
        ok = ok & mask
    if ok.sum() < 30:
        return dict(n=0, win=np.nan, base=np.nan, roi=np.nan)
    conf = (prob - 0.5).abs()
    thr = conf[ok].quantile(1 - pct / 100) if pct < 100 else -1
    m = ok & (conf >= thr)
    side = prob[m] > 0.5                       # True = model says OVER
    win = np.where(side, y[m], 1 - y[m])
    dec = np.where(side, po[m], pu[m])
    # the best blind side in exactly these rows -- always over 50, usually ~51
    base = max(y[m].mean(), 1 - y[m].mean())
    return dict(n=int(m.sum()), win=100 * win.mean(), base=100 * base,
                roi=100 * (win * (dec - 1) - (1 - win)).mean())


def main():
    D = build()
    F = families(D)
    print("[families] " + " ".join(f"{k}={len(v)}" for k, v in F.items()), flush=True)

    y = pd.Series(np.where(D["y_fg_tot_resid"] > 0, 1.0,
                           np.where(D["y_fg_tot_resid"] < 0, 0.0, np.nan)), index=D.index)
    po = pd.Series(to_dec(D["t60_total_over_price"]), index=D.index)
    pu = pd.Series(to_dec(D["t60_total_under_price"]), index=D.index)
    assert po.between(1.5, 3.0).mean() > 0.95, f"over prices not decimal: {po.describe()}"
    dates = D["date"]
    PHASES = ["EARLY", "MID", "LATE", "POST"]

    L = ["# NBA full-game total — feature-family ablation", "",
         f"{int(y.notna().sum()):,} gradeable games, seasons {sorted(D['season'].unique())}. "
         f"Target is the residual vs the T-60 close, so the model is trained on the thing we "
         f"actually bet, not on the total. Overs hit {100*y.mean():.1f}%, so blind UNDER is "
         f"{100*max(y.mean(),1-y.mean()):.1f}% and that is the bar, not 50%. "
         f"Breakeven at -110 is 52.4%.", ""]

    def block(title, runs, refit=56, kinds=("lgbm",)):
        rows = [f"\n## {title}\n",
                "| feature set | cols | top100% n/win/base | top25% n/win/base/ROI | "
                "top10% win/ROI |", "|---|---|---|---|---|"]
        for nm, cols in runs:
            X = D[cols].astype(float)
            X = X.loc[:, X.notna().mean() > 0.30]
            if X.shape[1] == 0:
                continue
            prob = walk(X, dates, y, refit=refit, kinds=kinds)
            a, b, c = (cut(prob, y, po, pu, 100), cut(prob, y, po, pu, 25),
                       cut(prob, y, po, pu, 10))
            rows.append(f"| {nm} | {X.shape[1]} | {a['n']} / {a['win']:.1f} / {a['base']:.1f} "
                        f"| {b['n']} / {b['win']:.1f} / {b['base']:.1f} / {b['roi']:+.1f} "
                        f"| {c['win']:.1f} / {c['roi']:+.1f} |")
            print(rows[-1], flush=True)
        return rows

    # ---- 1 each family ALONE -----------------------------------------------------------
    L += block("Each family alone", [(k, v) for k, v in F.items()])

    # ---- 2 full set, then full-minus-one ------------------------------------------------
    allc = sorted({c for v in F.values() for c in v})
    runs = [("ALL", allc)]
    for k in F:
        runs.append((f"ALL minus {k}", [c for c in allc if c not in set(F[k])]))
    L += block("Leave-one-out — a family that HELPS makes this row worse when removed", runs)

    # ---- 3 the production-style feature set, for reference -------------------------------
    prod = [c for c in F.get("box_form", []) if any(t in c for t in
            ("ortg", "drtg", "pace", "efg", "total", "own_score", "opp_score"))]
    L += block("Reference: production-style team-box-only set", [("box subset (prod-like)", prod)])

    # ---- 4 phases on the full set --------------------------------------------------------
    X = D[allc].astype(float)
    X = X.loc[:, X.notna().mean() > 0.30]
    prob = walk(X, dates, y, seeds=(0, 7, 13))
    L += ["\n## Full set by phase (3 seeds)\n",
          "| phase | cut | n | win% | base% | edge | ROI |", "|---|---|---|---|---|---|---|"]
    for ph in PHASES + ["ALL"]:
        mk = None if ph == "ALL" else (D["phase"] == ph)
        for pct in (100, 25, 10):
            g = cut(prob, y, po, pu, pct, mask=mk)
            if g["n"] == 0:
                continue
            L.append(f"| {ph} | top{pct}% | {g['n']} | {g['win']:.1f} | {g['base']:.1f} | "
                     f"**{g['win']-g['base']:+.1f}** | {g['roi']:+.1f} |")
            print(L[-1], flush=True)

    # ---- 5 does it beat the line at all? -------------------------------------------------
    r = D["y_fg_tot_resid"]
    L += ["\n## Correlation check (the number production fails)\n",
          f"- model P(over) vs actual residual: **{np.corrcoef(prob[prob.notna() & r.notna()], r[prob.notna() & r.notna()])[0,1]:+.3f}**",
          "- production `model_fair_total` vs the same kind of residual, graded on live data: **-0.017**", ""]

    path = os.path.join(ROOT, "NBA_TOTAL_LAB.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print(f"\nwrote {path}", flush=True)


if __name__ == "__main__":
    main()
