#!/usr/bin/env python3
"""THE MATCHUP BRIEF — layers 1, 3 and 6 of the conditional chain, both directions.

Spec: .claude/docs/23_prop_card_architecture.md. This is the part of the card that comes BEFORE any
player: the trenches set a condition, the script sets the volume, and every player panel then reads
the column that condition points to.

FOOTBALL LOGIC, stated so it can be argued with:

 1. PRESSURE IS A PRODUCT OF BOTH SIDES. A 37%-pressure offensive line against a rush that generates
    22% does not produce 37%, and it does not produce 22%. The standard reading is additive in rate
    space around the league mean: expected = OL_allowed + DL_generated - league. It is a matchup
    expectation, not a forecast, and both inputs are printed beside it so the reader can disagree.

 2. OVER-EXPECTED IS THE QUALITY MEASURE. Raw pressure rate rewards a defense that blitzes constantly
    and punishes a line that faces good rushes. `PressuredOverExpected` nets out how often they send
    it, so it is the honest read on whether a unit is actually good. Both are shown; they sometimes
    disagree, and when they do that IS the story.

 3. THE SPREAD PICKS THE SCRIPT BUCKET. An 8-point favourite plays most of its snaps leading, and
    teams call plays differently leading than trailing. Using the market's own number to choose which
    situational bucket to read is not a prediction — it is reading the market. `runPassReport` carries
    pass rate by Leading / Trailing / Neutral, so the brief prints all three and says which one the
    line points at.

 4. VOLUME IS SHARED. Both teams run roughly the same number of plays, so a team's expected snaps is
    its own pace adjusted by what the opponent's defense has been on the field for.

⚠ DEFENSE IS `teamNickname` IN EVERY `*__opponent` TABLE (verified at 100% on 2,829 rows) and
`opponentAbbreviation` in the PLAYER tables. Getting that backwards publishes the other team's
identity, which it did once.
"""
from __future__ import annotations
import argparse, json
import numpy as np, pandas as pd
from pathlib import Path

HERE = Path(__file__).resolve().parent
D = HERE / "data" / "fpdata"
num = lambda s: pd.to_numeric(s, errors="coerce")
AB = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
NICK = {"Cardinals": "ARZ", "Falcons": "ATL", "Ravens": "BLT", "Bills": "BUF", "Panthers": "CAR",
        "Bears": "CHI", "Bengals": "CIN", "Browns": "CLV", "Cowboys": "DAL", "Broncos": "DEN",
        "Lions": "DET", "Packers": "GB", "Texans": "HST", "Colts": "IND", "Jaguars": "JAX",
        "Chiefs": "KC", "Rams": "LA", "Chargers": "LAC", "Raiders": "LV", "Dolphins": "MIA",
        "Vikings": "MIN", "Patriots": "NE", "Saints": "NO", "Giants": "NYG", "Jets": "NYJ",
        "Eagles": "PHI", "Steelers": "PIT", "Seahawks": "SEA", "49ers": "SF", "Buccaneers": "TB",
        "Titans": "TEN", "Commanders": "WAS"}
ab = lambda s: pd.Series(s).map(lambda x: AB.get(x, x))
ORD = lambda n: f"{int(n)}{'th' if 11 <= int(n) % 100 <= 13 else {1:'st',2:'nd',3:'rd'}.get(int(n) % 10, 'th')}"


def load(t, season, weeks):
    d = pd.read_parquet(D / f"{t}.parquet")
    return d[(d.gameSeason == season) & (d.gameWeek.isin(weeks))].copy()


def rank_of(series, team, most_is_first=True):
    s = series.dropna()
    if team not in s.index:
        return None, len(s)
    v = s[team]
    r = int((s > v).sum()) + 1 if most_is_first else int((s < v).sum()) + 1
    return r, len(s)


def place(r, of, most="most", fewest="fewest"):
    if r is None:
        return ""
    return f"{ORD(r)}-{most} of {of}" if r <= (of + 1) // 2 else f"{ORD(of - r + 1)}-{fewest} of {of}"


# ------------------------------------------------------------------ layer 1: the trenches
def trenches(season, weeks):
    lm = load("lineMatchups__team", season, weeks)
    lm["t"] = ab(lm.teamAbbreviation)
    g = lm.groupby("t").agg(
        ol_press=("teamStatsPassingPressuredPercentage", lambda x: num(x).mean()),
        ol_press_oe=("teamStatsPassingPressuredOverExpected", lambda x: num(x).mean()),
        ol_ybc=("teamStatsRushingYardsBeforeContactTotal", lambda x: num(x).sum()),
        ol_att=("teamStatsRushingAttemptsTotal", lambda x: num(x).sum()),
        dl_press=("opponentStatsPassingPressuredPercentage", lambda x: num(x).mean()),
        dl_press_oe=("opponentStatsPassingPressuredOverExpected", lambda x: num(x).mean()),
        dl_ybc=("opponentStatsRushingYardsBeforeContactTotal", lambda x: num(x).sum()),
        dl_att=("opponentStatsRushingAttemptsTotal", lambda x: num(x).sum()))
    g["ol_ybc_att"] = g.ol_ybc / g.ol_att
    g["dl_ybc_att"] = g.dl_ybc / g.dl_att
    ra = load("rushingAdvanced__opponent", season, weeks)
    ra["t"] = ab(ra.teamNickname.map(NICK))            # defense = teamNickname
    d = ra.groupby("t").agg(
        stuff=("opponentStatsRushingAttemptsStuffsPercentage", lambda x: num(x).mean()),
        run_succ=("opponentStatsRushingAttemptsSuccessPercentage", lambda x: num(x).mean()),
        expl=("opponentStatsRushingRunsExplosivePercentage", lambda x: num(x).mean()))
    return g.join(d, how="left")


