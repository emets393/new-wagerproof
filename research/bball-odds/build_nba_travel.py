#!/usr/bin/env python3
"""NBA travel and circadian load — the block that was missing entirely.

WHAT WE HAD. Six counters per team: days of rest, back-to-back, rest-before-last, three-in-
four, games in the last seven days, consecutive road games. Every one of them counts GAMES.
None of them knows that the team flew, how far, which direction, into what altitude, or what
time their body thinks it is at tip-off. In the round-2 ablation this block was the only one
whose REMOVAL improved the model, and I read that as "schedule doesn't matter". The more
likely reading is that six game-counters are too crude to carry an effect that is physical.

WHAT THIS ADDS, and why each one is in here rather than being everything I could think of:

  DISTANCE (`trav_km`). Great-circle from the previous game's arena. A back-to-back in New
  York against Brooklyn and a back-to-back that crosses the continent are the same row in
  `h_sched_b2b` and are not the same thing.

  DIRECTION (`trav_tz`, signed east-positive). Eastward travel shortens the day and is the
  direction sports-medicine work consistently finds costly; westward lengthens it and is
  mild. An unsigned "time zones crossed" would average the two into nothing, which is
  probably why nobody finds anything with it.

  BODY CLOCK (`body_tip_hour`, `bodyclock_off`). A Los Angeles team tipping at 7pm in New
  York is playing at 4pm body time; a New York team tipping at 7:30pm in LA is playing at
  10:30pm. Local tip time alone cannot see this and neither can any rest counter. Computed
  from real UTC tip-offs converted to venue-local with DST handled by the tz database --
  which matters, because Phoenix does not observe DST and is Mountain in winter, Pacific in
  summer.

  ALTITUDE (`alt_m`, `alt_jump`, `days_at_alt`). Denver sits at 1,609m and Salt Lake City at
  1,288m; every other arena is under 400m. This is the single largest known physical effect
  on an NBA total and the frame had no column for it at all. `alt_jump` separates a visitor
  who flew in yesterday from the home team that lives there.

  ACCUMULATED LOAD (`km_7d`, `km_14d`, `venues_7d`, `days_since_home`). A road trip's cost is
  cumulative, and "games in the last 7 days" cannot distinguish a homestand from the fifth
  city in nine days.

NEUTRAL SITES ARE A KNOWN GAP. In-season-tournament finals in Las Vegas and the occasional
Mexico City / Paris game are modelled at the nominal home team's arena. That is wrong for a
few dozen games out of 5,400 and is flagged (`neutral_flag`) rather than silently absorbed.

Arena coordinates and elevations are static reference geography, hardcoded on purpose: no API
key, no network dependency, no drift. The Clippers' 2024-25 move from Crypto.com Arena to the
Intuit Dome is handled by season, because it changes both the coordinates and the elevation.
"""
import os
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "data", "parquet")

# team.id -> (lat, lon, elevation_m, tz). Elevation is the arena's, not the city centroid's.
ARENA = {
    1:  (33.7573, -84.3963,  320, "America/New_York"),              # State Farm Arena
    2:  (42.3662, -71.0621,    6, "America/New_York"),              # TD Garden
    3:  (40.6826, -73.9754,   12, "America/New_York"),              # Barclays Center
    4:  (35.2251, -80.8392,  229, "America/New_York"),              # Spectrum Center
    5:  (41.8807, -87.6742,  181, "America/Chicago"),               # United Center
    6:  (41.4965, -81.6882,  199, "America/New_York"),              # Rocket Arena
    7:  (32.7905, -96.8103,  137, "America/Chicago"),               # American Airlines Center
    8:  (39.7487, -105.0077, 1609, "America/Denver"),               # Ball Arena — altitude
    9:  (42.3411, -83.0553,  189, "America/New_York"),              # Little Caesars Arena
    10: (37.7680, -122.3877,   5, "America/Los_Angeles"),           # Chase Center
    11: (29.7508, -95.3621,   15, "America/Chicago"),               # Toyota Center
    12: (39.7640, -86.1555,  218, "America/Indiana/Indianapolis"),  # Gainbridge Fieldhouse
    13: (34.0430, -118.2673,  89, "America/Los_Angeles"),           # LAC — see INTUIT below
    14: (34.0430, -118.2673,  89, "America/Los_Angeles"),           # Crypto.com Arena
    15: (35.1382, -90.0506,   78, "America/Chicago"),               # FedExForum
    16: (25.7814, -80.1870,    3, "America/New_York"),              # Kaseya Center
    17: (43.0451, -87.9172,  187, "America/Chicago"),               # Fiserv Forum
    18: (44.9795, -93.2760,  253, "America/Chicago"),               # Target Center
    19: (29.9490, -90.0821,    2, "America/Chicago"),               # Smoothie King Center
    20: (40.7505, -73.9934,   12, "America/New_York"),              # Madison Square Garden
    21: (35.4634, -97.5151,  366, "America/Chicago"),               # Paycom Center
    22: (28.5392, -81.3839,   32, "America/New_York"),              # Kia Center
    23: (39.9012, -75.1720,    3, "America/New_York"),              # Wells Fargo Center
    24: (33.4457, -112.0712, 331, "America/Phoenix"),               # Footprint — no DST
    25: (45.5316, -122.6668,  15, "America/Los_Angeles"),           # Moda Center
    26: (38.5802, -121.4997,   9, "America/Los_Angeles"),           # Golden 1 Center
    27: (29.4270, -98.4375,  198, "America/Chicago"),               # Frost Bank Center
    28: (43.6435, -79.3791,   76, "America/Toronto"),               # Scotiabank Arena
    29: (40.7683, -111.9011, 1288, "America/Denver"),               # Delta Center — altitude
    30: (38.8981, -77.0209,    8, "America/New_York"),              # Capital One Arena
}
# The Clippers left Crypto.com Arena for the Intuit Dome in Inglewood for 2024-25.
INTUIT = (33.9450, -118.3417, 40, "America/Los_Angeles")
INTUIT_FROM_SEASON = 2024

