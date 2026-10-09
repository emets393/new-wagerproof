#!/usr/bin/env python3
"""SPOTLIGHT QUALIFICATION — families, caps, per-market eligibility, the bar.

Implements .claude/docs/28_spotlight_qualification.md. Each FAMILY contributes at most +/-1.0 no
matter how many of its dimensions fire, because correlated dimensions were inflating the count: one
fact about a defense's Cover-3 rate used to produce three separate votes.

A family's direction is read from the MATCHUP, not from the player's average against the line —
recent form is priced into these lines and stays context, weight 0.
"""
from __future__ import annotations
import argparse, json, os, sys
import numpy as np, pandas as pd
from pathlib import Path
import fp_matchup_layers as L

HERE = Path(__file__).resolve().parent
D = HERE / "data" / "fpdata"
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
num = lambda s: pd.to_numeric(s, errors="coerce")
fin = lambda v: v is not None and isinstance(v, (int, float, np.floating, np.integer)) and np.isfinite(float(v))

# eligibility: '*' counts, 'c' context only, absent = excluded (doc 28 §3)
ELIG = {
 ("RECV", "player_reception_yds"):  dict(F1="*", F2="c", F3="*", F4="*", F5="*", F6="*", F8="*", F9="*", F10="c"),
 ("RECV", "player_receptions"):     dict(F1="*", F2="c", F3="*", F4="c", F5="*", F6="*", F8="*", F9="*", F10="c"),
 ("RECV", "player_anytime_td"):     dict(F1="*", F3="c", F5="c", F6="*", F7="*", F10="*"),
 ("RB",   "player_rush_yds"):       dict(F1="*", F2="*", F3="*", F6="*", F7="c", F8="*", F10="*"),
 ("RB",   "player_rush_attempts"):  dict(F1="*", F2="c", F6="*", F7="c", F10="*"),
 ("RB",   "player_receptions"):     dict(F1="*", F2="c", F3="*", F4="*", F5="*", F6="*", F8="*", F9="*", F10="c"),
 ("RB",   "player_reception_yds"):  dict(F1="*", F2="c", F3="*", F4="*", F5="*", F6="*", F8="*", F9="*", F10="c"),
 ("RB",   "player_anytime_td"):     dict(F1="*", F2="*", F6="*", F7="*", F10="*"),
 ("QB",   "player_pass_yds"):       dict(F1="*", F2="*", F3="*", F4="*", F6="*", F8="*", F9="*", F10="*"),
 ("QB",   "player_pass_attempts"):  dict(F1="*", F2="*", F6="*", F10="*"),
 ("QB",   "player_pass_completions"):dict(F1="*", F2="*", F3="c", F4="*", F6="*", F8="*", F10="*"),
 ("QB",   "player_pass_tds"):       dict(F1="*", F2="c", F3="c", F6="*", F7="*", F10="*"),
 ("QB",   "player_rush_yds"):       dict(F1="*", F2="*", F6="*", F7="c", F8="*", F9="*", F10="*"),
 ("QB",   "player_anytime_td"):     dict(F1="*", F2="*", F6="*", F7="*", F10="*"),
}
for _k in list(ELIG):
    ELIG[_k]["F13"] = "*"          # narratives apply to every market
    ELIG[_k]["F14"] = "*"          # prop signals too, weighted by their own record
    ELIG[_k]["F15"] = "*"          # vacated usage — who is OUT around him
    ELIG[_k]["F16"] = "*"          # situational splits — primetime / divisional / home-away
    ELIG[_k]["F17"] = "*"          # route depth vs what the defense defends
    ELIG[_k]["F18"] = "*"          # his own tendency, trigger live (2023-25 fitted)
    ELIG[_k]["F19"] = "*"          # validated storylines, population base rates
    ELIG[_k]["F20"] = "*"          # the play-caller's situational shift
    ELIG[_k]["F21"] = "*"          # usage tercile -> the busy receiver goes under
ELIG[("RECV", "player_targets")] = dict(F1="*", F2="c", F3="c", F5="c", F6="*", F9="*", F10="*", F13="*", F14="*")
GROUP = {"WR": "RECV", "TE": "RECV", "RB": "RB", "FB": "RB", "QB": "QB"}
# ⛔ ROUTE DEPTH IS OFF BY DEFAULT — it graded ANTI-PREDICTIVE. As a full-weight family it took
# the board from 53.3% to 47.4% over 274 picks. Inverting the sign gave +2.6pp in 2025 and -1.3pp
# in 2026, i.e. a coin flip being fitted to the larger season, so it was not flipped. The data is
# still computed and sits on the card as DISPLAY (readers want "he runs it at 12.4 yards"); it
# just does not vote. Do not switch this on without a fresh walk-forward.
DEPTH_ON = False       # ablation switch for the route-depth family
DEPTH_SIGN = 1         # +1 = deeper-than-defended reads OVER; -1 inverts it

# (measure, position) -> (33rd, 67th percentile) of that usage share among this week's players.
# Populated by build_share_bands() before any family runs; empty means the share tell is skipped,
# which is the right failure (no band = no claim) rather than falling back to a fixed cutoff.
SHARE_BANDS = {}


def build_share_bands(P):
    """Terciles of target/carry share per position, from the slate itself.

    Fixed cutoffs (>=0.26 over, <=0.12 under) were not symmetric around the distribution: most
    pass-catchers on a roster sit below 12% while 26%+ is rare, so the pair fired 184 under
    against 32 over on 2026 wk5 and dragged the whole board one way. Terciles fire about equally
    often by construction, and they re-centre each week instead of baking in one slate's shape.
    """
    import json as _json
    rows = []
    for r in P.itertuples(index=False):
        role = getattr(r, "role", None)
        role = _json.loads(role) if isinstance(role, str) else (role or {})
        pos = getattr(r, "position", None) or role.get("position")
        for m in ("target_share", "carry_share"):
            v = role.get(m)
            if pos and fin(v):
                rows.append((m, pos, float(v)))
    if not rows:
        print("  [bands] no usage shares in the payload — F1's share tell will not fire")
        return
    df = pd.DataFrame(rows, columns=["measure", "pos", "v"])
    for (m, pos), g in df.groupby(["measure", "pos"]):
        if len(g) >= 12:                       # too few and a tercile is noise, not a band
            SHARE_BANDS[(m, pos)] = (float(g.v.quantile(1 / 3)), float(g.v.quantile(2 / 3)))
    shown = ", ".join(f"{m.split('_')[0]}/{pos} {lo:.0%}-{hi:.0%}"
                      for (m, pos), (lo, hi) in sorted(SHARE_BANDS.items()))
    print(f"  [bands] {shown}")
# which position-allowance measure each market reads, and whether aDOT helps or hurts it
ALLOW_KEY = {"player_reception_yds": "rec_yds", "player_receptions": "receptions",
             "player_targets": "targets", "player_anytime_td": None,
             "player_rush_yds": "rush_yds", "player_rush_attempts": "rush_att",
             "player_pass_yds": "pass_yds", "player_pass_attempts": "pass_att",
             "player_pass_completions": "pass_att", "player_pass_tds": "pass_tds"}
# sample gates (doc 28 §5)
G_ROUTE_HIS, G_ROUTE_DEF, G_SPLIT, G_DEF_GAMES = 15, 40, 15, 3


def key(env="SUPABASE_SERVICE_KEY"):
    for p in (HERE / ".." / ".." / ".env.local",):
        if p.exists():
            for ln in open(p):
                if ln.startswith(env + "="):
                    return ln.split("=", 1)[1].strip()
    return os.environ.get(env, "")


