import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// Vote tallies for game-detail widgets, with optimistic writes.
/// Contract: `.claude/docs/34_widget_votes_share.md` §4.
///
/// The interesting part is write ordering. Taps are optimistic, so a user can
/// fire up → clear → down faster than one round-trip. Two rules keep the server
/// and the screen from disagreeing:
///
///  1. **One request in flight per widget.** If `up` and a later `clear` were
///     both on the wire, nothing guarantees `up` commits first — it could land
///     second and the server would end on the vote the user retracted.
///  2. **Only the LATEST intent is queued behind it.** Intermediate taps are
///     dropped; they describe states the user already left.
@Observable
@MainActor
public final class WidgetVotesStore {
    public struct GameKey: Hashable, Sendable {
        public let sport: String
        public let gameId: String
        public init(sport: String, gameId: String) {
            self.sport = sport
            self.gameId = gameId
        }
    }

    private struct Target: Hashable {
        let game: GameKey
        let widgetKey: String
    }

    public typealias Fetch = @Sendable (_ sport: String, _ gameId: String) async -> [String: WidgetVoteTally]?
    public typealias Cast = @Sendable (_ sport: String, _ gameId: String, _ widgetKey: String, _ vote: Int)
        async -> Result<WidgetVoteTally, WidgetVoteError>

    /// What the UI renders — server state with any optimistic vote applied.
    public private(set) var tallies: [GameKey: [String: WidgetVoteTally]] = [:]
    /// Bumps each time the server refuses a vote for rate limiting, so a view
    /// can hang a `.sensoryFeedback` / toast off it without the store knowing
    /// about UI.
    public private(set) var rateLimitTick: Int = 0

    /// Last state the SERVER confirmed. A failed write rolls back to this, not
    /// to whatever was on screen before the tap — after three quick taps the
    /// pre-tap state may itself have been an unconfirmed guess.
    private var confirmed: [GameKey: [String: WidgetVoteTally]] = [:]
    private var lastLoad: [GameKey: Date] = [:]
    private var inFlightLoads: [GameKey: Task<Void, Never>] = [:]
    /// Latest unsent intent per widget (rule 2).
    private var queued: [Target: Int] = [:]
    /// Widgets with a request on the wire (rule 1).
    private var sending: Set<Target> = []
    /// Whose `myVote` values these are. See `setUser`.
    private var userId: String?
    /// Bumped on reset so a response for the previous account is discarded.
    private var generation: Int = 0

    /// Scores drift as other people vote, but nothing on the card depends on
    /// them being live to the second.
    private let ttl: TimeInterval = 60
    private let fetch: Fetch
    private let cast: Cast

    /// Production callers use the default initializer; tests inject fakes.
    public init(
        fetch: @escaping Fetch = { await WidgetVoteService.fetch(sport: $0, gameId: $1) },
        cast: @escaping Cast = { await WidgetVoteService.cast(sport: $0, gameId: $1, widgetKey: $2, vote: $3) }
    ) {
        self.fetch = fetch
        self.cast = cast
    }

    /// Left-join lookup for one card. A widget nobody has voted on has no row,
    /// which reads as an empty tally.
    public func tally(for game: GameKey, widgetKey: String) -> WidgetVoteTally {
        tallies[game]?[widgetKey] ?? WidgetVoteTally(widgetKey: widgetKey)
    }

    /// Tell the store who is signed in. `myVote` is per-user, so cached tallies
    /// from one account must never render for the next one on the same device.
    public func setUser(_ id: String?) {
        guard id != userId else { return }
        userId = id
        generation += 1
        tallies = [:]
        confirmed = [:]
        lastLoad = [:]
        queued = [:]
        // Requests still on the wire belong to the previous account; the
        // generation check stops them writing state or touching `sending`.
        sending = []
        for task in inFlightLoads.values { task.cancel() }
        inFlightLoads = [:]
    }

