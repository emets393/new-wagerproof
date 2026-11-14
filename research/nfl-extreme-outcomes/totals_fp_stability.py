#!/usr/bin/env python3
"""Is the FP-only totals result a real edge or the best of 12 cells I looked at?

The ablation gave FP-only 53.3% / +1.7% at |edge| >= 3 (n=398). That was the best of twelve
(family x threshold) cells inspected, so it is a CANDIDATE, not a finding. Three tests it has to
survive, each of which has killed a candidate in this repo before:

  1. PER-SEASON stability. A pooled number that lives in one season is noise.
  2. A PLACEBO: the same pipeline on SHUFFLED targets must land at ~50%. If shuffled data also
     "finds" 53%, the harness is manufacturing it.
  3. MONOTONICITY in |edge|. A real edge should strengthen, not wander.
"""
import warnings
warnings.filterwarnings("ignore")
import numpy as np, pandas as pd

P = pd.read_csv("out/totals_ablate_both.csv")  # written by the BOTH family; rebuild FP below
print("rebuilding the FP-only predictions for the stability tests ...")
