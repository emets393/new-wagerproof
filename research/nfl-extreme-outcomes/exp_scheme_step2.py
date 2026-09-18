#!/usr/bin/env python3
"""SCHEME PIPELINE — STEP 2: production conditional on the PREDICTED scheme (owner 2026-09-17).

Per-play frame 2022-25 (pbp + participation coverage + FTN blitz/box). Scheme dimensions:
  dropbacks: shell (two-high vs single-high), man vs zone, blitz vs none
  runs:      box (8+ vs lighter)
For every team-game, entering-week (K=4 games, prior-season seeded, never the game itself):
  offense: EPA/play overall and in each scheme level      defense: EPA/play ALLOWED, same
  scheme SHARES expected this week = identity + b x what the opponent pulls  (step 1 method)
Prediction for offense O vs defense D:
  baseline  B = O_all + D_all - league                       (identity only, no scheme)
  adjust    A = sum over dims, levels: share_s x [(O_s - O_all) + (D_s - D_all)]
The scheme-specific part is a DEVIATION from each side's own level, so situational selection
(a defense plays man on 3rd-and-long) cannot leak in as a level effect.
Tests, all walk-forward on 2023-25:
  T1  does B+A explain actual EPA/play better than B?          (information beyond identity)
  T2  team points model from [pass pred, rush pred, volume]; does (pred - market) explain
      (actual - market)?  Market = nflverse close, and the OPENER where we have it (2023-25).
      Nothing in the model saw a line, so a positive T2 is information the market lacks.
"""
import glob, numpy as np, pandas as pd
num = lambda s: pd.to_numeric(s, errors="coerce"); K = 4.0
COLS = ["game_id", "play_id", "season", "week", "posteam", "defteam", "home_team", "qb_dropback", "qb_scramble", "rush", "pass",
        "epa", "season_type", "posteam_score_post", "defteam_score_post", "home_score", "away_score"]
pbp = pd.concat([pd.read_parquet(f, columns=COLS) for f in ["data/pbp_cache/_dl_2022.parquet"] + sorted(glob.glob("data/pbp_cache/pbp_202[345].parquet"))], ignore_index=True)
pbp = pbp[(pbp.season_type == "REG") & pbp.posteam.notna() & pbp.epa.notna()]
ftn = pd.concat([pd.read_parquet("data/ftn_charting.parquet"), pd.read_parquet("data/ftn_charting_2025.parquet")], ignore_index=True)
for a, b in (("nflverse_game_id", "game_id"), ("nflverse_play_id", "play_id")):
    if b in ftn.columns and a in ftn.columns: ftn[b] = ftn[b].fillna(ftn[a]); ftn = ftn.drop(columns=a)
    elif a in ftn.columns: ftn = ftn.rename(columns={a: b})
ftn["play_id"] = num(ftn.play_id); ftn = ftn[["game_id", "play_id", "n_blitzers", "n_defense_box"]].drop_duplicates(["game_id", "play_id"], keep="last")
par = pd.concat([pd.read_parquet(f"data/pbp_participation_{y}.parquet", columns=["nflverse_game_id", "play_id", "defenders_in_box", "defense_man_zone_type", "defense_coverage_type"]) for y in (2022, 2023, 2024, 2025)], ignore_index=True)
par = par.rename(columns={"nflverse_game_id": "game_id"}).drop_duplicates(["game_id", "play_id"])
d = pbp.merge(ftn, on=["game_id", "play_id"], how="left").merge(par, on=["game_id", "play_id"], how="left")
d["box"] = num(d.n_defense_box).fillna(num(d.defenders_in_box))
db = d[d.qb_dropback == 1].copy()
db["shell"] = np.where(db.defense_coverage_type.isin(["COVER_2", "COVER_4", "COVER_6", "2_MAN"]), "two", np.where(db.defense_coverage_type.isin(["COVER_0", "COVER_1", "COVER_3", "COVER_9"]), "one", None))
db["mz"] = db.defense_man_zone_type.map({"MAN_COVERAGE": "man", "ZONE_COVERAGE": "zone"})
db["bl"] = np.where(db.n_blitzers.isna(), None, np.where(num(db.n_blitzers) >= 1, "blitz", "noblitz"))
ru = d[(d.rush == 1) & (d.qb_scramble != 1) & d.box.notna()].copy(); ru["bx"] = np.where(ru.box >= 8, "heavy", "light")
DIMS = {"shell": ("two", "one"), "mz": ("man", "zone"), "bl": ("blitz", "noblitz")}

