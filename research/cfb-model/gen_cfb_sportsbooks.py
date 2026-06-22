"""Populate cfb_sportsbooks (book_key -> display name + logo). Logos via Clearbit logo API (reliable, transparent)."""
import pandas as pd
import dry_common as C
BOOKS = {
 "draftkings": ("DraftKings", "draftkings.com"), "fanduel": ("FanDuel", "fanduel.com"),
 "betmgm": ("BetMGM", "betmgm.com"), "betrivers": ("BetRivers", "betrivers.com"),
 "williamhill_us": ("Caesars", "caesars.com"), "espnbet": ("ESPN BET", "espnbet.com"),
 "fanatics": ("Fanatics Sportsbook", "fanatics.com"), "bovada": ("Bovada", "bovada.lv"),
 "betonlineag": ("BetOnline", "betonline.ag"), "mybookieag": ("MyBookie", "mybookie.ag"),
 "betus": ("BetUS", "betus.com.pa"), "lowvig": ("LowVig", "lowvig.ag"),
}
rows = [{"book_key": k, "display_name": n, "domain": d, "logo_url": f"https://logo.clearbit.com/{d}"}
        for k, (n, d) in BOOKS.items()]
df = pd.DataFrame(rows)
print(f"cfb_sportsbooks: {len(df)}")
C.wipe("cfb_sportsbooks", "book_key=not.is.null"); C.insert("cfb_sportsbooks", df)
