"""#99 (RESEARCH ONLY) — does SCHEME context add unpriced information to the GAME markets?

Design: the closing line is the strongest baseline, so the increment test is
  config A: predict actual from [close line (+week)]            <- the market's own forecast
  config B: A + BOTH teams' scheme identities (off + def, l8)   <- does scheme beat the close?
GBM walk-forward by season (train < S, predict S), weeks 4-18, 2019-2025. If B's MAE < A's AND the
model-vs-line edges grade positive at the close (per-season, need, sigma, both sides), scheme carries
unpriced game-market info. NOTE this deliberately puts the LINE in features — that is correct for an
increment-over-market SCREEN (it is NOT the originator-model design; nothing here touches the locked
production models).

Also: the vertical-offense ATS fade MAIN-EFFECT check (is the 8/8 H1 cell just 'fade deep-ball
offenses' regardless of opponent?) with dose-response, using sign_conventions.assert_ats_sane.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingRegressor
from attempts_model import amer_profit
from sign_conventions import assert_ats_sane

DATA = Path(__file__).resolve().parent / "data"
DECN = 1.909
HP = dict(max_depth=3, learning_rate=0.05, max_iter=300, min_samples_leaf=40,
          l2_regularization=2.0, random_state=0)

ds = pd.read_parquet(DATA / "nfl_def_scheme.parquet")
os_ = pd.read_parquet(DATA / "nfl_off_scheme.parquet")
g = pd.read_parquet(DATA / "nflverse_games.parquet")
g = g[(g.game_type == "REG") & g.spread_line.notna() & g.result.notna()
      & g.total_line.notna() & g.total.notna()].copy()

OFFC = [c for c in os_.columns if c.endswith("_l8")]
DEFC = [c for c in ds.columns if c.endswith("_l8")]
for side, ab in [("h", "home_team"), ("a", "away_team")]:
    g = g.merge(os_.rename(columns={"team": ab, **{c: f"{side}_off_{c}" for c in OFFC}}),
                on=["season", "week", ab], how="left")
    g = g.merge(ds.rename(columns={"team": ab, **{c: f"{side}_def_{c}" for c in DEFC}}),
                on=["season", "week", ab], how="left")
SCH = [f"{s}_off_{c}" for s in ("h", "a") for c in OFFC] + [f"{s}_def_{c}" for s in ("h", "a") for c in DEFC]
g = g[(g.week >= 4) & (g.week <= 18)].copy()
# sanity: sign convention (favorites ~48-50%)
g["_m"] = g.result - g.spread_line
assert_ats_sane(g, "_m", g.spread_line > 0, label="game-models")


def wf(frame, feats, target):
    pr = pd.Series(np.nan, index=frame.index)
    for S in range(2019, 2026):
        tr, te = frame[frame.season < S], frame[frame.season == S]
        if len(tr) < 400 or len(te) == 0:
            continue
        pr.loc[te.index] = HistGradientBoostingRegressor(**HP).fit(tr[feats], tr[target]).predict(te[feats])
    return pr


def bet_cells(e, pred, line, actual, name):
    e = e.copy()
    e["edge"] = e[pred] - e[line]
    e = e[e[actual] != e[line]]
    for qq in (0.65, 0.8):
        thr = e.edge.abs().quantile(qq)
        for side, isov in [("OVER/COVER", True), ("UNDER/FADE", False)]:
            d = e[e.edge >= thr] if isov else e[e.edge <= -thr]
            if len(d) < 40:
                print(f"    {name} p{int(qq*100)} {side:11}: n={len(d)} thin"); continue
            win = (d[actual] > d[line]).values if isov else (d[actual] < d[line]).values
            n = len(d); wr = win.mean() * 100
            roi = (win.mean() * DECN - 1) * 100
            sg = 100 * np.sqrt(win.mean() * (1 - win.mean())) * DECN / np.sqrt(n)
            by = d.groupby("season").apply(
                lambda x: ((x[actual] > x[line]).mean() if isov else (x[actual] < x[line]).mean()))
            print(f"    {name} p{int(qq*100)} {side:11}: n={n:4d} win={wr:5.1f}% ROI={roi:+6.1f} "
                  f"sig={sg:4.1f} seasons {(by>=0.5).sum()}/{by.notna().sum()}")


print("=" * 100)
print("FG TOTAL — increment over the close (A=line only vs B=line+scheme)")
print("=" * 100)
fr = g.dropna(subset=SCH, how="all").copy()
fr["pA"] = wf(fr, ["total_line", "week"], "total")
fr["pB"] = wf(fr, ["total_line", "week"] + SCH, "total")
ev = fr[fr.pA.notna() & fr.pB.notna()]
maeA = np.abs(ev.pA - ev.total).mean(); maeB = np.abs(ev.pB - ev.total).mean()
maeL = np.abs(ev.total_line - ev.total).mean()
print(f"  n={len(ev)} | line MAE={maeL:.3f} | A(line-only model)={maeA:.3f} | B(+scheme)={maeB:.3f} "
      f"| scheme increment {maeB-maeA:+.3f} {'HELPS' if maeB<maeA else '(no gain)'}")
bet_cells(ev, "pB", "total_line", "total", "total+scheme")

print("\n" + "=" * 100)
print("FG SPREAD (margin) — increment over the close")
print("=" * 100)
fr["pAm"] = wf(fr, ["spread_line", "week"], "result")
fr["pBm"] = wf(fr, ["spread_line", "week"] + SCH, "result")
ev = fr[fr.pAm.notna() & fr.pBm.notna()]
maeA = np.abs(ev.pAm - ev.result).mean(); maeB = np.abs(ev.pBm - ev.result).mean()
maeL = np.abs(ev.spread_line - ev.result).mean()
print(f"  n={len(ev)} | line MAE={maeL:.3f} | A={maeA:.3f} | B(+scheme)={maeB:.3f} "
      f"| scheme increment {maeB-maeA:+.3f} {'HELPS' if maeB<maeA else '(no gain)'}")
bet_cells(ev, "pBm", "spread_line", "result", "margin+scheme")

print("\n" + "=" * 100)
print("VERTICAL-OFFENSE ATS FADE — main effect (no opponent condition), weeks 4-18")
print("=" * 100)
rows = []
for _, r in g.iterrows():
    rows.append(dict(season=r.season, week=r.week, off=r.home_team,
                     deep=r.get("h_off_deep_rate_l8"), ats=r.result - r.spread_line))
    rows.append(dict(season=r.season, week=r.week, off=r.away_team,
                     deep=r.get("a_off_deep_rate_l8"), ats=-r.result + r.spread_line))
tv = pd.DataFrame(rows).dropna(subset=["deep", "ats"])
tv = tv[tv.ats != 0]
tv["dq"] = tv.groupby("season").deep.transform(lambda s: s.rank(pct=True))
for thr in (0.75, 0.85, 0.92):
    d = tv[tv.dq >= thr]
    p = (d.ats < 0).mean()  # fade wins when the vertical offense fails to cover
    n = len(d); sg = 100 * np.sqrt(p * (1 - p)) * DECN / np.sqrt(n)
    by = d.groupby("season").ats.apply(lambda x: (x < 0).mean())
    print(f"  deep_rate >= p{int(thr*100)}: FADE hits {p*100:5.1f}% n={n:4d} ROI={(p*DECN-1)*100:+6.1f} "
          f"sig={sg:4.1f} seasons {(by>=0.5).sum()}/{by.notna().sum()}")
print("  complement (low-deep offenses, fade):")
d = tv[tv.dq <= 0.25]
p = (d.ats < 0).mean()
print(f"  deep_rate <= p25: FADE hits {p*100:5.1f}% n={len(d)}")
