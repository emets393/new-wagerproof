#!/usr/bin/env python3
"""PLAYER CHAIN — the St. Brown dossier as a function, for every receiver on a slate.

chain(player, team, opp) -> (calls: dict, brief: str)
  calls  = structured pregame expectations, graded next week by grade_player_briefs.py:
           share_dir (up/down/flat vs his base share), adot_dir, primary alignment, top stacked
           route, expected coverage (man/two-high vs his norm), expected pressure vs his QB's norm,
           base share, base aDOT, base yds/route
  brief  = the compact Discord/video paragraph with the numbers behind each call.
All tables are loaded ONCE (module import) with an as-of cutoff so nothing after the target week
leaks in. Base window = prior season + current season to date.
"""
import glob, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
FP = "data/fpdata/"; num = lambda s: pd.to_numeric(s, errors="coerce")
NICK = {"Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI","Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HOU","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LA","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS"}
AB = {"ARZ":"ARI","BLT":"BAL","CLV":"CLE","HST":"HOU"}
SEP, NRT, TPR, YPR = "playerStatsReceivingSeparationScorePercentage", "playerStatsReceivingSeparationRoutesTotal", "playerStatsReceivingTargetsPerRoute", "playerStatsReceivingAveragesPerRouteYardsTotal"
ROUTES = ["RouteSlant","RouteOut","RouteInDig","RouteCrossers","RouteGo","RoutePost","RouteCorner","RouteHitch","RouteFlat","RouteScreens"]; ALIGN = ["Slot","Wide","Inline","Backfield"]
def tk(d):
    s = d.teamAbbreviation if "teamAbbreviation" in d.columns and d.teamAbbreviation.notna().any() else d.teamNickname.map(NICK); return s.map(lambda a: AB.get(a, a))
def wavg(df, v, w):
    a, b = num(df[v]), num(df[w]); m = a.notna() & b.notna() & (b > 0); return (a[m] * b[m]).sum() / b[m].sum() if b[m].sum() else np.nan

