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
MARGIN_FEATS = ["sp_diff", "fpi_diff", "rec_diff", "neutralSite"]
TOTAL_FEATS = ["off_sum", "def_sum", "sp_diff", "neutralSite"]


def load():
    gm = pd.read_parquet(os.path.join(HERE, "data", "model_games.parquet"))
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
    return gm


def split_week0(te):
    """CFBD folds the opening weekend into week==1. Join kickoff dates and, if there's a >=3-day
    gap, drop the earlier (Week-0) cluster so each team appears once in the main week."""
    g = pd.read_parquet(os.path.join(CFBD, f"games_{SEASON}.parquet"))[["id", "startDate"]]
    te = te.merge(g.rename(columns={"id": "game_id"}), on="game_id", how="left")
    d = pd.to_datetime(te["startDate"], utc=True, errors="coerce").dt.normalize()
    uniq = sorted(d.dropna().unique())
    if len(uniq) > 1:
        gaps = [(uniq[i + 1] - uniq[i], uniq[i + 1]) for i in range(len(uniq) - 1)]
        biggest, split_date = max(gaps, key=lambda x: x[0])
        if biggest >= pd.Timedelta(days=3):
            n0 = int((d < split_date).sum())
            te = te[d >= split_date].copy()
            L(f"[split] dropped {n0} Week-0 games ({biggest.days}d gap before {pd.Timestamp(split_date).date()})")
    return te


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
    te = gm[(gm.season == SEASON) & (gm.week == WEEK)].copy()
    if te.empty:
        L(f"[predict] no {SEASON} wk{WEEK} games in model_games"); return
    te = split_week0(te)
    te["pred_margin"] = mreg.predict(imp(te, MARGIN_FEATS)).round(1)
    te["pred_total"] = treg.predict(imp(te, TOTAL_FEATS)).round(1)
    te["pred_spread"] = (-te.pred_margin).round(1)
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