def write_board(season, week, board):
    """Upsert the week's board into nfl_prop_spotlight.

    The pick is STAMPED HERE and never recomputed: `side`, `line` and the tells are what the
    reader was shown, so grading has to score that, not whatever the model would say later. Rows
    are upserted on (season, week, player_id, market), so a re-run during the week updates a pick
    that has not been graded yet and is idempotent.

    ⛔ `narrative` is deliberately NOT written here. fp_spotlight_write.py fills it afterwards and
    a blank one is a valid state, so this must not overwrite a narrative that has already landed
    (Prefer: merge-duplicates replaces the whole row, so the column is simply omitted from the
    payload and keeps its stored value).
    """
    import requests
    if not board:
        print("[spotlight] nothing qualified — board not written")
        return 0
    k = key()

    def num_(v):
        """NaN / inf -> None. json.dumps emits bare NaN, which PostgREST rejects for the WHOLE
        batch with "Out of range float values are not JSON compliant" — so one unpriced line
        silently cost the entire board (hit 2026-10-07: 6 of 15 picks never landed and the
        narrative step then had nothing to attach to)."""
        if v is None:
            return None
        try:
            f = float(v)
        except (TypeError, ValueError):
            return v
        return None if (f != f or f in (float("inf"), float("-inf"))) else f

    rows = [dict(season=season, week=week, player_id=str(b["player_id"]),
                 player_name=b.get("player"), position=b.get("pos"),
                 team=b.get("team"), opponent=b.get("opp"),
                 market=b["market"], market_label=b.get("market_label"),
                 side=b["direction"], line=num_(b.get("line")), net=num_(b.get("net")),
                 n_for=b.get("n_for"), n_against=b.get("n_against"),
                 board_rank=b.get("board_rank"), tells=b.get("tells"),
                 headshot_url=b.get("headshot_url"), updated_at="now()")
            for b in board if b.get("player_id")]
    skipped = len(board) - len(rows)
    if skipped:
        print(f"[spotlight] ! {skipped} board rows have no player_id and cannot be graded — skipped")
    r = requests.post(f"{SUPA}/nfl_prop_spotlight?on_conflict=season,week,player_id,market",
                      headers={"apikey": k, "Authorization": f"Bearer {k}",
                               "Content-Type": "application/json",
                               "Prefer": "resolution=merge-duplicates,return=minimal"},
                      json=rows, timeout=120)
    if r.status_code not in (200, 201, 204):
        raise SystemExit(f"[spotlight] write failed ({r.status_code}): {r.text[:300]}")
    # Remove picks this week no longer carries. Without it a re-run after a scoring change
    # leaves the previous board's qualifiers behind as phantom picks that were never withdrawn —
    # and an UNGRADED one would still be shown to readers. Graded rows are kept: a settled bet
    # stays on the record even if the engine would no longer make it.
    keep = {(r["player_id"], r["market"]) for r in rows}
    existing = requests.get(f"{SUPA}/nfl_prop_spotlight?season=eq.{season}&week=eq.{week}"
                            f"&result=is.null&select=id,player_id,market",
                            headers={"apikey": k, "Authorization": f"Bearer {k}"}, timeout=60)
    stale = [str(x["id"]) for x in (existing.json() if existing.ok else [])
             if (str(x["player_id"]), x["market"]) not in keep]
    if stale:
        d = requests.delete(f"{SUPA}/nfl_prop_spotlight?id=in.({','.join(stale)})",
                            headers={"apikey": k, "Authorization": f"Bearer {k}",
                                     "Prefer": "return=minimal"}, timeout=60)
        print(f"[spotlight] withdrew {len(stale)} ungraded picks no longer on the board"
              if d.ok else f"[spotlight] ! stale cleanup failed ({d.status_code})")
    print(f"[spotlight] wrote {len(rows)} picks -> nfl_prop_spotlight {season} wk{week}")
    return len(rows)


def fetch(table, params):
    import requests
    k = key(); h = {"apikey": k, "Authorization": f"Bearer {k}"}
    out, off = [], 0
    while True:
        r = requests.get(f"{SUPA}/{table}?{params}&limit=1000&offset={off}", headers=h, timeout=90)
        j = r.json()
        if r.status_code != 200 or not isinstance(j, list):
            raise SystemExit(f"[spotlight] {table} query failed ({r.status_code}): "
                             f"{str(j)[:300]}\n  params: {params}")
        out += j
        if len(j) < 1000:
            return out
        off += 1000


def rel(a, b):
    """signed relative gap, guarded"""
    if not fin(a) or not fin(b) or float(b) == 0:
        return None
    return (float(a) - float(b)) / abs(float(b))


def tell(d, w, src, text):
    return {"dir": d, "w": w, "src": src, "text": text}


# ---------------------------------------------------------------- the families
def _script_volume(br, passing):
    """The script's effect on volume, as a BUCKET-vs-BUCKET relative move.

    ⛔ Never compare exp_dropbacks_script to own_dropbacks. That product applies one script
    bucket's pass rate to the whole game's snaps, so it reads as though the team spends every
    snap in that state; a favourite's Leading rate is far below its season rate and the count
    came in low almost every time (-18.4% mean, negative on 72% of players on 2026 wk5), while
    the carries branch ran +21.1% the other way because it absorbs the same shortfall. That
    single comparison produced 180 under tells against 69 over and is most of why the week-5
    board came out 14 of 15 unders.

    The script question is relative — "does this matchup push them to throw more or less than
    normal?" — so compare the implied bucket against the NEUTRAL bucket. `exp_snaps` cancels, the
    read is unbiased by construction, and a favourite expected to sit on a lead still reads under
    while a dog expected to chase reads over.
    """
    r_s, r_n = br.get("pass_rate_script"), br.get("pass_rate_neutral")
    if not fin(r_s) or not fin(r_n):
        return None, None, None
    a, b = (r_s, r_n) if passing else (1.0 - r_s, 1.0 - r_n)
    if b <= 0:
        return None, None, None
    return (a - b) / b, a, b


def F1_role(B, R, br, pos, mkt):
    """Does the MATCHUP give him more or less volume than his own norm?"""
    out = []
    passing = pos == "QB" or mkt in ("player_pass_yds", "player_pass_attempts",
                                     "player_pass_completions", "player_pass_tds")
    rushing = mkt in ("player_rush_yds", "player_rush_attempts")
    if passing or not rushing:
        g, a, b = _script_volume(br, True)
        if g is not None and abs(g) >= 0.06:
            exp = br.get("exp_dropbacks_script")
            out.append(tell("over" if g > 0 else "under", 1.0, "volume",
                            f"the {br.get('script', 'expected').lower()} script they project into "
                            f"throws on {a*100:.0f}% of snaps against {b*100:.0f}% in a neutral "
                            f"game ({g*100:+.0f}%), about {exp:.0f} dropbacks"
                            if fin(exp) else
                            f"the {br.get('script', 'expected').lower()} script they project into "
                            f"throws on {a*100:.0f}% of snaps against {b*100:.0f}% in a neutral "
                            f"game ({g*100:+.0f}%)"))
    if rushing:
        g, a, b = _script_volume(br, False)
        if g is not None and abs(g) >= 0.08:
            out.append(tell("over" if g > 0 else "under", 1.0, "volume",
                            f"the {br.get('script', 'expected').lower()} script they project into "
                            f"runs on {a*100:.0f}% of snaps against {b*100:.0f}% in a neutral "
                            f"game ({g*100:+.0f}%)"))
    # Usage share, scored against the field rather than a fixed number. Fixed cutoffs were
    # wildly one-sided because they are not symmetric around the distribution: a <=12% target
    # share describes most pass-catchers on a roster while >=26% is rare, so the pair fired 184
    # under against 32 over. The percentile bands below fire by construction about equally often.
    if rushing:
        sh, band = R.get("carry_share"), SHARE_BANDS.get(("carry_share", pos))
        if fin(sh) and band:
            lo, hi = band
            if sh >= hi:
                out.append(tell("over", 0.5, "role", f"he takes {sh*100:.0f}% of the carries, "
                                                     f"a top-third workload for the position"))
            elif sh <= lo:
                out.append(tell("under", 0.5, "role", f"only {sh*100:.0f}% of the carries, "
                                                      f"a bottom-third workload"))
    else:
        # ⛔ THIS TELL WAS POINTED THE WRONG WAY. It scored a top-third target share as OVER
        # because a bigger role "should" mean more production. Measured on 7,261 receiving lines
        # (2025-26), the over rate by usage tercile is 53.8% / 47.7% / 45.3% — MONOTONE, and the
        # same shape on xfp_share (55.6% / 46.0% / 45.2%). The market prices the busy receiver
        # generously and he goes UNDER; it is the low-usage one who clears. Held in both the 2025
        # fit and the 2026 holdout (r -0.089 / -0.072), above a 0.058 placebo floor.
        # This single tell is most of why receiving graded 45.5%: the engine was systematically
        # backing the obvious name. See exp_prop_feature_screen.py.
        sh, band = R.get("target_share"), SHARE_BANDS.get(("target_share", pos))
        if fin(sh) and band:
            lo, hi = band
            if sh >= hi:
                out.append(tell("under", 0.5, "role",
                                f"he runs {sh*100:.0f}% of the target share — a top-third role, "
                                f"and the line is usually set generously for it"))
            elif sh <= lo:
                out.append(tell("over", 0.5, "role",
                                f"only a {sh*100:.0f}% target share, a bottom-third role — "
                                f"these lines sit low enough to clear"))
    return out


def F2_trench(br, T, team, opp, mkt, pos):
    out, lg = [], T.ol_press.mean()
    if mkt in ("player_rush_yds", "player_rush_attempts", "player_anytime_td") and pos in ("RB", "FB"):
        g = rel(br["exp_ybc"], T.ol_ybc_att.mean())
        if g is not None and abs(g) >= 0.12:
            out.append(tell("over" if g > 0 else "under", 1.0, "trenches",
                            f"expected {br['exp_ybc']:.2f} yards before contact a carry against a "
                            f"league {T.ol_ybc_att.mean():.2f} ({g*100:+.0f}%)"))
        st = T.stuff[opp]
        if fin(st) and abs(st - T.stuff.mean()) >= 0.05:
            out.append(tell("under" if st > T.stuff.mean() else "over", 0.5, "trenches",
                            f"they stuff {st*100:.0f}% of carries (league {T.stuff.mean()*100:.0f}%)"))
    else:
        g = rel(br["exp_pressure"], lg)
        if g is not None and abs(g) >= 0.12:
            # pressure hurts passing production; for pass ATTEMPTS it works through sacks instead
            d = "under" if g > 0 else "over"
            out.append(tell(d, 1.0, "trenches",
                            f"expected pressure {br['exp_pressure']*100:.0f}% against a league "
                            f"{lg*100:.0f}% ({g*100:+.0f}%)"))
    return out


