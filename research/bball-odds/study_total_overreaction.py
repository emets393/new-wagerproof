"""
NCAAB: the game after the total went WAY over (or way under). Owner theory 2026-10-30: books and public overreact to a
huge over, shade the next total up, and the teams do not score as much. Graded at the consensus close in ncaab_games_hist,
regular-season next games, 2020-21 → 2025-26 (1H and team totals from 2023-24).

Usage: /usr/bin/python3 study_total_overreaction.py <games_hist.parquet> <game_ot_ncaab.parquet> <out.md>
"""
import sys, importlib.util, math, numpy as np, pandas as pd
HIST, OT, OUT = sys.argv[1:4]
spec = importlib.util.spec_from_file_location("st", __file__.replace("study_total_overreaction.py", "study_blowout_ot_carryover.py"))
st = importlib.util.module_from_spec(spec); sys.argv = ["x", HIST, OT, "/dev/null"]; spec.loader.exec_module(st)

P = st.build_panel()
P["ou_margin"] = P.pts + P.opp_pts - P.total
P["tt_margin"] = P.pts - P.tt
P = P.sort_values(["team_id", "date"]).reset_index(drop=True)
g = P.groupby("team_id", sort=False)
P["prev_ou_margin"] = g.ou_margin.shift(1)
P["prev_tt_margin"] = g.tt_margin.shift(1)
P["prev_total_line"] = g.total.shift(1)
P["prev_pts"] = g.pts.shift(1); P["prev_opp_pts"] = g.opp_pts.shift(1)
# the team's average closing total over its prior games this season (shade proxy), excluding the game itself
P["avg_total_prior"] = g.total.transform(lambda s: s.shift(1).expanding().mean())
P["n_prior"] = g.cumcount()
P.loc[P.prev_season != P.season, ["prev_ou_margin", "prev_tt_margin", "prev_total_line", "prev_pts", "prev_opp_pts"]] = np.nan
opp = P[["cbbd_id", "team_id", "prev_ou_margin", "prev_tt_margin", "avg_total_prior"]].rename(
    columns={"team_id": "opp_id", "prev_ou_margin": "opp_prev_ou_margin", "prev_tt_margin": "opp_prev_tt_margin", "avg_total_prior": "opp_avg_total_prior"})
P = P.merge(opp, on=["cbbd_id", "opp_id"], how="left")
U = P[(P.game_type == "STD") & P.prev_ou_margin.notna()].copy()
U["shade"] = U.total - (U.avg_total_prior + U.opp_avg_total_prior) / 2     # tonight's total vs the two teams' prior average totals

def rec(sub, col):
    s = sub[col].dropna(); return int((s == "W").sum()), int((s == "L").sum()), int((s == "P").sum())
def fmt(sub, col, side):   # side 'over' -> W is over; 'under' -> flip
    w, l, p = rec(sub, col)
    if side == "under": w, l = l, w
    n = w + l
    if n == 0: return "—"
    seas = []
    for s, gg in sub.groupby("season"):
        a, b, _ = rec(gg, col)
        if side == "under": a, b = b, a
        if a + b: seas.append(f"{str(s)[-2:]}:{a}-{b}")
    wins = sum(1 for x in seas if int(x.split(":")[1].split("-")[0]) > int(x.split("-")[1]))
    return f"{w}-{l}-{p} ({w/n:.1%}, {(w*100/110-l)/n*100:+.1f}%) [{wins}/{len(seas)}] " + " · ".join(seas)

md = ["# NCAAB: the game after the total went way over (or way under)", "",
      "Owner theory: a huge over makes the book and the public shade the next total up, and the teams do not score as much. "
      "Universe: regular-season team-games 2020-21 → 2025-26 with a same-season previous game that had a closing total "
      f"(n = {len(U):,}). Graded at the consensus close. Records from the bet's side (UNDER for the over-reaction cells, OVER for the mirror). "
      "'Shade' = tonight's closing total minus the average of the two teams' prior closing totals this season (both teams need 3+ prior games).",
      "", f"Base rates: FG under {1-(lambda w,l,p: w/(w+l))(*rec(U,'ou')):.1%} · 1H under {1-(lambda w,l,p: w/(w+l))(*rec(U,'h1_ou')):.1%} · "
      f"team total under {1-(lambda w,l,p: w/(w+l))(*rec(U,'tto')):.1%}. Over-margin deciles: " +
      ", ".join(f"p{int(q*100)}={U.prev_ou_margin.quantile(q):+.0f}" for q in (0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95)), ""]

