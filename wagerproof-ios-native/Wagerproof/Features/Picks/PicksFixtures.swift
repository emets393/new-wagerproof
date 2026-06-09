#if DEBUG
import Foundation
import WagerproofModels

/// Deterministic sample data for the picks tab + sheet parity screenshots.
/// Production code never touches these — gated behind `#if DEBUG`.
///
/// Coverage: an NBA pick (won), an NFL pick (pending, free), an NCAAB pick
/// (pending, draft), and an admin-mode admin-editable pick.
enum PicksFixtures {
    static let nbaPick: EditorPick = EditorPick(
        id: "fixture-nba-1",
        gameId: "401704933",
        gameType: .nba,
        editorId: "editor-1",
        selectedBetType: "spread",
        editorsNotes: "Lakers come in rested off a 3-day break with LeBron and AD both healthy. Boston's bench has been a sieve on the road this stretch — expect Reaves to feast in pick-and-roll coverage.",
        isPublished: true,
        createdAt: "2026-05-19T17:00:00Z",
        updatedAt: "2026-05-19T17:00:00Z",
        betslipLinks: nil,
        pickValue: "Lakers -3.5",
        bestPrice: "-110",
        sportsbook: "DraftKings",
        units: 2,
        isFreePick: false,
        archivedGameData: nil,
        betType: "spread",
        result: .won
    )
    static let nbaGameData = EditorPickGameData(
        awayTeam: "Boston Celtics",
        homeTeam: "Los Angeles Lakers",
        awayLogo: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png",
        homeLogo: "https://a.espncdn.com/i/teamlogos/nba/500/lal.png",
        gameDate: "Wed, May 20",
        gameTime: "10:30 PM EST",
        rawGameDate: "2026-05-20",
        awaySpread: 3.5,
        homeSpread: -3.5,
        overLine: 224.5,
        awayMl: 142,
        homeMl: -165,
        awayTeamColors: TeamColors(primary: "#007A33", secondary: "#BA9653"),
        homeTeamColors: TeamColors(primary: "#552583", secondary: "#FDB927")
    )

    static let nflPick = EditorPick(
        id: "fixture-nfl-1",
        gameId: "2026-W08-KC-BUF",
        gameType: .nfl,
        editorId: "editor-1",
        selectedBetType: "moneyline",
        editorsNotes: "Mahomes vs Allen always cooks. Chiefs get the home crowd and a 4-day rest edge.",
        isPublished: true,
        createdAt: "2026-05-18T15:00:00Z",
        updatedAt: "2026-05-18T15:00:00Z",
        betslipLinks: nil,
        pickValue: "Chiefs ML",
        bestPrice: "-135",
        sportsbook: "FanDuel",
        units: 1,
        isFreePick: true,
        archivedGameData: nil,
        betType: nil,
        result: .pending
    )
    static let nflGameData = EditorPickGameData(
        awayTeam: "Buffalo",
        homeTeam: "Kansas City",
        awayLogo: "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png",
        homeLogo: "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png",
        gameDate: "Sun, May 24",
        gameTime: "4:25 PM EST",
        rawGameDate: "2026-05-24",
        awaySpread: 2.5,
        homeSpread: -2.5,
        overLine: 49.5,
        awayMl: 115,
        homeMl: -135,
        awayTeamColors: TeamColors(primary: "#00338D", secondary: "#C60C30"),
        homeTeamColors: TeamColors(primary: "#E31837", secondary: "#FFB81C")
    )

    static let ncaabPick = EditorPick(
        id: "fixture-ncaab-1",
        gameId: "ncaab-987",
        gameType: .ncaab,
        editorId: "editor-1",
        selectedBetType: "over_under",
        editorsNotes: "Both offenses ranked top-15 in adjusted pace. Total has hit the over in 7 of Duke's last 10.",
        isPublished: false,
        createdAt: "2026-05-19T19:00:00Z",
        updatedAt: "2026-05-19T19:00:00Z",
        betslipLinks: nil,
        pickValue: "Over 154.5",
        bestPrice: "-108",
        sportsbook: "Caesars",
        units: 1.5,
        isFreePick: false,
        archivedGameData: nil,
        betType: nil,
        result: nil
    )
    static let ncaabGameData = EditorPickGameData(
        awayTeam: "North Carolina",
        homeTeam: "Duke",
        awayLogo: nil,
        homeLogo: nil,
        gameDate: "Tue, May 19",
        gameTime: "7:00 PM EST",
        rawGameDate: "2026-05-19",
        awaySpread: 4.5,
        homeSpread: -4.5,
        overLine: 154.5,
        awayMl: 165,
        homeMl: -190,
        awayTeamColors: TeamColors(primary: "#7BAFD4", secondary: "#13294B"),
        homeTeamColors: TeamColors(primary: "#001A57", secondary: "#FFFFFF")
    )

    static let samplePicks: [EditorPick] = [nbaPick, nflPick, ncaabPick]

    static var gameDataMap: [String: EditorPickGameData] {
        [
            nbaPick.gameId: nbaGameData,
            nflPick.gameId: nflGameData,
            ncaabPick.gameId: ncaabGameData
        ]
    }

    /// A minimal pick — no notes, no result, no price — used for the
    /// "empty" pick-detail sheet parity screenshot.
    static let bareNbaPick = EditorPick(
        id: "fixture-nba-bare",
        gameId: "401704933",
        gameType: .nba,
        editorId: "editor-1",
        selectedBetType: "spread",
        editorsNotes: nil,
        isPublished: true,
        createdAt: "2026-05-19T17:00:00Z",
        updatedAt: "2026-05-19T17:00:00Z",
        betslipLinks: nil,
        pickValue: "Lakers -3.5",
        bestPrice: nil,
        sportsbook: nil,
        units: nil,
        isFreePick: false,
        archivedGameData: nil,
        betType: nil,
        result: nil
    )

    /// Degraded game data (no logos, no colors, no lines) used for the
    /// "error" pick-detail sheet parity screenshot.
    static let degradedGameData = EditorPickGameData(
        awayTeam: "Boston Celtics",
        homeTeam: "Los Angeles Lakers",
        awayLogo: nil,
        homeLogo: nil,
        gameDate: nil,
        gameTime: nil,
        rawGameDate: nil,
        awaySpread: nil,
        homeSpread: nil,
        overLine: nil,
        awayMl: nil,
        homeMl: nil,
        awayTeamColors: .default,
        homeTeamColors: .default
    )
}
#endif
