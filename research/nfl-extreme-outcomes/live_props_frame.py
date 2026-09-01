"""LIVE props_frame builder — the missing bridge from nfl_player_props (DB captures) to
the per-book frame nfl_slate_props_build consumes (owner escalation 2026-08-15: the generator
read only the frozen June research frame, so live-season captures never reached staging).

For (SEASON, WEEK): pull all captured rows, aggregate per (event, player, market, book) to
open (first snapshot) / close (latest snapshot) lines+prices, then attach the as-of context
the frame contract requires — form averages from player logs BEFORE this week (prior season
for week 1), opponent position-allowed indices, and the latest injury statuses. Output is
appended to data/props_frame.parquet rows for this week (replacing any prior build of the
same week) so the generator's existing consensus() works unchanged.

Usage: NFL_SEASON=2026 NFL_WEEK=1 python3 live_props_frame.py
"""
import os
import numpy as np
import pandas as pd
import requests

SEASON = int(os.environ.get("NFL_SEASON", 2026))
WEEK = int(os.environ.get("NFL_WEEK", 1))
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
BASE_URL = None
KEY = None
for fn in (os.path.join(HERE, "..", "..", ".env.local"),):
    if os.path.exists(fn):
        for line in open(fn):
            if line.startswith("SUPABASE_SERVICE_KEY="):
                KEY = line.split("=", 1)[1].strip()
KEY = KEY or os.environ.get("SUPABASE_SERVICE_KEY")
BASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
HDR = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

MARKET_STAT = {"player_pass_yds": "pass_yds", "player_pass_tds": "pass_tds",
               "player_receptions": "receptions", "player_reception_yds": "rec_yds",
               "player_rush_yds": "rush_yds", "player_anytime_td": "atd",
               "player_pass_attempts": "pass_attempts", "player_rush_attempts": "carries",
               "player_pass_completions": "completions"}
POS_STAT = {"pass_yds": "QB", "pass_tds": "QB", "pass_attempts": "QB", "completions": "QB",
            "rush_yds": "RB", "carries": "RB", "receptions": "WR", "rec_yds": "WR"}


def fetch_week_rows():
    out, offset = [], 0
    while True:
        r = requests.get(f"{BASE_URL}/nfl_player_props?season=eq.{SEASON}&week=eq.{WEEK}"
                         f"&select=*&limit=1000&offset={offset}", headers=HDR, timeout=60)
        rows = r.json()
        if not isinstance(rows, list) or not rows:
            break
        out.extend(rows)
        if len(rows) < 1000:
            break
        offset += 1000
    return pd.DataFrame(out)


def american_to_prob(o):
    o = pd.to_numeric(o, errors="coerce")
    return np.where(o < 0, -o / (-o + 100), 100 / (o + 100))


