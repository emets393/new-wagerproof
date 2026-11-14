"""
NCAAB carry-over study: the game AFTER a blowout win, a blowout loss, or an overtime game.
Every market graded at the consensus closing line (ncaab_games_hist): FG spread, FG moneyline,
FG total, team total, 1H spread, 1H moneyline, 1H total. Regular-season "next games" only
(game_type STD); the previous game may be anything in the same season.

Records are written from the bet's side. For sides the table shows BOTH back-the-team and
fade-the-team records (a 45% team ATS record is a 55% fade). Totals show over and under.

Usage: /usr/bin/python3 study_blowout_ot_carryover.py <games_hist.parquet> <game_ot_ncaab.parquet> <out.md>
"""
import sys, math
import numpy as np, pandas as pd

HIST, OT, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
JUICE = -110

def ml_profit(price, won):
    if won is None or price is None or (isinstance(price, float) and math.isnan(price)) or price == 0:
        return np.nan
    if won == "P": return 0.0
    if won == "W": return price / 100.0 if price > 0 else 100.0 / abs(price)
    return -1.0

def letter(margin):
    if pd.isna(margin): return None
    return "W" if margin > 0 else "L" if margin < 0 else "P"

def build_panel():
    H = pd.read_parquet(HIST)
    ot = pd.read_parquet(OT).rename(columns={"gameId": "cbbd_id"})
    H = H.merge(ot[["cbbd_id", "went_ot", "max_period"]], on="cbbd_id", how="left")
    H["date"] = pd.to_datetime(H["date_et"])
    rows = []
    for side in ("home", "away"):
        o = "away" if side == "home" else "home"
        sgn = 1.0 if side == "home" else -1.0
        d = pd.DataFrame({
            "cbbd_id": H.cbbd_id, "season": H.season, "date": H.date, "game_type": H.game_type,
            "neutral": H.neutral_site.fillna(False).astype(bool), "conf": H.conference_game,
            "team": H[f"{side}_team"], "team_id": H[f"{side}_team_id"], "opp_id": H[f"{o}_team_id"],
            "is_home": side == "home", "went_ot": H.went_ot, "max_period": H.max_period,
            "pts": H[f"{side}_score"], "opp_pts": H[f"{o}_score"],
            "h1_pts": H[f"{side}_h1"], "h1_opp_pts": H[f"{o}_h1"],
            "spread": sgn * H.close_spread, "ml": H[f"close_ml_{side}"], "total": H.close_total,
            "tt": H[f"tt_{side}"], "h1_spread": sgn * H.h1_spread, "h1_ml": H[f"h1_ml_{side}"], "h1_total": H.h1_total,
        })
        rows.append(d)
    P = pd.concat(rows, ignore_index=True)
    for c in ("ml", "h1_ml"):   # an American price is never inside (-100, 100); the backfill has a few such rows and they inflate payouts
        P.loc[P[c].abs() < 100, c] = np.nan
    P["margin"] = P.pts - P.opp_pts
    P["h1_margin"] = P.h1_pts - P.h1_opp_pts
    P = P.sort_values(["team_id", "date"]).reset_index(drop=True)
    g = P.groupby("team_id", sort=False)
    for c in ("margin", "went_ot", "max_period", "date", "season", "game_type", "neutral", "is_home", "spread"):
        P[f"prev_{c}"] = g[c].shift(1)
    P["rest"] = (P.date - P.prev_date).dt.days
    P.loc[P.prev_season != P.season, ["prev_margin", "prev_went_ot", "prev_max_period", "rest", "prev_game_type", "prev_neutral", "prev_is_home", "prev_spread"]] = np.nan
    # the opponent's previous-game situation (for totals: either / both teams)
    opp = P[["cbbd_id", "team_id", "prev_margin", "prev_went_ot", "rest"]].rename(
        columns={"team_id": "opp_id", "prev_margin": "opp_prev_margin", "prev_went_ot": "opp_prev_went_ot", "rest": "opp_rest"})
    P = P.merge(opp, on=["cbbd_id", "opp_id"], how="left")
    # outcomes from the TEAM's side
    P["ats"] = (P.margin + P.spread).apply(letter)
    P["su"] = P.margin.apply(letter)
    P["ou"] = (P.pts + P.opp_pts - P.total).apply(letter)          # W = over
    P["tto"] = (P.pts - P.tt).apply(letter)                       # W = team over its team total
    P["h1_ats"] = (P.h1_margin + P.h1_spread).apply(letter)
    P["h1_su"] = P.h1_margin.apply(letter)
    P["h1_ou"] = (P.h1_pts + P.h1_opp_pts - P.h1_total).apply(letter)  # W = over
    P.loc[P.spread.isna(), "ats"] = None
    P.loc[P.ml.isna(), "su"] = None
    P.loc[P.total.isna(), "ou"] = None
    P.loc[P.tt.isna(), "tto"] = None
    P.loc[P.h1_spread.isna(), "h1_ats"] = None
    P.loc[P.h1_ml.isna(), "h1_su"] = None
    P.loc[P.h1_total.isna(), "h1_ou"] = None
    P["su_profit"] = [ml_profit(p, w) for p, w in zip(P.ml, P.su)]
    P["h1_su_profit"] = [ml_profit(p, w) for p, w in zip(P.h1_ml, P.h1_su)]
    return P

