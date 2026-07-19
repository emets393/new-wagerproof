"""As-of-game feature aggregation for nfl_analysis_base (Systems feature, Bucket C).

Computes season-to-date "at the time of the game" features LEAK-SAFELY: for each (team, game)
every value uses ONLY that team's games earlier in the season (single chronological pass that
records state BEFORE applying the current game). Prior-year = the team's full previous season.
Head-to-head = the last completed meeting vs the same opponent.

Source & sink: warehouse project jpxnjuwglavsjbgbasnl, table nfl_analysis_base (grain = one row
per (game_id, team), team names = full school names). We read the base itself so signs/results
match the live data exactly (no fragile external join). Output = asof_nfl.parquet (merge frame,
keyed by game_id+team, with team_* and opp_* columns) ready to stage + merge into the base.

Run: python3 asof_features_cfb.py   (needs SUPABASE_SERVICE_KEY in repo .env.local; read-only here)
See .claude/docs/trends-systems/04_ASOF_AGGREGATION_SPEC.md
"""
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]  # repo root
BASE = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
OUT = Path(__file__).resolve().parent / "asof_nfl.parquet"

SEL = ("game_id,season,week,team,opponent,is_home,is_favorite,team_score,opp_score,"
       "total_points,fg_won,fg_covered,ou_result,fg_spread,fg_total,team_ml,season_type")