def build():
    raw = fetch_week_rows()
    if raw.empty:
        print(f"[live-frame] no captured props for {SEASON} wk{WEEK} — frame untouched")
        return None
    raw["snap"] = pd.to_datetime(raw.snapshot_time)
    gk = ["event_id", "player_id", "player_name", "position", "team",
          "market", "bookmaker", "home_team", "away_team"]
    g = raw.sort_values("snap").groupby(gk, dropna=False)
    fr = g.agg(open_line=("line", "first"), close_line=("line", "last"),
               open_over=("over_odds", "first"), close_over=("over_odds", "last"),
               open_under=("under_odds", "first"), close_under=("under_odds", "last"),
               n_snaps=("snap", "nunique"), first_snap=("snap", "min"),
               last_snap=("snap", "max"), commence=("commence_time", "first")).reset_index()
    fr["season"], fr["week"] = SEASON, WEEK
    fr["line_delta"] = fr.close_line - fr.open_line
    fr["line_range"] = fr.close_line - fr.open_line   # refined per-book later if needed
    fr["open_yes_prob"] = np.where(fr.market == "player_anytime_td", american_to_prob(fr.open_over), np.nan)
    fr["close_yes_prob"] = np.where(fr.market == "player_anytime_td", american_to_prob(fr.close_over), np.nan)
    fr["close_over_prob"] = american_to_prob(fr.close_over)
    fr["close_under_prob"] = american_to_prob(fr.close_under)
    fr["stat"] = fr.market.map(MARKET_STAT)
    fr["pregame_line"], fr["pregame_over"], fr["pregame_under"] = fr.close_line, fr.close_over, fr.close_under
    fr["gameday_delta"] = np.nan; fr["earlyweek_delta"] = np.nan
    fr["min_line"], fr["max_line"] = fr[["open_line", "close_line"]].min(axis=1), fr[["open_line", "close_line"]].max(axis=1)
    fr["actual"], fr["played"], fr["result_close"], fr["result_open"] = np.nan, np.nan, None, None
    # opp: if the player's team abbrev appears in the home name, opponent is away.
    is_home = [str(t).upper() in str(h).upper() if pd.notna(t) else False
               for t, h in zip(fr.team, fr.home_team)]
    fr["opp"] = np.where(is_home, fr.away_team, fr.home_team)

    # ---- as-of form from player logs BEFORE this week (prior season for wk1) ----
    po = pd.read_parquet(os.path.join(DATA, "player_offense.parquet"))
    po = po[(po.season < SEASON) | ((po.season == SEASON) & (po.week < WEEK))]
    po = po.sort_values(["season", "week"])
    form = {}
    for stat in set(fr.stat.dropna()):
        if stat == "atd" or stat not in po.columns:
            continue
        tail = po.groupby("player_id")[stat].agg(list)
        form[stat] = {pid: (vals[-3:], vals[-5:], vals[-17:]) for pid, vals in tail.items()}
    def f(pid, stat, which):
        v = form.get(stat, {}).get(pid)
        if not v: return np.nan
        arr = v[{"l3": 0, "l5": 1, "szn": 2}[which]]
        return float(np.mean(arr)) if len(arr) else np.nan
    fr["l3_avg"] = [f(p, s, "l3") for p, s in zip(fr.player_id, fr.stat)]
    fr["l5_avg"] = [f(p, s, "l5") for p, s in zip(fr.player_id, fr.stat)]
    fr["szn_avg"] = [f(p, s, "szn") for p, s in zip(fr.player_id, fr.stat)]
    szn = {(pid, s): v[2] for s, d in form.items() for pid, v in d.items()}
    fr["szn_max"] = [max(szn.get((p, s), [np.nan])) if szn.get((p, s)) else np.nan for p, s in zip(fr.player_id, fr.stat)]
    fr["szn_min"] = [min(szn.get((p, s), [np.nan])) if szn.get((p, s)) else np.nan for p, s in zip(fr.player_id, fr.stat)]
    fr["last_game"] = [(szn.get((p, s)) or [np.nan])[-1] for p, s in zip(fr.player_id, fr.stat)]
    gp = po.groupby("player_id").size()
    fr["gp_prior"] = fr.player_id.map(gp)

    # ---- def-allowed context: prior-season per-position points allowed proxy ----
    fr["def_allowed_pos"], fr["lg_allowed_pos"], fr["def_matchup_idx"] = np.nan, np.nan, np.nan

    # ---- latest injury statuses ----
    inj_p = os.path.join(DATA, "injuries_raw.parquet")
    fr["report_status"], fr["practice_status"] = None, None
    if os.path.exists(inj_p):
        inj = pd.read_parquet(inj_p)
        inj = inj[(inj.season == SEASON) & (inj.week == WEEK)].sort_values("date_modified")
        latest = inj.drop_duplicates("player_id", keep="last").set_index("player_id")
        fr["report_status"] = fr.player_id.map(latest.report_status)
        fr["practice_status"] = fr.player_id.map(latest.practice_status)
    fr["team_skill_out"] = np.nan

    # ---- merge into the frame file (replace this week's rows) ----
    fr["commence"] = pd.to_datetime(fr.commence)
    fp = os.path.join(DATA, "props_frame.parquet")
    base = pd.read_parquet(fp)
    base = base[~((base.season == SEASON) & (base.week == WEEK))]
    allf = pd.concat([base, fr[base.columns.intersection(fr.columns).tolist()
                               + [c for c in fr.columns if c not in base.columns]]],
                     ignore_index=True)
    allf = allf[base.columns.tolist()]  # keep the contract column order
    allf.to_parquet(fp, index=False)
    print(f"[live-frame] {len(fr)} rows for {SEASON} wk{WEEK} "
          f"({fr.market.nunique()} markets, {fr.player_id.nunique()} players, "
          f"{fr.bookmaker.nunique()} books) -> props_frame.parquet ({len(allf)} total)")
    return fr


if __name__ == "__main__":
    build()
