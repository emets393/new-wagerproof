import Foundation
import Supabase
import WagerproofModels

/// Hydrates the CFB team reference cache (`cfb_teams`) once per launch. The
/// dry-run slate uses this for AP-rank rows, logos, conferences, and CFBD colors.
public actor CFBTeamsService {
    public static let shared = CFBTeamsService()
    public init() {}

    private var didLoad = false

    private struct TeamRow: Decodable {
        let teamName: String
        let abbr: String?
        let conference: String?
        let classification: String?
        let color: String?
        let altColor: String?
        let logo: String?
        let logoDark: String?

        enum CodingKeys: String, CodingKey {
            case teamName = "team_name"
            case abbr, conference, classification, color, logo
            case altColor = "alt_color"
            case logoDark = "logo_dark"
        }
    }

    public func ensureLoaded() async {
        if didLoad { return }
        let cfb = await CFBSupabase.shared.client
        guard let rows: [TeamRow] = try? await cfb
            .from("cfb_teams")
            .select("team_name, abbr, conference, classification, color, alt_color, logo, logo_dark")
            .execute()
            .value, !rows.isEmpty
        else { return }

        didLoad = true
        let teams = rows.map {
            CFBTeamReference(
                teamName: $0.teamName,
                abbr: $0.abbr,
                conference: $0.conference,
                classification: $0.classification,
                color: $0.color,
                altColor: $0.altColor,
                logo: $0.logo,
                logoDark: $0.logoDark
            )
        }
        await MainActor.run { CFBTeamAssets.install(teams) }
    }
}
