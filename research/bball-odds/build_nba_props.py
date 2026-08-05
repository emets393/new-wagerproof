#!/usr/bin/env python3
"""Leak-safe NBA player-prop panel: one row per (event_id, market, player).

The team markets are exhausted — no algorithm in the zoo beat the closing line's MAE in
any of the 13 market x framing cells. Player props are a different animal for two
structural reasons that the raw feed makes measurable:

  1. ONE snapshot per prop, at ~T-64 min. That is exactly the house T-60 closing line,
     so there is no prop steam to chase — but it also means every book's number is a
     genuine pre-tip price we could have bet.
  2. 12 books, median 5 per prop, and 45% of props carry a cross-book line range of a
     FULL POINT or more. The team-market consensus is razor sharp; the prop market
     openly disagrees with itself. That disagreement is the thing to model.

So the panel keeps BOTH views:
  - CONSENSUS  median line + no-vig probability = the market's fair value
  - BEST       the most favourable line/price available on each side, and which book

Grading rule (memory: nfl-backtest-grading-framework): whichever line a signal USES is
the line it gets GRADED against. So the panel carries the result vs the consensus line
and vs each best line separately, and never mixes them.

Player history comes from bdl_player_box (182k player-games) via strict date < gamedate
expanding/rolling means. Nothing here may see the game it is predicting.
"""
import os
import re
import unicodedata

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

# Absence stems resolved from the team feature store into own-team / opponent.
# FRESH vs STALE vs RET is the distinction that made S8 hold up: a freshly-ruled-out
# teammate is news the prop line may not have absorbed, a long-term absence is already
# in every season average, and a RETURNING teammate takes usage back. Carrying all
# three lets the model separate them instead of collapsing them into "someone is out".
ABS_STEMS = ("fresh_max_ppg", "fresh_sum_ppg", "fresh_n", "fresh_max_min",
             "fresh_sum_min", "stale_n", "stale_sum_ppg", "stale_sum_min",
             "ret_n", "ret_sum_ppg", "ret_sum_min",
             "top1_out", "big_out", "guard_out", "n_regulars")

# market -> the box-score expression it settles on
MARKET_STAT = {
    "player_points": ("pts",),
    "player_rebounds": ("reb",),
    "player_assists": ("ast",),
    "player_threes": ("fg3m",),
    "player_blocks": ("blk",),
    "player_steals": ("stl",),
    "player_points_rebounds": ("pts", "reb"),
    "player_points_assists": ("pts", "ast"),
    "player_rebounds_assists": ("reb", "ast"),
    "player_points_rebounds_assists": ("pts", "reb", "ast"),
}


def norm_name(s):
    """Fold accents/punctuation/suffixes so Odds-API names match balldontlie names."""
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    s = s.lower().replace(".", "").replace("'", "").replace("-", " ")
    s = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b", "", s)
    return re.sub(r"\s+", " ", s).strip()


def american_to_dec(a):
    a = pd.to_numeric(a, errors="coerce")
    return np.where(a >= 0, 1 + a / 100.0, 1 + 100.0 / np.abs(a))


