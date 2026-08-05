"""QB-vs-scheme + RB-vs-box substrates for the prop player pages (Cursor contract fill).

From scheme_plays.parquet (play-level, 2022-2025):
  nfl_qb_vs_scheme.parquet   per passer: overall + per-look {man, zone, one_high, two_high,
                             pressure, blitz}: dropbacks, ypa, comp_pct, epa_db, sack_rate.
                             Metric choice: EPA/dropback is the primary compare metric
                             (captures sacks+INTs+depth, stable at n>=50); YPA + comp% +
                             sack% served as the human-readable support row.
  nfl_rusher_vs_box.parquet  per rusher (ids joined from full pbp 2023-2025): overall +
                             {heavy_box (8+), neutral (7), light_box (<=6)}: carries, ypc,
                             epa_rush, td_rate. Metric choice: YPC is the display metric,
                             EPA/rush the compare metric (YPC alone is long-run noisy).
"""
import pandas as pd
import numpy as np
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"

sp = pd.read_parquet(DATA / "scheme_plays.parquet")

# ---------- QB ----------
db = sp[(sp.qb_dropback == 1) & sp.passer_player_id.notna()].copy()
db["is_man"] = db.defense_man_zone_type.astype(str).str.contains("MAN", case=False, na=False)
db["is_zone"] = db.defense_man_zone_type.astype(str).str.contains("ZONE", case=False, na=False)
cov = db.defense_coverage_type.astype(str).str.upper()
db["is_two_high"] = cov.str.contains("TWO_HIGH|2_HIGH|COVER_2|COVER_4|COVER_6", na=False)
db["is_one_high"] = cov.str.contains("ONE_HIGH|1_HIGH|COVER_1|COVER_3", na=False)
db["is_pressure"] = db.was_pressure.fillna(False).astype(bool)
db["is_blitz"] = pd.to_numeric(db.number_of_pass_rushers, errors="coerce") >= 5
db["att"] = (db["pass"] == 1) & (db.sack != 1)
db["comp"] = db.complete_pass == 1

def qb_agg(d):
    att = int(d.att.sum())
    return dict(dropbacks=int(len(d)),
                ypa=float(d.loc[d.att, "yards_gained"].mean()) if att >= 1 else None,
                comp_pct=float(d.loc[d.att, "comp"].mean()) if att >= 1 else None,
                epa_db=float(d.epa.mean()) if len(d) else None,
                sack_rate=float((d.sack == 1).mean()) if len(d) else None)

rows = []
for pid, g in db.groupby("passer_player_id"):
    r = dict(player_id=pid, **{f"overall_{k}": v for k, v in qb_agg(g).items()})
    for look, mask in (("man", g.is_man), ("zone", g.is_zone), ("two_high", g.is_two_high),
                       ("one_high", g.is_one_high), ("pressure", g.is_pressure), ("blitz", g.is_blitz)):
        for k, v in qb_agg(g[mask]).items():
            r[f"{look}_{k}"] = v
    rows.append(r)
qb = pd.DataFrame(rows)
qb.to_parquet(DATA / "nfl_qb_vs_scheme.parquet", index=False)
print(f"QB substrate: {len(qb)} passers | >=150 dropbacks: {(qb.overall_dropbacks>=150).sum()}")

# ---------- RB ----------
ids = pd.concat([pd.read_parquet(DATA / "pbp_cache" / f"pbp_{y}.parquet",
                                 columns=["game_id", "play_id", "rusher_player_id"])
                 for y in (2023, 2024, 2025)])
ru = sp[sp.rush == 1].merge(ids.dropna(), on=["game_id", "play_id"], how="inner")
box = pd.to_numeric(ru.defenders_in_box, errors="coerce")
ru["box_grp"] = np.where(box >= 8, "heavy_box", np.where(box <= 6, "light_box", "neutral"))

def rb_agg(d):
    return dict(carries=int(len(d)),
                ypc=float(d.yards_gained.mean()) if len(d) else None,
                epa_rush=float(d.epa.mean()) if len(d) else None,
                td_rate=float((d.rush_touchdown == 1).mean()) if len(d) else None)

rows = []
for pid, g in ru.groupby("rusher_player_id"):
    r = dict(player_id=pid, **{f"overall_{k}": v for k, v in rb_agg(g).items()})
    for look in ("heavy_box", "neutral", "light_box"):
        for k, v in rb_agg(g[g.box_grp == look]).items():
            r[f"{look}_{k}"] = v
    rows.append(r)
rb = pd.DataFrame(rows)
rb.to_parquet(DATA / "nfl_rusher_vs_box.parquet", index=False)
print(f"RB substrate: {len(rb)} rushers | >=100 carries: {(rb.overall_carries>=100).sum()}")
