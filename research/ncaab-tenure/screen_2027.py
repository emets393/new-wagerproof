import os, json, re, numpy as np, pandas as pd, requests
pd.set_option("display.width", 250); pd.set_option("display.max_columns", 40); pd.set_option("display.max_rows", 400)
env = dict(l.strip().split("=",1) for l in open(os.path.expanduser("~/Documents/new-wagerproof/.env.local")) if "=" in l and not l.startswith("#"))
SB = "https://jpxnjuwglavsjbgbasnl.supabase.co"; SH = {"apikey": env["SUPABASE_SERVICE_KEY"].strip(), "Authorization": f"Bearer {env['SUPABASE_SERVICE_KEY'].strip()}"}
B = os.path.expanduser("~/Documents/new-wagerproof/research/bball-odds/data/parquet/")
POWER = {"ACC", "Big 12", "Big Ten", "SEC", "Big East", "Pac-12"}
# ---------------------------------------------------------------- player history 2021..2026 (+ 2027 box so far)
pb = pd.read_parquet(B + "cbbd_player_box.parquet", columns=["gameId", "season", "startDate", "teamId", "athleteSourceId", "minutes"]).dropna(subset=["athleteSourceId"])
pb["pid"] = pb.athleteSourceId.astype("int64"); pb["startDate"] = pd.to_datetime(pb.startDate, utc=True)
bx27 = pd.read_parquet("box_2027.parquet"); bx27["pid"] = pd.to_numeric(bx27.athleteSourceId, errors="coerce"); bx27 = bx27.dropna(subset=["pid"]); bx27["pid"] = bx27.pid.astype("int64")
bx27["startDate"] = pd.to_datetime(bx27.startDate, utc=True)
ps = pb[pb.minutes > 0].groupby(["season", "teamId", "pid"]).minutes.sum().reset_index()
def hist_for(S):
    prev = ps[ps.season < S]
    d1 = prev.groupby("pid").season.nunique().rename("d1_prev")
    here = prev.groupby(["teamId", "pid"]).season.nunique().rename("here_prev").reset_index()
    pm = prev[prev.season == S - 1].groupby("pid").minutes.sum().rename("prior_min")
    return d1, here, pm
def metrics(g, wcol):
    w = g[wcol].values.astype(float); tot = w.sum()
    if tot <= 0: return pd.Series(dict(upper=np.nan, core=np.nan, fresh=np.nan, n=0))
    f = lambda m: float((w * m).sum() / tot)
    return pd.Series(dict(upper=f(g.d1_prev.values >= 2), core=f(g.here_prev.values >= 2), fresh=f(g.d1_prev.values == 0), n=int((w > 0).sum())))
# ---------------------------------------------------------------- 1. historical re-grade of the cell under PRESEASON weighting (roster, prior minutes, freshman default)
ros = pd.read_parquet(os.path.expanduser("~/Documents/new-wagerproof/research/ncaab-hype/data/cbbd_rosters.parquet")); ros["pid"] = pd.to_numeric(ros.sourceId, errors="coerce")
rows = []
for S in [2023, 2024, 2025]:                                    # 2026 roster cache is half-complete -> skip for the calibration
    d1, here, pm = hist_for(S)
    r = ros[ros.season == S][["teamId", "pid"]].drop_duplicates().merge(d1, on="pid", how="left").merge(here, on=["teamId", "pid"], how="left").merge(pm, on="pid", how="left").fillna(0)
    r["season"] = S; rows.append(r)
RH = pd.concat(rows)
# also the ACTUAL first-10 rotation (as the study) to calibrate the freshman weight so that league freshman share matches
pb["gidx"] = pb.groupby(["season", "teamId"]).gameId.transform(lambda s: pd.factorize(s)[0] + 1)
act = pb[(pb.gidx <= 10) & pb.season.isin([2023, 2024, 2025])].groupby(["season", "teamId", "pid"]).minutes.sum().reset_index().rename(columns={"minutes": "w"})
act = act.merge(RH[["season", "teamId", "pid", "d1_prev", "here_prev"]], on=["season", "teamId", "pid"], how="left").fillna(0)
A = act.groupby(["season", "teamId"]).apply(lambda g: metrics(g, "w")).reset_index()
best = None
for WF in [50, 100, 150, 200, 300, 400]:
    RH["w"] = np.where(RH.d1_prev == 0, WF, RH.prior_min)
    T = RH.groupby(["season", "teamId"]).apply(lambda g: metrics(g, "w")).reset_index()
    c = T.merge(A, on=["season", "teamId"], suffixes=("_pre", "_act"))
    print(f"freshman default {WF:>3} min: league fresh share preseason {c.fresh_pre.mean():.3f} vs actual {c.fresh_act.mean():.3f}; corr upper {c[['upper_pre','upper_act']].corr().iloc[0,1]:.3f} core {c[['core_pre','core_act']].corr().iloc[0,1]:.3f}")
    if best is None or abs(c.fresh_pre.mean() - c.fresh_act.mean()) < best[0]: best = (abs(c.fresh_pre.mean() - c.fresh_act.mean()), WF, T)
