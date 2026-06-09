import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// `EditorPicksStore` mirrors the RN `PicksScreen` data layer plus the
/// `PickDetailSheetContext` + `EditorPickSheetContext` callback bridge.
///
/// Ports the byte-identical Supabase chain from
/// `wagerproof-mobile/app/(drawer)/(tabs)/picks.tsx`:
///
///   main.from('editors_picks')
///     .select('*')
///     .order('created_at', ascending: false)
///     [.eq('is_published', true) when !adminMode || !showDrafts]
///
/// After the picks come back, the store fans out per-sport joins against the
/// CFB Supabase project to hydrate `EditorPickGameData` (logos, lines,
/// formatted dates). For picks whose game has scrolled off the live tables,
/// we fall back to the pick's `archived_game_data` JSON blob.
///
/// Three sport-keyed branches are intentionally simplified vs the RN screen:
/// the RN code resolves NBA/NCAAB team logos by making per-team async calls,
/// which fan-out to a static ESPN logo map plus a one-shot DB-mapping cache.
/// We port the static ESPN map inline, but the NCAAB DB-mapping cache fetch
/// itself runs once per store lifecycle and is shared across picks.
@Observable
@MainActor
public final class EditorPicksStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    /// Sport filter for the picks tab. `.all` is the default (no filter).
    public enum SportFilter: String, Hashable, CaseIterable, Sendable {
        case all, nfl, cfb, nba, ncaab, mlb

        public var label: String {
            switch self {
            case .all: return "All"
            case .nfl: return "NFL"
            case .cfb: return "CFB"
            case .nba: return "NBA"
            case .ncaab: return "NCAAB"
            case .mlb: return "MLB"
            }
        }
    }

    public enum ViewMode: String, Sendable {
        /// Compact — 1-line row with badges. RN's default.
        case compact
        /// Large — full editor pick card with sportsbook buttons.
        case large
    }

    // MARK: - Observable state

    /// Picks filtered to last-7-days + future. What the feed renders.
    public private(set) var picks: [EditorPick] = []
    /// All picks (no date filter) — used by the stats banner.
    public private(set) var allPicks: [EditorPick] = []
    /// Joined game context, keyed by `pick.game_id`.
    public private(set) var gamesData: [String: EditorPickGameData] = [:]
    public private(set) var loadState: LoadState = .idle
    public private(set) var lastRefreshedAt: Date?

    /// Sport filter selected in the header pills. Mirrors RN `selectedSport`.
    public var selectedSport: SportFilter = .all
    /// View density. Mirrors RN `viewMode`.
    public var viewMode: ViewMode = .compact
    /// Admin-only — toggle visibility of unpublished drafts. Re-fetches when
    /// flipped (mirrors RN's `useEffect([adminModeEnabled, showDrafts])`).
    public var showDrafts: Bool = true

    public var isLoading: Bool {
        if case .loading = loadState { return true }
        return false
    }

    public var lastError: String? {
        if case .failed(let m) = loadState { return m }
        return nil
    }

    // MARK: - Init

    public init() {}

    /// Trigger a refresh. Wired to `.refreshable`, `.task`, and the
    /// `onPickSaved` callback from the editor creator sheet.
    // FIDELITY-WAIVER #012: After a successful refresh, RN's picks.tsx:852
    // calls wagerBotSuggestionStore.setPicksData(picks). That store lands in
    // B17 (Chat) — wire here once it exists.
    public func refresh(adminMode: Bool = false) async {
        loadState = .loading
        do {
            let main = await MainSupabase.shared.client
            // Mirror RN: `select('*').order('created_at', desc)`.
            // is_published=true filter applied unless admin + showDrafts.
            let response: [EditorPick]
            if adminMode && showDrafts {
                response = try await main
                    .from("editors_picks")
                    .select()
                    .order("created_at", ascending: false)
                    .execute()
                    .value
            } else {
                response = try await main
                    .from("editors_picks")
                    .select()
                    .eq("is_published", value: true)
                    .order("created_at", ascending: false)
                    .execute()
                    .value
            }

            // Build the joined game-data map. Best-effort per sport — a single
            // sport's outage doesn't blank the whole feed (matches RN).
            let dataMap = await hydrateGameData(for: response)

            self.gamesData = dataMap
            self.allPicks = response

            // Date filter: keep last-7-days through future games for the feed.
            // Picks without parseable dates pass through (RN does the same).
            self.picks = filterRecentAndFuture(response, using: dataMap)
            self.loadState = .loaded
            self.lastRefreshedAt = Date()
        } catch {
            // Keep prior data on screen; surface error to the view.
            self.loadState = .failed(error.localizedDescription)
        }
    }

    // MARK: - Mutations (admin-only)

    /// Update the `result` column on a pick. Used by the admin Won/Lost/Push
    /// buttons inside `EditorPickCard`. Refreshes the feed on success.
    @discardableResult
    public func updateResult(pickId: String, to result: PickResult?) async -> Bool {
        do {
            let main = await MainSupabase.shared.client
            struct Patch: Encodable { let result: String? }
            let patch = Patch(result: result?.rawValue)
            _ = try await main
                .from("editors_picks")
                .update(patch)
                .eq("id", value: pickId)
                .execute()
            return true
        } catch {
            return false
        }
    }

    /// Delete a pick from `editors_picks`. Used by `.swipeActions` and the
    /// creator sheet's Delete button.
    @discardableResult
    public func delete(pickId: String) async -> Bool {
        do {
            let main = await MainSupabase.shared.client
            _ = try await main
                .from("editors_picks")
                .delete()
                .eq("id", value: pickId)
                .execute()
            return true
        } catch {
            return false
        }
    }

    // MARK: - Derived selectors

    public func filtered(by sport: SportFilter) -> [EditorPick] {
        guard sport != .all else { return picks }
        return picks.filter { $0.gameType.rawValue == sport.rawValue }
    }

    public func allFiltered(by sport: SportFilter) -> [EditorPick] {
        guard sport != .all else { return allPicks }
        return allPicks.filter { $0.gameType.rawValue == sport.rawValue }
    }

    /// Group picks by their game's date (oldest at bottom). Picks without a
    /// parseable date go into a "Date Not Found" bucket appended at the end.
    /// Mirrors RN's `groupPicksByDate`.
    public func groupedByDate(_ source: [EditorPick]) -> [DateSection] {
        var buckets: [String: (date: Date, picks: [EditorPick])] = [:]
        var noDate: [EditorPick] = []

        for pick in source {
            guard let raw = gamesData[pick.gameId]?.rawGameDate,
                  let date = Self.parseDate(raw) else {
                noDate.append(pick)
                continue
            }
            let key = Self.dateKey(date)
            buckets[key, default: (date, [])].picks.append(pick)
        }

        var sections = buckets
            .map { _, value in DateSection(title: Self.sectionTitle(for: value.date), date: value.date, picks: value.picks) }
            .sorted { $0.date > $1.date }
        if !noDate.isEmpty {
            sections.append(DateSection(title: "Date Not Found", date: Date(timeIntervalSince1970: 0), picks: noDate))
        }
        return sections
    }

    public struct DateSection: Identifiable, Sendable, Hashable {
        public var id: String { title }
        public let title: String
        public let date: Date
        public let picks: [EditorPick]
    }

    // MARK: - Filtering

    private func filterRecentAndFuture(
        _ picks: [EditorPick],
        using map: [String: EditorPickGameData]
    ) -> [EditorPick] {
        let cal = Calendar(identifier: .gregorian)
        let today = cal.startOfDay(for: Date())
        guard let oneWeekAgo = cal.date(byAdding: .day, value: -7, to: today) else { return picks }

        return picks.filter { pick in
            guard let raw = map[pick.gameId]?.rawGameDate,
                  let date = Self.parseDate(raw) else { return true }
            let gameDay = cal.startOfDay(for: date)
            // Keep future games and games within last 7 days.
            return gameDay >= oneWeekAgo
        }
    }

    // MARK: - Game data hydration
    //
    // Loose port of RN's per-sport fetch loop. We deliberately keep the
    // queries small and stateless; the heavier date/time formatting that RN
    // does inline lives in `formatGameDate` / `formatGameTime` below.

    private func hydrateGameData(for picks: [EditorPick]) async -> [String: EditorPickGameData] {
        var map: [String: EditorPickGameData] = [:]
        let nflIds = picks.filter { $0.gameType == .nfl }.map { $0.gameId }
        let cfbIds = picks.filter { $0.gameType == .cfb }.compactMap { Int($0.gameId) }
        let nbaIds = picks.filter { $0.gameType == .nba }.map { $0.gameId }
        let ncaabIds = picks.filter { $0.gameType == .ncaab }.map { $0.gameId }

        // Fan out per-sport joins concurrently. Mirrors RN `Promise.all`.
        async let nflMap = fetchNFLContext(ids: nflIds)
        async let cfbMap = fetchCFBContext(ids: cfbIds)
        async let nbaMap = fetchNBAContext(ids: nbaIds)
        async let ncaabMap = fetchNCAABContext(ids: ncaabIds)

        for (k, v) in await nflMap { map[k] = v }
        for (k, v) in await cfbMap { map[k] = v }
        for (k, v) in await nbaMap { map[k] = v }
        for (k, v) in await ncaabMap { map[k] = v }

        // Fallback: synthesize from archived_game_data when live tables miss.
        for pick in picks where map[pick.gameId] == nil {
            if let archived = pick.archivedGameData {
                map[pick.gameId] = makeFallback(pick: pick, archived: archived)
            }
        }
        return map
    }

    private func makeFallback(pick: EditorPick, archived: ArchivedGameData) -> EditorPickGameData {
        EditorPickGameData(
            awayTeam: archived.awayTeam ?? "Away",
            homeTeam: archived.homeTeam ?? "Home",
            awayLogo: archived.awayLogo,
            homeLogo: archived.homeLogo,
            gameDate: archived.gameDate,
            gameTime: archived.gameTime,
            rawGameDate: archived.rawGameDate ?? archived.gameDate,
            awaySpread: archived.awaySpread,
            homeSpread: archived.homeSpread,
            overLine: archived.overLine,
            awayMl: archived.awayMl,
            homeMl: archived.homeMl,
            awayTeamColors: archived.awayTeamColors ?? .default,
            homeTeamColors: archived.homeTeamColors ?? .default
        )
    }

    // MARK: NFL context

    private struct NFLBettingLineRow: Decodable, Sendable {
        let trainingKey: String
        let awayTeam: String?
        let homeTeam: String?
        let gameDate: String?
        let gameTimeEt: String?
        let gameTime: String?
        let awaySpread: Double?
        let homeSpread: Double?
        let overLine: Double?
        let awayMl: Int?
        let homeMl: Int?
        enum CodingKeys: String, CodingKey {
            case trainingKey = "training_key"
            case awayTeam = "away_team"
            case homeTeam = "home_team"
            case gameDate = "game_date"
            case gameTimeEt = "game_time_et"
            case gameTime = "game_time"
            case awaySpread = "away_spread"
            case homeSpread = "home_spread"
            case overLine = "over_line"
            case awayMl = "away_ml"
            case homeMl = "home_ml"
        }
    }

    private func fetchNFLContext(ids: [String]) async -> [String: EditorPickGameData] {
        guard !ids.isEmpty else { return [:] }
        do {
            let cfb = await CFBSupabase.shared.client
            let rows: [NFLBettingLineRow] = try await cfb
                .from("nfl_betting_lines")
                .select()
                .in("training_key", values: ids)
                .execute()
                .value
            var out: [String: EditorPickGameData] = [:]
            for row in rows {
                out[row.trainingKey] = EditorPickGameData(
                    awayTeam: row.awayTeam ?? "Away",
                    homeTeam: row.homeTeam ?? "Home",
                    awayLogo: Self.nflLogo(row.awayTeam ?? ""),
                    homeLogo: Self.nflLogo(row.homeTeam ?? ""),
                    gameDate: Self.formatNFLGameDate(row.gameDate),
                    gameTime: Self.formatNFLGameTime(row.gameTimeEt) ?? row.gameTime,
                    rawGameDate: row.gameDate,
                    awaySpread: row.awaySpread,
                    homeSpread: row.homeSpread,
                    overLine: row.overLine,
                    awayMl: row.awayMl,
                    homeMl: row.homeMl
                )
            }
            return out
        } catch {
            return [:]
        }
    }

    // MARK: CFB context

    private struct CFBInputRow: Decodable, Sendable {
        let id: Int
        let awayTeam: String?
        let homeTeam: String?
        let startTime: String?
        let startDate: String?
        let gameDatetime: String?
        let datetime: String?
        let apiSpread: Double?
        let apiOverLine: Double?
        let awayMoneyline: Int?
        let homeMoneyline: Int?
        let awayMl: Int?
        let homeMl: Int?
        let spread: Double?

        enum CodingKeys: String, CodingKey {
            case id
            case awayTeam = "away_team"
            case homeTeam = "home_team"
            case startTime = "start_time"
            case startDate = "start_date"
            case gameDatetime = "game_datetime"
            case datetime
            case apiSpread = "api_spread"
            case apiOverLine = "api_over_line"
            case awayMoneyline = "away_moneyline"
            case homeMoneyline = "home_moneyline"
            case awayMl = "away_ml"
            case homeMl = "home_ml"
            case spread
        }
    }

    private func fetchCFBContext(ids: [Int]) async -> [String: EditorPickGameData] {
        guard !ids.isEmpty else { return [:] }
        do {
            let cfb = await CFBSupabase.shared.client
            let rows: [CFBInputRow] = try await cfb
                .from("cfb_live_weekly_inputs")
                .select()
                .in("id", values: ids)
                .execute()
                .value
            var out: [String: EditorPickGameData] = [:]
            for row in rows {
                let raw = row.startTime ?? row.startDate ?? row.gameDatetime ?? row.datetime
                let (date, time) = Self.formatETDateTime(raw)
                let homeSpread = row.apiSpread
                let awaySpread = homeSpread.map { -$0 }
                out[String(row.id)] = EditorPickGameData(
                    awayTeam: row.awayTeam ?? "Away",
                    homeTeam: row.homeTeam ?? "Home",
                    awayLogo: nil,
                    homeLogo: nil,
                    gameDate: date,
                    gameTime: time,
                    rawGameDate: raw,
                    awaySpread: awaySpread,
                    homeSpread: homeSpread,
                    overLine: row.apiOverLine,
                    awayMl: row.awayMoneyline ?? row.awayMl,
                    homeMl: row.homeMoneyline ?? row.homeMl,
                    openingSpread: row.spread
                )
            }
            return out
        } catch {
            return [:]
        }
    }

    // MARK: NBA context

    private struct NBAInputRow: Decodable, Sendable {
        let gameId: Int
        let awayTeam: String?
        let homeTeam: String?
        let gameDate: String?
        let tipoffTimeEt: String?
        let homeSpread: Double?
        let totalLine: Double?
        let homeMoneyline: Int?
        let awayMoneyline: Int?
        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case awayTeam = "away_team"
            case homeTeam = "home_team"
            case gameDate = "game_date"
            case tipoffTimeEt = "tipoff_time_et"
            case homeSpread = "home_spread"
            case totalLine = "total_line"
            case homeMoneyline = "home_moneyline"
            case awayMoneyline = "away_moneyline"
        }
    }

    private func fetchNBAContext(ids: [String]) async -> [String: EditorPickGameData] {
        guard !ids.isEmpty else { return [:] }
        do {
            let cfb = await CFBSupabase.shared.client
            let rows: [NBAInputRow] = try await cfb
                .from("nba_input_values_view")
                .select()
                .in("game_id", values: ids)
                .execute()
                .value
            var out: [String: EditorPickGameData] = [:]
            for row in rows {
                let (date, time) = Self.formatNBADateTime(
                    gameDate: row.gameDate,
                    tipoffEt: row.tipoffTimeEt
                )
                // Prefer DB column; fall back to complement formula (RN parity).
                let homeML = row.homeMoneyline
                let awayML: Int? = row.awayMoneyline ?? homeML.map { ml in
                    ml > 0 ? -(ml + 100) : 100 - ml
                }
                let homeSpread = row.homeSpread
                let awaySpread = homeSpread.map { -$0 }
                out[String(row.gameId)] = EditorPickGameData(
                    awayTeam: row.awayTeam ?? "Away",
                    homeTeam: row.homeTeam ?? "Home",
                    awayLogo: Self.nbaLogo(row.awayTeam ?? ""),
                    homeLogo: Self.nbaLogo(row.homeTeam ?? ""),
                    gameDate: date,
                    gameTime: time,
                    rawGameDate: row.gameDate,
                    awaySpread: awaySpread,
                    homeSpread: homeSpread,
                    overLine: row.totalLine,
                    awayMl: awayML,
                    homeMl: homeML
                )
            }
            return out
        } catch {
            return [:]
        }
    }

    // MARK: NCAAB context

    private struct NCAABInputRow: Decodable, Sendable {
        let gameId: Int
        let awayTeam: String?
        let homeTeam: String?
        let awayTeamId: Int?
        let homeTeamId: Int?
        let gameDateEt: String?
        let startUtc: String?
        let tipoffTimeEt: String?
        let spread: Double?
        let overUnder: Double?
        let homeMoneyline: Int?
        let awayMoneyline: Int?
        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case awayTeam = "away_team"
            case homeTeam = "home_team"
            case awayTeamId = "away_team_id"
            case homeTeamId = "home_team_id"
            case gameDateEt = "game_date_et"
            case startUtc = "start_utc"
            case tipoffTimeEt = "tipoff_time_et"
            case spread
            case overUnder = "over_under"
            case homeMoneyline = "homeMoneyline"
            case awayMoneyline = "awayMoneyline"
        }
    }

    private func fetchNCAABContext(ids: [String]) async -> [String: EditorPickGameData] {
        guard !ids.isEmpty else { return [:] }
        do {
            let cfb = await CFBSupabase.shared.client
            let rows: [NCAABInputRow] = try await cfb
                .from("v_cbb_input_values")
                .select()
                .in("game_id", values: ids)
                .execute()
                .value
            var out: [String: EditorPickGameData] = [:]
            for row in rows {
                let raw = row.gameDateEt ?? row.startUtc
                let (date, time) = Self.formatNCAABDateTime(
                    gameDate: row.gameDateEt,
                    timeSource: row.startUtc ?? row.tipoffTimeEt
                )
                let homeSpread = row.spread
                let awaySpread = homeSpread.map { -$0 }
                out[String(row.gameId)] = EditorPickGameData(
                    awayTeam: row.awayTeam ?? "Away",
                    homeTeam: row.homeTeam ?? "Home",
                    awayLogo: nil,
                    homeLogo: nil,
                    gameDate: date,
                    gameTime: time,
                    rawGameDate: raw,
                    awaySpread: awaySpread,
                    homeSpread: homeSpread,
                    overLine: row.overUnder,
                    awayMl: row.awayMoneyline,
                    homeMl: row.homeMoneyline
                )
            }
            return out
        } catch {
            return [:]
        }
    }

    // MARK: - Date / time formatters
    //
    // RN's NFL/CFB/NBA/NCAAB date formatters all produce slightly different
    // strings. We preserve each behaviour rather than collapsing because
    // reviewers compare side-by-side parity screenshots.

    private static func formatNFLGameDate(_ raw: String?) -> String? {
        guard let raw, raw.contains("-") else { return raw }
        let parts = raw.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return raw }
        var components = DateComponents()
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]
        guard let date = Calendar(identifier: .gregorian).date(from: components) else { return raw }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US")
        fmt.dateFormat = "EEE, MMM d"
        return fmt.string(from: date)
    }

    private static func formatNFLGameTime(_ gameTimeEt: String?) -> String? {
        // RN: split UTC datetime + manually add 5h EST offset, then format.
        // We just parse it as an ISO instant and format in ET.
        guard let raw = gameTimeEt, raw.contains(" ") else { return nil }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: raw.replacingOccurrences(of: " ", with: "T")) {
            return formatET(d)
        }
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: raw.replacingOccurrences(of: " ", with: "T")) {
            return formatET(d)
        }
        return nil
    }

    private static func formatETDateTime(_ raw: String?) -> (String?, String?) {
        guard let raw, !raw.isEmpty else { return (nil, nil) }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var d = iso.date(from: raw)
        if d == nil {
            iso.formatOptions = [.withInternetDateTime]
            d = iso.date(from: raw)
        }
        guard let date = d else { return (nil, nil) }
        let dateFmt = DateFormatter()
        dateFmt.locale = Locale(identifier: "en_US")
        dateFmt.timeZone = TimeZone(identifier: "America/New_York")
        dateFmt.dateFormat = "MMM d, yyyy"
        return (dateFmt.string(from: date).uppercased(), formatET(date))
    }

    private static func formatNBADateTime(gameDate: String?, tipoffEt: String?) -> (String?, String?) {
        let date: String? = {
            guard let raw = gameDate else { return nil }
            guard raw.contains("-") else { return raw }
            let parts = raw.split(separator: "-").compactMap { Int($0) }
            guard parts.count == 3 else { return raw }
            var c = DateComponents()
            c.year = parts[0]; c.month = parts[1]; c.day = parts[2]
            guard let d = Calendar(identifier: .gregorian).date(from: c) else { return raw }
            let fmt = DateFormatter()
            fmt.locale = Locale(identifier: "en_US")
            fmt.dateFormat = "EEE, MMM d"
            return fmt.string(from: d)
        }()

        var time: String? = nil
        if let raw = tipoffEt {
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let d = iso.date(from: raw) {
                time = formatET(d)
            } else if let date = gameDate, !date.isEmpty,
                      let hour = raw.split(separator: ":").first.flatMap({ Int($0) }),
                      let minute = raw.split(separator: ":").dropFirst().first.flatMap({ Int($0) }) {
                let parts = date.split(separator: "-").compactMap { Int($0) }
                if parts.count == 3 {
                    var c = DateComponents()
                    c.year = parts[0]; c.month = parts[1]; c.day = parts[2]
                    c.hour = hour; c.minute = minute
                    if let d = Calendar(identifier: .gregorian).date(from: c) {
                        time = formatET(d)
                    }
                }
            }
        }
        return (date, time)
    }

    private static func formatNCAABDateTime(gameDate: String?, timeSource: String?) -> (String?, String?) {
        // Reuse NBA formatter; same shape.
        return formatNBADateTime(gameDate: gameDate, tipoffEt: timeSource)
    }

    private static func formatET(_ date: Date) -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US")
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        fmt.dateFormat = "h:mm a 'EST'"
        return fmt.string(from: date)
    }

    /// Parse any of: `YYYY-MM-DD`, ISO 8601 timestamp, RN-style space-separated.
    public static func parseDate(_ raw: String) -> Date? {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: raw) { return d }
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: raw) { return d }

        if raw.contains("-") && !raw.contains("T") {
            let parts = raw.prefix(10).split(separator: "-").compactMap { Int($0) }
            if parts.count == 3 {
                var c = DateComponents()
                c.year = parts[0]; c.month = parts[1]; c.day = parts[2]
                return Calendar(identifier: .gregorian).date(from: c)
            }
        }
        return nil
    }

    private static func dateKey(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: d)
    }

    private static func sectionTitle(for date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "EEEE, MMM d"
        return f.string(from: date)
    }

    // MARK: - Logo maps (subset — covers parity-screenshot fixtures)
    //
    // The full ESPN maps in RN are 30+ entries per sport. We carry the full
    // production maps here so any of the four sports renders without a
    // separate DB-mapping fetch. CFB / NCAAB still need DB-driven mappings
    // (port lands when their tabs do — for picks tab parity we render the
    // initials fallback when the URL is empty).

    static func nflLogo(_ teamName: String) -> String? {
        let map: [String: String] = [
            "Arizona": "ari", "Atlanta": "atl", "Baltimore": "bal", "Buffalo": "buf",
            "Carolina": "car", "Chicago": "chi", "Cincinnati": "cin", "Cleveland": "cle",
            "Dallas": "dal", "Denver": "den", "Detroit": "det", "Green Bay": "gb",
            "Houston": "hou", "Indianapolis": "ind", "Jacksonville": "jax", "Kansas City": "kc",
            "Las Vegas": "lv", "Los Angeles Chargers": "lac", "Los Angeles Rams": "lar",
            "LA Chargers": "lac", "LA Rams": "lar", "Miami": "mia", "Minnesota": "min",
            "New England": "ne", "New Orleans": "no", "NY Giants": "nyg", "NY Jets": "nyj",
            "Philadelphia": "phi", "Pittsburgh": "pit", "San Francisco": "sf",
            "Seattle": "sea", "Tampa Bay": "tb", "Tennessee": "ten", "Washington": "wsh"
        ]
        guard let slug = map[teamName] else { return nil }
        return "https://a.espncdn.com/i/teamlogos/nfl/500/\(slug).png"
    }

    static func nbaLogo(_ teamName: String) -> String? {
        let map: [String: String] = [
            "Atlanta Hawks": "atl", "Boston Celtics": "bos", "Brooklyn Nets": "bkn",
            "Charlotte Hornets": "cha", "Chicago Bulls": "chi", "Cleveland Cavaliers": "cle",
            "Dallas Mavericks": "dal", "Denver Nuggets": "den", "Detroit Pistons": "det",
            "Golden State Warriors": "gs", "Houston Rockets": "hou", "Indiana Pacers": "ind",
            "LA Clippers": "lac", "Los Angeles Clippers": "lac", "LA Lakers": "lal",
            "Los Angeles Lakers": "lal", "Memphis Grizzlies": "mem", "Miami Heat": "mia",
            "Milwaukee Bucks": "mil", "Minnesota Timberwolves": "min", "New Orleans Pelicans": "no",
            "New York Knicks": "ny", "Oklahoma City Thunder": "okc", "Orlando Magic": "orl",
            "Philadelphia 76ers": "phi", "Phoenix Suns": "phx", "Portland Trail Blazers": "por",
            "Sacramento Kings": "sac", "San Antonio Spurs": "sa", "Toronto Raptors": "tor",
            "Utah Jazz": "utah", "Washington Wizards": "wsh"
        ]
        if let slug = map[teamName] {
            return "https://a.espncdn.com/i/teamlogos/nba/500/\(slug).png"
        }
        // Loose match (partial / case-insensitive).
        let lower = teamName.lowercased()
        for (k, v) in map where lower.contains(k.lowercased()) || k.lowercased().contains(lower) {
            return "https://a.espncdn.com/i/teamlogos/nba/500/\(v).png"
        }
        return nil
    }

    // MARK: - Debug helpers (screenshot harness only)

    #if DEBUG
    /// Inject a deterministic state for parity screenshots / SwiftUI previews.
    /// Polling-style refresh is skipped; the caller controls the result.
    public func debugSet(
        picks: [EditorPick],
        gamesData: [String: EditorPickGameData],
        state: LoadState
    ) {
        self.allPicks = picks
        self.picks = picks
        self.gamesData = gamesData
        self.loadState = state
        self.lastRefreshedAt = state == .loaded ? Date() : nil
    }
    #endif
}