# --------------------------------------------------------------------------- book view
def book_view():
    """Per-prop consensus + best-price view from the per-book T-60 snapshot."""
    frames = []
    for f in sorted(os.listdir(OUT)):
        if f.startswith("props_nba_") and f.endswith(".parquet"):
            frames.append(pd.read_parquet(os.path.join(OUT, f)))
    p = pd.concat(frames, ignore_index=True)
    p["snap"] = pd.to_datetime(p["snap_ts"], utc=True)
    p["ct"] = pd.to_datetime(p["commence_time"], utc=True)
    # T-60 policy: only prices a bettor still had an hour to act on
    p = p[(p["ct"] - p["snap"]).dt.total_seconds() / 60 >= 60].copy()
    p["over_dec"] = american_to_dec(p["over_price"])
    p["under_dec"] = american_to_dec(p["under_price"])
    p = p[p["over_dec"].notna() & p["under_dec"].notna() & p["line_point"].notna()]
    p["pkey"] = p["player"].map(norm_name)

    # MAIN-LINE SELECTION. betrivers/unibet/mybookie/betonline bundle a full ALTERNATE
    # ladder under the same market key (Luka points 34.5 -> 44.5 at one book), which
    # would poison both the consensus median and any "best line" search. The main line
    # is the rung with the most balanced two-way price; on the alt ladder the prices
    # fan out symmetrically around it, so this recovers exactly the standard number.
    bk = ["event_id", "market", "pkey", "book"]
    p["_bal"] = (p["over_dec"] - p["under_dec"]).abs()
    p = (p.sort_values(bk + ["_bal"]).groupby(bk, sort=False).head(1)
         .drop(columns=["_bal"]))

    k = ["event_id", "market", "pkey"]
    # Consensus prices are medianed in DECIMAL space — American odds are discontinuous
    # at +/-100, so a median of American numbers is meaningless (memory: bball research).
    g = p.groupby(k)
    C = g.agg(
        cons_line=("line_point", "median"),
        cons_over_dec=("over_dec", "median"),
        cons_under_dec=("under_dec", "median"),
        n_books=("book", "nunique"),
        line_sd=("line_point", "std"),
        line_min=("line_point", "min"),
        line_max=("line_point", "max"),
    ).reset_index()
    C["line_range"] = C["line_max"] - C["line_min"]

    # BEST OVER = lowest line; ties broken by best price. BEST UNDER = highest line.
    po = p.sort_values(["line_point", "over_dec"], ascending=[True, False])
    bo = po.groupby(k).head(1).set_index(k)[["line_point", "over_dec", "book"]]
    bo.columns = ["best_over_line", "best_over_dec", "best_over_book"]
    pu = p.sort_values(["line_point", "under_dec"], ascending=[False, False])
    bu = pu.groupby(k).head(1).set_index(k)[["line_point", "under_dec", "book"]]
    bu.columns = ["best_under_line", "best_under_dec", "best_under_book"]

    C = C.merge(bo.reset_index(), on=k, how="left").merge(bu.reset_index(), on=k, how="left")
    # how far the best side sits from where the market as a whole is
    C["over_edge_pts"] = C["cons_line"] - C["best_over_line"]
    C["under_edge_pts"] = C["best_under_line"] - C["cons_line"]
    return C


# ------------------------------------------------------------------------ player log
def player_log():
    b = pd.read_parquet(f"{OUT}/bdl_player_box.parquet")
    b = b.rename(columns={"player.id": "pid", "game.date": "date", "game.season": "season",
                          "team.id": "tid", "game.home_team_id": "hid",
                          "game.visitor_team_id": "vid"})
    b["date"] = pd.to_datetime(b["date"])
    b["pkey"] = (b["player.first_name"].astype(str) + " "
                 + b["player.last_name"].astype(str)).map(norm_name)
    # 'min' arrives as "37" or "37:24" depending on season
    m = b["min"].astype(str).str.split(":", expand=True)
    b["mins"] = pd.to_numeric(m[0], errors="coerce").fillna(0)
    if m.shape[1] > 1:
        b["mins"] += pd.to_numeric(m[1], errors="coerce").fillna(0) / 60.0
    for c in ("pts", "reb", "ast", "fg3m", "blk", "stl", "fga", "fta", "fg3a", "turnover"):
        b[c] = pd.to_numeric(b[c], errors="coerce").fillna(0)
    b["pra"] = b["pts"] + b["reb"] + b["ast"]
    b["pr"] = b["pts"] + b["reb"]
    b["pa"] = b["pts"] + b["ast"]
    b["ra"] = b["reb"] + b["ast"]
    # crude usage proxy — shot attempts + trips to the line + turnovers per minute
    b["use"] = (b["fga"] + 0.44 * b["fta"] + b["turnover"])
    b["is_home"] = (b["tid"] == b["hid"]).astype(float)
    keep = ["pid", "pkey", "date", "season", "tid", "mins", "pts", "reb", "ast", "fg3m",
            "blk", "stl", "fga", "fta", "fg3a", "turnover", "pra", "pr", "pa", "ra",
            "use", "is_home"]
    b = b[keep].dropna(subset=["date"]).sort_values(["pkey", "date"])
    return b.drop_duplicates(["pkey", "date"], keep="first").reset_index(drop=True)


STATS = ["mins", "pts", "reb", "ast", "fg3m", "blk", "stl", "pra", "pr", "pa", "ra",
         "use", "fga", "fg3a"]


