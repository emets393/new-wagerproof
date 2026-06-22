"""Generate cfb_team_trends — per-team season-to-date betting trends, AS OF before 2025 Week 7 (uses only
weeks 1-6, point-in-time/no look-ahead). Rates: SU record, ATS%, Over%, Team-Total Over%, 1H ATS%, 1H Over%
+ last-5 arrays + full game_log (jsonb) for last-5 chips and the over/under graph."""
import numpy as np, pandas as pd, warnings, json
import dry_common as C
warnings.filterwarnings("ignore")
SEASON, _wk = C.season_week()
THRU = _wk - 1  # team trends run "through" the week before the slate

gm = pd.read_parquet("data/model_games.parquet")
pre = gm[(gm.season == SEASON) & (gm.week <= THRU) & gm.actual_margin.notna()].copy()
g25 = pd.read_parquet("data/cfbd/games_2025.parquet")
h1h = {r.id: (sum(r.homeLineScores[:2]) if r.homeLineScores is not None and len(r.homeLineScores) >= 2 else None) for _, r in g25.iterrows()}
h1a = {r.id: (sum(r.awayLineScores[:2]) if r.awayLineScores is not None and len(r.awayLineScores) >= 2 else None) for _, r in g25.iterrows()}
dt = dict(zip(g25.id, g25.startDate))

# posted consensus lines (event odds, wk1-6)
ev = pd.read_parquet("data/event_odds/events_2025.parquet"); ev = ev[ev.game_id.isin(set(pre.game_id))].copy()
names = sorted(set(gm.homeTeam) | set(gm.awayTeam))
AL = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i", "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State", "Southern Miss Golden Eagles": "Southern Miss"}
def tdb(o):
    if o in AL: return AL[o]
    c = [x for x in names if str(o).startswith(str(x) + " ") or o == x]; c.sort(key=len, reverse=True); return c[0] if c else None
ttx = ev[(ev.market == "team_totals") & (ev.name == "Over")].copy(); ttx["team"] = ttx.description.map(tdb)
tt_cons = ttx.dropna(subset=["team", "point"]).groupby(["game_id", "team"]).point.median().to_dict()
h1s = ev[(ev.market == "spreads_h1")].copy(); h1s["nm"] = h1s.name.map(tdb); h1s = h1s[h1s.nm == h1s.home]
h1s_cons = h1s.groupby("game_id").point.median().to_dict()
h1t_cons = ev[(ev.market == "totals_h1") & (ev.name == "Over")].groupby("game_id").point.median().to_dict()

# build per-team game logs
logs = {}
for _, r in pre.sort_values("week").iterrows():
    gid = r.game_id
    for is_home in (True, False):
        team = r.homeTeam if is_home else r.awayTeam
        opp = r.awayTeam if is_home else r.homeTeam
        pf = r.homePoints if is_home else r.awayPoints
        pa = r.awayPoints if is_home else r.homePoints
        if pd.isna(pf) or pd.isna(pa): continue
        marg = pf - pa
        tsp = r.spread_close if is_home else -r.spread_close       # team's spread
        cov = marg + tsp
        ats = "P" if cov == 0 else ("W" if cov > 0 else "L")
        ou = "P" if r.actual_total == r.total_close else ("O" if r.actual_total > r.total_close else "U")
        # team total
        ttl = tt_cons.get((gid, team)); tt = None
        if ttl is not None: tt = "O" if pf > ttl else ("U" if pf < ttl else "P")
        # 1H
        h1f = (h1h if is_home else h1a).get(gid); h1ag = (h1a if is_home else h1h).get(gid)
        h1sp = h1s_cons.get(gid); h1tot = h1t_cons.get(gid)
        h1_ats = h1_ou = None; h1_team_sp = None; h1_cover_margin = None; h1_ou_margin = None
        if h1f is not None and h1ag is not None:
            if h1sp is not None:
                h1_team_sp = h1sp if is_home else -h1sp
                hcov = (h1f - h1ag) + h1_team_sp
                h1_ats = "P" if hcov == 0 else ("W" if hcov > 0 else "L"); h1_cover_margin = round(float(hcov), 1)
            if h1tot is not None:
                h1pts = h1f + h1ag
                h1_ou = "P" if h1pts == h1tot else ("O" if h1pts > h1tot else "U"); h1_ou_margin = round(float(h1pts - h1tot), 1)
        logs.setdefault(team, []).append({
            "week": int(r.week), "date": dt.get(gid), "opp": opp, "is_home": bool(is_home),
            "pts_for": int(pf), "pts_against": int(pa), "su": "W" if marg > 0 else "L",
            "spread": round(float(tsp), 1), "ats": ats, "cover_margin": round(float(cov), 1),
            "total": round(float(r.total_close), 1), "ou": ou, "total_points": int(r.actual_total), "ou_margin": round(float(r.actual_total - r.total_close), 1),
            "tt_line": round(float(ttl), 1) if ttl is not None else None, "tt": tt, "team_pts": int(pf),
            "tt_margin": round(float(pf - ttl), 1) if ttl is not None else None,
            "h1_spread": round(float(h1_team_sp), 1) if h1_team_sp is not None else None, "h1_ats": h1_ats,
            "h1_cover_margin": h1_cover_margin,
            "h1_total": round(float(h1tot), 1) if h1tot is not None else None, "h1_ou": h1_ou, "h1_ou_margin": h1_ou_margin})

