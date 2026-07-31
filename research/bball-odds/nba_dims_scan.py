"""Situational attribution: how many POINTS does a spot move the margin and the total,
and does that change with the architecture of the two teams in it.

Every cell reports four numbers, and the pairing is the whole point:

  raw margin / raw total   what actually happened on the floor
  vs spread / vs total     the same thing minus the number the market posted

A spot can be REAL and PRICED (raw moves, residual flat) -- that is a model ingredient.
A spot is BETTABLE only if the residual moves. Reporting only win% hides which of the two
you are looking at, which is why this file leads with points.

Hypotheses are the owner's, stated before the run:
  H1  away favourite off a 15+ point win
  H2  road-trip leg, and whether fast teams decay faster on the road
  H3  the sandwich -- short rest before AND after, mid-trip
  H4  fast team into fast team: better or worse against the number
  H5  a run of fast-paced opponents in a row
  H6  roster experience as a moderator of travel and trip load
  H7  rest gap by team architecture
"""
from __future__ import annotations
import numpy as np
import pandas as pd

PAN = "data/parquet/nba_dims_panel.parquet"
pd.set_option("display.width", 200)


def load() -> pd.DataFrame:
    p = pd.read_parquet(PAN)
    p = p[(p["postseason"] != 1) | p["postseason"].isna()]
    p = p[p["spread"].notna() & p["total_line"].notna()]
    # tertile tiers per season. NOTE: cut points come from the season's own distribution,
    # which is fine for measuring an effect size but would leak if a threshold were shipped;
    # anything promoted gets re-cut on prior-season points first.
    for c, nm in (("own_l10_pace", "own_pace_t"), ("opp_l10_pace", "opp_pace_t"),
                  ("own_l10_def_eff", "own_def_t"), ("opp_l10_def_eff", "opp_def_t"),
                  ("own_l10_off_eff", "own_off_t"), ("own_exp", "own_exp_t"),
                  ("own_l10_p3a_rate", "own_3pa_t"), ("own_l10_hhi", "own_conc_t")):
        if c not in p.columns:
            continue
        p[nm] = p.groupby("season")[c].transform(
            lambda s: pd.qcut(s, 3, labels=["low", "mid", "high"], duplicates="drop"))
    return p


def roi(win: pd.Series, price: pd.Series) -> float:
    """Units per unit staked. price is decimal; pushes already dropped by the caller."""
    return float((np.where(win, price - 1.0, -1.0)).mean() * 100)


def cell(p: pd.DataFrame, mask, label: str, min_n: int = 40) -> dict | None:
    d = p[mask]
    if len(d) < min_n:
        return None
    ats = d[d["ats_pts"] != 0]
    ou = d[d["tot_resid"] != 0]
    w_ats = ats["ats_pts"] > 0
    w_ov = ou["tot_resid"] > 0
    n = len(d)
    return {
        "label": label, "n": n,
        # points of attribution -- the headline
        "raw_mgn": d["margin"].mean(),
        "vs_spr": d["ats_pts"].mean(),
        "t_spr": d["ats_pts"].mean() / (d["ats_pts"].std(ddof=1) / np.sqrt(n)),
        "raw_tot": d["game_total"].mean(),
        "vs_tot": d["tot_resid"].mean(),
        "t_tot": d["tot_resid"].mean() / (d["tot_resid"].std(ddof=1) / np.sqrt(n)),
        # and the bet-shaped view of the same cell
        "ats%": 100 * w_ats.mean() if len(ats) else np.nan,
        "ats_roi": roi(w_ats, ats["spread_price"]) if len(ats) else np.nan,
        "ov%": 100 * w_ov.mean() if len(ou) else np.nan,
        "ov_roi": roi(w_ov, ou["tot_over_price"]) if len(ou) else np.nan,
        "un_roi": roi(~w_ov, ou["tot_under_price"]) if len(ou) else np.nan,
    }


def table(rows, title: str, cols=None) -> None:
    rows = [r for r in rows if r]
    if not rows:
        print(f"\n-- {title}\n   (no cell met the minimum sample)")
        return
    df = pd.DataFrame(rows)
    if cols:
        df = df[["label", "n"] + cols]
    print(f"\n-- {title}")
    print(df.to_string(index=False, float_format=lambda v: f"{v:7.2f}"))


