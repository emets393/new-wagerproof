#!/usr/bin/env python3
"""Fast priority pass: the DERIVATIVE markets only, boosters only.

The full zoo (nba_model.py) sweeps everything but takes hours, and its slow models
(LassoCV/ElasticNetCV/RF/ET/MLP) have already shown nothing on the full-game spread.
The thesis lives in the 1H and team-total markets — this runs those first with the
NaN-native boosters so we get the answer that matters without waiting on the sweep.

Same harness, same walk-forward, same T-60 grading — only the model list is trimmed.
"""
import os

import numpy as np
import pandas as pd

import nba_model as NM

ROOT = os.path.dirname(os.path.abspath(__file__))

FAST_REG = ("ridge", "hgb", "lgbm", "xgb", "cat")
FAST_CLF = ("lgbm_clf", "hgb_clf")

_reg, _clf = NM.model_zoo, NM.clf_zoo
NM.model_zoo = lambda seed=0: {k: v for k, v in _reg(seed).items() if k in FAST_REG}
NM.clf_zoo = lambda seed=0: {k: v for k, v in _clf(seed).items() if k in FAST_CLF}
NM.CLF_NAMES = set(FAST_CLF)

PRIORITY = ["h1_spread", "h1_total", "tt_home", "tt_away"]


def main():
    D = pd.read_parquet(f"{NM.OUT}/nba_model_features.parquet")
    logf = open(os.path.join(ROOT, "nba_model_fast.log"), "w")

    def log(s):
        print(s, flush=True)
        logf.write(s + "\n")
        logf.flush()

    out = []
    for name in PRIORITY:
        cfg = NM.MARKETS[name]
        for v in (["raw", "anchored"] + (["share"] if name == "h1_total" else [])):
            log(f"\n=== {name} / {v}")
            r = NM.run_market(D, name, cfg, v, log)
            out += r
            for row in r:
                if row["top"] in ("top100%", "top25%", "top10%"):
                    log(f"  {row['model']:9s} {row['top']:7s} n={row['n']:5d} "
                        f"win={row['win']:.1f} roi={row['roi']:+.1f} "
                        f"corr={row['corr']:+.3f} mae={row['mae_model']:.2f}/"
                        f"{row['mae_mkt']:.2f} per={row['per']}")
            pd.DataFrame(out).to_csv(os.path.join(ROOT, "nba_model_fast_results.csv"), index=False)

    log(f"\nwrote nba_model_fast_results.csv ({len(out)} rows)")
    logf.close()


if __name__ == "__main__":
    main()
