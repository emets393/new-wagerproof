#!/usr/bin/env python3
"""EXHAUSTIVE SEARCH — WAVE 2 (owner 2026-09-17 night). Same protocol as fp_exhaust.py (SEARCH 2022-24,
HOLDOUT 2025 touched once, shuffled-target null). New engineered families the wave-1 bank could not
see because those tables carry TOTALS, not rates:
  tendency   pass rate by situation (Overall, Inside20, Inside10, ThirdDown, Neutral, Leading,
             Trailing, FirstHalf, SecondHalf, Under5, 5To9, Over10, FirstDown) from the run-pass buckets
  proe       dropbacks / expected dropbacks − 1, offense and what the defense faces
  fpeff      production efficiency: PPR points per dropback (passing), per carry, per route — offense
             and allowed by the defense; plus the offense-minus-allowed matchup nets
  qb         STARTER-LEVEL passing rates keyed by the quarterback (K=4 seeded from HIS prior season),
             attached to the team by the QB of its most recent game — survives a QB change, which
             team-level rates do not
  ix         explicit offense-strength x defense-weakness products for the matchup pairs (what a
             linear model cannot form on its own)
Also a MARGIN-REGRESSION target variant (HistGBM on actual margin, bet when |pred − market| >= 1.5)."""
import glob, io, contextlib, importlib.util as iu, json, os, sys, time, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
FP = "data/fpdata/"; OUT = "out/"; K = 4.0; REL_MIN = 0.30; SEARCH = (2022, 2023, 2024); HOLD = 2025; SEEDS = 3
num = lambda s: pd.to_numeric(s, errors="coerce"); LOG = open(OUT + "fp_exhaust2.log", "a")
def L(*a):
    s = " ".join(str(x) for x in a); print(s); LOG.write(s + "\n"); LOG.flush()
