"""Coach blowout-management study — how coaches behave when up big.

GARBAGE TIME INCLUDED by design (the study is garbage time). All states are
defined at DRIVE START from the drive's own start scores — the score when the
coach sends the offense out is the cleanest read of what posture he chose.

Behavior metrics, each vs the coach's OWN neutral-game baseline:
  tempo_delta    sec/play on big-lead 2H drives minus own neutral sec/play (+ = slows down)
  pass_delta     early-down pass rate up big minus own neutral pass rate (+ = keeps throwing)
  starter_share  share of 4Q dropbacks up 21+ taken by the game's starting QB
  pts_drive_big  points per drive on 2H drives starting up 21+
  go4_big        4th-and-<=3 go rate while up 14+ in 2H
  expansion      final margin minus margin when the team FIRST reached +21 (+ = kept scoring)
  hammer         composite z-score (+ = keeps hammering; - = calls off the dogs)

States: BIG = drive starts with lead >= 21 in 2H. NEUTRAL = |lead| <= 7, periods 1-3.
End-of-half/game kneel drives excluded everywhere (universal, not discretionary).
Cupcake = FCS opponent, or pregame Elo edge >= 250. Lines context (betting section
only) comes from odds_game_frame.parquet — the Odds API, never CFBD lines.
"""
import os, re, sys
import numpy as np, pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data", "cfbd")
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)
SEASONS = [2021, 2022, 2023, 2024, 2025]

BIG, MEGA, NEUTRAL_BAND, ELO_CUPCAKE = 21, 28, 7, 250
MIN_BIG_DRIVES = 25          # pooled qualification for the main ranking
MIN_BIG_DRIVES_EARLY = 10    # weeks 1-3 subset

# ---------------- load ----------------
games = pd.concat([pd.read_parquet(f"{DATA}/games_{y}.parquet") for y in SEASONS], ignore_index=True)
games = games[games.seasonType == "regular"]
drives = pd.concat([pd.read_parquet(f"{DATA}/drives_{y}.parquet") for y in SEASONS], ignore_index=True)
plays = pd.concat([pd.read_parquet(f"{DATA}/plays_{y}.parquet") for y in SEASONS], ignore_index=True)
coach = pd.read_parquet(f"{DATA}/coach_seasons.parquet")
print(f"loaded: {len(games)} games, {len(drives)} drives, {len(plays)} plays")

# majority coach per team-season (midseason firings -> attribute to the longer stint)
coach = coach.sort_values("games", ascending=False).drop_duplicates(["year", "school"])
c_map = dict(zip(zip(coach.year, coach.school), coach.coach))

# game meta: classification + pregame elo per side
gm = games.set_index("id")
def opp_meta(gid, team):
    g = gm.loc[gid]
    if g.homeTeam == team:
        return g.awayTeam, g.awayClassification, g.homePregameElo, g.awayPregameElo, g.homePoints - g.awayPoints
    return g.homeTeam, g.homeClassification, g.awayPregameElo, g.homePregameElo, g.awayPoints - g.homePoints

# ---------------- drive frame ----------------
d = drives.copy()
d = d[d.gameId.isin(gm.index)]
d["lead_start"] = d.startOffenseScore - d.startDefenseScore
d["drive_pts"] = (d.endOffenseScore - d.startOffenseScore).clip(0, 8)
d["sec_play"] = np.where((d.plays > 0) & (d.elapsed_sec > 0), d.elapsed_sec / d.plays, np.nan)
d.loc[d.sec_play > 90, "sec_play"] = np.nan
kneel = d.driveResult.fillna("").str.upper().str.contains("END OF") & (d.plays <= 3)
d = d[~kneel]
d["coach"] = [c_map.get((s, t)) for s, t in zip(d.season, d.offense)]
d = d.dropna(subset=["coach"])
d["is_big"] = (d.lead_start >= BIG) & (d.startPeriod >= 3)
d["is_neutral"] = (d.lead_start.abs() <= NEUTRAL_BAND) & (d.startPeriod <= 3)

