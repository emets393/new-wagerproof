#if DEBUG
import Foundation
import WagerproofModels

/// DEBUG-only sample data for the player-prop detail parity screenshot.
/// Mirrors the shape the `get_mlb_player_props_l10` RPC returns (a line
/// ladder + a season game log) so the detail view computes a real chart,
/// hit-rate, and context splits without a network round-trip.
enum PropsFixtures {
    private static func g(_ v: Double, _ d: Int, _ a: String?, _ dt: String) -> MLBPlayerPropGameEntry {
        MLBPlayerPropGameEntry(v: v, d: d, a: a, dt: dt)
    }

    /// Hits prop — fair line at 1.5, with 0.5 and 2.5 alternates.
    static var hitsRow: MLBPlayerPropRow {
        MLBPlayerPropRow(
            playerId: 592450,
            playerName: "Aaron Judge",
            isPitcher: false,
            market: "batter_hits",
            gameIsDay: false,
            oppArchetypeToday: "Power",
            lines: [
                MLBPlayerPropLineEntry(line: 0.5, over: -220, under: 170),
                MLBPlayerPropLineEntry(line: 1.5, over: 135, under: -165),
                MLBPlayerPropLineEntry(line: 2.5, over: 410, under: -550),
            ],
            games: [
                g(2, 0, "Power", "2026-06-06"),
                g(1, 1, "Control", "2026-06-05"),
                g(2, 0, "Power", "2026-06-04"),
                g(3, 0, "Finesse", "2026-06-03"),
                g(1, 1, "Power", "2026-06-02"),
                g(0, 0, "Balanced", "2026-06-01"),
                g(2, 1, "Power", "2026-05-31"),
                g(1, 0, "Groundball", "2026-05-30"),
                g(2, 0, "Power", "2026-05-29"),
                g(1, 1, "Control", "2026-05-28"),
                g(0, 0, "Flyball", "2026-05-27"),
                g(2, 1, "Power", "2026-05-26"),
                g(1, 0, "Balanced", "2026-05-25"),
                g(3, 0, "Power", "2026-05-24"),
                g(1, 1, "Finesse", "2026-05-23"),
            ]
        )
    }

    /// Total Bases prop — second market so the switcher renders.
    static var totalBasesRow: MLBPlayerPropRow {
        MLBPlayerPropRow(
            playerId: 592450,
            playerName: "Aaron Judge",
            isPitcher: false,
            market: "batter_total_bases",
            gameIsDay: false,
            oppArchetypeToday: "Power",
            lines: [
                MLBPlayerPropLineEntry(line: 1.5, over: -160, under: 125),
                MLBPlayerPropLineEntry(line: 2.5, over: 130, under: -160),
                MLBPlayerPropLineEntry(line: 3.5, over: 320, under: -420),
            ],
            games: [
                g(4, 0, "Power", "2026-06-06"),
                g(1, 1, "Control", "2026-06-05"),
                g(2, 0, "Power", "2026-06-04"),
                g(5, 0, "Finesse", "2026-06-03"),
                g(1, 1, "Power", "2026-06-02"),
                g(0, 0, "Balanced", "2026-06-01"),
                g(3, 1, "Power", "2026-05-31"),
                g(2, 0, "Groundball", "2026-05-30"),
                g(4, 0, "Power", "2026-05-29"),
                g(1, 1, "Control", "2026-05-28"),
                g(0, 0, "Flyball", "2026-05-27"),
                g(2, 1, "Power", "2026-05-26"),
                g(1, 0, "Balanced", "2026-05-25"),
                g(6, 0, "Power", "2026-05-24"),
                g(2, 1, "Finesse", "2026-05-23"),
            ]
        )
    }

    static var sampleSelection: PlayerPropSelection {
        PlayerPropSelection(
            playerId: 592450,
            playerName: "Aaron Judge",
            isPitcher: false,
            position: "RF",
            batSide: "R",
            teamName: "New York Yankees",
            teamAbbr: "NYY",
            teamLogoUrl: nil,
            opponentName: "Detroit Tigers",
            opponentAbbr: "DET",
            opposingStarterName: "Tarik Skubal",
            opposingStarterHand: "L",
            opposingArchetypeName: "Power",
            gameTimeEt: "7:05 PM",
            officialDate: "2026-05-31",
            props: [hitsRow, totalBasesRow],
            transitionID: "fixture-judge-hits"
        )
    }
}
#endif
