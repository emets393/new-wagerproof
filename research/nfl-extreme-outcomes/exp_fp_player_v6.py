#!/usr/bin/env python3
"""v6 — PLAYER-ANCHORED model (owner mandate 2026-09-17): replace the team-level
passing composite with the ACTUAL STARTING QB's individual profile (keyed to
player_id, carried across teams/seasons), so injuries/QB changes change the
prediction. Starter = first passer of the game (handles start-then-hurt).
Tests vs team-composite baseline, overall and in QB-situation games."""
import numpy as np
import pandas as pd

AB_NV = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU"}


def num(s):
    return pd.to_numeric(s, errors="coerce")


# ---- per-QB entering-game profile (player_id level, prior-season carry) ----
qb = pd.read_parquet("data/fpdata/player_passing-advanced.parquet")
qb["db"] = num(qb.playerStatsPassingDropbacksTotal)
qb = qb[qb.db >= 10].copy()
QIN = {"cpoe": ("playerStatsPassingCompletionsOverExpected", 1),
       "acc": ("playerStatsPassingThrowAccuracyHighlyAccuratePercentage", 1),
       "offtgt": ("playerStatsPassingOffTargetThrowAttemptsPercentage", -1),
       "sack": ("playerStatsPassingSackedPercentage", -1),
       "adot": ("playerStatsPassingAverageDepthOfTarget", 1),
       "deep": ("playerStatsPassingDeepThrowAttemptsPercentage", 1),
       "hero": ("playerStatsPassingHeroThrowPercentage", 1),
       "ypa": ("playerStatsPassingYardsPerAttempt", 1)}
for k, (c, sg) in QIN.items():
    qb[k] = num(qb[c]) * sg
# z within season
for k in QIN:
    qb[k + "_z"] = qb.groupby("__season")[k].transform(lambda s: (s - s.mean()) / s.std())
qb["qb_quality_game"] = qb[["cpoe_z", "acc_z", "offtgt_z", "sack_z", "ypa_z"]].mean(axis=1)
qb["qb_aggr_game"] = qb[["adot_z", "deep_z", "hero_z"]].mean(axis=1)
qb = qb.sort_values(["playerPlayerId", "__season", "__week"])
# prior-season mean per player, then seed entering-game blend
pri = qb.groupby(["playerPlayerId", "__season"])[["qb_quality_game", "qb_aggr_game"]].mean().reset_index()
pri["nxt"] = pri.__season + 1
qb = qb.merge(pri.rename(columns={"qb_quality_game": "q_pr", "qb_aggr_game": "a_pr"})[
    ["playerPlayerId", "nxt", "q_pr", "a_pr"]], left_on=["playerPlayerId", "__season"],
    right_on=["playerPlayerId", "nxt"], how="left")
for src, pr, K in (("qb_quality", "q_pr", 4), ("qb_aggr", "a_pr", 4)):
    grp = qb.groupby(["playerPlayerId", "__season"])[src + "_game"]
    csum = grp.transform(lambda x: x.shift(1).expanding().sum())
    cnt = grp.transform(lambda x: x.shift(1).expanding().count()).fillna(0)
    prc = qb[pr]
    qb[src] = (prc.fillna(0) * K + csum.fillna(0)) / (K + cnt)
    qb.loc[prc.isna() & (cnt == 0), src] = 0.0
qbprof = qb[["playerPlayerId", "__season", "__week", "teamAbbreviation", "qb_quality", "qb_aggr", "db"]]

# ---- game STARTER (first passer) from full pbp, per team-game ----
import glob, pyarrow.parquet as pq
starters = []
for yr in range(2021, 2027):
    fp = f"data/pbp_cache/pbp_{yr}.parquet"
    if not glob.glob(fp):
        fp = "data/pbp_cache/_pbp2026.parquet" if yr == 2026 else None
    if not fp or not glob.glob(fp):
        continue
    have = pq.ParquetFile(fp).schema_arrow.names
    cols = [c for c in ["season", "week", "posteam", "passer_player_id", "passer_player_name", "pass", "play_id"] if c in have]
    d = pd.read_parquet(fp, columns=cols)
    idc = "passer_player_id" if "passer_player_id" in d.columns else "passer_player_name"
    d = d[(d["pass"] == 1) & d[idc].notna()].sort_values("play_id")
    s = d.groupby(["season", "week", "posteam"]).agg(starter_name=("passer_player_name", "first")).reset_index()
    if "season" not in d.columns:
        s["season"] = yr
    starters.append(s)
st = pd.concat(starters)
print(f"game starters (first-passer): {len(st)} team-games")

# map starter NAME -> qb profile (FP uses first initial + last, pbp uses same 'S.Darnold' style?)
# FP has playerFirstName/Last; build 'F.Last' key to match pbp passer_player_name
qb["nm"] = qb.playerFirstName.str[0] + "." + qb.playerLastName
name2id = qb.dropna(subset=["nm"]).groupby(["nm", "__season"]).playerPlayerId.first().reset_index()
st = st.merge(name2id, left_on=["starter_name", "season"], right_on=["nm", "__season"], how="left")

# ---- game rows + attach STARTER'S qb profile as the offense QB rating ----
g = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv", low_memory=False)
g = g[(g.game_type == "REG") & g.result.notna() & g.spread_line.notna() & g.total_line.notna()
      & (g.season >= 2021) & (g.season <= 2025)]
