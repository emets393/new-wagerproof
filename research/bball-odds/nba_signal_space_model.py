#!/usr/bin/env python3
"""Model in SIGNAL SPACE, not in box-score space.

Everything so far says the same thing from three directions:
  * no algorithm beat the closing line's MAE in any market or framing
  * model agreement adds nothing to S7/S8
  * the model's edge is 48-50% even INSIDE the populations we have proven are mispriced

That last one is the diagnosis, not just another negative. S7 fires on 106 of 3,173
games (3.3%) and is a CONJUNCTION — both teams, same direction, run >= 3. A booster with
min_child_samples=40 searching ~980 mostly-noise columns on ~2,500 rows will never
isolate a cell that small; it would have to discover the conjunction and the threshold
and the both-teams symmetry simultaneously, from marginal splits, under vig-level noise.
S7 was found because a human wrote the conjunction down and tested it.

So stop asking the model to rediscover the vocabulary. Hand it the vocabulary and ask
it to find the GRAMMAR — combinations of known-meaningful primitives that no one has
tried by hand. ~60 engineered features instead of 980, every one of them something a
person would recognise as a betting concept, with the conjunctions pre-formed.

This is the one modelling framing left that has a real mechanism behind it. If it also
comes back at 50%, the answer for the NBA is that the tradeable structure is exactly the
handful of rules we already have, and a model is not the tool.

Two markets, because the two validated signals live in different ones:
  1H total  (S7's market)   -> classify OVER/UNDER vs the T-60 1H line
  1H spread (S8's market)   -> classify HOME/AWAY cover vs the T-60 1H line
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.tree import DecisionTreeClassifier, export_text
import lightgbm as lgb
import xgboost as xgb

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")
SEEDS = (0, 7, 13)


def signal_space(G):
    """~60 features, every one a betting concept. Conjunctions pre-formed, because the
    model cannot invent them from marginal splits on this sample size."""
    S = pd.DataFrame(index=G.index)

    # ---- streak primitives (signed run length; + = overs/covers)
    for m in ("h1ou", "h1ats", "ou", "ats"):
        hr, ar = G.get(f"h_strk_{m}_run"), G.get(f"a_strk_{m}_run")
        if hr is None:
            continue
        S[f"{m}_h_run"], S[f"{m}_a_run"] = hr, ar
        # the S7 shape: both teams riding the SAME direction, and how deep
        same = np.sign(hr) == np.sign(ar)
        S[f"{m}_same_dir"] = same.astype(float) * np.sign(hr)
        S[f"{m}_shared_depth"] = np.where(same, np.minimum(hr.abs(), ar.abs()), 0.0)
        S[f"{m}_shared_signed"] = S[f"{m}_shared_depth"] * np.sign(hr)
        S[f"{m}_opposed"] = ((np.sign(hr) != np.sign(ar))
                             & (hr.abs() >= 2) & (ar.abs() >= 2)).astype(float)
        S[f"{m}_run_sum"], S[f"{m}_run_absdiff"] = hr + ar, (hr - ar).abs()
        # season-rate cross (both hot / both cold), the record version of the same idea
        hp, ap = G.get(f"h_strk_{m}_pct"), G.get(f"a_strk_{m}_pct")
        if hp is not None:
            S[f"{m}_pct_sum"], S[f"{m}_pct_diff"] = hp + ap, hp - ap
            S[f"{m}_both_hi"] = ((hp >= .55) & (ap >= .55)).astype(float)
            S[f"{m}_both_lo"] = ((hp <= .45) & (ap <= .45)).astype(float)

    # ---- availability primitives (the S8 vocabulary)
    hf, af = G["h_abs_fresh_max_ppg"], G["a_abs_fresh_max_ppg"]
    S["abs_h_fresh_max"], S["abs_a_fresh_max"] = hf, af
    S["abs_fresh_max_diff"] = hf.fillna(0) - af.fillna(0)
    S["abs_h_fresh_sum"] = G["h_abs_fresh_sum_ppg"]
    S["abs_a_fresh_sum"] = G["a_abs_fresh_sum_ppg"]
    S["abs_fresh_sum_total"] = G["h_abs_fresh_sum_ppg"].fillna(0) + G["a_abs_fresh_sum_ppg"].fillna(0)
    S["abs_h_stale_sum"], S["abs_a_stale_sum"] = G["h_abs_stale_sum_ppg"], G["a_abs_stale_sum_ppg"]
    S["abs_h_ret_sum"], S["abs_a_ret_sum"] = G["h_abs_ret_sum_ppg"], G["a_abs_ret_sum_ppg"]
    S["abs_h_top1_out"], S["abs_a_top1_out"] = G["h_abs_top1_out"], G["a_abs_top1_out"]
    S["abs_h_big_out"], S["abs_a_big_out"] = G["h_abs_big_out"], G["a_abs_big_out"]
    S["abs_h_guard_out"], S["abs_a_guard_out"] = G["h_abs_guard_out"], G["a_abs_guard_out"]
    # the S8 conjunction: one side moderately depleted, the other essentially clean
    S["abs_h_mod_only"] = ((hf >= 18) & (hf < 25) & (af < 18)).astype(float)
    S["abs_a_mod_only"] = ((af >= 18) & (af < 25) & (hf < 18)).astype(float)
    S["abs_h_sev_only"] = ((hf >= 25) & (af < 18)).astype(float)
    S["abs_a_sev_only"] = ((af >= 25) & (hf < 18)).astype(float)
    S["abs_both_out"] = ((hf >= 18) & (af >= 18)).astype(float)
    S["abs_none"] = ((hf.fillna(0) < 8) & (af.fillna(0) < 8)).astype(float)

    # ---- market context (the derivative ratios are the mechanism we are attacking)
    S["mk_spread"] = G["t60_spread_home_point"]
    S["mk_abs_spread"] = G["t60_spread_home_point"].abs()
    S["mk_close_game"] = (G["t60_spread_home_point"].abs() < 8).astype(float)
    S["mk_total"] = G["t60_total_point"]
    S["mk_h1_tot_ratio"] = G["mkt_h1_tot_ratio"]
    S["mk_h1_sp_ratio"] = G["mkt_h1_sp_ratio"]
    S["mk_tt_gap"] = G["mkt_tt_gap"]
    S["mk_move_spread"] = G["mkt_spread_move_open_t60"]
    S["mk_move_total"] = G["mkt_total_move_open_t60"]

    # ---- schedule / fatigue
    S["sch_h_rest"], S["sch_a_rest"] = G["h_sched_rest"], G["a_sched_rest"]
    S["sch_rest_diff"] = G["h_sched_rest"] - G["a_sched_rest"]
    S["sch_h_b2b"], S["sch_a_b2b"] = G["h_sched_b2b"], G["a_sched_b2b"]
    S["sch_both_b2b"] = (G["h_sched_b2b"].fillna(0) * G["a_sched_b2b"].fillna(0))
    S["sch_h_3in4"], S["sch_a_3in4"] = G["h_sched_3in4"], G["a_sched_3in4"]

    # ---- team quality / form / pace, the few that carry real information
    for c in ("adj_net", "adj_off", "adj_def", "adj_tempo_pts"):
        if f"d_{c}" in G:
            S[f"q_d_{c}"], S[f"q_sum_{c}"] = G[f"d_{c}"], G[f"sum_{c}"]
    for c in ("form_margin", "form_total", "form_adv_pace", "form_h1_tot_share"):
        if f"d_{c}" in G:
            S[f"f_d_{c}"], S[f"f_sum_{c}"] = G[f"d_{c}"], G[f"sum_{c}"]
    for c in ("s2d_h1_tot_share", "l5_h1_tot_share", "l10_h1_tot_share",
              "s2d_adv_pace", "l5_total", "l10_total", "s_pace", "s_p3a_rate"):
        if f"d_{c}" in G:
            S[f"p_d_{c}"], S[f"p_sum_{c}"] = G[f"d_{c}"], G[f"sum_{c}"]

    S["gp_min"] = np.minimum(G["h_gp"], G["a_gp"])
    return S


def clfs(seed):
    return {
        "lgbm": lgb.LGBMClassifier(n_estimators=300, learning_rate=0.03, num_leaves=8,
                                   min_child_samples=25, subsample=0.8, subsample_freq=1,
                                   colsample_bytree=0.7, reg_lambda=2.0, random_state=seed,
                                   verbose=-1, n_jobs=-1),
        "xgb": xgb.XGBClassifier(n_estimators=300, learning_rate=0.03, max_depth=3,
                                 min_child_weight=15, subsample=0.8, colsample_bytree=0.7,
                                 reg_lambda=2.0, random_state=seed, n_jobs=-1,
                                 tree_method="hist", eval_metric="logloss"),
        "hgb": HistGradientBoostingClassifier(max_iter=250, learning_rate=0.03,
                                              max_leaf_nodes=8, min_samples_leaf=25,
                                              l2_regularization=2.0, random_state=seed),
    }


def walk(S, G, y01, tag, P):
    """Rolling-origin refit every 14 days on the signal space."""
    blocks = G.groupby(pd.Grouper(key="date", freq="14D")).size()
    starts = [d for d in blocks.index if (G["date"] < d).sum() >= 600]
    for i, d0 in enumerate(starts):
        d1 = (starts[i + 1] if i + 1 < len(starts) else G["date"].max() + pd.Timedelta(days=1))
        tri = G.index[(G["date"] < d0) & y01.notna()]
        tei = G.index[(G["date"] >= d0) & (G["date"] < d1)]
        if len(tei) == 0 or len(tri) < 600:
            continue
        for seed in SEEDS:
            for mn, m in clfs(seed).items():
                try:
                    m.fit(S.loc[tri], y01.loc[tri])
                    P.loc[tei, f"{tag}|{mn}|{seed}"] = m.predict_proba(S.loc[tei])[:, 1]
                except Exception as e:                      # noqa: BLE001
                    print(f"  !! {tag}/{mn}/{seed}: {type(e).__name__} {e}", flush=True)


def report(G, y01, prob, po, pu, name, L, seasons):
    """prob > .5 => bet the '1' side (OVER / HOME)."""
    L += [f"\n### {name}\n", "| cut | n | win% | ROI | flat-110 | per-season |",
          "|---|---|---|---|---|---|"]
    conf = (prob - 0.5).abs()
    ok = prob.notna() & y01.notna()
    for pct in (100, 50, 25, 10, 5):
        thr = conf[ok].quantile(1 - pct / 100) if pct < 100 else -1
        m = ok & (conf >= thr)
        n = int(m.sum())
        if n < 20:
            continue
        side = prob[m] > 0.5
        win = np.where(side, y01[m], 1 - y01[m])
        dec = np.where(side, po[m], pu[m])
        roi = 100 * (win * (dec - 1) - (1 - win)).mean()
        rf = 100 * (win * 0.909 - (1 - win)).mean()
        per = []
        for s in seasons:
            mm = m & (G["season"] == s)
            k = int(mm.sum())
            if k >= 25:
                sd = prob[mm] > 0.5
                per.append(f"{100*np.where(sd, y01[mm], 1-y01[mm]).mean():.0f}")
            else:
                per.append("-")
        L.append(f"| top{pct}% | {n} | {100*win.mean():.1f} | {roi:+.1f} | {rf:+.1f} | "
                 f"{'/'.join(per)} |")


def main():
    D = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
    G = D[D[["h1_total_line", "h1_ov", "h1_un", "h1_spread", "h1_sp_h", "h1_sp_a",
             "t60_spread_home_point", "t60_total_point"]].notna().all(axis=1)].copy()
    G["date"] = pd.to_datetime(G["date"])
    G = G.sort_values("date").reset_index(drop=True)
    seasons = sorted(G["season"].unique())

    S = signal_space(G).astype(float)
    print(f"{len(G):,} games x {S.shape[1]} signal features", flush=True)

    rt = G["y_h1_total"] - G["h1_total_line"]
    y_tot = pd.Series(np.where(rt > 0, 1.0, np.where(rt < 0, 0.0, np.nan)), index=G.index)
    rs = G["y_h1_marg_resid"]
    y_sp = pd.Series(np.where(rs > 0, 1.0, np.where(rs < 0, 0.0, np.nan)), index=G.index)

    P = pd.DataFrame(index=G.index)
    print("walking 1H TOTAL...", flush=True)
    walk(S, G, y_tot, "tot", P)
    print("walking 1H SPREAD...", flush=True)
    walk(S, G, y_sp, "spr", P)

    L = ["# NBA model in SIGNAL SPACE", "",
         f"{len(G):,} games with full T-60 1H markets, seasons {seasons}. "
         f"{S.shape[1]} engineered signal features (conjunctions pre-formed). "
         f"Rolling-origin refit every 14D, {len(SEEDS)} seeds x 3 classifiers, "
         "probabilities averaged. Graded at the real T-60 1H price. BE 52.4%.", ""]

    for tag, y01, po, pu, nm in (("tot", y_tot, G["h1_ov"], G["h1_un"], "1H TOTAL (over/under)"),
                                 ("spr", y_sp, G["h1_sp_h"], G["h1_sp_a"], "1H SPREAD (home/away)")):
        cols = [c for c in P.columns if c.startswith(tag + "|")]
        if not cols:
            continue
        L += [f"\n## {nm}"]
        report(G, y01, P[cols].mean(axis=1), po, pu, "ensemble (9 fits)", L, seasons)
        for mn in ("lgbm", "xgb", "hgb"):
            cs = [c for c in cols if f"|{mn}|" in c]
            if cs:
                report(G, y01, P[cs].mean(axis=1), po, pu, f"{mn} (3 seeds)", L, seasons)

    # ---- hypothesis generation: what cells does a shallow tree carve out?
    # IN-SAMPLE and purely for reading, never graded as a result.
    L += ["\n## Shallow-tree cells (IN-SAMPLE, hypothesis generation only — NOT a result)\n"]
    for tag, y01, nm in (("tot", y_tot, "1H total"), ("spr", y_sp, "1H spread")):
        ok = y01.notna()
        t = DecisionTreeClassifier(max_depth=3, min_samples_leaf=120, random_state=0)
        t.fit(S[ok.values].fillna(S[ok.values].median()), y01[ok])
        L += [f"```\n{nm}\n" + export_text(t, feature_names=list(S.columns), max_depth=3) + "```"]

    path = os.path.join(ROOT, "NBA_SIGNAL_SPACE_BRIEF.md")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main()