def F3_scheme(S, CV, RC, pos, mkt):
    out = []
    shells = S.get("defense_shells", {})
    if pos in ("RB", "FB") and mkt in ("player_rush_yds", "player_rush_attempts"):
        by, ov = RC.get("by", {}), RC.get("overall", {}) or {}
        for cp, b in by.items():
            n = (b.get("attempts") or 0) * (b.get("games") or 0)
            if n < G_SPLIT or not fin(b.get("def_yards_per_attempt")):
                continue
            mine = rel(b.get("yards_per_attempt"), ov.get("yards_per_attempt"))
            theirs = rel(b.get("def_yards_per_attempt"), b.get("def_yards_per_attempt_league"))
            if mine is None or theirs is None:
                continue
            if mine > 0.10 and theirs > 0.05:
                out.append(tell("over", 1.0, "scheme",
                    f"on {cp.lower()} runs he gains {b['yards_per_attempt']:.2f} a carry "
                    f"({mine*100:+.0f}% on his own average) and they concede "
                    f"{b['def_yards_per_attempt']:.2f} ({theirs*100:+.0f}% vs league)"))
            elif mine < -0.10 and theirs < -0.05:
                out.append(tell("under", 1.0, "scheme",
                    f"on {cp.lower()} runs he gains {b['yards_per_attempt']:.2f} ({mine*100:+.0f}%) "
                    f"into a front that allows {b['def_yards_per_attempt']:.2f} ({theirs*100:+.0f}%)"))
        return out
    by, ov = CV.get("by", {}), CV.get("overall", {}) or {}
    top = max(((c, shells.get(c + "_rate_actual")) for c in by
               if fin(shells.get(c + "_rate_actual"))), key=lambda x: x[1], default=(None, None))
    if top[0]:
        b = by.get(top[0], {})
        n = (b.get("routes") or 0) * (b.get("games") or 0)
        g = rel(b.get("yards_per_route"), ov.get("yards_per_route"))
        if n >= G_SPLIT and g is not None and abs(g) >= 0.12:
            lab = {"Man": "man", "Cover2": "Cover 2", "Cover3": "Cover 3",
                   "Cover4": "Cover 4", "Cover6": "Cover 6"}.get(top[0], top[0])
            out.append(tell("over" if g > 0 else "under", 1.0, "coverage",
                f"they play {lab} most ({top[1]*100:.0f}% of dropbacks) and against it he runs "
                f"{b['yards_per_route']:.2f} yards a route, {g*100:+.0f}% on his own average "
                f"({n:.0f} routes)"))
    return out


def F4_tree(RT, RTO, TD, pos, mkt):
    """His tree weighted by what they concede on exactly those routes / depths."""
    out, lift, share = [], 0.0, 0.0
    src = TD.get("by", {}) if pos == "QB" else None
    if pos == "QB":
        ov = TD.get("overall", {}) or {}
        for d_, b in (src or {}).items():
            n = (b.get("attempts") or 0) * (b.get("games") or 0)
            if n < G_SPLIT or not fin(b.get("def_yards_per_attempt")):
                continue
            w = (b.get("attempts") or 0) / max(ov.get("attempts") or 1, 1)
            t = rel(b.get("def_yards_per_attempt"), b.get("def_yards_per_attempt_league"))
            if t is not None:
                lift += w * t; share += w
        if share >= 0.4 and abs(lift) >= 0.05:
            out.append(tell("over" if lift > 0 else "under", 1.0, "depth",
                f"weighted across the depths he actually throws, they allow {lift*100:+.0f}% "
                f"versus league"))
        return out
    for l in RT:
        hn = (l.get("routes") or 0) * (l.get("games") or 0)
        if hn < G_ROUTE_HIS or (l.get("def_routes_faced") or 0) < G_ROUTE_DEF:
            continue
        t = rel(l.get("def_yards_per_route_actual"), l.get("def_yards_per_route_league"))
        if t is None:
            continue
        lift += (l.get("share") or 0) * t; share += (l.get("share") or 0)
    if share >= 0.35 and abs(lift) >= 0.04:
        out.append(tell("over" if lift > 0 else "under", 1.0, "routes",
            f"weighted across the routes he actually runs ({share*100:.0f}% of his tree), they "
            f"allow {lift*100:+.0f}% versus league"))
    return out


def F17_depth(RT):
    """⭐ ROUTE DEPTH — is he working deeper than this defense usually has to defend?

    Owner 2026-10-08: "how far they run those routes and if the defense allows those types of
    distances". An out at 4 yards and an out at 14 are different routes against different
    coverage, and the tree compared share and yards-per-route only.

    ⛔ THIS HAS TO BE ITS OWN FAMILY. It lived inside F4 first and was provably inert: score()
    takes the MAX weight within a family and caps at 1.0, so a 0.5 depth tell is discarded
    whenever F4's 1.0 routes tell fires — and if it pointed the other way it was discarded too.
    Ablating it was bit-identical to leaving it on, across 274 graded picks, even though the
    term itself fired on 2,071 of 4,647 rows. A sub-1.0 tell added to a saturated family cannot
    move anything.
    """
    out = []
    if not DEPTH_ON:
        return out
    dep, dshare = 0.0, 0.0
    for l in RT:
        d_ = l.get("depth_vs_faced")
        if not fin(d_) or (l.get("def_routes_faced") or 0) < G_ROUTE_DEF:
            continue
        dep += (l.get("share") or 0) * d_
        dshare += (l.get("share") or 0)
    if dshare >= 0.35 and abs(dep) >= 1.0:
        deep = (dep * DEPTH_SIGN) > 0
        out.append(tell("over" if deep else "under", 1.0, "depth",
            f"on the routes he runs he is working {abs(dep):.1f} yards "
            f"{'deeper' if deep else 'shallower'} than this defense usually has to defend them"))
    return out


def ordinal(n):
    """1 -> "1st". Used for defensive ranks, which read far more plainly than a percentage
    ("4th most of 32" beats "+31% versus league" for a reader deciding whether to bet)."""
    n = int(n)
    if 10 <= n % 100 <= 20:
        return f"{n}th"
    return f"{n}{ {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th') }".replace(" ", "")


def _rank_dir(rank, of):
    """Direction from a defense's RANK, not from its distance to the league mean.

    ⛔ A band around the mean is not symmetric on a skewed quantity. Yards allowed is
    right-skewed, so `|actual/league - 1| >= 0.12` caught a crowd of modestly-below-average
    defenses and only a handful of far-above ones: F5 fired 76 under against 24 over even though
    its underlying data is unbiased (actual/league ratios 0.97-1.01, 55% of defenses below).
    Switching the baseline to the median does NOT fix it either — above the median teams sit
    further out, so the same band would simply flip the bias the other way.

    Terciles of rank are balanced by construction: rank is uniform over 32 defenses, so roughly a
    third fire each way and a third stay silent. rank 1 = allows the MOST (softest), so the top
    third is OVER.
    """
    if not fin(rank) or not fin(of) or of < 12:
        return None
    # Equal-sized bands from both ends. A bare `of / 3` is off by one: with 32 defenses it gives
    # ranks 1-10 for over but 22-32 for under, 10 against 11, which tilts under on its own.
    k = int(round(of / 3.0))
    if rank <= k:
        return "over"
    if rank >= of + 1 - k:
        return "under"
    return None


def F5_align(R, M):
    out, va = [], M.get("vs_alignment", {})
    best = max(((k, R.get(f"align_{k}_share")) for k in ("wide", "slot", "inline", "backfield")
                if fin(R.get(f"align_{k}_share"))), key=lambda x: x[1], default=(None, None))
    if not best[0] or best[1] < 0.35:
        return out
    b = va.get(best[0], {})
    if (b.get("games") or 0) < G_DEF_GAMES:
        return out
    d = _rank_dir(b.get("yds_rank"), b.get("yds_of"))
    g = rel(b.get("yds_actual"), b.get("yds_league"))
    if d and g is not None:
        out.append(tell(d, 1.0, "alignment",
            f"he runs {best[1]*100:.0f}% of his routes from the {best[0]} and they allow "
            f"{b['yds_actual']:.1f} yards a game there, {ordinal(int(b['yds_rank']))} most of "
            f"{int(b['yds_of'])} ({g*100:+.0f}% versus league)"))
    return out


def F6_allow(M, mkt, pos):
    out, vp = [], M.get("vs_position", {})
    k = ALLOW_KEY.get(mkt)
    if not k or (vp.get("games") or 0) < G_DEF_GAMES:
        return out
    d = _rank_dir(vp.get(k + "_rank"), vp.get(k + "_of"))
    g = rel(vp.get(k + "_actual"), vp.get(k + "_league"))
    if d and g is not None:
        lab = k.replace("_", " ")
        out.append(tell(d, 1.0, "defense",
            f"they allow {vp[k+'_actual']:.1f} {lab} a game to {pos}s, "
            f"{ordinal(int(vp[k+'_rank']))} most of {int(vp[k+'_of'])} "
            f"({g*100:+.0f}% versus a league {vp[k+'_league']:.1f})"))
    return out


