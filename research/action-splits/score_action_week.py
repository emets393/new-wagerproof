#!/usr/bin/env python3
"""Score ONE pasted Action Network week against our model, game by game, market by market.

WHY THIS EXISTS (owner, explicit, 2026-10-03). A paste is not a request for a pooled thesis.
The job is to find where the public reads AGREE and DISAGREE with our own model pick on each
game, so the agreements can be bet and the conflicts can be named. Reporting one aggregate
hit rate is how a recommendation went out on the exact subset that has never won: an
unconditioned "follow the 82% of tickets on the under" for Florida/Missouri wk5, when the
money was 67% the other way and that shape is 0-5 all-time.

The validated reads it applies (all CFB-only — never pool with NFL, see the memory):

  C1  SPREAD, by within-week TICKET VOLUME. Follow the crowd in the top two thirds, FADE it in
      the quiet third. In-sample wks1-3 90-59 (60.4%) +15.3%; week-4 holdout 34-18 (65.4%)
      +24.8%, quiet third 27.8% vs rest 61.8%, p=0.040 on the holdout alone. 4/4 weeks.

  C2  TOTAL at >=80% of tickets on one side — BUT CONDITIONED ON THE MONEY, which is the whole
      signal. money agrees -> follow the tickets, 47-13 (78.3%). money opposes -> follow the
      MONEY, 0-5 for the ticket side. Pooled 72.3% is a blend of those two and must never be
      quoted on its own.

  H5  STRICT SPLIT (ticket majority one side, MONEY MAJORITY the other) — TOTALS ONLY. Back the
      money side: 15-8 (65.2%) vs a 52.4% both-agree control; >=20pp gap 10-3 (76.9%). It
      INVERTS on spreads (money side 45.6%) and moneyline (34.8%), so it is not generalised.

  Moneyline is DEAD: ticket-majority 82.4% / +18.7% against a blind-favourite null of 81.9% /
  +17.3% on the same games, and the crowd IS the favourite in 190 of 193 games. Not scored.

Lines come from the Odds-API slate, never from the paste — Action's "Best Odds" column is
unreliable (wk5 printed Alabama at +20.5 away AND +5.5 home) and the house rule is one source
for every line anyway.

Usage: python3 score_action_week.py 2026 5
"""
import datetime
import os
import pathlib
import sys
from difflib import SequenceMatcher

import numpy as np
import pandas as pd
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
CFB_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
MIN_SIM = 1.45                      # same pair-similarity floor join_results.py uses


def _slate(season, week):
    env = {}
    for line in (pathlib.Path(HERE).parent.parent / ".env.local").read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1); env[k.strip()] = v.strip()
    key = env["SUPABASE_SERVICE_KEY"]
    r = requests.get(f"{CFB_URL}/cfb_slate_games", headers={"apikey": key, "Authorization": f"Bearer {key}"},
                     params={"season": f"eq.{season}", "week": f"eq.{week}", "select":
                             "home_team,away_team,kickoff,final_home,fg_spread_close,fg_total_close,"
                             "fg_pred_margin,fg_pred_total,fg_spread_pick,fg_total_pick,conviction_tier"},
                     timeout=60)
    r.raise_for_status()
    return r.json()


def _norm(s):
    return "".join(ch for ch in str(s).lower() if ch.isalnum())


def _match(away, home, slate):
    best, score = None, 0.0
    for g in slate:
        v = (SequenceMatcher(None, _norm(away), _norm(g["away_team"])).ratio()
             + SequenceMatcher(None, _norm(home), _norm(g["home_team"])).ratio())
        if v > score:
            best, score = g, v
    return best if score >= MIN_SIM else None