# opponent context per (game, offense)
gkeys = d[["gameId", "offense", "season", "week"]].drop_duplicates()
meta = gkeys.apply(lambda r: opp_meta(r.gameId, r.offense), axis=1, result_type="expand")
meta.columns = ["opp", "opp_class", "own_elo", "opp_elo", "final_margin"]
gkeys = pd.concat([gkeys.reset_index(drop=True), meta.reset_index(drop=True)], axis=1)
gkeys["cupcake"] = (gkeys.opp_class == "fcs") | ((gkeys.own_elo - gkeys.opp_elo) >= ELO_CUPCAKE)
d = d.merge(gkeys[["gameId", "offense", "opp", "cupcake", "final_margin"]], on=["gameId", "offense"], how="left")

# ---------------- play frame ----------------
p = plays.copy()
p = p[p.gameId.isin(gm.index)]
pt = p.playType.fillna("")
p["is_pass"] = pt.str.contains("Pass|Sack|Interception", regex=True)
p["is_rush"] = pt.str.contains("Rush")
p = p[p.is_pass | p.is_rush]
# join drive-start lead via (gameId, driveNumber)
p = p.merge(d[["gameId", "driveNumber", "offense", "lead_start", "startPeriod", "is_big", "is_neutral", "cupcake"]],
            on=["gameId", "driveNumber", "offense"], how="inner")
p["coach"] = [c_map.get((s, t)) for s, t in zip(p.season, p.offense)]
p = p.dropna(subset=["coach"])
# early-down, outside 2-minute situations -> discretionary play-calling only
disc = (p.down.isin([1, 2])) & ~((p.period.isin([2, 4])) & (p.clock_sec <= 120))

# QB extraction from playText
qb_re = re.compile(r"^([A-Za-z'.\-]+(?: [A-Za-z'.\-]+){0,2}?) (?:pass|sacked)")
def qb_of(txt):
    m = qb_re.match(str(txt))
    return m.group(1) if m else None
dropbacks = p[p.is_pass].copy()
dropbacks["qb"] = dropbacks.playText.map(qb_of)
dropbacks = dropbacks.dropna(subset=["qb"])
# starter = QB with most 1H dropbacks in that game for that team
h1 = dropbacks[dropbacks.period <= 2]
starter = (h1.groupby(["gameId", "offense", "qb"]).size().rename("n").reset_index()
             .sort_values("n", ascending=False).drop_duplicates(["gameId", "offense"]))
starter_map = dict(zip(zip(starter.gameId, starter.offense), starter.qb))
q4big = dropbacks[(dropbacks.period == 4) & (dropbacks.lead_start >= BIG)].copy()
q4big["is_starter"] = [starter_map.get((g, o)) == q for g, o, q in zip(q4big.gameId, q4big.offense, q4big.qb)]

# 4th-and-short go decisions while up 14+ in 2H (punts/FGs are non-scrimmage, so
# measure via ALL 4th-down snaps in raw plays)
p4 = plays[plays.gameId.isin(gm.index)].copy()
p4 = p4[(p4.down == 4)]
p4 = p4.merge(d[["gameId", "driveNumber", "offense", "lead_start", "startPeriod"]],
              on=["gameId", "driveNumber", "offense"], how="inner")
p4 = p4[(p4.lead_start >= 14) & (p4.startPeriod >= 3) & (p4.distance <= 3)]
pt4 = p4.playType.fillna("")
p4 = p4[~pt4.str.contains("Timeout|Penalty|End")]
p4["went"] = pt4.str.contains("Pass|Rush|Sack|Interception")
p4["coach"] = [c_map.get((s, t)) for s, t in zip(p4.season, p4.offense)]

# ---------------- margin expansion (game level) ----------------
seq = d.sort_values(["gameId", "driveNumber"])
first_big = (seq[seq.lead_start >= BIG].groupby(["gameId", "offense"])
             .first().reset_index()[["gameId", "offense", "lead_start"]]
             .rename(columns={"lead_start": "margin_at_big"}))
exp = first_big.merge(gkeys[["gameId", "offense", "final_margin", "cupcake", "season", "week"]],
                      on=["gameId", "offense"], how="left")
exp["expansion"] = exp.final_margin - exp.margin_at_big
exp["coach"] = [c_map.get((s, t)) for s, t in zip(exp.season, exp.offense)]
exp = exp.dropna(subset=["coach"])

