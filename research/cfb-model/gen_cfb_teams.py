"""Generate cfb_teams (static reference: logos + conference) for every team in the 2025 slate + all model_games
teams, so home_team/away_team in cfb_dryrun_games join cleanly. Public-read; full wipe + reload."""
import pandas as pd
import dry_common as C

gm = pd.read_parquet("data/model_games.parquet")
P5 = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
teams = sorted(set(gm.homeTeam) | set(gm.awayTeam))
logo, logo_d, abbr = C.team_maps(); conf = C.conf_maps()
rows = []
for t in teams:
    c = conf.get(t)
    rows.append({"team_name": t, "abbr": abbr.get(t) if isinstance(abbr.get(t), str) and abbr.get(t) != "#N/A" else t,
                 "conference": c, "classification": "P5" if c in P5 else ("FBS" if c else None),
                 "color": None, "alt_color": None, "logo": logo.get(t), "logo_dark": logo_d.get(t)})
df = pd.DataFrame(rows)
print(f"cfb_teams rows: {len(df)} | with logo: {df.logo.notna().sum()} | with conf: {df.conference.notna().sum()}")
C.wipe("cfb_teams", "team_name=not.is.null")
C.insert("cfb_teams", df)
