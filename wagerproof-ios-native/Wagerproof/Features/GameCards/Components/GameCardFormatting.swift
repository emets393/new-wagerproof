import Foundation
import SwiftUI
import WagerproofDesign

/// Shared formatting helpers + team color fallback used by the NFL and CFB
/// game cards / bottom sheets. Mirrors RN `utils/formatting.ts` +
/// `utils/teamColors.ts`.
///
/// FIDELITY-WAIVER #008: Real per-team color tables (the 500-line lookup in
/// `teamColors.ts`) port with the sport-specific batches. B04 uses a single
/// neutral palette so cards render even without team colors; reviewers
/// receive screenshots with placeholders highlighted.
enum GameCardFormatting {
    /// Formats a moneyline (+/-) integer to its display string.
    static func formatMoneyline(_ value: Int?) -> String {
        guard let value else { return "—" }
        return value > 0 ? "+\(value)" : "\(value)"
    }

    /// Formats a spread to display string. Spread is signed Double.
    static func formatSpread(_ value: Double?) -> String {
        guard let value else { return "—" }
        if value == value.rounded() {
            let v = Int(value)
            return v > 0 ? "+\(v)" : "\(v)"
        }
        return value > 0 ? "+\(String(format: "%.1f", value))" : String(format: "%.1f", value)
    }

    /// Round to nearest half (38.27 → 38.5). Used for O/U display.
    static func roundToNearestHalf(_ value: Double?) -> String {
        guard let value else { return "—" }
        let rounded = (value * 2).rounded() / 2
        if rounded == rounded.rounded() {
            return "\(Int(rounded))"
        }
        return String(format: "%.1f", rounded)
    }

    /// Format a date string (`YYYY-MM-DD` or ISO 8601) into a compact
    /// `Mon, Sep 14` display, matching RN's `formatCompactDate`.
    static func formatCompactDate(_ raw: String) -> String {
        let parsed: Date? = {
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let d = iso.date(from: raw) { return d }
            iso.formatOptions = [.withInternetDateTime]
            if let d = iso.date(from: raw) { return d }
            let fmt = DateFormatter()
            fmt.locale = Locale(identifier: "en_US_POSIX")
            fmt.timeZone = TimeZone(identifier: "America/New_York")
            for f in ["yyyy-MM-dd", "yyyy-MM-dd HH:mm:ss"] {
                fmt.dateFormat = f
                if let d = fmt.date(from: raw) { return d }
            }
            return nil
        }()
        guard let date = parsed else { return raw }
        let out = DateFormatter()
        out.locale = Locale(identifier: "en_US")
        out.timeZone = TimeZone(identifier: "America/New_York")
        out.dateFormat = "EEE, MMM d"
        return out.string(from: date)
    }

    /// Convert a game-time string (UTC ISO or `HH:mm`) to an EST display
    /// string. Mirrors RN's `convertTimeToEST`.
    static func convertTimeToEST(_ raw: String) -> String {
        if raw.isEmpty { return "" }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: raw) { return formatET(d) }
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: raw) { return formatET(d) }
        // Try `yyyy-MM-dd HH:mm:ss`
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "UTC")
        for f in ["yyyy-MM-dd HH:mm:ss", "HH:mm:ss", "HH:mm"] {
            fmt.dateFormat = f
            if let d = fmt.date(from: raw) { return formatET(d) }
        }
        return raw
    }

    private static func formatET(_ date: Date) -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US")
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        fmt.dateFormat = "h:mm a"
        return fmt.string(from: date) + " ET"
    }

    /// Pick a confidence color for a 50–100% probability slice.
    static func confidenceColor(_ percent: Int) -> Color {
        switch percent {
        case 80...: return Color(red: 0.13, green: 0.77, blue: 0.37) // strong green
        case 70..<80: return Color(red: 0.52, green: 0.80, blue: 0.09) // light green
        case 60..<70: return Color(red: 0.92, green: 0.70, blue: 0.03) // yellow
        default: return Color(red: 0.98, green: 0.45, blue: 0.09) // orange
        }
    }
}

/// Lightweight team-color pair fallback. Replaced per-sport in later
/// batches by the real RN color tables (`getNFLTeamColors`, etc.).
struct TeamColorPair: Hashable, Sendable {
    let primary: Color
    let secondary: Color

    static let neutralNFL = TeamColorPair(primary: Color(hex: 0x002244), secondary: Color(hex: 0xC8102E))
    static let neutralCFB = TeamColorPair(primary: Color(hex: 0x862633), secondary: Color(hex: 0xFFCD00))
    static let neutralNBA = TeamColorPair(primary: Color(hex: 0xC9082A), secondary: Color(hex: 0x17408B))
    /// NCAAB shares CFB's college-sport palette by default. Per-school
    /// gradients ship with #008 alongside CFB / NCAA color tables.
    static let neutralNCAAB = TeamColorPair(primary: Color(hex: 0x862633), secondary: Color(hex: 0xFFCD00))
}

/// Tiny initials helper used as a TeamAvatar fallback when logo URLs aren't
/// wired up yet. Strips parens, takes first letters of up to 2 words.
enum TeamInitials {
    static func from(_ teamName: String) -> String {
        let cleaned = teamName.replacingOccurrences(of: "()", with: "").trimmingCharacters(in: .whitespaces)
        let words = cleaned.split(separator: " ")
        if words.count >= 2 {
            return String(words.prefix(2).map { $0.first ?? "?" })
        }
        return String(cleaned.prefix(3)).uppercased()
    }

    /// Split team into city + nickname pair if the name has multiple words.
    /// Mirrors RN's `getTeamParts(name)`.
    static func parts(of teamName: String) -> (city: String, name: String) {
        let words = teamName.split(separator: " ")
        if words.count < 2 { return (teamName, "") }
        if words.count == 2 {
            return (String(words[0]), String(words[1]))
        }
        // Heuristic for 3-word names like "Los Angeles Lakers": last word is nickname.
        let nickname = words.last.map(String.init) ?? ""
        let city = words.dropLast().joined(separator: " ")
        return (city, nickname)
    }
}
