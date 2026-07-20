"""As-of-game feature aggregation for mlb_analysis_base (Systems parity — MLB flavor).

Leak-safe season-to-date features per (team, game): W/L record + win%, run-line cover%, over%,
streaks, runs for/against per game, prior-year record, head-to-head last meeting, opponent mirrors,
and the opponent's previous game (mirror of prev_result/prev_margin). Single chronological pass per
(team, season) ordered by (game_date, time_et, game_pk) — doubleheaders resolve by start time.

Run: python3 asof_features_mlb.py   (reads SUPABASE_SERVICE_KEY from repo .env.local; read-only)
Output: asof_mlb.parquet keyed by (game_pk, team_abbr). See 04_ASOF_AGGREGATION_SPEC.md.
"""
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
BASE = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
OUT = Path(__file__).resolve().parent / "asof_mlb.parquet"

SEL = ("game_pk,season,game_date,time_et,team_abbr,opponent_abbr,is_home,ml_won,rl_covered,ou_over,"
       "runs_scored,runs_allowed,margin,prev_result,prev_margin")


def key():
    for line in (ROOT / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found")


def fetch_all(k):
    hdr = {"apikey": k, "Authorization": f"Bearer {k}"}
    rows, step = [], 1000
    for off in range(0, 200000, step):
        req = urllib.request.Request(
            f"{BASE}/mlb_analysis_base?select={SEL}&order=game_date.asc,game_pk.asc&limit={step}&offset={off}",
            headers=hdr)
        page = json.load(urllib.request.urlopen(req, timeout=60))
        rows += page
        if len(page) < step:
            break
    return canonicalize_abbrs(pd.DataFrame(rows))


# Stats API / mapping drift: ARI↔AZ, OAK/SAC/LVA/Ath → ATH.
_ABBR_ALIASES = {"ARI": "AZ", "OAK": "ATH", "LVA": "ATH", "SAC": "ATH"}


def _canon_abbr(v):
    if not isinstance(v, str) or not v:
        return v
    u = v.strip().upper()
    return _ABBR_ALIASES.get(u, u)


def canonicalize_abbrs(df: pd.DataFrame) -> pd.DataFrame:
    for col in ("team_abbr", "opponent_abbr"):
        if col in df.columns:
            df[col] = df[col].map(_canon_abbr)
    # Drop exact duplicate identity rows from mixed-case Athletics ingest.
    if {"game_pk", "team_abbr"}.issubset(df.columns):
        df = df.drop_duplicates(subset=["game_pk", "team_abbr"], keep="first")
    return df.reset_index(drop=True)


def compute_asof(df):
    df = df.sort_values(["team_abbr", "season", "game_date", "time_et", "game_pk"]).reset_index(drop=True)
    cols = ["team_gp_s2d", "team_wins_s2d", "team_losses_s2d", "team_win_pct",
            "team_win_streak", "team_loss_streak",
            "team_rl_wins_s2d", "team_rl_cover_pct", "team_rl_streak",
            "team_over_count_s2d", "team_ou_games_s2d", "team_over_pct",
            "team_over_streak", "team_under_streak",
            "team_rpg", "team_rapg", "team_run_diff_pg"]
    out = {c: np.full(len(df), np.nan) for c in cols}
    for (_, _), idx in df.groupby(["team_abbr", "season"], sort=False).groups.items():
        w = l = 0; rlw = rll = 0; ov = un = 0; rs = ra = 0
        wstk = lstk = rlstk = ovstk = unstk = 0
        for i in idx:
            gp = w + l
            out["team_gp_s2d"][i] = gp
            out["team_wins_s2d"][i] = w; out["team_losses_s2d"][i] = l
            out["team_win_pct"][i] = w / gp if gp else np.nan
            out["team_win_streak"][i] = wstk; out["team_loss_streak"][i] = lstk
            rld = rlw + rll
            out["team_rl_wins_s2d"][i] = rlw
            out["team_rl_cover_pct"][i] = rlw / rld if rld else np.nan
            out["team_rl_streak"][i] = rlstk
            oud = ov + un
            out["team_over_count_s2d"][i] = ov; out["team_ou_games_s2d"][i] = oud
            out["team_over_pct"][i] = ov / oud if oud else np.nan
            out["team_over_streak"][i] = ovstk; out["team_under_streak"][i] = unstk
            out["team_rpg"][i] = rs / gp if gp else np.nan
            out["team_rapg"][i] = ra / gp if gp else np.nan
            out["team_run_diff_pg"][i] = (rs - ra) / gp if gp else np.nan
            r = df.iloc[i]
            if pd.notna(r.ml_won):
                if r.ml_won == 1: w += 1; wstk += 1; lstk = 0
                else: l += 1; lstk += 1; wstk = 0
                rs += r.runs_scored; ra += r.runs_allowed
            if pd.notna(r.rl_covered):
                if r.rl_covered == 1: rlw += 1; rlstk += 1
                else: rll += 1; rlstk = 0
            if pd.notna(r.ou_over):
                if r.ou_over == 1: ov += 1; ovstk += 1; unstk = 0
                else: un += 1; unstk += 1; ovstk = 0
    for c in cols:
        df[c] = out[c]
    return df


def add_prior_year(df):
    tot = (df.groupby(["team_abbr", "season"])
             .agg(wins=("ml_won", lambda s: (s == 1).sum()), games=("ml_won", lambda s: s.notna().sum()))
             .reset_index())
    tot["win_pct"] = tot.wins / tot.games.replace(0, np.nan)
    tot["next_season"] = tot.season + 1
    prev = (tot.drop(columns=["season"])
              .rename(columns={"next_season": "season", "wins": "team_prev_wins", "win_pct": "team_prev_win_pct"}))
    return df.merge(prev[["team_abbr", "season", "team_prev_wins", "team_prev_win_pct"]],
                    on=["team_abbr", "season"], how="left")


def add_h2h(df):
    df = df.sort_values(["team_abbr", "opponent_abbr", "game_date", "time_et", "game_pk"]).reset_index(drop=True)
    g = df.groupby(["team_abbr", "opponent_abbr"], sort=False)
    df["h2h_last_win"] = g["ml_won"].shift(1)
    df["h2h_last_over"] = g["ou_over"].shift(1)
    df["h2h_last_margin"] = g["margin"].shift(1)
    df["h2h_last_season"] = g["season"].shift(1)
    df["h2h_same_season"] = (df["h2h_last_season"] == df["season"])
    return df


def add_opponent(df):
    tcols = [c for c in df.columns if c.startswith("team_") and c not in ("team_abbr",)]
    mirror = df[["game_pk", "team_abbr"] + tcols].rename(
        columns={"team_abbr": "opponent_abbr", **{c: "opp_" + c[len("team_"):] for c in tcols}})
    df = df.merge(mirror, on=["game_pk", "opponent_abbr"], how="left")
    # opponent's previous game = the opponent row's own prev_result / prev_margin
    prevm = df[["game_pk", "team_abbr", "prev_result", "prev_margin"]].rename(
        columns={"team_abbr": "opponent_abbr", "prev_result": "opp_prev_result", "prev_margin": "opp_prev_margin"})
    return df.merge(prevm, on=["game_pk", "opponent_abbr"], how="left")


def leakage_test(df, n=300):
    d = df.sort_values(["team_abbr", "season", "game_date", "time_et", "game_pk"]).reset_index(drop=True)
    rng = np.random.default_rng(0)
    bad = 0
    for i in rng.choice(len(d), size=min(n, len(d)), replace=False):
        r = d.iloc[i]
        prior = d[(d.team_abbr == r.team_abbr) & (d.season == r.season) &
                  ((d.game_date < r.game_date) |
                   ((d.game_date == r.game_date) & (d.time_et < r.time_et)) |
                   ((d.game_date == r.game_date) & (d.time_et == r.time_et) & (d.game_pk < r.game_pk)))]
        prior = prior[prior.ml_won.notna()]
        exp = (prior.ml_won == 1).sum() / len(prior) if len(prior) else np.nan
        got = r.team_win_pct
        if not ((pd.isna(exp) and pd.isna(got)) or (pd.notna(exp) and abs(exp - got) < 1e-9)):
            bad += 1
    return bad


def main():
    df = fetch_all(key())
    print(f"{len(df)} rows, {df.season.min()}–{df.season.max()}")
    df = compute_asof(df)
    df = add_prior_year(df)
    df = add_h2h(df)
    df = add_opponent(df)
    bad = leakage_test(df)
    print(f"LEAKAGE TEST: {bad}/300 mismatches ({'PASS' if bad == 0 else 'FAIL'})")
    mid = df[df.team_gp_s2d >= 20]
    print(f"SANITY: win_pct(gp>=20)={mid.team_win_pct.mean():.3f} over_pct={mid.team_over_pct.mean():.3f} "
          f"rl_cover={mid.team_rl_cover_pct.mean():.3f} | h2h {df.h2h_last_win.notna().mean():.1%} "
          f"| prev_yr {df.team_prev_win_pct.notna().mean():.1%} | opp_prev {df.opp_prev_result.notna().mean():.1%}")
    BLOCK = {"team_abbr"}
    feat = [c for c in df.columns if (c.startswith(("team_", "opp_", "h2h_")) and c not in BLOCK)
            and c not in ("opp_prev_result",)] + ["opp_prev_result"]
    merge = df[["game_pk", "team_abbr"] + [c for c in feat if c != "team_abbr"]].copy()
    merge.to_parquet(OUT, index=False)
    print(f"wrote {OUT} ({len(merge)} rows, {len(feat)} feature cols)")


if __name__ == "__main__":
    main()