NICK = {"Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI","Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HOU","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
def tkey(d):
    s = d.teamAbbreviation if "teamAbbreviation" in d.columns and d.teamAbbreviation.notna().any() else d.teamNickname.map(NICK)
    return s.map(lambda a: AB_NV.get(a, a))
def load(t):
    d = pd.read_parquet(FP + t); d = d[d.__season >= 2021].copy(); d["team"] = tkey(d); return d.rename(columns={"__season": "season", "__week": "week"})
def entering(df, key, cols):
    d = df.sort_values([key, "season", "week"]).copy(); pri = d.groupby([key, "season"])[cols].mean(); g = d.groupby([key, "season"]); out = {}
    for c in cols:
        p = pd.Series([pri[c].get((t, s - 1), np.nan) for t, s in zip(d[key], d.season)], index=d.index)
        cs = g[c].transform(lambda x: x.shift(1).expanding().sum()).fillna(0); cn = g[c].transform(lambda x: x.shift(1).expanding().count()).fillna(0)
        v = (p.fillna(0) * K + cs) / (K + cn); v[p.isna() & (cn == 0)] = np.nan; out[c] = v
        out[c + "__f3"] = g[c].transform(lambda x: x.shift(1).rolling(3, min_periods=2).mean()) - v
    return pd.concat([d[[key, "season", "week"]], pd.DataFrame(out, index=d.index)], axis=1)
def gate(df, key, cols):
    f = df.copy(); f["par"] = f.week % 2; keep = []
    for c in cols:
        a = f[f.par == 1].groupby([key, "season"])[c].mean(); b = f[f.par == 0].groupby([key, "season"])[c].mean(); j = pd.concat([a, b], axis=1).dropna()
        if len(j) >= 40 and j.iloc[:, 0].corr(j.iloc[:, 1]) >= REL_MIN: keep.append(c)
    return keep

# ---------------- wave-2 bank
FAM = {}; BANK = None
def add(fam, frame, cols, key="team"):
    global BANK
    keep = gate(frame, key, cols); L(f"[bank2] {fam:10s} {len(cols):3d} cols -> {len(keep):3d} reliable")
    if not keep: return
    e = entering(frame[[key, "season", "week"] + keep].groupby([key, "season", "week"], as_index=False).mean(), key, keep)
    ren = {c: f"{fam}__{c}" for c in keep}; ren.update({c + "__f3": f"{fam}__{c}__f3" for c in keep}); e = e.rename(columns=ren)
    FAM[fam] = [ren[c] for c in keep]
    if key != "team": return e
    BANK = e if BANK is None else BANK.merge(e, on=["team", "season", "week"], how="outer")
# tendency
rp = load("flat/team_run-pass-report.parquet"); tc = []
for b in ("Overall", "Inside20", "Inside10", "ThirdDown", "Neutral", "Leading", "Trailing", "FirstHalf", "SecondHalf", "Under5", "5To9", "Over10", "FirstDown"):
    if f"{b}__teamStatsSnapsOffensePass" in rp.columns:
        rp[f"pr_{b}"] = num(rp[f"{b}__teamStatsSnapsOffensePass"]) / num(rp[f"{b}__teamStatsSnapsOffenseTotal"]).replace(0, np.nan); tc.append(f"pr_{b}")
add("tendency", rp, tc)
# proe
po = load("proeReport__team.parquet"); po["proe"] = num(po.teamStatsPassingDropbacksTotal) / num(po.teamStatsPassingDropbacksExpected).replace(0, np.nan) - 1
pd_ = load("proeReport__opponent.parquet"); pd_["proe_faced"] = num(pd_.opponentStatsPassingDropbacksTotal) / num(pd_.opponentStatsPassingDropbacksExpected).replace(0, np.nan) - 1
add("proe", po.merge(pd_[["team", "season", "week", "proe_faced"]], on=["team", "season", "week"], how="outer"), ["proe", "proe_faced"])
# fpeff
fo = load("fantasyPointsScored__team.parquet"); fd = load("fantasyPointsScored__opponent.parquet")
fo["pass_eff"] = num(fo.teamStatsFantasyPointsPprPassing) / num(fo.teamStatsPassingDropbacksTotal).replace(0, np.nan); fo["rush_eff"] = num(fo.teamStatsFantasyPointsPprRushing) / num(fo.teamStatsRushingAttemptsTotal).replace(0, np.nan); fo["recv_eff"] = num(fo.teamStatsFantasyPointsPprReceiving) / num(fo.teamStatsReceivingRoutesTotal).replace(0, np.nan)
fd["pass_eff_allowed"] = num(fd.opponentStatsFantasyPointsPprPassing) / num(fd.opponentStatsPassingDropbacksTotal).replace(0, np.nan); fd["rush_eff_allowed"] = num(fd.opponentStatsFantasyPointsPprRushing) / num(fd.opponentStatsRushingAttemptsTotal).replace(0, np.nan); fd["recv_eff_allowed"] = num(fd.opponentStatsFantasyPointsPprReceiving) / num(fd.opponentStatsReceivingRoutesTotal).replace(0, np.nan)
add("fpeff", fo.merge(fd[["team", "season", "week", "pass_eff_allowed", "rush_eff_allowed", "recv_eff_allowed"]], on=["team", "season", "week"], how="outer"), ["pass_eff", "rush_eff", "recv_eff", "pass_eff_allowed", "rush_eff_allowed", "recv_eff_allowed"])
# qb (starter-level, keyed by player, attached by most recent game's QB)
q = load("passingAdvanced__player.parquet"); q["db"] = num(q.playerStatsPassingDropbacksTotal); q = q[q.db >= 10]
q = q.sort_values("db", ascending=False).drop_duplicates(["team", "season", "week"])          # the team's QB that game
QC = [c for c in q.columns if c.startswith("playerStats") and any(p in c for p in ("Percentage", "PerAttempt", "OverExpected", "Rating", "AverageDepth", "AverageTime")) and not c.endswith("Label")]
for c in QC: q[c] = num(q[c])
q["scr_rate"] = num(q.playerStatsPassingScramblesTotal) / q.db; q["sack_rate"] = num(q.playerStatsPassingSackedTotal) / q.db
QC = [c for c in QC + ["scr_rate", "sack_rate"] if q[c].notna().mean() > 0.6 and q[c].std() > 1e-9]
q["qb"] = q.playerPlayerId.astype(str)
qe = add("qb", q, QC, key="qb")
if qe is not None:
    qe = qe.merge(q[["qb", "season", "week", "team"]], on=["qb", "season", "week"])      # the QB's entering values on the games he played
    # attach to team-week w the values of the QB who played the team's most recent game (< w)
    grid = q[["team", "season"]].drop_duplicates().merge(pd.DataFrame({"week": range(1, 19)}), how="cross")
    last = q[["team", "season", "week", "qb"]].rename(columns={"week": "gw"})
    grid = grid.merge(last, on=["team", "season"]); grid = grid[grid.gw < grid.week].sort_values("gw").groupby(["team", "season", "week"]).tail(1)
    # the QB's entering value AS OF that week = his value on his next row >= week (entering is a pre-game value); use his latest row <= week
    qv = qe.drop(columns="team"); qcols = [c for c in qv.columns if c.startswith("qb__")]
    att = grid.merge(qv, on=["qb", "season"], suffixes=("", "_q")); att = att[att.week_q <= att.week].sort_values("week_q").groupby(["team", "season", "week"]).tail(1)
    BANK = BANK.merge(att[["team", "season", "week"] + qcols], on=["team", "season", "week"], how="outer")
json.dump(FAM, open(FP + "_exhaust2_meta.json", "w")); BANK.to_parquet(FP + "_exhaust2_bank.parquet", index=False)
L(f"[bank2] {BANK.shape} team-weeks x cols; families: " + ", ".join(f"{k}={len(v)}" for k, v in FAM.items()))

# ---------------- game frame (same as wave 1)
sys.argv = [sys.argv[0]]
spec = iu.spec_from_file_location("fh", "forecast_harness.py"); FH = iu.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(FH); m, BASE = FH.build()
ours = set(m.home_ab.unique()); AB = {k: v for k, v in {"LA": "LAR", "JAX": "JAC", "WAS": "WSH", "LV": "LVR", "ARI": "ARZ", "BAL": "BLT", "CLE": "CLV", "HOU": "HST"}.items() if v in ours and k not in ours}
B = BANK.copy(); B["team"] = B.team.replace(AB); bcols = [c for c in B.columns if c not in ("team", "season", "week")]
m = m.merge(B.rename(columns={"team": "home_ab", **{c: "H." + c for c in bcols}}), on=["home_ab", "season", "week"], how="left")
m = m.merge(B.rename(columns={"team": "away_ab", **{c: "A." + c for c in bcols}}), on=["away_ab", "season", "week"], how="left")
od = pd.read_parquet("data/odds_consensus.parquet")[["season", "home_ab", "away_ab", "open_spread"]]
h = pd.read_parquet("data/odds_hist.parquet", columns=["season", "snap_ts", "home_team", "away_team", "book", "spread_home"]); h = h[h.season.isin([2021, 2022])]
C2A = {"Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR","Chicago":"CHI","Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN","Detroit":"DET","Green Bay":"GB","Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX","Kansas City":"KC","LA Rams":"LA","LA Chargers":"LAC","Las Vegas":"LV","Miami":"MIA","Minnesota":"MIN","New England":"NE","New Orleans":"NO","NY Giants":"NYG","NY Jets":"NYJ","Philadelphia":"PHI","Pittsburgh":"PIT","Seattle":"SEA","San Francisco":"SF","Tampa Bay":"TB","Tennessee":"TEN","Washington":"WAS"}
h["home_ab"] = h.home_team.map(C2A).replace(AB); h["away_ab"] = h.away_team.map(C2A).replace(AB)
h = h.dropna(subset=["home_ab", "away_ab", "spread_home"]).sort_values("snap_ts").drop_duplicates(["season", "home_ab", "away_ab", "book"], keep="first")
O21 = h.groupby(["season", "home_ab", "away_ab"]).spread_home.median().rename("open_spread").reset_index(); O21["open_spread"] = np.round(O21.open_spread * 2) / 2
m = m.merge(pd.concat([O21, od]), on=["season", "home_ab", "away_ab"], how="left")
FAMS = {}
for fam, cols in FAM.items():
    FAMS[f"{fam}:level"] = [f"H.{c}" for c in cols] + [f"A.{c}" for c in cols]
    for c in cols: m[f"N.{c}"] = m[f"H.{c}"] - m[f"A.{c}"]; m[f"F.{c}"] = m[f"H.{c}__f3"] - m[f"A.{c}__f3"]
    FAMS[f"{fam}:net"] = [f"N.{c}" for c in cols]; FAMS[f"{fam}:form"] = [f"F.{c}" for c in cols]
# fpeff matchup + explicit products (ix)
mxc = []; ixc = []
for o in ("pass", "rush", "recv"):
    co, cd = f"fpeff__{o}_eff", f"fpeff__{o}_eff_allowed"
    if f"H.{co}" in m.columns and f"H.{cd}" in m.columns:
        m[f"M.{o}"] = (m[f"H.{co}"] - m[f"A.{cd}"]) - (m[f"A.{co}"] - m[f"H.{cd}"]); mxc.append(f"M.{o}")
        m[f"X.{o}"] = m[f"H.{co}"] * m[f"A.{cd}"] - m[f"A.{co}"] * m[f"H.{cd}"]; ixc.append(f"X.{o}")
if mxc: FAMS["fpeff:matchup"] = mxc
if ixc: FAMS["fpeff:ix"] = ixc
L(f"[frame] {len(FAMS)} families: " + ", ".join(f"{k}={len(v)}" for k, v in FAMS.items()))

def mk(model, seed):
    if model == "hgb": return HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300, l2_regularization=2.0, min_samples_leaf=40, random_state=seed)
    if model == "hgb_shallow": return HistGradientBoostingClassifier(max_depth=2, learning_rate=0.03, max_iter=400, l2_regularization=5.0, min_samples_leaf=60, random_state=seed)
    if model == "logit": return make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), LogisticRegression(C=0.05, max_iter=2000))
    if model == "rf": return make_pipeline(SimpleImputer(strategy="median"), RandomForestClassifier(n_estimators=300, min_samples_leaf=40, max_features=0.3, random_state=seed, n_jobs=-1))
