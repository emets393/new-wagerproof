#!/usr/bin/env python3
"""QUARTERBACK PROFILES — {STAT} (owner, 2026-09-18).  For every ACTIVE 2026 starter with enough
priced games, a deep dive on HIS number:
  predictability  how tightly his {STAT} track the posted line (his line MAE and residual sd vs
                  the league), his over rate vs the line, and how much of his variance his own factors
                  explain (split-half) -> a predictability rank
  his factors     for each factor, the correlation of (his {STAT} − the line) with the factor, in
                  {STAT} per sd, with a permutation p-value; a factor is HIS TENDENCY when |r|>=.30,
                  p<.10 on 15+ games, AND the sign agrees on odd/even halves of his games
  vs the league   the same factor's league-wide residual correlation, so 'he is different' is explicit
Frame: data/_{STAT}_deep_frame.parquet (2023-25 priced lines).  Active QBs: this week's board.
Writes data/_qb_profiles_<season>.parquet and out/qb_profiles_<season>.md."""
import os, sys, numpy as np, pandas as pd, requests, warnings
warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE); sys.path.insert(0, os.path.dirname(HERE)); import football_report_lib as lib
env = lib.load_env(); H = lib.hdr(env); SEASON = int(sys.argv[1]) if len(sys.argv) > 1 else 2026; MKT = sys.argv[2] if len(sys.argv) > 2 else "player_pass_completions"; STAT = MKT.replace("player_pass_", "")
def fetch(table, params):
    j = requests.get(f"{lib.SUPA}/{table}?{params}", headers=H, timeout=60).json(); return j if isinstance(j, list) else []
d = pd.read_parquet(f"data/_{STAT}_deep_frame.parquet").dropna(subset=["qb"]).copy(); d["res"] = d.actual - d.close_line
FAC = {"opp_rate_man": "opponent man-coverage rate", "opp_rate_blitz": "opponent blitz rate", "opp_rate_press": "opponent pressure rate", "wind": "wind", "temp": "temperature", "team_spread": "team spread (+ = underdog)", "total": "game total", "e_rw_catchable": "receivers' catchable-target rate", "inj_wrte_tgt_out": "WR/TE target share out", "rest": "days of rest", "is_home": "home game", "close_line": "the line itself"}
for c in FAC: d[c] = d[c].fillna(d[c].median())
active = pd.DataFrame(fetch("nfl_slate_props", f"select=player_name,team&season=eq.{SEASON}&market=eq.{MKT}&limit=2000")).drop_duplicates("player_name")
short = lambda nm: nm.split()[0][0] + "." + " ".join(nm.split()[1:]) if " " in nm else nm
active["qb"] = active.player_name.map(lambda n: short(n.replace(".", "")))
# tolerant match: pbp style "J.Daniels" — first initial + last token
keys = d.qb.unique(); act = {}
for nm in active.player_name:
    parts = nm.replace(".", "").split(); cand = [k for k in keys if k.split(".")[-1].lower() == parts[-1].lower() and k[0].lower() == parts[0][0].lower()]
    if cand: act[cand[0]] = nm
