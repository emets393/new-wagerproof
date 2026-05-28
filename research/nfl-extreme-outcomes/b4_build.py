"""
Brief #4 — standings + Elo + division backbone (2002-2025).
- Division/conference map (handles SD/STL/OAK relocations as same division slot).
- Game-by-game Elo (HFA + MOV multiplier + season carryover) -> pre-game win prob.
- Elo entering each week (frozen snapshot for leak-safe rest-of-season simulation).
- Validate: Elo calibration/accuracy + reconstructed playoff field vs the REAL field (POST games).
Saves games_enriched.parquet and elo_entering.parquet.
"""
import os, numpy as np, pandas as pd
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
L = print
ng = pd.read_parquet(os.path.join(DATA, "nflverse_games.parquet"))

DIV = {}
for teams, cd in {
    ("BUF","MIA","NE","NYJ"): ("AFC","AFC_E"), ("BAL","CIN","CLE","PIT"): ("AFC","AFC_N"),
    ("HOU","IND","JAX","TEN"): ("AFC","AFC_S"), ("DEN","KC","OAK","LV","SD","LAC"): ("AFC","AFC_W"),
    ("DAL","NYG","PHI","WAS"): ("NFC","NFC_E"), ("CHI","DET","GB","MIN"): ("NFC","NFC_N"),
    ("ATL","CAR","NO","TB"): ("NFC","NFC_S"), ("ARI","STL","LA","SF","SEA"): ("NFC","NFC_W"),
}.items():
    for t in teams:
        DIV[t] = cd

g = ng[(ng.season.between(2002, 2025))].copy()
g["gameday"] = pd.to_datetime(g["gameday"])
g = g.sort_values(["gameday", "game_id"]).reset_index(drop=True)
for side in ("home", "away"):
    g[f"{side}_conf"] = g[f"{side}_team"].map(lambda t: DIV.get(t, (None, None))[0])
    g[f"{side}_div"] = g[f"{side}_team"].map(lambda t: DIV.get(t, (None, None))[1])
unmapped = sorted(set(g.home_team[g.home_div.isna()]) | set(g.away_team[g.away_div.isna()]))
assert not unmapped, f"unmapped teams: {unmapped}"
g["played"] = g["home_score"].notna()
L(f"[build] games 2002-2025: {len(g)} ({g.played.sum()} played); div map OK (35 abbrevs)")

# ---------------- Elo engine ----------------
HFA, K, BASE = 48.0, 20.0, 1505.0
elo = {}
elo_h, elo_a, ph = np.zeros(len(g)), np.zeros(len(g)), np.zeros(len(g))
elo_enter_rows = []   # (season, week, team, elo) entering each week
cur_season = None
seen_week = {}        # (season, team) -> set of weeks snapshotted


def mov_mult(margin, elo_diff_winner):
    return np.log(abs(margin) + 1) * (2.2 / (elo_diff_winner * 0.001 + 2.2))


for i, r in enumerate(g.itertuples()):
    s, wk = r.season, r.week
    if s != cur_season:                       # season carryover: regress 1/3 to mean
        for t in elo:
            elo[t] = BASE + (2/3) * (elo[t] - BASE)
        cur_season = s
    h, a = r.home_team, r.away_team
    eh, ea = elo.get(h, BASE), elo.get(a, BASE)
    # snapshot 'entering this week' once per team-week (REG only weeks)
    for t, e in ((h, eh), (a, ea)):
        key = (s, t, wk)
        if key not in seen_week:
            seen_week[key] = 1
            elo_enter_rows.append((s, wk, t, e))
    p = 1.0 / (1.0 + 10 ** (-((eh + HFA) - ea) / 400.0))
    elo_h[i], elo_a[i], ph[i] = eh, ea, p
    if r.played:                              # update after the game
        margin = r.home_score - r.away_score
        sh = 1.0 if margin > 0 else (0.0 if margin < 0 else 0.5)
        ediff_w = (eh + HFA - ea) if margin > 0 else (ea - eh - HFA)
        m = mov_mult(margin if margin != 0 else 1, ediff_w) if margin != 0 else 1.0
        delta = K * m * (sh - p)
        elo[h] = eh + delta
        elo[a] = ea - delta

g["elo_home"], g["elo_away"], g["p_home"] = elo_h, elo_a, ph
ee = pd.DataFrame(elo_enter_rows, columns=["season", "week", "team", "elo"])
g.to_parquet(os.path.join(DATA, "games_enriched.parquet"), index=False)
ee.to_parquet(os.path.join(DATA, "elo_entering.parquet"), index=False)

