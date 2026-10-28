#!/usr/bin/env python3
"""After a THRILLER: the previous game's KenPom ThrillScore x won/lost x where it was played x where the next game is -> next game ATS /
total / ML (owner 2026-10-28). Six seasons, T-60 close. Thriller = previous game's pregame ThrillScore in the top decile of the season (>= ~50)
or >= 70 (showcase); controls are the dull-game deciles. Writes THRILLER_NEXT.txt."""
import io, contextlib, os, numpy as np, pandas as pd, requests
with contextlib.redirect_stdout(io.StringIO()):
    import hangover_wide as H
D, rec = H.D, H.rec
out = open("THRILLER_NEXT.txt", "w")
def P(*a):
    s = " ".join(str(x) for x in a); print(s); out.write(s + "\n"); out.flush()
H.P = P
BB = H.BB
FM = pd.read_parquet(f"{BB}/kenpom_fanmatch.parquet"); FM["date"] = pd.to_datetime(FM.DateOfGame)
sk = os.environ["SUPABASE_SERVICE_KEY"]
mp = pd.DataFrame(requests.get("https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/ncaab_team_mapping?select=api_team_id,KenPom_Name", headers={"apikey": sk, "Authorization": f"Bearer {sk}"}).json())
k2id = dict(zip(mp.KenPom_Name, mp.api_team_id.astype(int)))
FM["home_id"] = FM.Home.map(k2id); FM["vis_id"] = FM.Visitor.map(k2id); FM = FM.dropna(subset=["home_id", "vis_id"])
FM["pair"] = [tuple(sorted((int(a), int(b)))) for a, b in zip(FM.home_id, FM.vis_id)]
fm = FM[["pair", "date", "ThrillScore", "PredTempo"]]
# attach the game's own thrill to every team-game (pair + date, +-1 day), then shift within team-season to get the PREVIOUS game's thrill
D["pair"] = [tuple(sorted((int(a), int(b)))) for a, b in zip(D.teamId, D.opponentId)]
D = D.merge(fm, on=["pair", "date"], how="left")
miss = D.ThrillScore.isna()
alt = D.loc[miss, ["pair", "date"]].copy(); alt["date"] = alt.date + pd.Timedelta(days=1)
fill = alt.merge(fm, on=["pair", "date"], how="left")
D.loc[miss, "ThrillScore"] = fill.ThrillScore.values; D.loc[miss, "PredTempo"] = fill.PredTempo.values
D = D.sort_values(["season_end", "teamId", "date"]); g = D.groupby(["season_end", "teamId"], sort=False)
D["p_thrill"] = g.ThrillScore.shift(1); D["p_tempo"] = g.PredTempo.shift(1)
D["thrill_d"] = D.groupby("season_end").p_thrill.transform(lambda s: pd.qcut(s.rank(method="first"), 10, labels=False) + 1)
H.D = D
P(f"team-games with previous-game thrill: {int(D.p_thrill.notna().sum()):,} of {len(D):,}; top-decile cut by season: " + str(D[D.thrill_d == 10].groupby('season_end').p_thrill.min().round(1).to_dict()))
reg = (D.conf_tourney != 1) & (D.ncaa_t != 1) & (D.p_conf_tourney != 1)
cell = H.cell
def grid(label, base):
    cell(f"{label}", base, p=True, per=True)
    cell(f"   ... and WON it", base & (D.p_win == 1), p=True); cell(f"   ... and LOST it", base & (D.p_win == 0), p=True)
    cell(f"   ... and won by 1-5", base & D.p_margin.between(1, 5)); cell(f"   ... and lost by 1-5", base & D.p_margin.between(-5, -1))
    cell(f"   ... and it went to OT", base & (D.p_went_ot == 1))
    P("   -- where the thriller was played")
    cell(f"   thriller at HOME", base & (D.p_is_home == 1) & (D.p_neutral == 0)); cell(f"   thriller on the ROAD", base & (D.p_is_home == 0) & (D.p_neutral == 0)); cell(f"   thriller NEUTRAL", base & (D.p_neutral == 1))
    cell(f"   won the thriller at HOME", base & (D.p_win == 1) & (D.p_is_home == 1) & (D.p_neutral == 0)); cell(f"   lost the thriller at HOME", base & (D.p_win == 0) & (D.p_is_home == 1) & (D.p_neutral == 0))
    cell(f"   won the thriller on the ROAD", base & (D.p_win == 1) & (D.p_is_home == 0) & (D.p_neutral == 0)); cell(f"   lost the thriller on the ROAD", base & (D.p_win == 0) & (D.p_is_home == 0) & (D.p_neutral == 0))
    P("   -- where the NEXT game is")
    cell(f"   next at HOME", base & (D.is_home == 1) & (D.neutral == 0)); cell(f"   next on the ROAD", base & (D.is_home == 0) & (D.neutral == 0))
    cell(f"   won thriller -> next at HOME", base & (D.p_win == 1) & (D.is_home == 1) & (D.neutral == 0)); cell(f"   won thriller -> next on the ROAD", base & (D.p_win == 1) & (D.is_home == 0) & (D.neutral == 0))
    cell(f"   lost thriller -> next at HOME", base & (D.p_win == 0) & (D.is_home == 1) & (D.neutral == 0)); cell(f"   lost thriller -> next on the ROAD", base & (D.p_win == 0) & (D.is_home == 0) & (D.neutral == 0))
    P("   -- venue of the thriller x venue of the next game")
    for pv, pn in (("HOME", 1), ("ROAD", 0)):
        for nv, nn in (("HOME", 1), ("ROAD", 0)):
            cell(f"   thriller {pv} -> next {nv}", base & (D.p_is_home == pn) & (D.p_neutral == 0) & (D.is_home == nn) & (D.neutral == 0))
            cell(f"      ... won it", base & (D.p_win == 1) & (D.p_is_home == pn) & (D.p_neutral == 0) & (D.is_home == nn) & (D.neutral == 0)); cell(f"      ... lost it", base & (D.p_win == 0) & (D.p_is_home == pn) & (D.p_neutral == 0) & (D.is_home == nn) & (D.neutral == 0))
    P("   -- next game as favorite / dog, rest")
    cell(f"   next as favorite", base & (D.spread < 0)); cell(f"   next as dog", base & (D.spread > 0))
    for gb in ["<=3 days", "4-5 days", "6+ days"]: cell(f"   gap {gb}", base & (D.gap_b == gb))

