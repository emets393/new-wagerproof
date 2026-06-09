import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// Loads tonight's MLB First-Five (F5) splits slate. 1:1 port of RN
/// `hooks/useMLBF5Splits.ts`:
///   1. `mlb_games_today` for today..+2 (drop postponed)
///   2. `mlb_team_mapping` to resolve team name → abbreviation
///   3. `mv_mlb_f5_team_splits` filtered to the slate's team abbreviations
///
/// All three live on the CFB (sports-data) Supabase, read anonymously.
@Observable
@MainActor
public final class MLBF5SplitsStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    public private(set) var games: [MLBF5Game] = []
    public private(set) var splitLookup: [String: MLBF5SplitRow] = [:]
    public private(set) var lastRefreshedAt: String?
    public private(set) var loadState: LoadState = .idle

    public var isLoading: Bool {
        if case .loading = loadState { return true }
        return false
    }
    public var errorMessage: String? {
        if case .failed(let m) = loadState { return m }
        return nil
    }

    public init() {}

    public func refresh() async {
        loadState = .loading
        let cfb = await CFBSupabase.shared.client
        let today = Self.todayET()
        let end = Self.addDays(today, 2)

        // 1. Today's slate.
        let scheduleRows: [ScheduleRow]
        do {
            scheduleRows = try await cfb
                .from("mlb_games_today")
                .select()
                .gte("official_date", value: today)
                .lte("official_date", value: end)
                .order("official_date", ascending: true)
                .order("game_time_et", ascending: true)
                .execute()
                .value
        } catch {
            loadState = .failed(error.localizedDescription)
            return
        }

        // 2. Team mapping (best-effort; the static MLBTeams map is the fallback).
        let mappingRows: [MLBTeamMapping] = (try? await cfb
            .from("mlb_team_mapping")
            .select()
            .execute()
            .value) ?? []
        var byName: [String: MLBTeamMapping] = [:]
        var byId: [Int: MLBTeamMapping] = [:]
        for m in mappingRows {
            if !m.teamName.isEmpty { byName[MLBTeams.normalize(m.teamName)] = m }
            if m.mlbApiId != 0 { byId[m.mlbApiId] = m }
        }

        let builtGames: [MLBF5Game] = scheduleRows
            .filter { !($0.isPostponed ?? false) }
            .map { row in
                let awayName = row.awayName
                let homeName = row.homeName
                let awayAbbr = MLBF5.toSplitTeamAbbr(Self.resolveTeam(awayName, teamId: row.awayId, byName: byName, byId: byId))
                let homeAbbr = MLBF5.toSplitTeamAbbr(Self.resolveTeam(homeName, teamId: row.homeId, byName: byName, byId: byId))
                return MLBF5Game(
                    gamePk: row.gamePk,
                    officialDate: row.officialDate,
                    gameTimeEt: row.gameTimeEt,
                    awayTeamName: awayName,
                    homeTeamName: homeName,
                    venueName: row.venueName,
                    awayAbbr: awayAbbr,
                    homeAbbr: homeAbbr,
                    awaySpName: row.awaySpName,
                    homeSpName: row.homeSpName,
                    awaySpHand: MLBF5.normalizePitchHand(row.awaySpHand),
                    homeSpHand: MLBF5.normalizePitchHand(row.homeSpHand),
                    totalLine: row.totalLine,
                    f5AwayMl: row.f5AwayMl,
                    f5HomeMl: row.f5HomeMl,
                    f5TotalLine: row.f5TotalLine
                )
            }

        // 3. Splits for the slate's teams.
        let abbrs = Array(Set(builtGames.flatMap { [$0.awayAbbr, $0.homeAbbr] })).sorted()
        if abbrs.isEmpty {
            games = builtGames
            splitLookup = [:]
            loadState = .loaded
            return
        }

        let splitRows: [MLBF5SplitRow] = (try? await cfb
            .from("mv_mlb_f5_team_splits")
            .select()
            .in("team_abbr", values: abbrs)
            .execute()
            .value) ?? []

        games = builtGames
        splitLookup = MLBF5.buildSplitLookup(splitRows)
        lastRefreshedAt = splitRows.compactMap { $0.lastRefreshedAt }.first
        loadState = .loaded
    }

    public func split(for game: MLBF5Game, side: String) -> MLBF5SplitRow? {
        if side == "away" {
            return MLBF5.findSplitRow(splitLookup, teamAbbr: game.awayAbbr, homeAway: "away", oppSpHand: game.homeSpHand)
        } else {
            return MLBF5.findSplitRow(splitLookup, teamAbbr: game.homeAbbr, homeAway: "home", oppSpHand: game.awaySpHand)
        }
    }

    // MARK: - Team resolution (mirrors RN `resolveTeam`)

    private static func resolveTeam(
        _ teamName: String,
        teamId: Int?,
        byName: [String: MLBTeamMapping],
        byId: [Int: MLBTeamMapping]
    ) -> String {
        let nameKey = MLBTeams.normalize(teamName)
        if let direct = byName[nameKey], !direct.team.isEmpty { return direct.team }
        if let teamId, let byTeamId = byId[teamId], !byTeamId.team.isEmpty { return byTeamId.team }
        for (key, mapping) in byName where key.contains(nameKey) || nameKey.contains(key) {
            if !mapping.team.isEmpty { return mapping.team }
        }
        if let info = MLBTeams.info(for: teamName) { return info.team }
        // Last-ditch: initials / first chars.
        let words = teamName.split(separator: " ")
        if words.count >= 2 {
            return words.suffix(3).map { String($0.prefix(1)) }.joined().uppercased()
        }
        return String(teamName.prefix(3)).uppercased()
    }

    // MARK: - Date helpers (ET, mirrors RN getTodayET / addDaysYmd)

    static func todayET() -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_CA") // yyyy-MM-dd
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: Date())
    }

    static func addDays(_ baseYmd: String, _ days: Int) -> String {
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = TimeZone(identifier: "America/New_York")
        parser.dateFormat = "yyyy-MM-dd"
        guard let base = parser.date(from: baseYmd),
              let shifted = Calendar.current.date(byAdding: .day, value: days, to: base) else {
            return baseYmd
        }
        return parser.string(from: shifted)
    }
}

