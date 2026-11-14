import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Per-team color tables / resolvers used by the game-detail team-aura glow,
/// hero avatars, and list cards. MLB has `MLBTeams.colors`; NFL has
/// `NFLTeamColors.colorPair`. This file fills the remaining sports:
///   - NBA: a full 30-team table (`NBATeams.colorPair`)
///   - CFB / NCAAB: `cfb_teams` brand colors, then ESPN school colors, then a
///     stable name hash when neither source has the school.

// MARK: - NBA

enum NBATeams {
    /// Primary/secondary by full team name, with nickname fallback so the
    /// backend's varied name formats ("Los Angeles Lakers" / "Lakers") resolve.
    static func colorPair(for team: String) -> TeamColorPair {
        if team.isEmpty { return fallback }
        if let direct = table[team] { return direct }
        let key = team.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if let code = abbreviations[key],
           let full = table.first(where: { abbreviations[$0.key.lowercased()] == code && $0.key.contains(" ") })?.value {
            return full
        }
        // Match on nickname contained in the supplied string.
        for (nickname, pair) in nicknameTable where team.localizedCaseInsensitiveContains(nickname) {
            return pair
        }
        return FallbackTeamColor.colorPair(for: team)
    }

    /// ESPN mark for a full name, nickname, city, or abbreviation. Known at
    /// render time, so the card does not wait on a team-table fetch.
    static func logoURL(for team: String) -> String? {
        let key = team.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard let slug = logoSlugs[key] else { return nil }
        return "https://a.espncdn.com/i/teamlogos/nba/500/\(slug).png"
    }

    /// Display code (NYK, PHI, GSW). Logo slugs stay separate — ESPN's `ny`
    /// is not the code shown on the card.
    static func abbreviation(for team: String) -> String {
        knownAbbreviation(for: team) ?? String(team.trimmingCharacters(in: .whitespacesAndNewlines).prefix(3)).uppercased()
    }

    /// Nil when the name is not a known franchise. The three-letter fallback
    /// is not a real code and must not be used to match two teams.
    static func knownAbbreviation(for team: String) -> String? {
        abbreviations[team.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()]
    }

    private static let abbreviations: [String: String] = [
        "atlanta hawks": "ATL", "atlanta": "ATL", "hawks": "ATL", "atl": "ATL",
        "boston celtics": "BOS", "boston": "BOS", "celtics": "BOS", "bos": "BOS",
        "brooklyn nets": "BKN", "brooklyn": "BKN", "nets": "BKN", "bkn": "BKN",
        "charlotte hornets": "CHA", "charlotte": "CHA", "hornets": "CHA", "cha": "CHA",
        "chicago bulls": "CHI", "chicago": "CHI", "bulls": "CHI", "chi": "CHI",
        "cleveland cavaliers": "CLE", "cleveland": "CLE", "cavaliers": "CLE", "cavs": "CLE", "cle": "CLE",
        "dallas mavericks": "DAL", "dallas": "DAL", "mavericks": "DAL", "mavs": "DAL", "dal": "DAL",
        "denver nuggets": "DEN", "denver": "DEN", "nuggets": "DEN", "den": "DEN",
        "detroit pistons": "DET", "detroit": "DET", "pistons": "DET", "det": "DET",
        "golden state warriors": "GSW", "golden state": "GSW", "warriors": "GSW", "gsw": "GSW", "gs": "GSW",
        "houston rockets": "HOU", "houston": "HOU", "rockets": "HOU", "hou": "HOU",
        "indiana pacers": "IND", "indiana": "IND", "pacers": "IND", "ind": "IND",
        "la clippers": "LAC", "los angeles clippers": "LAC", "clippers": "LAC", "lac": "LAC",
        "la lakers": "LAL", "los angeles lakers": "LAL", "lakers": "LAL", "lal": "LAL",
        "memphis grizzlies": "MEM", "memphis": "MEM", "grizzlies": "MEM", "mem": "MEM",
        "miami heat": "MIA", "miami": "MIA", "heat": "MIA", "mia": "MIA",
        "milwaukee bucks": "MIL", "milwaukee": "MIL", "bucks": "MIL", "mil": "MIL",
        "minnesota timberwolves": "MIN", "minnesota": "MIN", "timberwolves": "MIN", "wolves": "MIN", "min": "MIN",
        "new orleans pelicans": "NOP", "new orleans": "NOP", "pelicans": "NOP", "nop": "NOP", "no": "NOP",
        "new york knicks": "NYK", "new york": "NYK", "knicks": "NYK", "nyk": "NYK", "ny": "NYK",
        "oklahoma city thunder": "OKC", "oklahoma city": "OKC", "thunder": "OKC", "okc": "OKC",
        "orlando magic": "ORL", "orlando": "ORL", "magic": "ORL", "orl": "ORL",
        "philadelphia 76ers": "PHI", "philadelphia": "PHI", "76ers": "PHI", "sixers": "PHI", "phi": "PHI",
        "phoenix suns": "PHX", "phoenix": "PHX", "suns": "PHX", "phx": "PHX",
        "portland trail blazers": "POR", "portland": "POR", "trail blazers": "POR", "blazers": "POR", "por": "POR",
        "sacramento kings": "SAC", "sacramento": "SAC", "kings": "SAC", "sac": "SAC",
        "san antonio spurs": "SAS", "san antonio": "SAS", "spurs": "SAS", "sas": "SAS", "sa": "SAS",
        "toronto raptors": "TOR", "toronto": "TOR", "raptors": "TOR", "tor": "TOR",
        "utah jazz": "UTA", "utah": "UTA", "jazz": "UTA", "uta": "UTA",
        "washington wizards": "WAS", "washington": "WAS", "wizards": "WAS", "was": "WAS", "wsh": "WAS",
    ]

