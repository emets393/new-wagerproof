"""Walk-forward backtest: does the DERIVED team total (from the totals model + margin model)
beat the posted team-total line?

The team-total number we DISPLAY is not its own model — it's a split of two locked models:
    tt_home = (display_total + pred_margin) / 2
    tt_away = (display_total - pred_margin) / 2
where display_total = consensus_totals ensemble (walk-forward) and pred_margin = harness
regression margin (walk-forward). This asks the honest question: if we'd BET each side's
team total (Over/Under) off that derived number vs the posted team-total line, what's the
hit rate / ROI?

Grade-line honesty: derived from the OPEN-side totals model + margin model, so we grade vs
the team-total line. Team-total lines aren't in odds_consensus, so we pull the CLOSE consensus
(median across books at the latest snapshot) from odds_hist. ROI quoted at -110.
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


def line(label, res):
    w = int(np.sum(res == "W")); l = int(np.sum(res == "L")); p = int(np.sum(res == "P"))
    n = w + l
    hit = w / n * 100 if n else float("nan")
    print(f"  {label:34s} n={n:4d}  {w:4d}-{l:4d}-{p:<3d}  hit={hit:5.1f}%  ROI={roi(res)*100:+6.1f}%")


def tt_lines():
    """Closing consensus team-total line per game: median across books at the last snapshot."""
    oh = pd.read_parquet(os.path.join(DATA, "odds_hist.parquet"))
    tm = pd.read_parquet(os.path.join(DATA, "team_mapping.parquet"))
    nm = {r.team_name: RELOC.get(r["Team Abbrev"], r["Team Abbrev"]) for _, r in tm.iterrows()}
    oh = oh.dropna(subset=["tt_home_point", "tt_away_point"]).copy()
    oh["h"] = oh.home_team.map(nm); oh["a"] = oh.away_team.map(nm)
    oh = oh.dropna(subset=["h", "a"])
    # latest snapshot per game = closing
    oh["snap_ts"] = pd.to_datetime(oh.snap_ts)
    last = oh.groupby(["season", "h", "a"]).snap_ts.transform("max")
    cl = oh[oh.snap_ts == last]
    g = cl.groupby(["season", "h", "a"]).agg(tt_home_line=("tt_home_point", "median"),
                                             tt_away_line=("tt_away_point", "median")).reset_index()
    return g.rename(columns={"h": "home_ab", "a": "away_ab"})


def main():
    m, BASE = build()
    sc = m[["season", "week", "home_ab", "away_ab", "home_score", "away_score"]].copy()
    tt = tt_lines()

    # Totals model can't be regenerated for prior seasons here (frozen b54_feature_importance.csv
    # not in repo), so we use the saved walk-forward 2025 predictions — the season we display.
    seasons = [2025]
    rows = []
    for target in seasons:
        tot = pd.read_csv(os.path.join(OUT, f"predictions_totals_{target}.csv"))
        tot = tot[["season", "home_ab", "away_ab", "display_total", "tier"]]
        mar = train_predict(m, BASE, target)
        mar = mar[mar.season == target][["season", "home_ab", "away_ab", "pred_margin"]]
        d = tot.merge(mar, on=["season", "home_ab", "away_ab"], how="inner")
        d = d.merge(tt, on=["season", "home_ab", "away_ab"], how="inner")
        d = d.merge(sc, on=["season", "home_ab", "away_ab"], how="inner")
        d = d.dropna(subset=["display_total", "pred_margin", "tt_home_line", "tt_away_line",
                             "home_score", "away_score"])
        d["tt_home_pred"] = (d.display_total + d.pred_margin) / 2
        d["tt_away_pred"] = (d.display_total - d.pred_margin) / 2
        rows.append(d)
    df = pd.concat(rows, ignore_index=True)

    # one bet per side
    recs = []
    for _, r in df.iterrows():
        for side, pred, lineval, actual in [
            ("home", r.tt_home_pred, r.tt_home_line, r.home_score),
            ("away", r.tt_away_pred, r.tt_away_line, r.away_score)]:
            edge = pred - lineval
            direction = "OVER" if edge > 0 else "UNDER"
            if actual == lineval:
                res = "P"
            else:
                went_over = actual > lineval
                res = "W" if (went_over == (direction == "OVER")) else "L"
            recs.append(dict(season=int(r.season), side=side, edge=edge,
                             abs_edge=abs(edge), res=res))
    b = pd.DataFrame(recs)

    print("=" * 78)
    print("DERIVED TEAM TOTAL vs POSTED TEAM-TOTAL LINE  (totals model + margin model split)")
    print("=" * 78)
    line("ALL team-total bets", b.res.values)
    print("\n  -- by season --")
    for s in seasons:
        line(str(s), b[b.season == s].res.values)
    print("\n  -- home vs away side --")
    line("HOME team totals", b[b.side == "home"].res.values)
    line("AWAY team totals", b[b.side == "away"].res.values)
    print("\n  -- by |edge| (derived pred minus posted TT line) --")
    for thr in [0, 1, 1.5, 2, 3, 4, 5]:
        line(f"|edge| >= {thr}", b[b.abs_edge >= thr].res.values)
    print(f"\n  total team-total bets graded: {len(b)}  ({df.shape[0]} games x 2 sides)")


if __name__ == "__main__":
    main()
