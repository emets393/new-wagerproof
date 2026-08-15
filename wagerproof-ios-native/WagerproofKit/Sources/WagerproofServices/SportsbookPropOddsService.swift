import Foundation
import Supabase
import WagerproofModels

/// One player market's latest per-book board from `nfl_player_props`.
public struct SportsbookPropMarketOdds: Sendable {
    public let over: SportsbookMarketQuotes
    public let under: SportsbookMarketQuotes

    public init(over: SportsbookMarketQuotes, under: SportsbookMarketQuotes) {
        self.over = over
        self.under = under
    }
}

/// Reads real player-prop book rows keyed by the stable `player_id` + market
/// pair used by the detail screen. The bundled best-book JSON remains the
/// fallback when the historical table has no board.
public actor SportsbookPropOddsService {
    public static let shared = SportsbookPropOddsService()
    public init() {}

    private var cache: [String: SportsbookPropMarketOdds] = [:]

    private struct PropRow: Decodable {
        let bookmaker: String
        let line: Double?
        let overOdds: Double?
        let underOdds: Double?
        let snapshotTime: String?

        enum CodingKeys: String, CodingKey {
            case bookmaker, line
            case overOdds = "over_odds"
            case underOdds = "under_odds"
            case snapshotTime = "snapshot_time"
        }
    }

    public func odds(playerId: String, market: String) async -> SportsbookPropMarketOdds? {
        let cacheKey = "\(playerId)|\(market)"
        if let cached = cache[cacheKey] { return cached }

        let cfb = await CFBSupabase.shared.client
        guard let rows: [PropRow] = try? await cfb
            .from("nfl_player_props")
            .select("bookmaker,line,over_odds,under_odds,snapshot_time")
            .eq("player_id", value: playerId)
            .eq("market", value: market)
            .order("snapshot_time", ascending: false)
            .limit(250)
            .execute()
            .value,
        let newest = rows.compactMap(\.snapshotTime).max()
        else { return nil }

        // The table is one row per bookmaker per snapshot. De-dupe defensively
        // so malformed duplicate rows never render the same book twice.
        let latest = rows.filter { $0.snapshotTime == newest }
        let byBook = Dictionary(grouping: latest, by: { $0.bookmaker.lowercased() })
            .compactMap { $0.value.first }
        guard !byBook.isEmpty else { return nil }

        let capturedAt = Self.parseDate(newest)
        let over = Self.quotes(rows: byBook, isOver: true, capturedAt: capturedAt)
        let under = Self.quotes(rows: byBook, isOver: false, capturedAt: capturedAt)
        let result = SportsbookPropMarketOdds(over: over, under: under)
        cache[cacheKey] = result
        return result
    }

    private static func quotes(
        rows: [PropRow],
        isOver: Bool,
        capturedAt: Date?
    ) -> SportsbookMarketQuotes {
        var quotes = rows.compactMap { row -> SportsbookQuote? in
            let price = isOver ? row.overOdds : row.underOdds
            guard row.line != nil || price != nil else { return nil }
            let key = row.bookmaker.lowercased()
            return SportsbookQuote(
                bookKey: key,
                bookName: SportsbookCatalog.name(for: key),
                line: row.line,
                price: price.map { Int($0.rounded()) }
            )
        }

        quotes.sort { lhs, rhs in
            switch (lhs.line, rhs.line) {
            case let (l?, r?) where l != r:
                // Over clears more easily at the lower threshold; Under clears
                // more easily at the higher threshold.
                return isOver ? l < r : l > r
            default:
                return (lhs.price ?? .min) > (rhs.price ?? .min)
            }
        }
        return SportsbookMarketQuotes(quotes: quotes, capturedAt: capturedAt)
    }

    private static func parseDate(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return fractional.date(from: value) ?? plain.date(from: value)
    }
}
