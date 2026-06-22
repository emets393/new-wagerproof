import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

@Observable
@MainActor
public final class CFBDryRunPicksStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    public private(set) var games: [CFBPrediction] = []
    public private(set) var flags: [CFBDryRunFlag] = []
    public private(set) var loadState: LoadState = .idle

    public init() {}

    public var activeFlags: [CFBDryRunFlag] {
        flags.filter(\.isActive).sorted(by: flagSort)
    }

    public var trackingFlags: [CFBDryRunFlag] {
        flags.filter { !$0.isActive }.sorted(by: flagSort)
    }

    public var mammothGames: [CFBPrediction] {
        games.filter(\.mammoth)
    }

    public func game(for id: String) -> CFBPrediction? {
        games.first { $0.gameId == id || $0.id == id }
    }

    public func refresh() async {
        loadState = .loading
        do {
            await CFBTeamsService.shared.ensureLoaded()
            let cfb = await CFBSupabase.shared.client
            async let gamesRows: [GameRow] = cfb
                .from("cfb_dryrun_games")
                .select()
                .eq("week", value: 7)
                .execute()
                .value
            async let flagRows: [FlagRow] = cfb
                .from("cfb_dryrun_flags")
                .select()
                .eq("week", value: 7)
                .execute()
                .value
            async let signalDefs = CFBSignalDefinitionsService.shared.definitionsBySource()

            let (gRows, fRows, definitionsBySource) = try await (gamesRows, flagRows, signalDefs)
            let flagModels = fRows.map { row in
                let flag = row.model
                let definition = CFBSignalDefinitionsService.definition(for: flag.source, in: definitionsBySource)
                return flag.withSignalDefinition(definition)
            }
            let flagsByGame = Dictionary(grouping: flagModels, by: \.gameId)
            self.flags = flagModels
            self.games = gRows.map { prediction(from: $0, flagsByGame: flagsByGame) }
            loadState = .loaded
        } catch {
            loadState = .failed(error.localizedDescription)
        }
    }

    private func flagSort(_ a: CFBDryRunFlag, _ b: CFBDryRunFlag) -> Bool {
        if a.convictionTier.sortRank != b.convictionTier.sortRank {
            return a.convictionTier.sortRank < b.convictionTier.sortRank
        }
        return (a.stakeUnits ?? 0) > (b.stakeUnits ?? 0)
    }

    private func prediction(from row: GameRow, flagsByGame: [String: [CFBDryRunFlag]]) -> CFBPrediction {
        let id = row.gameId.value
        let home = row.homeTeam ?? "Home"
        let away = row.awayTeam ?? "Away"
        let score = Self.score(home: row.fgPredHomePts, away: row.fgPredAwayPts, total: row.fgPredTotal, margin: row.fgPredMargin)
        let homeMl: Int? = row.fgMlHomeClose.map { Int($0.rounded()) }
        let awayMl: Int? = row.fgMlAwayClose.map { Int($0.rounded()) }
        let awaySpread: Double? = row.fgSpreadClose.map { -$0 }
        let gameDate: String = row.kickoff ?? ""
        let homeRef: CFBTeamReference? = CFBTeamAssets.team(for: home)
        let awayRef: CFBTeamReference? = CFBTeamAssets.team(for: away)
        let mammoth = row.mammoth ?? false
        let gameFlags: [CFBDryRunFlag] = flagsByGame[id] ?? []
        let convictionTier = row.convictionTier ?? "none"
        return CFBPrediction(
            id: id,
            awayTeam: away,
            homeTeam: home,
            homeMl: homeMl,
            awayMl: awayMl,
            homeSpread: row.fgSpreadClose,
            awaySpread: awaySpread,
            overLine: row.fgTotalClose,
            gameDate: gameDate,
            gameTime: gameDate,
            trainingKey: id,
            uniqueId: id,
            homeAwaySpreadCoverProb: row.fgHomeCoverProb,
            temperature: row.wxTempF,
            precipitation: row.wxPrecipMm,
            windSpeed: row.wxWindMph,
            icon: row.wxIcon,
            wxTempF: row.wxTempF,
            wxWindMph: row.wxWindMph,
            wxPrecipMm: row.wxPrecipMm,
            wxIndoors: row.wxIndoors,
            wxIcon: row.wxIcon,
            wxSummary: row.wxSummary,
            predAwayScore: score?.away,
            predHomeScore: score?.home,
            predSpread: row.fgPredSpread,
            homeSpreadDiff: row.fgSpreadEdge,
            predTotal: row.fgPredTotal,
            overLineDiff: row.fgTotalEdge,
            gameId: id,
            season: row.season,
            week: row.week,
            kickoff: row.kickoff,
            homeConf: row.homeConf,
            awayConf: row.awayConf,
            homeRank: row.homeRank,
            awayRank: row.awayRank,
            homeTeamRef: homeRef,
            awayTeamRef: awayRef,
            fgSpreadClose: row.fgSpreadClose,
            fgTotalClose: row.fgTotalClose,
            ttHomeClose: row.ttHomeClose,
            ttAwayClose: row.ttAwayClose,
            ttHomeBestUnder: row.ttHomeBestUnder,
            ttHomeBestOver: row.ttHomeBestOver,
            ttAwayBestUnder: row.ttAwayBestUnder,
            ttAwayBestOver: row.ttAwayBestOver,
            h1SpreadClose: row.h1SpreadClose,
            h1TotalClose: row.h1TotalClose,
            fgPredMargin: row.fgPredMargin,
            fgPredSpread: row.fgPredSpread,
            fgSpreadEdge: row.fgSpreadEdge,
            fgSpreadPick: row.fgSpreadPick,
            fgSpreadCapped: row.fgSpreadCapped,
            fgPredTotal: row.fgPredTotal,
            fgTotalEdge: row.fgTotalEdge,
            fgTotalPick: row.fgTotalPick,
            ttHomePred: row.ttHomePred,
            ttAwayPred: row.ttAwayPred,
            ttHomePick: row.ttHomePick,
            ttAwayPick: row.ttAwayPick,
            h1PredMargin: row.h1PredMargin,
            h1PredTotal: row.h1PredTotal,
            h1SpreadPick: row.h1SpreadPick,
            h1TotalPick: row.h1TotalPick,
            h1MlPick: row.h1MlPick,
            convictionTierRaw: convictionTier,
            stakeUnits: row.stakeUnits,
            nFlagsActive: row.nFlagsActive,
            nFlagsTracking: row.nFlagsTracking,
            mammoth: mammoth,
            flags: gameFlags
        )
    }

    private static func score(home: Double?, away: Double?, total: Double?, margin: Double?) -> (home: Double, away: Double)? {
        if let home, let away { return (home, away) }
        guard let total, let margin else { return nil }
        return ((total + margin) / 2, (total - margin) / 2)
    }

    private struct FlexibleString: Decodable, Hashable, Sendable {
        let value: String
        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let s = try? c.decode(String.self) { value = s }
            else if let i = try? c.decode(Int.self) { value = String(i) }
            else if let d = try? c.decode(Double.self) { value = d.rounded(.towardZero) == d ? String(Int(d)) : String(d) }
            else { value = "" }
        }
    }

    private struct GameRow: Decodable, Sendable {
        let gameId: FlexibleString
        let season: Int?
        let week: Int?
        let kickoff: String?
        let homeTeam: String?
        let awayTeam: String?
        let homeConf: String?
        let awayConf: String?
        let homeRank: Int?
        let awayRank: Int?
        let fgSpreadClose: Double?
        let fgTotalClose: Double?
        let fgMlHomeClose: Double?
        let fgMlAwayClose: Double?
        let fgPredMargin: Double?
        let fgPredHomePts: Double?
        let fgPredAwayPts: Double?
        let fgPredSpread: Double?
        let fgSpreadEdge: Double?
        let fgSpreadPick: String?
        let fgSpreadCapped: Bool?
        let fgPredTotal: Double?
        let fgTotalEdge: Double?
        let fgTotalPick: String?
        let ttHomeClose: Double?
        let ttAwayClose: Double?
        let ttHomeBestUnder: Double?
        let ttHomeBestOver: Double?
        let ttAwayBestUnder: Double?
        let ttAwayBestOver: Double?
        let ttHomePred: Double?
        let ttAwayPred: Double?
        let ttHomePick: String?
        let ttAwayPick: String?
        let h1SpreadClose: Double?
        let h1TotalClose: Double?
        let h1PredMargin: Double?
        let h1PredTotal: Double?
        let h1SpreadPick: String?
        let h1TotalPick: String?
        let h1MlPick: String?
        let fgHomeCoverProb: Double?
        let wxTempF: Double?
        let wxWindMph: Double?
        let wxPrecipMm: Double?
        let wxIndoors: Bool?
        let wxIcon: String?
        let wxSummary: String?
        let convictionTier: String?
        let stakeUnits: Double?
        let nFlagsActive: Int?
        let nFlagsTracking: Int?
        let mammoth: Bool?

        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case season, week, kickoff
            case homeTeam = "home_team"
            case awayTeam = "away_team"
            case homeConf = "home_conf"
            case awayConf = "away_conf"
            case homeRank = "home_rank"
            case awayRank = "away_rank"
            case fgSpreadClose = "fg_spread_close"
            case fgTotalClose = "fg_total_close"
            case fgMlHomeClose = "fg_ml_home_close"
            case fgMlAwayClose = "fg_ml_away_close"
            case fgPredMargin = "fg_pred_margin"
            case fgPredHomePts = "fg_pred_home_pts"
            case fgPredAwayPts = "fg_pred_away_pts"
            case fgPredSpread = "fg_pred_spread"
            case fgSpreadEdge = "fg_spread_edge"
            case fgSpreadPick = "fg_spread_pick"
            case fgSpreadCapped = "fg_spread_capped"
            case fgPredTotal = "fg_pred_total"
            case fgTotalEdge = "fg_total_edge"
            case fgTotalPick = "fg_total_pick"
            case ttHomeClose = "tt_home_close"
            case ttAwayClose = "tt_away_close"
            case ttHomeBestUnder = "tt_home_best_under"
            case ttHomeBestOver = "tt_home_best_over"
            case ttAwayBestUnder = "tt_away_best_under"
            case ttAwayBestOver = "tt_away_best_over"
            case ttHomePred = "tt_home_pred"
            case ttAwayPred = "tt_away_pred"
            case ttHomePick = "tt_home_pick"
            case ttAwayPick = "tt_away_pick"
            case h1SpreadClose = "h1_spread_close"
            case h1TotalClose = "h1_total_close"
            case h1PredMargin = "h1_pred_margin"
            case h1PredTotal = "h1_pred_total"
            case h1SpreadPick = "h1_spread_pick"
            case h1TotalPick = "h1_total_pick"
            case h1MlPick = "h1_ml_pick"
            case fgHomeCoverProb = "fg_home_cover_prob"
            case wxTempF = "wx_temp_f"
            case wxWindMph = "wx_wind_mph"
            case wxPrecipMm = "wx_precip_mm"
            case wxIndoors = "wx_indoors"
            case wxIcon = "wx_icon"
            case wxSummary = "wx_summary"
            case convictionTier = "conviction_tier"
            case stakeUnits = "stake_units"
            case nFlagsActive = "n_flags_active"
            case nFlagsTracking = "n_flags_tracking"
            case mammoth
        }
    }

    private struct FlagRow: Decodable, Sendable {
        let id: FlexibleString
        let gameId: FlexibleString
        let season: Int?
        let week: Int?
        let game: String?
        let source: String?
        let market: String?
        let side: String?
        let line: Double?
        let price: Int?
        let edge: Double?
        let conviction: String?
        let tier: String?
        let stakeUnits: Double?
        let gradeLine: String?
        let mammoth: Bool?

        enum CodingKeys: String, CodingKey {
            case id
            case gameId = "game_id"
            case season, week, game, source, market, side, line, price, edge, conviction, tier, mammoth
            case stakeUnits = "stake_units"
            case gradeLine = "grade_line"
        }

        var model: CFBDryRunFlag {
            CFBDryRunFlag(
                id: id.value,
                gameId: gameId.value,
                season: season,
                week: week,
                game: game,
                source: source ?? "Signal",
                market: market ?? "",
                side: side ?? "",
                line: line,
                price: price,
                edge: edge,
                conviction: conviction ?? "track",
                tier: tier ?? "tracking",
                stakeUnits: stakeUnits,
                gradeLine: gradeLine,
                mammoth: mammoth
            )
        }
    }
}
