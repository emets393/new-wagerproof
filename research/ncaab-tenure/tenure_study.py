#!/usr/bin/env python3
"""NCAAB early-season TENURE + COHESION at small schools vs the T-60 close (owner ask 2026-11-02).

Owner's theory: the most tenured small-school teams (the players who actually play are juniors/seniors) and the most
cohesive ones (the same players have stayed together for years) do better in the first 5-10 games because the books do
not price them well at first -- or the opposite. Grade it historically, both directions, with quantile ladders.

Data (research/bball-odds caches + ncaab-hype roster cache):
  cbbd_player_box     minutes per player-game 2020-21..2025-26, athleteSourceId = stable id
  cbbd_rosters        CBBD /teams/roster 2021..2026 with startSeason = FIRST SEASON AT THIS SCHOOL (transfers reset: verified
                      100% of >=200-min transfers carry startSeason == S). Full 2022-2025, half of 2026 -> validation only.
  cbb_sit_panel       one row per team-game: T-60 spread, ats_pts, open spread, KenPom as-of, conference, gnum, coach_yr

Rotation for season S = players who appear in the team's first 10 games; weights = their minutes in those games ("the
players that actually play"). Clean-preseason check: weights = prior-season minutes anywhere.
  d1_prev     seasons before S with D1 minutes ANYWHERE (class proxy: 0 Fr, 1 So, 2 Jr, 3+ Sr/5th). Box starts 2020-21, so
              2 priors are observable from 2022-23 on -> class metrics graded 2023..2026 (4 seasons).
  here_prev   seasons before S with minutes AT THIS TEAM (time together with the program)
  upper_share share of rotation minutes played by juniors/seniors (d1_prev >= 2)
  senior_share  ... by d1_prev >= 3 (observable 2024..2026)
  avg_exp     minutes-weighted mean d1_prev (KenPom Exp analogue; validated against h_Exp)
  core_share  share of rotation minutes by players in their 3rd+ season at this school (here_prev >= 2)
  ret_share   share by players with any prior season here (here_prev >= 1)
  avg_here    minutes-weighted mean seasons at this school
  pair_ret    among the top-7 by minutes, fraction of pairs that BOTH played here last season (played together)
  pair_core   ... both in 3rd+ season here (together 2+ years)
Small school: conference size (power / mid-major / low-major, same map as ncaab-continuity/split_grid.py) and KenPom
preseason quintile (as-of rating at the team's first priced game).
Grading: team-side bet vs the T-60 spread, records from the winning side, per season, shuffle null (permute the trigger
within season x month) for headline cells, Jan-Feb placebo. Run: /usr/bin/python3 tenure_study.py > TENURE_RUN.txt
"""
import sys, itertools, numpy as np, pandas as pd
rng = np.random.default_rng(7)
B = "../bball-odds/data/parquet/"
pb = pd.read_parquet(B + "cbbd_player_box.parquet", columns=["gameId", "season", "startDate", "teamId", "athleteSourceId", "minutes"])
pb = pb.dropna(subset=["athleteSourceId"]); pb["pid"] = pb.athleteSourceId.astype("int64")
pb["startDate"] = pd.to_datetime(pb.startDate, utc=True); pb = pb.sort_values("startDate")
P = pd.read_parquet(B + "cbb_sit_panel.parquet")
P = P[P.spread.notna() & P.ats_pts.notna()].copy()
P["season_end"] = P.season.str[:4].astype(int) + 1
P["date"] = pd.to_datetime(P.startDate, utc=True)
P["team_gnum"] = P.sort_values("date").groupby(["season_end", "teamId"]).cumcount() + 1
P["gn"] = P.gnum.fillna(P.team_gnum)

# ---------------------------------------------------------------- per-player history
ps = pb[pb.minutes > 0].groupby(["season", "teamId", "pid"]).minutes.sum().reset_index()
seasons = sorted(ps.season.unique())
hist = []
for S in seasons:
    prev = ps[ps.season < S]
    d1 = prev.groupby("pid").season.nunique().rename("d1_prev")
    here = prev.groupby(["teamId", "pid"]).season.nunique().rename("here_prev").reset_index()
    pm = prev[prev.season == S - 1].groupby("pid").minutes.sum().rename("prior_min")
    pb["team_gidx"] = 0
    cur = pb[pb.season == S].copy()
    cur["team_gidx"] = cur.groupby("teamId").gameId.transform(lambda s: pd.factorize(s)[0] + 1)
    rot = cur[cur.team_gidx <= 10].groupby(["teamId", "pid"]).minutes.sum().reset_index().rename(columns={"minutes": "w"})
    rot = rot.merge(d1, on="pid", how="left").merge(here, on=["teamId", "pid"], how="left").merge(pm, on="pid", how="left")
    rot[["d1_prev", "here_prev", "prior_min"]] = rot[["d1_prev", "here_prev", "prior_min"]].fillna(0)
    rot["season"] = S; hist.append(rot)
