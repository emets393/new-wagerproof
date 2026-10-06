#!/usr/bin/env python3
"""Does "how he's done against THIS defense" beat "his rate x what this defense allows"?

The owner wants both the season-to-date number and the number against that specific defense. The
second one has a sample problem the first does not: a player faces a given defense once or twice a
year, so his head-to-head mean is 1-2 games. Three candidates, same walk-forward frame:

  A  BLEND            the shrunk player baseline from prop_blend_fit.py
  B  BLEND x DEF      that baseline scaled by what this defense allows the position, itself shrunk
  C  HEAD-TO-HEAD     the player's own raw mean against this defense, prior meetings only

If C does not beat A, then "vs this defense" is a story, not a projection, and the UI must label
it as history rather than let it imply an expectation.
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
    r.raise_for_status(); return pd.DataFrame(r.json())

K = {"pass_yds":1.5,"pass_tds":4.25,"pass_attempts":1.0,"rush_yds":2.5,
     "rush_att":1.0,"receptions":2.75,"rec_yds":4.0,"targets":2.25}
STATS = {"pass_yds":("pass_yds",("QB",)),"rush_yds":("rush_yds",("RB","QB")),
         "receptions":("receptions",("WR","TE","RB")),"rec_yds":("rec_yds",("WR","TE","RB")),
         "targets":("targets",("WR","TE","RB")),"rush_att":("carries",("RB",))}

g = q("""select player_id, position, season, week, opponent,
         pass_yds, pass_tds, pass_attempts, carries, rush_yds, targets, receptions, rec_yds
         from nfl_player_game_logs where season between 2024 and 2026 and week <= 18""")
for c in ("season","week"): g[c]=pd.to_numeric(g[c],errors="coerce")
g = g.dropna(subset=["player_id","season","week","opponent"]).sort_values(["season","week"])

print(f"{'market':<12}{'n':>6}{'A blend':>10}{'B blend×def':>13}{'C head2head':>13}{'best':>14}")
for mkt,(col,pos) in STATS.items():
    d = g[g.position.isin(pos)].copy()
    d[col] = pd.to_numeric(d[col], errors="coerce"); d = d.dropna(subset=[col])
    k = K[mkt]
    # player baseline, entering-game, shrunk to prior season
    pri = d.groupby(["player_id","season"])[col].mean().rename("prior").reset_index()
    pri["season"] = pri.season + 1
    d = d.merge(pri, on=["player_id","season"], how="left")
    gp = d.groupby(["player_id","season"], sort=False)[col]
    d["n"] = gp.transform(lambda s: s.shift(1).expanding().count())
    d["cur"] = gp.transform(lambda s: s.shift(1).expanding().mean())
    d["base"] = np.where(d.prior.notna(),
                         (d.n.fillna(0)*d.cur.fillna(0) + k*d.prior.fillna(0))/(d.n.fillna(0)+k),
                         d.cur)
    # defense allowance vs this position, entering-game, shrunk toward the league mean
    dd = d.sort_values(["opponent","season","week"])
    og = dd.groupby(["opponent","season"], sort=False)[col]
    dd["dn"] = og.transform(lambda s: s.shift(1).expanding().count())
    dd["dmean"] = og.transform(lambda s: s.shift(1).expanding().mean())
    lg = d[col].mean()
    KD = 20.0        # defenses face many players, so the prior is worth ~20 player-games
    dd["def_rate"] = (dd.dn.fillna(0)*dd.dmean.fillna(lg) + KD*lg)/(dd.dn.fillna(0)+KD)
    dd["def_mult"] = dd.def_rate/lg
    # head-to-head: this player vs this defense, PRIOR meetings only
    hh = dd.sort_values(["player_id","opponent","season","week"]).groupby(["player_id","opponent"], sort=False)[col]
    dd["h2h_n"] = hh.transform(lambda s: s.shift(1).expanding().count())
    dd["h2h"] = hh.transform(lambda s: s.shift(1).expanding().mean())
    ev = dd[(dd.n>=1) & dd.base.notna() & dd.h2h.notna() & (dd.h2h_n>=1)].copy()
    if len(ev) < 300: continue
    y = ev[col].to_numpy(float)
    A = ev.base.to_numpy(float)
    B = (ev.base*ev.def_mult).to_numpy(float)
    C = ev.h2h.to_numpy(float)
    rm = lambda p: float(np.sqrt(np.mean((p-y)**2)))
    ra, rb, rc = rm(A), rm(B), rm(C)
    best = min((ra,"A blend"),(rb,"B blend×def"),(rc,"C head2head"))[1]
    print(f"{mkt:<12}{len(ev):>6}{ra:>10.2f}{rb:>13.2f}{rc:>13.2f}{best:>14}")
print("\n(lower RMSE is better; C is the 'vs this defense' number the owner asked for)")
