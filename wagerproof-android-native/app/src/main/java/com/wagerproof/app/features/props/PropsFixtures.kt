package com.wagerproof.app.features.props

import com.wagerproof.core.models.MLBPlayerPropGameEntry
import com.wagerproof.core.models.MLBPlayerPropLineEntry
import com.wagerproof.core.models.MLBPlayerPropRow
import com.wagerproof.core.models.NFLDryrunPropRow
import com.wagerproof.core.models.NFLPlayerProps
import com.wagerproof.core.models.NFLPropGameContext
import com.wagerproof.core.models.NFLPropPlayer
import com.wagerproof.core.models.NFLPropRecentGame

/**
 * Debug-only sample data for the player-prop parity screenshots. Mirrors the
 * shape `get_mlb_player_props_l10` / `nfl_dryrun_props` return so the detail
 * views compute a real chart, hit-rate, and context splits without a network
 * round-trip. Seed via [PropsStore.debugSetNflPlayers]. Port of iOS
 * `PropsFixtures.swift`.
 */
object PropsFixtures {

    private fun g(v: Double, d: Int, a: String?, dt: String): MLBPlayerPropGameEntry =
        MLBPlayerPropGameEntry(v = v, d = d, a = a, dt = dt)

    val hitsRow: MLBPlayerPropRow
        get() = MLBPlayerPropRow.of(
            playerId = 592450,
            playerName = "Aaron Judge",
            isPitcher = false,
            market = "batter_hits",
            gameIsDay = false,
            oppArchetypeToday = "Power",
            lines = listOf(
                MLBPlayerPropLineEntry(line = 0.5, over = -220, under = 170),
                MLBPlayerPropLineEntry(line = 1.5, over = 135, under = -165),
                MLBPlayerPropLineEntry(line = 2.5, over = 410, under = -550),
            ),
            games = listOf(
                g(2.0, 0, "Power", "2026-06-06"),
                g(1.0, 1, "Control", "2026-06-05"),
                g(2.0, 0, "Power", "2026-06-04"),
                g(3.0, 0, "Finesse", "2026-06-03"),
                g(1.0, 1, "Power", "2026-06-02"),
                g(0.0, 0, "Balanced", "2026-06-01"),
                g(2.0, 1, "Power", "2026-05-31"),
                g(1.0, 0, "Groundball", "2026-05-30"),
                g(2.0, 0, "Power", "2026-05-29"),
                g(1.0, 1, "Control", "2026-05-28"),
                g(0.0, 0, "Flyball", "2026-05-27"),
                g(2.0, 1, "Power", "2026-05-26"),
                g(1.0, 0, "Balanced", "2026-05-25"),
                g(3.0, 0, "Power", "2026-05-24"),
                g(1.0, 1, "Finesse", "2026-05-23"),
            ),
        )

    val totalBasesRow: MLBPlayerPropRow
        get() = MLBPlayerPropRow.of(
            playerId = 592450,
            playerName = "Aaron Judge",
            isPitcher = false,
            market = "batter_total_bases",
            gameIsDay = false,
            oppArchetypeToday = "Power",
            lines = listOf(
                MLBPlayerPropLineEntry(line = 1.5, over = -160, under = 125),
                MLBPlayerPropLineEntry(line = 2.5, over = 130, under = -160),
                MLBPlayerPropLineEntry(line = 3.5, over = 320, under = -420),
            ),
            games = listOf(
                g(4.0, 0, "Power", "2026-06-06"),
                g(1.0, 1, "Control", "2026-06-05"),
                g(2.0, 0, "Power", "2026-06-04"),
                g(5.0, 0, "Finesse", "2026-06-03"),
                g(1.0, 1, "Power", "2026-06-02"),
                g(0.0, 0, "Balanced", "2026-06-01"),
                g(3.0, 1, "Power", "2026-05-31"),
                g(2.0, 0, "Groundball", "2026-05-30"),
                g(4.0, 0, "Power", "2026-05-29"),
                g(1.0, 1, "Control", "2026-05-28"),
                g(0.0, 0, "Flyball", "2026-05-27"),
                g(2.0, 1, "Power", "2026-05-26"),
                g(1.0, 0, "Balanced", "2026-05-25"),
                g(6.0, 0, "Power", "2026-05-24"),
                g(2.0, 1, "Finesse", "2026-05-23"),
            ),
        )

    val sampleSelection: PlayerPropSelection
        get() = PlayerPropSelection(
            playerId = 592450,
            playerName = "Aaron Judge",
            isPitcher = false,
            position = "RF",
            batSide = "R",
            teamName = "New York Yankees",
            teamAbbr = "NYY",
            teamLogoUrl = null,
            opponentName = "Detroit Tigers",
            opponentAbbr = "DET",
            opposingStarterName = "Tarik Skubal",
            opposingStarterHand = "L",
            opposingArchetypeName = "Power",
            gameTimeEt = "7:05 PM",
            officialDate = "2026-05-31",
            gamePk = 777001,
            preferredMarket = null,
            props = listOf(hitsRow, totalBasesRow),
            transitionID = "fixture-judge-hits",
        )

