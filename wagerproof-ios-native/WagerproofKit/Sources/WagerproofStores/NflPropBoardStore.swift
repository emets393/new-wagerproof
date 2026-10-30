import Foundation
import Observation
import WagerproofModels
import WagerproofServices

@Observable
@MainActor
public final class NflPropBoardStore {
    public private(set) var season = 0
    public private(set) var week = 0
    public private(set) var pages: [NFLPropPlayerPage] = []
    public private(set) var spotlight: [NflPropSpotlightRow] = []
    public private(set) var ledger: [NflPropSpotlightRow] = []
    public private(set) var books: [String: NflPropBookQuote] = [:]
    public private(set) var slate: [NflSlateContextLine] = []
    public private(set) var cheat: [NflCheatRow] = []
    public private(set) var isLoading = false
    public private(set) var errorMessage: String?

    private var loadedAt: Date?
    private let ttl: TimeInterval = 300

    public init() {}

    public var summary: NflLedgerSummary { NflPropRecord.summarize(ledger) }
    public var trenches: [NflTrenchRow] { NflCheatSheetMath.trenchRows(from: pages) }

    public func page(id: String) -> NFLPropPlayerPage? {
        pages.first { $0.playerId == id }
    }

    public func spotlight(playerId: String, market: String) -> NflPropSpotlightRow? {
        spotlight.first { $0.playerId == playerId && $0.market == market }
    }

    public func quote(playerId: String, market: String) -> NflPropBookQuote? {
        books["\(playerId):\(market)"]
    }

    public func refresh(force: Bool = false) async {
        if !force, let loadedAt, Date().timeIntervalSince(loadedAt) < ttl, !pages.isEmpty { return }
        if isLoading { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let payload = try await NflPropBoardService.shared.load()
            season = payload.season
            week = payload.week
            pages = payload.pages
            spotlight = payload.spotlight
            ledger = payload.ledger
            var map: [String: NflPropBookQuote] = [:]
            for quote in payload.books where !quote.playerId.isEmpty && !quote.market.isEmpty {
                map[quote.key] = quote
            }
            books = map
            slate = payload.slate
            cheat = payload.cheat
            loadedAt = Date()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