def agg(frame, dim, levels, side):
    key = ["season", "week", "game_id", side]; out = frame.groupby(key).agg(all_epa=("epa", "sum"), all_n=("epa", "size")).reset_index()
    for lv in levels:
        x = frame[frame[dim] == lv].groupby(key).agg(**{f"{lv}_epa": ("epa", "sum"), f"{lv}_n": ("epa", "size")}).reset_index()
        out = out.merge(x, on=key, how="left")
    return out.fillna(0).rename(columns={side: "team"})

def entering_rate(df, cols_epa_n, kplays):
    """entering EPA/play = (prior games' sum this season + K_plays * prior-season rate) / (prior n + K_plays)."""
    df = df.sort_values(["team", "season", "week"]).copy(); out = {}
    for (e, n), kp in zip(cols_epa_n, kplays):
        pri = df.groupby(["team", "season"]).agg(pe=(e, "sum"), pn=(n, "sum")); pri["pr"] = pri.pe / pri.pn.replace(0, np.nan)
        p = pd.Series([pri.pr.get((t, s - 1), np.nan) for t, s in zip(df.team, df.season)], index=df.index)
        g = df.groupby(["team", "season"]); cs = g[e].cumsum() - df[e]; cn = g[n].cumsum() - df[n]
        v = (cs + kp * p.fillna(0)) / (cn + kp * p.notna()); v[(cn == 0) & p.isna()] = np.nan
        out[e.replace("_epa", "")] = v
    return pd.DataFrame(out, index=df.index).reindex(df.index)

def entering_share(df, col):
    dd = df.sort_values(["team", "season", "week"]); pri = dd.groupby(["team", "season"])[col].mean()
    p = pd.Series([pri.get((t, s - 1), np.nan) for t, s in zip(dd.team, dd.season)], index=dd.index)
    g = dd.groupby(["team", "season"])[col]; cs = g.transform(lambda x: x.shift(1).expanding().sum()).fillna(0); cn = g.transform(lambda x: x.shift(1).expanding().count()).fillna(0)
    v = (p.fillna(0) * K + cs) / (K + cn); v[p.isna() & (cn == 0)] = np.nan; return v.reindex(df.index)

# ---------------- per team-game entering rates, offense and defense, every dim
LG = {}; OFF = None; DEF = None
for dim, levels in list(DIMS.items()) + [("bx", ("heavy", "light"))]:
    frame = ru if dim == "bx" else db
    for side, tag in (("posteam", "O"), ("defteam", "D")):
        a = agg(frame, dim, levels, side)
        kp = [4 * a.all_n.mean()] + [4 * a[f"{lv}_n"].mean() for lv in levels]
        r = entering_rate(a, [("all_epa", "all_n")] + [(f"{lv}_epa", f"{lv}_n") for lv in levels], kp)
        r.columns = [f"{tag}_{dim}_{c}" for c in r.columns]
        a = pd.concat([a[["season", "week", "game_id", "team"]], r], axis=1)
        # scheme share this game (for the share model) — on the OFFENSE side it is what it FACED, on defense what it PLAYED
        fr = frame.groupby(["season", "week", "game_id", side])[dim].apply(lambda s: 100 * (s == levels[0]).mean()).rename(f"{tag}_{dim}_share").reset_index().rename(columns={side: "team"})
        a = a.merge(fr, on=["season", "week", "game_id", "team"], how="left")
        if tag == "O": OFF = a if OFF is None else OFF.merge(a, on=["season", "week", "game_id", "team"], how="outer")
        else: DEF = a if DEF is None else DEF.merge(a, on=["season", "week", "game_id", "team"], how="outer")
    LG[dim] = {lv: frame[frame[dim] == lv].epa.mean() for lv in levels}; LG[dim]["all"] = frame.epa.mean()
# expected share this week (step-1 method): defense identity + b x offense's pull (residual), walk-forward b
for dim, levels in list(DIMS.items()) + [("bx", ("heavy", "light"))]:
    DEF[f"D_{dim}_id"] = entering_share(DEF, f"D_{dim}_share"); DEF[f"D_{dim}_dev"] = DEF[f"D_{dim}_share"] - DEF[f"D_{dim}_id"]
