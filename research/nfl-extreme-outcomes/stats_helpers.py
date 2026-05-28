"""
Rigor helpers: every cut reports n, hit rate, ROI, 95% CI.
Breakeven at -110 = 52.38%. For ML use price-implied breakeven.
"""
import numpy as np
import pandas as pd


def wilson_ci(k, n, z=1.96):
    """Wilson score interval for a proportion (better than normal approx on small n)."""
    if n == 0:
        return (np.nan, np.nan)
    p = k / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = (z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / denom
    return (centre - half, centre + half)


def bet_summary(wins, n, label="", price=-110, pushes=0):
    """
    Summary for a straight bet at a fixed American price.
    wins/n exclude pushes. ROI assumes 1u stake per bet (pushes return stake).
    """
    if n == 0:
        return {"label": label, "n": 0}
    dec = (100 / abs(price)) if price < 0 else (price / 100)  # profit per 1u on win
    hit = wins / n
    profit = wins * dec - (n - wins) * 1.0           # pushes excluded from n
    staked = n + pushes
    roi = profit / staked if staked else np.nan
    lo, hi = wilson_ci(wins, n)
    be = abs(price) / (abs(price) + 100) if price < 0 else 100 / (price + 100)
    return {
        "label": label, "n": int(n), "pushes": int(pushes),
        "hit": round(hit, 4), "ci95": (round(lo, 4), round(hi, 4)),
        "breakeven": round(be, 4), "edge_vs_be": round(hit - be, 4),
        "roi": round(roi, 4), "units": round(profit, 2), "price": price,
    }


def ml_roi(df, side_won_col, price_col):
    """ROI for moneyline bets where price varies per row. price American."""
    d = df.dropna(subset=[price_col]).copy()
    if len(d) == 0:
        return {"n": 0}
    dec = np.where(d[price_col] < 0, 100 / d[price_col].abs(), d[price_col] / 100)
    win = d[side_won_col].astype(float).values
    profit = np.where(win == 1, dec, -1.0)
    n = len(d); k = int(win.sum())
    lo, hi = wilson_ci(k, n)
    # price-implied breakeven (avg)
    implied = np.where(d[price_col] < 0, d[price_col].abs() / (d[price_col].abs() + 100),
                       100 / (d[price_col] + 100))
    return {"n": n, "wins": k, "hit": round(k / n, 4), "ci95": (round(lo, 4), round(hi, 4)),
            "avg_implied_be": round(float(implied.mean()), 4),
            "roi": round(float(profit.sum() / n), 4), "units": round(float(profit.sum()), 2)}


def per_season(df, season_col, mask, outcome_col, price=-110):
    """Replicate a bet rule per season. outcome_col is 1=win 0=loss (NaN=push/exclude)."""
    rows = []
    sub = df[mask]
    for s in sorted(sub[season_col].dropna().unique()):
        ss = sub[sub[season_col] == s]
        oc = ss[outcome_col].dropna()
        wins = int((oc == 1).sum()); n = int((oc.isin([0, 1])).sum())
        pushes = int((ss[outcome_col].isna() | (ss[outcome_col] == 0.5)).sum()) if False else 0
        r = bet_summary(wins, n, label=str(int(s)), price=price)
        rows.append(r)
    # all
    oc = sub[outcome_col].dropna()
    wins = int((oc == 1).sum()); n = int((oc.isin([0, 1])).sum())
    rows.append(bet_summary(wins, n, label="ALL", price=price))
    return pd.DataFrame(rows)


def cohen_d(a, b):
    a = pd.Series(a).dropna(); b = pd.Series(b).dropna()
    na, nb = len(a), len(b)
    if na < 2 or nb < 2:
        return np.nan
    sp = np.sqrt(((na - 1) * a.var(ddof=1) + (nb - 1) * b.var(ddof=1)) / (na + nb - 2))
    return (a.mean() - b.mean()) / sp if sp else np.nan


def fmt(d):
    """One-line print of a bet_summary dict."""
    if d.get("n", 0) == 0:
        return f"{d.get('label','')}: n=0"
    return (f"{d['label']}: n={d['n']} hit={d['hit']:.3f} "
            f"CI[{d['ci95'][0]:.3f},{d['ci95'][1]:.3f}] "
            f"roi={d['roi']*100:+.1f}% edge={d['edge_vs_be']*100:+.1f}pp")
