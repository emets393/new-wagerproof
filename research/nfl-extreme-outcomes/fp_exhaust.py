#!/usr/bin/env python3
"""EXHAUSTIVE, PRE-REGISTERED SEARCH: can ANY engineered form of the Fantasy Points data, with ANY
reasonable model, improve the production sides model?  (owner 2026-09-17 night)

Protocol — written before results, not after:
  SEARCH window  = 2022, 2023, 2024 test folds (train < season, week >= 4).  All selection here.
  HOLDOUT        = 2025. Touched ONCE, for the single configuration the search picks.
  NULL           = the identical search run on shuffled home_cover targets (3 replicates), so the
                   best score the search can reach by chance is known. A real find must beat it.
  Metric         = log-loss on all games (primary; a feature improvement shows here first) and
                   hit rate at |p-.5|>=.03 vs the OPENER (secondary, what production bets).
  Base           = production BASE + the 4 true season-to-date nets (what ships now).

Feature bank (every FP team/opponent table, one row per team-game, 2021+):
  every numeric RATE column (percentages, per-attempt, per-route, over-expected, ratings, depths),
  reliability-gated (split-half r >= 0.30 per team-season, odd vs even weeks),
  in 4 FORMS: entering K=4 level (home & away), NET (home - away), MATCHUP (offense stat minus the
  opponent's matching allowed stat, both directions, netted), FORM (last-3 minus entering).
Families = table x form.  Models = production HistGBM, shallow HistGBM, logistic, random forest,
  GBM+logistic blend.  Stage 1: every family alone on every model.  Stage 2: greedy forward
  selection over families (max 3) on the best model.  Stage 3: holdout + null.
Everything cached in data/fpdata/_exhaust_*.parquet; log to out/fp_exhaust.log.
"""
import glob, io, contextlib, importlib.util as iu, itertools, json, os, sys, time, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer

FP = "data/fpdata/"; OUT = "out/"; K = 4.0; REL_MIN = 0.30
SEARCH = (2022, 2023, 2024); HOLD = 2025; SEEDS = 3
num = lambda s: pd.to_numeric(s, errors="coerce")
LOG = open(OUT + "fp_exhaust.log", "a")
def L(*a):
    s = " ".join(str(x) for x in a); print(s); LOG.write(s + "\n"); LOG.flush()
