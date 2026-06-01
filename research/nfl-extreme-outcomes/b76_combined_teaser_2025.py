"""
b76 — COMBINED teaser strategy: model signals + Vegas team sharpness + line-bucket history.
Walk-forward honest: calibrate everything on 2018-2024 ONLY, test on 2025 ONLY.

THE COMBINED SCORE
  For each potential leg in each game on the 2025 slate (4 legs/game: home tease, away tease,
  over tease, under tease), score it across three lenses:
    bucket_p  — historical 6-pt teaser hit rate for THIS exact line value (2018-2024 only)
    signal_ok — 1 if any of our locked teaser-eligible signals (b73) picks this side
    sharp_ok  — 1 if matchup avg Vegas-error in prior 2 seasons <= league 50th pct (b74)

  combined = bucket_p + 0.05*signal_ok + 0.03*sharp_ok

  Eligible if bucket_p >= 0.74 (clears -110 historical pool) AND at least one of {signal_ok, sharp_ok}.

  Each week: take the top-2 legs by combined score from DISTINCT games. Form 2-team teaser.
  Grade vs the OPEN line +/- 6.

KEY INTEGRITY POINTS
  - Bucket hit rates: 2018-2024 only (no 2025 peek)
  - Sharpness: prior 2 seasons (2023+2024 for 2025 test)
  - Signal picks: produced by the harness with walk-forward training (already honest)
  - All 2025 games evaluated — not just games where our signals fire (cross-fertilizes the strategies)
"""
import os, sys, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stats_helpers import wilson_ci
from forecast_harness import build, generate, TEASER_RULES
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data")
OUT =os.path.join(os.path.dirname(os.path.abspath(__file__)),"out"); L=print

TEST_YEAR = int(sys.argv[1]) if len(sys.argv)>1 else 2025

# ---------------------------------------------------------------------------
# STEP 1: build SPREAD + TOTAL bucket hit-rate lookups from 2018-2024 ONLY
# ---------------------------------------------------------------------------
ma = pd.read_parquet(os.path.join(DATA,"matchup_arch.parquet"))
od = pd.read_parquet(os.path.join(DATA,"odds_consensus.parquet"))
ma["actual_margin"] = ma.home_score - ma.away_score
ma["actual_total"]  = ma.home_score + ma.away_score
hist = ma.merge(od[["season","home_ab","away_ab","open_spread","open_total"]],
                on=["season","home_ab","away_ab"], how="left")
hist["spread"] = hist.open_spread.fillna(hist.home_spread)
hist["total"]  = hist.open_total.fillna(hist.ou_vegas_line)
hist = hist[(hist.season<TEST_YEAR) & hist.spread.notna() & hist.total.notna()].copy()
L(f"\n[history] {len(hist)} games {hist.season.min()}-{hist.season.max()} for bucket calibration")

# Spread teaser outcomes vs the line at that game
hist["home_t_win"] = (hist.actual_margin + hist.spread + 6 > 0).astype(float)
hist.loc[hist.actual_margin + hist.spread + 6 == 0, "home_t_win"] = np.nan
hist["away_t_win"] = (hist.actual_margin + hist.spread - 6 < 0).astype(float)
hist.loc[hist.actual_margin + hist.spread - 6 == 0, "away_t_win"] = np.nan
hist["over_t_win"]  = (hist.actual_total > hist.total - 6).astype(float)
hist.loc[hist.actual_total == hist.total - 6, "over_t_win"] = np.nan
hist["under_t_win"] = (hist.actual_total < hist.total + 6).astype(float)
hist.loc[hist.actual_total == hist.total + 6, "under_t_win"] = np.nan
hist["spread_r"] = (hist.spread*2).round()/2
hist["total_r"]  = (hist.total*2).round()/2

def bucket_table(df, key, win_col, min_n=15):
    rows=[]
    for v in sorted(df[key].unique()):
        sub = df[df[key]==v]
        w = sub[win_col].dropna()
        if len(w)<min_n: continue
        n=len(w); k=int(w.sum()); lo,hi = wilson_ci(k,n)
        rows.append({"v":v,"n":n,"hit":k/n,"lo_ci":lo})
    return pd.DataFrame(rows)
spread_home = bucket_table(hist, "spread_r", "home_t_win")
spread_away = bucket_table(hist, "spread_r", "away_t_win")
total_over  = bucket_table(hist, "total_r",  "over_t_win")
total_under = bucket_table(hist, "total_r",  "under_t_win")

