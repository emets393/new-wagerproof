#!/usr/bin/env python3
"""Score the week's prop board with the validated prop models — every posted player-market gets a
projection, an edge vs the consensus line, and whether it clears that market's frozen threshold.
Generalized from score_slate_props.py (one-off 2026 wk2): board from nfl_player_props, spread/total
from nfl_slate_games, state carried forward from the Fantasy Points tables (prior season + this
season to date, K=4, never joined on the unplayed week), training = prop_engine's panel (2018-25).
Writes data/_prop_preds_<S>w<W>.parquet and upserts nfl_prop_model_preds (read by
nfl_prop_narratives.py as the 'model' tell; available to the props cards later).
Usage: score_props_week.py [season week]   (env NFL_SEASON/NFL_WEEK also honored)"""
import os, sys, numpy as np, pandas as pd, requests, warnings
warnings.filterwarnings("ignore"); pd.options.mode.chained_assignment = None
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE); sys.path.insert(0, os.path.dirname(HERE)); sys.path.insert(0, HERE)
import football_report_lib as lib
import prop_engine as E
from fp_hist import read_fp
num = lambda s: pd.to_numeric(s, errors="coerce"); K = 4.0
env = lib.load_env(); H = lib.hdr(env)
def fetch(table, params):
    j = requests.get(f"{lib.SUPA}/{table}?{params}", headers=H, timeout=90).json(); return j if isinstance(j, list) else []
if len(sys.argv) >= 3: SEASON, WEEK = int(sys.argv[1]), int(sys.argv[2])
elif os.environ.get("NFL_SEASON"): SEASON, WEEK = int(os.environ["NFL_SEASON"]), int(os.environ["NFL_WEEK"])
else:
    a = fetch("nfl_slate_games", "select=season,week&order=season.desc,week.desc&limit=1"); SEASON, WEEK = a[0]["season"], a[0]["week"]
N2A = {"Arizona Cardinals":"ARI","Atlanta Falcons":"ATL","Baltimore Ravens":"BAL","Buffalo Bills":"BUF","Carolina Panthers":"CAR","Chicago Bears":"CHI","Cincinnati Bengals":"CIN","Cleveland Browns":"CLE","Dallas Cowboys":"DAL","Denver Broncos":"DEN","Detroit Lions":"DET","Green Bay Packers":"GB","Houston Texans":"HOU","Indianapolis Colts":"IND","Jacksonville Jaguars":"JAX","Kansas City Chiefs":"KC","Las Vegas Raiders":"LV","Los Angeles Chargers":"LAC","Los Angeles Rams":"LA","Miami Dolphins":"MIA","Minnesota Vikings":"MIN","New England Patriots":"NE","New Orleans Saints":"NO","New York Giants":"NYG","New York Jets":"NYJ","Philadelphia Eagles":"PHI","Pittsburgh Steelers":"PIT","San Francisco 49ers":"SF","Seattle Seahawks":"SEA","Tampa Bay Buccaneers":"TB","Tennessee Titans":"TEN","Washington Commanders":"WAS"}
def carry(df, key, cols):
    d = df.copy(); prior = d[d.__season == SEASON - 1].groupby(key)[cols].mean(); cur = d[(d.__season == SEASON) & (d.__week < WEEK)].groupby(key)[cols].agg(["sum", "count"])
    idx = prior.index.union(cur.index if len(cur) else prior.index); out = {}
    for c in cols:
        p = prior[c].reindex(idx); s = cur[(c, "sum")].reindex(idx).fillna(0) if len(cur) else pd.Series(0.0, index=idx); n = cur[(c, "count")].reindex(idx).fillna(0) if len(cur) else pd.Series(0.0, index=idx)
        v = (p.fillna(0) * K + s) / (K + n); v[p.isna() & (n == 0)] = np.nan; out[c] = v
    return pd.DataFrame(out, index=idx).rename_axis(key).reset_index()
