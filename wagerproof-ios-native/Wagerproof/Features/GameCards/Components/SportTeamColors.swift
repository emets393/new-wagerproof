import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Per-team color tables / resolvers used by the game-detail team-aura glow,
/// hero avatars, and list cards. MLB has `MLBTeams.colors`; NFL has
/// `NFLTeamColors.colorPair`. This file fills the remaining sports:
///   - NBA: a full 30-team table (`NBATeams.colorPair`)
///   - CFB / NCAAB: no authoritative table exists for the hundreds of D1 teams,
///     so `FallbackTeamColor` derives a STABLE, pleasant color from the team
///     name. It isn't the school's real brand color — it just gives each team a
///     consistent, distinct glow so the carousel's color transitions still read.
///     Real CFB/NCAAB brand tables are a follow-up data task.

// MARK: - NBA

enum NBATeams {
    /// Primary/secondary by full team name, with nickname fallback so the
    /// backend's varied name formats ("Los Angeles Lakers" / "Lakers") resolve.
    static func colorPair(for team: String) -> TeamColorPair {
        if team.isEmpty { return fallback }
        if let direct = table[team] { return direct }
        // Match on nickname contained in the supplied string.
        for (nickname, pair) in nicknameTable where team.localizedCaseInsensitiveContains(nickname) {
            return pair
        }
        return FallbackTeamColor.colorPair(for: team)
    }

    private static let fallback = TeamColorPair(primary: Color(hex: 0xC9082A), secondary: Color(hex: 0x17408B))

    private static func pair(_ p: UInt32, _ s: UInt32) -> TeamColorPair {
        TeamColorPair(primary: Color(hex: Int(p)), secondary: Color(hex: Int(s)))
    }

    private static let table: [String: TeamColorPair] = [
        "Atlanta Hawks": pair(0xE03A3E, 0xC1D32F),
        "Boston Celtics": pair(0x007A33, 0xBA9653),
        "Brooklyn Nets": pair(0x1A1A1A, 0xFFFFFF),
        "Charlotte Hornets": pair(0x1D1160, 0x00788C),
        "Chicago Bulls": pair(0xCE1141, 0x000000),
        "Cleveland Cavaliers": pair(0x860038, 0xFDBB30),
        "Dallas Mavericks": pair(0x00538C, 0x0053BC),
        "Denver Nuggets": pair(0x0E2240, 0xFEC524),
        "Detroit Pistons": pair(0xC8102E, 0x1D42BA),
        "Golden State Warriors": pair(0x1D428A, 0xFFC72C),
        "Houston Rockets": pair(0xCE1141, 0x2C7AC3),
        "Indiana Pacers": pair(0x002D62, 0xFDBB30),
        "LA Clippers": pair(0xC8102E, 0x1D428A),
        "Los Angeles Clippers": pair(0xC8102E, 0x1D428A),
        "Los Angeles Lakers": pair(0x552583, 0xFDB927),
        "Memphis Grizzlies": pair(0x5D76A9, 0x12173F),
        "Miami Heat": pair(0x98002E, 0xF9A01B),
        "Milwaukee Bucks": pair(0x00471B, 0xEEE1C6),
        "Minnesota Timberwolves": pair(0x0C2340, 0x236192),
        "New Orleans Pelicans": pair(0x0C2340, 0xC8102E),
        "New York Knicks": pair(0x006BB6, 0xF58426),
        "Oklahoma City Thunder": pair(0x007AC1, 0xEF3B24),
        "Orlando Magic": pair(0x0077C0, 0xC4CED4),
        "Philadelphia 76ers": pair(0x006BB6, 0xED174C),
        "Phoenix Suns": pair(0x1D1160, 0xE56020),
        "Portland Trail Blazers": pair(0xE03A3E, 0x1A1A1A),
        "Sacramento Kings": pair(0x5A2D81, 0x63727A),
        "San Antonio Spurs": pair(0x8A8D8F, 0x1A1A1A),
        "Toronto Raptors": pair(0xCE1141, 0x1A1A1A),
        "Utah Jazz": pair(0x002B5C, 0xF9A01B),
        "Washington Wizards": pair(0x002B5C, 0xE31837)
    ]