def run(feats, model, tests, shuffle_seed=None):
    rows = []
    for ssn in tests:
        tr = m[(m.season < ssn) & (m.week >= 4)].dropna(subset=["home_cover"]); te = m[m.season == ssn].dropna(subset=["home_cover"]).copy()
        yy = tr.home_cover.values.astype(int)
        if shuffle_seed is not None: yy = np.random.default_rng(shuffle_seed + ssn).permutation(yy)
        ps = []
        for sd in range(SEEDS if model != "logit" else 1):
            if model == "blend": ps.append((mk("hgb", sd).fit(tr[feats], yy).predict_proba(te[feats])[:, 1] + mk("logit", sd).fit(tr[feats], yy).predict_proba(te[feats])[:, 1]) / 2)
            else: ps.append(mk(model, sd).fit(tr[feats], yy).predict_proba(te[feats])[:, 1])
        te["ph"] = np.mean(ps, axis=0); rows.append(te)
    return pd.concat(rows)
def run_margin(feats, tests):
    rows = []
    for ssn in tests:
        tr = m[(m.season < ssn) & (m.week >= 4)].dropna(subset=["actual_margin"]); te = m[m.season == ssn].dropna(subset=["actual_margin"]).copy()
        ps = [HistGradientBoostingRegressor(max_depth=3, learning_rate=0.05, max_iter=300, l2_regularization=2.0, min_samples_leaf=40, random_state=sd).fit(tr[feats], tr.actual_margin).predict(te[feats]) for sd in range(SEEDS)]
        te["pm"] = np.mean(ps, axis=0); rows.append(te)
    return pd.concat(rows)