# ---------------------------------------------------------------- board (latest line per book -> consensus)
raw = pd.DataFrame(fetch("nfl_player_props", f"select=player_id,player_name,position,team,market,bookmaker,line,over_odds,under_odds,home_team,away_team,snapshot_time&season=eq.{SEASON}&week=eq.{WEEK}&limit=50000"))
if not len(raw): sys.exit("no props on the board")
raw["snapshot_time"] = pd.to_datetime(raw.snapshot_time, utc=True); raw = raw[raw.line.notna()]
L = raw.sort_values("snapshot_time").groupby(["player_id", "market", "bookmaker"], as_index=False).last()
b = L.groupby(["player_id", "player_name", "position", "team", "market", "home_team", "away_team"], as_index=False).agg(close_line=("line", "median"), over_odds=("over_odds", "median"), books=("bookmaker", "nunique"))
b = b[(b.books >= 2) & b.close_line.notna() & (b.close_line > 0)]
b["home"] = b.home_team.map(N2A); b["away"] = b.away_team.map(N2A); b["team"] = b.team.map(lambda a: E.AB_NV.get(a, a)).replace({"LAR": "LA"})
b["opp"] = np.where(b.team == b.home, b.away, b.home); b["is_home"] = (b.team == b.home).astype(int); b["season"], b["week"] = SEASON, WEEK
g = pd.DataFrame(fetch("nfl_slate_games", f"select=home_ab,away_ab,fg_spread_close,fg_total_close&season=eq.{SEASON}&week=eq.{WEEK}"))
if len(g):
    g["home"] = g.home_ab.replace({"LAR": "LA"}); g["away"] = g.away_ab.replace({"LAR": "LA"}); b = b.merge(g[["home", "away", "fg_spread_close", "fg_total_close"]], on=["home", "away"], how="left")
    b["total"] = num(b.fg_total_close); b["team_spread"] = np.where(b.is_home == 1, num(b.fg_spread_close), -num(b.fg_spread_close))
else: b["total"] = np.nan; b["team_spread"] = np.nan
cw = read_fp("player_crosswalk")[["player_id", "playerPlayerId"]].drop_duplicates("player_id"); b = b.merge(cw, on="player_id", how="left")
print(f"{SEASON} wk{WEEK} board: {len(b)} priced player-markets | crosswalk {b.playerPlayerId.notna().mean():.0%} | lines {b.total.notna().mean():.0%}")
# ---------------------------------------------------------------- player state carried forward
ra = read_fp("player_receiving-advanced"); sep = read_fp("player_receiving-separation-by-alignment"); ru = read_fp("player_rushing-advanced"); bc = read_fp("player_rushing-bell-cow"); qb = read_fp("player_passing-advanced"); qb = qb[num(qb.playerStatsPassingDropbacksTotal) >= 10]
for src, M in ((ra, E.RC), (sep, E.SE), (ru, E.RU), (bc, E.BC), (qb, E.QC)):
    for k, c in M.items():
        if c in src.columns: src[k] = num(src[c])
for src, cols in ((ra, list(E.RC)), (sep, list(E.SE)), (ru, list(E.RU)), (bc, list(E.BC)), (qb, list(E.QC))):
    cols = [c for c in cols if c in src.columns]; b = b.merge(carry(src, "playerPlayerId", cols), on="playerPlayerId", how="left")
def tkey(df):
    if "teamAbbreviation" in df.columns and df.teamAbbreviation.notna().any(): return df.teamAbbreviation.map(lambda a: E.AB_NV.get(a, a))
    return df.teamNickname.map(E.NICK).map(lambda a: E.AB_NV.get(a, a))
def tblock(name, mapping, on, pref):
    global b
    t = read_fp(name); t["__k"] = tkey(t); cols = []
    for k, c in mapping.items():
        if c in t.columns: t[k] = num(t[c]); cols.append(k)
    st = carry(t, "__k", cols).rename(columns={c: pref + c for c in cols}); b = b.merge(st, left_on=on, right_on="__k", how="left").drop(columns="__k")
