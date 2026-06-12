import Foundation
import Supabase
import WagerproofModels

/// Hydrates the `NFLTeamAssets` cache from the `nfl_teams` reference table
/// (CFB/research Supabase): canonical `team_abbr` + `logo_espn` per
/// franchise. Loaded once per launch by whichever NFL surface fetches first;
/// failures are silent (cards fall back to the static identity map).
public actor NFLTeamsService {
    public static let shared = NFLTeamsService()
    public init() {}

    private var didLoad = false

    private struct TeamRow: Decodable {
        let teamAbbr: String
        let teamName: String?
        let teamNick: String?
        let logoEspn: String?
        enum CodingKeys: String, CodingKey {
            case teamAbbr = "team_abbr"
            case teamName = "team_name"
            case teamNick = "team_nick"
            case logoEspn = "logo_espn"
        }
    }

    public func ensureLoaded() async {
        if didLoad { return }
        let cfb = await CFBSupabase.shared.client
        guard let rows: [TeamRow] = try? await cfb
            .from("nfl_teams")
            .select("team_abbr, team_name, team_nick, logo_espn")
            .execute()
            .value, !rows.isEmpty
        else { return }
        didLoad = true
        let teams = rows.map {
            NFLTeamAssets.Team(abbr: $0.teamAbbr, name: $0.teamName ?? $0.teamAbbr, nick: $0.teamNick, logoEspn: $0.logoEspn)
        }
        await MainActor.run { NFLTeamAssets.install(teams) }
    }
}
