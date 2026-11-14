#!/usr/bin/env python3
"""After a HUGE game, how does a team do next week on the spread and the 1H spread?
Owner question 2026-09-21 (Ole Miss over LSU: ranked-vs-ranked, rivalry, national TV).

"Huge" = previous game was any of: vs an AP-ranked opponent, both teams ranked, a named rivalry
(data/cfb_rivalries.csv, hand-built ~95 pairs), on national broadcast TV (CFBD media: ABC/CBS/FOX/NBC
or ESPN main), or a Saturday-night primetime kick. Split by whether the team WON or LOST it, and by
favorite/underdog in that game (upset win vs expected win, upset loss vs expected loss).

Outcome = NEXT game ATS vs the OPENER (repo law) and vs the T-60 close, plus the 1H spread vs its
close (cfb_markets_2325, 2023-25 only). Per-season lines, blind base rate, z vs base, and a
shuffle null (same trigger counts, random team-games) for the headline cells.
Seasons 2021-2025, FBS games with a market (model_games)."""
import numpy as np, pandas as pd
from scipy.stats import norm

mg = pd.read_parquet("data/model_games.parquet")
mg = mg[mg.season.between(2021, 2025) & mg.spread_open.notna() & mg.actual_margin.notna()].copy()
mg["date"] = pd.to_datetime(mg.date, utc=True)
media = pd.read_parquet("data/cfbd/media_2021_2025.parquet")
NATIONAL = {"ABC", "CBS", "FOX", "NBC", "ESPN"}
tv = media[(media.mediaType == "tv")].groupby("id").outlet.agg(lambda s: bool(set(s) & NATIONAL))
mg["national_tv"] = mg.game_id.map(tv).fillna(False).astype(bool)
riv = pd.read_csv("data/cfb_rivalries.csv")
RIV = {frozenset((a, b)) for a, b in zip(riv.team_a, riv.team_b)}
mg["rivalry"] = [frozenset((h, a)) in RIV for h, a in zip(mg.homeTeam, mg.awayTeam)]
mk = pd.read_parquet("data/cfb_markets_2325.parquet")[["game_id", "team", "h1_spread", "h1_covered", "team_h1", "opp_h1"]]

rows = []
for hm in (True, False):
    s = 1 if hm else -1
    rows.append(pd.DataFrame(dict(
        game_id=mg.game_id, season=mg.season, week=mg.week, date=mg.date,
        team=mg.homeTeam if hm else mg.awayTeam, opp=mg.awayTeam if hm else mg.homeTeam, is_home=hm,
        own_rank=mg.home_self_rank if hm else mg.away_self_rank, opp_rank=mg.away_self_rank if hm else mg.home_self_rank,
        sp_open=mg.spread_open * s, sp_close=mg.spread_close * s, margin=mg.actual_margin * s,
        primetime=mg.primetime.fillna(0).astype(int).astype(bool), national_tv=mg.national_tv, rivalry=mg.rivalry,
        conf_game=mg.conferenceGame.fillna(False).astype(bool))))
p = pd.concat(rows, ignore_index=True).sort_values(["team", "season", "date"]).reset_index(drop=True)
p = p.merge(mk, on=["game_id", "team"], how="left")
p["won"] = p.margin > 0; p["cover_open"] = np.sign(p.margin + p.sp_open); p["cover_close"] = np.sign(p.margin + p.sp_close)
p["fav"] = p.sp_close < 0
p["opp_ranked"] = p.opp_rank.notna() & (p.opp_rank <= 25); p["both_ranked"] = p.opp_ranked & p.own_rank.notna() & (p.own_rank <= 25)
p["huge"] = p.opp_ranked | p.rivalry | p.national_tv
p["h1_cover"] = np.where(p.h1_covered.isna(), np.nan, p.h1_covered.astype(float))
# previous game (same season) for each team-game
prev_cols = ["huge", "opp_ranked", "both_ranked", "rivalry", "national_tv", "primetime", "won", "fav", "margin", "cover_close", "conf_game"]
for c in prev_cols: p["prev_" + c] = p.groupby(["team", "season"])[c].shift(1)
p["prev_upset_win"] = (p.prev_won == True) & (p.prev_fav == False)
p["prev_expected_win"] = (p.prev_won == True) & (p.prev_fav == True)
p["prev_upset_loss"] = (p.prev_won == False) & (p.prev_fav == True)
p["prev_expected_loss"] = (p.prev_won == False) & (p.prev_fav == False)

base = p[p.cover_open != 0]; b_open = (base.cover_open > 0).mean(); b_close = (base[base.cover_close != 0].cover_close > 0).mean()
b_h1 = base.h1_cover.mean()
print(f"team-games {len(p)} | blind next-game cover: open {100*b_open:.1f}%  close {100*b_close:.1f}%  1H {100*b_h1:.1f}% (2023-25, n={int(base.h1_cover.notna().sum())})\n")

def rep(name, mask):
    s = p[mask & (p.cover_open != 0)]
    if len(s) < 25: print(f"{name:48s} n={len(s):4d}  (too few)"); return
    o = (s.cover_open > 0).mean(); c = (s[s.cover_close != 0].cover_close > 0).mean()
    h = s.h1_cover.mean(); nh = int(s.h1_cover.notna().sum())
    z = (o - b_open) * 2 * np.sqrt(len(s))
    per = " ".join(f"{yr}:{100*(x.cover_open>0).mean():.0f}%({len(x)})" for yr, x in s.groupby("season"))
    print(f"{name:48s} n={len(s):4d}  ATS open {100*o:.1f}% z{z:+.1f} | close {100*c:.1f}% | 1H {100*h:.1f}% (n={nh})   {per}")

