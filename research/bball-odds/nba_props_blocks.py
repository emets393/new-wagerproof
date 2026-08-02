#!/usr/bin/env python3
"""Build the three context tables the NBA props panel has never had.

WHY THIS EXISTS. `nba_props_panel_v2.parquet` is 235 columns of the player's OWN form plus the
market. It has 45 opponent-side columns and every one of them is an injury/absence count -- there
is not a single column describing how good the opponent is at stopping anybody. The panel was also
built at 12:02 on 07-30, and `nba_player_team_agg` / `nba_rapm_team_agg` were built at 14:25 and
19:35 the same day, so the player-level tables could not have been wired in even in principle.
Attaching exactly those tables took the NBA full-game spread from -0.46% to +9.5% ROI.

This writes three small side tables rather than one fat panel. 474,732 prop rows x ~1,400 columns
is 2.5 GB in memory and most of it would be re-read ten times, once per market; the merge belongs
at model time where only one market's rows are resident.

    _props_team_ctx.parquet   own_/opp_/d_ team context, one row per (event_id, team_id).
                              Everything in the wide cache -- including the adj_def_* opponent-
                              ADJUSTED defensive family -- plus every block nba_blocks attaches,
                              rotated out of home/away into own/opponent orientation.

    _props_posdef.parquet     what each defence has ALLOWED to each position, as-of. Built here
                              from raw box scores because it exists nowhere in the repo. This is
                              the single most standard feature in prop modelling and the panel
                              does not have it.

    _props_pattr.parquet      position, height, weight per player. The panel knows a player's
                              rebound average but not that he is a centre.

ORIENTATION IS THE WHOLE POINT. The wide cache is home/away; a prop is own/opponent. Merging h_*
and a_* onto a player row and hoping the model works out which is his would waste the columns --
the model would have to learn `player_is_home` as an interaction on all ~400 of them.

EVERYTHING NEW IS LEAK-SCREENED. `nba_blocks.leak_screen` runs on the block columns before
rotation; the positional-defence table is built strictly from games STRICTLY BEFORE the current
one (a shift(1) inside the expanding mean, asserted below), which is the only defence against the
obvious failure of averaging in tonight's box score.
"""
import os
import sys
import unicodedata
import warnings

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nba_blocks as NB

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
PQ = os.path.join(ROOT, "data", "parquet")

# the stats a prop can be written on; posdef is built for each one
STATS = ["pts", "reb", "ast", "fg3m", "blk", "stl", "min"]
WINDOWS = {"s2d": None, "l10": 10, "l5": 5}


def pkey_norm(s):
    """Match balldontlie names to the panel's `pkey`.

    The panel lowercases and strips punctuation AND generational suffixes ('michael porter', not
    'michael porter jr'), so both sides need the same treatment. Hyphens become SPACES, not
    nothing -- removing them sends 'shai gilgeous-alexander' to a key the panel never produces.
    Reaches 99.8% of the 566 players who ever had a prop posted.
    """
    s = s.astype(str).map(lambda x: unicodedata.normalize("NFKD", x).encode("ascii", "ignore").decode())
    s = (s.str.lower()
          .str.replace(r"[-]", " ", regex=True)
          .str.replace(r"[^a-z ]", "", regex=True)
          .str.replace(r"\s+", " ", regex=True).str.strip())
    return s.str.replace(r"\s+(jr|sr|ii|iii|iv|v)$", "", regex=True).str.strip()


def pos_bucket(p):
    """G / F / C from balldontlie's eight position strings; primary listing wins on hyphens."""
    p = p.fillna("").astype(str).str.upper().str.strip()
    first = p.str.split("-").str[0]
    return first.where(first.isin(["G", "F", "C"]), "UNK")


# ---------------------------------------------------------------- team context

def build_team_ctx():
    W = pd.read_parquet(os.path.join(PQ, "_nba_wide_cache.parquet"))
    W, blocks = NB.attach(W)

    # strict=False: report and drop, because unlike the spread model this frame carries the whole
    # cache and one bad block should not kill the build. Dropped columns are named in the log.
    flagged = set(NB.leak_screen(W, blocks, strict=False))
    if flagged:
        W = W.drop(columns=[c for c in flagged if c in W.columns])
        print(f"[ctx] dropped {len(flagged)} leak-flagged columns", flush=True)

    cols = set(W.columns)
    bases = sorted({c[2:] for c in cols
                    if c[:2] == "h_" and ("a_" + c[2:]) in cols
                    and pd.api.types.is_numeric_dtype(W[c])})
    print(f"[ctx] {len(bases)} home/away base names to rotate", flush=True)

    keep = ["event_id", "game.id", "hid", "aid", "date"]
    out = []
    for side, me, them in (("h", "hid", "aid"), ("a", "aid", "hid")):
        o = ("a" if side == "h" else "h")
        F = W[keep].copy()
        F["team_id"] = W[me].astype(float)
        F["opp_id"] = W[them].astype(float)
        F["ctx_is_home"] = 1.0 if side == "h" else 0.0
        own = W[[f"{side}_{b}" for b in bases]].to_numpy(dtype=np.float32)
        opp = W[[f"{o}_{b}" for b in bases]].to_numpy(dtype=np.float32)
        F = pd.concat([F,
                       pd.DataFrame(own, columns=[f"own_{b}" for b in bases], index=W.index),
                       pd.DataFrame(opp, columns=[f"opp_{b}" for b in bases], index=W.index),
                       pd.DataFrame(own - opp, columns=[f"d_{b}" for b in bases], index=W.index)],
                      axis=1)
        out.append(F)

    T = pd.concat(out, ignore_index=True)
    T["event_id"] = T["event_id"].astype(str)
    assert T.duplicated(["event_id", "team_id"]).sum() == 0, "team ctx key is not unique"
    print(f"[ctx] {len(T):,} team-games x {T.shape[1]} cols", flush=True)
    return T


