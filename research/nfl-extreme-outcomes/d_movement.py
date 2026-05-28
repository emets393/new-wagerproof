"""
Avenue D — line movement (2023-25) + 2025 sharp/public splits.
Did extreme-miss games move unusually (market sensed it) or stay flat (blindsided)?
RLM / steam / sharp-vs-public tests. Avenue I situational at the end.
"""
import os, sys
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci, bet_summary, fmt

pd.set_option("display.width", 200)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
m = pd.read_parquet(os.path.join(DATA, "master.parquet"))
od = pd.read_parquet(os.path.join(DATA, "odds_consensus.parquet"))
sp = pd.read_parquet(os.path.join(DATA, "splits_2025.parquet"))
L = print

key = ["season", "home_ab", "away_ab"]
d = m.merge(od, on=key, how="inner", suffixes=("", "_od"))
L(f"[merge] master x odds: n={len(d)}  seasons={sorted(d['season'].unique())}")
d["ats_home"] = np.where(d["spread_diff"] > 0, 1.0, np.where(d["spread_diff"] < 0, 0.0, np.nan))
d["under_win"] = np.where(d["total_diff"] < 0, 1.0, np.where(d["total_diff"] > 0, 0.0, np.nan))
d["blowup"] = (d["spread_miss"] >= 21).astype(int)
d["tot_blowup"] = (d["total_miss"] >= 21).astype(int)

L("\n"+"="*90); L("AVENUE D — LINE MOVEMENT (open->close consensus, 2023-25)"); L("="*90)
L("\n[D1] Did extreme-miss games MOVE more than normal? (market sensing vs blindsided)")
for mvcol, missflag, lab in [("spread_move", "blowup", "spread"), ("total_move", "tot_blowup", "total")]:
    big = d[d[missflag] == 1]; norm = d[d[missflag] == 0]
    L(f"  {lab}: |move| blow-ups mean={big[mvcol].abs().mean():.2f} median={big[mvcol].abs().median():.2f} (n={len(big)}) "
      f"vs normal mean={norm[mvcol].abs().mean():.2f} median={norm[mvcol].abs().median():.2f} (n={len(norm)})")

L("\n[D2] STEAM: does the close-side win? (line moved toward a team -> back that team)")
# spread_move>0 => home_spread rose => home got WORSE (line moved toward away/dog). <0 => toward home.
for thr in [0.5, 1.0, 1.5]:
    toward_home = d["spread_move"] <= -thr   # home line shortened (steam on home)
    toward_away = d["spread_move"] >= thr
    out = pd.concat([d.loc[toward_home, "ats_home"], 1 - d.loc[toward_away, "ats_home"]]).dropna()
    wins = int((out == 1).sum()); n = int(out.isin([0, 1]).sum())
    L("   follow steam (move>=%.1f): " % thr + fmt(bet_summary(wins, n, f"steam>={thr}", -110)))
    # fade steam
    outf = pd.concat([1 - d.loc[toward_home, "ats_home"], d.loc[toward_away, "ats_home"]]).dropna()
    w2 = int((outf == 1).sum()); n2 = int(outf.isin([0, 1]).sum())
    L("   fade steam   (move>=%.1f): " % thr + fmt(bet_summary(w2, n2, f"fadesteam>={thr}", -110)))

L("\n[D3] TOTAL line move: follow vs fade (brief says fade-the-move is NULL):")
for thr in [0.5, 1.0]:
    up = d["total_move"] >= thr; dn = d["total_move"] <= -thr
    follow = pd.concat([1 - d.loc[up, "under_win"], d.loc[dn, "under_win"]]).dropna()  # up->bet over
    w = int((follow == 1).sum()); n = int(follow.isin([0, 1]).sum())
    L("   follow total move (>=%.1f): " % thr + fmt(bet_summary(w, n, f"follow>={thr}", -110)))
    fade = pd.concat([d.loc[up, "under_win"], 1 - d.loc[dn, "under_win"]]).dropna()
    w = int((fade == 1).sum()); n = int(fade.isin([0, 1]).sum())
    L("   fade total move   (>=%.1f): " % thr + fmt(bet_summary(w, n, f"fade>={thr}", -110)))

# ---- 2025 splits ----
L("\n"+"="*90); L("AVENUE D (2025) — SHARP / PUBLIC SPLITS  (n games ~281)"); L("="*90)
ds = m[m["season"] == 2025].merge(sp, on=["season", "home_ab", "away_ab"], how="inner")
L(f"[merge] 2025 master x splits: n={len(ds)}")
ds["ats_home"] = np.where(ds["spread_diff"] > 0, 1.0, np.where(ds["spread_diff"] < 0, 0.0, np.nan))
ds["under_win"] = np.where(ds["total_diff"] < 0, 1.0, np.where(ds["total_diff"] > 0, 0.0, np.nan))