R = pd.concat(hist, ignore_index=True)
# roster startSeason (years at this school, uncensored) for validation
ros = pd.read_parquet("../ncaab-hype/data/cbbd_rosters.parquet")
ros["pid"] = pd.to_numeric(ros.sourceId, errors="coerce"); ros["yrs_here_ros"] = (ros.season - ros.startSeason).clip(0, 5)
R = R.merge(ros[["season", "teamId", "pid", "yrs_here_ros"]].drop_duplicates(["season", "teamId", "pid"]), on=["season", "teamId", "pid"], how="left")

def team_metrics(g, wcol="w"):
    w = g[wcol].values.astype(float); tot = w.sum()
    if tot <= 0: return pd.Series(dtype=float)
    f = lambda m: float((w * m).sum() / tot)
    top = g.sort_values(wcol, ascending=False).head(7)
    pairs = list(itertools.combinations(range(len(top)), 2)); hp = top.here_prev.values
    pair_ret = np.mean([(hp[i] >= 1) & (hp[j] >= 1) for i, j in pairs]) if pairs else np.nan
    pair_core = np.mean([(hp[i] >= 2) & (hp[j] >= 2) for i, j in pairs]) if pairs else np.nan
    return pd.Series(dict(upper_share=f(g.d1_prev.values >= 2), senior_share=f(g.d1_prev.values >= 3), fresh_share=f(g.d1_prev.values == 0),
                          avg_exp=f(np.minimum(g.d1_prev.values, 4)), core_share=f(g.here_prev.values >= 2), ret_share=f(g.here_prev.values >= 1),
                          avg_here=f(np.minimum(g.here_prev.values, 4)), pair_ret=pair_ret, pair_core=pair_core,
                          avg_here_ros=float((w * g.yrs_here_ros.fillna(0).values).sum() / tot) if g.yrs_here_ros.notna().mean() > 0.9 else np.nan,
                          n_rot=int((w >= 0.1 * w.max()).sum())))
TS = R.groupby(["season", "teamId"]).apply(team_metrics).reset_index()
# clean-preseason weights: prior-season minutes anywhere (freshmen/no-minutes players drop out of the weighting)
TSp = R[R.prior_min > 0].groupby(["season", "teamId"]).apply(lambda g: team_metrics(g, "prior_min")).reset_index()
TSp = TSp[["season", "teamId", "upper_share", "core_share", "avg_exp", "avg_here"]].rename(columns=lambda c: c if c in ("season", "teamId") else "p_" + c)
TS = TS.merge(TSp, on=["season", "teamId"], how="left")
print(f"team-seasons: {len(TS):,}  by season {TS.groupby('season').size().to_dict()}")
print("metric means by season (censoring shows as a rising floor):")
print(TS.groupby("season")[["upper_share", "senior_share", "fresh_share", "avg_exp", "core_share", "ret_share", "avg_here", "pair_ret", "pair_core", "avg_here_ros"]].mean().round(3).to_string())

