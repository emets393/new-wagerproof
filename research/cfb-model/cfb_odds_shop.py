"""Best-book line shopping for CFB (odds_history + event_odds). Used by outliers cards."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

import dry_common as C

BOOKS = {
    "draftkings": ("DraftKings", "draftkings.com"),
    "fanduel": ("FanDuel", "fanduel.com"),
    "betmgm": ("BetMGM", "betmgm.com"),
    "betrivers": ("BetRivers", "betrivers.com"),
    "williamhill_us": ("Caesars", "caesars.com"),
    "fanatics": ("Fanatics Sportsbook", "fanatics.com"),
    "bovada": ("Bovada", "bovada.lv"),
    "betonlineag": ("BetOnline", "betonline.ag"),
    "mybookieag": ("MyBookie", "mybookie.ag"),
    "betus": ("BetUS", "betus.com.pa"),
    "lowvig": ("LowVig", "lowvig.ag"),
}

AL = {
    "Appalachian State Mountaineers": "App State",
    "Hawaii Rainbow Warriors": "Hawai'i",
    "UMass Minutemen": "Massachusetts",
    "San Jose State Spartans": "San José State",
    "Southern Miss Golden Eagles": "Southern Miss",
}

DATA = Path(__file__).resolve().parent / "data"


def book_meta(book_key: str | None) -> tuple[str | None, str | None]:
    if not book_key:
        return None, None
    name, domain = BOOKS.get(book_key, (book_key, None))
    logo = f"https://logo.clearbit.com/{domain}" if domain else None
    return name, logo


class CFBOddsShop:
    """Per-game best lines across books for both sides."""

    def __init__(self, season: int, week: int, games: list[dict]):
        self.season = season
        self.week = week
        self.games_by_id = {int(g["game_id"]): g for g in games}
        names = sorted({g["home_team"] for g in games} | {g["away_team"] for g in games})
        self._names = names
        self._pair2gid = {(g["home_team"], g["away_team"]): int(g["game_id"]) for g in games}
        self._fg: dict[tuple[int, str], object] = {}
        self._ev = pd.DataFrame()
        self._load_fg()
        self._load_ev()

    def _tdb(self, odds_name):
        if odds_name in AL:
            return AL[odds_name]
        candidates = [x for x in self._names if str(odds_name).startswith(str(x) + " ") or odds_name == x]
        candidates.sort(key=len, reverse=True)
        return candidates[0] if candidates else None

    def _load_fg(self):
        path = DATA / "odds_history" / f"odds_{self.season}.parquet"
        if not path.exists():
            return
        oh = pd.read_parquet(path)
        oh["h"] = oh.home_team.map(self._tdb)
        oh["a"] = oh.away_team.map(self._tdb)
        oh = oh.dropna(subset=["h", "a"])
        oh["gid"] = [self._pair2gid.get((h, a)) for h, a in zip(oh.h, oh.a)]
        oh = oh[oh.gid.notna() & (oh.hrs_to_kick > 0)].sort_values("hrs_to_kick")
        fg = oh.drop_duplicates(["gid", "book"], keep="first")
        for _, row in fg.iterrows():
            self._fg[(int(row.gid), row.book)] = row

    def _load_ev(self):
        path = DATA / "event_odds" / f"events_{self.season}.parquet"
        if not path.exists():
            return
        gids = set(self.games_by_id)
        ev = pd.read_parquet(path)
        ev = ev[ev.game_id.isin(gids)].copy()
        ev["snap_dt"] = pd.to_datetime(ev.snap, utc=True)
        ev["description"] = ev.description.fillna("_")
        self._ev = ev.sort_values("snap_dt").groupby(
            ["game_id", "market", "book", "name", "description"], as_index=False
        ).last()

    def _ev_rows(self, gid: int, market: str, name: str | None = None):
        s = self._ev[(self._ev.game_id == gid) & (self._ev.market == market)]
        return s[s.name == name] if name else s

    def best_spread(self, gid: int, side: str):
        vals = []
        for (g, bk), row in self._fg.items():
            if g != gid or pd.isna(row.spread_home):
                continue
            line = row.spread_home if side == "HOME" else -row.spread_home
            price = row.spread_home_price if side == "HOME" else row.spread_away_price
            vals.append((float(line), float(price) if pd.notna(price) else -110, bk))
        return max(vals, key=lambda x: (x[0], x[1])) if vals else None

    def best_total(self, gid: int, side: str):
        vals = []
        for (g, bk), row in self._fg.items():
            if g != gid or pd.isna(row.total):
                continue
            price = row.over_price if side == "OVER" else row.under_price
            vals.append((float(row.total), float(price) if pd.notna(price) else -110, bk))
        if not vals:
            return None
        if side == "OVER":
            return min(vals, key=lambda x: (x[0], -x[1]))
        return max(vals, key=lambda x: (x[0], x[1]))

    def best_ml(self, gid: int, side: str):
        vals = []
        for (g, bk), row in self._fg.items():
            if g != gid:
                continue
            ml = row.home_ml if side == "HOME" else row.away_ml
            if pd.notna(ml):
                vals.append((float(ml), bk))
        return max(vals, key=lambda x: x[0]) if vals else None

    def best_h1_spread(self, gid: int, side: str):
        game = self.games_by_id.get(gid)
        if not game:
            return None
        s = self._ev_rows(gid, "spreads_h1")
        s = s.copy()
        s["nm"] = s.name.map(self._tdb)
        s = s[s.nm == game["home_team"]]
        vals = []
        for _, row in s.iterrows():
            if pd.isna(row.point):
                continue
            line = row.point if side == "HOME" else -row.point
            vals.append((float(line), float(row.price) if pd.notna(row.price) else -110, row.book))
        return max(vals, key=lambda x: (x[0], x[1])) if vals else None

    def best_h1_total(self, gid: int, side: str):
        s = self._ev_rows(gid, "totals_h1", side.capitalize())
        vals = [
            (float(row.point), float(row.price) if pd.notna(row.price) else -110, row.book)
            for _, row in s.iterrows()
            if pd.notna(row.point)
        ]
        if not vals:
            return None
        if side == "OVER":
            return min(vals, key=lambda x: (x[0], -x[1]))
        return max(vals, key=lambda x: (x[0], x[1]))

    def best_tt(self, gid: int, team: str, ou: str):
        over = self._ev_rows(gid, "team_totals", "Over")
        over = over[over.description.map(self._tdb) == team]
        under = self._ev_rows(gid, "team_totals", "Under")
        under = under[under.description.map(self._tdb) == team]
        prices = {row.book: row.price for _, row in (under if ou == "UNDER" else over).iterrows()}
        vals = [
            (float(row.point), float(prices.get(row.book, -110)), row.book)
            for _, row in over.iterrows()
            if pd.notna(row.point)
        ]
        if not vals:
            return None
        if ou == "UNDER":
            return max(vals, key=lambda x: (x[0], x[1]))
        return min(vals, key=lambda x: (x[0], -x[1]))


def load_odds_shop(season: int, week: int, games: list[dict]) -> CFBOddsShop | None:
    try:
        return CFBOddsShop(season, week, games)
    except Exception as exc:
        print(f"  odds shop unavailable: {exc}")
        return None