rows = []
for _, r in g.iterrows():
    for team, opp, home in ((r.home_team, r.away_team, 1), (r.away_team, r.home_team, 0)):
        rows.append(dict(season=r.season, week=r.week, game_id=r.game_id, team=team, opp=opp, home=home,
                         pts=r.home_score if home else r.away_score, margin=r.result if home else -r.result,
                         line=-r.spread_line if home else r.spread_line, total=r.total_line))
p = pd.DataFrame(rows)
p["mkt_pts"] = p.total / 2 - p.line / 2
# starter qb profile: join st (starter id) -> qbprof (that qb's entering-game rating)
st2 = st.merge(qbprof[["playerPlayerId", "__season", "__week", "qb_quality", "qb_aggr"]],
               left_on=["playerPlayerId", "season", "week"],
               right_on=["playerPlayerId", "__season", "__week"], how="left")
st2 = st2[["season", "week", "posteam", "qb_quality", "qb_aggr", "playerPlayerId"]].rename(columns={"posteam": "team"})
p = p.merge(st2, on=["season", "week", "team"], how="left")
p = p.merge(st2.rename(columns={"team": "opp", "qb_quality": "o_qb_quality", "qb_aggr": "o_qb_aggr",
                                "playerPlayerId": "o_pid"}), on=["season", "week", "opp"], how="left")

# ---- team run/recv composites + opp defense (from composites_v2) ----
comp = pd.read_parquet("data/fpdata/composites_v2.parquet")
comp["ab_nv"] = comp.ab.map(lambda a: AB_NV.get(a, a))
USE = ["c_runblock", "c_rb_power", "c_recv_playmaking", "c_rz_usage", "c_passpro",
       "c_passrush", "c_runfront", "c_cov_disruption", "c_scheme_man", "c_scheme_twohigh"]
p = p.merge(comp[["ab_nv", "__season", "__week"] + USE],
            left_on=["team", "season", "week"], right_on=["ab_nv", "__season", "__week"], how="left")
p = p.merge(comp[["ab_nv", "__season", "__week"] + USE].add_prefix("O_"),
            left_on=["opp", "season", "week"], right_on=["O_ab_nv", "O___season", "O___week"], how="left")
p["d_trench_pass"] = p.c_passpro - p.O_c_passrush
p["d_trench_run"] = p.c_runblock - p.O_c_runfront
p["d_recv_cov"] = p.c_recv_playmaking - p.O_c_cov_disruption

FEATS_TEAM = ["line", "total", "mkt_pts", "home", "week", "d_trench_pass", "d_trench_run",
              "d_recv_cov", "c_rb_power", "c_rz_usage", "O_c_scheme_twohigh"]
FEATS_QB = FEATS_TEAM + ["qb_quality", "qb_aggr", "o_qb_quality"]   # + starting-QB anchor
p = p[p.week >= 4].copy()
for c in set(FEATS_QB):
    p[c] = num(p[c])
p_qb = p.dropna(subset=["pts", "line", "qb_quality"]).copy()   # need starter profile
for F, tag in ((FEATS_TEAM, "TEAM composite baseline"), (FEATS_QB, "PLAYER-anchored (starting QB)")):
    pp = p_qb.copy()
    Fv = [c for c in F if not pp[c].isna().all()]
    pp[Fv] = pp[Fv].fillna(pp[Fv].mean()).fillna(0.0)
    preds = []
    for ssn in (2023, 2024, 2025):
        tr, te = pp[pp.season < ssn], pp[pp.season == ssn].copy()
        Fk = [c for c in Fv if tr[c].std() > 1e-9]   # drop zero-variance in this fold
        X = tr[Fk].values.astype(float); m, s = X.mean(0), X.std(0); s[s == 0] = 1
        Xb = np.hstack([(X - m) / s, np.ones((len(X), 1))]); A = Xb.T @ Xb + 50 * np.eye(Xb.shape[1]); A[-1, -1] -= 50
        w = np.linalg.lstsq(A, Xb.T @ tr.pts.values.astype(float), rcond=None)[0]
        te["pred"] = np.hstack([(te[Fk].values.astype(float) - m) / s, np.ones((len(te), 1))]) @ w
        preds.append(te)
    pr = pd.concat(preds)
    own = pr.set_index(["game_id", "team"]).pred
    pr["pm"] = pr.pred - own.reindex(pd.MultiIndex.from_arrays([pr.game_id, pr.opp])).values
    gg = pr.drop_duplicates("game_id").copy()
    gg["e"] = gg.pm - (-gg.line)
    # grade
    fl = pd.read_parquet("data/fpdata/_qb_situation_flags.parquet")[["season", "week", "posteam", "qb_situation"]]
    gg = gg.merge(fl.rename(columns={"posteam": "team", "qb_situation": "qbs"}), on=["season", "week", "team"], how="left")
    print(f"\n== {tag} ==")
    for lab, sub in (("ALL", gg), ("QB-situation games", gg[gg.qbs == True])):
        for thr in (2, 3):
            m = sub.e.abs() >= thr; pk = sub.e >= thr; ok = m & ((sub.margin + sub.line) != 0)
            w2 = np.where(pk, (sub.margin + sub.line) > 0, (sub.margin + sub.line) < 0)
            if ok.sum() >= 12:
                print(f"  {lab:20s} SP{thr}: {100*w2[ok].mean():.1f}% (n={ok.sum()})")