L("\n[D4] SPREAD splits label -> did the labeled side cover?")
# Parse "Sharp Money on X" / "Public on X" / "Consensus on X" -> team name -> abbrev
tm = pd.read_parquet(os.path.join(DATA, "team_mapping.parquet"))
name2ab = dict(zip(tm["team_name"], tm["Team Abbrev"]))
def labeled_side_cover(row, label_col):
    lab = row[label_col]
    if not isinstance(lab, str):
        return np.nan
    for kind in ["Sharp Money on ", "Public on ", "Consensus on ", "Slight Lean on "]:
        if lab.startswith(kind):
            team = lab.replace(kind, "")
            ab = name2ab.get(team)
            if ab is None:
                return np.nan
            if ab == row["home_ab"]:
                return row["ats_home"]
            if ab == row["away_ab"]:
                return 1 - row["ats_home"] if pd.notna(row["ats_home"]) else np.nan
    return np.nan

for kind in ["Sharp Money on", "Public on", "Consensus on"]:
    mask = ds["spread_splits_label"].str.startswith(kind, na=False)
    sub = ds[mask].copy()
    sub["cov"] = sub.apply(lambda r: labeled_side_cover(r, "spread_splits_label"), axis=1)
    oc = sub["cov"].dropna()
    wins = int((oc == 1).sum()); n = int(oc.isin([0, 1]).sum())
    L(f"   spread '{kind} X' side covers: " + fmt(bet_summary(wins, n, kind, -110)))

L("\n[D5] TOTAL splits label -> did Under/Over hit?")
for kind in ["Sharp Money on Under", "Sharp Money on Over", "Public on Under", "Public on Over",
             "Consensus on Under", "Consensus on Over"]:
    mask = ds["total_splits_label"] == kind
    sub = ds[mask]
    if "Under" in kind:
        oc = sub["under_win"].dropna()
    else:
        oc = (1 - sub["under_win"]).dropna()
    wins = int((oc == 1).sum()); n = int(oc.isin([0, 1]).sum())
    if n > 0:
        L(f"   '{kind}' hits: " + fmt(bet_summary(wins, n, kind, -110)))

L("\n[D6] REVERSE LINE MOVEMENT proxy (handle% vs bets% gap = sharp side):")
# home sharp if home_spread_handle - home_spread_bets large (money without tickets)
ds["home_sharp_gap"] = ds["home_spread_handle"] - ds["home_spread_bets"]
for thr in [0.10, 0.15, 0.20]:
    home_sharp = ds["home_sharp_gap"] >= thr
    away_sharp = ds["home_sharp_gap"] <= -thr
    out = pd.concat([ds.loc[home_sharp, "ats_home"], 1 - ds.loc[away_sharp, "ats_home"]]).dropna()
    wins = int((out == 1).sum()); n = int(out.isin([0, 1]).sum())
    L(f"   back sharp side (handle-bets gap>={thr:.2f}): " + fmt(bet_summary(wins, n, f"gap{thr}", -110)))

L("\n"+"="*90); L("AVENUE I — SITUATIONAL (full 2018-25)"); L("="*90)
m["ats_home"] = np.where(m["spread_diff"] > 0, 1.0, np.where(m["spread_diff"] < 0, 0.0, np.nan))
m["under_win"] = np.where(m["total_diff"] < 0, 1.0, np.where(m["total_diff"] > 0, 0.0, np.nan))
def sit(label, mask):
    sub = m[mask]; n = len(sub)
    over = (sub["total_diff"] > 0).mean(); hc = (sub["spread_diff"] > 0).mean()
    L(f"  {label:24s} n={n:4d} over%={over*100:5.1f} home_cover%={hc*100:5.1f} "
      f"|sprmiss|={sub['spread_miss'].mean():.1f} |totmiss|={sub['total_miss'].mean():.1f} "
      f"blowup%={(sub['spread_miss']>=21).mean()*100:.1f}")
sit("primetime", m["primetime"] == 1)
sit("Sunday day", (m["is_sun"] == 1) & (m["primetime"] == 0))
sit("Thursday", m["is_thu"] == 1)
sit("Monday", m["is_mon"] == 1)
sit("divisional", m["div_game"] == 1)
sit("international", m["international_game"].astype(str).isin(["True", "true", "1"]))
sit("week1-4", m["week"].between(1, 4))
sit("week14-18", m["week"].between(14, 18))
sit("playoffs", m["week"] >= 19)
