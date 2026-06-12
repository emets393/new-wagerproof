"""Week 12 2025 DRY RUN — player props staging load.

One row per (player, market): consensus close line/price (median across the
4 US books), point-in-time L5/L10 trends through Week 11, P-flags fired
(PROPS_BRIEF1 P1-P10; the game-level P11 lives in nfl_dryrun_flags), and the
headshot join via nfl_player_profiles. Loads nfl_dryrun_props.

Usage:  python3 dryrun_wk12_props.py [--no-load]
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
BASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
SEASON, WEEK = 2025, 12
BATCH = 500
STAT_OF = {
    "player_pass_yds": "passing_yards", "player_pass_tds": "passing_tds",
    "player_receptions": "receptions", "player_reception_yds": "receiving_yards",
    "player_rush_yds": "rushing_yards", "player_anytime_td": "td_any",
}


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found in .env.local")


def fetch_headshots(key):
    hdr = {"apikey": key, "Authorization": f"Bearer {key}"}
    out, offset = {}, 0
    while True:
        r = requests.get(f"{BASE_URL}/nfl_player_profiles?select=gsis_id,headshot_url"
                         f"&limit=1000&offset={offset}", headers=hdr, timeout=60)
        rows = r.json()
        if not isinstance(rows, list) or not rows:
            break
        out.update({x["gsis_id"]: x["headshot_url"] for x in rows})
        if len(rows) < 1000:
            break
        offset += 1000
    return out


def consensus(pf):
    """Collapse the per-book wk12 frame to one consensus row per (player, market)."""
    w = pf[(pf.season == SEASON) & (pf.week == WEEK)].copy()
    keys = ["event_id", "player_id", "player_name", "position", "team",
            "market", "home_team", "away_team"]
    g = w.groupby(keys, dropna=False)
    c = g.agg(
        close_line=("close_line", "median"), open_line=("open_line", "median"),
        over_price=("close_over", "median"), under_price=("close_under", "median"),
        book_line_spread=("close_line", lambda s: s.max() - s.min()),
        n_books=("bookmaker", "nunique"),
        close_yes_prob=("close_yes_prob", "median"),
        open_yes_prob=("open_yes_prob", "median"),
        gp_prior=("gp_prior", "first"), last_game=("last_game", "first"),
        l3_avg=("l3_avg", "first"), l5_avg=("l5_avg", "first"),
        szn_avg=("szn_avg", "first"), szn_max=("szn_max", "first"),
        szn_min=("szn_min", "first"), opp=("opp", "first"),
        def_allowed_pos=("def_allowed_pos", "first"),
        lg_allowed_pos=("lg_allowed_pos", "first"),
        def_matchup_idx=("def_matchup_idx", "first"),
        report_status=("report_status", "first"),
        practice_status=("practice_status", "first"),
    ).reset_index()
    c["line_delta"] = c.close_line - c.open_line
    # ATD has no line; yes probs only apply to ATD
    is_atd = c.market == "player_anytime_td"
    c.loc[is_atd, ["close_line", "open_line", "line_delta", "book_line_spread",
                   "under_price"]] = np.nan
    c.loc[~is_atd, ["close_yes_prob", "open_yes_prob"]] = np.nan
    return c


def recent_form(c):
    """L10 trends + per-game history from player_offense, weeks < 12 only."""
    po = pd.read_parquet(DATA / "player_offense.parquet")
    po = po[(po.season == SEASON) & (po.week < WEEK) & (po.season_type == "REG")].copy()
    po["td_any"] = po.rushing_tds.fillna(0) + po.receiving_tds.fillna(0)
    ge = pd.read_parquet(DATA / "games_enriched.parquet")
    ge = ge[ge.season == SEASON]
    opp_map = {}
    for _, r in ge.iterrows():
        opp_map[(r.week, r.home_team)] = r.away_team
        opp_map[(r.week, r.away_team)] = r.home_team
    po["opp"] = [opp_map.get((w, t)) for w, t in zip(po.week, po.team)]

    l10_avg, rate5, rate10, recent = [], [], [], []
    hist = {pid: d.sort_values("week") for pid, d in po.groupby("player_id")}
    for _, r in c.iterrows():
        stat = STAT_OF[r.market]
        d = hist.get(r.player_id)
        if d is None or stat not in d.columns:
            l10_avg.append(None); rate5.append(None); rate10.append(None); recent.append([])
            continue
        s = d.dropna(subset=[stat]).tail(10)
        vals = s[stat].astype(float)
        l10_avg.append(round(vals.mean(), 2) if len(vals) else None)
        if pd.notna(r.close_line) and len(vals):
            rate10.append(round((vals > r.close_line).mean(), 3))
            v5 = vals.tail(5)
            rate5.append(round((v5 > r.close_line).mean(), 3))
        else:
            rate5.append(None); rate10.append(None)
        recent.append([dict(week=int(w), opp=o, actual=float(v))
                       for w, o, v in zip(s.week, s.opp, vals)])
    c["l10_avg"] = l10_avg
    c["over_rate_l5"] = rate5
    c["over_rate_l10"] = rate10
    c["recent_games"] = recent
    return c


def weekly_panel(pf, market):
    """Per (player, prop-week) consensus close line + result, weeks < 12 (for P9/P10)."""
    h = pf[(pf.season == SEASON) & (pf.week < WEEK) & (pf.market == market)]
    p = (h.groupby(["player_id", "week"])
         .agg(line=("close_line", "median"), actual=("actual", "first"))
         .reset_index().sort_values("week"))
    return {pid: d for pid, d in p.groupby("player_id")}


def add_flags(c, pf):
    p9_hist = weekly_panel(pf, "player_pass_tds")
    p10_hist = weekly_panel(pf, "player_receptions")
    flags = []
    for _, r in c.iterrows():
        f = []
        dev = ((r.close_line - r.l5_avg) / r.l5_avg
               if pd.notna(r.close_line) and pd.notna(r.l5_avg) and r.l5_avg > 0 else None)
        gp4 = pd.notna(r.gp_prior) and r.gp_prior >= 4
        if r.market == "player_pass_yds":
            if gp4 and dev is not None and dev > 0.05:
                f.append("P1")                         # line above form -> OVER
            if gp4 and dev is not None and -0.20 <= dev <= -0.05:
                f.append("P2")                         # line 5-20% below form -> UNDER
        if r.market == "player_pass_tds" and gp4 and dev is not None and dev >= 0.40:
            f.append("P3")                             # TD line >=40% above form -> OVER
        if r.market in ("player_pass_yds", "player_pass_tds") and r.gp_prior == 0:
            f.append("P4")                             # no-history QB -> UNDER
        if r.market == "player_anytime_td" and pd.notna(r.close_yes_prob) and pd.notna(r.open_yes_prob):
            move = r.close_yes_prob - r.open_yes_prob
            if move <= -0.05:
                f.append("P5")                         # drift-down -> YES at close
            if move >= 0.05:
                f.append("P6")                         # steam-up -> NEVER BET
        if (r.market == "player_rush_yds" and pd.notna(r.def_matchup_idx)
                and r.def_matchup_idx <= 0.8 and WEEK >= 5):
            f.append("P7")                             # very tough run D -> UNDER
        if (r.market == "player_rush_yds" and pd.notna(r.book_line_spread)
                and r.book_line_spread >= 3):
            f.append("P8")                             # shop UNDER at the highest book line
        if r.market == "player_pass_tds" and r.player_id in p9_hist:
            d = p9_hist[r.player_id].dropna(subset=["line", "actual"]).tail(2)
            if len(d) == 2 and (d.actual < d.line).all():
                f.append("P9")                         # 2 straight prop-week unders -> OVER
        if r.market == "player_receptions" and r.player_id in p10_hist and pd.notna(r.close_line):
            d = p10_hist[r.player_id].dropna(subset=["line"]).tail(2)
            if len(d) == 2 and r.close_line > d.line.iloc[1] > d.line.iloc[0]:
                f.append("P10")                        # line raised 2 straight weeks -> UNDER
        flags.append(f)
    c["p_flags"] = flags
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-load", action="store_true")
    args = ap.parse_args()

    pf = pd.read_parquet(DATA / "props_frame.parquet")
    c = consensus(pf)
    c = recent_form(c)
    c = add_flags(c, pf)

    # map to dry-run game ids via home team
    tm = pd.read_parquet(DATA / "team_mapping.parquet")
    name_ab = dict(zip(tm.city_and_name, tm["Team Abbrev"].replace({"LAR": "LA"})))
    hp = pd.read_parquet(DATA / "h1m_preds.parquet")
    hp = hp[(hp.season == SEASON) & (hp.week == WEEK)]
    gid = dict(zip(hp.home_ab, hp.game_id))
    c["home_ab"] = c.home_team.map(name_ab)
    c["game_id"] = c.home_ab.map(gid)
    c["is_home"] = c.team == c.home_ab

    key = load_key()
    heads = fetch_headshots(key)
    c["headshot_url"] = c.player_id.map(heads)

    n_flag = (c.p_flags.str.len() > 0).sum()
    print(f"{len(c)} prop rows | {c.player_id.nunique()} players | "
          f"{c.game_id.nunique()} games | rows with flags: {n_flag} | "
          f"headshots: {c.headshot_url.notna().mean():.1%}")
    print(c.explode("p_flags").groupby("p_flags").size())

    rows = []
    for _, r in c.iterrows():
        rows.append(dict(
            game_id=r.game_id, event_id=r.event_id, season=SEASON, week=WEEK,
            player_id=r.player_id, player_name=r.player_name, position=r.position,
            team=r.team, opponent=r.opp, is_home=bool(r.is_home),
            market=r.market,
            close_line=r.close_line, over_price=r.over_price, under_price=r.under_price,
            open_line=r.open_line, line_delta=r.line_delta, line_range=r.book_line_spread,
            n_books=int(r.n_books),
            close_yes_prob=round(float(r.close_yes_prob), 4) if pd.notna(r.close_yes_prob) else None,
            open_yes_prob=round(float(r.open_yes_prob), 4) if pd.notna(r.open_yes_prob) else None,
            gp_prior=int(r.gp_prior) if pd.notna(r.gp_prior) else None,
            last_game=r.last_game, l3_avg=r.l3_avg, l5_avg=r.l5_avg, l10_avg=r.l10_avg,
            szn_avg=r.szn_avg, szn_max=r.szn_max, szn_min=r.szn_min,
            over_rate_l5=r.over_rate_l5, over_rate_l10=r.over_rate_l10,
            recent_games=r.recent_games,
            def_allowed_pos=r.def_allowed_pos, lg_allowed_pos=r.lg_allowed_pos,
            def_matchup_idx=r.def_matchup_idx,
            report_status=r.report_status, practice_status=r.practice_status,
            flags=r.p_flags, headshot_url=r.headshot_url))
    df = pd.DataFrame(rows).replace({np.nan: None})

    if args.no_load:
        return
    hdr = {"apikey": key, "Authorization": f"Bearer {key}",
           "Content-Type": "application/json", "Prefer": "return=minimal"}
    resp = requests.delete(f"{BASE_URL}/nfl_dryrun_props?season=eq.{SEASON}&week=eq.{WEEK}",
                           headers=hdr, timeout=60)
    if resp.status_code not in (200, 204):
        sys.exit(f"delete: {resp.status_code} {resp.text[:300]}")
    recs = json.loads(df.to_json(orient="records"))
    for i in range(0, len(recs), BATCH):
        resp = requests.post(f"{BASE_URL}/nfl_dryrun_props", headers=hdr,
                             json=recs[i:i + BATCH], timeout=120)
        if resp.status_code != 201:
            sys.exit(f"batch {i}: {resp.status_code} {resp.text[:300]}")
        print(f"  loaded {min(i + BATCH, len(recs))}/{len(recs)}", end="\r")
    print(f"\nloaded {len(recs)} rows -> nfl_dryrun_props")


if __name__ == "__main__":
    main()
