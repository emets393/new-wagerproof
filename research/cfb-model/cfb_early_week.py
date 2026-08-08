"""
Early-week (weeks 1-3) DISPLAY predictor — README plan: the opponent-adjusted betting model is
COLD early (no games -> null adj ratings), so for the "every game gets a number" product we blend
PRESEASON priors into a per-game predicted margin + total. DISPLAY ONLY — the lean betting model
(cfb_forecast.py) is unchanged and still owns the betting edges from ~week 4 on.

Signals (leak-safe, known before kickoff): prior-year SP+ (overall/off/def) + FPI + recruiting (3yr).
talent / ELO / preseason polls join automatically once CFBD publishes them (~Aug) — empty for now,
so the blend rides on prior-SP+ + recruiting.

Slate hygiene:
  - Week-0 split: CFBD folds the early opening weekend into week==1; we split on the largest date
    gap and keep the main (later) cluster so a team isn't listed twice.
  - Missing-prior fallback: teams without a prior-year SP+ (many G5) are MEAN-imputed per feature
    (not filled 0 -> which made SP+ off/def look like a zero-offense team => degenerate totals).

Usage: CFB_SEASON=2026 CFB_WEEK=1 python3 cfb_early_week.py

⚠ AFTER REGENERATING EARLY PREDS: re-run gen_cfb_dryrun_games.py AND gen_cfb_picks.py
together — BOTH read these predictions, and regenerating only one desyncs the header
score from the pick cards (bit us 2026-08-05: cards showed stale cold-model numbers).
"""
import os
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

HERE = os.path.dirname(os.path.abspath(__file__))
CFBD = os.path.join(HERE, "data", "cfbd")
SEASON = int(os.getenv("CFB_SEASON", "2026"))
WEEK = int(os.getenv("CFB_WEEK", "1"))
L = print
# ROSTER features from player-level reconstruction (cfb_roster_early_test 2026-08-03:
# BASE+ROSTER MAE 12.95 v 13.19, disagreement error 18.5->16.2). NaN-safe: mean-imputed,
# so weeks before CFBD posts rosters (incl 2026 today) degrade to the BASE blend.
ROSTER_FEATS = ["d_ret_prod", "d_in_prod", "d_ret_share", "d_talent_stock",
                "d_qb1_prior", "d_qb1_transfer"]
MARGIN_FEATS = ["sp_diff", "fpi_diff", "rec_diff", "neutralSite"] + ROSTER_FEATS
# CORE O/D (CFBD /ratings/core, S-1 finals) — core_blend_test 2026-08-08: the O/D
# split beats overall-strength totals priors (wk1-3 MAE 13.17 v 13.31, λ +0.15).
# Margin model deliberately unchanged (CORE added only +0.04 there — noise).
TOTAL_FEATS = ["off_sum", "def_sum", "sp_diff", "core_off_sum", "core_def_sum", "neutralSite"]


