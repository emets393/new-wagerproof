import Foundation
import Supabase
import WagerproofModels

/// Fetches NFL trend snapshots + dry-run slate from CFB Supabase.
/// Queries are scoped to the current slate and slim columns only — full-table
/// coach/ref pulls were ~4MB and timed out on device.
public actor OutliersTrendsService {
    public static let shared = OutliersTrendsService()
    public init() {}

    private static let cfbGameColumns = """
        game_id,season,week,home_team,away_team,fg_spread_close,fg_total_close,kickoff
        """

    private static let gameColumns = """
        game_id,season,week,home_ab,away_ab,home_team,away_team,\
        fg_spread_close,fg_total_close,kickoff,slot,assigned_referee
        """

    private static let teamColumns = "team_abbr,team_name,season,through_week,splits,matchups"

    private static let coachColumns = """
        coach,current_team,career_games,last_season,through_season,through_week,\
        splits,matchups,market_coverage
        """

    private static let refColumns = "referee,career_games,through_season,through_week,splits,market_coverage"

    private static let playerColumns = """
        player_id,player_name,position,current_team,markets,coverage,\
        through_season,through_week,splits,matchups
        """

    private static let trendCardColumns = """
        card_id,game_id,matchup_label,subject_kind,subject_name,subject_detail,\
        team_abbr,player_id,market_key,bet_type_label,trend_value,trend_sample_n,\
        headshot_url,rows,betting_lines,is_player_overflow
        """

    private static let mlbTeamTrendColumns = "team_abbr,team_name,season,through_date,splits,matchups"

    private static let mlbGameColumns = """
        game_pk,official_date,game_time_et,away_team_name,home_team_name,\
        away_team_id,home_team_id,away_ml,home_ml,away_spread,home_spread,total_line,is_postponed
        """

    /// Pre-rendered trend cards for the active sport.
    public func fetchPrecomputedCards(
        sport: OutliersTrendsSport,
        season: Int,
        week: Int
    ) async throws -> [OutliersTrendsCard] {
        let table = sport == .ncaaf ? "cfb_outliers_trend_cards" : "nfl_outliers_trend_cards"
        let cfb = await CFBSupabase.shared.client
        let rows: [TrendCardRow] = try await cfb
            .from(table)
            .select(Self.trendCardColumns)
            .eq("season", value: season)
            .eq("week", value: week)
            .order("sort_rank", ascending: false)
            .execute()
            .value
        return rows.map(\.model)
    }

    /// Current dry-run slate — latest season/week for the sport.
    public func fetchSlateGames(sport: OutliersTrendsSport) async throws -> [OutliersTrendsGame] {
        switch sport {
        case .nfl: return try await fetchNFLSlateGames()
        case .ncaaf: return try await fetchCFBSlateGames()
        case .mlb: return try await fetchMLBSlateGames()
        default: return []
        }
    }

    /// Pre-rendered trend cards from `nfl_outliers_trend_cards`.
    public func fetchPrecomputedCards(season: Int, week: Int) async throws -> [OutliersTrendsCard] {
        try await fetchPrecomputedCards(sport: .nfl, season: season, week: week)
    }

    /// Current NFL dry-run slate — latest season/week only.
    public func fetchSlateGames() async throws -> [OutliersTrendsGame] {
        try await fetchNFLSlateGames()
    }

    private func fetchNFLSlateGames() async throws -> [OutliersTrendsGame] {
        let cfb = await CFBSupabase.shared.client
        let anchor: [SlateWeekRow] = try await cfb
            .from("nfl_dryrun_games")
            .select("season,week")
            .order("season", ascending: false)
            .order("week", ascending: false)
            .limit(1)
            .execute()
            .value
        guard let slate = anchor.first else { return [] }
        let rows: [GameRow] = try await cfb
            .from("nfl_dryrun_games")
            .select(Self.gameColumns)
            .eq("season", value: slate.season)
            .eq("week", value: slate.week)
            .order("kickoff", ascending: true)
            .execute()
            .value
        return rows.map(\.model)
    }

    private func fetchCFBSlateGames() async throws -> [OutliersTrendsGame] {
        let cfb = await CFBSupabase.shared.client
        let anchor: [SlateWeekRow] = try await cfb
            .from("cfb_dryrun_games")
            .select("season,week")
            .order("season", ascending: false)
            .order("week", ascending: false)
            .limit(1)
            .execute()
            .value
        guard let slate = anchor.first else { return [] }
        let rows: [CFBGameRow] = try await cfb
            .from("cfb_dryrun_games")
            .select(Self.cfbGameColumns)
            .eq("season", value: slate.season)
            .eq("week", value: slate.week)
            .order("kickoff", ascending: true)
            .execute()
            .value
        return rows.map(\.model)
    }

    public func fetchMLBBundle() async throws -> MLBTrendsSlateBundle {
        let games = try await fetchMLBSlateGames()
        guard let first = games.first else {
            return MLBTrendsSlateBundle(games: [], season: currentMLBSeason(), throughDate: nil, teams: [])
        }
        let teamAbbrs = Array(Set(games.flatMap { [$0.homeAb, $0.awayAb] })).sorted()
        let trendsAbbrs = Array(Set(teamAbbrs.map { MLBTrendsEngine.trendsAbbr(for: $0) })).sorted()
        let teamsRaw = try await fetchMLBTeamTrends(season: first.season, teamAbbrs: trendsAbbrs)
        let appAbbrByTrends = Dictionary(
            uniqueKeysWithValues: teamAbbrs.map { (MLBTrendsEngine.trendsAbbr(for: $0), $0) }
        )
        let teams = teamsRaw.map { record in
            MLBTrendsEngine.remapTeamRecord(record, preferredAppAbbr: appAbbrByTrends[record.teamAbbr.uppercased()])
        }
        let throughDate = teams.compactMap(\.throughDate).sorted().last
        return MLBTrendsSlateBundle(
            games: games,
            season: first.season,
            throughDate: throughDate,
            teams: teams
        )
    }

    private func currentMLBSeason() -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/New_York") ?? .current
        let year = cal.component(.year, from: Date())
        let month = cal.component(.month, from: Date())
        return month >= 3 ? year : year - 1
    }

    private func fetchMLBSlateGames() async throws -> [OutliersTrendsGame] {
        let cfb = await CFBSupabase.shared.client
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        fmt.dateFormat = "yyyy-MM-dd"
        let today = Date()
        let cal = Calendar(identifier: .gregorian)
        guard let end = cal.date(byAdding: .day, value: 2, to: today) else { return [] }
        let startDate = fmt.string(from: today)
        let endDate = fmt.string(from: end)

        let rows: [MLBGameRow] = try await cfb
            .from("mlb_games_today")
            .select(Self.mlbGameColumns)
            .gte("official_date", value: startDate)
            .lte("official_date", value: endDate)
            .order("game_time_et", ascending: true)
            .execute()
            .value

        let active = rows.filter { !($0.isPostponed ?? false) }
        guard !active.isEmpty else { return [] }

        let pks = active.compactMap(\.gamePk)
        let scheduleMeta = await fetchMLBScheduleMeta(gamePks: pks, client: cfb)
        let preds = try await fetchMLBPredictionMeta(gamePks: pks, client: cfb)
        let teamMaps = try await fetchMLBTeamAbbrMaps(client: cfb)
        let season = currentMLBSeason()

        return active.compactMap { row in
            row.model(
                season: season,
                mapping: teamMaps.byName,
                mappingById: teamMaps.byId,
                schedule: scheduleMeta[row.gamePk ?? -1],
                prediction: preds[row.gamePk ?? -1]
            )
        }
    }

    private func fetchMLBTeamTrends(season: Int, teamAbbrs: [String]) async throws -> [MLBTeamTrendRecord] {
        guard !teamAbbrs.isEmpty else { return [] }
        let cfb = await CFBSupabase.shared.client
        let rows: [MLBTeamTrendRow] = try await cfb
            .from("mlb_team_trends")
            .select(Self.mlbTeamTrendColumns)
            .eq("season", value: season)
            .in("team_abbr", values: teamAbbrs)
            .execute()
            .value
        return rows.map(\.model)
    }

    /// Series game number lives on `mlb_signal_features_pregame`, not `mlb_schedule`.
    /// Best-effort only — cards still build without series context if unavailable.
    private func fetchMLBScheduleMeta(
        gamePks: [Int],
        client: SupabaseClient
    ) async -> [Int: MLBScheduleMetaRow] {
        guard !gamePks.isEmpty else { return [:] }
        let rows: [MLBScheduleMetaRow] = (try? await client
            .from("mlb_signal_features_pregame")
            .select("game_pk,series_game_number")
            .in("game_pk", values: gamePks)
            .eq("home_away", value: "home")
            .execute()
            .value) ?? []
        var byPk: [Int: MLBScheduleMetaRow] = [:]
        for row in rows {
            if let pk = row.gamePk { byPk[pk] = row }
        }
        if byPk.count < gamePks.count {
            let fallback: [MLBScheduleMetaRow] = (try? await client
                .from("mlb_signal_features_pregame")
                .select("game_pk,series_game_number")
                .in("game_pk", values: gamePks)
                .execute()
                .value) ?? []
            for row in fallback where row.gamePk.map({ byPk[$0] == nil }) ?? false {
                if let pk = row.gamePk { byPk[pk] = row }
            }
        }
        return byPk
    }

    private func fetchMLBPredictionMeta(
        gamePks: [Int],
        client: SupabaseClient
    ) async throws -> [Int: MLBPredictionMetaRow] {
        guard !gamePks.isEmpty else { return [:] }
        let rows: [MLBPredictionMetaRow] = try await client
            .from("mlb_predictions_current")
            .select("game_pk,f5_home_spread,f5_total_line")
            .in("game_pk", values: gamePks)
            .execute()
            .value
        return Dictionary(uniqueKeysWithValues: rows.compactMap { row in
            row.gamePk.map { ($0, row) }
        })
    }

    private struct MLBTeamAbbrMaps {
        let byName: [String: String]
        let byId: [Int: String]
    }

    private func fetchMLBTeamAbbrMaps(client: SupabaseClient) async throws -> MLBTeamAbbrMaps {
        let rows: [MLBTeamMapping] = (try? await client
            .from("mlb_team_mapping")
            .select("mlb_api_id,team_name,team")
            .execute()
            .value) ?? []
        var byName: [String: String] = [:]
        var byId: [Int: String] = [:]
        for row in rows where !row.team.isEmpty {
            byName[MLBTeams.normalize(row.teamName)] = row.team
            byId[row.mlbApiId] = row.team
        }
        return MLBTeamAbbrMaps(byName: byName, byId: byId)
    }

    public func fetchNFLBundle() async throws -> NFLTrendsSlateBundle {
        let games = try await fetchSlateGames()
        guard let first = games.first else {
            return NFLTrendsSlateBundle(
                games: [],
                season: 2025,
                throughWeek: 11,
                teams: [],
                coaches: [],
                referees: [],
                players: []
            )
        }
        return try await fetchTrendData(games: games, season: first.season, throughWeek: max(1, first.week - 1))
    }

    public func fetchTrendData(
        games: [OutliersTrendsGame],
        season: Int,
        throughWeek: Int
    ) async throws -> NFLTrendsSlateBundle {
        let cfb = await CFBSupabase.shared.client
        let teamAbbrs = Array(Set(games.flatMap { [$0.homeAb, $0.awayAb] })).sorted()
        let refereeNames = Array(Set(games.compactMap(\.assignedReferee).filter { !$0.isEmpty })).sorted()

        async let teamRows: [TeamRow] = cfb
            .from("nfl_team_trends")
            .select(Self.teamColumns)
            .eq("season", value: season)
            .eq("through_week", value: throughWeek)
            .in("team_abbr", values: teamAbbrs)
            .execute()
            .value

        async let coachRows: [CoachRow] = cfb
            .from("nfl_coach_trends")
            .select(Self.coachColumns)
            .eq("through_season", value: season)
            .eq("through_week", value: throughWeek)
            .eq("last_season", value: season)
            .in("current_team", values: teamAbbrs)
            .execute()
            .value

        async let refRows = fetchRefereeRows(
            client: cfb,
            season: season,
            throughWeek: throughWeek,
            names: refereeNames
        )

        async let playerRows: [PlayerRow] = cfb
            .from("nfl_player_prop_trends")
            .select(Self.playerColumns)
            .eq("through_season", value: season)
            .eq("through_week", value: throughWeek)
            .in("current_team", values: teamAbbrs)
            .execute()
            .value

        let teams = (try await teamRows).map { $0.model() }
        let coaches = (try await coachRows).map { $0.model() }
        let referees = (try await refRows).map { $0.model() }
        let players = (try await playerRows).map { $0.model() }

        return NFLTrendsSlateBundle(
            games: games,
            season: season,
            throughWeek: throughWeek,
            teams: teams,
            coaches: coaches,
            referees: referees,
            players: players
        )
    }

    private func fetchRefereeRows(
        client: SupabaseClient,
        season: Int,
        throughWeek: Int,
        names: [String]
    ) async throws -> [RefRow] {
        guard !names.isEmpty else { return [] }
        return try await client
            .from("nfl_referee_trends")
            .select(Self.refColumns)
            .eq("through_season", value: season)
            .eq("through_week", value: throughWeek)
            .in("referee", values: names)
            .execute()
            .value
    }

    // MARK: - Row decoders

    private struct TrendCardRow: Decodable {
        let cardId: String
        let gameId: String
        let matchupLabel: String
        let subjectKind: String
        let subjectName: String
        let subjectDetail: String?
        let teamAbbr: String?
        let playerId: String?
        let marketKey: String
        let betTypeLabel: String
        let trendValue: Double
        let trendSampleN: Int
        let headshotUrl: String?
        let rows: [TrendCardRowLine]
        let bettingLines: [TrendCardBettingLine]
        let isPlayerOverflow: Bool

        enum CodingKeys: String, CodingKey {
            case cardId = "card_id"
            case gameId = "game_id"
            case matchupLabel = "matchup_label"
            case subjectKind = "subject_kind"
            case subjectName = "subject_name"
            case subjectDetail = "subject_detail"
            case teamAbbr = "team_abbr"
            case playerId = "player_id"
            case marketKey = "market_key"
            case betTypeLabel = "bet_type_label"
            case trendValue = "trend_value"
            case trendSampleN = "trend_sample_n"
            case headshotUrl = "headshot_url"
            case rows
            case bettingLines = "betting_lines"
            case isPlayerOverflow = "is_player_overflow"
        }

        var model: OutliersTrendsCard {
            OutliersTrendsCard(
                id: cardId,
                gameId: gameId,
                matchupLabel: matchupLabel,
                subjectKind: OutliersTrendsSubjectKind(rawValue: subjectKind) ?? .team,
                subjectName: subjectName,
                subjectDetail: subjectDetail,
                teamAbbr: teamAbbr,
                playerId: playerId,
                marketKey: marketKey,
                betTypeLabel: betTypeLabel,
                trendValue: trendValue,
                trendSampleN: trendSampleN,
                lineContext: nil,
                headshotUrl: headshotUrl,
                bettingLines: bettingLines.map(\.model),
                rows: rows.map(\.model),
                isPlayerOverflow: isPlayerOverflow
            )
        }
    }

    private struct CFBGameRow: Decodable {
        let gameId: FlexibleString
        let season: Int?
        let week: Int?
        let homeTeam: String?
        let awayTeam: String?
        let fgSpreadClose: Double?
        let fgTotalClose: Double?
        let kickoff: String?

        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case season, week, kickoff
            case homeTeam = "home_team"
            case awayTeam = "away_team"
            case fgSpreadClose = "fg_spread_close"
            case fgTotalClose = "fg_total_close"
        }

        var model: OutliersTrendsGame {
            let home = homeTeam ?? "Home"
            let away = awayTeam ?? "Away"
            return OutliersTrendsGame(
                id: gameId.value,
                season: season ?? 2025,
                week: week ?? 1,
                awayAb: away,
                homeAb: home,
                awayTeam: away,
                homeTeam: home,
                fgSpreadClose: fgSpreadClose,
                fgTotalClose: fgTotalClose,
                kickoff: kickoff,
                slot: nil,
                assignedReferee: nil
            )
        }
    }

    private struct MLBScheduleMetaRow: Decodable {
        let gamePk: Int?
        let seriesGameNumber: Int?

        enum CodingKeys: String, CodingKey {
            case gamePk = "game_pk"
            case seriesGameNumber = "series_game_number"
        }
    }

    private struct MLBPredictionMetaRow: Decodable {
        let gamePk: Int?
        let f5HomeSpread: Double?
        let f5TotalLine: Double?

        enum CodingKeys: String, CodingKey {
            case gamePk = "game_pk"
            case f5HomeSpread = "f5_home_spread"
            case f5TotalLine = "f5_total_line"
        }
    }

    private struct MLBGameRow: Decodable {
        let gamePk: Int?
        let officialDate: String?
        let gameTimeEt: String?
        let awayTeamName: String?
        let homeTeamName: String?
        let awayTeamId: Int?
        let homeTeamId: Int?
        let awayMl: Double?
        let homeMl: Double?
        let awaySpread: Double?
        let homeSpread: Double?
        let totalLine: Double?
        let isPostponed: Bool?

        enum CodingKeys: String, CodingKey {
            case gamePk = "game_pk"
            case officialDate = "official_date"
            case gameTimeEt = "game_time_et"
            case awayTeamName = "away_team_name"
            case homeTeamName = "home_team_name"
            case awayTeamId = "away_team_id"
            case homeTeamId = "home_team_id"
            case awayMl = "away_ml"
            case homeMl = "home_ml"
            case awaySpread = "away_spread"
            case homeSpread = "home_spread"
            case totalLine = "total_line"
            case isPostponed = "is_postponed"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            if let i = try? c.decode(Int.self, forKey: .gamePk) {
                gamePk = i
            } else if let s = try? c.decode(String.self, forKey: .gamePk), let i = Int(s) {
                gamePk = i
            } else {
                gamePk = nil
            }
            officialDate = try? c.decodeIfPresent(String.self, forKey: .officialDate)
            gameTimeEt = try? c.decodeIfPresent(String.self, forKey: .gameTimeEt)
            awayTeamName = try? c.decodeIfPresent(String.self, forKey: .awayTeamName)
            homeTeamName = try? c.decodeIfPresent(String.self, forKey: .homeTeamName)
            awayTeamId = Self.decodeInt(c, key: .awayTeamId)
            homeTeamId = Self.decodeInt(c, key: .homeTeamId)
            awayMl = Self.decodeNumeric(c, key: .awayMl)
            homeMl = Self.decodeNumeric(c, key: .homeMl)
            awaySpread = Self.decodeNumeric(c, key: .awaySpread)
            homeSpread = Self.decodeNumeric(c, key: .homeSpread)
            totalLine = Self.decodeNumeric(c, key: .totalLine)
            isPostponed = try? c.decodeIfPresent(Bool.self, forKey: .isPostponed)
        }

        private static func decodeInt(_ c: KeyedDecodingContainer<CodingKeys>, key: CodingKeys) -> Int? {
            if let i = try? c.decodeIfPresent(Int.self, forKey: key) { return i }
            if let s = try? c.decodeIfPresent(String.self, forKey: key), let i = Int(s) { return i }
            return nil
        }

        private static func decodeNumeric(_ c: KeyedDecodingContainer<CodingKeys>, key: CodingKeys) -> Double? {
            if let d = try? c.decodeIfPresent(Double.self, forKey: key) { return d }
            if let i = try? c.decodeIfPresent(Int.self, forKey: key) { return Double(i) }
            return nil
        }

        func model(
            season: Int,
            mapping: [String: String],
            mappingById: [Int: String],
            schedule: MLBScheduleMetaRow?,
            prediction: MLBPredictionMetaRow?
        ) -> OutliersTrendsGame? {
            guard let pk = gamePk else { return nil }
            let awayName = awayTeamName ?? "Away"
            let homeName = homeTeamName ?? "Home"
            let awayAb = awayTeamId.flatMap { mappingById[$0] }
                ?? mapping[MLBTeams.normalize(awayName)]
                ?? MLBTeams.info(for: awayName)?.team
                ?? String(awayName.prefix(3)).uppercased()
            let homeAb = homeTeamId.flatMap { mappingById[$0] }
                ?? mapping[MLBTeams.normalize(homeName)]
                ?? MLBTeams.info(for: homeName)?.team
                ?? String(homeName.prefix(3)).uppercased()
            let kickoff = gameTimeEt ?? officialDate
            let isDivisional = MLBTrendsEngine.isDivisionGame(home: homeAb, away: awayAb)
            let isDay = MLBTrendsEngine.isDayGame(kickoff: kickoff)
            let mlbContext = OutliersTrendsMLBContext(
                homeMl: homeMl,
                awayMl: awayMl,
                homeSpread: homeSpread,
                totalLine: totalLine,
                f5HomeSpread: prediction?.f5HomeSpread,
                f5TotalLine: prediction?.f5TotalLine,
                isDivisional: isDivisional,
                isDayGame: isDay,
                seriesGameNumber: schedule?.seriesGameNumber
            )
            return OutliersTrendsGame(
                id: String(pk),
                season: season,
                week: 0,
                awayAb: awayAb,
                homeAb: homeAb,
                awayTeam: awayName,
                homeTeam: homeName,
                fgSpreadClose: homeSpread,
                fgTotalClose: totalLine,
                kickoff: kickoff,
                slot: nil,
                assignedReferee: nil,
                mlbContext: mlbContext
            )
        }
    }

    private struct MLBTeamTrendRow: Decodable {
        let teamAbbr: String
        let teamName: String?
        let season: Int
        let throughDate: String?
        let splits: JSONValue?
        let matchups: JSONValue?

        enum CodingKeys: String, CodingKey {
            case teamAbbr = "team_abbr"
            case teamName = "team_name"
            case season
            case throughDate = "through_date"
            case splits, matchups
            case team
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            if let abbr = try? c.decode(String.self, forKey: .teamAbbr) {
                teamAbbr = abbr
            } else {
                teamAbbr = try c.decode(String.self, forKey: .team)
            }
            teamName = try? c.decodeIfPresent(String.self, forKey: .teamName)
            season = (try? c.decode(Int.self, forKey: .season)) ?? 2026
            throughDate = try? c.decodeIfPresent(String.self, forKey: .throughDate)
            splits = try? c.decodeIfPresent(JSONValue.self, forKey: .splits)
            matchups = try? c.decodeIfPresent(JSONValue.self, forKey: .matchups)
        }

        var model: MLBTeamTrendRecord {
            MLBTeamTrendRecord(
                teamAbbr: teamAbbr,
                teamName: teamName,
                season: season,
                throughDate: throughDate,
                splits: OutliersTrendsService.decodeSplits(splits),
                matchups: OutliersTrendsService.decodeMatchups(matchups)
            )
        }
    }

    private struct FlexibleString: Decodable {
        let value: String

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let string = try? container.decode(String.self) {
                value = string
            } else if let int = try? container.decode(Int.self) {
                value = String(int)
            } else {
                value = ""
            }
        }
    }

    private struct TrendCardRowLine: Decodable {
        let id: String
        let text: String
        let coverageNote: String?
        let dominantPct: Double
        let sampleN: Int

        enum CodingKeys: String, CodingKey {
            case id, text
            case coverageNote = "coverage_note"
            case dominantPct = "dominant_pct"
            case sampleN = "sample_n"
        }

        var model: OutliersTrendsCardRow {
            OutliersTrendsCardRow(
                id: id,
                text: text,
                coverageNote: coverageNote,
                dominantPct: dominantPct,
                sampleN: sampleN
            )
        }
    }

    private struct TrendCardBettingLine: Decodable {
        let id: String
        let label: String
        let lineText: String
        let oddsText: String?
        let bookName: String?
        let bookLogoUrl: String?
        let teamAbbr: String?

        enum CodingKeys: String, CodingKey {
            case id, label
            case lineText = "line_text"
            case oddsText = "odds_text"
            case bookName = "book_name"
            case bookLogoUrl = "book_logo_url"
            case teamAbbr = "team_abbr"
        }

        var model: OutliersTrendsBettingLine {
            OutliersTrendsBettingLine(
                id: id,
                label: label,
                lineText: lineText,
                oddsText: oddsText,
                bookName: bookName,
                bookLogoUrl: bookLogoUrl,
                teamAbbr: teamAbbr
            )
        }
    }

    private struct SlateWeekRow: Decodable {
        let season: Int
        let week: Int
    }

    private struct GameRow: Decodable {
        let gameId: String
        let season: Int?
        let week: Int?
        let homeAb: String?
        let awayAb: String?
        let homeTeam: String?
        let awayTeam: String?
        let fgSpreadClose: Double?
        let fgTotalClose: Double?
        let kickoff: String?
        let slot: String?
        let assignedReferee: String?

        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case season, week, kickoff, slot
            case homeAb = "home_ab"
            case awayAb = "away_ab"
            case homeTeam = "home_team"
            case awayTeam = "away_team"
            case fgSpreadClose = "fg_spread_close"
            case fgTotalClose = "fg_total_close"
            case assignedReferee = "assigned_referee"
        }

        var model: OutliersTrendsGame {
            OutliersTrendsGame(
                id: gameId,
                season: season ?? 2025,
                week: week ?? 1,
                awayAb: awayAb ?? "???",
                homeAb: homeAb ?? "???",
                awayTeam: awayTeam ?? awayAb ?? "Away",
                homeTeam: homeTeam ?? homeAb ?? "Home",
                fgSpreadClose: fgSpreadClose,
                fgTotalClose: fgTotalClose,
                kickoff: kickoff,
                slot: slot,
                assignedReferee: assignedReferee
            )
        }
    }

    private struct TeamRow: Decodable {
        let teamAbbr: String
        let teamName: String?
        let season: Int
        let throughWeek: Int
        let splits: JSONValue?
        let matchups: JSONValue?

        enum CodingKeys: String, CodingKey {
            case teamAbbr = "team_abbr"
            case teamName = "team_name"
            case season
            case throughWeek = "through_week"
            case splits, matchups
        }

        func model() -> NFLTeamTrendRecord {
            NFLTeamTrendRecord(
                teamAbbr: teamAbbr,
                teamName: teamName,
                season: season,
                throughWeek: throughWeek,
                splits: OutliersTrendsService.decodeSplits(splits),
                matchups: OutliersTrendsService.decodeMatchups(matchups)
            )
        }
    }

    private struct CoachRow: Decodable {
        let coach: String
        let currentTeam: String?
        let careerGames: Int?
        let lastSeason: Int?
        let throughSeason: Int
        let throughWeek: Int
        let splits: JSONValue?
        let matchups: JSONValue?
        let marketCoverage: [String: String]?

        enum CodingKeys: String, CodingKey {
            case coach
            case currentTeam = "current_team"
            case careerGames = "career_games"
            case lastSeason = "last_season"
            case throughSeason = "through_season"
            case throughWeek = "through_week"
            case splits, matchups
            case marketCoverage = "market_coverage"
        }

        func model() -> NFLCoachTrendRecord {
            NFLCoachTrendRecord(
                coach: coach,
                currentTeam: currentTeam,
                careerGames: careerGames,
                lastSeason: lastSeason,
                throughSeason: throughSeason,
                throughWeek: throughWeek,
                splits: OutliersTrendsService.decodeSplits(splits),
                matchups: OutliersTrendsService.decodeMatchups(matchups),
                marketCoverage: marketCoverage
            )
        }
    }

    private struct RefRow: Decodable {
        let referee: String
        let careerGames: Int?
        let throughSeason: Int
        let throughWeek: Int
        let splits: JSONValue?
        let marketCoverage: [String: String]?

        enum CodingKeys: String, CodingKey {
            case referee
            case careerGames = "career_games"
            case throughSeason = "through_season"
            case throughWeek = "through_week"
            case splits
            case marketCoverage = "market_coverage"
        }

        func model() -> NFLRefereeTrendRecord {
            NFLRefereeTrendRecord(
                referee: referee,
                careerGames: careerGames,
                throughSeason: throughSeason,
                throughWeek: throughWeek,
                splits: OutliersTrendsService.decodeSplits(splits),
                marketCoverage: marketCoverage
            )
        }
    }

    private struct PlayerRow: Decodable {
        let playerId: String
        let playerName: String?
        let position: String?
        let currentTeam: String?
        let markets: [String]?
        let coverage: String?
        let throughSeason: Int
        let throughWeek: Int
        let splits: JSONValue?
        let matchups: JSONValue?

        enum CodingKeys: String, CodingKey {
            case playerId = "player_id"
            case playerName = "player_name"
            case position
            case currentTeam = "current_team"
            case markets, coverage
            case throughSeason = "through_season"
            case throughWeek = "through_week"
            case splits, matchups
        }

        func model() -> NFLPlayerPropTrendRecord {
            NFLPlayerPropTrendRecord(
                playerId: playerId,
                playerName: playerName,
                position: position,
                currentTeam: currentTeam,
                markets: markets ?? [],
                coverage: coverage,
                throughSeason: throughSeason,
                throughWeek: throughWeek,
                splits: OutliersTrendsService.decodeSplits(splits),
                matchups: OutliersTrendsService.decodeMatchups(matchups)
            )
        }
    }

    // MARK: - JSON helpers

    private enum JSONValue: Decodable {
        case object([String: JSONValue])
        case array([JSONValue])
        case string(String)
        case number(Double)
        case bool(Bool)
        case null

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if container.decodeNil() {
                self = .null
            } else if let b = try? container.decode(Bool.self) {
                self = .bool(b)
            } else if let n = try? container.decode(Double.self) {
                self = .number(n)
            } else if let s = try? container.decode(String.self) {
                self = .string(s)
            } else if let a = try? container.decode([JSONValue].self) {
                self = .array(a)
            } else if let o = try? container.decode([String: JSONValue].self) {
                self = .object(o)
            } else {
                self = .null
            }
        }

        var objectValue: [String: JSONValue]? {
            if case .object(let o) = self { return o }
            return nil
        }
    }

    private static func decodeSplits(_ value: JSONValue?) -> NFLTrendSplits {
        guard let root = value?.objectValue else { return [:] }
        var out: NFLTrendSplits = [:]
        for (market, marketVal) in root {
            guard let dims = marketVal.objectValue else { continue }
            var dimMap: [String: [String: NFLTrendSplitCell]] = [:]
            for (dim, dimVal) in dims {
                guard let windows = dimVal.objectValue else { continue }
                var winMap: [String: NFLTrendSplitCell] = [:]
                for (window, winVal) in windows {
                    if let cell = decodeSplitCell(winVal) {
                        winMap[window] = cell
                    }
                }
                if !winMap.isEmpty { dimMap[dim] = winMap }
            }
            if !dimMap.isEmpty { out[market] = dimMap }
        }
        return out
    }

    private static func decodeSplitCell(_ value: JSONValue) -> NFLTrendSplitCell? {
        guard let obj = value.objectValue,
              case .number(let h) = obj["h"] ?? .null,
              case .number(let l) = obj["l"] ?? .null,
              case .number(let n) = obj["n"] ?? .null else { return nil }
        let pctVal: Double
        if case .number(let pct) = obj["pct"] ?? .null {
            pctVal = pct
        } else {
            pctVal = n > 0 ? h / n : 0
        }
        let p: Int?
        if case .number(let pv) = obj["p"] ?? .null { p = Int(pv) } else { p = nil }
        return NFLTrendSplitCell(h: Int(h), l: Int(l), p: p, n: Int(n), pct: pctVal)
    }

    private static func decodeMatchups(_ value: JSONValue?) -> [String: NFLTrendMatchupRecord] {
        guard let root = value?.objectValue else { return [:] }
        var out: [String: NFLTrendMatchupRecord] = [:]
        for (opp, oppVal) in root {
            guard let obj = oppVal.objectValue else { continue }
            var markets: [String: NFLTrendH2HCell] = [:]
            for (key, val) in obj {
                if key == "meetings" { continue }
                if let cell = decodeH2HCell(val) {
                    markets[key] = cell
                }
            }
            let meetings: Int?
            if case .number(let m) = obj["meetings"] ?? .null { meetings = Int(m) } else { meetings = nil }
            out[opp] = NFLTrendMatchupRecord(meetings: meetings, markets: markets)
        }
        return out
    }

    private static func decodeH2HCell(_ value: JSONValue) -> NFLTrendH2HCell? {
        guard let obj = value.objectValue,
              case .number(let h) = obj["h"] ?? .null,
              case .number(let n) = obj["n"] ?? .null else { return nil }
        let pct: Double?
        if case .number(let p) = obj["pct"] ?? .null { pct = p } else { pct = n > 0 ? h / n : nil }
        return NFLTrendH2HCell(h: Int(h), n: Int(n), pct: pct)
    }
}
