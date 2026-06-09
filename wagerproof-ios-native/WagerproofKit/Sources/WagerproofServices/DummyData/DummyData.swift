#if DEBUG
import Foundation
import WagerproofModels

/// Aggregated fixtures for DEBUG "Dummy Data Mode" (see `DummyDataMode`).
///
/// Card slates (NFL / NBA / NCAAB), real injuries, and real Polymarket price
/// curves come from `DummyDataGenerated` (captured from the live DB by
/// `scripts/wagerproof-migration/capture-dummy-data.py`). The pieces that have
/// NO retained rows in the offseason — the CFB slate and the NBA/NCAAB
/// situational-trends + model-accuracy + recent-trends widgets — are built
/// here, modeled on the real table schemas and value scales (cover %s are
/// 0–100 percentages, records are "W-L-P", situations use the real encoded
/// vocabulary like `is_after_loss` / `is_dog` / `two_three_days_off`). Values
/// are derived deterministically from each real matchup so every existing card,
/// detail, and widget populates consistently. No new widgets are invented.
///
/// Compiled out of Release builds entirely via `#if DEBUG`.
public enum DummyData {

    // MARK: - Card slates (real captured data)

    public static var nfl: [NFLPrediction] { DummyDataGenerated.nfl }
    public static var nba: [NBAGame] { DummyDataGenerated.nba }
    public static var ncaab: [NCAABGame] { DummyDataGenerated.ncaab }

    /// Hand-built realistic CFB slate — `cfb_api_predictions` /
    /// `cfb_live_weekly_inputs` are both empty in the offseason, so there is no
    /// real source to capture. Real FBS teams + conferences with plausible
    /// odds and model fields so the CFB cards + detail sheet populate.
    public static let cfb: [CFBPrediction] = [
        cfbGame(id: "cfb-1", away: "Ohio State", home: "Michigan", conf: "Big Ten",
                homeMl: -135, awayMl: 115, homeSpread: -2.5, total: 51.5,
                mlProb: 0.57, spreadProb: 0.64, ouProb: 0.41,
                predAway: 27.4, predHome: 31.1, spreadDiff: 4.2, totalDiff: -2.8),
        cfbGame(id: "cfb-2", away: "Georgia", home: "Alabama", conf: "SEC",
                homeMl: 105, awayMl: -125, homeSpread: 1.5, total: 45.5,
                mlProb: 0.48, spreadProb: 0.52, ouProb: 0.61,
                predAway: 24.8, predHome: 22.9, spreadDiff: 0.4, totalDiff: 3.1),
        cfbGame(id: "cfb-3", away: "Texas", home: "Oklahoma", conf: "SEC",
                homeMl: 165, awayMl: -200, homeSpread: 4.0, total: 56.5,
                mlProb: 0.34, spreadProb: 0.58, ouProb: 0.55,
                predAway: 31.9, predHome: 26.2, spreadDiff: -1.7, totalDiff: 1.6),
        cfbGame(id: "cfb-4", away: "Notre Dame", home: "USC", conf: "Independent",
                homeMl: -150, awayMl: 130, homeSpread: -3.0, total: 58.5,
                mlProb: 0.60, spreadProb: 0.55, ouProb: 0.47,
                predAway: 28.1, predHome: 31.6, spreadDiff: 0.5, totalDiff: 1.2,
                temp: 74, precip: 0, wind: 6, icon: "clear-day"),
        cfbGame(id: "cfb-5", away: "Oregon", home: "Washington", conf: "Big Ten",
                homeMl: 140, awayMl: -170, homeSpread: 3.5, total: 62.5,
                mlProb: 0.37, spreadProb: 0.61, ouProb: 0.66,
                predAway: 34.2, predHome: 29.5, spreadDiff: -1.2, totalDiff: 1.2,
                temp: 52, precip: 60, wind: 12, icon: "rain"),
        cfbGame(id: "cfb-6", away: "LSU", home: "Ole Miss", conf: "SEC",
                homeMl: -110, awayMl: -110, homeSpread: -1.0, total: 54.5,
                mlProb: 0.51, spreadProb: 0.50, ouProb: 0.53,
                predAway: 27.0, predHome: 28.3, spreadDiff: 0.3, totalDiff: 0.8),
    ]

