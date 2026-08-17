import Foundation
import Supabase
import WagerproofModels

/// Hydrates `SportsbookCatalog` from `nfl_sportsbooks` and `cfb_sportsbooks`
/// (`book_key`, `display_name`, `logo_url`, `domain`). Same pattern as
/// `NFLTeamsService` / `nfl_teams`: load once per launch, then every chip
/// reads the row synchronously.
public actor SportsbookCatalogService {
    public static let shared = SportsbookCatalogService()
    public init() {}

    private var didLoad = false

    private struct BookRow: Decodable {
        let bookKey: String
        let displayName: String?
        let logoUrl: String?
        let domain: String?

        enum CodingKeys: String, CodingKey {
            case bookKey = "book_key"
            case displayName = "display_name"
            case logoUrl = "logo_url"
            case domain
        }
    }

    public func ensureLoaded() async {
        if didLoad { return }
        let cfb = await CFBSupabase.shared.client
        let nflRows: [BookRow] = (try? await cfb
            .from("nfl_sportsbooks")
            .select("book_key, display_name, logo_url, domain")
            .execute()
            .value) ?? []
        let cfbRows: [BookRow] = (try? await cfb
            .from("cfb_sportsbooks")
            .select("book_key, display_name, logo_url, domain")
            .execute()
            .value) ?? []
        guard !nflRows.isEmpty || !cfbRows.isEmpty else { return }
        didLoad = true
        // NFL first so a key present in both tables keeps the NFL `logo_url`.
        let merged = (nflRows + cfbRows).map {
            SportsbookCatalog.Book(
                key: $0.bookKey,
                name: $0.displayName ?? $0.bookKey,
                logoURL: $0.logoUrl,
                domain: $0.domain
            )
        }
        await MainActor.run { SportsbookCatalog.install(merged) }
    }
}
