#!/usr/bin/env python3
"""Size + defense vs a paint-heavy, non-shooting offense -- NCAAB, six seasons at the T-60 close (owner theory 2026-10-28).

Theory: a team that scores inside and does not shoot threes meets a team that is much bigger and plays good defense -> the
small team cannot score, the big team wins, and the game stays under the total.

Row = one TEAM-game from the SMALL/paint team's side ("own"); the opponent ("opp") is the big defensive team. Every input is
pregame: style percentiles are expanding means of PRIOR games ranked within season (research/bball-odds/build_style_features),
height is KenPom's roster effective height for the season, defense is KenPom AdjDE as of the game date (archive). Lines = T-60.
Outcomes graded from the THESIS side: UNDER at the T-60 under price, BIG TEAM ATS at -110, BIG TEAM MONEYLINE at its price,
and the two teams' points against their implied team totals ((total -/+ spread)/2).

Outputs SIZE_DEFENSE_RUN.txt next to this file.
"""
import os
import sys
import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
BB = os.path.join(ROOT, "..", "bball-odds", "data", "parquet")
rng = np.random.default_rng(7)
out = open(os.path.join(ROOT, "SIZE_DEFENSE_RUN.txt"), "w")


def P(*a):
    s = " ".join(str(x) for x in a); print(s); out.write(s + "\n"); out.flush()


# ------------------------------------------------------------------------------------------------------- build
cols = ["cbbd_id", "season", "date", "month", "is_home", "neutral", "nonconf", "conf_game", "conf_tourney", "ncaa_t", "mte", "gnum", "o_game_num",
        "own_pts", "opp_pts", "margin", "spread", "total_line", "tot_resid", "ats_pts", "win", "ml_price", "opp_ml_price", "spread_price",
        "h_HgtEff", "a_HgtEff", "h_Hgt5", "a_Hgt5", "own_kp_em", "o_kp_em", "own_kp_tempo", "o_kp_tempo"]
style = ["pct_p3a_rate", "pct_paint_share", "pct_p3_pct", "pct_p3_share", "pct_pace", "pct_d_efg", "pct_d_paint100", "pct_d_p3a_rate", "pct_oreb"]
cols += [f"{s}_{c}" for s in ("h", "a") for c in style]
D = pd.read_parquet(f"{BB}/cbb_sit_panel.parquet", columns=cols)
F = pd.read_parquet(f"{BB}/ncaab_model_features.parquet", columns=["cbbd_id", "home_kp_de", "away_kp_de", "home_kp_oe", "away_kp_oe", "t60_total_under_price", "t60_total_over_price"]).drop_duplicates("cbbd_id")
D = D.merge(F, on="cbbd_id", how="left")
D = D[D.total_line.notna() & D.spread.notna()].copy()
D["season_end"] = D.season.str[:4].astype(int) + 1
h = D.is_home == 1
for c in style:
    D[f"own_{c}"] = np.where(h, D[f"h_{c}"], D[f"a_{c}"]); D[f"opp_{c}"] = np.where(h, D[f"a_{c}"], D[f"h_{c}"])
