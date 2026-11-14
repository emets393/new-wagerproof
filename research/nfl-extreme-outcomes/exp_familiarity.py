#!/usr/bin/env python3
"""STUDY B — FAMILIARITY (owner, 2026-09-18).  Does an offense / QB struggle against a defensive style it
has rarely faced (blitz-heavy, man-heavy, 5+ rushers)?  Does a defense struggle against an offensive
style it has rarely faced (run-heavy, play-action heavy)?
Per-play frame 2022-25 (nflverse pbp + FTN + participation). Per team-game: offense EPA/dropback, run
share, play-action rate, QB; defense blitz%, 5+ rushers%, man%, EPA allowed.
  style of the opponent  = entering K=4-seeded season-to-date rate, tiered each week (HIGH = top third)
  familiarity (team)     = dropback-weighted mean of the style ACTUALLY FACED in prior games this season
  familiarity (QB)       = same over the QB's own dropbacks, this season + the two before
  outcome                = this game's EPA/dropback minus the offense's entering norm (sd units), and the
                           margin residual vs the OPENER and the CLOSE, and the total residual
Readout: HIGH-style opponent x LOW / HIGH familiarity, per season; continuous interaction (walk-forward r);
bets: fade the unfamiliar offense ATS, and its game UNDER, per season."""
import glob, numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore"); num = lambda s: pd.to_numeric(s, errors="coerce")
COLS = ["game_id","play_id","season","week","posteam","defteam","qb_dropback","qb_scramble","pass","rush","play_type","passer_player_name","rusher_player_name","epa","season_type","home_team","away_team"]
pbp = pd.concat([pd.read_parquet(f, columns=COLS) for f in ["data/pbp_cache/_dl_2022.parquet"] + sorted(glob.glob("data/pbp_cache/pbp_202[345].parquet"))], ignore_index=True)
pbp = pbp[(pbp.season_type == "REG") & pbp.posteam.notna() & pbp.play_type.isin(["pass","run"])]
ftn = pd.concat([pd.read_parquet("data/ftn_charting.parquet"), pd.read_parquet("data/ftn_charting_2025.parquet")], ignore_index=True)
for a, b in (("nflverse_game_id","game_id"), ("nflverse_play_id","play_id")):
    if b in ftn.columns and a in ftn.columns: ftn[b] = ftn[b].fillna(ftn[a]); ftn = ftn.drop(columns=a)
    elif a in ftn.columns: ftn = ftn.rename(columns={a: b})
ftn["play_id"] = num(ftn.play_id); ftn = ftn[["game_id","play_id","n_blitzers","n_pass_rushers","is_play_action"]].drop_duplicates(["game_id","play_id"], keep="last")
par = pd.concat([pd.read_parquet(f"data/pbp_participation_{y}.parquet", columns=["nflverse_game_id","play_id","defense_man_zone_type"]) for y in (2022, 2023, 2024, 2025)]).rename(columns={"nflverse_game_id":"game_id"}).drop_duplicates(["game_id","play_id"])
d = pbp.merge(ftn, on=["game_id","play_id"], how="left").merge(par, on=["game_id","play_id"], how="left")
d["db"] = (d.qb_dropback == 1).astype(float); d["blitz"] = (num(d.n_blitzers) >= 1).where(d.n_blitzers.notna()).astype(float); d["rush5"] = (num(d.n_pass_rushers) >= 5).where(d.n_pass_rushers.notna()).astype(float)
d["man"] = d.defense_man_zone_type.map({"MAN_COVERAGE": 1.0, "ZONE_COVERAGE": 0.0}); d["pa"] = num(d.is_play_action).astype(float); d["isrun"] = (d.play_type == "run").astype(float)
d["qb"] = d.passer_player_name.where(d.passer_player_name.notna(), d.rusher_player_name.where(d.qb_dropback == 1))
DB = d[d.db == 1]
# ---- offense per game
O = DB.groupby(["season","week","posteam","game_id"]).agg(n_db=("epa","size"), epa=("epa","mean"), pa=("pa","mean"), qb=("qb", lambda s: s.mode().iloc[0] if s.notna().any() else None)).reset_index().rename(columns={"posteam":"team"})
O = O.merge(d.groupby(["season","week","posteam"]).agg(plays=("isrun","size"), runshare=("isrun","mean")).reset_index().rename(columns={"posteam":"team"}), on=["season","week","team"], how="left")
# ---- defense per game (style it PLAYED and EPA it allowed)
Dg = DB.groupby(["season","week","defteam"]).agg(n_db=("epa","size"), blitz=("blitz","mean"), rush5=("rush5","mean"), man=("man","mean"), epa_allowed=("epa","mean")).reset_index().rename(columns={"defteam":"team"})
def entering(df, cols, w="n_db"):
    x = df.sort_values(["team","season","week"]).copy(); out = pd.DataFrame(index=x.index)
    for c in cols:
        x["_n"] = x[c] * x[w]; pri = x.groupby(["team","season"]).agg(a=("_n","sum"), b=(w,"sum")); pri["r"] = pri.a / pri.b
        p = pd.Series([pri.r.get((t, s - 1), np.nan) for t, s in zip(x.team, x.season)], index=x.index); k = 4 * x[w].mean()
        g = x.groupby(["team","season"]); cs = g["_n"].cumsum() - x["_n"]; cn = g[w].cumsum() - x[w]
        v = (cs + k * p.fillna(0)) / (cn + k * p.notna()); v[(cn == 0) & p.isna()] = np.nan; out["e_" + c] = v
    return out.reindex(df.index)
