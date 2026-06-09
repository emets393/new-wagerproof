import Foundation
import Supabase
import WagerproofModels

/// Port of `wagerproof-mobile/services/topAgentsWidgetService.ts` +
/// the JS side of `modules/widget-data-bridge`. Fetches the user's top agents
/// (favorites first, then sorted by net units / win rate / streak) plus a
/// small slate of recent picks per agent, then writes the result to the
/// shared App Group UserDefaults that the iOS widget extension reads.
///
/// Wire format mirrors the RN bridge's `WidgetDataPayload` so any widget
/// extension shipped via Expo continues to read the same `widgetPayload` key
/// during the migration window.
///
/// FIDELITY-WAIVER #079: The native iOS widget extension target itself is
/// not yet wired in `project.yml` — see ticket #079. Until then this service
/// still maintains the App Group payload so the existing Expo-shipped
/// widget keeps working when users install the Swift app over the RN build.
public enum TopAgentsWidgetService {
    /// Shared App Group identifier. Matches `app.json:25` on the RN side and
    /// the `com.apple.security.application-groups` entry in
    /// `Wagerproof.entitlements`.
    public static let appGroupId = "group.com.wagerproof.mobile"

    /// Key used inside the App Group defaults for the JSON payload. Mirrors
    /// the RN native module's `widgetPayload` key — changing it would break
    /// every widget that's already on a user's home screen.
    public static let payloadKey = "widgetPayload"

    /// Per-RN constants. Keep in sync with `topAgentsWidgetService.ts:5-6`.
    private static let maxWidgetAgents = 3
    private static let picksPerAgent = 2

    // MARK: - Public entry points

    /// Fetch top agents + their recent picks and write the resulting payload
    /// to the App Group. Returns the bundle of `TopAgentWidgetData` so the
    /// caller can hash it for change detection (matches the RN
    /// `useTopAgentsWidgetSync` hashing path).
    @discardableResult
    public static func sync(userId: String) async throws -> [TopAgentWidgetData] {
        let agents = try await fetchTopAgents(userId: userId)
        // Preserve any non-agent data already in the payload (editor picks,
        // fade alerts, polymarket values). The RN bridge writes the whole
        // payload as one JSON blob so we have to round-trip it.
        var existing = readPayload() ?? WidgetDataPayload.empty()
        existing.topAgentPicks = agents
        existing.lastUpdated = Self.nowISO()
        try writePayload(existing)
        return agents
    }