# ---------------- aggregate per coach ----------------
def coach_table(dd, pp, qq, ee, p44, min_drives):
    """pp must already be filtered to discretionary snaps (early down, no 2-min)."""
    tempo_big = dd[dd.is_big].groupby("coach").sec_play.median()
    tempo_neu = dd[dd.is_neutral].groupby("coach").sec_play.median()
    n_big = dd[dd.is_big].groupby("coach").size()
    pts_big = dd[dd.is_big].groupby("coach").drive_pts.mean()
    pr_big = pp[pp.is_big].groupby("coach").is_pass.mean()
    pr_neu = pp[pp.is_neutral].groupby("coach").is_pass.mean()
    st = qq.groupby("coach").is_starter.agg(["mean", "size"])
    ex = ee.groupby("coach").expansion.agg(["median", "size"])
    g4 = p44.groupby("coach").went.agg(["mean", "size"])
    t = pd.DataFrame({
        "n_big_drives": n_big, "tempo_big": tempo_big, "tempo_neutral": tempo_neu,
        "tempo_delta": tempo_big - tempo_neu,
        "pass_big": pr_big, "pass_neutral": pr_neu, "pass_delta": pr_big - pr_neu,
        "starter_share_q4": st["mean"], "n_q4_dropbacks": st["size"],
        "pts_drive_big": pts_big,
        "expansion_med": ex["median"], "n_big_games": ex["size"],
        "go4_rate": g4["mean"], "n_go4": g4["size"],
    })
    t = t[t.n_big_drives >= min_drives].copy()
    # starter share is meaningless on a handful of dropbacks (option teams barely
    # throw up big) — mask it so the composite's NaN-skipping mean ignores it
    t.loc[t.n_q4_dropbacks < 10, "starter_share_q4"] = np.nan
    z = lambda s: (s - s.mean()) / s.std()
    t["hammer"] = pd.concat([z(-t.tempo_delta), z(t.pass_delta), z(t.starter_share_q4),
                             z(t.pts_drive_big), z(t.expansion_med)], axis=1).mean(axis=1)
    return t.sort_values("hammer", ascending=False)

# discretionary filter is positional — rebuild pp subsets carrying it
p_disc = p[disc]

full = coach_table(d, p_disc, q4big, exp, p4, MIN_BIG_DRIVES)
full.to_csv(f"{OUT}/coach_blowout_full.csv")
print(f"\nFULL SAMPLE ({len(full)} qualified coaches, >= {MIN_BIG_DRIVES} big-lead 2H drives)")
print(full.head(15).round(2).to_string())
print("\n--- bottom 10 (calls off the dogs) ---")
print(full.tail(10).round(2).to_string())

# early season, cupcake opponents — the owner's focus cut
d_e = d[(d.week <= 3) & d.cupcake.fillna(False)]
p_e = p_disc[(p_disc.week <= 3) & p_disc.cupcake.fillna(False)]
q_e = q4big[(q4big.week <= 3) & q4big.cupcake.fillna(False)]
e_e = exp[(exp.week <= 3) & exp.cupcake.fillna(False)]
p4_e = p4[p4.week <= 3]
early = coach_table(d_e, p_e, q_e, e_e, p4_e, MIN_BIG_DRIVES_EARLY)
early.to_csv(f"{OUT}/coach_blowout_early.csv")
print(f"\nEARLY SEASON wks1-3 vs CUPCAKES ({len(early)} coaches, >= {MIN_BIG_DRIVES_EARLY} big drives)")
print(early.head(15).round(2).to_string())

# per-season hammer for stability
per_season = []
for y in SEASONS:
    ty = coach_table(d[d.season == y], p_disc[p_disc.season == y], q4big[q4big.season == y],
                     exp[exp.season == y], p4[p4.season == y], 8)
    ty["season"] = y
    per_season.append(ty[["hammer", "season", "n_big_drives"]])
ps = pd.concat(per_season).reset_index()
ps.to_csv(f"{OUT}/coach_blowout_by_season.csv", index=False)
piv = ps.pivot_table(index="coach", columns="season", values="hammer")
multi = piv.dropna(thresh=3)
cors = []
for c in multi.index:
    v = piv.loc[c].dropna()
    for y in v.index:
        others = v.drop(y).mean()
        cors.append((v[y], others))
ca = pd.DataFrame(cors, columns=["season_z", "other_mean"])
print(f"\nSTABILITY: {len(multi)} coaches w/ 3+ seasons; season-vs-rest corr = "
      f"{ca.season_z.corr(ca.other_mean):+.3f} (n={len(ca)} coach-seasons)")
print("done")
