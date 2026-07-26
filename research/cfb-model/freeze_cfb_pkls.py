"""Pre-season freeze of the CFB model pkls (cfb_models_<season>.pkl + cfb_confirm_<season>.pkl).

cfb_forecast.build_season() can't freeze pre-season: after fit+dump it predicts on the target
slate, and sklearn raises on 0 rows (no <season> games exist yet). Training only needs
season<target, so we fit+dump here directly. Render's filesystem is ephemeral, so the frozen
pkls must be committed to git (a pkl fit on Render would be lost on the next cron container).

⚠ Hyperparams + train filters MIRROR cfb_forecast.build_season — keep in sync if the model changes.
Usage: python3 freeze_cfb_pkls.py [season]        # default 2026
"""
import os
import sys
import joblib
from sklearn.ensemble import HistGradientBoostingRegressor, HistGradientBoostingClassifier

import cfb_forecast as cf   # module-level load()/OUT; main() is __main__-guarded so import is safe

SEASON = int(sys.argv[1]) if len(sys.argv) > 1 else 2026

gm, feats, nets = cf.load()
sfeats = feats + nets

# totals + sides (mirror cfb_forecast.py:226-238)
tr = gm[(gm.season < SEASON) & gm.actual_total.notna()]
tm = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4,
                                   l2_regularization=1.0, random_state=0).fit(tr[feats], tr.actual_total)
sm = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_depth=4,
                                   l2_regularization=1.0, random_state=0).fit(tr[sfeats], tr.actual_margin)
joblib.dump((tm, sm), os.path.join(cf.OUT, f"cfb_models_{SEASON}.pkl"))

# confirm classifier for the MAMMOTH gate (mirror cfb_forecast.py:295-298)
trc = gm[(gm.season < SEASON) & gm.spread_close.notna() & gm.actual_margin.notna()]
trc = trc[(trc.actual_margin + trc.spread_close) != 0]
cc = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, max_depth=4,
                                    l2_regularization=1.0, random_state=0).fit(trc[feats], (trc.actual_margin + trc.spread_close) > 0)
joblib.dump(cc, os.path.join(cf.OUT, f"cfb_confirm_{SEASON}.pkl"))

print(f"[freeze] cfb_models_{SEASON}.pkl + cfb_confirm_{SEASON}.pkl "
      f"(trained on season<{SEASON}: {len(tr)} totals rows / {len(trc)} confirm rows)")
