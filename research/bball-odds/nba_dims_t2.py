"""Drill the two survivors of the situational scan.

S16  a high-pace team three or more games into a road trip -> FADE it against the spread
S17  an away favourite off a 20+ point win -> back it

Both came out of a scan, so both need what a scan cannot give: a dose response, the
one-term controls, the correct price on the side actually being bet, per-team robustness,
and a check that the effect is not just "back home teams" or "back good teams" in
disguise.

Note on prices: nba_dims_validate reported the ROI of BACKING the flagged team. S16 is a
FADE, so it has to be priced on the opponent's side of the same game -- the two prices are
not mirror images and using the wrong one flatters or buries the rule by a point or two.
"""
from __future__ import annotations
import numpy as np
import pandas as pd

PAN = "data/parquet/nba_dims_panel.parquet"
RNG = np.random.default_rng(20260731)
pd.set_option("display.width", 210)


def load():
    p = pd.read_parquet(PAN)
    p = p[(p["postseason"] != 1) | p["postseason"].isna()]
    p = p[p["spread"].notna() & p["total_line"].notna()].copy()
    # the opponent's spread price, so a fade can be priced on the side actually bet
    opp = p[["event_id", "team", "spread_price"]].rename(
        columns={"team": "opp", "spread_price": "fade_price"})
    p = p.merge(opp, on=["event_id", "opp"], how="left")
    for c, nm in (("own_l10_pace", "own_pace_pct"), ("opp_l10_pace", "opp_pace_pct"),
                  ("own_s2d_pace", "own_s2d_pct")):
        if c in p.columns:
            p[nm] = p.groupby("season")[c].rank(pct=True)
    return p


def fade(p, mask, label, min_n=40):
    """Score FADING the flagged team: bet its opponent, at the opponent's price."""
    d = p[mask]
    if len(d) < min_n:
        return None
    live = d[d["ats_pts"] != 0]
    w = live["ats_pts"] < 0          # we win when the flagged team fails to cover
    return {"label": label, "n": len(d),
            "their_pts": d["ats_pts"].mean(),
            "t": -d["ats_pts"].mean() / (d["ats_pts"].std(ddof=1) / np.sqrt(len(d))),
            "fade%": 100 * w.mean(),
            "fade_roi": float(np.where(w, live["fade_price"] - 1, -1).mean() * 100),
            "open_pts": (d["margin"] + d["open_spread"]).mean()}


def back(p, mask, label, min_n=40):
    d = p[mask]
    if len(d) < min_n:
        return None
    live = d[d["ats_pts"] != 0]
    w = live["ats_pts"] > 0
    return {"label": label, "n": len(d), "their_pts": d["ats_pts"].mean(),
            "t": d["ats_pts"].mean() / (d["ats_pts"].std(ddof=1) / np.sqrt(len(d))),
            "win%": 100 * w.mean(),
            "roi": float(np.where(w, live["spread_price"] - 1, -1).mean() * 100),
            "open_pts": (d["margin"] + d["open_spread"]).mean()}


def show(rows, title):
    rows = [r for r in rows if r]
    if not rows:
        print(f"\n-- {title}\n   (nothing met the minimum)")
        return
    print(f"\n-- {title}")
    print(pd.DataFrame(rows).to_string(index=False, float_format=lambda v: f"{v:7.2f}"))


def drop_one(p, mask, label, by="team", fade_side=True):
    d = p[mask]
    out = []
    for t in d[by].value_counts().head(6).index:
        sub = mask & (p[by] != t)
        r = fade(p, sub, f"  without {t}") if fade_side else back(p, sub, f"  without {t}")
        if r:
            r["dropped_n"] = int((d[by] == t).sum())
            out.append(r)
    print(f"\n-- {label}: drop the six most frequent teams one at a time")
    print(pd.DataFrame(out).to_string(index=False, float_format=lambda v: f"{v:7.2f}"))