NICK = {"Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI","Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HOU","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}

# ================================================================ 1. FEATURE BANK
TABLES = {  # table -> (family label, side)   side O = the team's offense, D = the team's defense (opponent tables)
    "passingAdvanced__team": ("pass_O", "O"), "passingAdvanced__opponent": ("pass_D", "D"),
    "rushingAdvanced__team": ("rush_O", "O"), "rushingAdvanced__opponent": ("rush_D", "D"),
    "receivingAdvanced__team": ("recv_O", "O"), "receivingAdvanced__opponent": ("recv_D", "D"),
    "coverageMatrix__team": ("covfaced_O", "O"), "coverageMatrix__opponent": ("cov_D", "D"),
    "lineMatchups__team": ("line", "O"), "runPassReport__team": ("tendency_O", "O"), "proeReport__team": ("proe_O", "O"), "proeReport__opponent": ("proe_D", "D"),
    "fantasyPointsScored__team": ("fpts_O", "O"), "fantasyPointsScored__opponent": ("fpts_D", "D"),
}
RATE_PAT = ("Percentage", "PerAttempt", "PerRoute", "PerDropback", "OverExpected", "Rating", "AverageDepth", "AverageTime", "Averages", "PerGame", "PerTarget", "PerReception", "PerCarry", "Rate", "PerDrive", "Share")
def tkey(d):
    if "teamAbbreviation" in d.columns and d.teamAbbreviation.notna().any(): s = d.teamAbbreviation
    else: s = d.teamNickname.map(NICK)
    return s.map(lambda a: AB_NV.get(a, a))

def entering(df, cols):
    d = df.sort_values(["team", "season", "week"]).copy()
    pri = d.groupby(["team", "season"])[cols].mean()
    out = {}
    g = d.groupby(["team", "season"])
    for c in cols:
        p = pd.Series([pri[c].get((t, s - 1), np.nan) for t, s in zip(d.team, d.season)], index=d.index)
        cs = g[c].transform(lambda x: x.shift(1).expanding().sum()).fillna(0); cn = g[c].transform(lambda x: x.shift(1).expanding().count()).fillna(0)
        v = (p.fillna(0) * K + cs) / (K + cn); v[p.isna() & (cn == 0)] = np.nan; out[c] = v
        out[c + "__f3"] = g[c].transform(lambda x: x.shift(1).rolling(3, min_periods=2).mean()) - v      # FORM: last-3 minus entering
    return pd.concat([d[["team", "season", "week"]], pd.DataFrame(out, index=d.index)], axis=1)

def split_half(df, cols):
    f = df[df.season.between(2021, 2025)].copy(); f["par"] = f.week % 2; out = {}
    for c in cols:
        a = f[f.par == 1].groupby(["team", "season"])[c].mean(); b = f[f.par == 0].groupby(["team", "season"])[c].mean()
        j = pd.concat([a.rename("a"), b.rename("b")], axis=1).dropna(); out[c] = j.a.corr(j.b) if len(j) >= 40 else np.nan
    return out

bank_path = FP + "_exhaust_bank.parquet"; meta_path = FP + "_exhaust_meta.json"
if os.path.exists(bank_path) and os.path.exists(meta_path):
    BANK = pd.read_parquet(bank_path); META = json.load(open(meta_path))
else:
    BANK = None; META = {"families": {}, "pairs": []}
    for tab, (fam, side) in TABLES.items():
        d = pd.read_parquet(FP + tab + ".parquet"); d = d[d.__season >= 2021].copy()
        d["team"] = tkey(d); d = d.rename(columns={"__season": "season", "__week": "week"})
        cols = [c for c in d.columns if any(p in c for p in RATE_PAT) and not c.endswith("Total") and not c.endswith("Label") and ("Stats" in c or c.startswith("marketShare"))]
        for c in cols: d[c] = num(d[c])
        cols = [c for c in cols if d[c].notna().mean() > 0.6 and d[c].std() > 1e-9]
        rel = split_half(d, cols); keep = [c for c in cols if pd.notna(rel[c]) and rel[c] >= REL_MIN]
        L(f"[bank] {tab:34s} {len(cols):3d} rate cols -> {len(keep):3d} reliable")
        if not keep: continue
        e = entering(d[["team", "season", "week"] + keep].groupby(["team", "season", "week"], as_index=False).mean(), keep)
        ren = {c: f"{fam}__{c}" for c in keep}; ren.update({c + "__f3": f"{fam}__{c}__f3" for c in keep})
        e = e.rename(columns=ren); META["families"][fam] = [ren[c] for c in keep]
        BANK = e if BANK is None else BANK.merge(e, on=["team", "season", "week"], how="outer")
    # matchup pairs: offense stat X (teamStats...) vs the same stat allowed (opponentStats...)
    for famO, famD in (("pass_O", "pass_D"), ("rush_O", "rush_D"), ("recv_O", "recv_D"), ("proe_O", "proe_D"), ("fpts_O", "fpts_D")):
        for co in META["families"].get(famO, []):
            stem = co.split("__", 1)[1].replace("teamStats", "")
            cd = f"{famD}__opponentStats{stem}"
            if cd in META["families"].get(famD, []): META["pairs"].append([co, cd])
    BANK.to_parquet(bank_path, index=False); json.dump(META, open(meta_path, "w"))
L(f"[bank] {BANK.shape[0]} team-weeks, {sum(len(v) for v in META['families'].values())} reliable base columns, {len(META['pairs'])} matchup pairs")

# ================================================================ 2. GAME FRAME
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

# engineered forms per family
FAMS = {}
for fam, cols in META["families"].items():
    lvl = [f"H.{c}" for c in cols] + [f"A.{c}" for c in cols]
    net = []
    for c in cols: m[f"N.{c}"] = m[f"H.{c}"] - m[f"A.{c}"]; net.append(f"N.{c}")
    frm = []
    for c in cols: m[f"F.{c}"] = m[f"H.{c}__f3"] - m[f"A.{c}__f3"]; frm.append(f"F.{c}")
    FAMS[f"{fam}:level"] = lvl; FAMS[f"{fam}:net"] = net; FAMS[f"{fam}:form"] = frm
mx = []
for co, cd in META["pairs"]:
    n = "M." + co.split("__", 1)[1]
    m[n] = (m[f"H.{co}"] - m[f"A.{cd}"]) - (m[f"A.{co}"] - m[f"H.{cd}"]); mx.append(n)
for fam in ("pass", "rush", "recv", "proe", "fpts"):
    sub = [c for c in mx if c in [("M." + co.split("__", 1)[1]) for co, cd in META["pairs"] if co.startswith(fam + "_O")]]
    if sub: FAMS[f"{fam}:matchup"] = sub
L(f"[frame] {len(FAMS)} families; sizes: " + ", ".join(f"{k}={len(v)}" for k, v in FAMS.items()))
m = m[m.week >= 1].copy()

# ================================================================ 3. MODELS + EVAL
def mk(model, seed):
    if model == "hgb": return HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=300, l2_regularization=2.0, min_samples_leaf=40, random_state=seed)
    if model == "hgb_shallow": return HistGradientBoostingClassifier(max_depth=2, learning_rate=0.03, max_iter=400, l2_regularization=5.0, min_samples_leaf=60, random_state=seed)
    if model == "logit": return make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), LogisticRegression(C=0.05, max_iter=2000))
    if model == "rf": return make_pipeline(SimpleImputer(strategy="median"), RandomForestClassifier(n_estimators=300, min_samples_leaf=40, max_features=0.3, random_state=seed, n_jobs=-1))
    raise ValueError(model)

