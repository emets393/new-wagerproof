"""Validate the leads from nba_dims_scan.py properly.

Three things the scan did not do, all of which can turn a lead into a mirage:

  1. THE TOTAL HAS A BASELINE. Games in this sample run +0.64 points over the posted
     number on average. A cell at +1.28 is therefore +0.64 of EXCESS, not +1.28, and its
     t-stat against zero is roughly double what it should be. Everything here is scored
     against the panel baseline.
  2. TOTALS MUST BE DEDUPED TO THE GAME. The panel has two rows per game. A condition
     that can be true for both teams (rest mismatch is true for both sides by definition)
     counts the same game twice and halves the standard error for free.
  3. PLACEBO AND PER-SEASON. These leads were found by looking, so they get priced
     against a matched random cut of the same size, and shown season by season.

Also reports each rule at the OPENING number, which separates "the market never prices
this" from "the market prices it late".
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
    for c, nm in (("own_l10_pace", "own_pace_t"), ("opp_l10_pace", "opp_pace_t"),
                  ("own_exp", "own_exp_t")):
        p[nm] = p.groupby("season")[c].transform(
            lambda s: pd.qcut(s, 3, labels=["low", "mid", "high"], duplicates="drop"))
    p["rest_gap"] = p["own_rest_days"] - p["opp_rest_days"]
    p["km7_hi"] = p.groupby("season")["own_km_7d"].transform(lambda s: s >= s.quantile(0.75))
    p["seq_slow"] = p.groupby("season")["seq_opp_pace3"].transform(lambda s: s <= s.quantile(0.25))
    p["seq_fast"] = p.groupby("season")["seq_opp_pace3"].transform(lambda s: s >= s.quantile(0.75))
    return p


def games(p):
    """Game-level view: one row per event, for anything bet on the total."""
    g = p.drop_duplicates("event_id")[
        ["event_id", "season", "game_total", "total_line", "open_total",
         "tot_over_price", "tot_under_price"]].copy()
    g["tot_resid"] = g["game_total"] - g["total_line"]
    g["tot_resid_open"] = g["game_total"] - g["open_total"]
    return g


def tot_test(g, ev_ids, label, side="over", base=None, min_n=40):
    """Score a set of games on the total, against the sample's own over-lean."""
    d = g[g["event_id"].isin(ev_ids)]
    if len(d) < min_n:
        return None
    if base is None:
        base = g["tot_resid"].mean()
    live = d[d["tot_resid"] != 0]
    w = live["tot_resid"] > 0 if side == "over" else live["tot_resid"] < 0
    price = live["tot_over_price"] if side == "over" else live["tot_under_price"]
    bl = g[g["tot_resid"] != 0]
    bw = bl["tot_resid"] > 0 if side == "over" else bl["tot_resid"] < 0
    exc = d["tot_resid"] - base
    return {"label": label, "n": len(d), "side": side,
            "pts": d["tot_resid"].mean(), "excess": exc.mean(),
            "t": exc.mean() / (exc.std(ddof=1) / np.sqrt(len(d))),
            "win%": 100 * w.mean(), "base%": 100 * bw.mean(),
            "roi": float(np.where(w, price - 1, -1).mean() * 100),
            "open_pts": d["tot_resid_open"].mean()}


def ats_test(p, mask, label, min_n=40):
    """Score a team-perspective set on the spread. The panel's ats_pts averages exactly
    0 by construction (both sides of every game are present), so zero IS the baseline."""
    d = p[mask]
    if len(d) < min_n:
        return None
    live = d[d["ats_pts"] != 0]
    w = live["ats_pts"] > 0
    return {"label": label, "n": len(d), "pts": d["ats_pts"].mean(),
            "t": d["ats_pts"].mean() / (d["ats_pts"].std(ddof=1) / np.sqrt(len(d))),
            "win%": 100 * w.mean(), "base%": 50.0,
            "roi": float(np.where(w, live["spread_price"] - 1, -1).mean() * 100),
            "open_pts": (d["margin"] + d["open_spread"]).mean()}


def show(rows, title):
    rows = [r for r in rows if r]
    if not rows:
        print(f"\n-- {title}\n   (nothing met the minimum)")
        return
    print(f"\n-- {title}")
    print(pd.DataFrame(rows).to_string(index=False, float_format=lambda v: f"{v:7.2f}"))


def placebo_tot(g, n_pick, observed_excess, trials=6000):
    base = g["tot_resid"].mean()
    r = g["tot_resid"].to_numpy()
    hits = 0
    for _ in range(trials):
        s = RNG.choice(r, size=n_pick, replace=False)
        if s.mean() - base >= observed_excess:
            hits += 1
    return (hits + 1) / (trials + 1)


def placebo_ats(p, n_pick, observed_pts, trials=6000):
    r = p["ats_pts"].to_numpy()
    hits = 0
    for _ in range(trials):
        s = RNG.choice(r, size=n_pick, replace=False)
        if s.mean() >= observed_pts:
            hits += 1
    return (hits + 1) / (trials + 1)


