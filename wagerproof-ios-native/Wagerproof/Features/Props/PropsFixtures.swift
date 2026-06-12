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

    // MARK: - NFL trend board (harness `nflPropsLoaded` / `nflPropDetail`)

    /// Compact `nfl_dryrun_props`-shaped board: two players × a few markets
    /// with consensus close lines and season game logs so the trend surfaces
    /// render. Screenshot-parity only — the app itself always fetches the
    /// live tables.
    static var nflBoard: [NFLPropPlayer] {
        func log(_ values: [Double]) -> [NFLPropRecentGame] {
            let opps = ["BAL", "MIA", "NE", "NYJ", "DEN", "KC", "ATL", "TB", "CAR", "LAC"]
            return values.enumerated().map { i, v in
                NFLPropRecentGame(opp: opps[i % opps.count], week: i + 1, actual: v)
            }
        }

        let rows: [NFLDryrunPropRow] = [
            NFLDryrunPropRow(
                gameId: "2025_12_KC_BUF", eventId: "nfl-fixture-1", season: 2025, week: 12,
                playerId: "00-0034857", playerName: "Josh Allen", position: "QB",
                team: "BUF", opponent: "KC", isHome: true,
                market: "player_pass_yds", closeLine: 262.5, overPrice: -110, underPrice: -110,
                openLine: 258.5, lineDelta: 4.0, lineRange: 6.0, nBooks: 4,
                lastGame: 280, l3Avg: 265.7, l5Avg: 254.2, l10Avg: 249.8,
                sznAvg: 251.3, sznMax: 342, sznMin: 169,
                overRateL5: 0.6, overRateL10: 0.5,
                recentGames: log([232, 274, 169, 256, 213, 342, 280, 248, 262, 280]),
                defMatchupIdx: 1.08, flags: ["P4"]
            ),
            NFLDryrunPropRow(
                gameId: "2025_12_KC_BUF", eventId: "nfl-fixture-1", season: 2025, week: 12,
                playerId: "00-0034857", playerName: "Josh Allen", position: "QB",
                team: "BUF", opponent: "KC", isHome: true,
                market: "player_rush_yds", closeLine: 38.5, overPrice: -115, underPrice: -105,
                openLine: 38.5, lineDelta: 0, lineRange: 3.0, nBooks: 4,
                lastGame: 44, l3Avg: 41.3, l5Avg: 37.8, l10Avg: 39.1,
                sznAvg: 40.2, sznMax: 84, sznMin: 12,
                overRateL5: 0.6, overRateL10: 0.5,
                recentGames: log([28, 52, 12, 44, 36, 84, 31, 47, 26, 44])
            ),
            NFLDryrunPropRow(
                gameId: "2025_12_KC_BUF", eventId: "nfl-fixture-1", season: 2025, week: 12,
                playerId: "00-0033873", playerName: "Patrick Mahomes", position: "QB",
                team: "KC", opponent: "BUF", isHome: false,
                market: "player_pass_yds", closeLine: 285.5, overPrice: -112, underPrice: -108,
                openLine: 287.5, lineDelta: -2.0, lineRange: 4.0, nBooks: 4,
                lastGame: 269, l3Avg: 278.0, l5Avg: 281.4, l10Avg: 274.6,
                sznAvg: 276.9, sznMax: 331, sznMin: 210,
                overRateL5: 0.4, overRateL10: 0.5,
                recentGames: log([291, 246, 331, 262, 210, 305, 286, 254, 269, 269])
            ),
            NFLDryrunPropRow(
                gameId: "2025_12_KC_BUF", eventId: "nfl-fixture-1", season: 2025, week: 12,
                playerId: "00-0033873", playerName: "Patrick Mahomes", position: "QB",
                team: "KC", opponent: "BUF", isHome: false,
                market: "player_anytime_td", closeLine: nil, overPrice: 460, underPrice: nil,
                nBooks: 4, closeYesProb: 0.18, openYesProb: 0.16,
                lastGame: 0, l3Avg: 0.33, l5Avg: 0.2, l10Avg: 0.2,
                sznAvg: 0.2, sznMax: 1, sznMin: 0,
                recentGames: log([0, 0, 1, 0, 0, 1, 0, 0, 0, 0])
            ),
        ]
        let games = ["2025_12_KC_BUF": NFLPropGameContext(gameDate: "2025-11-23", slot: "sun_late_sat")]
        return NFLPlayerProps.group(rows, games: games)
    }
}
#endif