    /// Read-only fetch of top agents. Used by tests and the optional
    /// "preview before sync" path. Mirrors `fetchTopAgentsForWidget` in
    /// `services/topAgentsWidgetService.ts`.
    public static func fetchTopAgents(userId: String) async throws -> [TopAgentWidgetData] {
        guard !userId.isEmpty else { return [] }
        let main = await MainSupabase.shared.client

        // 1) Slim agent rows — we only need the widget projection.
        let agentRows: [WidgetAgentRow] = try await main
            .from("avatar_profiles")
            .select("id, name, avatar_emoji, avatar_color, is_widget_favorite, is_active")
            .eq("user_id", value: userId)
            .eq("is_active", value: true)
            .execute()
            .value
        if agentRows.isEmpty { return [] }

        // 2) Performance cache for every agent. Failure here is tolerated:
        //    we still surface agents with zeroed stats (matches RN).
        var perfByAgent: [String: AgentPerformance] = [:]
        do {
            let ids = agentRows.map { $0.id }
            let perfs: [AgentPerformance] = try await main
                .from("avatar_performance_cache")
                .select("avatar_id, wins, losses, pushes, total_picks, win_rate, net_units, current_streak, best_streak")
                .in("avatar_id", values: ids)
                .execute()
                .value
            for p in perfs { perfByAgent[p.avatarId] = p }
        } catch {
            // swallow — non-fatal.
        }

        // 3) Sort favorites first, then by perf. Mirrors the RN
        //    `favorites/nonFavorites` split + `sortByPerformance`.
        let withPerf: [(row: WidgetAgentRow, perf: AgentPerformance?)] = agentRows.map { ag in
            (ag, perfByAgent[ag.id])
        }
        let favorites = withPerf
            .filter { $0.row.isWidgetFavorite == true }
            .sorted(by: Self.byPerformanceDesc)
        let nonFavorites = withPerf
            .filter { $0.row.isWidgetFavorite != true }
            .sorted(by: Self.byPerformanceDesc)
        var selected = Array(favorites.prefix(maxWidgetAgents))
        if selected.count < maxWidgetAgents {
            let remaining = maxWidgetAgents - selected.count
            selected.append(contentsOf: nonFavorites.prefix(remaining))
        }
        if selected.isEmpty { return [] }

        // 4) Fetch up to 3 days of recent picks for the selected agents. We
        //    over-fetch by 5x so the per-agent selector can dedupe and prefer
        //    today's picks before falling back to historical.
        let selectedIds = selected.map { $0.row.id }
        let lookbackDate = Calendar(identifier: .gregorian).date(byAdding: .day, value: -3, to: Date()) ?? Date()
        let lookbackStr = Self.localDateString(lookbackDate)
        var picksByAgent: [String: [AgentPick]] = Dictionary(uniqueKeysWithValues: selectedIds.map { ($0, []) })
        do {
            let allPicks: [AgentPick] = try await main
                .from("avatar_picks")
                .select()
                .in("avatar_id", values: selectedIds)
                .gte("game_date", value: lookbackStr)
                .order("created_at", ascending: false)
                .limit(maxWidgetAgents * picksPerAgent * 5)
                .execute()
                .value
            for pick in allPicks {
                picksByAgent[pick.avatarId, default: []].append(pick)
            }
        } catch {
            // Same as RN — pick-fetch failure doesn't blank the widget; we
            // still emit agent rows with empty picks so the widget shows
            // the agent shell.
        }

        return selected.map { entry -> TopAgentWidgetData in
            let row = entry.row
            let perf = entry.perf
            return TopAgentWidgetData(
                agentId: row.id,
                agentName: row.name,
                agentEmoji: row.avatarEmoji ?? "\u{1F916}",
                agentColor: row.avatarColor ?? "#6366f1",
                isFavorite: row.isWidgetFavorite ?? false,
                netUnits: perf?.netUnits ?? 0,
                winRate: perf?.winRate,
                currentStreak: perf?.currentStreak ?? 0,
                record: Self.formatRecord(perf),
                picks: Self.selectPicks(for: picksByAgent[row.id] ?? [])
            )
        }
    }

    // MARK: - Payload IO

