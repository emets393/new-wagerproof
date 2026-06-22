"""Shared helpers for the CFB Week-7 dry-run generators: Supabase PostgREST loader (delete-then-insert,
idempotent on filters) + team-name -> logo/conference maps. Never prints the service key."""
import os, json, requests, warnings
import pandas as pd
warnings.filterwarnings("ignore")

PROJ = "jpxnjuwglavsjbgbasnl"
URL = f"https://{PROJ}.supabase.co"
def _key():
    for ln in open(os.path.join(os.path.dirname(__file__), "..", "..", ".env.local")):
        if ln.startswith("SUPABASE_SERVICE_KEY="):
            return ln.strip().split("=", 1)[1]
    raise RuntimeError("no service key")
KEY = _key()
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}


def season_week(default_season=2025, default_week=7):
    """Target (season, week) for a generator run. Override via env CFB_SEASON / CFB_WEEK,
    or argv `gen_x.py <season> <week>`. Defaults preserve the Week-7-2025 dry-run, so an
    unparameterized run stays byte-for-byte the original."""
    import sys
    s = int(os.environ.get("CFB_SEASON", default_season))
    w = int(os.environ.get("CFB_WEEK", default_week))
    if len(sys.argv) >= 3 and sys.argv[1].isdigit() and sys.argv[2].isdigit():
        s, w = int(sys.argv[1]), int(sys.argv[2])
    return s, w


def wipe(table, filt):
    """filt e.g. 'season=eq.2025&week=eq.7' (or 'team_name=not.is.null' to clear all)."""
    r = requests.delete(f"{URL}/rest/v1/{table}?{filt}", headers=H)
    print(f"  delete {table}?{filt} -> {r.status_code}")

def insert(table, df, chunk=500):
    recs = json.loads(df.to_json(orient="records"))   # kills numpy types/NaN->null
    for i in range(0, len(recs), chunk):
        r = requests.post(f"{URL}/rest/v1/{table}", headers=H, data=json.dumps(recs[i:i+chunk]))
        if r.status_code >= 300:
            raise RuntimeError(f"insert {table} {r.status_code}: {r.text[:400]}")
    print(f"  inserted {len(recs)} -> {table}")

def team_maps():
    tm = pd.read_parquet(os.path.join(os.path.dirname(__file__), "data", "cfb_team_mapping.parquet"))
    logo = dict(zip(tm.api, tm.logo_light)); logo_d = dict(zip(tm.api, tm.logo_dark))
    abbr = dict(zip(tm.api, tm.abbreviation)) if 'abbreviation' in tm else dict(zip(tm.api, tm.team_rankings_format))
    return logo, logo_d, abbr

def conf_maps():
    """Most-recent conference + classification for each team from CFBD games."""
    g = pd.read_parquet(os.path.join(os.path.dirname(__file__), "data", "model_games.parquet"))
    g = g.sort_values("season")
    conf = {}
    for _, r in g.iterrows():
        conf[r.homeTeam] = r.homeConference; conf[r.awayTeam] = r.awayConference
    return conf

# signal -> (market, grade_line, conviction, active?) ; conviction stake: mammoth5/T1 3/T2 2/T3 1/track .5
SPOT_META = {
 "STACK": ("spread","close","T1",True), "SB premium": ("spread","soft","T1",True),
 "SB volume": ("spread","soft","T2",True), "PREMIUM lay-fav": ("spread","open","T2",True),
 "SOS fade padded": ("spread","close","T1",True), "G5 fade": ("spread","close","T1",True),
 "RvR": ("spread","close","T2",True), "KEY dog": ("spread","dk","T3",True), "KEY lay": ("spread","dk","T2",True),
 "CONF SunBelt fade": ("spread","close","T2",True), "CONF BigTen": ("spread","close","T2",True),
 "CONF AAC total": ("total","close","T2",True), "CONF SunBelt total": ("total","close","T2",True),
 "FORM over-hot": ("total","close","T2",True), "TOTAL fade high": ("total","close","T3",True),
 "TOTAL fade low": ("total","close","track",False), "TOTAL model over-edge": ("total","open","T3",True),
 "T1 under": ("total","open","T2",True), "T1 over": ("total","open","T2",True),
 "T2 under": ("total","open","T3",True), "T2 over": ("total","open","track",False),
 "T2 high-edge dog": ("spread","open","T2",True), "T3 away": ("spread","open","T3",True),
 "T3 fade home backup": ("spread","open","T3",True),
}
STAKE = {"mammoth": 5.0, "T1": 3.0, "T2": 2.0, "T3": 1.0, "track": 0.5}
def classify(token):
    for k, v in SPOT_META.items():
        if k in token: return v
    return None