# Dict lookups: bucket value -> (hit, lo_ci, n)
def to_dict(df): return {r.v: (r.hit, r.lo_ci, int(r.n)) for _,r in df.iterrows()}
HOME = to_dict(spread_home); AWAY = to_dict(spread_away)
OVER = to_dict(total_over);  UNDER = to_dict(total_under)
L(f"[buckets] HOME={len(HOME)} spread values, AWAY={len(AWAY)}, OVER={len(OVER)} total values, UNDER={len(UNDER)}")

# ---------------------------------------------------------------------------
# STEP 2: team sharpness (prior 2 seasons = 2023+2024 for 2025 test)
# ---------------------------------------------------------------------------
prev = ma[(ma.season>=TEST_YEAR-2) & (ma.season<TEST_YEAR)].copy()
prev["spread_err"] = (prev.actual_margin - (-prev.home_spread)).abs()
prev["total_err"]  = (prev.actual_total - prev.ou_vegas_line).abs()
home_s = prev[["home_ab","spread_err","total_err"]].rename(columns={"home_ab":"team"})
away_s = prev[["away_ab","spread_err","total_err"]].rename(columns={"away_ab":"team"})
tg = pd.concat([home_s,away_s], ignore_index=True)
sharp = tg.groupby("team").agg(sharp_spread=("spread_err","mean"),
                                sharp_total=("total_err","mean")).reset_index()
SHARP_S = dict(zip(sharp.team, sharp.sharp_spread))
SHARP_T = dict(zip(sharp.team, sharp.sharp_total))
L(f"[sharpness] computed for {len(sharp)} teams from {TEST_YEAR-2}-{TEST_YEAR-1}")

# ---------------------------------------------------------------------------
# STEP 3: generate signal picks for 2025 via the harness (walk-forward already honest)
# ---------------------------------------------------------------------------
m, BASE = build()
m["actual_margin"] = m.home_score - m.away_score
m["actual_total"]  = m.home_score + m.away_score
led, _ = generate(m, BASE, TEST_YEAR)
# Drop NaN merge-leftover columns the harness adds before grade()
for c in ["away_ab","home_ab","actual_margin","actual_total","win","clv_pts","roi_u"]:
    if c in led.columns: led = led.drop(columns=[c])
led["away_ab"] = led.game.str.split("@").str[0]
led["home_ab"] = led.game.str.split("@").str[1]
# Build a "this side has a signal pick" lookup keyed by (season, week, home_ab, away_ab, market, pick_side)
sig=set()
for _,r in led.iterrows():
    if r.rule not in TEASER_RULES and not (r.rule=="sides_model" and r.get("confluence",0)==1): continue
    if r.market=="spread":
        side = "HOME" if r.bet_home==1 else "AWAY"
    else:
        side = "OVER" if r.bet_home==-1 else "UNDER"
    sig.add((int(r.season), int(r.week), r.home_ab, r.away_ab, r.market, side))
L(f"[signals] {len(sig)} signal-eligible side selections for {TEST_YEAR}")

# ---------------------------------------------------------------------------
# STEP 4: build the 2025 slate — every game with open spread + total
# ---------------------------------------------------------------------------
target_games = m[(m.season==TEST_YEAR)].merge(
    od[["season","home_ab","away_ab","open_spread","open_total","close_spread","close_total"]],
    on=["season","home_ab","away_ab"], how="inner")
target_games = target_games.dropna(subset=["open_spread","open_total","actual_margin","actual_total"]).copy()
L(f"[slate] {len(target_games)} games in {TEST_YEAR} with open lines + actuals")

# ---------------------------------------------------------------------------
# STEP 5: evaluate every possible leg, score it, and grade outcome
# ---------------------------------------------------------------------------
BUCKET_MIN = 0.74   # only consider legs whose 2018-2024 bucket hit >= 74%
SIG_W  = 0.05
SHRP_W = 0.03

def round_half(x):
    return round(x*2)/2 if not pd.isna(x) else x