def run(feats, model, tests, y="home_cover", shuffle_seed=None):
    rows = []
    for ssn in tests:
        tr = m[(m.season < ssn) & (m.week >= 4)].dropna(subset=[y]); te = m[m.season == ssn].dropna(subset=[y]).copy()
        yy = tr[y].values.astype(int)
        if shuffle_seed is not None: yy = np.random.default_rng(shuffle_seed + ssn).permutation(yy)
        ps = []
        for sd in range(SEEDS if model != "logit" else 1):
            if model == "blend":
                a = mk("hgb", sd).fit(tr[feats], yy).predict_proba(te[feats])[:, 1]; b = mk("logit", sd).fit(tr[feats], yy).predict_proba(te[feats])[:, 1]; ps.append((a + b) / 2)
            else: ps.append(mk(model, sd).fit(tr[feats], yy).predict_proba(te[feats])[:, 1])
        te["ph"] = np.mean(ps, axis=0); rows.append(te)
    return pd.concat(rows)

def score(R):
    p = R.ph.clip(1e-4, 1 - 1e-4); ll = -np.mean(np.where(R.home_cover == 1, np.log(p), np.log(1 - p)))
    d = R.dropna(subset=["open_spread"]); d = d[((d.ph - .5).abs() >= .03) & ((d.actual_margin + d.open_spread) != 0)]
    won = np.where(d.ph > .5, d.actual_margin + d.open_spread > 0, d.actual_margin + d.open_spread < 0)
    return ll, won.mean(), len(d)

t0 = time.time(); results = []
MODELS = ("hgb", "hgb_shallow", "logit", "rf", "blend")
L("\n" + "=" * 100); L("STAGE 0 — baseline (production BASE incl. true nets) on every model, SEARCH window 2022-24"); L("=" * 100)
base_sc = {}
for mdl in MODELS:
    ll, hit, n = score(run(BASE, mdl, SEARCH)); base_sc[mdl] = (ll, hit, n); L(f"  {mdl:12s} logloss {ll:.4f}  hit@.03 {100*hit:.1f}% n={n}")
L("\n" + "=" * 100); L(f"STAGE 1 — every family alone on top of BASE, every model ({len(FAMS)} x {len(MODELS)} configs)"); L("=" * 100)
for fam, cols in FAMS.items():
    cols = [c for c in cols if c in m.columns and m[m.season.isin(SEARCH)][c].notna().mean() > 0.5]
    if not cols: continue
    for mdl in MODELS:
        ll, hit, n = score(run(BASE + cols, mdl, SEARCH)); b = base_sc[mdl]
        results.append(dict(stage=1, family=fam, model=mdl, k=len(cols), logloss=ll, d_ll=b[0] - ll, hit=hit, d_hit=hit - b[1], n=n))
        L(f"  {fam:22s} {mdl:12s} k={len(cols):3d}  logloss {ll:.4f} ({b[0]-ll:+.4f})  hit {100*hit:.1f}% ({100*(hit-b[1]):+.1f})   [{time.time()-t0:.0f}s]")
