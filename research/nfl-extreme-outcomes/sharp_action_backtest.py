"""SHARP ACTION indicator — PRE-REGISTERED backtest, NFL + CFB, 2021-2025, FG spread + total.

Components scored at each snapshot from the multi-book archive:
  LEAD  : sharp-book median vs all-book median (NFL sharp = betonlineag/lowvig;
          CFB sharp = williamhill_us/twinspires per LOCKED 2b). |gap| >= 0.5 -> side.
  STEAM : consensus moved >= 0.5 vs prior snapshot AND >= 3 books moved same way.
  TIMING: hours-to-kick at detection (late <= 6h / mid 6-24h / early > 24h).
  PUBLIC: move toward the DOG (spread) / UNDER (total) = against known public bias.
DETECTION = first snapshot where LEAD and STEAM point the same side (2 components).
Grade the sharp side AT THE DETECTION LINE (bet-at-detection law); CLV = did the close
move toward the sharp side from the detection line. Controls: games with no detection.
Confirm test (CFB totals): production core formula |edge|>=4 vs close -> sharp agrees /
disagrees / none. Per-season splits everywhere. Baseline for each cell = that market's
blind home/over rate in the same sport-season pool.
"""
import numpy as np, pandas as pd, sys

NFL_SHARP = {"betonlineag", "lowvig"}
CFB_SHARP = {"williamhill_us", "twinspires"}

def series(df, sharp_books, mkt):
    """per (game, snapshot): all-median, sharp-median, n books moved up/down vs prior."""
    col = "spread" if mkt == "spread" else "total"
    d = df.dropna(subset=[col]).copy()
    d = d.sort_values(["gk", "snap"])
    d["prev"] = d.groupby(["gk", "book"])[col].shift(1)
    d["dup"] = (d[col] - d.prev)
    g = d.groupby(["gk", "snap"])
    out = g.agg(all_med=(col, "median"), n_books=(col, "size"),
                n_up=("dup", lambda s: (s >= 0.5).sum()), n_dn=("dup", lambda s: (s <= -0.5).sum()),
                comm=("comm", "first")).reset_index()
    sh = d[d.book.isin(sharp_books)].groupby(["gk", "snap"])[col].median().rename("sharp_med").reset_index()
    out = out.merge(sh, on=["gk", "snap"], how="left")
    out = out.sort_values(["gk", "snap"])
    out["prev_med"] = out.groupby("gk").all_med.shift(1)
    out["hrs"] = (out.comm - out.snap).dt.total_seconds() / 3600
    return out

def detect(s, mkt):
    """first snapshot per game where LEAD and STEAM agree. Returns one row per detected game."""
    s = s.copy()
    gap = s.sharp_med - s.all_med
    mv = s.all_med - s.prev_med
    if mkt == "spread":   # spread_home: lower = toward HOME
        lead_side = np.where(gap <= -0.5, "HOME", np.where(gap >= 0.5, "AWAY", None))
        steam_side = np.where((mv <= -0.5) & (s.n_dn >= 3), "HOME", np.where((mv >= 0.5) & (s.n_up >= 3), "AWAY", None))
    else:
        lead_side = np.where(gap >= 0.5, "OVER", np.where(gap <= -0.5, "UNDER", None))
        steam_side = np.where((mv >= 0.5) & (s.n_up >= 3), "OVER", np.where((mv <= -0.5) & (s.n_dn >= 3), "UNDER", None))
    s["side"] = np.where((lead_side == steam_side) & pd.notna(lead_side), lead_side, None)
    s["lead_only"] = np.where(pd.notna(lead_side) & pd.isna(steam_side), lead_side, None)
    s["steam_only"] = np.where(pd.notna(steam_side) & pd.isna(lead_side), steam_side, None)
    det = s[s.side.notna()].groupby("gk").first().reset_index()
    det = det.rename(columns={"all_med": "det_line", "hrs": "det_hrs"})
    close = s.groupby("gk").last()[["all_med"]].rename(columns={"all_med": "close_line"}).reset_index()
    return det.merge(close, on="gk"), s

