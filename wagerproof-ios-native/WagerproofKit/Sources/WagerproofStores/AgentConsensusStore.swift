import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// Agent consensus for every game in the current games feed, keyed by game id.
/// Mirrors web's `useAgentConsensus` hook. See `.claude/docs/18_agent_consensus.md`.
///
/// Deliberately NOT fetched inside the per-sport card adapters: the flag
/// threshold scales with the WHOLE slate's volume, so it can only be computed
/// once the full set of games for a date is known. One RPC serves the entire
/// feed; the cards are pure lookups.
@Observable
@MainActor
public final class AgentConsensusStore {
    /// sport → (game_id → consensus). A sport with an empty map is a valid,
    /// expected state (no agents have bet that slate yet), not an error.
    public private(set) var bySport: [GamesStore.Sport: [String: GameAgentConsensus]] = [:]

    /// Shorter than the feed's 5-minute TTL: counts move through the day as
    /// agents generate (~1 new pick/minute on a busy MLB slate) while the slate
    /// itself does not.
    private let ttl: TimeInterval = 90

    /// Last successful load per sport, remembered with the exact date set it
    /// covered — a slate that grows a second day has to refetch even inside the
    /// TTL, because the threshold is per-day.
    private var lastLoad: [GamesStore.Sport: (dates: [String], at: Date)] = [:]
    /// The open call per sport, kept as a Task (not a Set) so a later caller can
    /// AWAIT it instead of being dropped — see `load`.
    private var inFlight: [GamesStore.Sport: Task<Void, Never>] = [:]
    /// Dates the open call covers. `lastLoad` only records dates AFTER a fetch
    /// lands, so without this a burst of callers arriving mid-flight cannot tell
    /// that their dates are already being fetched — see `ensureLoaded`.
    private var inFlightDates: [GamesStore.Sport: Set<String>] = [:]

    public init() {}

    /// Left-join lookup for a single card. `nil` is the normal case for a game
    /// no public agent has bet.
    public func consensus(for sport: GamesStore.Sport, gameId: String) -> GameAgentConsensus? {
        bySport[sport]?[gameId]
    }

    /// Load consensus for `sport` across every distinct date in its feed.
    /// `dates` are `yyyy-MM-dd` ET keys — the same keys the feed groups its
    /// date sections by.
    public func load(sport: GamesStore.Sport, dates: [String], force: Bool = false) async {
        let normalized = Set(dates.filter { !$0.isEmpty }).sorted()
        guard !normalized.isEmpty else { return }

        if !force,
           let last = lastLoad[sport],
           last.dates == normalized,
           Date().timeIntervalSince(last.at) < ttl {
            return
        }
        // Feed refreshes can re-fire the view's task while a call is still open.
        // Await that call rather than dropping ours: an unforced caller is
        // satisfied by whatever it returns, but a FORCED one (pull-to-refresh)
        // has to go back to the server afterwards. Returning early here made
        // pull-to-refresh silently no-op whenever the initial task was still in
        // flight.
        if let open = inFlight[sport] {
            await open.value
            if !force { return }
        }

        let task = Task { @MainActor in
            // nil == the RPC failed. Keep whatever we already had on screen and
            // leave `lastLoad` untouched so the next tick retries instead of
            // caching the failure for 90s.
            guard let result = await AgentConsensusService.fetch(sport: sport.rawValue, dates: normalized) else {
                return
            }
            self.bySport[sport] = result
            self.lastLoad[sport] = (normalized, Date())
        }
        inFlight[sport] = task
        inFlightDates[sport] = Set(normalized)
        await task.value
        // Only clear if nobody replaced it — a forced call that overlapped ours
        // owns the slot now.
        if inFlight[sport] == task {
            inFlight[sport] = nil
            inFlightDates[sport] = nil
        }
    }

    /// Cover a single game's date for surfaces that arrive without a feed —
    /// game detail reached from Search/WagerBot, or the Outliers matchup grid.
    ///
    /// Widens the existing coverage instead of replacing it: `load` is
    /// authoritative for a whole slate, and a detail page must never shrink the
    /// feed's map down to one day. Still one RPC per slate, never per card.
    public func ensureLoaded(sport: GamesStore.Sport, date: String) async {
        await ensureLoaded(sport: sport, dates: [date])
    }

    /// Multi-date variant — the Outliers grid knows every date on its board up
    /// front, so it can widen once rather than once per tile.
    public func ensureLoaded(sport: GamesStore.Sport, dates: [String]) async {
        let wanted = Set(dates.filter { !$0.isEmpty })
        guard !wanted.isEmpty else { return }

        if let last = lastLoad[sport],
           wanted.isSubset(of: Set(last.dates)),
           Date().timeIntervalSince(last.at) < ttl {
            return
        }
        // The detail carousel builds ±2 pages at once, so five sections call this
        // before the first RPC lands and stamps `lastLoad`. All five would then
        // fall through to `load(force:)`, and force deliberately does NOT return
        // early on an open call — so each fired its own redundant RPC and its own
        // `bySport` write, re-invalidating every section on every resident page.
        // If the open call already covers our dates, awaiting it IS the job.
        if let open = inFlight[sport],
           let covered = inFlightDates[sport],
           wanted.isSubset(of: covered) {
            await open.value
            return
        }
        // force: the TTL check above already decided; `load`'s own check would
        // compare against the narrower date set and bail.
        let union = Set(lastLoad[sport]?.dates ?? []).union(wanted).sorted()
        await load(sport: sport, dates: union, force: true)
    }

    /// Preview / screenshot-harness seeding. Also stamps `lastLoad` so a seeded
    /// store's `.task` doesn't immediately fire a real RPC over the fixtures.
    /// Returns `self` so it can be chained inside a `@ViewBuilder` preview —
    /// Swift 6 rejects bare `Void` expressions there.
    @discardableResult
    public func debugSet(sport: GamesStore.Sport, rows: [String: GameAgentConsensus]) -> AgentConsensusStore {
        bySport[sport] = rows
        lastLoad[sport] = (Set(rows.values.map(\.gameDate)).sorted(), Date())
        return self
    }
}
