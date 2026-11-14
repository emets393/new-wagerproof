#!/usr/bin/env python3
"""MATCHUP-CONDITIONAL POWER RATINGS (owner 2026-09-17).

Four scores per game: each team's OFFENSIVE composite (expected points vs THIS opponent's
defense) and DEFENSIVE composite (expected points allowed vs THIS opponent's offense).

Discipline, in order, every step gated before the next:
  1. unit ratings from VERIFIED-CLEAN tables only (split_recv_adv_x_coverage excluded — its
     coverage dimension does not exist and it fed the v4 leak)
  2. RELIABILITY gate: a unit must be a stable trait (split-half r >= 0.30) or it is dropped
  3. LEAK screen: |corr vs result| must not exceed |corr vs market| (screened on 2021-22 only)
  4. matchup differentials: offense unit minus this opponent's matching defense unit
  5. MARKET-FREE ridge -> expected points = the composite. Walk-forward. Then a market-blended
     version for comparison, because [[predict-the-raw-quantity-not-the-residual]] says
     withholding the line usually hurts — we test rather than assume.
  6. graded vs the OPENER (what production bets), per-season, margin symmetry, placebo.

RETRACTED 2026-09-17 (power_ratings_anchor_check.py): step 5 anchors on the CLOSE and step 6
grades vs the OPEN, so the "edge" was the close moving off the opener. Close-anchored vs close
48.0%; open-anchored vs open 53.8%. The composites describe matchups; they are not a bet.
"""
import numpy as np
import pandas as pd

def _load_games():
    """nflverse schedule; falls back to the local enriched copy when the release URL is down."""
    try:
        return pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv", low_memory=False)
    except Exception:
        return pd.read_parquet("data/games_enriched.parquet")

