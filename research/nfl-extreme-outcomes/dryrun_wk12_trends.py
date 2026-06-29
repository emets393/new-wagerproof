"""Week 12 2025 DRY RUN — per-team trend records into nfl_team_trends.

Pretend it's Wednesday of Week 12: every team's record covers their 2025 games
through Week 11 only (point-in-time). Mirrors cfb_team_trends so the same Swift
"team trends" section renders both sports; the only schema difference is that the
NFL table is keyed by team_abbr (joins nfl_teams.team_abbr) and game_log opponents
are abbreviations.

game_log is newest-first (index 0 = most recent game); last5_* take the first up-to-5.

Usage:  python3 dryrun_wk12_trends.py [--no-load]
"""
import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
BASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
# Season/week parametrized for production (env), defaulting to the Wk12-2025 dry-run so
# an unparameterized run stays byte-for-byte the original. THROUGH_WEEK = completed weeks.
SEASON = int(os.environ.get("NFL_SEASON", 2025))
THROUGH_WEEK = int(os.environ.get("NFL_WEEK", 12)) - 1

# splits spec: 6 markets x 5 dimensions x 3 windows, derived from game_log (current season).
# market -> (game_log field, hit-letter, loss-letter). hit = cover/win/over.
MKT = {"spread": ("ats", "W", "L"), "moneyline": ("su", "W", "L"),
       "total": ("ou", "O", "U"), "team_total": ("tt", "O", "U"),
       "h1_spread": ("h1_ats", "W", "L"), "h1_total": ("h1_ou", "O", "U")}
DIMS = ["overall", "home", "away", "favorite", "underdog"]
WINDOWS = [3, 5, 7]
MATCHUP_CAP = 6   # last N head-to-head meetings (cross-season) per opponent

_tm = pd.read_parquet(DATA / "team_mapping.parquet")
NORM = {"LAR": "LA", "WSH": "WAS", "JAC": "JAX"}
_tm["ab"] = _tm["Team Abbrev"].replace(NORM)
AB_NAME = dict(zip(_tm.ab, _tm.city_and_name))   # "LA" -> "Los Angeles Rams"


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found in .env.local")


def wl(margin):
    """Result letter from a signed margin: positive=W/O, negative=L/U, 0=P."""
    if margin > 0:
        return "W"
    if margin < 0:
        return "L"
    return "P"


def ou(margin):
    if margin > 0:
        return "O"
    if margin < 0:
        return "U"
    return "P"


def team_games(f, ab):
    """One row per game for `ab`, team's perspective, newest week first."""
    rows = []
    sub = f[(f.home_ab == ab) | (f.away_ab == ab)].sort_values("week")
    for _, r in sub.iterrows():
        home = r.home_ab == ab
        opp = r.away_ab if home else r.home_ab
        team_pts = r.final_home if home else r.final_away
        opp_pts = r.final_away if home else r.final_home
        if pd.isna(team_pts) or pd.isna(opp_pts):
            continue
        team_pts, opp_pts = int(team_pts), int(opp_pts)
        spread = r.spread_close_spread_home if home else -r.spread_close_spread_home  # team's line
        total = r.total_close_total_point
        tt_line = r.tt_home_close_tt_home_point if home else r.tt_away_close_tt_away_point
        total_points = team_pts + opp_pts

        cover_margin = (team_pts - opp_pts) + spread if pd.notna(spread) else None
        ou_margin = total_points - total if pd.notna(total) else None
        tt_margin = team_pts - tt_line if pd.notna(tt_line) else None

        # first half
        th = r.h1_home if home else r.h1_away
        oh = r.h1_away if home else r.h1_home
        h1_spread = (r.h1_spread_close_h1_spread_home if home
                     else -r.h1_spread_close_h1_spread_home)
        h1_total = r.h1_total_close_h1_total_point
        h1_cover_margin = ((th - oh) + h1_spread
                           if pd.notna(th) and pd.notna(oh) and pd.notna(h1_spread) else None)
        h1_total_points = (th + oh) if pd.notna(th) and pd.notna(oh) else None
        h1_ou_margin = (h1_total_points - h1_total
                        if h1_total_points is not None and pd.notna(h1_total) else None)

        rows.append(dict(
            week=int(r.week),
            opp=opp,
            date=str(r.gameday),
            is_home=bool(home),
            team_pts=team_pts, pts_for=team_pts, pts_against=opp_pts,
            total_points=total_points,
            spread=round(float(spread), 1) if pd.notna(spread) else None,
            total=round(float(total), 1) if pd.notna(total) else None,
            tt_line=round(float(tt_line), 1) if pd.notna(tt_line) else None,
            h1_spread=round(float(h1_spread), 1) if pd.notna(h1_spread) else None,
            h1_total=round(float(h1_total), 1) if pd.notna(h1_total) else None,
            su=wl(team_pts - opp_pts),
            ats=wl(cover_margin) if cover_margin is not None else None,
            ou=ou(ou_margin) if ou_margin is not None else None,
            tt=ou(tt_margin) if tt_margin is not None else None,
            h1_ats=wl(h1_cover_margin) if h1_cover_margin is not None else None,
            h1_ou=ou(h1_ou_margin) if h1_ou_margin is not None else None,
            cover_margin=round(float(cover_margin), 1) if cover_margin is not None else None,
            ou_margin=round(float(ou_margin), 1) if ou_margin is not None else None,
            tt_margin=round(float(tt_margin), 1) if tt_margin is not None else None,
            h1_cover_margin=round(float(h1_cover_margin), 1) if h1_cover_margin is not None else None,
            h1_ou_margin=round(float(h1_ou_margin), 1) if h1_ou_margin is not None else None,
        ))
    rows.reverse()   # newest-first
    return rows