class Chain:
    def __init__(self, season, week):
        self.season, self.week = season, week; S = [season - 1, season]
        from fp_hist import read_fp   # hist + current merge so the chain runs on a fresh Render clone (see fp_hist.py)
        def load(t, flat=False):
            d = read_fp(t, flat); d = d[d["__season"].isin(S)].copy(); d["team"] = tk(d)
            d["opp"] = d.opponentAbbreviation.map(lambda a: AB.get(a, a)) if "opponentAbbreviation" in d.columns else None
            if "playerFirstName" in d.columns: d["nm"] = d.playerFirstName.astype(str) + " " + d.playerLastName.astype(str)
            return d[(d["__season"] < season) | (d["__week"] < week)]
        self.sr, self.sa, self.sc = load("player_receiving-separation-by-routes", True), load("player_receiving-separation-by-alignment", True), load("player_receiving-separation-by-coverage", True)
        self.ra, self.mz = load("player_receiving-advanced"), load("receivingManVsZone__player", True)
        self.cvT, self.cvO, self.pa, self.po = load("coverageMatrix__team"), load("coverageMatrix__opponent"), load("passingAdvanced__team"), load("passingAdvanced__opponent")
        self.ROUT = [r for r in ROUTES if f"{r}__{NRT}" in self.sr.columns]
        self.lg_sep = {r: 100 * wavg(self.sr, f"{r}__{SEP}", f"{r}__{NRT}") for r in self.ROUT}; self.lg_al = {a: 100 * wavg(self.sa, f"{a}__{SEP}", f"{a}__{NRT}") for a in ALIGN}
        self.lg_press = 100 * wavg(self.pa, "teamStatsPassingPressuredPercentage", "teamStatsPassingDropbacksTotal"); self.lg_man = 100 * wavg(self.cvO, "opponentStatsCoverageSchemeManPassingDropbacksPercentage", "opponentStatsPassingDropbacksTotal"); self.lg_two = 100 * wavg(self.cvO, "opponentStatsCoverageSchemeTwoHighPassingDropbacksPercentage", "opponentStatsPassingDropbacksTotal")
        cf = self.cvT[["team","__season","__week","teamStatsCoverageSchemeManPassingDropbacksPercentage","teamStatsCoverageSchemeTwoHighPassingDropbacksPercentage"]].rename(columns={"teamStatsCoverageSchemeManPassingDropbacksPercentage":"man","teamStatsCoverageSchemeTwoHighPassingDropbacksPercentage":"twohi"})
        cf["man"], cf["twohi"] = 100 * num(cf.man), 100 * num(cf.twohi); self.cf = cf
        pq = self.pa[["team","__season","__week","teamStatsPassingPressuredPercentage","teamStatsPassingAverageTimeToThrow"]].rename(columns={"teamStatsPassingPressuredPercentage":"press","teamStatsPassingAverageTimeToThrow":"ttt"}); pq["press"] = 100 * num(pq.press); self.pq = pq
        # per-play (prior season only — current season participation lags nflverse publication)
        try:
            pbp = pd.read_parquet(f"data/pbp_cache/pbp_{season-1}.parquet", columns=["game_id","play_id","season","week","posteam","defteam","qb_dropback","epa","receiver_player_name","complete_pass","yards_gained","air_yards"])
            par = pd.read_parquet(f"data/pbp_participation_{season-1}.parquet", columns=["nflverse_game_id","play_id","defense_man_zone_type","defense_coverage_type","was_pressure","time_to_throw"]).rename(columns={"nflverse_game_id":"game_id"}).drop_duplicates(["game_id","play_id"])
            self.pl = pbp.merge(par, on=["game_id","play_id"], how="left"); self.pl = self.pl[self.pl.qb_dropback == 1]
        except Exception: self.pl = None
                # players are keyed by FP id (same-name players exist: two Justin Jeffersons in 2026 wk1). name+team -> id map
        for fr in (self.sr, self.sa, self.sc, self.ra, self.mz): fr["pid"] = fr.playerPlayerId.astype(str)
        self.ids = self.ra.groupby(["nm","team","pid"]).size().reset_index(name="n").sort_values("n", ascending=False).drop_duplicates(["nm","team"])[["nm","team","pid"]]

    def chain(self, player, team, opp, pid=None):
        if pid is None:
            m = self.ids[(self.ids.nm == player) & (self.ids.team == team)]
            if not len(m): return None, None
            pid = m.pid.iloc[0]
        P = self.ra[self.ra.pid == pid]
        if len(P) < 3: return None, None
        Pr, Pa, Pc, M = self.sr[self.sr.pid == pid], self.sa[self.sa.pid == pid], self.sc[self.sc.pid == pid], self.mz[self.mz.pid == pid]
        Dr, Da, dO, tO, dP = self.sr[self.sr.opp == opp], self.sa[self.sa.opp == opp], self.cvO[self.cvO.team == opp], self.pa[self.pa.team == team], self.po[self.po.team == opp]
        routes = num(P.playerStatsReceivingRoutesTotal).sum(); tsh = 100 * wavg(P, "marketShareReceivingTargetsTotal", "playerStatsReceivingRoutesTotal"); adot = wavg(P, "playerStatsReceivingAverageDepthOfTarget", "playerStatsReceivingTargetsTotal"); yprr = wavg(P, YPR, "playerStatsReceivingRoutesTotal"); pos = P.playerPosition.iloc[-1]
        # routes: mix + stacked edges vs opp
        tot = sum(num(Pr[f"{r}__{NRT}"]).sum() for r in self.ROUT); stacks = []
        for r in self.ROUT:
            n = num(Pr[f"{r}__{NRT}"]).sum(); nd = num(Dr[f"{r}__{NRT}"]).sum()
            if n < 12 or nd < 30: continue
            his = 100 * wavg(Pr, f"{r}__{SEP}", f"{r}__{NRT}") - self.lg_sep[r]; da = 100 * wavg(Dr, f"{r}__{SEP}", f"{r}__{NRT}") - self.lg_sep[r]
            stacks.append((r.replace("Route",""), n / tot, his, da, his + da))
        stacks.sort(key=lambda x: -x[4]); best, worst = stacks[:2], sorted(stacks, key=lambda x: x[4])[:1]
        mix = sorted(((r.replace("Route",""), num(Pr[f"{r}__{NRT}"]).sum() / tot) for r in self.ROUT if num(Pr[f"{r}__{NRT}"]).sum() >= 12), key=lambda x: -x[1])[:3]
        # alignment: mix + stack
        atot = sum(num(Pa[f"{a}__{NRT}"]).sum() for a in ALIGN); al = []
        for a in ALIGN:
            n = num(Pa[f"{a}__{NRT}"]).sum()
            if n < 12: continue
            his = 100 * wavg(Pa, f"{a}__{SEP}", f"{a}__{NRT}") - self.lg_al[a]; da = 100 * wavg(Da, f"{a}__{SEP}", f"{a}__{NRT}") - self.lg_al[a]; al.append((a, n / atot, his, da, his + da))
        prim = max(al, key=lambda x: x[1]) if al else None; best_al = max(al, key=lambda x: x[4]) if al else None
        # coverage: his norm vs opp identity; his splits by coverage
        G = P.merge(self.cf[self.cf.team == team], on=["team","__season","__week"], how="left"); G["tsh"] = 100 * num(G.marketShareReceivingTargetsTotal); G["adot"] = num(G.playerStatsReceivingAverageDepthOfTarget); G["yprr"] = num(G[YPR]); G["routes"] = num(G.playerStatsReceivingRoutesTotal)
        fm, ft = G.man.mean(), G.twohi.mean(); om = 100 * wavg(dO, "opponentStatsCoverageSchemeManPassingDropbacksPercentage", "opponentStatsPassingDropbacksTotal"); ot = 100 * wavg(dO, "opponentStatsCoverageSchemeTwoHighPassingDropbacksPercentage", "opponentStatsPassingDropbacksTotal")
        def split(col):
            med = G[col].median(); hi, lo = G[G[col] > med], G[G[col] <= med]; return wavg(hi, "tsh", "routes") - wavg(lo, "tsh", "routes"), wavg(hi, "adot", "routes") - wavg(lo, "adot", "routes"), wavg(hi, "yprr", "routes") - wavg(lo, "yprr", "routes")
        dm, dt = split("man"), split("twohi")
        # which way does THIS opponent push him: weight the man and two-high deltas by how far the opp is from his norm
        wm, wt = (om - fm) / 20.0, (ot - ft) / 20.0                    # +1 per 20 pts of coverage above his norm
        share_shift = wm * dm[0] + wt * dt[0]; adot_shift = wm * dm[1] + wt * dt[1]; yprr_shift = wm * dm[2] + wt * dt[2]
        share_dir = "up" if share_shift > 1.0 else ("down" if share_shift < -1.0 else "flat"); adot_dir = "deeper" if adot_shift > 0.5 else ("shorter" if adot_shift < -0.5 else "flat")
        # yprr by coverage family
        fam = {b: (wavg(M, f"{b}__{YPR}", f"{b}__playerStatsReceivingRoutesTotal"), int(num(M[f"{b}__playerStatsReceivingRoutesTotal"]).sum())) for b in ("Man","Zone","TwoHigh") if f"{b}__{YPR}" in self.mz.columns}
        # pocket
        op = 100 * wavg(tO, "teamStatsPassingPressuredPercentage", "teamStatsPassingDropbacksTotal"); dp = 100 * wavg(dP, "opponentStatsPassingPressuredPercentage", "opponentStatsPassingDropbacksTotal"); exp_press = op + dp - self.lg_press
        G2 = G.merge(self.pq[self.pq.team == team], on=["team","__season","__week"], how="left"); medp = G2.press.median(); hp, lp = G2[G2.press > medp], G2[G2.press <= medp]; press_eff = wavg(hp, "tsh", "routes") - wavg(lp, "tsh", "routes")
        pl_line = ""
        if self.pl is not None:
            key = player.split()[0][0] + "." + " ".join(player.split()[1:]) if "St." in player else player.split()[0][0] + "." + player.split()[-1]
            tm = self.pl[self.pl.posteam == team].copy(); tm["tgt"] = (tm.receiver_player_name == key).astype(int)
            if tm.tgt.sum() >= 15:
                c, p_ = tm[tm.was_pressure == False], tm[tm.was_pressure == True]; mn, zn = tm[tm.defense_man_zone_type == "MAN_COVERAGE"], tm[tm.defense_man_zone_type == "ZONE_COVERAGE"]
                pl_line = f"Snap by snap last season: targeted on {100*c.tgt.mean():.0f}% of clean dropbacks vs {100*p_.tgt.mean():.0f}% when the QB was pressured; {100*mn.tgt.mean():.0f}% vs man, {100*zn.tgt.mean():.0f}% vs zone."
        calls = dict(player=player, team=team, opp=opp, pos=pos, base_share=tsh, base_adot=adot, base_yprr=yprr, routes=int(routes), share_dir=share_dir, share_shift=share_shift, adot_dir=adot_dir, adot_shift=adot_shift, yprr_shift=yprr_shift,
                     prim_align=prim[0] if prim else None, best_align=best_al[0] if best_al else None, best_align_stack=best_al[4] if best_al else np.nan, top_route=best[0][0] if best else None, top_route_stack=best[0][4] if best else np.nan, worst_route=worst[0][0] if worst else None,
                     opp_man=om, opp_two=ot, his_man_norm=fm, his_two_norm=ft, exp_press=exp_press, qb_press_norm=op, press_effect_on_share=press_eff)
        b = []
        b.append(f"**{player} ({pos}, {team}) vs {opp}** — {routes:.0f} routes in base, target share {tsh:.1f}%, aDOT {adot:.1f}, {yprr:.2f} yds/route.")
        b.append(f"Runs: " + ", ".join(f"{r} {100*s:.0f}%" for r, s in mix) + f". Best stacked routes vs {opp}: " + "; ".join(f"{r} {t:+.1f} (his {h:+.1f}, {opp} allows {d:+.1f})" for r, s, h, d, t in best) + (f". Worst: {worst[0][0]} {worst[0][4]:+.1f}." if worst else ""))
        if prim: b.append(f"Lines up {prim[0].lower()} {100*prim[1]:.0f}% of the time" + (f"; best stack is {best_al[0].lower()} {best_al[4]:+.1f} (his {best_al[2]:+.1f}, {opp} allows {best_al[3]:+.1f})." if best_al else "."))
        b.append(f"Coverage: he usually sees man {fm:.0f}% / two-high {ft:.0f}%; {opp} plays man {om:.0f}% / two-high {ot:.0f}%. In his high-man games his share moves {dm[0]:+.1f} and aDOT {dm[1]:+.1f}; in high-two-high games {dt[0]:+.1f} / {dt[1]:+.1f}. Net for this matchup: share {share_dir} ({share_shift:+.1f}), depth {adot_dir} ({adot_shift:+.1f}).")
        if fam: b.append("Yards per route by coverage: " + ", ".join(f"{k} {v[0]:.2f} (n={v[1]})" for k, v in fam.items() if v[1] >= 25) + ".")
        b.append(f"Pocket: his QB is pressured {op:.0f}% (league {self.lg_press:.0f}); {opp} generates {dp:.0f}%; expect {exp_press:.0f}%. When his QB is pressured more his share moves {press_eff:+.1f}. " + pl_line)
        return calls, "\n".join(b)
