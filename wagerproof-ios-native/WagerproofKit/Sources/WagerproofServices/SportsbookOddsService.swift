import Foundation
import Supabase
import WagerproofModels

/// Per-book lines and prices for NFL team markets, read from
/// `nfl_historical_odds` — the hourly research capture that writes ONE ROW PER
/// BOOK per game per snapshot.
///
/// ## Why this isn't the pick row's `best_book`
/// A slate pick row already carries `best_book` / `best_line` / `best_odds`,
/// but that's one pre-chosen winner drawn from a wider book set than this table
/// covers (it credits Fanatics, which the capture doesn't collect). Showing that
/// chip above a board sourced from here would put two different books on the
/// same number. Cards therefore resolve their line from THIS service when it has
/// the game, and fall back to the pick row only when it doesn't.
///
/// ## Freshness
/// The capture pauses out of season, so `capturedAt` is surfaced on every result
/// and the UI is expected to say how old the board is rather than implying these
/// are live prices.
public actor SportsbookOddsService {
    public static let shared = SportsbookOddsService()
    public init() {}

    /// Keyed by `game_id`. A game sheet asks once per market and gets the same
    /// snapshot for all of them.
    private var cache: [String: SportsbookGameOdds] = [:]

    // MARK: - Row

    private struct OddsRow: Decodable {
        let snapTs: String?
        let commenceTime: String?
        let book: String
        let spreadHome: Double?
        let spreadHomePrice: Double?
        let spreadAway: Double?
        let spreadAwayPrice: Double?
        let totalPoint: Double?
        let totalOverPrice: Double?
        let totalUnderPrice: Double?
        let mlHome: Double?
        let mlAway: Double?
        let h1SpreadHome: Double?
        let h1SpreadHomePrice: Double?
        let h1SpreadAway: Double?
        let h1SpreadAwayPrice: Double?
        let h1TotalPoint: Double?
        let h1TotalOverPrice: Double?
        let h1TotalUnderPrice: Double?

        enum CodingKeys: String, CodingKey {
            case snapTs = "snap_ts"
            case commenceTime = "commence_time"
            case book
            case spreadHome = "spread_home"
            case spreadHomePrice = "spread_home_price"
            case spreadAway = "spread_away"
            case spreadAwayPrice = "spread_away_price"
            case totalPoint = "total_point"
            case totalOverPrice = "total_over_price"
            case totalUnderPrice = "total_under_price"
            case mlHome = "ml_home"
            case mlAway = "ml_away"
            case h1SpreadHome = "h1_spread_home"
            case h1SpreadHomePrice = "h1_spread_home_price"
            case h1SpreadAway = "h1_spread_away"
            case h1SpreadAwayPrice = "h1_spread_away_price"
            case h1TotalPoint = "h1_total_point"
            case h1TotalOverPrice = "h1_total_over_price"
            case h1TotalUnderPrice = "h1_total_under_price"
        }
    }

    // MARK: - Fetch

    /// - Parameters:
    ///   - gameId: slate `game_id`, used only as the cache key.
    ///   - awayTeam / homeTeam: FULL club names as stored on `nfl_slate_feed`.
    ///   - kickoff: used to pick the right meeting when two clubs play twice.
    public func odds(
        gameId: String,
        awayTeam: String,
        homeTeam: String,
        kickoff: Date?
    ) async -> SportsbookGameOdds? {
        let cacheKey = "nfl:\(gameId)"
        if let cached = cache[cacheKey] { return cached }

        let cfb = await CFBSupabase.shared.client
        let away = Self.cityName(awayTeam)
        let home = Self.cityName(homeTeam)

        guard let rows: [OddsRow] = try? await cfb
            .from("nfl_historical_odds")
            .select()
            .eq("away_team", value: away)
            .eq("home_team", value: home)
            .order("snap_ts", ascending: false)
            .limit(400)
            .execute()
            .value, !rows.isEmpty
        else { return nil }

        // Division rivals meet twice, so narrow to the meeting nearest kickoff
        // before taking the newest snapshot — otherwise a card can show the
        // other fixture's prices with no visible sign anything is wrong.
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        func parse(_ value: String?) -> Date? {
            guard let value else { return nil }
            return parser.date(from: value) ?? plain.date(from: value)
        }

        var candidates = rows
        if let kickoff {
            let grouped = Dictionary(grouping: rows) { $0.commenceTime ?? "" }
            if let nearest = grouped.min(by: { lhs, rhs in
                let l = parse(lhs.value.first?.commenceTime).map { abs($0.timeIntervalSince(kickoff)) } ?? .greatestFiniteMagnitude
                let r = parse(rhs.value.first?.commenceTime).map { abs($0.timeIntervalSince(kickoff)) } ?? .greatestFiniteMagnitude
                return l < r
            }) {
                candidates = nearest.value
            }
        }

        guard let newestStamp = candidates.compactMap({ $0.snapTs }).max() else { return nil }
        let latest = candidates.filter { $0.snapTs == newestStamp }
        guard !latest.isEmpty else { return nil }

        let result = SportsbookGameOdds(
            rows: latest.map(Self.snapshot),
            capturedAt: parse(newestStamp)
        )
        cache[cacheKey] = result
        return result
    }

    // MARK: - CFB

    private struct CFBOddsRow: Decodable {
        let snapshot: String?
        let commenceTime: String?
        let oddsGameId: String
        let homeTeam: String
        let awayTeam: String
        let book: String
        let homeMl: Double?
        let awayMl: Double?
        let spreadHome: Double?
        let spreadHomePrice: Double?
        let spreadAwayPrice: Double?
        let total: Double?
        let overPrice: Double?
        let underPrice: Double?

        enum CodingKeys: String, CodingKey {
            case snapshot, book, total
            case commenceTime = "commence_time"
            case oddsGameId = "game_id"
            case homeTeam = "home_team"
            case awayTeam = "away_team"
            case homeMl = "home_ml"
            case awayMl = "away_ml"
            case spreadHome = "spread_home"
            case spreadHomePrice = "spread_home_price"
            case spreadAwayPrice = "spread_away_price"
            case overPrice = "over_price"
            case underPrice = "under_price"
        }
    }

    /// Per-book CFB full-game markets from `ncaaf_odds_history`.
    ///
    /// The table has Odds-API event ids while the app has ESPN ids, so this
    /// deliberately narrows by kickoff first and then requires BOTH strict
    /// team aliases to match. A miss returns nil; it never guesses.
    public func cfbOdds(
        gameId: String,
        awayTeam: String,
        homeTeam: String,
        kickoff: Date?
    ) async -> SportsbookGameOdds? {
        let cacheKey = "cfb:\(gameId)"
        if let cached = cache[cacheKey] { return cached }
        guard let kickoff else { return nil }

        let cfb = await CFBSupabase.shared.client
        let lower = Self.queryTimestamp(kickoff.addingTimeInterval(-4 * 60 * 60))
        let upper = Self.queryTimestamp(kickoff.addingTimeInterval(4 * 60 * 60))

        guard let rows: [CFBOddsRow] = try? await cfb
            .from("ncaaf_odds_history")
            .select("snapshot,commence_time,game_id,home_team,away_team,book,home_ml,away_ml,spread_home,spread_home_price,spread_away_price,total,over_price,under_price")
            .gte("commence_time", value: lower)
            .lte("commence_time", value: upper)
            .order("snapshot", ascending: false)
            .limit(1000)
            .execute()
            .value, !rows.isEmpty
        else { return nil }

        let matched = rows.filter {
            CFBSportsbookTeamAliases.matches(oddsAPIName: $0.awayTeam, canonicalName: awayTeam)
                && CFBSportsbookTeamAliases.matches(oddsAPIName: $0.homeTeam, canonicalName: homeTeam)
        }
        guard !matched.isEmpty else { return nil }

        // Keep one Odds-API event before choosing its newest snapshot. This
        // protects a rare same-teams/same-window collision without fuzzy joins.
        let eventGroups = Dictionary(grouping: matched, by: \.oddsGameId)
        guard let nearestEvent = eventGroups.min(by: { lhs, rhs in
            let l = Self.parseDate(lhs.value.first?.commenceTime)
                .map { abs($0.timeIntervalSince(kickoff)) } ?? .greatestFiniteMagnitude
            let r = Self.parseDate(rhs.value.first?.commenceTime)
                .map { abs($0.timeIntervalSince(kickoff)) } ?? .greatestFiniteMagnitude
            return l < r
        })?.value,
        let newest = nearestEvent.compactMap(\.snapshot).max()
        else { return nil }

        let latest = nearestEvent.filter { $0.snapshot == newest }
        guard !latest.isEmpty else { return nil }
        let result = SportsbookGameOdds(
            rows: latest.map(Self.cfbSnapshot),
            capturedAt: Self.parseDate(newest)
        )
        cache[cacheKey] = result
        return result
    }

    private static func cfbSnapshot(_ row: CFBOddsRow) -> SportsbookGameOdds.BookRow {
        SportsbookGameOdds.BookRow(
            bookKey: row.book,
            spreadHome: row.spreadHome,
            spreadHomePrice: row.spreadHomePrice,
            // `ncaaf_odds_history` intentionally stores only the home point;
            // the away point is its exact inverse, while price stays separate.
            spreadAway: row.spreadHome.map { -$0 },
            spreadAwayPrice: row.spreadAwayPrice,
            totalPoint: row.total,
            totalOverPrice: row.overPrice,
            totalUnderPrice: row.underPrice,
            mlHome: row.homeMl,
            mlAway: row.awayMl
        )
    }

    private static func queryTimestamp(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: date)
    }

    private static func parseDate(_ value: String?) -> Date? {
        guard let value else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return fractional.date(from: value) ?? plain.date(from: value)
    }

    // MARK: - MLB

    private struct MLBOddsRow: Decodable {
        let fetchedAt: String?
        let bookmaker: String
        let homeMl: Double?
        let awayMl: Double?
        let homeSpread: Double?
        let awaySpread: Double?
        let homeSpreadOdds: Double?
        let awaySpreadOdds: Double?
        let totalLine: Double?
        let totalOverOdds: Double?
        let totalUnderOdds: Double?
        let f5HomeMl: Double?
        let f5AwayMl: Double?
        let f5HomeSpread: Double?
        let f5AwaySpread: Double?
        let f5HomeSpreadOdds: Double?
        let f5AwaySpreadOdds: Double?
        let f5TotalLine: Double?
        let f5TotalOverOdds: Double?
        let f5TotalUnderOdds: Double?

        enum CodingKeys: String, CodingKey {
            case bookmaker
            case fetchedAt = "fetched_at"
            case homeMl = "home_ml"
            case awayMl = "away_ml"
            case homeSpread = "home_spread"
            case awaySpread = "away_spread"
            case homeSpreadOdds = "home_spread_odds"
            case awaySpreadOdds = "away_spread_odds"
            case totalLine = "total_line"
            case totalOverOdds = "total_over_odds"
            case totalUnderOdds = "total_under_odds"
            case f5HomeMl = "f5_home_ml"
            case f5AwayMl = "f5_away_ml"
            case f5HomeSpread = "f5_home_spread"
            case f5AwaySpread = "f5_away_spread"
            case f5HomeSpreadOdds = "f5_home_spread_odds"
            case f5AwaySpreadOdds = "f5_away_spread_odds"
            case f5TotalLine = "f5_total_line"
            case f5TotalOverOdds = "f5_total_over_odds"
            case f5TotalUnderOdds = "f5_total_under_odds"
        }
    }

    public func mlbOdds(gamePk: Int) async -> SportsbookGameOdds? {
        let cacheKey = "mlb:\(gamePk)"
        if let cached = cache[cacheKey] { return cached }

        let cfb = await CFBSupabase.shared.client
        guard let rows: [MLBOddsRow] = try? await cfb
            .from("mlb_odds_snapshots")
            .select("fetched_at,bookmaker,home_ml,away_ml,home_spread,away_spread,home_spread_odds,away_spread_odds,total_line,total_over_odds,total_under_odds,f5_home_ml,f5_away_ml,f5_home_spread,f5_away_spread,f5_home_spread_odds,f5_away_spread_odds,f5_total_line,f5_total_over_odds,f5_total_under_odds")
            .eq("game_pk", value: gamePk)
            .order("fetched_at", ascending: false)
            .limit(100)
            .execute()
            .value,
        let newest = rows.compactMap(\.fetchedAt).max()
        else { return nil }

        let latest = rows.filter { $0.fetchedAt == newest }
        guard !latest.isEmpty else { return nil }
        let result = SportsbookGameOdds(
            rows: latest.map { row in
                SportsbookGameOdds.BookRow(
                    bookKey: row.bookmaker.lowercased(),
                    spreadHome: row.homeSpread,
                    spreadHomePrice: row.homeSpreadOdds,
                    spreadAway: row.awaySpread,
                    spreadAwayPrice: row.awaySpreadOdds,
                    totalPoint: row.totalLine,
                    totalOverPrice: row.totalOverOdds,
                    totalUnderPrice: row.totalUnderOdds,
                    mlHome: row.homeMl,
                    mlAway: row.awayMl,
                    f5SpreadHome: row.f5HomeSpread,
                    f5SpreadHomePrice: row.f5HomeSpreadOdds,
                    f5SpreadAway: row.f5AwaySpread,
                    f5SpreadAwayPrice: row.f5AwaySpreadOdds,
                    f5TotalPoint: row.f5TotalLine,
                    f5TotalOverPrice: row.f5TotalOverOdds,
                    f5TotalUnderPrice: row.f5TotalUnderOdds,
                    f5MlHome: row.f5HomeMl,
                    f5MlAway: row.f5AwayMl
                )
            },
            capturedAt: Self.parseDate(newest)
        )
        cache[cacheKey] = result
        return result
    }

    private static func snapshot(_ row: OddsRow) -> SportsbookGameOdds.BookRow {
        SportsbookGameOdds.BookRow(
            bookKey: row.book,
            spreadHome: row.spreadHome, spreadHomePrice: row.spreadHomePrice,
            spreadAway: row.spreadAway, spreadAwayPrice: row.spreadAwayPrice,
            totalPoint: row.totalPoint,
            totalOverPrice: row.totalOverPrice, totalUnderPrice: row.totalUnderPrice,
            mlHome: row.mlHome, mlAway: row.mlAway,
            h1SpreadHome: row.h1SpreadHome, h1SpreadHomePrice: row.h1SpreadHomePrice,
            h1SpreadAway: row.h1SpreadAway, h1SpreadAwayPrice: row.h1SpreadAwayPrice,
            h1TotalPoint: row.h1TotalPoint,
            h1TotalOverPrice: row.h1TotalOverPrice, h1TotalUnderPrice: row.h1TotalUnderPrice
        )
    }

    /// `nfl_historical_odds` stores city-form names, produced by the capture
    /// script's `to_city()`: drop the nickname, except four clubs that collapse
    /// to an ambiguous city. Mirrored here EXACTLY — a mismatch returns no rows
    /// and the board silently renders empty.
    /// See `research/nfl-extreme-outcomes/live_odds.py`.
    static func cityName(_ fullName: String) -> String {
        switch fullName {
        case "Los Angeles Chargers": return "LA Chargers"
        case "Los Angeles Rams": return "LA Rams"
        case "New York Giants": return "NY Giants"
        case "New York Jets": return "NY Jets"
        default:
            let parts = fullName.split(separator: " ")
            guard parts.count > 1 else { return fullName }
            return parts.dropLast().joined(separator: " ")
        }
    }
}

