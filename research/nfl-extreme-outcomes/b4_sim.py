"""
Brief #4 — Monte Carlo leverage engine (vectorized).
For each (season, as_of_week): freeze Elo at that week, simulate the REST of the regular season N times,
accumulate total/div/conf wins, resolve the era-correct playoff field (6 WC pre-2020, 3 from 2020) with a
composite tiebreaker key (record >> div >> conf >> elo). Output per team-week:
  playoff_pct, div_pct, leverage = P(playoff|win this week's game) - P(playoff|lose), + clinch/elim flags.
Saves b4_stakes.parquet. Validates clinch/elimination weeks against reality.
"""
import os, numpy as np, pandas as pd
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
L = print
rng = np.random.default_rng(0)
g = pd.read_parquet(os.path.join(DATA, "games_enriched.parquet"))
ee = pd.read_parquet(os.path.join(DATA, "elo_entering.parquet"))
HFA, N = 48.0, 4000
reg = g[(g.game_type == "REG")].copy()


def sim_season_week(season, as_of):
    gs = reg[reg.season == season]
    teams = sorted(set(gs.home_team) | set(gs.away_team))
    idx = {t: i for i, t in enumerate(teams)}; nT = len(teams)
    conf = np.array([1 if g.loc[g.home_team == t, "home_conf"].iloc[0] == "AFC" else 0 for t in teams]) \
        if False else np.array([0] * nT)
    # conf/div per team from DIV via games_enriched columns
    cd = {}
    for r in gs.itertuples():
        cd[r.home_team] = (r.home_conf, r.home_div); cd[r.away_team] = (r.away_conf, r.away_div)
    team_conf = np.array([cd[t][0] for t in teams]); team_div = np.array([cd[t][1] for t in teams])
    elo_wk = ee[(ee.season == season) & (ee.week == as_of)].set_index("team")["elo"]
    # fallback: last available elo entering <= as_of
    def get_elo(t):
        if t in elo_wk.index:
            return elo_wk[t]
        sub = ee[(ee.season == season) & (ee.team == t) & (ee.week <= as_of)]
        return sub.sort_values("week")["elo"].iloc[-1] if len(sub) else 1505.0
    elo = np.array([get_elo(t) for t in teams])

    played = gs[gs.week < as_of]; remaining = gs[gs.week >= as_of]
    cur_w = np.zeros(nT); cur_dw = np.zeros(nT); cur_cw = np.zeros(nT)
    for r in played.itertuples():
        if pd.isna(r.home_score):
            continue
        hi, ai = idx[r.home_team], idx[r.away_team]
        div = r.home_div == r.away_div; cf = r.home_conf == r.away_conf
        if r.home_score > r.away_score:
            cur_w[hi] += 1; cur_dw[hi] += div; cur_cw[hi] += cf
        elif r.home_score < r.away_score:
            cur_w[ai] += 1; cur_dw[ai] += div; cur_cw[ai] += cf
        else:
            cur_w[hi] += .5; cur_w[ai] += .5; cur_dw[hi] += .5*div; cur_dw[ai] += .5*div; cur_cw[hi] += .5*cf; cur_cw[ai] += .5*cf
    rg = remaining.reset_index(drop=True)
    ng_ = len(rg)
    if ng_ == 0:
        return None
    hi = rg.home_team.map(idx).values; ai = rg.away_team.map(idx).values
    isdiv = (rg.home_div.values == rg.away_div.values).astype(float)
    iscf = (rg.home_conf.values == rg.away_conf.values).astype(float)
    p_home = 1.0 / (1.0 + 10 ** (-((elo[hi] + HFA) - elo[ai]) / 400.0))
    HW = (rng.random((N, ng_)) < p_home).astype(np.float32)     # [N, ng]
    AW = 1.0 - HW
    # one-hot incidence [ng, nT]
    Mh = np.zeros((ng_, nT), np.float32); Ma = np.zeros((ng_, nT), np.float32)
    Mh[np.arange(ng_), hi] = 1; Ma[np.arange(ng_), ai] = 1
    Mhd = Mh * isdiv[:, None]; Mad = Ma * isdiv[:, None]
    Mhc = Mh * iscf[:, None]; Mac = Ma * iscf[:, None]
    wins = cur_w + HW @ Mh + AW @ Ma                  # [N,nT]
    dwins = cur_dw + HW @ Mhd + AW @ Mad
    cwins = cur_cw + HW @ Mhc + AW @ Mac
    comp = wins * 1e6 + dwins * 1e3 + cwins + (elo - 1505) * 1e-4   # composite tiebreaker
    # resolve playoff field per sim
    nwc = 2 if season <= 2019 else 3
    playoff = np.zeros((N, nT), bool)
    for cf_name in ("AFC", "NFC"):
        cmask = team_conf == cf_name
        cidx = np.where(cmask)[0]
        divwin = np.zeros(N, dtype=int) - 1
        is_divwin = np.zeros((N, nT), bool)
        for d in sorted(set(team_div[cidx])):
            didx = np.where((team_div == d) & cmask)[0]
            wlocal = comp[:, didx].argmax(1)
            winner = didx[wlocal]
            is_divwin[np.arange(N), winner] = True
        playoff |= is_divwin
        # wild cards: top nwc non-divwinners in conf by comp
        compc = comp[:, cidx].copy()
        compc[is_divwin[:, cidx]] = -1e18
        order = np.argsort(-compc, axis=1)[:, :nwc]
        for j in range(nwc):
            wc_global = cidx[order[:, j]]
            playoff[np.arange(N), wc_global] = True
    po_pct = playoff.mean(0)
    div_pct = np.zeros(nT)
    # division title pct
    for cf_name in ("AFC", "NFC"):
        cmask = team_conf == cf_name
        for d in sorted(set(team_div[np.where(cmask)[0]])):
            didx = np.where((team_div == d) & cmask)[0]
            wlocal = comp[:, didx].argmax(1)
            for j, ti in enumerate(didx):
                div_pct[ti] = (didx[wlocal] == ti).mean()

    # leverage: split each team's playoff by its result in the as_of week game
    rows = []
    wk_games = rg[rg.week == as_of]
    for r in wk_games.itertuples():
        gi = r.Index  # row index in rg
        for ti, is_home in ((idx[r.home_team], True), (idx[r.away_team], False)):
            wonvec = HW[:, gi] if is_home else AW[:, gi]
            won = wonvec.astype(bool)
            po_w = playoff[won, ti].mean() if won.any() else np.nan
            po_l = playoff[~won, ti].mean() if (~won).any() else np.nan
            rows.append(dict(season=season, week=as_of, team=teams[ti],
                             opp=(r.away_team if is_home else r.home_team), is_home=int(is_home),
                             playoff_pct=po_pct[ti], div_pct=div_pct[ti],
                             po_if_win=po_w, po_if_lose=po_l,
                             leverage=(po_w - po_l) if (po_w == po_w and po_l == po_l) else np.nan))
    return rows


