"""Pull the player-level + injury tables we already had in the DB but never used."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch import fetch_table, cache, DATA
for name, tbl, order in [
    ("ngs_passing", "nfl_ngs_passing_raw", "season,week"),
    ("ngs_receiving", "nfl_ngs_receiving_raw", "season,week"),
    ("ngs_rushing", "nfl_ngs_rushing_raw", "season,week"),
    ("injuries_raw", "nfl_injuries_raw", "season,week"),
    ("pregame_injuries", "nfl_pregame_injuries_team_week", "season,week"),
    ("ftn_charting", "nfl_ftn_charting_raw", "season,week"),
]:
    cache(name, lambda t=tbl, o=order: fetch_table(t, order=o))
print("done")
