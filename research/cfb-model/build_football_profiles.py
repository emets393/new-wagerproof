"""Phase 1 of the football port of the CBB archetype system (see research/bball-odds/BBALL_SIGNALS.md).
Build 3 leak-safe, within-season TEAM PROFILE groups (offense / defense / trenches) from the prior-only
as-of features already in model_games.parquet, cluster each into ~4-6 types on within-(season,week)
percentiles, verify within-season TYPE STABILITY, and emit named type cards + a reusable team-game table
(cfb_team_games_profiled.parquet) carrying both teams' profiles + spread/total outcomes for Phases 2-3.

Guardrails honored: prior-only within-season (week-1 has no profile), percentiles ranked within the
(season,week) cross-section (every team has ~equal prior sample at a given week), types are STRUCTURE
(cards/scouting), continuous percentile extremity is the conviction dial used later, not hard splits."""
import numpy as np, pandas as pd, warnings
from sklearn.cluster import KMeans
warnings.filterwarnings("ignore")

g = pd.read_parquet("data/model_games.parquet")

# ── feature groups (all prior-only as-of in model_games; <side>_ prefix) ──
# offense identity: tempo, run/pass lean, explosiveness, deep-ball, efficiency, finishing
OFF = {
    "o_sec_per_play": lambda s, d: g[f"{s}_poss_secs_pg"] / g[f"{s}_plays_pg"],   # low = up-tempo
    "o_pass_rate":    lambda s, d: g[f"{s}_pass_rate"],
    "o_epa":          lambda s, d: g[f"{s}_adj_epa"],
    "o_success":      lambda s, d: g[f"{s}_adj_success"],
    "o_explosive":    lambda s, d: g[f"{s}_adj_explosiveness"],
    "o_pass_explos":  lambda s, d: g[f"{s}_adj_pass_explosiveness"],              # deep-ball proxy
    "o_run_pass_gap": lambda s, d: g[f"{s}_adj_rushing_epa"] - g[f"{s}_adj_passing_epa"],  # + = run-leaning
    "o_finish_ppo":   lambda s, d: g[f"{s}_off_ppo"],
}
# defense identity: havoc/pressure (front vs back), what it limits (run vs pass), explosive allowed
DEF = {
    "d_havoc":        lambda s, d: g[f"{s}_def_havoc"],
    "d_havoc_f7":     lambda s, d: g[f"{s}_def_havoc_f7"],
    "d_havoc_db":     lambda s, d: g[f"{s}_def_havoc_db"],
    "d_epa_allowed":  lambda s, d: g[f"{s}_adj_epa_allowed"],                     # low = good D
    "d_rush_epa_all": lambda s, d: g[f"{s}_adj_rushing_epa_allowed"],
    "d_pass_epa_all": lambda s, d: g[f"{s}_adj_passing_epa_allowed"],
    "d_line_yds_all": lambda s, d: g[f"{s}_adj_line_yards_allowed"],             # low = run-stuffing
    "d_explos_all":   lambda s, d: g[f"{s}_adj_explosiveness_allowed"],
}
# trenches/physical: OL run-block + pass-pro, DL run-stuff + pressure, roster talent
TRENCH = {
    "t_ol_run_block": lambda s, d: g[f"{s}_adj_line_yards"],                      # high = OL run block
    "t_ol_2nd_level": lambda s, d: g[f"{s}_adj_second_level_yards"],
    "t_ol_open_field":lambda s, d: g[f"{s}_adj_open_field_yards"],
    "t_ol_pass_pro":  lambda s, d: -g[f"{s}_off_havoc"],                          # low havoc allowed = good pass pro
    "t_dl_run_stuff": lambda s, d: -g[f"{s}_adj_line_yards_allowed"],            # high = DL stuffs run
    "t_dl_pressure":  lambda s, d: g[f"{s}_def_havoc_f7"],
    "t_talent":       lambda s, d: g[f"{s}_talent"],
}
GROUPS = {"OFF": OFF, "DEF": DEF, "TRENCH": TRENCH}

# ── explode to one row per team-game, carrying that team's prior-only raw features + outcomes ──
def explode(side):
    o, d = (("home", "away") if side == "home" else ("away", "home"))
    df = pd.DataFrame({
        "game_id": g.game_id, "season": g.season, "week": g.week,
        "team": g[f"{o}Team"], "opponent": g[f"{d}Team"],
        "is_home": 1 if side == "home" else 0, "neutral": g.neutralSite.astype(int),
        "conf": g[f"{o}Conference"], "opp_conf": g[f"{d}Conference"],
    })
    for grp in GROUPS.values():
        for name, fn in grp.items():
            df[name] = fn(o, d).values
    # outcomes from THIS team's perspective
    team_spread = np.where(side == "home", g.spread_close, -g.spread_close)      # neg = team favored
    team_margin = np.where(side == "home", g.actual_margin, -g.actual_margin)
    df["team_spread"] = team_spread
    df["team_margin"] = team_margin
    df["ats_margin"] = team_margin + team_spread                                  # >0 = team covered
    df["covered"] = np.where(df.ats_margin == 0, np.nan, (df.ats_margin > 0).astype(float))
    df["total_close"] = g.total_close.values
    df["actual_total"] = g.actual_total.values
    df["over"] = np.where(g.actual_total == g.total_close, np.nan, (g.actual_total > g.total_close).astype(float)).astype(float)
    return df