PTS = ["raw_mgn", "vs_spr", "t_spr", "ats%", "ats_roi"]
TOT = ["raw_tot", "vs_tot", "t_tot", "ov%", "ov_roi", "un_roi"]
BOTH = ["vs_spr", "t_spr", "ats%", "raw_tot", "vs_tot", "t_tot", "ov%"]


def seasons(p, mask, label, col="vs_spr"):
    out = []
    for s in sorted(p["season"].unique()):
        out.append(cell(p, mask & (p["season"] == s), f"  {label} {s}", min_n=20))
    return out


# ===========================================================================================
def h1_blowout(p: pd.DataFrame) -> None:
    print("=" * 95)
    print("H1  OFF A 15+ POINT WIN -- the owner remembers away favourites bouncing again")
    print("=" * 95)
    print("""
  The full 2x2x2 so the claim can be located rather than assumed: home/away x
  favourite/dog x coming off a 15+ win or a 15+ loss. 'vs_spr' is the average points
  by which the team beat the closing spread -- 0 is a fair price, positive is value.""")

    bw = p["prev_blowout_win"] == 1
    bl = p["prev_blowout_loss"] == 1
    fav, dog = p["is_fav"] == 1, p["is_fav"] == 0
    away, home = p["is_home"] == 0, p["is_home"] == 1

    rows = [
        cell(p, bw & away & fav, "AWAY favourite off a 15+ WIN"),
        cell(p, bw & home & fav, "home favourite off a 15+ win"),
        cell(p, bw & away & dog, "away dog off a 15+ win"),
        cell(p, bw & home & dog, "home dog off a 15+ win"),
        cell(p, bl & away & fav, "away favourite off a 15+ LOSS"),
        cell(p, bl & home & fav, "home favourite off a 15+ loss"),
        cell(p, bl & away & dog, "away dog off a 15+ loss"),
        cell(p, bl & home & dog, "home dog off a 15+ loss"),
    ]
    table(rows, "the 2x2x2", PTS)

    table([cell(p, bw, "any team off a 15+ win"),
           cell(p, bl, "any team off a 15+ loss"),
           cell(p, away & fav, "any away favourite (control)"),
           cell(p, p["prev_margin"].abs() < 15, "off a single-digit-ish game (control)")],
          "controls -- is it the blowout or the label?", PTS)

    print("""
  Dose: if 'off a big win' is real it should grade with how big. If it spikes at exactly
  15 and dies either side, it is a number someone mined once and everyone repeated.""")
    rows = []
    for thr in (5, 10, 15, 20, 25, 30):
        rows.append(cell(p, (p["prev_margin"] >= thr) & away & fav,
                         f"away fav, prev win >= {thr}", min_n=25))
    table(rows, "dose ladder, away favourites", PTS)

    rows = []
    for lo, hi in ((5, 10), (10, 15), (15, 20), (20, 25), (25, 60)):
        rows.append(cell(p, (p["prev_margin"] >= lo) & (p["prev_margin"] < hi) & away & fav,
                         f"away fav, prev win {lo}-{hi}", min_n=25))
    table(rows, "disjoint bands (a ladder can look monotone from overlap alone)", PTS)

    best = bw & away & fav
    table(seasons(p, best, "away fav off 15+ win"), "per season", PTS)

    print("""
  And the rest-interaction, because a blowout win usually means starters sat the fourth --
  the mechanism is 'fresher legs', which should show up more on short rest, not less.""")
    table([cell(p, best & (p["own_rest_days"] <= 1), "away fav off 15+ win, 0-1 days rest"),
           cell(p, best & (p["own_rest_days"] >= 2), "away fav off 15+ win, 2+ days rest"),
           cell(p, bw & (p["own_rest_days"] <= 1), "any team off 15+ win, 0-1 days rest"),
           cell(p, bw & (p["own_rest_days"] >= 2), "any team off 15+ win, 2+ days rest")],
          "rest interaction", PTS)