def pct(w, total):
    return round(w / total, 3) if total else None


def _dim_ok(g, dim):
    if dim == "overall":
        return True
    if dim == "home":
        return g["is_home"]
    if dim == "away":
        return not g["is_home"]
    if dim == "favorite":
        return g["spread"] is not None and g["spread"] < 0
    if dim == "underdog":
        return g["spread"] is not None and g["spread"] > 0
    return False


def compute_splits(gl):
    """game_log (newest-first) -> {market: {dimension: {window: {h,l,p,n,pct}}}}.
    Per market, drop games missing that line, take the last `window` -> 'h of n'."""
    out = {}
    for mkt, (fld, hit, loss) in MKT.items():
        out[mkt] = {}
        for dim in DIMS:
            games = [g for g in gl if _dim_ok(g, dim) and g.get(fld) is not None]
            out[mkt][dim] = {}
            for w in WINDOWS:
                win = games[:w]
                h = sum(1 for g in win if g[fld] == hit)
                l = sum(1 for g in win if g[fld] == loss)
                p = sum(1 for g in win if g[fld] == "P")
                out[mkt][dim][str(w)] = {"h": h, "l": l, "p": p, "n": h + l,
                                         "pct": pct(h, h + l)}
    return out


def fetch_matchup_history(key):
    hdr = {"apikey": key, "Authorization": f"Bearer {key}"}
    cols = "matchup_key,date,away_team,home_team,winner_team,cover_team,ou_result"
    rows, offset = [], 0
    while True:
        r = requests.get(f"{BASE_URL}/nfl_matchup_history?select={cols}&limit=1000&offset={offset}",
                         headers=hdr, timeout=60).json()
        if not isinstance(r, list) or not r:
            break
        rows.extend(r)
        if len(r) < 1000:
            break
        offset += 1000
    return rows


def compute_matchups(history, ab):
    """Last MATCHUP_CAP H2H meetings vs each opponent (cross-season): spread/ml/total."""
    mine = [r for r in history if r["home_team"] == ab or r["away_team"] == ab]
    by_opp = {}
    for r in mine:
        opp = r["away_team"] if r["home_team"] == ab else r["home_team"]
        by_opp.setdefault(opp, []).append(r)
    out = {}
    for opp, rs in by_opp.items():
        rs = sorted(rs, key=lambda r: r["date"] or "", reverse=True)[:MATCHUP_CAP]
        ats_w = sum(1 for r in rs if r.get("cover_team") == ab)
        ats_n = sum(1 for r in rs if r.get("cover_team") in (ab, opp))   # exclude push
        ou_o = sum(1 for r in rs if (r.get("ou_result") or "").upper() == "OVER")
        ou_n = sum(1 for r in rs if (r.get("ou_result") or "").upper() in ("OVER", "UNDER"))
        su_w = sum(1 for r in rs if r.get("winner_team") == ab)
        out[opp] = {
            "meetings": len(rs),
            "spread": {"h": ats_w, "n": ats_n, "pct": pct(ats_w, ats_n)},
            "moneyline": {"h": su_w, "n": len(rs), "pct": pct(su_w, len(rs))},
            "total": {"h": ou_o, "n": ou_n, "pct": pct(ou_o, ou_n)},
        }
    return out


