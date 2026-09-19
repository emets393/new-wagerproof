#!/usr/bin/env python3
"""ATTEMPTS FIRST, THEN COMPLETIONS (owner, 2026-09-18).  completions = attempts x completion rate.
 A  the market's own decomposition: attempts LINE x his entering completion rate -> implied completions;
    does it beat the posted completions line? (and where they disagree, who is right?)
 B  two-stage model: attempts model (volume: spread, total, implied team total, PROE, pace, opponent pass
    rate faced, his attempts form, the attempts line) x completion-rate model (his entering rate, opponent
    man / blitz / pressure, wind, receivers' catchable rate, WR/TE out) -> completions
 C  the direct completions model from exp_completions_deep (for reference) and the completions LINE
Walk-forward 2024 / 2025 on the completions frame (1,773 QB-games) joined to the attempts lines from the
panel. Grading: MAE vs actual completions; the bet at |pred − completions line| >= 1.75 at best-book."""
import io, contextlib, numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore"); num = lambda s: pd.to_numeric(s, errors="coerce")
src = open("exp_prop_injury_context.py").read().split('print("\\n" + "=" * 130)')[0]; ns = {}
with contextlib.redirect_stdout(io.StringIO()): exec(compile(src, "ic", "exec"), ns)
prep2, PE = ns["prep2"], ns["PE"]
from prop_engine import ridge
d = pd.read_parquet("data/_completions_deep_frame.parquet").dropna(subset=["qb"]).copy()
att, _ = prep2("player_pass_attempts", ["QB"], None); att = att[att.close_line.notna()][["player_id","season","week","close_line","actual"]].rename(columns={"close_line":"att_line","actual":"att_actual"}).drop_duplicates(["player_id","season","week"])
d = d.merge(att, on=["player_id","season","week"], how="left"); print(f"completions frame {len(d)} | with an attempts line {d.att_line.notna().sum()} | with attempts actual {d.att_actual.notna().sum()}")
# his entering completion RATE (K=4 seeded) from the FP QB per-game table
qb = pd.read_parquet("data/fpdata/player_passing-advanced.parquet"); qb = qb[qb.__season >= 2022].copy(); qb["att"] = num(qb.playerStatsPassingAttemptsTotal); qb["cmp"] = num(qb.playerStatsPassingCompletionsTotal); qb["pid"] = qb.playerPlayerId.astype(str)
qb = qb[qb.att >= 5].sort_values(["pid","__season","__week"]); pri = qb.groupby(["pid","__season"]).agg(a=("cmp","sum"), b=("att","sum")); pri["r"] = pri.a / pri.b
p = pd.Series([pri.r.get((i, s - 1), np.nan) for i, s in zip(qb.pid, qb.__season)], index=qb.index); g = qb.groupby(["pid","__season"]); cs = g.cmp.cumsum() - qb.cmp; cn = g.att.cumsum() - qb.att; k = 4 * qb.att.mean()
qb["e_cprate"] = (cs + k * p.fillna(0)) / (cn + k * p.notna()); qb.loc[(cn == 0) & p.isna(), "e_cprate"] = np.nan
d["playerPlayerId"] = d.playerPlayerId.astype(str); d = d.merge(qb[["pid","__season","__week","e_cprate"]].rename(columns={"pid":"playerPlayerId","__season":"season","__week":"week"}), on=["playerPlayerId","season","week"], how="left")
d = d[d.att_line.notna() & d.e_cprate.notna()].copy(); d["implied"] = d.att_line * d.e_cprate; print(f"usable rows: {len(d)} (seasons {d.season.value_counts().sort_index().to_dict()})")
def gbest(x, pred, thr):
    e = pred - x.close_line.values; sel = (np.abs(e) >= thr) & x.bo_line.notna().values; x = x[sel]; e = e[sel]
    if not len(x): return np.nan, 0, np.nan
    over = e > 0; line = np.where(over, x.bo_line, x.bu_line); pay = np.where(over, x.bo_dec, x.bu_dec); won = np.where(over, x.actual > line, x.actual < line); push = x.actual.values == line
    p = np.where(push, 0, np.where(won, pay, -1.0)); return (won[~push].mean() if (~push).sum() else np.nan), int((~push).sum()), p.mean()
def fit(tr, te, F, y, lam=200):
    Fk = [c for c in F if tr[c].std() > 1e-9]; X = tr[Fk].values.astype(float); mu, sd = X.mean(0), X.std(0); sd[sd == 0] = 1
    w = ridge((X - mu) / sd, tr[y].values.astype(float), lam); return np.hstack([(te[Fk].values.astype(float) - mu) / sd, np.ones((len(te), 1))]) @ w