D["own_hgt"] = np.where(h, D.h_HgtEff, D.a_HgtEff); D["opp_hgt"] = np.where(h, D.a_HgtEff, D.h_HgtEff)
D["own_hgt5"] = np.where(h, D.h_Hgt5, D.a_Hgt5); D["opp_hgt5"] = np.where(h, D.a_Hgt5, D.h_Hgt5)
D["hgt_gap"] = D.opp_hgt - D.own_hgt                       # inches of effective height the opponent has on us
D["hgt5_gap"] = D.opp_hgt5 - D.own_hgt5
D["own_de"] = np.where(h, D.home_kp_de, D.away_kp_de); D["opp_de"] = np.where(h, D.away_kp_de, D.home_kp_de)
D["opp_oe"] = np.where(h, D.away_kp_oe, D.home_kp_oe)
# KenPom AdjDE as of the game date, ranked within season-month across team-games (lower AdjDE = better defense) -> pct 0 = best
D["opp_def_pct"] = D.groupby(["season_end", "month"]).opp_de.rank(pct=True)
D["own_def_pct"] = D.groupby(["season_end", "month"]).own_de.rank(pct=True)
D["under_price"] = D.t60_total_under_price.fillna(1.91)
D["own_impl"] = (D.total_line - D.spread) / 2; D["opp_impl"] = (D.total_line + D.spread) / 2
D["own_vs_impl"] = D.own_pts - D.own_impl; D["opp_vs_impl"] = D.opp_pts - D.opp_impl
D["big_spread"] = -D.spread                                  # the big team's spread (negative = favored)
D["big_cover"] = np.sign(-D.ats_pts)                         # +1 big team covers, -1 small team covers, 0 push
D["under"] = np.sign(-D.tot_resid)                           # +1 under, -1 over, 0 push
D["big_win"] = 1 - D.win
D["big_impl_p"] = 1 / D.opp_ml_price
D["novdec"] = D.month.isin([11, 12]); D["janplus"] = D.month.isin([1, 2, 3])
D["tourney"] = (D.conf_tourney == 1) | (D.ncaa_t == 1)
D["key"] = D.season_end.astype(str) + "-" + D.month.astype(str)
P(f"team-games with a line: {len(D):,}  seasons {sorted(D.season_end.unique())}  style coverage {D.own_pct_p3a_rate.notna().mean():.2f} (needs ~6 prior games)  height {D.hgt_gap.notna().mean():.3f}  AdjDE {D.opp_de.notna().mean():.3f}")
P(f"paint-share coverage by season (box score pointsInPaint is thin before 2022-23): " + str(D.groupby('season_end').own_pct_paint_share.apply(lambda s: s.notna().mean()).round(2).to_dict()))

# ------------------------------------------------------------------------------------------------------- grading
def rec(sgn):
    return int((sgn > 0).sum()), int((sgn < 0).sum()), int((sgn == 0).sum())


def roi_dec(win_mask, loss_mask, price):
    """ROI % at decimal prices from the bet side."""
    n = int(win_mask.sum() + loss_mask.sum())
    if n == 0: return np.nan
    return 100 * (float(((price - 1) * win_mask).sum()) - float(loss_mask.sum())) / n


def shuffle_p(mask, sgn, n=1000):
    """p of the observed (wins - losses) for sgn inside mask vs permuting mask within season-month. Two-sided-ish: P(|null| >= |obs|)."""
    m = mask.values.astype(bool); s = sgn.values
    ok = ~np.isnan(s)
    m, s, k = m[ok], s[ok], D.key.values[ok]
    obs = s[m].sum()
    idx_by_key = {}
    for i, kk in enumerate(k): idx_by_key.setdefault(kk, []).append(i)
    groups = [(np.array(v), m[np.array(v)].sum()) for v in idx_by_key.values() if m[np.array(v)].sum() > 0]
    null = np.zeros(n)
    for j in range(n):
        tot = 0.0
        for idx, cnt in groups:
            tot += s[rng.choice(idx, cnt, replace=False)].sum()
        null[j] = tot
    return float((np.abs(null) >= abs(obs)).mean())


def cell(label, mask, p=False, lines=True):
    s = D[mask & D.hgt_gap.notna()]
    n = len(s)
    if n < 60:
        P(f"  {label:<72} n={n} (thin)"); return
    uw, ul, up = rec(s.under); cw, cl, cp = rec(s.big_cover); mw = int(s.big_win.sum()); ml = int((s.big_win == 0).sum())
    u_roi = roi_dec(s.under > 0, s.under < 0, s.under_price); c_roi = 100 * (cw * 0.9091 - cl) / max(cw + cl, 1)
    m_roi = roi_dec(s.big_win == 1, s.big_win == 0, s.opp_ml_price) if s.opp_ml_price.notna().mean() > 0.9 else np.nan
    txt = (f"  {label:<72} n={n:5d} | UNDER {uw}-{ul} ({100*uw/max(uw+ul,1):.1f}%, {u_roi:+.1f}%) tot {s.tot_resid.mean():+.2f} "
           f"| BIG ATS {cw}-{cl} ({100*cw/max(cw+cl,1):.1f}%, {c_roi:+.1f}%) | BIG ML {mw}-{ml} ({100*mw/max(mw+ml,1):.1f}% vs impl {100*s.big_impl_p.mean():.1f}%, {m_roi:+.1f}%) "
           f"| small {s.own_vs_impl.mean():+.2f} big {s.opp_vs_impl.mean():+.2f} vs implied | line {s.total_line.mean():.1f} big sprd {s.big_spread.mean():+.1f}")
    if p:
        txt += f" | shuffle p under {shuffle_p(mask & D.hgt_gap.notna(), D.under):.3f} ats {shuffle_p(mask & D.hgt_gap.notna(), D.big_cover):.3f}"
    P(txt)


