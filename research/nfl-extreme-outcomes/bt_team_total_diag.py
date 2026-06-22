"""Diagnose the derived team-total signal (2025): why does the AWAY side underperform,
and what edge/side filter is best?

Derived: tt_home = (display_total + pred_margin)/2 ; tt_away = (display_total - pred_margin)/2.
We decompose the error into the two model components so we can see whether the asymmetry
comes from the margin model (a directional bias hits home/away with opposite sign) or from
the totals model (a level bias hits both sides the same way).
"""
import numpy as np
import pandas as pd
import os
from forecast_harness import build, train_predict, DATA

OUT = os.path.join(os.path.dirname(__file__), "out")
RELOC = {"LAR": "LA", "OAK": "LV", "SD": "LAC", "STL": "LA", "WSH": "WAS", "JAC": "JAX"}


def roi(res):
    w = np.sum(res == "W"); l = np.sum(res == "L"); n = w + l
    return (w * 0.9091 - l) / n if n else float("nan")


def grade(pred, lineval, actual):
    if actual == lineval:
        return "P"
    return "W" if ((actual > lineval) == (pred > lineval)) else "L"


def hitline(label, res):
    res = np.asarray(res)
    w = int(np.sum(res == "W")); l = int(np.sum(res == "L")); p = int(np.sum(res == "P"))
    n = w + l
    hit = w / n * 100 if n else float("nan")
    print(f"  {label:32s} n={n:4d}  {w:4d}-{l:4d}-{p:<2d}  hit={hit:5.1f}%  ROI={roi(res)*100:+6.1f}%")


def tt_lines():
    oh = pd.read_parquet(os.path.join(DATA, "odds_hist.parquet"))
    tm = pd.read_parquet(os.path.join(DATA, "team_mapping.parquet"))
    nm = {r.team_name: RELOC.get(r["Team Abbrev"], r["Team Abbrev"]) for _, r in tm.iterrows()}
    oh = oh.dropna(subset=["tt_home_point", "tt_away_point"]).copy()
    oh["h"] = oh.home_team.map(nm); oh["a"] = oh.away_team.map(nm)
    oh = oh.dropna(subset=["h", "a"])
    oh["snap_ts"] = pd.to_datetime(oh.snap_ts)
    last = oh.groupby(["season", "h", "a"]).snap_ts.transform("max")
    cl = oh[oh.snap_ts == last]
    g = cl.groupby(["season", "h", "a"]).agg(tt_home_line=("tt_home_point", "median"),
                                             tt_away_line=("tt_away_point", "median")).reset_index()
    return g.rename(columns={"h": "home_ab", "a": "away_ab"})


