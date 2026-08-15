import Foundation

/// One sportsbook's price on one side of one market.
///
/// Sourced from `nfl_historical_odds`, which the hourly research capture writes
/// as ONE ROW PER BOOK per game per snapshot. That's the only per-book feed the
/// app has; the pick row's `best_book` / `best_line` is a single pre-chosen
/// winner with no way to see who else was close.
public struct SportsbookQuote: Identifiable, Hashable, Sendable {
    /// Odds-API book key, e.g. `draftkings`. Also the identity used by the
    /// user's preferred-book setting.
    public let bookKey: String
    /// Human label, e.g. "DraftKings".
    public let bookName: String
    /// The number being offered — a spread from the bet's perspective, or a
    /// total. Nil on markets that are price-only (moneyline).
    public let line: Double?
    /// American odds.
    public let price: Int?

    public var id: String { bookKey }

    public init(bookKey: String, bookName: String, line: Double?, price: Int?) {
        self.bookKey = bookKey
        self.bookName = bookName
        self.line = line
        self.price = price
    }
}

/// Every book's quote on one market for one game, ordered best-first.
public struct SportsbookMarketQuotes: Sendable {
    public let quotes: [SportsbookQuote]
    /// When the capture ran. Surfaced so a stale board can say so rather than
    /// implying these are live prices.
    public let capturedAt: Date?

    public init(quotes: [SportsbookQuote], capturedAt: Date?) {
        self.quotes = quotes
        self.capturedAt = capturedAt
    }

    public var best: SportsbookQuote? { quotes.first }

    public func quote(for bookKey: String?) -> SportsbookQuote? {
        guard let bookKey else { return nil }
        return quotes.first { $0.bookKey == bookKey }
    }

    /// The book a card should lead with: the BEST number among the books the
    /// user actually holds accounts with, or the best overall when they haven't
    /// narrowed it down.
    ///
    /// `quotes` is already sorted best-first, so the first match in the user's
    /// set is by definition their best available.
    ///
    /// Falls back to the overall best rather than showing "not offered" — if
    /// none of a user's books price this market, a blank card helps nobody.
    public func preferred(_ bookKeys: Set<String>) -> SportsbookQuote? {
        guard !bookKeys.isEmpty else { return best }
        return quotes.first { bookKeys.contains($0.bookKey) } ?? best
    }

    /// True when the leading quote came from the user's own set rather than the
    /// fallback — drives whether the chip says "YOUR BOOKS" or "BEST LINE".
    public func isFromSelection(_ bookKeys: Set<String>) -> Bool {
        guard !bookKeys.isEmpty, let shown = preferred(bookKeys) else { return false }
        return bookKeys.contains(shown.bookKey)
    }
}

/// Which side of which market a card is asking about, so the service knows how
/// to read a row and which direction counts as "best".
public enum SportsbookMarket: Sendable, Equatable {
    /// Spread for the away or home side. Best = the biggest number (most points
    /// received / fewest laid).
    case spread(isHome: Bool)
    /// Game total. Best depends on the side: OVER wants the lowest number,
    /// UNDER the highest.
    case total(isOver: Bool)
    /// Moneyline for a side. No line, best = the longest price.
    case moneyline(isHome: Bool)
    case firstHalfSpread(isHome: Bool)
    case firstHalfTotal(isOver: Bool)
    case firstFiveMoneyline(isHome: Bool)
    case firstFiveSpread(isHome: Bool)
    case firstFiveTotal(isOver: Bool)
}

