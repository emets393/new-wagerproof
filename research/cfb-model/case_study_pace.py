"""
CASE STUDY (hypothesis generation): 3 teams of distinct styles in 2025. For every game, show the team's
possessions/tempo/run-rate/TOP and the DEVIATION from their season norm, vs the OPPONENT'S archetype.
Question: do they adapt (run more / slow down / fewer possessions) based on the opponent's style?
Teams: Army (slow/run/ball-control), Oklahoma (balanced), Florida Atlantic (fast/pass/no-huddle).
"""
import pandas as pd, numpy as np
import archetypes as AR

YEAR = 2025
box = pd.read_parquet(f"data/cfbd/teamgame_box_{YEAR}.parquet")
ga = pd.read_parquet(f"data/cfbd/game_advanced_{YEAR}.parquet"); ga = ga[ga.seasonType == "regular"]
games = pd.read_parquet(f"data/cfbd/games_{YEAR}.parquet")
out, tg, AX = AR.build_archetypes()   # per-game archetype tags
out = out[out.season == YEAR]

box["run_rate"] = box.rush_att / (box.rush_att + box.pass_att)
box["sec_play"] = box.poss_secs / box.plays
dr = ga[["gameId", "team", "offense.drives"]].rename(columns={"gameId": "game_id", "offense.drives": "drives"})
box = box.merge(dr, on=["game_id", "team"], how="left")

# opponent + week from games
glong = []
for _, r in games[games.seasonType == "regular"].iterrows():
    glong.append({"game_id": r.id, "week": r.week, "team": r.homeTeam, "opp": r.awayTeam})
    glong.append({"game_id": r.id, "week": r.week, "team": r.awayTeam, "opp": r.homeTeam})
gl = pd.DataFrame(glong)
box = box.merge(gl, on=["game_id", "team"], how="left")

# opponent archetype: from out (per game home/away tags), get the OPP side's tags
def opp_tags(game_id, opp):
    row = out[out.game_id == game_id]
    if not len(row): return {}
    row = row.iloc[0]
    side = "home" if row.homeTeam == opp else ("away" if row.awayTeam == opp else None)
    if side is None: return {}
    return {"opp_off": row[f"{side}_A_style"], "opp_tempo": row[f"{side}_A_tempo"],
            "opp_pass": row[f"{side}_A_pass"], "opp_runD": row[f"{side}_D_run"], "opp_front7": row[f"{side}_D_front7"]}

def show(team):
    t = box[(box.team == team) & box.week.notna() & box.plays.notna()].sort_values("week").copy()
    norm = {c: t[c].mean() for c in ["drives", "sec_play", "run_rate", "poss_secs", "plays", "points"]}
    print(f"\n{'='*108}\n{team} 2025 — season norm: drives {norm['drives']:.1f}, sec/play {norm['sec_play']:.1f}, "
          f"run% {100*norm['run_rate']:.0f}, TOP {norm['poss_secs']/60:.1f}min, plays {norm['plays']:.0f}, pts {norm['points']:.1f}\n{'='*108}")
    print(f"{'wk':>2} {'opponent':<20}{'oppOFF':<11}{'oppTempo':<10}{'oppRunD':<10}{'drv':>5}{'sec/p':>6}{'run%':>6}{'TOP':>6}{'pts':>5}  vs-norm(drv/sec/run%)")
    for _, r in t.iterrows():
        ot = opp_tags(r.game_id, r.opp)
        dd = r.drives - norm["drives"]; ds = r.sec_play - norm["sec_play"]; dr_ = 100*(r.run_rate - norm["run_rate"])
        print(f"{int(r.week):>2} {str(r.opp)[:20]:<20}{str(ot.get('opp_off','?'))[:10]:<11}{str(ot.get('opp_tempo','?'))[:9]:<10}"
              f"{str(ot.get('opp_runD','?'))[:9]:<10}{r.drives:>5.0f}{r.sec_play:>6.1f}{100*r.run_rate:>6.0f}{r.poss_secs/60:>6.1f}{r.points:>5.0f}"
              f"   {dd:+.0f}/{ds:+.1f}/{dr_:+.0f}")

for tm in ["Army", "Oklahoma", "Florida Atlantic"]:
    show(tm)