def pct(w, n): return round(100 * w / n, 1) if n else None
def last5(lst, key): return [g[key] for g in lst[::-1] if g[key] is not None][:5]
rows = []
for team, log in logs.items():
    n = len(log)
    suw = sum(g["su"] == "W" for g in log); sul = n - suw
    aw = sum(g["ats"] == "W" for g in log); al = sum(g["ats"] == "L" for g in log); ap = sum(g["ats"] == "P" for g in log)
    oo = sum(g["ou"] == "O" for g in log); ouu = sum(g["ou"] == "U" for g in log); op = sum(g["ou"] == "P" for g in log)
    tto = sum(g["tt"] == "O" for g in log); ttu = sum(g["tt"] == "U" for g in log); ttn = sum(g["tt"] in ("O", "U") for g in log)
    haw = sum(g["h1_ats"] == "W" for g in log); hal = sum(g["h1_ats"] == "L" for g in log); hap = sum(g["h1_ats"] == "P" for g in log); han = sum(g["h1_ats"] in ("W", "L", "P") for g in log)
    hoo = sum(g["h1_ou"] == "O" for g in log); hou = sum(g["h1_ou"] == "U" for g in log); hon = sum(g["h1_ou"] in ("O", "U") for g in log)
    rows.append({"team_name": team, "season": SEASON, "through_week": THRU, "games": n,
        "su_w": suw, "su_l": sul, "su_record": f"{suw}-{sul}",
        "ats_w": aw, "ats_l": al, "ats_p": ap, "ats_pct": pct(aw, aw + al),
        "ou_o": oo, "ou_u": ouu, "ou_p": op, "over_pct": pct(oo, oo + ouu),
        "tt_o": tto, "tt_u": ttu, "tt_games": ttn, "tt_over_pct": pct(tto, ttn),
        "h1_ats_w": haw, "h1_ats_l": hal, "h1_ats_p": hap, "h1_ats_games": han, "h1_ats_pct": pct(haw, haw + hal),
        "h1_ou_o": hoo, "h1_ou_u": hou, "h1_ou_games": hon, "h1_over_pct": pct(hoo, hon),
        "last5_su": last5(log, "su"), "last5_ats": last5(log, "ats"), "last5_ou": last5(log, "ou"),
        "game_log": log[::-1]})   # newest first; real list -> stored as jsonb array (loader handles JSON)
df = pd.DataFrame(rows)
print(f"cfb_team_trends: {len(df)} teams | avg games {df.games.mean():.1f} | with TT {(df.tt_games>0).sum()} | with 1H {(df.h1_ats_games>0).sum()}")
C.wipe("cfb_team_trends", f"season=eq.{SEASON}")
C.insert("cfb_team_trends", df)