ACCLIM_CAP = 14.0   # days after which altitude acclimatisation is treated as complete


def venue(team_id, season):
    if team_id == 13 and season >= INTUIT_FROM_SEASON:
        return INTUIT
    return ARENA[team_id]


def haversine_km(a, b):
    """Great-circle distance. Teams fly, so straight-line is the right metric, not road miles."""
    lat1, lon1 = np.radians(a[0]), np.radians(a[1])
    lat2, lon2 = np.radians(b[0]), np.radians(b[1])
    h = (np.sin((lat2 - lat1) / 2) ** 2
         + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2)
    return 6371.0 * 2 * np.arcsin(np.sqrt(h))


def build():
    G = pd.read_parquet(f"{OUT}/bdl_games.parquet").drop_duplicates("id")
    G = G[["id", "season", "datetime", "date", "home_team.id", "visitor_team.id", "ist_stage"]]
    G = G.rename(columns={"id": "bdl_id", "home_team.id": "hid", "visitor_team.id": "aid"})
    G = G[G["hid"].isin(ARENA) & G["aid"].isin(ARENA)].copy()
    # real UTC tip-offs; a handful of rows have no datetime and fall out of the clock features
    G["tip_utc"] = pd.to_datetime(G["datetime"], utc=True, errors="coerce")
    G["date"] = pd.to_datetime(G["date"]).dt.tz_localize(None)
    # Order by DATE, not tip time. 11 games (all 2022-12-02) have no `datetime`, and NaT sorts
    # last -- which walked those team-seasons out of order and produced negative day-diffs.
    # A team plays at most one game per day, so date ordering is exact.
    G = G.sort_values(["date", "tip_utc"]).reset_index(drop=True)
    # IST semifinals and final are played in Las Vegas; a few international games also exist.
    # Flagged, not silently modelled as a home game.
    G["neutral_flag"] = G["ist_stage"].astype(str).str.contains("Final", case=False,
                                                                na=False).astype(int)
    print(f"[travel] {len(G):,} games, {G['neutral_flag'].sum()} flagged neutral-site", flush=True)

    # one row per team per game, in chronological order per team-season
    rows = []
    for _, g in G.iterrows():
        for tid, home in ((g["hid"], 1), (g["aid"], 0)):
            rows.append((g["bdl_id"], g["season"], g["date"], g["tip_utc"], tid, home,
                         g["hid"], g["neutral_flag"]))
    T = pd.DataFrame(rows, columns=["bdl_id", "season", "date", "tip_utc", "team_id",
                                    "is_home", "venue_team", "neutral_flag"])
    T = T.sort_values(["team_id", "season", "tip_utc"]).reset_index(drop=True)

    vl = T.apply(lambda r: venue(r["venue_team"], r["season"]), axis=1)
    T["v_lat"] = [v[0] for v in vl]
    T["v_lon"] = [v[1] for v in vl]
    T["alt_m"] = [float(v[2]) for v in vl]
    T["v_tz"] = [v[3] for v in vl]
    hl = T.apply(lambda r: venue(r["team_id"], r["season"]), axis=1)
    T["h_lat"] = [v[0] for v in hl]
    T["h_lon"] = [v[1] for v in hl]
    T["home_tz"] = [v[3] for v in hl]

    # ---- clock: venue-local tip hour, and what the visiting body clock reads ----------------
    # Done per timezone so the tz database applies the right DST rule for each date. Phoenix
    # is the reason this cannot be a fixed integer offset.
    T["local_hour"] = np.nan
    T["v_off"] = np.nan
    T["home_off"] = np.nan
    for tz in set(T["v_tz"]):
        m = (T["v_tz"] == tz) & T["tip_utc"].notna()
        loc = T.loc[m, "tip_utc"].dt.tz_convert(tz)
        T.loc[m, "local_hour"] = loc.dt.hour + loc.dt.minute / 60.0
        T.loc[m, "v_off"] = loc.dt.strftime("%z").astype(int) / 100.0
    for tz in set(T["home_tz"]):
        m = (T["home_tz"] == tz) & T["tip_utc"].notna()
        T.loc[m, "home_off"] = (T.loc[m, "tip_utc"].dt.tz_convert(tz)
                                .dt.strftime("%z").astype(int) / 100.0)
    # negative = the team is EAST of home, so its body clock reads earlier than the arena clock
    T["bodyclock_off"] = T["home_off"] - T["v_off"]
    T["body_tip_hour"] = T["local_hour"] + T["bodyclock_off"]

    # ---- trip geometry, walked per team-season ---------------------------------------------
    out = []
    for (_, _), g in T.groupby(["team_id", "season"], sort=False):
        g = g.sort_values(["date", "tip_utc"]).copy()
        plat = g["v_lat"].shift(1)
        plon = g["v_lon"].shift(1)
        g["trav_km"] = haversine_km((plat.values, plon.values), (g["v_lat"].values,
                                                                 g["v_lon"].values))
        g.loc[g["trav_km"].isna(), "trav_km"] = 0.0
        # Signed, EAST POSITIVE. UTC offsets get LESS negative going east (LA -8 -> NY -5), so
        # east is cur - prev, not prev - cur. Getting this backwards would have made `east_km`
        # measure westward flights, which is the direction that does NOT hurt.
        g["trav_tz"] = (g["v_off"] - g["v_off"].shift(1)).fillna(0.0)
        g["alt_jump"] = (g["alt_m"] - g["alt_m"].shift(1)).fillna(0.0)
        g["days_rest"] = g["date"].diff().dt.days.fillna(3.0)

        # Days already spent in this elevation band. Capped at ACCLIM_CAP because altitude
        # acclimatisation is essentially complete inside two weeks, and because a sentinel like
        # "99 = they live here" would put a huge isolated spike in a column a ridge has to
        # standardise -- the cap makes home and long-settled visitors the same thing, which is
        # what the physiology says they are.
        da = []
        for i in range(len(g)):
            if g["is_home"].iloc[i] == 1:
                da.append(ACCLIM_CAP)
            else:
                d, j = 0.0, i
                while j > 0 and abs(g["alt_m"].iloc[j - 1] - g["alt_m"].iloc[i]) < 200:
                    d += (g["date"].iloc[j] - g["date"].iloc[j - 1]).days
                    j -= 1
                da.append(min(d, ACCLIM_CAP))
        g["days_at_alt"] = da

        # trailing physical load — cumulative, which no game-counter can express
        km7, km14, ven7, dsh = [], [], [], []
        for i in range(len(g)):
            d0 = g["date"].iloc[i]
            w7 = (g["date"] >= d0 - pd.Timedelta(days=7)) & (g["date"] <= d0)
            w14 = (g["date"] >= d0 - pd.Timedelta(days=14)) & (g["date"] <= d0)
            km7.append(g.loc[w7, "trav_km"].sum())
            km14.append(g.loc[w14, "trav_km"].sum())
            ven7.append(g.loc[w7, "venue_team"].nunique())
            hm = g.iloc[:i + 1]
            hm = hm[hm["is_home"] == 1]
            # NaN, not 999, when a team has not been home yet this season: a sentinel that
            # large dominates the column's variance and the standardiser hands the ridge
            # garbage. NaN is dropped to the training mean instead.
            dsh.append(0.0 if g["is_home"].iloc[i] == 1
                       else (np.nan if hm.empty else float((d0 - hm["date"].iloc[-1]).days)))
        g["km_7d"], g["km_14d"], g["venues_7d"], g["days_since_home"] = km7, km14, ven7, dsh
        out.append(g)

    T = pd.concat(out, ignore_index=True)
    # per-day travel intensity: 2,000km on one day's rest is not 2,000km on three
    T["km_per_rest"] = T["trav_km"] / T["days_rest"].clip(lower=1.0)
    T["east_km"] = T["trav_km"] * (T["trav_tz"] > 0)      # distance flown in the hard direction
    # Altitude only costs you if you have not adjusted to it. Raw `alt_m` cannot separate the
    # Nuggets, who live at 1,609m, from a visitor who landed yesterday -- and they are the whole
    # point. Exponential decay with a ~3-day constant: a same-day arrival keeps ~72% of the
    # elevation, the home team keeps ~1%.
    T["alt_exposure"] = T["alt_m"] * np.exp(-T["days_at_alt"] / 3.0)

    keep = ["bdl_id", "team_id", "is_home", "neutral_flag", "trav_km", "trav_tz", "alt_m",
            "alt_jump", "days_at_alt", "alt_exposure", "km_7d", "km_14d", "venues_7d",
            "days_since_home", "km_per_rest", "east_km", "local_hour", "bodyclock_off",
            "body_tip_hour"]
    T = T[keep]
    T.to_parquet(f"{OUT}/nba_travel.parquet", index=False)

    feat = [c for c in keep if c not in ("bdl_id", "team_id", "is_home", "neutral_flag")]
    print(f"[travel] wrote {len(T):,} team-games x {len(feat)} features -> nba_travel.parquet",
          flush=True)
    print(T[feat].describe().T[["mean", "std", "min", "max"]].round(2).to_string(), flush=True)
    return T


if __name__ == "__main__":
    build()