VOL = ["att_line","team_spread","total","implied_tt","abs_spread","big_fav","big_dog","is_home","T_gs_proe","T_gs_db","T_rp_passrate","O_rp_passrate","off_sec_per_play_neutral_s2d","off_plays_per_game_s2d","off_proe_s2d","def_pass_success_allowed_s2d","qb_db","l5","szn","wind","rest","div_game"]
RATE = ["e_cprate","opp_rate_man","opp_rate_blitz","opp_rate_press","O_dcv_man","O_dps_cpoe","wind","temp","e_rw_catchable","e_rw_contested","inj_wrte_tgt_out","qb_cpoe","qb_adot","qb_ttt","qb_poe","ix_sens_man","ix_sens_blitz","ix_sens_press"]
VOL = [c for c in VOL if c in d.columns]; RATE = [c for c in RATE if c in d.columns]; _all = list(dict.fromkeys(VOL + RATE)); d[_all] = d[_all].apply(lambda s: s.fillna(s.median())).fillna(0)
d["cprate"] = d.actual / d.att_actual.replace(0, np.nan)
print("\n" + "=" * 112); print("A) THE MARKET'S OWN DECOMPOSITION — attempts line x his entering completion rate vs the completions line"); print("=" * 112)
for yr in (2024, 2025):
    x = d[d.season == yr]; print(f"  {yr}: MAE completions line {np.abs(x.close_line - x.actual).mean():.2f} | implied (att line x his rate) {np.abs(x.implied - x.actual).mean():.2f} | r(implied − line, actual − line) = {np.corrcoef(x.implied - x.close_line, x.actual - x.close_line)[0,1]:+.3f}")
    for t in (1.0, 1.75, 2.5): w, n, roi = gbest(x, x.implied.values, t); print(f"       bet the implied side at |gap| ≥ {t}: {100*w if n else np.nan:4.1f}% n={n:3d} ROI {100*roi if n else np.nan:+5.1f}%")
print("\n" + "=" * 112); print("B) TWO-STAGE MODEL — attempts model x completion-rate model, walk-forward"); print("=" * 112)
print(f"  {'model':40s} | " + " | ".join(f"{yr}: MAE   r    bet≥1.75 win%/n ROI" for yr in (2024, 2025)))
def row(name, preds):
    out = []
    for yr in (2024, 2025):
        te, pr = preds[yr]; w, n, roi = gbest(te, pr, 1.75); out.append(f"{yr}: {np.abs(pr - te.actual).mean():4.2f} {np.corrcoef(pr, te.actual)[0,1]:+.2f}  {100*w if n else np.nan:4.1f}%/{n:3d} {100*roi if n else np.nan:+5.1f}%")
    print(f"  {name:40s} | " + " | ".join(out))
P = {k: {} for k in ("line","attline_x_rate","att_model","rate_model","two_stage","two_stage_line","direct")}
for yr in (2024, 2025):
    tr, te = d[(d.season < yr) & d.att_actual.notna() & d.cprate.notna()], d[d.season == yr].copy()
    a_pred = fit(tr, te, VOL, "att_actual"); r_pred = fit(tr, te, RATE, "cprate")
    P["line"][yr] = (te, te.close_line.values); P["attline_x_rate"][yr] = (te, te.implied.values)
    P["att_model"][yr] = (te, a_pred * te.e_cprate.values); P["rate_model"][yr] = (te, te.att_line.values * r_pred); P["two_stage"][yr] = (te, a_pred * r_pred)
    te2 = te.assign(att_pred=a_pred, rate_pred=r_pred, two=a_pred * r_pred); tr2 = tr.assign(att_pred=fit(tr, tr, VOL, "att_actual"), rate_pred=fit(tr, tr, RATE, "cprate")); tr2["two"] = tr2.att_pred * tr2.rate_pred
    P["two_stage_line"][yr] = (te, fit(tr2, te2, ["two","close_line","att_pred","rate_pred"], "actual", 60))
    DIRECT = [c for c in PE.SETS["player_pass_completions"] if c in d.columns]; P["direct"][yr] = (te, fit(tr, te, DIRECT, "actual", 60))
    print(f"  [{yr}] attempts model: MAE {np.abs(a_pred - te.att_actual).mean():.2f} vs attempts line {np.abs(te.att_line - te.att_actual).mean():.2f} | rate model: MAE {np.abs(r_pred - te.cprate).mean():.3f} vs his entering rate {np.abs(te.e_cprate - te.cprate).mean():.3f}")
row("completions LINE", P["line"]); row("attempts LINE x his entering rate", P["attline_x_rate"]); row("attempts MODEL x his entering rate", P["att_model"]); row("attempts LINE x rate MODEL", P["rate_model"]); row("attempts MODEL x rate MODEL (two-stage)", P["two_stage"]); row("two-stage + completions line (blend)", P["two_stage_line"]); row("direct completions model (current)", P["direct"])
print("\n  read: if 'attempts LINE x rate MODEL' beats the direct model, the rate is where the edge is; if 'attempts MODEL x his rate' does, it is volume.")
