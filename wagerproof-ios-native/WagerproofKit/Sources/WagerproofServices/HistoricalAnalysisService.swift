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

    /// MLB team abbr + name from `mlb_team_mapping`, remapped to game-log codes (AZ/ATH).
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
        var seen = Set<String>()
        var out: [(abbr: String, name: String)] = []
        for row in rows {
            let abbr = MLBF5.toSplitTeamAbbr(row.team)
            guard !abbr.isEmpty, !seen.contains(abbr) else { continue }
            seen.insert(abbr)
            out.append((abbr: abbr, name: MLBF5.analysisTeamLabel(abbr, fallback: row.teamName ?? row.team)))
        }
        return out.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
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
    
    // MARK: - B4: NL Filter Chat
    
    public struct NLFilterPatchResponse: Decodable {
        public let snapshot: [String: JSONValue]?
        public let applied: [AppliedChange]?
        public let rejected: [String]?
        public let noChange: Bool?
        public let couldntMap: [String]?
        public let ambiguous: [String]?
        public let error: String?
        
        public struct AppliedChange: Decodable {
            public let dimension: String
            public let note: String?

            // The reducer's from/to are `unknown` (numbers, arrays, bools…) —
            // decoding them as String? used to fail the whole applied array and
            // the UI reported "didn't catch a filter" for successful patches.
            enum CodingKeys: String, CodingKey { case dimension, note }

            public init(dimension: String, note: String? = nil) {
                self.dimension = dimension
                self.note = note
            }

            public init(from decoder: Decoder) throws {
                let c = try decoder.container(keyedBy: CodingKeys.self)
                dimension = try c.decode(String.self, forKey: .dimension)
                note = try? c.decodeIfPresent(String.self, forKey: .note)
            }
        }

        enum CodingKeys: String, CodingKey {
            // Edge fn returns camelCase `noChange` — the old "no_change" mapping
            // made it decode as nil forever.
            case snapshot, applied, rejected, error, noChange, ambiguous
            case couldntMap = "couldnt_map"
        }
        
        public init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            
            // Decode snapshot as JSONValue dictionary
            snapshot = try container.decodeIfPresent([String: JSONValue].self, forKey: .snapshot)
            
            // Check both possible applied formats
            if let appliedChanges = try? container.decodeIfPresent([AppliedChange].self, forKey: .applied) {
                applied = appliedChanges
            } else if let appliedStrings = try? container.decodeIfPresent([String].self, forKey: .applied) {
                // Convert string array to AppliedChange array for backward compatibility
                applied = appliedStrings.map { AppliedChange(dimension: $0) }
            } else {
                applied = nil
            }
            
            rejected = try container.decodeIfPresent([String].self, forKey: .rejected)
            noChange = try container.decodeIfPresent(Bool.self, forKey: .noChange)
            couldntMap = try container.decodeIfPresent([String].self, forKey: .couldntMap)
            ambiguous = try container.decodeIfPresent([String].self, forKey: .ambiguous)
            error = try container.decodeIfPresent(String.self, forKey: .error)
        }
    }
    
    /// Submit NL filter patch via main project Edge Function
    public func submitNLFilterPatch(
        sentence: String,
        currentFilter: [String: JSONValue],
        coaches: [String],
        referees: [String],
        sport: HistoricalAnalysisSport
    ) async throws -> NLFilterPatchResponse {
        let client = MainSupabase.shared.client
        
        struct RequestBody: Encodable {
            let sentence: String
            let currentFilter: [String: JSONValue]
            let coaches: [String]
            let referees: [String]
            let sport: String
            let apply: Bool
            
            enum CodingKeys: String, CodingKey {
                case sentence, currentFilter, coaches, referees, sport, apply
            }
        }
        
        let body = RequestBody(
            sentence: sentence,
            currentFilter: currentFilter,
            coaches: coaches,
            referees: referees,
            sport: sport.rawValue,
            apply: true
        )
        
        let response: NLFilterPatchResponse = try await client.functions.invoke(
            "nl-filter-patch",
            options: FunctionInvokeOptions(body: body)
        )
        
        return response
    }
}