/// One snapshot of every book's prices on a game, plus the market readers that
/// turn it into an ordered board.
public struct SportsbookGameOdds: Sendable {
    public struct BookRow: Sendable {
        public let bookKey: String
        public let spreadHome: Double?
        public let spreadHomePrice: Double?
        public let spreadAway: Double?
        public let spreadAwayPrice: Double?
        public let totalPoint: Double?
        public let totalOverPrice: Double?
        public let totalUnderPrice: Double?
        public let mlHome: Double?
        public let mlAway: Double?
        public let h1SpreadHome: Double?
        public let h1SpreadHomePrice: Double?
        public let h1SpreadAway: Double?
        public let h1SpreadAwayPrice: Double?
        public let h1TotalPoint: Double?
        public let h1TotalOverPrice: Double?
        public let h1TotalUnderPrice: Double?
        public let f5SpreadHome: Double?
        public let f5SpreadHomePrice: Double?
        public let f5SpreadAway: Double?
        public let f5SpreadAwayPrice: Double?
        public let f5TotalPoint: Double?
        public let f5TotalOverPrice: Double?
        public let f5TotalUnderPrice: Double?
        public let f5MlHome: Double?
        public let f5MlAway: Double?

        public init(
            bookKey: String,
            spreadHome: Double? = nil, spreadHomePrice: Double? = nil,
            spreadAway: Double? = nil, spreadAwayPrice: Double? = nil,
            totalPoint: Double? = nil,
            totalOverPrice: Double? = nil, totalUnderPrice: Double? = nil,
            mlHome: Double? = nil, mlAway: Double? = nil,
            h1SpreadHome: Double? = nil, h1SpreadHomePrice: Double? = nil,
            h1SpreadAway: Double? = nil, h1SpreadAwayPrice: Double? = nil,
            h1TotalPoint: Double? = nil,
            h1TotalOverPrice: Double? = nil, h1TotalUnderPrice: Double? = nil,
            f5SpreadHome: Double? = nil, f5SpreadHomePrice: Double? = nil,
            f5SpreadAway: Double? = nil, f5SpreadAwayPrice: Double? = nil,
            f5TotalPoint: Double? = nil,
            f5TotalOverPrice: Double? = nil, f5TotalUnderPrice: Double? = nil,
            f5MlHome: Double? = nil, f5MlAway: Double? = nil
        ) {
            self.bookKey = bookKey
            self.spreadHome = spreadHome
            self.spreadHomePrice = spreadHomePrice
            self.spreadAway = spreadAway
            self.spreadAwayPrice = spreadAwayPrice
            self.totalPoint = totalPoint
            self.totalOverPrice = totalOverPrice
            self.totalUnderPrice = totalUnderPrice
            self.mlHome = mlHome
            self.mlAway = mlAway
            self.h1SpreadHome = h1SpreadHome
            self.h1SpreadHomePrice = h1SpreadHomePrice
            self.h1SpreadAway = h1SpreadAway
            self.h1SpreadAwayPrice = h1SpreadAwayPrice
            self.h1TotalPoint = h1TotalPoint
            self.h1TotalOverPrice = h1TotalOverPrice
            self.h1TotalUnderPrice = h1TotalUnderPrice
            self.f5SpreadHome = f5SpreadHome
            self.f5SpreadHomePrice = f5SpreadHomePrice
            self.f5SpreadAway = f5SpreadAway
            self.f5SpreadAwayPrice = f5SpreadAwayPrice
            self.f5TotalPoint = f5TotalPoint
            self.f5TotalOverPrice = f5TotalOverPrice
            self.f5TotalUnderPrice = f5TotalUnderPrice
            self.f5MlHome = f5MlHome
            self.f5MlAway = f5MlAway
        }
    }