# ---------------------------------------------------------------- attach to games
D = P.merge(TS.rename(columns={"season": "season_end"}), on=["season_end", "teamId"], how="inner")
opp = TS.rename(columns={"season": "season_end", "teamId": "opponentId"}).add_prefix("o_").rename(columns={"o_season_end": "season_end", "o_opponentId": "opponentId"})
D = D.merge(opp, on=["season_end", "opponentId"], how="left")
D = D[D.season_end >= 2023].copy()                                    # class metrics need two observable prior seasons
POWER = {"ACC", "Big 12", "Big Ten", "SEC", "Big East", "Pac-12"}
MIDS = {"American Athletic", "Mountain West", "Atlantic 10", "West Coast", "Missouri Valley", "Conference USA", "Mid-American", "Sun Belt"}
csize = lambda c: "power" if c in POWER else ("mid-major" if c in MIDS else "low-major")
D["csize"] = D.conference.map(csize); D["o_csize"] = D.opponentConference.map(csize)
first = D.sort_values("date").groupby(["season_end", "teamId"]).own_kp_em.first().rename("kp_pre").reset_index()
D = D.merge(first, on=["season_end", "teamId"]).merge(first.rename(columns={"teamId": "opponentId", "kp_pre": "o_kp_pre"}), on=["season_end", "opponentId"], how="left")
D["kp_q"] = D.groupby("season_end").kp_pre.transform(lambda s: pd.qcut(s.rank(method="first"), 5, labels=["Q1 worst", "Q2", "Q3", "Q4", "Q5 best"]))
D["win_ats"] = np.sign(D.ats_pts); D["win_open"] = np.sign(D.ats_open_pts); D["mon"] = D.date.dt.month
D["early5"] = D.gn <= 5; D["early10"] = D.gn <= 10; D["nov"] = D.mon == 11; D["novdec"] = D.mon.isin([11, 12]); D["janfeb"] = D.mon.isin([1, 2])
D["small"] = D.csize != "power"; D["low"] = D.csize == "low-major"
for m in ["upper_share", "core_share", "avg_exp", "avg_here", "pair_ret", "pair_core", "senior_share", "fresh_share", "ret_share"]:
    D[m + "_gap"] = D[m] - D["o_" + m]
# within-season quintiles of each metric over TEAM-SEASONS (not games), overall and within small schools
def quint(df, col, by):
    t = df.drop_duplicates(["season_end", "teamId"])[["season_end", "teamId", col]].dropna()
    t["q"] = t.groupby("season_end")[col].transform(lambda s: pd.qcut(s.rank(method="first"), 5, labels=[1, 2, 3, 4, 5]).astype(int))
    return df.merge(t[["season_end", "teamId", "q"]].rename(columns={"q": by}), on=["season_end", "teamId"], how="left")
for m in ["upper_share", "core_share", "avg_exp", "avg_here", "pair_ret", "pair_core", "senior_share", "fresh_share"]:
    D = quint(D, m, "q_" + m)
    sm = quint(D[D.small], m, "qs_" + m)[["season_end", "teamId", "qs_" + m]].drop_duplicates()
    D = D.merge(sm, on=["season_end", "teamId"], how="left")
print(f"\nteam-games graded: {len(D):,} seasons {sorted(D.season_end.unique())}; small-school share {D.small.mean():.2f}, low-major {D.low.mean():.2f}")
print("validation: avg_exp vs KenPom Exp (own side, h_Exp when home / a_Exp when away) corr =",
      round(np.corrcoef(D.avg_exp, np.where(D.isHome, D.h_Exp, D.a_Exp))[0, 1], 3), "; avg_here (box) vs roster startSeason years corr =",
      round(D[["avg_here", "avg_here_ros"]].dropna().corr().iloc[0, 1], 3), "; actual-minutes vs prior-minutes weighting upper_share corr =", round(D[["upper_share", "p_upper_share"]].dropna().corr().iloc[0, 1], 3))

# ---------------------------------------------------------------- helpers
def rec(x, col="win_ats"):
    return int((x[col] > 0).sum()), int((x[col] < 0).sum())
def shuffle_p(mask, x, n=1000):
    obs = x.loc[mask, "win_ats"].sum(); k = int(mask.sum())
    if k < 40: return np.nan
    codes = pd.factorize(x.season_end.astype(str) + "_" + x.mon.astype(str))[0]; vals = x.win_ats.values; m = mask.values
    order = np.argsort(codes, kind="stable"); bounds = np.flatnonzero(np.diff(codes[order])) + 1
    groups = np.split(order, bounds); sims = np.empty(n)
    for i in range(n):
        perm = np.empty_like(vals)
        for idx in groups: perm[idx] = vals[rng.permutation(idx)]
        sims[i] = perm[m].sum()
    return float((np.abs(sims) >= abs(obs)).mean())