def score(R):
    p = R.ph.clip(1e-4, 1 - 1e-4); ll = -np.mean(np.where(R.home_cover == 1, np.log(p), np.log(1 - p)))
    d = R.dropna(subset=["open_spread"]); d = d[((d.ph - .5).abs() >= .03) & ((d.actual_margin + d.open_spread) != 0)]
    won = np.where(d.ph > .5, d.actual_margin + d.open_spread > 0, d.actual_margin + d.open_spread < 0); return ll, won.mean(), len(d)
def score_margin(R, thr=1.5):
    d = R.dropna(subset=["open_spread"]); d["e"] = d.pm - (-d.open_spread); d = d[(d.e.abs() >= thr) & ((d.actual_margin + d.open_spread) != 0)]
    won = np.where(d.e > 0, d.actual_margin + d.open_spread > 0, d.actual_margin + d.open_spread < 0); return won.mean(), len(d)

t0 = time.time(); MODELS = ("hgb", "hgb_shallow", "logit", "rf", "blend"); base_sc = {}
L("\n" + "=" * 100); L("WAVE 2 STAGE 0 — baseline on SEARCH window"); L("=" * 100)
for mdl in MODELS:
    base_sc[mdl] = score(run(BASE, mdl, SEARCH)); L(f"  {mdl:12s} logloss {base_sc[mdl][0]:.4f}  hit@.03 {100*base_sc[mdl][1]:.1f}% n={base_sc[mdl][2]}")