out = []
for season in range(2002, 2026):
    wks = sorted(reg[reg.season == season].week.unique())
    for w in wks:
        if w < 4:        # leverage negligible weeks 1-3; skip for speed
            continue
        r = sim_season_week(season, w)
        if r:
            out.append(pd.DataFrame(r))
    L(f"  simulated {season} (weeks {wks[0]}-{wks[-1]})")
S = pd.concat(out, ignore_index=True)
# flags
S["eliminated"] = S.playoff_pct <= 0.02
S["clinched"] = S.playoff_pct >= 0.98
S["must_win"] = (S.po_if_lose <= 0.05) & (S.po_if_win >= 0.20)        # win keeps alive, loss ~ends it
S["win_and_in"] = (S.po_if_win >= 0.95) & (S.po_if_lose < 0.95)
S["no_stakes"] = S.eliminated | S.clinched
S.to_parquet(os.path.join(DATA, "b4_stakes.parquet"), index=False)
L(f"\n[saved] b4_stakes: {S.shape}")

# ---------------- VALIDATION ----------------
L("\n[validate] effectively-eliminated teams by end of season should be the non-playoff teams:")
last = S.sort_values("week").groupby(["season", "team"]).tail(1)
real_field = {}
for s in range(2002, 2026):
    real_field[s] = set(g[(g.season == s) & (g.game_type != "REG") & g.home_score.notna()].home_team) | \
                    set(g[(g.season == s) & (g.game_type != "REG") & g.home_score.notna()].away_team)
chk = last.copy(); chk["made_real"] = chk.apply(lambda r: r.team in real_field.get(r.season, set()), axis=1)
# final-week elim should rarely be a real playoff team
bad = chk[(chk.eliminated) & (chk.made_real)]
L(f"  teams flagged eliminated in their last sim-week that ACTUALLY made playoffs: {len(bad)} (want ~0)")
L(f"  final-week mean playoff_pct: made-real={chk[chk.made_real].playoff_pct.mean():.2f} "
  f"missed={chk[~chk.made_real].playoff_pct.mean():.2f} (want ~1 vs ~0)")
# spot-check leverage distribution by week
L("\n  mean |leverage| by week (should rise into late season):")
for w in [5, 8, 10, 12, 14, 16, 17, 18]:
    sub = S[S.week == w]
    if len(sub):
        L(f"    wk{w}: mean|lev|={sub.leverage.abs().mean():.3f}  must_win%={sub.must_win.mean()*100:.1f}  "
          f"elim%={sub.eliminated.mean()*100:.1f}  clinch%={sub.clinched.mean()*100:.1f}")