print("=== NEXT GAME after a HUGE game (ranked opp / rivalry / national TV), by result ===")
rep("after HUGE game, any result", p.prev_huge == True)
rep("  after HUGE WIN", (p.prev_huge == True) & (p.prev_won == True))
rep("    huge win as UNDERDOG (upset)", (p.prev_huge == True) & p.prev_upset_win)
rep("    huge win as FAVORITE", (p.prev_huge == True) & p.prev_expected_win)
rep("    huge win by 14+", (p.prev_huge == True) & (p.prev_won == True) & (p.prev_margin >= 14))
rep("    huge win by 1-7", (p.prev_huge == True) & (p.prev_won == True) & (p.prev_margin <= 7))
rep("  after HUGE LOSS", (p.prev_huge == True) & (p.prev_won == False))
rep("    huge loss as FAVORITE (upset loss)", (p.prev_huge == True) & p.prev_upset_loss)
rep("    huge loss as UNDERDOG", (p.prev_huge == True) & p.prev_expected_loss)
rep("    huge loss by 14+", (p.prev_huge == True) & (p.prev_won == False) & (p.prev_margin <= -14))
rep("    huge loss by 1-7", (p.prev_huge == True) & (p.prev_won == False) & (p.prev_margin >= -7))
print("\n=== by WHAT made it huge ===")
for flag, lab in [("prev_both_ranked", "both ranked"), ("prev_opp_ranked", "opp ranked"), ("prev_rivalry", "rivalry"), ("prev_national_tv", "national TV"), ("prev_primetime", "Sat primetime")]:
    rep(f"{lab}: WON", (p[flag] == True) & (p.prev_won == True))
    rep(f"{lab}: LOST", (p[flag] == True) & (p.prev_won == False))
print("\n=== the Ole Miss shape: ranked-vs-ranked RIVALRY game, on national TV ===")
big3 = (p.prev_both_ranked == True) & (p.prev_rivalry == True)
rep("both ranked + rivalry: WON", big3 & (p.prev_won == True))
rep("both ranked + rivalry: LOST", big3 & (p.prev_won == False))
rep("both ranked + national TV: WON", (p.prev_both_ranked == True) & (p.prev_national_tv == True) & (p.prev_won == True))
rep("both ranked + national TV: LOST", (p.prev_both_ranked == True) & (p.prev_national_tv == True) & (p.prev_won == False))
print("\n=== control: after an ORDINARY game (none of the above) ===")
rep("ordinary game: WON", (p.prev_huge == False) & (p.prev_won == True))
rep("ordinary game: LOST", (p.prev_huge == False) & (p.prev_won == False))
print("\n=== does the next-game LINE already price it? (mean team-relative opener next game) ===")
for lab, m in [("after huge win", (p.prev_huge == True) & (p.prev_won == True)), ("after huge loss", (p.prev_huge == True) & (p.prev_won == False)), ("after ordinary win", (p.prev_huge == False) & (p.prev_won == True))]:
    s = p[m & p.sp_open.notna()]; print(f"  {lab:20s} mean opener {s.sp_open.mean():+.1f} | open->close move {(s.sp_close - s.sp_open).mean():+.2f} (negative = market moved TOWARD the team)")
# shuffle null for the two headline cells
rng = np.random.default_rng(0)
for lab, m in [("after HUGE WIN", (p.prev_huge == True) & (p.prev_won == True)), ("after HUGE LOSS", (p.prev_huge == True) & (p.prev_won == False))]:
    s = p[m & (p.cover_open != 0)]; obs = (s.cover_open > 0).mean(); pool = base.cover_open.values
    nulls = np.array([(rng.choice(pool, len(s)) > 0).mean() for _ in range(2000)])
    print(f"  null {lab}: observed {100*obs:.1f}% vs random same-n {100*nulls.mean():.1f}% ± {100*nulls.std():.1f}  (p two-sided {2*min((nulls>=obs).mean(), (nulls<=obs).mean()):.3f})")
p.to_parquet("data/_big_game_hangover_panel.parquet", index=False)

# ---------------------------------------------------------------------------------------------
# RESULT (2026-09-21): the "huge game" hangover is NULL on the full-game spread — after a huge
# win 49.9%, after a huge loss 50.3% (n=1114 / 1355), shuffle p≈1; upset wins 46.9% (n=320,
# z −1.1) is the only lean and it is inside noise. Both-ranked + rivalry cells are too small.
# What IS there is the SATURDAY-NIGHT PRIMETIME hangover, regardless of result:
#   next game FG ATS vs opener 46.8% (n=1294, 5/5 seasons ≤49%, null p=.016) → fade 53.2%
#   next game 1H spread        42.6% (n=784, 2023-25: 47/40/41, null p<.0001)  → fade 57.4%
#   after a primetime WIN the 1H is 40.9% (n=394, 46/39/38); 8+ days rest 39.9% (n=228)
#   control: after a Saturday AFTERNOON game 50.9% / 50.8%; after non-Saturday 51.2% / 48.5%
# Mechanism guess: late Saturday kick → short recovery + slow start; the 1H carries it.
# STATUS: CANDIDATE (post-hoc cut on a pre-existing feature) — paper-track before any stake.
# Rebuild media: cfbd.get("/games/media", year, seasonType) -> data/cfbd/media_2021_2025.parquet.
# ---------------------------------------------------------------------------------------------
