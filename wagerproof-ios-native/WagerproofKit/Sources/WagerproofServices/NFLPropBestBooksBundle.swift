import Foundation
import WagerproofModels

/// Backend-precomputed best-shop fields keyed by `player_id|market`.
/// Shipped in the app bundle until `nfl_dryrun_props` carries these columns.
struct NFLPropBestBooksRecord: Decodable {
    let bestOverBook: String?
    let bestOverBookName: String?
    let bestOverBookLogo: String?
    let bestOverLine: Double?
    let bestOverPrice: Double?
    let bestUnderBook: String?
    let bestUnderBookName: String?
    let bestUnderBookLogo: String?
    let bestUnderLine: Double?
    let bestUnderPrice: Double?

    enum CodingKeys: String, CodingKey {
        case bestOverBook = "best_over_book"
        case bestOverBookName = "best_over_book_name"
        case bestOverBookLogo = "best_over_book_logo"
        case bestOverLine = "best_over_line"
        case bestOverPrice = "best_over_price"
        case bestUnderBook = "best_under_book"
        case bestUnderBookName = "best_under_book_name"
        case bestUnderBookLogo = "best_under_book_logo"
        case bestUnderLine = "best_under_line"
        case bestUnderPrice = "best_under_price"
    }
}

enum NFLPropBestBooksBundle {
    static let index: [String: NFLPropBestBooksRecord] = load()

    private static func load() -> [String: NFLPropBestBooksRecord] {
        guard let url = Bundle.module.url(
            forResource: "nfl_dryrun_prop_best_books",
            withExtension: "json"
        ) else { return [:] }
        return (try? Data(contentsOf: url))
            .flatMap { try? JSONDecoder().decode([String: NFLPropBestBooksRecord].self, from: $0) }
            ?? [:]
    }
}