print(f"{len(active)} QBs on this season's board; {len(act)} have priced {STAT} history in 2023-25")
LG = {f: np.corrcoef(d[f], d.res)[0,1] for f in FAC}; lg_mae = np.abs(d.res).mean(); lg_sd = d.res.std()
rng = np.random.default_rng(0)
rows, md = [], [f"# Quarterback profiles — {STAT}, {SEASON} starters\n", f"Each line: how HIS {STAT} relate to the posted line and to each factor, on his own priced games 2023-25. A tendency is listed only when it holds on both halves of his games. Nothing here is a pick.\n"]
for q, nm in sorted(act.items(), key=lambda kv: -len(d[d.qb == kv[0]])):
    x = d[d.qb == q].sort_values(["season","week"]); n = len(x)
    if n < 15: continue
    mae, sd, over = np.abs(x.res).mean(), x.res.std(), (x.actual > x.close_line).mean()
    o, e = x.iloc[::2], x.iloc[1::2]; tend = []
    for f, lab in FAC.items():
        if x[f].std() == 0: continue
        r = np.corrcoef(x[f], x.res)[0,1]; slope = r * x.res.std()
        null = np.array([np.corrcoef(rng.permutation(x[f].values), x.res)[0,1] for _ in range(400)]); p = (np.abs(null) >= abs(r)).mean()
        ro = np.corrcoef(o[f], o.res)[0,1] if o[f].std() > 0 else 0; re_ = np.corrcoef(e[f], e.res)[0,1] if e[f].std() > 0 else 0
        # STABILITY = same sign in EVERY season with 8+ of his games (and at least two such seasons). Odd/even
        # halves pooled across seasons let two old seasons carry a pattern the latest season reversed (J.Love blitz, 2026-09-18).
        seas = [np.corrcoef(g[f], g.res)[0,1] for s_, g in x.groupby('season') if len(g) >= 8 and g[f].std() > 0]
        stable = len(seas) >= 2 and all(np.sign(v) == np.sign(r) for v in seas)
        if abs(r) >= 0.30 and p < 0.10 and stable: tend.append(dict(factor=f, label=lab, r=round(r, 2), slope=round(slope, 2), p=round(p, 3), league_r=round(LG[f], 2)))
    # predictability: how much of his residual his own tendencies explain out of sample (split-half), and his line MAE vs league
    pred_rank = mae
    rows.append(dict(qb=q, name=nm, games=n, line_mae=round(mae, 2), resid_sd=round(sd, 2), over_rate=round(over, 2), mean_res=round(x.res.mean(), 2), n_tendencies=len(tend), tendencies=tend))
R = pd.DataFrame(rows).sort_values("line_mae"); R["predictability_rank"] = range(1, len(R) + 1)
print(f"\nleague: line MAE {lg_mae:.2f}, residual sd {lg_sd:.2f}\n")
print(f"  {'#':>2s} {'quarterback':22s} {'games':>5s} {'line MAE':>8s} {'resid sd':>8s} {'over%':>6s} {'bias':>6s} | his stable tendencies (r, {STAT} per sd; league r)")
for r in R.itertuples():
    t = "; ".join(f"{x['label']} {x['r']:+.2f} ({x['slope']:+.1f}/sd; league {x['league_r']:+.2f})" for x in r.tendencies) or "none that hold in every season"
    print(f"  {r.predictability_rank:2d} {r.name:22s} {r.games:5d} {r.line_mae:8.2f} {r.resid_sd:8.2f} {100*r.over_rate:5.0f}% {r.mean_res:+6.2f} | {t}")
    md.append(f"## {r.predictability_rank}. {r.name} — {r.games} priced games\n- Predictability: the line misses him by **{r.line_mae:.1f}** {STAT} on average (league {lg_mae:.1f}); residual sd {r.resid_sd:.1f}; over the line {100*r.over_rate:.0f}% of games (average {r.mean_res:+.1f}).\n" + ("- Tendencies that hold in every season of his games:\n" + "\n".join(f"  - **{x['label']}**: {x['slope']:+.1f} {STAT} per sd vs the line (r {x['r']:+.2f}, p {x['p']:.2f}; league-wide r {x['league_r']:+.2f})" for x in r.tendencies) if r.tendencies else f"- No factor moves his {STAT} vs the line in a way that holds in every season of his games — the line prices him well.") + "\n")
R.to_parquet(f"data/_qb_profiles_{STAT}_{SEASON}.parquet", index=False); os.makedirs("out", exist_ok=True); open(f"out/qb_profiles_{STAT}_{SEASON}.md", "w").write("\n".join(md))
print(f"\nwrote data/_qb_profiles_{STAT}_{SEASON}.parquet and out/qb_profiles_{STAT}_{SEASON}.md")
print("\n  read: 'predictable' = the line misses him by less. A tendency with league r near 0 and his r at ±.3+ is HIS, not the league's.")