    // MARK: - NBA widgets

    /// Real injuries captured per team. Keyed by full team name (matches
    /// `NBAGame.awayTeam` / `homeTeam`). Returns ([], []) for unknown teams.
    public static func nbaInjuries(awayTeam: String, homeTeam: String)
        -> (away: [NBAInjuryReport], home: [NBAInjuryReport]) {
        (DummyDataGenerated.nbaInjuriesByTeam[awayTeam] ?? [],
         DummyDataGenerated.nbaInjuriesByTeam[homeTeam] ?? [])
    }

    /// Recent-trends payload for the NBA matchup-overview widget. Built
    /// deterministically from the team names (the matchup store's `load`
    /// receives no gameId).
    public static func nbaRecentTrends(awayTeam: String, homeTeam: String) -> NBAGameTrends {
        let a = seed(awayTeam), h = seed(homeTeam)
        let dict: [String: Any] = [
            "home_ovr_rtg": rating(h, base: 112), "away_ovr_rtg": rating(a, base: 112),
            "home_consistency": frac(h, lo: 0.58, hi: 0.92), "away_consistency": frac(a, lo: 0.58, hi: 0.92),
            "home_win_streak": Double(h % 5 - 2), "away_win_streak": Double(a % 5 - 2),
            "home_ats_pct": pct(h, lo: 44, hi: 62), "away_ats_pct": pct(a, lo: 44, hi: 62),
            "home_ats_streak": Double(h % 4), "away_ats_streak": Double(-(a % 4)),
            "home_last_margin": Double((h % 25) - 12), "away_last_margin": Double((a % 25) - 12),
            "home_over_pct": pct(h, lo: 42, hi: 60), "away_over_pct": pct(a, lo: 42, hi: 60),
            "home_adj_pace_pregame_l3_trend": delta(h), "away_adj_pace_pregame_l3_trend": delta(a),
            "home_adj_off_rtg_pregame_l3_trend": delta(h + 1), "away_adj_off_rtg_pregame_l3_trend": delta(a + 1),
            "home_adj_def_rtg_pregame_l3_trend": delta(h + 2), "away_adj_def_rtg_pregame_l3_trend": delta(a + 2),
        ]
        return decodeJSON(dict)
    }

    /// One `NBAGameTrendsData` per game in the slate (keyed by `gameId`).
    public static func nbaTrendsData() -> [NBAGameTrendsData] {
        nba.map { g in
            NBAGameTrendsData(
                gameId: g.gameId,
                gameDate: g.gameDate,
                tipoffTime: g.gameTime,
                awayTeam: nbaTrendRow(gameId: g.gameId, teamId: g.gameId * 10 + 1,
                                      abbr: g.awayAbbr, name: g.awayTeam, isHome: false),
                homeTeam: nbaTrendRow(gameId: g.gameId, teamId: g.gameId * 10 + 2,
                                      abbr: g.homeAbbr, name: g.homeTeam, isHome: true)
            )
        }
    }

