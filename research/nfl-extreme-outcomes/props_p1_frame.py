"""Props analysis frame: one row per (game, player, market, book).

Collapses the snapshot history into open/close/movement features, then joins
player form (prior-game rolling stats), opponent defense-allowed (season-to-
date), injury report status, and actual results. Output: data/props_frame.parquet.
"""
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STAT_OF = {
    "player_pass_yds": "passing_yards", "player_pass_tds": "passing_tds",
    "player_receptions": "receptions", "player_reception_yds": "receiving_yards",
    "player_rush_yds": "rushing_yards", "player_anytime_td": "td_any",
}


def amer_to_prob(o):
    o = pd.to_numeric(o, errors="coerce")
    return np.where(o < 0, -o / (-o + 100), 100 / (o + 100))


def main():
    pr = pd.read_parquet(ROOT / "data" / "props_rows.parquet")
    pr["snapshot_time"] = pd.to_datetime(pr.snapshot_time, utc=True, format="mixed")
    pr["commence_time"] = pd.to_datetime(pr.commence_time, utc=True, format="mixed")
    pr["gameday"] = pr.commence_time.dt.date

    po = pd.read_parquet(ROOT / "data" / "player_offense.parquet")
    po = po[po.season.isin([2024, 2025])].copy()
    po["td_any"] = po.rushing_tds.fillna(0) + po.receiving_tds.fillna(0)

    # ---- collapse snapshots -> open/close per (event, player, market, book)
    keys = ["event_id", "season", "week", "player_id", "player_name", "position",
            "team", "market", "bookmaker", "home_team", "away_team"]
    # one line per snapshot: if a snapshot has multiple points keep most balanced juice
    pr["juice_imbalance"] = (pd.to_numeric(pr.over_odds, errors="coerce").fillna(0)
                             + pd.to_numeric(pr.under_odds, errors="coerce").fillna(0)).abs()
    pr = pr.sort_values("juice_imbalance").groupby(keys + ["snapshot_time"], dropna=False).first().reset_index()
    pr = pr.sort_values("snapshot_time")

    g = pr.groupby(keys, dropna=False)
    frame = g.agg(
        open_line=("line", "first"), close_line=("line", "last"),
        min_line=("line", "min"), max_line=("line", "max"),
        open_over=("over_odds", "first"), close_over=("over_odds", "last"),
        open_under=("under_odds", "first"), close_under=("under_odds", "last"),
        n_snaps=("snapshot_time", "nunique"),
        first_snap=("snapshot_time", "first"), last_snap=("snapshot_time", "last"),
        commence=("commence_time", "last"),
    ).reset_index()

    # line at the final pre-gameday snapshot (separates early-week vs gameday moves)
    pr["is_gameday"] = pr.snapshot_time.dt.date == pr.gameday
    pregd = (pr[~pr.is_gameday].groupby(keys, dropna=False)
             .agg(pregame_line=("line", "last"), pregame_over=("over_odds", "last"),
                  pregame_under=("under_odds", "last")).reset_index())
    frame = frame.merge(pregd, on=keys, how="left")

    frame["line_delta"] = frame.close_line - frame.open_line
    frame["gameday_delta"] = frame.close_line - frame.pregame_line
    frame["earlyweek_delta"] = frame.pregame_line - frame.open_line
    frame["line_range"] = frame.max_line - frame.min_line
    frame["open_yes_prob"] = amer_to_prob(frame.open_over)
    frame["close_yes_prob"] = amer_to_prob(frame.close_over)
    frame["close_over_prob"] = amer_to_prob(frame.close_over)
    frame["close_under_prob"] = amer_to_prob(frame.close_under)

    # ---- actuals
    stat = frame.market.map(STAT_OF)
    act = po.melt(id_vars=["player_id", "season", "week"],
                  value_vars=list(set(STAT_OF.values())),
                  var_name="stat", value_name="actual")
    frame["stat"] = stat
    frame = frame.merge(act, on=["player_id", "season", "week", "stat"], how="left")
    frame["played"] = frame.actual.notna()

    def grade(line, actual):
        return np.select([actual > line, actual < line], ["over", "under"], default="push")

    m = frame.played & frame.market.ne("player_anytime_td")
    frame.loc[m, "result_close"] = grade(frame.loc[m, "close_line"], frame.loc[m, "actual"])
    frame.loc[m, "result_open"] = grade(frame.loc[m, "open_line"], frame.loc[m, "actual"])
    atd = frame.played & frame.market.eq("player_anytime_td")
    frame.loc[atd, "result_close"] = np.where(frame.loc[atd, "actual"] > 0, "yes", "no")
    frame.loc[atd, "result_open"] = frame.loc[atd, "result_close"]

    # ---- player form (prior games only, within season)
    po = po.sort_values(["player_id", "season", "week"])
    forms = []
    for statname in set(STAT_OF.values()):
        s = po[["player_id", "season", "week", statname]].dropna(subset=[statname])
        s = s.sort_values(["player_id", "season", "week"])
        grp = s.groupby(["player_id", "season"])[statname]
        f = s[["player_id", "season", "week"]].copy()
        f["stat"] = statname
        f["l3_avg"] = grp.transform(lambda x: x.shift(1).rolling(3, min_periods=1).mean())
        f["l5_avg"] = grp.transform(lambda x: x.shift(1).rolling(5, min_periods=1).mean())
        f["szn_avg"] = grp.transform(lambda x: x.shift(1).expanding().mean())
        f["szn_max"] = grp.transform(lambda x: x.shift(1).expanding().max())
        f["szn_min"] = grp.transform(lambda x: x.shift(1).expanding().min())
        f["last_game"] = grp.shift(1)
        f["gp_prior"] = grp.transform(lambda x: x.shift(1).expanding().count())
        forms.append(f)
    form = pd.concat(forms)
    frame = frame.merge(form, on=["player_id", "season", "week", "stat"], how="left")
    frame["gp_prior"] = frame.gp_prior.fillna(0)

    # ---- opponent + defense-allowed (season-to-date, prior weeks only)
    ge = pd.read_parquet(ROOT / "data" / "games_enriched.parquet")
    ge = ge[ge.season.isin([2024, 2025])][["season", "week", "home_team", "away_team"]]
    ge.columns = ["season", "week", "home_abbr", "away_abbr"]
    sched = pd.concat([
        ge.rename(columns={"home_abbr": "team", "away_abbr": "opp"}),
        ge.rename(columns={"away_abbr": "team", "home_abbr": "opp"})])
    frame = frame.merge(sched, on=["season", "week", "team"], how="left")

    po2 = po.merge(sched, on=["season", "week", "team"], how="left")
    allowed_frames = []
    for statname in set(STAT_OF.values()):
        a = (po2.groupby(["season", "week", "opp", "position"])[statname].sum()
             .reset_index().rename(columns={"opp": "def_team", statname: "allowed"}))
        a = a.sort_values(["season", "def_team", "position", "week"])
        a["def_allowed_pos"] = (a.groupby(["season", "def_team", "position"])["allowed"]
                                .transform(lambda x: x.shift(1).expanding().mean()))
        a["stat"] = statname
        allowed_frames.append(a[["season", "week", "def_team", "position", "stat", "def_allowed_pos"]])
    allowed = pd.concat(allowed_frames)
    frame = frame.merge(allowed.rename(columns={"def_team": "opp"}),
                        on=["season", "week", "opp", "position", "stat"], how="left")
    # league-average allowed at that position/stat/week -> matchup index
    lg = (allowed.groupby(["season", "week", "position", "stat"]).def_allowed_pos.mean()
          .reset_index().rename(columns={"def_allowed_pos": "lg_allowed_pos"}))
    frame = frame.merge(lg, on=["season", "week", "position", "stat"], how="left")
    frame["def_matchup_idx"] = frame.def_allowed_pos / frame.lg_allowed_pos

    # ---- injuries: own status + team skill players Out
    inj = pd.read_parquet(ROOT / "data" / "injuries_raw.parquet")
    inj = inj[inj.season.isin([2024, 2025])]
    own = (inj.sort_values("date_modified").groupby(["season", "week", "player_id"])
           .agg(report_status=("report_status", "last"),
                practice_status=("practice_status", "last")).reset_index())
    frame = frame.merge(own, on=["season", "week", "player_id"], how="left")

    skill_out = (inj[(inj.report_status == "Out") & (inj.position.isin(["QB", "RB", "WR", "TE"]))]
                 .groupby(["season", "week", "team"]).player_id.nunique()
                 .reset_index().rename(columns={"player_id": "team_skill_out"}))
    frame = frame.merge(skill_out, on=["season", "week", "team"], how="left")
    frame["team_skill_out"] = frame.team_skill_out.fillna(0)

    frame.to_parquet(ROOT / "data" / "props_frame.parquet", index=False)
    print(f"frame rows: {len(frame):,}")
    print(frame.groupby(["season"]).size())
    print("\nby market:")
    print(frame.market.value_counts().to_string())
    print("\nplayed:", frame.played.mean().round(3),
          "| has form:", frame.szn_avg.notna().mean().round(3),
          "| has def idx:", frame.def_matchup_idx.notna().mean().round(3),
          "| own inj status:", frame.report_status.notna().mean().round(3))
    print("\nclose vs open line corr:", frame[["open_line", "close_line"]].corr().iloc[0, 1].round(4))
    print(frame[["line_delta", "line_range", "n_snaps"]].describe().round(2).to_string())


if __name__ == "__main__":
    main()
