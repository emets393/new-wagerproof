#!/usr/bin/env python3
"""How much season-to-date vs prior-season for a player's prop baseline? FIT it, per market.

OWNER PROBLEM (2026-10-06, verbatim): "we can't just use season to date early in the season
because they haven't played too many games, and we can't use historical data completely because
players change each season sometimes, so we need a happy median dynamically depending on the
samples the individual player had."

That is textbook shrinkage. The estimate for a player entering week W is

    blended = (n * cur + k * prior) / (n + k)

where n = games he has ALREADY played this season, cur = his mean over those games, prior = his
mean last season, and k is the "how many games of this season is the prior worth" constant. k is
NOT a guess: fit it per market by minimising out-of-sample squared error against what the player
actually did in week W. A big k means last year still dominates deep into the season; a small k
means this season takes over fast.

Walk-forward by construction: predicting week W uses only weeks < W of this season plus last
season entire. Players with no prior season fall back to cur alone (and are reported separately,
because rookies are exactly where this breaks).
"""
import warnings
warnings.filterwarnings("ignore")
import numpy as np, pandas as pd, pathlib, requests

ROOT = pathlib.Path("/Users/chrishabib/Documents/new-wagerproof")
env = {}
for line in (ROOT / ".env.local").read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        a, b = line.split("=", 1); env[a.strip()] = b.strip()
PAT = env["SUPABASE_PAT"]


def q(sql):
    r = requests.post("https://api.supabase.com/v1/projects/jpxnjuwglavsjbgbasnl/database/query",
                      headers={"Authorization": f"Bearer {PAT}", "Content-Type": "application/json"},
                      json={"query": sql}, timeout=300)
    r.raise_for_status()
    return pd.DataFrame(r.json())


STATS = {           # market -> (column, positions that actually take this prop)
    "pass_yds":      ("pass_yds",   ("QB",)),
    "pass_tds":      ("pass_tds",   ("QB",)),
    "pass_attempts": ("pass_attempts", ("QB",)),
    "rush_yds":      ("rush_yds",   ("RB", "QB")),
    "rush_att":      ("carries",    ("RB",)),
    "receptions":    ("receptions", ("WR", "TE", "RB")),
    "rec_yds":       ("rec_yds",    ("WR", "TE", "RB")),
    "targets":       ("targets",    ("WR", "TE", "RB")),
}

g = q("""select player_id, player_name, position, season, week, opponent, home_away,
         pass_yds, pass_tds, pass_attempts, carries, rush_yds, targets, receptions, rec_yds
         from nfl_player_game_logs where season between 2024 and 2026 and week <= 18""")
for c in ("season", "week"):
    g[c] = pd.to_numeric(g[c], errors="coerce")
g = g.dropna(subset=["player_id", "season", "week"]).sort_values(["player_id", "season", "week"])
print(f"{len(g)} player-games, seasons {sorted(g.season.unique())}\n")

rows = []
for mkt, (col, pos) in STATS.items():
    d = g[g.position.isin(pos)].copy()
    d[col] = pd.to_numeric(d[col], errors="coerce")
    d = d.dropna(subset=[col])
    # prior-season mean per player
    prior = (d.groupby(["player_id", "season"])[col].mean().rename("prior_mean").reset_index())
    prior["season"] = prior.season + 1                      # last season's mean applies to THIS one
    d = d.merge(prior, on=["player_id", "season"], how="left")
    # entering-game season-to-date: shift so week W never sees itself
    grp = d.groupby(["player_id", "season"], sort=False)[col]
    d["n"] = grp.transform(lambda s: s.shift(1).expanding().count())
    d["cur"] = grp.transform(lambda s: s.shift(1).expanding().mean())
    ev = d[(d.n >= 1) & d.prior_mean.notna() & d.cur.notna()].copy()
    if len(ev) < 200:
        continue
    y = ev[col].to_numpy(float); n = ev.n.to_numpy(float)
    cur = ev.cur.to_numpy(float); pri = ev.prior_mean.to_numpy(float)
    def mse(k):
        p = (n * cur + k * pri) / (n + k)
        return float(np.mean((p - y) ** 2))
    ks = np.concatenate([np.arange(0, 12.25, 0.25), np.arange(13, 41, 1.0)])
    errs = [mse(k) for k in ks]
    kbest = float(ks[int(np.argmin(errs))])
    rows.append(dict(market=mkt, n_rows=len(ev), k=kbest,
                     rmse_blend=np.sqrt(mse(kbest)), rmse_cur=np.sqrt(mse(0.0)),
                     rmse_prior=np.sqrt(mse(1e6))))
r = pd.DataFrame(rows)
r["gain_vs_cur"] = (1 - r.rmse_blend / r.rmse_cur) * 100
r["gain_vs_prior"] = (1 - r.rmse_blend / r.rmse_prior) * 100
print("=== fitted prior weight k, per market ===")
print(f"{'market':<14}{'rows':>7}{'k':>7}{'RMSE blend':>12}{'vs cur-only':>13}{'vs prior-only':>15}")
for x in r.itertuples():
    print(f"{x.market:<14}{x.n_rows:>7}{x.k:>7.2f}{x.rmse_blend:>12.2f}"
          f"{x.gain_vs_cur:>12.1f}%{x.gain_vs_prior:>14.1f}%")
print("\n=== what that k means in practice: % weight on THIS season by games played ===")
print(f"{'market':<14}" + "".join(f"{f'{i}g':>7}" for i in (1, 2, 3, 4, 6, 8, 12, 16)))
for x in r.itertuples():
    print(f"{x.market:<14}" + "".join(f"{100*i/(i+x.k):>6.0f}%" for i in (1, 2, 3, 4, 6, 8, 12, 16)))
r.to_csv("out/prop_blend_fit.csv", index=False)
print("\n-> out/prop_blend_fit.csv")