# ===========================================================================================
def h2_trip(p: pd.DataFrame) -> None:
    print("\n" + "=" * 95)
    print("H2  ROAD-TRIP LEG -- and whether a team's architecture changes how it decays")
    print("=" * 95)
    print("""
  leg 1 is the first game of a road trip, leg 2 the second, and so on. Home games are
  excluded entirely. Read 'vs_spr' as points of value per game and 'vs_tot' as points
  the game ran over the posted total.""")

    rows = []
    for lg in (1, 2, 3, 4, 5):
        m = p["trip_leg"] == lg if lg < 5 else p["trip_leg"] >= 5
        rows.append(cell(p, m, f"road trip leg {lg}{'+' if lg == 5 else ''}", min_n=60))
    table(rows, "the leg ladder", BOTH)

    print("""
  Now the architecture cut the owner asked for: does a fast team wear down on the road
  faster than a slow one? Legs 3+ only, split by the travelling team's own pace tier.""")
    deep = p["trip_leg"] >= 3
    rows = [cell(p, deep & (p["own_pace_t"] == t), f"leg 3+, travelling team pace {t}", min_n=40)
            for t in ("low", "mid", "high")]
    rows += [cell(p, (p["trip_leg"] == 1) & (p["own_pace_t"] == t), f"leg 1, pace {t}", min_n=40)
             for t in ("low", "mid", "high")]
    table(rows, "trip depth x own pace", BOTH)

    print("""
  Same cut on experience -- do veteran rotations handle a long trip better than young ones?""")
    rows = [cell(p, deep & (p["own_exp_t"] == t), f"leg 3+, rotation experience {t}", min_n=40)
            for t in ("low", "mid", "high")]
    rows += [cell(p, (p["trip_leg"] <= 1) & (p["own_exp_t"] == t),
                  f"home or leg 1, experience {t}", min_n=40) for t in ("low", "mid", "high")]
    table(rows, "trip depth x rotation experience", BOTH)

    print("""
  And the two-sided version: a deep-trip road team into a HOME team that is itself
  mid-homestand and rested, versus one that is also beaten up.""")
    table([cell(p, deep & (p["o_trip_leg"] == 0) & (p["opp_rest_days"] >= 2),
                "leg 3+ into a rested home team"),
           cell(p, deep & (p["o_trip_leg"] == 0) & (p["opp_rest_days"] <= 1),
                "leg 3+ into a tired home team"),
           cell(p, deep & (p["own_rest_days"] <= 1), "leg 3+ on 0-1 days rest"),
           cell(p, deep & (p["own_rest_days"] >= 2), "leg 3+ on 2+ days rest")],
          "trip depth x the other side", BOTH)


# ===========================================================================================
def h3_sandwich(p: pd.DataFrame) -> None:
    print("\n" + "=" * 95)
    print("H3  THE SANDWICH -- short rest behind AND another road game ahead")
    print("=" * 95)
    print("""
  The owner's exact spot: second game of a road trip, one day off, then another away
  game. Built as trip_leg >= 2, rest <= 1 day, next game away. The schedule lookahead is
  legal -- it is public months in advance.""")

    sw = (p["trip_leg"] >= 2) & (p["own_rest_days"] <= 1) & (p["next_is_away"] == 1)
    table([cell(p, sw, "OWNER'S SPOT: mid-trip, short rest, road game next"),
           cell(p, (p["trip_leg"] >= 2) & (p["own_rest_days"] <= 1),
                "  drop the lookahead: mid-trip on short rest"),
           cell(p, (p["trip_leg"] >= 2) & (p["next_is_away"] == 1),
                "  drop the rest term: mid-trip with a road game next"),
           cell(p, (p["own_rest_days"] <= 1) & (p["next_is_away"] == 1) & (p["trip_leg"] == 0),
                "  at HOME on short rest with a road game next"),
           cell(p, p["trip_leg"] >= 2, "  mid-trip, no other condition")],
          "the spot and its three one-term controls", BOTH)

    print("""
  Then the architecture question stacked on top: is the fatigue spot worse for a
  high-pace team, and does the OPPONENT's pace decide whether points go up or down?""")
    rows = [cell(p, sw & (p["own_pace_t"] == t), f"sandwich, own pace {t}", min_n=30)
            for t in ("low", "mid", "high")]
    rows += [cell(p, sw & (p["opp_pace_t"] == t), f"sandwich, opponent pace {t}", min_n=30)
             for t in ("low", "mid", "high")]
    table(rows, "sandwich x pace architecture", BOTH)

    rows = [cell(p, sw & (p["own_exp_t"] == t), f"sandwich, experience {t}", min_n=30)
            for t in ("low", "mid", "high")]
    table(rows, "sandwich x rotation experience", BOTH)
    table(seasons(p, sw, "sandwich"), "sandwich per season", PTS)


