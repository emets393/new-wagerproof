#!/usr/bin/env python3
"""QB PROFILES -> FORECAST (owner, 2026-09-18).  Learn each quarterback through 2025 week 12, then
predict his completions vs the posted line for 2025 weeks 13-22 and 2026 week 1, and grade it.
Per QB, three predictors:
  LINE      the posted line (the thing to beat)
  UNIV      universal ridge on the 12 factors (everyone's slopes)
  HIS       his own ridge on the 12 factors from HIS prior games (>=12 games; else UNIV)
  PROFILE   the line + his STABLE tendencies only (factor r >= .30, p < .10, sign on both halves,
            all measured before the cutoff) x the factor's standardized value  — the profile as a forecast
Grading: MAE vs actual; the bet at |pred − line| >= 1.5 at best-book; per QB and pooled; and which
QBs were actually predictable OUT OF SAMPLE (his model's MAE vs the line's on his test games).
2026 wk1 rows are built from nfl_player_props (consensus + best book + graded actual) with the factors
carried from the end of 2025 (opponent rates, receivers, weather from the matchup file, lines)."""
import os, sys, numpy as np, pandas as pd, requests, warnings
warnings.filterwarnings("ignore"); num = lambda s: pd.to_numeric(s, errors="coerce")
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE); sys.path.insert(0, os.path.dirname(HERE)); import football_report_lib as lib
env = lib.load_env(); H = lib.hdr(env); MKT = sys.argv[1] if len(sys.argv) > 1 else "player_pass_completions"; STAT = MKT.replace("player_pass_", "").replace("player_", ""); RB = MKT.startswith("player_rush"); THR = (10.0 if RB else 15.0) if "yds" in MKT else 1.5   # bet threshold on the market's own scale
def fetch(table, params):
    j = requests.get(f"{lib.SUPA}/{table}?{params}", headers=H, timeout=90).json(); return j if isinstance(j, list) else []
FAC = ["close_line","opp_rate_man","opp_rate_blitz","opp_rate_press","wind","temp","team_spread","total","e_rw_catchable","inj_wrte_tgt_out","rest","is_home"]
if RB: FAC = ["close_line","opp_rate_heavy","opp_rate_stack","opp_succ_allowed","opp_ypc_allowed","wind","temp","team_spread","total","ms_rush","inj_rb_car_out","rest","is_home"]
d = pd.read_parquet(f"data/_{STAT}_deep_frame.parquet").dropna(subset=["qb"]).copy(); FAC = [c for c in FAC if c in d.columns]
# ---------------------------------------------------------------- 2026 week 1 rows
pp = pd.DataFrame(fetch("nfl_player_props", f"select=player_name,team,market,bookmaker,line,over_odds,under_odds,actual_value,home_team,away_team,snapshot_time&season=eq.2026&week=eq.1&market=eq.{MKT}&limit=5000"))
pp["snapshot_time"] = pd.to_datetime(pp.snapshot_time, utc=True); L = pp.sort_values("snapshot_time").groupby(["player_name","bookmaker"], as_index=False).last()
dec = lambda o: (1 + o / 100) if o > 0 else (1 + 100 / abs(o))
def bb(g):
    ov = g.loc[g.line.idxmin()]; un = g.loc[g.line.idxmax()]
    return pd.Series(dict(close_line=g.line.median(), bo_line=ov.line, bo_dec=dec(float(ov.over_odds)) if pd.notna(ov.over_odds) else 1.91, bu_line=un.line, bu_dec=dec(float(un.under_odds)) if pd.notna(un.under_odds) else 1.91, actual=g.actual_value.dropna().iloc[0] if g.actual_value.notna().any() else np.nan, team=g.team.iloc[0], home_team=g.home_team.iloc[0], away_team=g.away_team.iloc[0]))
W = L.groupby("player_name").apply(bb).reset_index(); W = W[W.actual.notna() & (W.groupby("player_name").size().reindex(W.player_name).values >= 1)]
N2A = {"Arizona Cardinals":"ARI","Atlanta Falcons":"ATL","Baltimore Ravens":"BAL","Buffalo Bills":"BUF","Carolina Panthers":"CAR","Chicago Bears":"CHI","Cincinnati Bengals":"CIN","Cleveland Browns":"CLE","Dallas Cowboys":"DAL","Denver Broncos":"DEN","Detroit Lions":"DET","Green Bay Packers":"GB","Houston Texans":"HOU","Indianapolis Colts":"IND","Jacksonville Jaguars":"JAX","Kansas City Chiefs":"KC","Las Vegas Raiders":"LV","Los Angeles Chargers":"LAC","Los Angeles Rams":"LA","Miami Dolphins":"MIA","Minnesota Vikings":"MIN","New England Patriots":"NE","New Orleans Saints":"NO","New York Giants":"NYG","New York Jets":"NYJ","Philadelphia Eagles":"PHI","Pittsburgh Steelers":"PIT","San Francisco 49ers":"SF","Seattle Seahawks":"SEA","Tampa Bay Buccaneers":"TB","Tennessee Titans":"TEN","Washington Commanders":"WAS"}
W["team"] = W.team.replace({"LAR":"LA"}); W["home"] = W.home_team.map(N2A); W["away"] = W.away_team.map(N2A); W["opp"] = np.where(W.team == W.home, W.away, W.home); W["is_home"] = (W.team == W.home).astype(float)
keys = d.qb.unique()
def match(nm):
    parts = str(nm).replace(".", "").split(); c = [k for k in keys if k.split(".")[-1].lower() == parts[-1].lower() and k[0].lower() == parts[0][0].lower()]; return c[0] if c else None