pd.DataFrame(results).to_parquet(FP + "_exhaust_stage1.parquet", index=False)
R1 = pd.DataFrame(results)
L("\n  STAGE 1 TOP 12 by log-loss gain:"); L(R1.sort_values("d_ll", ascending=False).head(12).to_string(index=False))
L("\n  families that improve log-loss on >=4 of 5 models:")
agg = R1.groupby("family").agg(n_better=("d_ll", lambda s: (s > 0).sum()), mean_dll=("d_ll", "mean"), mean_dhit=("d_hit", "mean")).sort_values("mean_dll", ascending=False)
L(agg[agg.n_better >= 4].to_string())

# ================================================================ 4. STAGE 2 greedy on best model
best_model = R1.groupby("model").d_ll.mean().idxmax()
L("\n" + "=" * 100); L(f"STAGE 2 — greedy forward selection over families on model '{best_model}', max 3 families, SEARCH window"); L("=" * 100)
chosen = []; cur = list(BASE); cur_ll = base_sc[best_model][0]
for step in range(3):
    best = None
    for fam, cols in FAMS.items():
        if fam in chosen: continue
        cols = [c for c in cols if c in m.columns and m[m.season.isin(SEARCH)][c].notna().mean() > 0.5]
        if not cols: continue
        ll, hit, n = score(run(cur + cols, best_model, SEARCH))
        if best is None or ll < best[1]: best = (fam, ll, hit, n, cols)
    if best is None or best[1] >= cur_ll - 0.0005: L(f"  step {step+1}: no family improves log-loss by >= .0005 — stop"); break
    chosen.append(best[0]); cur = cur + best[4]; cur_ll = best[1]
    L(f"  step {step+1}: + {best[0]:22s} logloss {best[1]:.4f}  hit@.03 {100*best[2]:.1f}% n={best[3]}  (features now {len(cur)})")
SEL = cur

# ================================================================ 5. STAGE 3 holdout + null
L("\n" + "=" * 100); L("STAGE 3 — the ONE selected configuration on the 2025 HOLDOUT, vs the baseline, plus 2022-25 pooled"); L("=" * 100)
for lab, feats in (("baseline (ships now)", BASE), (f"selected: BASE + {chosen}", SEL)):
    ll, hit, n = score(run(feats, best_model, (HOLD,))); ll4, hit4, n4 = score(run(feats, best_model, SEARCH + (HOLD,)))
    L(f"  {lab:60s} 2025: logloss {ll:.4f} hit@.03 {100*hit:.1f}% n={n}   | 2022-25: logloss {ll4:.4f} hit {100*hit4:.1f}% n={n4}")
L("\n  NULL — same greedy search on SHUFFLED targets (3 replicates): best search-window log-loss gain reachable by chance")
for rep in range(3):
    b0 = score(run(BASE, best_model, SEARCH, shuffle_seed=100 + rep))[0]; cur_n = list(BASE); ll_n = b0; picks = []
    for step in range(3):
        best = None
        for fam, cols in FAMS.items():
            if fam in picks: continue
            cols = [c for c in cols if c in m.columns and m[m.season.isin(SEARCH)][c].notna().mean() > 0.5]
            if not cols: continue
            ll = score(run(cur_n + cols, best_model, SEARCH, shuffle_seed=100 + rep))[0]
            if best is None or ll < best[1]: best = (fam, ll, cols)
        if best is None or best[1] >= ll_n - 0.0005: break
        picks.append(best[0]); cur_n += best[2]; ll_n = best[1]
    L(f"    null rep {rep}: gain {b0 - ll_n:+.4f} from {picks}")
L(f"\n  REAL search gain on SEARCH window: {base_sc[best_model][0] - cur_ll:+.4f} from {chosen}")
L(f"done in {time.time()-t0:.0f}s")
