"""Build a per-team markets table for 2023-2025 (the seasons with derivative-market odds) so the archetype
study can test EVERY market: team totals, 1H spread, 1H total, 1H moneyline — graded at the closest-to-kick
(h2) consensus. FG spread/total already live in cfb_team_games_profiled.parquet (2016-2025).
Consensus = median point across books (prices medianed in DECIMAL per the bball gotcha). 1H results from
CFBD quarter line scores (Q1+Q2)."""
import numpy as np, pandas as pd, glob, warnings
warnings.filterwarnings("ignore")

# ── team-name bridge: event full name ("Navy Midshipmen") -> model_games short ("Navy") ──
mg = pd.read_parquet("data/model_games.parquet")
short = sorted(set(mg.homeTeam) | set(mg.awayTeam))
ALIAS = {"Appalachian State Mountaineers": "App State", "Hawaii Rainbow Warriors": "Hawai'i",
         "UMass Minutemen": "Massachusetts", "San Jose State Spartans": "San José State",
         "Southern Miss Golden Eagles": "Southern Miss"}
def to_short(full):
    if full in ALIAS: return ALIAS[full]
    c = [x for x in short if str(full).startswith(str(x) + " ") or full == x]
    c.sort(key=len, reverse=True)
    return c[0] if c else None

def am_to_dec(a):
    a = float(a)
    return 1 + (a / 100 if a > 0 else 100 / -a)

# ── 1H actual points from CFBD quarter line scores ──
ls_rows = []
for f in glob.glob("data/cfbd/games_20*.parquet"):
    g = pd.read_parquet(f)
    idc = "id" if "id" in g.columns else "gameId"
    for _, r in g.iterrows():
        h, a = r.get("homeLineScores"), r.get("awayLineScores")
        if h is None or a is None or not hasattr(h, "__len__") or len(h) < 2 or len(a) < 2: continue
        ls_rows.append({"game_id": int(r[idc]), "home_h1": int(h[0] + h[1]), "away_h1": int(a[0] + a[1])})
ls = pd.DataFrame(ls_rows).drop_duplicates("game_id")

# ── consensus derivative lines at h2 ──
ev = pd.concat([pd.read_parquet(f) for f in glob.glob("data/event_odds/events_20*.parquet")], ignore_index=True)
ev = ev[ev.snap_tag == "h2"].copy()
ev["short"] = ev.description.where(ev.description.notna(), ev.name).map(to_short)

# team totals (full game): per team line = median Over point
tt = ev[(ev.market == "team_totals") & (ev.name == "Over")].dropna(subset=["short", "point"])
tt_line = tt.groupby(["game_id", "short"]).point.median().rename("tt_line")

# 1H spread: per team point = median
h1s = ev[(ev.market == "spreads_h1")].copy(); h1s["short"] = h1s.name.map(to_short)
h1s = h1s.dropna(subset=["short", "point"])
h1_spread = h1s.groupby(["game_id", "short"]).point.median().rename("h1_spread")

# 1H total: game-level Over point
h1t = ev[(ev.market == "totals_h1") & (ev.name == "Over")].dropna(subset=["point"])
h1_total = h1t.groupby("game_id").point.median().rename("h1_total")

# 1H ML: per team decimal price (median in decimal)
h1m = ev[(ev.market == "h2h_h1")].copy(); h1m["short"] = h1m.name.map(to_short)
h1m = h1m.dropna(subset=["short", "price"]); h1m["dec"] = h1m.price.map(am_to_dec)
h1_ml = h1m.groupby(["game_id", "short"]).dec.median().rename("h1_ml_dec")

# ── assemble per-team rows (join to the profiled team-games) ──
tg = pd.read_parquet("data/cfb_team_games_profiled.parquet")
tg = tg[tg.season >= 2023].copy()
# points for team-total grading
pts = pd.concat([
    mg[["game_id", "homeTeam", "homePoints", "awayPoints"]].rename(columns={"homeTeam": "team", "homePoints": "team_pts", "awayPoints": "opp_pts"}),
    mg[["game_id", "awayTeam", "awayPoints", "homePoints"]].rename(columns={"awayTeam": "team", "awayPoints": "team_pts", "homePoints": "opp_pts"}),
], ignore_index=True)
tg = tg.merge(pts, on=["game_id", "team"], how="left")
tg = tg.merge(ls, on="game_id", how="left")
tg = tg.merge(tt_line.reset_index().rename(columns={"short": "team"}), on=["game_id", "team"], how="left")
tg = tg.merge(h1_spread.reset_index().rename(columns={"short": "team"}), on=["game_id", "team"], how="left")
tg = tg.merge(h1_total.reset_index(), on="game_id", how="left")
tg = tg.merge(h1_ml.reset_index().rename(columns={"short": "team"}), on=["game_id", "team"], how="left")

# team 1H points (perspective)
tg["team_h1"] = np.where(tg.is_home == 1, tg.home_h1, tg.away_h1)
tg["opp_h1"] = np.where(tg.is_home == 1, tg.away_h1, tg.home_h1)

# ── grade every derivative market (team perspective) ──
tg["tt_over"] = np.where(tg.team_pts == tg.tt_line, np.nan, (tg.team_pts > tg.tt_line).astype(float))
h1_margin = tg.team_h1 - tg.opp_h1
tg["h1_ats_margin"] = h1_margin + tg.h1_spread
tg["h1_covered"] = np.where(tg.h1_ats_margin == 0, np.nan, (tg.h1_ats_margin > 0).astype(float))
h1_tot_pts = tg.home_h1 + tg.away_h1
tg["h1_over"] = np.where(h1_tot_pts == tg.h1_total, np.nan, (h1_tot_pts > tg.h1_total).astype(float))
tg["h1_won"] = np.where(h1_margin == 0, np.nan, (h1_margin > 0).astype(float))          # 1H ML (push=tie excluded)

cov = {"tt_line": tg.tt_line.notna().mean(), "h1_spread": tg.h1_spread.notna().mean(),
       "h1_total": tg.h1_total.notna().mean(), "h1_ml_dec": tg.h1_ml_dec.notna().mean(),
       "team_h1": tg.team_h1.notna().mean()}
print("coverage (share of 2023-25 team-games with the line):", {k: round(v, 2) for k, v in cov.items()})
tg.to_parquet("data/cfb_markets_2325.parquet", index=False)
print(f"wrote data/cfb_markets_2325.parquet rows={len(tg)}")
