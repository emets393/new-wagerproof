"""Player-prop scheme battery (RESEARCH ONLY) — the owner's example, tested honestly:
does a receiver's CAREER production split vs coverage families, interacted with the OPPONENT'S
scheme identity, predict prop outcomes vs the T-60 close line?

Cells (receptions + reception_yds, the markets with sample):
  P-S1  MAN-BEATER vs MAN-HEAVY D: player's ypt_man_minus_zone top-quartile AND opp man_rate_l8
        top-quartile -> OVER his line? (and the mirror: man-victim vs man-heavy -> UNDER)
  P-S2  ZONE-BEATER vs ZONE-HEAVY D (man_rate bottom-quartile) -> OVER / mirror UNDER.
  P-S3  1-HIGH-BEATER (ypt_one_minus_two top-q) vs SINGLE-high-heavy D -> OVER / mirror.
Guardrails: T-60 close + real prices, both sides vs the cell's own unconditional rate, per-season,
sigma, complements. No model in the loop — these are pure data-interaction cells; if they hit,
they become a SCHEME feature family for the per-market models next.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from attempts_model import amer_profit

DATA = Path(__file__).resolve().parent / "data"
DEC = 1.909

p = pd.read_parquet(DATA / "nfl_prop_v3_panel.parquet")
p = p[p.market.isin(["player_receptions", "player_reception_yds"])].dropna(subset=["close_line", "actual"])
pv = pd.read_parquet(DATA / "nfl_player_vs_scheme.parquet")
ds = pd.read_parquet(DATA / "nfl_def_scheme.parquet")
p = p.merge(pv, on=["season", "week", "player_id"], how="left")
p = p.merge(ds.rename(columns={"team": "opp"}), on=["season", "week", "opp"], how="left")
p = p[p.actual != p.close_line].copy()

# within-season quartiles (all inputs already as-of)
for c in ["ypt_man_minus_zone", "ypt_one_minus_two"]:
    p[f"{c}_q"] = p.groupby("season")[c].transform(lambda s: s.rank(pct=True))
for c in ["man_rate_l8", "two_high_rate_l8"]:
    p[f"{c}_q"] = p.groupby("season")[c].transform(lambda s: s.rank(pct=True))


def cell(d, is_over, lbl, base):
    if len(d) < 40:
        print(f"    {lbl:52} n={len(d)} (thin)"); return
    win = (d.actual > d.close_line).values if is_over else (d.actual < d.close_line).values
    px = (d.over_px if is_over else d.under_px).values
    n = len(d); wr = win.mean() * 100
    roi = np.nanmean(np.where(win, amer_profit(px), -1.0)) * 100
    need = np.nanmean(1 / (1 + amer_profit(px))) * 100
    sg = 100 * np.sqrt(win.mean() * (1 - win.mean())) * DEC / np.sqrt(n)
    by = " ".join(f"{y}:{(((d[d.season==y].actual>d[d.season==y].close_line) if is_over else (d[d.season==y].actual<d[d.season==y].close_line)).mean()*100):.0f}%"
                  for y in (2024, 2025) if len(d[d.season == y]) >= 15)
    print(f"    {lbl:52} n={n:4d} win={wr:5.1f}% unc={base:4.1f} need={need:4.1f} ROI={roi:+6.1f} sig={sg:4.1f} [{by}]")


for mkt in ["player_receptions", "player_reception_yds"]:
    e = p[p.market == mkt]
    base_o = (e.actual > e.close_line).mean() * 100
    print(f"\n===== {mkt} (n={len(e)}, unconditional over {base_o:.1f}%) =====")
    print("  P-S1 MAN interaction:")
    cell(e[(e.ypt_man_minus_zone_q >= 0.75) & (e.man_rate_l8_q >= 0.75)], True,
         "man-beater vs man-heavy D -> OVER", base_o)
    cell(e[(e.ypt_man_minus_zone_q <= 0.25) & (e.man_rate_l8_q >= 0.75)], False,
         "man-victim vs man-heavy D -> UNDER", 100 - base_o)
    print("    controls (same player types vs LOW-man D — effect should shrink):")
    cell(e[(e.ypt_man_minus_zone_q >= 0.75) & (e.man_rate_l8_q <= 0.25)], True,
         "man-beater vs zone-heavy D -> OVER (control)", base_o)
    cell(e[(e.ypt_man_minus_zone_q <= 0.25) & (e.man_rate_l8_q <= 0.25)], False,
         "man-victim vs zone-heavy D -> UNDER (control)", 100 - base_o)
    print("  P-S2 ZONE interaction (mirror family):")
    cell(e[(e.ypt_man_minus_zone_q <= 0.25) & (e.man_rate_l8_q <= 0.25)], True,
         "zone-beater vs zone-heavy D -> OVER", base_o)
    print("  P-S3 SHELL interaction:")
    cell(e[(e.ypt_one_minus_two_q >= 0.75) & (e.two_high_rate_l8_q <= 0.25)], True,
         "1high-beater vs single-high D -> OVER", base_o)
    cell(e[(e.ypt_one_minus_two_q >= 0.75) & (e.two_high_rate_l8_q >= 0.75)], False,
         "1high-beater vs two-high D -> UNDER", 100 - base_o)
