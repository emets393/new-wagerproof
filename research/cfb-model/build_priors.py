"""
Leak-safe PRESEASON priors per (season, team): returning production, recruiting, prior-year SP+/FPI.
All known before week 1 -> safe for every game, especially valuable early season.
Pull + build -> data/priors.parquet
"""
import os
import pandas as pd
import cfbd

HERE = os.path.dirname(os.path.abspath(__file__))
YEARS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]


def main():
    # returning production (preseason, current year)
    ret = []
    for y in YEARS:
        for r in cfbd.get("/player/returning", year=y):
            ret.append({"season": y, "team": r["team"], "ret_ppa": r.get("percentPPA"),
                        "ret_pass": r.get("percentPassingPPA"), "ret_rush": r.get("percentRushingPPA"),
                        "ret_usage": r.get("usage")})
    ret = pd.DataFrame(ret)

    # recruiting points (preseason). also 3yr rolling avg = roster talent
    rec = []
    for y in range(2013, 2026):
        for r in cfbd.get("/recruiting/teams", year=y):
            rec.append({"season": y, "team": r["team"], "recruit_pts": r.get("points"), "recruit_rank": r.get("rank")})
    rec = pd.DataFrame(rec)
    rec = rec.sort_values(["team", "season"])
    rec["recruit_3yr"] = rec.groupby("team")["recruit_pts"].transform(lambda s: s.rolling(3, min_periods=1).mean())

    # SP+ and FPI -> use PRIOR year as a preseason prior (current-year is final = leak)
    sp = []
    for y in range(2015, 2026):
        try:
            for r in cfbd.get("/ratings/sp", year=y):
                o = r.get("offense") or {}; d = r.get("defense") or {}
                sp.append({"season": y, "team": r["team"], "sp_rating": r.get("rating"),
                           "sp_off": o.get("rating"), "sp_def": d.get("rating")})
        except Exception:
            pass
    sp = pd.DataFrame(sp)
    sp["prior_season"] = sp["season"] + 1  # year Y uses year (Y-1) SP+
    sp_prior = sp.drop(columns="season").rename(columns={"prior_season": "season",
              "sp_rating": "prior_sp", "sp_off": "prior_sp_off", "sp_def": "prior_sp_def"})

    fpi = []
    for y in range(2015, 2026):
        try:
            for r in cfbd.get("/ratings/fpi", year=y):
                fpi.append({"season": y, "team": r["team"], "fpi": r.get("fpi")})
        except Exception:
            pass
    fpi = pd.DataFrame(fpi)
    fpi["season"] = fpi["season"] + 1
    fpi = fpi.rename(columns={"fpi": "prior_fpi"})

    pri = (ret.merge(rec[["season", "team", "recruit_pts", "recruit_rank", "recruit_3yr"]], on=["season", "team"], how="outer")
           .merge(sp_prior, on=["season", "team"], how="left")
           .merge(fpi, on=["season", "team"], how="left"))
    pri = pri[pri.season.isin(YEARS)]
    out = os.path.join(HERE, "data", "priors.parquet")
    pri.to_parquet(out, index=False)
    print(f"priors: {len(pri)} rows -> {out}")
    print(pri[["ret_ppa", "recruit_pts", "recruit_3yr", "prior_sp", "prior_fpi"]].describe().round(2).to_string())
    print("non-null prior_sp:", pri.prior_sp.notna().sum(), "/ ret_ppa:", pri.ret_ppa.notna().sum())


if __name__ == "__main__":
    main()
