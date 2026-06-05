"""
ARCHETYPE ASSIGNMENT ENGINE (as-of / walk-forward). Tags every team-game on 6 offense + 5 defense axes,
each tied to a real metric. Tags are terciles vs the POOLED cross-season distribution (a structural
reference; uses no game outcomes). Team-level (model_games adj_* as-of) axes + QB-mobility & run/pass
identity built season-to-date (prior weeks, prior-season fallback) from player_usage + qb_starts.

Exports build_archetypes() -> per-(season,game_id) frame with home_* and away_* archetype tags, for the
matchup-mixture analysis. Run directly to print example team assignments for a completed season (sanity).
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DC = os.path.join(HERE, "data", "cfbd")


def _asof_player_metrics():
    """Season-to-date (prior weeks) QB rush ypg + team run/pass identity, per (season, week, team)."""
    pu = pd.read_parquet(os.path.join(DC, "player_usage.parquet"))
    pu = pu[pu.season_type == "regular"]
    qb = pd.read_parquet(os.path.join(DC, "qb_starts.parquet")).sort_values(["team", "season", "week"])
    # established starter as-of = QB with most cumulative att in PRIOR weeks
    qb["cum_att"] = qb.groupby(["team", "season"]).att.cumsum() - qb.att
    start = qb.sort_values("cum_att").drop_duplicates(["season", "week", "team"], keep="last")[["season", "week", "team", "qb"]]
    # team totals per game. NOTE: `tar` (targets) is unreliable/zero in this source -> use `rec`
    # (receptions) as the pass-volume proxy: rush_share = carries / (carries + receptions).
    tg = pu.groupby(["season", "week", "team"]).agg(car=("car", "sum"), rec=("rec", "sum"),
                                                    rush_yds=("rush_yds", "sum")).reset_index()
    tg = tg.sort_values(["team", "season", "week"])
    g = tg.groupby(["team", "season"], group_keys=False)
    for c in ["car", "rec", "rush_yds"]:
        tg[f"cum_{c}"] = g[c].cumsum() - tg[c]          # prior weeks only
    tg["gp"] = g.cumcount()
    tg["rush_share"] = tg.cum_car / (tg.cum_car + tg.cum_rec)
    # QB rush as-of: join starter, sum that player's prior-week rush
    pum = pu.merge(start, on=["season", "week", "team"], how="inner")
    pum = pum[pum.player == pum.qb]
    qg = pum.groupby(["season", "week", "team"]).agg(qb_rush=("rush_yds", "sum"), qb_car=("car", "sum")).reset_index()
    qg = qg.sort_values(["team", "season", "week"])
    gg = qg.groupby(["team", "season"], group_keys=False)
    qg["cum_qb_rush"] = gg.qb_rush.cumsum() - qg.qb_rush
    qg["cum_qb_gp"] = gg.cumcount()
    qg["qb_rush_ypg"] = qg.cum_qb_rush / qg.cum_qb_gp.replace(0, np.nan)
    out = tg.merge(qg[["season", "week", "team", "qb_rush_ypg"]], on=["season", "week", "team"], how="left")
    return out[["season", "week", "team", "rush_share", "qb_rush_ypg", "gp"]]


def _tag(s, lo_lab, mid_lab, hi_lab, invert=False):
    s = pd.to_numeric(s, errors="coerce")
    q1, q2 = s.quantile(1/3), s.quantile(2/3)
    t = pd.Series(mid_lab, index=s.index, dtype=object)
    t[s <= q1] = (hi_lab if invert else lo_lab)
    t[s >= q2] = (lo_lab if invert else hi_lab)
    t[s.isna()] = "?"
    return t


def build_archetypes():
    gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
    gm = gm[gm.season >= 2021].copy()
    pm = _asof_player_metrics()
    # melt to per-team-game (each game -> home row + away row) carrying that team's OWN off/def metrics
    def side(df, who):
        opp = "away" if who == "home" else "home"
        cols = {f"{who}Team": "team", f"{who}Conference": "conf"}
        r = df[["season", "week", "game_id", f"{who}Team", f"{who}Conference"]].rename(columns=cols)
        for base in ["adj_line_yards", "adj_standard_down_success", "adj_explosiveness", "adj_success",
                     "adj_pass_explosiveness", "adj_passing_epa", "adj_rushing_epa", "pace_off_plays",
                     "def_havoc_f7", "adj_line_yards_allowed", "adj_passing_epa_allowed",
                     "adj_pass_explosiveness_allowed", "def_havoc_db", "adj_rushing_epa_allowed",
                     "def_havoc", "adj_explosiveness_allowed"]:
            r[base] = pd.to_numeric(df.get(f"{who}_{base}"), errors="coerce")
        r["who"] = who
        return r
    tg = pd.concat([side(gm, "home"), side(gm, "away")], ignore_index=True)
    tg = tg.merge(pm, on=["season", "week", "team"], how="left")
    # ---- OFFENSE tags ----
    tg["A_OL"] = _tag(tg.adj_line_yards, "Poor-OL", "Avg-OL", "Elite-OL")
    expl = _tag(tg.adj_explosiveness, "lo", "mid", "hi"); succ = _tag(tg.adj_success, "lo", "mid", "hi")
    tg["A_style"] = np.where((expl == "hi") & (succ != "hi"), "Explosive",
                     np.where((succ == "hi") & (expl != "hi"), "Methodical", "Balanced"))
    pe = _tag(tg.adj_pass_explosiveness, "lo", "mid", "hi"); pepa = _tag(tg.adj_passing_epa, "lo", "mid", "hi")
    tg["A_pass"] = np.where((pe != "lo") & (pepa != "lo") & ((pe == "hi") | (pepa == "hi")), "Vertical-WR",
                    np.where((pe == "lo") | (pepa == "lo"), "Weak-pass", "Avg-pass"))
    tg["A_identity"] = _tag(tg.rush_share, "Pass-heavy", "Balanced", "Run-heavy")
    tg["A_QB"] = _tag(tg.qb_rush_ypg, "Pocket-QB", "Mobile-QB", "Dual-threat")
    tg["A_tempo"] = _tag(tg.pace_off_plays, "Slow", "Avg-tempo", "Up-tempo")
    # ---- DEFENSE tags (invert where low metric = better) ----
    tg["D_front7"] = _tag(tg.def_havoc_f7, "Weak-front", "Avg-front", "Dominant-front")
    sec = (_tag(tg.adj_passing_epa_allowed, "lo", "mid", "hi", invert=True).map({"lo":0,"mid":1,"hi":2}).fillna(1)
           + _tag(tg.adj_pass_explosiveness_allowed, "lo", "mid", "hi", invert=True).map({"lo":0,"mid":1,"hi":2}).fillna(1))
    tg["D_secondary"] = pd.cut(sec, [-1,1,2,5], labels=["Weak-secondary","Avg-secondary","Lockdown-secondary"]).astype(object)
    rund = (_tag(tg.adj_rushing_epa_allowed,"lo","mid","hi",invert=True).map({"lo":0,"mid":1,"hi":2}).fillna(1)
           + _tag(tg.adj_line_yards_allowed,"lo","mid","hi",invert=True).map({"lo":0,"mid":1,"hi":2}).fillna(1))
    tg["D_run"] = pd.cut(rund, [-1,1,2,5], labels=["Soft-runD","Avg-runD","Stout-runD"]).astype(object)
    tg["D_aggression"] = _tag(tg.def_havoc, "Passive-D", "Balanced-D", "Blitz-D")
    tg["D_bigplay"] = _tag(tg.adj_explosiveness_allowed, "BendDontBreak", "Avg-prev", "Leaky", invert=False)
    AX = ["A_OL","A_style","A_pass","A_identity","A_QB","A_tempo","D_front7","D_secondary","D_run","D_aggression","D_bigplay"]
    # pivot back to per-game home_* / away_*
    h = tg[tg.who=="home"][["season","game_id"]+AX].rename(columns={a:f"home_{a}" for a in AX})
    a = tg[tg.who=="away"][["season","game_id"]+AX].rename(columns={a:f"away_{a}" for a in AX})
    out = gm[["season","week","game_id","homeTeam","awayTeam","spread_close","total_close","actual_margin","actual_total"]].merge(h,on=["season","game_id"]).merge(a,on=["season","game_id"])
    return out, tg, AX


if __name__ == "__main__":
    out, tg, AX = build_archetypes()
    print(f"team-games tagged: {len(tg)} | games: {len(out)}")
    # season-end dominant (modal) archetype per team, 2024 sanity check
    yr = 2024; t = tg[(tg.season==yr) & (tg.gp>=6)]
    mode = t.groupby("team")[AX].agg(lambda x: x.mode().iat[0] if len(x.mode()) else "?")
    print(f"\n=== {yr} dominant archetypes (sanity check known identities) ===")
    for team in ["Iowa","Air Force","Army","Ohio State","Oregon","Georgia Tech","Kansas","Alabama","Washington State"]:
        if team in mode.index:
            r = mode.loc[team]
            print(f"  {team:<16} OFF[{r.A_identity}/{r.A_OL}/{r.A_style}/{r.A_pass}/{r.A_QB}/{r.A_tempo}]")
            print(f"  {'':<16} DEF[{r.D_front7}/{r.D_secondary}/{r.D_run}/{r.D_aggression}/{r.D_bigplay}]")
