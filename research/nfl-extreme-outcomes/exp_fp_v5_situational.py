#!/usr/bin/env python3
"""v5 = v4 matchup model + SITUATIONAL family (owner mandate 2026-09-17):
referee scoring tendency (walk-forward), rest/bye/short-week, primetime, weather,
division. Tests whether the production-model context features add to the FP
matchup engine. Ablation: v4-only vs v4+situational, spreads AND totals."""
import numpy as np
import pandas as pd

src = open("exp_fp_v5_base.py").read()
exec(src)   # builds p (with FEATS), ridge helpers, base game frame `p`, DIFFS, etc.

# ---------- situational features from games_enriched ----------
ge = pd.read_parquet("data/games_enriched.parquet")
ge = ge[["game_id", "season", "week", "home_team", "away_team", "referee",
         "home_rest", "away_rest", "gametime", "weekday", "roof", "temp", "wind", "div_game"]].copy()

# referee scoring tendency: prior-seasons avg game total for that ref, vs league,
# strictly walk-forward (only games in seasons < current)
res = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv", low_memory=False)
res = res[(res.game_type == "REG") & res.result.notna()]
res["tot"] = res.home_score + res.away_score
ref_hist = res[["season", "referee", "tot"]].dropna(subset=["referee"])
rows = []
for ssn in range(2021, 2027):
    prior = ref_hist[ref_hist.season < ssn]
    lg = prior.tot.mean()
    r = prior.groupby("referee").tot.agg(["mean", "count"])
    r["ref_pts_oe"] = np.where(r["count"] >= 20, r["mean"] - lg, 0.0)   # shrink thin refs to 0
    for ref, row in r.iterrows():
        rows.append(dict(season=ssn, referee=ref, ref_pts_oe=row.ref_pts_oe))
reftab = pd.DataFrame(rows)
ge = ge.merge(reftab, on=["season", "referee"], how="left")
ge["ref_pts_oe"] = ge.ref_pts_oe.fillna(0.0)

# team-perspective situational (join to each team-game row in p)
def team_situ(df, is_home):
    d = df.copy()
    d["team"] = d.home_team if is_home else d.away_team
    d["s_rest"] = (d.home_rest - d.away_rest) if is_home else (d.away_rest - d.home_rest)
    d["s_off_bye"] = ((d.home_rest if is_home else d.away_rest) >= 10).astype(int)
    d["s_short_week"] = ((d.home_rest if is_home else d.away_rest) <= 4).astype(int)
    d["s_home"] = 1 if is_home else 0
    return d[["game_id", "team", "s_rest", "s_off_bye", "s_short_week", "s_home"]]

situ_team = pd.concat([team_situ(ge, True), team_situ(ge, False)])
# game-level (same for both sides)
def gm_time(t):
    try:
        h = int(str(t).split(":")[0]); return h
    except Exception:
        return 13
ge["hour"] = ge.gametime.map(gm_time)
ge["s_primetime"] = ((ge.hour >= 20) | (ge.weekday.isin(["Thursday", "Monday"]))).astype(int)
ge["s_dome"] = ge.roof.isin(["dome", "closed"]).astype(int)
ge["s_wind"] = pd.to_numeric(ge.wind, errors="coerce").fillna(0)
ge["s_cold"] = (pd.to_numeric(ge.temp, errors="coerce").fillna(60) <= 35).astype(int)
gm_situ = ge[["game_id", "ref_pts_oe", "s_primetime", "s_dome", "s_wind", "s_cold", "div_game"]]

p = p.merge(situ_team, on=["game_id", "team"], how="left")
p = p.merge(gm_situ, on="game_id", how="left")
SITU = ["ref_pts_oe", "s_rest", "s_off_bye", "s_short_week", "s_primetime",
        "s_dome", "s_wind", "s_cold", "div_game"]
for c in SITU:
    p[c] = pd.to_numeric(p[c], errors="coerce").fillna(0)


def evalmodel(feats, tag):
    pp = p.dropna(subset=["pts", "line", "total"]).copy()
    F = [c for c in feats if not pp[c].isna().all()]
    pp[F] = pp[F].fillna(pp[F].mean())
    preds = []
    for ssn in (2023, 2024, 2025):
        tr, te = pp[pp.season < ssn], pp[pp.season == ssn].copy()
        X = tr[F].values.astype(float); m, s = X.mean(0), X.std(0); s[s == 0] = 1
        w = rf((X - m) / s, tr.pts.values.astype(float))
        te["pred"] = np.hstack([(te[F].values.astype(float) - m) / s, np.ones((len(te), 1))]) @ w
        preds.append(te)
    pr2 = pd.concat(preds)
    own = pr2.set_index(["game_id", "team"]).pred
    pr2["pm"] = pr2.pred - own.reindex(pd.MultiIndex.from_arrays([pr2.game_id, pr2.opp])).values
    pr2["pt"] = pr2.pred + own.reindex(pd.MultiIndex.from_arrays([pr2.game_id, pr2.opp])).values
    gg = pr2.drop_duplicates("game_id").copy()
    act = g.set_index("game_id")
    gg["act_total"] = act.reindex(gg.game_id).home_score.values + act.reindex(gg.game_id).away_score.values
    gg["e_sp"] = gg.pm - (-gg.line); gg["e_tot"] = gg.pt - gg.total
    out = f"{tag:26s}"
    for mkt, ecol, win_fn in (("SP", "e_sp", None), ("TOT", "e_tot", None)):
        for thr in (2, 3):
            m2 = gg[ecol].abs() >= thr
            if mkt == "SP":
                pick = gg[ecol] >= thr
                w2 = np.where(pick, (gg.margin + gg.line) > 0, (gg.margin + gg.line) < 0)
                ok = m2 & ((gg.margin + gg.line) != 0)
            else:
                pick = gg[ecol] >= thr
                w2 = np.where(pick, gg.act_total > gg.total, gg.act_total < gg.total)
                ok = m2 & (gg.act_total != gg.total)
            out += f" | {mkt}{thr} {100*w2[ok].mean():.1f}%({ok.sum()})"
    print(out)


print("ABLATION (walk-forward 2023-25, wk1+):")
V4 = [c for c in FEATS]
evalmodel(V4, "v4 matchup only")
evalmodel(V4 + SITU, "v4 + situational")
evalmodel(V4 + ["ref_pts_oe"], "v4 + referee only")
evalmodel(V4 + ["s_rest", "s_off_bye", "s_short_week", "s_primetime"], "v4 + rest/primetime only")
evalmodel(V4 + ["s_wind", "s_cold", "s_dome"], "v4 + weather only")
