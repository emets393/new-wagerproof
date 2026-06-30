import Foundation

/// Process-wide cache of the `nfl_teams` reference table (32 rows: abbr,
/// display name, `logo_espn` URL). Services hydrate it once per launch
/// (`NFLTeamsService.ensureLoaded()`); cards read it synchronously while
/// building row models.
///
/// Lives in Models (not Services) so SwiftUI views can read it without a
/// Supabase dependency. Lookups normalize through `NFLTeams.abbr`, so any
/// team string format ("BUF", "Buffalo Bills", "Buffalo") resolves; misses
/// fall back to the static ESPN slug URL.
@MainActor
public enum NFLTeamAssets {
    public struct Team: Sendable, Hashable {
        public let abbr: String
        public let name: String
        public let nick: String?
        public let logoEspn: String?

        public init(abbr: String, name: String, nick: String?, logoEspn: String?) {
            self.abbr = abbr
            self.name = name
            self.nick = nick
            self.logoEspn = logoEspn
        }
    }

    public private(set) static var byAbbr: [String: Team] = [:]
    /// Lowercased alias (abbr / full name / nickname) → table `team_abbr`.
    private static var abbrByAlias: [String: String] = [:]

    public static var isLoaded: Bool { !byAbbr.isEmpty }

    public static func install(_ teams: [Team]) {
        byAbbr = Dictionary(uniqueKeysWithValues: teams.map { ($0.abbr.uppercased(), $0) })
        var aliases: [String: String] = [:]
        for t in teams {
            aliases[t.abbr.lowercased()] = t.abbr
            aliases[t.name.lowercased()] = t.abbr
            if let nick = t.nick { aliases[nick.lowercased()] = t.abbr }
        }
        abbrByAlias = aliases
    }

    /// Table `team_abbr` for any team string format; falls back to the
    /// static identity map when the table hasn't loaded or doesn't match.
    public static func abbr(for team: String) -> String {
        if let hit = abbrByAlias[team.trimmingCharacters(in: .whitespaces).lowercased()] {
            return hit
        }
        return NFLTeams.abbr(for: team)
    }

    /// `logo_espn` URL for any team string format; nil only when the team
    /// can't be resolved to a franchise at all.
    public static func logo(for team: String) -> String? {
        if let hit = byAbbr[abbr(for: team)]?.logoEspn { return hit }
        return NFLTeams.logoUrl(for: team)
    }

    /// Short display name (nickname) for matchup labels — e.g. "Cowboys".
    public static func nickname(for team: String) -> String {
        let key = abbr(for: team).uppercased()
        if let nick = byAbbr[key]?.nick, !nick.isEmpty { return nick }
        if let name = byAbbr[key]?.name, !name.isEmpty {
            return name.split(separator: " ").last.map(String.init) ?? name
        }
        if let mascot = NFLTeams.mascot(for: team) { return mascot }
        return NFLTeams.nickname(for: team)
    }
}
