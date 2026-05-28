"""
Value of REST in points, three ways:
  (1) TRUE value   — effect of net rest on actual margin, controlling for team strength (PR).
  (2) MARKET value — how many points the closing spread already moves per rest day.
  (3) EDGE         — effect of net rest on margin BEYOND the line (does rest beat the number?).
Then spot-specific values (off bye, short week, mini-bye) and a totals check.
Directly tests the article's claim that the market ignores rest.
"""
import os, sys
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
m = pd.read_parquet(os.path.join(DATA, "master.parquet"))
L = print

m["rest_diff"] = m["home_rest"] - m["away_rest"]
m["pr_diff"] = m["home_predictive_pr"] - m["away_predictive_pr"]
m["mkt_margin"] = -m["home_spread"]               # market-expected home margin
m["abs_rest"] = m["rest_diff"].abs()


def ols(y, Xcols, data, names=None):
    """OLS with analytic SEs. Returns DataFrame of coef, se, t, 95% CI."""
    d = data.dropna(subset=[y] + Xcols)
    X = np.column_stack([np.ones(len(d))] + [d[c].values for c in Xcols])
    yv = d[y].values
    XtX_inv = np.linalg.inv(X.T @ X)
    beta = XtX_inv @ X.T @ yv
    resid = yv - X @ beta
    s2 = (resid @ resid) / (len(d) - X.shape[1])
    se = np.sqrt(np.diag(s2 * XtX_inv))
    nm = ["const"] + (names or Xcols)
    out = pd.DataFrame({"term": nm, "coef": beta, "se": se})
    out["t"] = out["coef"] / out["se"]
    out["lo"] = out["coef"] - 1.96 * out["se"]
    out["hi"] = out["coef"] + 1.96 * out["se"]
    out["n"] = len(d)
    return out


def show(title, res):
    L(f"\n  {title}")
    for _, r in res.iterrows():
        L(f"    {r.term:12s} coef={r.coef:+6.3f} ± {r.se:.3f}  95%CI[{r.lo:+.3f},{r.hi:+.3f}]  t={r.t:+.1f}")
    L(f"    (n={int(res['n'].iloc[0])})")


L("="*90); L("REST VALUE IN POINTS — three estimands"); L("="*90)
L("  rest_diff = home_rest - away_rest (positive = home better rested)")

show("(1) TRUE value: actual_margin ~ rest_diff + pr_diff  [const=HFA]",
     ols("actual_margin", ["rest_diff", "pr_diff"], m))
show("(2) MARKET value: mkt_margin (-home_spread) ~ rest_diff + pr_diff",
     ols("mkt_margin", ["rest_diff", "pr_diff"], m))
show("(3) EDGE: spread_diff (margin - line) ~ rest_diff + pr_diff",
     ols("spread_diff", ["rest_diff", "pr_diff"], m))

L("\n  Interpretation: if (1)~(2), the market prices rest correctly and (3)~0 (no edge).")

# also raw (uncontrolled) true value for reference
show("(0) RAW (uncontrolled): actual_margin ~ rest_diff",
     ols("actual_margin", ["rest_diff"], m))

# ---------------- spot-specific point values ----------------
L("\n"+"="*90); L("SPOT-SPECIFIC point values (indicator vs market, controlling for PR)"); L("="*90)
m["home_off_bye"] = (m["home_rest"] >= 13).astype(int)
m["away_off_bye"] = (m["away_rest"] >= 13).astype(int)
m["home_short"] = (m["home_rest"] <= 4).astype(int)
m["away_short"] = (m["away_rest"] <= 4).astype(int)
m["bye_edge"] = m["home_off_bye"] - m["away_off_bye"]     # +1 home off bye, -1 away off bye
show("margin ~ bye_edge + short_edge + pr_diff (TRUE points of a bye/short spot)",
     ols("actual_margin", ["home_off_bye", "away_off_bye", "home_short", "away_short", "pr_diff"], m,
         names=["home_off_bye", "away_off_bye", "home_short", "away_short", "pr_diff"]))
show("spread_diff ~ same (EDGE: do these spots beat the line?)",
     ols("spread_diff", ["home_off_bye", "away_off_bye", "home_short", "away_short", "pr_diff"], m,
         names=["home_off_bye", "away_off_bye", "home_short", "away_short", "pr_diff"]))

# ---------------- ATS exploitability by rest bucket, per season ----------------
L("\n"+"="*90); L("EDGE check — ATS cover of the BETTER-RESTED side, per season"); L("="*90)
m["ats_home"] = np.where(m["spread_diff"] > 0, 1.0, np.where(m["spread_diff"] < 0, 0.0, np.nan))
for lab, lo in [("rest edge >=3 days", 3), ("rest edge >=6 days", 6)]:
    sub = m[m["abs_rest"] >= lo].copy()
    # bet the better-rested side
    bet_home = sub["rest_diff"] > 0
    won = np.where(bet_home, sub["ats_home"], 1 - sub["ats_home"])
    ws = pd.Series(won, index=sub.index).dropna()
    L(f"\n  back better-rested side, {lab} (n={int(ws.isin([0,1]).sum())}):")
    for s in sorted(sub["season"].unique()):
        ss = sub[sub["season"] == s]; bb = (ss["rest_diff"] > 0)
        w = pd.Series(np.where(bb, ss["ats_home"], 1 - ss["ats_home"]), index=ss.index).dropna()
        k = int((w == 1).sum()); n = int(w.isin([0, 1]).sum())
        L("    " + fmt(bet_summary(k, n, str(int(s)))))
    k = int((ws == 1).sum()); n = int(ws.isin([0, 1]).sum())
    L("    " + fmt(bet_summary(k, n, "ALL")))

# ---------------- totals: does rest affect total points? ----------------
L("\n"+"="*90); L("TOTALS — does rest affect total points (beyond the line)?"); L("="*90)
m["max_rest"] = m[["home_rest", "away_rest"]].max(axis=1)
m["min_rest"] = m[["home_rest", "away_rest"]].min(axis=1)
show("actual_total ~ abs_rest + max_rest + ou_vegas_line",
     ols("actual_total", ["abs_rest", "max_rest", "ou_vegas_line"], m,
         names=["abs_rest", "max_rest", "ou_line"]))
show("total_diff (total - line) ~ abs_rest + max_rest (EDGE on totals)",
     ols("total_diff", ["abs_rest", "max_rest"], m, names=["abs_rest", "max_rest"]))