tblock("team_defense_rushing-advanced", E.DR, "opp", "O_"); tblock("team_defense_coverage-matrix", E.CV, "opp", "O_"); tblock("team_defense_passing-advanced", E.DP, "opp", "O_"); tblock("team_defense_receiving-advanced", E.DRC, "opp", "O_")
tblock("lineMatchups__team", E.LM, "opp", "OL_"); tblock("lineMatchups__team", E.LM, "team", "T_")
pr_t = read_fp("proeReport__team"); pr_t["__k"] = tkey(pr_t); pr_t["gs_db"] = num(pr_t.teamStatsPassingDropbacksTotal); pr_t["gs_db_exp"] = num(pr_t.teamStatsPassingDropbacksExpected); pr_t["gs_proe"] = pr_t.gs_db - pr_t.gs_db_exp; pr_t["gs_snaps"] = num(pr_t.teamStatsSnapsOffenseTotal); GSC = ["gs_db", "gs_db_exp", "gs_proe", "gs_snaps"]
for on, pref in (("team", "T_"), ("opp", "O_")): b = b.merge(carry(pr_t, "__k", GSC).rename(columns={c: pref + c for c in GSC}), left_on=on, right_on="__k", how="left").drop(columns="__k")
rpr = read_fp("team_run-pass-report") if os.path.exists("data/fpdata/team_run-pass-report.parquet") or os.path.exists("data/fpdata_hist/team_run-pass-report.parquet") else read_fp("runPassReport__team")
rpr["__k"] = tkey(rpr); rpr["rp_pass"] = num(rpr.teamStatsSnapsOffensePass); rpr["rp_rush"] = num(rpr.teamStatsSnapsOffenseRush); rpr["rp_tot"] = num(rpr.teamStatsSnapsOffenseTotal); rpr["rp_passrate"] = rpr.rp_pass / rpr.rp_tot.replace(0, np.nan); RPC = ["rp_pass", "rp_rush", "rp_tot", "rp_passrate"]
for on, pref in (("team", "T_"), ("opp", "O_")): b = b.merge(carry(rpr, "__k", RPC).rename(columns={c: pref + c for c in RPC}), left_on=on, right_on="__k", how="left").drop(columns="__k")
# season-to-date actuals for szn / l3 / l5 (this season's played weeks; prior-season tail when fewer than 3)
def per_game(df, cols):
    x = df[(df.__season < SEASON) | (df.__week < WEEK)].copy()
    for k, c in cols.items(): x[k] = num(x[c])
    return x.sort_values(["__season", "__week"])
G_ra = per_game(ra, {"player_receptions": "playerStatsReceivingReceptionsTotal", "player_reception_yds": "playerStatsReceivingYardsTotal"})
G_ru = per_game(ru, {"player_rush_yds": "playerStatsRushingYardsTotal", "player_rush_attempts": "playerStatsRushingAttemptsTotal"})
G_qb = per_game(qb, {"player_pass_yds": "playerStatsPassingYardsTotal", "player_pass_tds": "playerStatsPassingTouchdownsTotal", "player_pass_completions": "playerStatsPassingCompletionsTotal", "player_pass_attempts": "playerStatsPassingAttemptsTotal"})
def hist(pid, mkt):
    src = G_ra if mkt in ("player_receptions", "player_reception_yds") else (G_ru if mkt.startswith("player_rush") else G_qb)
    if mkt not in src.columns: return (np.nan, np.nan, np.nan)
    x = src[src.playerPlayerId == pid][mkt].dropna(); this = src[(src.playerPlayerId == pid) & (src.__season == SEASON)][mkt].dropna()
    if not len(x): return (np.nan, np.nan, np.nan)
    return (float(this.mean()) if len(this) else float(x.tail(5).mean()), float(x.tail(3).mean()), float(x.tail(5).mean()))
b[["szn", "l3", "l5"]] = pd.DataFrame([hist(p, m) for p, m in zip(b.playerPlayerId, b.market)], index=b.index); b["actual"] = np.nan
B = b
for name, expr in (("ix_sep_man", lambda: B.sp_score * B.O_dcv_man), ("ix_slot_zone", lambda: B.rc_slot * B.O_dcv_zone), ("ix_deep_2h", lambda: B.rc_adot * B.O_dcv_twohigh), ("ix_wide_man", lambda: B.rc_wide * B.O_dcv_man), ("ix_bfield_2h", lambda: B.rc_bfield * B.O_dcv_twohigh), ("ix_tprr_soft", lambda: B.rc_tprr * B.O_drc_tgt),
                   ("ix_press_rush", lambda: B.qb_poe * B.OL_dl_poe), ("ix_hold_rush", lambda: B.qb_ttt * B.OL_dl_poe), ("ix_scram_2h", lambda: B.qb_scramble * B.O_dcv_twohigh), ("ix_chk_2h", lambda: B.qb_checkdown * B.O_dcv_twohigh), ("ix_qb_vol", lambda: B.qb_db * B.T_gs_proe), ("ix_rush_front", lambda: B.ru_ypa - B.O_dru_ypa),
                   ("ix_ybc_gap", lambda: B.ru_ybc - B.O_dru_ybc), ("ix_yac_soft", lambda: B.ru_yac * B.O_dru_mtf), ("ix_stuff", lambda: B.ru_stuff * B.O_dru_stuff), ("ix_zone_fit", lambda: B.ru_zoneypa * B.O_dru_zoneypa), ("ix_workload", lambda: B.ms_rush * B.tm_rush_att), ("ix_script_rush", lambda: B.ms_rush * (-B.team_spread)), ("ix_script_pass", lambda: B.T_gs_proe * B.total)):
    try: B[name] = expr()
    except Exception: B[name] = np.nan
