"""Defense matchup + injury context vs prop results.

Close-line signals graded vs close. Per-season throughout.
"""
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 200)
OU = ["player_pass_yds", "player_pass_tds", "player_receptions",
      "player_reception_yds", "player_rush_yds"]


def payout(o):
    o = pd.to_numeric(o, errors="coerce")
    return np.where(o > 0, o / 100, 100 / -o)


def roi(g, side):
    odds = g.close_over if side == "over" else g.close_under
    pnl = np.where(g.result_close.eq(side), payout(odds),
                   np.where(g.result_close.eq("push"), 0, -1.0))
    pnl = pnl[~np.isnan(pnl)]
    return (pnl.mean() * 100 if len(pnl) else np.nan), len(pnl)


def table(df, by, label, min_n=40):
    rows = []
    for keys, g in df.groupby(by, observed=True):
        if len(g) < min_n:
            continue
        ro, n = roi(g, "over")
        ru, _ = roi(g, "under")
        rows.append((*np.atleast_1d(keys), n, f"{g.result_close.eq('over').mean():.1%}",
                     f"{ro:+.1f}%", f"{ru:+.1f}%"))
    cols = (by if isinstance(by, list) else [by]) + ["n", "over%", "ROI_over", "ROI_under"]
    print(f"\n== {label} ==")
    print(pd.DataFrame(rows, columns=cols).to_string(index=False))


def main():
    f = pd.read_parquet(ROOT / "data" / "props_frame.parquet")
    ou = f[f.market.isin(OU) & f.played & f.close_line.notna() & (f.week >= 5)].copy()

    # ---------- 1. defense matchup index vs result
    print("=" * 80)
    print("1. DEF MATCHUP (def_allowed to position / league avg), week>=5")
    ou["def_b"] = pd.cut(ou.def_matchup_idx, [0, .8, .92, 1.08, 1.25, 9],
                         labels=["very tough", "tough", "neutral", "soft", "very soft"])
    table(ou, ["def_b", "season"], "all OU x defense bucket")
    for mkt in ["player_reception_yds", "player_rush_yds", "player_pass_yds"]:
        table(ou[ou.market == mkt], ["def_b", "season"], f"{mkt} x defense bucket", 30)

    # interaction: line ignores matchup? line below form AND soft defense -> over?
    d = ou[(ou.gp_prior >= 4) & (ou.l5_avg > 0)].copy()
    d["dev"] = (d.close_line - d.l5_avg) / d.l5_avg
    combo = d[(d.def_matchup_idx > 1.15) & (d.dev < -0.05)]
    table(combo, ["market", "season"], "SOFT defense + line BELOW form (mispriced matchup?)", 25)
    combo2 = d[(d.def_matchup_idx < 0.85) & (d.dev > 0.05)]
    table(combo2, ["market", "season"], "TOUGH defense + line ABOVE form", 25)

    # ---------- 2. own injury status
    print("\n" + "=" * 80)
    print("2. OWN INJURY STATUS (player on report and PLAYED)")
    f2 = f[f.market.isin(OU) & f.played & f.close_line.notna()].copy()
    f2["status"] = f2.report_status.fillna("none")
    table(f2[f2.status.ne("none")], ["status", "season"], "played-through injury x status", 30)
    q = f2[f2.status.eq("Questionable")]
    table(q, ["market", "season"], "Questionable + played, by market", 30)
    # DNP base rates by status (how often does Questionable actually sit?)
    f3 = f[f.market.isin(OU)].drop_duplicates(["season", "week", "player_id"])
    f3["status"] = f3.report_status.fillna("none")
    print("\nP(did not play) by report status:")
    print(f3.groupby("status").played.agg(n="size", played_rate="mean").round(3).to_string())

    # ---------- 3. teammates out
    print("\n" + "=" * 80)
    print("3. TEAM SKILL PLAYERS RULED OUT (same team, QB/RB/WR/TE)")
    f2["out_b"] = pd.cut(f2.team_skill_out, [-1, 0, 1, 2, 99], labels=["0", "1", "2", "3+"])
    table(f2, ["out_b", "season"], "all OU x #teammates out")
    table(f2[f2.market == "player_receptions"], ["out_b", "season"], "receptions x #teammates out", 30)
    table(f2[f2.market == "player_rush_yds"], ["out_b", "season"], "rush yds x #teammates out", 30)

    # ATD when 2+ skill teammates out (more red-zone work concentrated)
    atd = f[(f.market == "player_anytime_td") & f.played & f.close_yes_prob.notna()].copy()
    atd["out_b"] = pd.cut(atd.team_skill_out, [-1, 0, 1, 99], labels=["0", "1", "2+"])
    rows = []
    for (b, s), g in atd.groupby(["out_b", "season"], observed=True):
        if len(g) < 100:
            continue
        pnl = np.where(g.result_close.eq("yes"), payout(g.close_over), -1.0)
        rows.append((b, s, len(g), f"{g.close_yes_prob.mean():.3f}",
                     f"{g.result_close.eq('yes').mean():.3f}", f"{pnl.mean()*100:+.1f}%"))
    print("\n== ATD x #teammates out (implied vs actual, ROI blind-yes) ==")
    print(pd.DataFrame(rows, columns=["out_b", "season", "n", "implied", "actual", "ROI_yes"]).to_string(index=False))


if __name__ == "__main__":
    main()