def build(history=None):
    f = pd.read_parquet(DATA / "h1tt_frame.parquet")
    f = f[(f.season == SEASON) & (f.week <= THROUGH_WEEK)].copy()
    history = history or []
    teams = sorted(set(f.home_ab) | set(f.away_ab))
    out = []
    for ab in teams:
        gl = team_games(f, ab)
        if not gl:
            continue
        su_w = sum(g["su"] == "W" for g in gl)
        su_l = sum(g["su"] == "L" for g in gl)
        ats_w = sum(g["ats"] == "W" for g in gl)
        ats_l = sum(g["ats"] == "L" for g in gl)
        ats_p = sum(g["ats"] == "P" for g in gl)
        ou_o = sum(g["ou"] == "O" for g in gl)
        ou_u = sum(g["ou"] == "U" for g in gl)
        ou_p = sum(g["ou"] == "P" for g in gl)
        tt_o = sum(g["tt"] == "O" for g in gl)
        tt_u = sum(g["tt"] == "U" for g in gl)
        h1_aw = sum(g["h1_ats"] == "W" for g in gl)
        h1_al = sum(g["h1_ats"] == "L" for g in gl)
        h1_ap = sum(g["h1_ats"] == "P" for g in gl)
        h1_oo = sum(g["h1_ou"] == "O" for g in gl)
        h1_ou_u = sum(g["h1_ou"] == "U" for g in gl)
        out.append(dict(
            team_abbr=ab, team_name=AB_NAME.get(ab, ab),
            season=SEASON, through_week=THROUGH_WEEK, games=len(gl),
            su_w=su_w, su_l=su_l, su_record=f"{su_w}-{su_l}",
            ats_w=ats_w, ats_l=ats_l, ats_p=ats_p, ats_pct=pct(ats_w, ats_w + ats_l),
            ou_o=ou_o, ou_u=ou_u, ou_p=ou_p, over_pct=pct(ou_o, ou_o + ou_u),
            tt_o=tt_o, tt_u=tt_u, tt_games=tt_o + tt_u, tt_over_pct=pct(tt_o, tt_o + tt_u),
            h1_ats_w=h1_aw, h1_ats_l=h1_al, h1_ats_p=h1_ap, h1_ats_games=h1_aw + h1_al + h1_ap,
            h1_ats_pct=pct(h1_aw, h1_aw + h1_al),
            h1_ou_o=h1_oo, h1_ou_u=h1_ou_u, h1_ou_games=h1_oo + h1_ou_u,
            h1_over_pct=pct(h1_oo, h1_oo + h1_ou_u),
            last5_su=[g["su"] for g in gl[:5]],
            last5_ats=[g["ats"] for g in gl[:5]],
            last5_ou=[g["ou"] for g in gl[:5]],
            game_log=gl,
            splits=compute_splits(gl),                      # home/away + fav/dog x 3/5/7 x 6 markets
            matchups=compute_matchups(history, ab),         # H2H vs each opponent (cross-season)
        ))
    return pd.DataFrame(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-load", action="store_true")
    args = ap.parse_args()

    key = load_key()
    history = fetch_matchup_history(key)
    df = build(history)
    print(f"{len(df)} teams through week {THROUGH_WEEK} | matchup-history rows: {len(history)}")
    print(df[["team_abbr", "su_record", "ats_w", "ats_l", "over_pct", "games"]].to_string(index=False))
    if args.no_load:
        # show one team's splits sample for sanity
        s = df.iloc[0]
        print(f"\nsample splits for {s.team_abbr} — spread:", json.dumps(s.splits["spread"], indent=0))
        print(f"sample matchups for {s.team_abbr}:", json.dumps(s.matchups, indent=0)[:400])
        return

    recs = json.loads(df.to_json(orient="records"))
    hdr = {"apikey": key, "Authorization": f"Bearer {key}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}
    requests.delete(f"{BASE_URL}/nfl_team_trends?season=eq.{SEASON}&through_week=eq.{THROUGH_WEEK}",
                    headers=hdr, timeout=60)
    resp = requests.post(f"{BASE_URL}/nfl_team_trends", headers=hdr, json=recs, timeout=120)
    if resp.status_code != 201:
        sys.exit(f"insert: {resp.status_code} {resp.text[:300]}")
    print(f"loaded {len(recs)} rows -> nfl_team_trends")


if __name__ == "__main__":
    main()