def key():
    for line in (ROOT / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found in .env.local")


def fetch_all(k):
    hdr = {"apikey": k, "Authorization": f"Bearer {k}"}
    rows, step = [], 1000
    for off in range(0, 100000, step):
        req = urllib.request.Request(f"{BASE}/nfl_analysis_base?select={SEL}&order=season.asc,week.asc,game_id.asc"
                                     f"&limit={step}&offset={off}", headers=hdr)
        page = json.load(urllib.request.urlopen(req, timeout=60))
        rows += page
        if len(page) < step:
            break
    return pd.DataFrame(rows)


def compute_asof(df):
    """One chronological pass per (team, season): record state BEFORE each game (leak-safe)."""
    df = df.sort_values(["team", "season", "week", "game_id"]).reset_index(drop=True)
    df["margin"] = df.team_score - df.opp_score
    df["cover_margin"] = df.margin + df.fg_spread          # >0 covered (matches fg_covered)

    cols = ["team_gp_s2d", "team_wins_s2d", "team_losses_s2d", "team_win_pct",
            "team_win_streak", "team_loss_streak",
            "team_ats_wins_s2d", "team_ats_losses_s2d", "team_ats_win_pct",
            "team_ats_win_streak", "team_ats_loss_streak", "team_avg_cover_margin",
            "team_over_count_s2d", "team_ou_games_s2d", "team_over_pct",
            "team_over_streak", "team_under_streak",
            "team_ppg", "team_pa_pg", "team_point_diff_pg"]
    out = {c: np.full(len(df), np.nan) for c in cols}

    for (_, _), idx in df.groupby(["team", "season"], sort=False).groups.items():
        w = l = 0                       # W/L
        aw = al = 0                     # ATS W/L (pushes excluded)
        ov = un = 0                     # over/under (pushes excluded)
        pts = opp = 0                   # points for/against
        wstk = lstk = 0                 # win/loss streak
        awstk = alstk = 0               # ATS win/loss streak
        ovstk = unstk = 0               # over/under streak
        cmsum = cmn = 0                 # cover-margin running sum / count
        for i in idx:
            gp = w + l
            out["team_gp_s2d"][i] = gp
            out["team_wins_s2d"][i] = w
            out["team_losses_s2d"][i] = l
            out["team_win_pct"][i] = w / gp if gp else np.nan
            out["team_win_streak"][i] = wstk
            out["team_loss_streak"][i] = lstk
            ats_dec = aw + al
            out["team_ats_wins_s2d"][i] = aw
            out["team_ats_losses_s2d"][i] = al
            out["team_ats_win_pct"][i] = aw / ats_dec if ats_dec else np.nan
            out["team_ats_win_streak"][i] = awstk
            out["team_ats_loss_streak"][i] = alstk
            out["team_avg_cover_margin"][i] = cmsum / cmn if cmn else np.nan
            oud = ov + un
            out["team_over_count_s2d"][i] = ov
            out["team_ou_games_s2d"][i] = oud
            out["team_over_pct"][i] = ov / oud if oud else np.nan
            out["team_over_streak"][i] = ovstk
            out["team_under_streak"][i] = unstk
            out["team_ppg"][i] = pts / gp if gp else np.nan
            out["team_pa_pg"][i] = opp / gp if gp else np.nan
            out["team_point_diff_pg"][i] = (pts - opp) / gp if gp else np.nan

            # ---- apply this game to state (only if the game is completed) ----
            r = df.iloc[i]
            if pd.notna(r.fg_won):
                if r.fg_won == 1:
                    w += 1; wstk += 1; lstk = 0
                else:
                    l += 1; lstk += 1; wstk = 0
                pts += r.team_score; opp += r.opp_score
            if pd.notna(r.fg_covered):
                cmsum += r.cover_margin; cmn += 1
                if r.fg_covered == 1:
                    aw += 1; awstk += 1; alstk = 0
                else:
                    al += 1; alstk += 1; awstk = 0
            if pd.notna(r.ou_result):
                if r.ou_result == 1:
                    ov += 1; ovstk += 1; unstk = 0
                else:
                    un += 1; unstk += 1; ovstk = 0
    for c in cols:
        df[c] = out[c]
    return df


def add_prior_year(df):
    season_tot = (df.groupby(["team", "season"])
                    .agg(wins=("fg_won", lambda s: (s == 1).sum()),
                         games=("fg_won", lambda s: s.notna().sum()),
                         playoff=("season_type", lambda s: (s == "postseason").any()))
                    .reset_index())
    season_tot["losses"] = season_tot.games - season_tot.wins
    season_tot["win_pct"] = season_tot.wins / season_tot.games.replace(0, np.nan)
    season_tot["next_season"] = season_tot.season + 1
    prev = (season_tot.drop(columns=["season"])
            .rename(columns={"next_season": "season",
                             "wins": "team_prev_wins", "losses": "team_prev_losses",
                             "win_pct": "team_prev_win_pct", "playoff": "team_made_playoffs_prev"}))
    return df.merge(prev[["team", "season", "team_prev_wins", "team_prev_losses",
                          "team_prev_win_pct", "team_made_playoffs_prev"]],
                    on=["team", "season"], how="left")


def add_h2h(df):
    df = df.sort_values(["team", "opponent", "season", "week", "game_id"]).reset_index(drop=True)
    g = df.groupby(["team", "opponent"], sort=False)
    df["h2h_last_win"] = g["fg_won"].shift(1)
    df["h2h_last_ats_win"] = g["fg_covered"].shift(1)
    df["h2h_last_over"] = g["ou_result"].shift(1)
    df["h2h_last_home"] = g["is_home"].shift(1)
    df["h2h_last_fav"] = g["is_favorite"].shift(1)
    df["h2h_last_margin"] = g["margin"].shift(1)
    df["h2h_last_spread"] = g["fg_spread"].shift(1)
    df["h2h_last_total"] = g["fg_total"].shift(1)
    df["h2h_last_ml"] = g["team_ml"].shift(1)
    df["h2h_last_season"] = g["season"].shift(1)
    df["h2h_same_season"] = (df["h2h_last_season"] == df["season"])
    return df


def add_opponent(df):
    """Attach the opponent's team_* as opp_* by swapping within each game_id."""
    tcols = [c for c in df.columns if c.startswith("team_") and c not in ("team_score", "team_ml")]
    mirror = df[["game_id", "team"] + tcols].rename(
        columns={"team": "opponent", **{c: "opp_" + c[len("team_"):] for c in tcols}})
    return df.merge(mirror, on=["game_id", "opponent"], how="left")


def leakage_test(df, n=300):
    """Recompute team_win_pct the slow, obviously-correct way and assert equality (proves no leak)."""
    d = df.sort_values(["team", "season", "week", "game_id"]).reset_index(drop=True)
    rng = np.random.default_rng(0)
    sample = rng.choice(len(d), size=min(n, len(d)), replace=False)
    bad = 0
    for i in sample:
        r = d.iloc[i]
        prior = d[(d.team == r.team) & (d.season == r.season) &
                  ((d.week < r.week) | ((d.week == r.week) & (d.game_id < r.game_id)))]
        prior = prior[prior.fg_won.notna()]
        exp = (prior.fg_won == 1).sum() / len(prior) if len(prior) else np.nan
        got = r.team_win_pct
        if not ((pd.isna(exp) and pd.isna(got)) or (pd.notna(exp) and abs(exp - got) < 1e-9)):
            bad += 1
    return bad


def main():
    k = key()
    print("fetching nfl_analysis_base ...")
    df = fetch_all(k)
    print(f"  {len(df)} rows, {df.season.min()}–{df.season.max()}")
    df = compute_asof(df)
    df = add_prior_year(df)
    df = add_h2h(df)
    df = add_opponent(df)

    bad = leakage_test(df)
    print(f"LEAKAGE TEST: {bad} mismatches out of 300  ({'PASS' if bad == 0 else 'FAIL'})")

    # sanity
    played = df[df.fg_won.notna()]
    mid = played[played.team_gp_s2d >= 4]      # meaningful sample
    print(f"SANITY: mean team_win_pct (gp>=4) = {mid.team_win_pct.mean():.3f} (expect ~0.50)")
    print(f"        mean team_over_pct (gp>=4) = {mid.team_over_pct.mean():.3f} (expect ~0.50)")
    print(f"        mean team_ats_win_pct(gp>=4)= {mid.team_ats_win_pct.mean():.3f} (expect ~0.50)")
    print(f"        h2h_last_win non-null = {df.h2h_last_win.notna().mean():.1%}")
    print(f"        prev_win_pct non-null = {df.team_prev_win_pct.notna().mean():.1%}")

    BLOCK = {"team_score", "opp_score", "team_ml", "opp_ml"}   # current-game values, not as-of features
    feat = [c for c in df.columns if c.startswith(("team_", "opp_", "h2h_")) and c not in BLOCK]
    merge = df[["game_id", "team"] + [c for c in feat if c != "team"]].copy()
    merge.to_parquet(OUT, index=False)
    print(f"wrote {OUT}  ({len(merge)} rows, {len(feat)} feature cols)")
    print("feature cols:", ", ".join(feat))


if __name__ == "__main__":
    main()
