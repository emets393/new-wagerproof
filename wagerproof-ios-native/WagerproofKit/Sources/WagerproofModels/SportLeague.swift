import Foundation

public enum SportLeague: String, Codable, CaseIterable, Sendable, Hashable {
    case nfl
    case cfb
    case nba
    case ncaab
    case mlb

    public var displayName: String {
        switch self {
        case .nfl: "NFL"
        case .cfb: "College Football"
        case .nba: "NBA"
        case .ncaab: "College Basketball"
        case .mlb: "MLB"
        }
    }

    public var sfSymbol: String {
        switch self {
        case .nfl, .cfb: "football.fill"
        case .nba, .ncaab: "basketball.fill"
        case .mlb: "baseball.fill"
        }
    }
}