tg = pd.concat([explode("home"), explode("away")], ignore_index=True)
# profile requires priors: drop rows with no as-of offense (week 1)
prof_cols = [c for grp in GROUPS.values() for c in grp]
tg = tg.dropna(subset=["o_epa", "d_epa_allowed", "t_ol_run_block"]).reset_index(drop=True)

# ── within-(season,week) percentiles: leak-safe, comparable (equal prior sample at a given week) ──
for c in prof_cols:
    tg[c + "_pct"] = tg.groupby(["season", "week"])[c].rank(pct=True)
pct_cols = [c + "_pct" for c in prof_cols]
tg[pct_cols] = tg[pct_cols].fillna(0.5)

# ── cluster each group into types on the percentile vectors (fit once; percentiles already season-normalized) ──
KS = {"OFF": 5, "DEF": 5, "TRENCH": 4}
np.random.seed(0)
type_cards = {}
for grp, feats in GROUPS.items():
    cols = [f + "_pct" for f in feats]
    km = KMeans(n_clusters=KS[grp], n_init=10, random_state=0).fit(tg[cols])
    tg[grp + "_type"] = km.labels_
    # centroid card (mean percentile per feature) — for naming
    cent = pd.DataFrame(km.cluster_centers_, columns=list(feats.keys()))
    type_cards[grp] = cent

# ── name types by their centroid extremes (interpretable card) ──
def card_label(grp, row):
    hi = row.sort_values(ascending=False).head(2).index.tolist()
    lo = row.sort_values().head(2).index.tolist()
    return f"hi[{','.join(hi)}] lo[{','.join(lo)}]"

print("=" * 90)
print("PHASE 1 — CFB TEAM PROFILE TYPES (centroid percentiles; leak-safe within-season)")
print("=" * 90)
for grp in GROUPS:
    print(f"\n### {grp} types (k={KS[grp]}) — share of team-games + centroid signature")
    cent = type_cards[grp]
    shares = tg[grp + "_type"].value_counts(normalize=True).sort_index()
    for t in range(KS[grp]):
        row = cent.loc[t]
        n = (tg[grp + "_type"] == t).sum()
        # example teams: most common team-seasons in this type at end of season
        ex = (tg[tg[grp + "_type"] == t].groupby(["season", "team"]).size().sort_values(ascending=False)
              .head(4).index.map(lambda x: f"{x[1]}{str(x[0])[2:]}").tolist())
        print(f"  T{t} ({shares.get(t,0)*100:4.1f}%, n={n:5d}): {card_label(grp, row)}")
        print(f"        e.g. {', '.join(ex)}")

# ── STABILITY: within a team-season, how often is the type at midseason == type at end? ──
print("\n" + "=" * 90)
print("WITHIN-SEASON TYPE STABILITY (CBB benchmark was 80-84%)")
print("=" * 90)
for grp in GROUPS:
    col = grp + "_type"
    rows = []
    for (ssn, team), sub in tg.groupby(["season", "team"]):
        sub = sub.sort_values("week")
        if len(sub) < 4:
            continue
        mid = sub.iloc[len(sub) // 2][col]
        end = sub.iloc[-1][col]
        modal = sub[col].mode().iloc[0]
        rows.append({"mid_eq_end": int(mid == end),
                     "modal_share": (sub[col] == modal).mean()})
    r = pd.DataFrame(rows)
    print(f"  {grp:7s}: mid==end {r.mid_eq_end.mean()*100:4.1f}%  |  mean modal-type share across weeks {r.modal_share.mean()*100:4.1f}%  (n_team_seasons={len(r)})")

# attach opponent DEF type + actual offensive ppa — needed by the S-CFB1 style-delta signal (cfb_style_delta.py)
import glob as _glob
_opp = tg[["game_id", "team", "DEF_type"]].rename(columns={"team": "opponent", "DEF_type": "opp_DEF"})
tg = tg.merge(_opp, on=["game_id", "opponent"], how="left")
_ga = pd.concat([pd.read_parquet(f) for f in _glob.glob("data/cfbd/game_advanced_20*.parquet")], ignore_index=True).rename(columns={"gameId": "game_id"})
_ga = _ga[["game_id", "team", "offense.ppa"]].rename(columns={"offense.ppa": "off_ppa"})
tg = tg.merge(_ga, on=["game_id", "team"], how="left")

tg.to_parquet("data/cfb_team_games_profiled.parquet", index=False)
print(f"\nwrote data/cfb_team_games_profiled.parquet  rows={len(tg)}  seasons={sorted(tg.season.unique())}  (with opp_DEF + off_ppa)")
