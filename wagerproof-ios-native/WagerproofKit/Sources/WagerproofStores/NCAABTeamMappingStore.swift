import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// Session-scoped cache of `ncaab_team_mapping` rows. Mirrors the RN
/// `useNCAABTeamMapping` module-level cache + fetch promise: the first
/// caller triggers a single `select(...)`; subsequent callers reuse the
/// in-memory `[String: NCAABTeamMappingEntry]` index.
///
/// Two index keys are stored per row — by `teamranking_team_name` and by
/// `api_team_id` — to match RN's substring fallback lookup behavior.
@Observable
@MainActor
public final class NCAABTeamMappingStore {
    /// Keyed by trimmed `teamranking_team_name` (case-sensitive original case)
    /// plus a lowercased alias so RN's `name.toLowerCase()` lookup matches.
    public private(set) var byName: [String: NCAABTeamMappingEntry] = [:]
    /// Keyed by `api_team_id`.
    public private(set) var byApiTeamId: [Int: NCAABTeamMappingEntry] = [:]
    public private(set) var isLoaded: Bool = false

    /// In-flight task so concurrent callers don't kick off duplicate queries
    /// (RN uses a module-level `fetchPromise` for the same reason).
    private var inflight: Task<Void, Never>?

    public init() {}

    /// Trigger a one-time fetch. Subsequent calls are no-ops once loaded.
    public func load() async {
        if isLoaded { return }
        if let inflight {
            await inflight.value
            return
        }
        let task = Task { @MainActor [weak self] in
            guard let self else { return }
            await self.performLoad()
        }
        inflight = task
        await task.value
    }

    private func performLoad() async {
        defer { inflight = nil }
        let cfb = await CFBSupabase.shared.client
        let rows: [Row] = (try? await cfb
            .from("ncaab_team_mapping")
            .select("api_team_id, espn_team_id, team_abbrev, teamranking_team_name")
            .execute()
            .value) ?? []

        var nameIdx: [String: NCAABTeamMappingEntry] = [:]
        var idIdx: [Int: NCAABTeamMappingEntry] = [:]
        for row in rows {
            // Resolve ESPN id (may arrive as String or Int from the API).
            let espnId: Int? = {
                if let intVal = row.espnTeamIdInt { return intVal }
                if let strVal = row.espnTeamIdString, let parsed = Int(strVal) { return parsed }
                return nil
            }()
            let logo: String? = {
                guard let espnId else { return nil }
                // RN: https://a.espncdn.com/i/teamlogos/ncaa/500/{espn_team_id}.png
                return "https://a.espncdn.com/i/teamlogos/ncaa/500/\(espnId).png"
            }()
            let abbrev: String? = {
                guard let raw = row.teamAbbrev?.trimmingCharacters(in: .whitespaces), !raw.isEmpty else { return nil }
                return raw
            }()
            let teamRankingName: String? = {
                guard let raw = row.teamRankingName?.trimmingCharacters(in: .whitespaces), !raw.isEmpty else { return nil }
                return raw
            }()
            let entry = NCAABTeamMappingEntry(
                apiTeamId: row.apiTeamId,
                abbrev: abbrev,
                logoUrl: logo,
                teamRankingName: teamRankingName
            )
            if let name = teamRankingName {
                nameIdx[name] = entry
                nameIdx[name.lowercased()] = entry
            }
            idIdx[row.apiTeamId] = entry
        }
        self.byName = nameIdx
        self.byApiTeamId = idIdx
        self.isLoaded = true
    }

    /// RN-equivalent name lookup: exact match first, then a length-gated
    /// substring/contains fallback (≥6 chars) for cases like
    /// "Central Arkansas" vs "Cent. Arkansas Bears".
    public func lookup(teamName: String) -> NCAABTeamMappingEntry? {
        let trimmed = teamName.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return nil }
        if let exact = byName[trimmed] ?? byName[trimmed.lowercased()] {
            return exact
        }
        let lower = trimmed.lowercased()
        guard lower.count >= 6 else { return nil }
        for (key, info) in byName where key == key.lowercased() {
            if key.contains(lower) || lower.contains(key) {
                return info
            }
        }
        return nil
    }

    public func lookup(apiTeamId: Int) -> NCAABTeamMappingEntry? {
        byApiTeamId[apiTeamId]
    }

    private struct Row: Decodable, Sendable {
        let apiTeamId: Int
        let espnTeamIdInt: Int?
        let espnTeamIdString: String?
        let teamAbbrev: String?
        let teamRankingName: String?

        enum CodingKeys: String, CodingKey {
            case apiTeamId = "api_team_id"
            case espnTeamId = "espn_team_id"
            case teamAbbrev = "team_abbrev"
            case teamRankingName = "teamranking_team_name"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            apiTeamId = try c.decode(Int.self, forKey: .apiTeamId)
            // espn_team_id arrives as Int or String depending on the row.
            if let n = try? c.decode(Int.self, forKey: .espnTeamId) {
                espnTeamIdInt = n
                espnTeamIdString = nil
            } else if let s = try? c.decode(String.self, forKey: .espnTeamId) {
                espnTeamIdInt = nil
                espnTeamIdString = s
            } else {
                espnTeamIdInt = nil
                espnTeamIdString = nil
            }
            teamAbbrev = try? c.decode(String.self, forKey: .teamAbbrev)
            teamRankingName = try? c.decode(String.self, forKey: .teamRankingName)
        }
    }
}
