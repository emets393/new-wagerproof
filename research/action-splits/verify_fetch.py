"""
Does fetch_action.py still agree with the site? Re-fetch a week and diff it.

    python3 verify_fetch.py nfl 2026 6              vs the pasted rows in the CSV
    python3 verify_fetch.py nfl 2026 6 --live       vs a second fetch 60s later

Why this exists. The fetcher reads an UNDOCUMENTED endpoint. Nobody will send us a
deprecation notice; the failure we actually have to catch is the silent one, where the
shape changes and we start writing blanks or stale numbers into the research base. So
the check is on the VALUES, not on the HTTP status.

Two things it separates, which the first run of this confused:

  SPLITS + OPENER are point-in-time facts that settle. `bets_*`, `money_*`, `tickets`
  and the opening line should reproduce a pasted week closely. They will not reproduce
  it EXACTLY, and that is not a bug: a paste captured Thursday and a fetch run Sunday
  are two different moments of a live market, and `tickets` in particular keeps
  climbing right up to kickoff. Treat a large drift here as a capture-time difference
  first and a defect second.

  BEST ODDS cannot be reproduced after the fact at all. `away_close` / `home_close` /
  `*_price` are the best price available AT THE MOMENT YOU LOOK. Re-reading a finished
  week gives you the closing number, not the one that was on the screen when the week
  was pasted. Measured on NFL weeks 1-4: splits agreed on ~95% of rows, best-odds on
  ~58%. ⛔ Do NOT "fix" that gap by backfilling old weeks from the API — it would
  silently rewrite history that was captured mid-week.

--live is the real regression test: fetch twice a minute apart. Everything except the
genuinely moving numbers must be identical. If the opener or the team names shift
between two reads a minute apart, the endpoint changed under us.
"""
import argparse
import csv
import subprocess
import sys
import tempfile
import time
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
KEY = ("sport", "season", "week", "market", "away", "home")

# the columns that should settle, and the ones that cannot be compared across time
SETTLED = ["away_open", "home_open", "bets_away", "bets_home",
           "money_away", "money_home"]
MOVING = ["away_close", "home_close", "away_price", "home_price",
          "tickets", "away_move", "home_move"]


def load(path, where=None):
    with open(path) as f:
        rows = [r for r in csv.DictReader(f) if not where or where(r)]
    return {tuple(r[k] for k in KEY): r for r in rows}


def fetch(league, season, week):
    tmp = Path(tempfile.mkdtemp()) / "f.csv"
    subprocess.run([sys.executable, str(ROOT / "fetch_action.py"), league,
                    str(season), str(week), "--out", str(tmp), "--no-merge"],
                   check=True, stdout=subprocess.DEVNULL)
    return load(tmp)


def norm(v):
    if v in ("", None):
        return None
    try:
        return round(float(v), 4)
    except ValueError:
        return v


def compare(a, b, fields, label_a, label_b):
    both = set(a) & set(b)
    miss = Counter()
    ex = defaultdict(list)
    for k in both:
        for f in fields:
            x, y = norm(a[k][f]), norm(b[k][f])
            if x != y:
                miss[f] += 1
                if len(ex[f]) < 2:
                    ex[f].append(f"wk{k[2]} {k[3]} {k[4]}@{k[5]}: "
                                 f"{label_a}={x} {label_b}={y}")
    for f in fields:
        pct = 100 * (len(both) - miss[f]) / len(both) if both else 0
        print(f"   {'OK ' if not miss[f] else '   '} {f:<14} "
              f"{len(both) - miss[f]}/{len(both)} agree ({pct:.0f}%)")
        for e in ex[f]:
            print(f"          {e}")
    return both, miss


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("league")
    ap.add_argument("season", type=int)
    ap.add_argument("weeks")
    ap.add_argument("--live", action="store_true",
                    help="fetch twice 60s apart instead of comparing to the CSV")
    a = ap.parse_args()

    one = fetch(a.league, a.season, a.weeks)
    print(f"[fetch] {len(one)} rows")

    if a.live:
        print("[live] second read in 60s — everything but a moving market must match")
        time.sleep(60)
        two = fetch(a.league, a.season, a.weeks)
        if set(one) != set(two):
            print(f"  ⚠ GAME SET CHANGED between reads: "
                  f"{len(set(one) ^ set(two))} rows differ")
        both, miss = compare(one, two, SETTLED + ["tickets"], "t0", "t1")
        # Only tickets may legitimately move in 60 seconds.
        bad = {f: n for f, n in miss.items() if n and f != "tickets"}
        print("\n[verdict]", "STABLE" if not bad else f"⚠ UNSTABLE: {bad}")
        return

    sport = {"nfl": "nfl", "ncaaf": "cfb"}[a.league]
    paste = load(ROOT / "data" / "action_splits.csv", lambda r: r["sport"] == sport)
    if not paste:
        print(f"no pasted {sport} rows to compare against")
        return
    print(f"[paste] {len(paste)} rows on file\n"
          f"\n SETTLED — should agree closely (differences = capture time):")
    both, miss = compare(paste, one, SETTLED, "paste", "fetch")
    print(f"\n MOVING — cannot be reproduced after the fact, shown for information:")
    compare(paste, one, MOVING, "paste", "fetch")
    worst = max((miss[f] for f in SETTLED), default=0)
    rate = 100 * (len(both) - worst) / len(both) if both else 0
    print(f"\n[verdict] worst settled column agrees on {rate:.0f}% of {len(both)} rows."
          f"  {'OK' if rate >= 85 else '⚠ LOOK AT THIS'}")


if __name__ == "__main__":
    main()
