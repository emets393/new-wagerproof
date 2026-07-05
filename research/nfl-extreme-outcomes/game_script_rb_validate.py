"""Full validation: run-heavy prep -> RB1 rush-yds OVER (2024-25).
ROI at real prices, open-line (CLV) check, FAVORITE control, threshold tuning.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from stats_helpers import wilson_ci
from game_script_team import team_actuals, team_lines, NORM

DATA = Path(__file__).resolve().parent / "data"


def amer_profit(o):
    o = pd.to_numeric(pd.Series(o), errors="coerce").values.astype(float)
    return np.where(np.isnan(o) | (o == 0), np.nan, np.where(o > 0, o/100.0, 100.0/np.abs(np.where(o == 0, 1, o))))


def rb1():
    pf = pd.read_parquet(DATA / "props_frame.parquet")
    rb = pf[pf.market == "player_rush_yds"]
    c = rb.groupby(["season", "week", "player_id", "team"]).agg(
        close_line=("close_line", "median"), open_line=("open_line", "median"),
        actual=("actual", "first"), close_over=("close_over", "median"),
        open_over=("open_over", "median")).reset_index()
    c["team"] = c.team.replace(NORM)
    c = c.dropna(subset=["close_line", "actual"])
    idx = c.groupby(["season", "week", "team"]).close_line.idxmax()   # lead RB
    return c.loc[idx]


def spreads():
    h = pd.read_parquet(DATA / "h1tt_frame.parquet")
    h["home_ab"] = h.home_ab.replace(NORM); h["away_ab"] = h.away_ab.replace(NORM)
    rows = []
    for _, r in h.iterrows():
        for home in (True, False):
            rows.append(dict(season=int(r.season), week=int(r.week),
                team=r.home_ab if home else r.away_ab,
                team_spread=r.spread_close_spread_home if home else -r.spread_close_spread_home))
    return pd.DataFrame(rows)


def grade(sub, line_col, px_col):
    """OVER bet vs line_col at px_col. Returns (n, hit%, roi%, per-season dict, ci)."""
    s = sub.dropna(subset=[line_col, "actual", px_col]).copy()
    s = s[s.actual != s[line_col]]
    if len(s) == 0:
        return None
    win = (s.actual > s[line_col]).values
    prof = amer_profit(s[px_col].values)
    roi = np.nanmean(np.where(win, prof, -1.0)) * 100
    k, n = int(win.sum()), len(s)
    lo, hi = wilson_ci(k, n)
    per = {y: (s[s.season == y].actual > s[s.season == y][line_col]).mean() * 100
           for y in (2024, 2025) if len(s[s.season == y])}
    return n, k/n*100, roi, per, (lo*100, hi*100)


def line(label, res):
    if res is None:
        print(f"  {label:40s} n=0"); return
    n, hp, roi, per, ci = res
    ys = " ".join(f"{y}:{v:.0f}%" for y, v in per.items())
    print(f"  {label:40s} n={n:4d} hit={hp:5.1f}% ROI={roi:+6.1f}% [{ys}] CI[{ci[0]:.0f},{ci[1]:.0f}]")


def main():
    tg = spreads().merge(team_lines(), on=["season", "week", "team"], how="left") \
        .merge(team_actuals()[["season", "week", "team", "avg_pass_prior", "avg_rush_prior"]],
               on=["season", "week", "team"], how="left") \
        .merge(rb1(), on=["season", "week", "team"], how="inner")
    tg["pass_lean"] = tg.pass_att_line - tg.avg_pass_prior
    tg["rush_lean"] = tg.rush_att_line - tg.avg_rush_prior
    tg["is_fav"] = tg.team_spread < 0
    tg = tg.dropna(subset=["pass_lean", "rush_lean"])
    print(f"RB1 team-games with leans: {len(tg)}")
    print(f"  base RB1-over (close): {(tg.actual>tg.close_line).mean()*100:.1f}%  "
          f"break-even @-110 = 52.4%\n")

    rh = tg[(tg.pass_lean < 0) & (tg.rush_lean > 0)]
    print("(1) HEADLINE — run-heavy -> RB1 rush-yds OVER:")
    line("close line + close price", grade(rh, "close_line", "close_over"))
    line("OPEN line + open price (CLV check)", grade(rh, "open_line", "open_over"))

    print("\n(2) FAVORITE CONTROL (does it beat 'just a favorite's RB'?):")
    line("ALL RB1 over (baseline)", grade(tg, "close_line", "close_over"))
    line("favorite RB1 over (baseline)", grade(tg[tg.is_fav], "close_line", "close_over"))
    line("run-heavy & FAVORITE", grade(rh[rh.is_fav], "close_line", "close_over"))
    line("run-heavy & UNDERDOG (isolate volume)", grade(rh[~rh.is_fav], "close_line", "close_over"))

    print("\n(3) THRESHOLD TUNING (stronger lean -> stronger edge = real?):")
    for t in (0, 1, 2, 3):
        sub = tg[(tg.pass_lean < -t) & (tg.rush_lean > t)]
        line(f"pass_lean<-{t} & rush_lean>{t}", grade(sub, "close_line", "close_over"))


if __name__ == "__main__":
    main()
