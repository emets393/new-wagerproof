import Foundation

/// Polymarket market cache row. Mirrors the RN `polymarket_markets` table in
/// Main Supabase (game_key format `{league}_{away_team}_{home_team}`).
/// Backed by a `pg_cron`-refreshed cache; `PolymarketService` falls back to
/// `gamma-api.polymarket.com` when the cache misses.
///
/// `priceHistory` is a JSONB array of `{t, p}` rows where `t` is a unix
/// timestamp (seconds) and `p` is the YES-token price (0.0–1.0).
public struct PolymarketMarket: Codable, Hashable, Sendable, Identifiable {
    public let gameKey: String
    public let league: String
    public let marketType: PolymarketMarketType
    public let tokenId: String?
    public let currentAwayOdds: Double?
    public let currentHomeOdds: Double?
    public let priceHistory: [PolymarketPricePoint]

    public var id: String { "\(gameKey)#\(marketType.rawValue)" }

    public init(
        gameKey: String,
        league: String,
        marketType: PolymarketMarketType,
        tokenId: String? = nil,
        currentAwayOdds: Double? = nil,
        currentHomeOdds: Double? = nil,
        priceHistory: [PolymarketPricePoint] = []
    ) {
        self.gameKey = gameKey
        self.league = league
        self.marketType = marketType
        self.tokenId = tokenId
        self.currentAwayOdds = currentAwayOdds
        self.currentHomeOdds = currentHomeOdds
        self.priceHistory = priceHistory
    }

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

public enum PolymarketMarketType: String, Codable, CaseIterable, Sendable, Hashable {
    case moneyline
    case spread
    case total

    public var displayLabel: String {
        switch self {
        case .moneyline: return "Moneyline"
        case .spread: return "Spread"
        case .total: return "Total"
        }
    }
}

/// A single Polymarket price observation. `t` is unix seconds, `p` is the
/// price of the YES outcome on the away-team token (0.0–1.0). The home odds
/// are `1 - p`. Decoded as a tuple-style JSON object `{"t": 1700000000, "p": 0.55}`.
public struct PolymarketPricePoint: Codable, Hashable, Sendable {
    public let t: Int
    public let p: Double

    public init(t: Int, p: Double) {
        self.t = t
        self.p = p
    }
}

/// The bundle of markets returned for a single game. `awayTeam` + `homeTeam`
/// are echoed so the caller can render labels without re-parsing the
/// `game_key`. `markets` is keyed by market type to mirror RN's
/// `PolymarketAllMarketsData` shape.
public struct PolymarketGameMarkets: Sendable, Hashable {
    public let awayTeam: String
    public let homeTeam: String
    public let markets: [PolymarketMarketType: PolymarketMarket]

    public init(awayTeam: String, homeTeam: String, markets: [PolymarketMarketType: PolymarketMarket]) {
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.markets = markets
    }

    public var moneyline: PolymarketMarket? { markets[.moneyline] }
    public var spread: PolymarketMarket? { markets[.spread] }
    public var total: PolymarketMarket? { markets[.total] }
}