# ------------------------------------------------------------------ layer 3: volume
def volume(season, weeks):
    pr = load("proeReport__team", season, weeks)
    pr["t"] = ab(pr.teamNickname.map(NICK))
    # NOT `drop`: that attribute is DataFrame.drop, so o.drop returns the METHOD and the
    # arithmetic below fails with "unsupported operand type(s) for -: 'method' and 'float'".
    o = pr.groupby("t").agg(snaps=("teamStatsSnapsOffenseTotal", lambda x: num(x).mean()),
                            dbk=("teamStatsPassingDropbacksTotal", lambda x: num(x).mean()),
                            dbk_exp=("teamStatsPassingDropbacksExpected", lambda x: num(x).mean()))
    o["proe"] = o.dbk - o.dbk_exp
    po = load("proeReport__opponent", season, weeks)
    po["t"] = ab(po.teamNickname.map(NICK))            # defense = teamNickname
    d = po.groupby("t").agg(
        snaps_faced=("opponentStatsSnapsOffenseTotal", lambda x: num(x).mean()),
        dbk_faced=("opponentStatsPassingDropbacksTotal", lambda x: num(x).mean()))
    return o.join(d, how="left")


# ------------------------------------------------------------------ layers 3+6: the script
SCRIPT = ["bucketNeutral", "bucketLeading", "bucketTrailing", "bucketFirstDown",
          "bucketThirdDown", "bucketInside10", "bucketInside20", "bucketUnder5", "bucketOver10"]


def script(season, weeks):
    rp = load("runPassReport__team", season, weeks)
    rows = []
    for r in rp.itertuples(index=False):
        b = getattr(r, "bucket", None)
        if not isinstance(b, dict):
            continue
        t = AB.get(NICK.get(r.teamNickname), NICK.get(r.teamNickname))
        for k in SCRIPT:
            c = b.get(k)
            if not isinstance(c, dict):
                continue
            p, ru = c.get("teamStatsSnapsOffensePass"), c.get("teamStatsSnapsOffenseRush")
            if p is None and ru is None:
                continue
            rows.append({"t": t, "bucket": k.replace("bucket", ""),
                         "p": p or 0.0, "r": ru or 0.0})
    S = pd.DataFrame(rows)
    g = S.groupby(["t", "bucket"], as_index=False).agg(p=("p", "sum"), r=("r", "sum"))
    g["pass_rate"] = g.p / (g.p + g.r).replace(0, np.nan)
    g["snaps"] = g.p + g.r
    return g