def load():
    gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
    # Ephemeral disk (Render): build_features assembles only the CURRENT season in-run, so the
    # training seasons come from the committed frozen frame. Locally model_games already spans
    # 2016+ and the concat is a no-op (drop_duplicates keeps the freshly built rows first).
    hist_fp = os.path.join(HERE, "data", "model_games_hist.parquet")
    if os.path.exists(hist_fp):
        hist = pd.read_parquet(hist_fp)
        gm = (pd.concat([gm, hist[hist.season < SEASON]], ignore_index=True)
              .drop_duplicates(["season", "week", "homeTeam", "awayTeam"], keep="first"))
    # DISPLAY/GRADE market line = THE ODDS API only (owner rule: every bet line, every sport, comes from
    # The Odds API — never CFBD). odds_game_frame is the Odds-API consensus (fetch_odds_history /
    # materialize_odds_history -> build_odds_frame). Override model_games' CFBD consensus_lines entirely;
    # a game with no Odds-API line shows no line (NaN) rather than falling back to CFBD.
    of = pd.read_parquet(os.path.join(HERE, "data", "odds_game_frame.parquet"))[
        ["season", "home", "away", "close_spread", "close_total"]].rename(
        columns={"home": "homeTeam", "away": "awayTeam"})
    gm = gm.merge(of, on=["season", "homeTeam", "awayTeam"], how="left")
    gm["spread_close"] = gm["close_spread"]
    gm["total_close"] = gm["close_total"]
    pri = pd.read_parquet(os.path.join(HERE, "data", "priors.parquet"))
    h = pri.add_prefix("h_").rename(columns={"h_season": "season", "h_team": "homeTeam"})
    a = pri.add_prefix("a_").rename(columns={"a_season": "season", "a_team": "awayTeam"})
    gm = gm.merge(h, on=["season", "homeTeam"], how="left").merge(a, on=["season", "awayTeam"], how="left")
    gm["sp_diff"] = gm.h_prior_sp - gm.a_prior_sp
    gm["fpi_diff"] = gm.h_prior_fpi - gm.a_prior_fpi
    gm["rec_diff"] = gm.h_recruit_3yr - gm.a_recruit_3yr
    gm["off_sum"] = gm.h_prior_sp_off + gm.a_prior_sp_off
    gm["def_sum"] = gm.h_prior_sp_def + gm.a_prior_sp_def
    # prior-season CORE O/D (NaN-safe: mean-imputed downstream like ROSTER feats,
    # so seasons/teams without CORE degrade to the SP+ off/def priors)
    crp = os.path.join(CFBD, "core_ratings.parquet")
    if os.path.exists(crp):
        cr = pd.read_parquet(crp)[["year", "team", "offense", "defense"]]
        cr["season"] = cr.year + 1                      # S-1 final -> season-S prior
        ch = cr.rename(columns={"team": "homeTeam", "offense": "h_core_off", "defense": "h_core_def"})
        ca = cr.rename(columns={"team": "awayTeam", "offense": "a_core_off", "defense": "a_core_def"})
        gm = gm.merge(ch[["season", "homeTeam", "h_core_off", "h_core_def"]],
                      on=["season", "homeTeam"], how="left")
        gm = gm.merge(ca[["season", "awayTeam", "a_core_off", "a_core_def"]],
                      on=["season", "awayTeam"], how="left")
        gm["core_off_sum"] = gm.h_core_off + gm.a_core_off
        gm["core_def_sum"] = gm.h_core_def + gm.a_core_def
    else:
        gm["core_off_sum"] = np.nan
        gm["core_def_sum"] = np.nan
    rsp = os.path.join(HERE, "data", "roster_scores.parquet")
    if os.path.exists(rsp):
        rs = pd.read_parquet(rsp)
        rh = rs.add_prefix("rh_").rename(columns={"rh_season": "season", "rh_team": "homeTeam"})
        ra = rs.add_prefix("ra_").rename(columns={"ra_season": "season", "ra_team": "awayTeam"})
        gm = gm.merge(rh, on=["season", "homeTeam"], how="left").merge(ra, on=["season", "awayTeam"], how="left")
        for c in ("ret_prod", "in_prod", "ret_share", "talent_stock", "qb1_prior", "qb1_transfer"):
            gm[f"d_{c}"] = gm.get(f"rh_{c}") - gm.get(f"ra_{c}")
    else:
        for c in ("ret_prod", "in_prod", "ret_share", "talent_stock", "qb1_prior", "qb1_transfer"):
            gm[f"d_{c}"] = np.nan
    return gm


