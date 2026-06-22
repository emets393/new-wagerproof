import Foundation
import WagerproofModels

/// Navigation payload pushed when a player's prop card is tapped. Carries
/// everything `PlayerPropDetailView` needs so the detail page is
/// self-contained (no re-fetch): the player's full prop ladder set, the
/// matchup context (opposing starter + archetype) the splits annotate, plus
/// the team/opponent identity the MLB-game-style hero renders.
///
/// `Identifiable` + `Hashable` so it can drive `navigationDestination(item:)`.
struct PlayerPropSelection: Identifiable, Hashable {
    let playerId: Int
    let playerName: String
    let isPitcher: Bool
    let position: String?
    let batSide: String?

    // Team identity (for the hero aura + headshot glow + "vs OPP").
    let teamName: String
    let teamAbbr: String
    let teamLogoUrl: String?
    let opponentName: String
    let opponentAbbr: String

    // Matchup context.
    let opposingStarterName: String
    let opposingStarterHand: String
    let opposingArchetypeName: String?
    let gameTimeEt: String?
    let officialDate: String
    let gamePk: Int
    /// When set, the detail page opens on this market (feed market filter).
    let preferredMarket: String?

    /// The player's prop rows (one per market), already filtered to this
    /// player + role.
    let props: [MLBPlayerPropRow]
    /// Source id for the card→detail zoom transition.
    let transitionID: String

    var id: String { transitionID }

    /// Day/night for today's game (all the player's rows share it).
    var gameIsDay: Bool { props.first?.gameIsDay ?? false }
}