def side(name, off, de, T, V, SC, spread_off):
    """One direction of the matchup: `off` has the ball, `de` is defending."""
    print(f"\n  {'─'*96}\n  {off} OFFENSE  vs  {de} DEFENSE")
    lg_press = T.ol_press.mean()
    exp = T.ol_press[off] + T.dl_press[de] - lg_press
    r_ol, n_ol = rank_of(T.ol_press, off)
    r_dl, n_dl = rank_of(T.dl_press, de)
    print(f"    PASS RUSH   {off} OL allows {T.ol_press[off]:.1%} pressure ({place(r_ol,n_ol,'most','fewest')} "
          f"allowed) · {de} DL generates {T.dl_press[de]:.1%} ({place(r_dl,n_dl)})")
    print(f"                -> expected pressure in this game ~{exp:.1%}  (league {lg_press:.1%})")
    oe_o, oe_d = T.ol_press_oe[off], T.dl_press_oe[de]
    print(f"                quality-adjusted: OL {oe_o:+.1%} over expected, DL {oe_d:+.1%} "
          f"-> net {oe_o + oe_d:+.1%}")
    lg_ybc = T.ol_ybc_att.mean()
    exp_ybc = T.ol_ybc_att[off] + T.dl_ybc_att[de] - lg_ybc
    r_y, n_y = rank_of(T.ol_ybc_att, off)
    r_s, n_s = rank_of(T.stuff, de)
    print(f"    RUN BLOCK   {off} OL {T.ol_ybc_att[off]:.2f} yds before contact/carry "
          f"({place(r_y,n_y)}) · {de} DL stuffs {T.stuff[de]:.1%} ({place(r_s,n_s)}), "
          f"run-success allowed {T.run_succ[de]:.1%}")
    print(f"                -> expected yards before contact ~{exp_ybc:.2f}/carry  (league {lg_ybc:.2f})")
    lg_sn = V.snaps.mean()
    exp_sn = V.snaps[off] + V.snaps_faced[de] - lg_sn
    lg_dr = V.dbk.mean()
    exp_dr = V.dbk[off] + V.dbk_faced[de] - lg_dr
    print(f"    VOLUME      {off} {V.snaps[off]:.1f} snaps/g, {V.dbk[off]:.1f} dropbacks "
          f"(PROE {V.proe[off]:+.1f}) · {de} faces {V.snaps_faced[de]:.1f} snaps, "
          f"{V.dbk_faced[de]:.1f} dropbacks")
    print(f"                -> expected ~{exp_sn:.0f} snaps, ~{exp_dr:.0f} dropbacks, "
          f"~{max(exp_sn - exp_dr, 0):.0f} carries")
    s = SC[SC.t == off].set_index("bucket")
    want = "Leading" if spread_off < 0 else ("Trailing" if spread_off > 0 else "Neutral")
    # Two routes to dropbacks, and they should be shown together: the additive volume estimate
    # embeds this team's SEASON script, while snaps x the script-bucket pass rate uses the script the
    # SPREAD implies. A heavy favourite passes less than its season average, and the additive number
    # cannot know that.
    if want in s.index and np.isfinite(exp_sn):
        exp_dr_script = exp_sn * s.pass_rate[want]
        print(f"                -> {want.lower()}-script route: {exp_sn:.0f} snaps x "
              f"{s.pass_rate[want]:.0%} pass = ~{exp_dr_script:.0f} dropbacks, "
              f"~{exp_sn - exp_dr_script:.0f} carries")
    else:
        exp_dr_script = exp_dr
    bits = []
    for b in ["Neutral", "Leading", "Trailing"]:
        if b in s.index:
            bits.append(f"{b.lower()} {s.pass_rate[b]:.0%}" + (" <-" if b == want else ""))
    print(f"    SCRIPT      pass rate: " + " · ".join(bits))
    extra = [f"{b} {s.pass_rate[b]:.0%}" for b in ["ThirdDown", "Inside10", "Inside20", "Under5"]
             if b in s.index]
    if extra:
        print(f"                situational: " + " · ".join(extra))
    print(f"                {off} are {spread_off:+.1f} — most snaps come {want.upper()}, "
          f"so the {want.lower()} rate is the one to read.")
    # The NEUTRAL-script counterpart of exp_dropbacks_script, so a consumer can read the script
    # effect as a relative move instead of against the team's season average.
    # ⛔ exp_dropbacks_script vs own_dropbacks IS NOT A FAIR COMPARISON and must not be used as
    # one. `pass_rate[want]` is the rate WITHIN one script bucket, while exp_sn is the whole
    # game's snaps, so the product assumes the team is in that state for 100% of its snaps. A
    # favourite's Leading rate sits well below its season rate, so the implied count came in
    # under the season average almost every time: measured on 2026 wk5, implied dropbacks
    # averaged 29.6 against an own 36.2 (-18.4%, negative on 72% of players) and the carries
    # branch was biased +21.1% the other way because exp_sn - exp_dr_script absorbs the whole
    # shortfall. That one error produced 180 under tells against 69 over in F1 and is most of
    # why the week-5 board came out 14 of 15 unders. Compare like with like: bucket vs bucket.
    neutral_rate = s.pass_rate["Neutral"] if "Neutral" in s.index else None
    return {"exp_pressure": exp, "exp_ybc": exp_ybc, "exp_dropbacks": exp_dr,
            "exp_dropbacks_script": exp_dr_script, "exp_snaps": exp_sn, "script": want,
            "pass_rate_script": s.pass_rate[want] if want in s.index else None,
            "pass_rate_neutral": float(neutral_rate) if neutral_rate is not None else None,
            "exp_dropbacks_neutral": (float(exp_sn * neutral_rate)
                                      if neutral_rate is not None and np.isfinite(exp_sn) else None)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--home", required=True); ap.add_argument("--away", required=True)
    ap.add_argument("--spread-home", type=float, required=True,
                    help="closing home spread, e.g. -8.0")
    ap.add_argument("--total", type=float)
    ap.add_argument("--season", type=int, default=2026); ap.add_argument("--through", type=int, default=4)
    a = ap.parse_args()
    weeks = list(range(1, a.through + 1))
    T, V, SC = trenches(a.season, weeks), volume(a.season, weeks), script(a.season, weeks)
    print("=" * 100)
    print(f"MATCHUP BRIEF — {a.away} @ {a.home}   {a.home} {a.spread_home:+.1f}"
          + (f", total {a.total}" if a.total else "") + f"   (through {a.season} week {a.through})")
    out = {}
    out[a.home] = side("home", a.home, a.away, T, V, SC, a.spread_home)
    out[a.away] = side("away", a.away, a.home, T, V, SC, -a.spread_home)
    print()


if __name__ == "__main__":
    main()