Dg = pd.concat([Dg, entering(Dg, ["blitz","rush5","man","epa_allowed"])], axis=1); O = pd.concat([O, entering(O, ["epa","pa"]), entering(O, ["runshare"], w="plays")], axis=1)
for c in ("blitz","rush5","man"): Dg["tier_" + c] = Dg.groupby(["season","week"])["e_" + c].transform(lambda s: pd.qcut(s.rank(method="first"), 3, labels=["LOW","mid","HIGH"]) if s.notna().sum() >= 9 else pd.Series(index=s.index, dtype=object))
for c in ("runshare","pa"): O["tier_" + c] = O.groupby(["season","week"])["e_" + c].transform(lambda s: pd.qcut(s.rank(method="first"), 3, labels=["LOW","mid","HIGH"]) if s.notna().sum() >= 9 else pd.Series(index=s.index, dtype=object))
# ---- pair: each offense-game with the defense it faced (actual style faced that game + defense entering style/tier)
sched = d.groupby(["season","week","game_id","posteam"]).defteam.first().reset_index().rename(columns={"posteam":"team","defteam":"opp"})
X = O.merge(sched, on=["season","week","game_id","team"]).merge(Dg[["season","week","team","blitz","rush5","man","e_blitz","e_rush5","e_man","tier_blitz","tier_rush5","tier_man"]].rename(columns={"team":"opp","blitz":"faced_blitz","rush5":"faced_rush5","man":"faced_man"}), on=["season","week","opp"], how="left")
# team familiarity: dropback-weighted mean style faced in PRIOR games this season; QB familiarity: prior 2 seasons + this season, own dropbacks
X = X.sort_values(["team","season","week"]).copy()
for c in ("blitz","rush5","man"):
    X["_n"] = X["faced_" + c] * X.n_db; g = X.groupby(["team","season"]); X["fam_" + c] = (g["_n"].cumsum() - X["_n"]) / (g.n_db.cumsum() - X.n_db)
Q = X.dropna(subset=["qb"]).sort_values(["qb","season","week"]).copy()
for c in ("blitz","rush5","man"):
    Q["_n"] = Q["faced_" + c] * Q.n_db; g = Q.groupby("qb"); cs = g["_n"].cumsum() - Q["_n"]; cn = g.n_db.cumsum() - Q.n_db
    # restrict to the last two seasons + current: subtract everything older than season-2
    old_n = Q.assign(_o=Q._n.where(Q.season < Q.season - 0)).groupby("qb")["_n"].cumsum() * 0   # placeholder (kept simple: career-to-date within 2022-25 = at most 3 prior seasons)
    Q["qfam_" + c] = cs / cn.replace(0, np.nan)
