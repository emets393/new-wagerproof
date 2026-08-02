import Foundation
import XCTest
@testable import WagerproofStores

@MainActor
final class ReviewPromptCoordinatorTests: XCTestCase {
    func testGeneratedPicksRequireTwoViewsAndOnlyAttemptOncePerVersion() {
        let defaults = makeDefaults()
        let coordinator = makeCoordinator(defaults: defaults)

        coordinator.recordGeneratedPicksViewed()
        XCTAssertNil(coordinator.pendingRequest)

        coordinator.recordGeneratedPicksViewed()
        let request = tryUnwrap(coordinator.pendingRequest)
        XCTAssertEqual(request.trigger, .generatedPicksViewed)
        XCTAssertTrue(coordinator.claim(request))

        coordinator.recordSystemSaved()
        XCTAssertNil(coordinator.pendingRequest)
    }

    func testSaveAndCompletedShareAreImmediateHighConfidenceSignals() {
        let saveCoordinator = makeCoordinator(defaults: makeDefaults())
        saveCoordinator.recordSystemSaved()
        XCTAssertEqual(saveCoordinator.pendingRequest?.trigger, .systemSaved)

        let shareCoordinator = makeCoordinator(defaults: makeDefaults())
        shareCoordinator.recordContentShared()
        XCTAssertEqual(shareCoordinator.pendingRequest?.trigger, .contentShared)
    }

    func testResearchDepthRequiresThreeDetailsAcrossTwoActiveDays() {
        let defaults = makeDefaults()
        var date = Date(timeIntervalSince1970: 1_800_000_000)
        let coordinator = makeCoordinator(defaults: defaults, now: { date })

        coordinator.recordAppActive()
        coordinator.recordResearchDetailViewed()
        coordinator.recordResearchDetailViewed()
        XCTAssertNil(coordinator.pendingRequest)

        date = date.addingTimeInterval(24 * 60 * 60)
        coordinator.recordAppActive()
        coordinator.recordResearchDetailViewed()
        XCTAssertEqual(coordinator.pendingRequest?.trigger, .researchDepthReached)
    }

    func testSecondExistingAgentAndLaterSessionRevisitAreEligible() {
        let secondAgentCoordinator = makeCoordinator(defaults: makeDefaults(), sessionID: "session-a")
        secondAgentCoordinator.recordAgentCreated(agentID: "agent-2", totalAgentCount: 2)
        XCTAssertEqual(secondAgentCoordinator.pendingRequest?.trigger, .secondAgentCreated)

        let revisitDefaults = makeDefaults()
        let creationCoordinator = makeCoordinator(defaults: revisitDefaults, sessionID: "creation-session")
        creationCoordinator.recordAgentCreated(agentID: "agent-1", totalAgentCount: 1)
        creationCoordinator.recordAgentDetailViewed(agentID: "agent-1")
        XCTAssertNil(creationCoordinator.pendingRequest)

        let returnCoordinator = makeCoordinator(defaults: revisitDefaults, sessionID: "return-session")
        returnCoordinator.recordAgentDetailViewed(agentID: "agent-1")
        XCTAssertEqual(returnCoordinator.pendingRequest?.trigger, .createdAgentRevisited)
    }

    func testManualReviewIntentSuppressesAutomaticRequests() {
        let coordinator = makeCoordinator(defaults: makeDefaults())
        coordinator.recordManualReviewLinkOpened()
        coordinator.recordSystemSaved()
        coordinator.recordContentShared()
        XCTAssertNil(coordinator.pendingRequest)
    }

    func testNewVersionStillHonorsOneHundredTwentyDayCooldown() {
        let defaults = makeDefaults()
        var date = Date(timeIntervalSince1970: 1_800_000_000)
        var version = "1.0"
        let coordinator = ReviewPromptCoordinator(
            defaults: defaults,
            now: { date },
            appVersion: { version },
            sessionID: "session"
        )

        coordinator.recordSystemSaved()
        XCTAssertTrue(coordinator.claim(tryUnwrap(coordinator.pendingRequest)))

        version = "1.1"
        date = date.addingTimeInterval(30 * 24 * 60 * 60)
        coordinator.recordContentShared()
        XCTAssertNil(coordinator.pendingRequest)

        date = date.addingTimeInterval(91 * 24 * 60 * 60)
        coordinator.recordContentShared()
        XCTAssertEqual(coordinator.pendingRequest?.trigger, .contentShared)
    }

    private func makeCoordinator(
        defaults: UserDefaults,
        now: @escaping () -> Date = { Date(timeIntervalSince1970: 1_800_000_000) },
        sessionID: String = "session"
    ) -> ReviewPromptCoordinator {
        ReviewPromptCoordinator(
            defaults: defaults,
            now: now,
            appVersion: { "1.0" },
            sessionID: sessionID
        )
    }

    private func makeDefaults() -> UserDefaults {
        let suite = "ReviewPromptCoordinatorTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defaults.removePersistentDomain(forName: suite)
        return defaults
    }

    private func tryUnwrap<T>(
        _ value: T?,
        file: StaticString = #filePath,
        line: UInt = #line
    ) -> T {
        guard let value else {
            XCTFail("Expected non-nil value", file: file, line: line)
            fatalError("Expected non-nil value")
        }
        return value
    }
}
