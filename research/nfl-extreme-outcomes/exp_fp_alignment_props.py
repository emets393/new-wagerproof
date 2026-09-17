#!/usr/bin/env python3
"""First Fantasy Points alignment study (owner priority, 2026-09-16).

Question: does alignment matchup — a receiver's slot/wide identity vs the
defense's alignment funnel — condition prop OVER rates beyond the line?

Construct (all entering-game, strictly prior weeks, leak-safe):
  player_slot_share : slot routes / total routes, s2d expanding (shifted)
  def_slot_funnel   : share of receiving yards a defense concedes to SLOT
                      alignment, s2d expanding (shifted)
Grade: actual vs close line on player_reception_yds / player_receptions
(2022-2025 — separation charting floor is 2022).
"""
import numpy as np
import pandas as pd

sep = pd.read_parquet("data/fpdata/player_receiving-separation-by-alignment.parquet")
cols = {c.lower(): c for c in sep.columns}
# locate slot/wide route + yards columns
slot_rte = next(c for c in sep.columns if "Slot" in c and "Routes" in c and "Total" in c)
all_rte = next(c for c in sep.columns if "Overall" in c and "Routes" in c and "Total" in c)
slot_yds = next((c for c in sep.columns if "Slot" in c and "Yard" in c), None)
all_yds = next((c for c in sep.columns if "Overall" in c and "Yard" in c), None)
print(f"using: {slot_rte} / {all_rte} | {slot_yds} / {all_yds}")

sep["name"] = sep.playerFirstName.str.strip() + " " + sep.playerLastName.str.strip()
for c in (slot_rte, all_rte, slot_yds, all_yds):
    if c:
        sep[c] = pd.to_numeric(sep[c], errors="coerce")
sep = sep.sort_values(["playerPlayerId", "__season", "__week"])

# player slot share entering game (cumulative prior routes)
gp = sep.groupby(["playerPlayerId", "__season"])
sep["cum_slot"] = gp[slot_rte].transform(lambda s: s.shift(1).expanding().sum())
sep["cum_all"] = gp[all_rte].transform(lambda s: s.shift(1).expanding().sum())
sep["slot_share_pre"] = sep.cum_slot / sep.cum_all.replace(0, np.nan)

# defense slot funnel entering game: yards to slot / total, by opponent
dg = (sep.groupby(["opponentAbbreviation", "__season", "__week"])
      .agg(slot_y=(slot_yds, "sum"), all_y=(all_yds, "sum")).reset_index()
      .sort_values(["opponentAbbreviation", "__season", "__week"]))
dgg = dg.groupby(["opponentAbbreviation", "__season"])
dg["cs"] = dgg.slot_y.transform(lambda s: s.shift(1).expanding().sum())
dg["ca"] = dgg.all_y.transform(lambda s: s.shift(1).expanding().sum())
dg["def_slot_funnel_pre"] = dg.cs / dg.ca.replace(0, np.nan)

sep = sep.merge(dg[["opponentAbbreviation", "__season", "__week", "def_slot_funnel_pre"]],
                on=["opponentAbbreviation", "__season", "__week"], how="left")

# join to graded props via crosswalk
cw = pd.read_parquet("data/fpdata/player_crosswalk.parquet")[["player_id", "playerPlayerId"]]
panel = pd.read_parquet("data/nfl_prop_v3_panel.parquet")
line_col = next(c for c in panel.columns if "close" in c.lower() and "line" in c.lower())
pan = panel[panel.market.isin(["player_reception_yds", "player_receptions"])].copy()
pan = pan.merge(cw, on="player_id", how="inner")
j = pan.merge(sep[["playerPlayerId", "__season", "__week", "slot_share_pre", "def_slot_funnel_pre"]],
              left_on=["playerPlayerId", "season", "week"],
              right_on=["playerPlayerId", "__season", "__week"], how="inner")
j = j.dropna(subset=["slot_share_pre", "def_slot_funnel_pre", "actual", line_col])
j["over"] = np.where(j.actual == j[line_col], np.nan, (j.actual > j[line_col]).astype(float))
print(f"joined prop rows with alignment context: {len(j)} ({j.season.min()}-{j.season.max()})\n")

def cell(name, m, d=None):
    d = j if d is None else d
    c = d[m]["over"].dropna()
    if len(c) < 30:
        print(f"{name:58s} n={len(c)}")
        return
    z = (c.mean() - 0.5) * 2 * np.sqrt(len(c))
    print(f"{name:58s} {int(c.sum()):5d}-{int(len(c)-c.sum()):5d} ({100*c.mean():.1f}%)  z={z:+.2f}")

for mkt in ("player_reception_yds", "player_receptions"):
    d = j[j.market == mkt]
    print(f"== {mkt} (base over rate: {100*d.over.mean():.1f}%, n={d.over.notna().sum()}) ==")
    slot_hi = d.slot_share_pre >= 0.6
    slot_lo = d.slot_share_pre <= 0.35
    fun_q = d.def_slot_funnel_pre.rank(pct=True)
    fun_hi, fun_lo = fun_q >= 0.67, fun_q <= 0.33
    cell("slot receiver vs slot-funnel defense (MATCH)", slot_hi & fun_hi, d)
    cell("slot receiver vs slot-stingy defense (MISMATCH)", slot_hi & fun_lo, d)
    cell("wide receiver vs slot-funnel defense (MISMATCH)", slot_lo & fun_hi, d)
    cell("wide receiver vs slot-stingy defense (MATCH-wide)", slot_lo & fun_lo, d)
    print()