MARKETS = [  # (column, label, kind)  kind: side (back/fade) | total (over/under) | ml (back at price / fade at opp price)
    ("ats", "FG spread", "side"), ("su", "FG moneyline", "ml"), ("ou", "FG total", "total"), ("tto", "Team total", "total"),
    ("h1_ats", "1H spread", "side"), ("h1_su", "1H moneyline", "ml"), ("h1_ou", "1H total", "total"),
]

def rec(sub, col):
    s = sub[col].dropna()
    w, l, p = (s == "W").sum(), (s == "L").sum(), (s == "P").sum()
    return int(w), int(l), int(p)

def roi_110(w, l):
    n = w + l
    return np.nan if n == 0 else (w * 100 / 110 - l) / n * 100

def z(w, l, base):
    n = w + l
    if n == 0: return np.nan
    return (w / n - base) / math.sqrt(base * (1 - base) / n)

def seasons_line(sub, col, flip=False):
    out = []
    for s, g in sub.groupby("season"):
        w, l, p = rec(g, col)
        if flip: w, l = l, w
        out.append(f"{str(s)[-2:]}: {w}-{l}")
    return " · ".join(out)

def grade(sub, base, label):
    """One row per market: back-team record, fade-team record (or over/under), ROI, z vs base, per season."""
    lines = []
    for col, mlabel, kind in MARKETS:
        w, l, p = rec(sub, col)
        n = w + l
        if n < 30:
            lines.append(f"| {mlabel} | n={n} | — | — | — | too thin |"); continue
        b = base[col]
        if kind == "side":
            back = f"back {w}-{l}-{p} ({w/n:.1%}, {roi_110(w,l):+.1f}%)"
            fade = f"fade {l}-{w}-{p} ({l/n:.1%}, {roi_110(l,w):+.1f}%)"
            zz = z(w, l, b)
        elif kind == "total":
            back = f"over {w}-{l}-{p} ({w/n:.1%}, {roi_110(w,l):+.1f}%)"
            fade = f"under {l}-{w}-{p} ({l/n:.1%}, {roi_110(l,w):+.1f}%)"
            zz = z(w, l, b)
        else:
            prof = sub[f"{col}_profit"].dropna()
            back = f"back {w}-{l} ({w/n:.1%}, ML ROI {prof.mean()*100:+.1f}%)"
            # fading = backing the opponent at the opponent's price: approximate with -profit minus vig is not available; show opp SU only
            fade = f"opponent SU {l}-{w} ({l/n:.1%})"
            zz = z(w, l, b)
        best_is_back = (w / n) >= 0.5
        seas = seasons_line(sub, col, flip=not best_is_back)
        lines.append(f"| {mlabel} | {n} | {back} | {fade} | {zz:+.1f} | {seas} |")
    return lines

def base_rates(U):
    return {col: (lambda w, l, p: w / max(w + l, 1))(*rec(U, col)) for col, _, _ in MARKETS}

def section(md, title, sub, base, note=""):
    md.append(f"\n### {title}\n")
    if note: md.append(note + "\n")
    md.append(f"n team-games = {len(sub):,}\n")
    md.append("| market | n | back / over | fade / under | z vs base | per season (from the better side) |")
    md.append("|---|---|---|---|---|---|")
    md.extend(grade(sub, base, title))