def block(title, sub, side, note=""):
    md.append(f"\n### {title}\n"); 
    if note: md.append(note + "\n")
    sh = sub[(sub.n_prior >= 3) & sub.shade.notna()].shade
    md.append(f"n = {len(sub):,} team-games · shade of tonight's total vs the two teams' prior average: {sh.mean():+.2f} pts (n={len(sh):,})\n")
    md.append(f"| market | {side} record (bet side) | per season |"); md.append("|---|---|---|")
    for col, lab in (("ou", "FG total"), ("h1_ou", "1H total"), ("tto", "Team total (this team)")):
        r = fmt(sub, col, side); md.append(f"| {lab} | {r.split(' [')[0]} | {r.split('[',1)[1] if '[' in r else ''} |")

md.append("\n## 1. ONE team's last game went over by X+ → bet UNDER tonight\n")
for t in (10, 15, 20, 25, 30):
    block(f"This team's previous game went over the total by {t}+", U[U.prev_ou_margin >= t], "under")
md.append("\n## 2. BOTH teams' last games went over by X+ → UNDER\n")
for t in (10, 15, 20, 25):
    block(f"Both teams' previous games went over by {t}+", U[(U.prev_ou_margin >= t) & (U.opp_prev_ou_margin >= t)], "under")
md.append("\n## 3. EITHER team's last game went over by X+ → UNDER (game-level read)\n")
for t in (15, 20, 25, 30):
    block(f"Either team's previous game went over by {t}+", U[(U.prev_ou_margin >= t) | (U.opp_prev_ou_margin >= t)], "under")
md.append("\n## 4. Who did the scoring: the team itself vs what it allowed (prev game over by 20+)\n")
B = U[U.prev_ou_margin >= 20]
block("Over by 20+ AND this team beat its own team total by 10+ (it did the scoring)", B[B.prev_tt_margin >= 10], "under")
block("Over by 20+ AND this team was UNDER its own team total (the opponent did the scoring)", B[B.prev_tt_margin < 0], "under")
block("Over by 20+, one team only (the opponent's last game did NOT go over by 10+)", B[B.opp_prev_ou_margin < 10], "under")
md.append("\n## 5. Over by 20+, by rest and venue\n")
for lo, hi, lab in ((1, 2, "1-2 days"), (3, 4, "3-4 days"), (5, 7, "5-7 days"), (8, 60, "8+ days")):
    block(f"Over by 20+, {lab} rest", B[B.rest.between(lo, hi)], "under")
block("Over by 20+, tonight at home", B[B.is_home & ~B.neutral], "under")
block("Over by 20+, tonight on the road", B[~B.is_home & ~B.neutral], "under")
block("Over by 20+, tonight's total is HIGHER than the two teams' prior average by 3+ (the shade happened)", B[(B.n_prior >= 3) & (B.shade >= 3)], "under")
block("Over by 20+, tonight's total is NOT shaded (within ±3 of prior average)", B[(B.n_prior >= 3) & B.shade.between(-3, 3)], "under")
block("Over by 20+, tonight's total is LOWER than prior average by 3+", B[(B.n_prior >= 3) & (B.shade <= -3)], "under")
md.append("\n## 6. Mirror: last game went UNDER by X+ → bet OVER tonight\n")
for t in (10, 15, 20, 25, 30):
    block(f"This team's previous game went under by {t}+", U[U.prev_ou_margin <= -t], "over")
for t in (15, 20):
    block(f"Both teams' previous games went under by {t}+", U[(U.prev_ou_margin <= -t) & (U.opp_prev_ou_margin <= -t)], "over")
md.append("\n## 7. Control: the shade on an ordinary game\n")
block("All games (both teams 3+ prior games)", U[U.n_prior >= 3], "under")
open(OUT, "w").write("\n".join(md) + "\n"); print("wrote", OUT, len(U))