    public let rows: [BookRow]
    public let capturedAt: Date?

    public init(rows: [BookRow], capturedAt: Date?) {
        self.rows = rows
        self.capturedAt = capturedAt
    }

    /// Every book's quote on one market, best-first.
    ///
    /// "Best" is side-dependent and is the whole reason this can't be a generic
    /// sort: an OVER wants the LOWEST total, an UNDER the highest, and a spread
    /// always wants the biggest number. Price breaks ties — at the same number,
    /// the longer American price is strictly better for the bettor.
    public func quotes(for market: SportsbookMarket) -> SportsbookMarketQuotes {
        var quotes: [SportsbookQuote] = []

        for row in rows {
            let line: Double?
            let price: Double?
            switch market {
            case .spread(let isHome):
                line = isHome ? row.spreadHome : row.spreadAway
                price = isHome ? row.spreadHomePrice : row.spreadAwayPrice
            case .total(let isOver):
                line = row.totalPoint
                price = isOver ? row.totalOverPrice : row.totalUnderPrice
            case .moneyline(let isHome):
                line = nil
                price = isHome ? row.mlHome : row.mlAway
            case .firstHalfSpread(let isHome):
                line = isHome ? row.h1SpreadHome : row.h1SpreadAway
                price = isHome ? row.h1SpreadHomePrice : row.h1SpreadAwayPrice
            case .firstHalfTotal(let isOver):
                line = row.h1TotalPoint
                price = isOver ? row.h1TotalOverPrice : row.h1TotalUnderPrice
            case .firstFiveMoneyline(let isHome):
                line = nil
                price = isHome ? row.f5MlHome : row.f5MlAway
            case .firstFiveSpread(let isHome):
                line = isHome ? row.f5SpreadHome : row.f5SpreadAway
                price = isHome ? row.f5SpreadHomePrice : row.f5SpreadAwayPrice
            case .firstFiveTotal(let isOver):
                line = row.f5TotalPoint
                price = isOver ? row.f5TotalOverPrice : row.f5TotalUnderPrice
            }

            // A book that doesn't price this market at all is omitted rather
            // than listed with dashes — BetMGM had no spread in a real snapshot.
            guard line != nil || price != nil else { continue }

            quotes.append(
                SportsbookQuote(
                    bookKey: row.bookKey,
                    bookName: SportsbookCatalog.name(for: row.bookKey),
                    line: line,
                    price: price.map { Int($0.rounded()) }
                )
            )
        }

        let wantsLowLine: Bool = {
            if case .total(let isOver) = market { return isOver }
            if case .firstHalfTotal(let isOver) = market { return isOver }
            if case .firstFiveTotal(let isOver) = market { return isOver }
            return false
        }()

        quotes.sort { lhs, rhs in
            switch (lhs.line, rhs.line) {
            case let (l?, r?) where l != r:
                return wantsLowLine ? l < r : l > r
            default:
                return (lhs.price ?? .min) > (rhs.price ?? .min)
            }
        }

        return SportsbookMarketQuotes(quotes: quotes, capturedAt: capturedAt)
    }
}
