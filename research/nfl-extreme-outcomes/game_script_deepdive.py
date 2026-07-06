"""Game-script DEEP DIVE — exhaustive combination sweep (2024-25).

Every lean feature (pass att/comp/yds, rush att/yds, WR1 rec yds, + efficiency-mismatch
and pass/run-ratio features) x 4 buckets (up / down / strong-up / strong-down) x every
target (team total, game total, spread cover, moneyline, WR1/RB1/QB prop overs, each
side). Each combo graded 2024 vs 2025 separately; NOTHING discarded — full table to
game_script_deepdive_results.csv, candidates tiered + printed. Read-only.
"""
import numpy as np
import pandas as pd
from pathlib import Path
from stats_helpers import wilson_ci
from game_script_scan import lines, team_primary, NORM

DATA = Path(__file__).resolve().parent / "data"


def outcomes():
    h = pd.read_parquet(DATA / "h1tt_frame.parquet")
    h["home_ab"] = h.home_ab.replace(NORM); h["away_ab"] = h.away_ab.replace(NORM)
    rows = []
    for _, r in h.iterrows():
        tot = r.final_home + r.final_away
        for home in (True, False):
            tp = r.final_home if home else r.final_away
            op = r.final_away if home else r.final_home
            tsp = r.spread_close_spread_home if home else -r.spread_close_spread_home
            rows.append(dict(season=int(r.season), week=int(r.week),
                team=r.home_ab if home else r.away_ab,
                team_pts=tp, opp_pts=op, team_margin=tp - op, team_spread=tsp,
                tt_line=r.tt_home_close_tt_home_point if home else r.tt_away_close_tt_away_point,
                total_line=r.total_close_total_point, actual_total=tot))
    return pd.DataFrame(rows)


def pct(row_lean, row_line):
    prior = row_line - row_lean
    return np.where((prior != 0) & prior.notna(), row_lean / prior, np.nan)


def build():
    d = lines()
    tg = outcomes()
    for mkt, c in [("player_pass_attempts", "pa"), ("player_pass_completions", "pc"),
                   ("player_pass_yds", "py"), ("player_rush_attempts", "ra"),
                   ("player_rush_yds", "ry"), ("player_reception_yds", "wy")]:
        p = team_primary(d, mkt, c)
        tg = tg.merge(p, on=["season", "week", "team"], how="left")
        tg[f"{c}_pct"] = pct(tg[f"{c}_lean"], tg[f"{c}_line"])
    # efficiency-mismatch + ratio features
    tg["qb_att_vs_yds"] = tg.pa_pct - tg.py_pct      # attempts leaning up more than yards -> low ypa
    tg["rb_att_vs_yds"] = tg.ra_pct - tg.ry_pct      # carries up more than yards -> grind
    tg["qb_comp_vs_att"] = tg.pc_pct - tg.pa_pct     # completion vs attempt lean
    tg["passrun_ratio"] = tg.pa_pct - tg.ra_pct      # game leaning pass vs run
    return tg


FEATURES = ["pa_pct", "pc_pct", "py_pct", "ra_pct", "ry_pct", "wy_pct",
            "qb_att_vs_yds", "rb_att_vs_yds", "qb_comp_vs_att", "passrun_ratio"]
FEAT_LABEL = {"pa_pct": "QB pass-att lean", "pc_pct": "QB pass-comp lean", "py_pct": "QB pass-yds lean",
              "ra_pct": "RB rush-att lean", "ry_pct": "RB rush-yds lean", "wy_pct": "WR1 rec-yds lean",
              "qb_att_vs_yds": "QB att>yds mismatch", "rb_att_vs_yds": "RB att>yds mismatch",
              "qb_comp_vs_att": "QB comp>att mismatch", "passrun_ratio": "pass>run ratio lean"}