// MARK: - Flexible schedule row decode

/// `mlb_games_today` is wide and column names drift across migrations, so we
/// read each field from the first present of several candidate keys — mirrors
/// the `||` fallbacks in the RN hook's `fetchF5Games`.
private struct ScheduleRow: Decodable {
    let gamePk: Int
    let officialDate: String
    let gameTimeEt: String?
    let awayName: String
    let homeName: String
    let venueName: String?
    let awayId: Int?
    let homeId: Int?
    let awaySpName: String?
    let homeSpName: String?
    let awaySpHand: String?
    let homeSpHand: String?
    let totalLine: Double?
    let f5AwayMl: Double?
    let f5HomeMl: Double?
    let f5TotalLine: Double?
    let isPostponed: Bool?

    struct AnyKey: CodingKey {
        var stringValue: String
        var intValue: Int? { nil }
        init?(stringValue: String) { self.stringValue = stringValue }
        init?(intValue: Int) { nil }
        init(_ s: String) { self.stringValue = s }
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        gamePk = c.firstInt(["game_pk", "gamePk"]) ?? 0
        officialDate = c.firstString(["official_date", "officialDate", "game_date_et"]) ?? ""
        gameTimeEt = c.firstString(["game_time_et", "gameTimeEt"])
        awayName = c.firstString(["away_team_name", "away_team", "away_team_full_name"]) ?? "Away"
        homeName = c.firstString(["home_team_name", "home_team", "home_team_full_name"]) ?? "Home"
        venueName = c.firstString(["venue_name", "venue"])
        awayId = c.firstInt(["away_team_id", "away_mlb_team_id", "away_id"])
        homeId = c.firstInt(["home_team_id", "home_mlb_team_id", "home_id"])
        awaySpName = c.firstString(["away_sp_name"])
        homeSpName = c.firstString(["home_sp_name"])
        awaySpHand = c.firstString(["away_sp_hand"])
        homeSpHand = c.firstString(["home_sp_hand"])
        totalLine = c.firstDouble(["total_line", "game_total_line"])
        f5AwayMl = c.firstDouble(["f5_away_ml"])
        f5HomeMl = c.firstDouble(["f5_home_ml"])
        f5TotalLine = c.firstDouble(["f5_total_line"])
        isPostponed = c.firstBool(["is_postponed", "postponed"])
    }
}

private extension KeyedDecodingContainer where Key == ScheduleRow.AnyKey {
    func firstString(_ keys: [String]) -> String? {
        for raw in keys {
            guard let key = ScheduleRow.AnyKey(stringValue: raw) else { continue }
            if let s = try? decode(String.self, forKey: key), !s.isEmpty { return s }
            if let i = try? decode(Int.self, forKey: key) { return String(i) }
            if let d = try? decode(Double.self, forKey: key) { return String(d) }
        }
        return nil
    }
    func firstInt(_ keys: [String]) -> Int? {
        for raw in keys {
            guard let key = ScheduleRow.AnyKey(stringValue: raw) else { continue }
            if let i = try? decode(Int.self, forKey: key) { return i == 0 ? nil : i }
            if let d = try? decode(Double.self, forKey: key) { return Int(d) == 0 ? nil : Int(d) }
            if let s = try? decode(String.self, forKey: key), let i = Int(s) { return i == 0 ? nil : i }
        }
        return nil
    }
    func firstDouble(_ keys: [String]) -> Double? {
        for raw in keys {
            guard let key = ScheduleRow.AnyKey(stringValue: raw) else { continue }
            if let d = try? decode(Double.self, forKey: key) { return d }
            if let i = try? decode(Int.self, forKey: key) { return Double(i) }
            if let s = try? decode(String.self, forKey: key), let d = Double(s) { return d }
        }
        return nil
    }
    func firstBool(_ keys: [String]) -> Bool? {
        for raw in keys {
            guard let key = ScheduleRow.AnyKey(stringValue: raw) else { continue }
            if let b = try? decode(Bool.self, forKey: key) { return b }
            if let i = try? decode(Int.self, forKey: key) { return i != 0 }
            if let s = try? decode(String.self, forKey: key) { return s == "true" || s == "t" || s == "1" }
        }
        return nil
    }
}
