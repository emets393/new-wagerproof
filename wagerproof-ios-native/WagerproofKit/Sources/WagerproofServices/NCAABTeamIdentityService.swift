import Foundation
import Supabase
import WagerproofModels

/// Loads every `ncaab_team_mapping` row once so agent tickets can show the
/// same ESPN mark and `team_abbrev` the college basketball game cards use,
/// even when the games slate has not been opened.
public actor NCAABTeamIdentityService {
    public static let shared = NCAABTeamIdentityService()
    public init() {}

    private var didLoad = false

    public func ensureLoaded() async {
        if didLoad { return }
        let cfb = await CFBSupabase.shared.client
        let rows: [Row]
        do {
            rows = try await cfb
                .from("ncaab_team_mapping")
                .select("espn_team_id, team_abbrev, teamranking_team_name")
                .execute()
                .value
        } catch {
            return
        }
        didLoad = true
        var logos: [String: String] = [:]
        var abbrevs: [String: String] = [:]
        for row in rows {
            let name = row.teamRankingName?.trimmingCharacters(in: .whitespacesAndNewlines)
            let abbrev = row.teamAbbrev?.trimmingCharacters(in: .whitespacesAndNewlines)
            let logo = row.espnId.map { "https://a.espncdn.com/i/teamlogos/ncaa/500/\($0).png" }
            if let name, !name.isEmpty {
                if let logo { logos[name] = logo }
                if let abbrev, !abbrev.isEmpty { abbrevs[name] = abbrev }
            }
            if let abbrev, !abbrev.isEmpty {
                if let logo { logos[abbrev] = logo }
                abbrevs[abbrev] = abbrev
            }
        }
        await MainActor.run {
            NCAABTeamAssets.install(logos)
            NCAABTeamAssets.installAbbrevs(abbrevs)
        }
    }

    private struct Row: Decodable, Sendable {
        let espnId: Int?
        let teamAbbrev: String?
        let teamRankingName: String?

        enum CodingKeys: String, CodingKey {
            case espnTeamId = "espn_team_id"
            case teamAbbrev = "team_abbrev"
            case teamRankingName = "teamranking_team_name"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            if let n = try? c.decode(Int.self, forKey: .espnTeamId) {
                espnId = n
            } else if let s = try? c.decode(String.self, forKey: .espnTeamId), let n = Int(s) {
                espnId = n
            } else {
                espnId = nil
            }
            teamAbbrev = try? c.decode(String.self, forKey: .teamAbbrev)
            teamRankingName = try? c.decode(String.self, forKey: .teamRankingName)
        }
    }
}