/// Strict bridge between the Odds API's school+mascot names and the short
/// school names stored by `cfb_dryrun_games`.
///
/// Every supported school+mascot string is mapped explicitly. A caller still
/// supplies the two teams on the requested game, so even a valid alias cannot
/// attach prices from another matchup.
public enum CFBSportsbookTeamAliases {
    /// Exact Odds API school+mascot name -> app/ESPN school name.
    ///
    /// This covers every team in the 2026 reference table (139 teams). It is
    /// intentionally explicit: prefix matching can turn Idaho State into
    /// Idaho, North Carolina A&T into North Carolina, or Tennessee State into
    /// Tennessee without producing an error.
    private static let rawAliases: [String: String] = [
        "Air Force Falcons": "Air Force",
        "Akron Zips": "Akron",
        "Alabama Crimson Tide": "Alabama",
        "Appalachian State Mountaineers": "App State",
        "Arizona State Sun Devils": "Arizona State",
        "Arizona Wildcats": "Arizona",
        "Arkansas Razorbacks": "Arkansas",
        "Arkansas State Red Wolves": "Arkansas State",
        "Army Black Knights": "Army",
        "Auburn Tigers": "Auburn",
        "Ball State Cardinals": "Ball State",
        "Baylor Bears": "Baylor",
        "Boise State Broncos": "Boise State",
        "Boston College Eagles": "Boston College",
        "Bowling Green Falcons": "Bowling Green",
        "Buffalo Bulls": "Buffalo",
        "BYU Cougars": "BYU",
        "California Golden Bears": "California",
        "Central Michigan Chippewas": "Central Michigan",
        "Charlotte 49ers": "Charlotte",
        "Cincinnati Bearcats": "Cincinnati",
        "Clemson Tigers": "Clemson",
        "Coastal Carolina Chanticleers": "Coastal Carolina",
        "Colorado Buffaloes": "Colorado",
        "Colorado State Rams": "Colorado State",
        "Delaware Blue Hens": "Delaware",
        "Duke Blue Devils": "Duke",
        "East Carolina Pirates": "East Carolina",
        "Eastern Michigan Eagles": "Eastern Michigan",
        "Florida Atlantic Owls": "Florida Atlantic",
        "Florida Gators": "Florida",
        "Florida International Panthers": "Florida International",
        "Florida State Seminoles": "Florida State",
        "Fresno State Bulldogs": "Fresno State",
        "Georgia Bulldogs": "Georgia",
        "Georgia Southern Eagles": "Georgia Southern",
        "Georgia State Panthers": "Georgia State",
        "Georgia Tech Yellow Jackets": "Georgia Tech",
        "Hawaii Rainbow Warriors": "Hawai'i",
        "Houston Cougars": "Houston",
        "Idaho Vandals": "Idaho",
        "Illinois Fighting Illini": "Illinois",
        "Indiana Hoosiers": "Indiana",
        "Iowa Hawkeyes": "Iowa",
        "Iowa State Cyclones": "Iowa State",
        "Jacksonville State Gamecocks": "Jacksonville State",
        "James Madison Dukes": "James Madison",
        "Kansas Jayhawks": "Kansas",
        "Kansas State Wildcats": "Kansas State",
        "Kennesaw State Owls": "Kennesaw State",
        "Kent State Golden Flashes": "Kent State",
        "Kentucky Wildcats": "Kentucky",
        "Liberty Flames": "Liberty",
        "Louisiana Ragin Cajuns": "Louisiana",
        "Louisiana Tech Bulldogs": "Louisiana Tech",
        "Louisville Cardinals": "Louisville",
        "LSU Tigers": "LSU",
        "Marshall Thundering Herd": "Marshall",
        "Maryland Terrapins": "Maryland",
        "Memphis Tigers": "Memphis",
        "Miami (OH) RedHawks": "Miami (OH)",
        "Miami Hurricanes": "Miami",
        "Miami RedHawks": "Miami (OH)",
        "Michigan State Spartans": "Michigan State",
        "Michigan Wolverines": "Michigan",
        "Middle Tennessee Blue Raiders": "Middle Tennessee",
        "Minnesota Golden Gophers": "Minnesota",
        "Mississippi Rebels": "Ole Miss",
        "Mississippi State Bulldogs": "Mississippi State",
        "Missouri State Bears": "Missouri State",
        "Missouri Tigers": "Missouri",
        "Navy Midshipmen": "Navy",
        "NC State Wolfpack": "NC State",
        "Nebraska Cornhuskers": "Nebraska",
        "Nevada Wolf Pack": "Nevada",
        "New Mexico Lobos": "New Mexico",
        "New Mexico State Aggies": "New Mexico State",
        "North Carolina Tar Heels": "North Carolina",
        "North Dakota State Bison": "North Dakota State",
        "North Texas Mean Green": "North Texas",
        "Northern Illinois Huskies": "Northern Illinois",
        "Northwestern Wildcats": "Northwestern",
        "Notre Dame Fighting Irish": "Notre Dame",
        "Ohio Bobcats": "Ohio",
        "Ohio State Buckeyes": "Ohio State",
        "Oklahoma Sooners": "Oklahoma",
        "Oklahoma State Cowboys": "Oklahoma State",
        "Old Dominion Monarchs": "Old Dominion",
        "Ole Miss Rebels": "Ole Miss",
        "Oregon Ducks": "Oregon",
        "Oregon State Beavers": "Oregon State",
        "Penn State Nittany Lions": "Penn State",
        "Pittsburgh Panthers": "Pittsburgh",
        "Purdue Boilermakers": "Purdue",
        "Rice Owls": "Rice",
        "Rutgers Scarlet Knights": "Rutgers",
        "Sacramento State Hornets": "Sacramento State",
        "Sam Houston State Bearkats": "Sam Houston",
        "San Diego State Aztecs": "San Diego State",
        "San Jose State Spartans": "San José State",
        "SMU Mustangs": "SMU",
        "South Alabama Jaguars": "South Alabama",
        "South Carolina Gamecocks": "South Carolina",
        "South Florida Bulls": "South Florida",
        "Southern California Trojans": "USC",
        "Southern Mississippi Golden Eagles": "Southern Miss",
        "Stanford Cardinal": "Stanford",
        "Syracuse Orange": "Syracuse",
        "TCU Horned Frogs": "TCU",
        "Temple Owls": "Temple",
        "Tennessee Volunteers": "Tennessee",
        "Texas A&M Aggies": "Texas A&M",
        "Texas Longhorns": "Texas",
        "Texas State Bobcats": "Texas State",
        "Texas Tech Red Raiders": "Texas Tech",
        "Toledo Rockets": "Toledo",
        "Troy Trojans": "Troy",
        "Tulane Green Wave": "Tulane",
        "Tulsa Golden Hurricane": "Tulsa",
        "UAB Blazers": "UAB",
        "UCF Knights": "UCF",
        "UCLA Bruins": "UCLA",
        "UConn Huskies": "UConn",
        "UL Monroe Warhawks": "UL Monroe",
        "UMass Minutemen": "Massachusetts",
        "UNLV Rebels": "UNLV",
        "USC Trojans": "USC",
        "Utah State Aggies": "Utah State",
        "Utah Utes": "Utah",
        "UTEP Miners": "UTEP",
        "UTSA Roadrunners": "UTSA",
        "Vanderbilt Commodores": "Vanderbilt",
        "Virginia Cavaliers": "Virginia",
        "Virginia Tech Hokies": "Virginia Tech",
        "Wake Forest Demon Deacons": "Wake Forest",
        "Washington Huskies": "Washington",
        "Washington State Cougars": "Washington State",
        "West Virginia Mountaineers": "West Virginia",
        "Western Kentucky Hilltoppers": "Western Kentucky",
        "Western Michigan Broncos": "Western Michigan",
        "Wisconsin Badgers": "Wisconsin",
        "Wyoming Cowboys": "Wyoming",
    ]

