"""Fantasy Points table loader that survives a fresh Render clone.

fp_pull.py's consolidate() rebuilds data/fpdata/<tool>__<scope>.parquet from the raw cells on the
job's OWN disk, so on Render a table holds only the weeks that job pulled (this season). The
prior season lives in data/fpdata_hist/ — git-tracked copies of the tables the weekly report
builders need (nfl_matchup_facts.py, nfl_prop_narratives.py, player_chain.py). read_fp() merges
hist + current, the freshly pulled cell winning on overlap, so the same code runs identically on a
laptop with full history and on Render with hist + this season.

Adding a table to a builder: copy it into data/fpdata_hist (same relative path, flat/ included)
and `git add -f` it — research/.gitignore excludes *.parquet by default."""
import os
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
KEYS = ("__season", "__week", "playerPlayerId", "teamNickname", "teamTeamId", "gameGameId")


# Tables whose CURRENT-season rows arrive from fp_pull under a different file name than the
# historical copy. fp_pull's consolidate() writes `<tool>__<scope>.parquet` (camelCase); a few
# tracked hist tables came from an older hyphenated export. Without the alias the hist copy is
# the only source on Render and silently freezes as the season goes on — and when the hist copy
# is also missing the builder just dies (score_props_week, 2026-09-22). Verified before adding:
# the two files' stat values are identical on every overlapping (player, week).
ALIAS = {
    "player_receiving-separation-by-alignment": "receivingSeparationByAlignment__player",
}


def read_fp(table, flat=False):
    parts = []
    names = [table] + ([ALIAS[table]] if table in ALIAS and not flat else [])
    for base in ("data/fpdata_hist", "data/fpdata"):
        for name in names:
            p = os.path.join(HERE, base, "flat" if flat else "", name + ".parquet")
            if os.path.exists(p):
                parts.append(pd.read_parquet(p))
    if not parts:
        raise FileNotFoundError(f"{table}.parquet not in data/fpdata or data/fpdata_hist")
    d = pd.concat(parts, ignore_index=True)
    keys = [c for c in KEYS if c in d.columns]
    return d.drop_duplicates(subset=keys, keep="last") if keys else d