bm = score_margin(run_margin(BASE, SEARCH)); L(f"  margin-reg   hit@1.5 {100*bm[0]:.1f}% n={bm[1]}")
L("\n" + "=" * 100); L("WAVE 2 STAGE 1 — every new family alone, every model"); L("=" * 100)
res = []
for fam, cols in FAMS.items():
    cols = [c for c in cols if c in m.columns and m[m.season.isin(SEARCH)][c].notna().mean() > 0.5]
    if not cols: continue
    for mdl in MODELS:
        ll, hit, n = score(run(BASE + cols, mdl, SEARCH)); b = base_sc[mdl]
        res.append(dict(family=fam, model=mdl, k=len(cols), logloss=ll, d_ll=b[0] - ll, hit=hit, d_hit=hit - b[1], n=n))
        L(f"  {fam:18s} {mdl:12s} k={len(cols):3d}  logloss {ll:.4f} ({b[0]-ll:+.4f})  hit {100*hit:.1f}% ({100*(hit-b[1]):+.1f})   [{time.time()-t0:.0f}s]")
    mh = score_margin(run_margin(BASE + cols, SEARCH)); L(f"  {fam:18s} {'margin-reg':12s} k={len(cols):3d}  hit@1.5 {100*mh[0]:.1f}% ({100*(mh[0]-bm[0]):+.1f}) n={mh[1]}")