    val nflBoard: List<NFLPropPlayer>
        get() {
            fun log(values: List<Double>): List<NFLPropRecentGame> {
                val opps = listOf("BAL", "MIA", "NE", "NYJ", "DEN", "KC", "ATL", "TB", "CAR", "LAC")
                return values.mapIndexed { i, v -> NFLPropRecentGame(opp = opps[i % opps.size], week = i + 1, actual = v) }
            }
            val rows = listOf(
                NFLDryrunPropRow(
                    gameId = "2025_12_KC_BUF", eventId = "nfl-fixture-1", season = 2025, week = 12,
                    playerId = "00-0034857", playerName = "Josh Allen", position = "QB",
                    team = "BUF", opponent = "KC", isHome = true,
                    market = "player_pass_yds", closeLine = 262.5, overPrice = -110.0, underPrice = -110.0,
                    openLine = 258.5, lineDelta = 4.0, lineRange = 6.0, nBooks = 4,
                    lastGame = 280.0, l3Avg = 265.7, l5Avg = 254.2, l10Avg = 249.8,
                    sznAvg = 251.3, sznMax = 342.0, sznMin = 169.0,
                    overRateL5 = 0.6, overRateL10 = 0.5,
                    recentGames = log(listOf(232.0, 274.0, 169.0, 256.0, 213.0, 342.0, 280.0, 248.0, 262.0, 280.0)),
                    defMatchupIdx = 1.08, flags = listOf("P1"),
                    bestOverBook = "draftkings", bestOverBookName = "DraftKings",
                    bestOverLine = 262.5, bestOverPrice = -110.0,
                    bestUnderBook = "fanduel", bestUnderBookName = "FanDuel",
                    bestUnderLine = 262.5, bestUnderPrice = -105.0,
                ),
                NFLDryrunPropRow(
                    gameId = "2025_12_KC_BUF", eventId = "nfl-fixture-1", season = 2025, week = 12,
                    playerId = "00-0034857", playerName = "Josh Allen", position = "QB",
                    team = "BUF", opponent = "KC", isHome = true,
                    market = "player_rush_yds", closeLine = 38.5, overPrice = -115.0, underPrice = -105.0,
                    openLine = 38.5, lineDelta = 0.0, lineRange = 3.0, nBooks = 4,
                    lastGame = 44.0, l3Avg = 41.3, l5Avg = 37.8, l10Avg = 39.1,
                    sznAvg = 40.2, sznMax = 84.0, sznMin = 12.0,
                    overRateL5 = 0.6, overRateL10 = 0.5,
                    recentGames = log(listOf(28.0, 52.0, 12.0, 44.0, 36.0, 84.0, 31.0, 47.0, 26.0, 44.0)),
                    bestOverBook = "betmgm", bestOverBookName = "BetMGM",
                    bestOverLine = 38.5, bestOverPrice = -118.0,
                    bestUnderBook = "draftkings", bestUnderBookName = "DraftKings",
                    bestUnderLine = 39.5, bestUnderPrice = -105.0,
                ),
                NFLDryrunPropRow(
                    gameId = "2025_12_KC_BUF", eventId = "nfl-fixture-1", season = 2025, week = 12,
                    playerId = "00-0033873", playerName = "Patrick Mahomes", position = "QB",
                    team = "KC", opponent = "BUF", isHome = false,
                    market = "player_pass_yds", closeLine = 285.5, overPrice = -112.0, underPrice = -108.0,
                    openLine = 287.5, lineDelta = -2.0, lineRange = 4.0, nBooks = 4,
                    lastGame = 269.0, l3Avg = 278.0, l5Avg = 281.4, l10Avg = 274.6,
                    sznAvg = 276.9, sznMax = 331.0, sznMin = 210.0,
                    overRateL5 = 0.4, overRateL10 = 0.5,
                    recentGames = log(listOf(291.0, 246.0, 331.0, 262.0, 210.0, 305.0, 286.0, 254.0, 269.0, 269.0)),
                ),
                NFLDryrunPropRow(
                    gameId = "2025_12_KC_BUF", eventId = "nfl-fixture-1", season = 2025, week = 12,
                    playerId = "00-0033873", playerName = "Patrick Mahomes", position = "QB",
                    team = "KC", opponent = "BUF", isHome = false,
                    market = "player_anytime_td", closeLine = null, overPrice = 460.0, underPrice = null,
                    nBooks = 4, closeYesProb = 0.18, openYesProb = 0.16,
                    lastGame = 0.0, l3Avg = 0.33, l5Avg = 0.2, l10Avg = 0.2,
                    sznAvg = 0.2, sznMax = 1.0, sznMin = 0.0,
                    recentGames = log(listOf(0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0)),
                    flags = listOf("P5"),
                ),
            )
            val games = mapOf("2025_12_KC_BUF" to NFLPropGameContext(gameDate = "2025-11-23", slot = "sun_late_sat"))
            return NFLPlayerProps.group(rows, games)
        }
}