    /// One `NBAModelAccuracyData` per game (keyed by `gameId`).
    public static func nbaAccuracy() -> [NBAModelAccuracyData] {
        nba.map { g in
            let s = g.gameId
            let mlHome = (g.homeAwayMlProb ?? 0.5) >= 0.5
            let mlProb = mlHome ? (g.homeAwayMlProb ?? 0.5) : 1 - (g.homeAwayMlProb ?? 0.5)
            return NBAModelAccuracyData(
                gameId: g.gameId, awayTeam: g.awayTeam, homeTeam: g.homeTeam,
                awayAbbr: g.awayAbbr, homeAbbr: g.homeAbbr,
                gameDate: g.gameDate, tipoffTime: g.gameTime,
                homeSpread: g.homeSpread,
                homeSpreadDiff: diff(g.modelFairHomeSpread, g.homeSpread),
                spreadAccuracy: bucket(s, lo: 53, hi: 67),
                homeWinProb: g.homeAwayMlProb, awayWinProb: g.homeAwayMlProb.map { 1 - $0 },
                mlPickIsHome: mlHome, mlPickProbRounded: (mlProb * 100).rounded() / 100,
                mlAccuracy: bucket(s + 1, lo: 58, hi: 74),
                overLine: g.overLine, overLineDiff: diff(g.modelFairTotal, g.overLine),
                ouAccuracy: bucket(s + 2, lo: 49, hi: 61)
            )
        }
    }

    // MARK: - NCAAB widgets

    public static func ncaabTrendsData() -> [NCAABGameTrendsData] {
        ncaab.map { g in
            NCAABGameTrendsData(
                gameId: g.gameId,
                gameDate: g.gameDate,
                tipoffTime: g.gameTime,
                awayTeam: ncaabTrendRow(gameId: g.gameId, teamId: g.gameId * 10 + 1,
                                        abbr: g.awayTeamAbbrev ?? abbr(g.awayTeam), name: g.awayTeam, isHome: false),
                homeTeam: ncaabTrendRow(gameId: g.gameId, teamId: g.gameId * 10 + 2,
                                        abbr: g.homeTeamAbbrev ?? abbr(g.homeTeam), name: g.homeTeam, isHome: true),
                awayTeamLogo: g.awayTeamLogo,
                homeTeamLogo: g.homeTeamLogo,
                ouConsensusScore: frac(g.gameId, lo: 0.4, hi: 0.85),
                atsDominanceScore: frac(g.gameId + 7, lo: 0.4, hi: 0.85)
            )
        }
    }

    public static func ncaabAccuracy() -> [NCAABModelAccuracyGame] {
        ncaab.map { g in
            let s = g.gameId
            let mlHome = (g.homeAwayMlProb ?? 0.5) >= 0.5
            let mlProb = mlHome ? (g.homeAwayMlProb ?? 0.5) : 1 - (g.homeAwayMlProb ?? 0.5)
            return NCAABModelAccuracyGame(
                gameId: g.gameId, awayTeam: g.awayTeam, homeTeam: g.homeTeam,
                awayAbbr: g.awayTeamAbbrev ?? abbr(g.awayTeam),
                homeAbbr: g.homeTeamAbbrev ?? abbr(g.homeTeam),
                gameDate: g.gameDate, tipoffTime: g.gameTime,
                homeSpread: g.homeSpread,
                homeSpreadDiff: diff(g.modelFairHomeSpread, g.homeSpread),
                spreadAccuracy: ncaabBucket(s, lo: 52, hi: 66),
                homeWinProb: g.homeAwayMlProb, awayWinProb: g.homeAwayMlProb.map { 1 - $0 },
                mlPickIsHome: mlHome, mlPickProbRounded: (mlProb * 100).rounded() / 100,
                mlAccuracy: ncaabBucket(s + 1, lo: 57, hi: 72),
                overLine: g.overLine,
                overLineDiff: diff(g.predTotalPoints, g.overLine),
                ouAccuracy: ncaabBucket(s + 2, lo: 48, hi: 60),
                awayTeamLogo: g.awayTeamLogo, homeTeamLogo: g.homeTeamLogo
            )
        }
    }

    // MARK: - Polymarket