def line(mask, label, x=None, placebo=None, shuffle=False):
    x = D if x is None else x; s = x[mask]
    if len(s) < 40: print(f"   {label:<66} n={len(s)} (thin)"); return
    w, l = rec(s); side = "BACK" if w >= l else "FADE"; w2, l2 = (w, l) if w >= l else (l, w)
    sgn = 1 if side == "BACK" else -1
    per = " ".join(f"{str(y)[2:]}:{rec(g)[0] if sgn>0 else rec(g)[1]}-{rec(g)[1] if sgn>0 else rec(g)[0]}" for y, g in s.groupby("season_end"))
    z = (w2 - l2) / np.sqrt(w2 + l2); roi = 100 * (w2 * 100 / 110 - l2) / (w2 + l2)
    ow, ol = rec(s, "win_open"); ow, ol = (ow, ol) if sgn > 0 else (ol, ow)
    extra = f"  | vs opener {ow}-{ol} ({100*ow/max(1,ow+ol):.1f}%)"
    if shuffle: extra += f"  | shuffle p {shuffle_p(mask, x):.3f}"
    if placebo is not None:
        sp = x[placebo]
        if len(sp) >= 40:
            pw, pl = rec(sp); pw, pl = (pw, pl) if sgn > 0 else (pl, pw); extra += f"  | Jan-Feb placebo same side {pw}-{pl} ({100*pw/(pw+pl):.1f}%)"
    print(f"   {label:<66} {side} {w2}-{l2} ({100*w2/(w2+l2):.1f}%, ROI {roi:+.1f}%, z {z:+.1f}) spr {s.spread.mean():+.1f} | {per}{extra}")
def ladder(qcol, label, win, winlab, x=None, side_fixed=None):
    """Quintile ladder, BACK records (so a falling % down the ladder = fade the low end / back the high end)."""
    x = D if x is None else x
    print(f"\n   {label} -- {winlab} -- BACK the team, by within-season quintile (1 = least, 5 = most):")
    for q in [1, 2, 3, 4, 5]:
        s = x[win & (x[qcol] == q)]
        if len(s) < 40: print(f"      Q{q}: n={len(s)} thin"); continue
        w, l = rec(s); pl = x[x.janfeb & (x[qcol] == q)]; pw, pll = rec(pl)
        per = " ".join(f"{str(y)[2:]}:{rec(g)[0]}-{rec(g)[1]}" for y, g in s.groupby("season_end"))
        print(f"      Q{q}: {w}-{l} ({100*w/(w+l):.1f}%)  margin vs spread {s.ats_pts.mean():+.2f}  spr {s.spread.mean():+.1f}  SU {100*(s.win>0).mean():.0f}% | {per} | Jan-Feb {pw}-{pll} ({100*pw/max(1,pw+pll):.1f}%)")

# ---------------------------------------------------------------- A. is it real, is it priced? (team-season regression, first 10 games)
import numpy.linalg as la
def ols(y, X, names):
    X = np.column_stack([np.ones(len(y))] + X); b = la.lstsq(X, y, rcond=None)[0]; res = y - X @ b
    se = np.sqrt(np.diag(la.inv(X.T @ X)) * res.var(ddof=X.shape[1])); return {n: (round(b[i+1], 2), round(b[i+1]/se[i+1], 1)) for i, n in enumerate(names)}
print("\n=== A. IS TENURE/COHESION REAL AND IS IT PRICED? team-season regression, first 10 games, controls = prior-season margin ===")
ts = D[D.early10].groupby(["season_end", "teamId"]).agg(upper=("upper_share", "first"), core=("core_share", "first"), exp=("avg_exp", "first"), here=("avg_here", "first"), pair=("pair_core", "first"),
                                                    margin=("margin", "mean"), spread=("spread", "mean"), ats=("ats_pts", "mean"), pm=("pm_margin", "first"), small=("small", "first"), kp=("kp_pre", "first")).reset_index()
ts["pm"] = ts.pm.fillna(ts.pm.median())
print(f" (team-seasons {len(ts)}, prior-season margin known for {ts.pm.notna().mean():.0%}; controls = preseason KenPom + prior-season margin)")
for lab, sub0 in [("all teams", ts), ("small schools (non-power)", ts[ts.small]), ("power conferences", ts[~ts.small])]:
    for v, nm in [("upper", "upper_share (Jr/Sr minutes share)"), ("core", "core_share (3rd+ yr at school)"), ("exp", "avg_exp"), ("here", "avg_here"), ("pair", "pair_core")]:
        sub = sub0.dropna(subset=[v, "margin", "spread", "ats", "kp"])
        if v == "upper": print(f" -- {lab}: n={len(sub)}")
        a = ols(sub.margin.values, [sub[v].values, sub.pm.values, sub.kp.values], [v, "pm", "kp"])[v]
        b = ols(-sub.spread.values, [sub[v].values, sub.pm.values, sub.kp.values], [v, "pm", "kp"])[v]
        c = ols(sub.ats.values, [sub[v].values, sub.pm.values, sub.kp.values], [v, "pm", "kp"])[v]
        print(f"    {nm:<36} realised margin {a[0]:+.2f} (t {a[1]:+.1f}) | market {b[0]:+.2f} (t {b[1]:+.1f}) | ATS gap {c[0]:+.2f} (t {c[1]:+.1f})   per unit of the metric")