def F7_rz(RZ, SIT, pos, mkt):
    out = []
    him, dfn = RZ.get("him", {}), RZ.get("defense", {})
    if pos in ("RB", "FB"):
        sh, i10 = him.get("rz5_carry_share"), SIT.get("Inside10", {})
        if fin(sh) and sh >= 0.6 and fin(i10.get("pass_rate")):
            out.append(tell("over", 1.0, "red zone",
                f"he takes {sh*100:.0f}% of the inside-5 carries and his team runs on "
                f"{(1-i10['pass_rate'])*100:.0f}% of inside-10 snaps"))
        g = rel(dfn.get("rush_tds_allowed"), dfn.get("rush_tds_allowed_league"))
        if g is not None and abs(g) >= 0.20:
            out.append(tell("over" if g > 0 else "under", 1.0, "red zone",
                f"they allow {dfn['rush_tds_allowed']:.2f} rushing TDs a game, {g*100:+.0f}% "
                f"versus league"))
    else:
        ez, i10 = him.get("ez_targets"), SIT.get("Inside10", {})
        if fin(ez) and ez >= 1.0 and fin(i10.get("pass_rate")):
            out.append(tell("over", 1.0, "red zone",
                f"{ez:.2f} end-zone targets a game and his team passes on "
                f"{i10['pass_rate']*100:.0f}% of inside-10 snaps"))
        g = rel(dfn.get("ez_tds_allowed"), dfn.get("ez_tds_allowed_league"))
        if g is not None and abs(g) >= 0.20:
            out.append(tell("over" if g > 0 else "under", 1.0, "red zone",
                f"they allow {dfn['ez_tds_allowed']:.2f} end-zone TDs a game, {g*100:+.0f}% "
                f"versus league"))
    return out


def F8_eff(B, E, CN, mkt, pos):
    """Is he trending above or below his own prior season on the rate this market pays for?"""
    out = []
    mk = {"player_reception_yds": "rec_yds", "player_receptions": "receptions",
          "player_rush_yds": "rush_yds", "player_pass_yds": "pass_yds",
          "player_pass_completions": "pass_attempts"}.get(mkt)
    b = B.get(mk or "", {})
    g = rel(b.get("season_to_date"), b.get("prior_season"))
    if g is not None and abs(g) >= 0.18 and (b.get("games") or 0) >= 3:
        out.append(tell("over" if g > 0 else "under", 0.5, "form",
            f"his {b['games']}-game rate of {b['season_to_date']:.1f} is {g*100:+.0f}% on his "
            f"{b['prior_season']:.1f} last season"))
    return out


def F9_cond(COND, mkt):
    out = []
    if not COND:
        return out
    g = COND.get("gap")
    if g is not None and abs(g) >= 0.12:
        out.append(tell("over" if g > 0 else "under", 1.0, "condition",
            f"this matchup points at his {COND['group']} games, where he has run "
            f"{COND['val']:.1f} against {COND['base']:.1f} overall ({g*100:+.0f}%, "
            f"{COND['games']} games)"))
    return out


def F10_script(SIT, br, mkt, pos):
    out = []
    want = br["script"]
    s, ov = SIT.get(want, {}), SIT.get("Overall", {})
    g = rel(s.get("pass_rate"), ov.get("pass_rate"))
    if g is None or abs(g) < 0.04:
        return out
    passing = pos == "QB" or mkt in ("player_reception_yds", "player_receptions", "player_targets")
    if passing:
        d = "over" if g > 0 else "under"
    elif mkt in ("player_rush_yds", "player_rush_attempts"):
        d = "under" if g > 0 else "over"
    else:
        return out
    out.append(tell(d, 1.0, "script",
        f"as {'favourites' if want == 'Leading' else 'underdogs' if want == 'Trailing' else 'a coin flip'} "
        f"they sit in the {want.lower()} bucket, where they pass {s['pass_rate']*100:.0f}% against "
        f"their own {ov['pass_rate']*100:.0f}% overall"))
    return out


# ⛔ THE PROP MODEL IS GONE (owner, 2026-10-07): "I don't think we want to use the player prop
# model anymore, we just want to provide stats for each player and the betting lines."
# F11 used to carry the projection as a vote. It is removed rather than demoted to context, because
# a projection printed as context is still the product making a forecast — and the measured record
# was a coin flip (fp_edge graded 50.5%, 336-329, against the close).
# Do not reinstate it without that instruction being reversed.


MKT_STAT = {"player_rush_yds": "rushing_yards", "player_rush_attempts": "carries",
            "player_reception_yds": "receiving_yards", "player_receptions": "receptions",
            "player_targets": "targets", "player_pass_yds": "passing_yards",
            "player_pass_attempts": "attempts", "player_pass_completions": "completions",
            "player_pass_tds": "passing_tds"}
_OFF = {"df": None}


def bday_record(pid, bdate, stat):
    """His production in games within 3 days of his birthday, against his own career average.

    ⚠ This is a PRODUCTION record, not an over-rate: historical prop lines only reach back to late
    2023, so an over-rate here would rest on one or two lines. The card says which it is.
    """
    if stat is None:
        return None
    if _OFF["df"] is None:
        po = pd.read_parquet(HERE / "data" / "player_offense.parquet")
        sch = pd.read_parquet(HERE / "data" / "nflverse_games.parquet",
                              columns=["season", "week", "gameday", "home_team", "away_team"])
        sch = pd.concat([sch.assign(t=sch.home_team), sch.assign(t=sch.away_team)])[
            ["season", "week", "t", "gameday"]]
        # ⚠ join on TEAM as well as season/week — without it every game of that week matches and
        # one player's four birthday games read as 63.
        po = po.merge(sch, left_on=["season", "week", "team"],
                      right_on=["season", "week", "t"], how="left")
        po["gameday"] = pd.to_datetime(po.gameday)
        _OFF["df"] = po
    po = _OFF["df"]
    x = po[po.player_id == pid]
    if not len(x) or stat not in x.columns:
        return None
    x = x.drop_duplicates(["season", "week"])
    gd = x.gameday
    diff = gd.apply(lambda d: 999 if pd.isna(d) else
                    min(abs((d - bdate.replace(year=y)).days) for y in (d.year - 1, d.year, d.year + 1)))
    near = x[diff <= 3]
    v = num(x[stat])
    if not len(near) or not v.notna().any():
        return {"games": 0, "val": None, "base": None}
    return {"games": int(len(near)), "val": float(num(near[stat]).mean()), "base": float(v.mean())}