def main():
    gm = load()
    tr = gm[(gm.week <= 3) & (gm.season < SEASON)
            & gm.actual_margin.notna() & gm.actual_total.notna() & gm.sp_diff.notna()].copy()
    L(f"[train] weeks 1-3, seasons <{SEASON}: {len(tr)} games")

    feats_all = sorted(set(MARGIN_FEATS + TOTAL_FEATS))
    means = tr[feats_all].mean()               # league-average fallback (leak-safe: train only)

    def imp(df, feats):
        return df[feats].fillna(means)

    # walk-forward sanity
    mm_e, tt_e = [], []
    for S in sorted(tr.season.unique()):
        if S < 2021:
            continue
        a, b = tr[tr.season < S], tr[tr.season == S]
        if len(a) < 300 or len(b) < 20:
            continue
        mm = Ridge(alpha=5.0).fit(imp(a, MARGIN_FEATS), a.actual_margin)
        tt = Ridge(alpha=5.0).fit(imp(a, TOTAL_FEATS), a.actual_total)
        mm_e.append(np.abs(mm.predict(imp(b, MARGIN_FEATS)) - b.actual_margin).mean())
        tt_e.append(np.abs(tt.predict(imp(b, TOTAL_FEATS)) - b.actual_total).mean())
    if mm_e:
        L(f"[walk-forward wk1-3] margin MAE={np.mean(mm_e):.2f} | total MAE={np.mean(tt_e):.2f}  (market ~= 11-12 / 12-13)")

    mreg = Ridge(alpha=5.0).fit(imp(tr, MARGIN_FEATS), tr.actual_margin)
    treg = Ridge(alpha=5.0).fit(imp(tr, TOTAL_FEATS), tr.actual_total)
    # Predict EVERY game in the week — including the Week-0 opening-weekend games CFBD folds into week==1.
    # A team that plays both Week 0 (late Aug) and Week 1 (early Sep) shows two rows; both are real games and
    # the app orders by kickoff, so both display correctly. We do NOT drop the openers.
    te = gm[(gm.season == SEASON) & (gm.week == WEEK)].copy()
    if te.empty:
        L(f"[predict] no {SEASON} wk{WEEK} games in model_games"); return
    te["pred_margin"] = mreg.predict(imp(te, MARGIN_FEATS)).round(1)
    te["pred_total"] = treg.predict(imp(te, TOTAL_FEATS)).round(1)
    te["pred_spread"] = (-te.pred_margin).round(1)
    # MARKET ANCHOR (cfb_early_talent_test 2026-08-03): the preseason blend carries ZERO
    # information beyond the closing line in wk1-3 (shrink λ = -0.07±0.10 spread, +0.12±0.11
    # total; the line's MAE beats the blend outright, and the market wins the top-decile
    # disagreement games 15.2 vs 18.7). Deviations from the line are noise — e.g. 2026 wk1
    # OSU@Tulsa raw blend -0.8 vs market -12.5. Display = close + 0.25*(blend-close), capped
    # ±7/±6, keeping a model voice at ~0.1 MAE cost. Raw blend kept where no Odds-API line.
    # λ HISTORY: 0.25 was the stale-ratings-era bandage (raw blend was 6+ pts off market w/
    # absurdities). With TRUE preseason SP+ + roster features the raw blend sits ~3.1 pts off
    # the close with sane extremes — owner call 2026-08-05: SHOW OUR NUMBER (λ=1), keep the
    # cap purely as a safety rail (binds only on the p90 tail, e.g. refusing to lay 40+).
    LAM, CAP_S, CAP_T = 1.0, 7.0, 6.0
    hs = te.spread_close.notna()
    te.loc[hs, "pred_spread"] = (te.spread_close + (LAM * (te.pred_spread - te.spread_close))
                                 .clip(-CAP_S, CAP_S)).round(1)[hs]
    te.loc[hs, "pred_margin"] = -te.loc[hs, "pred_spread"]
    ht = te.total_close.notna()
    te.loc[ht, "pred_total"] = (te.total_close + (LAM * (te.pred_total - te.total_close))
                                .clip(-CAP_T, CAP_T)).round(1)[ht]
    L(f"[anchor] λ={LAM} cap ±{CAP_S}/±{CAP_T}: {int(hs.sum())} spreads, {int(ht.sum())} totals anchored to the Odds-API close")
    L(f"[predict] {len(te)} {SEASON} wk{WEEK} games | prior-SP+ present on both sides for "
      f"{int((te.h_prior_sp.notna() & te.a_prior_sp.notna()).sum())}")
    out = os.path.join(HERE, "out", f"cfb_early_preds_{SEASON}.csv")
    cols = ["season", "week", "homeTeam", "awayTeam", "pred_spread", "pred_total", "spread_close", "total_close"]
    te[[c for c in cols if c in te.columns]].to_csv(out, index=False)
    L(f"[save] {out}")
    L(te[[c for c in ["homeTeam", "awayTeam", "pred_spread", "pred_total", "spread_close", "total_close"]
          if c in te.columns]].head(25).to_string(index=False))


if __name__ == "__main__":
    main()
