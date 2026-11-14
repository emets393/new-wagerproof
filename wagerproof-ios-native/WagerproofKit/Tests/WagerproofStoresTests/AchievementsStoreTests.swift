import Foundation
import XCTest
import WagerproofModels
import WagerproofServices
@testable import WagerproofStores

@MainActor
final class AchievementsStoreTests: XCTestCase {
    private let date = Date(timeIntervalSince1970: 1_800_000_000)
    private func defaults() -> UserDefaults {
        let name = "AchievementsStoreTests.\(UUID())"
        addTeardownBlock { UserDefaults.standard.removePersistentDomain(forName: name) }
        return UserDefaults(suiteName: name)!
    }
    private func snapshot(_ offset: Double = 0, _ statuses: [AchievementStatus] = [], new: [String] = []) -> AchievementSnapshot {
        AchievementSnapshot(initializedAt: date, generatedAt: date.addingTimeInterval(offset), achievements: statuses, newlyUnlockedIds: new)
    }
    private func award(_ id: String = "first-agent", backfill: Bool = false) -> AchievementStatus {
        AchievementStatus(id: id, progress: 1, earnedAt: date, isBackfilled: backfill)
    }
    private func drainTasks() async { for _ in 0..<30 { await Task.yield() } }

    func testProgressCannotUnlockWithoutServerAward() async {
        let service = AchievementServiceMock([snapshot(0, [.init(id: "first-agent", progress: 1, currentValue: 50)])])
        let store = AchievementsStore(service: service, defaults: defaults()); store.bind(userId: "A")
        await store.refresh()
        XCTAssertEqual(store.achievement(id: "first-agent")?.fraction, 1)
        XCTAssertEqual(store.unlockedCount, 0)
        XCTAssertTrue(store.pendingCelebrations.isEmpty)
    }
    func testEarnedDateAndAttributionSurviveRegressionAndRelaunch() async {
        let agent = UUID(), prefs = defaults()
        let original = AchievementStatus(id: "first-agent", earnedAt: date, creditedAgentId: agent)
        let service = AchievementServiceMock([snapshot(0, [original]), snapshot(10)])
        let store = AchievementsStore(service: service, defaults: prefs); store.bind(userId: "A")
        await store.refresh(); await store.refresh()
        XCTAssertEqual(store.achievement(id: "first-agent")?.status.earnedAt, date)
        XCTAssertEqual(store.achievement(id: "first-agent")?.status.creditedAgentId, agent)
        let reopened = AchievementsStore(service: service, defaults: prefs); reopened.bind(userId: "a")
        XCTAssertEqual(reopened.unlockedCount, 1)
        XCTAssertEqual(reopened.achievement(id: "first-agent")?.status.creditedAgentId, agent)
        XCTAssertTrue(reopened.pendingCelebrations.isEmpty)
    }
    func testQuietBackfillAndUniqueCelebrationQueue() async {
        let service = AchievementServiceMock([
            snapshot(0, [award(backfill: true)], new: ["first-agent"]),
            snapshot(1, [award(backfill: true), award("first-follow")], new: ["first-follow", "first-follow"]),
            snapshot(2, [award(backfill: true), award("first-follow")], new: ["first-follow"]),
        ])
        let store = AchievementsStore(service: service, defaults: defaults()); store.bind(userId: "A")
        await store.refresh(); XCTAssertTrue(store.pendingCelebrations.isEmpty)
        await store.refresh(); await store.refresh()
        XCTAssertEqual(store.pendingCelebrations, ["first-follow"])
    }
    func testOlderSnapshotCannotRegressProgressOrCreateCelebration() async {
        let service = AchievementServiceMock([
            snapshot(10, [.init(id: "experience-10", progress: 0.7)]),
            snapshot(1, [award(), .init(id: "experience-10", progress: 0.2)], new: ["first-agent"]),
        ])
        let store = AchievementsStore(service: service, defaults: defaults()); store.bind(userId: "A")
        await store.refresh(); await store.refresh()
        XCTAssertEqual(store.achievement(id: "experience-10")?.fraction, 0.7)
        XCTAssertEqual(store.unlockedCount, 0)
        XCTAssertTrue(store.pendingCelebrations.isEmpty)
    }
    func testOfflineRefreshKeepsCachedCollectionAndDismissal() async {
        let prefs = defaults(), service = AchievementServiceMock([snapshot(0, [award()], new: ["first-agent"])])
        let store = AchievementsStore(service: service, defaults: prefs); store.bind(userId: "A")
        await store.refresh(); service.failAcknowledgments = true
        store.acknowledgeCelebration("first-agent"); await drainTasks()
        let reopened = AchievementsStore(service: service, defaults: prefs); reopened.bind(userId: "A")
        service.failFetch = true; await reopened.refresh()
        XCTAssertEqual(reopened.unlockedCount, 1)
        XCTAssertNotNil(reopened.errorMessage)
        XCTAssertTrue(reopened.pendingCelebrations.isEmpty)
        service.failFetch = false; service.responses = [snapshot(1, [award()], new: ["first-agent"])]
        await reopened.refresh()
        XCTAssertTrue(reopened.pendingCelebrations.isEmpty)
    }
    func testAccountSwitchClearsPrivateDataAndLateOldResponse() async {
        let service = AchievementServiceMock([])
        service.holdNextFetch = true
        let store = AchievementsStore(service: service, defaults: defaults()); store.bind(userId: "A")
        let oldRefresh = Task { await store.refresh() }
        while service.heldFetch == nil { await Task.yield() }
        store.bind(userId: "B")
        XCTAssertFalse(store.hasLoaded); XCTAssertEqual(store.unlockedCount, 0)
        service.responses = [snapshot(10)]
        await store.refresh()
        service.heldFetch?.resume(returning: snapshot(20, [award()], new: ["first-agent"]))
        service.heldFetch = nil; await oldRefresh.value
        XCTAssertEqual(store.userId, "b"); XCTAssertEqual(store.unlockedCount, 0)
        XCTAssertTrue(store.pendingCelebrations.isEmpty); XCTAssertFalse(store.isLoading)
        store.bind(userId: nil)
        XCTAssertNil(store.userId); XCTAssertFalse(store.hasLoaded)
    }
    func testDuplicateDismissalSendsOneAcknowledgment() async {
        let service = AchievementServiceMock([snapshot(0, [award()], new: ["first-agent"])])
        let store = AchievementsStore(service: service, defaults: defaults()); store.bind(userId: "A")
        await store.refresh()
        store.acknowledgeCelebration("first-agent"); store.acknowledgeCelebration("first-agent")
        await drainTasks()
        XCTAssertEqual(service.acknowledgments, [["first-agent"]])
        XCTAssertTrue(store.pendingCelebrations.isEmpty)
    }
    func testQueuedAcknowledgmentCannotRunForNextAccount() async {
        let service = AchievementServiceMock([snapshot(0, [award()], new: ["first-agent"])])
        let store = AchievementsStore(service: service, defaults: defaults()); store.bind(userId: "A")
        await store.refresh()
        store.acknowledgeCelebration("first-agent")
        store.bind(userId: "B") // Change before the unstructured acknowledgment task starts.
        await drainTasks()
        XCTAssertTrue(service.acknowledgments.isEmpty)
    }
    func testFailedActivityRetriesOnNextRefresh() async {
        let service = AchievementServiceMock([]); service.failRecord = true
        let store = AchievementsStore(service: service, defaults: defaults()); store.bind(userId: "A")
        await store.record(.props)
        XCTAssertNotNil(store.errorMessage)
        service.failRecord = false; service.responses = [snapshot(1, [award("props-scout")], new: ["props-scout"])]
        await store.refresh()
        XCTAssertEqual(service.activities, [.props, .props])
        XCTAssertEqual(store.pendingCelebrations, ["props-scout"])
    }