def grade(det, res, mkt):
    d = det.merge(res, on="gk", how="inner")
    if mkt == "spread":
        cm = d.margin + d.det_line
        d["win"] = np.where(d.side == "HOME", cm > 0, cm < 0)
        d["push"] = cm == 0
        d["clv"] = np.where(d.side == "HOME", d.close_line < d.det_line, d.close_line > d.det_line)
        d["flat"] = d.close_line == d.det_line
        # public proxy: toward dog = |spread| shrinking at detection vs prev
        d["toward_dog"] = np.where(d.side == "HOME", d.det_line > 0, d.det_line < 0)  # backing the dog side
    else:
        d["win"] = np.where(d.side == "OVER", d.actual_total > d.det_line, d.actual_total < d.det_line)
        d["push"] = d.actual_total == d.det_line
        d["clv"] = np.where(d.side == "OVER", d.close_line > d.det_line, d.close_line < d.det_line)
        d["flat"] = d.close_line == d.det_line
        d["toward_dog"] = d.side == "UNDER"
    d["timing"] = pd.cut(d.det_hrs, [-1, 6, 24, 1e9], labels=["late<=6h", "mid 6-24h", "early>24h"])
    return d[~d.push]

def cell(name, d, seasons):
    if len(d) < 20:
        print(f"    {name:40s} n={len(d)} (<20)"); return
    per = " ".join(f"{y}:{d[d.season == y].win.mean()*100:.0f}%({(d.season == y).sum()})" for y in seasons if (d.season == y).sum())
    roi = np.mean(np.where(d.win, 100/110, -1.0)) * 100
    nf = d[~d.flat]
    print(f"    {name:40s} n={len(d):4d} hit={d.win.mean()*100:5.1f}% ROI={roi:+5.1f}% CLV+={nf.clv.mean()*100:4.0f}% [{per}]")

def run(sport, df, res, sharp_books, seasons):
    print(f"\n{'='*18} {sport} {'='*18}")
    for mkt in ("spread", "total"):
        s = series(df, sharp_books, mkt)
        det, full = detect(s, mkt)
        d = grade(det, res, mkt)
        d["season"] = d.gk.str.split("|").str[0].astype(int)
        base_key = "HOME" if mkt == "spread" else "OVER"
        allg = s.groupby("gk").last().reset_index().merge(res, on="gk")
        if mkt == "spread":
            base = ((allg.margin + allg.all_med) > 0).mean()
        else:
            base = (allg.actual_total > allg.all_med).mean()
        print(f"\n  -- {mkt.upper()} --  games={allg.gk.nunique()}  detected={len(d)} ({len(d)/max(allg.gk.nunique(),1)*100:.0f}%)  blind {base_key}@close={base*100:.1f}%")
        cell("SHARP SIDE @ detection (all)", d, seasons)
        for t in ("late<=6h", "mid 6-24h", "early>24h"):
            cell(f"  timing {t}", d[d.timing == t], seasons)
        cell("  toward dog/under (public-fade)", d[d.toward_dog], seasons)
        cell("  toward fav/over (with public)", d[~d.toward_dog], seasons)
        # single-component controls
        for comp in ("lead_only", "steam_only"):
            c = full[full[comp].notna()].groupby("gk").first().reset_index().rename(columns={"all_med": "det_line", "hrs": "det_hrs"})
            c["side"] = c[comp]
            c = c.merge(s.groupby("gk").last()[["all_med"]].rename(columns={"all_med": "close_line"}).reset_index(), on="gk")
            gc = grade(c, res, mkt); gc["season"] = gc.gk.str.split("|").str[0].astype(int)
            cell(f"  control: {comp}", gc, seasons)
        d.to_parquet(f"data/sharp_det_{sport}_{mkt}.parquet", index=False)