def seasons(label, mask):
    s = D[mask & D.hgt_gap.notna()]
    parts = []
    for y, g in s.groupby("season_end"):
        uw, ul, _ = rec(g.under); cw, cl, _ = rec(g.big_cover)
        parts.append(f"{str(y)[2:]}: U {uw}-{ul} ATS {cw}-{cl}")
    P(f"  {label:<72} " + " | ".join(parts))


valid = D.own_pct_p3a_rate.notna() & D.opp_def_pct.notna()
P("\n=== 0. BASE RATES (every priced team-game, both perspectives) ===")
cell("all team-games", D.cbbd_id.notna())
cell("style columns populated (6+ prior games) and AdjDE present", valid)

P("\n=== A. ONE COMPONENT AT A TIME (small-team perspective; 'BIG' = the opponent) ===")
P("-- own three-point attempt rate quintile (Q1 = shoots the fewest threes)")
D["p3a_q"] = pd.cut(D.own_pct_p3a_rate, [-0.01, 0.2, 0.4, 0.6, 0.8, 1.0], labels=["Q1 fewest 3s", "Q2", "Q3", "Q4", "Q5 most 3s"])
for q in D.p3a_q.cat.categories: cell(f"own 3PA rate {q}", valid & (D.p3a_q == q))
P("-- own paint share quintile (2022-23 on; Q5 = most points in the paint)")
D["paint_q"] = pd.cut(D.own_pct_paint_share, [-0.01, 0.2, 0.4, 0.6, 0.8, 1.0], labels=["Q1", "Q2", "Q3", "Q4", "Q5 most paint"])
for q in D.paint_q.cat.categories: cell(f"own paint share {q}", valid & (D.season_end >= 2023) & (D.paint_q == q))
P("-- own 3P% quintile (Q1 = worst shooters)")
D["p3pct_q"] = pd.cut(D.own_pct_p3_pct, [-0.01, 0.2, 0.4, 0.6, 0.8, 1.0], labels=["Q1 worst 3P%", "Q2", "Q3", "Q4", "Q5 best 3P%"])
for q in D.p3pct_q.cat.categories: cell(f"own 3P% {q}", valid & (D.p3pct_q == q))
P("-- opponent effective-height advantage over us, inches (KenPom HgtEff)")
D["gap_b"] = pd.cut(D.hgt_gap, [-9, -2, -1, 0, 1, 2, 3, 9], labels=["<-2 (we are much taller)", "-2..-1", "-1..0", "0..1", "1..2", "2..3", "3+ (they are much taller)"])
for q in D.gap_b.cat.categories: cell(f"opp height edge {q}", valid & (D.gap_b == q))
P("-- opponent KenPom AdjDE quintile as of the game (Q1 = best defenses)")
D["def_q"] = pd.cut(D.opp_def_pct, [-0.01, 0.2, 0.4, 0.6, 0.8, 1.0], labels=["Q1 best D", "Q2", "Q3", "Q4", "Q5 worst D"])
for q in D.def_q.cat.categories: cell(f"opp defense {q}", valid & (D.def_q == q))

