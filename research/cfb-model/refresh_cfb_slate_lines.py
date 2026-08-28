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

    # ---- TT / 1H best-book refresh (labels + best_* on picks) ----------------
    # TT has NO runtime book board on web (the FG board reads ncaaf_odds_history
    # only), so a stale pick.best_line shows verbatim. Mirror gen_cfb_picks'
    # best_tt / best_h1_* selection over the freshest event-odds captures.
    ev = requests.get(
        f"{SUPA}/ncaaf_event_odds?select=game_id,market,name,description,book,point,price,home,away,snap_ts"
        f"&game_id=in.({gids})&season=eq.{season}&snap_ts=gte.{since}&order=snap_ts.desc",
        headers=hdr, timeout=90).json()
    b_up = []
    if isinstance(ev, list) and ev:
        e = pd.DataFrame(ev)
        e = e.sort_values("snap_ts", ascending=False).drop_duplicates(["game_id", "market", "name", "description", "book"])
        def _norm(s): return str(s or "").lower().replace("\u2019", "'")
        def best_tt(gid, team, ou):
            s = e[(e.game_id == str(gid)) & (e.market == "team_totals")]
            s = s[s.description.map(lambda d: _norm(d).startswith(_norm(team)))]
            over = s[s.name == "Over"]; under = s[s.name == "Under"]
            pr = {r.book: r.price for r in (under if ou == "UNDER" else over).itertuples()}
            v = [(float(r.point), float(pr.get(r.book, -110)), r.book) for r in over.itertuples() if pd.notna(r.point)]
            if not v: return None
            return max(v, key=lambda x: (x[0], x[1])) if ou == "UNDER" else min(v, key=lambda x: (x[0], -x[1]))
        def best_h1s(gid, side, home):
            s = e[(e.game_id == str(gid)) & (e.market == "spreads_h1")]
            s = s[s.name.map(lambda n: _norm(n).startswith(_norm(home)))]
            v = [((float(r.point) if side == "HOME" else -float(r.point)),
                  float(r.price) if pd.notna(r.price) else -110, r.book) for r in s.itertuples() if pd.notna(r.point)]
            return max(v, key=lambda x: (x[0], x[1])) if v else None
        def best_h1t(gid, side):
            s = e[(e.game_id == str(gid)) & (e.market == "totals_h1") & (e.name == side.capitalize())]
            v = [(float(r.point), float(r.price) if pd.notna(r.price) else -110, r.book) for r in s.itertuples() if pd.notna(r.point)]
            if not v: return None
            return min(v, key=lambda x: (x[0], -x[1])) if side == "OVER" else max(v, key=lambda x: (x[0], x[1]))
        for p in picks:
            gid, cg, side = p["game_id"], p.get("card_group"), (p.get("pick_side") or "")
            g = pred.get(int(gid)) or {}
            bt = None
            if cg == "team_total" and p.get("pick_team") and side:
                bt = best_tt(gid, p["pick_team"], side)
            elif cg == "h1_spread" and side in ("HOME", "AWAY"):
                bt = best_h1s(gid, side, g.get("home_team", ""))
            elif cg == "h1_total" and side in ("OVER", "UNDER"):
                bt = best_h1t(gid, side)
            if bt is None:
                continue
            line, odds, book = bt
            rec = {"best_line": round(line, 1), "best_odds": odds, "best_book": book}
            lbl = p.get("pick_label") or ""
            m = re.match(r"^(.*?)([+-]?\d+(?:\.\d+)?)$", lbl.strip())
            if m:
                tail = (f"{round(line,1):+g}" if m.group(2).startswith(("+", "-")) else f"{round(line,1):g}")
                rec["pick_label"] = f"{m.group(1)}{tail}"
            r = requests.patch(f"{SUPA}/cfb_slate_picks?id=eq.{p['id']}", headers=hdr, json=rec, timeout=30)
            b_up.append(r.status_code in (200, 204))
    print(f"best-book (tt/1h): {sum(b_up)}/{len(b_up)} picks refreshed")
    flip_stale_sides(hdr, season, week, gids)


