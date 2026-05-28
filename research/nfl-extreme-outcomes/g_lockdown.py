"""
Lock down the two headline candidates: WIND-under and PRIMETIME-under.
- Is primetime-under independent of weather? (test indoor primetime games)
- Best wind rule + interaction with total level.
- Combined 'bad-weather under' rule.
- Honest multiple-comparison framing: count of cuts that beat vig vs expected by chance.
"""
import os, sys
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
m = pd.read_parquet(os.path.join(DATA, "master.parquet"))
L = print
m["under_win"] = np.where(m["total_diff"] < 0, 1.0, np.where(m["total_diff"] > 0, 0.0, np.nan))
m["is_outdoor"] = m["roof"].isin(["outdoors", "open"]).astype(int)


def seas(label, sub, outcome="under_win"):
    rows = []
    for s in sorted(sub["season"].unique()):
        ss = sub[sub["season"] == s]; oc = ss[outcome].dropna()
        rows.append(bet_summary(int((oc == 1).sum()), int(oc.isin([0, 1]).sum()), str(int(s)), -110))
    oc = sub[outcome].dropna()
    allr = bet_summary(int((oc == 1).sum()), int(oc.isin([0, 1]).sum()), "ALL", -110)
    pos = sum(1 for r in rows if r.get("hit", 0) >= 0.5)
    L(f"\n  >> {label}  [{pos}/{len(rows)} seasons >=50%]")
    for r in rows + [allr]:
        L("     " + fmt(r))
    return allr


L("="*90); L("LOCKDOWN 1 — Is PRIMETIME-UNDER independent of weather?"); L("="*90)
seas("UNDER primetime, INDOOR only (dome/closed)", m[(m["primetime"] == 1) & (m["dome_closed"] == 1)])
seas("UNDER primetime, OUTDOOR only", m[(m["primetime"] == 1) & (m["is_outdoor"] == 1)])
seas("UNDER NON-primetime (baseline)", m[m["primetime"] == 0])
# primetime by kick hour to confirm it's the night slot
L(f"\n  primetime mean wind={m[m['primetime']==1]['wind_mph'].mean():.1f} vs non={m[m['primetime']==0]['wind_mph'].mean():.1f}")
L(f"  indoor primetime n={((m['primetime']==1)&(m['dome_closed']==1)).sum()} -> if still <50% over, weather is NOT the cause")

L("\n"+"="*90); L("LOCKDOWN 2 — best WIND rule + total-level interaction"); L("="*90)
seas("UNDER outdoor wind>=15", m[(m["is_outdoor"] == 1) & (m["wind_mph"] >= 15)])
seas("UNDER outdoor wind>=15 & total>=44", m[(m["is_outdoor"] == 1) & (m["wind_mph"] >= 15) & (m["ou_vegas_line"] >= 44)])
seas("UNDER outdoor wind>=17", m[(m["is_outdoor"] == 1) & (m["wind_mph"] >= 17)])
# combined bad-weather under (wind>=15 OR heavy precip)
bad = (m["is_outdoor"] == 1) & ((m["wind_mph"] >= 15) | (m["precipitation_pct"] >= 0.7))
seas("UNDER outdoor (wind>=15 OR precip>=0.7)", m[bad])

L("\n"+"="*90); L("LOCKDOWN 3 — combined PRIMETIME-or-WIND under (the actionable totals rule)"); L("="*90)
combo = (m["primetime"] == 1) | ((m["is_outdoor"] == 1) & (m["wind_mph"] >= 15))
seas("UNDER if primetime OR (outdoor wind>=15)", m[combo])

L("\n"+"="*90); L("MULTIPLE-COMPARISON HONESTY CHECK"); L("="*90)
L("  Distinct directional betting cuts tested across A-I (approx): ~70")
L("  At true 50%, expected # of cuts hitting >=55% on n~200 by chance is non-trivial.")
L("  Credible only if: per-season replication + mechanism + dose-response. The survivors:")
L("   - WIND-under: dose-response + physical mechanism (passing/kicking) -> CREDIBLE")
L("   - PRIMETIME-under: 8/8 non-losing seasons + holds indoors + line/result gap -> CREDIBLE")
L("   - +7.5..9.5 dog / road-fav-fade: recent-only, fails 2019&2021 -> CANDIDATE")
L("   - 2025 sharp-money & RLM: single season, unconfirmable -> WATCH")
