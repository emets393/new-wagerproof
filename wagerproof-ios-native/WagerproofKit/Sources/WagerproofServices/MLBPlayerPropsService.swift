import Foundation
import Supabase
import WagerproofModels

/// Fetches and assembles the MLB player-props matchups feed from the CFB
/// (sports) Supabase project. Ports the RN `useMLBPitcherMatchups` +
/// `useMLBPlayerPropsL10` data flow:
///
///   1. `mlb_games_today`         schedule + starting pitchers (today..+2 ET)
///   2. `mlb_game_lineups`        batting orders for those games
///   3. `v_mlb_pitcher_archetypes` season archetype per starter
///   4. `mlb_team_mapping`        abbreviation + logo
///   5. `get_mlb_player_props_l10(p_game_pk)` RPC — prop ladder + game log,
///      fetched per game in parallel (the slate is ~15 games).
///
/// No auth needed — RLS on the CFB project exposes these to the anon role,
/// same as the games feed (`GamesStore.fetchMLB`).
public actor MLBPlayerPropsService {
    public static let shared = MLBPlayerPropsService()
    public init() {}

    /// Assemble every prop matchup for the current slate. Games without both
    /// starters posted, or that are postponed, are dropped (matches RN).
    public func fetchMatchups() async throws -> [MLBPropMatchup] {
        let cfb = await CFBSupabase.shared.client

        // Step 1 — schedule window (today through +2 days, ET). Same window
        // the games feed uses so the two surfaces stay in sync.
        let cal = Calendar(identifier: .gregorian)
        let today = Date()
        guard let dayAfter = cal.date(byAdding: .day, value: 2, to: today) else { return [] }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        fmt.dateFormat = "yyyy-MM-dd"
        let startDate = fmt.string(from: today)
        let endDate = fmt.string(from: dayAfter)

        let gameRows: [GamesTodayRow] = (try? await cfb
            .from("mlb_games_today")
            .select()
            .gte("official_date", value: startDate)
            .lte("official_date", value: endDate)
            .order("official_date", ascending: true)
            .order("game_time_et", ascending: true)
            .execute()
            .value) ?? []

        // Only games with both starters posted and not postponed get props.
        let eligible = gameRows.filter { row in
            row.isPostponed != true && row.awaySpId != nil && row.homeSpId != nil && row.gamePk != nil
        }
        if eligible.isEmpty { return [] }

        let gamePks = eligible.compactMap(\.gamePk)
        let pitcherIds = Array(Set(eligible.flatMap { [$0.awaySpId, $0.homeSpId].compactMap { $0 } }))
        let season = Int(startDate.prefix(4)) ?? cal.component(.year, from: today)

        // Steps 2–4 + props (step 5) run concurrently.
        async let lineupsTask = fetchLineups(cfb, gamePks: gamePks)
        async let archetypesTask = fetchArchetypes(cfb, pitcherIds: pitcherIds, season: season)
        async let mappingTask = fetchTeamMapping(cfb)
        async let propsTask = fetchAllProps(cfb, gamePks: gamePks)

        let lineups = await lineupsTask
        let archetypes = await archetypesTask
        let mapping = await mappingTask
        let propsByGame = await propsTask

        let lineupsByGame = Dictionary(grouping: lineups, by: \.gamePk)
        let archetypeById = Dictionary(archetypes.map { ($0.pitcherId, $0) }, uniquingKeysWith: { a, _ in a })
        let mappingByName = Dictionary(mapping.map { (MLBTeams.normalize($0.teamName), $0) }, uniquingKeysWith: { a, _ in a })
        let mappingById = Dictionary(mapping.map { ($0.mlbApiId, $0) }, uniquingKeysWith: { a, _ in a })

        return eligible.compactMap { row in
            guard let pk = row.gamePk,
                  let awaySpId = row.awaySpId,
                  let homeSpId = row.homeSpId else { return nil }

            let awayName = row.awayTeamName ?? row.awayTeam ?? "Away"
            let homeName = row.homeTeamName ?? row.homeTeam ?? "Home"

            // Resolve abbreviation + logo: mapping by id, then by name, then
            // the static team table (mirrors GamesStore.fetchMLB).
            let awayMapping = row.awayTeamId.flatMap { mappingById[$0] } ?? mappingByName[MLBTeams.normalize(awayName)]
            let homeMapping = row.homeTeamId.flatMap { mappingById[$0] } ?? mappingByName[MLBTeams.normalize(homeName)]
            let awayFallback = MLBTeams.info(for: awayName)
            let homeFallback = MLBTeams.info(for: homeName)
            let awayAbbr = awayMapping?.team ?? awayFallback?.team ?? Self.fallbackAbbrev(awayName)
            let homeAbbr = homeMapping?.team ?? homeFallback?.team ?? Self.fallbackAbbrev(homeName)

            let gameLineups = lineupsByGame[pk] ?? []
            let awayLineup = gameLineups
                .filter { row.awayTeamId != nil && $0.teamId == row.awayTeamId }
                .sorted { ($0.battingOrder ?? 999) < ($1.battingOrder ?? 999) }
            let homeLineup = gameLineups
                .filter { row.homeTeamId != nil && $0.teamId == row.homeTeamId }
                .sorted { ($0.battingOrder ?? 999) < ($1.battingOrder ?? 999) }

            let awayStarter = MLBPropStarter(
                pitcherId: awaySpId,
                name: row.awaySpName ?? "Away SP",
                teamLabel: awayName,
                hand: row.awaySpHand ?? "R",
                archetype: archetypeById[awaySpId]
            )
            let homeStarter = MLBPropStarter(
                pitcherId: homeSpId,
                name: row.homeSpName ?? "Home SP",
                teamLabel: homeName,
                hand: row.homeSpHand ?? "R",
                archetype: archetypeById[homeSpId]
            )

            return MLBPropMatchup(
                gamePk: pk,
                officialDate: row.officialDate ?? startDate,
                gameTimeEt: row.gameTimeEt,
                awayTeamName: awayName,
                homeTeamName: homeName,
                awayAbbr: awayAbbr,
                homeAbbr: homeAbbr,
                awayLogoUrl: awayMapping?.logoUrl ?? awayFallback?.logoUrl,
                homeLogoUrl: homeMapping?.logoUrl ?? homeFallback?.logoUrl,
                awayStarter: awayStarter,
                homeStarter: homeStarter,
                awayLineup: awayLineup,
                homeLineup: homeLineup,
                props: propsByGame[pk] ?? []
            )
        }
    }

    /// Fetch the prop ladder + game log for a single game. Exposed for
    /// callers that want to refresh one card.
    public func fetchProps(gamePk: Int) async throws -> [MLBPlayerPropRow] {
        let cfb = await CFBSupabase.shared.client
        struct Params: Encodable { let p_game_pk: Int }
        let rows: [MLBPlayerPropRow] = try await cfb
            .rpc("get_mlb_player_props_l10", params: Params(p_game_pk: gamePk))
            .execute()
            .value
        return rows
    }

    // MARK: - Sub-fetches

    private func fetchLineups(_ cfb: SupabaseClient, gamePks: [Int]) async -> [MLBLineupRow] {
        (try? await cfb
            .from("mlb_game_lineups")
            .select()
            .in("game_pk", values: gamePks)
            .order("batting_order", ascending: true)
            .execute()
            .value) ?? []
    }

    private func fetchArchetypes(_ cfb: SupabaseClient, pitcherIds: [Int], season: Int) async -> [MLBPitcherArchetypeProfile] {
        guard !pitcherIds.isEmpty else { return [] }
        return (try? await cfb
            .from("v_mlb_pitcher_archetypes")
            .select("pitcher_id, archetype, k_pct, gb_pct, fb_pct, bb_pct, max_fb_velo")
            .eq("season", value: season)
            .in("pitcher_id", values: pitcherIds)
            .execute()
            .value) ?? []
    }

    private func fetchTeamMapping(_ cfb: SupabaseClient) async -> [MLBTeamMapping] {
        (try? await cfb
            .from("mlb_team_mapping")
            .select()
            .execute()
            .value) ?? []
    }

    /// Fetch props for every game concurrently. A failed game yields no
    /// props rather than failing the whole feed.
    private func fetchAllProps(_ cfb: SupabaseClient, gamePks: [Int]) async -> [Int: [MLBPlayerPropRow]] {
        await withTaskGroup(of: (Int, [MLBPlayerPropRow]).self) { group in
            for pk in gamePks {
                group.addTask {
                    struct Params: Encodable { let p_game_pk: Int }
                    let rows: [MLBPlayerPropRow] = (try? await cfb
                        .rpc("get_mlb_player_props_l10", params: Params(p_game_pk: pk))
                        .execute()
                        .value) ?? []
                    return (pk, rows)
                }
            }
            var result: [Int: [MLBPlayerPropRow]] = [:]
            for await (pk, rows) in group { result[pk] = rows }
            return result
        }
    }

    private static func fallbackAbbrev(_ teamName: String) -> String {
        let trimmed = teamName.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "MLB" }
        return trimmed.split(separator: " ")
            .compactMap { $0.first }
            .prefix(3)
            .map { String($0).uppercased() }
            .joined()
    }

    // MARK: - Schedule decode

    /// Subset of `mlb_games_today` the props feed needs. Adds the starting
    /// pitcher id/hand columns the games feed doesn't decode.
    private struct GamesTodayRow: Decodable, Sendable {
        let gamePk: Int?
        let officialDate: String?
        let gameTimeEt: String?
        let awayTeamName: String?
        let homeTeamName: String?
        let awayTeam: String?
        let homeTeam: String?
        let awayTeamId: Int?
        let homeTeamId: Int?
        let isPostponed: Bool?
        let awaySpId: Int?
        let homeSpId: Int?
        let awaySpName: String?
        let homeSpName: String?
        let awaySpHand: String?
        let homeSpHand: String?

        enum CodingKeys: String, CodingKey {
            case gamePk = "game_pk"
            case officialDate = "official_date"
            case gameTimeEt = "game_time_et"
            case awayTeamName = "away_team_name"
            case homeTeamName = "home_team_name"
            case awayTeam = "away_team"
            case homeTeam = "home_team"
            case awayTeamId = "away_team_id"
            case homeTeamId = "home_team_id"
            case isPostponed = "is_postponed"
            case awaySpId = "away_sp_id"
            case homeSpId = "home_sp_id"
            case awaySpName = "away_sp_name"
            case homeSpName = "home_sp_name"
            case awaySpHand = "away_sp_hand"
            case homeSpHand = "home_sp_hand"
        }
    }
}