    /// Build a 3-market (moneyline / spread / total) bundle for any matchup by
    /// reusing real captured price curves. Guarantees every game-detail
    /// Polymarket widget renders a real-shaped chart.
    public static func polymarket(league: String, awayTeam: String, homeTeam: String)
        -> PolymarketGameMarkets? {
        let curves = DummyDataGenerated.polymarketCurves
        guard !curves.isEmpty else { return nil }
        let gameKey = "\(league)_\(awayTeam)_\(homeTeam)"
        let base = seed(gameKey)
        func market(_ type: PolymarketMarketType, _ offset: Int) -> PolymarketMarket {
            let curve = curves[(base + offset) % curves.count]
            return PolymarketMarket(
                gameKey: gameKey, league: league, marketType: type,
                tokenId: "dummy-\(type.rawValue)-\(base)",
                currentAwayOdds: curve.currentAwayOdds,
                currentHomeOdds: curve.currentHomeOdds,
                priceHistory: curve.points.map { PolymarketPricePoint(t: $0.0, p: $0.1) }
            )
        }
        return PolymarketGameMarkets(
            awayTeam: awayTeam, homeTeam: homeTeam,
            markets: [
                .moneyline: market(.moneyline, 0),
                .spread: market(.spread, 1),
                .total: market(.total, 2),
            ]
        )
    }

    // MARK: - Builders / helpers

    private static func cfbGame(
        id: String, away: String, home: String, conf: String,
        homeMl: Int, awayMl: Int, homeSpread: Double, total: Double,
        mlProb: Double, spreadProb: Double, ouProb: Double,
        predAway: Double, predHome: Double, spreadDiff: Double, totalDiff: Double,
        temp: Double? = nil, precip: Double? = nil, wind: Double? = nil, icon: String? = nil
    ) -> CFBPrediction {
        CFBPrediction(
            id: id, awayTeam: away, homeTeam: home,
            homeMl: homeMl, awayMl: awayMl,
            homeSpread: homeSpread, awaySpread: -homeSpread, overLine: total,
            gameDate: "2025-11-29", gameTime: "2025-11-29T20:00:00+00:00",
            trainingKey: id, uniqueId: id,
            homeAwayMlProb: mlProb, homeAwaySpreadCoverProb: spreadProb, ouResultProb: ouProb,
            runId: "dummy", temperature: temp, precipitation: precip, windSpeed: wind, icon: icon,
            spreadSplitsLabel: nil, totalSplitsLabel: nil, mlSplitsLabel: nil,
            conference: conf,
            predAwayScore: predAway, predHomeScore: predHome,
            predAwayPoints: predAway, predHomePoints: predHome,
            predSpread: -(predHome - predAway), homeSpreadDiff: spreadDiff,
            predTotal: predAway + predHome, totalDiff: totalDiff,
            predOverLine: total + totalDiff, overLineDiff: totalDiff,
            openingSpread: homeSpread, openingTotal: total
        )
    }

    /// Build an NBA situational trend row (no public init on the model →
    /// decode from a JSON dict). Scale matches `nba_game_situational_trends`:
    /// records "W-L-P", cover %s in 0–100, situations encoded.
    private static func nbaTrendRow(gameId: Int, teamId: Int, abbr: String, name: String, isHome: Bool)
        -> NBASituationalTrendRow {
        decodeJSON(situationalDict(gameId: gameId, teamIdKey: "team_id", teamId: teamId,
                                   abbr: abbr, name: name, isHome: isHome))
    }

