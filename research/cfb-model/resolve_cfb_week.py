"""Print 'SEASON WEEK' for the current CFB week (from the CFBD /calendar), so the weekly cron can run the
pipeline unattended:  read S W < <(python3 resolve_cfb_week.py) ; ./run_cfb_week.sh "$S" "$W"

Rules: the week whose [startDate, endDate] contains 'now' (regular preferred over postseason on overlap);
before the season → week 1; between weeks / after the last week → the nearest upcoming (or last) week.
Falls back to (season, 1) if the CFBD calendar for that season isn't loaded yet (offseason)."""
import sys, datetime as dt
import cfbd


def _parse(s):
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


def resolve(now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    # CFB season spans Aug–Jan; from ~July on it's the new season, Jan/Feb is the prior season's postseason.
    season = now.year if now.month >= 7 else now.year - 1
    try:
        cal = cfbd.get("/calendar", year=season) or []
    except Exception:
        cal = []
    if not cal:
        return season, 1
    reg = sorted([c for c in cal if c.get("seasonType") == "regular"], key=lambda c: c["week"])
    post = sorted([c for c in cal if c.get("seasonType") == "postseason"], key=lambda c: c["week"])
    for c in reg + post:                                    # inside a week window (regular wins overlap)
        if _parse(c["startDate"]) <= now <= _parse(c["endDate"]):
            return season, int(c["week"])
    if reg and now < _parse(reg[0]["startDate"]):           # before kickoff → week 1
        return season, 1
    upcoming = [c for c in reg if _parse(c["startDate"]) > now]
    if upcoming:                                            # between weeks → the next one
        return season, int(upcoming[0]["week"])
    return season, int(reg[-1]["week"]) if reg else 1       # season over → last regular week


if __name__ == "__main__":
    s, w = resolve()
    print(f"{s} {w}")