def narratives(pid, name, team, opp, gameday, bio, hist, team_weeks, mkt_stat=None):
    """F13 — the special narratives, scored from HIS OWN record in that spot.

    Owner, 2026-10-07: a positive record is +2, a negative one -2, and a FIRST occurrence is
    non-directional — it does not move the net, it raises the player's RANK among qualifiers, so it
    decides WHICH of the 10-15 surface rather than which way they point.

    ⚠ THE WEIGHT IS SAMPLE-GATED, because these records are thin. Median 3 prop lines across 228
    players; a 2-line birthday record would otherwise outweigh "they allow the 2nd-fewest receiving
    yards in the league", since every other family is capped at 1.0.
        8+ prop lines -> full +/-2.0      4-7 lines -> +/-1.0      under 4 -> context, weight 0
    """
    out, interest = [], 0.0
    b = bio.get(pid) or {}

    def rec(kind, n_lines, rate, base, label):
        nonlocal interest
        if not fin(rate) or not fin(base) or not fin(n_lines) or n_lines < 1:
            interest += 1.0
            out.append(tell("context", 0.0, "narrative",
                f"{label} — first time we have him in this spot, so there is no record to read"))
            return
        gap = rate - base
        if n_lines >= 8:
            w = 2.0
        elif n_lines >= 4:
            w = 1.0
        else:
            w = 0.0
        d = "over" if gap > 0 else "under"
        if w == 0 or abs(gap) < 0.05:
            out.append(tell("context", 0.0, "narrative",
                f"{label} — {rate*100:.0f}% over rate against his usual {base*100:.0f}% on only "
                f"{int(n_lines)} prop lines, too few to count"))
            return
        out.append(tell(d, w, "narrative",
            f"{label} — he has gone over {rate*100:.0f}% of the time in this spot against his usual "
            f"{base*100:.0f}% ({int(n_lines)} prop lines)"))

    # --- revenge: facing a team he has played for before
    prior_teams = team_weeks.get(pid, set()) - {team}
    if opp in prior_teams:
        h = hist.get(pid) or {}
        rec("rv", h.get("rv_lines"), h.get("rv_over"), h.get("rv_else_over"),
            f"revenge game — he has played for {opp}")
    elif (b.get("draft_team") or "") == opp:
        h = hist.get(pid) or {}
        rec("rv", h.get("rv_lines"), h.get("rv_over"), h.get("rv_else_over"),
            f"he was drafted by {opp}")

    # --- homecoming: away game in his birth state
    if b.get("birth_state") and not b.get("is_home"):
        if b.get("opp_state") and b["birth_state"] == b["opp_state"]:
            h = hist.get(pid) or {}
            rec("hc", h.get("hc_lines"), h.get("hc_over"), h.get("else_over"),
                f"homecoming — visiting his home state of {b['birth_state']}")

    # --- birthday, within 3 days of kickoff (storyline_flags.py's own definition)
    bd = b.get("birth_date")
    if bd is not None and gameday is not None:
        try:
            bdate = pd.to_datetime(bd); g = pd.to_datetime(gameday)
            this = bdate.replace(year=g.year)
            diff = min(abs((g - this).days), abs((g - this.replace(year=g.year - 1)).days),
                       abs((g - this.replace(year=g.year + 1)).days))
            if diff <= 3:
                # ⛔ DO NOT ASSUME FIRST OCCURRENCE. The first version hardcoded every birthday as a
                # first-time read because no birthday record was kept — and told the user "first
                # time we have him in this spot" about Geno Smith, who has played four games within
                # three days of his birthday (2021, 2022, 2024, 2025). Claiming no history when you
                # simply never looked is worse than saying nothing.
                bg = bday_record(pid, bdate, mkt_stat)
                label = f"birthday game — he turns {g.year - bdate.year} within {diff} day(s) of kickoff"
                if bg is None or bg["games"] == 0:
                    interest += 1.0
                    out.append(tell("context", 0.0, "narrative",
                        f"{label} — no prior game of his lands this close to it"))
                else:
                    n, v, b = bg["games"], bg["val"], bg["base"]
                    gap = (v - b) / abs(b) if b else 0.0
                    w = 2.0 if n >= 8 else (1.0 if n >= 4 else 0.0)
                    if w == 0 or abs(gap) < 0.08:
                        out.append(tell("context", 0.0, "narrative",
                            f"{label} — {v:.1f} against his usual {b:.1f} across {n} such games, "
                            f"too few to count"))
                    else:
                        out.append(tell("over" if gap > 0 else "under", w, "narrative",
                            f"{label} — in {n} games this close to it he has averaged {v:.1f} "
                            f"against his usual {b:.1f} ({gap*100:+.0f}%). Production, not an "
                            f"over-rate: prop lines do not reach back that far"))
        except Exception:
            pass
    return out, interest


def F21_usage(R, pos, mkt):
    """⭐ THE BUSY RECEIVER GOES UNDER. The single strongest measured relationship in the payload.

    Measured on 7,261 receiving lines (2025-26), over-rate by usage tercile:
        target_share   bottom 53.8%  middle 47.7%  top 45.3%
        xfp_share      bottom 55.6%  middle 46.0%  top 45.2%
    Monotone, and it held in both the 2025 fit and the 2026 holdout (r -0.089 / -0.072) against a
    0.058 placebo floor. The market prices the obvious name generously; the low-usage receiver is
    the one whose number sits low enough to clear.

    ⛔ IT NEEDS ITS OWN FAMILY, not a tell inside F1. score() takes the MAX weight per family and
    caps at 1.0, so a 0.5 usage tell is discarded whenever F1's 1.0 script tell fires — flipping
    the sign inside F1 moved the board by 0.3pp while the underlying split is 8.5 points wide.
    That is the second time a real signal was swallowed by a saturated family (route depth was the
    first); treat the cap as a design constraint, not an implementation detail.
    """
    if mkt not in ("player_reception_yds", "player_receptions", "player_targets"):
        return []
    sh = R.get("xfp_share")
    band = SHARE_BANDS.get(("xfp_share", pos))
    if not fin(sh) or not band:
        sh, band = R.get("target_share"), SHARE_BANDS.get(("target_share", pos))
    if not fin(sh) or not band:
        return []
    lo, hi = band
    if sh >= hi:
        return [tell("under", 1.0, "usage",
                     f"he carries {sh*100:.0f}% of the usage, a top-third role for the position — "
                     f"those lines are set generously and clear only 45% of the time")]
    if sh <= lo:
        return [tell("over", 1.0, "usage",
                     f"only {sh*100:.0f}% of the usage, a bottom-third role — these lines sit low "
                     f"and go over 54% of the time")]
    return []


def F15_vacated(VAC, R, pos, mkt):
    """⭐ WHO IS OUT AROUND HIM. Owner 2026-10-08: "players who are out in a particular game means
    the share of production goes to other players. You haven't even considered that."

    The engine read no injury report at all, which is one reason receiving graded 45.5%: a WR2
    whose WR1 is out is a different player that week and nothing could see it.

    Scored on the share VACATED by team-mates with an out-like designation, paired to the market
    it actually frees up — targets for receiving, carries for rushing. "Questionable" is excluded
    upstream; roughly half of them play, and counting them would inflate every team alike.
    """
    out = []
    if not VAC:
        return out
    # ⛔ TWO-SIDED, unlike the first version of this family. A QB out cuts his pass-catchers; it
    # does not free anything for them. F15 emitting only OVER was the same one-sided asymmetry
    # that produced the 14-of-15-unders board, just pointing the other way.
    if VAC.get("qb_out") and mkt in ("player_reception_yds", "player_receptions",
                                     "player_targets", "player_anytime_td"):
        who = VAC.get("qb_out_name") or "their starting QB"
        out.append(tell("under", 1.0, "vacated",
                        f"{who} is out, and a backup under centre cuts what his receivers see"))
    key = "vacated_carry_share" if mkt in ("player_rush_yds", "player_rush_attempts") \
        else "vacated_target_share"
    v = VAC.get(key)
    if not fin(v) or v <= 0:
        return out
    who = [x for x in (VAC.get("out_players") or []) if x.get("name")]
    names = ", ".join(x["name"] for x in who[:2]) if who else f"{VAC.get('out_count', 0)} players"
    lab = "carries" if key.startswith("vacated_carry") else "targets"
    # Bands, not a raw multiplier: a 5% vacancy is noise and a 25% one reshapes a depth chart.
    if v >= 0.20:
        out.append(tell("over", 1.0, "vacated",
            f"{names} out, which frees {v*100:.0f}% of the {lab} he is competing for"))
    elif v >= 0.10:
        out.append(tell("over", 0.5, "vacated",
            f"{names} out, freeing {v*100:.0f}% of the {lab}"))
    else:
        out.append(tell("context", 0.0, "vacated",
            f"{names} out, but only {v*100:.0f}% of the {lab} — too little to move his role"))
    return out


def F16_situational(SIT_READS):
    """⭐ SITUATIONAL SPLITS — primetime / divisional / home-away, each against HIS OWN overall rate.

    Owner 2026-10-08. The splits existed in nfl_player_prop_trends and the engine never read them.

    ⛔ The lift is what counts, never the raw rate: a 62% primetime record says nothing if he
    clears 62% everywhere. Scored only when the spot differs from his baseline by 15+ points on
    4+ games in that spot, and the direction follows the lift.
    ⚠ Per-opponent history is NOT here — it measured 22-35% worse than baseline
    (prop-baseline-blend-law). The defense's allowance answers that question properly.
    """
    out = []
    for r in (SIT_READS or []):
        lift, n = r.get("lift"), r.get("n")
        if not fin(lift) or not fin(n):
            continue
        word = {"primetime": "in primetime", "regular": "outside primetime",
                "division": "in divisional games", "non_division": "out of division",
                "home": "at home", "away": "on the road"}.get(r["dim"], r["dim"])
        txt = (f"{word} he has cleared this line {r['hit']} of {r['n']} "
               f"({r['pct']*100:.0f}%) against {r['overall_pct']*100:.0f}% overall "
               f"({r['overall_n']} games)")
        if abs(lift) >= 0.15 and n >= 4:
            out.append(tell("over" if lift > 0 else "under", 0.5, "situational", txt))
        else:
            out.append(tell("context", 0.0, "situational", txt))
    return out


def F18_tendency(RT_TELLS):
    """⭐ The player's OWN tendency whose trigger is live this week — ported from the original
    regression-report model (research_tells.py), which graded 22-13 on 2026 wks 2-4 while the
    spotlight went 20-20 on the same games.

    Triggers: wind, heat/cold, favourite/underdog, game total, home/road, rest, a blitz-heavy or
    low-blitz opponent. A factor only becomes HIS tendency at |r|>=.30, p<.10 on 15+ games, with
    the sign agreeing across odd/even halves of his games — so these are survivor-tested, unlike
    F13 which scores a player's own record off a median of 3 prop lines.

    ✅ LEAK-SAFE FOR 2026: the tendencies are fitted on `_*_deep_frame.parquet`, which holds
    2023-2025 only, so 2026 is a genuine holdout.
    ⛔ NOT leak-safe for 2025, which IS in the fitting frame. Never quote a 2025 number for this.
    """
    return _rt_family(RT_TELLS, "tendency")