def main():
    p = load()
    print(f"panel {len(p)} regular-season team-games\n")

    # =====================================================================================
    print("=" * 108)
    print("S16  HIGH-PACE TEAM, DEEP INTO A ROAD TRIP -> FADE IT")
    print("=" * 108)
    print("""  The owner's hypothesis almost verbatim: an up-and-down team several games into a
  road trip is worn out, its defence goes before its offence, so it fails to cover and the
  game runs over. 'their_pts' is the flagged team's average points vs its own spread --
  negative means fading it wins. Fades are priced on the OPPONENT's number.""")

    fastp = p["own_pace_pct"] >= 2 / 3
    deep = p["trip_leg"] >= 3
    show([fade(p, deep & fastp, "S16: leg 3+, top-third pace -> fade"),
          fade(p, deep & ~fastp, "  control: leg 3+, not a fast team"),
          fade(p, (p["trip_leg"].between(1, 2)) & fastp, "  control: fast team, leg 1-2"),
          fade(p, (p["is_home"] == 1) & fastp, "  control: fast team, at home"),
          fade(p, deep, "  control: leg 3+, any team"),
          fade(p, p["is_home"] == 0, "  control: every road team")],
         "the rule and its one-term controls")

    print("""
  Dose on trip depth. If fatigue is the mechanism it should deepen with the trip, not
  switch on at an arbitrary leg.""")
    rows = []
    for lg in (1, 2, 3, 4, 5):
        m = (p["trip_leg"] == lg) if lg < 5 else (p["trip_leg"] >= 5)
        rows.append(fade(p, m & fastp, f"fast team, leg {lg}{'+' if lg == 5 else ''}", min_n=30))
    show(rows, "leg ladder, fast teams only")
    rows = []
    for lg in (1, 2, 3, 4, 5):
        m = (p["trip_leg"] == lg) if lg < 5 else (p["trip_leg"] >= 5)
        rows.append(fade(p, m & ~fastp, f"slower team, leg {lg}{'+' if lg == 5 else ''}", min_n=30))
    show(rows, "leg ladder, everyone else (this should stay flat)")

    print("""
  Dose on pace. Same idea from the other axis.""")
    rows = []
    for q in (0.50, 0.60, 0.667, 0.75, 0.85):
        rows.append(fade(p, deep & (p["own_pace_pct"] >= q),
                         f"leg 3+, pace above the {int(q*100)}th pct", min_n=30))
    show(rows, "pace ladder at leg 3+")

    print("""
  Robustness of the pace measure itself: l10 pace is a 10-game window, season-to-date is
  a different estimator. A real architecture effect should not care which one is used.""")
    if "own_s2d_pct" in p.columns:
        show([fade(p, deep & (p["own_s2d_pct"] >= 2 / 3), "leg 3+, top-third SEASON pace"),
              fade(p, deep & fastp, "leg 3+, top-third L10 pace (the rule)")],
             "pace estimator swap")

    print("""
  Who is on the other side, and does rest confound it? trip_leg >= 3 is always a road
  team, so fading it means backing a home team -- the 'every road team' control above is
  the one that matters, and it is flat.""")
    show([fade(p, deep & fastp & (p["own_rest_days"] <= 1), "S16 on 0-1 days rest"),
          fade(p, deep & fastp & (p["own_rest_days"] >= 2), "S16 on 2+ days rest"),
          fade(p, deep & fastp & (p["opp_pace_pct"] >= 2 / 3), "S16 into a fast home team"),
          fade(p, deep & fastp & (p["opp_pace_pct"] < 2 / 3), "S16 into a slower home team"),
          fade(p, deep & fastp & (p["is_fav"] == 1), "S16 when they are still favoured"),
          fade(p, deep & fastp & (p["is_fav"] == 0), "S16 when they are the dog")],
         "conditioning")

    show([fade(p, deep & fastp & (p["season"] == s), f"  S16 {s}", min_n=20)
          for s in sorted(p["season"].unique())], "per season")
    drop_one(p, deep & fastp, "S16", fade_side=True)

    r = fade(p, deep & fastp, "x")
    obs = -r["their_pts"]
    arr = p["ats_pts"].to_numpy()
    hits = sum(1 for _ in range(6000)
               if -RNG.choice(arr, size=r["n"], replace=False).mean() >= obs)
    print(f"\n   placebo (matched random cut of {r['n']} team-games): p = {(hits+1)/6001:.4f}")

    # =====================================================================================
    print("\n" + "=" * 108)
    print("S17  AWAY FAVOURITE OFF A 20+ POINT WIN -> BACK IT")
    print("=" * 108)
    print("""  The owner remembered this at 15 points. At 15 it is not there (+0.64 pts, 52.0%);
  the 15-20 band is actively bad. At 20 it is there and every season is positive. Testing
  whether 20 is a real edge of the effect or a threshold that got lucky.""")

    af = (p["is_home"] == 0) & (p["is_fav"] == 1)
    hf = (p["is_home"] == 1) & (p["is_fav"] == 1)
    rows = []
    for thr in (10, 15, 20, 25, 30):
        rows.append(back(p, af & (p["prev_margin"] >= thr),
                         f"away fav, prev win >= {thr}", min_n=30))
    show(rows, "dose ladder")

    show([back(p, af & (p["prev_margin"] >= 20), "S17: away fav off a 20+ win"),
          back(p, hf & (p["prev_margin"] >= 20), "  same spot at HOME (should be weaker)"),
          back(p, (p["is_home"] == 0) & (p["is_fav"] == 0) & (p["prev_margin"] >= 20),
               "  away DOG off a 20+ win"),
          back(p, af, "  control: any away favourite"),
          back(p, p["prev_margin"] >= 20, "  control: anyone off a 20+ win"),
          back(p, af & (p["prev_margin"].between(0, 20)), "  away fav off a win under 20")],
         "the rule and its controls")

    print("""
  Mechanism check. A 20+ win usually means the starters watched the fourth quarter, so
  the story is fresh legs plus a market that shades against 'due for a letdown'. If that
  is right the effect should be at least as strong on short rest.""")
    s17 = af & (p["prev_margin"] >= 20)
    show([back(p, s17 & (p["own_rest_days"] <= 1), "S17 on 0-1 days rest"),
          back(p, s17 & (p["own_rest_days"] >= 2), "S17 on 2+ days rest"),
          back(p, s17 & (p["prev_was_home"] == 1), "S17 when the blowout was at home"),
          back(p, s17 & (p["prev_was_home"] == 0), "S17 when the blowout was on the road"),
          back(p, s17 & (p["spread"] <= -6), "S17 laying 6 or more"),
          back(p, s17 & (p["spread"] > -6), "S17 laying less than 6")],
         "conditioning", )

    show([back(p, s17 & (p["season"] == s), f"  S17 {s}", min_n=20)
          for s in sorted(p["season"].unique())], "per season")
    drop_one(p, s17, "S17", fade_side=False)

    r2 = back(p, s17, "x")
    hits = sum(1 for _ in range(6000)
               if RNG.choice(arr, size=r2["n"], replace=False).mean() >= r2["their_pts"])
    print(f"\n   placebo (matched random cut of {r2['n']} team-games): p = {(hits+1)/6001:.4f}")

    print("""
  Finally: are S16 and S17 independent of the rules already in NBA_PROVEN? Both are
  spread rules, so overlap with S9/S11 (late-season dead home teams) would be a problem.""")
    late = p["own_gp"] >= 50
    show([back(p, s17 & late, "S17 late season only"),
          back(p, s17 & ~late, "S17 before both teams hit 50 games"),
          fade(p, deep & fastp & late, "S16 late season only"),
          fade(p, deep & fastp & ~late, "S16 before 50 games")],
         "season phase (S9/S11 live entirely in the late season)")


if __name__ == "__main__":
    main()