    private static let aliases = Dictionary(
        uniqueKeysWithValues: rawAliases.map { (normalize($0.key), $0.value) }
    )

    public static var supportedAliasCount: Int { rawAliases.count }

    /// Resolves only within the caller's known candidate set. Returning nil is
    /// intentional: a fuzzy global guess could attach another game's prices.
    public static func canonicalName(
        forOddsAPIName oddsName: String,
        candidates: [String]
    ) -> String? {
        guard let canonical = aliases[normalize(oddsName)] else { return nil }
        return candidates.first { normalize($0) == normalize(canonical) }
    }

    public static func matches(oddsAPIName: String, canonicalName: String) -> Bool {
        self.canonicalName(forOddsAPIName: oddsAPIName, candidates: [canonicalName]) != nil
    }

    private static func normalize(_ value: String) -> String {
        value
            .folding(options: [.diacriticInsensitive], locale: Locale(identifier: "en_US_POSIX"))
            .lowercased()
            .replacingOccurrences(of: ".", with: "")
            .replacingOccurrences(of: "'", with: "")
            .replacingOccurrences(of: "’", with: "")
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
    }
}

/// Display metadata for the books the capture actually returns. Keyed by the
/// Odds-API key stored in `nfl_historical_odds.book`.
public enum SportsbookCatalog {
    public static let names: [String: String] = [
        "draftkings": "DraftKings",
        "fanduel": "FanDuel",
        "betmgm": "BetMGM",
        "betrivers": "BetRivers",
        "williamhill_us": "Caesars",
        "bovada": "Bovada",
        "betus": "BetUS",
        "betonlineag": "BetOnline",
        "lowvig": "LowVig",
        "mybookieag": "MyBookie",
        "fanatics": "Fanatics",
    ]