def F19_storyline(RT_TELLS):
    """Validated storylines with POPULATION base rates, not the player's own thin record: QB vs a
    former team -> passing yards UNDER (60% across 59 games 2023-25, TDs 70%); a skill player in
    his first season away vs the old team -> OVER (60% on 154 lines vs 47% elsewhere).

    ⛔ CANNOT BE BACKTESTED with the current artifacts: part of it reads
    _storyline_player_history.parquet, a full-season aggregate with no as-of cutoff, so scoring a
    past week with it leaks. Ported for LIVE use, where "everything through last week" is exactly
    what the reader has; validate it forward, not in the harness.
    """
    return _rt_family(RT_TELLS, "storyline")


def F20_coaching(RT_TELLS):
    """The offensive play-caller's stable situational shift live this week — primetime, divisional,
    cold, windy, home, favourite, underdog, short rest, bye, vs a blitz-heavy front. Pass-heavy
    shifts push QB volume and receivers OVER; run-heavy shifts push rush attempts OVER and pass
    attempts UNDER. The spotlight's F10 has the TEAM's pass rate by bucket but nothing about who
    is calling the plays.

    ⛔ CANNOT BE BACKTESTED either: _coach_situations_pc.parquet is built from 2022-CURRENT
    play-by-play with no season cutoff, so it contains the weeks being scored. Live use only.
    """
    return _rt_family(RT_TELLS, "coaching")


def _rt_family(rt_tells, src):
    """Pick one source out of a ResearchTells list and cap it at the family weight.

    They arrive as {src, dir, text, w} with w up to 1.5 — above this engine's 1.0 family cap —
    so the cap does the clipping in score(); passing the raw weight through would let one tell
    outrank an entire family.
    """
    out = []
    for t in (rt_tells or []):
        if t.get("src") != src:
            continue
        d = t.get("dir")
        out.append(tell(d if d in ("over", "under") else "context",
                        min(float(t.get("w") or 0.0), 1.0) if d in ("over", "under") else 0.0,
                        src, t.get("text") or ""))
    return out


# F14 — the prop SIGNALS (the P-flags on nfl_slate_props.flags).
# Owner, 2026-10-07: weight them by their RECORD, and a signal pointing the other way counts
# against. Absence never penalises — a family that does not fire scores 0, which is automatic.
#
# ⛔ A FLAT BONUS WOULD HAVE BEEN WORSE THAN NOTHING. P5_atd_drift_yes was the largest sample on
# the board at 80 bets, 18.8% and -15% ROI; adding a point in its own direction would have pushed
# graded picks the wrong way. It is deleted now, but the lesson is why weight follows record.
# P3, P12 and P13 were retired 2026-10-07 (graded at their own market's baseline over 2023-25)
# and are gone from the builder, so they are not listed here. A flag missing from this map falls
# through to the (None, None) branch and is described to the reader as "a caution with no side" —
# correct for P6, wrong for anything directional, which is why P19 is registered here and not
# only in the builder.
SIGNAL_MARKETS = {
    "P1": ("player_pass_yds", "over"), "P2": ("player_pass_yds", "under"),
    "P4": ("player_pass_yds", "under"),
    "P7": ("player_rush_yds", "under"), "P9": ("player_pass_tds", "over"),
    "P10": ("player_receptions", "under"), "P11": ("player_anytime_td", "over"),
    "P19": ("player_receptions", "over"),
    "P14": ("player_pass_attempts", "under"), "P15": ("player_pass_attempts", "under"),
    "P16": ("player_pass_attempts", "under"), "P17": ("player_rush_yds", "under"),
    "P18": ("player_pass_tds", "over"),
    # P6 is "steam-up -> NEVER BET": a caution with no side, so it is context only.
    "P6": (None, None),
}
SIGNAL_KEY = {"P1": "P1_pass_yds_form_over", "P2": "P2_pass_yds_form_under",
              "P4": "P4_no_history_qb_under",
              "P7": "P7_rush_yds_tough_d_under", "P9": "P9_pass_tds_regression_over",
              "P10": "P10_receptions_raised_under", "P11": "P11_atd_implied_over",
              "P19": "P19_receptions_cut_over",
              "P14": "P14_attempts_model_under", "P15": "P15_attempts_steam_under",
              "P16": "P16_attempts_confluence", "P17": "P17_rush_yds_model_under",
              "P18": "P18_pass_tds_model_over"}
BREAK_EVEN, SIGNAL_MIN_N = 0.5238, 15       # -110 juice; below 15 bets a record is not a record
# ⚠ `records` comes from signal_performance, which only holds the CURRENT season — so a flag can
# score off 15-20 bets here while the 2023-25 table in .claude/docs/28_spotlight_qualification.md
# says it is noise. That table is the authority on which flags deserve weight at all; this gate
# only decides whether THIS season's record is long enough to quote. And measure a prop flag
# against its own market's baseline, never 50%: rush yards go under 53.6% of the time unprompted.


def F14_signals(flags, mkt, records):
    """Each attached flag, weighted by its own graded record. Disagreement counts against."""
    out = []
    for f in (flags or []):
        f = str(f).strip().upper()
        mk, side = SIGNAL_MARKETS.get(f, (None, None))
        key = SIGNAL_KEY.get(f, f)
        if mk is None:
            out.append(tell("context", 0.0, "signal",
                            f"signal {f} is attached — a caution with no side, so it does not count"))
            continue
        if mk != mkt:
            continue                                   # a signal only speaks to its own market
        rec = records.get(key)
        if not rec or not fin(rec.get("n")) or rec["n"] < SIGNAL_MIN_N:
            n = int(rec["n"]) if rec and fin(rec.get("n")) else 0
            out.append(tell("context", 0.0, "signal",
                f"signal {key} is attached and points {side} — only {n} graded bets behind it, "
                f"too few to count"))
            continue
        hr, n = float(rec["hit_rate"]), int(rec["n"])
        if hr >= BREAK_EVEN:
            out.append(tell(side, 0.5, "signal",
                f"signal {key} is attached and points {side} — {rec['wins']}-{rec['losses']} "
                f"({hr*100:.0f}%) across {n} graded bets"))
        else:
            # A losing record does NOT get inverted into the opposite direction. That would be
            # reading a small negative sample as positive evidence the other way, which is a
            # stronger claim than the data supports. It is shown and scores nothing.
            out.append(tell("context", 0.0, "signal",
                f"signal {key} is attached and points {side}, but its record is "
                f"{rec['wins']}-{rec['losses']} ({hr*100:.0f}%) across {n} bets — below break-even, "
                f"so it does not count"))
    return out


# ---------------------------------------------------------------- scoring
def score(fams, elig):
    """Each FAMILY contributes at most +/-1.0 — the whole point of the rebuild."""
    net, agree, oppose, counted = 0.0, set(), set(), []
    for fam, tells in fams.items():
        mode = elig.get(fam)
        if mode is None:
            continue                                   # excluded for this market
        for t in tells:
            t["family"] = fam
        if mode == "c":
            for t in tells:
                t["dir"], t["w"] = "context", 0.0
            counted += tells
            continue
        best = {}
        for t in tells:
            if t["dir"] in ("over", "under") and t["w"] > 0:
                best[t["dir"]] = max(best.get(t["dir"], 0.0), t["w"])
        counted += tells
        if not best:
            continue
        d = max(best, key=best.get)
        w = min(best[d], 1.0)                           # the cap
        if len(best) == 2 and abs(best["over"] - best["under"]) < 1e-9:
            continue                                   # family self-cancels
        net += w if d == "over" else -w
        (agree if d == "over" else oppose).add(fam)
    return net, agree, oppose, counted


NET_FRAC, BAR_FRAC, MAX_AGAINST = 0.45, 0.60, 1
FLOOR_FAMS, FLOOR_NET = 3, 2.5      # nothing weak reaches the board, whatever its market
PER_MARKET_CAP, BOARD_MAX = 2, 15   # no market dominates; the board is a fixed size
# ⛔ SCALE TO WHAT A MARKET CAN ACTUALLY PRODUCE, NOT TO WHAT IS ELIGIBLE.
# Scaling the bar to the ELIGIBLE family count made two markets impossible by construction: RB and
# QB rushing yards needed net 3.60 when the best player in each reached 3.5, and WR anytime TD
# needed 2.70 against a ceiling of 2.00. Only 3.0 of 8 eligible families actually fire on a rushing
# line and 1.2 of 6 on an anytime TD, because many dimensions simply have nothing to say in those
# markets. CAPACITY is the 90th percentile of families fired on that market, measured, and both
# thresholds scale to it.


def qualifies(net, agree, oppose, bar, n_el):
    """Doc 28 §4 — all four conditions. Thresholds are module-level so they can be CALIBRATED to a
    target weekly volume instead of guessed; see --calibrate."""
    direction = "over" if net > 0 else "under"
    forr = agree if direction == "over" else oppose
    agn = oppose if direction == "over" else agree
    return (len(forr) >= bar and abs(net) >= NET_FRAC * n_el
            and len(agn) <= MAX_AGAINST), direction, forr, agn