def asof_features(b):
    """Everything strictly from games BEFORE the row's own date."""
    g = b.groupby("pkey", sort=False)
    # is_home is a property of the scheduled game, known long before tip — legal here,
    # and it is what lets the panel resolve h_abs_*/a_abs_* into own-team vs opponent.
    F = b[["pkey", "date", "season", "tid", "is_home"]].copy()
    F["gp_prior"] = g.cumcount()
    prev = g["date"].shift(1)
    F["rest_days"] = (b["date"] - prev).dt.days
    F["b2b"] = (F["rest_days"] <= 1).astype(float)

    for s in STATS:
        sh = g[s].shift(1)
        by = sh.groupby(b["pkey"], sort=False)
        F[f"{s}_exp"] = by.expanding().mean().reset_index(level=0, drop=True)
        F[f"{s}_l3"] = by.rolling(3, min_periods=2).mean().reset_index(level=0, drop=True)
        F[f"{s}_l5"] = by.rolling(5, min_periods=3).mean().reset_index(level=0, drop=True)
        F[f"{s}_l10"] = by.rolling(10, min_periods=5).mean().reset_index(level=0, drop=True)
        if s in ("mins", "pts", "reb", "ast", "pra", "fg3m"):
            F[f"{s}_sd5"] = by.rolling(5, min_periods=3).std().reset_index(level=0, drop=True)
            F[f"{s}_sd10"] = by.rolling(10, min_periods=5).std().reset_index(level=0, drop=True)
            # form vs baseline: is he hot or cold relative to his own season?
            F[f"{s}_trend"] = F[f"{s}_l3"] - F[f"{s}_exp"]

    # per-minute rates: the honest way to project a stat when minutes are moving
    for s in ("pts", "reb", "ast", "fg3m", "blk", "stl", "pra", "pr", "pa", "ra", "use"):
        F[f"{s}_pm_exp"] = F[f"{s}_exp"] / F["mins_exp"].replace(0, np.nan)
        F[f"{s}_pm_l5"] = F[f"{s}_l5"] / F["mins_l5"].replace(0, np.nan)
        # naive projection = recent rate x recent minutes
        F[f"{s}_proj"] = F[f"{s}_pm_l5"] * F["mins_l5"]
    return F


