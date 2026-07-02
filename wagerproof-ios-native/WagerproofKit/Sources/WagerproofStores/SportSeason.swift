import Foundation

/// Per-sport regular-season windows + season-aware empty-state copy, shared by
/// the Games and Props tabs. Bookend dates are approximate (regular-season
/// start → championship) and use ET to match the app's sports-date convention
/// (`GamesStore.Sport.displayOrder`). Precise enough to (a) dim a sport in the
/// tab picker while it's out of season and (b) tell an offseason user when to
/// return vs. telling an in-season user an empty board is just mid-refresh.
public enum SportSeason {
    /// Season start (month, day) and end (month, day). Windows that run past
    /// Dec 31 (football/basketball) have a start month later than the end month.
    public static func window(for sport: GamesStore.Sport) -> (start: DateComponents, end: DateComponents) {
        switch sport {
        case .nfl:   return (dc(9, 4),   dc(2, 15))
        case .cfb:   return (dc(8, 23),  dc(1, 20))
        case .nba:   return (dc(10, 21), dc(6, 22))
        case .ncaab: return (dc(11, 3),  dc(4, 8))
        case .mlb:   return (dc(3, 26),  dc(11, 5))
        }
    }

    private static func dc(_ month: Int, _ day: Int) -> DateComponents {
        DateComponents(month: month, day: day)
    }

    private static var calendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/New_York") ?? .current
        return cal
    }

    /// month*100+day so month/day pairs compare as plain ascending integers.
    private static func ordinal(_ month: Int, _ day: Int) -> Int { month * 100 + day }

    /// True when `date` sits inside the sport's season window, handling windows
    /// that wrap past Dec 31.
    public static func isInSeason(_ sport: GamesStore.Sport, on date: Date = Date()) -> Bool {
        let w = window(for: sport)
        guard let sm = w.start.month, let sd = w.start.day,
              let em = w.end.month, let ed = w.end.day else { return false }
        let today = ordinal(calendar.component(.month, from: date), calendar.component(.day, from: date))
        let start = ordinal(sm, sd)
        let end = ordinal(em, ed)
        if start <= end { return today >= start && today <= end }   // same-year window (MLB)
        return today >= start || today <= end                       // wraps the new year
    }

    /// The next calendar date the season starts, relative to `date`.
    public static func nextSeasonStart(_ sport: GamesStore.Sport, on date: Date = Date()) -> Date? {
        calendar.nextDate(after: date, matching: window(for: sport).start, matchingPolicy: .nextTime)
    }

    /// Title + message for an empty "no games / no props" tile, chosen by
    /// in-season vs. offseason. `itemsNoun`/`dataNoun` let the Props tab say
    /// "player props" / "prop data" where the Games tab says "games" / "game data".
    public static func emptyCopy(
        for sport: GamesStore.Sport,
        itemsNoun: String = "games",
        dataNoun: String = "game data",
        on date: Date = Date()
    ) -> (title: String, message: String) {
        if isInSeason(sport, on: date) {
            return (
                "Refreshing \(sport.label) analysis",
                "We're refreshing analysis for today's \(itemsNoun). Check back tomorrow for updated \(dataNoun)."
            )
        }
        let title = "\(sport.label) is out of season"
        if let start = nextSeasonStart(sport, on: date) {
            return (title, "The season begins \(startFormatter.string(from: start)). Check back closer to the start date.")
        }
        return (title, "Check back when the season starts.")
    }

    private static let startFormatter: DateFormatter = {
        let f = DateFormatter()
        f.timeZone = TimeZone(identifier: "America/New_York") ?? .current
        f.dateFormat = "MMMM d"   // e.g. "September 4"
        return f
    }()
}
