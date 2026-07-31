#!/usr/bin/env python3
"""NBA halves (1H) deep dive — spread, total, moneyline (NBA_HALVES_BRIEF1.md).

3 seasons of 1H closes (2023-24 → 2025-26). Builds a per-team-game 1H frame
with prior-only running records + context, then tests the owner's dimensions
and more. Grading at 1H consensus close (decimal median). BE 52.4%.

Guardrail from CBB: public-record signals (cover%, streaks) tend to be priced
or REVERSE. Contextual (divisional/meeting#/rest) and contrarian (cold favorite
= market overcorrection) angles are the better bets. Test all; let data rule.
Scan honesty: ~5% of cells clear |ROI|>=5% by chance.
"""
import glob
import os

import numpy as np
import pandas as pd

from movement_study import am_to_dec

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")


def build():
    h = pd.concat([pd.read_parquet(p) for p in
                   sorted(glob.glob(f"{OUT}/h1tt_nba_*.parquet"))], ignore_index=True)
    for c in ("h1_ml_home_price", "h1_ml_away_price", "h1_spread_home_price",
              "h1_spread_away_price", "h1_total_over_price", "h1_total_under_price"):
        h[c] = am_to_dec(h[c])
    cons = h.groupby("event_id").agg(
        h1_spread=("h1_spread_home_point", "median"),
        h1_sp_h=("h1_spread_home_price", "median"),
        h1_sp_a=("h1_spread_away_price", "median"),
        h1_total=("h1_total_point", "median"),
        h1_ov=("h1_total_over_price", "median"),
        h1_un=("h1_total_under_price", "median"),
        h1_ml_h=("h1_ml_home_price", "median"),
        h1_ml_a=("h1_ml_away_price", "median")).reset_index()

    g = pd.read_parquet(f"{OUT}/games_nba.parquet").dropna(subset=["home_h1", "away_h1"])
    mg = pd.read_parquet(f"{OUT}/movement_games_nba.parquet")[
        ["event_id", "t60_spread_home_point"]]
    g = g.merge(mg, on="event_id").merge(cons, on="event_id", how="inner")
    ct = "commence_time" if "commence_time" in g.columns else "date"
    g["date"] = pd.to_datetime(g[ct]).dt.tz_localize(None)

    # divisions
    bg = pd.read_parquet(f"{OUT}/bdl_games.parquet").drop_duplicates("id")
    bg["date"] = pd.to_datetime(bg["date"])
    bg["hk"] = bg["home_team.full_name"].str.lower().str.replace(r"[^a-z]", "", regex=True)
    from name_maps import norm
    g["hk"] = g["home_team"].map(norm)
    bg["hk"] = bg["home_team.full_name"].map(norm)
    bg["dkey"] = bg["date"].dt.strftime("%Y-%m-%d")
    g["dkey"] = (g["date"] - pd.Timedelta(hours=5)).dt.strftime("%Y-%m-%d")
    g = g.merge(bg[["hk", "dkey", "home_team.division", "visitor_team.division"]],
                on=["hk", "dkey"], how="left")
    g["divisional"] = (g["home_team.division"] == g["visitor_team.division"]).astype(float)

    # 1H outcomes (home perspective)
    g["h1_margin"] = g["home_h1"] - g["away_h1"]
    g["h1_tot"] = g["home_h1"] + g["away_h1"]
    g["h1_cov_home"] = g["h1_margin"] + g["h1_spread"]      # >0 home covers 1H
    g["h1_over"] = g["h1_tot"] - g["h1_total"]              # >0 over
    g["h1_home_win"] = (g["h1_margin"] > 0)

    # long team frame for prior-only records
    rows = []
    for side, sgn in (("home", 1), ("away", -1)):
        rows.append(pd.DataFrame({
            "event_id": g["event_id"], "season": g["season"], "date": g["date"],
            "team": g[side + "_team"], "opp": g[("away" if side == "home" else "home") + "_team"],
            "is_home": side == "home",
            "h1_cov": sgn * g["h1_cov_home"],               # team-perspective 1H cover margin
            "h1_covered": (sgn * g["h1_cov_home"] > 0),
            "h1_won": g["h1_home_win"] if side == "home" else ~g["h1_home_win"],
            "team_1h_pts": g["home_h1"] if side == "home" else g["away_h1"],
            "over_res": (g["h1_over"] > 0),
            "team_spread": g["t60_spread_home_point"] * sgn,
            "divisional": g["divisional"]}))
    t = pd.concat(rows, ignore_index=True).sort_values(["team", "season", "date"])
    grp = t.groupby(["team", "season"])
    t["gnum"] = grp.cumcount()
    t["s_cov_pct"] = grp["h1_covered"].transform(lambda s: s.shift(1).expanding().mean())
    t["s_ov_pct"] = grp["over_res"].transform(lambda s: s.shift(1).expanding().mean())
    # current streaks (consecutive prior 1H covers / non-covers)
    def streak(s):
        s = s.shift(1)
        out = np.zeros(len(s)); run = 0; prev = None
        for i, v in enumerate(s):
            if pd.isna(v): out[i] = 0; run = 0; prev = None; continue
            if v == prev: run += 1
            else: run = 1
            out[i] = run if v else -run
            prev = v
        return pd.Series(out, index=s.index)
    t["cov_streak"] = grp["h1_covered"].transform(streak)
    t["ov_streak"] = grp["over_res"].transform(streak)
    # meeting number vs this opponent in-season
    t["meet"] = t.groupby(["team", "season", "opp"]).cumcount() + 1
    return g, t