    func testOfflineActivitySurvivesRelaunchReplaysOnceAndIsAccountIsolated() async {
        let prefs = defaults()
        let offlineService = AchievementServiceMock([]); offlineService.failRecord = true
        let original = AchievementsStore(service: offlineService, defaults: prefs)
        original.bind(userId: "A")
        await original.record(.historicalAnalysis)
        XCTAssertNotNil(original.errorMessage)

        let onlineService = AchievementServiceMock([snapshot(1)])
        let reopened = AchievementsStore(service: onlineService, defaults: prefs)
        reopened.bind(userId: "B")
        await reopened.refresh()
        XCTAssertTrue(onlineService.activities.isEmpty, "Another account must not replay A's event")

        reopened.bind(userId: "a")
        onlineService.responses = [snapshot(2, [award("trend-explorer")], new: ["trend-explorer"])]
        await reopened.refresh()
        XCTAssertEqual(onlineService.activities, [.historicalAnalysis])
        XCTAssertEqual(reopened.pendingCelebrations, ["trend-explorer"])

        let nextLaunch = AchievementsStore(service: onlineService, defaults: prefs)
        nextLaunch.bind(userId: "A")
        onlineService.responses = [snapshot(3, [award("trend-explorer")])]
        await nextLaunch.refresh()
        XCTAssertEqual(onlineService.activities, [.historicalAnalysis], "Successful replay clears durable pending event")
        XCTAssertEqual(nextLaunch.unlockedCount, 1)
    }
}

@MainActor
private final class AchievementServiceMock: AchievementServing {
    enum Failure: Error { case offline }
    var responses: [AchievementSnapshot]
    var acknowledgments: [[String]] = []
    var activities: [AchievementActivity] = []
    var failFetch = false, failRecord = false, failAcknowledgments = false
    var holdNextFetch = false
    var heldFetch: CheckedContinuation<AchievementSnapshot, Error>?
    init(_ responses: [AchievementSnapshot]) { self.responses = responses }
    func fetch() async throws -> AchievementSnapshot {
        if holdNextFetch {
            holdNextFetch = false
            return try await withCheckedThrowingContinuation { heldFetch = $0 }
        }
        if failFetch { throw Failure.offline }
        return responses.removeFirst()
    }
    func record(_ activity: AchievementActivity) async throws -> AchievementSnapshot {
        activities.append(activity)
        if failRecord { throw Failure.offline }
        return responses.removeFirst()
    }
    func acknowledge(_ ids: [String]) async throws {
        acknowledgments.append(ids)
        if failAcknowledgments { throw Failure.offline }
    }
}
