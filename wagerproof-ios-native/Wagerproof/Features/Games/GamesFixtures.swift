#if DEBUG
import Foundation
import WagerproofModels

/// Deterministic sample data used by parity-screenshot capture for the
/// Games tab. Gated behind `#if DEBUG`. Mirrors a typical mid-week snapshot
/// with NFL games (one strong model pick, one with weather) plus a couple
/// of CFB games.
enum GamesFixtures {
    private static let consensusAvatars = [
        ConsensusAvatar(
            avatarId: "fixture-agent-1",
            name: "Line Hawk",
            spriteIndexOverride: 7,
            color: "gradient:#3B82F6,#06B6D4"
        ),
        ConsensusAvatar(
            avatarId: "fixture-agent-2",
            name: "Sharp Edge",
            spriteIndexOverride: 3,
            color: "#EF4444"
        ),
        ConsensusAvatar(
            avatarId: "fixture-agent-3",
            name: "Trend Spotter",
            spriteIndexOverride: nil,
            color: "#10B981"
        ),
        ConsensusAvatar(
            avatarId: "fixture-agent-4",
            name: "Value Hunter",
            spriteIndexOverride: nil,
            color: "gradient:#F97316,#FACC15"
        ),
    ]

    /// Both consensus treatments are represented so simulator QA proves the
    /// football adapters render the same feature MLB does: a flagged CONSENSUS
    /// row and a quieter split one. Every fixture carries `marketAgents` /
    /// `marketLabel` / runner-up / slate rank, because those drive the copy and
    /// a fixture without them only ever exercises the legacy fallback.
    static let nflConsensus: [String: GameAgentConsensus] = [
        "nfl-fixture-1": GameAgentConsensus(
            gameId: "nfl-fixture-1",
            gameDate: "2026-09-14",
            agents: 18,
            side: "Philadelphia -3.5",
            sideAgents: 13,
            marketAgents: 15,
            marketLabel: "spread",
            agreement: 13.0 / 15.0,
            threshold: 8,
            flagged: true,
            runnerUpSide: "Dallas +3.5",
            runnerUpAgents: 2,
            slateRank: 1,
            slateGames: 6,
            avatars: consensusAvatars
        ),
        "nfl-fixture-2": GameAgentConsensus(
            gameId: "nfl-fixture-2",
            gameDate: "2026-09-14",
            agents: 11,
            side: "Under 53",
            sideAgents: 5,
            marketAgents: 11,
            marketLabel: "total",
            agreement: 5.0 / 11.0,
            threshold: 8,
            flagged: false,
            runnerUpSide: "Over 53",
            runnerUpAgents: 4,
            slateRank: 4,
            slateGames: 6,
            avatars: consensusAvatars
        ),
    ]

    static let cfbConsensus: [String: GameAgentConsensus] = [
        "cfb-fixture-1": GameAgentConsensus(
            gameId: "cfb-fixture-1",
            gameDate: "2026-11-28",
            agents: 21,
            side: "Under 51.5",
            sideAgents: 15,
            marketAgents: 17,
            marketLabel: "total",
            agreement: 15.0 / 17.0,
            threshold: 8,
            flagged: true,
            runnerUpSide: "Over 51.5",
            runnerUpAgents: 2,
            slateRank: 1,
            slateGames: 5,
            avatars: consensusAvatars
        ),
        "cfb-fixture-2": GameAgentConsensus(
            gameId: "cfb-fixture-2",
            gameDate: "2026-09-26",
            agents: 9,
            side: "Georgia -1.5",
            sideAgents: 4,
            marketAgents: 9,
            marketLabel: "spread",
            agreement: 4.0 / 9.0,
            threshold: 8,
            flagged: false,
            runnerUpSide: "Clemson +1.5",
            runnerUpAgents: 3,
            slateRank: 3,
            slateGames: 5,
            avatars: consensusAvatars
        ),
    ]