# ---------------- VALIDATION ----------------
L("\n[validate Elo] (played REG+POST games)")
pl = g[g.played].copy()
pl["home_win"] = (pl.home_score > pl.away_score).astype(int)
acc_home = (pl.p_home >= 0.5).eq(pl.home_win == 1).mean()
L(f"  home SU win rate = {pl.home_win.mean():.3f} (expect ~0.56-0.58 post-2002)")
L(f"  Elo pick (p_home>=.5) accuracy = {acc_home:.3f} (expect ~0.62-0.66)")
# calibration
pl["bin"] = (pl.p_home * 10).clip(0, 9).astype(int)
cal = pl.groupby("bin").agg(pred=("p_home", "mean"), actual=("home_win", "mean"), n=("home_win", "size"))
L("  calibration (pred vs actual home-win by decile):")
for b, rr in cal.iterrows():
    L(f"    p~{rr.pred:.2f}: actual={rr.actual:.2f} (n={int(rr.n)})")

# ---------------- standings + playoff-field reconstruction (rule-based, for validation) ----------------
def final_standings(season):
    """Reconstruct regular-season records + division winners + playoff field; compare to reality."""
    gs = g[(g.season == season) & (g.game_type == "REG") & g.played]
    teams = sorted(set(gs.home_team) | set(gs.away_team))
    rec = {t: dict(w=0, l=0, t=0, dw=0, dl=0, cw=0, cl=0, pf=0, pa=0) for t in teams}
    h2h = {t: {} for t in teams}
    for r in gs.itertuples():
        h, a = r.home_team, r.away_team
        hw = r.home_score > r.away_score; tie = r.home_score == r.away_score
        div = DIV[h][1] == DIV[a][1]; conf = DIV[h][0] == DIV[a][0]
        for t, opp, won, sf, sa in ((h, a, hw, r.home_score, r.away_score), (a, h, (not hw and not tie), r.away_score, r.home_score)):
            rec[t]["pf"] += sf; rec[t]["pa"] += sa
            if tie:
                rec[t]["t"] += 1; rec[t]["dt"] = rec[t].get("dt", 0) + (1 if div else 0)
            elif won:
                rec[t]["w"] += 1; rec[t]["dw"] += div; rec[t]["cw"] += conf
            else:
                rec[t]["l"] += 1; rec[t]["dl"] += div; rec[t]["cl"] += conf
            h2h[t][opp] = h2h[t].get(opp, 0) + (1 if (won and not tie) else 0)
    def wpct(t): return (rec[t]["w"] + 0.5 * rec[t]["t"]) / max(1, rec[t]["w"] + rec[t]["l"] + rec[t]["t"])
    def dpct(t): return (rec[t]["dw"]) / max(1, rec[t]["dw"] + rec[t]["dl"])
    def cpct(t): return (rec[t]["cw"]) / max(1, rec[t]["cw"] + rec[t]["cl"])
    # composite key approximating tiebreakers: wpct >> div >> conf >> pointdiff
    def key(t): return (wpct(t), dpct(t), cpct(t), (rec[t]["pf"] - rec[t]["pa"]))
    nwc = 2 if season <= 2019 else 3
    field = {}
    for conf in ("AFC", "NFC"):
        cteams = [t for t in teams if DIV[t][0] == conf]
        # division winners
        divw = []
        for d in sorted(set(DIV[t][1] for t in cteams)):
            dteams = [t for t in cteams if DIV[t][1] == d]
            divw.append(max(dteams, key=key))
        divw_sorted = sorted(divw, key=key, reverse=True)
        # wild cards
        rest = [t for t in cteams if t not in divw]
        wc = sorted(rest, key=key, reverse=True)[:nwc]
        seeds = divw_sorted + wc
        for sd, t in enumerate(seeds, 1):
            field[t] = sd
    return field


L("\n[validate standings] reconstructed playoff field vs REAL (teams in POST games):")
tot_match = tot = 0
for s in range(2002, 2026):
    real = set(g[(g.season == s) & (g.game_type != "REG") & g.played].home_team) | \
           set(g[(g.season == s) & (g.game_type != "REG") & g.played].away_team)
    if not real:
        continue
    recon = set(final_standings(s).keys())
    match = len(real & recon); tot_match += match; tot += len(real)
    if s >= 2020 or len(real & recon) < len(real):
        L(f"  {s}: real={len(real)} recon={len(recon)} match={match}/{len(real)}"
          + ("" if match == len(real) else f"  MISS real-only={sorted(real-recon)} recon-only={sorted(recon-real)}"))
L(f"  OVERALL playoff-team match: {tot_match}/{tot} = {tot_match/tot*100:.1f}%")