def main():
    # ---------- NFL ----------
    oh = pd.read_parquet("data/odds_hist.parquet")
    oh = oh[oh.season.between(2021, 2025)].copy()
    oh["snap"] = pd.to_datetime(oh.snap_ts, utc=True, errors="coerce")
    oh["comm"] = pd.to_datetime(oh.commence_time, utc=True, errors="coerce")
    oh = oh[oh.snap < oh.comm]
    oh["gk"] = oh.season.astype(str) + "|" + oh.home_team + "|" + oh.away_team + "|" + oh.comm.dt.strftime("%Y%m%d")
    oh = oh.rename(columns={"spread_home": "spread", "total_point": "total"})
    CITY = {"Arizona":"ARI","Atlanta":"ATL","Baltimore":"BAL","Buffalo":"BUF","Carolina":"CAR","Chicago":"CHI","Cincinnati":"CIN","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN","Detroit":"DET","Green Bay":"GB","Houston":"HOU","Indianapolis":"IND","Jacksonville":"JAX","Kansas City":"KC","LA Rams":"LA","LA Chargers":"LAC","Las Vegas":"LV","Miami":"MIA","Minnesota":"MIN","New England":"NE","New Orleans":"NO","NY Giants":"NYG","NY Jets":"NYJ","Philadelphia":"PHI","Pittsburgh":"PIT","Seattle":"SEA","San Francisco":"SF","Tampa Bay":"TB","Tennessee":"TEN","Washington":"WAS"}
    ab2c = {v: k for k, v in CITY.items()}
    ge = pd.read_parquet("data/games_enriched.parquet")
    ge = ge[ge.season.between(2021, 2025)].dropna(subset=["home_score", "away_score"]).copy()
    rows = []
    for _, r in ge.iterrows():
        for dd in (0, 1):
            day = (pd.to_datetime(r.gameday) + pd.Timedelta(days=dd)).strftime("%Y%m%d")
            rows.append({"gk": f"{r.season}|{ab2c.get(r.home_team)}|{ab2c.get(r.away_team)}|{day}",
                         "margin": r.home_score - r.away_score, "actual_total": r.home_score + r.away_score})
    res = pd.DataFrame(rows).drop_duplicates("gk")
    run("NFL", oh[["gk", "snap", "comm", "book", "spread", "total"]], res, NFL_SHARP, range(2021, 2026))

    # ---------- CFB ----------
    import glob
    frames = []
    for f in sorted(glob.glob("../cfb-model/data/odds_history/odds_202[1-5].parquet")):
        x = pd.read_parquet(f)
        x["season"] = int(f[-12:-8])
        frames.append(x[["season", "snapshot", "commence_time", "game_id", "book", "spread_home", "total"]])
    ch = pd.concat(frames, ignore_index=True)
    ch["snap"] = pd.to_datetime(ch.snapshot, utc=True, errors="coerce")
    ch["comm"] = pd.to_datetime(ch.commence_time, utc=True, errors="coerce")
    ch = ch[ch.snap < ch.comm]
    ch["gk"] = ch.season.astype(str) + "|" + ch.game_id.astype(str)
    ch = ch.rename(columns={"spread_home": "spread"})
    mw = pd.read_parquet("../cfb-model/data/movement_windows.parquet")
    mw = mw.drop_duplicates(["season", "home", "away"], keep=False)[["season", "game_id", "actual_margin", "actual_total"]].dropna()
    mw["gk"] = mw.season.astype(str) + "|" + mw.game_id.astype(str)
    cres = mw.rename(columns={"actual_margin": "margin"})[["gk", "margin", "actual_total"]]
    run("CFB", ch[["gk", "snap", "comm", "book", "spread", "total"]], cres, CFB_SHARP, range(2021, 2026))

if __name__ == "__main__":
    main()
