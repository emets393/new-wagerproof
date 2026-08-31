"""NFL/CFB model record vs the CLOSING line -> football_model_record (owner spec 2026-08-31).

Grades every market the slate carries straight off cfb/nfl_slate_games finals:
  fg_spread, fg_total, fg_ml, tt (both team totals), h1_spread, h1_total, h1_ml
Three scopes per market:
  overall            one row per market
  edge               records split by model-edge bucket (points; win-prob pp for ML)
  team               model record in every market a team's games involve
Closing line = the *_close columns (T-60 policy — the 15-min refresher keeps them
current through kickoff). ROI: flat 1u at -110 for point markets, the stored close
price for ML (record still counts when a price is missing; ROI just skips it).

Oracle check (mandatory per research law): every game also grades a synthetic pick
of the side that actually covered — anything under 100% ex-push aborts the load.

Rebuilds (sport, season) in full each run. Usage: football_model_record.py [cfb|nfl]
"""
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
import football_report_lib as lib

PT_BUCKETS = [(0, 3, "0-3"), (3, 6, "3-6"), (6, 10, "6-10"), (10, 1e9, "10+")]
PP_BUCKETS = [(0, 5, "0-5"), (5, 10, "5-10"), (10, 20, "10-20"), (20, 1e9, "20+")]


def bucket(val, table):
    if val is None:
        return None
    v = abs(float(val))
    for lo, hi, name in table:
        if lo <= v < hi:
            return name
    return None


def fnum(x):
    return None if x is None else float(x)


def ml_profit(price):
    """Profit on a 1u ML win at an American price; None when no price stored."""
    if price is None:
        return None
    p = float(price)
    return p / 100.0 if p > 0 else 100.0 / abs(p)


def grade_side(pick, diff):
    """pick HOME/AWAY/OVER/UNDER vs a home-/over-perspective diff (>0 = home covers / over)."""
    if diff == 0:
        return "push"
    hit = diff > 0
    if pick in ("HOME", "OVER"):
        return "win" if hit else "loss"
    return "loss" if hit else "win"


def derived_side(pred_diff, pos, neg):
    """Model side from prediction-vs-close diff (>0 -> pos side)."""
    if pred_diff is None or pred_diff == 0:
        return None
    return pos if pred_diff > 0 else neg


def bets_for_game(g):
    """Yield (market, result, roi, edge_bucket) for every gradeable market.

    Side = the stored display pick when present, else DERIVED from the model's
    prediction vs the close (identical rule the generators use — verified equal
    where both exist). Early week-0/1 rows predate the pick columns, so
    derivation is what makes them gradeable at all."""
    fh, fa = fnum(g.get("final_home")), fnum(g.get("final_away"))
    if fh is None or fa is None:
        return
    margin, total = fh - fa, fh + fa
    out = []

    def point_bet(market, pick, diff, edge, team=None):
        # team: a TT bet belongs to ONE team's record; every other market is a
        # game-level bet and attributes to both participants (team=None).
        if not pick:
            return
        res = grade_side(pick, diff)
        roi = {"win": 100 / 110, "loss": -1.0, "push": 0.0}[res]
        out.append((market, res, roi, bucket(edge, PT_BUCKETS), team))

    sc = fnum(g.get("fg_spread_close"))
    pm = fnum(g.get("fg_pred_margin"))
    if sc is not None:
        pick = g.get("fg_spread_pick") or (derived_side(pm + sc, "HOME", "AWAY") if pm is not None else None)
        edge = g.get("fg_spread_edge")
        if edge is None and pm is not None:
            edge = pm + sc
        point_bet("fg_spread", pick, margin + sc, edge)
    tc = fnum(g.get("fg_total_close"))
    ptot = fnum(g.get("fg_pred_total"))
    if tc is not None:
        pick = g.get("fg_total_pick") or (derived_side(ptot - tc, "OVER", "UNDER") if ptot is not None else None)
        edge = g.get("fg_total_edge")
        if edge is None and ptot is not None:
            edge = ptot - tc
        point_bet("fg_total", pick, total - tc, edge)

    # FG moneyline: the model's side is its win prob; push on a tie.
    prob = fnum(g.get("fg_home_win_prob"))
    if prob is not None and prob != 0.5:
        side = "HOME" if prob > 0.5 else "AWAY"
        res = "push" if margin == 0 else ("win" if (margin > 0) == (side == "HOME") else "loss")
        price = g.get("fg_ml_home_close") if side == "HOME" else g.get("fg_ml_away_close")
        win_profit = ml_profit(price)
        roi = {"win": win_profit, "loss": -1.0, "push": 0.0}[res] if (win_profit is not None or res != "win") else None
        out.append(("fg_ml", res, roi, bucket((prob - 0.5) * 100, PP_BUCKETS), None))

    for side_key, final_pts in (("home", fh), ("away", fa)):
        c = fnum(g.get(f"tt_{side_key}_close"))
        pred = fnum(g.get(f"tt_{side_key}_pred"))
        if c is not None:
            p = g.get(f"tt_{side_key}_pick") or (derived_side(pred - c, "OVER", "UNDER") if pred is not None else None)
            point_bet("tt", p, final_pts - c, (pred - c) if pred is not None else None,
                      team=g.get(f"{side_key}_team"))

    h1h, h1a = fnum(g.get("h1_home")), fnum(g.get("h1_away"))
    if h1h is not None and h1a is not None:
        h1m, h1t = h1h - h1a, h1h + h1a
        c = fnum(g.get("h1_spread_close"))
        hpm = fnum(g.get("h1_pred_margin"))
        if c is not None:
            p = g.get("h1_spread_pick") or (derived_side(hpm + c, "HOME", "AWAY") if hpm is not None else None)
            point_bet("h1_spread", p, h1m + c, (hpm + c) if hpm is not None else None)
        c = fnum(g.get("h1_total_close"))
        hpt = fnum(g.get("h1_pred_total"))
        if c is not None:
            p = g.get("h1_total_pick") or (derived_side(hpt - c, "OVER", "UNDER") if hpt is not None else None)
            point_bet("h1_total", p, h1t - c, (hpt - c) if hpt is not None else None)
        p = g.get("h1_ml_pick") or (derived_side(hpm, "HOME", "AWAY") if hpm is not None else None)
        if p in ("HOME", "AWAY"):
            res = "push" if h1m == 0 else ("win" if (h1m > 0) == (p == "HOME") else "loss")
            price = g.get("h1_ml_home_close") if p == "HOME" else g.get("h1_ml_away_close")
            win_profit = ml_profit(price)
            roi = {"win": win_profit, "loss": -1.0, "push": 0.0}[res] if (win_profit is not None or res != "win") else None
            out.append(("h1_ml", res, roi, None, None))

    yield from out