    /// Offered in Settings. Ordered by how many users are likely to hold an
    /// account, not alphabetically.
    public static let selectable: [String] = [
        "draftkings", "fanduel", "betmgm", "betrivers", "williamhill_us",
        "fanatics", "bovada", "betus", "betonlineag", "lowvig", "mybookieag",
    ]

    public static func name(for key: String) -> String {
        names[key] ?? key.capitalized
    }
}

/// The books the user actually holds accounts with, shared by every surface
/// that quotes a price.
///
/// Stored as a comma-separated list in plain `UserDefaults` so `@AppStorage`
/// (which can't bind a `Set`) and non-SwiftUI readers in the Kit see the same
/// value. Not in the App Group yet — the widget extension doesn't render book
/// chips; move it there when it does.
public enum SportsbookPreference {
    /// The `@AppStorage` key. Value is a CSV of Odds-API book keys; empty
    /// string means "every book", which is the default.
    public static let defaultsKey = "sportsbook.preferred"

    /// Empty = no filter, show the best number anywhere. Unknown keys are
    /// dropped on read so a retired book can't silently narrow a user's board
    /// to nothing.
    public static var selectedBookKeys: Set<String> {
        get { decode(UserDefaults.standard.string(forKey: defaultsKey)) }
        set { UserDefaults.standard.set(encode(newValue), forKey: defaultsKey) }
    }

    public static func decode(_ raw: String?) -> Set<String> {
        guard let raw, !raw.isEmpty else { return [] }
        return Set(
            raw.split(separator: ",")
                .map { String($0).trimmingCharacters(in: .whitespaces) }
                .filter { SportsbookCatalog.names[$0] != nil }
        )
    }

    /// Sorted on write so the stored string is stable — an unordered Set would
    /// otherwise rewrite defaults (and fire `@AppStorage` observers) on every
    /// launch.
    public static func encode(_ keys: Set<String>) -> String {
        keys.sorted().joined(separator: ",")
    }

    /// One-line summary for the settings row.
    public static func summary(_ keys: Set<String>) -> String {
        switch keys.count {
        case 0: return "Showing the best number from any book"
        case 1: return "\(SportsbookCatalog.name(for: keys.first!)) — best number from your book"
        case 2, 3:
            let names = keys.sorted().map { SportsbookCatalog.name(for: $0) }
            return "Best of \(names.joined(separator: ", "))"
        default: return "Best of your \(keys.count) books"
        }
    }
}
