import Foundation

/// Process-wide cache of the `cfb_teams` reference table. CFB has 137 teams,
/// so cards resolve logos/colors from this cache instead of hardcoding a table.
@MainActor
public enum CFBTeamAssets {
    public private(set) static var byName: [String: CFBTeamReference] = [:]
    private static var nameByAlias: [String: String] = [:]

    public static var isLoaded: Bool { !byName.isEmpty }

    public static func install(_ teams: [CFBTeamReference]) {
        byName = Dictionary(uniqueKeysWithValues: teams.map { (normalize($0.teamName), $0) })
        var aliases: [String: String] = [:]
        for team in teams {
            let key = normalize(team.teamName)
            aliases[key] = key
            if let abbr = team.abbr, !abbr.isEmpty {
                aliases[normalize(abbr)] = key
            }
        }
        nameByAlias = aliases
    }

    public static func team(for name: String) -> CFBTeamReference? {
        let key = normalize(name)
        if let canonical = nameByAlias[key] {
            return byName[canonical]
        }
        return byName[key]
    }

    public static func abbr(for name: String) -> String {
        team(for: name)?.abbr?.uppercased() ?? fallbackAbbr(from: name)
    }

    public static func logo(for name: String, dark: Bool = false) -> String? {
        guard let team = team(for: name) else { return nil }
        return dark ? (team.logoDark ?? team.logo) : (team.logo ?? team.logoDark)
    }

    public static func colorHex(for name: String) -> (primary: String?, secondary: String?) {
        guard let team = team(for: name) else { return (nil, nil) }
        return (team.color, team.altColor)
    }

    public static func normalize(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: ".", with: "")
            .replacingOccurrences(of: "'", with: "")
            .replacingOccurrences(of: "  ", with: " ")
    }

    private static func fallbackAbbr(from name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "CFB" }
        return trimmed
            .split(separator: " ")
            .compactMap(\.first)
            .prefix(4)
            .map { String($0).uppercased() }
            .joined()
    }
}
