"""
2025 PORTFOLIO DRY-RUN — conviction-weighted staking across ALL bet types (walk-forward, no leakage; reads the
harness output CSVs which were generated train<2025). Stake scales with each bet's VALIDATED hit-rate:
  MAMMOTH 5u | >=62% 3u | 58-62% 2u | 55-58% 1.5u | 53-55% 1u | model-lean-only 0.5u
Grade honestly (signal-line == grade-line): sides/totals @ open, team-totals @ best posted, 1H @ posted close.
Price -110 (win +0.909 / loss -1.0) except 1H ML at posted American odds. NOT compounded — flat unit = $100.
"""
import re
import numpy as np
import pandas as pd

UNIT = 100.0
def stake_for(hit, mammoth=False):
    if mammoth: return 5.0
    if hit >= 62: return 3.0
    if hit >= 58: return 2.0
    if hit >= 55: return 1.5
    if hit >= 53: return 1.0
    return 0.5

# validated hit% per signal keyword (from LOCKED_MODELS), per market
SIDES = {"STACK": 72, "PREMIUM lay-fav": 66, "padded": 64, "G5 fade": 65, "SB premium": 64, "fade home backup": 60,
         "RvR": 60, "T2 high-edge dog": 59, "CONF SunBelt fade": 58, "lay -6.5": 57, "SB volume": 57,
         "CONF BigTen": 55, "KEY": 54, "T3": 53}
TOTS = {"CONF SunBelt total": 68, "backup QB": 60, "FORM over-hot": 58, "T1 under": 58, "CONF AAC": 57,
        "T1 over": 56, "T2 under": 56, "week 1 opener": 55, "TOTAL fade high": 55, "TOTAL model over-edge": 55,
        "TOTAL fade low": 52, "T2 over": 52}
def best_hit(spots, table):
    if not isinstance(spots, str): return 51
    h = [v for k, v in table.items() if k in spots]
    return max(h) if h else 51

rows = []
def add(market, hit, won, mammoth=False, price=-110):
    st = stake_for(hit, mammoth)
    pay = (abs(price) / 100 if price > 0 else 100 / abs(price)) if won else -1.0
    rows.append({"market": market, "stake": st, "hit": hit, "mammoth": mammoth,
                 "won": int(won), "pnl_u": st * pay})

# ---- SIDES + TOTALS (cfb_bets) ----
b = pd.read_csv("out/cfb_bets_2025.csv")
for _, r in b.iterrows():
    if isinstance(r.sides_bet, str) and r.sides_bet in ("HOME", "AWAY") and pd.notna(r.spread_open) and pd.notna(r.actual_margin):
        if (r.actual_margin + r.spread_open) != 0:
            hc = (r.actual_margin + r.spread_open) > 0
            won = hc if r.sides_bet == "HOME" else (not hc)
            add("SIDES" if not r.mammoth else "SIDES-MAMMOTH", best_hit(r.spots, SIDES), won, mammoth=bool(r.mammoth))
    if isinstance(r.totals_bet, str) and r.totals_bet in ("OVER", "UNDER") and pd.notna(r.total_open) and pd.notna(r.actual_total):
        if r.actual_total != r.total_open:
            ov = r.actual_total > r.total_open
            won = ov if r.totals_bet == "OVER" else (not ov)
            add("TOTALS", best_hit(r.spots, TOTS), won)

# ---- TEAM TOTALS (cfb_team_totals; graded @ best posted line) ----
tt = pd.read_csv("out/cfb_team_totals_2025.csv")
tt = tt[tt.pts.notna() & tt.line.notna() & (tt.pts != tt.line)]
for _, r in tt.iterrows():
    won = (r.pts < r.line) if r.bet == "UNDER" else (r.pts > r.line)
    if r.form_stack == 1: hit = 61
    elif r.bet == "OVER": hit = 62          # P5-only overs
    elif r.p5: hit = 60
    else: hit = 56
    add("TEAM-TOTAL", hit, won)

# ---- 1H (cfb_h1_model) ----
h = pd.read_csv("out/cfb_h1_model_2025.csv")
for _, r in h.iterrows():
    if isinstance(r.h1_spread_bet, str) and r.h1_spread_bet in ("HOME", "AWAY") and pd.notna(r.h1m) and pd.notna(r.hs):
        if (r.h1m + r.hs) != 0:
            hc = (r.h1m + r.hs) > 0
            add("1H-SPREAD", 54, hc if r.h1_spread_bet == "HOME" else (not hc))
    if isinstance(r.h1_tot_bet, str) and r.h1_tot_bet:
        side = r.h1_tot_bet.split("@")[0]; line = r.h1t_hi if side == "UNDER" else r.h1t_lo
        if pd.notna(r.h1t) and pd.notna(line) and r.h1t != line:
            ov = r.h1t > line
            add("1H-TOTAL", 56 if side == "UNDER" else 55, ov if side == "OVER" else (not ov))
    if isinstance(r.h1_ml_bet, str) and r.h1_ml_bet:
        side = "HOME" if "HOME" in r.h1_ml_bet else "AWAY"
        ml = r.mlh_best if side == "HOME" else r.mla_best
        if pd.notna(r.h1m) and pd.notna(ml) and r.h1m != 0:
            won = r.h1m > 0 if side == "HOME" else r.h1m < 0
            add("1H-ML", 51, won, price=float(ml))   # 0.5u track-live; real American payout

R = pd.DataFrame(rows)
def line(label, d):
    n = len(d); st = d.stake.sum(); pnl = d.pnl_u.sum()
    roi = 100 * pnl / st if st else 0
    print(f"  {label:<18} bets {n:<4} staked {st*UNIT:>9,.0f}  P&L {pnl*UNIT:>+9,.0f}  ROI {roi:>+6.1f}%  win {100*d.won.mean() if n else 0:4.1f}%")
print("=" * 86); print("2025 PORTFOLIO DRY-RUN (flat unit = $100, walk-forward, no leakage)"); print("=" * 86)
print("\nBY BET TYPE:")
for m in ["SIDES", "SIDES-MAMMOTH", "TOTALS", "TEAM-TOTAL", "1H-SPREAD", "1H-TOTAL", "1H-ML"]:
    d = R[R.market == m]
    if len(d): line(m, d)
print("\nBY CONVICTION (stake size):")
for lab, lo, hi in [("MAMMOTH 5u", 5, 99), ("HIGH 3u", 3, 3.01), ("MED 2u", 2, 2.01), ("LOW 1.5u", 1.5, 1.51), ("SMALL 1u", 1, 1.01), ("LEAN .5u", 0.5, 0.51)]:
    d = R[(R.stake >= lo) & (R.stake < hi + 0.001)] if lo < 5 else R[R.stake >= 5]
    if len(d): line(lab, d)
print("\n" + "-" * 86)
line("PORTFOLIO TOTAL", R)
spotonly = R[R.stake >= 1.0]
line("EXCL .5u leans", spotonly)
print(f"\n  bankroll note: {R.stake.sum()*UNIT:,.0f} total risked across the season at $100/unit")