    private static let logoSlugs: [String: String] = [
        "atlanta hawks": "atl", "atlanta": "atl", "hawks": "atl", "atl": "atl",
        "boston celtics": "bos", "boston": "bos", "celtics": "bos", "bos": "bos",
        "brooklyn nets": "bkn", "brooklyn": "bkn", "nets": "bkn", "bkn": "bkn",
        "charlotte hornets": "cha", "charlotte": "cha", "hornets": "cha", "cha": "cha",
        "chicago bulls": "chi", "chicago": "chi", "bulls": "chi", "chi": "chi",
        "cleveland cavaliers": "cle", "cleveland": "cle", "cavaliers": "cle", "cavs": "cle", "cle": "cle",
        "dallas mavericks": "dal", "dallas": "dal", "mavericks": "dal", "mavs": "dal", "dal": "dal",
        "denver nuggets": "den", "denver": "den", "nuggets": "den", "den": "den",
        "detroit pistons": "det", "detroit": "det", "pistons": "det", "det": "det",
        "golden state warriors": "gs", "golden state": "gs", "warriors": "gs", "gs": "gs", "gsw": "gs",
        "houston rockets": "hou", "houston": "hou", "rockets": "hou", "hou": "hou",
        "indiana pacers": "ind", "indiana": "ind", "pacers": "ind", "ind": "ind",
        "la clippers": "lac", "los angeles clippers": "lac", "clippers": "lac", "lac": "lac",
        "la lakers": "lal", "los angeles lakers": "lal", "lakers": "lal", "lal": "lal",
        "memphis grizzlies": "mem", "memphis": "mem", "grizzlies": "mem", "mem": "mem",
        "miami heat": "mia", "miami": "mia", "heat": "mia", "mia": "mia",
        "milwaukee bucks": "mil", "milwaukee": "mil", "bucks": "mil", "mil": "mil",
        "minnesota timberwolves": "min", "minnesota": "min", "timberwolves": "min", "wolves": "min", "min": "min",
        "new orleans pelicans": "no", "new orleans": "no", "pelicans": "no", "nop": "no", "no": "no",
        "new york knicks": "ny", "knicks": "ny", "nyk": "ny", "ny": "ny",
        "oklahoma city thunder": "okc", "oklahoma city": "okc", "thunder": "okc", "okc": "okc",
        "orlando magic": "orl", "orlando": "orl", "magic": "orl", "orl": "orl",
        "philadelphia 76ers": "phi", "philadelphia": "phi", "76ers": "phi", "sixers": "phi", "phi": "phi",
        "phoenix suns": "phx", "phoenix": "phx", "suns": "phx", "phx": "phx",
        "portland trail blazers": "por", "portland": "por", "trail blazers": "por", "blazers": "por", "por": "por",
        "sacramento kings": "sac", "sacramento": "sac", "kings": "sac", "sac": "sac",
        "san antonio spurs": "sa", "san antonio": "sa", "spurs": "sa", "sas": "sa", "sa": "sa",
        "toronto raptors": "tor", "toronto": "tor", "raptors": "tor", "tor": "tor",
        "utah jazz": "utah", "utah": "utah", "jazz": "utah", "uta": "utah",
        "washington wizards": "wsh", "washington": "wsh", "wizards": "wsh", "was": "wsh", "wsh": "wsh",
    ]

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

/// College basketball page colors. Football schools use `cfb_teams`. Everyone
/// else uses the ESPN color cached beside the logo, then the name hash.
@MainActor
enum NCAABTeamColors {
    static func colorPair(for team: String) -> TeamColorPair {
        let football = CFBTeamAssets.colorHex(for: team)
        if football.primary != nil {
            return CFBTeamColors.colorPair(for: team)
        }
        if let school = NCAABTeamAssets.schoolColor(for: team),
           let primary = Self.parse(school.primary) {
            return TeamColorPair(
                primary: Color(hex: primary),
                secondary: Color(hex: Self.parse(school.secondary) ?? primary)
            )
        }
        return FallbackTeamColor.colorPair(for: team)
    }

    private static func parse(_ raw: String) -> Int? {
        let cleaned = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")
        guard cleaned.count == 6 else { return nil }
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