def main():
    m, BASE = build()
    sc = m[["season", "week", "home_ab", "away_ab", "home_score", "away_score"]].copy()
    target = 2025
    tot = pd.read_csv(os.path.join(OUT, f"predictions_totals_{target}.csv"))[
        ["season", "home_ab", "away_ab", "display_total"]]
    mar = train_predict(m, BASE, target)
    mar = mar[mar.season == target][["season", "home_ab", "away_ab", "pred_margin"]]
    d = tot.merge(mar, on=["season", "home_ab", "away_ab"]).merge(
        tt_lines(), on=["season", "home_ab", "away_ab"]).merge(
        sc, on=["season", "home_ab", "away_ab"])
    d = d.dropna(subset=["display_total", "pred_margin", "tt_home_line", "tt_away_line",
                         "home_score", "away_score"]).copy()
    d["tt_home_pred"] = (d.display_total + d.pred_margin) / 2
    d["tt_away_pred"] = (d.display_total - d.pred_margin) / 2
    d["actual_margin"] = d.home_score - d.away_score
    d["actual_total"] = d.home_score + d.away_score

    print("=" * 72)
    print(f"TEAM-TOTAL DIAGNOSTIC  ({target}, n={len(d)} games)")
    print("=" * 72)

    print("\n-- component model bias (pred - actual; +=overshoot) --")
    print(f"  margin model : mean={ (d.pred_margin-d.actual_margin).mean():+.2f}  "
          f"MAE={ (d.pred_margin-d.actual_margin).abs().mean():.2f}")
    print(f"  totals model : mean={ (d.display_total-d.actual_total).mean():+.2f}  "
          f"MAE={ (d.display_total-d.actual_total).abs().mean():.2f}")

    print("\n-- derived team-total prediction bias (pred - actual points) --")
    print(f"  HOME tt: mean={ (d.tt_home_pred-d.home_score).mean():+.2f}  "
          f"MAE={ (d.tt_home_pred-d.home_score).abs().mean():.2f}")
    print(f"  AWAY tt: mean={ (d.tt_away_pred-d.away_score).mean():+.2f}  "
          f"MAE={ (d.tt_away_pred-d.away_score).abs().mean():.2f}")

    print("\n-- vs the POSTED line (pred - line; +=we lean OVER) --")
    print(f"  HOME: mean lean={ (d.tt_home_pred-d.tt_home_line).mean():+.2f}   "
          f"line bias (line-actual)={ (d.tt_home_line-d.home_score).mean():+.2f}")
    print(f"  AWAY: mean lean={ (d.tt_away_pred-d.tt_away_line).mean():+.2f}   "
          f"line bias (line-actual)={ (d.tt_away_line-d.away_score).mean():+.2f}")

    # per-side, per-direction grading
    print("\n-- hit rate by side x bet direction --")
    for side, pcol, lcol, acol in [("HOME", "tt_home_pred", "tt_home_line", "home_score"),
                                    ("AWAY", "tt_away_pred", "tt_away_line", "away_score")]:
        for dirn in ["OVER", "UNDER"]:
            sub = d[(d[pcol] > d[lcol]) if dirn == "OVER" else (d[pcol] < d[lcol])]
            res = [grade(r[pcol], r[lcol], r[acol]) for _, r in sub.iterrows()]
            hitline(f"{side} {dirn}", res)

    # build long bet frame for threshold sweep
    recs = []
    for _, r in d.iterrows():
        for side, p, ln, a in [("home", r.tt_home_pred, r.tt_home_line, r.home_score),
                               ("away", r.tt_away_pred, r.tt_away_line, r.away_score)]:
            recs.append(dict(side=side, edge=p - ln, abs_edge=abs(p - ln),
                             dirn="OVER" if p > ln else "UNDER", res=grade(p, ln, a)))
    b = pd.DataFrame(recs)

    print("\n-- edge-band sweep (both sides) --")
    bands = [(0, 1), (1, 1.5), (1.5, 2), (2, 2.5), (2.5, 3), (3, 4), (4, 99)]
    for lo, hi in bands:
        hitline(f"|edge| [{lo},{hi})", b[(b.abs_edge >= lo) & (b.abs_edge < hi)].res.values)

    print("\n-- HOME-only edge-band sweep --")
    for lo, hi in bands:
        sub = b[(b.side == "home") & (b.abs_edge >= lo) & (b.abs_edge < hi)]
        hitline(f"HOME |edge| [{lo},{hi})", sub.res.values)

    print("\n-- best candidate filters --")
    hitline("HOME, |edge|>=1.5", b[(b.side == "home") & (b.abs_edge >= 1.5)].res.values)
    hitline("HOME, 1.5<=|edge|<4", b[(b.side == "home") & (b.abs_edge >= 1.5) & (b.abs_edge < 4)].res.values)
    hitline("BOTH, 1.5<=|edge|<4", b[(b.abs_edge >= 1.5) & (b.abs_edge < 4)].res.values)
    hitline("HOME OVER, |edge|>=1.5", b[(b.side == "home") & (b.dirn == "OVER") & (b.abs_edge >= 1.5)].res.values)


if __name__ == "__main__":
    main()