WF = best[1]; T = best[2]; print(f"-> freshman default weight {WF} minutes")
# grade the preseason cell on the study's game table
D = pd.read_parquet(os.path.expanduser("~/Documents/new-wagerproof/research/ncaab-tenure/tenure_games.parquet"))
T = T.rename(columns={"season": "season_end", "upper": "pre_upper", "core": "pre_core", "fresh": "pre_fresh"}).dropna(subset=["pre_upper", "pre_core"])
for c in ["pre_upper", "pre_core"]:
    T["q_" + c] = T.groupby("season_end")[c].transform(lambda s: pd.qcut(s.rank(method="first"), 5, labels=[1, 2, 3, 4, 5]).astype(int))
G = D.merge(T[["season_end", "teamId", "pre_upper", "pre_core", "pre_fresh", "q_pre_upper", "q_pre_core"]], on=["season_end", "teamId"], how="inner")
def rec(s): w, l = int((s.win_ats > 0).sum()), int((s.win_ats < 0).sum()); return w, l
def line(m, lab, x):
    s = x[m]; w, l = rec(s); per = " ".join(f"{str(y)[2:]}:{rec(g)[0]}-{rec(g)[1]}" for y, g in s.groupby("season_end"))
    print(f"   {lab:<60} BACK {w}-{l} ({100*w/max(1,w+l):.1f}%) spr {s.spread.mean():+.1f} | {per}")
print("\n=== historical re-grade, PRESEASON roster weighting (2022-23..2024-25), small schools ===")
Yp = (G.q_pre_upper == 1) & (G.q_pre_core == 1) & G.small; Ya = (G.q_upper_share == 1) & (G.q_core_share == 1) & G.small
line(G.novdec & Ya, "study cell (actual first-10 minutes), same seasons", G)
line(G.novdec & Yp, "preseason cell: young Q1 AND new Q1, Nov-Dec", G)
line(G.novdec & Yp & (G.spread >= 7), "  ... dog of 7+", G)
line(G.early5 & Yp, "  ... first 5 games", G); line(G.early10 & Yp, "  ... first 10 games", G)
line(G.novdec & (G.pre_upper <= 0.20) & (G.pre_core == 0) & G.small, "preseason absolute: Jr/Sr <=20% and no 3rd+-yr minutes, Nov-Dec", G)
line(G.novdec & (G.pre_upper <= 0.20) & (G.pre_core == 0) & G.small & (G.spread >= 7), "  ... dog of 7+", G)
line(G.novdec & Yp & Ya, "overlap: in BOTH the preseason and actual cells", G)
line(G.janfeb & Yp, "preseason cell Jan-Feb placebo", G)
print(f"   preseason vs actual cell agreement: {int((Yp & Ya).sum())} of {int(Yp.sum())} preseason-cell games are also actual-cell games")
# ---------------------------------------------------------------- 2. this season (2027)
R27 = pd.read_parquet("rosters_2027.parquet"); R27["pid"] = pd.to_numeric(R27.sourceId, errors="coerce"); R27 = R27.dropna(subset=["pid"]); R27["pid"] = R27.pid.astype("int64")
d1, here, pm = hist_for(2027)
r = R27.merge(d1, on="pid", how="left").merge(here, on=["teamId", "pid"], how="left").merge(pm, on="pid", how="left")
r[["d1_prev", "here_prev", "prior_min"]] = r[["d1_prev", "here_prev", "prior_min"]].fillna(0)
r["w"] = np.where(r.d1_prev == 0, WF, r.prior_min)
T27 = r.groupby(["teamId", "team", "conference"]).apply(lambda g: metrics(g, "w")).reset_index().rename(columns={"upper": "pre_upper", "core": "pre_core", "fresh": "pre_fresh", "n": "n_roster"})
# actual minutes so far (1-2 games)
a = bx27[bx27.minutes > 0].groupby(["teamId", "pid"]).minutes.sum().reset_index().rename(columns={"minutes": "w"}).merge(d1, on="pid", how="left").merge(here, on=["teamId", "pid"], how="left").fillna(0)
A27 = a.groupby("teamId").apply(lambda g: metrics(g, "w")).reset_index().rename(columns={"upper": "act_upper", "core": "act_core", "fresh": "act_fresh", "n": "n_played"})
gp = bx27.groupby("teamId").gameId.nunique().rename("games_played").reset_index()
T27 = T27.merge(A27, on="teamId", how="left").merge(gp, on="teamId", how="left").dropna(subset=["pre_upper", "pre_core"])
T27["small"] = ~T27.conference.isin(POWER)
for c in ["pre_upper", "pre_core"]:
    T27["q_" + c] = pd.qcut(T27[c].rank(method="first"), 5, labels=[1, 2, 3, 4, 5]).astype(int)