# offense's pull = mean over its prior games of (defense share played − that defense's identity)
G = OFF.merge(DEF.rename(columns={c: c for c in DEF.columns}), on=["season", "week", "game_id"], suffixes=("", "_d"))
G = G[G.team != G.team_d].rename(columns={"team": "off", "team_d": "def"})
for dim in list(DIMS) + ["bx"]:
    G["team"] = G.off; G[f"O_{dim}_inv"] = entering_share(G, f"D_{dim}_dev"); G = G.drop(columns="team")
# actual production this game (target)
act_p = db.groupby(["game_id", "posteam"]).agg(pass_epa=("epa", "mean"), n_db=("epa", "size")).reset_index().rename(columns={"posteam": "off"})
act_r = ru.groupby(["game_id", "posteam"]).agg(rush_epa=("epa", "mean"), n_ru=("epa", "size")).reset_index().rename(columns={"posteam": "off"})
G = G.merge(act_p, on=["game_id", "off"], how="left").merge(act_r, on=["game_id", "off"], how="left")
pts = pbp.groupby(["game_id", "posteam"]).apply(lambda g: g.home_score.iloc[0] if g.posteam.iloc[0] == g.home_team.iloc[0] else g.away_score.iloc[0]).rename("pts").reset_index().rename(columns={"posteam": "off"})
G = G.merge(pts, on=["game_id", "off"], how="left")

# ---------------- predictions, walk-forward
TEST = (2023, 2024, 2025)
def build(G):
    G = G.copy()
    for dim, levels in list(DIMS.items()) + [("bx", ("heavy", "light"))]:
        lv0, lv1 = levels
        # expected share of lv0 this week: identity + b x pull, b fit on prior seasons
        G[f"{dim}_shr"] = np.nan
        for ssn in TEST:
            tr = G[(G.season < ssn)].dropna(subset=[f"D_{dim}_dev", f"O_{dim}_inv"])
            b = np.polyfit(tr[f"O_{dim}_inv"], tr[f"D_{dim}_dev"], 1)[0] if len(tr) > 200 else 0.0
            m = G.season == ssn; G.loc[m, f"{dim}_shr"] = (G.loc[m, f"D_{dim}_id"] + b * G.loc[m, f"O_{dim}_inv"].fillna(0)).clip(0, 100) / 100
        s0 = G[f"{dim}_shr"]; s1 = 1 - s0
        G[f"{dim}_adj"] = s0 * ((G[f"O_{dim}_{lv0}"] - G[f"O_{dim}_all"]) + (G[f"D_{dim}_{lv0}"] - G[f"D_{dim}_all"])) + \
                          s1 * ((G[f"O_{dim}_{lv1}"] - G[f"O_{dim}_all"]) + (G[f"D_{dim}_{lv1}"] - G[f"D_{dim}_all"]))
    G["pass_B"] = G.O_shell_all + G.D_shell_all - LG["shell"]["all"]
    G["pass_A"] = G[["shell_adj", "mz_adj", "bl_adj"]].sum(axis=1)
    G["rush_B"] = G.O_bx_all + G.D_bx_all - LG["bx"]["all"]; G["rush_A"] = G.bx_adj
    return G
P = build(G); T = P[P.season.isin(TEST)].dropna(subset=["pass_B", "pass_A", "pass_epa", "rush_B", "rush_A", "rush_epa"])
print("=" * 100); print(f"STEP 2 — T1: does scheme conditioning add information beyond identity?  (walk-forward 2023-25, n={len(T)} team-games)"); print("=" * 100)
def cor(a, b): return np.corrcoef(a, b)[0, 1]
for mk, B, A, y in (("PASS EPA/dropback", "pass_B", "pass_A", "pass_epa"), ("RUSH EPA/carry", "rush_B", "rush_A", "rush_epa")):
    r0 = cor(T[B], T[y]); r1 = cor(T[B] + T[A], T[y]); ra = cor(T[A], T[y] - T[B]); t = ra * np.sqrt(len(T) - 2) / np.sqrt(1 - ra ** 2)
    print(f"  {mk:18s} corr(identity, actual) {r0:+.3f} | corr(identity + scheme adj, actual) {r1:+.3f} | corr(adj, residual) {ra:+.3f}  t={t:+.1f}")
    for ssn in TEST:
        x = T[T.season == ssn]; print(f"      {ssn}: identity {cor(x[B], x[y]):+.3f}  +scheme {cor(x[B] + x[A], x[y]):+.3f}  adj-vs-residual {cor(x[A], x[y] - x[B]):+.3f}")