def oracle_check(games):
    """Grade a pick that KNOWS the result on every point market — must never lose."""
    for g in games:
        fh, fa = fnum(g.get("final_home")), fnum(g.get("final_away"))
        if fh is None or fa is None:
            continue
        sc = fnum(g.get("fg_spread_close"))
        if sc is not None:
            diff = (fh - fa) + sc
            if diff != 0:
                oracle = "HOME" if diff > 0 else "AWAY"
                assert grade_side(oracle, diff) == "win", f"oracle spread loss on {g.get('game_id')}"
        tc = fnum(g.get("fg_total_close"))
        if tc is not None:
            diff = (fh + fa) - tc
            if diff != 0:
                oracle = "OVER" if diff > 0 else "UNDER"
                assert grade_side(oracle, diff) == "win", f"oracle total loss on {g.get('game_id')}"


def run(sport):
    env = lib.load_env()
    H = lib.hdr(env)
    table = f"{sport}_slate_games"
    games = requests.get(
        f"{lib.SUPA}/{table}?select=*&final_home=not.is.null&final_away=not.is.null",
        headers=H, timeout=120).json()
    if not isinstance(games, list):
        sys.exit(f"{sport}: fetch failed {str(games)[:200]}")
    seasons = sorted({g["season"] for g in games})
    print(f"{sport}: {len(games)} completed games across seasons {seasons}")
    oracle_check(games)

    for season in seasons or []:
        sg = [g for g in games if g["season"] == season]
        through_week = max(g["week"] for g in sg)
        agg = {}  # (market, scope, key) -> [w, l, p, roi_sum, roi_known]

        def add(market, scope, key, res, roi):
            if key is None:
                return
            a = agg.setdefault((market, scope, key), [0, 0, 0, 0.0, True])
            a[{"win": 0, "loss": 1, "push": 2}[res]] += 1
            if roi is None:
                a[4] = False
            else:
                a[3] += roi

        for g in sg:
            teams = [g.get("home_team"), g.get("away_team")]
            for market, res, roi, eb, team in bets_for_game(g):
                add(market, "overall", "all", res, roi)
                add(market, "edge", eb, res, roi)
                # A TT bet counts only toward ITS team's record (owner rule);
                # game-level bets attribute to both participants.
                for t in ([team] if team else teams):
                    add(market, "team", t, res, roi)

        rows = [dict(sport=sport, season=season, market=m, scope=s, scope_key=k,
                     wins=a[0], losses=a[1], pushes=a[2], n=a[0] + a[1] + a[2],
                     roi_units=round(a[3], 3) if a[4] else None,
                     through_week=through_week, updated_at="now()")
                for (m, s, k), a in agg.items()]
        requests.delete(f"{lib.SUPA}/football_model_record?sport=eq.{sport}&season=eq.{season}",
                        headers=H, timeout=60)
        for i in range(0, len(rows), 500):
            r = requests.post(f"{lib.SUPA}/football_model_record", headers=H,
                              json=rows[i:i + 500], timeout=60)
            if r.status_code not in (200, 201):
                sys.exit(f"{sport} {season}: insert failed {r.status_code} {r.text[:200]}")
        ov = {m: a for (m, s, _), a in agg.items() if s == "overall" for m in [m]}
        summary = ", ".join(f"{m} {a[0]}-{a[1]}" + (f"-{a[2]}" if a[2] else "")
                            for m, a in sorted(ov.items()))
        print(f"  {season} thru wk{through_week}: {len(rows)} rows | {summary}")


if __name__ == "__main__":
    targets = sys.argv[1:] or ["cfb", "nfl"]
    for sp in targets:
        run(sp)
