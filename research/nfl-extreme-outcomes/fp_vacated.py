#!/usr/bin/env python3
"""Vacated usage: how much of a team's target/carry share is ruled OUT this week.

Owner 2026-10-08: "players who are out in a particular game means the share of production goes to
other players. You haven't even considered that." Correct — nothing in the engine read an injury
report. A WR2 whose WR1 is out is a different player that week, and the whole scoring stack was
blind to it, which is one reason the receiving markets graded 45.5%.

WHAT THIS COMPUTES, per (season, week, team):
  vacated_target_share / vacated_carry_share — the sum of the ENTERING usage share of every
  teammate carrying an out-like designation on the injury report for that week.

THE SHARE IS ENTERING-GAME, THE DESIGNATION IS PREGAME. Both are known before kickoff, so this is
legitimately usable — but the pairing is the subtle part: the share must come from weeks BEFORE
this one (what he HAD been doing), never from the week in question, or an out player's zero-usage
week leaks backwards and reports the vacancy as nil.

⛔ "Questionable" IS NOT OUT. Roughly half of questionable players suit up, so counting them
inflates every team's vacancy and the feature stops discriminating. Out and Doubtful only — the
same OUT_LIKE split cfb_automation's injuries.py uses.

Sources: nfl_injuries_raw (ESPN pregame feed, refreshed 3x/day, 2023+, all 32 teams) and the
payload's own entering market shares.
"""
import os
import sys

import pandas as pd
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
OUT_LIKE = {"Out", "Doubtful", "Injured Reserve", "IR"}
# the payload's entering share columns these map onto
SHARE_COLS = {"target": "e_marketShareReceivingTargetsTotal",
              "carry": "e_marketShareRushingAttemptsTotal",
              "route": "e_marketShareReceivingRoutesTotal"}


def _key():
    k = os.environ.get("SUPABASE_SERVICE_KEY")
    if k:
        return k
    env = os.path.join(HERE, "..", "..", ".env.local")
    if os.path.exists(env):
        for ln in open(env):
            if ln.startswith("SUPABASE_SERVICE_KEY="):
                return ln.split("=", 1)[1].strip()
    sys.exit("[vacated] no SUPABASE_SERVICE_KEY")


def injuries(seasons):
    """Out-like designations per (season, week, team, player_id)."""
    k = _key()
    h = {"apikey": k, "Authorization": f"Bearer {k}"}
    rows, inlist = [], ",".join(str(s) for s in seasons)
    off = 0
    while True:
        r = requests.get(f"{SUPA}/nfl_injuries_raw?season=in.({inlist})"
                         f"&select=season,week,team,player_id,player_name,position,report_status"
                         f"&limit=1000&offset={off}", headers=h, timeout=90)
        if r.status_code != 200:
            sys.exit(f"[vacated] nfl_injuries_raw failed ({r.status_code}): {r.text[:200]}")
        j = r.json()
        rows += j
        if len(j) < 1000:
            break
        off += 1000
    d = pd.DataFrame(rows)
    if d.empty:
        return d
    d = d[d.report_status.isin(OUT_LIKE)]
    return d.drop_duplicates(["season", "week", "team", "player_id"])


