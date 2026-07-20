"""Phase 3 — go deep on the 'pass-heavy O vs leaky pass D' totals lead across EVERY market, with
extremity dose-response dials, complement checks, per-season breakdown, and scan honesty.
FG spread/total/ML: 2016-2025 (9 seasons). Team total + 1H spread/total/ML: 2023-2025 (3 seasons).
Grade at the close (FG) / h2 consensus (derivative); decimal prices; breakeven 52.4%."""
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
DEC = 1.909

tg = pd.read_parquet("data/cfb_team_games_profiled.parquet")
# attach OPPONENT percentile profile (leaky pass D lives on the opponent)
oppcols = ["d_pass_epa_all_pct", "d_explos_all_pct", "d_epa_allowed_pct", "o_pass_rate_pct", "o_epa_pct"]
opp = tg[["game_id", "team"] + oppcols].rename(columns={**{"team": "opponent"}, **{c: "opp_" + c for c in oppcols}})
tg = tg.merge(opp, on=["game_id", "opponent"], how="left")
mk = pd.read_parquet("data/cfb_markets_2325.parquet")
tg = tg.merge(mk[["game_id", "team", "tt_over", "h1_covered", "h1_over", "h1_won", "h1_ml_dec"]],
              on=["game_id", "team"], how="left")

def stats(d, col, price=None, side_hi=True):
    """side_hi: bet the '1' side (e.g. over/cover/win). Returns n, pct, roi, seasons-on-side."""
    d = d.dropna(subset=[col])
    if len(d) == 0: return None
    p = d[col].mean() if side_hi else (1 - d[col].mean())
    if price is not None:
        # ML: realized profit at decimal price for the chosen side (only '1' side supported here)
        prof = (d[col] * d[price] - 1).mean()
        roi = prof * 100
    else:
        roi = (p * DEC - 1) * 100
    by = d.groupby("season")[col].apply(lambda x: x.mean() if side_hi else 1 - x.mean())
    return dict(n=len(d), pct=round(p * 100, 1), roi=round(roi, 1),
                seasons=f"{(by>=0.5).sum()}/{by.notna().sum()}", rng=f"{round(by.min()*100)}-{round(by.max()*100)}")

def line(lbl, s):
    print(f"  {lbl:42s} " + (f"{s['pct']:5.1f}%  n={s['n']:5d}  ROI {s['roi']:+6.1f}  seasons {s['seasons']:>4} [{s['rng']}]" if s else "   —  no sample"))

# ── DOSE-RESPONSE: FG total UNDER by pass-heavy × leaky-pass-D extremity (game-level, dedup) ──
print("="*96); print("DOSE-RESPONSE — pass-heavy O vs leaky pass D → FG game UNDER (2016-2025, game-level)"); print("="*96)
for ph in [0.60, 0.70, 0.80]:
    for lk in [0.60, 0.70, 0.80]:
        m = (tg.o_pass_rate_pct >= ph) & (tg.opp_d_pass_epa_all_pct >= lk)
        d = tg[m].drop_duplicates("game_id")
        line(f"pass≥{int(ph*100)} × leakyD≥{int(lk*100)}", stats(d, "over", side_hi=False))

# ── EVERY MARKET at the primary threshold (pass≥70 × leakyD≥70) ──
print("\n" + "="*96); print("EVERY MARKET — condition: pass-heavy≥70th × opp leaky-pass-D≥70th"); print("="*96)
m = (tg.o_pass_rate_pct >= 0.70) & (tg.opp_d_pass_epa_all_pct >= 0.70)
sub = tg[m]
subg = sub.drop_duplicates("game_id")
print("-- game-level (dedup) --")
line("FG total UNDER", stats(subg, "over", side_hi=False))
line("1H total UNDER (2023-25)", stats(subg, "h1_over", side_hi=False))
print("-- team perspective (the pass-heavy team) --")
line("team total UNDER (2023-25)", stats(sub, "tt_over", side_hi=False))
line("FG spread — team covers", stats(sub, "covered", side_hi=True))
line("FG spread — FADE team (dog side)", stats(sub, "covered", side_hi=False))
line("FG ML — team wins SU", stats(sub.assign(su=(sub.team_margin>0).astype(float)), "su", side_hi=True))
line("1H spread — team covers (2023-25)", stats(sub, "h1_covered", side_hi=True))
line("1H total UNDER (team rows, 2023-25)", stats(sub, "h1_over", side_hi=False))
line("1H ML — team wins 1H @ price (2023-25)", stats(sub, "h1_won", price="h1_ml_dec", side_hi=True))

# ── COMPLEMENT checks (should be symmetric-negative if the signal is real) ──
print("\n" + "="*96); print("COMPLEMENT / SPECIFICITY checks (FG total, game-level)"); print("="*96)
line("pass-heavy≥70 vs ELITE pass D≤30 (mirror)", stats(tg[(tg.o_pass_rate_pct>=0.70)&(tg.opp_d_pass_epa_all_pct<=0.30)].drop_duplicates("game_id"), "over", side_hi=False))
line("RUN-heavy≤30 vs leaky pass D≥70", stats(tg[(tg.o_pass_rate_pct<=0.30)&(tg.opp_d_pass_epa_all_pct>=0.70)].drop_duplicates("game_id"), "over", side_hi=False))
line("pass-heavy≥70 vs AVG pass D (40-60)", stats(tg[(tg.o_pass_rate_pct>=0.70)&(tg.opp_d_pass_epa_all_pct.between(0.4,0.6))].drop_duplicates("game_id"), "over", side_hi=False))
line("BASELINE all games FG total UNDER", stats(tg.drop_duplicates("game_id"), "over", side_hi=False))

# ── MECHANISM: is the total inflated? avg line vs actual for the cell ──
print("\n" + "="*96); print("MECHANISM — posted total vs actual points (the cell vs baseline)"); print("="*96)
c = subg.dropna(subset=["over"])
b = tg.drop_duplicates("game_id").dropna(subset=["over"])
print(f"  cell:     avg line {c.total_close.mean():.1f}  actual {c.actual_total.mean():.1f}  (diff {c.actual_total.mean()-c.total_close.mean():+.1f})  n={len(c)}")
print(f"  baseline: avg line {b.total_close.mean():.1f}  actual {b.actual_total.mean():.1f}  (diff {b.actual_total.mean()-b.total_close.mean():+.1f})")
