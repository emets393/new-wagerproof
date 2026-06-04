"""
Garbage-time-EXCLUDED season-to-date advanced stats (excludeGarbageTime works on /stats/season/advanced).
Per (year, endWeek=W) = GT-excluded stats through week W (leak-safe for week W+1).
Sharper, more predictive ratings (Connelly methodology). -> data/gt_excluded_asof.parquet
"""
import os
import pandas as pd
import cfbd

HERE = os.path.dirname(os.path.abspath(__file__))
YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]
WEEKS = range(1, 16)


def g(d, *p, default=None):
    for k in p:
        d = d.get(k) if isinstance(d, dict) else None
        if d is None:
            return default
    return d


def main():
    out = os.path.join(HERE, "data", "gt_excluded_asof.parquet")
    if os.path.exists(out):
        print("cached"); return
    rows = []
    for y in YEARS:
        for w in WEEKS:
            try:
                res = cfbd.get("/stats/season/advanced", year=y, startWeek=1, endWeek=w, excludeGarbageTime="true")
            except Exception:
                continue
            for r in res:
                o, d = r.get("offense", {}), r.get("defense", {})
                rows.append({
                    "season": y, "asof_week": w, "team": r.get("team"),
                    "gt_off_ppa": o.get("ppa"), "gt_off_succ": o.get("successRate"), "gt_off_expl": o.get("explosiveness"),
                    "gt_off_pass_ppa": g(o, "passingPlays", "ppa"), "gt_off_rush_ppa": g(o, "rushingPlays", "ppa"),
                    "gt_def_ppa": d.get("ppa"), "gt_def_succ": d.get("successRate"), "gt_def_expl": d.get("explosiveness"),
                    "gt_def_pass_ppa": g(d, "passingPlays", "ppa"), "gt_def_rush_ppa": g(d, "rushingPlays", "ppa"),
                })
        print(f"  {y}: {len(rows)} rows")
    pd.DataFrame(rows).to_parquet(out, index=False)
    print(f"gt_excluded_asof -> {out} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