def condition_read(pid, exp_press, mkt):
    """His production in the clean-or-hurried half this matchup points at, vs his overall."""
    try:
        pa = pd.read_parquet(D / "passingAdvanced__player.parquet")
    except Exception:
        return None
    q = pa[pa.playerPlayerId == pid].copy()
    for k, c in [("press", "playerStatsPassingPressuredPercentage"),
                 ("dbk", "playerStatsPassingDropbacksTotal"),
                 ("att", "playerStatsPassingAttemptsTotal"),
                 ("yds", "playerStatsPassingYardsTotal")]:
        q[k] = num(q[c])
    q = q[(q.dbk >= 10) & q.press.notna()]
    if len(q) < 12:
        return None
    med = q.press.median()
    grp = "clean" if exp_press <= med else "hurried"
    q["grp"] = np.where(q.press > med, "hurried", "clean")
    x = q[q.grp == grp]
    if len(x) < 6:
        return None
    val, base = x.yds.sum() / len(x), q.yds.sum() / len(q)
    return {"group": grp, "val": val, "base": base, "games": len(x), "gap": rel(val, base)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--payload", required=True)
    ap.add_argument("--season", type=int, default=2026); ap.add_argument("--week", type=int, default=5)
    ap.add_argument("--through", type=int, default=4)
    ap.add_argument("--explain", help="player name to explain in full")
    ap.add_argument("--emit", action="store_true", help="write the board as json for the writer")
    ap.add_argument("--dump-tells", action="store_true",
                    help="every tell on every scored line, for direction-balance calibration")
    ap.add_argument("--write", action="store_true",
                    help="upsert the board into nfl_prop_spotlight (the picks of record)")
    ap.add_argument("--calibrate", action="store_true",
                    help="sweep the thresholds and report weekly volume for each")
    ap.add_argument("--net-min", type=float); ap.add_argument("--bar-frac", type=float)
    ap.add_argument("--max-against", type=int)
    a = ap.parse_args()
    for k, v in (("NET_FRAC", a.net_min), ("BAR_FRAC", a.bar_frac), ("MAX_AGAINST", a.max_against)):
        if v is not None:
            globals()[k] = v
    weeks = list(range(1, a.through + 1))
    T, V, SC = L.trenches(a.season, weeks), L.volume(a.season, weeks), L.script(a.season, weeks)

    P = pd.read_parquet(a.payload)
    cw = pd.read_parquet(D / "player_crosswalk.parquet").drop_duplicates("playerPlayerId")
    P = P.merge(cw[["playerPlayerId", "player_name", "player_id"]], on="playerPlayerId",
                how="left", suffixes=("", "_cw"))
    props = fetch("nfl_slate_props",
                  f"season=eq.{a.season}&week=eq.{a.week}&select=player_id,player_name,position,market,close_line,open_line,team,opponent,flags,headshot_url")
    games = fetch("nfl_slate_games", f"season=eq.{a.season}&week=eq.{a.week}&select=home_ab,away_ab,fg_spread_close,gameday")
    spread = {}
    for g in games:
        spread[g["home_ab"]] = g["fg_spread_close"]
        spread[g["away_ab"]] = -g["fg_spread_close"] if g["fg_spread_close"] is not None else None
    briefs = {}
    for g in games:
        h, aw, sp = g["home_ab"], g["away_ab"], g["fg_spread_close"]
        if sp is None or h not in T.index or aw not in T.index:
            continue
        import io, contextlib
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            briefs[h] = L.side("h", h, aw, T, V, SC, sp)
            briefs[aw] = L.side("a", aw, h, T, V, SC, -sp)
        for t in (h, aw):
            briefs[t]["own_dropbacks"] = float(V.dbk[t]) if t in V.index else None
            briefs[t]["own_carries"] = float(V.snaps[t] - V.dbk[t]) if t in V.index else None

    # --- signal records, pooled across seasons: a flag's weight is its graded record
    sig_rows = fetch("signal_performance", "sport=eq.nfl&select=signal_key,season,n,wins,losses,hit_rate")
    agg = {}
    for x in sig_rows:
        sk = x["signal_key"]
        if not str(sk).startswith("P"):
            continue
        acc = agg.setdefault(sk, {"n": 0, "wins": 0, "losses": 0})   # NOT `a` — that is argparse
        for f_ in ("n", "wins", "losses"):
            acc[f_] += int(x.get(f_) or 0)
    for sk, acc in agg.items():
        dec = acc["wins"] + acc["losses"]
        acc["hit_rate"] = (acc["wins"] / dec) if dec else None
    records = {sk: acc for sk, acc in agg.items() if acc.get("hit_rate") is not None}
    print(f"  signal records loaded: {len(records)} flags with a graded history")

    # --- situational splits, computed AS OF this week (never the live snapshot, which is
    # "through <latest week>" and would leak every future game into a past board)
    from fp_situational import splits_as_of, read_for as sit_read, game_context
    sit_splits = splits_as_of(a.season, a.week)
    gctx = game_context()
    print(f"  situational splits as of {a.season} wk{a.week}: {len(sit_splits)} player-markets")

    # --- narrative inputs
    bio_df = pd.read_parquet(HERE / "data" / "player_bio.parquet")
    hist_df = pd.read_parquet(HERE / "data" / "_storyline_player_history.parquet")
    tw = pd.read_parquet(HERE / "data" / "player_team_weeks.parquet")
    team_weeks = tw.groupby(tw.player_id.astype(str)).team.apply(lambda x: set(x.dropna())).to_dict()
    hist = {str(r.player_id): r._asdict() for r in hist_df.itertuples(index=False)}
    STATE_TEAM = {"TX": {"DAL", "HOU"}, "CA": {"SF", "LAC", "LA"}, "FL": {"TB", "MIA", "JAX"},
                  "NY": {"NYG", "NYJ", "BUF"}, "PA": {"PHI", "PIT"}, "OH": {"CLE", "CIN"},
                  "MO": {"KC"}, "WA": {"SEA"}, "MA": {"NE"}, "GA": {"ATL"}, "AZ": {"ARI"},
                  "CO": {"DEN"}, "MI": {"DET"}, "WI": {"GB"}, "MN": {"MIN"}, "NO": {"NO"},
                  "LA": {"NO"}, "IN": {"IND"}, "TN": {"TEN"}, "MD": {"BAL"}, "NC": {"CAR"},
                  "NV": {"LV"}, "IL": {"CHI"}, "VA": {"WAS"}, "DC": {"WAS"}}
    bio = {}
    for r in bio_df.itertuples(index=False):
        bio[str(r.gsis_id)] = {"birth_date": getattr(r, "birth_date", None),
                               "birth_state": getattr(r, "birth_st", None) or getattr(r, "birth_state", None),
                               "draft_team": getattr(r, "draft_team", None)}
    gameday = {}
    for g in games:
        gameday[g["home_ab"]] = g.get("gameday"); gameday[g["away_ab"]] = g.get("gameday")

    build_share_bands(P)
    by_pid = {str(r.player_id): r for r in P.itertuples(index=False) if pd.notna(r.player_id)}
    rows, n_lines = [], 0
    for pr in props:
        pid, mkt, pos = str(pr["player_id"]), pr["market"], pr.get("position")
        grp = GROUP.get(pos)
        elig = ELIG.get((grp, mkt))
        if elig is None or pid not in by_pid:
            continue
        n_lines += 1
        r = by_pid[pid]
        br = briefs.get(r.opp if False else r.team)
        if br is None:
            continue
        B, R, E, M, S = (json.loads(getattr(r, c)) for c in ["baseline", "role", "efficiency", "matchup", "scheme"])
        CV = json.loads(r.coverage); RC = json.loads(r.run_concept); TD = json.loads(r.throw_depth)
        RT = json.loads(r.routes); RTO = json.loads(r.route_overall)
        RZ = json.loads(r.redzone); SIT = json.loads(r.situational); CN = json.loads(r.run_consistency)
        COND = condition_read(r.playerPlayerId, br["exp_pressure"], mkt) if "F9" in elig else None
        fams = {
            "F1": F1_role(B, R, br, pos, mkt), "F2": F2_trench(br, T, r.team, r.opp, mkt, pos),
            "F3": F3_scheme(S, CV, RC, pos, mkt), "F4": F4_tree(RT, RTO, TD, pos, mkt),
            "F5": F5_align(R, M), "F6": F6_allow(M, mkt, pos), "F7": F7_rz(RZ, SIT, pos, mkt),
            "F8": F8_eff(B, E, CN, mkt, pos), "F9": F9_cond(COND, mkt),
            "F10": F10_script(SIT, br, mkt, pos),
            }
        b = dict(bio.get(pid) or {})
        b["is_home"] = (pr.get("team") == pr.get("opponent"))  # placeholder, replaced below
        b["is_home"] = r.team not in (pr.get("opponent") or "")
        b["opp_state"] = next((st for st, ts in STATE_TEAM.items() if r.opp in ts), None)
        nar, interest = narratives(pid, pr["player_name"], r.team, r.opp,
                                   gameday.get(r.team), {pid: b}, hist, team_weeks,
                                   MKT_STAT.get(mkt))
        fams["F13"] = nar
        fams["F14"] = F14_signals(pr.get("flags"), mkt, records)
        fams["F15"] = F15_vacated(json.loads(getattr(r, "vacated", "{}") or "{}"), R, pos, mkt)
        fams["F17"] = F17_depth(RT)
        fams["F21"] = F21_usage(R, pos, mkt)
        ctx = gctx.get((a.season, a.week, r.team))
        fams["F16"] = F16_situational(
            sit_read(sit_splits, pid, mkt, *ctx) if ctx else [])
        net, agree, oppose, counted = score(fams, elig)
        n_el = sum(1 for v in elig.values() if v == "*")
        rows.append(dict(player_id=pid, headshot_url=pr.get("headshot_url"),
                         player=pr["player_name"], pos=pos, market=mkt, line=pr.get("close_line") or pr.get("open_line"),
                         net=net, direction="over" if net > 0 else "under",
                         n_for=0, n_against=0, bar=0,
                         eligible=n_el,
                         qualifies=False, tells=counted, team=r.team, opp=r.opp,
                         interest=interest, n_el=n_el,
                         fam_over=len(agree), fam_under=len(oppose)))
    Q = pd.DataFrame(rows)
    # capacity per (market, position): the 90th percentile of families that actually fire
    Q["fired"] = Q[["fam_over", "fam_under"]].max(axis=1)
    cap = Q.groupby(["market", "pos"]).fired.quantile(0.90).rename("capacity").reset_index()
    cap["capacity"] = cap.capacity.clip(lower=2.0)
    Q = Q.merge(cap, on=["market", "pos"], how="left")
    # ⛔ A WEEKLY BOARD IS A SELECTION PROBLEM, NOT A CUTOFF PROBLEM.
    # Two threshold schemes both failed: scaled to ELIGIBLE families, rushing yards and anytime TD
    # became impossible (the bar sat above the best score anyone in the market reached); scaled to
    # measured CAPACITY, every market became trivial and 150 qualified. Different markets carry
    # genuinely different evidence density, and no single cutoff is fair across them.
    # So: a QUALITY FLOOR nothing weak can pass, then rank within each market, then allocate a
    # fixed board. That is stable week to week and guarantees the spread a flat cutoff destroys.
    Q["bar"] = np.maximum(2, np.ceil(Q.capacity * BAR_FRAC)).astype(int)
    Q["n_for"] = np.where(Q.net > 0, Q.fam_over, Q.fam_under)
    Q["n_against"] = np.where(Q.net > 0, Q.fam_under, Q.fam_over)
    Q["passes_floor"] = ((Q.n_for >= FLOOR_FAMS) & (Q.net.abs() >= FLOOR_NET)
                         & (Q.n_against <= MAX_AGAINST))
    Q["rank_in_mkt"] = (Q[Q.passes_floor].groupby(["market", "pos"])
                        .net.transform(lambda x: x.abs().rank(ascending=False, method="first")))
    Q["qualifies"] = Q.passes_floor & (Q.rank_in_mkt <= PER_MARKET_CAP)
    # trim to the board size, best first, keeping the market spread already imposed by the cap
    if Q.qualifies.sum() > BOARD_MAX:
        keep = (Q[Q.qualifies].assign(k=Q.net.abs() + 0.01 * Q.interest)
                .sort_values("k", ascending=False).head(BOARD_MAX).index)
        Q["qualifies"] = Q.index.isin(keep)
    if a.calibrate:
        print(f"\ncalibration on {len(Q)} scored lines — target 10-15 a week\n")
        print(f"  {'net/el>=':>6} {'bar frac':>9} {'max against':>12} {'qualify':>8}  markets")
        best = []
        # ⛔ A FLAT NET THRESHOLD REPEATS THE FLAT-BAR MISTAKE ONE LEVEL UP. Families cap at 1.0,
        # so a 5-family market can never reach net 4.0 the way a 9-family one can — at net >= 4.0
        # only 4 of 14 markets produced a single qualifier. Score as a FRACTION of what the market
        # could possibly muster, so markets compete on their own scale.
        for nf in (0.40, 0.45, 0.50, 0.55, 0.60):
            for bf in (0.50, 0.55, 0.60):
                for ma in (0, 1):
                    n = 0; mk = set()
                    for x in Q.itertuples(index=False):
                        bar = max(2, int(np.ceil(x.capacity * bf)))
                        d = "over" if x.net > 0 else "under"
                        f_ = x.fam_over if d == "over" else x.fam_under
                        ag = x.fam_under if d == "over" else x.fam_over
                        if f_ >= bar and abs(x.net) / max(x.capacity, 1) >= nf and ag <= ma:
                            n += 1; mk.add(x.market.replace("player_", ""))
                    flag = "  <= target" if 10 <= n <= 15 else ""
                    print(f"  {nf:>6.2f} {bf:>9.2f} {ma:>12d} {n:>8d}  {len(mk)} markets{flag}")
                    if 10 <= n <= 15:
                        best.append((nf, bf, ma, n, len(mk)))
        print(f"\n  settings inside the target: {best}")
        return
    print(f"\nscored {n_lines} posted lines with an eligible market  |  "
          f"{int(Q.qualifies.sum())} qualify")
    print(f"  by market:")
    for (m, p), g in Q.groupby(["market", "pos"]):
        if g.qualifies.sum():
            print(f"    {m:26s} {p:3s} {int(g.qualifies.sum()):2d} of {len(g)}")
    S_ = Q[Q.qualifies].sort_values("net", key=abs, ascending=False)
    print(f"\n  QUALIFYING ({len(S_)}):")
    for x in S_.itertuples(index=False):
        print(f"    {x.player:22s} {x.pos:3s} {x.market.replace('player_',''):18s} line {str(x.line):>6}  "
              f"{x.direction.upper():5s} net {x.net:+.1f}  families {x.n_for}-{x.n_against} "
              f"(bar {x.bar}, capacity {x.capacity:.0f} of {x.eligible} eligible)")
    if a.explain:
        e = Q[Q.player == a.explain]
        for x in e.itertuples(index=False):
            print(f"\n{'='*96}\n{x.player} — {x.pos}, {x.team} vs {x.opp} · {x.market} line {x.line}")
            print(f"  net {x.net:+.2f} · direction {x.direction.upper()} · families "
                  f"{x.n_for} for / {x.n_against} against · bar {x.bar} of {x.eligible} eligible · "
                  f"{'QUALIFIES' if x.qualifies else 'does not qualify'}")
            for t in x.tells:
                print(f"    [{t['dir']:7s} w={t['w']:.1f}] {t['family']:3s} {t['src']:10s} {t['text']}")
    Q.drop(columns=["tells"]).to_csv(HERE / "out" / f"spotlight_{a.season}w{a.week}.csv", index=False)
    if a.dump_tells:
        # One row per tell over EVERY scored line, not just the qualifiers. Needed because a
        # per-family direction split measured on the board is measured AFTER selection, which
        # amplifies whichever way the engine already leans and hides where that lean comes from.
        import csv
        dp = HERE / "out" / f"spotlight_tells_{a.season}w{a.week}.csv"
        with open(dp, "w", newline="") as fh:
            w_ = csv.writer(fh)
            w_.writerow(["player", "pos", "market", "line", "net", "direction", "qualifies",
                         "family", "tell_dir", "weight", "src", "text"])
            for x in Q.itertuples(index=False):
                for t in (x.tells or []):
                    w_.writerow([x.player, x.pos, x.market, x.line, x.net, x.direction,
                                 x.qualifies, t["family"], t["dir"], t["w"], t["src"], t["text"]])
        print(f"  wrote {dp}")
    if a.emit:
        LAB = {"player_reception_yds": "Receiving yards", "player_receptions": "Receptions",
               "player_targets": "Targets", "player_rush_yds": "Rushing yards",
               "player_rush_attempts": "Rush attempts", "player_pass_yds": "Passing yards",
               "player_pass_attempts": "Pass attempts", "player_pass_completions": "Completions",
               "player_pass_tds": "Passing TDs", "player_anytime_td": "Anytime TD"}
        board = [dict(player_id=x.player_id, player=x.player, pos=x.pos, team=x.team, opp=x.opp,
                      headshot_url=x.headshot_url, market=x.market,
                      market_label=LAB.get(x.market, x.market), line=x.line,
                      direction=x.direction, net=round(float(x.net), 2),
                      n_for=int(x.n_for), n_against=int(x.n_against), board_rank=i,
                      tells=[t for t in x.tells if t["dir"] != "context" or t["w"] == 0])
                 for i, x in enumerate(Q[Q.qualifies].sort_values("net", key=abs, ascending=False)
                                       .itertuples(index=False), start=1)]
        out = HERE / "out" / f"spotlight_{a.season}w{a.week}.json"
        json.dump(board, open(out, "w"), indent=1)
        print(f"\n  wrote {out} ({len(board)} rows)")
        if a.write:
            write_board(a.season, a.week, board)
    elif a.write:
        raise SystemExit("[spotlight] --write needs --emit (the board is built in that branch)")


if __name__ == "__main__":
    main()
