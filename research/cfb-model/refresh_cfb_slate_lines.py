"""Refresh the CFB slate's DISPLAYED lines from the freshest live captures.

Owner-reported 2026-08-28: lines on the site/app were frozen at Monday's slate
build even though the 15-min collectors were capturing fine — nothing ever
pushed fresh numbers back onto the rows the clients read. This closes the loop:

  cfb_slate_games : fg_spread_close / fg_total_close / fg_ml_*_close (+ edges
                    recomputed against the frozen model numbers), tt_*_close,
                    h1_spread_close / h1_total_close
  cfb_slate_picks : vegas_line per card (consensus the card quotes)

Pick SIDES are never flipped here — the model's picks stay as generated; only
the market numbers and edges move. Sources: cfb_line_movement (already the
consensus-per-snapshot view over both capture tables). Runs after the 15-min
collectors in the cfb-live-odds-hourly cron. Data-only: no client deploy.
"""
import datetime as dt
import re
import sys
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
SUPA = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"


def load_key():
    for fn in (ROOT.parent.parent / ".env.local", ROOT.parent.parent / ".env"):
        if fn.exists():
            for line in fn.read_text().splitlines():
                if line.startswith("SUPABASE_SERVICE_KEY="):
                    return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found")


def main():
    key = load_key()
    hdr = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    anchor = requests.get(f"{SUPA}/cfb_slate_games?select=season,week&order=season.desc,week.desc&limit=1",
                          headers=hdr, timeout=30).json()
    if not anchor:
        sys.exit("no slate")
    season, week = anchor[0]["season"], anchor[0]["week"]
    games = requests.get(
        f"{SUPA}/cfb_slate_games?select=game_id,kickoff,fg_pred_spread,fg_pred_total,home_team,away_team"
        f"&season=eq.{season}&week=eq.{week}",
        headers=hdr, timeout=30).json()
    now = dt.datetime.now(dt.timezone.utc)
    upcoming = [g for g in games if g.get("kickoff") and
                dt.datetime.fromisoformat(g["kickoff"].replace("Z", "+00:00")) > now]
    if not upcoming:
        print("no upcoming games — nothing to refresh")
        return
    gids = ",".join(str(g["game_id"]) for g in upcoming)

    # freshest consensus per game per arm (FG rows vs event rows interleave, so
    # take the latest non-null per column). 26h lookback: future-day games only
    # capture 3x/day, so a short window would find nothing midweek; on game day
    # captures are 15-min and "latest" is minutes old either way.
    # strftime + Z, not isoformat(): the +00:00 plus-sign reads as a space in a
    # URL and PostgREST 400s the filter.
    since = (now - dt.timedelta(hours=26)).strftime("%Y-%m-%dT%H:%M:%SZ")
    mv = requests.get(
        f"{SUPA}/cfb_line_movement?select=game_id,snap_ts,fg_spread_home,fg_total,ml_home,ml_away,"
        f"tt_home,tt_away,h1_spread_home,h1_total"
        f"&game_id=in.({gids})&season=eq.{season}&snap_ts=gte.{since}&order=snap_ts.desc",
        headers=hdr, timeout=60).json()
    if not isinstance(mv, list) or not mv:
        print(f"no captures since {since} — nothing to refresh: {str(mv)[:160]}")
        return
    df = pd.DataFrame(mv)
    fills = df.groupby("game_id").apply(lambda s: s.apply(lambda col: col.dropna().iloc[0] if col.dropna().size else None))

    def val(row, k):
        v = row.get(k)
        return None if v is None or (isinstance(v, float) and v != v) else float(v)

    pred = {g["game_id"]: g for g in upcoming}
    g_up, p_up = [], []
    for gid, row in fills.iterrows():
        gid = int(gid)
        rec = {"game_id": gid}
        if val(row, "fg_spread_home") is not None:
            rec["fg_spread_close"] = val(row, "fg_spread_home")
            ps = pred[gid].get("fg_pred_spread")
            if ps is not None:
                rec["fg_spread_edge"] = round(val(row, "fg_spread_home") - float(ps), 1)
        if val(row, "fg_total") is not None:
            rec["fg_total_close"] = val(row, "fg_total")
            pt = pred[gid].get("fg_pred_total")
            if pt is not None:
                rec["fg_total_edge"] = round(float(pt) - val(row, "fg_total"), 1)
        if val(row, "ml_home") is not None:
            rec["fg_ml_home_close"] = val(row, "ml_home")
        if val(row, "ml_away") is not None:
            rec["fg_ml_away_close"] = val(row, "ml_away")
        for src, dst in [("tt_home", "tt_home_close"), ("tt_away", "tt_away_close"),
                         ("h1_spread_home", "h1_spread_close"), ("h1_total", "h1_total_close")]:
            if val(row, src) is not None:
                rec[dst] = val(row, src)
        if len(rec) > 1:
            g_up.append(rec)

    ok = 0
    for rec in g_up:
        gid = rec.pop("game_id")
        r = requests.patch(f"{SUPA}/cfb_slate_games?game_id=eq.{gid}", headers=hdr, json=rec, timeout=30)
        ok += r.status_code in (200, 204)
    print(f"games: {ok}/{len(g_up)} rows refreshed")

    # picks: the consensus number each card quotes (sides untouched)
    picks = requests.get(
        f"{SUPA}/cfb_slate_picks?select=id,game_id,card_group,pick_side,pick_team,pick_label"
        f"&season=eq.{season}&week=eq.{week}&game_id=in.({gids})",
        headers=hdr, timeout=60).json()
    fmap = {int(g): r for g, r in fills.iterrows()}
    for p in picks:
        row = fmap.get(int(p["game_id"]))
        if row is None:
            continue
        cg, side = p.get("card_group"), (p.get("pick_side") or "")
        v = None
        if cg == "spread" and val(row, "fg_spread_home") is not None:
            v = val(row, "fg_spread_home") * (1 if side == "HOME" else -1)
        elif cg == "total" and val(row, "fg_total") is not None:
            v = val(row, "fg_total")
        elif cg == "team_total":
            g = pred.get(int(p["game_id"])) or {}
            is_home = p.get("pick_team") == g.get("home_team")
            tv = val(row, "tt_home") if is_home else val(row, "tt_away")
            if tv is not None:
                v = tv
        elif cg == "h1_spread" and val(row, "h1_spread_home") is not None:
            v = val(row, "h1_spread_home") * (1 if side == "HOME" else -1)
        elif cg == "h1_total" and val(row, "h1_total") is not None:
            v = val(row, "h1_total")
        if v is not None:
            rec = {"id": p["id"], "vegas_line": round(v, 1)}
            # pick_label bakes the number into text ("North Carolina Over 19.5")
            # — rebuild its numeric tail so the card can't contradict itself.
            lbl = p.get("pick_label") or ""
            m = re.match(r"^(.*?)([+-]?\d+(?:\.\d+)?)$", lbl.strip())
            if m:
                num = round(v, 1)
                tail = (f"{num:+g}" if m.group(2).startswith(("+", "-")) else f"{num:g}")
                rec["pick_label"] = f"{m.group(1)}{tail}"
            p_up.append(rec)
    ok = 0
    for rec in p_up:
        pid = rec.pop("id")
        r = requests.patch(f"{SUPA}/cfb_slate_picks?id=eq.{pid}", headers=hdr, json=rec, timeout=30)
        ok += r.status_code in (200, 204)
    print(f"picks: {ok}/{len(p_up)} vegas_line refreshed")


if __name__ == "__main__":
    main()
