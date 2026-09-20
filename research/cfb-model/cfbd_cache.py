"""CFBD cache policy (2026-09-20). Past seasons are immutable — cache on file existence. The LIVE season changes every
week (scores, advanced box scores, lines, weather, Elo, rankings, talent), so its files are refetched when older than
MAX_AGE_H. Before this, every fetcher cached on `os.path.exists` and the 2026 files were 0-row stubs from July: the ratings
builder skipped 2026, and the week-4 model predicted its baseline (+4.4 to +6.3 for every game)."""
import datetime as dt, os
MAX_AGE_H = 6.0
def live_season():
    env = os.environ.get("CFB_SEASON")
    if env: return int(env)
    t = dt.date.today(); return t.year if t.month >= 7 else t.year - 1
def stale(path, year, max_age_h=MAX_AGE_H):
    if not os.path.exists(path): return True
    if int(year) < live_season(): return False
    return (dt.datetime.now().timestamp() - os.path.getmtime(path)) > max_age_h * 3600
