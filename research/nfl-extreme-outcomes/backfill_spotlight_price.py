#!/usr/bin/env python3
"""Stamp price on spotlight picks from the page row's posted market, and settle units.

One-off for rows published before nfl_prop_spotlight carried a price, and the same routine the
grader uses to compute units once a result lands.

⛔ The price comes from the PAGE ROW for that player-week, which is the board the reader saw.
It is not re-pulled from the odds feed, because today's number is not the number the pick was
published at.
"""
import argparse, json, sys, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import prop_cheatsheet as PC

SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"


def units_for(result, price):
    if result is None or price is None:
        return None
    if result == "push":
        return 0.0
    if result == "loss":
        return -1.0
    p = float(price)
    return round(p / 100.0 if p > 0 else 100.0 / abs(p), 4)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=2026)
    ap.add_argument("--week", type=int)
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    k = PC.key()
    h = {"apikey": k, "Authorization": f"Bearer {k}"}
    wk = f"&week=eq.{a.week}" if a.week else ""
    picks = PC.get(f"nfl_prop_spotlight?season=eq.{a.season}{wk}"
                   f"&select=id,week,player_id,market,side,result,price,units", k)
    pages = PC.get(f"nfl_prop_player_pages?season=eq.{a.season}{wk}"
                   f"&select=player_id,week,markets", k)
    book = {(str(p["player_id"]), p["week"]): {m["key"]: m for m in (p.get("markets") or [])}
            for p in pages}
    upd = []
    for p in picks:
        mk = book.get((str(p["player_id"]), p["week"]), {}).get(p["market"]) or {}
        price = mk.get("over_price") if p["side"] == "over" else mk.get("under_price")
        price = p["price"] if p.get("price") is not None else (
            int(price) if price is not None else None)
        u = units_for(p.get("result"), price)
        if price == p.get("price") and u == p.get("units"):
            continue
        upd.append(dict(id=p["id"], price=price, units=u))
    have = sum(1 for x in upd if x["price"] is not None)
    print(f"{len(picks)} picks | {len(upd)} need a change | {have} resolved to a price")
    if not a.write:
        print("dry run — pass --write"); return
    hdr = {**h, "Content-Type": "application/json", "Prefer": "return=minimal"}
    for x in upd:
        r = urllib.request.Request(f"{SUPA}/nfl_prop_spotlight?id=eq.{x['id']}",
                                   data=json.dumps({kk: vv for kk, vv in x.items() if kk != "id"}).encode(),
                                   method="PATCH", headers=hdr)
        urllib.request.urlopen(r, timeout=60)
    print(f"stamped {len(upd)} rows")


if __name__ == "__main__":
    main()
