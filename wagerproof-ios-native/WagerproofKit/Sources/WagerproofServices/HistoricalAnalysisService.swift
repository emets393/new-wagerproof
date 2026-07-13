import Foundation
import Supabase
import WagerproofModels

/// Read-only warehouse RPCs for Historical Analysis.
/// Backend lives on CFBSupabase (`jpxnjuwglavsjbgbasnl`) — same project as dry-run tables.
public actor HistoricalAnalysisService {
    public static let shared = HistoricalAnalysisService()
    public init() {}

    private struct RPCParams: Encodable {
        let p_bet_type: String
        let p_filters: [String: JSONValue]
    }

    private struct PitcherRPCParams: Encodable {
        let p_q: String?
    }

    public func fetchAnalysis(
        sport: HistoricalAnalysisSport,
        betType: String,
        filters: [String: JSONValue]
    ) async throws -> HistoricalAnalysisResponse {
        let client = await CFBSupabase.shared.client
        let params = RPCParams(p_bet_type: betType, p_filters: filters)
        return try await client
            .rpc(sport.analysisRPC, params: params)
            .execute()
            .value
    }

    public func fetchUpcoming(
        sport: HistoricalAnalysisSport,
        betType: String,
        filters: [String: JSONValue]
    ) async throws -> [HistoricalAnalysisUpcomingGame] {
        let client = await CFBSupabase.shared.client
        let params = RPCParams(p_bet_type: betType, p_filters: filters)
        let rows: [HistoricalAnalysisUpcomingGame] = try await client
            .rpc(sport.upcomingRPC, params: params)
            .execute()
            .value
        return rows
    }

    /// Bootstrap coach/referee (NFL), conference (CFB), or empty analysis for MLB team list.
    public func fetchBootstrap(sport: HistoricalAnalysisSport) async throws -> HistoricalAnalysisResponse {
        let betType = sport == .mlb ? "ml" : "fg_spread"
        return try await fetchAnalysis(sport: sport, betType: betType, filters: [:])
    }

    /// MLB team abbr + name from `mlb_team_mapping`.
    public func fetchMLBTeamAbbrs() async throws -> [(abbr: String, name: String)] {
        let client = await CFBSupabase.shared.client
        struct Row: Decodable {
            let team: String
            let teamName: String?

            enum CodingKeys: String, CodingKey {
                case team
                case teamName = "team_name"
            }
        }
        let rows: [Row] = try await client
            .from("mlb_team_mapping")
            .select("team,team_name")
            .execute()
            .value
        return rows
            .map { (abbr: $0.team, name: $0.teamName ?? $0.team) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    /// Pitcher typeahead via `mlb_pitcher_options`. Empty query → `p_q: null` (same as web).
    public func fetchPitcherOptions(q: String) async throws -> [MlbPitcherOption] {
        let client = await CFBSupabase.shared.client
        let trimmed = q.trimmingCharacters(in: .whitespacesAndNewlines)
        let params = PitcherRPCParams(p_q: trimmed.isEmpty ? nil : trimmed)
        return try await client
            .rpc("mlb_pitcher_options", params: params)
            .execute()
            .value
    }

    /// CFB team names grouped by conference — used to OR multiple conferences via `team[]`.
    public func fetchConferenceTeamMap() async throws -> [String: [String]] {
        let client = await CFBSupabase.shared.client
        struct Row: Decodable {
            let teamName: String
            let conference: String?

            enum CodingKeys: String, CodingKey {
                case teamName = "team_name"
                case conference
            }
        }
        let rows: [Row] = try await client
            .from("cfb_teams")
            .select("team_name,conference")
            .execute()
            .value
        var map: [String: [String]] = [:]
        for row in rows {
            guard let conf = row.conference, !conf.isEmpty else { continue }
            map[conf, default: []].append(row.teamName)
        }
        for key in map.keys {
            map[key]?.sort()
        }
        return map
    }

    /// CFB team logos keyed by `cfb_team_mapping.api` name.
    public func fetchCFBLogos() async throws -> [String: String] {
        let client = await CFBSupabase.shared.client
        struct Row: Decodable {
            let api: String?
            let logoLight: String?

            enum CodingKeys: String, CodingKey {
                case api
                case logoLight = "logo_light"
            }
        }
        let rows: [Row] = try await client
            .from("cfb_team_mapping")
            .select("api,logo_light")
            .execute()
            .value
        var out: [String: String] = [:]
        for row in rows {
            if let api = row.api, let logo = row.logoLight, !logo.isEmpty {
                out[api] = logo
            }
        }
        return out
    }
}