pd.options.mode.chained_assignment = None
FP = "data/fpdata/"
FLAT = FP + "flat/"
num = lambda s: pd.to_numeric(s, errors="coerce")
AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}
NICK = {"Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI",
"Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HOU",
"Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA",
"Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT",
"Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
C2A = {"Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR","Chicago":"CHI",
"Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN","Detroit":"DET","Green Bay":"GB",
"Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX","Kansas City":"KC","LA Rams":"LA","LA Chargers":"LAC",
"Las Vegas":"LV","Miami":"MIA","Minnesota":"MIN","New England":"NE","New Orleans":"NO","NY Giants":"NYG",
"NY Jets":"NYJ","Philadelphia":"PHI","Pittsburgh":"PIT","Seattle":"SEA","San Francisco":"SF","Tampa Bay":"TB",
"Tennessee":"TEN","Washington":"WAS"}
K = 4.0
SCREEN = [2021, 2022]
TEST = [2023, 2024, 2025]
REL_MIN = 0.30


def tkey(df):
    if "teamAbbreviation" in df.columns and df.teamAbbreviation.notna().any():
        s = df.teamAbbreviation
    else:
        s = df.teamNickname.map(NICK)
    return s.map(lambda a: AB_NV.get(a, a))


def entering(df, key, cols):
    d = df.sort_values([key, "__season", "__week"]).copy()
    pri = d.groupby([key, "__season"])[cols].mean().reset_index()
    pri["__nxt"] = pri.__season + 1
    pri = pri.rename(columns={c: "__p_" + c for c in cols})
    d = d.merge(pri[[key, "__nxt"] + ["__p_" + c for c in cols]],
                left_on=[key, "__season"], right_on=[key, "__nxt"], how="left")
    g = d.groupby([key, "__season"])
    out = d[[key, "__season", "__week"]].copy()
    for c in cols:
        cs = g[c].transform(lambda x: x.shift(1).expanding().sum())
        cn = g[c].transform(lambda x: x.shift(1).expanding().count()).fillna(0)
        p = d["__p_" + c]
        v = (p.fillna(0) * K + cs.fillna(0)) / (K + cn)
        v[p.isna() & (cn == 0)] = np.nan
        out[c] = v
    return out


# ================================================================ 1. UNIT RATINGS (per-game raw)
RAW = []      # list of (frame with __k/__season/__week + unit cols, [unit cols])


def unit_table(path, spec, flat=False):
    t = pd.read_parquet((FLAT if flat else FP) + path)
    t["__k"] = tkey(t)
    keep = []
    for name, col, sign in spec:
        if col in t.columns:
            t[name] = num(t[col]) * sign; keep.append(name)
    if keep:
        RAW.append((t[["__k", "__season", "__week"] + keep], keep))


# sign convention: + = GOOD for the unit that owns it
unit_table("team_offense_passing-advanced.parquet", [
    ("O_pass_cpoe", "teamStatsPassingCompletionsOverExpected", 1),
    ("O_pass_ypa", "teamStatsPassingYardsPerAttempt", 1),
    ("O_pass_sack", "teamStatsPassingSackedPercentage", -1),
    ("O_pass_press", "teamStatsPassingPressuredPercentage", -1),
    ("O_pass_adot", "teamStatsPassingAverageDepthOfTarget", 1)])
unit_table("team_offense_rushing-advanced.parquet", [
    ("O_run_ypa", "teamStatsRushingYardsPerAttempt", 1),
    ("O_run_ybc", "teamStatsRushingYardsBeforeContactPerAttempt", 1),
    ("O_run_yac", "teamStatsRushingYardsAfterContactPerAttempt", 1),
    ("O_run_succ", "teamStatsRushingAttemptsSuccessPercentage", 1),
    ("O_run_stuff", "teamStatsRushingAttemptsStuffsPercentage", -1),
    ("O_run_expl", "teamStatsRushingRunsExplosivePercentage", 1)])
unit_table("team_defense_passing-advanced.parquet", [
    ("D_pass_ypa", "opponentStatsPassingYardsPerAttempt", -1),
    ("D_pass_cpoe", "opponentStatsPassingCompletionsOverExpected", -1),
    ("D_pass_sack", "opponentStatsPassingSackedPercentage", 1),
    ("D_pass_press", "opponentStatsPassingPressuredPercentage", 1),
    ("D_pass_poe", "opponentStatsPassingPressuredOverExpected", 1)])
unit_table("team_defense_rushing-advanced.parquet", [
    ("D_run_ypa", "opponentStatsRushingYardsPerAttempt", -1),
    ("D_run_ybc", "opponentStatsRushingYardsBeforeContactPerAttempt", -1),
    ("D_run_succ", "opponentStatsRushingAttemptsSuccessPercentage", -1),
    ("D_run_stuff", "opponentStatsRushingAttemptsStuffsPercentage", 1),
    ("D_run_expl", "opponentStatsRushingRunsExplosivePercentage", -1)])
unit_table("team_defense_receiving-advanced.parquet", [
    ("D_rec_yprr", "opponentStatsReceivingAveragesPerRouteYardsTotal", -1)])
unit_table("lineMatchups__team.parquet", [
    ("O_ol_poe", "teamStatsPassingPressuredOverExpected", -1),
    ("D_dl_poe", "opponentStatsPassingPressuredOverExpected", 1)])
# red zone + situational (recovered buckets, verified top-level == Overall at 100%)
rp = pd.read_parquet(FLAT + "team_run-pass-report.parquet")
rp["__k"] = tkey(rp)
for bk, nm in (("Inside20", "rz20"), ("Inside10", "rz10")):
    p_, t_ = f"{bk}__teamStatsSnapsOffensePass", f"{bk}__teamStatsSnapsOffenseTotal"
    rp[f"O_{nm}_plays"] = num(rp[t_])
    rp[f"O_{nm}_passrate"] = num(rp[p_]) / num(rp[t_]).replace(0, np.nan)
RAW.append((rp[["__k", "__season", "__week", "O_rz20_plays", "O_rz10_plays", "O_rz20_passrate", "O_rz10_passrate"]],
            ["O_rz20_plays", "O_rz10_plays", "O_rz20_passrate", "O_rz10_passrate"]))
# production CORE (team_week, city names). TEAM_WEEK env swaps the source: the prod table's
# `_s2d` columns are CUMULATIVE SINCE 2018 (never reset by season — see build_team_week_seasonal.py),
# so the default here is an 8-season franchise average, not season-to-date.
# Default is the rebuilt seasonal file; A/B on 2023-25 (power_ratings_core_fix.py) was a wash
# (spreads 59.3% -> 59.7%, totals 63.0% -> 60.6%), so the switch is about the definition being
# true, not about performance.
import os
_TW = os.environ.get("TEAM_WEEK", "data/team_week_seasonal.parquet")
tw = pd.read_parquet(_TW if os.path.exists(_TW) else "data/team_week.parquet")
tw["__k"] = tw.team.map(C2A).fillna(tw.team)
tw = tw.rename(columns={"season": "__season", "week": "__week"})
CORE = {"O_epa_pass": ("off_pass_epa_neutral_s2d", 1), "O_epa_run": ("off_rush_epa_neutral_s2d", 1),
        "O_ppd": ("off_pts_per_drive_s2d", 1), "O_proe": ("off_proe_s2d", 1),
        "D_epa_pass": ("def_pass_epa_allowed_neutral_s2d", -1), "D_epa_run": ("def_rush_epa_allowed_neutral_s2d", -1),
        "D_ppd": ("def_pts_per_drive_allowed_s2d", -1)}
ck = []
for nm, (c, sg) in CORE.items():
    if c in tw.columns:
        tw[nm] = num(tw[c]) * sg; ck.append(nm)
# team_week is already season-to-date (entering), so it bypasses entering()
CORE_FRAME = tw[["__k", "__season", "__week"] + ck].copy()

# ================================================================ 2. RELIABILITY GATE
def split_half(frame, cols):
    """odd-vs-even-week season means, per team-season; r across team-seasons."""
    out = {}
    f = frame[frame.__season.isin([2021, 2022, 2023, 2024, 2025])].copy()
    f["par"] = f.__week % 2
    for c in cols:
        a = f[f.par == 1].groupby(["__k", "__season"])[c].mean()
        b = f[f.par == 0].groupby(["__k", "__season"])[c].mean()
        j = pd.concat([a.rename("a"), b.rename("b")], axis=1).dropna()
        out[c] = j.a.corr(j.b) if len(j) >= 40 else np.nan
    return out


REL = {}
for frame, cols in RAW:
    REL.update(split_half(frame, cols))
UNITS_ALL = list(REL)
UNITS = [u for u in UNITS_ALL if pd.notna(REL[u]) and REL[u] >= REL_MIN]
print("=" * 96)
print("RELIABILITY GATE — split-half r (odd vs even weeks). Keep >= 0.30")
print("=" * 96)
for u in sorted(UNITS_ALL, key=lambda x: -(REL[x] if pd.notna(REL[x]) else -9)):
    print(f"  {u:18s} r={REL[u]:+.2f}  {'KEEP' if u in UNITS else 'drop'}")
print(f"kept {len(UNITS)} of {len(UNITS_ALL)} FP units (+ {len(ck)} production CORE units, already validated)")

# ================================================================ 3. entering-game + assemble
ENT = None
for frame, cols in RAW:
    keep = [c for c in cols if c in UNITS]
    if not keep:
        continue
    e = entering(frame, "__k", keep)
    ENT = e if ENT is None else ENT.merge(e, on=["__k", "__season", "__week"], how="outer")
ENT = ENT.merge(CORE_FRAME, on=["__k", "__season", "__week"], how="outer")
ALLU = UNITS + ck
OFFU = [u for u in ALLU if u.startswith("O_")]
DEFU = [u for u in ALLU if u.startswith("D_")]

g = _load_games()
g = g[(g.game_type == "REG") & g.result.notna() & g.spread_line.notna() & g.total_line.notna()
      & (g.season >= 2021) & (g.season <= 2025)]
rows = []
for _, r in g.iterrows():
    # neutral / international sites: the designated "home" team has no home field -> home=0 for both
    neutral = ("location" in g.columns) and (str(r.location) != "Home")
    for team, opp, home in ((r.home_team, r.away_team, 0 if neutral else 1), (r.away_team, r.home_team, 0)):
        rows.append(dict(season=r.season, week=r.week, game_id=r.game_id, team=team, opp=opp, home=home, neutral=int(neutral),
                         pts=r.home_score if home else r.away_score, margin=r.result if home else -r.result,
                         close_line=-r.spread_line if home else r.spread_line, total=r.total_line))
P = pd.DataFrame(rows)
P["mkt_pts"] = P.total / 2 - P.close_line / 2
P = P.merge(ENT, left_on=["team", "season", "week"], right_on=["__k", "__season", "__week"], how="left").drop(
    columns=["__k", "__season", "__week"], errors="ignore")
P = P.merge(ENT.rename(columns={c: "opp_" + c for c in ALLU}),
            left_on=["opp", "season", "week"], right_on=["__k", "__season", "__week"], how="left").drop(
    columns=["__k", "__season", "__week"], errors="ignore")

# ================================================================ 4. MATCHUP DIFFERENTIALS
# offense unit vs opponent's MATCHING defense unit (both signed so + = good for the offense)
PAIRS = [("O_pass_ypa", "D_pass_ypa"), ("O_pass_cpoe", "D_pass_cpoe"), ("O_pass_sack", "D_pass_sack"),
         ("O_pass_press", "D_pass_press"), ("O_ol_poe", "D_dl_poe"), ("O_run_ypa", "D_run_ypa"),
         ("O_run_ybc", "D_run_ybc"), ("O_run_succ", "D_run_succ"), ("O_run_stuff", "D_run_stuff"),
         ("O_run_expl", "D_run_expl"), ("O_epa_pass", "D_epa_pass"), ("O_epa_run", "D_epa_run"),
         ("O_ppd", "D_ppd")]
MX = []
for o, d in PAIRS:
    if o in P.columns and "opp_" + d in P.columns:
        # defense units are signed + = good for DEFENSE, so offense-minus-defense = net edge for offense
        P["mx_" + o[2:]] = P[o] - P["opp_" + d]
        MX.append("mx_" + o[2:])
print(f"\nmatchup differentials: {len(MX)}")

# ================================================================ 5. LEAK SCREEN
CANDS = OFFU + ["opp_" + d for d in DEFU] + MX + ["home"]
CANDS = [c for c in dict.fromkeys(CANDS) if c in P.columns]
for c in CANDS:
    P[c] = num(P[c])
S = P[P.season.isin(SCREEN)]
dropped = []
KEEPF = []
for c in CANDS:
    s = S[[c, "mkt_pts", "pts"]].dropna()
    if len(s) < 200 or s[c].std() < 1e-9:
        continue
    cl, cr = abs(s[c].corr(s.mkt_pts)), abs(s[c].corr(s.pts))
    if cr > cl * 1.25 and cr > 0.05:
        dropped.append((c, cl, cr))
    else:
        KEEPF.append(c)
print(f"\nLEAK SCREEN ({SCREEN}): kept {len(KEEPF)}, dropped {len(dropped)}")
for c, cl, cr in dropped:
    print(f"  dropped {c:22s} mkt {cl:.3f} result {cr:.3f}")

# ================================================================ 6. FIT + EVALUATE
Q = P.dropna(subset=["pts", "close_line", "total"]).copy()
Q[KEEPF] = Q[KEEPF].fillna(Q.groupby("season")[KEEPF].transform("mean")).fillna(Q[KEEPF].mean()).fillna(0)
O = pd.read_parquet("data/odds_consensus.parquet")[["season", "home_ab", "away_ab", "open_spread", "open_total"]]


def ridge(X, y, lam):
    Xb = np.hstack([X, np.ones((len(X), 1))])
    A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam
    return np.linalg.lstsq(A, Xb.T @ y, rcond=None)[0]


def fit(feats, lam=80.0, shuffle=False, seed=0):
    rng = np.random.default_rng(seed)
    preds = []
    for ssn in TEST:
        tr, te = Q[Q.season < ssn].copy(), Q[Q.season == ssn].copy()
        y = tr.pts.values.astype(float)
        if shuffle:
            y = rng.permutation(y)
        Fk = [c for c in feats if tr[c].std() > 1e-9]
        X = tr[Fk].values.astype(float); m, s = X.mean(0), X.std(0); s[s == 0] = 1
        w = ridge((X - m) / s, y, lam)
        te["pred"] = np.hstack([(te[Fk].values.astype(float) - m) / s, np.ones((len(te), 1))]) @ w
        preds.append(te)
    pr = pd.concat(preds)
    own = pr.set_index(["game_id", "team"]).pred
    pr["opp_pred"] = own.reindex(pd.MultiIndex.from_arrays([pr.game_id, pr.opp])).values
    return pr


def evaluate(pr, label):
    gg = pr[pr.home == 1].copy()
    gg = gg.rename(columns={"pred": "home_off", "opp_pred": "away_off"})
    gg["pm"] = gg.home_off - gg.away_off
    gg["pt"] = gg.home_off + gg.away_off
    gg["home_team"] = gg.team; gg["away_team"] = gg.opp
    act = Q.groupby("game_id", as_index=False).pts.sum().rename(columns={"pts": "tot_act"})
    gg = gg.merge(act, on="game_id", how="left")
    gg = gg.merge(O, left_on=["season", "home_team", "away_team"], right_on=["season", "home_ab", "away_ab"], how="left")
    gg["open_home_line"] = gg.open_spread
    r2 = 1 - ((pr.pts - pr.pred) ** 2).sum() / ((pr.pts - pr.pts.mean()) ** 2).sum()
    r2m = 1 - ((pr.pts - pr.mkt_pts) ** 2).sum() / ((pr.pts - pr.pts.mean()) ** 2).sum()
    print(f"\n{'=' * 96}\n{label}\n{'=' * 96}")
    print(f"  R² predicting team points: composite {r2:.3f}  vs  market alone {r2m:.3f}")
    gg = gg.dropna(subset=["open_home_line", "open_total"])
    gg["e"] = gg.pm - (-gg.open_home_line)
    gg["te"] = gg.pt - gg.open_total
    for col, thr_list, mk in (("e", (1, 2, 3), "SPREAD vs OPEN"), ("te", (2, 3, 4), "TOTAL vs OPEN")):
        print(f"  {mk}")
        for thr in thr_list:
            if col == "e":
                d = gg[(gg.e.abs() >= thr) & ((gg.margin + gg.open_home_line) != 0)].copy()
                d["won"] = np.where(d.e > 0, (d.margin + d.open_home_line) > 0, (d.margin + d.open_home_line) < 0)
                d["beat"] = np.where(d.e > 0, d.margin + d.open_home_line, -(d.margin + d.open_home_line))
            else:
                d = gg[(gg.te.abs() >= thr) & (gg.tot_act != gg.open_total)].copy()
                d["won"] = np.where(d.te > 0, d.tot_act > d.open_total, d.tot_act < d.open_total)
                d["beat"] = np.where(d.te > 0, d.tot_act - d.open_total, d.open_total - d.tot_act)
            if len(d) < 30:
                continue
            wm, lm = d[d.won].beat.mean(), d[~d.won].beat.mean()
            sym = abs(wm) / abs(lm) if lm else np.nan
            row = f"    thr{thr}: {100*d.won.mean():5.1f}% n={len(d):3d} sym={sym:.2f} |"
            for ssn in TEST:
                x = d[d.season == ssn]
                row += f" {ssn}:{100*x.won.mean():5.1f}%({len(x):3d})" if len(x) >= 15 else f" {ssn}:--"
            print(row)
    return gg


MARKET_FREE = KEEPF
MARKET_BLEND = ["close_line", "total", "mkt_pts"] + KEEPF
pr_free = fit(MARKET_FREE)
gg_free = evaluate(pr_free, "A) MARKET-FREE POWER RATINGS  (the composite = expected points from unit matchups only)")
pr_blend = fit(MARKET_BLEND)
gg_blend = evaluate(pr_blend, "B) MARKET-BLENDED  (composite + market anchor)")

print(f"\n{'=' * 96}\nPLACEBO (shuffled training outcomes, market-free)\n{'=' * 96}")
for sd in (1, 2):
    gp = fit(MARKET_FREE, shuffle=True, seed=sd)
    gpp = gp[gp.home == 1].copy(); gpp["pm"] = gpp.pred - gpp.opp_pred
    gpp = gpp.merge(O, left_on=["season", "team", "opp"], right_on=["season", "home_ab", "away_ab"], how="inner")
    gpp["e"] = gpp.pm - (-gpp.open_spread)
    d = gpp[(gpp.e.abs() >= 2) & ((gpp.margin + gpp.open_spread) != 0)]
    w = np.where(d.e > 0, (d.margin + d.open_spread) > 0, (d.margin + d.open_spread) < 0)
    print(f"  seed {sd}: spread thr2 vs open {100*w.mean():.1f}% (n={len(d)})")

# ================================================================ 7. coefficient report (what drives it)
tr = Q[Q.season < 2025]
Fk = [c for c in MARKET_FREE if tr[c].std() > 1e-9]
X = tr[Fk].values.astype(float); m, s = X.mean(0), X.std(0); s[s == 0] = 1
w = ridge((X - m) / s, tr.pts.values.astype(float), 80.0)
co = pd.Series(w[:-1], index=Fk).sort_values(key=abs, ascending=False)
print(f"\n{'=' * 96}\nWHAT DRIVES THE COMPOSITE (standardized coefficients, points per 1 SD)\n{'=' * 96}")
for k, v in co.head(14).items():
    print(f"  {k:24s} {v:+.2f}")
pr_free.to_parquet(FP + "_power_ratings_preds.parquet", index=False)
