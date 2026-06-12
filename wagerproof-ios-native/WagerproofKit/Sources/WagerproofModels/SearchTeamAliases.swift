import Foundation

/// Team-name match/rank shared by SearchStore's game results. MLB gets
/// mascot/city-aware matching via a local token splitter (mascot = trailing
/// token(s), city = leading tokens; the `twoTokenMascots` set covers
/// "red sox" / "white sox" / "blue jays" — keep it in sync with the canonical
/// `MLBTeams` map if names ever change). All other sports fall back to the
/// generic substring + initials matcher. NFL's alias map is private to its
/// feature — NFL aliases are out of scope here.
public enum SearchTeamAliases {
    public struct Match: Sendable {
        public let score: Int
        public init(score: Int) { self.score = score }
    }

    /// Rank table: 100 exact abbr · 90 exact mascot/city token · 70 prefix of
    /// mascot/city/full name (query ≥ 3 chars) · 40 substring of full name ·
    /// 30 initials.
    public static func match(query: String, teamName: String, abbr: String?,
                             sport: SearchStoreSport) -> Match? {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty, !teamName.isEmpty else { return nil }

        if let abbr, !abbr.isEmpty, abbr.lowercased() == q {
            return Match(score: 100)
        }

        let full = teamName.lowercased()
        let (city, mascot) = split(teamName: teamName, sport: sport)

        if q == mascot || (!city.isEmpty && q == city) {
            return Match(score: 90)
        }
        if q.count >= 3 {
            if mascot.hasPrefix(q) || (!city.isEmpty && city.hasPrefix(q)) || full.hasPrefix(q) {
                return Match(score: 70)
            }
        }
        if full.contains(q) {
            return Match(score: 40)
        }
        let initials = teamName
            .split(separator: " ")
            .compactMap { $0.first }
            .map { String($0).lowercased() }
            .joined()
        if !initials.isEmpty, initials.contains(q) {
            return Match(score: 30)
        }
        return nil
    }

    /// Two-token MLB mascots — "boston red sox" splits city "boston",
    /// mascot "red sox", not "sox".
    private static let twoTokenMascots: Set<String> = ["red sox", "white sox", "blue jays"]

    private static func split(teamName: String, sport: SearchStoreSport) -> (city: String, mascot: String) {
        let tokens = teamName.lowercased()
            .split(separator: " ", omittingEmptySubsequences: true)
            .map(String.init)
        guard tokens.count >= 2 else { return ("", tokens.first ?? "") }
        if sport == .mlb, tokens.count >= 2 {
            let lastTwo = tokens.suffix(2).joined(separator: " ")
            if twoTokenMascots.contains(lastTwo) {
                return (tokens.dropLast(2).joined(separator: " "), lastTwo)
            }
        }
        return (tokens.dropLast().joined(separator: " "), tokens.last ?? "")
    }
}

/// Sport key mirrored out of `SearchStore.GamesStoreSport` so this matcher
/// (Models layer) doesn't depend on the Stores layer.
public enum SearchStoreSport: String, Sendable, Hashable {
    case nfl, cfb, nba, ncaab, mlb
}
