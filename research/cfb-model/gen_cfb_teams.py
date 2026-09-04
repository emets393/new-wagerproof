"""Generate cfb_teams (static reference: logos + conference + colors) covering EVERY FBS
program plus any team appearing in the model frames (FCS opponents included), so
home_team/away_team in cfb_slate_games always join. Public-read; full wipe + reload.

Team list = CFBD /teams FBS (owner 2026-08-11: 94 rows was a Render-era regression —
model_games on a fresh disk holds only the current week's slate, so any team not playing
that week had NO row) ∪ current model_games ∪ the committed historical frame.
Colors come from CFBD (color/alternateColor) — they were hard-coded None before, which
left every client rendering fallback team colors."""
import os
import pandas as pd
import dry_common as C
import cfbd

SEASON, _ = C.season_week()
gm = pd.read_parquet("data/model_games.parquet")
teams = set(gm.homeTeam) | set(gm.awayTeam)
hp = "data/model_games_hist.parquet"
if os.path.exists(hp):
    h = pd.read_parquet(hp)
    teams |= set(h.homeTeam) | set(h.awayTeam)

api = {}
try:
    for t in cfbd.get("/teams", year=SEASON):
        api[t["school"]] = t
    teams |= {s for s, t in api.items() if (t.get("classification") or "").lower() == "fbs"}
except Exception as e:
    print(f"[teams] CFBD /teams fetch failed ({e}) — falling back to frame teams only")

P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
logo, logo_d, abbr = C.team_maps(); conf = C.conf_maps()
rows = []
for t in sorted(teams):
    a = api.get(t, {})
    c = a.get("conference") or conf.get(t)
    cls = (a.get("classification") or "").lower()
    rows.append({"team_name": t,
                 "abbr": (a.get("abbreviation") or (abbr.get(t) if isinstance(abbr.get(t), str) and abbr.get(t) != "#N/A" else None) or t),
                 "conference": c,
                 "classification": "P5" if c in P5 else ("FBS" if cls == "fbs" or c else None),
                 "color": a.get("color"), "alt_color": a.get("alternateColor"),
                 "logo": logo.get(t), "logo_dark": logo_d.get(t)})
df = pd.DataFrame(rows)
print(f"cfb_teams rows: {len(df)} | with logo: {df.logo.notna().sum()} | with conf: {df.conference.notna().sum()} | with color: {df.color.notna().sum()}")
C.wipe("cfb_teams", "team_name=not.is.null")
C.insert("cfb_teams", df)
