#!/usr/bin/env python3
"""SCHEME PIPELINE — blitz, box, pass rushers, and QB scrambles (owner 2026-09-17).
Per-play frame 2022-25: nflverse pbp + FTN charting (n_blitzers, n_pass_rushers, n_defense_box)
+ nflverse participation (per-play man/zone, coverage type, defenders_in_box, was_pressure).
  1. Josh Allen: scramble rate and EPA by coverage / blitz / rushers / box, vs league QBs
  2. Defense per-game dials (blitz%, 5+ rushers%, box>=8 on runs, man%) — step-1 predictability:
     identity + what the opponent pulls, walk-forward 2023-25
  3. Scheme-conditioned production preview: EPA per dropback allowed blitzing vs not, BUF/DET
"""
import glob, numpy as np, pandas as pd
num = lambda s: pd.to_numeric(s, errors="coerce"); K = 4.0
COLS = ["game_id", "play_id", "season", "week", "posteam", "defteam", "qb_dropback", "qb_scramble", "pass", "rush",
        "play_type", "passer_player_name", "rusher_player_name", "epa", "down", "ydstogo", "wp", "season_type"]
pbp = pd.concat([pd.read_parquet(f, columns=COLS) for f in ["data/pbp_cache/_dl_2022.parquet"] + sorted(glob.glob("data/pbp_cache/pbp_202[345].parquet"))], ignore_index=True)
pbp = pbp[(pbp.season_type == "REG") & pbp.posteam.notna()]
ftn = pd.concat([pd.read_parquet("data/ftn_charting.parquet"), pd.read_parquet("data/ftn_charting_2025.parquet")], ignore_index=True)
for a, b in (("nflverse_game_id", "game_id"), ("nflverse_play_id", "play_id")):
    if b in ftn.columns and a in ftn.columns: ftn[b] = ftn[b].fillna(ftn[a]); ftn = ftn.drop(columns=a)
    elif a in ftn.columns: ftn = ftn.rename(columns={a: b})
ftn["play_id"] = num(ftn.play_id)
ftn = ftn[["game_id", "play_id", "n_blitzers", "n_pass_rushers", "n_defense_box", "is_qb_out_of_pocket", "is_play_action", "is_rpo"]].drop_duplicates(["game_id", "play_id"], keep="last")
par = pd.concat([pd.read_parquet(f"data/pbp_participation_{y}.parquet", columns=["nflverse_game_id", "play_id", "defenders_in_box", "number_of_pass_rushers", "was_pressure", "defense_man_zone_type", "defense_coverage_type"]) for y in (2022, 2023, 2024, 2025)], ignore_index=True)
par = par.rename(columns={"nflverse_game_id": "game_id"}).drop_duplicates(["game_id", "play_id"])
d = pbp.merge(ftn, on=["game_id", "play_id"], how="left").merge(par, on=["game_id", "play_id"], how="left")
d["blitz"] = (num(d.n_blitzers) >= 1).where(d.n_blitzers.notna())
d["rush5"] = (num(d.n_pass_rushers) >= 5).where(d.n_pass_rushers.notna())
d["box"] = num(d.n_defense_box).fillna(num(d.defenders_in_box))
d["man"] = d.defense_man_zone_type.map({"MAN_COVERAGE": 1.0, "ZONE_COVERAGE": 0.0})
db = d[(d.qb_dropback == 1)].copy(); db["scr"] = db.qb_scramble.fillna(0).astype(float)
# on a scramble nflverse lists the QB as the RUSHER and leaves passer null — without this, every QB scrambles 0%
db["qb"] = db.passer_player_name.where(db.passer_player_name.notna(), db.rusher_player_name)
print(f"dropbacks 2022-25: {len(db)}  with FTN blitz {db.blitz.notna().mean():.0%}  with coverage {db.man.notna().mean():.0%}  with box {db.box.notna().mean():.0%}")

def rate(g, lab):
    return f"  {lab:34s} scramble {100*g.scr.mean():5.1f}%  EPA/dropback {g.epa.mean():+.3f}  n={len(g)}"
print("\n" + "=" * 100); print("1) JOSH ALLEN vs LEAGUE QBs — when does he run?"); print("=" * 100)
JA = db[db.qb == "J.Allen"]; LG = db
for lab, m in (("man coverage", lambda x: x.man == 1), ("zone coverage", lambda x: x.man == 0),
               ("blitz (5+ or blitzer sent)", lambda x: x.blitz == True), ("no blitz", lambda x: x.blitz == False),
               ("<=3 pass rushers", lambda x: num(x.n_pass_rushers) <= 3), ("4 pass rushers", lambda x: num(x.n_pass_rushers) == 4), ("5+ pass rushers", lambda x: num(x.n_pass_rushers) >= 5),
               ("light box (<=6)", lambda x: x.box <= 6), ("7 in box", lambda x: x.box == 7), ("stacked box (8+)", lambda x: x.box >= 8)):
    print(rate(JA[m(JA)], "ALLEN  " + lab) + "   |   league" + rate(LG[m(LG)], "")[36:])
for cov in ("COVER_0", "COVER_1", "COVER_2", "2_MAN", "COVER_3", "COVER_4", "COVER_6"):
    a = JA[JA.defense_coverage_type == cov]; l = LG[LG.defense_coverage_type == cov]
    if len(a) >= 40: print(f"  ALLEN  {cov:10s} scramble {100*a.scr.mean():5.1f}%  EPA {a.epa.mean():+.3f}  n={len(a)}   | league scramble {100*l.scr.mean():4.1f}%  EPA {l.epa.mean():+.3f}")