def main():
    P = build_panel()
    U = P[(P.game_type == "STD") & P.prev_margin.notna()].copy()   # regular-season next games with a same-season previous game
    base = base_rates(U)
    md = ["# NCAAB carry-over: the game after a blowout, and the game after overtime",
          "",
          "Universe: every Division I team-game 2020-21 → 2025-26 whose previous game was in the same season, next game regular season "
          "(`game_type = STD`), graded at the consensus close in `ncaab_games_hist`. First-half and team-total lines exist from 2023-24. "
          "Overtime from CBBD period scores (`game_ot_ncaab`). Records are from the bet's side; sides show back AND fade, totals show over AND under; "
          "ROI at -110 (moneylines at the posted price). z is against the universe base rate of that market (below).",
          ""]
    md.append("Base rates in the universe (team side / over): " + ", ".join(f"{lab} {base[c]:.1%}" for c, lab, _ in MARKETS))
    md.append(f"\nUniverse size: {len(U):,} team-games; previous-margin deciles: " +
              ", ".join(f"p{int(q*100)}={U.prev_margin.quantile(q):+.0f}" for q in (0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95)))

    md.append("\n## 1. Coming off a blowout WIN — margin ladder\n")
    for thr in (15, 20, 25, 30):
        section(md, f"Won previous game by {thr}+", U[U.prev_margin >= thr], base)
    md.append("\n#### Blowout win, by days of rest before tonight (won by 20+)\n")
    for lo, hi, lab in ((1, 2, "1-2 days"), (3, 4, "3-4 days"), (5, 7, "5-7 days"), (8, 60, "8+ days")):
        section(md, f"Won by 20+, {lab} rest", U[(U.prev_margin >= 20) & U.rest.between(lo, hi)], base)
    section(md, "Won by 20+ as a favorite tonight (spread ≤ -3)", U[(U.prev_margin >= 20) & (U.spread <= -3)], base)
    section(md, "Won by 20+ as an underdog tonight (spread ≥ +3)", U[(U.prev_margin >= 20) & (U.spread >= 3)], base)
    section(md, "Won by 20+, tonight ON THE ROAD", U[(U.prev_margin >= 20) & (~U.is_home) & (~U.neutral)], base)
    section(md, "Won by 20+, tonight AT HOME", U[(U.prev_margin >= 20) & (U.is_home) & (~U.neutral)], base)
    section(md, "Won by 20+ AS AN UNDERDOG last game (prev spread ≥ +3)", U[(U.prev_margin >= 20) & (U.prev_spread >= 3)], base,
            "The upset blowout: the market had the team losing and it won by 20.")

    md.append("\n## 2. Coming off a blowout LOSS — margin ladder\n")
    for thr in (15, 20, 25, 30):
        section(md, f"Lost previous game by {thr}+", U[U.prev_margin <= -thr], base)
    md.append("\n#### Blowout loss, by days of rest before tonight (lost by 20+)\n")
    for lo, hi, lab in ((1, 2, "1-2 days"), (3, 4, "3-4 days"), (5, 7, "5-7 days"), (8, 60, "8+ days")):
        section(md, f"Lost by 20+, {lab} rest", U[(U.prev_margin <= -20) & U.rest.between(lo, hi)], base)
    section(md, "Lost by 20+ as a favorite tonight (spread ≤ -3)", U[(U.prev_margin <= -20) & (U.spread <= -3)], base)
    section(md, "Lost by 20+ as an underdog tonight (spread ≥ +3)", U[(U.prev_margin <= -20) & (U.spread >= 3)], base)
    section(md, "Lost by 20+, tonight ON THE ROAD", U[(U.prev_margin <= -20) & (~U.is_home) & (~U.neutral)], base)
    section(md, "Lost by 20+, tonight AT HOME", U[(U.prev_margin <= -20) & (U.is_home) & (~U.neutral)], base)
    section(md, "Lost by 20+ AS A FAVORITE last game (prev spread ≤ -3)", U[(U.prev_margin <= -20) & (U.prev_spread <= -3)], base,
            "The humiliation: the market had the team winning and it lost by 20.")

    md.append("\n## 3. Totals: when EITHER / BOTH teams come off a blowout\n")
    big = (U.prev_margin.abs() >= 20)
    obig = (U.opp_prev_margin.abs() >= 20)
    section(md, "Either team off a 20+ game (any direction)", U[big | obig], base)
    section(md, "Both teams off a 20+ game", U[big & obig], base)
    section(md, "Both teams off a 20+ WIN", U[(U.prev_margin >= 20) & (U.opp_prev_margin >= 20)], base)
    section(md, "Both teams off a 20+ LOSS", U[(U.prev_margin <= -20) & (U.opp_prev_margin <= -20)], base)
    section(md, "Blowout winner vs blowout loser (team won by 20+, opponent lost by 20+)", U[(U.prev_margin >= 20) & (U.opp_prev_margin <= -20)], base)

    md.append("\n## 4. Coming off OVERTIME\n")
    O = U[U.prev_went_ot == True]
    section(md, "Previous game went to overtime (any result)", O, base)
    section(md, "Won in overtime", O[O.prev_margin > 0], base)
    section(md, "Lost in overtime", O[O.prev_margin < 0], base)
    section(md, "Multiple overtimes", O[O.prev_max_period >= 4], base)
    md.append("\n#### Overtime, by days of rest before tonight\n")
    for lo, hi, lab in ((1, 2, "1-2 days"), (3, 4, "3-4 days"), (5, 7, "5-7 days"), (8, 60, "8+ days")):
        section(md, f"Off overtime, {lab} rest", O[O.rest.between(lo, hi)], base)
    section(md, "Off overtime, tonight ON THE ROAD", O[(~O.is_home) & (~O.neutral)], base)
    section(md, "Off overtime, tonight AT HOME", O[(O.is_home) & (~O.neutral)], base)
    section(md, "Off overtime as a favorite tonight (spread ≤ -3)", O[O.spread <= -3], base)
    section(md, "Off overtime as an underdog tonight (spread ≥ +3)", O[O.spread >= 3], base)
    section(md, "Off overtime, opponent rested 3+ days and did NOT play OT", O[(O.opp_rest >= 3) & (O.opp_prev_went_ot == False)], base)
    section(md, "BOTH teams off overtime", U[(U.prev_went_ot == True) & (U.opp_prev_went_ot == True)], base)
    section(md, "Either team off overtime (totals read)", U[(U.prev_went_ot == True) | (U.opp_prev_went_ot == True)], base)

    md.append("\n## 5. The long layoff after a blowout (8+ days of rest) — totals ladder\n")
    md.append("8+ day gaps are mostly the December exam break and the holiday week. Control: every regular-season game off 8+ days rest.\n")
    section(md, "Control: any game, 8+ days rest", U[U.rest >= 8], base)
    for thr in (10, 15, 20, 25, 30):
        section(md, f"Won by {thr}+, then 8+ days off", U[(U.prev_margin >= thr) & (U.rest >= 8)], base)
    for thr in (10, 15, 20, 25, 30):
        section(md, f"Lost by {thr}+, then 8+ days off", U[(U.prev_margin <= -thr) & (U.rest >= 8)], base)

    md.append("\n## 6. Overtime by exact days of rest\n")
    for d in (1, 2, 3, 4, 5):
        section(md, f"Off overtime, exactly {d} day(s) rest", O[O.rest == d], base)
        section(md, f"Control: any game, exactly {d} day(s) rest", U[U.rest == d], base)

    md.append("\n## 7. Both teams blown out last game — ladder\n")
    for thr in (10, 15, 20, 25):
        section(md, f"Both teams lost by {thr}+", U[(U.prev_margin <= -thr) & (U.opp_prev_margin <= -thr)], base)
    for thr in (10, 15, 20, 25):
        section(md, f"Both teams won by {thr}+", U[(U.prev_margin >= thr) & (U.opp_prev_margin >= thr)], base)

    md.append("\n## 8. Rest-gap control (no blowout / OT condition)\n")
    for lo, hi, lab in ((1, 2, "1-2 days"), (3, 4, "3-4 days"), (5, 7, "5-7 days"), (8, 60, "8+ days")):
        section(md, f"All regular-season games, {lab} rest", U[U.rest.between(lo, hi)], base)

    open(OUT, "w").write("\n".join(md) + "\n")
    print("wrote", OUT, "universe", len(U))

if __name__ == "__main__":
    main()