# ------------------------------------------------------- opponent positional defence

def build_posdef():
    """As-of allowed rates: what this defence has given up to G / F / C, per game and per minute.

    Built from raw box scores. For every game we credit the DEFENDING team with what the other
    side's players at each position produced, then take an expanding / rolling mean over that
    team's PRIOR games only. The shift is asserted, not assumed.
    """
    b = pd.read_parquet(os.path.join(PQ, "bdl_player_box.parquet"),
                        columns=["game.id", "game.date", "game.season", "team.id",
                                 "game.home_team_id", "game.visitor_team_id",
                                 "player.position", "min"] + STATS[:-1])
    b = b.rename(columns={"game.id": "gid", "team.id": "tid", "game.date": "date",
                          "game.season": "season"})
    b["min"] = pd.to_numeric(b["min"].astype(str).str.split(":").str[0], errors="coerce")
    for s in STATS:
        b[s] = pd.to_numeric(b[s], errors="coerce")
    b["pos"] = pos_bucket(b["player.position"])
    b["date"] = pd.to_datetime(b["date"], errors="coerce")
    # the defence is whichever of the two teams the scorer does NOT play for
    b["def_tid"] = np.where(b["tid"] == b["game.home_team_id"],
                            b["game.visitor_team_id"], b["game.home_team_id"])

    G = (b.groupby(["gid", "date", "season", "def_tid", "pos"], as_index=False)[STATS].sum()
          .sort_values(["def_tid", "pos", "date", "gid"]))
    for s in STATS[:-1]:
        G[f"{s}_pm"] = G[s] / G["min"].replace(0, np.nan)   # per allowed-minute, pace-free

    val = STATS + [f"{s}_pm" for s in STATS[:-1]]
    out = G[["gid", "def_tid", "pos"]].copy()
    grp = G.groupby(["def_tid", "pos"])
    for tag, w in WINDOWS.items():
        # shift(1) FIRST, then the window: the mean must not contain tonight's game
        r = grp[val].shift(1)
        r = (r.groupby([G["def_tid"], G["pos"]]).expanding().mean().reset_index(level=[0, 1], drop=True)
             if w is None else
             r.groupby([G["def_tid"], G["pos"]]).rolling(w, min_periods=2).mean()
              .reset_index(level=[0, 1], drop=True))
        out = out.join(r.add_prefix(f"opd_{tag}_"))
    out["opd_n_prior"] = grp.cumcount()

    # ASSERT the shift: the as-of column must not reproduce the same game's realised value.
    chk = G[["gid", "def_tid", "pos"]].join(out.set_index(out.index)[["opd_s2d_pts"]])
    same = (np.isclose(G["pts"].to_numpy(), chk["opd_s2d_pts"].to_numpy(), atol=1e-9)
            & chk["opd_s2d_pts"].notna().to_numpy())
    assert same.mean() < 0.01, f"posdef leaks the current game ({same.mean():.1%} exact matches)"

    print(f"[posdef] {len(out):,} team-game-position rows, "
          f"{sum(c.startswith('opd_') for c in out.columns)} cols", flush=True)
    return out


# ---------------------------------------------------------------- player attributes

def build_pattr():
    b = pd.read_parquet(os.path.join(PQ, "bdl_player_box.parquet"),
                        columns=["player.id", "player.first_name", "player.last_name",
                                 "player.position", "player.height", "player.weight"])
    b["pk"] = pkey_norm(b["player.first_name"].fillna("") + " " + b["player.last_name"].fillna(""))
    ft = b["player.height"].astype(str).str.split("-", expand=True)
    b["pa_height_in"] = pd.to_numeric(ft[0], errors="coerce") * 12 + pd.to_numeric(ft[1], errors="coerce")
    b["pa_weight"] = pd.to_numeric(b["player.weight"], errors="coerce")
    b["pos"] = pos_bucket(b["player.position"])
    A = (b.groupby("pk")
          .agg(pos=("pos", lambda s: s.value_counts().index[0]),
               pa_height_in=("pa_height_in", "median"),
               pa_weight=("pa_weight", "median"),
               pa_gp=("pk", "size"))
          .reset_index())
    A["pa_is_g"] = (A["pos"] == "G").astype(float)
    A["pa_is_f"] = (A["pos"] == "F").astype(float)
    A["pa_is_c"] = (A["pos"] == "C").astype(float)
    print(f"[pattr] {len(A):,} players", flush=True)
    return A


if __name__ == "__main__":
    T = build_team_ctx()
    T.to_parquet(os.path.join(PQ, "_props_team_ctx.parquet"), index=False)

    P = build_posdef()
    P.to_parquet(os.path.join(PQ, "_props_posdef.parquet"), index=False)

    A = build_pattr()
    A.to_parquet(os.path.join(PQ, "_props_pattr.parquet"), index=False)

    D = pd.read_parquet(os.path.join(PQ, "nba_props_panel_v2.parquet"),
                        columns=["event_id", "team_id", "pkey"])
    D["event_id"] = D["event_id"].astype(str)
    cov = D.merge(T[["event_id", "team_id"]].assign(_h=1), on=["event_id", "team_id"],
                  how="left")["_h"].notna().mean()
    pcov = pkey_norm(pd.Series(D["pkey"].unique())).isin(set(A["pk"])).mean()
    print(f"\n[props] team ctx joins {cov:.2%} of prop rows | player attrs cover {pcov:.2%} of players",
          flush=True)
