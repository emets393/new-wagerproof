"""Position-group roster dimensions for the conditional gap study (owner-specified).

Per (season, team), from the player-level layer:
  qb1_returning   projected QB1 is a returning player with prior production (not transfer)
  qb1_transfer    projected QB1 arrived via portal
  qb1_new         no QB on roster has prior-year production (true unknown)
  qb1_prior       QB1's prior-year total PPA (experience + quality in one number)
  rec_ret_share   share of prior-year WR/TE receiving-corps production that returns
  ol_talent       mean recruiting composite of OL on roster (OL/OT/OG/C/G/T)
  dl_talent       mean recruiting composite of DL on roster (DL/DE/DT/NT/EDGE)
  transfer_rating sum of incoming portal player ratings (class quality, 2021+)
-> data/roster_dims.parquet
"""
import numpy as np
import pandas as pd
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data" / "cfbd"
OL = {"OL", "OT", "OG", "C", "G", "T"}
DL = {"DL", "DE", "DT", "NT", "EDGE"}
REC = {"WR", "TE"}

ro = pd.read_parquet(DATA / "rosters.parquet")
rc = pd.read_parquet(DATA / "recruits.parquet")
pp = pd.read_parquet(DATA / "player_ppa.parquet")
pt = pd.read_parquet(DATA / "portal.parquet")

comp = rc.dropna(subset=["athlete_id", "rating"]).groupby("athlete_id").rating.max()
pp["tot"] = pd.to_numeric(pp.tot_all, errors="coerce")
prod = (pp.sort_values("tot", ascending=False).drop_duplicates(["season", "athlete_id"])
          .set_index(["season", "athlete_id"]).tot)
rec_prior = pp[pp.position.isin(REC)].groupby(["season", "team"]).tot.sum()
pt["name"] = (pt.firstName.fillna("") + " " + pt.lastName.fillna("")).str.strip()
tin = pt.dropna(subset=["destination", "rating"]).groupby(["season", "destination"]).rating.sum()

rows = []
seasons = sorted(ro.season.unique())
for S in seasons[1:]:
    cur = ro[ro.season == S].drop_duplicates(["team", "athlete_id"])
    prev = ro[ro.season == S - 1] if S - 1 in seasons else ro[ro.season == S - 2]
    PY = int(prev.season.iloc[0])
    prev_team = prev.drop_duplicates("athlete_id").set_index("athlete_id").team
    for team, g in cur.groupby("team"):
        was = g.athlete_id.map(prev_team)
        # QB1
        qbs = g[g.position == "QB"].copy()
        qb1_prior = np.nan; qb1_ret = qb1_tr = qb1_new = 0
        if len(qbs):
            qbs["prior"] = prod.reindex([(PY, i) for i in qbs.athlete_id]).values
            qbs = qbs.sort_values("prior", ascending=False, na_position="last")
            q = qbs.iloc[0]
            qb1_prior = q.prior
            if pd.isna(q.prior):
                qb1_new = 1
            elif prev_team.get(q.athlete_id, team) != team:
                qb1_tr = 1
            else:
                qb1_ret = 1
        # receiving corps returning share
        rec_ids = g[g.position.isin(REC)].athlete_id
        rec_back = prod.reindex([(PY, i) for i in rec_ids[was.reindex(rec_ids.index) == team]]).sum()
        rp = rec_prior.get((PY, team), np.nan)
        rec_ret = (rec_back / rp) if (pd.notna(rp) and rp > 0) else np.nan
        # trench talent
        olt = g[g.position.isin(OL)].athlete_id.map(comp).mean()
        dlt = g[g.position.isin(DL)].athlete_id.map(comp).mean()
        rows.append(dict(season=S, team=team, qb1_returning=qb1_ret, qb1_transfer=qb1_tr,
                         qb1_new=qb1_new, qb1_prior=qb1_prior, rec_ret_share=rec_ret,
                         ol_talent=olt, dl_talent=dlt,
                         transfer_rating=tin.get((S, team), 0.0)))

out = pd.DataFrame(rows)
out.to_parquet(DATA.parent / "roster_dims.parquet", index=False)
print(f"{len(out)} team-seasons -> data/roster_dims.parquet")
print(out[out.season == 2025][["qb1_returning", "qb1_transfer", "qb1_new"]].mean().round(2).to_dict())
print(f"coverage: rec_ret {out.rec_ret_share.notna().mean()*100:.0f}% | ol {out.ol_talent.notna().mean()*100:.0f}% | dl {out.dl_talent.notna().mean()*100:.0f}%")
