"""Roster reconstruction per (season, team) — player-level early-season strength (task #101).

For every rostered player in season S: classify returning / transfer-in / newcomer via the
S-1 roster diff, then value him:
  - played last year  -> his prior-year TOTAL PPA (production x usage in one number)
  - transfer          -> prior-year total PPA at his old school (portal rating as fallback)
  - newcomer/no snaps -> recruiting composite (talent stock, not production)

Team-season outputs (data/roster_scores.parquet):
  ret_prod        production RETURNING (sum prior tot PPA of returners)
  ret_share       player-level returning-production share (our own percentPPA —
                  computable for 2026 the day CFBD posts rosters, unlike the API feed)
  in_prod         production IMPORTED via transfers
  lost_prod       production that left (prior team total - returning)
  net_prod        ret_prod + in_prod - lost_prod
  talent_stock    mean composite of the top-40 rated players on the roster
  qb1_prior       projected QB1's prior-year total PPA (best QB on roster, returning or
                  transfer — the single biggest early-season lever in college)
  qb1_transfer    1 if that QB is a transfer-in
  qb1_rating      that QB's recruiting/portal composite (fallback signal when no snaps)
"""
import numpy as np
import pandas as pd
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data" / "cfbd"

ro = pd.read_parquet(DATA / "rosters.parquet")
rc = pd.read_parquet(DATA / "recruits.parquet")
pp = pd.read_parquet(DATA / "player_ppa.parquet")
pt = pd.read_parquet(DATA / "portal.parquet")

# best composite per athlete (some have HS + JUCO rows)
comp = rc.dropna(subset=["athlete_id", "rating"]).groupby("athlete_id").rating.max()
# prior-year production per athlete-season (tot_all can be NaN on kickers etc.)
pp["tot"] = pd.to_numeric(pp.tot_all, errors="coerce")
# mid-season transfers get a row per team — keep the larger-production row per athlete-season
prod = (pp.sort_values("tot", ascending=False)
          .drop_duplicates(["season", "athlete_id"])
          .set_index(["season", "athlete_id"]).tot)
team_prior_tot = pp.groupby(["season", "team"]).tot.sum()
# portal ratings by (season, name) — portal rows lack athlete ids; match by name+season
pt["name"] = (pt.firstName.fillna("") + " " + pt.lastName.fillna("")).str.strip()
portal_rating = (pt.dropna(subset=["rating"])
                   .sort_values("rating", ascending=False)
                   .drop_duplicates(["season", "name"])
                   .set_index(["season", "name"]).rating.sort_index())

ro["name"] = (ro["first"].fillna("") + " " + ro["last"].fillna("")).str.strip()
rows = []
seasons = sorted(ro.season.unique())
for S in seasons[1:]:
    cur = ro[ro.season == S]
    prev = ro[ro.season == S - 1] if S - 1 in seasons else ro[ro.season == S - 2]
    PY = int(prev.season.iloc[0])
    # a player can appear on two rosters in a transfer year — keep one row per athlete
    prev_team = prev.drop_duplicates("athlete_id").set_index("athlete_id").team
    cur = cur.drop_duplicates(["team", "athlete_id"])
    for team, g in cur.groupby("team"):
        ids = g.athlete_id
        was = ids.map(prev_team)                      # NaN = newcomer
        returning = g[was == team]
        transfers = g[(was.notna()) & (was != team)]
        ret_prod = prod.reindex([(PY, i) for i in returning.athlete_id]).sum()
        in_prod = prod.reindex([(PY, i) for i in transfers.athlete_id]).sum()
        prior_total = team_prior_tot.get((PY, team), np.nan)
        lost = (prior_total - ret_prod) if pd.notna(prior_total) else np.nan
        ratings = g.athlete_id.map(comp).dropna().sort_values(ascending=False)
        talent = ratings.head(40).mean() if len(ratings) else np.nan
        # projected QB1: any QB on the roster, ranked by prior-year production then composite
        qbs = g[g.position == "QB"].copy()
        qb1_prior = qb1_rating = np.nan; qb1_transfer = 0
        if len(qbs):
            qbs["prior"] = prod.reindex([(PY, i) for i in qbs.athlete_id]).values
            qbs["comp"] = qbs.athlete_id.map(comp)
            qbs["pr"] = qbs.name.map(lambda n: portal_rating.get((S, n), np.nan))
            qbs = qbs.sort_values(["prior", "comp"], ascending=False, na_position="last")
            q = qbs.iloc[0]
            qb1_prior = q.prior
            qb1_rating = q.comp if pd.notna(q.comp) else q.pr
            qb1_transfer = int(pd.notna(q.athlete_id) and prev_team.get(q.athlete_id, team) != team)
        rows.append(dict(season=S, team=team, n_roster=len(g),
                         ret_prod=ret_prod, in_prod=in_prod, lost_prod=lost,
                         ret_share=(ret_prod / prior_total) if (pd.notna(prior_total) and prior_total > 0) else np.nan,
                         net_prod=ret_prod + in_prod - (lost if pd.notna(lost) else 0),
                         talent_stock=talent, qb1_prior=qb1_prior,
                         qb1_rating=qb1_rating, qb1_transfer=qb1_transfer))

out = pd.DataFrame(rows)
out.to_parquet(Path(__file__).resolve().parent / "data" / "roster_scores.parquet", index=False)
print(f"{len(out)} team-seasons -> data/roster_scores.parquet")
sanity = out[out.season == 2025].sort_values("net_prod")
print("\n2025 lowest net_prod:", sanity[["team", "ret_share", "net_prod", "qb1_transfer"]].head(4).to_string(index=False))
print("\n2025 highest net_prod:", sanity[["team", "ret_share", "net_prod", "qb1_transfer"]].tail(4).to_string(index=False))
print(f"\nret_share coverage: {out.ret_share.notna().mean()*100:.0f}% | qb1_prior: {out.qb1_prior.notna().mean()*100:.0f}% | talent: {out.talent_stock.notna().mean()*100:.0f}%")
# correlation vs the API's team-level percentPPA where both exist (validates the construction).
# priors.parquet may not exist yet on an ephemeral disk (it's a committed artifact patched
# weekly) — the validation print is optional, never fail the roster build over it.
_prip = Path(__file__).resolve().parent / "data" / "priors.parquet"
if not _prip.exists():
    print("[roster] priors.parquet absent — skipping percentPPA validation print")
    raise SystemExit(0)
pri = pd.read_parquet(_prip)
j = out.merge(pri[["season", "team", "ret_ppa"]], on=["season", "team"], how="inner").dropna(subset=["ret_share", "ret_ppa"])
if len(j):
    print(f"corr(our player-built ret_share, CFBD percentPPA) = {np.corrcoef(j.ret_share, j.ret_ppa)[0,1]:+.3f} (n={len(j)})")
