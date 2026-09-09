import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// Honeydew's latched collection and FIFO celebrations, with server-owned eligibility.
@Observable @MainActor
public final class AchievementsStore {
    public private(set) var achievements = AchievementCatalog.definitions.map { Achievement(definition: $0) }
    public private(set) var pendingCelebrations: [String] = []
    public private(set) var isLoading = false
    public private(set) var errorMessage: String?
    public private(set) var userId: String?
    public private(set) var hasLoaded = false
    @ObservationIgnored private let service: any AchievementServing
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private var generation = UUID()
    @ObservationIgnored private var snapshot: AchievementSnapshot?
    @ObservationIgnored private var acknowledged = Set<String>()
    @ObservationIgnored private var pendingActivities = Set<AchievementActivity>()
    @ObservationIgnored private var refreshAgain = false

    public init(service: any AchievementServing = AchievementService(), defaults: UserDefaults = .standard) {
        self.service = service; self.defaults = defaults
    }
    public var unlockedCount: Int { achievements.filter(\.earned).count }
    public var recentlyUnlocked: [Achievement] {
        achievements.filter(\.earned).sorted {
            ($0.status.earnedAt ?? .distantPast) > ($1.status.earnedAt ?? .distantPast)
        }.prefix(6).map { $0 }
    }
    public var upNext: [Achievement] {
        var groups = Set<AchievementGroup>()
        let locked = achievements.filter { !$0.earned }
        return locked.filter { groups.insert($0.definition.group).inserted }
            .sorted { $0.fraction > $1.fraction }
    }
    public func achievement(id: String) -> Achievement? { achievements.first { $0.id == id } }

    public func bind(userId: String?) {
        let normalized = userId?.lowercased()
        guard normalized != self.userId else { return }
        generation = UUID(); self.userId = normalized
        snapshot = nil; pendingCelebrations = []; pendingActivities = []
        acknowledged = []; isLoading = false; errorMessage = nil; hasLoaded = false; refreshAgain = false
        achievements = AchievementCatalog.definitions.map { Achievement(definition: $0) }
        guard let normalized else { return }
        pendingActivities = Set((defaults.stringArray(forKey: "achievements.activities.\(normalized)") ?? [])
            .compactMap(AchievementActivity.init(rawValue:)))
        acknowledged = Set(defaults.stringArray(forKey: "achievements.seen.\(normalized)") ?? [])
        if let data = defaults.data(forKey: "achievements.snapshot.\(normalized)"),
           let cached = try? JSONDecoder().decode(AchievementSnapshot.self, from: data) {
            apply(cached, celebrate: false)
        }
    }

    public func record(_ activity: AchievementActivity) async {
        guard userId != nil else { return }
        pendingActivities.insert(activity)
        persistActivities()
        await refresh()
    }

    public func refresh() async {
        guard let uid = userId else { return }
        if isLoading { refreshAgain = true; return }
        let token = generation
        isLoading = true
        defer { if generation == token { isLoading = false } }
        repeat {
            refreshAgain = false
            let activity = pendingActivities.first
            do {
                let value: AchievementSnapshot
                if let activity { value = try await service.record(activity) }
                else { value = try await service.fetch() }
                guard generation == token, userId == uid else { return }
                if let activity { pendingActivities.remove(activity); persistActivities() }
                apply(value, celebrate: true)
                // Retry acknowledgment after offline dismissal without replaying the celebration locally.
                if !acknowledged.isEmpty { try? await service.acknowledge(Array(acknowledged)) }
                guard generation == token else { return }
                errorMessage = nil
            } catch {
                guard generation == token else { return }
                errorMessage = "Your collection couldn’t sync. Pull to refresh to try again."
                return
            }
        } while generation == token && (refreshAgain || !pendingActivities.isEmpty)
    }

    private func persistActivities() {
        if let userId { defaults.set(pendingActivities.map(\.rawValue), forKey: "achievements.activities.\(userId)") }
    }

    public func acknowledgeCelebration(_ id: String) {
        guard userId != nil, achievement(id: id)?.earned == true, !acknowledged.contains(id) else { return }
        pendingCelebrations.removeAll { $0 == id }
        acknowledged.insert(id)
        let token = generation
        Task {
            guard generation == token else { return }
            try? await service.acknowledge([id])
        }
        if let userId { defaults.set(Array(acknowledged), forKey: "achievements.seen.\(userId)") }
    }

    private func apply(_ value: AchievementSnapshot, celebrate: Bool) {
        // Ignore stale progress responses, and preserve the earliest known persisted unlock.
        if let snapshot, value.generatedAt < snapshot.generatedAt { return }
        let previous = Dictionary(achievements.map { ($0.id, $0.status) }, uniquingKeysWith: { first, _ in first })
        let incoming = Dictionary(value.achievements.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let hadSnapshot = snapshot != nil
        achievements = AchievementCatalog.definitions.map { definition in
            let fresh = incoming[definition.id] ?? AchievementStatus(id: definition.id, targetValue: definition.target)
            let old = previous[definition.id]
            let status: AchievementStatus
            if let old, let date = old.earnedAt, fresh.earnedAt == nil || date < fresh.earnedAt! {
                status = AchievementStatus(id: fresh.id, progress: fresh.progress, currentValue: fresh.currentValue,
                    targetValue: fresh.targetValue, earnedAt: date, isBackfilled: old.isBackfilled,
                    creditedAgentId: old.creditedAgentId)
            } else { status = fresh }
            return Achievement(definition: definition, status: status)
        }
        if celebrate {
            for item in achievements where item.earned && !item.status.isBackfilled {
                let newlyEarned = value.newlyUnlockedIds.contains(item.id)
                    || (hadSnapshot && previous[item.id]?.earnedAt == nil)
                if newlyEarned && !acknowledged.contains(item.id) && !pendingCelebrations.contains(item.id) {
                    pendingCelebrations.append(item.id)
                }
            }
        }
        snapshot = AchievementSnapshot(catalogVersion: value.catalogVersion, initializedAt: value.initializedAt,
            generatedAt: value.generatedAt, achievements: achievements.map(\.status))
        hasLoaded = true
        if let userId, let data = try? JSONEncoder().encode(snapshot) {
            defaults.set(data, forKey: "achievements.snapshot.\(userId)")
        }
    }
}