def targets(tg):
    def ok(s):  # valid (non-null, non-push handled by strict > / <)
        return s
    T = {}
    T["team_total_OVER"] = (tg.team_pts > tg.tt_line, tg.tt_line.notna())
    T["team_total_UNDER"] = (tg.team_pts < tg.tt_line, tg.tt_line.notna())
    T["game_total_OVER"] = (tg.actual_total > tg.total_line, tg.total_line.notna())
    T["game_total_UNDER"] = (tg.actual_total < tg.total_line, tg.total_line.notna())
    T["spread_COVER"] = (tg.team_margin + tg.team_spread > 0,
                         tg.team_spread.notna() & (tg.team_margin + tg.team_spread != 0))
    T["moneyline_WIN"] = (tg.team_margin > 0, tg.team_margin != 0)
    T["WR1_recyds_OVER"] = (tg.wy_act > tg.wy_line, tg.wy_act.notna() & (tg.wy_act != tg.wy_line))
    T["RB1_rushyds_OVER"] = (tg.ry_act > tg.ry_line, tg.ry_act.notna() & (tg.ry_act != tg.ry_line))
    T["QB_passyds_OVER"] = (tg.py_act > tg.py_line, tg.py_act.notna() & (tg.py_act != tg.py_line))
    return T


def main():
    tg = build()
    T = targets(tg)
    bases = {name: (hit[valid].mean() * 100) for name, (hit, valid) in T.items()}
    print(f"team-game rows: {len(tg)}")
    print("base rates:", {k: round(v) for k, v in bases.items()}, "\n")

    rows = []
    for f in FEATURES:
        col = tg[f]
        q25, q75 = col.quantile(0.25), col.quantile(0.75)
        buckets = {"up": col > 0, "down": col < 0, "strong_up": col >= q75, "strong_down": col <= q25}
        for bname, bmask in buckets.items():
            for tname, (hit, valid) in T.items():
                m = bmask & valid & col.notna()
                sub = pd.DataFrame({"hit": hit[m], "season": tg.season[m]})
                n = len(sub)
                if n < 8:
                    continue
                k = int(sub.hit.sum()); hp = k / n * 100
                lo, hi = wilson_ci(k, n)
                y24 = sub[sub.season == 2024].hit
                y25 = sub[sub.season == 2025].hit
                h24 = y24.mean() * 100 if len(y24) else np.nan
                h25 = y25.mean() * 100 if len(y25) else np.nan
                base = bases[tname]
                both = (h24 > base) and (h25 > base) if (len(y24) and len(y25)) else False
                edge = hp - base
                rows.append(dict(feature=FEAT_LABEL[f], bucket=bname, target=tname,
                    n=n, hit=round(hp, 1), base=round(base, 1), edge=round(edge, 1),
                    y2024=round(h24, 1) if not np.isnan(h24) else None,
                    y2025=round(h25, 1) if not np.isnan(h25) else None,
                    ci_lo=round(lo * 100), ci_hi=round(hi * 100),
                    both_beat_base=both, n24=len(y24), n25=len(y25)))
    res = pd.DataFrame(rows)
    res.to_csv(DATA.parent / "game_script_deepdive_results.csv", index=False)
    print(f"combos tested: {len(res)}  (expect ~a few % to look good by chance — see caveat)\n")

    # TIER: both seasons beat base + margin + sample
    res["tier"] = np.where(res.both_beat_base & (res.edge >= 4) & (res.n >= 40) &
                           (res[["y2024", "y2025"]].min(axis=1) - res.base >= 2), "HIGH",
                   np.where(res.both_beat_base & (res.edge >= 3), "LEAD", "noise"))
    for tier in ("HIGH", "LEAD"):
        t = res[res.tier == tier].sort_values("edge", ascending=False)
        print(f"===== {tier} ({len(t)}) =====")
        if not len(t):
            print("  (none)\n"); continue
        for _, r in t.head(20).iterrows():
            print(f"  {r.feature:20s} {r.bucket:11s} -> {r.target:17s} "
                  f"n={r.n:4d} hit={r.hit:5.1f}% (base {r.base:4.1f}, edge {r.edge:+4.1f}) "
                  f"[24:{r.y2024} 25:{r.y2025}] CI[{r.ci_lo},{r.ci_hi}]")
        print()
    print(f"full table -> game_script_deepdive_results.csv ({len(res)} rows, nothing dropped)")


if __name__ == "__main__":
    main()
