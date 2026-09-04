"""Refresh the NFL slate's DISPLAYED lines from the freshest live captures.

Port of research/cfb-model/refresh_cfb_slate_lines.py (owner 2026-08-30: NFL
has the same anatomy — slate lines froze at build time while captures ran).
Simpler than CFB: nfl_line_movement carries EVERY series (fg/tt/h1/ml) in one
row per snapshot.

  nfl_slate_games : fg/tt/h1 close columns + fg edges (vs frozen preds) + the
                    fg pick labels ("NE +3.5" style) re-tailed to current lines
  nfl_slate_picks : vegas_line + pick_label numeric tail per card
  SIDE FLIPS      : when the line crosses the model's number the pick follows
                    (side/team/label/lines/edge + signal stance swap + games-row
                    pick). Conviction DEMOTES to none on flip — the NFL ladder
                    depends on classifier outputs that only the full rebuild
                    recomputes, so the tier honestly waits for the next
                    nfl-slate-refresh run rather than being guessed.

Sign conventions (verified against live rows 2026-08-30): fg_spread_edge =
close - pred (negative -> model backs AWAY); fg_total_edge = pred - close
(positive -> OVER). Runs after the 15-min collectors; data-only.
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


def val(row, k):
    v = row.get(k)
    return None if v is None or (isinstance(v, float) and v != v) else float(v)


def fmt(v):
    return ("+" if v > 0 else "") + f"{v:g}"


def main():
    key = load_key()
    hdr = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    anchor = requests.get(f"{SUPA}/nfl_slate_games?select=season,week&order=season.desc,week.desc&limit=1",
                          headers=hdr, timeout=30).json()
    if not anchor:
        sys.exit("no slate")
    season, week = anchor[0]["season"], anchor[0]["week"]
    gsel = ("game_id,kickoff,home_team,away_team,fg_pred_spread,fg_pred_total,"
            "tt_home_pred,tt_away_pred,h1_pred_margin,h1_pred_total")
    games = requests.get(f"{SUPA}/nfl_slate_games?select={gsel}&season=eq.{season}&week=eq.{week}",
                         headers=hdr, timeout=30).json()
    now = dt.datetime.now(dt.timezone.utc)
    upcoming = [g for g in games if g.get("kickoff") and
                dt.datetime.fromisoformat(str(g["kickoff"]).replace("Z", "+00:00")) > now]
    if not upcoming:
        print("no upcoming games — nothing to refresh")
        return
    gids = ",".join(str(g["game_id"]) for g in upcoming)
    since = (now - dt.timedelta(hours=26)).strftime("%Y-%m-%dT%H:%M:%SZ")
    mv = requests.get(
        f"{SUPA}/nfl_line_movement?select=game_id,snap_ts,fg_spread_home,fg_total,ml_home,ml_away,"
        f"tt_home,tt_away,h1_spread_home,h1_total,h1_ml_home,h1_ml_away"
        f"&game_id=in.({gids})&season=eq.{season}&snap_ts=gte.{since}&order=snap_ts.desc",
        headers=hdr, timeout=90).json()
    if not isinstance(mv, list) or not mv:
        print(f"no captures since {since}: {str(mv)[:160]}")
        return
    df = pd.DataFrame(mv)
    fills = df.groupby("game_id").apply(
        lambda s: s.apply(lambda col: col.dropna().iloc[0] if col.dropna().size else None))
    pred = {g["game_id"]: g for g in upcoming}

    def abbr(gid, home):
        parts = str(gid).split("_")
        return parts[3] if home else parts[2]

    # ---- games rows -----------------------------------------------------------
    ok = 0
    for gid, row in fills.iterrows():
        g = pred.get(gid)
        if g is None:
            continue
        rec = {}
        sp = val(row, "fg_spread_home")
        if sp is not None:
            rec["fg_spread_close"] = sp
            ps = g.get("fg_pred_spread")
            if ps is not None:
                rec["fg_spread_edge"] = round(sp - float(ps), 2)
                side_home = (sp - float(ps)) >= 0
                rec["fg_spread_pick"] = f"{abbr(gid, side_home)} {fmt(sp if side_home else -sp)}"
        tot = val(row, "fg_total")
        if tot is not None:
            rec["fg_total_close"] = tot
            pt = g.get("fg_pred_total")
            if pt is not None:
                rec["fg_total_edge"] = round(float(pt) - tot, 2)
                rec["fg_total_pick"] = "OVER" if (float(pt) - tot) > 0 else "UNDER"
        for src, dst in [("ml_home", "fg_ml_home_close"), ("ml_away", "fg_ml_away_close"),
                         ("tt_home", "tt_home_close"), ("tt_away", "tt_away_close"),
                         ("h1_spread_home", "h1_spread_close"), ("h1_total", "h1_total_close"),
                         ("h1_ml_home", "h1_ml_home_close"), ("h1_ml_away", "h1_ml_away_close")]:
            v = val(row, src)
            if v is not None:
                rec[dst] = v
        if rec:
            r = requests.patch(f"{SUPA}/nfl_slate_games?game_id=eq.{gid}", headers=hdr, json=rec, timeout=30)
            ok += r.status_code in (200, 204)
    print(f"games: {ok}/{len(upcoming)} rows refreshed")

    # ---- picks: lines, labels, side flips -------------------------------------
    picks = requests.get(
        f"{SUPA}/nfl_slate_picks?select=id,game_id,card_group,pick_side,pick_team,pick_label,"
        f"signal_keys,signals"
        f"&season=eq.{season}&week=eq.{week}&game_id=in.({gids})", headers=hdr, timeout=60).json()
    if not isinstance(picks, list):
        sys.exit(f"picks fetch failed: {str(picks)[:200]}")
    fmap = {g: r for g, r in fills.iterrows()}
    n_line, n_flip = 0, 0
    for p in picks:
        gid = p["game_id"]
        row, g = fmap.get(gid), pred.get(gid)
        if row is None or g is None:
            continue
        cg, side = p.get("card_group"), (p.get("pick_side") or "")
        team_home = g.get("home_team")
        # desired model side + current pick-perspective line per card
        new_side, cur_line, model_line = None, None, None
        if cg == "spread" and val(row, "fg_spread_home") is not None and g.get("fg_pred_spread") is not None:
            sp, ps = val(row, "fg_spread_home"), float(g["fg_pred_spread"])
            new_side = "HOME" if (sp - ps) >= 0 else "AWAY"
            cur_line = sp if new_side == "HOME" else -sp
            model_line = ps if new_side == "HOME" else -ps
            edge = abs(sp - ps)
        elif cg == "total" and val(row, "fg_total") is not None and g.get("fg_pred_total") is not None:
            t, pt = val(row, "fg_total"), float(g["fg_pred_total"])
            new_side = "OVER" if (pt - t) > 0 else "UNDER"
            cur_line, model_line, edge = t, pt, abs(pt - t)
        elif cg == "team_total" and p.get("pick_team"):
            is_home = p["pick_team"] == team_home
            tv = val(row, "tt_home" if is_home else "tt_away")
            pv = g.get("tt_home_pred" if is_home else "tt_away_pred")
            if tv is not None and pv is not None:
                new_side = "OVER" if float(pv) >= tv else "UNDER"
                cur_line, model_line, edge = tv, float(pv), abs(float(pv) - tv)
        elif cg == "h1_spread" and val(row, "h1_spread_home") is not None and g.get("h1_pred_margin") is not None:
            sp, pm = val(row, "h1_spread_home"), float(g["h1_pred_margin"])  # pred margin: + = home by pm
            new_side = "HOME" if (sp + pm) >= 0 else "AWAY"                 # side_edge = margin + home spread
            cur_line = sp if new_side == "HOME" else -sp
            model_line = -pm if new_side == "HOME" else pm
            edge = abs(sp + pm)
        elif cg == "h1_total" and val(row, "h1_total") is not None and g.get("h1_pred_total") is not None:
            t, pt = val(row, "h1_total"), float(g["h1_pred_total"])
            new_side = "OVER" if (pt - t) > 0 else "UNDER"
            cur_line, model_line, edge = t, pt, abs(pt - t)
        if new_side is None:
            continue
        if side and new_side != side:
            # FLIP: side follows the model; conviction honestly demotes until the
            # next full rebuild re-derives the NFL ladder (classifier-dependent).
            team = (g["home_team"] if new_side == "HOME" else g["away_team"]) if new_side in ("HOME", "AWAY") else p.get("pick_team")
            if cg == "spread":
                label = f"{team} {fmt(cur_line)}"
            elif cg in ("total", "h1_total"):
                label = f"{'1H ' if cg == 'h1_total' else ''}{new_side.title()} {cur_line:g}"
            elif cg == "team_total":
                label = f"{p['pick_team']} {new_side.title()} {cur_line:g}"
            else:
                label = f"{team} 1H {fmt(cur_line)}"
            rec = dict(pick_side=new_side, pick_label=label,
                       vegas_line=round(cur_line, 1), model_line=round(model_line, 2),
                       edge=round(edge, 2), best_line=None, best_odds=None, best_book=None,
                       conviction="none", has_play=False)
            # NFL stance lives in the embedded signals jsonb — invert each
            # signal's stance so aligned<->counter chips follow the flip.
            sigs = p.get("signals")
            if isinstance(sigs, list):
                inv = []
                for s in sigs:
                    if isinstance(s, dict):
                        s = dict(s)
                        st = str(s.get("stance") or "").lower()
                        if st in ("counter", "contradict"):
                            s["stance"] = "support"
                        elif st:
                            s["stance"] = "counter"
                    inv.append(s)
                rec["signals"] = inv
            if cg == "spread" and new_side in ("HOME", "AWAY"):
                rec["pick_team"] = team
            r = requests.patch(f"{SUPA}/nfl_slate_picks?id=eq.{p['id']}", headers=hdr, json=rec, timeout=30)
            n_flip += r.status_code in (200, 204)
        else:
            rec = {"vegas_line": round(cur_line, 1)}
            lbl = p.get("pick_label") or ""
            m = re.match(r"^(.*?)([+-]?\d+(?:\.\d+)?)$", lbl.strip())
            if m:
                tail = (f"{round(cur_line,1):+g}" if m.group(2).startswith(("+", "-")) else f"{round(cur_line,1):g}")
                rec["pick_label"] = f"{m.group(1)}{tail}"
            r = requests.patch(f"{SUPA}/nfl_slate_picks?id=eq.{p['id']}", headers=hdr, json=rec, timeout=30)
            n_line += r.status_code in (200, 204)
    print(f"picks: {n_line} lines refreshed, {n_flip} side flip(s)")

    # ---- line-band signal hygiene (owner 2026-09-04, mirrors the CFB refresher) ----
    # Pure current-number band conditions re-checked every run; a flag whose line
    # left its band is dropped (the 3x-daily rebuild re-fires it if it returns).
    def _band_ok(key, row):
        sp = row.get("fg_spread_home")
        tth = row.get("tt_home")
        if key == "K9_home_tt_high_over":
            return tth is None or float(tth) >= 24
        if key == "K2_bigfav_home_tt_over":
            return sp is None or float(sp) <= -7
        return True
    try:
        BAND_KEYS = "K9_home_tt_high_over,K2_bigfav_home_tt_over"
        fl = requests.get(f"{SUPA}/nfl_slate_flags?select=id,game_id,signal_key,game"
                          f"&season=eq.{season}&week=eq.{week}&signal_key=in.({BAND_KEYS})"
                          f"&game_id=in.({gids})", headers=hdr, timeout=30).json()
        killed = 0
        for f_ in (fl if isinstance(fl, list) else []):
            if f_["game_id"] not in fills.index:
                continue
            row = fills.loc[f_["game_id"]].to_dict()
            row = {k: (None if v is None or (isinstance(v, float) and v != v) else v) for k, v in row.items()}
            if not _band_ok(f_["signal_key"], row):
                r = requests.delete(f"{SUPA}/nfl_slate_flags?id=eq.{f_['id']}", headers=hdr, timeout=30)
                if r.status_code in (200, 204):
                    killed += 1
                    print(f"  [band hygiene] dropped {f_['signal_key']} on {f_['game']} — line left the band")
        if killed:
            print(f"band hygiene: {killed} stale flag(s) removed")
    except Exception as e:
        print(f"band hygiene skipped: {e}")


if __name__ == "__main__":
    main()
