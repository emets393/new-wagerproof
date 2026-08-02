import Foundation

/// Pipeline scaffolding keys that fire on nearly every game.
/// Never render as per-game signal chips / feed badges.
public enum FootballBlanketSignals {
    public static let nfl: Set<String> = ["sides_model"]
    public static let cfb: Set<String> = [
        "model_lean",
        "opener_under",
        "rivalry_week_over",
    ]

    public static func isBlanket(sport: String, key: String) -> Bool {
        let normalized = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return true }
        switch sport.lowercased() {
        case "nfl": return nfl.contains(normalized)
        case "cfb": return cfb.contains(normalized)
        default: return false
        }
    }

    public static func displayKeys(sport: String, keys: [String]) -> [String] {
        var seen = Set<String>()
        return keys.compactMap { key in
            let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty, !isBlanket(sport: sport, key: trimmed) else { return nil }
            guard seen.insert(trimmed).inserted else { return nil }
            return trimmed
        }
    }
}