# what does he see, by year (are defenses changing how they play him?)
print("\n  what defenses do to Allen by season (share of his dropbacks): man% / blitz% / 5+rushers% / 2-high-ish (COVER_2,4,6,2_MAN)%")
for s in (2022, 2023, 2024, 2025):
    a = JA[JA.season == s]; th = a.defense_coverage_type.isin(["COVER_2", "COVER_4", "COVER_6", "2_MAN"]).mean()
    print(f"    {s}: man {100*a.man.mean():4.1f}%  blitz {100*a.blitz.mean():4.1f}%  5+ {100*a.rush5.mean():4.1f}%  two-high {100*th:4.1f}%   (league man {100*LG[LG.season==s].man.mean():.1f}%, blitz {100*LG[LG.season==s].blitz.mean():.1f}%)")

# ================================================================ 2) defense per-game dials + predictability
print("\n" + "=" * 100); print("2) BLITZ / BOX as scheme dials — is THIS WEEK's rate predictable from identity + opponent?  (walk-forward 2023-25)"); print("=" * 100)
runs = d[(d.rush == 1) & (d.qb_scramble != 1) & d.box.notna()]
G = db.groupby(["season", "week", "defteam", "posteam"]).agg(blitz=("blitz", "mean"), rush5=("rush5", "mean"), man=("man", "mean"), n=("scr", "size")).reset_index()
B = runs.groupby(["season", "week", "defteam", "posteam"]).agg(box8=("box", lambda s: (s >= 8).mean()), box=("box", "mean")).reset_index()
G = G.merge(B, on=["season", "week", "defteam", "posteam"], how="left")
for c in ("blitz", "rush5", "man", "box8"): G[c] = 100 * G[c]
G = G.rename(columns={"defteam": "def", "posteam": "off"})

def entering(df, key, col):
    dd = df.sort_values([key, "season", "week"]); pri = dd.groupby([key, "season"])[col].mean()
    p = pd.Series([pri.get((kk, ss - 1), np.nan) for kk, ss in zip(dd[key], dd.season)], index=dd.index)
    g = dd.groupby([key, "season"])[col]
    cs = g.transform(lambda x: x.shift(1).expanding().sum()).fillna(0); cn = g.transform(lambda x: x.shift(1).expanding().count()).fillna(0)
    v = (p.fillna(0) * K + cs) / (K + cn); v[p.isna() & (cn == 0)] = np.nan
    return v.reindex(df.index)
print(f"  {'dial':12s} {'b':>6s} | {'MAE identity':>12s} {'MAE +opp':>9s} {'gain':>6s} | {'corr(pred shift, actual shift)':>30s} {'corr(identity, actual)':>22s} {'n':>5s}")
for k in ("blitz", "rush5", "box8", "man"):
    G[k + "_id"] = entering(G, "def", k); G[k + "_dev"] = G[k] - G[k + "_id"]; G[k + "_inv"] = entering(G, "off", k + "_dev")
    x = G.dropna(subset=[k + "_id", k + "_inv", k]); rows = []
    for ssn in (2023, 2024, 2025):
        tr, te = x[x.season < ssn], x[x.season == ssn].copy()
        if len(tr) < 200: continue
        b = np.polyfit(tr[k + "_inv"], tr[k + "_dev"], 1)[0]; te["pred"] = te[k + "_id"] + b * te[k + "_inv"]; te["b"] = b; rows.append(te)
    r = pd.concat(rows); m0 = (r[k] - r[k + "_id"]).abs().mean(); m1 = (r[k] - r.pred).abs().mean()
    print(f"  {k:12s} {r.b.mean():6.2f} | {m0:12.2f} {m1:9.2f} {m0-m1:+6.2f} | {np.corrcoef(r.pred-r[k+'_id'], r[k+'_dev'])[0,1]:30.3f} {np.corrcoef(r[k+'_id'], r[k])[0,1]:22.3f} {len(r):5d}")
print("  (box in defenders, everything else in % of plays)")

# ================================================================ 3) scheme-conditioned production preview
print("\n" + "=" * 100); print("3) PRODUCTION BY SCHEME, 2025 — EPA per dropback (offense view: what the offense did; defense view: what it allowed)"); print("=" * 100)
x = db[db.season == 2025]
def cell(g): return f"{g.epa.mean():+.3f} ({len(g)})"
print(f"  {'':14s} {'vs blitz':>16s} {'vs no blitz':>16s} {'vs man':>16s} {'vs zone':>16s} {'vs 8+ box':>16s}")
for lab, m in (("LEAGUE", x), ("BUF offense", x[x.posteam == "BUF"]), ("DET offense", x[x.posteam == "DET"]), ("BUF defense", x[x.defteam == "BUF"]), ("DET defense", x[x.defteam == "DET"])):
    print(f"  {lab:14s} {cell(m[m.blitz==True]):>16s} {cell(m[m.blitz==False]):>16s} {cell(m[m.man==1]):>16s} {cell(m[m.man==0]):>16s} {cell(m[m.box>=8]):>16s}")
print(f"  2025 rates: BUF D blitz {100*x[x.defteam=='BUF'].blitz.mean():.0f}% / DET D blitz {100*x[x.defteam=='DET'].blitz.mean():.0f}% / league {100*x.blitz.mean():.0f}%;  "
      f"box>=8 on runs: BUF D {100*(runs[(runs.season==2025)&(runs.defteam=='BUF')].box>=8).mean():.0f}%  DET D {100*(runs[(runs.season==2025)&(runs.defteam=='DET')].box>=8).mean():.0f}%  league {100*(runs[runs.season==2025].box>=8).mean():.0f}%")
G.to_parquet("data/fpdata/_scheme_dials_blitz_box.parquet", index=False)
