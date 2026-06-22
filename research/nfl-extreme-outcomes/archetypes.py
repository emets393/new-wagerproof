"""
Team STYLE archetypes via k-means (2022-2025, FTN-complete). Standardized to capture HOW a team
plays, not how good. Two independent clusterings: offensive style, defensive style.
Validates week/season stability; assigns per-game archetype pairings; saves matchup_arch.parquet.
"""
import os
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
m = pd.read_parquet(os.path.join(DATA, "matchup.parquet"))
L = print

OFF_STYLE = ["off_proe_s2d", "off_no_huddle_rate_s2d", "off_plays_per_game_s2d",
             "off_motion_rate_s2d", "off_pa_rate_s2d", "off_shotgun_rate_s2d",
             "off_screen_rate_s2d", "off_rpo_rate_s2d", "off_intended_ay_s2d"]
DEF_STYLE = ["def_pressure_rate_s2d", "def_blitz_rate_s2d", "def_dib_s2d"]


def stack_team_week(side_feats, prefix):
    """Build one row per (season,week,team) of style features from the game-level view."""
    rows = []
    for venue, ab in [("home", "home_ab"), ("away", "away_ab")]:
        cols = {f"{venue}_{f}": f for f in side_feats}
        sub = m[["season", "week", ab] + list(cols)].rename(columns={ab: "ab", **cols})
        rows.append(sub)
    tw = pd.concat(rows, ignore_index=True)
    return tw


def fit_style(tw, feats, name):
    d = tw.dropna(subset=feats).copy()
    d = d[d["season"] >= 2022]
    X = StandardScaler().fit_transform(d[feats])
    L(f"\n=== {name} STYLE clustering (n team-weeks={len(d)}, feats={len(feats)}) ===")
    best = None
    for k in range(3, 7):
        km = KMeans(n_clusters=k, n_init=10, random_state=0).fit(X)
        sil = silhouette_score(X, km.labels_, sample_size=4000, random_state=0)
        L(f"  k={k}: silhouette={sil:.3f}")
        if best is None or sil > best[1]:
            best = (k, sil, km)
    k, sil, km = best
    L(f"  -> chosen k={k} (silhouette={sil:.3f})")
    d["cluster"] = km.labels_
    # profile: mean of each feature per cluster (original units) + size
    prof = d.groupby("cluster")[feats].mean()
    prof["n"] = d.groupby("cluster").size()
    L(f"\n  {name} cluster profiles (original units):")
    with pd.option_context("display.width", 220, "display.max_columns", None):
        L(prof.round(3).to_string())
    return d, km, feats


def assign(tw_all, km, feats):
    d = tw_all.dropna(subset=feats).copy()
    from sklearn.preprocessing import StandardScaler
    # refit scaler on 2022+ to match training space
    base = d[d["season"] >= 2022]
    sc = StandardScaler().fit(base[feats])
    d["cluster"] = km.predict(sc.transform(d[feats]))
    return d[["season", "week", "ab", "cluster"]]


# ---- Offensive style ----
otw = stack_team_week(OFF_STYLE, "off")
od, okm, ofeats = fit_style(otw, OFF_STYLE, "OFFENSE")
off_assign = assign(otw, okm, ofeats).rename(columns={"cluster": "off_arch"})

# ---- Defensive style ----
dtw = stack_team_week(DEF_STYLE, "def")
dd, dkm, dfeats = fit_style(dtw, DEF_STYLE, "DEFENSE")
def_assign = assign(dtw, dkm, dfeats).rename(columns={"cluster": "def_arch"})

# ---- STABILITY: how often does a team's weekly archetype match its season modal? ----
def stability(assign_df, col, name):
    a = assign_df.dropna(subset=[col])
    modal = a.groupby(["season", "ab"])[col].agg(lambda s: s.mode().iloc[0]).rename("modal")
    a = a.merge(modal, on=["season", "ab"])
    wk_match = (a[col] == a["modal"]).mean()
    # season-to-season persistence of modal
    md = modal.reset_index().sort_values(["ab", "season"])
    md["prev"] = md.groupby("ab")["modal"].shift(1)
    ss_match = (md["modal"] == md["prev"]).mean()
    L(f"  [{name}] week->season-modal match={wk_match*100:.1f}% ; season->next-season modal persistence={ss_match*100:.1f}%")

L("\n=== STABILITY ===")
stability(off_assign, "off_arch", "OFF")
stability(def_assign, "def_arch", "DEF")

# ---- assign per-game pairings ----
g = m.copy()
g = g.merge(off_assign.rename(columns={"ab": "home_ab", "off_arch": "home_off_arch"}),
            on=["season", "week", "home_ab"], how="left")
g = g.merge(off_assign.rename(columns={"ab": "away_ab", "off_arch": "away_off_arch"}),
            on=["season", "week", "away_ab"], how="left")
g = g.merge(def_assign.rename(columns={"ab": "home_ab", "def_arch": "home_def_arch"}),
            on=["season", "week", "home_ab"], how="left")
g = g.merge(def_assign.rename(columns={"ab": "away_ab", "def_arch": "away_def_arch"}),
            on=["season", "week", "away_ab"], how="left")
# pairing keys: home offense vs away defense, away offense vs home defense
g["pair_hoff_adef"] = g["home_off_arch"].astype("Int64").astype(str) + "v" + g["away_def_arch"].astype("Int64").astype(str)
g["pair_aoff_hdef"] = g["away_off_arch"].astype("Int64").astype(str) + "v" + g["home_def_arch"].astype("Int64").astype(str)
g.to_parquet(os.path.join(DATA, "matchup_arch.parquet"), index=False)
cov = g[(g["season"] >= 2022)]["home_off_arch"].notna().mean()
L(f"\n[saved] matchup_arch: {g.shape}; archetype coverage 2022+ = {cov*100:.1f}%")