    /// NCAAB situational row — model exposes a public init, so build directly.
    private static func ncaabTrendRow(gameId: Int, teamId: Int, abbr: String, name: String, isHome: Bool)
        -> NCAABSituationalTrendRow {
        let s = seed("\(gameId)-\(name)")
        let atsLast = record(s, lo: 18, hi: 28), atsFav = record(s + 1, lo: 12, hi: 20)
        let atsSide = record(s + 2, lo: 8, hi: 16), atsHome = record(s + 3, lo: 10, hi: 22)
        let ouLast = record(s + 4, lo: 18, hi: 28), ouFav = record(s + 5, lo: 12, hi: 20)
        let ouHome = record(s + 6, lo: 10, hi: 22)
        return NCAABSituationalTrendRow(
            gameId: gameId, gameDate: "2026-02-21", apiTeamId: teamId,
            teamAbbr: abbr, teamName: name, teamSide: isHome ? "home" : "away",
            lastGameSituation: isHome ? "is_after_win" : "is_after_loss",
            favDogSituation: isHome ? "is_fav" : "is_dog",
            sideSpreadSituation: isHome ? "is_home_fav" : "is_away_dog",
            homeAwaySituation: nil,
            restBucket: "two_three_days_off", restComp: "equal_rest",
            atsLastGameRecord: atsLast.0, atsLastGameCoverPct: atsLast.1,
            atsFavDogRecord: atsFav.0, atsFavDogCoverPct: atsFav.1,
            atsSideFavDogRecord: atsSide.0, atsSideFavDogCoverPct: atsSide.1,
            atsHomeAwayRecord: atsHome.0, atsHomeAwayCoverPct: atsHome.1,
            atsRestBucketRecord: nil, atsRestBucketCoverPct: nil,
            atsRestCompRecord: nil, atsRestCompCoverPct: nil,
            ouLastGameRecord: ouLast.0, ouLastGameOverPct: ouLast.1, ouLastGameUnderPct: 100 - ouLast.1,
            ouFavDogRecord: ouFav.0, ouFavDogOverPct: ouFav.1, ouFavDogUnderPct: 100 - ouFav.1,
            ouSideFavDogRecord: nil, ouSideFavDogOverPct: nil, ouSideFavDogUnderPct: nil,
            ouHomeAwayRecord: ouHome.0, ouHomeAwayOverPct: ouHome.1, ouHomeAwayUnderPct: 100 - ouHome.1,
            ouRestBucketRecord: nil, ouRestBucketOverPct: nil, ouRestBucketUnderPct: nil,
            ouRestCompRecord: nil, ouRestCompOverPct: nil, ouRestCompUnderPct: nil
        )
    }

    private static func situationalDict(
        gameId: Int, teamIdKey: String, teamId: Int, abbr: String, name: String, isHome: Bool
    ) -> [String: Any] {
        let s = seed("\(gameId)-\(name)")
        let atsLast = record(s, lo: 18, hi: 28), atsFav = record(s + 1, lo: 12, hi: 20)
        let atsSide = record(s + 2, lo: 8, hi: 16), atsHome = record(s + 3, lo: 10, hi: 22)
        let atsRestB = record(s + 7, lo: 9, hi: 18), atsRestC = record(s + 8, lo: 30, hi: 55)
        let ouLast = record(s + 4, lo: 18, hi: 28), ouFav = record(s + 5, lo: 12, hi: 20)
        let ouSide = record(s + 9, lo: 8, hi: 16), ouHome = record(s + 6, lo: 10, hi: 22)
        let ouRestB = record(s + 10, lo: 9, hi: 18), ouRestC = record(s + 11, lo: 30, hi: 55)
        return [
            "game_id": gameId, "game_date": "2026-04-12", teamIdKey: teamId,
            "team_abbr": abbr, "team_name": name, "team_side": isHome ? "home" : "away",
            "last_game_situation": isHome ? "is_after_win" : "is_after_loss",
            "fav_dog_situation": isHome ? "is_fav" : "is_dog",
            "side_spread_situation": isHome ? "is_home_fav" : "is_away_dog",
            "rest_bucket": "two_three_days_off", "rest_comp": "equal_rest",
            "ats_last_game_record": atsLast.0, "ats_last_game_cover_pct": atsLast.1,
            "ats_fav_dog_record": atsFav.0, "ats_fav_dog_cover_pct": atsFav.1,
            "ats_side_fav_dog_record": atsSide.0, "ats_side_fav_dog_cover_pct": atsSide.1,
            "ats_home_away_record": atsHome.0, "ats_home_away_cover_pct": atsHome.1,
            "ats_rest_bucket_record": atsRestB.0, "ats_rest_bucket_cover_pct": atsRestB.1,
            "ats_rest_comp_record": atsRestC.0, "ats_rest_comp_cover_pct": atsRestC.1,
            "ou_last_game_record": ouLast.0, "ou_last_game_over_pct": ouLast.1, "ou_last_game_under_pct": 100 - ouLast.1,
            "ou_fav_dog_record": ouFav.0, "ou_fav_dog_over_pct": ouFav.1, "ou_fav_dog_under_pct": 100 - ouFav.1,
            "ou_side_fav_dog_record": ouSide.0, "ou_side_fav_dog_over_pct": ouSide.1, "ou_side_fav_dog_under_pct": 100 - ouSide.1,
            "ou_home_away_record": ouHome.0, "ou_home_away_over_pct": ouHome.1, "ou_home_away_under_pct": 100 - ouHome.1,
            "ou_rest_bucket_record": ouRestB.0, "ou_rest_bucket_over_pct": ouRestB.1, "ou_rest_bucket_under_pct": 100 - ouRestB.1,
            "ou_rest_comp_record": ouRestC.0, "ou_rest_comp_over_pct": ouRestC.1, "ou_rest_comp_under_pct": 100 - ouRestC.1,
        ]
    }