# ===========================================================================================
def h4_style_grid(p: pd.DataFrame) -> None:
    print("\n" + "=" * 95)
    print("H4  STYLE vs STYLE -- the 3x3 the owner asked for")
    print("=" * 95)
    print("""
  Does a fast team play better against another fast team? Rows are the team's own pace
  tier, columns the opponent's. Each cell shows points vs the spread, then points vs the
  total. Every team-game appears once from each side, so the spread grid is
  antisymmetric by construction -- read the DIAGONAL and the corners.""")

    for lbl, key in (("POINTS VS THE SPREAD", "vs_spr"), ("POINTS VS THE TOTAL", "vs_tot"),
                     ("RAW GAME TOTAL", "raw_tot")):
        g = pd.DataFrame(index=["low", "mid", "high"], columns=["low", "mid", "high"], dtype=float)
        nn = g.copy()
        for a in ("low", "mid", "high"):
            for b in ("low", "mid", "high"):
                c = cell(p, (p["own_pace_t"] == a) & (p["opp_pace_t"] == b), "x", min_n=30)
                if c:
                    g.loc[a, b] = c[key]
                    nn.loc[a, b] = c["n"]
        print(f"\n   {lbl}   (rows = own pace, cols = opponent pace)")
        print(g.to_string(float_format=lambda v: f"{v:8.2f}"))
        print("   n:")
        print(nn.to_string(float_format=lambda v: f"{v:8.0f}"))

    print("""
  Same grid for the defensive axis, because 'up and down' is as much about who cannot
  get a stop as who wants to run.""")
    g = pd.DataFrame(index=["low", "mid", "high"], columns=["low", "mid", "high"], dtype=float)
    for a in ("low", "mid", "high"):
        for b in ("low", "mid", "high"):
            c = cell(p, (p["own_def_t"] == a) & (p["opp_def_t"] == b), "x", min_n=30)
            if c:
                g.loc[a, b] = c["vs_tot"]
    print("\n   POINTS VS THE TOTAL   (rows = own def rating tier, cols = opponent's;"
          " 'low' = fewest points allowed)")
    print(g.to_string(float_format=lambda v: f"{v:8.2f}"))

    table([cell(p, (p["own_pace_t"] == "high") & (p["opp_pace_t"] == "high"),
                "both teams fast"),
           cell(p, (p["own_pace_t"] == "low") & (p["opp_pace_t"] == "low"),
                "both teams slow"),
           cell(p, (p["own_pace_t"] == "high") & (p["opp_pace_t"] == "low"),
                "fast into slow (style clash)"),
           cell(p, (p["own_pace_t"] == "high") & (p["opp_pace_t"] == "high")
                & (p["own_def_t"] == "high") & (p["opp_def_t"] == "high"),
                "both fast AND both leaky")],
          "the corners, stated plainly", BOTH)


# ===========================================================================================
def h5_opp_run(p: pd.DataFrame) -> None:
    print("\n" + "=" * 95)
    print("H5  A RUN OF FAST OPPONENTS -- does facing pace three straight games leave a mark")
    print("=" * 95)
    print("""
  seq_opp_pace3 is the average pace of the last three opponents, valued as they were at
  the time. High = this team has just been dragged up and down for a week.""")

    q = p["seq_opp_pace3"]
    hi, lo = q.quantile(0.75), q.quantile(0.25)
    table([cell(p, q >= hi, "last 3 opponents FAST (top quartile)"),
           cell(p, q <= lo, "last 3 opponents SLOW (bottom quartile)"),
           cell(p, (q >= hi) & (p["opp_pace_t"] == "high"), "fast run, and tonight is fast too"),
           cell(p, (q >= hi) & (p["opp_pace_t"] == "low"), "fast run, tonight is a slow team"),
           cell(p, (q >= hi) & (p["trip_leg"] >= 2), "fast run AND mid road trip"),
           cell(p, (q >= hi) & (p["own_exp_t"] == "low"), "fast run, young rotation"),
           cell(p, (q >= hi) & (p["own_exp_t"] == "high"), "fast run, veteran rotation")],
          "recent opponent pace", BOTH)