legs=[]
for _,g in target_games.iterrows():
    sp = round_half(g.open_spread); tt = round_half(g.open_total)
    # Sharpness for this matchup
    h_ss = SHARP_S.get(g.home_ab, np.nan); a_ss = SHARP_S.get(g.away_ab, np.nan)
    h_st = SHARP_T.get(g.home_ab, np.nan); a_st = SHARP_T.get(g.away_ab, np.nan)
    sharp_spread = np.nanmean([h_ss, a_ss])
    sharp_total  = np.nanmean([h_st, a_st])
    # 4 possible legs per game
    candidates = [
        ("HOME",  "spread", sp, HOME, g.open_spread+6, sharp_spread, (g.actual_margin + g.open_spread + 6) > 0, (g.actual_margin + g.open_spread + 6) == 0),
        ("AWAY",  "spread", sp, AWAY, g.open_spread-6, sharp_spread, (g.actual_margin + g.open_spread - 6) < 0, (g.actual_margin + g.open_spread - 6) == 0),
        ("OVER",  "total",  tt, OVER, g.open_total-6,  sharp_total,  (g.actual_total > g.open_total - 6),       (g.actual_total == g.open_total - 6)),
        ("UNDER", "total",  tt, UNDER,g.open_total+6,  sharp_total,  (g.actual_total < g.open_total + 6),       (g.actual_total == g.open_total + 6)),
    ]
    for side, market, line, lookup, teased, sharp_val, won, push in candidates:
        if line not in lookup: continue
        bucket_p, bucket_lo, bucket_n = lookup[line]
        if bucket_p < BUCKET_MIN: continue
        signal_ok = int((TEST_YEAR, int(g.week), g.home_ab, g.away_ab, market, side) in sig)
        sharp_ok  = int(pd.notna(sharp_val) and sharp_val <= (np.nanmedian(list(SHARP_S.values())) if market=="spread" else np.nanmedian(list(SHARP_T.values()))))
        # Must have at least one confirmation beyond the bucket
        if signal_ok==0 and sharp_ok==0: continue
        score = bucket_p + SIG_W*signal_ok + SHRP_W*sharp_ok
        legs.append({"season":int(g.season),"week":int(g.week),"home_ab":g.home_ab,"away_ab":g.away_ab,
                     "side":side,"market":market,"line":line,"teased":teased,
                     "bucket_p":bucket_p,"bucket_n":bucket_n,"bucket_lo":bucket_lo,
                     "signal_ok":signal_ok,"sharp_ok":sharp_ok,"sharp_val":sharp_val,
                     "score":score,"won":(np.nan if push else int(won)),"push":push})
ldf = pd.DataFrame(legs)
L(f"[legs] {len(ldf)} eligible legs (bucket>=74% + 1+ confirmation)")
L(f"  By market: {ldf.market.value_counts().to_dict()}")
L(f"  By side:   {ldf.side.value_counts().to_dict()}")
L(f"  Signal=1:  {ldf.signal_ok.sum()}/{len(ldf)}")
L(f"  Sharp=1:   {ldf.sharp_ok.sum()}/{len(ldf)}")
L(f"  Both=1:    {((ldf.signal_ok==1)&(ldf.sharp_ok==1)).sum()}")

# Per-leg performance summary by confirmation profile
L(f"\n{'='*92}\nPER-LEG hit rates by confirmation profile\n{'='*92}")
for tag, sub in [("ALL eligible legs", ldf),
                 ("  signal=1 only (no sharp)",  ldf[(ldf.signal_ok==1)&(ldf.sharp_ok==0)]),
                 ("  sharp=1 only (no signal)",  ldf[(ldf.signal_ok==0)&(ldf.sharp_ok==1)]),
                 ("  BOTH signal=1 AND sharp=1", ldf[(ldf.signal_ok==1)&(ldf.sharp_ok==1)])]:
    w = sub.won.dropna(); n=len(w); k=int(w.sum())
    if n==0: L(f"  {tag:34s}: (none)"); continue
    lo,hi=wilson_ci(k,n)
    L(f"  {tag:34s}: n={n:3d} hit={k}/{n}={k/n*100:5.1f}% CI[{lo*100:.0f},{hi*100:.0f}]")