def team_vacancies(role_df, seasons, gsis_col="player_id", team_col="teamAbbreviation"):
    """{(season, week, team): {vacated_target_share, vacated_carry_share, out_names}}.

    `role_df` is the payload's entering role frame — one row per (player, season, week) carrying
    the e_marketShare* columns and the player's gsis id and team.
    """
    inj = injuries(seasons)
    if inj.empty or role_df.empty:
        print("[vacated] no injury rows or no role rows — vacancies will be empty")
        return {}
    # ⛔ COERCE THE JOIN KEYS ON BOTH SIDES. The payload carries season/week as float (they come
    # through a rename of gameSeason/gameWeek and any NaN upcasts the column), while the REST
    # response gives ints — pandas then matches almost nothing and reports it as "no injured
    # player had a role", which looks like a data gap rather than a dtype bug. Measured: 2 of
    # 1,502 out-like rows matched for 2025 before this.
    inj["player_id"] = inj.player_id.astype(str)
    for c in ("season", "week"):
        inj[c] = pd.to_numeric(inj[c], errors="coerce").astype("Int64")
    r = role_df.copy()
    for c in ("season", "week"):
        r[c] = pd.to_numeric(r[c], errors="coerce").astype("Int64")
    r[gsis_col] = r[gsis_col].astype(str)
    # ⛔ The share must come from BEFORE the week in question. The payload's e_* columns are
    # already entering-game (shift(1) within season), so the row for (player, week W) carries his
    # usage through W-1 — exactly what we want for "what he had been doing".
    keep = ["season", "week", gsis_col, team_col] + [c for c in SHARE_COLS.values() if c in r.columns]
    r = r[keep].rename(columns={gsis_col: "player_id", team_col: "team"})
    r["player_id"] = r.player_id.astype(str)

    # ⛔ DO NOT MERGE ON THE WEEK HE IS OUT. A player who does not play has NO FP row for that
    # week, so an exact-week join matches nothing — it found 2 of 1,502 out-like rows for 2025
    # and looked like a data gap rather than a logic error. What we want is what he HAD been
    # doing: his most recent role row from a week BEFORE the one he is missing.
    r = r.sort_values(["player_id", "season", "week"])
    share_cols = [c for c in SHARE_COLS.values() if c in r.columns]
    last = {}                       # (player_id, season) -> list of (week, {share: value})
    for pid, sea, wk, *vals in zip(r.player_id, r.season, r.week,
                                   *[r[c] for c in share_cols]):
        last.setdefault((pid, int(sea) if pd.notna(sea) else None), []).append(
            (int(wk) if pd.notna(wk) else -1, dict(zip(share_cols, vals))))

    def share_before(pid, season, week):
        rows = last.get((pid, int(season)), [])
        prior = [x for x in rows if x[0] < int(week)]
        return max(prior, key=lambda x: x[0])[1] if prior else None

    recs = []
    for x in inj.itertuples(index=False):
        sh = share_before(str(x.player_id), x.season, x.week)
        if sh is None:
            continue                # no prior usage this season -> nothing to vacate
        recs.append(dict(season=int(x.season), week=int(x.week), team=x.team,
                         player_id=str(x.player_id), player_name=x.player_name,
                         position=x.position, **sh))
    m = pd.DataFrame(recs)
    if m.empty:
        print("[vacated] no injured player had prior-week usage to vacate")
        return {}
    out = {}
    for (s, w, t), g in m.groupby(["season", "week", "team"]):
        rec = {}
        for short, col in SHARE_COLS.items():
            if col in g.columns:
                rec[f"vacated_{short}_share"] = float(pd.to_numeric(g[col], errors="coerce")
                                                      .fillna(0).sum())
        rec["out_count"] = int(len(g))
        # ⛔ A QB OUT CUTS HIS RECEIVERS, it does not free anything for them — the original
        # regression-report model had this two-sided and F15 did not, which is the same one-sided
        # asymmetry that produced the 14-of-15-unders board. Only a QB who had been playing
        # counts: share_before() already guarantees prior usage, so his presence here means he
        # was on the field, not a third-stringer who is always inactive.
        rec["qb_out"] = bool((g.position == "QB").any())
        if rec["qb_out"]:
            rec["qb_out_name"] = str(g[g.position == "QB"].player_name.iloc[0])
        tcol = SHARE_COLS["target"] if SHARE_COLS["target"] in g.columns else share_cols[0]
        rec["out_players"] = [
            {"name": x.player_name, "pos": x.position,
             "target_share": _f(getattr(x, SHARE_COLS["target"], None)),
             "carry_share": _f(getattr(x, SHARE_COLS["carry"], None))}
            for x in g.sort_values(tcol, ascending=False).head(5).itertuples(index=False)]
        out[(int(s), int(w), str(t))] = rec
    tot = sum(v["out_count"] for v in out.values())
    print(f"[vacated] {len(out)} team-weeks carrying an out-like designation, {tot} players")
    return out


def _f(v):
    try:
        f = float(v)
        return None if pd.isna(f) else round(f, 4)
    except (TypeError, ValueError):
        return None


if __name__ == "__main__":
    import json
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    week = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    inj = injuries([season])
    print(f"out-like rows {season}: {len(inj)}")
    w = inj[inj.week == week]
    print(f"  wk{week}: {len(w)} players across {w.team.nunique()} teams")
    print(w.groupby("team").size().sort_values(ascending=False).head(8).to_string())
