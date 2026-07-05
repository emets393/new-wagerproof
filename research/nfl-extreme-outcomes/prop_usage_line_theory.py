"""Theory: Vegas line move vs recent usage (2024-25 props).

A (usage DOWN, line UP -> OVER?): player's recent usage (targets WR/TE, carries RB)
   over last ~3 games is BELOW their season baseline, yet the next game's line is
   ABOVE their recent average line -> does the OVER hit? (Vegas signaling a bounce.)
B (inverse; usage UP, line DOWN -> UNDER?): recent usage ABOVE baseline (hot) but the
   next line is BELOW their recent average -> does the UNDER hit? (Vegas fading them.)

Markets: reception_yds + receptions (WR/TE, usage=targets); rush_yds (RB, usage=carries).
Read-only research; prints hit rates + ROI by line-move magnitude and by season.
"""
import numpy as np
import pandas as pd
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"
REC = {"player_reception_yds", "player_receptions"}
RUSH = {"player_rush_yds"}


def amer_profit(o):
    o = pd.to_numeric(pd.Series(o), errors="coerce").values.astype(float)
    return np.where(np.isnan(o) | (o == 0), np.nan, np.where(o > 0, o/100.0, 100.0/np.abs(np.where(o == 0, 1, o))))


def build():
    pf = pd.read_parquet(DATA / "props_frame.parquet")
    pf = pf[pf.market.isin(REC | RUSH)].copy()
    g = pf.groupby(["season", "week", "player_id", "position", "market"]).agg(
        close_line=("close_line", "median"), actual=("actual", "first"),
        over_px=("close_over", "median"), under_px=("close_under", "median")).reset_index()
    # usage per player-game
    po = pd.read_parquet(DATA / "player_offense.parquet")[
        ["season", "week", "player_id", "targets", "carries"]]
    g = g.merge(po, on=["season", "week", "player_id"], how="left")
    g["usage"] = np.where(g.market.isin(RUSH), g.carries, g.targets)
    g = g.sort_values(["player_id", "market", "season", "week"])

    def _grp(col, fn):
        return g.groupby(["player_id", "market"])[col].transform(fn)
    # entering (shifted) — never uses the current game
    g["line_prior"] = _grp("close_line", lambda s: s.shift(1).rolling(3, min_periods=2).mean())
    g["use_last3"] = _grp("usage", lambda s: s.shift(1).rolling(3, min_periods=2).mean())
    g["use_base"] = _grp("usage", lambda s: s.shift(1).expanding(min_periods=3).mean())
    g["line_delta"] = g.close_line - g.line_prior
    g["line_pct"] = g.line_delta / g.line_prior
    g = g.dropna(subset=["line_prior", "use_last3", "use_base", "actual", "close_line"])
    g = g[g.actual != g.close_line]           # drop pushes
    g["over"] = g.actual > g.close_line
    g["usage_down"] = g.use_last3 < g.use_base
    g["usage_up"] = g.use_last3 > g.use_base
    return g


def rep(label, sub, bet_over):
    sub = sub.dropna(subset=["over"])
    n = len(sub)
    if n < 15:
        print(f"  {label:34s} n={n:4d}  (thin)"); return
    hit = sub.over.mean() if bet_over else (~sub.over).mean()
    px = sub.over_px if bet_over else sub.under_px
    prof = amer_profit(px.values)
    win = sub.over.values if bet_over else (~sub.over.values)
    roi = np.nanmean(np.where(win, prof, -1.0)) * 100
    per = "  ".join(f"{yr}:{ (s.over.mean() if bet_over else (~s.over).mean())*100:.0f}%/{len(s)}"
                    for yr in (2024, 2025) for s in [sub[sub.season == yr]] if len(s))
    print(f"  {label:34s} n={n:4d}  hit={hit*100:5.1f}%  ROI={roi:+6.1f}%   [{per}]")


def main():
    g = build()
    base_over = g.over.mean() * 100
    print(f"population: n={len(g)}  base OVER rate={base_over:.1f}%  (so 'edge' = beat ~{base_over:.0f}% / {100-base_over:.0f}%)\n")

    print("SETUP A — usage DOWN + line UP -> bet OVER:")
    a = g[g.usage_down & (g.line_delta > 0)]
    rep("any line increase", a, True)
    rep("  slight (+0-10%)", a[a.line_pct <= 0.10], True)
    rep("  moderate (+10-25%)", a[(a.line_pct > 0.10) & (a.line_pct <= 0.25)], True)
    rep("  extreme (>+25%)", a[a.line_pct > 0.25], True)

    print("\nSETUP B — usage UP + line DOWN -> bet UNDER:")
    b = g[g.usage_up & (g.line_delta < 0)]
    rep("any line decrease", b, False)
    rep("  slight (-0-10%)", b[b.line_pct >= -0.10], False)
    rep("  moderate (-10-25%)", b[(b.line_pct < -0.10) & (b.line_pct >= -0.25)], False)
    rep("  extreme (<-25%)", b[b.line_pct < -0.25], False)

    # sanity contrasts: the naive (no-usage-filter) versions
    print("\nCONTRAST (no usage filter):")
    rep("line UP only -> OVER", g[g.line_delta > 0], True)
    rep("line DOWN only -> UNDER", g[g.line_delta < 0], False)


if __name__ == "__main__":
    main()
