package com.wagerproof.app.features.scoreboard

import com.wagerproof.core.models.GamePredictions
import com.wagerproof.core.models.LiveGame
import com.wagerproof.core.models.PredictionStatus

/**
 * Deterministic scoreboard fixtures for the screenshot harness / previews. iOS
 * `Scoreboard/ScoreboardFixtures`. Five games: hitting NFL, missing NFL,
 * no-prediction NFL, NBA mixed, NCAAB missing.
 */
object ScoreboardFixtures {

    private fun ps(
        pick: PredictionStatus.Pick,
        hitting: Boolean,
        prob: Double,
        line: Double?,
    ) = PredictionStatus(
        predicted = pick,
        isHitting = hitting,
        probability = prob,
        line = line,
        currentDifferential = 0.0,
    )

    val sampleGames: List<LiveGame> = listOf(
        LiveGame(
            id = "1", league = "NFL", homeTeam = "Boston", awayTeam = "New York",
            homeAbbr = "BOS", awayAbbr = "NYK", homeScore = 24, awayScore = 17,
            quarter = "Q3", period = "Q3", timeRemaining = "5:42", isLive = true,
            gameStatus = "live", lastUpdated = "2026-05-20T10:00:00Z",
            predictions = GamePredictions(
                hasAnyHitting = true,
                spread = ps(PredictionStatus.Pick.HOME, true, 0.65, -3.5),
                overUnder = ps(PredictionStatus.Pick.OVER, true, 0.60, 38.5),
            ),
        ),
        LiveGame(
            id = "2", league = "NFL", homeTeam = "Green Bay", awayTeam = "Chicago",
            homeAbbr = "GB", awayAbbr = "CHI", homeScore = 10, awayScore = 21,
            quarter = "Q2", period = "Q2", timeRemaining = "2:10", isLive = true,
            gameStatus = "live", lastUpdated = "2026-05-20T10:00:00Z",
            predictions = GamePredictions(
                hasAnyHitting = false,
                moneyline = ps(PredictionStatus.Pick.HOME, false, 0.58, null),
                spread = ps(PredictionStatus.Pick.HOME, false, 0.55, -6.5),
            ),
        ),
        LiveGame(
            id = "3", league = "NFL", homeTeam = "Dallas", awayTeam = "Philadelphia",
            homeAbbr = "DAL", awayAbbr = "PHI", homeScore = 0, awayScore = 0,
            quarter = "Q1", period = "Q1", timeRemaining = "12:00", isLive = true,
            gameStatus = "live", lastUpdated = "2026-05-20T10:00:00Z",
            predictions = null,
        ),
        LiveGame(
            id = "4", league = "NBA", homeTeam = "Los Angeles", awayTeam = "Miami",
            homeAbbr = "LAL", awayAbbr = "MIA", homeScore = 88, awayScore = 91,
            quarter = "Q4", period = "Q4", timeRemaining = "3:20", isLive = true,
            gameStatus = "live", lastUpdated = "2026-05-20T10:00:00Z",
            predictions = GamePredictions(
                hasAnyHitting = true,
                moneyline = ps(PredictionStatus.Pick.AWAY, true, 0.62, null),
                spread = ps(PredictionStatus.Pick.AWAY, false, 0.54, 4.5),
                overUnder = ps(PredictionStatus.Pick.OVER, true, 0.59, 224.5),
            ),
        ),
        LiveGame(
            id = "5", league = "NCAAB", homeTeam = "Duke", awayTeam = "Kansas",
            homeAbbr = "DUKE", awayAbbr = "KU", homeScore = 45, awayScore = 42,
            quarter = "H2", period = "H2", timeRemaining = "8:15", isLive = true,
            gameStatus = "live", lastUpdated = "2026-05-20T10:00:00Z",
            predictions = null,
        ),
    )
}