P("\n=== A. PREVIOUS GAME IN THE TOP THRILL DECILE OF THE SEASON ===")
grid("A top-decile thriller last game", (D.thrill_d == 10) & reg)
P("\n=== B. PREVIOUS GAME A SHOWCASE (ThrillScore >= 70) ===")
grid("B showcase thriller (>= 70) last game", (D.p_thrill >= 70) & reg)
P("\n=== C. CONTROL: previous game in the DULL half (deciles 1-5) ===")
cell("C dull previous game, won it", (D.thrill_d <= 5) & (D.p_win == 1) & reg); cell("C dull previous game, lost it", (D.thrill_d <= 5) & (D.p_win == 0) & reg)
cell("C dull, lost it, next on the ROAD", (D.thrill_d <= 5) & (D.p_win == 0) & (D.is_home == 0) & (D.neutral == 0) & reg); cell("C dull, won it, next at HOME", (D.thrill_d <= 5) & (D.p_win == 1) & (D.is_home == 1) & (D.neutral == 0) & reg)
P("\n=== D. LADDER: previous-game thrill decile -> next game (own ATS %, over %, n) ===")
for d_ in range(1, 11):
    s = D[(D.thrill_d == d_) & reg]; cw, cl = rec(s.cover); uw, ul = rec(s.under)
    w = s[s.p_win == 1]; l = s[s.p_win == 0]
    P(f"  decile {int(d_):>2}: n {len(s):5d} | own ATS {100*cw/(cw+cl):.1f}% | over {100*ul/(uw+ul):.1f}% | after a WIN ATS {100*rec(w.cover)[0]/max(sum(rec(w.cover)),1):.1f}% | after a LOSS ATS {100*rec(l.cover)[0]/max(sum(rec(l.cover)),1):.1f}% | thrill {s.p_thrill.mean():.0f}")
P("\n=== E. BOTH TEAMS' NEXT GAMES: the thriller's two teams meet different opponents -- is the market shading them? ===")
s = D[(D.thrill_d == 10) & reg]; P(f"  after a top-decile thriller: next-game spread {s.spread.mean():+.2f} (winners {s[s.p_win==1].spread.mean():+.2f}, losers {s[s.p_win==0].spread.mean():+.2f}); own ATS margin {s.ats_pts.mean():+.2f}; total line {s.total_line.mean():.1f} vs actual {(s.own_pts+s.opp_pts).mean():.1f}")
out.close()