# ---------------------------------------------------------------- B. quantile ladders (owner standard)
print("\n=== B. QUANTILE LADDERS -- all D1, 2022-23..2025-26 ===")
for m, lab in [("upper_share", "TENURE: share of rotation minutes by juniors/seniors"), ("avg_exp", "TENURE: minutes-weighted D1 seasons played"),
               ("core_share", "COHESION: share of minutes by players in 3rd+ season at this school"), ("avg_here", "COHESION: minutes-weighted seasons at this school"),
               ("pair_core", "COHESION: top-7 pairs together 2+ years"), ("pair_ret", "COHESION: top-7 pairs who played here together last year")]:
    for win, wl in [(D.early5, "first 5 games"), (D.early10, "first 10 games"), (D.novdec, "Nov-Dec")]:
        ladder("q_" + m, lab, win, wl)
print("\n=== C. QUANTILE LADDERS -- SMALL SCHOOLS ONLY (non-power), quintiles within small schools ===")
S = D[D.small]
for m, lab in [("upper_share", "TENURE: Jr/Sr minutes share"), ("avg_exp", "TENURE: avg D1 seasons"), ("core_share", "COHESION: 3rd+ year share"), ("avg_here", "COHESION: avg seasons here"), ("pair_core", "COHESION: pairs together 2+ yrs"), ("senior_share", "TENURE: senior share (2024-26 only)")]:
    for win, wl in [(S.early5, "first 5 games"), (S.early10, "first 10 games"), (S.novdec, "Nov-Dec")]:
        ladder("qs_" + m, lab, win, wl, x=S)
print("\n=== C2. LOW-MAJOR ONLY, first 10 games ===")
L = D[D.low]
for m, lab in [("upper_share", "TENURE: Jr/Sr share"), ("core_share", "COHESION: 3rd+ year share"), ("avg_here", "COHESION: avg seasons here")]:
    ladder("qs_" + m, lab, L.early10, "first 10 games, low-majors", x=L)

# ---------------------------------------------------------------- D. rules: tenured, cohesive, both, vs a young/new opponent
print("\n=== D. RULES (both directions reported; records from the winning side) ===")
top_t = D.q_upper_share == 5; top_c = D.q_core_share == 5; top_h = D.q_avg_here == 5; bot_t = D.q_upper_share == 1; bot_c = D.q_core_share == 1
for win, wl in [(D.early5, "first 5 games"), (D.early10, "first 10 games"), (D.novdec, "Nov-Dec")]:
    print(f" -- window: {wl}")
    line(win & top_t, "most tenured quintile (Jr/Sr share)", placebo=D.janfeb & top_t, shuffle=True)
    line(win & top_c, "most cohesive quintile (3rd+ yr share)", placebo=D.janfeb & top_c, shuffle=True)
    line(win & top_t & top_c, "BOTH most tenured and most cohesive", placebo=D.janfeb & top_t & top_c, shuffle=True)
    line(win & top_t & top_c & D.small, "  ... small school", placebo=D.janfeb & top_t & top_c & D.small, shuffle=True)
    line(win & top_t & top_c & D.low, "  ... low-major", placebo=D.janfeb & top_t & top_c & D.low, shuffle=True)
    line(win & (D.upper_share >= 0.75), "Jr/Sr play 75%+ of minutes", placebo=D.janfeb & (D.upper_share >= 0.75), shuffle=True)
    line(win & (D.upper_share >= 0.75) & D.small, "  ... small school", placebo=D.janfeb & (D.upper_share >= 0.75) & D.small, shuffle=True)
    line(win & (D.core_share >= 0.50), "3rd+ year players 50%+ of minutes", placebo=D.janfeb & (D.core_share >= 0.50), shuffle=True)
    line(win & (D.core_share >= 0.50) & D.small, "  ... small school", placebo=D.janfeb & (D.core_share >= 0.50) & D.small, shuffle=True)
    line(win & (D.pair_core >= 0.4), "40%+ of top-7 pairs together 2+ years", placebo=D.janfeb & (D.pair_core >= 0.4), shuffle=True)
    line(win & (D.upper_share_gap >= 0.35), "tenure gap +35pts vs opponent", placebo=D.janfeb & (D.upper_share_gap >= 0.35), shuffle=True)
    line(win & (D.upper_share_gap >= 0.35) & D.small, "  ... small school", placebo=D.janfeb & (D.upper_share_gap >= 0.35) & D.small, shuffle=True)
    line(win & (D.core_share_gap >= 0.35), "cohesion gap +35pts vs opponent", placebo=D.janfeb & (D.core_share_gap >= 0.35), shuffle=True)
    line(win & top_t & (D.o_fresh_share >= 0.4), "most tenured vs opponent playing freshmen 40%+", placebo=D.janfeb & top_t & (D.o_fresh_share >= 0.4), shuffle=True)
    line(win & bot_t, "LEAST tenured quintile (young rotation)", placebo=D.janfeb & bot_t, shuffle=True)
    line(win & bot_c, "LEAST cohesive quintile (all new to each other)", placebo=D.janfeb & bot_c, shuffle=True)
    line(win & bot_t & bot_c & D.small, "young AND new, small school", placebo=D.janfeb & bot_t & bot_c & D.small, shuffle=True)

