#!/usr/bin/env python3
"""The look-ahead grid (owner 2026-10-26): the team with a top-25 opponent NEXT, graded tonight, split by tonight's side
and size, tonight's venue, and the venue of the big game. Conference play Dec-Feb, tonight and next both conference games,
no tournaments. Every cell is shown next to the SAME cut without a ranked opponent next (the baseline), so the number to
read is the gap, not the raw win%."""
import numpy as np, pandas as pd, importlib.util, io, contextlib

spec = importlib.util.spec_from_file_location("ls", "lookahead_study.py"); ls = importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()):
    spec.loader.exec_module(ls)
U, rec = ls.U, ls.rec
X = pd.read_parquet("../bball-odds/data/parquet/cbb_sit_panel.parquet", columns=["season", "teamId", "date", "mte", "conf_tourney", "ncaa_t"]); X["date"] = pd.to_datetime(X.date)
U = U.merge(X, on=["season", "teamId", "date"], how="left").merge(X.rename(columns={"date": "n_date", "mte": "n_mte", "conf_tourney": "n_conf_tourney", "ncaa_t": "n_ncaa_t"}), on=["season", "teamId", "n_date"], how="left")
C = U[(U.mte == 0) & (U.n_mte == 0) & (U.conf_tourney == 0) & (U.n_conf_tourney == 0) & (U.ncaa_t == 0) & (U.n_ncaa_t == 0)
      & (U.conf_game == 1) & (U.n_conf_game == 1) & U.month.isin([12, 1, 2]) & (U.neutral == 0)].copy()
C["tonight"] = np.where(C.is_home == 1, "home", "away")
C["next_venue"] = np.where(C.n_neutral == 1, "neutral", np.where(C.n_is_home == 1, "home", "away"))
C["side"] = pd.cut(C.spread, [-99, -12, -7, -3.5, 0, 3, 6.5, 12, 99],
                   labels=["fav 12.5+", "fav 7.5-12", "fav 3.5-7", "fav 0.5-3", "dog 0.5-3", "dog 3.5-6.5", "dog 7-12", "dog 12.5+"])
LA = C.n_top25_opp


def cell(m):
    w, l, p, pct, lo, roi = rec(C[m]); return w, l, pct, roi


def line(lab, m, base):
    w, l, pct, roi = cell(m); bw, bl, bpct, broi = cell(base)
    if w + l < 25:
        return
    gap = (pct - bpct) * 100
    flag = " <--" if (w + l >= 60 and abs(gap) >= 5) else ""
    print(f"  {lab:40s} look-ahead {w:4d}-{l:<4d} {pct:5.1%} roi {roi:+5.1f}%   | baseline {bw:5d}-{bl:<5d} {bpct:5.1%}   gap {gap:+4.1f}{flag}")


print("1. TONIGHT'S SIDE AND SIZE (look-ahead team = top-25 opponent next; baseline = same side/size, nothing ranked next)")
for s in C.side.cat.categories:
    line(s, LA & (C.side == s), ~LA & (C.side == s))

print("\n2. TONIGHT'S VENUE x SIDE")
for v in ("home", "away"):
    for s in ("favorite", "dog"):
        m = (C.tonight == v) & ((C.spread < 0) if s == "favorite" else (C.spread > 0))
        line(f"tonight {v}, {s}", LA & m, ~LA & m)
    for s in C.side.cat.categories:
        m = (C.tonight == v) & (C.side == s)
        line(f"   tonight {v}, {s}", LA & m, ~LA & m)

print("\n3. THE BIG GAME'S VENUE x TONIGHT'S SIDE")
for nv in ("home", "away"):
    for s in ("favorite", "dog"):
        m = (C.next_venue == nv) & ((C.spread < 0) if s == "favorite" else (C.spread > 0))
        line(f"big game {nv}, tonight {s}", LA & m, ~LA & (C.next_venue == nv) & ((C.spread < 0) if s == "favorite" else (C.spread > 0)))
    for s in C.side.cat.categories:
        m = (C.next_venue == nv) & (C.side == s)
        line(f"   big game {nv}, tonight {s}", LA & m, ~LA & m)

print("\n4. TONIGHT'S VENUE x BIG GAME'S VENUE x SIDE (the full grid, cells with 25+)")
for v in ("home", "away"):
    for nv in ("home", "away"):
        for s in ("favorite", "dog"):
            m = (C.tonight == v) & (C.next_venue == nv) & ((C.spread < 0) if s == "favorite" else (C.spread > 0))
            line(f"tonight {v} -> big game {nv}, {s}", LA & m, ~LA & m)
        for s in ("fav 7.5-12", "fav 12.5+", "dog 7-12", "dog 12.5+"):
            m = (C.tonight == v) & (C.next_venue == nv) & (C.side == s)
            line(f"   tonight {v} -> big game {nv}, {s}", LA & m, ~LA & m)

print("\n5. HOW BIG IS THE BIG GAME (next opponent's rank) x tonight's side, dogs 7+ and favorites 7+")
for lo_, hi_, lab in ((1, 5, "next opp top-5"), (6, 10, "next opp 6-10"), (11, 25, "next opp 11-25")):
    r = C.n_o_rank_asof.between(lo_, hi_)
    line(f"{lab}, dog 7+", r & (C.spread >= 7), ~LA & (C.spread >= 7))
    line(f"{lab}, favorite 7+", r & (C.spread <= -7), ~LA & (C.spread <= -7))
    line(f"{lab}, any", r, ~LA)

print("\n6. DOG 7+ WITH THE BIG GAME NEXT, by season and by days until it")
d = C[LA & (C.spread >= 7)]
print("  by season: " + "  ".join(f"{k} {int((x.ats_pts > 0).sum())}-{int((x.ats_pts < 0).sum())}" for k, x in d.groupby("season")))
for lo_, hi_ in ((1, 2), (3, 3), (4, 5), (6, 7)):
    line(f"  dog 7+, big game in {lo_}-{hi_} days", LA & (C.spread >= 7) & C.n_days.between(lo_, hi_), ~LA & (C.spread >= 7) & C.n_days.between(lo_, hi_))