# ===========================================================================================
def h6_experience(p: pd.DataFrame) -> None:
    print("\n" + "=" * 95)
    print("H6  ROTATION EXPERIENCE as a moderator of travel load")
    print("=" * 95)
    print("""
  Years since draft, minutes-weighted over the trailing 10 games. Not literal age --
  balldontlie has no birthdate -- and it covers 87% of minutes. 'low' is roughly a
  3-year rotation, 'high' roughly 8 years.""")

    table([cell(p, p["own_exp_t"] == t, f"experience {t}, all games") for t in ("low", "mid", "high")],
          "main effect (expect ~0 -- the market knows who is young)", BOTH)

    km = p["own_km_7d"]
    heavy = km >= km.quantile(0.75)
    rows = []
    for t in ("low", "mid", "high"):
        rows.append(cell(p, heavy & (p["own_exp_t"] == t), f"heavy travel week, experience {t}"))
        rows.append(cell(p, ~heavy & (p["own_exp_t"] == t), f"light travel week, experience {t}"))
    table(rows, "travel load x experience", BOTH)

    rows = []
    for t in ("low", "mid", "high"):
        rows.append(cell(p, (p["own_venues_7d"] >= 3) & (p["own_exp_t"] == t),
                         f"3+ arenas in 7 days, experience {t}", min_n=30))
    table(rows, "arena churn x experience", BOTH)

    rows = []
    for t in ("low", "mid", "high"):
        rows.append(cell(p, (p["own_b2b"] == 1) & (p["own_exp_t"] == t),
                         f"back-to-back, experience {t}", min_n=30))
    table(rows, "back-to-back x experience", BOTH)


# ===========================================================================================
def h7_rest_arch(p: pd.DataFrame) -> None:
    print("\n" + "=" * 95)
    print("H7  REST GAP by architecture -- S15 said +2 days is the cell; who does it help most")
    print("=" * 95)
    gap = p["own_rest_days"] - p["opp_rest_days"]
    rows = []
    for g_ in (-2, -1, 0, 1, 2):
        m = (gap == g_) if g_ > -2 else (gap <= -2)
        rows.append(cell(p, m, f"rest gap {g_:+d}{'' if g_ > -2 else ' or worse'}", min_n=60))
    rows.append(cell(p, gap >= 3, "rest gap +3 or more", min_n=40))
    table(rows, "the rest ladder in POINTS (this is S15 restated as attribution)", BOTH)

    print("""
  Who benefits: does two extra days help a fast team or an old team more?""")
    plus2 = gap >= 2
    rows = [cell(p, plus2 & (p["own_pace_t"] == t), f"+2 days rest, own pace {t}", min_n=30)
            for t in ("low", "mid", "high")]
    rows += [cell(p, plus2 & (p["own_exp_t"] == t), f"+2 days rest, experience {t}", min_n=30)
             for t in ("low", "mid", "high")]
    table(rows, "rest advantage x architecture", BOTH)


def main() -> None:
    p = load()
    print(f"panel: {len(p)} regular-season team-games with a closing spread and total")
    print("baseline: vs_spr and vs_tot are POINTS. A fair market gives ~0.00 on both.")
    print("          t of +/-2 is the usual noise floor for ONE test; there are ~150 here,")
    print("          so treat anything under t=3 as a lead, not a finding.")
    h1_blowout(p)
    h2_trip(p)
    h3_sandwich(p)
    h4_style_grid(p)
    h5_opp_run(p)
    h6_experience(p)
    h7_rest_arch(p)


if __name__ == "__main__":
    main()