    static let sampleNFL: [NFLPrediction] = [
        NFLPrediction(
            id: "nfl-fixture-1",
            awayTeam: "Dallas Cowboys",
            homeTeam: "Philadelphia Eagles",
            homeMl: -180,
            awayMl: 150,
            homeSpread: -3.5,
            awaySpread: 3.5,
            overLine: 48.5,
            gameDate: "2026-09-14",
            gameTime: "2026-09-14T20:20:00Z",
            trainingKey: "nfl-fixture-1",
            uniqueId: "nfl-fixture-1",
            homeAwayMlProb: 0.65,
            homeAwaySpreadCoverProb: 0.72,
            ouResultProb: 0.58,
            runId: "fixture",
            temperature: 68,
            precipitation: 10,
            windSpeed: 8,
            icon: "partly-cloudy",
            spreadSplitsLabel: "Sharp",
            totalSplitsLabel: nil,
            mlSplitsLabel: nil,
            homeMlHandle: "0.58",
            awayMlHandle: "0.42",
            homeMlBets: "0.55",
            awayMlBets: "0.45",
            homeSpreadHandle: "0.60",
            awaySpreadHandle: "0.40",
            homeSpreadBets: "0.62",
            awaySpreadBets: "0.38",
            overHandle: "0.52",
            underHandle: "0.48",
            overBets: "0.50",
            underBets: "0.50",
            fgSpreadClose: -3.5,
            fgTotalClose: 48.5,
            fgSpreadPick: "HOME",
            fgTotalPick: "OVER"
        ),
        NFLPrediction(
            id: "nfl-fixture-2",
            awayTeam: "Kansas City Chiefs",
            homeTeam: "Buffalo Bills",
            homeMl: -110,
            awayMl: -110,
            homeSpread: -1.5,
            awaySpread: 1.5,
            overLine: 53.0,
            gameDate: "2026-09-14",
            gameTime: "2026-09-14T17:00:00Z",
            trainingKey: "nfl-fixture-2",
            uniqueId: "nfl-fixture-2",
            homeAwayMlProb: 0.52,
            homeAwaySpreadCoverProb: 0.48,
            ouResultProb: 0.83,
            runId: "fixture",
            temperature: 42,
            precipitation: 0,
            windSpeed: 16,
            icon: "windy",
            spreadSplitsLabel: nil,
            totalSplitsLabel: "Sharp Under",
            mlSplitsLabel: nil,
            fgSpreadClose: -1.5,
            fgTotalClose: 53.0,
            fgSpreadPick: "AWAY",
            fgTotalPick: "UNDER"
        ),
        NFLPrediction(
            id: "nfl-fixture-3",
            awayTeam: "Green Bay Packers",
            homeTeam: "Chicago Bears",
            homeMl: 230,
            awayMl: -280,
            homeSpread: 7.0,
            awaySpread: -7.0,
            overLine: 44.5,
            gameDate: "2026-09-15",
            gameTime: "2026-09-15T17:00:00Z",
            trainingKey: "nfl-fixture-3",
            uniqueId: "nfl-fixture-3",
            homeAwayMlProb: 0.30,
            homeAwaySpreadCoverProb: 0.55,
            ouResultProb: 0.45,
            runId: "fixture",
            temperature: nil,
            precipitation: nil,
            windSpeed: nil,
            icon: nil
        ),
        NFLPrediction(
            id: "nfl-fixture-4",
            awayTeam: "San Francisco 49ers",
            homeTeam: "Los Angeles Rams",
            homeMl: 120,
            awayMl: -140,
            homeSpread: 2.5,
            awaySpread: -2.5,
            overLine: 47.5,
            gameDate: "2026-09-15",
            gameTime: "2026-09-15T20:20:00Z",
            trainingKey: "nfl-fixture-4",
            uniqueId: "nfl-fixture-4",
            homeAwayMlProb: 0.55,
            homeAwaySpreadCoverProb: 0.62,
            ouResultProb: 0.55,
            runId: "fixture"
        )
    ]

    static let sampleCFB: [CFBPrediction] = [
        CFBPrediction(
            id: "cfb-fixture-1",
            awayTeam: "Ohio State",
            homeTeam: "Michigan",
            homeMl: -125,
            awayMl: 105,
            homeSpread: -2.5,
            awaySpread: 2.5,
            overLine: 51.5,
            gameDate: "2026-11-28",
            gameTime: "2026-11-28T17:00:00Z",
            trainingKey: "cfb-fixture-1",
            uniqueId: "cfb-fixture-1",
            homeAwayMlProb: 0.56,
            homeAwaySpreadCoverProb: 0.65,
            ouResultProb: 0.42,
            runId: "fixture",
            conference: "Big Ten",
            predAwayScore: 27.4,
            predHomeScore: 31.1,
            homeSpreadDiff: 4.2,
            overLineDiff: -2.8,
            fgSpreadClose: -2.5,
            fgTotalClose: 51.5,
            fgSpreadPick: "HOME",
            fgPredTotal: 48.7,
            fgTotalPick: "UNDER"
        ),
        CFBPrediction(
            id: "cfb-fixture-2",
            awayTeam: "Georgia",
            homeTeam: "Alabama",
            homeMl: 100,
            awayMl: -120,
            homeSpread: 1.5,
            awaySpread: -1.5,
            overLine: 45.5,
            gameDate: "2026-09-26",
            gameTime: "2026-09-26T19:30:00Z",
            trainingKey: "cfb-fixture-2",
            uniqueId: "cfb-fixture-2",
            homeAwayMlProb: 0.48,
            homeAwaySpreadCoverProb: 0.51,
            ouResultProb: 0.62,
            runId: "fixture",
            conference: "SEC",
            predAwayScore: 22.9,
            predHomeScore: 24.8,
            homeSpreadDiff: 0.4,
            overLineDiff: 3.1,
            fgSpreadClose: 1.5,
            fgTotalClose: 45.5,
            fgSpreadPick: "AWAY",
            fgPredTotal: 48.6,
            fgTotalPick: "OVER"
        )
    ]
}
#endif