# ---- SIDE FLIPS (owner catch 2026-08-28: Memphis +4 shown while the model had
# UNLV by 5). A pick is "the MODEL'S side of the CURRENT line" — when the market
# crosses the model's number, side, label, signal stance (aligned<->counter
# swap), conviction (re-derived from flags on the new side), and the games-row
# pick move TOGETHER. best_* is nulled on flip (clients fall back to the live
# runtime board). Mirrors gen_cfb_picks' conventions exactly.
TIER_DISP = {"mammoth": "mammoth", "T1": "high", "T2": "med", "T3": "low", "track": "lean"}
CONV_RANK = {"mammoth": 5, "T1": 4, "T2": 3, "T3": 2, "track": 1}
STAKE_DISP = {"mammoth": 5.0, "high": 3.0, "med": 2.0, "low": 1.0, "lean": 0.5, "none": 0.0}


def flip_stale_sides(hdr, season, week, gids):
    gsel = ("game_id,home_team,away_team,fg_pred_spread,fg_pred_total,fg_spread_close,fg_total_close,"
            "fg_spread_pick,fg_total_pick,tt_home_pred,tt_away_pred,tt_home_close,tt_away_close")
    grows = {int(g["game_id"]): g for g in requests.get(
        f"{SUPA}/cfb_slate_games?select={gsel}&season=eq.{season}&week=eq.{week}&game_id=in.({gids})",
        headers=hdr, timeout=30).json()}
    flags = requests.get(
        f"{SUPA}/cfb_slate_flags?select=game_id,market,side,conviction,mammoth,signal_key"
        f"&season=eq.{season}&week=eq.{week}", headers=hdr, timeout=30).json()
    fdf = pd.DataFrame(flags) if flags else pd.DataFrame(
        columns=["game_id", "market", "side", "conviction", "mammoth", "signal_key"])

    def conv_for(gid, market, side_pred):
        f = fdf[(fdf.game_id == gid) & (fdf.market == market)]
        f = f[f.side.map(side_pred)] if len(f) else f
        if not len(f):
            return "none", False, []
        best = max(f.conviction, key=lambda c: CONV_RANK.get(c, 0))
        return TIER_DISP.get(best, "low"), bool(f.mammoth.any()), sorted(set(f.signal_key))

    def counter_keys(gid, market, side_pred):
        f = fdf[(fdf.game_id == gid) & (fdf.market == market)]
        f = f[f.side.map(side_pred)] if len(f) else f
        return sorted(set(f.signal_key))

    pk2 = requests.get(
        f"{SUPA}/cfb_slate_picks?select=id,game_id,card_group,pick_side,pick_team"
        f"&season=eq.{season}&week=eq.{week}&game_id=in.({gids})", headers=hdr, timeout=60).json()

    def fmt(v):
        return ("+" if v > 0 else "") + f"{v:g}"

    flips, gpatch = 0, {}
    for p in pk2:
        gid = int(p["game_id"])
        g = grows.get(gid)
        if not g:
            continue
        cg, cur = p.get("card_group"), p.get("pick_side")
        rec = None
        if cg == "spread" and g.get("fg_spread_close") is not None and g.get("fg_pred_spread") is not None:
            close, prd = float(g["fg_spread_close"]), float(g["fg_pred_spread"])
            new = "HOME" if (close - prd) >= 0 else "AWAY"   # side_edge = close - pred; ties break HOME (generator rule)
            if cur and new != cur:
                team = g["home_team"] if new == "HOME" else g["away_team"]
                vl = close if new == "HOME" else -close
                ml = prd if new == "HOME" else -prd
                cv, mam, sig = conv_for(gid, "spread", lambda s, n=new: s == n)
                edge = abs(close - prd)
                capped = edge > 14 and cv == "none"   # EARLY degenerate cap
                rec = dict(pick_side=new, pick_team=team, pick_label=f"{team} {fmt(vl)}",
                           vegas_line=round(vl, 1), model_line=round(ml, 1), edge=round(edge, 1),
                           best_line=None, best_odds=None, best_book=None,
                           conviction=(cv if not capped else "none"), is_mammoth=mam,
                           has_play=(cv != "none" and not capped), display_only=capped,
                           signal_keys=sig,
                           counter_signal_keys=counter_keys(gid, "spread",
                               lambda s, o=("AWAY" if new == "HOME" else "HOME"): s == o),
                           stake_units=STAKE_DISP.get(cv if not capped else "none", 0.0))
                gpatch.setdefault(gid, {})["fg_spread_pick"] = new
        elif cg == "total" and g.get("fg_total_close") is not None and g.get("fg_pred_total") is not None:
            close, prd = float(g["fg_total_close"]), float(g["fg_pred_total"])
            new = "OVER" if (prd - close) > 0 else "UNDER"
            if cur and new != cur:
                cv, mam, sig = conv_for(gid, "total", lambda s, n=new: s == n)
                rec = dict(pick_side=new, pick_team=None, pick_label=f"{new.title()} {close:g}",
                           vegas_line=round(close, 1), model_line=round(prd, 1),
                           edge=round(abs(prd - close), 1),
                           best_line=None, best_odds=None, best_book=None,
                           conviction=cv, is_mammoth=mam, has_play=(cv != "none"), display_only=False,
                           signal_keys=sig,
                           counter_signal_keys=counter_keys(gid, "total",
                               lambda s, o=("UNDER" if new == "OVER" else "OVER"): s == o),
                           stake_units=STAKE_DISP.get(cv, 0.0))
                gpatch.setdefault(gid, {})["fg_total_pick"] = new
        elif cg == "team_total" and p.get("pick_team"):
            is_home = p["pick_team"] == g.get("home_team")
            prd = g.get("tt_home_pred") if is_home else g.get("tt_away_pred")
            close = g.get("tt_home_close") if is_home else g.get("tt_away_close")
            if prd is not None and close is not None:
                new = "OVER" if float(prd) >= float(close) else "UNDER"
                if cur and new != cur:
                    team = p["pick_team"]
                    cv, mam, sig = conv_for(gid, "team_total",
                                            lambda s, t=team, n=new: t in str(s) and n in str(s))
                    rec = dict(pick_side=new,
                               pick_label=f"{team} {new.title()} {float(close):g}",
                               vegas_line=round(float(close), 1),
                               edge=round(float(prd) - float(close), 1),
                               best_line=None, best_odds=None, best_book=None,
                               conviction=cv, is_mammoth=False, has_play=(cv != "none"),
                               display_only=False, signal_keys=sig,
                               counter_signal_keys=counter_keys(gid, "team_total",
                                   lambda s, t=team, o=("UNDER" if new == "OVER" else "OVER"):
                                       t in str(s) and o in str(s)),
                               stake_units=STAKE_DISP.get(cv, 0.0))
        if rec is not None:
            r = requests.patch(f"{SUPA}/cfb_slate_picks?id=eq.{p['id']}", headers=hdr, json=rec, timeout=30)
            flips += r.status_code in (200, 204)
    for gid, gp in gpatch.items():
        requests.patch(f"{SUPA}/cfb_slate_games?game_id=eq.{gid}", headers=hdr, json=gp, timeout=30)
    # conviction_summary coherence for re-sided games (slate pills read it)
    order = ["lean", "low", "med", "high", "mammoth"]
    for gid in gpatch:
        pks = requests.get(
            f"{SUPA}/cfb_slate_picks?select=card_group,conviction,is_mammoth"
            f"&game_id=eq.{gid}&season=eq.{season}&week=eq.{week}&has_play=eq.true",
            headers=hdr, timeout=30).json()
        seen = {}
        for x in pks:
            cgn = x["card_group"]
            if cgn not in seen or order.index(x["conviction"]) > order.index(seen[cgn]["conviction"]):
                seen[cgn] = {"card": cgn, "conviction": x["conviction"], "mammoth": bool(x["is_mammoth"])}
        requests.patch(f"{SUPA}/cfb_slate_games?game_id=eq.{gid}", headers=hdr,
                       json={"conviction_summary": list(seen.values())}, timeout=30)
    print(f"side flips: {flips} pick(s), {len(gpatch)} game row(s) re-sided")


if __name__ == "__main__":
    main()
