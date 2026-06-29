import Foundation
import Supabase
import WagerproofModels

/// Reads the Best Picks Report tables from the CFB Supabase project —
/// mirrors web `usePlayerPropPerformance.ts` + `useSnapshotPlayerPropPicks`.
public actor MLBPlayerPropPicksService {
    public static let shared = MLBPlayerPropPicksService()
    public init() {}

    public func fetchTodaysPicks(reportDate: String) async throws -> [MLBPlayerPropBestPick] {
        let cfb = await CFBSupabase.shared.client
        let rows: [PickRow] = try await cfb
            .from("mlb_player_prop_picks")
            .select()
            .eq("report_date", value: reportDate)
            .order("score", ascending: false)
            .execute()
            .value
        return rows.map { $0.model(reportDate: reportDate) }
    }

    public func fetchGradeSummary() async throws -> [MLBPlayerPropGradeSummary] {
        let cfb = await CFBSupabase.shared.client
        let rows: [SummaryRow] = try await cfb
            .from("v_mlb_player_prop_grade_summary")
            .select()
            .execute()
            .value
        return rows.compactMap { $0.model }
    }

    public func fetchGradeHistory(limit: Int = 200) async throws -> [MLBPlayerPropGrade] {
        let cfb = await CFBSupabase.shared.client
        let rows: [GradeRow] = try await cfb
            .from("mlb_player_prop_grades")
            .select(
                "report_date, game_pk, player_id, player_name, team_name, market, market_label, kind, tier, score, line, side, over_odds, under_odds, l10_pct, actual_value, result, units_staked, units_won"
            )
            .order("report_date", ascending: false)
            .order("score", ascending: false)
            .limit(limit)
            .execute()
            .value
        return rows.compactMap { $0.model }
    }

    /// Today in America/New_York as `yyyy-MM-dd` — matches the report date key.
    public static func todayET() -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: Date())
    }

    // MARK: - Row decoders

    private struct PickRow: Decodable {
        let gamePk: Int
        let playerId: Int
        let market: String
        let side: String
        let playerName: String
        let teamName: String?
        let gameLabel: String
        let isDay: Bool
        let marketLabel: String
        let kind: String
        let tier: String
        let score: Int
        let line: Double
        let overOdds: Int?
        let underOdds: Int?
        let l10Over: Int?
        let l10Games: Int?
        let l10Pct: Int?
        let rationale: RationalePayload?
        let locked: Bool

        enum CodingKeys: String, CodingKey {
            case gamePk = "game_pk"
            case playerId = "player_id"
            case market, side
            case playerName = "player_name"
            case teamName = "team_name"
            case gameLabel = "game_label"
            case isDay = "is_day"
            case marketLabel = "market_label"
            case kind, tier, score, line
            case overOdds = "over_odds"
            case underOdds = "under_odds"
            case l10Over = "l10_over"
            case l10Games = "l10_games"
            case l10Pct = "l10_pct"
            case rationale, locked
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            gamePk = Self.flexInt(c, .gamePk) ?? 0
            playerId = Self.flexInt(c, .playerId) ?? 0
            market = (try? c.decode(String.self, forKey: .market)) ?? ""
            side = (try? c.decode(String.self, forKey: .side)) ?? "over"
            playerName = (try? c.decode(String.self, forKey: .playerName)) ?? "Player"
            teamName = try? c.decodeIfPresent(String.self, forKey: .teamName)
            gameLabel = (try? c.decode(String.self, forKey: .gameLabel)) ?? ""
            isDay = (try? c.decode(Bool.self, forKey: .isDay)) ?? false
            marketLabel = (try? c.decode(String.self, forKey: .marketLabel)) ?? market
            kind = (try? c.decode(String.self, forKey: .kind)) ?? "batter"
            tier = (try? c.decode(String.self, forKey: .tier)) ?? "lean"
            score = Self.flexInt(c, .score) ?? 0
            line = Self.flexDouble(c, .line) ?? 0
            overOdds = Self.flexInt(c, .overOdds)
            underOdds = Self.flexInt(c, .underOdds)
            l10Over = Self.flexInt(c, .l10Over)
            l10Games = Self.flexInt(c, .l10Games)
            l10Pct = Self.flexInt(c, .l10Pct)
            rationale = try? c.decodeIfPresent(RationalePayload.self, forKey: .rationale)
            locked = (try? c.decode(Bool.self, forKey: .locked)) ?? false
        }

        func model(reportDate: String) -> MLBPlayerPropBestPick {
            MLBPlayerPropBestPick(
                reportDate: reportDate,
                gamePk: gamePk,
                playerId: playerId,
                market: market,
                side: side,
                playerName: playerName,
                teamName: teamName,
                gameLabel: gameLabel,
                isDay: isDay,
                marketLabel: marketLabel,
                kind: MLBPlayerPropPickKind(rawValue: kind) ?? .batter,
                tier: MLBPlayerPropPickTier(rawValue: tier) ?? .lean,
                score: score,
                line: line,
                overOdds: overOdds,
                underOdds: underOdds,
                l10Over: l10Over,
                l10Games: l10Games,
                l10Pct: l10Pct,
                rationale: rationale?.lines ?? [],
                locked: locked
            )
        }

        private static func flexInt(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Int? {
            if let i = try? c.decodeIfPresent(Int.self, forKey: key) { return i }
            if let s = try? c.decodeIfPresent(String.self, forKey: key), let i = Int(s) { return i }
            if let d = try? c.decodeIfPresent(Double.self, forKey: key) { return Int(d) }
            return nil
        }

        private static func flexDouble(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Double? {
            if let d = try? c.decodeIfPresent(Double.self, forKey: key) { return d }
            if let s = try? c.decodeIfPresent(String.self, forKey: key), let d = Double(s) { return d }
            if let i = try? c.decodeIfPresent(Int.self, forKey: key) { return Double(i) }
            return nil
        }
    }

    private struct RationalePayload: Decodable {
        let lines: [String]

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let arr = try? container.decode([String].self) {
                lines = arr
                return
            }
            lines = []
        }
    }

    private struct SummaryRow: Decodable {
        let tier: String
        let market: String
        let marketLabel: String
        let kind: String
        let picksTotal: Int
        let picksWon: Int
        let picksLost: Int
        let picksPush: Int
        let picksPending: Int
        let winPct: Double?
        let unitsStaked: Double?
        let unitsWon: Double?
        let roiPct: Double?

        enum CodingKeys: String, CodingKey {
            case tier, market
            case marketLabel = "market_label"
            case kind
            case picksTotal = "picks_total"
            case picksWon = "picks_won"
            case picksLost = "picks_lost"
            case picksPush = "picks_push"
            case picksPending = "picks_pending"
            case winPct = "win_pct"
            case unitsStaked = "units_staked"
            case unitsWon = "units_won"
            case roiPct = "roi_pct"
        }

        var model: MLBPlayerPropGradeSummary? {
            guard let tier = MLBPlayerPropPickTier(rawValue: tier),
                  let kind = MLBPlayerPropPickKind(rawValue: kind) else { return nil }
            return MLBPlayerPropGradeSummary(
                tier: tier,
                market: market,
                marketLabel: marketLabel,
                kind: kind,
                picksTotal: picksTotal,
                picksWon: picksWon,
                picksLost: picksLost,
                picksPush: picksPush,
                picksPending: picksPending,
                winPct: winPct,
                unitsStaked: unitsStaked,
                unitsWon: unitsWon,
                roiPct: roiPct
            )
        }
    }

    private struct GradeRow: Decodable {
        let reportDate: String
        let gamePk: Int
        let playerId: Int
        let playerName: String?
        let teamName: String?
        let market: String
        let marketLabel: String?
        let kind: String?
        let tier: String?
        let score: Int?
        let line: Double?
        let side: String
        let overOdds: Int?
        let underOdds: Int?
        let l10Pct: Int?
        let actualValue: Double?
        let result: String?
        let unitsStaked: Double?
        let unitsWon: Double?

        enum CodingKeys: String, CodingKey {
            case reportDate = "report_date"
            case gamePk = "game_pk"
            case playerId = "player_id"
            case playerName = "player_name"
            case teamName = "team_name"
            case market
            case marketLabel = "market_label"
            case kind, tier, score, line, side
            case overOdds = "over_odds"
            case underOdds = "under_odds"
            case l10Pct = "l10_pct"
            case actualValue = "actual_value"
            case result
            case unitsStaked = "units_staked"
            case unitsWon = "units_won"
        }

        var model: MLBPlayerPropGrade? {
            MLBPlayerPropGrade(
                reportDate: reportDate,
                gamePk: gamePk,
                playerId: playerId,
                market: market,
                side: side,
                playerName: playerName,
                teamName: teamName,
                marketLabel: marketLabel,
                kind: kind.flatMap { MLBPlayerPropPickKind(rawValue: $0) },
                tier: tier.flatMap { MLBPlayerPropPickTier(rawValue: $0) },
                score: score,
                line: line,
                overOdds: overOdds,
                underOdds: underOdds,
                l10Pct: l10Pct,
                actualValue: actualValue,
                result: result.flatMap { MLBPlayerPropPickResult(rawValue: $0) },
                unitsStaked: unitsStaked,
                unitsWon: unitsWon
            )
        }
    }
}
