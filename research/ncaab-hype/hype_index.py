#!/usr/bin/env python3
"""Preseason HYPE per college team-season, 2020-21 .. 2025-26, from things known before the first game.

Owner question (2026-10-26): find the teams with all the notoriety coming into a season -- the huge recruiting
class, the multiple top-50 players -- and look at their early games against real opponents. Step one: measure hype.

Components, every one dated before opening night:
  ap_pre        preseason AP rank (week-1 poll, mid-October); unranked = 40
  coaches_pre   preseason Coaches rank; unranked = 40
  class_rank    247 composite recruiting class rank for the class that enrolled this season
  n_top50       top-50 recruits (any class, by composite rating within class) on this season's roster
  n_top100      same, top-100
  n_5star       five-stars on the roster
  kp_pre        KenPom rank on the archive's opening-day snapshot
  kp_prev_final previous season's final KenPom rank (established vs new)
  poll_premium  kp_pre - ap_pre for AP-ranked teams: the poll likes them MORE than the numbers (hype beyond substance)

hype = mean z-score of (-ap_pre, -class_rank, n_top50, poll_premium) within season; hype_rank = rank within season.

Sources: College Basketball Data (rankings, recruiting/teams, recruiting/players, teams/roster -- cached in data/),
KenPom archive parquet in ../bball-odds. Team key = CBBD teamId, which is the id the situational panel carries.
"""
import numpy as np
import pandas as pd

D = "data"
rk = pd.read_parquet(f"{D}/cbbd_rankings.parquet")
rt = pd.read_parquet(f"{D}/cbbd_recruit_teams.parquet")
rp = pd.read_parquet(f"{D}/cbbd_recruit_players.parquet")
ros = pd.read_parquet(f"{D}/cbbd_rosters.parquet")
kp = pd.read_parquet("../bball-odds/data/parquet/kenpom_archive_daily.parquet")
kp["ArchiveDate"] = pd.to_datetime(kp.ArchiveDate)

# preseason polls = week 1
pre = rk[rk.week == 1]
ap = pre[pre.pollType == "AP Top 25"].groupby(["season", "teamId"]).agg(ap_pre=("ranking", "min"), ap_points=("points", "max")).reset_index()
co = pre[pre.pollType == "Coaches Poll"].groupby(["season", "teamId"]).agg(coaches_pre=("ranking", "min")).reset_index()

# recruiting class for the season = class year == season end-year (class of 2025 are freshmen in 2025-26)
cls = rt.rename(columns={"year": "season", "ranking": "class_rank", "rating": "class_rating"})[["season", "teamId", "class_rank", "class_rating"]]

# recruit national rank within class by composite rating, then who is on each season's roster
rp = rp[rp.rating.notna()].copy()
rp["nat_rank"] = rp.groupby("year").rating.rank(ascending=False, method="first")
rec = rp[["athleteId", "year", "nat_rank", "stars"]].dropna(subset=["athleteId"])
j = ros.merge(rec, left_on="id", right_on="athleteId", how="inner")
stars = j.groupby(["season", "teamId"]).agg(n_top50=("nat_rank", lambda s: int((s <= 50).sum())),
                                            n_top100=("nat_rank", lambda s: int((s <= 100).sum())),
                                            n_5star=("stars", lambda s: int((s == 5).sum())),
                                            n_fresh_top50=("nat_rank", lambda s: 0)).reset_index()
fr = j[j.year == j.season - 1].groupby(["season", "teamId"]).nat_rank.apply(lambda s: int((s <= 50).sum())).rename("n_fresh_top50").reset_index()
stars = stars.drop(columns="n_fresh_top50").merge(fr, on=["season", "teamId"], how="left").fillna({"n_fresh_top50": 0})

# KenPom opening-day rank, and the prior season's final rank; KenPom names -> CBBD ids via the roster team names
first = kp.sort_values("ArchiveDate").groupby("Season").head(400)
first = first[first.ArchiveDate == first.groupby("Season").ArchiveDate.transform("min")]
kp_pre = first[["Season", "TeamName", "RankAdjEM", "RankAdjEMFinal"]].rename(columns={"Season": "season", "RankAdjEM": "kp_pre", "RankAdjEMFinal": "kp_final"})
fin = kp_pre[["season", "TeamName", "kp_final"]].copy(); fin["season"] += 1; fin = fin.rename(columns={"kp_final": "kp_prev_final"})
kp_pre = kp_pre.merge(fin, on=["season", "TeamName"], how="left")
# KenPom names -> CBBD team ids through ncaab_team_mapping (api_team_id IS the CBBD teamId)
mp = pd.read_parquet(f"{D}/team_mapping.parquet").dropna(subset=["KenPom_Name"])
kp_pre = kp_pre.merge(mp[["KenPom_Name", "api_team_id"]].rename(columns={"KenPom_Name": "TeamName", "api_team_id": "teamId"}), on="TeamName", how="inner")[["season", "teamId", "kp_pre", "kp_prev_final"]]
teams = ros[["season", "teamId", "team", "conference"]].drop_duplicates(["season", "teamId"])


H = teams.merge(ap, on=["season", "teamId"], how="left").merge(co, on=["season", "teamId"], how="left") \
         .merge(cls, on=["season", "teamId"], how="left").merge(stars, on=["season", "teamId"], how="left").merge(kp_pre, on=["season", "teamId"], how="left")
for c in ("n_top50", "n_top100", "n_5star", "n_fresh_top50"):
    H[c] = H[c].fillna(0).astype(int)
H["ap_pre_f"] = H.ap_pre.fillna(40)
H["class_rank_f"] = H.class_rank.fillna(H.class_rank.max())
H["poll_premium"] = np.where(H.ap_pre.notna() & H.kp_pre.notna(), H.kp_pre - H.ap_pre, 0.0)


def z(s):
    return (s - s.mean()) / (s.std(ddof=0) or 1)


parts = pd.DataFrame({"a": -H.groupby("season").ap_pre_f.transform(z), "c": -H.groupby("season").class_rank_f.transform(z),
                      "t": H.groupby("season").n_top50.transform(z), "p": H.groupby("season").poll_premium.transform(z)})
H["hype"] = parts.mean(axis=1)
H["hype_rank"] = H.groupby("season").hype.rank(ascending=False, method="first")
H.to_parquet(f"{D}/hype_index.parquet", index=False)

print(f"{len(H)} team-seasons; kp matched {H.kp_pre.notna().mean():.0%}; AP ranked {H.ap_pre.notna().sum()}")
for s, g in H.groupby("season"):
    print(f"\n== {s - 1}-{str(s)[2:]}: top 10 by hype ==")
    print(g.sort_values("hype_rank").head(10)[["team", "conference", "ap_pre", "coaches_pre", "class_rank", "n_top50", "n_fresh_top50", "n_5star", "kp_pre", "kp_prev_final", "poll_premium", "hype"]]
          .to_string(index=False, float_format=lambda v: f"{v:.1f}"))