    private static let nicknameTable: [String: TeamColorPair] = [
        "Hawks": pair(0xE03A3E, 0xC1D32F), "Celtics": pair(0x007A33, 0xBA9653),
        "Nets": pair(0x1A1A1A, 0xFFFFFF), "Hornets": pair(0x1D1160, 0x00788C),
        "Bulls": pair(0xCE1141, 0x000000), "Cavaliers": pair(0x860038, 0xFDBB30),
        "Mavericks": pair(0x00538C, 0x0053BC), "Nuggets": pair(0x0E2240, 0xFEC524),
        "Pistons": pair(0xC8102E, 0x1D42BA), "Warriors": pair(0x1D428A, 0xFFC72C),
        "Rockets": pair(0xCE1141, 0x2C7AC3), "Pacers": pair(0x002D62, 0xFDBB30),
        "Clippers": pair(0xC8102E, 0x1D428A), "Lakers": pair(0x552583, 0xFDB927),
        "Grizzlies": pair(0x5D76A9, 0x12173F), "Heat": pair(0x98002E, 0xF9A01B),
        "Bucks": pair(0x00471B, 0xEEE1C6), "Timberwolves": pair(0x0C2340, 0x236192),
        "Pelicans": pair(0x0C2340, 0xC8102E), "Knicks": pair(0x006BB6, 0xF58426),
        "Thunder": pair(0x007AC1, 0xEF3B24), "Magic": pair(0x0077C0, 0xC4CED4),
        "76ers": pair(0x006BB6, 0xED174C), "Sixers": pair(0x006BB6, 0xED174C),
        "Suns": pair(0x1D1160, 0xE56020), "Trail Blazers": pair(0xE03A3E, 0x1A1A1A),
        "Blazers": pair(0xE03A3E, 0x1A1A1A), "Kings": pair(0x5A2D81, 0x63727A),
        "Spurs": pair(0x8A8D8F, 0x1A1A1A), "Raptors": pair(0xCE1141, 0x1A1A1A),
        "Jazz": pair(0x002B5C, 0xF9A01B), "Wizards": pair(0x002B5C, 0xE31837)
    ]
}

// MARK: - MLB

enum MLBTeamColors {
    static func colorPair(for team: String) -> TeamColorPair {
        let pair = MLBTeams.colors(for: team)
        return TeamColorPair(
            primary: Color(hex: Int(pair.primary)),
            secondary: Color(hex: Int(pair.secondary))
        )
    }
}

// MARK: - Hashed fallback (CFB / NCAAB)

@MainActor
enum CFBTeamColors {
    static func colorPair(for team: String) -> TeamColorPair {
        let hex = CFBTeamAssets.colorHex(for: team)
        if let primary = parse(hex.primary) {
            return TeamColorPair(
                primary: Color(hex: primary),
                secondary: Color(hex: parse(hex.secondary) ?? primary)
            )
        }
        return FallbackTeamColor.colorPair(for: team)
    }

    private static func parse(_ raw: String?) -> Int? {
        guard let raw else { return nil }
        let cleaned = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")
        guard !cleaned.isEmpty else { return nil }
        return Int(cleaned, radix: 16)
    }
}

enum FallbackTeamColor {
    /// Deterministic, pleasant color derived from a stable hash of the team
    /// name. Not the school's real brand color — a consistent stand-in so the
    /// aura still varies per matchup until real tables land.
    static func colorPair(for team: String) -> TeamColorPair {
        guard !team.isEmpty else {
            return TeamColorPair(primary: Color(hex: 0x862633), secondary: Color(hex: 0xFFCD00))
        }
        // FNV-1a-ish stable hash (String.hashValue is randomized per run).
        var hash: UInt64 = 1469598103934665603
        for byte in team.lowercased().utf8 {
            hash = (hash ^ UInt64(byte)) &* 1099511628211
        }
        let hue = Double(hash % 360) / 360.0
        // Secondary hue offset for a little gradient interest.
        let hue2 = Double((hash / 360) % 360) / 360.0
        let primary = Color(hue: hue, saturation: 0.62, brightness: 0.78)
        let secondary = Color(hue: hue2, saturation: 0.5, brightness: 0.6)
        return TeamColorPair(primary: primary, secondary: secondary)
    }
}