    // Deterministic value helpers — stable per input so fixtures don't churn.

    private static func decodeJSON<T: Decodable>(_ dict: [String: Any]) -> T {
        let data = try! JSONSerialization.data(withJSONObject: dict, options: [])
        return try! JSONDecoder().decode(T.self, from: data)
    }

    private static func seed(_ s: String) -> Int {
        var h = 2166136261
        for b in s.utf8 { h = (h ^ Int(b)) &* 16777619 }
        return h & 0x7fff_ffff
    }

    /// Build a "W-L-P" record + cover/over percentage (0–100) from a seed.
    private static func record(_ s: Int, lo: Int, hi: Int) -> (String, Double) {
        let total = lo + (s % max(1, hi - lo + 1))
        let wins = min(total, max(0, total / 2 + 1 + (s % 4)))
        let losses = max(0, total - wins)
        let pct = total > 0 ? (Double(wins) / Double(total) * 1000).rounded() / 10 : 0
        return ("\(wins)-\(losses)-0", pct)
    }

    private static func pct(_ s: Int, lo: Double, hi: Double) -> Double {
        ((lo + Double(s % 100) / 100 * (hi - lo)) * 10).rounded() / 10
    }

    private static func frac(_ s: Int, lo: Double, hi: Double) -> Double {
        ((lo + Double(s % 100) / 100 * (hi - lo)) * 100).rounded() / 100
    }

    private static func rating(_ s: Int, base: Double) -> Double {
        ((base + Double((s % 160) - 80) / 10) * 10).rounded() / 10
    }

    private static func delta(_ s: Int) -> Double {
        (Double((s % 60) - 30) / 10 * 10).rounded() / 10
    }

    private static func bucket(_ s: Int, lo: Int, hi: Int) -> NBAAccuracyBucket {
        let games = 40 + (s % 90)
        let acc = (Double(lo) + Double(s % 100) / 100 * Double(hi - lo))
        return NBAAccuracyBucket(games: games, accuracyPct: (acc * 10).rounded() / 10)
    }

    private static func ncaabBucket(_ s: Int, lo: Int, hi: Int) -> NCAABAccuracyBucket {
        let games = 40 + (s % 90)
        let acc = (Double(lo) + Double(s % 100) / 100 * Double(hi - lo))
        return NCAABAccuracyBucket(games: games, accuracyPct: (acc * 10).rounded() / 10)
    }

    private static func diff(_ a: Double?, _ b: Double?) -> Double? {
        guard let a, let b else { return nil }
        return ((a - b) * 10).rounded() / 10
    }

    private static func abbr(_ name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        return String(trimmed.prefix(4)).uppercased()
    }
}
#endif