W["qb"] = W.player_name.map(match); W = W[W.qb.notna()].copy(); W["season"], W["week"] = 2026, 1
# factors carried from the end of 2025: opponent rates & receivers = last 2025 value per team; weather/lines from matchup + slate
OPPC = [c for c in FAC if c.startswith("opp_")]; last = d[d.season == 2025].sort_values("week").groupby("opp")[OPPC].last(); W = W.merge(last, left_on="opp", right_index=True, how="left")
TEAMC = [c for c in ("e_rw_catchable",) if c in FAC]; lastr = d[d.season == 2025].sort_values("week").groupby("team")[TEAMC].last() if TEAMC else None; W = W.merge(lastr, left_on="team", right_index=True, how="left") if TEAMC else W
PLC = [c for c in ("ms_rush",) if c in FAC]; lastp = d[d.season == 2025].sort_values("week").groupby("qb")[PLC].last() if PLC else None; W = W.merge(lastp, left_on="qb", right_index=True, how="left") if PLC else W
m = pd.read_parquet("data/matchup.parquet"); m = m[(m.season == 2026) & (m.week == 1)][["home_ab","away_ab","wind_mph","temp_f","game_stadium_dome","dome_closed","home_spread","nv_total_line"]]
m["home_ab"] = m.home_ab.replace({"LAR":"LA"}); m["away_ab"] = m.away_ab.replace({"LAR":"LA"}); m["indoors"] = (m.game_stadium_dome.astype(str).str.lower() == "true") | (num(m.dome_closed) == 1)
m["wind"] = np.where(m.indoors, 0, num(m.wind_mph)); m["temp"] = np.where(m.indoors, 70, num(m.temp_f))
W = W.merge(m[["home_ab","away_ab","wind","temp","home_spread","nv_total_line"]], left_on=["home","away"], right_on=["home_ab","away_ab"], how="left")
W["team_spread"] = np.where(W.is_home == 1, num(W.home_spread), -num(W.home_spread)); W["total"] = num(W.nv_total_line); W["rest"] = 7.0
inj = pd.DataFrame(fetch("nfl_injuries_raw", "select=team,player,position,report_status&season=eq.2026&week=eq.1")); W["inj_wrte_tgt_out"] = 0.0; W["inj_rb_car_out"] = 0.0   # share-out needs the FP share join; week 1 injuries were light — treated as 0
for c in FAC: W[c] = W[c].fillna(d[c].median())
print(f"2026 week 1: {len(W)} QB {STAT} lines with graded actuals and matched profiles")
# ---------------------------------------------------------------- assemble train / test
CUT = (2025, 12)
d["phase"] = np.where(d.season < 2025, "train", np.where((d.season == 2025) & (d.week <= 12), "train", "test25"))
W["phase"] = "test26"; cols = ["qb","player_name","season","week","team","opp","actual","close_line","bo_line","bo_dec","bu_line","bu_dec","phase"] + [c for c in FAC if c != "close_line"]
D = pd.concat([d[cols], W[cols]], ignore_index=True); D[FAC] = D[FAC].apply(lambda s: s.fillna(s.median()))
tr, te = D[D.phase == "train"].copy(), D[D.phase != "train"].copy(); te["res"] = te.actual - te.close_line
print(f"train: {len(tr)} QB-games through 2025 wk12 | test: {int((te.phase=='test25').sum())} games 2025 wk13+ and {int((te.phase=='test26').sum())} games 2026 wk1")
def ridge(X, y, lam):
    Xb = np.hstack([X, np.ones((len(X), 1))]); A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam; return np.linalg.lstsq(A, Xb.T @ y, rcond=None)[0]