for dim in ("shell", "mz", "bl"):
    ra = cor(T[f"{dim}_adj"], T.pass_epa - T.pass_B); print(f"      dim {dim:6s} alone: corr(adj, residual) {ra:+.3f}   sd of adj {T[f'{dim}_adj'].std():.3f} EPA/db")
print(f"      dim bx     alone: corr(adj, residual) {cor(T.bx_adj, T.rush_epa - T.rush_B):+.3f}   sd of adj {T.bx_adj.std():.3f} EPA/carry")

# ---------------- T2: points vs market
print("\n" + "=" * 100); print("STEP 2 — T2: team points.  (pred − market) vs (actual − market).  Model never saw a line."); print("=" * 100)
g = pd.read_parquet("data/games_enriched.parquet")[["game_id", "home_team", "away_team", "spread_line", "total_line"]]
P = P.merge(g, on="game_id", how="left"); P["is_home"] = (P.off == P.home_team).astype(int)
P["mkt_pts"] = P.total_line / 2 + np.where(P.is_home == 1, P.spread_line, -P.spread_line) / 2
O = pd.read_parquet("data/odds_consensus.parquet")[["season", "home_ab", "away_ab", "open_spread", "open_total"]]
P = P.merge(O, left_on=["season", "home_team", "away_team"], right_on=["season", "home_ab", "away_ab"], how="left")
P["open_pts"] = P.open_total / 2 + np.where(P.is_home == 1, -P.open_spread, P.open_spread) / 2
# volume entering: dropbacks and rushes per game
V = pd.concat([db.groupby(["season", "week", "game_id", "posteam"]).size().rename("v_db"), ru.groupby(["season", "week", "game_id", "posteam"]).size().rename("v_ru")], axis=1).reset_index().rename(columns={"posteam": "team"})
V["v_db_e"] = entering_share(V, "v_db"); V["v_ru_e"] = entering_share(V, "v_ru")
P = P.merge(V[["game_id", "team", "v_db_e", "v_ru_e"]].rename(columns={"team": "off"}), on=["game_id", "off"], how="left")
def ridge(X, y, lam=5.0):
    Xb = np.hstack([X, np.ones((len(X), 1))]); A = Xb.T @ Xb + lam * np.eye(Xb.shape[1]); A[-1, -1] -= lam; return np.linalg.lstsq(A, Xb.T @ y, rcond=None)[0]
for lab, feats in (("identity only", ["pass_B", "rush_B", "v_db_e", "v_ru_e", "is_home"]), ("identity + scheme", ["pass_B", "pass_A", "rush_B", "rush_A", "v_db_e", "v_ru_e", "is_home"])):
    rows = []
    for ssn in TEST:
        tr = P[(P.season < ssn) & (P.season >= 2022)].dropna(subset=feats + ["pts"]); te = P[P.season == ssn].dropna(subset=feats + ["pts"]).copy()
        X = tr[feats].values.astype(float); m, s = X.mean(0), X.std(0); s[s == 0] = 1; w = ridge((X - m) / s, tr.pts.values.astype(float))
        te["pred"] = np.hstack([(te[feats].values.astype(float) - m) / s, np.ones((len(te), 1))]) @ w; rows.append(te)
    R = pd.concat(rows); rc = R.dropna(subset=["mkt_pts"]); ro = R.dropna(subset=["open_pts"])
    print(f"  {lab:18s} corr(pred, actual pts) {cor(R.pred, R.pts):+.3f} | vs CLOSE: corr(pred−mkt, actual−mkt) {cor(rc.pred - rc.mkt_pts, rc.pts - rc.mkt_pts):+.3f} (n={len(rc)})"
          f" | vs OPEN: {cor(ro.pred - ro.open_pts, ro.pts - ro.open_pts):+.3f} (n={len(ro)})   market alone corr {cor(rc.mkt_pts, rc.pts):+.3f}")
    R.to_parquet(f"data/fpdata/_scheme_step2_{lab.split()[0]}{'_scheme' if 'scheme' in lab else ''}.parquet", index=False)
