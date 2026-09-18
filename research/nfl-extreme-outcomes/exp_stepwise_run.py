#!/usr/bin/env python3
"""STEPWISE, BOTTOM-UP (owner, 2026-09-18): take one facet at a time and show whether it predicts.
STEP 1 — the run game.  Team A's entering rush success (overall, and split by ZONE vs MAN/GAP concept)
crossed with Team B's entering defense (success allowed overall and by concept), plus stuffs, missed
tackles forced, yards before contact (the line) — does it predict THIS game's rush success / yards per
carry?  Walk-forward by season (fit on prior seasons only), out-of-sample correlation per season.
STEP 1b — does the matchup expectation move POINTS beyond the closing line?  Correlate the expected
rush-success edge with (team points − implied team total) and with the margin residual vs close.
Entering values are K=4-game prior-season-seeded season-to-date, attempt-weighted (no same-game leak).
Source: data/fpdata/rushingAdvanced__team / __opponent (FP, weekly 2021-2026)."""
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
FP = "data/fpdata/"; num = lambda s: pd.to_numeric(s, errors="coerce")
NICK = {"Cardinals":"ARI","Falcons":"ATL","Ravens":"BAL","Bills":"BUF","Panthers":"CAR","Bears":"CHI","Bengals":"CIN","Browns":"CLE","Cowboys":"DAL","Broncos":"DEN","Lions":"DET","Packers":"GB","Texans":"HOU","Colts":"IND","Jaguars":"JAX","Chiefs":"KC","Rams":"LAR","Chargers":"LAC","Raiders":"LV","Dolphins":"MIA","Vikings":"MIN","Patriots":"NE","Saints":"NO","Giants":"NYG","Jets":"NYJ","Eagles":"PHI","Steelers":"PIT","Seahawks":"SEA","49ers":"SF","Buccaneers":"TB","Titans":"TEN","Commanders":"WAS","Football Team":"WAS","Redskins":"WAS"}
def tk(s): return s.map(NICK)
T = pd.read_parquet(FP + "rushingAdvanced__team.parquet"); D = pd.read_parquet(FP + "rushingAdvanced__opponent.parquet")
T = T[T.__season >= 2021].rename(columns={"__season":"season","__week":"week"}); D = D[D.__season >= 2021].rename(columns={"__season":"season","__week":"week"})
T["team"] = tk(T.teamNickname); D["team"] = tk(D.teamNickname)
P = "teamStatsRushing"; Q = "opponentStatsRushing"
def cols(d, p):
    o = pd.DataFrame({"season": d.season, "week": d.week, "team": d.team})
    o["att"] = num(d[f"{p}AttemptsTotal"]); o["succ"] = num(d[f"{p}AttemptsSuccessPercentage"]); o["ypa"] = num(d[f"{p}YardsPerAttempt"])
    o["stuff"] = num(d[f"{p}AttemptsStuffsPercentage"]); o["mtf"] = num(d[f"{p}MissedTacklesForcedPerAttempt"]); o["ybco"] = num(d[f"{p}YardsBeforeContactPerAttempt"])
    o["z_att"] = num(d[f"{p}ConceptZoneAttemptsTotal"]); o["z_succ"] = num(d[f"{p}ConceptZoneAttemptsSuccessPercentage"]); o["z_ypa"] = num(d[f"{p}ConceptZoneYardsPerAttempt"])
    o["m_att"] = num(d[f"{p}ConceptManAttemptsTotal"]); o["m_succ"] = num(d[f"{p}ConceptManAttemptsSuccessPercentage"]); o["m_ypa"] = num(d[f"{p}ConceptManYardsPerAttempt"])
    return o
