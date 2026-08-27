"""Backup-QB pregame trigger: covers.com injuries x established starters.

Rebuild of the module described in memory cfb-qb-injury-trigger (the validated
original was never committed). Emits one `backup_qb_start` row per team whose
ESTABLISHED starter is listed Out/IR (Doubtful fires with soft=True) — the
pregame trigger for the two vaulted signals `fade_home_backup_qb` (spread) and
`backup_qb_under` (total), which until now could only be detected post-game.

Established starter = cumulative-attempts leader through week W-1 of the season
(leak-safe, data/cfbd/qb_starts.parquet). Week 1 is the cold week: --carry-prior
seeds it from the PRIOR season's leader (rescues returning starters; blind to
transfers — those rows carry carried=True and are lower-confidence).

covers abbreviates first names ("C. Harrell"), so matching is last-name +
first-initial, with a difflib fallback. Dependency-free (difflib+unicodedata).

Usage:
  python3 qb_availability.py <season> <week>     # reads data/injuries/cfb_injuries_{s}_w{w}.parquet
  python3 qb_availability.py --self-test         # plumbing test on 2024 actuals
"""
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
QB_STARTS = ROOT / "data" / "cfbd" / "qb_starts.parquet"

# covers school -> CFBD team where the school prefix alone doesn't resolve
TEAM_ALIASES = {
    "north carolina state": "NC State",
    "miami (fl)": "Miami",
    "miami (oh)": "Miami (OH)",
    "southern methodist": "SMU",
    "texas christian": "TCU",
    "central florida": "UCF",
    "alabama birmingham": "UAB",
    "texas el paso": "UTEP",
    "texas san antonio": "UTSA",
    "louisiana state": "LSU",
    "southern california": "USC",
    "mississippi": "Ole Miss",
    "hawaii": "Hawai'i",
    "san jose state": "San José State",
    "connecticut": "UConn",
    "massachusetts": "Massachusetts",
    "louisiana lafayette": "Louisiana",
    "louisiana monroe": "UL Monroe",
    "appalachian state": "App State",
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join(s.lower().replace("'", "'").replace(".", "").split())


def map_team(covers_team, cfbd_teams):
    """covers 'School Mascot' -> CFBD team name. Longest-prefix + alias map."""
    by_norm = {norm(t): t for t in cfbd_teams}
    words = covers_team.split()
    # longest prefix of the covers string that IS a CFBD team ("Georgia Bulldogs"
    # -> "Georgia"; "Miami (OH) RedHawks" -> "Miami (OH)")
    for n in range(len(words), 0, -1):
        cand = norm(" ".join(words[:n]))
        if cand in by_norm:
            return by_norm[cand]
        if cand in TEAM_ALIASES:
            return TEAM_ALIASES[cand]
    return None


def name_matches(injury_name: str, starter_name: str) -> bool:
    """covers 'C. Harrell' vs CFBD 'Cade Harrell': last name + first initial,
    difflib fallback for suffixes/spelling drift."""
    a, b = norm(injury_name).split(), norm(starter_name).split()
    if not a or not b:
        return False
    strip = {"jr", "sr", "ii", "iii", "iv", "v"}
    a = [w for w in a if w not in strip] or a
    b = [w for w in b if w not in strip] or b
    if a[-1] == b[-1] and a[0][0] == b[0][0]:
        return True
    return SequenceMatcher(None, " ".join(a), " ".join(b)).ratio() >= 0.85


def build_established(season: int, week: int, carry_prior: bool = True) -> pd.DataFrame:
    """Per-team established starter entering (season, week): cumulative-attempts
    leader through week-1. Week 1 + carry_prior -> prior season's leader
    (carried=True)."""
    q = pd.read_parquet(QB_STARTS)
    cur = q[(q.season == season) & (q.week < week)]
    if len(cur):
        agg = cur.groupby(["team", "qb"], as_index=False).att.sum()
        est = agg.sort_values("att", ascending=False).drop_duplicates("team")
        est = est.assign(carried=False)
    else:
        est = pd.DataFrame(columns=["team", "qb", "att", "carried"])
    if carry_prior:
        prior = q[q.season == season - 1]
        if len(prior):
            pagg = prior.groupby(["team", "qb"], as_index=False).att.sum()
            pest = pagg.sort_values("att", ascending=False).drop_duplicates("team").assign(carried=True)
            est = pd.concat([est, pest[~pest.team.isin(est.team)]], ignore_index=True)
    return est[["team", "qb", "att", "carried"]]


FIRE_STATUSES = {"out", "ir"}
SOFT_STATUSES = {"doubtful"}


def flag_backup_starts(injuries: pd.DataFrame, established: pd.DataFrame,
                       verbose: bool = False) -> pd.DataFrame:
    """QB injury rows whose player IS the team's established starter and whose
    status rules him out -> backup_qb_start rows (soft=True for Doubtful)."""
    cfbd_teams = set(established.team)
    est_by_team = established.set_index("team")
    out_rows, unmatched_teams = [], set()
    qbs = injuries[injuries.pos.str.upper() == "QB"]
    for r in qbs.itertuples():
        status = norm(r.status)
        if status not in FIRE_STATUSES | SOFT_STATUSES:
            continue
        team = map_team(r.team, cfbd_teams)
        if team is None:
            unmatched_teams.add(r.team)
            continue
        if team not in est_by_team.index:
            continue
        est = est_by_team.loc[team]
        if name_matches(r.player, est.qb):
            out_rows.append(dict(team=team, injured_qb=est.qb, injury_listed=r.player,
                                 status=r.status, detail=r.detail,
                                 soft=status in SOFT_STATUSES, carried=bool(est.carried)))
        elif verbose:
            print(f"  [no-fire] {team}: injured QB '{r.player}' is not established starter '{est.qb}'")
    if unmatched_teams:
        print(f"  [map_team] unmatched covers teams: {sorted(unmatched_teams)}")
    return pd.DataFrame(out_rows)


def self_test() -> None:
    """Plumbing test on 2024 actuals: every established starter, re-fed as an
    abbreviated-name Out row, must fire; a fabricated other name must not."""
    est = build_established(2024, 8, carry_prior=False)
    est = est[est.att >= 50].head(200)
    syn = pd.DataFrame([dict(team=f"{t} Mascots",
                             player=f"{q.split()[0][0]}. {' '.join(q.split()[1:])}",
                             pos="QB", status="Out", detail="test") for t, q in zip(est.team, est.qb)])
    fired = flag_backup_starts(syn, est)
    assert len(fired) == len(syn), f"self-test: {len(fired)}/{len(syn)} fired"
    neg = syn.assign(player="Z. Nonexistent")
    assert flag_backup_starts(neg, est).empty, "self-test: negative rows fired"
    print(f"self-test OK: {len(fired)}/{len(syn)} synthetic starters fire, 0 false positives")


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
        sys.exit(0)
    season, week = int(sys.argv[1]), int(sys.argv[2])
    inj_path = ROOT / "data" / "injuries" / f"cfb_injuries_{season}_w{week}.parquet"
    if not inj_path.exists():
        sys.exit(f"no injury file: {inj_path.name} — run covers_cfb_injuries.py first")
    injuries = pd.read_parquet(inj_path)
    established = build_established(season, week, carry_prior=True)
    fired = flag_backup_starts(injuries, established, verbose=True)
    if fired.empty:
        print("no backup_qb_start triggers this week")
    else:
        print(fired.to_string(index=False))