P("\n=== B. THE THESIS CELLS (pre-stated) ===")
low3 = D.own_pct_p3a_rate <= 0.25; vlow3 = D.own_pct_p3a_rate <= 0.15
cant = D.own_pct_p3_pct <= 0.50
big1 = D.hgt_gap >= 1; big2 = D.hgt_gap >= 2; big3 = D.hgt_gap >= 3
gd = D.opp_def_pct <= 0.20; gd25 = D.opp_def_pct <= 0.25
paint = D.own_pct_paint_share >= 0.75
T1 = valid & low3 & big1 & gd
cell("T1  own 3PA rate bottom quartile & opp taller by 1+ & opp AdjDE top 20%", T1, p=True); seasons("    T1 by season", T1)
cell("T2  ... opp taller by 2+", valid & low3 & big2 & gd, p=True)
cell("T3  ... opp taller by 3+", valid & low3 & big3 & gd)
cell("T4  T1 and we also shoot it badly (3P% below median)", valid & low3 & cant & big1 & gd, p=True)
cell("T5  3PA rate bottom 15% & opp taller by 1+ & opp AdjDE top 20%", valid & vlow3 & big1 & gd)
cell("T6  PAINT share top quartile & opp taller by 1+ & opp AdjDE top 20% (2022-23 on)", valid & (D.season_end >= 2023) & paint & big1 & gd, p=True)
cell("T7  paint top quartile & 3PA bottom quartile & opp taller 1+ & top-20% D (2022-23 on)", valid & (D.season_end >= 2023) & paint & low3 & big1 & gd)
P("-- pairs (which two of the three carry it?)")
cell("P1  3PA bottom quartile & opp taller by 1+ (any defense)", valid & low3 & big1)
cell("P2  3PA bottom quartile & opp AdjDE top 20% (any height)", valid & low3 & gd)
cell("P3  opp taller by 1+ & opp AdjDE top 20% (any offense)", valid & big1 & gd)
cell("P4  opp taller by 2+ & opp AdjDE top 20% (any offense)", valid & big2 & gd)
P("-- placebos: the same big defensive opponent against a THREE-HEAVY small team (thesis says these should differ)")
cell("X1  own 3PA rate TOP quartile & opp taller by 1+ & opp AdjDE top 20%", valid & (D.own_pct_p3a_rate >= 0.75) & big1 & gd, p=True)
cell("X2  own 3PA rate middle half & opp taller by 1+ & opp AdjDE top 20%", valid & D.own_pct_p3a_rate.between(0.25, 0.75) & big1 & gd)
P("-- the mirror: WE are the big defensive team facing a non-shooter (same games from the other side, sanity)")
cell("M1  own taller by 1+ & own AdjDE top 20% & opp 3PA rate bottom quartile", valid & (D.hgt_gap <= -1) & (D.own_def_pct <= 0.20) & (D.opp_pct_p3a_rate <= 0.25))

P("\n=== C. INTERACTION GRID: own 3PA-rate tercile x opp height edge, inside opp AdjDE top 25% (UNDER % / BIG ATS % / n) ===")
D["p3a_t"] = pd.cut(D.own_pct_p3a_rate, [-0.01, 1 / 3, 2 / 3, 1.0], labels=["few 3s", "mid", "many 3s"])
D["gap_t"] = pd.cut(D.hgt_gap, [-9, 0, 1, 2, 9], labels=["opp shorter", "0..1", "1..2", "2+"])
g = D[valid & gd25]
for pt in D.p3a_t.cat.categories:
    row = []
    for gt in D.gap_t.cat.categories:
        s = g[(g.p3a_t == pt) & (g.gap_t == gt)]
        uw, ul, _ = rec(s.under); cw, cl, _ = rec(s.big_cover)
        row.append(f"{gt}: U {100*uw/max(uw+ul,1):.1f}% ATS {100*cw/max(cw+cl,1):.1f}% (n {len(s)})")
    P(f"  {pt:<9} | " + " | ".join(row))
P("-- same grid, opp AdjDE WORST 50% (if the defense matters, these rows should look different)")
g = D[valid & (D.opp_def_pct > 0.5)]
for pt in D.p3a_t.cat.categories:
    row = []
    for gt in D.gap_t.cat.categories:
        s = g[(g.p3a_t == pt) & (g.gap_t == gt)]
        uw, ul, _ = rec(s.under); cw, cl, _ = rec(s.big_cover)
        row.append(f"{gt}: U {100*uw/max(uw+ul,1):.1f}% ATS {100*cw/max(cw+cl,1):.1f}% (n {len(s)})")
    P(f"  {pt:<9} | " + " | ".join(row))