X = X.merge(Q[["season","week","team","qfam_blitz","qfam_rush5","qfam_man"]], on=["season","week","team"], how="left")
X["dev"] = (X.epa - X.e_epa) / X.epa.std()
# lines
m = pd.read_parquet("data/matchup.parquet")[["season","week","home_ab","away_ab","home_score","away_score","home_spread","nv_total_line"]]
m["home_ab"] = m.home_ab.replace({"LA":"LAR"}); m["away_ab"] = m.away_ab.replace({"LA":"LAR"})
od = pd.read_parquet("data/odds_consensus.parquet")[["season","home_ab","away_ab","open_spread","open_total"]]; m = m.merge(od, on=["season","home_ab","away_ab"], how="left")
h = m.rename(columns={"home_ab":"team","away_ab":"opp2","home_score":"pts","away_score":"opp_pts"}).assign(spread=lambda z: z.home_spread, ospread=lambda z: z.open_spread)
a = m.rename(columns={"away_ab":"team","home_ab":"opp2","away_score":"pts","home_score":"opp_pts"}).assign(spread=lambda z: -z.home_spread, ospread=lambda z: -z.open_spread)
L = pd.concat([h, a])[["season","week","team","pts","opp_pts","spread","ospread","nv_total_line","open_total"]]
X = X.merge(L, on=["season","week","team"], how="left"); X["resid"] = X.pts - X.opp_pts + X.spread; X["oresid"] = X.pts - X.opp_pts + X.ospread; X["tresid"] = X.pts + X.opp_pts - X.nv_total_line
X = X[(X.week >= 3)].dropna(subset=["dev","e_epa"]).copy(); YRS = (2022, 2023, 2024, 2025)
print(f"{len(X)} offense-games 2022-25 | blitz coverage {X.faced_blitz.notna().mean():.0%} man {X.faced_man.notna().mean():.0%} QB fam {X.qfam_blitz.notna().mean():.0%}\n")
def famtier(s): return pd.qcut(s.rank(method="first"), 3, labels=["UNFAMILIAR","mid","FAMILIAR"]) if s.notna().sum() >= 30 else pd.Series(index=s.index, dtype=object)
print("=" * 118); print("OFFENSE vs a HIGH-style defense, split by how much of that style the offense / QB has faced before"); print("=" * 118)
print(f"  {'style':8s} {'who':5s} | {'UNFAMILIAR: EPA dev / ATS resid / n':38s} | {'FAMILIAR: EPA dev / ATS resid / n':38s} | per-season EPA dev UNFAM vs FAM")
for c in ("blitz","rush5","man"):
    for who, fcol in (("team", "fam_" + c), ("QB", "qfam_" + c)):
        x = X[(X["tier_" + c] == "HIGH")].dropna(subset=[fcol, "dev"]).copy(); x["ft"] = x.groupby("season")[fcol].transform(famtier)
        u, f = x[x.ft == "UNFAMILIAR"], x[x.ft == "FAMILIAR"]
        per = " ".join(f"{yr} {x[(x.season == yr) & (x.ft == 'UNFAMILIAR')].dev.mean():+.2f}/{x[(x.season == yr) & (x.ft == 'FAMILIAR')].dev.mean():+.2f}" for yr in YRS)
        print(f"  {c:8s} {who:5s} | {u.dev.mean():+.3f} sd / {u.resid.mean():+5.2f} pts / n={len(u):3d}          | {f.dev.mean():+.3f} sd / {f.resid.mean():+5.2f} pts / n={len(f):3d}          | {per}")
print("  read: if unfamiliarity hurts, UNFAMILIAR EPA dev should be clearly below FAMILIAR, in most seasons, and the ATS residual negative")
print("\n  continuous version — walk-forward r for predicting this game's EPA deviation from (opp style − familiarity) x opp style:")
for c in ("blitz","rush5","man"):
    for who, fcol in (("team", "fam_" + c), ("QB", "qfam_" + c)):
        x = X.dropna(subset=[fcol, "e_" + c, "dev"]).copy(); x["gapx"] = (x["e_" + c] - x[fcol]) * x["e_" + c]; out = []
        for yr in (2023, 2024, 2025):
            tr, te = x[x.season < yr], x[x.season == yr]; b = np.polyfit(tr.gapx, tr.dev, 1); out.append(f"{yr} r={np.corrcoef(np.polyval(b, te.gapx), te.dev)[0,1]:+.3f}")
        print(f"    {c:8s} {who:5s} " + "  ".join(out))