def main():
    season = int(sys.argv[1]) if len(sys.argv) > 2 else 2026
    week = int(sys.argv[2]) if len(sys.argv) > 2 else int(sys.argv[1])
    now = datetime.datetime.now(datetime.timezone.utc)
    spl = pd.read_csv(os.path.join(HERE, "data", "action_splits.csv"))
    spl = spl[(spl.sport == "cfb") & (spl.season == season) & (spl.week == week)]
    if spl.empty:
        sys.exit(f"no cfb {season} wk{week} rows in data/action_splits.csv — parse the paste first")
    slate = _slate(season, week)

    rows = []
    for _, r in spl.iterrows():
        g = _match(r.away, r.home, slate)
        if g is None or g["final_home"] is not None:
            continue                                  # unmatched, or already settled
        if datetime.datetime.fromisoformat(g["kickoff"].replace("Z", "+00:00")) <= now:
            continue                                  # kicked off
        b, m = pd.to_numeric(r.bets_away, errors="coerce"), pd.to_numeric(r.money_away, errors="coerce")
        if pd.isna(b) or pd.isna(m):
            continue
        rows.append(dict(market=r.market, away=g["away_team"], home=g["home_team"],
                         kick=g["kickoff"][11:16], tickets=pd.to_numeric(r.tickets, errors="coerce"),
                         bets_away=b, money_away=m,
                         mkt_spread=g["fg_spread_close"], mkt_total=g["fg_total_close"],
                         pred_margin=g["fg_pred_margin"], pred_total=g["fg_pred_total"],
                         pick_spread=g["fg_spread_pick"], pick_total=g["fg_total_pick"],
                         tier=g["conviction_tier"]))
    d = pd.DataFrame(rows)
    if d.empty:
        sys.exit("every matched game has already kicked off")
    print(f"\ncfb {season} wk{week} — {d.away.nunique()} games still to play "
          f"({len(spl)} pasted rows, {len(d)} matched market-rows)\n")

    plays = []

    # ---- C1: spread, within-week ticket terciles ---------------------------------------
    s = d[d.market == "spread"].dropna(subset=["tickets"]).copy()
    s = s[s.bets_away != 50]                          # a dead-even board has no crowd
    if len(s) >= 6:
        s["crowd"] = np.where(s.bets_away > 50, "AWAY", "HOME")
        s["tercile"] = pd.qcut(s.tickets, 3, labels=["quiet", "mid", "loud"])
        # quiet third FADES the crowd, the top two thirds FOLLOW it
        s["side"] = np.where(s.tercile == "quiet",
                             np.where(s.crowd == "AWAY", "HOME", "AWAY"), s.crowd)
        for _, r in s.iterrows():
            line = r.mkt_spread if r.side == "HOME" else -r.mkt_spread
            plays.append(dict(market="spread", read="C1", kick=r.kick,
                              game=f"{r.away}@{r.home}",
                              bet=f"{(r.home if r.side=='HOME' else r.away)} {line:+g}",
                              why=f"{r.tercile} third, {int(r.tickets):,} tix, crowd "
                                  f"{int(r.bets_away if r.crowd=='AWAY' else 100-r.bets_away)}%",
                              model=r.pick_spread, num=r.pred_margin, agree=r.side == r.pick_spread))

    # ---- C2 + H5: totals, ALWAYS conditioned on the money -----------------------------
    t = d[d.market == "total"].copy()
    for _, r in t.iterrows():
        tix_over, mny_over = r.bets_away > 50, r.money_away > 50
        heavy = r.bets_away if tix_over else 100 - r.bets_away
        gap = abs(r.money_away - r.bets_away)
        split = tix_over != mny_over
        if split:
            # strict majority flip -> back the MONEY (totals only). 15-8 overall, 10-3 at >=20pp.
            side = "OVER" if mny_over else "UNDER"
            read = f"H5 split{' >=20pp' if gap >= 20 else ''}"
            why = (f"tickets {int(heavy)}% {'OVER' if tix_over else 'UNDER'} vs money "
                   f"{int(r.money_away if mny_over else 100-r.money_away)}% the other way, {int(gap)}pp")
        elif heavy >= 80:
            # money agrees -> follow the tickets (47-13). This is the ONLY case where tickets lead.
            side = "OVER" if tix_over else "UNDER"
            read = "C2 (money agrees)"
            why = f"{int(heavy)}% of tickets and the money both {side}"
        else:
            continue
        plays.append(dict(market="total", read=read, kick=r.kick, game=f"{r.away}@{r.home}",
                          bet=f"{side} {r.mkt_total:g}", why=why, model=r.pick_total,
                          num=r.pred_total, agree=side == r.pick_total))

    p = pd.DataFrame(plays)
    if p.empty:
        print("no public read fires on this board"); return
    for lbl, sub in (("AGREES WITH THE MODEL — this is the board", p[p.agree]),
                     ("DISAGREES WITH THE MODEL — conflicts, decide consciously",
                      p[~p.agree & p.model.notna()]),
                     ("model has no pick — public read standing alone", p[p.model.isna()])):
        if not len(sub):
            continue
        print(f"=== {lbl}  ({len(sub)}) ===")
        print(f"   {'kick':<6}{'mkt':<7}{'GAME':<34}{'BET':<22}{'model':>7}  {'read':<18}why")
        for _, r in sub.sort_values("kick").iterrows():
            num = f"{r.num:+.1f}" if r.market == "spread" else f"{r.num:.1f}"
            print(f"   {r.kick:<6}{r.market:<7}{r.game[:33]:<34}{r.bet[:21]:<22}{num:>7}  {r.read:<18}{r.why}")
        print()
    a = int(p.agree.sum())
    print(f"{a} of {len(p)} public reads agree with the model. Those are the ones to bet; the rest "
          f"are a choice between two signals, not a consensus.")


if __name__ == "__main__":
    main()