P("\n=== D. T1 SPLITS (does any slice carry it?) ===")
cell("T1 Nov-Dec", T1 & D.novdec); cell("T1 Jan-Mar", T1 & D.janplus)
cell("T1 non-conference", T1 & (D.nonconf == 1)); cell("T1 conference game", T1 & (D.conf_game == 1))
cell("T1 regular season only (no tournaments)", T1 & ~D.tourney)
cell("T1 big team at home", T1 & (D.is_home == 0) & (D.neutral == 0)); cell("T1 big team away", T1 & (D.is_home == 1) & (D.neutral == 0)); cell("T1 neutral", T1 & (D.neutral == 1))
cell("T1 big team favored by 10+", T1 & (D.big_spread <= -10)); cell("T1 big team favored 0-10", T1 & D.big_spread.between(-10, 0)); cell("T1 big team is the DOG", T1 & (D.big_spread > 0))
cell("T1 total line under 135", T1 & (D.total_line < 135)); cell("T1 total 135-145", T1 & D.total_line.between(135, 145)); cell("T1 total over 145", T1 & (D.total_line > 145))
cell("T1 small team KenPom better than opp (upset spot)", T1 & (D.own_kp_em > D.o_kp_em)); cell("T1 small team KenPom worse", T1 & (D.own_kp_em <= D.o_kp_em))
cell("T1 slow big team (opp AdjTempo bottom third)", T1 & (D.o_kp_tempo <= D.groupby('season_end').o_kp_tempo.transform(lambda s: s.quantile(1/3))))
cell("T1 small team also rebounds well (oreb pct top third)", T1 & (D.own_pct_oreb >= 2 / 3)); cell("T1 small team poor on the glass", T1 & (D.own_pct_oreb <= 1 / 3))
cell("T1 opp also protects the paint (d_paint100 pct bottom quartile)", T1 & (D.opp_pct_d_paint100 <= 0.25)); cell("T1 opp D does NOT protect the paint (top half)", T1 & (D.opp_pct_d_paint100 >= 0.5))

P("\n=== E. IS THE MARKET ALREADY THERE? (what the line does in the thesis cell vs the rest) ===")
s, r = D[T1], D[valid & ~T1]
P(f"  T1 total line {s.total_line.mean():.1f} vs rest {r.total_line.mean():.1f}; actual total {s.own_pts.add(s.opp_pts).mean():.1f} vs rest {r.own_pts.add(r.opp_pts).mean():.1f}")
P(f"  T1 big-team spread {s.big_spread.mean():+.1f} (implied win {100*s.big_impl_p.mean():.1f}%, actual {100*s.big_win.mean():.1f}%); small team scores {s.own_vs_impl.mean():+.2f} vs implied, big team {s.opp_vs_impl.mean():+.2f}")
# linear read: total residual and big-team ATS margin on the three components (standardized), all valid rows
X = D[valid & D.hgt_gap.notna()].copy()
Z = np.column_stack([np.ones(len(X)), -(X.own_pct_p3a_rate - 0.5) / 0.29, X.hgt_gap.fillna(0), -(X.opp_def_pct - 0.5) / 0.29])
for y, nm in ((X.tot_resid.values, "total minus line"), ((-X.ats_pts).values, "big-team ATS margin"), (X.own_vs_impl.values, "small team pts vs implied")):
    b = np.linalg.lstsq(Z, y, rcond=None)[0]; res = y - Z @ b; se = np.sqrt(np.diag(np.linalg.inv(Z.T @ Z)) * res.var())
    P(f"  {nm:<28} ~ fewer-3s(sd) {b[1]:+.2f} (t {b[1]/se[1]:+.1f})  opp height edge/inch {b[2]:+.2f} (t {b[2]/se[2]:+.1f})  better-opp-D(sd) {b[3]:+.2f} (t {b[3]/se[3]:+.1f})")
out.close()