T27["cell_q"] = (T27.q_pre_upper == 1) & (T27.q_pre_core == 1) & T27.small
T27["cell_abs"] = (T27.pre_upper <= 0.20) & (T27.pre_core == 0) & T27.small
print(f"\n2026-27: {len(T27)} rosters, {T27.games_played.notna().sum()} with box so far; Q1 cut-offs: Jr/Sr share <= {T27[T27.q_pre_upper==1].pre_upper.max():.3f}, 3rd+-yr share <= {T27[T27.q_pre_core==1].pre_core.max():.3f}")
print(f"teams in the quintile cell: {int(T27.cell_q.sum())}; in the absolute rule: {int(T27.cell_abs.sum())}; both: {int((T27.cell_q & T27.cell_abs).sum())}")
cell = T27[T27.cell_q | T27.cell_abs].sort_values("pre_upper")
print(cell[["team", "conference", "pre_upper", "pre_core", "pre_fresh", "n_roster", "games_played", "act_upper", "act_core", "cell_q", "cell_abs"]].round(3).to_string(index=False))
T27.to_parquet("teams_2027.parquet")
# ---------------------------------------------------------------- 3. games: today (final / in progress) and upcoming, with spreads
Gm = pd.read_parquet("games_2027.parquet"); Gm["tip"] = pd.to_datetime(Gm.startDate, utc=True).dt.tz_convert("US/Eastern"); Gm["date"] = Gm.tip.dt.date.astype(str)
V = pd.read_parquet("inputs_view.parquet")[["game_id", "spread", "over_under"]].rename(columns={"spread": "home_spread"})
Gm = Gm.merge(V, left_on="id", right_on="game_id", how="left")
ids = set(cell.teamId)
rows = []
for g in Gm.itertuples():
    for side in ["home", "away"]:
        tid = getattr(g, f"{side}TeamId")
        if tid not in ids: continue
        t = T27.set_index("teamId").loc[tid]
        hs = g.home_spread
        team_spread = (hs if side == "home" else -hs) if pd.notna(hs) else np.nan
        opp = g.awayTeam if side == "home" else g.homeTeam
        own_pts = g.homePoints if side == "home" else g.awayPoints; opp_pts = g.awayPoints if side == "home" else g.homePoints
        res = ""
        if g.status == "final" and pd.notna(own_pts):
            margin = own_pts - opp_pts; res = f"{int(own_pts)}-{int(opp_pts)} "
            if pd.notna(team_spread): res += "COVER" if margin + team_spread > 0 else ("PUSH" if margin + team_spread == 0 else "LOSS")
        elif g.status == "in_progress": res = f"live {own_pts}-{opp_pts}" if pd.notna(own_pts) else "live"
        rows.append(dict(date=g.date, tip=g.tip.strftime("%a %I:%M%p"), team=getattr(g, f"{side}Team"), conf=t.conference, venue=("neutral" if g.neutralSite else side), opponent=opp,
                         team_spread=team_spread, dog7=(team_spread >= 7) if pd.notna(team_spread) else None, status=g.status, result=res,
                         jr_sr=round(t.pre_upper, 2), yr3=round(t.pre_core, 2), rule=("quintile+abs" if (t.cell_q and t.cell_abs) else ("quintile" if t.cell_q else "abs"))))
out = pd.DataFrame(rows).sort_values(["date", "tip"])
print("\n=== TODAY (2026-11-02): teams in the cell ===")
print(out[out.date == "2026-11-02"].to_string(index=False))
print("\n=== UPCOMING (through 2026-11-06) ===")
print(out[out.date > "2026-11-02"].to_string(index=False))
out.to_csv("cell_games.csv", index=False)