O = cols(T, P); X = cols(D, Q)      # O = offense's own numbers; X = what the defense ALLOWED (opponent stats)
print(f"team-games: offense {len(O)}, defense {len(X)}; success mean {O.succ.mean():.3f} (fraction) | zone share {(O.z_att/O.att).mean():.2f}")
def entering(df, pfx):
    """K=4-game seeded season-to-date, weighted by attempts (concept metrics by concept attempts)."""
    d = df.sort_values(["team","season","week"]).copy(); out = pd.DataFrame(index=d.index)
    for m, w in (("succ","att"), ("ypa","att"), ("stuff","att"), ("mtf","att"), ("ybco","att"), ("z_succ","z_att"), ("z_ypa","z_att"), ("m_succ","m_att"), ("m_ypa","m_att")):
        d["_n"] = d[m] * d[w]; pri = d.groupby(["team","season"]).agg(a=("_n","sum"), b=(w,"sum")); pri["r"] = pri.a / pri.b
        p = pd.Series([pri.r.get((t, s - 1), np.nan) for t, s in zip(d.team, d.season)], index=d.index); k = 4 * d[w].mean()
        g = d.groupby(["team","season"]); cs = g["_n"].cumsum() - d["_n"]; cn = g[w].cumsum() - d[w]
        out[f"{pfx}{m}"] = (cs + k * p.fillna(0)) / (cn + k * p.notna()); out.loc[(cn == 0) & p.isna(), f"{pfx}{m}"] = np.nan
    for w in ("z_att","m_att"):   # entering concept SHARE
        d["_s"] = d[w]; g = d.groupby(["team","season"]); cs = g["_s"].cumsum() - d["_s"]; ca = g["att"].cumsum() - d["att"]; out[f"{pfx}{w}_share"] = (cs / ca.replace(0, np.nan))
    return out.reindex(df.index)
O = pd.concat([O, entering(O, "e_")], axis=1); X = pd.concat([X, entering(X, "d_")], axis=1)
# pair each offense game with the defense it faced: need opponent per team-game -> from the games frame
m = pd.read_parquet("data/matchup.parquet")[["season","week","home_ab","away_ab","home_score","away_score","home_spread","nv_total_line"]]
m["home_ab"] = m.home_ab.replace({"LA":"LAR"}); m["away_ab"] = m.away_ab.replace({"LA":"LAR"})
h = m.rename(columns={"home_ab":"team","away_ab":"opp","home_score":"pts","away_score":"opp_pts"}); h["is_home"] = 1; h["spread"] = h.home_spread
a = m.rename(columns={"away_ab":"team","home_ab":"opp","away_score":"pts","home_score":"opp_pts"}); a["is_home"] = 0; a["spread"] = -a.home_spread
G = pd.concat([h, a])[["season","week","team","opp","pts","opp_pts","is_home","spread","nv_total_line"]]
G["implied"] = (G.nv_total_line - G.spread) / 2; G["pts_resid"] = G.pts - G.implied; G["margin_resid"] = (G.pts - G.opp_pts) + G.spread
F = O.merge(G, on=["season","week","team"], how="inner").merge(X.drop(columns=["att","succ","ypa","stuff","mtf","ybco","z_att","z_succ","z_ypa","m_att","m_succ","m_ypa"]).rename(columns={"team":"opp"}), on=["season","week","opp"], how="left")
F["lg"] = F.groupby("season").e_succ.transform("mean")
# concept-matched expectation: my share of each concept x (my success on it + what they allow on it - league)
F["e_zshare"] = F.e_z_att_share.fillna(0.5)
F["own_concept"] = F.e_zshare * F.e_z_succ + (1 - F.e_zshare) * F.e_m_succ
F["def_concept"] = F.e_zshare * F.d_z_succ + (1 - F.e_zshare) * F.d_m_succ
F["match_simple"] = F.e_succ + F.d_succ - F.lg
F["match_concept"] = F.own_concept + F.def_concept - F.lg
F = F[F.week >= 2].dropna(subset=["succ","e_succ","d_succ"])
print(f"\nrows with entering values both sides: {len(F)}")
def wf(target, feats, label):
    out = []
    for yr in (2022, 2023, 2024, 2025):
        tr, te = F[(F.season < yr)].dropna(subset=feats + [target]), F[F.season == yr].dropna(subset=feats + [target])
        A = np.column_stack([tr[feats].values, np.ones(len(tr))]); b = np.linalg.lstsq(A, tr[target].values, rcond=None)[0]
        pred = np.column_stack([te[feats].values, np.ones(len(te))]) @ b; out.append(f"{yr}: r={np.corrcoef(pred, te[target])[0,1]:+.3f} n={len(te)}")
    print(f"  {label:58s} " + "  ".join(out))
