#!/usr/bin/env python3
"""Robustness for the early-season hype fade (see early_hype_test.py).

  1. season ledger of FADING the star-power roster (3+ top-50 recruits vs opponent 0-1) at the actual closing price
  2. placebo: the same hype teams vs the same opponent class in January-February -- does the market learn?
  3. concentration: drop each hype team in turn; top contributors
  4. dose: top-50 recruits on the roster 2 / 3 / 4 / 5+, opponent held at 0-1
  5. null: within each season, permute the roster star-count across power-conference teams; best-of-family
"""
import numpy as np
import pandas as pd

RNG = np.random.default_rng(20261026)
P = pd.read_parquet("../bball-odds/data/parquet/cbb_sit_panel.parquet",
                    columns=["season", "teamId", "opponentId", "team", "opponent", "conference", "opponentConference", "date", "month", "gnum",
                             "neutral", "is_home", "conf_game", "post", "spread", "ats_pts", "ats_open_pts", "win", "margin", "o_kp_rank", "spread_price"])
P["season_end"] = P.season.str[:4].astype(int) + 1
H = pd.read_parquet("data/hype_index.parquet")
cols = ["n_top50", "n_fresh_top50", "class_rank", "hype_rank", "kp_prev_final"]
P = P.merge(H[["season", "teamId"] + cols].rename(columns={"season": "season_end"}), on=["season_end", "teamId"], how="left") \
     .merge(H[["season", "teamId"] + cols].rename(columns={"season": "season_end", "teamId": "opponentId", **{c: "o_" + c for c in cols}}), on=["season_end", "opponentId"], how="left")
POWER = {"ACC", "Big 12", "Big Ten", "SEC", "Big East", "Pac-12"}
base = (P.post == 0) & P.spread.notna() & (P.spread.abs() <= 12) & P.conference.isin(POWER) & (P.opponentConference.isin(POWER) | (P.o_kp_rank <= 40)) & P.n_top50.notna() & P.o_n_top50.notna()
early = base & P.month.isin([11, 12])
late = base & P.month.isin([1, 2])
HYPE = (P.n_top50 >= 3) & (P.o_n_top50 <= 1)


def fade(df):
    """Record from the FADE side: a hype-team loss ATS is a win. ROI at the opponent's implied price (~ -110 mirror)."""
    w, l, p = int((df.ats_pts < 0).sum()), int((df.ats_pts > 0).sum()), int((df.ats_pts == 0).sum())
    n = w + l; pct = w / max(n, 1)
    roi = (w * (100 / 110) - l) / max(n, 1) * 100
    lo = pct - 1.96 * np.sqrt(pct * (1 - pct) / max(n, 1))
    return w, l, p, pct, roi, lo


def line(lab, df):
    w, l, p, pct, roi, lo = fade(df)
    print(f"  {lab:48s} {w}-{l}{('-' + str(p)) if p else ''}  {pct:6.1%}  [lo {lo:5.1%}]  roi {roi:+5.1f}%  n={w + l}")


print("1. FADE the star-power roster, Nov-Dec, major opponent, |spread|<=12")
line("all six seasons", P[early & HYPE])
for s, g in P[early & HYPE].groupby("season"):
    line(f"   {s}", g)
line("at the OPENER instead", P[early & HYPE].assign(ats_pts=P[early & HYPE].ats_open_pts))

print("\n2. PLACEBO -- same definition, January-February (market has seen them)")
line("Jan-Feb, fade the star-power roster", P[late & HYPE])
for s, g in P[late & HYPE].groupby("season"):
    line(f"   {s}", g)

print("\n3. CONCENTRATION -- Nov-Dec fade, dropping one hype team at a time (worst case shown), and the top contributors")
e = P[early & HYPE]
worst = None
for t, g in e.groupby("team"):
    rest = e[e.team != t]; w, l, p, pct, roi, lo = fade(rest)
    if worst is None or pct < worst[1]:
        worst = (t, pct, w, l)
print(f"  drop {worst[0]} -> {worst[2]}-{worst[3]} ({worst[1]:.1%})  (the weakest drop-one)")
top = e.groupby("team").apply(lambda g: pd.Series(dict(n=len(g), fade_w=int((g.ats_pts < 0).sum()), fade_l=int((g.ats_pts > 0).sum())))).sort_values("n", ascending=False)
print(top.head(12).to_string())

print("\n4. DOSE -- top-50 recruits on the hype roster, opponent held at 0-1, Nov-Dec")
for lo_, hi_, lab in ((2, 2, "exactly 2"), (3, 3, "exactly 3"), (4, 4, "exactly 4"), (5, 99, "5 or more")):
    line(lab, P[early & P.n_top50.between(lo_, hi_) & (P.o_n_top50 <= 1)])
line("opponent ALSO has 3+ (both hyped)", P[early & (P.n_top50 >= 3) & (P.o_n_top50 >= 3)])

print("\n5. NULL -- permute n_top50 across power-conference team-seasons within each season (2000 draws)")
obs = fade(P[early & HYPE])[3]
pool = P[early].copy()
ts = pool[["season_end", "teamId", "n_top50"]].drop_duplicates(["season_end", "teamId"])
sims = []
for _ in range(2000):
    sh = ts.copy(); sh["n_top50"] = sh.groupby("season_end").n_top50.transform(lambda s: RNG.permutation(s.values))
    m = dict(zip(zip(sh.season_end, sh.teamId), sh.n_top50))
    own = np.array([m[(a, b)] for a, b in zip(pool.season_end, pool.teamId)])
    opp = np.array([m.get((a, b), np.nan) for a, b in zip(pool.season_end, pool.opponentId)])
    sel = (own >= 3) & (opp <= 1)
    if sel.sum() >= 50:
        sims.append(fade(pool[sel])[3])
sims = np.array(sims)
print(f"  observed fade win% {obs:.1%}; null mean {sims.mean():.1%} sd {sims.std():.1%}; p(null >= observed) = {(sims >= obs).mean():.4f}  (n sims {len(sims)})")