def main():
    print("book view...", flush=True)
    C = book_view()
    print(f"  {len(C):,} prop rows with a T-60 book view", flush=True)

    print("player log...", flush=True)
    b = player_log()
    F = asof_features(b)
    L = pd.concat([b[["pkey", "date"]], F.drop(columns=["pkey", "date"])], axis=1)

    print("graded panel...", flush=True)
    P = pd.read_parquet(f"{OUT}/props_graded.parquet")
    P["pkey"] = P["player"].map(norm_name)
    P["date"] = pd.to_datetime(P["date_et"])
    P = P[P["market"].isin(MARKET_STAT)].copy()
    # props_graded carries its own (contaminated) line/price/n_books — drop them so the
    # main-line book view is the single source and nothing gets an _x/_y suffix.
    P = P.drop(columns=[c for c in ("line", "over_dec", "under_dec", "n_books")
                        if c in P.columns])

    D = P.merge(C, on=["event_id", "market", "pkey"], how="inner")
    print(f"  {len(D):,} rows after book-view join", flush=True)

    # attach player history by (pkey, actual game date). bdl dates are game-day UTC-ish;
    # props date_et is Eastern, so allow a +/-1 day tolerance via merge_asof on date.
    D = D.sort_values("date")
    L = L.sort_values("date")
    D = pd.merge_asof(D, L, on="date", by="pkey", direction="nearest",
                      tolerance=pd.Timedelta(days=1))
    print(f"  history matched on {D['gp_prior'].notna().mean():.1%} of rows", flush=True)

    # ---- team context + absence, joined by event_id from the team feature store
    try:
        T = pd.read_parquet(f"{OUT}/nba_model_features.parquet")
        want = ["event_id", "t60_total_point", "t60_spread_home_point",
                "sum_s_pace", "d_s_pace"]
        for side in ("h", "a"):
            for stem in ABS_STEMS:
                want.append(f"{side}_abs_{stem}")
        tc = [c for c in want if c in T.columns]
        D = D.merge(T[tc].drop_duplicates("event_id"), on="event_id", how="left")
        print(f"  team context on {D['t60_total_point'].notna().mean():.1%} of rows", flush=True)
    except Exception as e:                                              # noqa: BLE001
        print(f"  !! team context skipped: {type(e).__name__} {e}", flush=True)

    # ---- USAGE VACUUM. S8 showed the NBA market prices team POINTS correctly but gets
    # the half-split wrong when a rotation player is freshly out. A prop line is the
    # same kind of derivative: when a teammate sits, the minutes and shots have to go
    # somewhere, and a per-player number posted off season averages is slow to move.
    # Resolve the h_/a_ absence pair into own-team vs opponent from is_home.
    ih = D["is_home"]
    for stem in ABS_STEMS:
        h, a = f"h_abs_{stem}", f"a_abs_{stem}"
        if h in D.columns and a in D.columns:
            D[f"own_{stem}"] = np.where(ih == 1, D[h], D[a])
            D[f"opp_{stem}"] = np.where(ih == 1, D[a], D[h])
    # spread from the player's own side: large negative = his team is a big favourite,
    # which is the garbage-time risk that caps a star's minutes.
    if "t60_spread_home_point" in D.columns:
        D["own_spread"] = np.where(ih == 1, D["t60_spread_home_point"],
                                   -D["t60_spread_home_point"])
        D["blowout_risk"] = D["own_spread"].abs()
    D["player_is_home"] = ih
    if "own_fresh_sum_ppg" in D.columns:
        print(f"  usage-vacuum on {D['own_fresh_sum_ppg'].notna().mean():.1%} of rows",
              flush=True)

    # ---- market-implied probability, de-vigged in decimal space
    for tag in ("cons",):
        io, iu = 1 / D[f"{tag}_over_dec"], 1 / D[f"{tag}_under_dec"]
        D[f"{tag}_p_over"] = io / (io + iu)
        D[f"{tag}_hold"] = io + iu - 1

    # ---- targets. graded 'actual' is the settled stat; re-grade against each line.
    D["resid_cons"] = D["actual"] - D["cons_line"]
    D["y_cons"] = np.where(D["resid_cons"] > 0, 1.0,
                           np.where(D["resid_cons"] < 0, 0.0, np.nan))
    # Every y_* is an OVER-wins indicator at its own line, so grading code can flip a
    # single way (win = y if over else 1-y) without ever double-inverting.
    D["y_best_over"] = np.where(D["actual"] > D["best_over_line"], 1.0,
                                np.where(D["actual"] < D["best_over_line"], 0.0, np.nan))
    D["y_best_under"] = np.where(D["actual"] > D["best_under_line"], 1.0,
                                 np.where(D["actual"] < D["best_under_line"], 0.0, np.nan))

    # line vs the player's own recent form — the single most informative prop feature
    for s in ("exp", "l3", "l5", "l10", "proj"):
        for stat in ("pts", "reb", "ast", "fg3m", "pra", "pr", "pa", "ra", "blk", "stl"):
            col = f"{stat}_{s}"
            if col not in D.columns:
                continue
    D["form_ref"] = np.nan
    D["proj_ref"] = np.nan
    for mk, parts in MARKET_STAT.items():
        m = D["market"] == mk
        if not m.any():
            continue
        key = {("pts",): "pts", ("reb",): "reb", ("ast",): "ast", ("fg3m",): "fg3m",
               ("blk",): "blk", ("stl",): "stl", ("pts", "reb"): "pr",
               ("pts", "ast"): "pa", ("reb", "ast"): "ra",
               ("pts", "reb", "ast"): "pra"}[parts]
        D.loc[m, "form_ref"] = D.loc[m, f"{key}_l5"]
        D.loc[m, "form_exp"] = D.loc[m, f"{key}_exp"]
        D.loc[m, "form_l10"] = D.loc[m, f"{key}_l10"]
        D.loc[m, "form_sd"] = D.loc[m, f"{key}_sd5"] if f"{key}_sd5" in D else np.nan
        D.loc[m, "proj_ref"] = D.loc[m, f"{key}_proj"] if f"{key}_proj" in D else np.nan
    D["line_vs_form"] = D["cons_line"] - D["form_ref"]
    D["line_vs_exp"] = D["cons_line"] - D["form_exp"]
    D["line_vs_proj"] = D["cons_line"] - D["proj_ref"]
    # scale-free versions so a 2-point gap on a 30-pt line isn't equated with one on 4.5
    D["line_vs_form_z"] = D["line_vs_form"] / D["form_sd"].replace(0, np.nan)
    D["line_vs_form_r"] = D["line_vs_form"] / D["cons_line"].replace(0, np.nan)

    # player's own recent record against his posted lines (prior props only)
    D = D.sort_values("date")
    pm = D.groupby(["pkey", "market"], sort=False)["y_cons"]
    D["hit_rate_prior"] = (pm.shift(1).groupby([D["pkey"], D["market"]])
                           .rolling(10, min_periods=4).mean().reset_index(level=[0, 1], drop=True))
    D["props_prior"] = pm.transform(lambda s: s.shift(1).notna().cumsum())

    # overridable so a feature-set change can be built ALONGSIDE the panel that running
    # jobs are reading, which keeps the A/B honest instead of clobbering the baseline
    path = os.environ.get("PANEL_OUT", f"{OUT}/nba_props_panel.parquet")
    D.to_parquet(path, index=False)
    print(f"\nwrote {path}: {D.shape[0]:,} rows x {D.shape[1]} cols", flush=True)
    sc = "season" if "season" in D.columns else "season_x"
    print(f"markets: {D['market'].nunique()}, seasons: {sorted(D[sc].unique())}")
    print(f"usable (history + target): "
          f"{(D['gp_prior'].ge(5) & D['y_cons'].notna()).sum():,}")
    print(f"cross-book line range >= 1: {(D['line_range'] >= 1).mean():.1%}")


if __name__ == "__main__":
    main()