def summ(df, win, dec, label, lines, min_n=40):
    win = pd.Series(win, index=df.index).astype(float)
    ok = win.notna()
    n = int(ok.sum())
    if n < min_n:
        return None
    w = (win == 1) & ok
    profit = np.where(~ok, 0.0, np.where(w, dec.fillna(1.909) - 1, -1.0))
    per = " ".join(f"{s2}:{gg.mean()*100:.0f}" for s2, gg in
                   df.assign(w=w.astype(float), ok=ok).loc[ok].groupby("season")["w"])
    lines.append(f"| {label} | {n:,} | {w.sum()/n*100:.1f}% | {profit[ok].mean()*100:+.1f}% | {per} |")
    return w.sum() / n * 100


def main():
    g, t = build()
    lines = ["# NBA Halves Brief #1 — 1H spread / total / ML (3 seasons)", "",
             f"{len(g):,} games w/ 1H closes. Team-frame {len(t):,} rows. "
             "1H consensus close, decimal. BE 52.4%. per-season shown."]

    # ============ GAME-LEVEL (1H total) ============
    over_win = pd.Series(np.where(g["h1_over"] > 0, 1.0, np.where(g["h1_over"] < 0, 0.0, np.nan)), index=g.index)
    lines.append("\n## 1H TOTAL — context\n| signal | n | win% | ROI | per-season |")
    lines.append("|---|---|---|---|---|")
    # divisional & meeting number
    g2 = g.merge(t[t["is_home"]][["event_id", "meet", "gnum"]], on="event_id", how="left")
    for lbl, mask, side in [
        ("divisional game → 1H UNDER", g2["divisional"] == 1, "u"),
        ("divisional game → 1H OVER", g2["divisional"] == 1, "o"),
        ("divisional 2nd+ meeting → 1H UNDER", (g2["divisional"] == 1) & (g2["meet"] >= 2), "u"),
        ("divisional 3rd+ meeting → 1H UNDER", (g2["divisional"] == 1) & (g2["meet"] >= 3), "u"),
        ("any 2nd+ meeting → 1H UNDER", g2["meet"] >= 2, "u"),
        ("any 3rd+ meeting → 1H UNDER", g2["meet"] >= 3, "u"),
        ("late season (both 20+ gp) → 1H UNDER", g2["gnum"] >= 20, "u"),
        ("late season (both 20+ gp) → 1H OVER", g2["gnum"] >= 20, "o"),
    ]:
        w = over_win if side == "o" else (1 - over_win)
        dec = g["h1_ov"] if side == "o" else g["h1_un"]
        summ(g2[mask], w[mask], dec[mask], lbl, lines)

    # ============ 1H SPREAD — team streaks / records ============
    lines.append("\n## 1H SPREAD — records & streaks (public-record; expect priced/reverse)\n| signal | n | win% | ROI | per-season |")
    lines.append("|---|---|---|---|---|")
    cov_win = pd.Series(np.where(t["h1_cov"] > 0, 1.0, np.where(t["h1_cov"] < 0, 0.0, np.nan)), index=t.index)
    dec_cov = pd.Series(np.where(t["is_home"], g.set_index("event_id").loc[t["event_id"], "h1_sp_h"].values,
                                 g.set_index("event_id").loc[t["event_id"], "h1_sp_a"].values), index=t.index)
    late = t["gnum"] >= 20
    for lbl, mask in [
        ("hot: covered 3+ 1H spreads in a row → BACK", late & (t["cov_streak"] >= 3)),
        ("hot: covered 3+ → FADE", late & (t["cov_streak"] >= 3)),
        ("cold: failed 3+ 1H spreads in a row → BACK", late & (t["cov_streak"] <= -3)),
        ("cold: failed 3+ → FADE", late & (t["cov_streak"] <= -3)),
        ("high season 1H cover% (>=58) → BACK", late & (t["s_cov_pct"] >= .58)),
        ("high season cover% → FADE", late & (t["s_cov_pct"] >= .58)),
        ("low season 1H cover% (<=42) → BACK", late & (t["s_cov_pct"] <= .42)),
        ("low season cover% → FADE", late & (t["s_cov_pct"] <= .42)),
    ]:
        back = "BACK" in lbl
        w = cov_win if back else (1 - cov_win)
        summ(t[mask], w[mask], dec_cov[mask], lbl, lines)

    # ============ the owner's contrarian cell: cold+favored ============
    lines.append("\n## 1H SPREAD — contrarian: cold team that's FAVORED (overcorrection)\n| signal | n | win% | ROI | per-season |")
    lines.append("|---|---|---|---|---|")
    fav = t["team_spread"] < 0
    for lbl, mask in [
        ("cold (3+ 1H fails) AND favored → BACK cold fav", late & (t["cov_streak"] <= -3) & fav),
        ("cold (<=40% season) AND favored → BACK", late & (t["s_cov_pct"] <= .40) & fav),
        ("cold fav vs hot dog (opp cov_streak>=3) → BACK cold fav", None),
    ]:
        if mask is None: continue
        summ(t[mask], cov_win[mask], dec_cov[mask], lbl, lines)
    # cold fav vs hot dog needs opp join
    opp = t[["event_id", "team", "cov_streak", "s_cov_pct"]].rename(
        columns={"team": "opp", "cov_streak": "opp_streak", "s_cov_pct": "opp_covpct"})
    tj = t.merge(opp, on=["event_id", "opp"], how="left")
    cw = pd.Series(np.where(tj["h1_cov"] > 0, 1.0, np.where(tj["h1_cov"] < 0, 0.0, np.nan)), index=tj.index)
    dc = pd.Series(dec_cov.values, index=tj.index)
    latej = tj["gnum"] >= 20
    for lbl, mask in [
        ("cold+fav vs HOT dog (opp 3+ hot) → BACK cold fav", latej & (tj["cov_streak"] <= -3) & (tj["team_spread"] < 0) & (tj["opp_streak"] >= 3)),
        ("hot+dog vs cold fav → BACK hot dog", latej & (tj["cov_streak"] >= 3) & (tj["team_spread"] > 0) & (tj["opp_streak"] <= -3)),
        ("both hot (both 3+ cover streak) → team", latej & (tj["cov_streak"] >= 3) & (tj["opp_streak"] >= 3)),
    ]:
        summ(tj[mask], cw[mask], dc[mask], lbl, lines)

    # ============ 1H ML ============
    lines.append("\n## 1H MONEYLINE — halftime-lead as-of records\n| signal | n | win% | ROI | per-season |")
    lines.append("|---|---|---|---|---|")
    t["s_win_pct"] = t.groupby(["team", "season"])["h1_won"].transform(lambda s: s.shift(1).expanding().mean())
    ml_win = pd.Series(t["h1_won"].astype(float).values, index=t.index)
    ml_dec = pd.Series(np.where(t["is_home"], g.set_index("event_id").loc[t["event_id"], "h1_ml_h"].values,
                                g.set_index("event_id").loc[t["event_id"], "h1_ml_a"].values), index=t.index)
    for lbl, mask in [
        ("dog team leads 1H often (s_win>=55%) → 1H ML", late & (t["s_win_pct"] >= .55) & (t["team_spread"] > 0)),
        ("fav team trails 1H often (s_win<=45%) as dog value?", late & (t["s_win_pct"] <= .45) & (t["team_spread"] < 0)),
        ("home dog 1H ML (base rate)", (t["is_home"]) & (t["team_spread"] > 0)),
    ]:
        summ(t[mask], ml_win[mask], ml_dec[mask], lbl, lines)

    with open(os.path.join(ROOT, "NBA_HALVES_BRIEF1.md"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote NBA_HALVES_BRIEF1.md")


if __name__ == "__main__":
    main()