print("\nSTEP 1 — predict THIS game's rush SUCCESS RATE (out-of-sample r per season; noise ceiling for a one-game rate is ~0.35)")
wf("succ", ["e_succ"], "own entering success only")
wf("succ", ["d_succ"], "opponent's entering success ALLOWED only")
wf("succ", ["e_succ","d_succ"], "own + opponent allowed")
wf("succ", ["match_concept"], "CONCEPT-MATCHED (zone/man split, share-weighted)")
wf("succ", ["e_succ","d_succ","own_concept","def_concept"], "own + opp + both concept terms")
wf("succ", ["e_succ","d_succ","e_stuff","d_stuff","e_ybco","d_ybco","e_mtf","d_mtf"], "+ stuffs, yards before contact, missed tackles (line/back)")
wf("succ", ["e_succ","d_succ","e_stuff","d_stuff","e_ybco","d_ybco","e_mtf","d_mtf","own_concept","def_concept","is_home"], "everything")
print("\nSTEP 1 — predict yards per carry")
wf("ypa", ["e_ypa","d_ypa"], "own + opponent allowed ypa")
wf("ypa", ["e_ypa","d_ypa","e_z_ypa","e_m_ypa","d_z_ypa","d_m_ypa","e_zshare"], "+ concept ypa splits")
wf("ypa", ["e_ypa","d_ypa","e_stuff","d_stuff","e_ybco","d_ybco","e_mtf","d_mtf","e_z_ypa","e_m_ypa","d_z_ypa","d_m_ypa","e_zshare","is_home"], "everything")
print("\nSTEP 1b — does the run-game expectation move POINTS beyond the closing line?  (corr of the matchup expectation with the residual, per season)")
for lab, c in (("simple matchup (own + allowed − league)", "match_simple"), ("concept-matched matchup", "match_concept")):
    for tgt, tl in (("pts_resid", "team pts − implied team total"), ("margin_resid", "margin vs close")):
        out = []
        for yr in (2022, 2023, 2024, 2025):
            x = F[(F.season == yr)].dropna(subset=[c, tgt]); out.append(f"{yr}: r={np.corrcoef(x[c], x[tgt])[0,1]:+.3f}")
        print(f"  {lab:42s} -> {tl:30s} " + "  ".join(out))
# and the simplest bet: top-decile run-matchup edge -> team total OVER / bottom -> UNDER, vs implied, per season
print("\n  bet test: top 10% run-matchup edge -> team points OVER implied; bottom 10% -> UNDER (per season)")
for c in ("match_simple", "match_concept"):
    out = []
    for yr in (2022, 2023, 2024, 2025):
        x = F[(F.season == yr)].dropna(subset=[c, "pts_resid"]); q = x[c].quantile([.1, .9]); hi, lo = x[x[c] >= q[.9]], x[x[c] <= q[.1]]
        w = np.concatenate([(hi.pts_resid > 0).values, (lo.pts_resid < 0).values]); out.append(f"{yr}: {100*w.mean():.1f}% n={len(w)}")
    print(f"  {c:16s} " + "  ".join(out))
print("\nSTEP 2 would be usage (run/pass rate) and STEP 3 expected points per facet — only worth building if step 1 clears the noise ceiling AND 1b shows the residual moves.")