# ---------------------------------------------------------------- E. small school x KenPom quintile x tenure (where would a misprice live?)
print("\n=== E. small schools, first 10 games: most-tenured-and-cohesive (small-school quintile 5 on both) by KenPom preseason quintile, venue, spread ===")
S = D[D.small]; both = (S.qs_upper_share == 5) & (S.qs_core_share == 5); tt = S.qs_upper_share == 5; cc = S.qs_core_share == 5
for lab, m in [("tenured Q5 (small-school quintiles)", tt), ("cohesive Q5", cc), ("both Q5", both)]:
    print(f" -- {lab}")
    line(S.early10 & m, "all", x=S, placebo=S.janfeb & m, shuffle=True)
    for q in ["Q1 worst", "Q2", "Q3", "Q4", "Q5 best"]:
        line(S.early10 & m & (S.kp_q == q), f"  KenPom preseason {q}", x=S)
    line(S.early10 & m & (S.is_home == 1), "  home", x=S); line(S.early10 & m & (S.is_home == 0) & (S.neutral != 1), "  away", x=S)
    line(S.early10 & m & (S.spread > 0), "  underdog", x=S); line(S.early10 & m & (S.spread >= 7), "  dog of 7+", x=S); line(S.early10 & m & (S.spread < 0), "  favorite", x=S)
    line(S.early10 & m & (S.o_csize == "power"), "  vs power-conference opponent", x=S); line(S.early10 & m & (S.o_csize != "power"), "  vs non-power opponent", x=S)
    line(S.early10 & m & (S.o_upper_share <= 0.4), "  vs opponent with Jr/Sr share <= 40%", x=S)

# ---------------------------------------------------------------- F. clean-preseason weighting + KenPom Exp cross-check
print("\n=== F. ROBUSTNESS: prior-minutes weighting (no in-season info) and KenPom Exp quintiles, first 10 games ===")
D = quint(D, "p_upper_share", "q_p_upper"); D = quint(D, "p_core_share", "q_p_core")
D["kp_exp"] = np.where(D.isHome, D.h_Exp, D.a_Exp); D = quint(D, "kp_exp", "q_kp_exp")
ladder("q_p_upper", "TENURE weighted by PRIOR-season minutes", D.early10, "first 10 games")
ladder("q_p_core", "COHESION weighted by PRIOR-season minutes", D.early10, "first 10 games")
ladder("q_kp_exp", "KenPom Exp (end-of-season, minutes-weighted class)", D.early10, "first 10 games")
ladder("q_kp_exp", "KenPom Exp, small schools", D.early10 & D.small, "first 10 games")
D.to_parquet("tenure_games.parquet"); TS.to_parquet("tenure_team_seasons.parquet")
print("\nwrote tenure_games.parquet, tenure_team_seasons.parquet")
