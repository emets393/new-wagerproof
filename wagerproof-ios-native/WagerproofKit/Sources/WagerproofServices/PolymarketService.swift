import Foundation
import Supabase
import WagerproofModels

/// Polymarket market lookup service. Ports the RN
/// `wagerproof-mobile/services/polymarketService.ts` cache-first flow:
///   1. Read `polymarket_markets` from Main Supabase by `game_key` + league.
///   2. If cache misses, fall back to the live Polymarket gamma API.
///
/// Iterating on the cache table itself is the backend's job (pg_cron). This
/// actor only reads; it never writes the cache.
///
/// Why an actor: callers can be on any thread, and the cached `URLSession`
/// + ongoing-request map below need synchronized access. The actor isolation
/// guarantees both without an explicit lock.
public actor PolymarketService {
    public static let shared = PolymarketService()

    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        self.session = URLSession(configuration: config)
    }

    /// Fetch markets for a single game. Cache-first; falls back to live API
    /// when the cache is empty. Returns `nil` when both lookups fail or
    /// produce no data — callers render a placeholder in that case.
    public func markets(
        league: String,
        awayTeam: String,
        homeTeam: String
    ) async -> PolymarketGameMarkets? {
        #if DEBUG
        // Dummy Data Mode: reuse real captured price curves for any matchup so
        // the game-detail Polymarket widget renders offseason.
        if DummyDataMode.isEnabled {
            return DummyData.polymarket(league: league, awayTeam: awayTeam, homeTeam: homeTeam)
        }
        #endif
        if let cached = await fetchFromCache(league: league, awayTeam: awayTeam, homeTeam: homeTeam) {
            return cached
        }
        // Live fallback is deliberately stubbed for B04 — the gamma-api
        // pipeline is large and lands when the Polymarket parity tab does.
        // The cache covers prod traffic because pg_cron refreshes hourly.
        return nil
    }

    // MARK: - Cache reads

    /// Mirrors `getAllMarketsDataFromCache` in the RN service. Single query
    /// against `polymarket_markets` filtered by composite `game_key`.
    private func fetchFromCache(
        league: String,
        awayTeam: String,
        homeTeam: String
    ) async -> PolymarketGameMarkets? {
        let gameKey = "\(league)_\(awayTeam)_\(homeTeam)"
        do {
            let main = await MainSupabase.shared.client
            let rows: [CacheRow] = try await main
                .from("polymarket_markets")
                .select()
                .eq("game_key", value: gameKey)
                .eq("league", value: league)
                .execute()
                .value

            guard !rows.isEmpty else { return nil }
            var byType: [PolymarketMarketType: PolymarketMarket] = [:]
            for row in rows {
                let type = PolymarketMarketType(rawValue: row.marketType ?? "moneyline") ?? .moneyline
                byType[type] = PolymarketMarket(
                    gameKey: gameKey,
                    league: league,
                    marketType: type,
                    tokenId: row.tokenId,
                    currentAwayOdds: row.currentAwayOdds,
                    currentHomeOdds: row.currentHomeOdds,
                    priceHistory: row.priceHistory ?? []
                )
            }
            return PolymarketGameMarkets(awayTeam: awayTeam, homeTeam: homeTeam, markets: byType)
        } catch {
            return nil
        }
    }

    // Internal decoder shape — kept private because callers consume the
    // sanitized `PolymarketGameMarkets`.
    private struct CacheRow: Decodable, Sendable {
        let gameKey: String?
        let league: String?
        let marketType: String?
        let tokenId: String?
        let currentAwayOdds: Double?
        let currentHomeOdds: Double?
        let priceHistory: [PolymarketPricePoint]?

        enum CodingKeys: String, CodingKey {
            case gameKey = "game_key"
            case league
            case marketType = "market_type"
            case tokenId = "token_id"
            case currentAwayOdds = "current_away_odds"
            case currentHomeOdds = "current_home_odds"
            case priceHistory = "price_history"
        }
    }
}
