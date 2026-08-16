import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// Shell-hoisted source for every Parlay God surface (Outliers rail, Search
/// rail, Props Cheats, matchup widgets). Fetches the MLB + NFL trends bundles
/// and the props slate once, builds the leg pool off-main, and serves ticket
/// sets — per-sport tickets, mixed side by side on the rails.
///
/// Fetches its own data instead of piggybacking on OutliersTrendsStore /
/// PropsStore so any surface can appear first without hydrating a whole tab.
@Observable
@MainActor
public final class ParlayGodStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    public private(set) var loadState: LoadState = .idle
    /// Cross-game category tickets for the Outliers + Search rails.
    public private(set) var slateTickets: [ParlayTicket] = []
    /// Player-props-only category tickets for the Props tab rail.
    public private(set) var propsTickets: [ParlayTicket] = []
    public private(set) var lastRefreshedAt: Date?

    // Not observed: `tickets(forGameKey:)` memoizes from view bodies, and
    // mutating observed state during view update is illegal. Views re-render
    // off `loadState`/`slateTickets` changes instead.
    @ObservationIgnored private var pool: [ParlayLeg] = []
    @ObservationIgnored private var gameTicketCache: [String: [ParlayTicket]] = [:]

    /// Matches the props feed TTL — slates/odds refresh slowly intraday.
    private let ttl: TimeInterval = 300

    public init() {}

    public var isLoading: Bool { loadState == .loading }
    public var hasContent: Bool { !slateTickets.isEmpty }

    /// Sports currently fielding slate tickets — drives the rail header's
    /// "Supports" icon cluster (a sport with no qualifying streaks today drops off).
    public var slateSports: [ParlaySport] { ParlayGodEngine.sports(in: slateTickets) }
    public var propsSports: [ParlaySport] { ParlayGodEngine.sports(in: propsTickets) }

    /// Props Cheats are deliberately scoped to the selected sport. Building
    /// each sport separately also prevents an MLB leg from completing an NFL
    /// ticket (or vice versa) when one slate is thin.
    public func propsTickets(for sport: ParlaySport) -> [ParlayTicket] {
        propsTickets.filter { ticket in ticket.legs.allSatisfy { $0.sport == sport } }
    }

    public func propsSports(for sport: ParlaySport) -> [ParlaySport] {
        propsTickets(for: sport).isEmpty ? [] : [sport]
    }

    /// Same-game tickets for a matchup widget. Built lazily per game from the
    /// cached pool; empty until the first refresh lands.
    public func tickets(forGameKey gameKey: String) -> [ParlayTicket] {
        if let cached = gameTicketCache[gameKey] { return cached }
        let built = ParlayGodEngine.gameTickets(from: pool, gameKey: gameKey)
        gameTicketCache[gameKey] = built
        return built
    }

    public func refreshIfNeeded(force: Bool = false) async {
        if loadState == .loading { return }
        if !force, let last = lastRefreshedAt, Date().timeIntervalSince(last) < ttl, loadState == .loaded {
            return
        }
        loadState = .loading

        do {
            // Each source tolerates the others failing: a props outage still
            // yields team-leg tickets, an NFL outage still yields MLB, etc.
            async let mlbBundleTask = OutliersTrendsService.shared.fetchMLBBundle()
            async let nflBundleTask = OutliersTrendsService.shared.fetchNFLBundle()
            async let matchupsTask = MLBPlayerPropsService.shared.fetchMatchups()
            async let nflPlayersTask = NFLPlayerPropsService.shared.fetchPlayers()

            let mlbBundle = try? await mlbBundleTask
            let nflBundle = try? await nflBundleTask
            let matchups = try? await matchupsTask
            let nflPlayers = try? await nflPlayersTask
            guard mlbBundle != nil || nflBundle != nil || matchups != nil || nflPlayers != nil else {
                throw NSError(domain: "ParlayGod", code: 1, userInfo: [
                    NSLocalizedDescriptionKey: "No slate data available",
                ])
            }

            // Pure CPU work over value types — keep it off the main actor.
            let built = await Task.detached(priority: .userInitiated) { () -> ([ParlayLeg], [ParlayLeg], [ParlayLeg], [ParlayLeg]) in
                let mlbTeam = mlbBundle.map { ParlayGodEngine.teamLegs(bundle: $0) } ?? []
                let nflTeam = nflBundle.map { ParlayGodEngine.nflTeamLegs(bundle: $0) } ?? []
                let mlbProps = ParlayGodEngine.propLegs(matchups: matchups ?? [])
                let nflProps = ParlayGodEngine.nflPropLegs(players: nflPlayers ?? [])
                return (mlbTeam, nflTeam, mlbProps, nflProps)
            }.value

            // A transiently-failed source must not wipe its legs for the whole
            // TTL (a nil bundle once turned the rail props-only all morning) —
            // keep the last-known legs of that kind and stay stale to retry.
            let mlbTeamLegs = mlbBundle != nil ? built.0 : pool.filter { $0.kind == .team && $0.sport == .mlb }
            let nflTeamLegs = nflBundle != nil ? built.1 : pool.filter { $0.kind == .team && $0.sport == .nfl }
            let mlbPropLegs = matchups != nil ? built.2 : pool.filter { $0.kind == .prop && $0.sport == .mlb }
            let nflPropLegs = nflPlayers != nil ? built.3 : pool.filter { $0.kind == .prop && $0.sport == .nfl }
            pool = mlbTeamLegs + nflTeamLegs + mlbPropLegs + nflPropLegs
            slateTickets = ParlayGodEngine.slateTickets(from: pool)
            propsTickets = [.mlb, .nfl].flatMap { sport in
                ParlayGodEngine.propsTickets(from: pool.filter { $0.kind == .prop && $0.sport == sport })
            }
            gameTicketCache = [:]
            lastRefreshedAt = (mlbBundle != nil && nflBundle != nil && matchups != nil && nflPlayers != nil) ? Date() : nil
            loadState = .loaded
        } catch {
            loadState = .failed(error.localizedDescription)
        }
    }
}