b = B
def ridge(X, y, lam):
    Xb = np.hstack([X, np.ones((len(X), 1))]); A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam; return np.linalg.lstsq(A, Xb.T @ y, rcond=None)[0]
# frozen configs (exp_prop_holdout / all-configs verdicts): market, positions, lambda, threshold, feature set, validated tier label
SPEC = [("player_pass_yds", ["QB"], 60, 20, None, "robust"), ("player_pass_completions", ["QB"], 60, 1.75, None, "2025-strong"), ("player_pass_tds", ["QB"], 200, 0.35, None, "61.0%"),
        ("player_receptions", ["WR", "TE"], 200, 0.7, E.NARROW_RECV, "2025-only"), ("player_reception_yds", ["WR", "TE"], 200, 12, E.NARROW_RECV, "robust-small"), ("player_receptions", ["RB"], 600, 0.7, E.NARROW_RECV, "56.8%"),
        ("player_rush_attempts", ["RB"], 200, 1.8, E.NARROW_RUSH, "56.7%")]
out = []
for mkt, pos, lam, thr, fs, tier in SPEC:
    if mkt not in E.SETS and fs is None: continue
    feats = fs if fs is not None else E.SETS[mkt]
    tr = E.panel[(E.panel.market == mkt) & E.panel.position.isin(pos)].copy(); tr = tr[(tr.week >= 4) & tr.close_line.notna() & (tr.close_line > 0) & tr.actual.notna()]
    te = b[(b.market == mkt) & b.position.isin(pos) & b.playerPlayerId.notna()].copy()
    if not len(te) or len(tr) < 300: continue
    F = [c for c in dict.fromkeys(feats) if c in tr.columns and c in te.columns and tr[c].notna().mean() > 0.35]; med = tr[F].median(); tr[F] = tr[F].fillna(med).fillna(0); te[F] = te[F].fillna(med).fillna(0)
    Fk = [c for c in F if tr[c].std() > 1e-9]; X = tr[Fk].values.astype(float); mu, sd = X.mean(0), X.std(0); sd[sd == 0] = 1
    w = ridge((X - mu) / sd, tr.actual.values.astype(float), lam); te["pred"] = np.hstack([(te[Fk].values.astype(float) - mu) / sd, np.ones((len(te), 1))]) @ w
    te["edge"] = te.pred - te.close_line; te["threshold"] = thr; te["fires"] = te.edge.abs() >= thr; te["tier"] = tier; out.append(te[["player_id", "player_name", "position", "team", "opp", "market", "close_line", "pred", "edge", "threshold", "fires", "tier"]])
    print(f"  {mkt:26s} {'+'.join(pos):5s} train n={len(tr):6d} feats={len(Fk):3d} | scored {len(te):3d}, fires {int(te.fires.sum())}")
if not out: sys.exit("nothing scored")
P = pd.concat(out, ignore_index=True); P["season"], P["week"] = SEASON, WEEK; P.to_parquet(f"data/_prop_preds_{SEASON}w{WEEK}.parquet", index=False)
requests.delete(f"{lib.SUPA}/nfl_prop_model_preds?season=eq.{SEASON}&week=eq.{WEEK}", headers=H, timeout=30); ok = 0
rows = [dict(id=f"{SEASON}|{WEEK}|{r.player_id}|{r.market}", season=SEASON, week=WEEK, player_id=str(r.player_id), player_name=r.player_name, team=r.team, opp=r.opp, position=r.position, market=r.market, line=float(r.close_line), pred=round(float(r.pred), 2), edge=round(float(r.edge), 2), threshold=float(r.threshold), fires=bool(r.fires), tier=r.tier) for r in P.itertuples()]
for i in range(0, len(rows), 200):
    x = requests.post(f"{lib.SUPA}/nfl_prop_model_preds", headers={**H, "Prefer": "resolution=merge-duplicates"}, json=rows[i:i + 200], timeout=60); ok += (x.status_code in (200, 201)) * len(rows[i:i + 200])
print(f"wrote {ok}/{len(rows)} projections -> nfl_prop_model_preds ({int(P.fires.sum())} clear their threshold)")
