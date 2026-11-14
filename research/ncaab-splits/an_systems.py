#!/usr/bin/env python3
"""Grade Action Network's four NCAAB Pro Systems (Bet Labs) on the two seasons of AN splits we hold.

Their records run 2005-2024 on Bet Labs' own data. 2024-25 and 2025-26 are out of sample for every one of them,
and that is the only test that matters for a system built by filtering a 20-year table.

    python3 an_systems.py
"""
import numpy as np
import pandas as pd

d = pd.read_parquet("data/ncaab_splits.parquet")
d = d[d.tix_away.notna() & ~d.placeholder_sp].copy()
d["dow"] = d.slate_date.dt.day_name()
POWER = {"BIG12", "SEC", "PAC12", "ACC", "BIGTEN", "BIGEAST"}

# ---- team-game panel ---------------------------------------------------------------------------------------
rows = []
for r in d.itertuples():
    for home in (True, False):
        rows.append(dict(
            season=r.season, slate_date=r.slate_date, tip=r.tip_utc, game_id=r.game_id, dow=r.dow,
            team=r.home if home else r.away, team_id=r.home_id if home else r.away_id, is_home=home,
            conf=r.home_conf if home else r.away_conf, conf_game=r.conf_game, game_type=r.game_type,
            rank=r.home_rank if home else r.away_rank, total_line=r.total_line,
            spread=r.home_spread if home else -r.home_spread,
            price=(r.home_spread_price if home else r.away_spread_price),
            tix=(100 - r.tix_away) if home else r.tix_away,
            margin=(r.home_pts - r.away_pts) if home else (r.away_pts - r.home_pts),
        ))
P = pd.DataFrame(rows)
P["ats"] = P.margin + P.spread
P["is_dog"] = P.spread > 0
P = P.sort_values(["team_id", "season", "slate_date", "tip"])
g = P.groupby(["team_id", "season"])
P["prev_margin"] = g.margin.shift(1)
P["prev_ats"] = g.ats.shift(1)
P["prev_home"] = g.is_home.shift(1)
win = (P.ats > 0).astype(float); loss = (P.ats < 0).astype(float)
P["ats_w_prior"] = win.groupby([P.team_id, P.season]).cumsum() - win
P["ats_l_prior"] = loss.groupby([P.team_id, P.season]).cumsum() - loss
P["ats_pct_prior"] = 100 * P.ats_w_prior / (P.ats_w_prior + P.ats_l_prior).replace(0, np.nan)
reg = P.game_type.fillna("reg").eq("reg")


def pay(price):
    p = -110 if price is None or (isinstance(price, float) and np.isnan(price)) else float(price)
    return 100 / abs(p) if p < 0 else abs(p) / 100


def grade(name, m, record):
    s = P[m]
    w, l, p = int((s.ats > 0).sum()), int((s.ats < 0).sum()), int((s.ats == 0).sum())
    profit = sum(pay(x) for x in s.loc[s.ats > 0, "price"]) - l
    roi = 100 * profit / max(w + l, 1)
    pct = 100 * w / max(w + l, 1)
    n = w + l
    lo = (pct / 100 - 1.96 * np.sqrt(pct / 100 * (1 - pct / 100) / max(n, 1))) * 100 if n else 0
    print(f"\n{name}\n  AN's record 2005-24: {record}")
    print(f"  OUT OF SAMPLE 2024-26: {w}-{l}-{p}  {pct:.1f}%  (95% lower {lo:.1f}%)  ROI {roi:+.1f}% at the consensus price")
    for sn, ss in s.groupby("season"):
        ww, ll = int((ss.ats > 0).sum()), int((ss.ats < 0).sum())
        print(f"     {sn - 1}-{str(sn)[2:]}: {ww}-{ll}  {100 * ww / max(ww + ll, 1):.1f}%")
    return s


print(f"panel: {len(P)} team-games, {P['rank'].notna().sum()} ranked, prev-game known for {P.prev_margin.notna().mean():.0%}")

s1 = grade("1. Fade The Public In Big Conferences -- team in a power conference, conference game, regular season, closing total 128-146.5, team has 0-24% of spread tickets",
           reg & P.conf_game & P.conf.isin(POWER) & P.total_line.between(128, 146.5) & P.tix.between(0, 24), "597-470-28 (56%), +8%")
s2 = grade("2. Top 15 Home Teams -- AP top 15, at home, non-conference, regular season, won previous game (at home) by 5-63, season ATS% 0-75%",
           reg & ~P.conf_game & P.is_home & P["rank"].between(1, 15) & P.prev_margin.between(5, 63) & (P.prev_home == True) & P.ats_pct_prior.between(0, 75), "261-191-8 (58%), +12%")
s3 = grade("3. Big Conference Dogs -- visitor, regular season, Saturday, conference game, dog +10 to +14, 7-35% of tickets, lost previous game and failed to cover it",
           reg & P.conf_game & ~P.is_home & (P.dow == "Saturday") & P.spread.between(10, 14) & P.tix.between(7, 35) & (P.prev_margin <= -1) & (P.prev_ats <= -1), "228-167-8 (58%), +12%")
s4 = grade("4. Betting Against The Public -- visiting dog +10 to +15, conference game, 0-25% of tickets, previous game ATS margin -15 to -5",
           P.conf_game & ~P.is_home & P.spread.between(10, 15) & P.tix.between(0, 25) & P.prev_ats.between(-15, -5), "143-85-3 (63%), +22%")

print("\n--- the blind baselines each system sits on (same two seasons) ---")
for lab, m in (("every power-conference team in a conference game, regular season", reg & P.conf_game & P.conf.isin(POWER)),
               ("every AP top-15 home team, non-conference", reg & ~P.conf_game & P.is_home & P["rank"].between(1, 15)),
               ("every visiting dog +10 to +15 in a conference game", P.conf_game & ~P.is_home & P.spread.between(10, 15)),
               ("every visiting dog +10 to +15 in a conference game with <=25% of tickets", P.conf_game & ~P.is_home & P.spread.between(10, 15) & (P.tix <= 25))):
    s = P[m]; w, l = int((s.ats > 0).sum()), int((s.ats < 0).sum())
    print(f"  {lab:75s} {w}-{l}  {100 * w / max(w + l, 1):.1f}%")
