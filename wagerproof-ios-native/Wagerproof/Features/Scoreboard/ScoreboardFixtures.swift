#if DEBUG
import Foundation
import WagerproofModels

/// Deterministic sample data for the scoreboard's parity screenshots.
/// Not used in production — gated behind `#if DEBUG`.
///
/// Mirrors a typical mid-gameday snapshot: a few NFL games (one hitting,
/// one missing, one no-prediction), an NBA game with a hitting bet, and an
/// NCAAB game with mixed signals. League ordering follows the canonical
/// LEAGUE_CONFIG order from RN: NFL → NCAAF → NBA → NCAAB.
enum ScoreboardFixtures {
    static let sampleGames: [LiveGame] = [
        nflBosNyk,
        nflLAR,
        nflMIA,
        nbaLAL,
        ncaabDuke
    ]

    private static var nflBosNyk: LiveGame {
        LiveGame(
            id: "nfl-1",
            league: "NFL",
            homeTeam: "Boston Patriots",
            awayTeam: "New York Giants",
            homeAbbr: "NE",
            awayAbbr: "NYG",
            homeScore: 24,
            awayScore: 17,
            quarter: "Q3",
            period: "Q3",
            timeRemaining: "5:42",
            isLive: true,
            gameStatus: "live",
            lastUpdated: "2026-05-20T18:00:00Z",
            predictions: GamePredictions(
                hasAnyHitting: true,
                moneyline: PredictionStatus(
                    predicted: .home,
                    isHitting: true,
                    probability: 0.62,
                    line: nil,
                    currentDifferential: 7
                ),
                spread: PredictionStatus(
                    predicted: .home,
                    isHitting: true,
                    probability: 0.58,
                    line: -3.5,
                    currentDifferential: 3.5
                ),
                overUnder: PredictionStatus(
                    predicted: .over,
                    isHitting: true,
                    probability: 0.55,
                    line: 38.5,
                    currentDifferential: 2.5
                )
            )
        )
    }

    private static var nflLAR: LiveGame {
        LiveGame(
            id: "nfl-2",
            league: "NFL",
            homeTeam: "Los Angeles Rams",
            awayTeam: "San Francisco 49ers",
            homeAbbr: "LAR",
            awayAbbr: "SF",
            homeScore: 10,
            awayScore: 20,
            quarter: "Q2",
            period: "Q2",
            timeRemaining: "2:11",
            isLive: true,
            gameStatus: "live",
            lastUpdated: "2026-05-20T18:00:00Z",
            predictions: GamePredictions(
                hasAnyHitting: false,
                moneyline: PredictionStatus(
                    predicted: .home,
                    isHitting: false,
                    probability: 0.55,
                    line: nil,
                    currentDifferential: -10
                ),
                spread: PredictionStatus(
                    predicted: .home,
                    isHitting: false,
                    probability: 0.52,
                    line: -2.5,
                    currentDifferential: -12.5
                )
            )
        )
    }

    private static var nflMIA: LiveGame {
        LiveGame(
            id: "nfl-3",
            league: "NFL",
            homeTeam: "Miami Dolphins",
            awayTeam: "Buffalo Bills",
            homeAbbr: "MIA",
            awayAbbr: "BUF",
            homeScore: 7,
            awayScore: 7,
            quarter: "Q1",
            period: "Q1",
            timeRemaining: "8:30",
            isLive: true,
            gameStatus: "live",
            lastUpdated: "2026-05-20T18:00:00Z",
            predictions: nil
        )
    }

    private static var nbaLAL: LiveGame {
        LiveGame(
            id: "nba-1",
            league: "NBA",
            homeTeam: "Los Angeles Lakers",
            awayTeam: "Boston Celtics",
            homeAbbr: "LAL",
            awayAbbr: "BOS",
            homeScore: 88,
            awayScore: 82,
            quarter: "Q4",
            period: "Q4",
            timeRemaining: "4:55",
            isLive: true,
            gameStatus: "live",
            lastUpdated: "2026-05-20T18:00:00Z",
            predictions: GamePredictions(
                hasAnyHitting: true,
                moneyline: PredictionStatus(
                    predicted: .home,
                    isHitting: true,
                    probability: 0.66,
                    line: nil,
                    currentDifferential: 6
                ),
                spread: PredictionStatus(
                    predicted: .home,
                    isHitting: true,
                    probability: 0.6,
                    line: -3.0,
                    currentDifferential: 3
                ),
                overUnder: PredictionStatus(
                    predicted: .over,
                    isHitting: false,
                    probability: 0.55,
                    line: 218.5,
                    currentDifferential: -48.5
                )
            )
        )
    }

    private static var ncaabDuke: LiveGame {
        LiveGame(
            id: "ncaab-1",
            league: "NCAAB",
            homeTeam: "Duke Blue Devils",
            awayTeam: "North Carolina Tar Heels",
            homeAbbr: "DUKE",
            awayAbbr: "UNC",
            homeScore: 45,
            awayScore: 52,
            quarter: "H2",
            period: "H2",
            timeRemaining: "12:14",
            isLive: true,
            gameStatus: "live",
            lastUpdated: "2026-05-20T18:00:00Z",
            predictions: GamePredictions(
                hasAnyHitting: false,
                moneyline: PredictionStatus(
                    predicted: .home,
                    isHitting: false,
                    probability: 0.7,
                    line: nil,
                    currentDifferential: -7
                ),
                spread: PredictionStatus(
                    predicted: .home,
                    isHitting: false,
                    probability: 0.62,
                    line: -6.5,
                    currentDifferential: -13.5
                )
            )
        )
    }
}
#endif