def per_season_tot(g, ev_ids, label, side="over"):
    out = []
    for s in sorted(g["season"].unique()):
        sub = g[g["season"] == s]
        out.append(tot_test(sub, ev_ids, f"  {label} {s}", side=side,
                            base=g["tot_resid"].mean(), min_n=15))
    return out


def per_season_ats(p, mask, label):
    return [ats_test(p, mask & (p["season"] == s), f"  {label} {s}", min_n=15)
            for s in sorted(p["season"].unique())]


def main():
    p = load()
    g = games(p)
    base = g["tot_resid"].mean()
    ob = g[g["tot_resid"] != 0]
    print(f"games {len(g)} | team-games {len(p)}")
    print(f"TOTAL BASELINE: the average game runs {base:+.3f} points over the closing total, "
          f"and the over hits {100*(ob['tot_resid']>0).mean():.2f}% of the time.")
    print("Every 'excess' below is measured against that, not against zero.\n")

    # ---------------------------------------------------------------- T1 rest mismatch
    print("=" * 105)
    print("T1  REST MISMATCH -> OVER.  Either side having 2+ more days off than the other.")
    print("=" * 105)
    print("""  Mechanism: a rest gap creates an effort/legs asymmetry, and one side unable to
  defend at its normal level raises the score regardless of WHICH side it is. The spread
  prices rest (S15 showed it prices it linearly); this asks whether the total does at all.""")
    mm = p[p["rest_gap"].abs() >= 2]["event_id"].unique()
    mm3 = p[p["rest_gap"].abs() >= 3]["event_id"].unique()
    mm1 = p[p["rest_gap"].abs() == 1]["event_id"].unique()
    eq = p.groupby("event_id")["rest_gap"].first().abs()
    rows = [tot_test(g, mm, "rest gap 2+ either way -> OVER"),
            tot_test(g, mm3, "rest gap 3+ either way -> OVER"),
            tot_test(g, mm1, "  control: rest gap of exactly 1"),
            tot_test(g, eq[eq == 0].index, "  control: equal rest")]
    show(rows, "the mismatch ladder (dose: bigger gap should mean more points)")
    show(per_season_tot(g, mm, "rest gap 2+"), "per season")
    r = rows[0]
    print(f"\n   placebo (matched random cut of {r['n']} games): p = "
          f"{placebo_tot(g, r['n'], r['excess']):.4f}")
    print(f"   at the OPENING total this cell is {r['open_pts']:+.2f} points "
          f"(closing {r['pts']:+.2f}) -- if the open is bigger, the market is correcting late.")

    # ---------------------------------------------------------------- T2 trip x pace
    print("\n" + "=" * 105)
    print("T2  DEEP ROAD TRIP x FAST TEAM.  The owner's hypothesis, stated in advance.")
    print("=" * 105)
    print("""  'An up-and-down team, several games into a road trip, is worn out -- do they fail to
  cover, and does the game go over because the defence goes first?' Both halves get tested.""")
    deep_fast = (p["trip_leg"] >= 3) & (p["own_pace_t"] == "high")
    show([ats_test(p, deep_fast, "leg 3+ AND fast team -> FADE them ATS"),
          ats_test(p, (p["trip_leg"] >= 3) & (p["own_pace_t"] != "high"),
                   "  control: leg 3+, not a fast team"),
          ats_test(p, (p["trip_leg"] <= 1) & (p["own_pace_t"] == "high"),
                   "  control: fast team, home or leg 1"),
          ats_test(p, p["trip_leg"] >= 3, "  control: leg 3+, any team")],
         "the spread half (negative pts = fading them wins)")
    show(per_season_ats(p, deep_fast, "leg3+ x fast"), "per season, spread")
    a = ats_test(p, deep_fast, "x")
    print(f"\n   placebo on the fade (matched random cut of {a['n']}): p = "
          f"{placebo_ats(p, a['n'], -a['pts']):.4f}")

    ev = p[deep_fast]["event_id"].unique()
    show([tot_test(g, ev, "leg 3+ AND fast team -> OVER"),
          tot_test(g, p[(p["trip_leg"] >= 3) & (p["own_pace_t"] != "high")]["event_id"].unique(),
                   "  control: leg 3+, not fast"),
          tot_test(g, p[(p["trip_leg"] <= 1) & (p["own_pace_t"] == "high")]["event_id"].unique(),
                   "  control: fast team, home or leg 1")],
         "the total half")
    show(per_season_tot(g, ev, "leg3+ x fast"), "per season, total")

    # ---------------------------------------------------------------- T3 tired veterans
    print("\n" + "=" * 105)
    print("T3  TIRED VETERAN ROTATION -> OVER.  The age question.")
    print("=" * 105)
    print("""  Experience is minutes-weighted years-since-draft over the trailing 10 games (not
  literal age -- there is no birthdate in the feed). 'Fatigued' = on a back-to-back or in
  the heaviest quarter of travel weeks. Mechanism: old legs stop defending first.""")
    vet = p["own_exp_t"] == "high"
    yng = p["own_exp_t"] == "low"
    tired = (p["own_b2b"] == 1) | p["km7_hi"]
    show([tot_test(g, p[vet & tired]["event_id"].unique(), "veteran rotation + fatigued -> OVER"),
          tot_test(g, p[vet & ~tired]["event_id"].unique(), "  control: veteran, fresh"),
          tot_test(g, p[yng & tired]["event_id"].unique(), "  control: young rotation + fatigued"),
          tot_test(g, p[tired]["event_id"].unique(), "  control: anyone fatigued"),
          tot_test(g, p[vet]["event_id"].unique(), "  control: any veteran rotation")],
         "experience x fatigue on the total")
    ev3 = p[vet & tired]["event_id"].unique()
    show(per_season_tot(g, ev3, "vet+tired"), "per season")
    r3 = tot_test(g, ev3, "x")
    print(f"\n   placebo (matched random cut of {r3['n']}): p = "
          f"{placebo_tot(g, r3['n'], r3['excess']):.4f}")

    # ---------------------------------------------------------------- T4 opponent pace run
    print("\n" + "=" * 105)
    print("T4  COMING OFF A RUN OF SLOW OPPONENTS -> OVER.  An anchoring story.")
    print("=" * 105)
    print("""  If a team's last three opponents walked the ball up, its recent scoring numbers are
  artificially low, and anything that anchors on them -- including the posted total --
  should be set too low tonight. This is the highest t-stat in the scan, so it is also
  the one most likely to be an artifact of scoring against zero instead of +0.64.""")
    show([tot_test(g, p[p["seq_slow"]]["event_id"].unique(), "last 3 opponents SLOW -> OVER"),
          tot_test(g, p[p["seq_fast"]]["event_id"].unique(), "last 3 opponents FAST -> OVER"),
          tot_test(g, p[p["seq_slow"] & (p["opp_pace_t"] == "high")]["event_id"].unique(),
                   "slow run, into a fast team tonight"),
          tot_test(g, p[p["seq_slow"] & (p["own_pace_t"] == "high")]["event_id"].unique(),
                   "slow run, and this team is itself fast")],
         "opponent-pace history on the total")
    show(per_season_tot(g, p[p["seq_slow"]]["event_id"].unique(), "slow run"), "per season")

    # ---------------------------------------------------------------- T5/T6 blowouts
    print("\n" + "=" * 105)
    print("T5/T6  OFF A BLOWOUT WIN.  Relocating the owner's remembered trend.")
    print("=" * 105)
    bw = p["prev_blowout_win"] == 1
    hd = (p["is_home"] == 1) & (p["is_fav"] == 0)
    af = (p["is_home"] == 0) & (p["is_fav"] == 1)
    show([ats_test(p, bw & hd, "HOME DOG off a 15+ win"),
          ats_test(p, hd, "  control: any home dog"),
          ats_test(p, bw & af, "away favourite off a 15+ win (the remembered version)"),
          ats_test(p, (p["prev_margin"] >= 20) & af, "away favourite off a 20+ win"),
          ats_test(p, af, "  control: any away favourite"),
          ats_test(p, bw, "  control: anyone off a 15+ win")],
         "blowout-win cells")
    show(per_season_ats(p, bw & hd, "home dog off 15+"), "per season, home dog")
    show(per_season_ats(p, (p["prev_margin"] >= 20) & af, "away fav off 20+"), "per season, away fav 20+")
    for m, lbl in ((bw & hd, "home dog off 15+"), ((p["prev_margin"] >= 20) & af, "away fav off 20+")):
        a = ats_test(p, m, "x")
        print(f"   placebo {lbl} (n={a['n']}): p = {placebo_ats(p, a['n'], a['pts']):.4f}")

    # ---------------------------------------------------------------- overlap
    print("\n" + "=" * 105)
    print("OVERLAP  are T1-T4 four findings or one finding wearing four hats?")
    print("=" * 105)
    sets = {"T1 rest mismatch": set(mm),
            "T2 deep trip x fast": set(ev),
            "T3 vet + fatigued": set(ev3),
            "T4 slow-opp run": set(p[p["seq_slow"]]["event_id"].unique())}
    keys = list(sets)
    ov = pd.DataFrame(index=keys, columns=keys, dtype=float)
    for a_ in keys:
        for b_ in keys:
            ov.loc[a_, b_] = 100 * len(sets[a_] & sets[b_]) / max(1, len(sets[a_]))
    print("\n   % of the ROW rule's games that are also in the COLUMN rule")
    print(ov.to_string(float_format=lambda v: f"{v:6.1f}"))
    union = set().union(*sets.values())
    show([tot_test(g, union, "ANY of T1-T4 -> OVER"),
          tot_test(g, set(g["event_id"]) - union, "  games in none of them")],
         "the union")


if __name__ == "__main__":
    main()
