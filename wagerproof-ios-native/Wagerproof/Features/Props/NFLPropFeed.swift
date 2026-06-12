import Foundation
import WagerproofModels

/// Navigation payload pushed when an NFL prop card is tapped. The grouped
/// `NFLPropPlayer` already carries every market's line, prices, and trend
/// data, so the detail page is self-contained (no re-fetch) — same contract
/// as the MLB `PlayerPropSelection`.
struct NFLPlayerPropSelection: Identifiable, Hashable {
    let player: NFLPropPlayer
    /// Source id for the card→detail zoom transition.
    let transitionID: String

    var id: String { transitionID }
}

/// One player card in the NFL props feed. The dry-run contract carries a
/// season game log per market, so NFL gets the same hit-rate sort the MLB
/// feed has.
struct NFLPropFeedItem: Identifiable {
    let player: NFLPropPlayer
    let selection: NFLPlayerPropSelection

    var id: String { selection.transitionID }

    // Sort keys (same shape PropsView's MLB sorting uses).
    var sortDate: String { player.gameDate }
    var sortTime: String { player.sortKey }
    /// Headline market's L10 hit rate vs the close line; -1 sorts no-data last.
    var hitRate: Double { player.headlineMarket?.l10HitRate ?? -1 }
}

enum NFLPropFeed {
    /// One card per player — the service already grouped rows per player and
    /// ordered markets by priority. Players without any market are dropped.
    static func items(from players: [NFLPropPlayer]) -> [NFLPropFeedItem] {
        players.compactMap { player in
            guard player.headlineMarket != nil else { return nil }
            let selection = NFLPlayerPropSelection(
                player: player,
                transitionID: "nflprop-\(player.id)"
            )
            return NFLPropFeedItem(player: player, selection: selection)
        }
    }
}
