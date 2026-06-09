import Foundation
import WagerproofModels

/// One player-specific item in the Props feed. Carries the headline prop for
/// the card plus the full `PlayerPropSelection` for the detail push. The feed
/// is flat (one card per player), so the matchup's starters + lineups are
/// flattened into these items with each player's team/opponent resolved.
struct PlayerPropFeedItem: Identifiable {
    let selection: PlayerPropSelection
    let headline: MLBHeadlineProp
    /// Team palette for the headshot glow + hero aura.
    let teamPrimaryHex: UInt32
    let teamSecondaryHex: UInt32
    /// Batting order (nil for pitchers / unlisted batters) — shown as "1. Name".
    let lineOrder: Int?

    var id: String { selection.transitionID }

    // Sort keys.
    var sortDate: String { selection.officialDate }
    var sortTime: String { selection.gameTimeEt ?? "" }
    var hitRate: Double {
        let l10 = headline.computed.l10
        return l10.games > 0 ? Double(l10.over) / Double(l10.games) : -1
    }
}

enum PlayerPropFeed {
    /// Flatten a slate of matchups into per-player feed items. Pitchers come
    /// first (K-anchored), then each lineup batter, then posted-but-unlisted
    /// batters. Players without a headline prop are dropped.
    static func items(from matchups: [MLBPropMatchup]) -> [PlayerPropFeedItem] {
        var out: [PlayerPropFeedItem] = []
        for m in matchups {
            // Starters (pitchers) — prioritise the strikeouts market.
            out.append(contentsOf: starterItem(m, starter: m.awayStarter, isAway: true))
            out.append(contentsOf: starterItem(m, starter: m.homeStarter, isAway: false))

            // Batting orders.
            for row in m.awayLineup {
                out.append(contentsOf: batterItem(m, row: row, isAway: true))
            }
            for row in m.homeLineup {
                out.append(contentsOf: batterItem(m, row: row, isAway: false))
            }

            // Posted batters not in either lineup — team unknown.
            for group in m.extraBatterGroups {
                guard let headline = MLBPlayerProps.pickHeadlineProp(group.props) else { continue }
                let name = group.props.first?.playerName ?? "Player"
                let sel = PlayerPropSelection(
                    playerId: group.playerId,
                    playerName: name,
                    isPitcher: false,
                    position: nil,
                    batSide: nil,
                    teamName: "",
                    teamAbbr: "",
                    teamLogoUrl: nil,
                    opponentName: "",
                    opponentAbbr: "",
                    opposingStarterName: "opposing starter",
                    opposingStarterHand: "R",
                    opposingArchetypeName: nil,
                    gameTimeEt: m.gameTimeEt,
                    officialDate: m.officialDate,
                    props: group.props,
                    transitionID: "prop-\(m.gamePk)-\(group.playerId)-batter"
                )
                let colors = MLBTeams.colors(for: "")
                out.append(PlayerPropFeedItem(
                    selection: sel, headline: headline,
                    teamPrimaryHex: colors.primary, teamSecondaryHex: colors.secondary,
                    lineOrder: nil
                ))
            }
        }
        return out
    }

    // MARK: - Per-player builders

    private static func starterItem(_ m: MLBPropMatchup, starter: MLBPropStarter, isAway: Bool) -> [PlayerPropFeedItem] {
        let myProps = m.pitcherProps(for: starter.pitcherId)
        let kProps = myProps.filter { $0.market == "pitcher_strikeouts" }
        guard let headline = MLBPlayerProps.pickHeadlineProp(kProps.isEmpty ? myProps : kProps) else { return [] }
        let opp = isAway ? m.homeStarter : m.awayStarter
        let sel = PlayerPropSelection(
            playerId: starter.pitcherId,
            playerName: starter.name,
            isPitcher: true,
            position: "\(starter.hand)HP",
            batSide: nil,
            teamName: isAway ? m.awayTeamName : m.homeTeamName,
            teamAbbr: isAway ? m.awayAbbr : m.homeAbbr,
            teamLogoUrl: isAway ? m.awayLogoUrl : m.homeLogoUrl,
            opponentName: isAway ? m.homeTeamName : m.awayTeamName,
            opponentAbbr: isAway ? m.homeAbbr : m.awayAbbr,
            opposingStarterName: opp.name,
            opposingStarterHand: opp.hand,
            opposingArchetypeName: nil,
            gameTimeEt: m.gameTimeEt,
            officialDate: m.officialDate,
            props: myProps,
            transitionID: "prop-\(m.gamePk)-\(starter.pitcherId)-pitcher"
        )
        let colors = MLBTeams.colors(for: isAway ? m.awayTeamName : m.homeTeamName)
        return [PlayerPropFeedItem(
            selection: sel, headline: headline,
            teamPrimaryHex: colors.primary, teamSecondaryHex: colors.secondary,
            lineOrder: nil
        )]
    }

    private static func batterItem(_ m: MLBPropMatchup, row: MLBLineupRow, isAway: Bool) -> [PlayerPropFeedItem] {
        let myProps = m.batterProps(for: row.playerId)
        guard let headline = MLBPlayerProps.pickHeadlineProp(myProps) else { return [] }
        let opp = isAway ? m.homeStarter : m.awayStarter
        let sel = PlayerPropSelection(
            playerId: row.playerId,
            playerName: row.playerName,
            isPitcher: false,
            position: row.position,
            batSide: row.batSide,
            teamName: isAway ? m.awayTeamName : m.homeTeamName,
            teamAbbr: isAway ? m.awayAbbr : m.homeAbbr,
            teamLogoUrl: isAway ? m.awayLogoUrl : m.homeLogoUrl,
            opponentName: isAway ? m.homeTeamName : m.awayTeamName,
            opponentAbbr: isAway ? m.homeAbbr : m.awayAbbr,
            opposingStarterName: opp.name,
            opposingStarterHand: opp.hand,
            opposingArchetypeName: opp.archetype?.archetype,
            gameTimeEt: m.gameTimeEt,
            officialDate: m.officialDate,
            props: myProps,
            transitionID: "prop-\(m.gamePk)-\(row.playerId)-batter"
        )
        let colors = MLBTeams.colors(for: isAway ? m.awayTeamName : m.homeTeamName)
        return [PlayerPropFeedItem(
            selection: sel, headline: headline,
            teamPrimaryHex: colors.primary, teamSecondaryHex: colors.secondary,
            lineOrder: row.battingOrder
        )]
    }
}