    /// Read the current payload, if any. Returns nil when there's no payload
    /// or when the App Group isn't available (e.g. running in tests without
    /// the entitlement).
    public static func readPayload() -> WidgetDataPayload? {
        guard let defaults = appGroupDefaults() else { return nil }
        guard let jsonString = defaults.string(forKey: payloadKey),
              let data = jsonString.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetDataPayload.self, from: data)
    }

    public static func writePayload(_ payload: WidgetDataPayload) throws {
        let data = try JSONEncoder().encode(payload)
        guard let jsonString = String(data: data, encoding: .utf8) else { return }
        let defaults = appGroupDefaults() ?? .standard
        defaults.set(jsonString, forKey: payloadKey)
        // FIDELITY-WAIVER #079: When the iOS widget extension target lands,
        // call `WidgetCenter.shared.reloadAllTimelines()` from a wrapper in
        // the app target (WidgetCenter isn't importable from this
        // extension-safe service).
    }

    /// Hash that mirrors RN's `lastHashRef`. View consumers use it to skip
    /// no-op syncs.
    public static func hash(of agents: [TopAgentWidgetData]) -> String {
        let summary: [[String: Any]] = agents.map { agent in
            [
                "agentId": agent.agentId,
                "isFavorite": agent.isFavorite,
                "picks": agent.picks.map { $0.id },
            ]
        }
        // Deterministic JSON via sorted keys.
        if let data = try? JSONSerialization.data(
            withJSONObject: summary,
            options: [.sortedKeys]
        ), let s = String(data: data, encoding: .utf8) {
            return s
        }
        return agents.map { $0.agentId }.joined(separator: ",")
    }

    // MARK: - Internals

    /// FIDELITY-WAIVER #080: App Group access falls back to `.standard`
    /// UserDefaults when the widget extension target isn't wired (degraded
    /// mode — the in-app debug surface still works, the home-screen widget
    /// does not). The entitlement IS configured in `Wagerproof.entitlements`
    /// but until a widget extension target exists the data has no consumer.
    private static func appGroupDefaults() -> UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    private static func byPerformanceDesc(
        _ a: (row: WidgetAgentRow, perf: AgentPerformance?),
        _ b: (row: WidgetAgentRow, perf: AgentPerformance?)
    ) -> Bool {
        // Sort by net_units desc, then win_rate desc, then current_streak desc.
        let an = a.perf?.netUnits ?? 0
        let bn = b.perf?.netUnits ?? 0
        if an != bn { return an > bn }
        let aw = a.perf?.winRate ?? 0
        let bw = b.perf?.winRate ?? 0
        if aw != bw { return aw > bw }
        let asL = a.perf?.currentStreak ?? 0
        let bs = b.perf?.currentStreak ?? 0
        return asL > bs
    }

    private static func formatRecord(_ perf: AgentPerformance?) -> String {
        let wins = perf?.wins ?? 0
        let losses = perf?.losses ?? 0
        let pushes = perf?.pushes ?? 0
        return pushes > 0 ? "\(wins)-\(losses)-\(pushes)" : "\(wins)-\(losses)"
    }

    /// Pick selection: prefer today's picks, fall back to historical. Mirrors
    /// `selectPicksForAgent` in the RN service.
    private static func selectPicks(for allPicks: [AgentPick]) -> [AgentPickForWidget] {
        let todayStr = Self.localDateString(Date())
        let todays = allPicks
            .filter { $0.gameDate == todayStr }
            .sorted { $0.createdAt > $1.createdAt }
        let historical = allPicks
            .filter { $0.gameDate != todayStr }
            .sorted { $0.createdAt > $1.createdAt }
        var selected: [AgentPick] = []
        var seen = Set<String>()
        for p in todays {
            if selected.count >= picksPerAgent { break }
            selected.append(p)
            seen.insert(p.id)
        }
        for p in historical {
            if selected.count >= picksPerAgent { break }
            if seen.contains(p.id) { continue }
            selected.append(p)
            seen.insert(p.id)
        }
        return selected.map(Self.toWidget)
    }

    private static func toWidget(_ pick: AgentPick) -> AgentPickForWidget {
        AgentPickForWidget(
            id: pick.id,
            sport: pick.sport.rawValue,
            matchup: pick.matchup,
            pickSelection: pick.pickSelection,
            odds: pick.odds,
            result: pick.result == .pending ? nil : pick.result.rawValue,
            gameDate: pick.gameDate.isEmpty ? nil : pick.gameDate
        )
    }

    private static func localDateString(_ date: Date) -> String {
        let cal = Calendar(identifier: .gregorian)
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 1970, c.month ?? 1, c.day ?? 1)
    }

    private static func nowISO() -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: Date())
    }

    /// Slim agent row used internally by `fetchTopAgents`. Kept fileprivate so
    /// it doesn't leak into the public surface; we re-emit as
    /// `TopAgentWidgetData` for callers.
    fileprivate struct WidgetAgentRow: Decodable {
        let id: String
        let name: String
        let avatarEmoji: String?
        let avatarColor: String?
        let isWidgetFavorite: Bool?
        let isActive: Bool?
        enum CodingKeys: String, CodingKey {
            case id, name
            case avatarEmoji = "avatar_emoji"
            case avatarColor = "avatar_color"
            case isWidgetFavorite = "is_widget_favorite"
            case isActive = "is_active"
        }
    }
}