    /// Load one game's tallies unless a fresh copy is already held. Safe to
    /// call from every page of the detail carousel — concurrent callers share
    /// one request.
    public func ensureLoaded(_ game: GameKey, force: Bool = false) async {
        guard !game.gameId.isEmpty else { return }
        if !force, let at = lastLoad[game], Date().timeIntervalSince(at) < ttl { return }
        if let open = inFlightLoads[game] {
            await open.value
            return
        }
        let started = generation
        let task = Task { @MainActor in
            // nil == the RPC failed. Leave `lastLoad` untouched so the next
            // open retries instead of caching the failure for a minute.
            guard let rows = await self.fetch(game.sport, game.gameId),
                  self.generation == started else { return }
            self.adopt(rows, for: game)
            self.lastLoad[game] = Date()
        }
        inFlightLoads[game] = task
        await task.value
        if inFlightLoads[game] == task { inFlightLoads[game] = nil }
    }

    /// The user tapped the up (`+1`) or down (`-1`) arrow.
    public func tap(_ arrow: Int, game: GameKey, widgetKey: String) {
        guard arrow == 1 || arrow == -1, !game.gameId.isEmpty, userId != nil else { return }
        let target = Target(game: game, widgetKey: widgetKey)
        let current = tally(for: game, widgetKey: widgetKey)
        let desired = WidgetVoteTally.resolvedVote(current: current.myVote, tapped: arrow)

        tallies[game, default: [:]][widgetKey] = current.applying(vote: desired)
        queued[target] = desired
        guard !sending.contains(target) else { return }
        sending.insert(target)
        Task { @MainActor in await self.drain(target) }
    }

    /// Sends queued intents for one widget, one at a time, until none remain.
    private func drain(_ target: Target) async {
        let started = generation
        defer { if generation == started { sending.remove(target) } }

        while let desired = queued.removeValue(forKey: target) {
            let known = confirmed[target.game]?[target.widgetKey]
            // Tapped up then clear before anything was sent: nothing to say.
            if (known?.myVote ?? 0) == desired {
                if let known { tallies[target.game, default: [:]][target.widgetKey] = known }
                continue
            }

            let result = await cast(target.game.sport, target.game.gameId, target.widgetKey, desired)
            guard generation == started else { return }

            switch result {
            case .success(let server):
                confirmed[target.game, default: [:]][target.widgetKey] = server
                // A newer tap is queued: keep showing ITS optimistic state.
                // Overwriting with this response would flick the arrow back.
                if queued[target] == nil {
                    tallies[target.game, default: [:]][target.widgetKey] = server
                } else if let next = queued[target] {
                    tallies[target.game, default: [:]][target.widgetKey] = server.applying(vote: next)
                }
            case .failure(let error):
                if error == .rateLimited { rateLimitTick += 1 }
                // Retrying a queued tap straight after a refusal would just be
                // refused again; drop it and show the truth.
                queued[target] = nil
                if let known {
                    tallies[target.game, default: [:]][target.widgetKey] = known
                } else {
                    tallies[target.game]?[target.widgetKey] = nil
                }
            }
        }
    }

    /// Fold a fresh server read into both maps without trampling a vote the
    /// user has tapped but the server has not confirmed yet.
    private func adopt(_ rows: [String: WidgetVoteTally], for game: GameKey) {
        var shown = rows
        var known = rows
        for target in sending.union(queued.keys) where target.game == game {
            let key = target.widgetKey
            // The read may predate the in-flight write: keep our confirmed and
            // on-screen entries for that widget; the write's own response is
            // the authority for it.
            known[key] = confirmed[game]?[key]
            shown[key] = tallies[game]?[key]
        }
        confirmed[game] = known
        tallies[game] = shown
    }

    /// Preview / screenshot-harness seeding. Stamps `lastLoad` so a seeded
    /// store's `.task` doesn't fire a real RPC over the fixtures. Returns
    /// `self` so it chains inside a `@ViewBuilder` preview.
    @discardableResult
    public func debugSet(_ game: GameKey, userId: String? = "preview", rows: [WidgetVoteTally]) -> WidgetVotesStore {
        self.userId = userId
        let map = Dictionary(rows.map { ($0.widgetKey, $0) }, uniquingKeysWith: { first, _ in first })
        tallies[game] = map
        confirmed[game] = map
        lastLoad[game] = Date()
        return self
    }
}