def harness_week(season, week):
    """Authoritative source: re-run the locked harness for one week. Returns (gm, te, S).
    te has per-game preds/edges/p_home_conf/mammoth; S = spot_library dict {name:(mask,side,market,grade)}."""
    import cfb_forecast as F
    gm, feats, te, S = F.build_season(season, week)
    return gm, te.reset_index(drop=True), S

def model_side(r): return "AWAY" if r.side_edge < 0 else "HOME"
def spread_line(r, grade, side):
    if grade == "open": return r.spread_open
    if grade == "dk": return r.get("dk_sp_close", r.spread_close)
    if grade == "soft": return r.soft_best_home if side == "HOME" else r.soft_best_away
    return r.spread_close
def total_line(r, grade): return r.total_open if grade == "open" else r.total_close

# source-string -> stable signal_key (ordered: specific first). Joins flags to cfb_signal_defs.
KEY_MAP = [
 ("STACK","stack"), ("SB premium","soft_book_gap"), ("SB volume","soft_book_gap"),
 ("PREMIUM lay-fav","premium_lay_fav"), ("SOS fade padded","padded_road_fade"), ("G5 fade","g5_fade_after_loss"),
 ("RvR","rvr_home"), ("KEY dog","key_dog"), ("KEY lay","key_lay_fav"),
 ("CONF SunBelt fade","conf_sunbelt_fade"), ("CONF BigTen","conf_bigten_road_fav"),
 ("CONF AAC","conf_aac_over"), ("CONF SunBelt total","conf_sunbelt_under"),
 ("FORM over-hot","form_over_hot_under"), ("TOTAL fade high","fade_high_total"), ("TOTAL fade low","fade_low_total"),
 ("TOTAL model over-edge","model_total_over"), ("T1 under","model_total_under"), ("T1 over","model_total_over_pace"),
 ("T2 under: week 1","opener_under"), ("T2 under: ranked upset","ranked_upset_letdown_under"),
 ("T2 under: PT rr","primetime_rivalry_letdown_under"), ("T2 under: backup","backup_qb_under"),
 ("T2 over","rivalry_week_over"), ("T2 high-edge dog","model_highedge_dog"),
 ("T3 fade home backup","fade_home_backup_qb"), ("T3 away","model_road_value"),
 ("TEAM-TOTAL","team_total"), ("1H spread","h1_spread"), ("1H total","h1_total"), ("1H ML","h1_ml"),
]
def key_for(source):
    for sub, k in KEY_MAP:
        if sub in str(source): return k
    return "model_lean"

# ===== UNIFIED team-total model: derived from the full-game model so it's coherent with the headline score =====
P5CONF = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
def fg_team_pts(pred_total, pred_margin, is_home):
    return (pred_total + pred_margin) / 2 if is_home else (pred_total - pred_margin) / 2
def tt_conv_key(edge, pside, p5):
    """Validated gates on the full-game-derived team total (vs posted): UNDER<=-3 ~57%, OVER+4 P5 ~58%,
    OVER+6 P5 ~62%. Returns conviction key or None (no play). OVER is P5-only (G5 overs are dead)."""
    if pside == "UNDER" and edge <= -3: return "T2"
    if pside == "OVER" and p5 and edge >= 6: return "T1"
    if pside == "OVER" and p5 and edge >= 4: return "T2"
    return None

def recommendation(conviction, has_play):
    """Ready-to-display bet-quality label so the app renders a string with no logic."""
    if not has_play: return "No Bet"
    return {"mammoth": "MAMMOTH Play", "high": "High Conviction", "med": "Solid Play",
            "low": "Lean", "lean": "Small Lean"}.get(conviction, "Play")