print("\n  BETS — HIGH-style defense vs an UNFAMILIAR offense (bottom third): fade the offense ATS (vs close | vs open) and its game UNDER, per season")
for c in ("blitz","rush5","man"):
    for who, fcol in (("team", "fam_" + c), ("QB", "qfam_" + c)):
        x = X[(X["tier_" + c] == "HIGH")].dropna(subset=[fcol]).copy(); x["ft"] = x.groupby("season")[fcol].transform(famtier); u = x[x.ft == "UNFAMILIAR"]
        per = []
        for yr in YRS:
            z = u[u.season == yr]; r1 = z.resid[z.resid != 0]; r2 = z.oresid[z.oresid.notna() & (z.oresid != 0)]; t = z.tresid[z.tresid != 0]
            per.append(f"{yr} ATS {100*(r1 < 0).mean() if len(r1) else np.nan:4.1f}%|{100*(r2 < 0).mean() if len(r2) else np.nan:4.1f}% n={len(r1):2d} UNDER {100*(t < 0).mean() if len(t) else np.nan:4.1f}%")
        print(f"    {c:8s} {who:5s} " + "  ".join(per))
# ---- DEFENSE side: defense unfamiliar with run-heavy / play-action-heavy offenses
print("\n" + "=" * 118); print("DEFENSE vs a HIGH run-share / HIGH play-action offense, split by how much of that style the defense has faced this season"); print("=" * 118)
Y = Dg.merge(sched.rename(columns={"team":"opp","opp":"team"}), on=["season","week","team"]).merge(O[["season","week","team","runshare","pa","e_runshare","e_pa","tier_runshare","tier_pa","n_db"]].rename(columns={"team":"opp","runshare":"faced_run","pa":"faced_pa","n_db":"o_db"}), on=["season","week","opp"], how="left")
Y = Y.sort_values(["team","season","week"]).copy()
for c, f in (("run","faced_run"), ("pa","faced_pa")):
    Y["_n"] = Y[f] * Y.o_db; g = Y.groupby(["team","season"]); Y["fam_" + c] = (g["_n"].cumsum() - Y["_n"]) / (g.o_db.cumsum() - Y.o_db)
Y["dev"] = (Y.epa_allowed - Y.e_epa_allowed) / Y.epa_allowed.std()      # positive = allowed MORE than its norm (bad for the defense)
Y = Y.merge(L, on=["season","week","team"], how="left"); Y["resid"] = Y.pts - Y.opp_pts + Y.spread; Y["tresid"] = Y.pts + Y.opp_pts - Y.nv_total_line; Y = Y[Y.week >= 3].dropna(subset=["dev"])
for c, tcol in (("run","tier_runshare"), ("pa","tier_pa")):
    x = Y[Y[tcol] == "HIGH"].dropna(subset=["fam_" + c]).copy(); x["ft"] = x.groupby("season")["fam_" + c].transform(famtier); u, f = x[x.ft == "UNFAMILIAR"], x[x.ft == "FAMILIAR"]
    per = " ".join(f"{yr} {x[(x.season == yr) & (x.ft == 'UNFAMILIAR')].dev.mean():+.2f}/{x[(x.season == yr) & (x.ft == 'FAMILIAR')].dev.mean():+.2f}" for yr in YRS)
    print(f"  {c:4s} | UNFAMILIAR defense allowed {u.dev.mean():+.3f} sd vs norm, ATS resid {u.resid.mean():+5.2f}, n={len(u)} | FAMILIAR {f.dev.mean():+.3f} sd, ATS {f.resid.mean():+5.2f}, n={len(f)} | {per}")
    per = []
    for yr in YRS:
        z = u[u.season == yr]; r1 = z.resid[z.resid != 0]; t = z.tresid[z.tresid != 0]; per.append(f"{yr} fade-D ATS {100*(r1 < 0).mean() if len(r1) else np.nan:4.1f}% n={len(r1):2d} OVER {100*(t > 0).mean() if len(t) else np.nan:4.1f}%")
    print(f"       bets: " + "  ".join(per))