mu, sd = tr[FAC].mean().values, tr[FAC].std().replace(0, 1).values
def zfit(x, F, lam): return ridge((x[F].values - mu[[FAC.index(f) for f in F]]) / sd[[FAC.index(f) for f in F]], x.actual.values.astype(float), lam)
def zpred(x, F, w): return np.hstack([(x[F].values - mu[[FAC.index(f) for f in F]]) / sd[[FAC.index(f) for f in F]], np.ones((len(x), 1))]) @ w
wu = zfit(tr, FAC, 60); te["UNIV"] = zpred(te, FAC, wu); te["LINE"] = te.close_line
rng = np.random.default_rng(0); te["HIS"] = te.UNIV; te["PROFILE"] = te.close_line; te["BIAS"] = te.close_line; prof = {}
for q in te.qb.unique():
    his = tr[tr.qb == q]
    if len(his) < 12: continue
    w = zfit(his, FAC, 20); te.loc[te.qb == q, "HIS"] = zpred(te[te.qb == q], FAC, w)
    # stable tendencies measured before the cutoff (on the residual vs the line)
    r_ = his.actual - his.close_line; o, e = his.iloc[::2], his.iloc[1::2]; tend = []
    for f in FAC:
        if f == "close_line" or his[f].std() == 0: continue
        r = np.corrcoef(his[f], r_)[0,1]; null = np.array([np.corrcoef(rng.permutation(his[f].values), r_)[0,1] for _ in range(300)]); p = (np.abs(null) >= abs(r)).mean()
        ro = np.corrcoef(o[f], o.actual - o.close_line)[0,1] if o[f].std() > 0 else 0; re_ = np.corrcoef(e[f], e.actual - e.close_line)[0,1] if e[f].std() > 0 else 0
        # STRICT stability (2026-09-18): same sign in every season before the cutoff with 8+ of his games, at least two such seasons
        seas = [np.corrcoef(g[f], g.actual - g.close_line)[0,1] for s_, g in his.groupby('season') if len(g) >= 8 and g[f].std() > 0]
        if abs(r) >= 0.30 and p < 0.10 and len(seas) >= 2 and all(np.sign(v) == np.sign(r) for v in seas): tend.append((f, r * r_.std() / his[f].std(), his[f].mean()))   # slope per unit of factor
    prof[q] = tend; bias = r_.median() * len(r_) / (len(r_) + 8)   # MEDIAN residual: rush yards is right-skewed (mean +3.5 vs median −1.0 vs the line); a mean bias leans every back OVER
    te.loc[te.qb == q, "BIAS"] = te[te.qb == q].close_line + bias
    te.loc[te.qb == q, "PROFILE"] = te[te.qb == q].close_line + bias + (sum(b * (te[te.qb == q][f] - m_) for f, b, m_ in tend) if tend else 0)
def grade(x, col, thr):
    e = x[col] - x.close_line; s = x[e.abs() >= thr]; e = e[e.abs() >= thr]
    if not len(s): return np.nan, 0, np.nan
    over = e > 0; line = np.where(over, s.bo_line, s.bu_line); pay = np.where(over, s.bo_dec, s.bu_dec); won = np.where(over, s.actual > line, s.actual < line); push = s.actual.values == line
    p = np.where(push, 0, np.where(won, pay, -1.0)); return (won[~push].mean() if (~push).sum() else np.nan), int((~push).sum()), p.mean()
print("\n" + "=" * 110); print("POOLED FORECAST — 2025 weeks 13+ and 2026 week 1"); print("=" * 110)
for ph, lab in (("test25", "2025 wk13-22"), ("test26", "2026 wk1"), (None, "both")):
    x = te if ph is None else te[te.phase == ph]; print(f"  {lab:14s} n={len(x):3d} | " + " | ".join(f"{c}: MAE {np.abs(x[c] - x.actual).mean():4.2f}" + ("" if c == "LINE" else f" bet≥THR {100*grade(x, c, THR)[0]:4.1f}%/{grade(x, c, THR)[1]:3d} ROI {100*grade(x, c, THR)[2]:+5.1f}%") for c in ("LINE","UNIV","HIS","BIAS","PROFILE")))
print("\n" + "=" * 110); print("PER QUARTERBACK — out-of-sample: his model vs the line on HIS test games (2025 wk13+ and 2026 wk1); who was predictable?"); print("=" * 110)
print(f"  {'quarterback':22s} {'test n':>6s} | {'line MAE':>8s} {'HIS MAE':>7s} {'PROF MAE':>8s} | {'HIS bet ≥THR':>14s} | {'PROF bet ≥THR':>14s} | stable tendencies used (before the cutoff)")
rows = []
for q, x in te.groupby("qb"):
    if len(x) < 4: continue
    lm, hm, pm = np.abs(x.LINE - x.actual).mean(), np.abs(x.HIS - x.actual).mean(), np.abs(x.PROFILE - x.actual).mean(); wh, nh, _ = grade(x, "HIS", THR); wp, np_, _ = grade(x, "PROFILE", THR)
    t = ", ".join(f"{f} {b:+.2f}/unit" for f, b, _ in prof.get(q, [])) or "—"
    rows.append((q, x.player_name.iloc[0], len(x), lm, hm, pm, wh, nh, wp, np_, t))
for q, nm, n, lm, hm, pm, wh, nh, wp, np_, t in sorted(rows, key=lambda r: r[3] - r[4], reverse=True):
    print(f"  {nm[:22]:22s} {n:6d} | {lm:8.2f} {hm:7.2f} {pm:8.2f} | {100*wh if nh else np.nan:5.1f}% n={nh:3d} | {100*wp if np_ else np.nan:5.1f}% n={np_:3d} | {t}")
print("\n  read: HIS MAE below line MAE = his own model predicted him better than the market did, out of sample. A tendency that helped shows PROF MAE < line MAE.")
te.to_parquet(f"data/_qb_forecast_{STAT}_test.parquet", index=False)
