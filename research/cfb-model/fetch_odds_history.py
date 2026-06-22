"""
Historical CFB betting-line MOVEMENT from The Odds API, PRE-GAME only. ALL US books.

- Sport: americanfootball_ncaaf. Markets: h2h (ML) + spreads + totals. Region: us (all books).
- Smart snapshot schedule (dense game days Thu-Sat, sparse early week) ~506 snaps/season.
- Historical cost = 10 x #markets x #regions per call = 30 credits/snap => ~15,200 credits/season.
- *** PRE-GAME ONLY: keep a game's line only if snapshot_time < commence_time (drops live/in-game odds).
  Last pre-kickoff snapshot per game = the closing line. ***
- Resumable (manifest of done timestamps), credit-capped (stops < SAFETY), incremental save.
- Run ONE SEASON AT A TIME with --year to monitor credit burn.

Usage:
  python3 fetch_odds_history.py --year 2021            # ESTIMATE only (free balance check)
  python3 fetch_odds_history.py --year 2021 --go       # pull 2021
"""
import os, sys, json, time, argparse
from datetime import datetime, timedelta, timezone
import requests
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(HERE, "data", "odds_history"); os.makedirs(OUT, exist_ok=True)
SPORT = "americanfootball_ncaaf"
MARKETS = "h2h,spreads,totals"
REGIONS = "us"
CREDITS_PER_SNAP = 30           # 10 x 3 markets x 1 region
SAFETY_MIN_CREDITS = 3000

SEASONS = {2021: ("2021-08-20", "2022-01-20"), 2022: ("2022-08-20", "2023-01-20"),
           2023: ("2023-08-20", "2024-01-20"), 2024: ("2024-08-20", "2025-01-20"),
           2025: ("2025-08-20", "2026-01-20")}
# UTC hours per weekday (Mon=0..Sun=6); dense Thu-Sat (game days incl late-night windows)
HOURS = {0: [16, 23], 1: [16, 23], 2: [16, 23], 3: [2, 16, 20, 23],
         4: [2, 16, 20, 23], 5: [1, 4, 13, 16, 19, 22], 6: [1, 16, 23]}


def key():
    for fn in (".env.local", ".env"):
        p = os.path.join(ROOT, fn)
        if os.path.exists(p):
            for line in open(p):
                for name in ("ODDS_API_KEY", "VITE_THE_ODDS_API_KEY"):
                    if line.startswith(name + "="):
                        return line.split("=", 1)[1].strip()
    raise RuntimeError("ODDS_API_KEY / VITE_THE_ODDS_API_KEY not in .env.local")


def snapshots(season):
    s, e = SEASONS[season]
    d = datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    end = datetime.fromisoformat(e).replace(tzinfo=timezone.utc)
    ts = []
    while d <= end:
        for h in HOURS[d.weekday()]:
            ts.append(d.replace(hour=h, minute=0, second=0))
        d += timedelta(days=1)
    return ts


def parse_snapshot(snap_iso, data):
    snap = datetime.fromisoformat(snap_iso.replace("Z", "+00:00"))
    rows = []
    for ev in data:
        ct = datetime.fromisoformat(ev["commence_time"].replace("Z", "+00:00"))
        if ct <= snap:          # PRE-GAME ONLY (drops live odds)
            continue
        home, away = ev["home_team"], ev["away_team"]
        for bk in ev.get("bookmakers", []):
            r = {"snapshot": snap_iso, "commence_time": ev["commence_time"], "game_id": ev["id"],
                 "home_team": home, "away_team": away, "book": bk["key"],
                 "home_ml": None, "away_ml": None, "spread_home": None, "spread_home_price": None,
                 "spread_away_price": None, "total": None, "over_price": None, "under_price": None,
                 "hrs_to_kick": round((ct - snap).total_seconds() / 3600, 1)}
            for mk in bk.get("markets", []):
                if mk["key"] == "h2h":
                    for o in mk["outcomes"]:
                        if o["name"] == home: r["home_ml"] = o.get("price")
                        elif o["name"] == away: r["away_ml"] = o.get("price")
                elif mk["key"] == "spreads":
                    for o in mk["outcomes"]:
                        if o["name"] == home: r["spread_home"], r["spread_home_price"] = o.get("point"), o.get("price")
                        elif o["name"] == away: r["spread_away_price"] = o.get("price")
                elif mk["key"] == "totals":
                    for o in mk["outcomes"]:
                        if o["name"] == "Over": r["total"], r["over_price"] = o.get("point"), o.get("price")
                        elif o["name"] == "Under": r["under_price"] = o.get("price")
            rows.append(r)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, required=True, choices=list(SEASONS))
    ap.add_argument("--go", action="store_true")
    a = ap.parse_args()
    K = key()
    base = "https://api.the-odds-api.com/v4"
    r = requests.get(f"{base}/sports", params={"apiKey": K}, timeout=30)
    remaining = int(r.headers.get("x-requests-remaining", -1))
    ts = snapshots(a.year)
    n = len(ts)
    print(f"credit balance: remaining={remaining} used={r.headers.get('x-requests-used')}")
    print(f"season {a.year}: {n} snapshots x {CREDITS_PER_SNAP} = {n*CREDITS_PER_SNAP:,} credits "
          f"(markets={MARKETS}, region={REGIONS}=all US books)")
    if not a.go:
        print("\nESTIMATE ONLY. Re-run with --go to pull this season."); return

    manifest = os.path.join(OUT, f"_done_{a.year}.json")
    done = set(json.load(open(manifest))) if os.path.exists(manifest) else set()
    fp = os.path.join(OUT, f"odds_{a.year}.parquet")
    for t in ts:
        iso = t.strftime("%Y-%m-%dT%H:%M:%SZ")
        if iso in done:
            continue
        try:
            resp = requests.get(f"{base}/historical/sports/{SPORT}/odds",
                                params={"apiKey": K, "regions": REGIONS, "markets": MARKETS,
                                        "oddsFormat": "american", "date": iso}, timeout=60)
            rem = int(resp.headers.get("x-requests-remaining", remaining))
            if resp.status_code != 200:
                print(f"  {iso}: HTTP {resp.status_code} {resp.text[:140]}")
                if resp.status_code in (401, 402, 403):
                    print("  -> auth/plan error (historical access?). Stopping."); break
                continue
            payload = resp.json()
            rows = parse_snapshot(payload.get("timestamp", iso), payload.get("data", []))
            if rows:
                df = pd.DataFrame(rows)
                if os.path.exists(fp):
                    df = pd.concat([pd.read_parquet(fp), df], ignore_index=True)
                df.to_parquet(fp, index=False)
            done.add(iso); json.dump(sorted(done), open(manifest, "w"))
            if rem < SAFETY_MIN_CREDITS:
                print(f"  STOP: credits {rem} < safety floor {SAFETY_MIN_CREDITS}"); break
            if len(done) % 50 == 0:
                print(f"  {len(done)}/{n} | {iso} | {len(rows)} rows | credits left {rem}")
        except Exception as ex:
            print(f"  {iso}: ERR {ex}"); time.sleep(2)
    tot = pd.read_parquet(fp) if os.path.exists(fp) else pd.DataFrame()
    print(f"{a.year} done: {len(done)}/{n} snapshots | {len(tot)} book-game-snapshot rows -> {fp}")


if __name__ == "__main__":
    main()
