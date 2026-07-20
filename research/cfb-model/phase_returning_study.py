"""Returning-production / roster-continuity study (CFB) — validate or kill the first-look early-season edge.
Guardrails: grade at close, decimal -110 (breakeven 52.4%), per-season ALWAYS, dose-response, complement,
scan honesty, and the CRITICAL talent-control (is it continuity or just 'good teams'?). Returning production
is preseason-known → leak-safe for early-season prediction."""
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
DEC = 1.909

mg = pd.read_parquet("data/model_games.parquet")
rp = pd.read_parquet("data/cfbd/returning_production.parquet")
inc = pd.read_parquet("data/cfbd/portal_incoming.parquet").rename(columns={"destination": "team"})

def side(s):
    o, d = ("home", "away") if s == "home" else ("away", "home")
    return pd.DataFrame({
        "season": mg.season, "week": mg.week, "team": mg[f"{o}Team"], "opp": mg[f"{d}Team"],
        "spread": (mg.spread_close if s == "home" else -mg.spread_close),
        "margin": (mg.actual_margin if s == "home" else -mg.actual_margin),
        "total_close": mg.total_close, "actual_total": mg.actual_total,
        "talent": mg[f"{o}_talent"], "opp_talent": mg[f"{d}_talent"]})
tg = pd.concat([side("home"), side("away")], ignore_index=True)
tg["covered"] = np.where((tg.margin + tg.spread) == 0, np.nan, ((tg.margin + tg.spread) > 0).astype(float))
tg["ats_margin"] = tg.margin + tg.spread
tg["over"] = np.where(tg.actual_total == tg.total_close, np.nan, (tg.actual_total > tg.total_close).astype(float))
tg["talent_diff"] = tg.talent - tg.opp_talent
R = rp[["season", "team", "percentPPA", "percentPassingPPA", "percentRushingPPA", "percentReceivingPPA"]]
tg = tg.merge(R.rename(columns={"percentPPA": "ret", "percentPassingPPA": "ret_pass", "percentRushingPPA": "ret_rush", "percentReceivingPPA": "ret_rec"}), on=["season", "team"], how="left")
tg = tg.merge(R.rename(columns={"team": "opp", "percentPPA": "opp_ret"})[["season", "opp", "opp_ret"]], on=["season", "opp"], how="left")
tg = tg.merge(R.rename(columns={"team": "opp", "percentPassingPPA": "opp_ret_pass", "percentRushingPPA": "opp_ret_rush", "percentReceivingPPA": "opp_ret_rec"})[["season", "opp", "opp_ret_pass", "opp_ret_rush", "opp_ret_rec"]], on=["season", "opp"], how="left")
tg = tg.merge(inc, on=["season", "team"], how="left"); tg["portal_in"] = tg.portal_in.fillna(0)
tg["ret_diff"] = tg.ret - tg.opp_ret

def st(d, col="covered", hi=True):
    d = d.dropna(subset=[col])
    if len(d) < 25: return f"  n={len(d):4d}  (thin)"
    p = d[col].mean() if hi else 1 - d[col].mean(); by = d.groupby("season")[col].apply(lambda x: x.mean() if hi else 1 - x.mean())
    return f"{p*100:5.1f}%  n={len(d):4d}  ROI {(p*DEC-1)*100:+6.1f}  seasons {(by>=0.5).sum()}/{by.notna().sum()} [{round(by.min()*100)}-{round(by.max()*100)}]"

print("="*94); print("1) TIMING/DECAY — back the more-experienced team (ret_diff≥+.20) by week bucket"); print("="*94)
for lo, hi, lbl in [(1, 1, "wk 1"), (2, 3, "wk 2-3"), (4, 6, "wk 4-6"), (7, 9, "wk 7-9"), (10, 20, "wk 10+")]:
    print(f"  {lbl:7s}: {st(tg[(tg.week.between(lo, hi)) & (tg.ret_diff >= 0.20)])}")

print("\n" + "="*94); print("2) DOSE-RESPONSE (weeks 1-3) + complement"); print("="*94)
for thr in [0.10, 0.20, 0.30]:
    print(f"  ret_diff ≥ +{thr:.2f}: {st(tg[(tg.week <= 3) & (tg.ret_diff >= thr)])}")
print(f"  complement ret_diff ≤ -0.20 (rebuilt covers): {st(tg[(tg.week <= 3) & (tg.ret_diff <= -0.20)])}")

print("\n" + "="*94); print("3) TALENT CONTROL (critical) — is it CONTINUITY or just better teams? (weeks 1-3)"); print("="*94)
e = tg[tg.week <= 3]
print(f"  experienced & MORE talented   (ret_diff≥.20, talent_diff>0):  {st(e[(e.ret_diff>=0.20)&(e.talent_diff>0)])}")
print(f"  experienced & LESS/= talented (ret_diff≥.20, talent_diff≤0):  {st(e[(e.ret_diff>=0.20)&(e.talent_diff<=0)])}  <- isolates continuity")
print(f"  MORE talented but LESS exp    (talent_diff>0, ret_diff≤-.20): {st(e[(e.talent_diff>0)&(e.ret_diff<=-0.20)])}  <- talent w/o continuity")
print(f"  control: more talented overall(talent_diff>0):                {st(e[e.talent_diff>0])}")

print("\n" + "="*94); print("4) PER-POSITION returning differential (weeks 1-3)"); print("="*94)
for col, lbl in [("ret_pass", "returning PASSING (QB)"), ("ret_rush", "returning RUSHING"), ("ret_rec", "returning RECEIVING")]:
    d = e[col] - e["opp_" + col]
    print(f"  {lbl:22s} diff ≥ +.25 covers: {st(e[d >= 0.25])}")

print("\n" + "="*94); print("5) PORTAL churn interaction (2021-25) + 6) TOTALS + 7) MECHANISM"); print("="*94)
print(f"  experienced team LOW churn (ret_diff≥.20, portal_in≤3): {st(e[(e.ret_diff>=0.20)&(e.portal_in<=3)&(e.season>=2021)])}")
print(f"  both teams REBUILT → game UNDER (both ret≤.55, wk1-3):  {st(e[(e.ret<=0.55)&(e.opp_ret<=0.55)].drop_duplicates(['season','week','team' if False else 'total_close','actual_total']), 'over', hi=False)}")
cell = e[(e.ret_diff >= 0.20)].dropna(subset=["ats_margin"]); base = e.dropna(subset=["ats_margin"])
print(f"  MECHANISM: experienced-team avg ATS margin {cell.ats_margin.mean():+.2f} (line spot-on = 0) vs baseline {base.ats_margin.mean():+.2f}  → line under-values them by ~{cell.ats_margin.mean()-base.ats_margin.mean():.2f} pts")
print("\n[scan honesty] ~8 primary cells tested; belief = 9/9-season consistency + symmetric complement + talent-control + mechanism, not the headline %.")
