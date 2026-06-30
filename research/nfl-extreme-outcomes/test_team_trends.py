"""Test the team-trends Outliers data on the Wk12-2025 DRY RUN.

Renders what the app will read from nfl_team_trends for a real Week 12 matchup
(both teams' situational splits per market + the head-to-head record), then
VERIFIES one split cell by re-deriving it from the raw game_log so we can eyeball
that the aggregation is correct. Read-only.

Usage:  python3 test_team_trends.py [AWAY HOME]   (default PHI DAL)
"""
import sys
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent
BASE = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
MARKETS = [("spread", "ATS cover"), ("moneyline", "ML win"), ("team_total", "team-total OVER"),
           ("total", "game OVER"), ("h1_spread", "1H ATS cover"), ("h1_total", "1H OVER")]
DIMS = [("overall", "overall"), ("home", "at home"), ("away", "on road"),
        ("favorite", "as favorite"), ("underdog", "as underdog")]


def key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("no key")


def fetch(ab, k):
    hdr = {"apikey": k, "Authorization": f"Bearer {k}"}
    r = requests.get(f"{BASE}/nfl_team_trends?team_abbr=eq.{ab}&season=eq.2025&through_week=eq.11",
                     headers=hdr, timeout=30).json()
    return r[0] if r else None


def cell(d):
    if not d or d.get("n", 0) == 0:
        return "  –  "
    pct = d["pct"]
    return f"{d['h']}-{d['l']}{('-'+str(d['p'])) if d.get('p') else ''} ({pct*100:.0f}%)"


def render(t, opp):
    print(f"\n{'='*66}\n{t['team_abbr']} — season {t['su_record']} SU, {t['games']} games "
          f"(ATS {t['ats_w']}-{t['ats_l']}, Over {t['over_pct']})\n{'='*66}")
    sp = t.get("splits") or {}
    mu = (t.get("matchups") or {}).get(opp)
    for mk, label in MARKETS:
        print(f"  {label}")
        block = sp.get(mk, {})
        for dim, dlabel in DIMS:
            w = block.get(dim, {})
            print(f"    {dlabel:12s}  L3 {cell(w.get('3')):14s}  L5 {cell(w.get('5')):14s}  L7 {cell(w.get('7'))}")
        if mu and mk in mu:
            m = mu[mk]
            print(f"    vs {opp} (H2H, last {mu['meetings']}): {m['h']}-{m['n']-m['h']} ({(m['pct'] or 0)*100:.0f}%)")
    return t


def verify(t):
    """Re-derive 'spread / at home / L5' straight from game_log and compare."""
    gl = t.get("game_log") or []
    home_ats = [(g["week"], g["opp"], g["ats"]) for g in gl if g["is_home"] and g.get("ats")]
    last5 = home_ats[:5]
    h = sum(1 for _, _, a in last5 if a == "W")
    l = sum(1 for _, _, a in last5 if a == "L")
    stored = (t.get("splits") or {}).get("spread", {}).get("home", {}).get("5", {})
    print(f"\n{'-'*66}\nVERIFY {t['team_abbr']} spread/home/L5 from game_log (newest-first):")
    for wk, opp, a in last5:
        print(f"    wk{wk:>2} vs {opp:<4} -> {a}")
    print(f"  re-derived: {h}-{l}   |   stored split: {cell(stored)}   "
          f"=> {'MATCH' if (h==stored.get('h') and l==stored.get('l')) else 'MISMATCH!!'}")


if __name__ == "__main__":
    away, home = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ("PHI", "DAL")
    k = key()
    ta, th = fetch(away, k), fetch(home, k)
    if not ta or not th:
        sys.exit(f"missing trends row for {away} or {home}")
    print(f"\n### Week 12 dry-run trend cards: {away} @ {home} ###")
    render(th, away)   # home team, H2H vs away
    render(ta, home)   # away team, H2H vs home
    verify(th)
    verify(ta)