# ---------------------------------------------------------------------------
# STEP 6: build the 2-team teaser ledger — top-2 per week from distinct games
# ---------------------------------------------------------------------------
records=[]
for (sea,wk), grp in ldf.groupby(["season","week"]):
    grp = grp.sort_values("score", ascending=False)
    seen=set(); top=[]
    for _,r in grp.iterrows():
        gid = (r.home_ab, r.away_ab)
        if gid in seen: continue
        seen.add(gid); top.append(r)
        if len(top)==2: break
    if len(top)<2: continue
    l1,l2 = top
    records.append({
        "season":int(sea),"week":int(wk),
        "leg1":f"{l1.away_ab}@{l1.home_ab} {l1.market}/{l1.side}/{l1.line:+g}->{l1.teased:+g}",
        "leg2":f"{l2.away_ab}@{l2.home_ab} {l2.market}/{l2.side}/{l2.line:+g}->{l2.teased:+g}",
        "l1_won":l1.won,"l2_won":l2.won,
        "l1_score":l1.score,"l2_score":l2.score,
        "l1_bucket":l1.bucket_p,"l2_bucket":l2.bucket_p,
        "l1_sig":l1.signal_ok,"l2_sig":l2.signal_ok,
        "l1_sharp":l1.sharp_ok,"l2_sharp":l2.sharp_ok,
        "combo":"+".join(sorted([l1.market,l2.market])),
        "both":(np.nan if (pd.isna(l1.won) or pd.isna(l2.won)) else int(l1.won==1 and l2.won==1))
    })
res = pd.DataFrame(records)
L(f"\n{'='*92}\n2-TEAM TEASER LEDGER for {TEST_YEAR} ({len(res)} weeks with 2 legs)\n{'='*92}")
graded = res.dropna(subset=["both"])
n,k = len(graded), int(graded.both.sum())
lo,hi = wilson_ci(k,n) if n else (0,0)
for juice,payoff in [("@-120",100/120),("@-110",100/110)]:
    pnl = graded.both.apply(lambda b: payoff if b==1 else -1.0)
    L(f"\nALL teasers {juice}: n={n} hit={k}/{n}={k/n*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI={pnl.mean()*100:+.1f}% units={pnl.sum():+.1f}")

L(f"\nBy market combo:")
for combo in ["total+total","spread+total","spread+spread"]:
    c = graded[graded.combo==combo]
    if len(c)==0: L(f"  {combo:14s}: (none)"); continue
    cn=len(c); ck=int(c.both.sum()); lo,hi=wilson_ci(ck,cn)
    pnl = c.both.apply(lambda b: (100/120) if b==1 else -1.0)
    L(f"  {combo:14s}: n={cn:2d} hit={ck}/{cn}={ck/cn*100:.1f}% CI[{lo*100:.0f},{hi*100:.0f}] ROI@-120={pnl.mean()*100:+.1f}%")

L(f"\nBy confirmation profile of both legs:")
for tag, mask in [("both legs signal=1",  (graded.l1_sig==1)&(graded.l2_sig==1)),
                  ("both legs sharp=1",   (graded.l1_sharp==1)&(graded.l2_sharp==1)),
                  ("at least one signal", (graded.l1_sig==1)|(graded.l2_sig==1)),
                  ("at least one sharp",  (graded.l1_sharp==1)|(graded.l2_sharp==1))]:
    sub = graded[mask]
    if len(sub)==0: continue
    cn=len(sub); ck=int(sub.both.sum()); lo,hi=wilson_ci(ck,cn)
    pnl = sub.both.apply(lambda b: (100/120) if b==1 else -1.0)
    L(f"  {tag:24s}: n={cn:2d} hit={ck}/{cn}={ck/cn*100:.1f}% ROI@-120={pnl.mean()*100:+.1f}%")

L(f"\n{'='*92}\nEVERY WEEK'S TEASER (the realized 2025 product)\n{'='*92}")
for _,r in res.iterrows():
    status = ("WIN" if r.both==1 else ("loss" if r.both==0 else "push/void"))
    sig_tag = f"sig={int(r.l1_sig)}/{int(r.l2_sig)}"
    sharp_tag = f"sharp={int(r.l1_sharp)}/{int(r.l2_sharp)}"
    L(f"  W{r.week:2d} [{r.combo:13s}] {sig_tag} {sharp_tag}")
    L(f"      leg1: {r.leg1}  bucket={r.l1_bucket*100:.0f}%")
    L(f"      leg2: {r.leg2}  bucket={r.l2_bucket*100:.0f}%  -> {status}")

res.to_csv(os.path.join(OUT, f"b76_combined_teaser_{TEST_YEAR}.csv"), index=False)
L(f"\n[save] -> out/b76_combined_teaser_{TEST_YEAR}.csv")
