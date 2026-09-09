#if DEBUG
import SwiftUI
import WagerproofModels
import WagerproofServices
import WagerproofStores

/// Isolated visual QA. This fixture never records activity or modifies production unlocks.
struct AchievementPreview: View {
    @Environment(AuthStore.self) private var auth
    @State private var store = AchievementsStore(service: PreviewAchievementService(),
        defaults: UserDefaults(suiteName: "achievement.visual-qa.\(UUID().uuidString)")!)
    var body: some View {
        NavigationStack {
            if ProcessInfo.processInfo.arguments.contains("-achievementCelebration"),
               let item = store.achievement(id: "first-agent") {
                AchievementUnlockedSheet(item: item, onDone: {})
            } else if let index = ProcessInfo.processInfo.arguments.firstIndex(of: "-achievementID"),
               index + 1 < ProcessInfo.processInfo.arguments.count {
                AchievementDetailView(id: ProcessInfo.processInfo.arguments[index + 1])
            } else { AchievementLibraryView() }
        }
        .environment(store)
        .task {
            if let index = ProcessInfo.processInfo.arguments.firstIndex(of: "-achievementName"),
               index + 1 < ProcessInfo.processInfo.arguments.count {
                let uid = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!
                auth.debugSet(phase: .authenticated(userId: uid), profile: Profile(id: uid,
                    displayName: ProcessInfo.processInfo.arguments[index + 1]))
            }
            store.bind(userId: "visual-qa"); await store.refresh()
            if ProcessInfo.processInfo.arguments.contains("-bakeAchievementThumbnails") {
                do { try await AchievementNativeBake.run() } catch { print("Native achievement bake failed: \(error)") }
            }
        }
    }
}
private struct PreviewAchievementService: AchievementServing {
    func fetch() async throws -> AchievementSnapshot {
        let locked = ProcessInfo.processInfo.arguments.contains("-achievementLocked")
        let now = Date()
        return AchievementSnapshot(initializedAt: now, generatedAt: now,
            achievements: AchievementCatalog.definitions.enumerated().map { index, item in
                AchievementStatus(id: item.id, progress: 0.35, currentValue: floor(item.target * 0.35),
                    targetValue: item.target, earnedAt: locked ? nil : now.addingTimeInterval(Double(-index * 86400)),
                    isBackfilled: true)
            })
    }
    func record(_ activity: AchievementActivity) async throws -> AchievementSnapshot { try await fetch() }
    func acknowledge(_ ids: [String]) async throws {}
}
#endif
