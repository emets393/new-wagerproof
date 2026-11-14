#!/usr/bin/env python3
"""Score an UPCOMING slate: carry each team's current composite/fit state forward
onto the unplayed schedule, apply the trained FP-only model. Usage: SEASON WEEK.
Writes data/fpdata/_slate_pred.parquet (per-game spread/total edges)."""
import sys
import numpy as np
import pandas as pd

TS, TW = int(sys.argv[1]), int(sys.argv[2])
AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
NICK = {"Cardinals":"ARZ","Falcons":"ATL","Ravens":"BLT","Bills":"BUF","Panthers":"CAR",
"Bears":"CHI","Bengals":"CIN","Browns":"CLV","Cowboys":"DAL","Broncos":"DEN","Lions":"DET",
"Packers":"GB","Texans":"HST","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA",
"Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE",
"Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA",
"49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}

# 1) build the TRAINING panel exactly as the FP-only variant (played games <=2025)
src = open("predict_upcoming.py").read().split('# TRAIN on 2021-2025')[0]
# stop before the target-week predict block; it builds p, FEATS, rf2, validation
src = src.split('# validation backtest')[0]
exec(src)
for c in [x for x in FEATS if x in p.columns]:
    p[c] = pd.to_numeric(p[c], errors="coerce")
CORE9 = ["off_pass_epa_neutral_s2d","off_rush_epa_neutral_s2d","def_pass_epa_allowed_neutral_s2d",
"def_rush_epa_allowed_neutral_s2d","off_proe_s2d","off_plays_per_game_s2d","off_pts_per_drive_s2d",
"def_pts_per_drive_allowed_s2d"]
USE_EPA = False   # wk1 EPA is unregressed noise (breaks preds); FP-only is the validated early-season model
if USE_EPA:
    for c in CORE9 + ["T_"+c for c in CORE9]:
        if c in p.columns and c not in FEATS:
            FEATS.append(c)
FEATS = [c for c in FEATS if c in p.columns and not p[c].isna().all()]
# team_week EPA for the upcoming slate (own + opp)
_tw = pd.read_parquet("data/team_week.parquet")
_CITY2AB = {v:k for k,v in {"ARI":"Arizona","ATL":"Atlanta","BAL":"Baltimore","BUF":"Buffalo","CAR":"Carolina","CHI":"Chicago","CIN":"Cincinnati","CLE":"Cleveland","DAL":"Dallas","DEN":"Denver","DET":"Detroit","GB":"Green Bay","HOU":"Houston","IND":"Indianapolis","JAX":"Jacksonville","KC":"Kansas City","LA":"LA Rams","LAC":"LA Chargers","LV":"Las Vegas","MIA":"Miami","MIN":"Minnesota","NE":"New England","NO":"New Orleans","NYG":"NY Giants","NYJ":"NY Jets","PHI":"Philadelphia","PIT":"Pittsburgh","SEA":"Seattle","SF":"San Francisco","TB":"Tampa Bay","TEN":"Tennessee","WAS":"Washington"}.items()}
_tw["ab"] = _tw.team.map(_CITY2AB).fillna(_tw.team)
_epa_cur = _tw[(_tw.season==TS)&(_tw.week==TW)].set_index("ab")
tr = p[p.season <= 2025].dropna(subset=["pts", "line", "total"] + FEATS)
X = tr[FEATS].values.astype(float); MU, SD = X.mean(0), X.std(0); SD[SD == 0] = 1

def ridge(Xs, y, lam=50.0):
    Xb = np.hstack([Xs, np.ones((len(Xs), 1))]); A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam
    return np.linalg.solve(A, Xb.T @ y)
W = ridge((X - MU) / SD, tr.pts.values.astype(float))

# 2) each team's CURRENT entering-state = the entering-game composite value the
#    model would use for its NEXT game (latest available, seeded/expanding).
#    v4 already computed compS with entering-game 'c_*' values per played row;
#    take each team's most recent row (<= last played week of TS).
comp = pd.read_parquet("data/fpdata/composites_v2.parquet")   # realized _game
comp["ab_nv"] = comp.ab.map(lambda a: AB_NV.get(a, a))
CN = [c for c in comp.columns if c.startswith("c_") and not c.endswith("_game")]
# reuse the v4 seeded entering-values already in `compS` (built in predict_upcoming src)
state = compS.copy()
state["ab_nv2"] = state.ab_nv if "ab_nv" in state.columns else state.ab.map(lambda a: AB_NV.get(a, a))
# latest state per team up to current season/week
st = state[(state.__season == TS)].sort_values("__week").groupby("ab_nv").tail(1)
if st.empty:  # season just started, use prior-season carry (week 1 of TS)
    st = state[(state.__season == TS)]
cur = st.set_index("ab_nv")[CN]

# 3) fit_scheme_pass current state: latest per team
fs = p[p.season == TS].dropna(subset=["fit_scheme_pass"]).sort_values("week").groupby("team").tail(1)
fit_cur = fs.set_index("team").fit_scheme_pass if len(fs) else pd.Series(dtype=float)

# 4) build the upcoming schedule rows
g = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv", low_memory=False)
sl = g[(g.season == TS) & (g.week == TW)].copy()
import os
_lf = f"data/odds_lines_{TS}w{TW}.parquet"
if os.path.exists(_lf):
    _ol = pd.read_parquet(_lf)
    sl = sl.merge(_ol[["home_team","home_spread_close","total_close"]], on="home_team", how="left")
    sl["spread_line"] = -sl["home_spread_close"]   # nflverse convention: spread_line = home line sign-flipped? keep home-persp below
    # our home_spread_close is HOME perspective (neg=home fav). r.spread_line used as: home line = -spread_line.
    # so spread_line must = -home_spread_close
    sl["spread_line"] = -sl["home_spread_close"]
    sl["total_line"] = sl["total_close"]
    print(f"USING ODDS-API LINES from {_lf}")
ge = pd.read_parquet("data/games_enriched.parquet")
res = g[(g.game_type == "REG") & g.result.notna()].copy(); res["tot"] = res.home_score + res.away_score
lg = res[res.season < TS].tot.mean()
refm = res[res.season < TS].dropna(subset=["referee"]).groupby("referee").tot.agg(["mean", "count"])
refm["oe"] = np.where(refm["count"] >= 20, refm["mean"] - lg, 0.0)
gerow = ge.set_index("game_id")
rows = []
for _, r in sl.iterrows():
    for team, opp, home in ((r.home_team, r.away_team, 1), (r.away_team, r.home_team, 0)):
        if team not in cur.index or opp not in cur.index:
            continue
        d = dict(game_id=r.game_id, team=team, opp=opp, home=home,
                 line=-r.spread_line if home else r.spread_line, total=r.total_line,
                 week=TW)
        d["mkt_pts"] = r.total_line / 2 - d["line"] / 2
        for c in CN:
            d[c] = cur.loc[team, c]; d["O_" + c] = cur.loc[opp, c]
        d["fit_scheme_pass"] = fit_cur.get(team, np.nan)
        # situational
        gid = r.game_id; grow = gerow.loc[gid] if gid in gerow.index else None
        ref = grow.referee if grow is not None else None
        d["ref_pts_oe"] = float(refm.oe.get(ref, 0.0)) if ref is not None else 0.0
        rest = (r.home_rest if home else r.away_rest)
        d["s_rest"] = (r.home_rest - r.away_rest) if home else (r.away_rest - r.home_rest)
        d["s_off_bye"] = int(rest >= 10); d["s_short_week"] = int(rest <= 4)
        d["s_primetime"] = int(str(r.weekday) in ("Thursday", "Monday"))
        for c in CORE9:
            d[c] = _epa_cur.loc[team, c] if team in _epa_cur.index and c in _epa_cur.columns else np.nan
            d["T_"+c] = _epa_cur.loc[opp, c] if opp in _epa_cur.index and c in _epa_cur.columns else np.nan
        rows.append(d)
up = pd.DataFrame(rows)
DIFFS = {"d_trench_pass": ("c_passpro", "O_c_passrush"), "d_trench_run": ("c_runblock", "O_c_runfront"),
         "d_playmaking": ("c_recv_playmaking", "O_c_tackling"), "d_power": ("c_rb_power", "O_c_tackling"),
         "d_precision_cov": ("c_qb_precision", "O_c_cov_disruption"),
         "d_deep_fit": ("c_qb_aggression", "O_c_deep_denial"), "d_rz": ("c_rz_usage", "O_c_rz_defense")}
for d, (a, b) in DIFFS.items():
    up[d] = up[a] - up[b]
for c in FEATS:
    if c not in up.columns:
        up[c] = np.nan
    up[c] = pd.to_numeric(up[c], errors="coerce")
up[FEATS] = up[FEATS].fillna(tr[FEATS].mean())
up["pred"] = np.hstack([(up[FEATS].values.astype(float) - MU) / SD, np.ones((len(up), 1))]) @ W

own = up.set_index(["game_id", "team"]).pred
up["pm"] = up.pred - own.reindex(pd.MultiIndex.from_arrays([up.game_id, up.opp])).values
up["pt"] = up.pred + own.reindex(pd.MultiIndex.from_arrays([up.game_id, up.opp])).values
gg = up.drop_duplicates("game_id").copy()
gm = g.set_index("game_id")
gg["home_ab"] = gm.reindex(gg.game_id).home_team.values; gg["away_ab"] = gm.reindex(gg.game_id).away_team.values
gg["hl"] = np.where(gg.team == gg.home_ab, gg.line, -gg.line)
gg["hpm"] = np.where(gg.team == gg.home_ab, gg.pm, -gg.pm)
gg["sp_edge"] = gg.hpm - (-gg.hl); gg["tot_edge"] = gg.pt - gg.total
DZ = list(DIFFS)
for k in DZ:
    mu, sd = p[k].mean(), p[k].std()
    up[k + "_z"] = (up[k] - mu) / sd
zt = up.drop_duplicates("game_id").set_index("game_id")
gg[[k + "_z" for k in DZ]] = zt.reindex(gg.game_id)[[k + "_z" for k in DZ]].values
gg.to_parquet("data/fpdata/_slate_pred.parquet")
print(f"scored {len(gg)} games for {TS} wk{TW}  ({len(FEATS)} feats)")
print(gg[["away_ab", "home_ab", "hl", "sp_edge", "total", "tot_edge"]].round(1).to_string(index=False))
