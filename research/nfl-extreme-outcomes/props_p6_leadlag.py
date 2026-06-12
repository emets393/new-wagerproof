"""Book-vs-book dynamics from full snapshot history.

1. LEAD-LAG: which book moves first, and do others follow?
2. STALE-BOOK CHASE: others' median line has moved >=thr since open, book b
   hasn't moved yet -> bet the move direction at b's stale line, graded at the
   line/odds available AT THE TRIGGER SNAPSHOT (honest, no lookahead).
3. MOVEMENT DISAGREEMENT: books that moved opposite directions open->close.
"""
import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent
pd.set_option("display.width", 220)
OU = ["player_pass_yds", "player_pass_tds", "player_receptions",
      "player_reception_yds", "player_rush_yds"]
BOOKS = ["draftkings", "fanduel", "betmgm", "williamhill_us"]
THR = {"player_pass_yds": 3, "player_reception_yds": 2.5, "player_rush_yds": 2.5,
       "player_receptions": 0.5, "player_pass_tds": 0.5}


def payout(o):
    o = pd.to_numeric(o, errors="coerce")
    return np.where(o > 0, o / 100, 100 / -o)


def main():
    pr = pd.read_parquet(ROOT / "data" / "props_rows.parquet")
    pr = pr[pr.market.isin(OU) & pr.line.notna()].copy()
    pr["snapshot_time"] = pd.to_datetime(pr.snapshot_time, utc=True, format="mixed")
    pr["key"] = pr.event_id + "|" + pr.player_id + "|" + pr.market

    # actuals from the frame (played props only)
    fr = pd.read_parquet(ROOT / "data" / "props_frame.parquet")
    fr = fr[fr.market.isin(OU) & fr.played]
    act = (fr.assign(key=fr.event_id + "|" + fr.player_id + "|" + fr.market)
           [["key", "season", "week", "actual"]].drop_duplicates("key").set_index("key"))

    # wide panels: (key, snapshot) x book
    line_w = pr.pivot_table(index=["key", "snapshot_time"], columns="bookmaker",
                            values="line", aggfunc="first")
    over_w = pr.pivot_table(index=["key", "snapshot_time"], columns="bookmaker",
                            values="over_odds", aggfunc="first")
    under_w = pr.pivot_table(index=["key", "snapshot_time"], columns="bookmaker",
                             values="under_odds", aggfunc="first")
    for b in BOOKS:
        for w in (line_w, over_w, under_w):
            if b not in w.columns:
                w[b] = np.nan
    g = line_w.groupby(level=0)
    line_f = g.ffill()          # latest known line per book at each snapshot
    over_f = over_w.groupby(level=0).ffill()
    under_f = under_w.groupby(level=0).ffill()
    opens = g.transform("first")  # each book's opener

    keys = line_f.index.get_level_values(0)
    mkt = pd.Series(keys, index=line_f.index).str.split("|").str[-1]
    thr = mkt.map(THR)

    # ---------- 1. lead-lag: who moves first
    print("=" * 80)
    print("1. WHO MOVES FIRST (first book to leave its opener, props where >=2 books moved)")
    moved = (line_f != opens) & line_f.notna()
    first_move_t = {}
    for b in BOOKS:
        s = line_f.index.to_frame(index=False)
        s["moved"] = moved[b].values
        fm = s[s.moved].groupby("key").snapshot_time.min()
        first_move_t[b] = fm
    fm = pd.DataFrame(first_move_t)
    fm = fm[fm.notna().sum(axis=1) >= 2]
    leader = fm.idxmin(axis=1)
    print(f"props where >=2 books moved off open: {len(fm):,}")
    print(leader.value_counts(normalize=True).round(3).to_string())
    # does the leader's direction predict the others?
    print("\n(direction agreement: when leader moved, did the other books' eventual")
    print(" open->close move match the leader's first-move direction?)")
    rows = []
    closes = g.transform("last")
    for b in BOOKS:
        sel = leader == b
        ks = leader[sel].index
        sub_open = opens.loc[(ks, slice(None)), :].groupby(level=0).first()
        sub_close = closes.loc[(ks, slice(None)), :].groupby(level=0).first()
        # leader's own total move direction as proxy for its first move
        ldir = np.sign(sub_close[b] - sub_open[b])
        others = [x for x in BOOKS if x != b]
        omove = np.sign((sub_close[others].median(axis=1) - sub_open[others].median(axis=1)))
        ok = (ldir != 0) & (omove != 0)
        rows.append((b, sel.sum(), f"{(ldir[ok]==omove[ok]).mean():.1%}"))
    print(pd.DataFrame(rows, columns=["leader", "n_led", "others followed same dir"]).to_string(index=False))

    # ---------- 2. stale-book chase
    print("\n" + "=" * 80)
    print("2. STALE-BOOK CHASE: others' median moved >=thr off open, book b still at open")
    print("   -> bet move direction at b's stale line (trigger-time odds), first trigger only")
    results = []
    for b in BOOKS:
        others = [x for x in BOOKS if x != b]
        med_now = line_f[others].median(axis=1)
        med_open = opens[others].median(axis=1)
        omove = med_now - med_open
        stale = (line_f[b] == opens[b]) & line_f[b].notna()
        for direction in ("up", "down"):
            trig = stale & (omove >= thr if direction == "up" else omove <= -thr)
            t = trig[trig]
            if not len(t):
                continue
            tf = t.index.to_frame(index=False).groupby("key").snapshot_time.min().reset_index()
            tf = tf.join(act, on="key").dropna(subset=["actual"])
            midx = pd.MultiIndex.from_frame(tf[["key", "snapshot_time"]])
            line = line_f.loc[midx, b].values
            odds = (over_f if direction == "up" else under_f).loc[midx, b].values
            side_win = tf.actual.values > line if direction == "up" else tf.actual.values < line
            push = tf.actual.values == line
            pnl = np.where(push, 0.0, np.where(side_win, payout(pd.Series(odds)), -1.0))
            ok = ~pd.isna(odds)
            tf["season"] = tf.key.map(act.season) if False else tf.season
            for season in (2024, 2025):
                m = ok & (tf.season.values == season)
                if m.sum() < 25:
                    continue
                results.append((b, direction, season, int(m.sum()),
                                f"{side_win[m & ~push].mean():.1%}",
                                f"{pnl[m].mean()*100:+.1f}%",
                                f"{np.nanmean(odds[m]):.0f}"))
    print(pd.DataFrame(results, columns=["stale book", "others moved", "season", "n",
                                         "win%", "ROI", "avg odds"]).to_string(index=False))

    # pooled all books
    print("\npooled (all stale books) by market:")
    rows = []
    for direction in ("up", "down"):
        for season in (2024, 2025):
            for m_ in OU:
                pnls, wins = [], []
                for b in BOOKS:
                    others = [x for x in BOOKS if x != b]
                    med_now = line_f[others].median(axis=1)
                    med_open = opens[others].median(axis=1)
                    omove = med_now - med_open
                    stale = (line_f[b] == opens[b]) & line_f[b].notna()
                    trig = stale & (omove >= thr if direction == "up" else omove <= -thr) & (mkt == m_)
                    t = trig[trig]
                    if not len(t):
                        continue
                    tf = t.index.to_frame(index=False).groupby("key").snapshot_time.min().reset_index()
                    tf = tf.join(act, on="key").dropna(subset=["actual"])
                    tf = tf[tf.season == season]
                    if not len(tf):
                        continue
                    midx = pd.MultiIndex.from_frame(tf[["key", "snapshot_time"]])
                    line = line_f.loc[midx, b].values
                    odds = (over_f if direction == "up" else under_f).loc[midx, b].values
                    side_win = tf.actual.values > line if direction == "up" else tf.actual.values < line
                    push = tf.actual.values == line
                    pnl = np.where(push, 0.0, np.where(side_win, payout(pd.Series(odds)), -1.0))
                    okm = ~pd.isna(odds)
                    pnls.extend(pnl[okm]); wins.extend(side_win[okm & ~push])
                if len(pnls) >= 30:
                    rows.append((m_, direction, season, len(pnls),
                                 f"{np.mean(wins):.1%}", f"{np.mean(pnls)*100:+.1f}%"))
    print(pd.DataFrame(rows, columns=["market", "others moved", "season", "n", "win%", "ROI"]).to_string(index=False))

    # ---------- 3. books moved OPPOSITE directions open->close
    print("\n" + "=" * 80)
    print("3. BOOKS DISAGREE ON DIRECTION (open->close, some up >=thr & some down >=thr)")
    o = fr.assign(key=fr.event_id + "|" + fr.player_id + "|" + fr.market)
    o = o[o.open_line.notna() & o.close_line.notna()]
    o["delta"] = o.close_line - o.open_line
    o["t"] = o.market.map(THR)
    agg = o.groupby(["key", "season"]).agg(up=("delta", lambda x: (x >= x.index.map(lambda i: 0) + o.loc[x.index, "t"]).any()),
                                           dn=("delta", lambda x: (x <= -o.loc[x.index, "t"]).any()),
                                           n_books=("delta", "size")).reset_index()
    dis = agg[agg.up & agg.dn & (agg.n_books >= 3)]
    print(f"props with opposite-direction movers: {len(dis):,} "
          f"({len(dis)/max(len(agg),1):.1%} of multi-book props) -> too rare/noisy to trade" if len(dis) < 500
          else f"props with opposite-direction movers: {len(dis):,}")


if __name__ == "__main__":
    main()