R = pd.DataFrame(res); R.to_parquet(FP + "_exhaust2_stage1.parquet", index=False)
L("\n  TOP 10 by log-loss gain:"); L(R.sort_values("d_ll", ascending=False).head(10).to_string(index=False))
agg = R.groupby("family").agg(n_better=("d_ll", lambda s: (s > 0).sum()), mean_dll=("d_ll", "mean"), mean_dhit=("d_hit", "mean")).sort_values("mean_dll", ascending=False)
L("\n  families improving log-loss on >=4 of 5 models:"); L(agg[agg.n_better >= 4].to_string() if (agg.n_better >= 4).any() else "  none")
best_model = R.groupby("model").d_ll.mean().idxmax()
L("\n" + "=" * 100); L(f"WAVE 2 STAGE 2 — greedy over ALL families (wave 1 + wave 2) on '{best_model}', max 3"); L("=" * 100)
# bring wave-1 families in too so the greedy can mix
try:
    M1 = json.load(open(FP + "_exhaust_meta.json")); B1 = pd.read_parquet(FP + "_exhaust_bank.parquet"); B1["team"] = B1.team.replace(AB); b1c = [c for c in B1.columns if c not in ("team", "season", "week")]
    m = m.merge(B1.rename(columns={"team": "home_ab", **{c: "H1." + c for c in b1c}}), on=["home_ab", "season", "week"], how="left").merge(B1.rename(columns={"team": "away_ab", **{c: "A1." + c for c in b1c}}), on=["away_ab", "season", "week"], how="left")
    for fam, cols in M1["families"].items():
        for c in cols: m[f"N1.{c}"] = m[f"H1.{c}"] - m[f"A1.{c}"]
        FAMS[f"w1:{fam}:net"] = [f"N1.{c}" for c in cols]
except Exception as e: L(f"  (wave-1 bank not merged: {type(e).__name__})")
chosen = []; cur = list(BASE); cur_ll = base_sc[best_model][0]
for step in range(3):
    best = None
    for fam, cols in FAMS.items():
        if fam in chosen: continue
        cols = [c for c in cols if c in m.columns and m[m.season.isin(SEARCH)][c].notna().mean() > 0.5]
        if not cols: continue
        ll, hit, n = score(run(cur + cols, best_model, SEARCH))
        if best is None or ll < best[1]: best = (fam, ll, hit, n, cols)
    if best is None or best[1] >= cur_ll - 0.0005: L(f"  step {step+1}: nothing improves log-loss by >= .0005 — stop"); break
    chosen.append(best[0]); cur += best[4]; cur_ll = best[1]; L(f"  step {step+1}: + {best[0]:24s} logloss {best[1]:.4f} hit@.03 {100*best[2]:.1f}% n={best[3]}")
L("\n" + "=" * 100); L("WAVE 2 STAGE 3 — HOLDOUT 2025 for the selected configuration + shuffled-target null"); L("=" * 100)
for lab, feats in (("baseline", BASE), (f"selected {chosen}", cur)):
    ll, hit, n = score(run(feats, best_model, (HOLD,))); ll4, hit4, n4 = score(run(feats, best_model, SEARCH + (HOLD,)))
    L(f"  {lab:50s} 2025: logloss {ll:.4f} hit {100*hit:.1f}% n={n} | 2022-25: logloss {ll4:.4f} hit {100*hit4:.1f}% n={n4}")
for rep in range(3):
    b0 = score(run(BASE, best_model, SEARCH, shuffle_seed=200 + rep))[0]; cur_n = list(BASE); ll_n = b0; picks = []
    for step in range(3):
        best = None
        for fam, cols in FAMS.items():
            if fam in picks: continue
            cols = [c for c in cols if c in m.columns and m[m.season.isin(SEARCH)][c].notna().mean() > 0.5]
            if not cols: continue
            ll = score(run(cur_n + cols, best_model, SEARCH, shuffle_seed=200 + rep))[0]
            if best is None or ll < best[1]: best = (fam, ll, cols)
        if best is None or best[1] >= ll_n - 0.0005: break
        picks.append(best[0]); cur_n += best[2]; ll_n = best[1]
    L(f"  null rep {rep}: chance gain {b0-ll_n:+.4f} from {picks}")
L(f"  REAL gain: {base_sc[best_model][0]-cur_ll:+.4f} from {chosen}"); L(f"done in {time.time()-t0:.0f}s")
